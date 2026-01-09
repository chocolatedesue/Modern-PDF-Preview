# Technical Architecture

This document describes the technical design of the **Modern PDF Preview** extension.

## Overview

This extension differentiates itself from legacy viewers by using a modern stack designed for performance and security.

### 1. Rendering Engine
We use `pdfium.wasm` (via `embed-pdf-viewer`), a compiled WebAssembly version of the industry-standard **PDFium** library. 
- **Consistency**: Ensures rendering matches Google Chrome's native PDF viewer.
- **Performance**: High-speed rendering with low memory overhead compared to pure JS solutions.

### 2. Web Workers
Rendering tasks are offloaded to a Web Worker (`worker-engine.js`).
- **Responsiveness**: Keeps the VS Code UI thread responsive, even when rendering large or complex documents.
- **Isolation**: Crashes in the rendering engine are less likely to bring down the extension host.

### 3. Hybrid Loading Strategy
To support both Desktop and Web environments, we implement a hybrid loading mechanism:

- **Desktop (Local)**: Uses standard `vscode-resource:` URIs for efficient native file access.
- **Web (Remote/Virtual)**: Uses a "Data Injection" fallback.
    - The extension host reads the file content into memory.
    - Content is streamed to the webview as a Blob URL.
    - This bypasses `401 Unauthorized` errors and CORS issues common in browser-based VS Code (vscode.dev).

### 4. Components
- **Frontend**: Built with `embed-pdf-viewer`, providing a rich UI for zoom, navigation, and annotations.
- **Extension Host**: Handles file system interactions and message passing using the VS Code `CustomEditorProvider` API.
