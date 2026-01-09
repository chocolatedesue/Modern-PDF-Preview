# API Reference

Modern PDF Pro (WASM) exports an API that other extension authors can use to open PDF previews within VS Code.

## Usage

To use the API, you must first obtain it from the extension.

```javascript
const pdfViewer = vscode.extensions.getExtension('chocolatedesue.modern-pdf-pro');
const api = await pdfViewer.activate();
const pdfApi = api.getV1Api();
```

## `PdfViewerApi`

### `previewPdfFile(provider)`

Creates a new Webview panel and displays the PDF provided by the `provider`.

- `provider`: An instance of `PdfFileDataProvider`.

## `PdfFileDataProvider`

A holder for PDF file data.

### Static Methods

- `fromBase64String(base64Data)`: Creates a provider from a Base64 encoded string.
- `fromUint8Array(u8array)`: Creates a provider from a `Uint8Array`.

### Instance Methods

- `withName(newName)`: Sets the display name for the PDF (shown as the tab title). Returns the instance for chaining.

## Example

```javascript
import * as vscode from 'vscode';

export async function activate(context) {
    const pdfViewer = vscode.extensions.getExtension('chocolatedesue.modern-pdf-pro');
    const api = await pdfViewer.activate();
    const pdfApi = api.getV1Api();

    const disposable = vscode.commands.registerCommand('my-extension.previewPdf', async (uri) => {
        const fileData = await vscode.workspace.fs.readFile(uri);
        const provider = pdfApi.PdfFileDataProvider.fromUint8Array(fileData)
                            .withName('Custom Preview');
        pdfApi.previewPdfFile(provider);
    });

    context.subscriptions.push(disposable);
}
```
