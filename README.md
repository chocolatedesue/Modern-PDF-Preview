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

### 🖊️ Annotation Support
Review and mark up documents directly.
- **Highlight** important text.
- **Draw** ink signatures or diagrams.
- **Add Notes** and comments.

### 🌐 Universal Support
Works everywhere you use VS Code.
- **Desktop**: Windows, macOS, Linux.
- **Web**: VS Code for Web (vscode.dev), GitHub Codespaces.
- **Privacy-First**: All rendering happens locally. Your data never leaves your machine (or browser sandbox).

### 🎨 Seamless Integration
- **Theme Sync**: Automatically adapts to Light, Dark, and High Contrast themes.
- **Rich Toolbar**: Thumbnails, Outline/Bookmarks, Search, Print, and Presentation Mode.

## 📦 Installation & Search

### 🔍 Search
Search for **"Modern PDF Preview"** in the VS Code Extensions panel.

### 🆔 Extension ID
`chocolatedesue.modern-pdf-preview`

### 🌐 Direct Links
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=chocolatedesue.modern-pdf-preview)
- [Open VSX Registry](https://open-vsx.org/extension/chocolatedesue/modern-pdf-preview)

## 📚 Documentation

- **[Technical Architecture](docs/ARCHITECTURE.md)**: Learn how we use WASM and Web Workers.
- **[API Reference](docs/API.md)**: Integrate PDF previewing into your own extension.
- **[Troubleshooting](docs/TROUBLESHOOTING.md)**: Solutions for common issues.

## Credits & Disclaimer

This project is a modern evolution of the [vscode-pdf-viewer](https://github.com/AdamRaichu/vscode-pdf-viewer) project.

It leverages the **[embed-pdf-viewer](https://github.com/embedpdf/embed-pdf-viewer)** component for robust and high-performance PDF rendering via WebAssembly.

> **Note**: I am **NOT** the maintainer of `pdfium` or `embed-pdf-viewer`. This extension is a wrapper that integrates these excellent technologies into VS Code. 
>
> If you encounter rendering bugs or specific PDF feature issues, please check the upstream repositories. I cannot fix core rendering engine bugs.

[vsc-marketplace]: https://marketplace.visualstudio.com/items?itemName=chocolatedesue.modern-pdf-preview

