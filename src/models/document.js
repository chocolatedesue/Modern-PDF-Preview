import Logger from "../services/logger";
const vscode = require("vscode");

/**
 * @implements {import("../api/index").PdfFileDataProvider}
 */
export class PDFDoc {
  /**
   * @param {vscode.Uri} uri
   * @param {{ backupUri?: vscode.Uri | null, initialData?: Uint8Array | null }} [options]
   */
  constructor(uri, options = {}) {
    this._uri = uri;
    this._backupUri = options.backupUri || null;
    this._initialData = options.initialData || null;
    this._inFlightRead = null;
    this._disposables = [];
    this._ignoreChangesUntil = 0;
    this._onDidDelete = new vscode.EventEmitter();
    this._onDidChange = new vscode.EventEmitter();

    this.onDidDelete = this._onDidDelete.event;
    this.onDidChange = this._onDidChange.event;

    this.#registerWatcher();
  }

  dispose() {
    this._inFlightRead = null;
    this._onDidDelete.fire(this.uri);
    this._disposeAll();
  }

  #disposeAll() {
    for (const disposable of this._disposables) {
      try {
        disposable.dispose();
      } catch (e) {
        Logger.log(`[Watcher] Failed to dispose watcher: ${e}`);
      }
    }
    this._disposables = [];
  }

  #registerWatcher() {
    try {
      const lastSlash = this.uri.path.lastIndexOf("/");
      const baseUri = this.uri.with({
        path: lastSlash > 0 ? this.uri.path.slice(0, lastSlash) : "/",
      });
      const fileName = this.uri.path.slice(lastSlash + 1);

      if (!fileName) {
        return;
      }

      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(baseUri, fileName)
      );

      const onChange = (changedUri) => {
        if (changedUri.toString() === this.uri.toString()) {
          if (Date.now() < this._ignoreChangesUntil) {
            Logger.log(`[Watcher] Ignoring self-triggered change for ${this.uri.toString()}`);
            return;
          }
          Logger.log(`[Watcher] External change detected for ${this.uri.toString()}`);
          this._onDidChange.fire(changedUri);
        }
      };

      this._disposables.push(
        watcher,
        watcher.onDidChange(onChange),
        watcher.onDidCreate(onChange),
        watcher.onDidDelete((deletedUri) => {
          if (deletedUri.toString() === this.uri.toString()) {
            this._onDidDelete.fire(deletedUri);
          }
        }),
        this._onDidDelete,
        this._onDidChange
      );
    } catch (e) {
      Logger.log(`[Watcher] Failed to create watcher for ${this.uri.toString()}: ${e}`);
    }
  }

  get uri() {
    return this._uri;
  }

  markPendingWrite(durationMs = 1500) {
    this._ignoreChangesUntil = Date.now() + durationMs;
  }

  clearTransientSource() {
    this._backupUri = null;
    this._initialData = null;
  }

  /**
   * Reads the file data with concurrency protection.
   * @returns {Promise<Uint8Array>}
   */
  async getFileData() {
    // If already reading, return the existing promise
    if (this._inFlightRead) {
      return this._inFlightRead;
    }

    this._inFlightRead = (async () => {
      try {
        if (this._initialData) {
          return this._initialData;
        }

        const sourceUri = this._backupUri || this.uri;

        // Check file size limit for Web environment (100MB)
        if (vscode.env.uiKind === vscode.UIKind.Web) {
          try {
            const stat = await vscode.workspace.fs.stat(sourceUri);
            const MAX_SIZE_MB = 100;
            if (stat.size > MAX_SIZE_MB * 1024 * 1024) {
              throw new Error(`File is too large (${(stat.size / 1024 / 1024).toFixed(1)}MB) for the Web version (Max ${MAX_SIZE_MB}MB). Please use VS Code Desktop.`);
            }
          } catch (e) {
            // Ignore stat errors, fallback to try reading
            if (e.message && e.message.includes('File is too large')) {
              throw e;
            }
          }
        }

        const startTime = Date.now();
        const fileData = await vscode.workspace.fs.readFile(sourceUri);

        const duration = Date.now() - startTime;
        Logger.logPerformance('PDF data loaded', duration, {
          size: fileData.byteLength
        });
        return fileData;
      } finally {
        this._inFlightRead = null;
      }
    })();

    return this._inFlightRead;
  }
}
