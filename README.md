# Lens Text

Lens Text turns text in a PNG, JPG, JPEG, or WebP image into editable text. Drop an image, choose a file, or paste a screenshot with **Ctrl+V**. Select **Extract Text**, edit the result if needed, and select **Copy Text**.

OCR runs in your browser or in the Electron window. Images are not sent to a server. The English language data, OCR worker, and WebAssembly engine are included with the project, so OCR needs no runtime download after the app is built. Recognition is currently English only.

## Run the web app

Open PowerShell in the `lens-text` folder and run:

```powershell
npm run dev
```

Open the local URL Vite prints, normally `http://localhost:5173`.

## Run the Windows desktop app

For desktop development with automatic React updates:

```powershell
npm run dev:desktop
```

To build and launch the production desktop app:

```powershell
npm run desktop
```

To make a Windows installer:

```powershell
npm run dist:win
```

The installer is created at `release/Lens Text Setup 1.0.0.exe`. The unpacked app is in `release/win-unpacked`.

## Checks

```powershell
npm run lint
npm run build
```

`src/App.tsx` contains image input, OCR, clipboard, and result handling. `src/App.css` and `src/index.css` contain the responsive light and dark styles. `electron/main.cjs` opens the built site in a sandboxed Electron window. `scripts/copy-ocr-assets.cjs` copies the OCR engine files from installed dependencies into `public/ocr` before development or builds. `public/ocr/eng.traineddata.gz` is the bundled English model.

The English model comes from the [Tesseract.js English data package](https://www.npmjs.com/package/@tesseract.js-data/eng). To add another language, include its trained data and update the worker language in `src/App.tsx`.
