import {
  buildSerializableViewState,
  extractLegacyPageNumber,
  extractStageViewState,
} from "./viewState.js";

const SYNC_DEBOUNCE_MS = 200;
const CHECKPOINT_DEBOUNCE_MS = 1500;

export function createViewerRuntime({ store, vscodeService, onWorkerFallback, onError }) {
  let viewerDisposables = [];
  let docDisposables = [];
  let syncTimeout;
  let checkpointTimeout;
  let statusTimeout;
  let isRestoring = false;
  let activeStage = null;
  let lastReportedDirty = false;

  function clearTimers() {
    clearTimeout(syncTimeout);
    clearTimeout(checkpointTimeout);
    clearTimeout(statusTimeout);
  }

  function disposeList(list) {
    for (const fn of list) {
      try {
        if (typeof fn === "function") {
          fn();
        }
      } catch (error) {
        console.warn("[Webview] Failed to dispose listener:", error);
      }
    }
    list.length = 0;
  }

  function clearAllDisposables() {
    clearTimers();
    disposeList(docDisposables);
    disposeList(viewerDisposables);
    activeStage = null;
    isRestoring = false;
    lastReportedDirty = false;
  }

  function reportStatus() {
    if (!activeStage) {
      return;
    }
    try {
      const pageCount = activeStage.getPageCount?.() ?? 0;
      const pageIndex = activeStage.getCurrentPageIndex?.() ?? 0;
      const zoomLevel = activeStage.getZoomLevel?.() ?? 1;
      const zoomMode = activeStage.getZoomMode?.() ?? "custom";
      vscodeService.postMessage({
        command: "viewer-status-changed",
        documentKey: store.currentDocumentKey,
        status: {
          pageNumber: pageCount > 0 ? pageIndex + 1 : 0,
          pageCount,
          zoomLevel,
          zoomMode,
        },
      });
    } catch {
      // Ignore transient not-ready reads during document transitions
    }
  }

  function scheduleStatusReport() {
    clearTimeout(statusTimeout);
    statusTimeout = window.setTimeout(reportStatus, 80);
  }

  function queueViewStateSync({ flush = false, immediate = false } = {}) {
    if (isRestoring || !activeStage) {
      return;
    }

    const snapshot = buildSerializableViewState(activeStage);
    if (!snapshot) {
      return;
    }

    store.syncViewState(snapshot, { notifyExtension: false, persistLocally: false });

    if (flush) {
      clearTimeout(syncTimeout);
      clearTimeout(checkpointTimeout);
      store.syncViewState(snapshot, {
        notifyExtension: true,
        flush: true,
        persistLocally: true,
      });
      return;
    }

    clearTimeout(syncTimeout);
    syncTimeout = window.setTimeout(() => {
      const latest = buildSerializableViewState(activeStage);
      if (latest) {
        store.syncViewState(latest, {
          notifyExtension: true,
          persistLocally: true,
        });
      }
    }, immediate ? 0 : SYNC_DEBOUNCE_MS);

    clearTimeout(checkpointTimeout);
    checkpointTimeout = window.setTimeout(() => {
      const latest = buildSerializableViewState(activeStage);
      if (latest) {
        store.syncViewState(latest, {
          notifyExtension: true,
          flush: true,
          persistLocally: true,
        });
      }
    }, CHECKPOINT_DEBOUNCE_MS);
  }

  function applyDefaultZoom(stage) {
    const zoomLevel = store.messageConfig?.zoomLevel;
    if (!stage || zoomLevel === undefined || zoomLevel === null) {
      return;
    }
    try {
      if (zoomLevel === "fit-width" && typeof stage.fitWidth === "function") {
        stage.fitWidth();
      } else if (zoomLevel === "fit-page" && typeof stage.fitPage === "function") {
        stage.fitPage();
      } else if (typeof zoomLevel === "number" && typeof stage.zoomTo === "function") {
        stage.zoomTo(zoomLevel);
      } else if (typeof stage.zoomTo === "function") {
        stage.zoomTo(zoomLevel);
      }
    } catch (error) {
      console.warn("[Webview] Failed to apply default zoom:", error);
    }
  }

  function restoreViewState(stage) {
    const saved = store.persistedViewState;
    if (!stage) {
      return;
    }
    if (!saved) {
      applyDefaultZoom(stage);
      return;
    }

    isRestoring = true;
    try {
      const v3State = extractStageViewState(saved);
      if (v3State && typeof stage.applyViewState === "function") {
        stage.applyViewState(v3State);
      } else {
        const legacyPage = extractLegacyPageNumber(saved);
        if (legacyPage && legacyPage > 1 && typeof stage.goToPage === "function") {
          stage.goToPage(legacyPage - 1, { behavior: "instant" });
        }
      }
    } catch (error) {
      console.warn("[Webview] Failed to restore viewState:", error);
    } finally {
      window.setTimeout(() => {
        isRestoring = false;
        reportStatus();
      }, 250);
    }
  }

  function bindActiveDocument(viewer, documentId) {
    disposeList(docDisposables);
    activeStage = null;
    lastReportedDirty = false;

    if (!documentId) {
      return;
    }

    const scoped = viewer.forDocument(documentId);
    const stage = scoped.tryGet("stage");
    activeStage = stage;

    if (stage) {
      restoreViewState(stage);

      if (typeof stage.onPageChanged === "function") {
        docDisposables.push(
          stage.onPageChanged(() => {
            scheduleStatusReport();
            queueViewStateSync({ immediate: true });
          })
        );
      }
      if (typeof stage.onZoomChanged === "function") {
        docDisposables.push(
          stage.onZoomChanged(() => {
            scheduleStatusReport();
            queueViewStateSync({ immediate: true });
          })
        );
      }
      if (typeof stage.onCameraChanged === "function") {
        docDisposables.push(
          stage.onCameraChanged(() => {
            queueViewStateSync();
          })
        );
      }
      if (typeof stage.onSettingsChanged === "function") {
        docDisposables.push(
          stage.onSettingsChanged(() => {
            scheduleStatusReport();
            queueViewStateSync({ immediate: true });
          })
        );
      }

      reportStatus();
    }
  }

  function handleOpenFailure(msg) {
    if (store.useWorker && /worker/i.test(msg)) {
      console.warn("[Webview] Worker engine boot failed; falling back to main-thread engine:", msg);
      onWorkerFallback?.();
      return;
    }
    onError?.(msg);
    vscodeService.postMessage({ command: "error", error: msg });
  }

  function handleReady(viewer) {
    clearAllDisposables();
    store.viewer = viewer;

    if (typeof window !== "undefined") {
      window.__modernPdfViewer = viewer;
    }

    const documents = viewer.documents;
    if (!documents) {
      return;
    }

    if (typeof documents.onOpened === "function") {
      viewerDisposables.push(
        documents.onOpened((event) => {
          bindActiveDocument(viewer, event.documentId);
        })
      );
    }

    if (typeof documents.onActiveChanged === "function") {
      viewerDisposables.push(
        documents.onActiveChanged((event) => {
          bindActiveDocument(viewer, event.documentId);
        })
      );
    }

    if (typeof documents.onUnsavedChangesChanged === "function") {
      viewerDisposables.push(
        documents.onUnsavedChangesChanged((event) => {
          if (event.hasUnsavedChanges && !lastReportedDirty) {
            lastReportedDirty = true;
            vscodeService.postMessage({ command: "dirty" });
          } else if (!event.hasUnsavedChanges) {
            lastReportedDirty = false;
          }
        })
      );
    }

    if (typeof documents.onOpenFailed === "function") {
      viewerDisposables.push(
        documents.onOpenFailed((event) => {
          const msg = event?.error?.message || "Failed to open PDF document.";
          handleOpenFailure(msg);
        })
      );
    }

    // Check if any document already settled or failed before onReady attached listeners
    const existingDocs = documents.list?.() || [];
    for (const doc of existingDocs) {
      if (doc.status === "error") {
        handleOpenFailure(doc.error?.message || "Failed to open PDF document.");
        return;
      }
    }

    const currentId = documents.getActiveId?.();
    if (currentId) {
      const info = documents.get?.(currentId);
      if (info?.status === "ready") {
        bindActiveDocument(viewer, currentId);
      }
    }
  }

  function flushViewState() {
    queueViewStateSync({ flush: true });
  }

  function destroy() {
    flushViewState();
    clearAllDisposables();
    if (typeof window !== "undefined" && window.__modernPdfViewer === store.viewer) {
      delete window.__modernPdfViewer;
    }
    store.viewer = null;
  }

  return {
    handleReady,
    flushViewState,
    destroy,
  };
}
