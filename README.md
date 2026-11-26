# Modern PDF Preview (WASM)

<!-- markdownlint-disable MD033 -->

<div align="center">

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/chocolatedesue.modern-pdf-preview?color=darkblue&logo=visual%20studio%20code&logoColor=007acc)][vsc-marketplace]
[![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/chocolatedesue.modern-pdf-preview?color=darkblue&label=Install%20Count&logo=visual%20studio%20code&logoColor=007acc)][vsc-marketplace]
[![GitHub license](https://img.shields.io/github/license/chocolatedesue/Modern-PDF-Preview)](https://github.com/chocolatedesue/Modern-PDF-Preview/blob/main/LICENSE)

</div>

Fast PDF preview for VS Code powered by `@embedpdf/viewer` (Web Component) and `PDFium WASM` — zero framework overhead, Desktop & Web dual runtime.

## Features

- **PDFium WASM rendering**: Runs in a Web Worker (with automatic main-thread fallback) and streams local/remote files via zero-copy `asWebviewUri`.
- **Two-page spread & Fit Width by default**: Opens in `odd` two-page spread + `page-width` (Fit Width), customizable in VS Code Settings.
- **Annotations & form filling**: Native VS Code dirty tracking, Undo/Redo, and `Ctrl+S` / `Cmd+S` save back to disk.
- **VS Code integration**: Theme token sync, status bar (`Page X / Y · Z%` + open tab count), and persistent view state across reloads.
- **Desktop & Web**: Works on local Desktop, Remote-SSH / WSL / `code-server`, and `vscode.dev` / `github.dev`, plus a collision-free extension API.

## Settings

| Setting | Default | Options / Description |
| --- | --- | --- |
| `modernPdfViewer.defaultSpreadMode` | `"odd"` | `"odd"` (two-page), `"even"` (cover two-page), `"none"` (single-page) |
| `modernPdfViewer.defaultZoomLevel` | `"page-width"` | `"page-width"` (Fit Width), `"page-fit"`, `"page-height"`, `"auto"`, `"50%"`–`"400%"` |
| `modernPdfViewer.worker` | `true` | Render PDFs in a Web Worker (auto-fallback to main thread) |
| `modernPdfViewer.enableForms` | `true` | Enable interactive PDF form filling |
| `modernPdfViewer.showStatusBar` | `true` | Show page, zoom, and open PDF tab count in the status bar |
| `modernPdfViewer.tabBar` | `"never"` | `"never"`, `"multiple"`, `"always"` internal viewer tab bar |

## Install

- VS Code Marketplace: [chocolatedesue.modern-pdf-preview](https://marketplace.visualstudio.com/items?itemName=chocolatedesue.modern-pdf-preview)
- Open VSX: [chocolatedesue.modern-pdf-preview](https://open-vsx.org/extension/chocolatedesue/modern-pdf-preview)

## Docs

- [API](docs/API.md) · [Architecture](docs/ARCHITECTURE.md) · [Development](docs/DEVELOPMENT.md) · [Troubleshooting](docs/TROUBLESHOOTING.md)

## Credits

- [embed-pdf-viewer](https://github.com/embedpdf/embed-pdf-viewer) · [PDFium WASM](https://github.com/bblanchon/pdfium-binaries) · [mathematic-inc/vscode-pdf](https://github.com/mathematic-inc/vscode-pdf) (reference)

License: MIT

[vsc-marketplace]: https://marketplace.visualstudio.com/items?itemName=chocolatedesue.modern-pdf-preview
