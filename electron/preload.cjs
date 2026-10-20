const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('lensTextDesktop', {
  askAi: (input) => ipcRenderer.invoke('ai:ask', input),
  startSnip: () => ipcRenderer.invoke('snip:start'),
  shortcutStatus: () => ipcRenderer.invoke('snip:shortcut-status'),
  onCapture: (callback) => {
    const listener = (_event, base64) => callback(base64)
    ipcRenderer.on('snip:captured', listener)
    return () => ipcRenderer.removeListener('snip:captured', listener)
  },
  onError: (callback) => {
    const listener = (_event, message) => callback(message)
    ipcRenderer.on('snip:error', listener)
    return () => ipcRenderer.removeListener('snip:error', listener)
  },
})
