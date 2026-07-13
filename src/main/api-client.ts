import axios, { AxiosInstance } from 'axios'
import fs from 'fs'
import path from 'path'
import { app, BrowserWindow } from 'electron'

function broadcast(channel: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel)
  }
}

class ApiClient {
  private instance: AxiosInstance
  private token: string | null = null
  private configPath: string
  private offline = false

  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'server.config.json')
    const config = this.loadConfig()
    
    this.instance = axios.create({
      baseURL: config.api_url || 'http://141.147.75.132/api/v1',
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json'
      }
    })

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
            broadcast('network:offline')
          }
          error.message = 'Cannot reach the server. Check your network connection.'
        }
        return Promise.reject(error)
      }
    )
  }

  private loadConfig() {
    const DEFAULT_URL = 'http://141.147.75.132/api/v1'

    // Dev mode (`npm run dev`): the repo-root server.config.json is the
    // single source of truth — edit its "env" (prod | testbed) and restart.
    // Packaged builds ignore this branch and keep the per-machine AppData
    // config, so field installs can never be flipped by a repo edit.
    if (!app.isPackaged) {
      const rootPath = path.join(app.getAppPath(), 'server.config.json')
      try {
        if (fs.existsSync(rootPath)) {
          const rootCfg = JSON.parse(fs.readFileSync(rootPath, 'utf-8'))
          if (rootCfg.env && rootCfg.environments && rootCfg.environments[rootCfg.env]) {
            rootCfg.api_url = rootCfg.environments[rootCfg.env]
          }
          if (rootCfg.api_url) {
            console.log(`[api] dev mode: using "${rootCfg.env ?? 'api_url'}" → ${rootCfg.api_url}`)
            return rootCfg
          }
        }
      } catch (err) {
        console.error('[api] dev config unreadable, falling back to AppData:', err)
      }
    }

    try {
      if (fs.existsSync(this.configPath)) {
        const config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'))
        // Force upgrade if they have the old server IP cached in their AppData
        if (config.api_url && config.api_url.includes('152.67.128.248')) {
          config.api_url = DEFAULT_URL
          fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2))
        }
        // Named environments win over the flat api_url: set "env" to one of
        // the keys in "environments" (e.g. "prod" | "testbed") to switch.
        if (config.env && config.environments && config.environments[config.env]) {
          config.api_url = config.environments[config.env]
        }
        return config
      } else {
        // Create the file with default URL if it doesn't exist
        fs.writeFileSync(this.configPath, JSON.stringify({ api_url: DEFAULT_URL }, null, 2))
      }
    } catch (err) {
      console.error('Failed to load server.config.json:', err)
    }
    // Default config if file missing or error
    return { api_url: DEFAULT_URL }
  }

  private markOnline(): void {
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
