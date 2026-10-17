const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('screenSnip', {
  capture: () => ipcRenderer.invoke('snip:get-capture'),
  complete: (rectangle) => ipcRenderer.invoke('snip:complete', rectangle),
  cancel: () => ipcRenderer.send('snip:cancel'),
})
