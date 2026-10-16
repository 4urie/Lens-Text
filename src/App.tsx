import { useCallback, useEffect, useRef, useState } from 'react'
import { createWorker, type Worker as OcrWorker } from 'tesseract.js'
import './App.css'

type Status = 'idle' | 'working' | 'success' | 'empty' | 'error'
const supported = new Set(['image/png', 'image/jpeg', 'image/webp'])
const ocrAssets = new URL(`${import.meta.env.BASE_URL}ocr/`, window.location.href).href.replace(/\/$/, '')

function Icon({ name }: { name: 'scan' | 'upload' | 'paste' | 'copy' | 'trash' | 'sun' | 'moon' | 'image' | 'check' | 'arrow' }) {
  const paths = {
    scan: <><path d="M4 9V6a2 2 0 0 1 2-2h3m6 0h3a2 2 0 0 1 2 2v3m0 6v3a2 2 0 0 1-2 2h-3m-6 0H6a2 2 0 0 1-2-2v-3M7 12h10M7 15h7"/></>,
    upload: <path d="M12 16V4m0 0L8 8m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>,
    paste: <><rect x="6" y="5" width="14" height="16" rx="2"/><path d="M9 5V3h8v2M9 10h8m-8 4h6M4 9H3v10a2 2 0 0 0 2 2"/></>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></>,
    trash: <path d="M4 7h16M10 3h4M6 7l1 14h10l1-14M10 11v6m4-6v6"/>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></>,
    moon: <path d="M20 15.2A8 8 0 0 1 8.8 4 8 8 0 1 0 20 15.2Z"/>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
  }
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('lens-text-theme')
    return saved === 'light' || saved === 'dark' ? saved : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  })
  const [image, setImage] = useState<{ file: File; url: string } | null>(null)
  const [text, setText] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('Your extracted text will appear here.')
  const [progress, setProgress] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [copied, setCopied] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const textArea = useRef<HTMLTextAreaElement>(null)
  const previewUrl = useRef<string | null>(null)
  const workerRef = useRef<OcrWorker | null>(null)
  const runId = useRef(0)
  const mounted = useRef(true)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('lens-text-theme', theme)
  }, [theme])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      runId.current += 1
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
      void workerRef.current?.terminate()
    }
  }, [])

  const stopOcr = useCallback(() => {
    runId.current += 1
    const worker = workerRef.current
    workerRef.current = null
    if (worker) void worker.terminate().catch(() => {})
  }, [])

  const loadImage = useCallback((file: File) => {
    if (!supported.has(file.type)) {
      setMessage('Choose a PNG, JPG, JPEG, or WebP image.')
      setStatus('error')
      return
    }
    stopOcr()
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
    const url = URL.createObjectURL(file)
    previewUrl.current = url
    setImage({ file, url })
    setText('')
    setProgress(0)
    setCopied(false)
    setStatus('idle')
    setMessage('Image ready. Select Extract Text to begin.')
  }, [stopOcr])

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const item = Array.from(event.clipboardData?.items ?? []).find((entry) => supported.has(entry.type))
      const file = item?.getAsFile()
      if (file) { event.preventDefault(); loadImage(file) }
    }
    const onDragOver = (event: DragEvent) => { if (event.dataTransfer?.types.includes('Files')) event.preventDefault() }
    const onDrop = (event: DragEvent) => { if (event.dataTransfer?.types.includes('Files')) event.preventDefault() }
    window.addEventListener('paste', onPaste)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('paste', onPaste)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [loadImage])

  const pasteImage = async () => {
    if (!navigator.clipboard?.read) {
      setStatus('error')
      setMessage('Clipboard image access is unavailable here. Try Ctrl+V or upload an image.')
      return
    }
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const type = item.types.find((value) => supported.has(value))
        if (type) {
          const blob = await item.getType(type)
          loadImage(new File([blob], 'Pasted image', { type }))
          return
        }
      }
      setStatus('error')
      setMessage('No supported image is on the clipboard. Copy a screenshot, then try again.')
    } catch {
      setStatus('error')
      setMessage('Clipboard access was blocked. Press Ctrl+V or upload an image instead.')
    }
  }

  const clear = () => {
    stopOcr()
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
    previewUrl.current = null
    setImage(null)
    setText('')
    setProgress(0)
    setCopied(false)
    setStatus('idle')
    setMessage('Your extracted text will appear here.')
    if (fileInput.current) fileInput.current.value = ''
  }

  const extract = async () => {
    if (!image || status === 'working') return
    stopOcr()
    const thisRun = runId.current
    setProgress(0)
    setText('')
    setCopied(false)
    setStatus('working')
    setMessage('Preparing the OCR engine…')
    let worker: OcrWorker | null = null
    try {
      worker = await createWorker('eng', 1, {
        workerPath: `${ocrAssets}/worker.min.js`,
        corePath: ocrAssets,
        langPath: ocrAssets,
        workerBlobURL: false,
        logger: ({ status: step, progress: value }) => {
          if (mounted.current && runId.current === thisRun) {
            setMessage(step === 'recognizing text' ? 'Reading text from your image…' : 'Preparing the OCR engine…')
            setProgress(Math.round(Math.max(0, Math.min(1, value)) * 100))
          }
        },
      })
      if (!mounted.current || runId.current !== thisRun) { await worker.terminate(); return }
      workerRef.current = worker
      const result = await worker.recognize(image.file)
      if (!mounted.current || runId.current !== thisRun) return
      const extracted = result.data.text.trim()
      setText(extracted)
      setProgress(100)
      setStatus(extracted ? 'success' : 'empty')
      setMessage(extracted ? 'Text extracted. You can edit it below before copying.' : 'No text found. Try a sharper image with larger, clearer text.')
    } catch (error) {
      if (mounted.current && runId.current === thisRun) {
        console.error('OCR failed:', error)
        setStatus('error')
        setMessage('Text extraction failed. Try another image or run it again.')
      }
    } finally {
      if (worker) {
        if (workerRef.current === worker) workerRef.current = null
        try { await worker.terminate() } catch { /* Clear may already have stopped it. */ }
      }
    }
  }

  const copyText = async () => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      try {
        textArea.current?.focus()
        textArea.current?.select()
        if (!document.execCommand('copy')) throw new Error('Copy failed')
      } catch {
        setMessage('Copy was blocked. Select the text and press Ctrl+C instead.')
        return
      }
    }
    setCopied(true)
    setMessage('Text copied to your clipboard.')
    window.setTimeout(() => setCopied(false), 2200)
  }

  const onDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files[0]
    if (file) loadImage(file)
  }

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><Icon name="scan"/></span><span>Lens <strong>Text</strong></span></div>
      <div className="topbar-right"><span className="local-badge"><span className="badge-dot"/>On-device OCR</span><button className="theme-button" type="button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}><Icon name={theme === 'light' ? 'moon' : 'sun'}/></button></div>
    </header>
    <main className="main-content">
      <section className="intro"><div className="eyebrow"><span className="eyebrow-line"/> SIMPLE IMAGE TO TEXT</div><h1>See text. <span>Copy it.</span></h1><p>Turn screenshots, photos, and documents into editable text in a few clicks.</p></section>
      <div className="workspace">
        <section className="panel source-panel" aria-labelledby="source-title">
          <div className="panel-heading"><div><span className="step">01</span><h2 id="source-title">Source image</h2></div><span className="panel-hint">PNG, JPG, WebP</span></div>
          <input ref={fileInput} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) loadImage(file) }} aria-label="Choose an image" />
          <div className={`drop-zone ${dragging ? 'dragging' : ''} ${image ? 'has-image' : ''}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true) }} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={(event) => { event.preventDefault(); if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false) }} onDrop={onDrop}>
            {image ? <img src={image.url} className="preview" alt="Selected source for text extraction" onError={() => { setStatus('error'); setMessage('This image could not be opened. Try another file.') }} /> : <div className="empty-upload"><div className="upload-icon"><Icon name="image"/></div><h3>Drop your image here</h3><p>or choose a file to get started</p><button className="secondary-button choose-button" type="button" onClick={() => fileInput.current?.click()}><Icon name="upload"/> Browse files</button></div>}
            {dragging && <div className="drop-overlay">Drop image here</div>}
          </div>
          {image && <div className="file-row"><span className="file-name" title={image.file.name}>{image.file.name}</span><button className="text-button" type="button" onClick={() => fileInput.current?.click()}>Change image</button></div>}
          <div className="source-actions"><button className="secondary-button" type="button" onClick={() => fileInput.current?.click()}><Icon name="upload"/> Upload image</button><button className="secondary-button" type="button" onClick={pasteImage}><Icon name="paste"/> Paste image</button></div>
          <p className="shortcut-note">Tip: Copy a screenshot and press <kbd>Ctrl</kbd> + <kbd>V</kbd> anywhere on this page.</p>
          <button className="primary-button" type="button" onClick={extract} disabled={!image || status === 'working'}>{status === 'working' ? <><span className="spinner"/> Extracting… {progress}%</> : <><Icon name="scan"/> Extract Text <Icon name="arrow"/></>}</button>
        </section>
        <section className="panel result-panel" aria-labelledby="result-title">
          <div className="panel-heading"><div><span className="step">02</span><h2 id="result-title">Extracted text</h2></div><span className={`status-pill status-${status}`}>{status === 'working' ? 'Processing' : status === 'success' ? 'Ready' : status === 'empty' ? 'No text' : status === 'error' ? 'Needs attention' : 'Waiting'}</span></div>
          <div className="result-body"><textarea ref={textArea} aria-label="Extracted text, editable" placeholder="Your extracted text will appear here…" value={text} onChange={(event) => { setText(event.target.value); setCopied(false); if (event.target.value && status !== 'working') setStatus('success') }} spellCheck={false}/>{status === 'working' && <div className="progress-track" role="progressbar" aria-label="OCR progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${progress}%` }}/></div>}</div>
          <div className={`status-message ${status}`} role="status" aria-live="polite">{status === 'success' && <Icon name="check"/>}<span>{message}</span></div>
          <div className="result-footer"><span className="char-count">{text.length.toLocaleString()} characters</span><div className="result-actions"><button className="icon-button" type="button" onClick={clear} disabled={!image && !text && status === 'idle'}><Icon name="trash"/> Clear</button><button className="copy-button" type="button" onClick={copyText} disabled={!text}><Icon name={copied ? 'check' : 'copy'}/>{copied ? 'Copied!' : 'Copy Text'}</button></div></div>
        </section>
      </div>
      <div className="privacy-note"><span className="privacy-icon">✦</span><span>Your image stays on your device. Text extraction runs locally in your browser.</span></div>
    </main>
    <footer className="footer"><span>Lens Text</span><span>Made for the words you need.</span></footer>
  </div>
}

export default App
