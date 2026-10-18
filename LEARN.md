# Learn Lens Text

This guide helps you understand the project and make your first change. You can work on the web app without changing the Windows desktop code.

## 1. Try the app

Install [Node.js](https://nodejs.org/) if it is not already installed. In a terminal opened in the repository folder, run:

```sh
npm install
npm run dev
```

Open the local address printed in the terminal. Add a PNG, JPEG, or WebP image, then choose **Extract All**. You can edit the extracted text and copy one result or all results.

To try the Windows desktop app during development, run:

```sh
npm run dev:desktop
```

## 2. Find your way around

- `src/App.tsx` contains the main React app: image input, queue, OCR, and copying results.
- `src/App.css` and `src/index.css` contain the app's styles.
- `electron/main.cjs` sets up the desktop window, screen capture, and global shortcut.
- `electron/snip.html`, `electron/snip.css`, and `electron/snip.js` implement the screen selection overlay.
- `public/ocr/` contains the OCR worker, engine files, and bundled English language data.
- `scripts/copy-ocr-assets.cjs` prepares OCR files for development and builds.

## 3. Follow an image through OCR

1. The app accepts PNG, JPEG, and WebP files. You can select files, drop them into the app, or paste an image from the clipboard.
2. `src/App.tsx` adds each accepted image to the queue and creates a temporary browser URL to display it.
3. Tesseract.js loads the bundled worker and English language data from `public/ocr/`.
4. OCR progress and recognized text are saved to the image's queue item.
5. You can edit the result and copy it. The images are processed locally; the app does not send them to a server.

## 4. Make a small change

Choose one focused improvement, such as clarifying a message, adjusting a style, or fixing a small bug. Search the files above for the relevant text or component, make the change, and run:

```sh
npm run lint
npm run build
```

Then start the app with `npm run dev` and try the changed behavior. For a visual change, check both light and dark themes and a narrow window size.

## 5. Learn more

- Read [CONTRIBUTING.md](CONTRIBUTING.md) for branch and pull request guidance.
- Read [README.md](README.md) for app features and run commands.
- Read [LICENSE](LICENSE) for the project's MIT License.

When you are ready, describe what you changed and how someone can verify it in your pull request.
