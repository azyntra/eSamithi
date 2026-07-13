import { app, shell, BrowserWindow } from 'electron'
import path from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc-handlers'
import { initUpdater } from './updater'

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: 'eSamithi',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load renderer
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

import fs from 'fs'

function ensureConfigExists(): void {
  const configPath = path.join(app.getPath('userData'), 'server.config.json')
  
  const rootConfig = path.join(app.getAppPath(), 'server.config.json')
  let defaultUrl = 'http://141.147.75.132/api/v1'
  
  if (fs.existsSync(rootConfig)) {
    try {
      const rootData = JSON.parse(fs.readFileSync(rootConfig, 'utf-8'))
      if (rootData.api_url) defaultUrl = rootData.api_url
    } catch(e) {}
  }

  if (!fs.existsSync(configPath)) {
    if (fs.existsSync(rootConfig)) {
      fs.copyFileSync(rootConfig, configPath)
    } else {
      fs.writeFileSync(configPath, JSON.stringify({ api_url: defaultUrl }, null, 2))
    }
  } else {
    try {
      const currentData = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      let dirty = false

      // If the existing config points to localhost but the bundled one points to cloud, overwrite it.
      // This fixes the issue for users who already opened the app and got the bad default.
      if (currentData.api_url && currentData.api_url.includes('localhost') && !defaultUrl.includes('localhost')) {
        currentData.api_url = defaultUrl
        dirty = true
      }

      // Keep the named-environment map in sync with the bundled config so new
      // server IPs ship with app updates — but never override a machine's
      // chosen "env" (a field client stays on prod; a test machine on testbed).
      if (fs.existsSync(rootConfig)) {
        try {
          const rootData = JSON.parse(fs.readFileSync(rootConfig, 'utf-8'))
          if (rootData.environments) {
            if (JSON.stringify(currentData.environments) !== JSON.stringify(rootData.environments)) {
              currentData.environments = rootData.environments
              dirty = true
            }
            if (!currentData.env && rootData.env) {
              currentData.env = rootData.env
              dirty = true
            }
          }
        } catch(e) {}
      }

      if (dirty) fs.writeFileSync(configPath, JSON.stringify(currentData, null, 2))
    } catch(e) {}
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('lk.esamithi.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Ensure config exists for API client
  ensureConfigExists()

  // Register IPC handlers (now cloud-based)
  registerIpcHandlers()

  const win = createWindow()
  initUpdater(win)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
