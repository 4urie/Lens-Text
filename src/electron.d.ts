interface Window {
  lensTextDesktop?: {
    askAi: (input: { question: string; extractedText: string; mode: 'web' }) => Promise<{ answer: string; sources: { title: string; url: string }[] }>
    startSnip: () => Promise<{ ok: boolean; error?: string }>
    shortcutStatus: () => Promise<boolean>
    onCapture: (callback: (base64: string) => void) => () => void
    onError: (callback: (message: string) => void) => () => void
  }
}
