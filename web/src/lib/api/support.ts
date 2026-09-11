// Support mode (operator impersonation) — requirements FR-15.
//
// The platform console mints a 60-minute tenant token and hands it to this app
// in a one-time URL fragment. We take it out of the address bar immediately: a
// fragment is never sent to a server, but it would otherwise sit in history,
// in a screenshot, and in whatever the operator pastes into a support ticket.
//
// Nothing in the payload is believed except the token. Everything the banner
// shows is read back from GET /auth/me, which only returns a `support` block
// for a token the tenant API has verified and the platform has not revoked —
// so a hand-written fragment cannot fake a support session, it can only fail.
export interface SupportHandoff {
  token: string
  slug: string
  /** Where "Exit" sends the operator. Origin only — see consoleOrigin(). */
  returnTo: string | null
}

const KEY = 'esamithi.web.support'

// Survives a reload of this tab and dies with it, like the workspace it
// replaces. The module copy covers browsers that refuse session storage.
let cached: SupportHandoff | null = null

// The console writes its own origin into the payload, so this can only be
// wrong if someone hand-edits a fragment — which needs a valid token, i.e. an
// operator. Reducing it to scheme + host anyway means the worst a doctored
// link can do is send that operator's own browser to a different front page.
function consoleOrigin(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw) return null
  try {
    const u = new URL(raw)
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1'
    return u.protocol === 'https:' || (u.protocol === 'http:' && local) ? u.origin : null
  } catch {
    return null
  }
}

function decode(fragment: string): unknown {
  // The console percent-encodes the base64 (+ / = are meaningful in a
  // fragment); that layer comes off BEFORE atob, or any payload containing
  // %2B, %2F or %3D throws and the session silently drops.
  let raw = fragment
  try {
    raw = decodeURIComponent(raw)
  } catch {
    /* an older console linked the raw base64 */
  }
  const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

function store(handoff: SupportHandoff): void {
  cached = handoff
  try {
    sessionStorage.setItem(KEY, JSON.stringify(handoff))
  } catch {
    /* storage blocked: this page load only */
  }
}

function stripFragment(): void {
  try {
    history.replaceState(null, '', window.location.pathname + window.location.search)
  } catch {
    /* nothing we can do; the token is short-lived and revocable */
  }
}

/**
 * Read a handoff out of the URL fragment, remember it and clean the address
 * bar. Must run before the router mounts, so the fragment never becomes part
 * of a route. Returns whatever session this tab now has, new or existing.
 */
export function consumeHandoff(): SupportHandoff | null {
  const m = /[#&]s=([^&]+)/.exec(window.location.hash)
  if (!m) return loadHandoff()
  try {
    const p = decode(m[1]!) as { token?: unknown; slug?: unknown; console?: unknown }
    if (typeof p.token === 'string' && p.token && typeof p.slug === 'string' && p.slug) {
      store({ token: p.token, slug: p.slug, returnTo: consoleOrigin(p.console) })
    }
  } catch {
    /* malformed: keep whatever this tab already had */
  }
  stripFragment()
  return loadHandoff()
}

export function loadHandoff(): SupportHandoff | null {
  if (cached) return cached
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SupportHandoff
    if (!parsed?.token || !parsed?.slug) return null
    cached = parsed
    return parsed
  } catch {
    return null
  }
}

export function clearHandoff(): void {
  cached = null
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
