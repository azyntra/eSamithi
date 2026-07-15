import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './App.css'
import { initTheme } from './utils/theme'
import { installShim, loadSession, clearSession, type WorkspaceSession } from './workspace/shim'

initTheme()

// The super-admin panel hands off the impersonation session via a one-time
// URL hash (#s=<base64 json>); we stash it in sessionStorage and clean the URL
// so the token never lingers in the address bar or history.
function bootstrapSession(): WorkspaceSession | null {
  const hash = window.location.hash
  const m = hash.match(/[#&]s=([^&]+)/)
  if (m) {
    try {
      // enter.ts percent-encodes the base64 (+ / = would otherwise be mangled
      // in the fragment) — decode that layer BEFORE atob, else any payload
      // containing %2B/%2F/%3D throws and the session silently drops.
      let b64 = m[1]
      try { b64 = decodeURIComponent(b64) } catch { /* raw base64 from older links */ }
      const decoded = JSON.parse(decodeURIComponent(escape(atob(b64)))) as WorkspaceSession
      sessionStorage.setItem('esamithi.workspace', JSON.stringify(decoded))
      history.replaceState(null, '', window.location.pathname)
      return decoded
    } catch {
      /* fall through to existing session */
    }
  }
  return loadSession()
}

// Non-dismissable banner while impersonating (FR-5.3): who, which samithi,
// countdown, exit. Exit revokes the session on the platform side.
function SupportBanner({ session }: { session: WorkspaceSession }): React.ReactElement {
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    const tick = (): void => {
      const ms = new Date(session.expiresAt).getTime() - Date.now()
      if (ms <= 0) { clearSession(); window.location.href = '/admin/'; return }
      const m = Math.floor(ms / 60000)
      const s = Math.floor((ms % 60000) / 1000)
      setRemaining(`${m}:${String(s).padStart(2, '0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [session.expiresAt])

  const exit = async (): Promise<void> => {
    const panelRefresh = sessionStorage.getItem('esamithi.pa.refresh')
    if (panelRefresh) {
      // Best-effort revoke through the panel API (same origin)
      try {
        const r = await fetch('/pa/v1/auth/refresh', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: panelRefresh })
        })
        if (r.ok) {
          const d = await r.json()
          await fetch(`/pa/v1/impersonations/${session.sid}`, {
            method: 'DELETE', headers: { Authorization: `Bearer ${d.token}` }
          })
        }
      } catch { /* revocation also happens on expiry */ }
    }
    clearSession()
    window.location.href = '/admin/'
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
      background: '#b91c1c', color: '#fff', padding: '7px 16px',
      display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, fontWeight: 600,
      boxShadow: '0 2px 8px rgba(0,0,0,.3)'
    }}>
      <span>⚠ Super Admin support session — inside <b>{session.name}</b> as {session.actorEmail}</span>
      <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', opacity: 0.9 }}>ends in {remaining}</span>
      <button onClick={exit} style={{
        background: '#fff', color: '#b91c1c', border: 0, borderRadius: 6,
        padding: '4px 12px', fontWeight: 700, cursor: 'pointer'
      }}>Exit samithi</button>
    </div>
  )
}

function Root(): React.ReactElement {
  return (
    <>
      <SupportBanner session={activeSession!} />
      <App />
    </>
  )
}

const activeSession = bootstrapSession()

if (!activeSession) {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <div style={{ padding: 40, fontFamily: 'system-ui', textAlign: 'center' }}>
      <h2>No active support session</h2>
      <p>Open a samithi from the <a href="/admin/">platform console</a>.</p>
    </div>
  )
} else {
  installShim(activeSession)
  // Pre-authenticate the desktop App (skips its login screen) and offset the
  // whole fixed layout below the 34px support banner.
  ;(globalThis as { __IMPERSONATION__?: unknown }).__IMPERSONATION__ = {
    user: { id: 0, username: activeSession.actorEmail, full_name: 'eSamithi Support', role: 'admin' }
  }
  const style = document.createElement('style')
  style.textContent = `
    .sidebar { top: 34px !important; height: calc(100vh - 34px) !important; }
    .app-layout { height: calc(100vh - 34px) !important; margin-top: 34px !important; }
  `
  document.head.appendChild(style)
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>
  )
}
