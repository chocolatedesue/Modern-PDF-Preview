# Architecture

The extension has two parts:

- Extension host: VS Code integration, file I/O, save flow, view-state persistence
- Webview: Pure ES2022 Webview hosting `@embedpdf/viewer` (`<embedpdf-viewer>` Web Component) and `@embedpdf/engine`

## Runtime Layout

- `src/providers/`: custom editor provider and webview wiring
- `src/models/`: document loading and file watching
- `src/managers/`: editor tracking, config, view-state persistence
- `src/services/`: shared services such as logging
- `src/api/`: public API for other extensions
- `src/webview/`: Pure JS entrypoint, viewer runtime, state store, and VS Code bridge

## Rendering

- Engine: `pdfium.wasm`
- Viewer stack: `@embedpdf/viewer@3.4.0` + `@embedpdf/engine@3.4.0`
- Target environments: desktop VS Code and VS Code Web

## Document Loading

- Local files use `asWebviewUri(...)` when possible.
- Web or API previews can fall back to data injection.
- The webview restores page position from persisted `viewState`.

## Resource Model

- Webviews keep context when hidden.
- State is persisted separately from the rendered viewer.
- Resources are released when the panel is disposed.
