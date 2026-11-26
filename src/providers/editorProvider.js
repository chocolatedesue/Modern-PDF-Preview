import Logger from "../services/logger";
import {
  VIEW_TYPE,
  WEBVIEW_OPTIONS,
  MEDIA_FILES,
  REPOSITORY_ISSUES_URL,
} from "../constants/index.js";
import { getPdfConfiguration } from "../managers/configManager";
import { activeEditors } from "../managers/editorManager";
import { ViewStateManager } from "../managers/viewStateManager";
import { statusBarManager } from "../managers/statusBarManager";
import { PDFDoc } from "../models/document";
import { getWebviewHtml, getErrorHtml } from "./webviewHtmlBuilder";

const vscode = require("vscode");

const panelInstanceKeys = new WeakMap();
let nextApiPanelId = 1;

/**
 * @implements {vscode.CustomEditorProvider}
 */
function encodeBinaryToBase64(data) {
  if (typeof data === "string") {
    return data;
  }
  const bytes =
    data instanceof Uint8Array
      ? data
      : ArrayBuffer.isView(data)
        ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
        : data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : new Uint8Array(data);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");
  }
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export default class PDFEdit {
  /**
   * Registers the custom editor provider.
   * @param {vscode.ExtensionContext} context
   * @returns {vscode.Disposable}
   */
  static register(context) {
    PDFEdit.globalContext = context;
    statusBarManager.init(context);
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
    let activeEntry = null;
    let activeKey = null;

    for (const [key, entry] of activeEditors.entries()) {
      if (entry.panel?.active) {
        activeKey = key;
        activeEntry = entry;
        break;
      }
    }

    if (!activeEntry || !activeKey) {
      Logger.log("[Force Save] No active PDF editor found");
      return;
    }

    const targetUri = activeEntry.dataProvider?.uri || null;
    if (!targetUri) {
      vscode.window.showWarningMessage("Cannot save an in-memory API PDF preview directly to disk.");
      return;
    }

    Logger.log(`[Force Save] Triggering save for ${targetUri.toString()}`);
    const tokenSource = new vscode.CancellationTokenSource();
    const provider = new PDFEdit(context);

    try {
      await provider.#performSave(activeKey, targetUri, activeEntry.panel, tokenSource.token);
      vscode.window.showInformationMessage("PDF Saved Successfully");
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to save PDF: ${e.message}`);
    } finally {
      tokenSource.dispose();
    }
  }

  static viewType = VIEW_TYPE;
  static globalContext = null;
  static htmlTemplateCache = null;

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
      Logger.log("[Error] Extension context not initialized. Call register() first.");
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

  /**
   * Computes a collision-free identity key for activeEditors.
   * File-backed documents use their canonical URI; API previews get a unique per-panel ID
   * so multiple previews with the default name never overwrite each other.
   */
  #getEditorKey(dataProvider, panel, previewOptions = {}) {
    if (dataProvider?.uri) {
      return dataProvider.uri.toString();
    }

    if (panel && panelInstanceKeys.has(panel)) {
      return panelInstanceKeys.get(panel);
    }

    const instanceId = nextApiPanelId++;
    const label = encodeURIComponent(previewOptions.documentKey || dataProvider?.name || "api-preview");
    const uniqueKey = `pdf-api://instance-${instanceId}/${label}`;
    if (panel) {
      panelInstanceKeys.set(panel, uniqueKey);
    }
    return uniqueKey;
  }

  /**
   * Save the custom document.
   * @param {vscode.CustomDocument} document
   * @param {vscode.CancellationToken} cancellation
   * @returns {Promise<void>}
   */
  async saveCustomDocument(document, cancellation) {
    const editorKey = document.uri.toString();
    const editorEntry = activeEditors.get(editorKey);

    if (!editorEntry || !editorEntry.panel) {
      Logger.log(`[Error] No active panel found for ${editorKey}`);
      return;
    }

    return this.#performSave(editorKey, document.uri, editorEntry.panel, cancellation);
  }

  /**
   * Save the custom document to a different location.
   * @param {vscode.CustomDocument} document
   * @param {vscode.Uri} destination
   * @param {vscode.CancellationToken} cancellation
   * @returns {Promise<void>}
   */
  async saveCustomDocumentAs(document, destination, cancellation) {
    const editorKey = document.uri.toString();
    const editorEntry = activeEditors.get(editorKey);

    if (!editorEntry || !editorEntry.panel) {
      throw new Error("No active PDF editor found for Save As");
    }

    await this.#ensureParentDirectory(destination);
    await this.#performSave(editorKey, document.uri, editorEntry.panel, cancellation, destination);
  }

  async #performSave(editorKey, uri, panel, cancellation, destinationUri = uri) {
    const editorEntry = activeEditors.get(editorKey);

    if (!editorEntry) {
      throw new Error(`No active editor entry for ${editorKey}`);
    }

    if (editorEntry.pendingSave) {
      throw new Error("A save is already in progress for this document");
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    Logger.log(`[Save] Initiating save request ${requestId}`);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const entry = activeEditors.get(editorKey);
        if (entry?.pendingSave?.requestId === requestId) {
          Logger.log("[Save] Timeout waiting for webview response");
          this.#cleanupPendingSave(entry);
          reject(new Error("Save timed out"));
        }
      }, 30000);

      const cancellationDisposable = cancellation.onCancellationRequested(() => {
        const entry = activeEditors.get(editorKey);
        if (entry?.pendingSave?.requestId === requestId) {
          Logger.log("[Save] Save request cancelled");
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

  async #resolvePendingSave(editorKey, requestId, rawData) {
    const editorEntry = activeEditors.get(editorKey);
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
      Logger.log("[Save] File saved successfully");
      pendingSave.resolve();
    } catch (error) {
      Logger.log(`[Save] Error writing file: ${error}`);
      pendingSave.reject(error instanceof Error ? error : new Error(String(error)));
    }

    return true;
  }

  #rejectPendingSave(editorKey, requestId, errorMessage) {
    const editorEntry = activeEditors.get(editorKey);
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
        Logger.log("[Open Link] Blocked absolute or scheme-based file link");
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

  async revertCustomDocument(document, _cancellation) {
    const editorKey = document.uri.toString();
    const editorEntry = activeEditors.get(editorKey);
    const stateKey = editorEntry?.stateKey || editorKey;

    Logger.log(`[Revert] Reverting document: ${editorKey}`);

    if (document instanceof PDFDoc) {
      document.clearTransientSource();
    }

    if (editorEntry?.panel) {
      await this.viewStateManager.flush(stateKey);
      await this.#postViewerMessage(document, editorEntry.panel, "reload", {}, editorKey);
    }
  }

  async backupCustomDocument(document, _context, _cancellation) {
    await this.#ensureParentDirectory(_context.destination);

    const editorKey = document.uri.toString();
    const editorEntry = activeEditors.get(editorKey);

    if (editorEntry?.panel) {
      await this.#performSave(editorKey, document.uri, editorEntry.panel, _cancellation, _context.destination);
    } else if (typeof document.getFileData === "function") {
      await this.#writeFileData(_context.destination, await document.getFileData());
    } else {
      throw new Error("Unable to back up PDF without an active editor");
    }

    return {
      id: _context.destination.toString(),
      delete: () => {
        void vscode.workspace.fs.delete(_context.destination).catch(() => {});
      },
    };
  }

  #attachLifecycleHandlers(editorKey, dataProvider, panel) {
    const entry = activeEditors.get(editorKey);
    if (!entry) {
      return;
    }

    if (typeof dataProvider?.onDidChange === "function" && !entry.changeDisposable) {
      entry.changeDisposable = dataProvider.onDidChange(async () => {
        Logger.log(`[Reload] Posting reload for ${editorKey}`);
        const current = activeEditors.get(editorKey);
        const stateKey = current?.stateKey || editorKey;
        if (current?.panel) {
          await this.viewStateManager.flush(stateKey);
          await this.#postViewerMessage(dataProvider, current.panel, "reload", {}, editorKey);
        }
      });
    }

    if (!entry.viewStateDisposable && typeof panel.onDidChangeViewState === "function") {
      entry.viewStateDisposable = panel.onDidChangeViewState((event) => {
        const current = activeEditors.get(editorKey);
        const visible = !!event.webviewPanel.visible;
        try {
          event.webviewPanel.webview.postMessage({
            command: "visibility-changed",
            visible,
          });
        } catch {
          // Ignore if panel is disposing
        }
        if (!visible && current?.stateKey) {
          void this.viewStateManager.flush(current.stateKey);
        }
        statusBarManager.refresh();
      });
    }

    if (!entry.disposeDisposable && typeof panel.onDidDispose === "function") {
      entry.disposeDisposable = panel.onDidDispose(() => {
        const current = activeEditors.get(editorKey);
        if (current?.pendingSave) {
          const pendingSave = current.pendingSave;
          this.#cleanupPendingSave(current);
          pendingSave.reject(new Error("Editor was closed before the save completed"));
        }
        current?.messageDisposable?.dispose();
        current?.changeDisposable?.dispose();
        current?.viewStateDisposable?.dispose();
        activeEditors.delete(editorKey);
        statusBarManager.refresh();

        const stateKey = current?.stateKey || editorKey;
        void this.viewStateManager.flush(stateKey).finally(() => {
          this.viewStateManager.disposeUri(stateKey);
        });
        Logger.log(`Webview panel disposed for ${editorKey}`);
      });
    }
  }

  async resolveCustomEditor(document, panel, _token) {
    const editorKey = this.#getEditorKey(document, panel);
    Logger.log(`Resolving Custom Editor for: ${editorKey}`);

    const existingEntry = activeEditors.get(editorKey);

    activeEditors.set(editorKey, {
      panel,
      stateKey: existingEntry?.stateKey || editorKey,
      messageDisposable: existingEntry?.messageDisposable || null,
      changeDisposable: existingEntry?.changeDisposable || null,
      viewStateDisposable: existingEntry?.viewStateDisposable || null,
      disposeDisposable: existingEntry?.disposeDisposable || null,
      lastViewState: existingEntry?.lastViewState || this.viewStateManager.getPersisted(editorKey),
      lastStatus: existingEntry?.lastStatus || null,
      dataProvider: document,
      pendingSave: existingEntry?.pendingSave || null,
    });

    this.#attachLifecycleHandlers(editorKey, document, panel);

    if (panel.webview.html && panel.webview.html.length > 0) {
      Logger.log("Webview already initialized, skipping setup");
      statusBarManager.refresh();
      return;
    }

    await this.setupWebview(document, panel);
  }

  async openCustomDocument(uri, _context, _token) {
    Logger.log(`Opening Custom Document: ${uri.toString()}`);
    const backupUri = _context?.backupId ? vscode.Uri.parse(_context.backupId) : null;
    const initialData = _context?.untitledDocumentData || null;
    return new PDFDoc(uri, { backupUri, initialData });
  }

  async setupWebview(dataProvider, panel, previewOptions = {}) {
    const startTime = Date.now();
    const extUri = this.context.extensionUri;
    const mediaUri = vscode.Uri.joinPath(extUri, "media");

    const editorKey = this.#getEditorKey(dataProvider, panel, previewOptions);
    const documentUri = dataProvider?.uri || null;
    const stateKey = previewOptions.documentKey || activeEditors.get(editorKey)?.stateKey || editorKey;

    const localResourceRoots = [mediaUri];

    const candidateUris = [documentUri, dataProvider instanceof PDFDoc ? dataProvider.sourceUri : null].filter(
      (u, idx, arr) => u && u.scheme !== "pdf-api" && arr.findIndex((x) => x?.toString() === u.toString()) === idx
    );
    for (const u of candidateUris) {
      try {
        const pdfDir = u.with({
          path: u.path.substring(0, u.path.lastIndexOf("/")),
        });
        localResourceRoots.push(pdfDir);
      } catch (e) {
        Logger.log(`[Warning] Could not resolve PDF directory for localResourceRoots: ${e}`);
      }
    }

    panel.webview.options = {
      ...WEBVIEW_OPTIONS,
      localResourceRoots,
    };
    Logger.log(`[Performance] Webview setup started for ${editorKey}`);

    try {
      if (!PDFEdit.htmlTemplateCache) {
        const htmlPath = vscode.Uri.joinPath(mediaUri, MEDIA_FILES.WEBVIEW_HTML);
        PDFEdit.htmlTemplateCache = new TextDecoder("utf-8").decode(
          await vscode.workspace.fs.readFile(htmlPath)
        );
        Logger.log("[Cache] HTML template loaded and cached");
      }
      const htmlContent = PDFEdit.htmlTemplateCache;

      const webviewBundleUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, MEDIA_FILES.WEBVIEW_BUNDLE));
      const wasmUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, MEDIA_FILES.WASM));
      const workerUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, MEDIA_FILES.WORKER));

      panel.webview.html = getWebviewHtml(
        panel.webview,
        htmlContent,
        webviewBundleUri,
        mediaUri,
        wasmUri,
        workerUri
      );

      const existingEntry = activeEditors.get(editorKey);
      if (existingEntry?.messageDisposable) {
        existingEntry.messageDisposable.dispose();
      }

      const messageDisposable = panel.webview.onDidReceiveMessage(async (message) => {
        if (message.command === "ready") {
          await this.handleWebviewReady(dataProvider, panel, previewOptions, editorKey);
        } else if (message.command === "log") {
          Logger.log(`[Webview] ${message.message}`);
        } else if (message.command === "error") {
          if (!this.#rejectPendingSave(editorKey, message.requestId, message.error)) {
            Logger.log(`[Webview Error] ${message.error}`);
          }
        } else if (message.command === "viewer-state-changed") {
          const nextViewState = message.viewState || null;
          const incomingStateKey = message.documentKey || stateKey;
          this.viewStateManager.updateHot(incomingStateKey, nextViewState);
          const entry = activeEditors.get(editorKey);
          if (entry) {
            entry.lastViewState = nextViewState;
          }
          if (message.flush) {
            await this.viewStateManager.flush(incomingStateKey);
          } else {
            this.viewStateManager.scheduleCheckpoint(incomingStateKey);
          }
        } else if (message.command === "viewer-status-changed") {
          const entry = activeEditors.get(editorKey);
          if (entry) {
            entry.lastStatus = message.status || null;
            statusBarManager.refresh();
          }
        } else if (message.command === "open-link") {
          await this.#handleOpenLink(message, documentUri);
        } else if (message.command === "dirty") {
          if (dataProvider instanceof PDFDoc) {
            Logger.log(`[Webview] Document marked dirty: ${editorKey}`);
            this._onDidChangeCustomDocument.fire({
              document: dataProvider,
              undo: () => {
                panel.webview.postMessage({ command: "undo" });
              },
              redo: () => {
                panel.webview.postMessage({ command: "redo" });
              },
            });
          }
        } else if (message.command === "close") {
          vscode.commands.executeCommand("workbench.action.closeActiveEditor");
        } else if (message.command === "save-response") {
          await this.#resolvePendingSave(editorKey, message.requestId, message.data);
        }
      });

      activeEditors.set(editorKey, {
        panel,
        stateKey,
        messageDisposable,
        changeDisposable: existingEntry?.changeDisposable || null,
        viewStateDisposable: existingEntry?.viewStateDisposable || null,
        disposeDisposable: existingEntry?.disposeDisposable || null,
        lastViewState: existingEntry?.lastViewState || this.viewStateManager.getPersisted(stateKey),
        lastStatus: existingEntry?.lastStatus || null,
        dataProvider,
        pendingSave: existingEntry?.pendingSave || null,
      });

      this.#attachLifecycleHandlers(editorKey, dataProvider, panel);
      statusBarManager.refresh();

      const duration = Date.now() - startTime;
      Logger.logPerformance("Webview setup completed", duration);
    } catch (e) {
      const duration = Date.now() - startTime;
      Logger.log(`[Performance] Webview setup failed after ${duration}ms: ${e.stack || e}`);

      let errorType = "Unknown Error";
      let suggestion = "Please try reopening the file.";
      let canRetry = true;

      if (e.message && e.message.includes("WASM")) {
        errorType = "WASM Loading Failed";
        suggestion = "The WebAssembly module failed to load. Try reinstalling the extension.";
        canRetry = false;
      } else if (e.code === "ENOENT" || (e.message && e.message.includes("ENOENT"))) {
        errorType = "File Not Found";
        suggestion = "The PDF file may have been moved or deleted.";
        canRetry = false;
      } else if (e.code === "EACCES" || (e.message && e.message.includes("EACCES"))) {
        errorType = "Permission Denied";
        suggestion = "Check file permissions and try again.";
      } else if (e.message && e.message.includes("fetch")) {
        errorType = "Network Error";
        suggestion = "Failed to load required resources. Check your connection.";
      }

      panel.webview.html = getErrorHtml(errorType, e.message, suggestion, canRetry, duration);

      vscode.window
        .showErrorMessage(`PDF Viewer: ${errorType}`, "View Logs", "Report Issue")
        .then((selection) => {
          if (selection === "View Logs") {
            Logger.show();
          } else if (selection === "Report Issue") {
            vscode.env.openExternal(vscode.Uri.parse(REPOSITORY_ISSUES_URL));
          }
        });
    }
  }

  async handleWebviewReady(dataProvider, panel, previewOptions = {}, editorKey = null) {
    const isWeb = vscode.env.uiKind === vscode.UIKind.Web;
    Logger.log(`[Webview Ready] Environment: ${isWeb ? "Web" : "Desktop"} (UIKind: ${vscode.env.uiKind})`);
    await this.#postViewerMessage(dataProvider, panel, "preview", previewOptions, editorKey);
  }

  async #postViewerMessage(dataProvider, panel, command, previewOptions = {}, explicitKey = null) {
    const editorKey = explicitKey || this.#getEditorKey(dataProvider, panel, previewOptions);
    const documentKey = previewOptions.documentKey || activeEditors.get(editorKey)?.stateKey || editorKey;
    const extUri = this.context.extensionUri;
    const mediaUri = vscode.Uri.joinPath(extUri, "media");
    const wasmUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, MEDIA_FILES.WASM));
    const workerUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, MEDIA_FILES.WORKER));
    const persistedViewState =
      this.viewStateManager.getPersisted(documentKey) ||
      activeEditors.get(editorKey)?.lastViewState ||
      null;

    const msg = {
      command,
      documentKey,
      wasmUri: wasmUri.toString(true),
      workerUri: workerUri.toString(true),
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

    const isPureWebHost = typeof process === "undefined" || !process.versions?.node;
    const sourceUri = dataProvider instanceof PDFDoc ? dataProvider.sourceUri : dataProvider?.uri;
    const hasInMemoryData = dataProvider instanceof PDFDoc && dataProvider.hasInMemoryData();
    const isDirectUriScheme = sourceUri?.scheme === "file" || sourceUri?.scheme === "vscode-remote";
    const canUseDirectWebviewUri =
      Boolean(sourceUri) &&
      !isPureWebHost &&
      isDirectUriScheme &&
      !hasInMemoryData;

    if (canUseDirectWebviewUri) {
      Logger.log(`Strategy: URI Mode (${command})`);
      msg.pdfUri = panel.webview.asWebviewUri(sourceUri).toString(true);
      panel.webview.postMessage(msg);
      return;
    }

    Logger.log(`Strategy: Data Injection Mode (${command})`);

    try {
      let data;
      if (dataProvider instanceof PDFDoc) {
        data = await dataProvider.getFileData();
      } else if (typeof dataProvider.getRawData === "function") {
        data = dataProvider.getRawData();
      } else {
        data = await dataProvider.getFileData();
      }

      msg.data = encodeBinaryToBase64(data);
      panel.webview.postMessage(msg);
    } catch (err) {
      Logger.log(`Error loading file data: ${err}`);
      panel.webview.postMessage({
        command: "error",
        error: err.message || String(err),
      });
    }
  }
}
