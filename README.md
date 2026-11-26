# Modern PDF Preview (WASM)

<!-- markdownlint-disable MD033 -->

<div align="center">

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/chocolatedesue.modern-pdf-preview?color=darkblue&logo=visual%20studio%20code&logoColor=007acc)][vsc-marketplace]
[![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/chocolatedesue.modern-pdf-preview?color=darkblue&label=Install%20Count&logo=visual%20studio%20code&logoColor=007acc)][vsc-marketplace]
[![GitHub license](https://img.shields.io/github/license/chocolatedesue/Modern-PDF-Preview)](https://github.com/chocolatedesue/Modern-PDF-Preview/blob/main/LICENSE)

</div>

Fast PDF preview for VS Code, built on `EmbedPDF 3.x` (`@embedpdf/viewer-svelte`) and `PDFium WASM`.

## Features

- Fast PDF rendering with PDFium WebAssembly (Web Worker with automatic main-thread fallback)
- Annotations & interactive form filling with native VS Code dirty tracking, Undo/Redo, and `Ctrl+S` / `Cmd+S` save back to disk
- Desktop (`node`) and Web (`vscode.dev` / `github.dev`) dual runtime support
- Native VS Code theme token synchronization and status bar indicator (page, zoom, open PDF count)
- Persistent view state (page, scroll anchor, zoom, spread, rotation) across reloads
- Collision-free Public API for other VS Code extensions

## Settings

- `modernPdfViewer.defaultZoomLevel`
- `modernPdfViewer.defaultSpreadMode`
- `modernPdfViewer.tabBar`
- `modernPdfViewer.worker`
- `modernPdfViewer.enableForms`
- `modernPdfViewer.showStatusBar`

## Notes

- Hidden PDF tabs keep their webview context to preserve state.
- Memory usage grows with the number of open PDFs; the status bar shows the open PDF count when multiple tabs are open.
- Close unused PDF tabs if you work with large files.

## Install

- VS Code Marketplace: [chocolatedesue.modern-pdf-preview](https://marketplace.visualstudio.com/items?itemName=chocolatedesue.modern-pdf-preview)
- Open VSX: [chocolatedesue.modern-pdf-preview](https://open-vsx.org/extension/chocolatedesue/modern-pdf-preview)

## Docs

- [API](docs/API.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Development](docs/DEVELOPMENT.md)
- [Reference Repository](docs/REFERENCE.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## Credits

- [embed-pdf-viewer](https://github.com/embedpdf/embed-pdf-viewer)
- [PDFium WASM](https://github.com/bblanchon/pdfium-binaries)
- [mathematic-inc/vscode-pdf](https://github.com/mathematic-inc/vscode-pdf) as reference only

License: MIT

[vsc-marketplace]: https://marketplace.visualstudio.com/items?itemName=chocolatedesue.modern-pdf-preview
