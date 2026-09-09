// Samithi (tenant) context: resolved once from the join code through the
// same-origin directory proxy and remembered on this device. Nothing here is
// secret; the session cookie and access token live in lib/api/session.ts.
export interface SamithiContext {
  code: string
  slug: string
  name: string
  api_url: string
  status?: string
  maintenance?: { message?: string } | null
  app_url?: string | null
}

const KEY = 'esamithi.web.samithi'

export function loadSamithi(): SamithiContext | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SamithiContext
    return parsed && parsed.slug && parsed.code ? parsed : null
  } catch {
    return null
  }
}

export function saveSamithi(ctx: SamithiContext): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ctx))
  } catch {
    /* storage blocked */
  }
}

export function clearSamithi(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export const apiBase = (): string => `${window.location.origin}/api/v1`
export const directoryBase = (): string => `${window.location.origin}/directory/v1`

export class DirectoryError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'DirectoryError'
    this.status = status
  }
}

export async function resolveSamithi(code: string): Promise<SamithiContext> {
  const clean = code.trim().toUpperCase()
  let res: Response
  try {
    res = await fetch(`${directoryBase()}/resolve/${encodeURIComponent(clean)}`, { headers: { Accept: 'application/json' } })
  } catch {
    throw new DirectoryError(0, 'network')
  }
  const body = (await res.json().catch(() => ({}))) as Partial<SamithiContext> & { error?: string }
  if (!res.ok || !body.slug || !body.api_url) {
    throw new DirectoryError(res.status, body.error || 'not_found')
  }
  return {
    code: clean,
    slug: body.slug,
    name: body.name || body.slug,
    api_url: body.api_url,
    status: body.status,
    maintenance: body.maintenance ?? null,
    app_url: body.app_url ?? null
  }
}

// Which API origins does THIS app host serve? Empty (dev) accepts any.
function allowedApiOrigins(): string[] {
  return String(import.meta.env.VITE_API_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function apiOriginOf(apiUrl: string): string | null {
  try {
    return new URL(apiUrl).origin
  } catch {
    return null
  }
}

export function isServedHere(ctx: SamithiContext): boolean {
  const allowed = allowedApiOrigins()
  if (allowed.length === 0) return true
  const origin = apiOriginOf(ctx.api_url)
  return origin !== null && allowed.includes(origin)
}

// Fallback until the platform publishes servers.app_url in the resolve response
const HOST_MAP: Record<string, string> = {
  'https://api.esamithi.com': 'https://app.esamithi.com/',
  'http://141.147.75.132': 'https://app.esamithi.com/',
  'http://212.227.103.150': 'https://console.esamithi.com/app/',
  'https://console.esamithi.com': 'https://console.esamithi.com/app/'
}

export function appUrlFor(ctx: SamithiContext): string | null {
  if (ctx.app_url) return ctx.app_url
  const origin = apiOriginOf(ctx.api_url)
  return origin ? (HOST_MAP[origin] ?? null) : null
}
