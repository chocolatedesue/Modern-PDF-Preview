# Changelog

## [2.0.2] - 2026-11-26

### Changed
- Restored `modernPdfViewer.defaultSpreadMode` default to `"odd"` (two-page spread) alongside `modernPdfViewer.defaultZoomLevel` default `"page-width"` (Fit Width), with clearer Settings descriptions and concise `README.md` / `ARCHITECTURE.md` docs.

### Fixed
- Passed `zoom` (`ZoomSpec`, e.g. `{ mode: "fit-width" }`) directly into EmbedPDF 3.4.0 `plugins.stage` config so initial Fit Width and custom zoom defaults apply reliably on first open instead of starting in `automatic` mode.

## [2.0.1] - 2026-11-26

### Changed
- Changed `modernPdfViewer.defaultSpreadMode` default from `"odd"` (two-page spread) to `"none"` (single-page continuous) so PDFs remain sharp and unclipped in narrow VS Code editor panes (two-page spread remains selectable in settings and the toolbar).

### Fixed
- Fixed VS Code Web (`vscode.dev`), virtual workspaces, remote non-`file` URIs, and Hot Exit backup/untitled restores bypassing `PDFDoc.getFileData()` (ensuring `vscode.workspace.fs.readFile` and the 100 MB Web safety limit actually run).
- Kept Node-backed `file://` and `vscode-remote://` hosts (Desktop, Remote-SSH, WSL, `code-server`, and on-disk Hot Exit backups) on zero-copy `asWebviewUri` streaming; hardened Data Injection Mode (pure `vscode.dev` WebWorker, virtual FS, `untitled:`, and SDK in-memory previews) to encode binary payloads cleanly for VS Code's JSON `postMessage` bridge and decode via native `Uint8Array.fromBase64()` when available.

## [2.0.0] - 2026-11-26

### Changed
- Removed Svelte and migrated the webview to the pure `@embedpdf/viewer@3.4.0` (`<embedpdf-viewer>` Web Component) and `@embedpdf/engine@3.4.0` runtime, gaining 3.1 large-document page loading optimizations and 3.4 scrollbar/form focus fixes.
- Replaced private `export.saveAsCopy().toPromise()` save path with official 3.4.0 `viewer.documents.download()`, ensuring pending annotation and form edits flush cleanly before writing to disk.
- Replaced manual 2.x scroll/zoom/rotation persistence glue with native 3.4.0 `StageCapability.getViewState()` / `applyViewState()` (with backwards-compatible fallback for legacy 2.x saved page numbers).
- Switched toolbar gating from ineffective `disabledCategories` to 3.4.0 fine-grained `features` (preview-first defaults: annotations & form filling on; form building, measurement, redaction, snapshots, print/open/download chrome off).
- Updated toolchain dependencies (`webpack@5.113.0`, `webpack-cli@7.3.1`, `@vscode/vsce@^3.9.2`, `ovsx@^1.4.0`) while keeping `@types/vscode@1.75.0` aligned with `engines.vscode`.

### Added
- Native VS Code dirty state & Undo/Redo integration (`CustomDocumentEditEvent` wired to EmbedPDF 3.4.0 `HistoryCapability` and `documents.onUnsavedChangesChanged`).
- VS Code Status Bar indicator (`Page X / Y · Z%` and open PDF tab count tooltip), configurable via `modernPdfViewer.showStatusBar`.
- Visibility-aware webview lifecycle (`panel.onDidChangeViewState`) flushing view state on tab hide.
- VS Code theme CSS variable synchronization into EmbedPDF 3.4.0 theme tokens.
- `modernPdfViewer.enableForms` setting to toggle interactive form filling.

### Fixed
- Fixed `PdfViewerApi.previewPdfFile()` `activeEditors` key collision when multiple API previews share the default name, and fixed missing `onDidDispose` cleanup on API panels.
- Fixed unescaped HTML interpolation in `getErrorHtml()`.
- Updated `package.json`, `README.md`, and error dialog links from legacy `chocolatedesue/vscode-pdf` to `chocolatedesue/Modern-PDF-Preview`.
- Fixed `PdfFileDataProvider.fromBase64String()` to work in Web Extension environments without Node `Buffer`.

## [1.5.11] - 2026-06-20

- Fixed PDF documents staying stuck on `Loading document...` in VS Code desktop webviews by passing a blob-backed WASM URL to the EmbedPDF worker.
- Defaulted `modernPdfViewer.worker` to `true` so PDF processing runs off the webview UI thread, with fallback to the direct engine if worker preparation fails.
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
