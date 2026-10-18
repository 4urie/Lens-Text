# Lens Text

Lens Text turns text in PNG, JPEG, or WebP images into editable text. Select several files, drop a group of images, or paste screenshots with **Ctrl+V**. Select **Extract All** to process the queue. Each image gets its own editable result. **Copy Text** copies the selected result; **Copy All Results** combines nonempty results in image order with filenames.

In the Windows desktop app, press **Ctrl+Shift+O** from any app or select **Screen Snip** in Lens Text. Drag over the screen area you want to read. The selection is added to the queue and extracted automatically. Press **Esc** to cancel. If another app already uses the shortcut, the Screen Snip button still works. Screen Snip is a desktop feature; the web app keeps its upload, drop, and paste options.

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

The installer is created at `release/Lens Text Setup 1.2.0.exe`. Close an older Lens Text version and run this installer to update it. The unpacked app is in `release/win-unpacked`.

## Checks

```powershell
npm run lint
npm run build
```

`src/App.tsx` contains image input, the batch queue, OCR, clipboard, and result handling. `src/App.css` and `src/index.css` contain the responsive light and dark styles. `electron/main.cjs` manages the sandboxed desktop window, global shortcut, and screen capture. `electron/snip.html` and `electron/snip.js` provide the selection overlay. `scripts/copy-ocr-assets.cjs` copies the OCR engine files from installed dependencies into `public/ocr` before development or builds. `public/ocr/eng.traineddata.gz` is the bundled English model.

The English model comes from the [Tesseract.js English data package](https://www.npmjs.com/package/@tesseract.js-data/eng). To add another language, include its trained data and update the worker language in `src/App.tsx`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and contribution guidelines. Contributions are welcome, including bug reports, documentation improvements, and code changes.

## License

Lens Text is available under the [MIT License](LICENSE).
