# Lens Text

Lens Text turns text in PNG, JPEG, or WebP images into editable text. Select several files, drop a group of images, or paste screenshots with **Ctrl+V**. Select **Extract All** to process the queue. Each image gets its own editable result. **Copy Text** copies the selected result; **Copy All Results** combines nonempty results in image order with filenames.

In the Windows desktop app, press **Ctrl+Shift+O** from any app or select **Screen Snip** in Lens Text. Drag over the screen area you want to read. The selection is added to the queue and extracted automatically. Press **Esc** to cancel. If another app already uses the shortcut, the Screen Snip button still works. Screen Snip is a desktop feature; the web app keeps its upload, drop, and paste options.

OCR runs in your browser or in the Electron window. Images are not sent to a server. The English language data, OCR worker, and WebAssembly engine are included with the project, so OCR needs no runtime download after the app is built. Recognition is currently English only. Using the optional AI feature sends extracted text and your question to DeepSeek.

## Ask AI about scans

Set `DEEPSEEK_API_KEY` in the environment before starting Lens Text. After extracting text, enter a question in **Ask about your scans**. **Scanned text** answers from the OCR results only. **Web search** searches with DeepSeek Search, then answers using the OCR results and web summaries; source links appear below the answer. The app sends up to 40,000 characters of extracted text per question. Images are not sent to DeepSeek. The local process sends the API key to DeepSeek for authentication.

The Windows app calls DeepSeek from its Electron main process. The local web app calls a server bound to `127.0.0.1`; `npm run dev` starts that server and Vite together. For a built local web app, run `npm run build` and then `npm run serve:web`, and open `http://127.0.0.1:8787`. The API key stays in the Electron process or local server environment, outside the browser bundle. The local server is intended for use on your own computer.

## Save and reopen a session

Select **Save Session** to download a JSON file containing the current images, extracted or edited text, and selected image. Later, select **Open Session** and choose that file to restore the queue. Opening a session replaces the current queue after confirmation. A session is portable between the web and Windows desktop app, and the file stays on your device. Images waiting for OCR can be extracted after reopening.

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
