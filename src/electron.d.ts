interface Window {
  lensTextDesktop?: {
    startSnip: () => Promise<{ ok: boolean; error?: string }>
    shortcutStatus: () => Promise<boolean>
    onCapture: (callback: (base64: string) => void) => () => void
    onError: (callback: (message: string) => void) => () => void
  }
}
