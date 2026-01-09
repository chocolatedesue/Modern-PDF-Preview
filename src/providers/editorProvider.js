import Logger from "../services/logger";
import { VIEW_TYPE, WEBVIEW_OPTIONS, MEDIA_FILES } from "../constants/index.js";
import { getPdfConfiguration } from "../managers/configManager";
import { activeEditors } from "../managers/editorManager";
import { PDFDoc } from "../models/document";
import { getWebviewHtml, getErrorHtml } from "./webviewHtmlBuilder";

const vscode = require("vscode");

/**
 * @implements {vscode.CustomEditorProvider}
 */
export default class PDFEdit {
  /**
   * Registers the custom editor provider.
   * @param {vscode.ExtensionContext} context
   * @returns {vscode.Disposable}
   */
  static register(context) {
    PDFEdit.globalContext = context;
    const provider = new PDFEdit(context);
    return vscode.window.registerCustomEditorProvider(PDFEdit.viewType, provider, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
      supportsMultipleEditorsPerDocument: false,
    });
  }

  /**
   * Force save the current active document.
   * @param {vscode.ExtensionContext} context
   */
  static async forceSave(context) {
    // Find the active panel's URI
    let activeEntry = null;
    let activeUri = null;

    for (const [uri, entry] of activeEditors.entries()) {
      if (entry.panel.active) {
        activeUri = vscode.Uri.parse(uri);
        activeEntry = entry;
        break;
      }
    }

    if (!activeEntry || !activeUri) {
      Logger.log('[Force Save] No active PDF editor found');
      return;
    }

    Logger.log(`[Force Save] Triggering save for ${activeUri.toString()}`);

    // Create a dummy cancellation token source since this is a command
    const tokenSource = new vscode.CancellationTokenSource();

    // Use an instance to call the private #performSave
    const provider = new PDFEdit(context);

    try {
      await provider.#performSave(activeUri, activeEntry.panel, tokenSource.token);
      vscode.window.showInformationMessage("PDF Saved Successfully");
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to save PDF: ${e.message}`);
    } finally {
      tokenSource.dispose();
    }
  }

  static viewType = VIEW_TYPE;
  static globalContext = null;

  /**
   * Preview a PDF file from an API provider.
   * @param {import("../api").PdfFileDataProvider} provider
   * @param {vscode.WebviewPanel} panel
   */
  static async previewPdfFile(provider, panel) {
    panel.webview.options = WEBVIEW_OPTIONS;

    const editor = new PDFEdit(PDFEdit.globalContext);
    if (!PDFEdit.globalContext) {
      Logger.log('[Error] Extension context not initialized. Call register() first.');
      return;
    }

    await editor.setupWebview(provider, panel);
  }

  /**
   * @param {vscode.ExtensionContext} context
   */
  constructor(context) {
    this.context = context;
    this._onDidChangeCustomDocument = new vscode.EventEmitter();
    this.onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;
  }

  /**
   * Save the custom document.
   * @param {vscode.CustomDocument} document
   * @param {vscode.CancellationToken} cancellation
   * @returns {Promise<void>}
   */
  async saveCustomDocument(document, cancellation) {
    const uriString = document.uri.toString();
    const editorEntry = activeEditors.get(uriString);

    if (!editorEntry || !editorEntry.panel) {
      Logger.log(`[Error] No active panel found for ${uriString}`);
      return;
    }

    return this.#performSave(document.uri, editorEntry.panel, cancellation);
  }

  /**
   * Internal helper to save document
   * @param {vscode.Uri} uri
   * @param {vscode.WebviewPanel} panel
   * @param {vscode.CancellationToken} cancellation
   */
  async #performSave(uri, panel, cancellation) {
    const uriString = uri.toString();
    const editorEntry = activeEditors.get(uriString);

    if (!editorEntry) {
      throw new Error(`No active editor entry for ${uriString}`);
    }

    Logger.log(`[Save] Initiating save for ${uriString}`);

    // Create a promise that resolves when the webview returns the data
    return new Promise((resolve, reject) => {
      // Set the resolver to be called when 'save-response' is received
      editorEntry.resolveSave = async (data) => {
        try {
          if (!data) {
            Logger.log(`[Save] No data received from webview`);
            resolve();
            return;
          }

          Logger.log(`[Save] Writing ${data.byteLength} bytes to ${uri.fsPath}`);
          await vscode.workspace.fs.writeFile(uri, data);

          Logger.log(`[Save] File saved successfully`);
          resolve();
        } catch (e) {
          Logger.log(`[Save] Error writing file: ${e}`);
          reject(e);
        } finally {
          editorEntry.resolveSave = null;
        }
      };

      // Send save command
      panel.webview.postMessage({ command: 'save' });

      // Handle cancellation/timeout
      const timeout = setTimeout(() => {
        if (editorEntry.resolveSave) {
          Logger.log(`[Save] Timeout waiting for webview response`);
          editorEntry.resolveSave = null;
          reject(new Error("Save timed out"));
        }
      }, 30000); // 30s timeout

      cancellation.onCancellationRequested(() => {
        clearTimeout(timeout);
        editorEntry.resolveSave = null;
        reject(new Error("Save cancelled"));
      });
    });
  }

  /**
   * Revert the custom document.
   * @param {vscode.CustomDocument} document
   * @param {vscode.CancellationToken} _cancellation
   * @returns {Promise<void>}
   */
  async revertCustomDocument(document, _cancellation) {
    const uriString = document.uri.toString();
    const editorEntry = activeEditors.get(uriString);

    Logger.log(`[Revert] Reverting document: ${uriString}`);

    // Notify webview to reload
    if (editorEntry && editorEntry.panel) {
      // Re-initialize the webview with fresh data
      // This will trigger 'ready' -> handleWebviewReady -> getFileData (fresh)
      await this.setupWebview(document, editorEntry.panel);
    }
  }

  /**
   * Backup the custom document.
   * @param {vscode.CustomDocument} document
   * @param {vscode.CustomDocumentBackupContext} _context
   * @param {vscode.CancellationToken} _cancellation
   * @returns {Promise<vscode.CustomDocumentBackup>}
   */
  async backupCustomDocument(document, _context, _cancellation) {
    // Implementation for hot exit / backup
    return {
      id: document.uri.toString(),
      delete: () => { }
    };
  }

  /**
   * Called when the custom editor is opened.
   * @param {vscode.CustomDocument} document
   * @param {vscode.WebviewPanel} panel
   * @param {vscode.CancellationToken} _token
   */
  async resolveCustomEditor(document, panel, _token) {
    const uriString = document.uri.toString();
    Logger.log(`Resolving Custom Editor for: ${uriString}`);

    // Register editor instance
    activeEditors.set(uriString, {
      panel,
      resolveSave: null,
      messageDisposable: null // Will be set in setupWebview
    });

    // Check if webview is already set up (to prevent reinitialization on tab switch)
    if (panel.webview.html && panel.webview.html.length > 0) {
      Logger.log('Webview already initialized, skipping setup');
      return;
    }

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
   * @param {PDFDoc|import("../api").PdfFileDataProvider} dataProvider
   * @param {vscode.WebviewPanel} panel
   */
  async setupWebview(dataProvider, panel) {
    const startTime = Date.now();
    const extUri = this.context.extensionUri;
    const mediaUri = vscode.Uri.joinPath(extUri, "media");

    const uri = dataProvider.uri || (typeof dataProvider.getRawData === 'function' ? vscode.Uri.parse(`pdf-api:///${encodeURIComponent(dataProvider.name)}`) : null);
    const uriString = uri ? uri.toString() : 'unknown-uri';

    const isWeb = vscode.env.uiKind === vscode.UIKind.Web;
    let localResourceRoots = [mediaUri];

    if (!isWeb && uri && uri.scheme !== 'pdf-api') {
      try {
        const path = require('path');
        const pdfDir = vscode.Uri.file(path.dirname(uri.fsPath));
        localResourceRoots.push(pdfDir);
      } catch (e) {
        Logger.log(`[Warning] Could not resolve PDF directory for localResourceRoots: ${e}`);
      }
    }

    panel.webview.options = {
      ...WEBVIEW_OPTIONS,
      localResourceRoots: localResourceRoots
    };
    Logger.log(`[Performance] Webview setup started for ${uriString}`);

    try {
      // Load HTML template
      const htmlPath = vscode.Uri.joinPath(mediaUri, MEDIA_FILES.WEBVIEW_HTML);
      const htmlContent = new TextDecoder("utf-8").decode(await vscode.workspace.fs.readFile(htmlPath));

      // Resolve resources
      const webviewBundleUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, MEDIA_FILES.WEBVIEW_BUNDLE));
      const wasmUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, MEDIA_FILES.WASM));

      // Inject variables into HTML
      panel.webview.html = getWebviewHtml(panel.webview, htmlContent, webviewBundleUri, mediaUri, wasmUri);

      // Prepare init message
      const config = getPdfConfiguration();
      const msg = {
        command: "preview",
        wasmUri: wasmUri.toString(true),
        config: config
      };

      // Ensure old message listeners are cleaned up if re-initializing
      const existingEntry = activeEditors.get(uriString);
      if (existingEntry && existingEntry.messageDisposable) {
        existingEntry.messageDisposable.dispose();
      }

      // Message Handling
      const messageDisposable = panel.webview.onDidReceiveMessage(async (message) => {
        if (message.command === 'ready') {
          await this.handleWebviewReady(dataProvider, panel, msg);
        } else if (message.command === 'log') {
          Logger.log(`[Webview] ${message.message}`);
        } else if (message.command === 'error') {
          Logger.log(`[Webview Error] ${message.error}`);
        } else if (message.command === 'dirty') {
          // Mark document as dirty
          Logger.log(`[Webview] Document marked dirty`);
          this._onDidChangeCustomDocument.fire({
            document: dataProvider,
            undo: () => { }, // We don't support undo/redo yet
            redo: () => { }
          });
        } else if (message.command === 'save-direct') {
          // Unsolicited save from webview (e.g. Ctrl+S)
          const rawData = message.data;
          if (rawData && uri && uri.scheme !== 'pdf-api') {
            Logger.log(`[Direct Save] Writing ${rawData.length} bytes to ${uri.fsPath}`);
            // Write file directly
            try {
              const buffer = new Uint8Array(rawData);
              await vscode.workspace.fs.writeFile(uri, buffer);

              Logger.log('[Direct Save] File overwritten successfully');
            } catch (e) {
              Logger.log(`[Direct Save] Failed to write file: ${e}`);
              panel.webview.postMessage({
                command: 'error',
                error: `Failed to save file: ${e.message}`
              });
            }
          }
        } else if (message.command === 'close') {
          vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        } else if (message.command === 'save-response') {
          // Handle save response
          const editorEntry = activeEditors.get(uriString);
          if (editorEntry && editorEntry.resolveSave) {
            const rawData = message.data;
            if (rawData) {
              // Convert standard Array back to Uint8Array
              editorEntry.resolveSave(new Uint8Array(rawData));
            } else {
              editorEntry.resolveSave(null);
            }
          }
        }
      });

      // Update entry with new disposable and current panel
      activeEditors.set(uriString, {
        panel,
        resolveSave: existingEntry ? existingEntry.resolveSave : null,
        messageDisposable
      });

      // Cleanup when panel is disposed
      panel.onDidDispose(() => {
        const entry = activeEditors.get(uriString);
        if (entry && entry.messageDisposable) {
          entry.messageDisposable.dispose();
        }
        activeEditors.delete(uriString);
        Logger.log(`Webview panel disposed for ${uriString}`);
      });

      const duration = Date.now() - startTime;
      Logger.logPerformance('Webview setup completed', duration);

    } catch (e) {
      const duration = Date.now() - startTime;
      Logger.log(`[Performance] Webview setup failed after ${duration}ms: ${e.stack || e}`);

      // Classify error type and provide helpful suggestions
      let errorType = 'Unknown Error';
      let suggestion = 'Please try reopening the file.';
      let canRetry = true;

      if (e.message && e.message.includes('WASM')) {
        errorType = 'WASM Loading Failed';
        suggestion = 'The WebAssembly module failed to load. Try reinstalling the extension.';
        canRetry = false;
      } else if (e.code === 'ENOENT' || (e.message && e.message.includes('ENOENT'))) {
        errorType = 'File Not Found';
        suggestion = 'The PDF file may have been moved or deleted.';
        canRetry = false;
      } else if (e.code === 'EACCES' || (e.message && e.message.includes('EACCES'))) {
        errorType = 'Permission Denied';
        suggestion = 'Check file permissions and try again.';
      } else if (e.message && e.message.includes('fetch')) {
        errorType = 'Network Error';
        suggestion = 'Failed to load required resources. Check your connection.';
      }

      // Display user-friendly error page
      panel.webview.html = getErrorHtml(errorType, e.message, suggestion, canRetry, duration);

      // Show VS Code notification with actions
      vscode.window.showErrorMessage(
        `PDF Viewer: ${errorType}`,
        'View Logs',
        'Report Issue'
      ).then(selection => {
        if (selection === 'View Logs') {
          Logger.show();
        } else if (selection === 'Report Issue') {
          vscode.env.openExternal(vscode.Uri.parse(
            'https://github.com/chocolatedesue/vscode-pdf/issues/new'
          ));
        }
      });
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

    // Create a new message object to avoid mutating the original initMsg
    // which is captured in the closure of the message handler
    const msg = { ...initMsg };

    if (dataProvider.uri && !isWeb) {
      Logger.log("Strategy: URI Mode (Standard)");
      msg.pdfUri = panel.webview.asWebviewUri(dataProvider.uri).toString(true);
      panel.webview.postMessage(msg);
    } else {
      Logger.log("Strategy: Data Injection Mode (Web/Fallback)");
      try {
        let data;
        if (dataProvider instanceof PDFDoc) {
          data = await dataProvider.getFileData();
        } else if (typeof dataProvider.getRawData === 'function') {
          data = dataProvider.getRawData();
        } else {
          data = await dataProvider.getFileData();
        }

        msg.data = data;

        // Note: We DO NOT use transferables here because 'data' might be coming from the global cacheManager.
        // Transferring the buffer would make it unusable for other editor instances or subsequent reads.
        // Standard cloning via postMessage is safer for shared cache data.
        panel.webview.postMessage(msg);
      } catch (err) {
        Logger.log(`Error loading file data: ${err}`);
        panel.webview.postMessage({
          command: 'error',
          error: err.message || String(err)
        });
      }
    }
  }

}
