# Modern PDF Preview (WASM)

<!-- markdownlint-disable MD033 -->

<div align="center">

[![Visual Studio Marketplace Last Updated](https://img.shields.io/visual-studio-marketplace/last-updated/chocolatedesue.modern-pdf-preview?color=darkblue&logo=visual%20studio%20code&logoColor=007acc)][vsc-marketplace]
[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/chocolatedesue.modern-pdf-preview?color=darkblue&logo=visual%20studio%20code&logoColor=007acc)][vsc-marketplace]
[![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/chocolatedesue.modern-pdf-preview?color=darkblue&label=Install%20Count&logo=visual%20studio%20code&logoColor=007acc)][vsc-marketplace]


[![GitHub issues](https://img.shields.io/github/issues/chocolatedesue/vscode-pdf)](https://github.com/chocolatedesue/vscode-pdf/issues)
[![GitHub stars](https://img.shields.io/github/stars/chocolatedesue/vscode-pdf)](https://github.com/chocolatedesue/vscode-pdf/stargazers)
[![GitHub license](https://img.shields.io/github/license/chocolatedesue/vscode-pdf)](https://github.com/chocolatedesue/vscode-pdf/blob/main/LICENSE)

</div>

**Modern PDF Preview** is a next-generation PDF viewer for VS Code, designed for speed, accuracy, and productivity. 

It is built on top of **[PDFium WASM](https://github.com/bblanchon/pdfium-binaries)** and wrapped with **[embed-pdf-viewer](https://github.com/embedpdf/embed-pdf-viewer)**, delivering a Chrome-grade rendering experience directly inside your editor.

## ✨ Key Features

### 🚀 High Performance
Powered by **WebAssembly (WASM)**, this extension renders large PDFs instantly without slowing down VS Code. Smooth scrolling and zooming come standard.

### 🖊️ Annotation & Saving
Review and mark up documents directly.
- **Highlight** important text.
- **Draw** ink signatures or diagrams.
- **Add Notes** and comments.
- **Direct Save**: Press `Ctrl+S` (Windows/Linux) or `Cmd+S` (macOS) to directly overwrite the PDF file with your modifications.

### 🌐 Universal Support
Works everywhere you use VS Code.
- **Desktop**: Windows, macOS, Linux.
- **Web**: VS Code for Web (vscode.dev), GitHub Codespaces.
- **Privacy-First**: All rendering happens locally. Your data never leaves your machine (or browser sandbox).

### ⚙️ Configuration

Customize the initial viewer state in your VS Code settings:

- `modernPdfViewer.defaultZoomLevel`: Initial zoom (e.g., `page-width`, `page-fit`, `100%`).
- `modernPdfViewer.defaultSpreadMode`: Initial spread (e.g., `none`, `odd`, `even`).

### 🎨 Seamless Integration
- **Theme Sync**: Automatically adapts to Light, Dark, and High Contrast themes.
- **Rich Toolbar**: Thumbnails, Outline/Bookmarks, Search, Print, and Presentation Mode.

## 📦 Installation & Search

### 🔍 Search
Search for **"Modern PDF Preview"** in the VS Code Extensions panel or use the ID: `chocolatedesue.modern-pdf-preview`.

## 📚 Documentation

- **[Technical Architecture](docs/ARCHITECTURE.md)**: How WASM and Web Workers are used.
- **[Development Guide](docs/DEVELOPMENT.md)**: Setup, build, testing, and release procedures.
- **[API Reference](docs/API.md)**: Preview PDFs from your own extension.
- **[Troubleshooting](docs/TROUBLESHOOTING.md)**: Solutions for common issues.

## 📜 Credits & License

This project is an evolution of [vscode-pdf-viewer](https://github.com/AdamRaichu/vscode-pdf-viewer) and uses:
- **[embed-pdf-viewer](https://github.com/embedpdf/embed-pdf-viewer)**: Core UI component.
- **[PDFium WASM](https://github.com/bblanchon/pdfium-binaries)**: High-performance rendering engine (Apache 2.0 / BSD 3-Clause).

License: **MIT**

[vsc-marketplace]: https://marketplace.visualstudio.com/items?itemName=chocolatedesue.modern-pdf-preview

