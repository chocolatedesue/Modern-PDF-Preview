import { activeEditors } from "./editorManager";
import { getPdfConfiguration } from "./configManager";

const vscode = require("vscode");

class StatusBarManager {
  constructor() {
    this._item = null;
  }

  init(context) {
    if (this._item) {
      return this._item;
    }
    this._item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this._item.name = "Modern PDF Preview";
    context.subscriptions.push(this._item);
    return this._item;
  }

  refresh() {
    if (!this._item) {
      return;
    }

    const config = getPdfConfiguration();
    if (!config.showStatusBar) {
      this._item.hide();
      return;
    }

    let activeEntry = null;
    for (const entry of activeEditors.values()) {
      if (entry.panel?.active) {
        activeEntry = entry;
        break;
      }
    }

    if (!activeEntry) {
      this._item.hide();
      return;
    }

    const status = activeEntry.lastStatus;
    const openCount = activeEditors.size;
    const parts = [];

    if (status && status.pageCount > 0) {
      parts.push(`Page ${status.pageNumber} / ${status.pageCount}`);
    } else {
      parts.push("PDF");
    }

    if (status && typeof status.zoomLevel === "number" && Number.isFinite(status.zoomLevel)) {
      parts.push(`${Math.round(status.zoomLevel * 100)}%`);
    }

    if (openCount > 1) {
      parts.push(`${openCount} open`);
    }

    this._item.text = `$(file-pdf) ${parts.join(" · ")}`;
    this._item.tooltip =
      openCount > 1
        ? `Modern PDF Preview — ${openCount} PDF tabs open (close unused tabs to reduce WASM memory)`
        : "Modern PDF Preview (EmbedPDF 3.x WASM)";
    this._item.show();
  }

  dispose() {
    if (this._item) {
      this._item.dispose();
      this._item = null;
    }
  }
}

export const statusBarManager = new StatusBarManager();
