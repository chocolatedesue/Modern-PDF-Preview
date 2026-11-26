/* global __webpack_public_path__:writable */
if (typeof window !== "undefined" && window.mediaUri) {
  __webpack_public_path__ = window.mediaUri + "/";
}

import "@embedpdf/viewer";
import { createLocalEngine } from "@embedpdf/engine";
import { vscodeService } from "./services/vscode.js";
import {
  createPdfStore,
  buildThemeConfig,
  buildFeaturesConfig,
  buildStagePluginConfig,
  getThemePreference,
} from "./state/pdfStore.js";
import { createViewerRuntime } from "./viewer/runtime.js";

const store = createPdfStore();
const abortController = new AbortController();

function getDomElements() {
  return {
    loadingEl: document.getElementById("loading"),
    errorEl: document.getElementById("error"),
    errorTextEl: document.getElementById("error-text"),
    viewerHost: document.getElementById("viewer-host"),
  };
}

function showLoading() {
  const { loadingEl, errorEl } = getDomElements();
  if (errorEl) errorEl.hidden = true;
  if (loadingEl) loadingEl.hidden = false;
}

function hideLoading() {
  const { loadingEl } = getDomElements();
  if (loadingEl) loadingEl.hidden = true;
}

function showError(message) {
  const { loadingEl, errorEl, errorTextEl } = getDomElements();
  if (loadingEl) loadingEl.hidden = true;
  if (errorTextEl) {
    // Safe DOM textContent assignment — zero innerHTML injection surface
    errorTextEl.textContent = String(message || "An unexpected error occurred.");
  }
  if (errorEl) errorEl.hidden = false;
}

function unmountViewer() {
  runtime.destroy();
  if (store.viewerElement) {
    store.viewerElement.remove();
    store.viewerElement = null;
  }
}

function buildEngineOption() {
  const wasmBinary = store.wasmBinary || undefined;
  if (store.useWorker && store.workerBlobUrl) {
    return {
      wasmBinary,
      worker: store.workerBlobUrl,
      encoderWorker: false,
    };
  }
  return () =>
    createLocalEngine({
      runtime: wasmBinary ? { wasmBinary: wasmBinary.slice(0) } : undefined,
    });
}

function mountViewer() {
  const { viewerHost } = getDomElements();
  if (!viewerHost || !store.pdfSrc) {
    return;
  }

  unmountViewer();

  const el = document.createElement("embedpdf-viewer");
  el.style.width = "100%";
  el.style.height = "100%";
  el.config = {
    src: store.pdfSrc,
    theme: buildThemeConfig(getThemePreference()),
    features: buildFeaturesConfig(store.messageConfig),
    warnBeforeLeaving: false,
    engine: buildEngineOption(),
    plugins: {
      stage: buildStagePluginConfig(store.messageConfig),
    },
    onReady: (viewer) => {
      hideLoading();
      runtime.handleReady(viewer);
    },
  };

  store.viewerElement = el;
  viewerHost.appendChild(el);
}

const runtime = createViewerRuntime({
  store,
  vscodeService,
  onWorkerFallback: () => {
    store.releaseWorkerBlobUrl();
    store.useWorker = false;
    mountViewer();
  },
  onError: (msg) => {
    showError(msg);
  },
});

async function handlePreviewMessage(message, { forceReload = false } = {}) {
  const newDocUri = message.pdfUri || "base64-data";
  const newDocKey = message.documentKey || newDocUri;
  const docChanged = store.currentDocumentKey !== newDocKey;
  const srcChanged = store.currentDocumentUri !== newDocUri;

  showLoading();
  store.currentDocumentKey = newDocKey;
  store.currentDocumentUri = newDocUri;

  try {
    await store.resolveEngineAssets(message);
  } catch (err) {
    showError(`Failed to load PDF engine assets: ${err?.message || String(err)}`);
    return;
  }

  store.messageConfig = {
    ...(message.config || {}),
    worker: store.useWorker,
  };

  const restoredViewState = message.viewState ?? vscodeService.getState()?.viewState ?? null;
  store.syncViewState(restoredViewState, { notifyExtension: false });

  const src = store.resolvePdfSource(message);
  if (!src) {
    showError("Failed to resolve PDF source.");
    return;
  }

  const shouldRemount = forceReload || docChanged || srcChanged || !!message.data || !store.viewerElement;
  store.pdfSrc = src;

  if (shouldRemount) {
    mountViewer();
  } else {
    hideLoading();
    store.viewerElement.src = src;
    store.viewerElement.features = buildFeaturesConfig(store.messageConfig);
  }
}

async function handleMessage(event) {
  const message = event.data;
  if (!message || !message.command) return;

  switch (message.command) {
    case "preview":
      await handlePreviewMessage(message);
      break;
    case "reload":
      await handlePreviewMessage(message, { forceReload: true });
      break;
    case "save":
      await store.handleSave(message);
      break;
    case "undo":
      store.handleUndo();
      break;
    case "redo":
      store.handleRedo();
      break;
    case "visibility-changed":
      store.isVisible = !!message.visible;
      if (!store.isVisible) {
        runtime.flushViewState();
      }
      break;
    case "error":
      showError(message.error);
      break;
  }
}

function handleKeyDown(e) {
  const isMac = navigator.platform.toUpperCase().includes("MAC");
  const mod = isMac ? e.metaKey : e.ctrlKey;

  if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "w") {
    e.preventDefault();
    e.stopPropagation();
    vscodeService.postMessage({ command: "close" });
  }
}

function init() {
  const { signal } = abortController;

  window.addEventListener("keydown", handleKeyDown, { capture: true, signal });
  window.addEventListener("message", handleMessage, { signal });

  // Intercept window.open so external PDF links route through VS Code's allowlisted openExternal
  const originalWindowOpen = window.open;
  window.open = function (url) {
    if (url) {
      vscodeService.postMessage({
        command: "open-link",
        result: { outcome: "uri", uri: String(url) },
      });
    }
    return null;
  };

  const themeObserver = new MutationObserver(() => {
    if (store.viewerElement) {
      store.viewerElement.theme = buildThemeConfig(getThemePreference());
    }
  });
  themeObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
  });

  window.addEventListener(
    "unload",
    () => {
      abortController.abort();
      themeObserver.disconnect();
      window.open = originalWindowOpen;
      unmountViewer();
      store.releasePdfBlobUrl();
      store.releaseWorkerBlobUrl();
    },
    { once: true }
  );

  vscodeService.postMessage({ command: "ready" });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
