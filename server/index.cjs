const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const { askDeepSeek } = require('./deepseek.cjs')

const host = '127.0.0.1'
const port = Number(process.env.LENS_TEXT_PORT || 8787)
const dist = path.resolve(__dirname, '..', 'dist')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm', '.gz': 'application/gzip', '.ico': 'image/x-icon' }

function json(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(value))
}

http.createServer(async (request, response) => {
  let pathname
  try { pathname = decodeURIComponent(new URL(request.url, `http://${host}:${port}`).pathname) }
  catch { response.writeHead(400).end(); return }
  if (pathname === '/api/ai/ask') {
    if (request.method !== 'POST' || !request.headers['content-type']?.startsWith('application/json')) {
      json(response, 405, { error: 'Use POST with JSON.' })
      return
    }
    let body = ''
    try {
      for await (const chunk of request) {
        body += chunk
        if (body.length > 100000) throw new Error('Request is too large.')
      }
      json(response, 200, await askDeepSeek(JSON.parse(body)))
    } catch (error) {
      json(response, 400, { error: error instanceof Error ? error.message : 'Could not answer the question.' })
    }
    return
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405).end()
    return
  }
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
  const file = path.resolve(dist, relative)
  if (!file.startsWith(dist + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404).end()
    return
  }
  response.writeHead(200, { 'Content-Type': `${mime[path.extname(file)] || 'application/octet-stream'}`, 'Cache-Control': 'no-store' })
  if (request.method === 'HEAD') response.end()
  else fs.createReadStream(file).pipe(response)
}).listen(port, host, () => console.log(`Lens Text local web server: http://${host}:${port}`))
