import { api, getAccessToken } from '../api'

// Mint an impersonation token and hand off to the support workspace. The
// session (incl. token) is passed via a one-time URL hash the workspace
// consumes then strips — the token never lives in browser history.
export async function enterSamithi(slug: string, name: string, actorEmail: string): Promise<void> {
  const d = await api<{ token: string; api_url: string; slug: string; sid: string; expires_at: string }>(
    `/samithis/${slug}/impersonate`,
    { method: 'POST' }
  )
  const session = {
    token: d.token, apiUrl: d.api_url, slug: d.slug, name,
    sid: d.sid, expiresAt: d.expires_at, actorEmail
  }
  // Keep the panel refresh token reachable so the workspace "Exit" can revoke
  void getAccessToken()
  const payload = btoa(unescape(encodeURIComponent(JSON.stringify(session))))
  window.location.href = '/workspace/workspace.html#s=' + encodeURIComponent(payload)
}
