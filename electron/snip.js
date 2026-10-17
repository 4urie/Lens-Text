const surface = document.getElementById('snip-surface')
const image = document.getElementById('screen-image')
const shade = document.getElementById('shade')
const selection = document.getElementById('selection')
const status = document.getElementById('status')
let origin = null
let busy = false

window.screenSnip.capture().then((dataUrl) => {
  image.src = dataUrl
}).catch(() => {
  status.textContent = 'Could not capture this display. Press Esc to close.'
})

function rectangleAt(x, y) {
  const left = Math.min(origin.x, x)
  const top = Math.min(origin.y, y)
  const width = Math.abs(x - origin.x)
  const height = Math.abs(y - origin.y)
  selection.style.left = `${left}px`
  selection.style.top = `${top}px`
  selection.style.width = `${width}px`
  selection.style.height = `${height}px`
  return { x: left, y: top, width, height }
}

surface.addEventListener('pointerdown', (event) => {
  if (busy || event.button !== 0 || event.target.closest('button')) return
  origin = { x: event.clientX, y: event.clientY }
  selection.hidden = false
  shade.classList.add('selecting')
  surface.setPointerCapture(event.pointerId)
  rectangleAt(event.clientX, event.clientY)
})

surface.addEventListener('pointermove', (event) => {
  if (origin) rectangleAt(event.clientX, event.clientY)
})

surface.addEventListener('pointerup', async (event) => {
  if (!origin || busy) return
  const rectangle = rectangleAt(event.clientX, event.clientY)
  origin = null
  surface.releasePointerCapture(event.pointerId)
  if (rectangle.width < 8 || rectangle.height < 8) {
    selection.hidden = true
    shade.classList.remove('selecting')
    status.textContent = 'Select a larger area.'
    return
  }
  busy = true
  status.textContent = 'Sending selection to Lens Text...'
  try {
    await window.screenSnip.complete(rectangle)
  } catch {
    busy = false
    selection.hidden = true
    shade.classList.remove('selecting')
    status.textContent = 'Could not extract this area. Try another selection.'
  }
})

document.getElementById('cancel').addEventListener('click', () => window.screenSnip.cancel())
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') window.screenSnip.cancel()
})
