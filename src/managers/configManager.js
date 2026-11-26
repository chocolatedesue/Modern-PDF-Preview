const vscode = require("vscode");

/**
 * Fetches and maps VS Code configuration values for the EmbedPDF 3.x webview.
 * @returns {Object}
 */
export function getPdfConfiguration() {
  const config = vscode.workspace.getConfiguration("modernPdfViewer");

  const zoomMap = {
    "page-width": "fit-width",
    "page-fit": "fit-page",
    "page-height": "fit-page",
    auto: "automatic",
  };

  const spreadMap = {
    none: "none",
    odd: "odd",
    even: "even",
  };

  let zoomLevel = config.get("defaultZoomLevel", "page-width");
  const spreadMode = config.get("defaultSpreadMode", "none");
  const tabBar = config.get("tabBar", "never");
  const worker = config.get("worker", true);
  const enableForms = config.get("enableForms", true);
  const showStatusBar = config.get("showStatusBar", true);

  if (typeof zoomLevel === "string" && zoomLevel.endsWith("%")) {
    const percent = parseFloat(zoomLevel);
    if (!Number.isNaN(percent) && percent > 0) {
      zoomLevel = percent / 100;
    }
  } else {
    zoomLevel = zoomMap[zoomLevel] || zoomLevel;
  }

  return {
    zoomLevel,
    spreadMode: spreadMap[spreadMode] || "none",
    rotation: 0,
    tabBar,
    worker,
    enableForms,
    showStatusBar,
  };
}
