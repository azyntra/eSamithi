import { api, getAccessToken } from '../api'

interface Impersonation {
  token: string
  api_url: string
  /** This server's office web app, or null while it still uses /workspace/ */
  app_url: string | null
  slug: string
  sid: string
  expires_at: string
}

// Mint an impersonation token and hand off to the support workspace. The
// session (incl. token) is passed via a one-time URL hash the target consumes
// then strips — the token never lives in browser history.
//
// Where it goes depends on the server the society is on. Once that server row
// has an app_url, its operators land in the office web app's /support route;
// until then they land in the legacy /workspace/ bundle, which stays deployed.
// Setting or clearing app_url switches this either way with no deploy.
export async function enterSamithi(slug: string, name: string, actorEmail: string): Promise<void> {
  const d = await api<Impersonation>(`/samithis/${slug}/impersonate`, { method: 'POST' })
  // Keep the panel refresh token reachable so the workspace "Exit" can revoke
  void getAccessToken()

  if (d.app_url) {
    // The web app is on another origin and holds no platform credentials, so
    // it cannot revoke anything itself: its "Exit" sends the operator back
    // here with the sid, and Layout ends the session under this login.
    const payload = encode({ token: d.token, slug: d.slug, console: window.location.origin })
    window.location.href = `${d.app_url.replace(/\/+$/, '')}/support#s=${payload}`
    return
  }

  const session = {
    token: d.token, apiUrl: d.api_url, slug: d.slug, name,
    sid: d.sid, expiresAt: d.expires_at, actorEmail
  }
  // ?v= cache-buster: guarantees a fresh workspace.html (a heuristically
  // cached copy would pin the user to an old bundle)
  window.location.href = `/workspace/workspace.html?v=${Date.now()}#s=${encode(session)}`
}

function encode(session: unknown): string {
  return encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(session)))))
}

// The web app's "Exit samithi" returns to /admin/#/?exit=<sid>. Revoking needs
// super-admin credentials, which only exist here, so this is where it happens.
// Best-effort by design: a session nobody revokes still dies on its own hour.
export async function revokeImpersonation(sid: string): Promise<void> {
  await api(`/impersonations/${sid}`, { method: 'DELETE' })
}
