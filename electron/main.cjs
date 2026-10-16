const { app, BrowserWindow, net, protocol } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
])

const distRoot = path.resolve(__dirname, '..', 'dist')
const devUrl = process.env.VITE_DEV_SERVER_URL

function createWindow() {
  const window = new BrowserWindow({
    width: 1250,
    height: 880,
    minWidth: 660,
    minHeight: 620,
    backgroundColor: '#faf9fd',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

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
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
