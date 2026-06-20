import Logger from "../services/logger";
import { VIEW_TYPE, WEBVIEW_OPTIONS, MEDIA_FILES } from "../constants/index.js";
import { getPdfConfiguration } from "../managers/configManager";
import { activeEditors } from "../managers/editorManager";
import { ViewStateManager } from "../managers/viewStateManager";
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
  static htmlTemplateCache = null; // Cache for HTML template

  /**
   * Preview a PDF file from an API provider.
   * @param {import("../api").PdfFileDataProvider} provider
   * @param {vscode.WebviewPanel} panel
   * @param {{ documentKey?: string, config?: Record<string, unknown>, viewState?: Record<string, unknown> }} [previewOptions]
   */
  static async previewPdfFile(provider, panel, previewOptions = {}) {
    panel.webview.options = WEBVIEW_OPTIONS;

    const editor = new PDFEdit(PDFEdit.globalContext);
    if (!PDFEdit.globalContext) {
      Logger.log('[Error] Extension context not initialized. Call register() first.');
      return;
    }

    await editor.setupWebview(provider, panel, previewOptions);
  }

  /**
   * @param {vscode.ExtensionContext} context
   */
  constructor(context) {
    this.context = context;
    this.viewStateManager = new ViewStateManager(context);
    this._onDidChangeCustomDocument = new vscode.EventEmitter();
    this.onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;
  }

  #getDataProviderUri(dataProvider) {
    if (dataProvider?.uri) {
      return dataProvider.uri;
    }

    if (typeof dataProvider?.getRawData === "function") {
      return vscode.Uri.parse(`pdf-api:///${encodeURIComponent(dataProvider.name)}`);
    }

    return null;
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
   * Save the custom document to a different location.
   * @param {vscode.CustomDocument} document
   * @param {vscode.Uri} destination
   * @param {vscode.CancellationToken} cancellation
   * @returns {Promise<void>}
   */
  async saveCustomDocumentAs(document, destination, cancellation) {
    const uriString = document.uri.toString();
    const editorEntry = activeEditors.get(uriString);

    if (!editorEntry || !editorEntry.panel) {
      throw new Error("No active PDF editor found for Save As");
    }

    await this.#ensureParentDirectory(destination);
    await this.#performSave(document.uri, editorEntry.panel, cancellation, destination);
  }

  /**
   * Internal helper to save document
   * @param {vscode.Uri} uri
   * @param {vscode.WebviewPanel} panel
   * @param {vscode.CancellationToken} cancellation
   * @param {vscode.Uri} [destinationUri]
   */
  async #performSave(uri, panel, cancellation, destinationUri = uri) {
    const uriString = uri.toString();
    const editorEntry = activeEditors.get(uriString);

    if (!editorEntry) {
      throw new Error(`No active editor entry for ${uriString}`);
    }

    if (editorEntry.pendingSave) {
      throw new Error("A save is already in progress for this document");
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    Logger.log(`[Save] Initiating save request ${requestId}`);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const entry = activeEditors.get(uriString);
        if (entry?.pendingSave?.requestId === requestId) {
          Logger.log(`[Save] Timeout waiting for webview response`);
          this.#cleanupPendingSave(entry);
          reject(new Error("Save timed out"));
        }
      }, 30000);

      const cancellationDisposable = cancellation.onCancellationRequested(() => {
        const entry = activeEditors.get(uriString);
        if (entry?.pendingSave?.requestId === requestId) {
          Logger.log(`[Save] Save request cancelled`);
          this.#cleanupPendingSave(entry);
          reject(new Error("Save cancelled"));
        }
      });

      editorEntry.pendingSave = {
        requestId,
        destinationUri,
        timeout,
        cancellationDisposable,
        resolve,
        reject,
      };

      panel.webview.postMessage({ command: "save", requestId });
    });
  }

  /**
   * Write file data to disk (unified method for all save operations)
   * @param {vscode.Uri} uri
   * @param {Uint8Array|ArrayLike<number>} data
   */
  async #writeFileData(uri, data) {
    const buffer = data instanceof Uint8Array ? data : new Uint8Array(data);
    const editorEntry = activeEditors.get(uri.toString());
    if (editorEntry?.dataProvider instanceof PDFDoc) {
      editorEntry.dataProvider.clearTransientSource();
      editorEntry.dataProvider.markPendingWrite();
    }
    Logger.log(`[Save] Writing ${buffer.byteLength} bytes`);
    await vscode.workspace.fs.writeFile(uri, buffer);
  }

  #cleanupPendingSave(editorEntry) {
    if (!editorEntry?.pendingSave) {
      return;
    }

    clearTimeout(editorEntry.pendingSave.timeout);
    editorEntry.pendingSave.cancellationDisposable.dispose();
    editorEntry.pendingSave = null;
  }

  async #resolvePendingSave(uriString, requestId, rawData) {
    const editorEntry = activeEditors.get(uriString);
    const pendingSave = editorEntry?.pendingSave;
    if (!pendingSave || pendingSave.requestId !== requestId) {
      return false;
    }

    this.#cleanupPendingSave(editorEntry);

    try {
      if (!rawData) {
        throw new Error("No data received from webview");
      }

      await this.#writeFileData(pendingSave.destinationUri, new Uint8Array(rawData));
      Logger.log(`[Save] File saved successfully`);
      pendingSave.resolve();
    } catch (error) {
      Logger.log(`[Save] Error writing file: ${error}`);
      pendingSave.reject(error instanceof Error ? error : new Error(String(error)));
    }

    return true;
  }

  #rejectPendingSave(uriString, requestId, errorMessage) {
    const editorEntry = activeEditors.get(uriString);
    const pendingSave = editorEntry?.pendingSave;
    if (!pendingSave || pendingSave.requestId !== requestId) {
      return false;
    }

    this.#cleanupPendingSave(editorEntry);
    pendingSave.reject(new Error(errorMessage || "Save failed"));
    return true;
  }

  #isAllowedExternalUri(uri) {
    return ["http", "https", "mailto"].includes((uri?.scheme || "").toLowerCase());
  }

  #getParentUri(uri) {
    const lastSlash = uri.path.lastIndexOf("/");
    return uri.with({
      path: lastSlash > 0 ? uri.path.slice(0, lastSlash) : "/",
    });
  }

  async #ensureParentDirectory(uri) {
    await vscode.workspace.fs.createDirectory(this.#getParentUri(uri));
  }

  async #handleOpenLink(message, documentUri) {
    const target = message.target;
    const result = message.result;

    try {
      if (result?.outcome === "uri" && result.uri) {
        const externalUri = vscode.Uri.parse(result.uri);
        if (!this.#isAllowedExternalUri(externalUri)) {
          Logger.log(`[Open Link] Blocked unsupported external URI scheme: ${externalUri.scheme}`);
          void vscode.window.showWarningMessage("Blocked an unsupported external link embedded in the PDF.");
          return;
        }
        await vscode.env.openExternal(externalUri);
        return;
      }

      if (!target || target.type !== "action") {
        return;
      }

      if (target.action.type === 3 && target.action.uri) {
        const externalUri = vscode.Uri.parse(target.action.uri);
        if (!this.#isAllowedExternalUri(externalUri)) {
          Logger.log(`[Open Link] Blocked unsupported external URI scheme: ${externalUri.scheme}`);
          void vscode.window.showWarningMessage("Blocked an unsupported external link embedded in the PDF.");
          return;
        }
        await vscode.env.openExternal(externalUri);
        return;
      }

      if (target.action.type !== 4 || !target.action.path || !documentUri) {
        return;
      }

      const normalizedPath = target.action.path.replace(/\\/g, "/");
      if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(normalizedPath) || normalizedPath.startsWith("/")) {
        Logger.log(`[Open Link] Blocked absolute or scheme-based file link`);
        void vscode.window.showWarningMessage("Blocked a PDF link that points to an absolute path or unsupported URI.");
        return;
      }

      const resourceUri = vscode.Uri.joinPath(this.#getParentUri(documentUri), normalizedPath);
      const targetLabel = resourceUri.path.split("/").pop() || resourceUri.toString(true);
      const selection = await vscode.window.showWarningMessage(
        `This PDF wants to open "${targetLabel}".`,
        { modal: true },
        "Open"
      );

      if (selection !== "Open") {
        return;
      }

      await vscode.commands.executeCommand("vscode.open", resourceUri);
    } catch (error) {
      Logger.log(`[Open Link] Failed to open link: ${error}`);
    }
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
    const stateKey = editorEntry?.stateKey || uriString;

    Logger.log(`[Revert] Reverting document: ${uriString}`);

    if (document instanceof PDFDoc) {
      document.clearTransientSource();
    }

    // Notify webview to reload
    if (editorEntry && editorEntry.panel) {
      await this.viewStateManager.flush(stateKey);
      await this.#postViewerMessage(document, editorEntry.panel, "reload");
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
    await this.#ensureParentDirectory(_context.destination);

    const uriString = document.uri.toString();
    const editorEntry = activeEditors.get(uriString);

    if (editorEntry?.panel) {
      await this.#performSave(document.uri, editorEntry.panel, _cancellation, _context.destination);
    } else if (typeof document.getFileData === "function") {
      await this.#writeFileData(_context.destination, await document.getFileData());
    } else {
      throw new Error("Unable to back up PDF without an active editor");
    }

    return {
      id: _context.destination.toString(),
      delete: () => {
        void vscode.workspace.fs.delete(_context.destination).catch(() => { });
      }
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

    const existingEntry = activeEditors.get(uriString);

    // Register editor instance
    activeEditors.set(uriString, {
      panel,
      stateKey: existingEntry?.stateKey || uriString,
      messageDisposable: existingEntry?.messageDisposable || null,
      changeDisposable: existingEntry?.changeDisposable || null,
      disposeDisposable: existingEntry?.disposeDisposable || null,
      lastViewState: existingEntry?.lastViewState || this.viewStateManager.getPersisted(uriString),
      dataProvider: document,
      pendingSave: existingEntry?.pendingSave || null
    });

    const changeEntry = activeEditors.get(uriString);
    if (typeof document.onDidChange === "function" && !changeEntry?.changeDisposable) {
      changeEntry.changeDisposable = document.onDidChange(async () => {
        Logger.log(`[Reload] Posting reload for ${uriString}`);
        const entry = activeEditors.get(uriString);
        const stateKey = entry?.stateKey || uriString;
        if (entry?.panel) {
          await this.viewStateManager.flush(stateKey);
          await this.#postViewerMessage(document, entry.panel, "reload");
        }
      });
    }

    if (!changeEntry?.disposeDisposable) {
      changeEntry.disposeDisposable = panel.onDidDispose(() => {
        const entry = activeEditors.get(uriString);
        if (entry?.pendingSave) {
          const pendingSave = entry.pendingSave;
          this.#cleanupPendingSave(entry);
          pendingSave.reject(new Error("Editor was closed before the save completed"));
        }
        if (entry?.messageDisposable) {
          entry.messageDisposable.dispose();
        }
        if (entry?.changeDisposable) {
          entry.changeDisposable.dispose();
        }
        activeEditors.delete(uriString);
        const stateKey = entry?.stateKey || uriString;
        void this.viewStateManager.flush(stateKey).finally(() => {
          this.viewStateManager.disposeUri(stateKey);
        });
        Logger.log(`Webview panel disposed for ${uriString}`);
      });
    }

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
    const backupUri = _context?.backupId ? vscode.Uri.parse(_context.backupId) : null;
    const initialData = _context?.untitledDocumentData || null;
    return new PDFDoc(uri, { backupUri, initialData });
  }

  /**
   * Sets up the webview content and message handling.
   * @param {PDFDoc|import("../api").PdfFileDataProvider} dataProvider
   * @param {vscode.WebviewPanel} panel
   */
  async setupWebview(dataProvider, panel, previewOptions = {}) {
    const startTime = Date.now();
    const extUri = this.context.extensionUri;
    const mediaUri = vscode.Uri.joinPath(extUri, "media");

    const uri = this.#getDataProviderUri(dataProvider);
    const uriString = uri ? uri.toString() : 'unknown-uri';
    const stateKey = previewOptions.documentKey || activeEditors.get(uriString)?.stateKey || uriString;

    let localResourceRoots = [mediaUri];

    if (uri && uri.scheme !== 'pdf-api') {
      try {
        // Correctly handle both local and remote URIs by getting the parent directory URI
        // while preserving the original scheme and authority.
        // For file:///path/to/doc.pdf -> file:///path/to
        // For vscode-remote://ssh/path/to/doc.pdf -> vscode-remote://ssh/path/to
        const pdfDir = uri.with({ path: uri.path.substring(0, uri.path.lastIndexOf('/')) });
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
      // Load HTML template (cached)
      if (!PDFEdit.htmlTemplateCache) {
        const htmlPath = vscode.Uri.joinPath(mediaUri, MEDIA_FILES.WEBVIEW_HTML);
        PDFEdit.htmlTemplateCache = new TextDecoder("utf-8").decode(
          await vscode.workspace.fs.readFile(htmlPath)
        );
        Logger.log('[Cache] HTML template loaded and cached');
      }
      const htmlContent = PDFEdit.htmlTemplateCache;

      // Resolve resources
      const webviewBundleUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, MEDIA_FILES.WEBVIEW_BUNDLE));
      const wasmUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, MEDIA_FILES.WASM));

      // Inject variables into HTML
      panel.webview.html = getWebviewHtml(panel.webview, htmlContent, webviewBundleUri, mediaUri, wasmUri);

      // Replace any previous message listener before re-initializing
      const existingEntry = activeEditors.get(uriString);
      if (existingEntry && existingEntry.messageDisposable) {
        existingEntry.messageDisposable.dispose();
      }

      // Message Handling
      const messageDisposable = panel.webview.onDidReceiveMessage(async (message) => {
        if (message.command === 'ready') {
          await this.handleWebviewReady(dataProvider, panel, previewOptions);
        } else if (message.command === 'log') {
          Logger.log(`[Webview] ${message.message}`);
        } else if (message.command === 'error') {
          if (!this.#rejectPendingSave(uriString, message.requestId, message.error)) {
            Logger.log(`[Webview Error] ${message.error}`);
          }
        } else if (message.command === 'viewer-state-changed') {
          const nextViewState = message.viewState || null;
          const incomingStateKey = message.documentKey || stateKey;
          this.viewStateManager.updateHot(incomingStateKey, nextViewState);
          const entry = activeEditors.get(uriString);
          if (entry) {
            entry.lastViewState = nextViewState;
          }
          if (message.flush) {
            await this.viewStateManager.flush(incomingStateKey);
          } else {
            this.viewStateManager.scheduleCheckpoint(incomingStateKey);
          }
        } else if (message.command === "open-link") {
          await this.#handleOpenLink(message, uri);
        } else if (message.command === 'dirty') {
          // Mark document as dirty
          Logger.log(`[Webview] Document marked dirty`);
          this._onDidChangeCustomDocument.fire({
            document: dataProvider,
            undo: () => { }, // We don't support undo/redo yet
            redo: () => { }
          });
        } else if (message.command === 'close') {
          vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        } else if (message.command === 'save-response') {
          await this.#resolvePendingSave(uriString, message.requestId, message.data);
        }
      });

      // Update entry with new disposable and current panel
      activeEditors.set(uriString, {
        panel,
        stateKey,
        messageDisposable,
        changeDisposable: existingEntry ? existingEntry.changeDisposable : null,
        disposeDisposable: existingEntry ? existingEntry.disposeDisposable : null,
        lastViewState: existingEntry ? existingEntry.lastViewState : this.viewStateManager.getPersisted(uriString),
        dataProvider,
        pendingSave: existingEntry ? existingEntry.pendingSave : null
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
   */
  async handleWebviewReady(dataProvider, panel, previewOptions = {}) {
    const isWeb = vscode.env.uiKind === vscode.UIKind.Web;
    Logger.log(`[Webview Ready] Environment: ${isWeb ? "Web" : "Desktop"} (UIKind: ${vscode.env.uiKind})`);
    await this.#postViewerMessage(dataProvider, panel, "preview", previewOptions);
  }

  async #postViewerMessage(dataProvider, panel, command, previewOptions = {}) {
    const uri = this.#getDataProviderUri(dataProvider);
    const uriString = uri ? uri.toString() : "unknown-uri";
    const documentKey = previewOptions.documentKey || activeEditors.get(uriString)?.stateKey || uriString;
    const extUri = this.context.extensionUri;
    const mediaUri = vscode.Uri.joinPath(extUri, "media");
    const wasmUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, MEDIA_FILES.WASM));
    const persistedViewState =
      this.viewStateManager.getPersisted(documentKey) ||
      activeEditors.get(uriString)?.lastViewState ||
      null;
    const msg = {
      command,
      documentKey,
      wasmUri: wasmUri.toString(true),
      config: {
        ...getPdfConfiguration(),
        ...(previewOptions.config || {}),
      },
      viewState: previewOptions.viewState
        ? {
          ...(persistedViewState || {}),
          ...previewOptions.viewState,
        }
        : persistedViewState,
    };

    Logger.log(`[View State] Sending ${command} payload to webview`);

    if (dataProvider.uri) {
      Logger.log(`Strategy: URI Mode (${command})`);
      msg.pdfUri = panel.webview.asWebviewUri(dataProvider.uri).toString(true);
      panel.webview.postMessage(msg);
      return;
    }

    Logger.log(`Strategy: Data Injection Mode (${command})`);

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

      // Note: We do not use transferables here because 'data' may come from shared caches.
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
