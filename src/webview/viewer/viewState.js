/**
 * Helpers for serializing and validating EmbedPDF 3.4.0 StageViewState
 * while safely handling legacy 2.x persisted view states.
 */

export function isV3StageViewState(viewState) {
  return !!(
    viewState &&
    typeof viewState === "object" &&
    typeof viewState.pageIndex === "number" &&
    viewState.anchor &&
    typeof viewState.anchor === "object"
  );
}

export function buildSerializableViewState(stage) {
  if (!stage || typeof stage.getViewState !== "function") {
    return null;
  }

  try {
    const viewState = stage.getViewState();
    if (!viewState || typeof viewState !== "object") {
      return null;
    }
    return {
      version: 3,
      stage: JSON.parse(JSON.stringify(viewState)),
      pageNumber: (stage.getCurrentPageIndex?.() ?? 0) + 1,
      pageCount: stage.getPageCount?.() ?? 0,
      zoomLevel: stage.getZoomLevel?.() ?? 1,
    };
  } catch (error) {
    console.warn("[Webview] Failed to snapshot stage viewState:", error);
    return null;
  }
}

export function extractStageViewState(persisted) {
  if (!persisted || typeof persisted !== "object") {
    return null;
  }
  if (persisted.version === 3 && isV3StageViewState(persisted.stage)) {
    return persisted.stage;
  }
  if (isV3StageViewState(persisted)) {
    return persisted;
  }
  return null;
}

export function extractLegacyPageNumber(persisted) {
  if (!persisted || typeof persisted !== "object") {
    return null;
  }
  if (typeof persisted.pageNumber === "number" && Number.isFinite(persisted.pageNumber) && persisted.pageNumber >= 1) {
    return Math.floor(persisted.pageNumber);
  }
  return null;
}
