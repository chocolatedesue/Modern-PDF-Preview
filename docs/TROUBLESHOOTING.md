# Troubleshooting

## PDF stays on loading

- Reopen the file.
- Check the developer console for webview errors.
- In VS Code Web, prefer smaller files if memory is tight.

## macOS VS Code worker engine stalls

On macOS desktop VS Code, EmbedPDF's Web Worker engine can initialize the
toolbar but leave the document stuck on `Loading document...`. The PDF itself is
still fetched through `asWebviewUri`; the failure is in the worker-backed PDFium
engine path inside the VS Code webview runtime.

The extension defaults `modernPdfViewer.worker` to `false` so PDF files render
through the direct PDFium engine in VS Code desktop webviews. This preserves
binary URI loading and avoids base64 data injection, but it means PDF processing
runs on the webview UI thread. For very large files, this may be less responsive
than the worker path.

To retest the worker path after VS Code or EmbedPDF changes, enable:

```json
{
  "modernPdfViewer.worker": true
}
```

Expected regression signal: the toolbar appears, but the page area remains on
`Loading document...`. If the document renders with `worker: true`, prefer the
worker path again for better large-file responsiveness.

## Web build does not load

Check:

- `package.json` has both `main` and `browser`
- web capabilities are enabled
- the web bundle exists in `media/`

## WASM blocked by CSP

If the viewer fails during WASM startup, verify the webview CSP allows:

- `wasm-unsafe-eval`
- worker loading from `blob:`

## Save does not work

- Confirm the PDF is not opened from a read-only source.
- In Web mode, saving support may be limited by the host environment.
- Check the output channel for save errors.

## Headless test issues

Use:

```bash
bun run test-web-headless
```

Do not run browser-based tests without headless mode on a server without a display.
