# Modern PDF Pro (WASM)

<!-- markdownlint-disable MD033 -->

<div align="center">

[![Visual Studio Marketplace Last Updated](https://img.shields.io/visual-studio-marketplace/last-updated/chocolatedesue.modern-pdf-pro?color=darkblue&logo=visual%20studio%20code&logoColor=007acc)][vsc-marketplace]
[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/chocolatedesue.modern-pdf-pro?color=darkblue&logo=visual%20studio%20code&logoColor=007acc)][vsc-marketplace]
[![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/chocolatedesue.modern-pdf-pro?color=darkblue&label=Install%20Count&logo=visual%20studio%20code&logoColor=007acc)][vsc-marketplace]
[![Patreon](https://img.shields.io/badge/Support-Patreon-FF424D?logo=patreon)][patreon-link]

[![GitHub issues](https://img.shields.io/github/issues/chocolatedesue/vscode-pdf)](https://github.com/chocolatedesue/vscode-pdf/issues)
[![GitHub stars](https://img.shields.io/github/stars/chocolatedesue/vscode-pdf)](https://github.com/chocolatedesue/vscode-pdf/stargazers)
[![GitHub license](https://img.shields.io/github/license/chocolatedesue/vscode-pdf)](https://github.com/chocolatedesue/vscode-pdf/blob/main/LICENSE)

</div>

**Modern PDF Pro** is a high-performance, privacy-focused PDF viewer for Visual Studio Code. It uses a modern WebAssembly (WASM) engine to render PDFs with speed and accuracy, supporting both Desktop and Web environments (GitHub Codespaces, vscode.dev).

## 🚀 Key Features

- **High Performance**: Powered by a custom WASM build of Google's PDFium engine. fast, efficient, and lightweight.
- **Web Ready**: Fully supported in **VS Code for Web** and **GitHub Codespaces**. We use intelligent data injection to bypass common browser CORS/permission issues.
- **Theme Sync**: Automatically adapts to your VS Code theme (Dark, Light, High Contrast).
- **Privacy First**: All rendering happens locally in your browser/webview. No data is sent to external servers.
- **Rich Tools**: Search, thumbnails, page navigation, and zoom.

## 📦 Installation & Search

You can find the extension in the Marketplace or OpenVSX Registry.

### 🔍 Search
Search for **"Modern PDF Pro"** in the VS Code Extensions panel.

### 🆔 Extension ID
Use the ID for direct installation:
`chocolatedesue.modern-pdf-pro`

### 🌐 Direct Links
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=chocolatedesue.modern-pdf-pro)
- [Open VSX Registry](https://open-vsx.org/extension/chocolatedesue/modern-pdf-pro)

## 🛠 Technical Architecture

This extension differentiates itself from legacy viewers by using a modern stack:

1.  **Rendering Engine**: Uses `pdfium.wasm` (via `embed-pdf-viewer`), a compiled WebAssembly version of the industry-standard PDFium library. This ensures consistent rendering matching Google Chrome.
2.  **Web Workers**: Rendering tasks are offloaded to a Web Worker (`worker-engine.js`), keeping the VS Code UI thread responsive even with large documents.
3.  **Hybrid Loading Strategy**:
    - **Desktop**: Uses standard `vscode-resource:` URIs for efficient native file access.
    - **Web**: Uses a "Data Injection" fallback. The extension host reads the file into memory and streams it to the webview as a Blob URL, solving 401 Unauthorized errors common in browser-based VS Code.

## 📚 API for Developers

Other extensions can use Modern PDF Pro to preview PDFs.

```javascript
const extension = vscode.extensions.getExtension('chocolatedesue.modern-pdf-pro');
const api = await extension.activate();
// See docs/API.md for full usage
```
Refer to [`docs/API.md`](docs/API.md) for full documentation.

## Credits

This project is a modern evolution of the [vscode-pdf-viewer](https://github.com/AdamRaichu/vscode-pdf-viewer) project.

[vsc-marketplace]: https://marketplace.visualstudio.com/items?itemName=chocolatedesue.modern-pdf-pro
[patreon-link]: https://www.patreon.com/bePatron?u=23456789 (Replace with real link if available)
