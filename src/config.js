const vscode = require('vscode');

/**
 * Fetches and maps configurations for the PDF webview.
 * @returns {Object}
 */
export function getPdfConfiguration() {
    const config = vscode.workspace.getConfiguration('modernPdfViewer');

    // Map VS Code enum values to @embedpdf/snippet values
    const zoomMap = {
        'page-width': 'fit-width',
        'page-fit': 'fit-page',
        'page-height': 'fit-page', // fit-height is not supported by default, fallback to fit-page
        'auto': 'automatic'
    };

    const spreadMap = {
        'none': 'none',
        'odd': 'odd',
        'even': 'even'
    };

    let zoomLevel = config.get('defaultZoomLevel', 'page-width');
    const spreadMode = config.get('defaultSpreadMode', 'none');

    const tabBar = config.get('tabBar', 'never');

    // Handle percentage strings (e.g., "100%")
    if (typeof zoomLevel === 'string' && zoomLevel.endsWith('%')) {
        const percent = parseFloat(zoomLevel);
        if (!isNaN(percent)) {
            zoomLevel = percent / 100;
        }
    } else {
        zoomLevel = zoomMap[zoomLevel] || zoomLevel;
    }

    return {
        zoomLevel: zoomLevel,
        spreadMode: spreadMap[spreadMode] || spreadMode,
        tabBar: tabBar,
        initialDocuments: [],
    };
}
