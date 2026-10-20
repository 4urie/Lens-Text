const { app, BrowserWindow, desktopCapturer, globalShortcut, ipcMain, net, protocol, screen } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { askDeepSeek } = require('../server/deepseek.cjs')

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
])

const distRoot = path.resolve(__dirname, '..', 'dist')
const devUrl = process.env.VITE_DEV_SERVER_URL
const shortcut = 'CommandOrControl+Shift+O'
let mainWindow = null
let snipSession = null
let snipStarting = false
let shortcutRegistered = false

function finishSnip() {
  const session = snipSession
  snipSession = null
  if (session) {
    for (const entry of session.values()) {
      if (!entry.window.isDestroyed()) entry.window.close()
    }
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show()
    mainWindow.focus()
  }
}

async function startSnip() {
  if (snipStarting || snipSession) return { ok: false, error: 'A screen snip is already open.' }
  snipStarting = true
  try {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide()
    await new Promise((resolve) => setTimeout(resolve, 180))
    const displays = screen.getAllDisplays()
    if (!displays.length) throw new Error('No display is available to capture.')
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.max(...displays.map((display) => Math.ceil(display.bounds.width * display.scaleFactor))),
        height: Math.max(...displays.map((display) => Math.ceil(display.bounds.height * display.scaleFactor))),
      },
    })
    const views = new Map()
    snipSession = views
    await Promise.all(displays.map(async (display, index) => {
      const source = sources.find((candidate) => candidate.display_id === String(display.id)) ?? sources[index]
      if (!source || source.thumbnail.isEmpty()) throw new Error('Screen capture is unavailable for this display.')
      const overlay = new BrowserWindow({
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height,
        frame: false,
        transparent: false,
        resizable: false,
        movable: false,
        show: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        backgroundColor: '#111019',
        webPreferences: {
          preload: path.join(__dirname, 'snip-preload.cjs'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      })
      views.set(overlay.webContents.id, { window: overlay, image: source.thumbnail })
      overlay.on('closed', () => { if (snipSession === views) finishSnip() })
      overlay.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
      await overlay.loadFile(path.join(__dirname, 'snip.html'))
    }))
    if (snipSession === views) {
      for (const entry of views.values()) entry.window.show()
    }
    return { ok: true }
  } catch (error) {
    finishSnip()
    const message = error instanceof Error ? error.message : 'Screen capture failed.'
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('snip:error', message)
    return { ok: false, error: message }
  } finally {
    snipStarting = false
  }
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1250,
    height: 880,
    minWidth: 660,
    minHeight: 620,
    backgroundColor: '#faf9fd',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  mainWindow = window
  window.on('closed', () => { if (mainWindow === window) mainWindow = null })

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, url) => {
    const allowed = devUrl ? url.startsWith(devUrl) : url.startsWith('app://lens-text/')
    if (!allowed) event.preventDefault()
  })

  if (devUrl) {
    void window.loadURL(devUrl)
    window.webContents.openDevTools({ mode: 'detach' })
  } else {
    void window.loadURL('app://lens-text/')
  }
}

app.whenReady().then(() => {
  ipcMain.handle('ai:ask', (event, input) => {
    if (event.sender !== mainWindow?.webContents) throw new Error('Unavailable.')
    return askDeepSeek(input)
  })
  ipcMain.handle('snip:start', (event) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) return { ok: false, error: 'Unavailable.' }
    return startSnip()
  })
  ipcMain.handle('snip:shortcut-status', (event) => event.sender === mainWindow?.webContents && shortcutRegistered)
  ipcMain.handle('snip:get-capture', (event) => {
    const entry = snipSession?.get(event.sender.id)
    if (!entry) throw new Error('No active screen snip.')
    return entry.image.toDataURL()
  })
  ipcMain.handle('snip:complete', (event, rect) => {
    const entry = snipSession?.get(event.sender.id)
    if (!entry || !rect || !['x', 'y', 'width', 'height'].every((key) => Number.isFinite(rect[key]))) {
      throw new Error('Invalid screen selection.')
    }
    const bounds = entry.window.getContentBounds()
    const imageSize = entry.image.getSize()
    const scaleX = imageSize.width / bounds.width
    const scaleY = imageSize.height / bounds.height
    const x = Math.max(0, Math.min(imageSize.width - 1, Math.floor(rect.x * scaleX)))
    const y = Math.max(0, Math.min(imageSize.height - 1, Math.floor(rect.y * scaleY)))
    const width = Math.min(imageSize.width - x, Math.ceil(rect.width * scaleX))
    const height = Math.min(imageSize.height - y, Math.ceil(rect.height * scaleY))
    if (width < 8 || height < 8) throw new Error('Select a larger area.')
    const png = entry.image.crop({ x, y, width, height }).toPNG()
    finishSnip()
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('snip:captured', png.toString('base64'))
    return { ok: true }
  })
  ipcMain.on('snip:cancel', (event) => { if (snipSession?.has(event.sender.id)) finishSnip() })
  protocol.handle('app', (request) => {
    const url = new URL(request.url)
    if (url.hostname !== 'lens-text') return new Response('Not found', { status: 404 })
    let pathname
    try { pathname = decodeURIComponent(url.pathname) } catch { return new Response('Bad path', { status: 400 }) }
    const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
    const target = path.resolve(distRoot, requested)
    if (!target.startsWith(distRoot + path.sep)) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(target).toString())
  })
  createWindow()
  shortcutRegistered = globalShortcut.register(shortcut, () => { void startSnip() })
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('will-quit', () => globalShortcut.unregisterAll())
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
