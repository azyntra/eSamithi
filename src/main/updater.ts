import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater'
import { BrowserWindow, ipcMain, app } from 'electron'
import { is } from '@electron-toolkit/utils'

let mainWindow: BrowserWindow | null = null

function sendToRenderer(channel: string, data: any): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

export function initUpdater(window: BrowserWindow): void {
  mainWindow = window

  // Always register getVersion so the UI can display it
  ipcMain.handle('updater:getVersion', () => {
    return app.getVersion()
  })

  // Don't configure auto-updater in dev mode
  if (is.dev) {
    console.log('[Updater] Skipping auto-update in development mode')
    
    // Register mock handlers for dev mode
    ipcMain.handle('updater:check', () => ({ success: false, error: 'Auto-update is disabled in development mode' }))
    ipcMain.handle('updater:download', () => ({ success: false, error: 'Auto-update is disabled in development mode' }))
    ipcMain.handle('updater:install', () => {})
    
    return
  }

  // Configure updater
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  // ── Event listeners ────────────────────────────────────────────

  autoUpdater.on('checking-for-update', () => {
    sendToRenderer('updater:event', { type: 'checking' })
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    sendToRenderer('updater:event', {
      type: 'available',
      version: info.version,
      releaseDate: info.releaseDate
    })
  })

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    sendToRenderer('updater:event', {
      type: 'not-available',
      version: info.version
    })
  })

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    sendToRenderer('updater:event', {
      type: 'progress',
      percent: Math.round(progress.percent),
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total
    })
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    sendToRenderer('updater:event', {
      type: 'downloaded',
      version: info.version
    })
  })

  autoUpdater.on('error', (err: Error) => {
    // If the error is a 404 (no update file on server yet), treat it as "no update available"
    if (err.message.includes('404') || err.message.includes('ENOENT') || err.message.includes('Cannot find channel')) {
      sendToRenderer('updater:event', {
        type: 'not-available',
        version: app.getVersion()
      })
      return
    }

    sendToRenderer('updater:event', {
      type: 'error',
      message: err.message
    })
  })

  // ── IPC handlers ───────────────────────────────────────────────

  ipcMain.handle('updater:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      return { success: true, version: result?.updateInfo?.version }
    } catch (err: any) {
      // Catch 404s and return success so the frontend doesn't show an error box
      if (err.message.includes('404') || err.message.includes('ENOENT') || err.message.includes('Cannot find channel')) {
        return { success: true, version: app.getVersion() }
      }
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('updater:download', async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall(false, true)
  })

  // getVersion is already registered above

  // Auto-check for updates 5 seconds after launch
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.log('[Updater] Auto-check failed:', err.message)
    })
  }, 5000)
}
