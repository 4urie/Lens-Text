const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const target = path.join(root, 'public', 'ocr')
fs.mkdirSync(target, { recursive: true })

const assets = [
  ['tesseract.js', 'dist/worker.min.js'],
  ['tesseract.js-core', 'tesseract-core-lstm.wasm.js'],
  ['tesseract.js-core', 'tesseract-core-lstm.wasm'],
  ['tesseract.js-core', 'tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core', 'tesseract-core-simd-lstm.wasm'],
  ['tesseract.js-core', 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['tesseract.js-core', 'tesseract-core-relaxedsimd-lstm.wasm'],
]

for (const [packageName, file] of assets) {
  const source = path.join(root, 'node_modules', packageName, file)
  fs.copyFileSync(source, path.join(target, path.basename(file)))
}

if (!fs.existsSync(path.join(target, 'eng.traineddata.gz'))) {
  throw new Error('Missing public/ocr/eng.traineddata.gz. Restore the bundled English language data before building.')
}

console.log('Local OCR assets are ready.')
