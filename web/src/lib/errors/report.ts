import { apiBase } from '@/lib/api/samithi'
import { getSessionState } from '@/lib/api/session'

// A render crash in an office is a screenshot in a chat, hours later, with
// the stack long gone. The tenant API already keeps client_errors for the
// mobile app — same table, same retention, auth optional — so the web app
// files its own crashes there and the row names the samithi, the version and
// the route. One report per distinct crash per tab; the endpoint is rate
// limited and a render loop must not turn into a flood.
const filed = new Set<string>()

export function reportCrash(error: unknown, context: string, fatal = true): void {
  try {
    const message = error instanceof Error ? error.message : String(error ?? 'unknown error')
    const key = `${message}|${context}`
    if (filed.has(key)) return
    filed.add(key)
    const slug = getSessionState().samithi?.slug
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (slug) headers['X-Samithi'] = slug
    void fetch(`${apiBase()}/client-errors`, {
      method: 'POST',
      headers,
      keepalive: true,
      body: JSON.stringify({
        platform: 'web',
        app_version: __APP_VERSION__,
        is_fatal: fatal,
        message: message.slice(0, 500),
        stack: error instanceof Error ? error.stack : undefined,
        context: context.slice(0, 200)
      })
    }).catch(() => undefined)
  } catch {
    /* reporting must never be the second crash */
  }
}
