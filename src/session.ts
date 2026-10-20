export type ItemStatus = 'pending' | 'processing' | 'success' | 'empty' | 'error'

export type SessionItem = {
  id: number
  file: File
  text: string
  status: ItemStatus
  error?: string
}

type SavedItem = {
  id: number
  name: string
  type: string
  lastModified: number
  imageData: string
  text: string
  status: ItemStatus
  error?: string
}

const format = 'lens-text-session'
const version = 1
const imageTypes = new Set(['image/png', 'image/jpeg', 'image/webp'])
const statuses = new Set<ItemStatus>(['pending', 'success', 'empty', 'error'])

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('An image could not be read.'))
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`))
    reader.readAsDataURL(file)
  })
}

export async function createSession(items: SessionItem[], selectedId: number | null): Promise<Blob> {
  const savedItems: SavedItem[] = await Promise.all(items.map(async (item) => ({
    id: item.id,
    name: item.file.name,
    type: item.file.type,
    lastModified: item.file.lastModified,
    imageData: await readImage(item.file),
    text: item.text,
    status: item.status === 'processing' ? 'pending' : item.status,
    ...(item.error ? { error: item.error } : {}),
  })))
  return new Blob([JSON.stringify({ format, version, savedAt: new Date().toISOString(), selectedId, items: savedItems })], { type: 'application/json' })
}

export async function openSession(file: File): Promise<{ items: SessionItem[], selectedId: number | null }> {
  let data: unknown
  try {
    data = JSON.parse(await file.text())
  } catch {
    throw new Error('This is not a valid Lens Text session file.')
  }
  if (!data || typeof data !== 'object') throw new Error('This is not a valid Lens Text session file.')
  const session = data as Record<string, unknown>
  if (session.format !== format || session.version !== version || !Array.isArray(session.items)) {
    throw new Error('This session format is not supported.')
  }
  const ids = new Set<number>()
  const items = session.items.map((value: unknown): SessionItem => {
    if (!value || typeof value !== 'object') throw new Error('The session contains an invalid image entry.')
    const item = value as Partial<SavedItem>
    if (!Number.isSafeInteger(item.id) || (item.id ?? 0) < 1 || ids.has(item.id!) ||
      typeof item.name !== 'string' || !item.name || !imageTypes.has(item.type ?? '') ||
      typeof item.lastModified !== 'number' || !Number.isFinite(item.lastModified) ||
      typeof item.imageData !== 'string' || typeof item.text !== 'string' ||
      !statuses.has(item.status as ItemStatus) ||
      (item.error !== undefined && typeof item.error !== 'string')) {
      throw new Error('The session contains an invalid image entry.')
    }
    const prefix = `data:${item.type};base64,`
    if (!item.imageData.startsWith(prefix)) throw new Error('The session contains an invalid image.')
    let binary: string
    try { binary = atob(item.imageData.slice(prefix.length)) }
    catch { throw new Error('The session contains an invalid image.') }
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    ids.add(item.id!)
    return {
      id: item.id!,
      file: new File([bytes], item.name, { type: item.type, lastModified: item.lastModified }),
      text: item.text,
      status: item.status!,
      ...(item.error ? { error: item.error } : {}),
    }
  })
  const selectedId = typeof session.selectedId === 'number' && ids.has(session.selectedId)
    ? session.selectedId : items[0]?.id ?? null
  return { items, selectedId }
}
