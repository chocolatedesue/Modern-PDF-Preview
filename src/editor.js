import PdfViewerApi from "./api";

const vscode = require("vscode");

/**
 * @implements {import("..").PdfFileDataProvider}
 */
class PDFDoc {
  constructor(uri) {
    this._uri = uri;
  }

  async dispose() { }

  get uri() {
    return this._uri;
  }

  async getFileData() {
    var uri = this.uri;
    return new Promise(function (resolve, reject) {
      vscode.workspace.fs.readFile(uri).then(
        function (fileData) {
          return PdfViewerApi.PdfFileDataProvider.fromUint8Array(fileData)
            .getFileData()
            .then(function (data) {
              resolve(data);
            });
        },
        function (err) {
          reject(err);
        }
      );
    });
  }
}

export default class PDFEdit {
  static register() {
    const provider = new PDFEdit();
    return vscode.window.registerCustomEditorProvider(PDFEdit.viewType, provider);
  }

  static viewType = "modernPdfViewer.PDFEdit";

  constructor() { }

  async resolveCustomEditor(document, panel, _token) {
    PDFEdit.previewPdfFile(document, panel);
  }

  async openCustomDocument(uri, _context, _token) {
    return new PDFDoc(uri);
  }

  /**
   *
   * @param {import("..").PdfFileDataProvider} dataProvider The object containing the pdf file data.
   * @param {vscode.WebviewPanel} panel The webview panel object to use.
   */
  static previewPdfFile(dataProvider, panel) {
    const extUri = vscode.extensions.getExtension("chocolatedesue.modern-pdf-pro").extensionUri;
    panel.webview.options = {
      enableScripts: true,
    };
    panel.webview.html = `<!DOCTYPE html>
<html>

<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${panel.webview.cspSource} blob: data:; script-src ${panel.webview.cspSource} 'unsafe-eval' 'wasm-unsafe-eval'; style-src ${panel.webview.cspSource} 'unsafe-inline'; worker-src ${panel.webview.cspSource} blob: 'unsafe-eval' 'wasm-unsafe-eval'; connect-src ${panel.webview.cspSource} blob:; font-src ${panel.webview.cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script type="module" src="${panel.webview.asWebviewUri(vscode.Uri.joinPath(extUri, "media", "editor.js"))}"></script>
  <link rel="stylesheet" href="${panel.webview.asWebviewUri(vscode.Uri.joinPath(extUri, "media", "editor.css"))}">
</head>

<body>

  <div id="loading">
    <h1>Your PDF is loading...</h1>
    <p>If you see this screen for more than a few seconds, close this editor tab and reopen the file.</p>
  </div>
  <div id="error" style="display: none; color: var(--vscode-errorForeground); padding: 20px;">
    <h1>Error Loading PDF</h1>
    <pre id="error-message"></pre>
  </div>
  <div id="pdf-viewer" style="width: 100vw; height: 100vh;"></div>

</body>

</html>`;
    dataProvider.getFileData().then(function (data) {
      panel.webview.postMessage({
        command: "base64",
        data: data,
        wasmUri: panel.webview.asWebviewUri(vscode.Uri.joinPath(extUri, "media", "pdfium.wasm")).toString(true),
        workerUri: panel.webview.asWebviewUri(vscode.Uri.joinPath(extUri, "media", "worker-engine-BwJuk6Jt.js")).toString(true)
      });
    });
  }
}
