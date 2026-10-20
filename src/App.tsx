import { useCallback, useEffect, useRef, useState } from 'react'
import { createWorker, type Worker as OcrWorker } from 'tesseract.js'
import { createSession, openSession, type SessionItem } from './session'
import './App.css'

type ImageItem = SessionItem & {
  url: string
  progress: number
}

const supported = new Set(['image/png', 'image/jpeg', 'image/webp'])
const ocrAssets = new URL(`${import.meta.env.BASE_URL}ocr/`, window.location.href).href.replace(/\/$/, '')

function Icon({ name }: { name: 'scan' | 'upload' | 'paste' | 'copy' | 'trash' | 'sun' | 'moon' | 'image' | 'check' | 'arrow' | 'close' | 'save' | 'open' | 'search' | 'globe' }) {
  const paths = {
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></>,
    scan: <path d="M4 9V6a2 2 0 0 1 2-2h3m6 0h3a2 2 0 0 1 2 2v3m0 6v3a2 2 0 0 1-2 2h-3m-6 0H6a2 2 0 0 1-2-2v-3M7 12h10M7 15h7"/>,
    upload: <path d="M12 16V4m0 0L8 8m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>,
    paste: <><rect x="6" y="5" width="14" height="16" rx="2"/><path d="M9 5V3h8v2M9 10h8m-8 4h6M4 9H3v10a2 2 0 0 0 2 2"/></>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></>,
    trash: <path d="M4 7h16M10 3h4M6 7l1 14h10l1-14M10 11v6m4-6v6"/>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></>,
    moon: <path d="M20 15.2A8 8 0 0 1 8.8 4 8 8 0 1 0 20 15.2Z"/>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
    close: <path d="M5 5 19 19M19 5 5 19"/>,
    save: <><path d="M4 4h13l3 3v13H4z"/><path d="M8 4v6h8V4M8 20v-7h8v7"/></>,
    open: <><path d="M4 8V5a2 2 0 0 1 2-2h5l2 2h5a2 2 0 0 1 2 2v1"/><path d="M3 10h18l-2 10H5z"/></>,
  }
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('lens-text-theme')
    return saved === 'light' || saved === 'dark' ? saved : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  })
  const [items, setItems] = useState<ImageItem[]>([])
  const itemsRef = useRef<ImageItem[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [processing, setProcessing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [shortcutAvailable, setShortcutAvailable] = useState(false)
  const [notice, setNotice] = useState('Add images to start extracting text.')
  const [sessionBusy, setSessionBusy] = useState<'saving' | 'opening' | null>(null)
  const [sessionMessage, setSessionMessage] = useState('')
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiResult, setAiResult] = useState<{ answer: string; sources: { title: string; url: string }[] } | null>(null)
  const [aiError, setAiError] = useState('')
  const [copied, setCopied] = useState<'single' | 'all' | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const sessionInput = useRef<HTMLInputElement>(null)
  const workerRef = useRef<OcrWorker | null>(null)
  const processingRef = useRef(false)
  const runId = useRef(0)
  const nextId = useRef(1)
  const autoSnipIds = useRef<number[]>([])
  const aiRequestId = useRef(0)
  const mounted = useRef(true)

  const commitItems = useCallback((next: ImageItem[]) => {
    aiRequestId.current += 1
    setAiResult(null)
    setAiError('')
    itemsRef.current = next
    setItems(next)
  }, [])

  const updateItem = useCallback((id: number, change: Partial<ImageItem>) => {
    commitItems(itemsRef.current.map((item) => item.id === id ? { ...item, ...change } : item))
  }, [commitItems])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('lens-text-theme', theme)
  }, [theme])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      runId.current += 1
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.url))
      void workerRef.current?.terminate().catch(() => {})
    }
  }, [])

  const stopOcr = useCallback(() => {
    runId.current += 1
    const worker = workerRef.current
    workerRef.current = null
    if (worker) void worker.terminate().catch(() => {})
    commitItems(itemsRef.current.map((item) => item.status === 'processing' ? { ...item, status: 'pending', progress: 0 } : item))
    processingRef.current = false
    setProcessing(false)
  }, [commitItems])

  const addImages = useCallback((files: File[]) => {
    const valid = files.filter((file) => supported.has(file.type))
    const rejected = files.length - valid.length
    if (!valid.length) {
      setNotice('Choose PNG, JPG, JPEG, or WebP images.')
      return []
    }
    const added = valid.map((file): ImageItem => ({
      id: nextId.current++,
      file,
      url: URL.createObjectURL(file),
      text: '',
      status: 'pending',
      progress: 0,
    }))
    commitItems([...itemsRef.current, ...added])
    setSelectedId((previous) => previous ?? added[0].id)
    setCopied(null)
    setNotice(`${added.length} image${added.length === 1 ? '' : 's'} added.${rejected ? ` ${rejected} unsupported file${rejected === 1 ? ' was' : 's were'} skipped.` : ''} Select Extract All to begin.`)
    return added.map((item) => item.id)
  }, [commitItems])

  useEffect(() => {
    const desktop = window.lensTextDesktop
    if (!desktop) return
    void desktop.shortcutStatus().then(setShortcutAvailable).catch(() => setShortcutAvailable(false))
    const offCapture = desktop.onCapture((base64) => {
      try {
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
        const file = new File([bytes.buffer], `Screen snip ${nextId.current}.png`, { type: 'image/png' })
        const ids = addImages([file])
        if (ids.length) {
          autoSnipIds.current.push(...ids)
          setSelectedId(ids[0])
          setNotice('Screen area captured. Extracting text...')
        }
      } catch {
        setNotice('Could not read the screen snip. Please try again.')
      }
    })
    const offError = desktop.onError((message) => setNotice(message))
    return () => { offCapture(); offError() }
  }, [addImages])

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.items ?? [])
        .filter((entry) => supported.has(entry.type))
        .map((entry) => entry.getAsFile())
        .filter((file): file is File => file !== null)
      if (files.length) {
        event.preventDefault()
        addImages(files)
      }
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
  }, [addImages])

  const pasteImages = async () => {
    if (!navigator.clipboard?.read) {
      setNotice('Clipboard image access is unavailable. Try Ctrl+V or upload images.')
      return
    }
    try {
      const clipboardItems = await navigator.clipboard.read()
      const files: File[] = []
      for (const item of clipboardItems) {
        const type = item.types.find((value) => supported.has(value))
        if (type) files.push(new File([await item.getType(type)], `Pasted image ${nextId.current + files.length}.png`, { type }))
      }
      if (files.length) addImages(files)
      else setNotice('No supported image is on the clipboard. Copy a screenshot, then try again.')
    } catch {
      setNotice('Clipboard access was blocked. Press Ctrl+V or upload images instead.')
    }
  }

  const startScreenSnip = async () => {
    const result = await window.lensTextDesktop?.startSnip()
    if (result && !result.ok) setNotice(result.error ?? 'Screen snip could not start.')
  }

  const removeItem = (id: number) => {
    const target = itemsRef.current.find((item) => item.id === id)
    if (!target) return
    if (target.status === 'processing') stopOcr()
    URL.revokeObjectURL(target.url)
    const next = itemsRef.current.filter((item) => item.id !== id)
    commitItems(next)
    if (selectedId === id) setSelectedId(next[0]?.id ?? null)
    setCopied(null)
    setNotice(next.length ? 'Image removed.' : 'Add images to start extracting text.')
  }

  const clearAll = () => {
    stopOcr()
    itemsRef.current.forEach((item) => URL.revokeObjectURL(item.url))
    commitItems([])
    setSelectedId(null)
    setCopied(null)
    setNotice('Add images to start extracting text.')
    if (fileInput.current) fileInput.current.value = ''
  }

  const saveSession = async () => {
    if (!itemsRef.current.length || processing || sessionBusy) return
    setSessionBusy('saving')
    setSessionMessage('Saving session...')
    try {
      const file = await createSession(itemsRef.current, selectedId)
      const url = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = url
      link.download = `Lens Text session ${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setSessionMessage('Session saved. Keep the downloaded file to reopen it later.')
    } catch (error) {
      console.error('Could not save session:', error)
      setSessionMessage('Could not save the session. Please try again.')
    } finally {
      setSessionBusy(null)
    }
  }

  const loadSession = async (file: File) => {
    if (processing || sessionBusy) return
    setSessionBusy('opening')
    setSessionMessage('Opening session...')
    try {
      const restored = await openSession(file)
      if (itemsRef.current.length && !window.confirm('Replace the current images and results with this saved session?')) {
        setSessionMessage('Open session canceled.')
        return
      }
      const restoredItems: ImageItem[] = restored.items.map((item) => ({
        ...item,
        url: URL.createObjectURL(item.file),
        progress: item.status === 'success' || item.status === 'empty' ? 100 : 0,
      }))
      stopOcr()
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.url))
      autoSnipIds.current = []
      commitItems(restoredItems)
      setSelectedId(restored.selectedId)
      nextId.current = Math.max(0, ...restoredItems.map((item) => item.id)) + 1
      setCopied(null)
      setNotice(`Opened session with ${restoredItems.length} image${restoredItems.length === 1 ? '' : 's'}.`)
      setSessionMessage(`Opened session with ${restoredItems.length} image${restoredItems.length === 1 ? '' : 's'}.`)
    } catch (error) {
      console.error('Could not open session:', error)
      setSessionMessage(error instanceof Error ? error.message : 'Could not open this session.')
    } finally {
      setSessionBusy(null)
    }
  }

  const extractAll = useCallback(async (onlyIds?: number[]) => {
    if (processingRef.current) return
    const queue = itemsRef.current.filter((item) => (item.status === 'pending' || item.status === 'error') && (!onlyIds || onlyIds.includes(item.id)))
    if (!queue.length) return
    const thisRun = ++runId.current
    processingRef.current = true
    setProcessing(true)
    setCopied(null)
    setNotice(`Preparing OCR for ${queue.length} image${queue.length === 1 ? '' : 's'}...`)
    let worker: OcrWorker | null = null
    let activeId: number | null = null
    let done = 0
    try {
      worker = await createWorker('eng', 1, {
        workerPath: `${ocrAssets}/worker.min.js`,
        corePath: ocrAssets,
        langPath: ocrAssets,
        workerBlobURL: false,
        logger: ({ status, progress }) => {
          if (mounted.current && runId.current === thisRun && activeId !== null && status === 'recognizing text') {
            updateItem(activeId, { progress: Math.round(Math.max(0, Math.min(1, progress)) * 100) })
          }
        },
      })
      if (!mounted.current || runId.current !== thisRun) return
      workerRef.current = worker
      for (const queued of queue) {
        if (!mounted.current || runId.current !== thisRun) break
        if (!itemsRef.current.some((item) => item.id === queued.id)) continue
        activeId = queued.id
        setSelectedId(queued.id)
        updateItem(queued.id, { status: 'processing', progress: 0, error: undefined })
        setNotice(`Reading image ${done + 1} of ${queue.length}: ${queued.file.name}`)
        try {
          const result = await worker.recognize(queued.file)
          if (!mounted.current || runId.current !== thisRun) break
          const extracted = result.data.text.trim()
          updateItem(queued.id, { text: extracted, status: extracted ? 'success' : 'empty', progress: 100 })
        } catch (error) {
          if (!mounted.current || runId.current !== thisRun) break
          console.error(`OCR failed for ${queued.file.name}:`, error)
          updateItem(queued.id, { status: 'error', progress: 0, error: 'Text extraction failed. Select Retry to try this image again.' })
        }
        done += 1
      }
      if (mounted.current && runId.current === thisRun) {
        const failures = itemsRef.current.filter((item) => item.status === 'error').length
        setNotice(`Finished ${done} image${done === 1 ? '' : 's'}.${failures ? ` ${failures} need${failures === 1 ? 's' : ''} another try.` : ''}`)
      }
    } catch (error) {
      if (mounted.current && runId.current === thisRun) {
        console.error('OCR engine failed:', error)
        const queuedIds = new Set(queue.map((item) => item.id))
        commitItems(itemsRef.current.map((item) => queuedIds.has(item.id) && item.status === 'pending'
          ? { ...item, status: 'error', error: 'OCR could not start. Select Retry after checking the app files.' }
          : item))
        setNotice('The OCR engine could not start. Try again.')
      }
    } finally {
      activeId = null
      if (worker) {
        if (workerRef.current === worker) workerRef.current = null
        try { await worker.terminate() } catch { /* Clear may already have stopped it. */ }
      }
      if (mounted.current && runId.current === thisRun) {
        processingRef.current = false
        setProcessing(false)
      }
    }
  }, [updateItem, commitItems])

  useEffect(() => {
    if (processing || !autoSnipIds.current.length) return
    const ids = autoSnipIds.current.splice(0)
    if (ids.some((id) => itemsRef.current.some((item) => item.id === id && item.status === 'pending'))) {
      void extractAll(ids)
    }
  }, [items, processing, extractAll])

  const retrySelected = () => {
    if (!selectedId || processing) return
    updateItem(selectedId, { status: 'pending', progress: 0, error: undefined })
    void extractAll([selectedId])
  }

  const copyValue = async (value: string, kind: 'single' | 'all') => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const helper = document.createElement('textarea')
      helper.value = value
      helper.style.position = 'fixed'
      helper.style.opacity = '0'
      document.body.appendChild(helper)
      helper.select()
      let worked = false
      try { worked = document.execCommand('copy') } catch { /* Browser denied the fallback. */ }
      helper.remove()
      if (!worked) {
        setNotice('Copy was blocked. Select the text and press Ctrl+C instead.')
        return
      }
    }
    setCopied(kind)
    setNotice(kind === 'all' ? 'All extracted text copied.' : 'Text copied to your clipboard.')
    window.setTimeout(() => setCopied((current) => current === kind ? null : current), 2200)
  }

  const selected = items.find((item) => item.id === selectedId) ?? null
  const pendingCount = items.filter((item) => item.status === 'pending' || item.status === 'error').length
  const completeCount = items.filter((item) => item.status === 'success' || item.status === 'empty').length
  const combinedText = items.filter((item) => item.text.trim()).map((item) => `${item.file.name}\n${item.text.trim()}`).join('\n\n')

  const askAi = async () => {
    const question = aiQuestion.trim()
    if (!question || aiBusy) return
    const requestId = ++aiRequestId.current
    setAiBusy(true)
    setAiResult(null)
    setAiError('')
    try {
      const input = { question, extractedText: combinedText.slice(0, 40000), mode: 'web' as const }
      const response = window.lensTextDesktop
        ? await window.lensTextDesktop.askAi(input)
        : await fetch('/api/ai/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
          .then(async (result) => {
            const data = await result.json()
            if (!result.ok) throw new Error(data.error || 'Could not answer the question.')
            return data as { answer: string; sources: { title: string; url: string }[] }
          })
      if (aiRequestId.current === requestId) setAiResult(response)
    } catch (error) {
      if (aiRequestId.current === requestId) setAiError(error instanceof Error ? error.message : 'Could not answer the question.')
    } finally {
      setAiBusy(false)
    }
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
          <div className="panel-heading"><div><span className="step">01</span><h2 id="source-title">Source images</h2></div><span className="panel-hint">PNG, JPG, WebP</span></div>
          <input ref={fileInput} className="sr-only" type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={(event) => { addImages(Array.from(event.target.files ?? [])); event.target.value = '' }} aria-label="Choose images" />
          <input ref={sessionInput} className="sr-only" type="file" accept=".json,application/json" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void loadSession(file) }} aria-label="Open saved session" />
          <div className={`drop-zone ${dragging ? 'dragging' : ''} ${selected ? 'has-image' : ''}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true) }} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={(event) => { event.preventDefault(); if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false) }} onDrop={(event) => { event.preventDefault(); setDragging(false); addImages(Array.from(event.dataTransfer.files)) }}>
            {selected ? <img src={selected.url} className="preview" alt={`Preview of ${selected.file.name}`} onError={() => updateItem(selected.id, { status: 'error', error: 'This image could not be opened. Remove it and try another file.' })} /> : <div className="empty-upload"><div className="upload-icon"><Icon name="image"/></div><h3>Drop your images here</h3><p>or choose files to get started</p><button className="secondary-button choose-button" type="button" onClick={() => fileInput.current?.click()}><Icon name="upload"/> Browse files</button></div>}
            {dragging && <div className="drop-overlay">Drop images here</div>}
          </div>
          <div className="source-actions"><button className="secondary-button" type="button" onClick={() => fileInput.current?.click()}><Icon name="upload"/> Add images</button><button className="secondary-button" type="button" onClick={pasteImages}><Icon name="paste"/> Paste image</button>{window.lensTextDesktop && <button className="secondary-button snip-button" type="button" onClick={() => { void startScreenSnip() }}><Icon name="scan"/> Screen Snip</button>}</div>
          <button className="primary-button" type="button" onClick={() => { void extractAll() }} aria-busy={processing} disabled={!pendingCount || processing || !!sessionBusy}>{processing ? <><span className="spinner"/> Extracting {completeCount} of {items.length}</> : items.length > 0 && !pendingCount ? <><Icon name="check"/> Extraction complete</> : <><Icon name="scan"/> Extract All{pendingCount ? ` (${pendingCount})` : ''} <Icon name="arrow"/></>}</button>
          {items.length > 0 && <div className="image-list" role="region" tabIndex={0} aria-label="Images to extract">
            <div className="list-heading"><strong>{items.length} image{items.length === 1 ? '' : 's'}</strong><span>{completeCount} completed</span></div>
            {items.map((item, index) => <div className={`image-row ${selectedId === item.id ? 'selected' : ''}`} key={item.id}>
              <button type="button" className="image-select" onClick={() => setSelectedId(item.id)} aria-label={`View result for ${item.file.name}`} aria-current={selectedId === item.id ? 'true' : undefined}>
                <img src={item.url} alt="" />
                <span className="image-row-info"><span className="file-name" title={item.file.name}>{index + 1}. {item.file.name}</span><span className={`row-status status-${item.status}`}>{item.status === 'processing' ? `Reading ${item.progress}%` : item.status === 'success' ? 'Done' : item.status === 'empty' ? 'No text' : item.status === 'error' ? 'Error' : 'Queued'}</span></span>
              </button>
              <button className="remove-button" type="button" onClick={() => removeItem(item.id)} aria-label={`Remove ${item.file.name}`} title="Remove image"><Icon name="close"/></button>
            </div>)}
          </div>}
          <div className="session-actions" role="group" aria-label="Session actions"><button className="secondary-button" type="button" onClick={() => { void saveSession() }} disabled={!items.length || processing || !!sessionBusy}><Icon name="save"/> {sessionBusy === 'saving' ? 'Saving...' : 'Save Session'}</button><button className="secondary-button" type="button" onClick={() => sessionInput.current?.click()} disabled={processing || !!sessionBusy}><Icon name="open"/> {sessionBusy === 'opening' ? 'Opening...' : 'Open Session'}</button></div>
          {sessionMessage && <p className="session-message" role="status">{sessionMessage}</p>}
          <p className="shortcut-note">{window.lensTextDesktop ? <>Select an area with Screen Snip{shortcutAvailable ? <> or press <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>O</kbd> anywhere.</> : <>. The global shortcut may be in use by another app.</>}</> : <>Tip: Select several files at once, drop a group, or press <kbd>Ctrl</kbd> + <kbd>V</kbd> to add a screenshot.</>}</p>
        </section>
        <section className="panel result-panel" aria-labelledby="result-title">
          <div className="panel-heading"><div><span className="step">02</span><h2 id="result-title">Extracted text</h2></div><span className={`status-pill status-${processing ? 'processing' : selected?.status ?? 'pending'}`}>{processing ? 'Processing' : selected?.status === 'success' ? 'Ready' : selected?.status === 'empty' ? 'No text' : selected?.status === 'error' ? 'Needs attention' : 'Waiting'}</span></div>
          {selected && <div className="result-file"><Icon name="image"/><span title={selected.file.name}>{selected.file.name}</span><span>{items.findIndex((item) => item.id === selected.id) + 1} of {items.length}</span></div>}
          <div className="result-body"><textarea aria-label="Extracted text, editable" placeholder={selected ? 'Text for this image will appear here...' : 'Choose an image to see its text...'} value={selected?.text ?? ''} onChange={(event) => { if (selected) { updateItem(selected.id, { text: event.target.value, status: event.target.value ? 'success' : 'empty', error: undefined }); setCopied(null) } }} disabled={!selected || selected.status === 'processing'} spellCheck={false}/>{selected?.status === 'processing' && <div className="progress-track" role="progressbar" aria-label="OCR progress" aria-valuenow={selected.progress} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${selected.progress}%` }}/></div>}</div>
          <div className={`status-message ${selected?.status ?? 'pending'}`} role="status" aria-live="polite">{selected?.status === 'success' && <Icon name="check"/>}<span>{selected?.error ?? (selected?.status === 'empty' ? 'No text found. Try a clearer image.' : selected?.status === 'success' ? 'Edit this result before copying, if needed.' : notice)}</span></div>
          <div className="result-footer"><span className="char-count">{(selected?.text.length ?? 0).toLocaleString()} characters</span><div className="result-actions">{selected?.status === 'error' && <button className="icon-button" type="button" onClick={retrySelected} disabled={processing}>Retry</button>}<button className="icon-button" type="button" onClick={clearAll} disabled={!items.length}><Icon name="trash"/> Clear All</button><button className="copy-button" type="button" onClick={() => copyValue(selected?.text ?? '', 'single')} disabled={!selected?.text}><Icon name={copied === 'single' ? 'check' : 'copy'}/>{copied === 'single' ? 'Copied!' : 'Copy Text'}</button></div></div>
          <button className="copy-all-button" type="button" onClick={() => copyValue(combinedText, 'all')} disabled={!combinedText}><Icon name={copied === 'all' ? 'check' : 'copy'}/>{copied === 'all' ? 'Copied all!' : 'Copy All Results'}</button>
        </section>
      </div>
      <section className="ai-panel ai-web" aria-labelledby="ai-title">
        <div className="ai-heading"><span className="ai-heading-icon"><Icon name="globe"/></span><div><span className="ai-eyebrow">SEARCH THE WEB</span><h3 id="ai-title">Web search</h3></div></div>
        <p>Explore any topic with an AI answer and web sources. Add a scan for extra context.</p>
        <div className="ai-context"><span className={`badge-dot ${combinedText ? 'is-ready' : ''}`}/>{combinedText ? `${items.filter((item) => item.text.trim()).length} scan${items.filter((item) => item.text.trim()).length === 1 ? '' : 's'} added as context` : 'Ready to search. Scan context is optional.'}</div>
        <label className="ai-label" htmlFor="ai-question">What would you like to explore?</label>
        <div className="ai-composer">
          <textarea id="ai-question" className="ai-question" value={aiQuestion} maxLength={1000} disabled={aiBusy} aria-describedby="ai-input-hint" onChange={(event) => setAiQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) { event.preventDefault(); void askAi() } }} placeholder="Name a topic or ask a specific question..." rows={3}/>
          <div className="ai-composer-footer"><span id="ai-input-hint">Ctrl / Cmd + Enter to ask</span><span>{aiQuestion.length}/1,000</span></div>
        </div>
        {combinedText && <div className="ai-suggestions"><span>Try</span>{['Search this', 'Look up'].map((prompt) => <button key={prompt} type="button" disabled={!combinedText || aiBusy} onClick={() => { setAiQuestion(prompt); document.getElementById('ai-question')?.focus() }}>{prompt === 'Search this' ? 'Search this topic' : 'Find related sources'}<Icon name="arrow"/></button>)}</div>}
        {combinedText.length > 40000 && <p className="ai-limit">Only the first 40,000 characters will be sent.</p>}
        <button className="ai-ask-button" type="button" onClick={() => { void askAi() }} disabled={!aiQuestion.trim() || aiBusy}>{aiBusy ? <><span className="spinner"/>Working on your answer...</> : <><Icon name="search"/>Search and answer<Icon name="arrow"/></>}</button>
        <div role="status" aria-live="polite">{aiBusy && <p className="ai-loading">Searching the web and preparing an answer. This may take a moment.</p>}</div>
        {aiError && <p className="ai-error" role="alert">{aiError}</p>}
        {aiResult && <div className="ai-response" aria-live="polite">
          <div className="ai-answer-heading"><strong>Search answer</strong><span>DeepSeek Flash</span></div>
          <p>{aiResult.answer}</p>
          {aiResult.sources.length > 0 && <div className="ai-sources"><div className="ai-sources-heading"><strong>Explore the sources</strong><span>{aiResult.sources.length} links</span></div><ol>{aiResult.sources.map((source, index) => <li key={`${source.url}-${index}`}><a href={source.url} target="_blank" rel="noopener noreferrer"><span className="ai-source-number">{index + 1}</span><span className="ai-source-text"><strong>{source.title}</strong><span>{source.url}</span></span><Icon name="arrow"/><span className="sr-only"> (opens in a new tab)</span></a></li>)}</ol></div>}
          {aiResult.sources.length === 0 && <p className="ai-no-sources">No web sources were returned for this search.</p>}
        </div>}
        <p className="ai-privacy">Only extracted text and your question are sent to DeepSeek. Your images stay on this device.</p>
      </section>
      <div className="privacy-note"><span className="privacy-icon">✦</span><span>Images stay on your device. OCR runs locally; AI questions send extracted text to DeepSeek.</span></div>
    </main>
    <footer className="footer"><span>Lens Text</span><span>Made for the words you need.</span></footer>
  </div>
}

export default App
