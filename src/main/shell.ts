import { app, shell, BrowserWindow, session } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initUpdater } from './updater'

// eSamithi thin shell (Phase 5). Built with ESAMITHI_SHELL=1; not the default entry.
//
// Everything this window shows comes from https://app.esamithi.com. The office
// keeps its desktop icon, its taskbar entry and its silent auto-update, and
// gets the web application inside them. There is no local database, no API
// client and no IPC surface any more: the renderer that needed them is frozen
// in git, and 1.3.9 rebuilt from it is the rollback if this shell ever has to
// be withdrawn.
//
// Four things this shell must get right, because a browser would do them for
// free and an Electron window would not:
//   · the session survives a restart — a persistent partition, so the refresh
//     cookie is still there tomorrow morning and nobody signs in twice a day
//   · it can only ever show the app — any other address opens in the real
//     browser instead, so a stray link cannot strand the window somewhere
//   · it says what it is — the user-agent suffix is how the API tells a shell
//     sign-in from a browser one, and how the app knows to hide "install"
//   · it survives the internet going away — a lost connection shows a page
//     that keeps trying, rather than Chromium's error screen
const APP_URL = (is.dev && process.env.ESAMITHI_APP_URL) || 'https://app.esamithi.com/'
const APP_ORIGIN = new URL(APP_URL).origin
const PARTITION = 'persist:esamithi-web'
const RETRY_MS = 5000

function offlinePage(): string {
  // Inline rather than packaged: a file that fails to ship would turn a lost
  // connection into a blank window. Both languages, because the office reads
  // Sinhala and the message appears exactly when nothing else can be loaded.
  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>eSamithi</title><style>
  :root { color-scheme: light }
  body { margin:0; height:100vh; display:grid; place-items:center; background:#F5F7FA;
         font-family:-apple-system,Segoe UI,system-ui,sans-serif; color:#0F172A }
  .card { text-align:center; max-width:30rem; padding:2rem }
  .mark { width:56px; height:56px; margin:0 auto 1.25rem; border-radius:16px; background:#1E64D4;
          color:#fff; font-weight:700; font-size:20px; display:grid; place-items:center }
  h1 { font-size:1.25rem; margin:0 0 .5rem }
  p { margin:.25rem 0; color:#475569; line-height:1.6 }
  .si { font-size:.95rem }
  .dots { margin-top:1.5rem; color:#94A3B8; font-size:.8rem }
</style></head><body><div class="card">
  <div class="mark">eS</div>
  <h1>Waiting for the connection</h1>
  <p>eSamithi cannot reach the internet right now. It will connect by itself as soon as the connection is back.</p>
  <p class="si">දැනට අන්තර්ජාල සම්බන්ධතාවය නොමැත. සම්බන්ධතාවය නැවත ලැබුණු වහාම eSamithi ස්වයංක්‍රීයව සම්බන්ධ වේ.</p>
  <p class="dots">Trying again every few seconds…</p>
</div></body></html>`
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: 'eSamithi',
    backgroundColor: '#F5F7FA',
    autoHideMenuBar: true,
    webPreferences: {
      partition: PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  })

  win.on('ready-to-show', () => win.show())

  // Anything that is not the app belongs in the user's own browser
  const external = (url: string): boolean => {
    if (url.startsWith(APP_ORIGIN)) return false
    if (/^https?:/i.test(url)) void shell.openExternal(url)
    return true
  }
  win.webContents.setWindowOpenHandler(({ url }) => {
    external(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (external(url)) event.preventDefault()
  })

  // A lost connection should look like waiting, not like a broken program.
  let retry: NodeJS.Timeout | null = null
  const stopRetrying = (): void => {
    if (retry) clearInterval(retry)
    retry = null
  }
  win.webContents.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
    // -3 is a navigation the app itself cancelled; it is not a failure.
    if (!isMainFrame || code === -3 || url.startsWith('data:')) return
    void win.webContents.loadURL(offlinePage())
    if (!retry) retry = setInterval(() => void win.webContents.loadURL(APP_URL), RETRY_MS)
  })
  win.webContents.on('did-finish-load', () => {
    if (win.webContents.getURL().startsWith(APP_ORIGIN)) stopRetrying()
  })
  win.on('closed', stopRetrying)

  void win.webContents.loadURL(APP_URL)
  return win
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('lk.esamithi.app')

  // How the API tells a shell sign-in from a browser one, and how the web app
  // knows not to offer "install this app" inside a window that is the app.
  app.userAgentFallback = `${app.userAgentFallback} eSamithiShell/${app.getVersion()}`

  // The office application asks for none of these.
  session.fromPartition(PARTITION).setPermissionRequestHandler((_wc, _permission, callback) => callback(false))

  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  const win = createWindow()
  initUpdater(win)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
