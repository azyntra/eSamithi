import axios, { AxiosInstance } from 'axios'
import fs from 'fs'
import path from 'path'
import { app, BrowserWindow } from 'electron'

// Multi-samithi: instead of a hardcoded server IP, each office resolves its
// samithi join code against the directory service once, and the resolved
// { code, samithi(slug), name, api_url } is persisted per machine. Legacy
// configs (api_url only, no samithi) keep working against their server's
// default tenant until the office is onboarded with a code.
const DEFAULT_DIRECTORY = 'http://212.227.103.150/directory'
const RE_RESOLVE_AFTER_MS = 3 * 60 * 1000 // unreachable this long → ask the directory again (failover)
const RE_RESOLVE_EVERY_MS = 60 * 1000

interface ServerConfig {
  api_url?: string
  samithi?: string
  code?: string
  name?: string
  directory_url?: string
  // dev-mode niceties (repo-root server.config.json)
  env?: string
  environments?: Record<string, string>
  samithis?: Record<string, string>
}

function broadcast(channel: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel)
  }
}

class ApiClient {
  private instance: AxiosInstance
  private token: string | null = null
  private configPath: string
  private config: ServerConfig
  private offline = false
  private offlineSince: number | null = null
  private lastReResolve = 0

  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'server.config.json')
    this.config = this.loadConfig()

    this.instance = axios.create({
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' }
    })
    this.applyConfig()

    // Request interceptor for JWT
    this.instance.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`
      }
      return config
    })

    // Session expiry: a 401 after login means the JWT has expired —
    // clear it and tell the renderer to return to the login screen.
    // Network failures (no response at all) flip a single offline flag so the
    // renderer can show one "server unreachable" bar instead of raw axios noise.
    this.instance.interceptors.response.use(
      (response) => {
        this.markOnline()
        return response
      },
      (error) => {
        if (error.response) {
          this.markOnline() // the server answered — we are reachable
          if (error.response.status === 401 && this.token) {
            this.token = null
            broadcast('auth:session-expired')
          }
        } else {
          if (!this.offline) {
            this.offline = true
            this.offlineSince = Date.now()
            broadcast('network:offline')
          }
          void this.maybeReResolve()
          error.message = 'Cannot reach the server. Check your network connection.'
        }
        return Promise.reject(error)
      }
    )
  }

  private loadConfig(): ServerConfig {
    // Dev mode (`npm run dev`): the repo-root server.config.json is the
    // single source of truth — edit its "env" (prod | testbed) and restart.
    // Packaged builds ignore this branch and keep the per-machine AppData
    // config, so field installs can never be flipped by a repo edit.
    if (!app.isPackaged) {
      const rootPath = path.join(app.getAppPath(), 'server.config.json')
      try {
        if (fs.existsSync(rootPath)) {
          const rootCfg: ServerConfig = JSON.parse(fs.readFileSync(rootPath, 'utf-8'))
          if (rootCfg.env && rootCfg.environments?.[rootCfg.env]) {
            rootCfg.api_url = rootCfg.environments[rootCfg.env]
          }
          if (rootCfg.env && rootCfg.samithis?.[rootCfg.env]) {
            rootCfg.samithi = rootCfg.samithis[rootCfg.env]
          }
          if (rootCfg.api_url) {
            console.log(`[api] dev mode: using "${rootCfg.env ?? 'api_url'}" → ${rootCfg.api_url} (samithi: ${rootCfg.samithi ?? '—'})`)
            return rootCfg
          }
        }
      } catch (err) {
        console.error('[api] dev config unreadable, falling back to AppData:', err)
      }
    }

    try {
      if (fs.existsSync(this.configPath)) {
        const config: ServerConfig = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'))
        // Named environments win over the flat api_url: set "env" to one of
        // the keys in "environments" (e.g. "prod" | "testbed") to switch.
        if (config.env && config.environments?.[config.env]) {
          config.api_url = config.environments[config.env]
        }
        if (config.env && config.samithis?.[config.env]) {
          config.samithi = config.samithis[config.env]
        }
        return config
      }
    } catch (err) {
      console.error('Failed to load server.config.json:', err)
    }
    // No config at all → first run: the renderer shows the samithi-code
    // setup screen (no more hardcoded default server)
    return {}
  }

  private persistConfig(): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2))
    } catch (err) {
      console.error('Failed to persist server.config.json:', err)
    }
  }

  private applyConfig(): void {
    this.instance.defaults.baseURL = this.config.api_url
    if (this.config.samithi) {
      this.instance.defaults.headers['X-Samithi'] = this.config.samithi
    } else {
      delete this.instance.defaults.headers['X-Samithi']
    }
  }

  // First-run setup and Settings → change samithi. Resolves a join code via
  // the directory and makes it this machine's server config.
  public async resolveSamithi(code: string): Promise<{ slug: string; name: string; api_url: string }> {
    const clean = String(code || '').trim().toUpperCase()
    if (!/^[A-Z0-9-]{2,20}$/.test(clean)) {
      throw new Error('Enter a valid samithi code (e.g. TST-2481)')
    }
    const directory = this.config.directory_url || DEFAULT_DIRECTORY
    let record: { slug: string; name: string; api_url: string; status: string }
    try {
      const res = await axios.get(`${directory}/v1/resolve/${clean}`, { timeout: 10000 })
      record = res.data
    } catch (err: any) {
      if (err.response?.status === 404) {
        throw new Error('Unknown samithi code. Please check the code with your society office.')
      }
      throw new Error('Cannot reach the samithi directory. Check your internet connection.')
    }
    if (record.status !== 'active') {
      throw new Error('This samithi is not active. Please contact eSamithi support.')
    }
    this.config = {
      ...this.config,
      code: clean,
      samithi: record.slug,
      name: record.name,
      api_url: record.api_url
    }
    this.persistConfig()
    this.applyConfig()
    return record
  }

  public getSetupState(): { configured: boolean; code: string | null; name: string | null; api_url: string | null } {
    return {
      configured: Boolean(this.config.api_url),
      code: this.config.code ?? null,
      name: this.config.name ?? null,
      api_url: this.config.api_url ?? null
    }
  }

  // Failover without app updates (multi-samithi plan §2.7): after a few
  // minutes unreachable, ask the directory whether our samithi moved and
  // follow its api_url if it changed.
  private async maybeReResolve(): Promise<void> {
    if (!this.config.code || !this.offlineSince) return
    const now = Date.now()
    if (now - this.offlineSince < RE_RESOLVE_AFTER_MS) return
    if (now - this.lastReResolve < RE_RESOLVE_EVERY_MS) return
    this.lastReResolve = now
    try {
      const directory = this.config.directory_url || DEFAULT_DIRECTORY
      const res = await axios.get(`${directory}/v1/resolve/${this.config.code}`, { timeout: 10000 })
      if (res.data?.api_url && res.data.api_url !== this.config.api_url) {
        console.log(`[api] directory moved ${this.config.code}: ${this.config.api_url} → ${res.data.api_url}`)
        this.config.api_url = res.data.api_url
        this.config.samithi = res.data.slug ?? this.config.samithi
        this.persistConfig()
        this.applyConfig()
      }
    } catch {
      // directory also unreachable — keep waiting
    }
  }

  private markOnline(): void {
    this.offlineSince = null
    if (this.offline) {
      this.offline = false
      broadcast('network:online')
    }
  }

  public setToken(token: string | null) {
    this.token = token
  }

  // Reachability probe for the offline bar's Retry button. A 4xx/5xx still
  // proves the server is up, so only a missing response counts as offline.
  public async ping(): Promise<boolean> {
    try {
      await this.instance.get('/health', { timeout: 5000 })
      return true
    } catch (err: any) {
      return !!err.response
    }
  }

  public async get(url: string, params?: any) {
    const response = await this.instance.get(url, { params })
    return response.data
  }

  public async post(url: string, data?: any) {
    const response = await this.instance.post(url, data)
    return response.data
  }

  public async put(url: string, data?: any) {
    const response = await this.instance.put(url, data)
    return response.data
  }

  public async patch(url: string, data?: any) {
    const response = await this.instance.patch(url, data)
    return response.data
  }

  public async delete(url: string) {
    const response = await this.instance.delete(url)
    return response.data
  }
}

export const apiClient = new ApiClient()
