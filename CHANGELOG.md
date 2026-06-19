# Changelog

## [1.5.10] - 2026-06-19

- Fixed PDF documents staying stuck on `Loading document...` in macOS VS Code webviews by defaulting the EmbedPDF worker engine off for the VS Code desktop runtime.
- Added `modernPdfViewer.worker` so the worker engine can be re-enabled when retesting newer VS Code or EmbedPDF runtimes.
- Allowed VS Code resource CDN URLs in the webview CSP so PDF/WASM/font resources can be fetched through `asWebviewUri`.
- Updated EmbedPDF and packaging/build dependencies.

## [1.5.8] - 2026-03-29

- Added SDK preview options for per-preview config and initial view state.
- Added support for opening API previews at a specific initial page.
- Reduced view-state persistence work during scroll.
- Fixed Blob creation for injected PDF data to avoid extra bytes and memory waste.
- Removed outdated save and viewer hooks, and trimmed project docs.

## [1.5.7] - 2026-03-29

- Reduced restore-time view-state churn.
- Moved viewer runtime and persistence logic into separate modules.

## [1.5.6] - 2026-03-29

- Updated Bun dependencies and build tooling.
- Fixed VSIX packaging by aligning `@types/vscode` with `engines.vscode`.
- Added `references/vscode-pdf` submodule and related docs.

## [1.5.5] - 2026-01-17

- Fixed broken reload after VS Code restart caused by expired webview URIs.
- Added page/view-state restoration after restart.
- Cached the HTML template to reduce file I/O.
- Unified save logic and reduced view-state serialization churn.
- Centralized webview options.
- Removed unused constants and imports.
