import PdfViewerApi from "./api";
import Logger from "./logger";
const vscode = require("vscode");

const START_PAGE_OPTS = {
  enableScripts: true,
  retainContextWhenHidden: true,
};

/**
 * @implements {import("..").PdfFileDataProvider}
 */
class PDFDoc {
  /**
   * @param {vscode.Uri} uri
   */
  constructor(uri) {
    this._uri = uri;
  }

  async dispose() { }

  get uri() {
    return this._uri;
  }

  /**
   * Reads the file data.
   * @returns {Promise<Uint8Array>}
   */
  async getFileData() {
    try {
      const fileData = await vscode.workspace.fs.readFile(this.uri);
      const dataProvider = PdfViewerApi.PdfFileDataProvider.fromUint8Array(fileData);
      return await dataProvider.getFileData();
    } catch (err) {
      throw err;
    }
  }
}

export default class PDFEdit {
  /**
   * Registers the custom editor provider.
   * @param {vscode.ExtensionContext} context
   * @returns {vscode.Disposable}
   */
  static register(context) {
    const provider = new PDFEdit(context);
    return vscode.window.registerCustomEditorProvider(PDFEdit.viewType, provider);
  }

  static viewType = "modernPdfViewer.PDFEdit";

  /**
   * @param {vscode.ExtensionContext} context
   */
  constructor(context) {
    this.context = context;
  }

  /**
   * Called when the custom editor is opened.
   * @param {vscode.CustomDocument} document
   * @param {vscode.WebviewPanel} panel
   * @param {vscode.CancellationToken} _token
   */
  async resolveCustomEditor(document, panel, _token) {
    Logger.log(`Resolving Custom Editor for: ${document.uri.toString()}`);
    await this.setupWebview(document, panel);
  }

  /**
   * Opens the custom document.
   * @param {vscode.Uri} uri
   * @param {vscode.CustomDocumentOpenContext} _context
   * @param {vscode.CancellationToken} _token
   * @returns {Promise<PDFDoc>}
   */
  async openCustomDocument(uri, _context, _token) {
    Logger.log(`Opening Custom Document: ${uri.toString()}`);
    return new PDFDoc(uri);
  }

  /**
   * Sets up the webview content and message handling.
   * @param {PDFDoc} dataProvider
   * @param {vscode.WebviewPanel} panel
   */
  async setupWebview(dataProvider, panel) {
    const extUri = this.context.extensionUri;
    const mediaUri = vscode.Uri.joinPath(extUri, "media");

    panel.webview.options = START_PAGE_OPTS;

    try {
      // Load HTML template
      const htmlPath = vscode.Uri.joinPath(extUri, "src", "webview.html");
      const htmlContent = new TextDecoder("utf-8").decode(await vscode.workspace.fs.readFile(htmlPath));

      // Resolve resources
      const editorJsUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, "editor.js"));
      const editorCssUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, "editor.css"));
      const wasmUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, "pdfium.wasm"));

      // Dynamic Worker Resolution
      const workerFilename = await this.findWorkerFilename(mediaUri);
      const workerUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, workerFilename));

      // Inject variables into HTML
      panel.webview.html = htmlContent
        .replace(/{{CSP_SOURCE}}/g, panel.webview.cspSource)
        .replace(/{{EDITOR_JS_URI}}/g, editorJsUri.toString())
        .replace(/{{EDITOR_CSS_URI}}/g, editorCssUri.toString());

      // Prepare init message
      const msg = {
        command: "preview",
        wasmUri: wasmUri.toString(true),
        workerUri: workerUri.toString(true)
      };

      // Message Handling
      panel.webview.onDidReceiveMessage(async (message) => {
        if (message.command === 'ready') {
          await this.handleWebviewReady(dataProvider, panel, msg);
        }
      });

    } catch (e) {
      Logger.log(`Error setting up webview: ${e}`);
      panel.webview.html = `<h1>Error loading viewer</h1><p>${e.message}</p>`;
    }
  }

  /**
   * Handles the 'ready' message from the webview.
   * @param {PDFDoc} dataProvider 
   * @param {vscode.WebviewPanel} panel 
   * @param {Object} initMsg 
   */
  async handleWebviewReady(dataProvider, panel, initMsg) {
    const isWeb = vscode.env.uiKind === vscode.UIKind.Web;
    Logger.log(`[Webview Ready] Environment: ${isWeb ? "Web" : "Desktop"} (UIKind: ${vscode.env.uiKind})`);

    if (dataProvider.uri && !isWeb) {
      Logger.log("Strategy: URI Mode (Standard)");
      initMsg.pdfUri = panel.webview.asWebviewUri(dataProvider.uri).toString(true);
      panel.webview.postMessage(initMsg);
    } else {
      Logger.log("Strategy: Data Injection Mode (Web/Fallback)");
      try {
        const data = await dataProvider.getFileData();
        initMsg.data = data;
        panel.webview.postMessage(initMsg);
      } catch (err) {
        Logger.log(`Error loading file data: ${err}`);
        panel.webview.postMessage({
          command: 'error',
          error: err.message || String(err)
        });
      }
    }
  }

  /**
   * Finds the worker file in the media directory dynamically.
   * @param {vscode.Uri} mediaUri 
   * @returns {Promise<string>}
   */
  async findWorkerFilename(mediaUri) {
    try {
      const children = await vscode.workspace.fs.readDirectory(mediaUri);
      // Look for worker-engine-*.js or worker-engine.js
      const workerFile = children.find(([name, type]) =>
        name.startsWith("worker-engine") && name.endsWith(".js")
      );

      if (workerFile) {
        return workerFile[0];
      }

      Logger.log("Worker file not found, defaulting to 'worker-engine.js'");
      return "worker-engine.js";
    } catch (e) {
      Logger.log(`Error listing media folder: ${e} - Defaulting to 'worker-engine.js'`);
      return "worker-engine.js";
    }
  }
}
