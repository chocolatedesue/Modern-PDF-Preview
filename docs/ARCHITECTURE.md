# Architecture

The extension has two parts:

- Extension host: VS Code integration, file I/O, save flow, view-state persistence
- Webview: PDF UI built with Svelte and `@embedpdf/*`

## Runtime Layout

- `src/providers/`: custom editor provider and webview wiring
- `src/models/`: document loading and file watching
- `src/managers/`: editor tracking, config, view-state persistence
- `src/services/`: shared services such as logging
- `src/api/`: public API for other extensions
- `src/webview/`: Svelte app, viewer runtime, state, components

## Rendering

- Engine: `pdfium.wasm`
- Viewer stack: `@embedpdf/svelte-pdf-viewer`
- Target environments: desktop VS Code and VS Code Web

## Document Loading

- Local files use `asWebviewUri(...)` when possible.
- Web or API previews can fall back to data injection.
- The webview restores page position from persisted `viewState`.

## Resource Model

- Webviews keep context when hidden.
- State is persisted separately from the rendered viewer.
- Resources are released when the panel is disposed.
