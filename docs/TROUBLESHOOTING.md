# Troubleshooting

## PDF stays on loading

- Reopen the file.
- Check the developer console for webview errors.
- In VS Code Web, prefer smaller files if memory is tight.

## VS Code desktop worker engine stalls

In desktop VS Code, EmbedPDF's Web Worker engine can initialize the
toolbar but leave the document stuck on `Loading document...`. The PDF itself is
still fetched through `asWebviewUri`; the failure is in the worker-backed PDFium
engine path inside the VS Code webview runtime.

The extension defaults `worker: true` so PDF processing runs in EmbedPDF's worker
engine instead of the webview UI thread.

To disable the worker path and force the direct engine, set:

```json
{
  "modernPdfViewer.worker": false
}
```

In VS Code desktop webviews, the extension first fetches `pdfium.wasm` on the
webview UI thread and passes a `blob:` URL to the worker. This bypasses worker
fetches against VS Code resource URLs. If that preparation fails, the extension
logs a warning and falls back to the direct engine instead of leaving the PDF
stuck on `Loading document...`.

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
