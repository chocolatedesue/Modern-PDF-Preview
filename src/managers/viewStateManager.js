import Logger from "../services/logger";
import { activeEditors } from "./editorManager";

const VIEW_STATE_STORAGE_PREFIX = "modernPdfViewer.viewState:";
const VIEW_STATE_CHECKPOINT_DELAY = 1500;
const viewStateMemoryCache = new Map();
const viewStateCheckpointTimers = new Map();
const lastCheckpointedViewStateCache = new Map();

function areViewStatesEqual(left, right) {
  return JSON.stringify(left || null) === JSON.stringify(right || null);
}

export class ViewStateManager {
  /**
   * @param {import("vscode").ExtensionContext} context
   */
  constructor(context) {
    this.context = context;
  }

  #getViewStateKey(uriString) {
    return `${VIEW_STATE_STORAGE_PREFIX}${uriString}`;
  }

  #clearCheckpointTimer(uriString) {
    const existingTimer = viewStateCheckpointTimers.get(uriString);
    if (existingTimer) {
      clearTimeout(existingTimer);
      viewStateCheckpointTimers.delete(uriString);
    }
  }

  getPersisted(uriString) {
    if (!uriString || uriString === "unknown-uri") {
      return null;
    }

    if (viewStateMemoryCache.has(uriString)) {
      return viewStateMemoryCache.get(uriString);
    }

    const persistedViewState = this.context.workspaceState.get(this.#getViewStateKey(uriString), null);
    lastCheckpointedViewStateCache.set(uriString, persistedViewState);
    return persistedViewState;
  }

  updateHot(uriString, viewState) {
    if (!uriString || uriString === "unknown-uri") {
      return;
    }

    const normalizedViewState = viewState || null;
    viewStateMemoryCache.set(uriString, normalizedViewState);

    const editorEntry = activeEditors.get(uriString);
    if (editorEntry) {
      editorEntry.lastViewState = normalizedViewState;
    }
  }

  async flush(uriString) {
    if (!uriString || uriString === "unknown-uri") {
      return;
    }

    this.#clearCheckpointTimer(uriString);

    const normalizedViewState = viewStateMemoryCache.get(uriString) || null;
    const lastCheckpointedViewState = lastCheckpointedViewStateCache.get(uriString);
    if (areViewStatesEqual(lastCheckpointedViewState, normalizedViewState)) {
      return;
    }

    Logger.log(`[View State] Checkpointing updated viewer state`);
    await this.context.workspaceState.update(this.#getViewStateKey(uriString), normalizedViewState);
    lastCheckpointedViewStateCache.set(uriString, normalizedViewState);
  }

  scheduleCheckpoint(uriString) {
    if (!uriString || uriString === "unknown-uri") {
      return;
    }

    this.#clearCheckpointTimer(uriString);
    viewStateCheckpointTimers.set(
      uriString,
      setTimeout(() => {
        viewStateCheckpointTimers.delete(uriString);
        void this.flush(uriString);
      }, VIEW_STATE_CHECKPOINT_DELAY)
    );
  }

  clearTimer(uriString) {
    if (!uriString || uriString === "unknown-uri") {
      return;
    }

    this.#clearCheckpointTimer(uriString);
  }

  disposeUri(uriString) {
    if (!uriString || uriString === "unknown-uri") {
      return;
    }

    this.#clearCheckpointTimer(uriString);
    viewStateMemoryCache.delete(uriString);
    lastCheckpointedViewStateCache.delete(uriString);
  }
}
