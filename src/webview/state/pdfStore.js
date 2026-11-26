import { base64ToArrayBuffer } from "../utils/binary.js";
import { vscodeService } from "../services/vscode.js";

function areViewStatesEqual(left, right) {
  return JSON.stringify(left || null) === JSON.stringify(right || null);
}

export function getThemePreference() {
  if (typeof document !== "undefined") {
    if (
      document.body.classList.contains("vscode-dark") ||
      document.body.classList.contains("vscode-high-contrast")
    ) {
      return "dark";
    }
  }
  return "light";
}

function readVsCodeThemeTokens() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {};
  }
  const style = getComputedStyle(document.documentElement);
  const pick = (varName) => {
    const val = style.getPropertyValue(varName)?.trim();
    return val || undefined;
  };
  const tokens = {
    accent: pick("--vscode-focusBorder") || pick("--vscode-button-background"),
    background: pick("--vscode-editor-background"),
    surface: pick("--vscode-editorWidget-background") || pick("--vscode-sideBar-background"),
    "surface-raised": pick("--vscode-dropdown-background") || pick("--vscode-editorWidget-background"),
    text: pick("--vscode-foreground"),
    "text-muted": pick("--vscode-descriptionForeground"),
    border: pick("--vscode-panel-border") || pick("--vscode-editorWidget-border"),
    hover: pick("--vscode-toolbar-hoverBackground") || pick("--vscode-list-hoverBackground"),
    canvas: pick("--vscode-editor-background"),
    font: pick("--vscode-font-family"),
  };
  return Object.fromEntries(Object.entries(tokens).filter(([, v]) => v !== undefined));
}

export function buildThemeConfig(preference = getThemePreference()) {
  const tokens = readVsCodeThemeTokens();
  return Object.keys(tokens).length > 0 ? { preference, tokens } : preference;
}

export function buildFeaturesConfig(config) {
  const enableForms = config?.enableForms !== false;
  const showTabs = config?.tabBar && config.tabBar !== "never";
  return {
    annotations: true,
    "forms.filling": enableForms,
    "forms.building": false,
    measurement: false,
    redaction: false,
    snapshots: false,
    "documents.open": false,
    "documents.download": false,
    "documents.print": false,
    "documents.tabs": !!showTabs,
  };
}

export function buildStagePluginConfig(config) {
  const stage = {};
  if (config?.spreadMode) {
    stage.spread = config.spreadMode;
  }
  if (typeof config?.rotation === "number" && config.rotation !== 0) {
    stage.viewRotation = config.rotation;
  }
  return stage;
}

export function createPdfStore() {
  return {
    pdfSrc: null,
    wasmBinary: null,
    wasmSourceUri: null,
    workerBlobUrl: null,
    workerSourceUri: null,
    useWorker: false,
    messageConfig: null,
    activeBlobUrl: null,
    currentDocumentUri: null,
    currentDocumentKey: null,
    persistedViewState: null,
    viewer: null,
    viewerElement: null,
    isVisible: true,

    syncViewState(viewState, options = {}) {
      const { notifyExtension = true, flush = false, persistLocally = true } = options;
      const nextViewState = viewState || null;
      const viewStateChanged = !areViewStatesEqual(this.persistedViewState, nextViewState);

      if (viewStateChanged) {
        this.persistedViewState = nextViewState;
      }

      if (persistLocally) {
        const currentState = vscodeService.getState() || {};
        const shouldPersistLocally =
          viewStateChanged ||
          currentState.documentKey !== this.currentDocumentKey ||
          !areViewStatesEqual(currentState.viewState, nextViewState) ||
          currentState.config !== this.messageConfig;

        if (shouldPersistLocally) {
          vscodeService.setState({
            ...currentState,
            documentKey: this.currentDocumentKey,
            viewState: nextViewState,
            config: this.messageConfig,
          });
        }
      }

      if (notifyExtension && (viewStateChanged || flush)) {
        vscodeService.postMessage({
          command: "viewer-state-changed",
          documentKey: this.currentDocumentKey,
          viewState: nextViewState,
          flush,
        });
      }
    },

    releaseWorkerBlobUrl() {
      if (this.workerBlobUrl) {
        URL.revokeObjectURL(this.workerBlobUrl);
        this.workerBlobUrl = null;
        this.workerSourceUri = null;
      }
    },

    releasePdfBlobUrl() {
      if (this.activeBlobUrl) {
        URL.revokeObjectURL(this.activeBlobUrl);
        this.activeBlobUrl = null;
      }
    },

    async resolveEngineAssets(message) {
      const wasmUri = message.wasmUri || window.wasmUri;
      const workerUri = message.workerUri || window.workerUri;
      const wantsWorker = message.config?.worker !== false;

      if (wasmUri && (!this.wasmBinary || this.wasmSourceUri !== wasmUri)) {
        const response = await fetch(wasmUri);
        if (!response.ok) {
          throw new Error(`WASM fetch failed with HTTP ${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        const magic = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
        if (magic[0] !== 0x00 || magic[1] !== 0x61 || magic[2] !== 0x73 || magic[3] !== 0x6d) {
          throw new Error("WASM response did not contain a valid WebAssembly header");
        }
        this.wasmBinary = buffer;
        this.wasmSourceUri = wasmUri;
      }

      if (!wantsWorker || !workerUri) {
        this.releaseWorkerBlobUrl();
        this.useWorker = false;
        return;
      }

      if (this.workerBlobUrl && this.workerSourceUri === workerUri) {
        this.useWorker = true;
        return;
      }

      try {
        const workerResp = await fetch(workerUri);
        if (!workerResp.ok) {
          throw new Error(`Worker fetch failed with HTTP ${workerResp.status}`);
        }
        const workerCode = await workerResp.text();
        this.releaseWorkerBlobUrl();
        this.workerBlobUrl = URL.createObjectURL(
          new Blob([workerCode], { type: "application/javascript" })
        );
        this.workerSourceUri = workerUri;
        this.useWorker = true;
      } catch (error) {
        console.warn("[Webview] Worker blob bypass failed; using main-thread engine:", error);
        this.releaseWorkerBlobUrl();
        this.useWorker = false;
      }
    },

    resolvePdfSource(message) {
      if (message.pdfUri) {
        this.releasePdfBlobUrl();
        return message.pdfUri;
      }
      if (message.data) {
        let buffer;
        if (message.data instanceof Uint8Array) {
          buffer = message.data;
        } else if (message.data instanceof ArrayBuffer) {
          buffer = new Uint8Array(message.data);
        } else if (Array.isArray(message.data)) {
          buffer = new Uint8Array(message.data);
        } else {
          buffer = new Uint8Array(base64ToArrayBuffer(message.data));
        }
        this.releasePdfBlobUrl();
        const blobUrl = URL.createObjectURL(new Blob([buffer], { type: "application/pdf" }));
        this.activeBlobUrl = blobUrl;
        return blobUrl;
      }
      return null;
    },

    async handleSave(message) {
      try {
        if (!this.viewer?.documents) {
          throw new Error("PDF viewer is not ready to save yet.");
        }
        const activeId = this.viewer.documents.getActiveId();
        if (!activeId) {
          throw new Error("No active PDF document to save.");
        }
        const bytes = await this.viewer.documents.download(activeId);
        vscodeService.postMessage({
          command: "save-response",
          data: bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
          requestId: message.requestId,
        });
      } catch (e) {
        vscodeService.postMessage({
          command: "error",
          error: e?.message || String(e),
          requestId: message.requestId,
        });
      }
    },

    handleUndo() {
      try {
        const history = this.viewer?.tryGet("history");
        if (history?.canUndo()) {
          history.undo();
        }
      } catch (e) {
        console.warn("[Webview] Undo failed:", e);
      }
    },

    handleRedo() {
      try {
        const history = this.viewer?.tryGet("history");
        if (history?.canRedo()) {
          history.redo();
        }
      } catch (e) {
        console.warn("[Webview] Redo failed:", e);
      }
    },
  };
}
