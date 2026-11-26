/**
 * Escapes HTML special characters to prevent markup/script injection in error pages.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Generates the HTML for the PDF webview.
 * @param {import("vscode").Webview} webview
 * @param {string} htmlContent
 * @param {import("vscode").Uri} webviewBundleUri
 * @param {import("vscode").Uri} mediaUri
 * @param {import("vscode").Uri} wasmUri
 * @param {import("vscode").Uri} workerUri
 * @returns {string}
 */
export function getWebviewHtml(webview, htmlContent, webviewBundleUri, mediaUri, wasmUri, workerUri) {
  return htmlContent
    .replace(/{{CSP_SOURCE}}/g, webview.cspSource)
    .replace(/{{WEBVIEW_BUNDLE_URI}}/g, webviewBundleUri.toString())
    .replace(/{{MEDIA_URI}}/g, webview.asWebviewUri(mediaUri).toString())
    .replace(/{{WASM_URI}}/g, wasmUri.toString())
    .replace(/{{WORKER_URI}}/g, workerUri ? workerUri.toString() : "");
}

/**
 * Generates an HTML-escaped error page.
 * @param {string} errorType
 * @param {string} errorMessage
 * @param {string} suggestion
 * @param {boolean} canRetry
 * @param {number} duration
 * @returns {string}
 */
export function getErrorHtml(errorType, errorMessage, suggestion, canRetry, duration) {
  const safeType = escapeHtml(errorType);
  const safeMessage = escapeHtml(errorMessage || "An unknown error occurred");
  const safeSuggestion = escapeHtml(suggestion);
  const safeDuration = escapeHtml(Number.isFinite(duration) ? duration : 0);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
      <style>
        body {
          font-family: var(--vscode-font-family);
          padding: 40px;
          color: var(--vscode-foreground);
          background: var(--vscode-editor-background);
        }
        .error-container {
          max-width: 600px;
          margin: 0 auto;
        }
        h1 {
          color: var(--vscode-errorForeground);
          margin-bottom: 20px;
        }
        .error-details {
          background: var(--vscode-textBlockQuote-background);
          border-left: 4px solid var(--vscode-errorForeground);
          padding: 15px;
          margin: 20px 0;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .suggestion {
          background: var(--vscode-textBlockQuote-background);
          border-left: 4px solid var(--vscode-notificationsInfoIcon-foreground);
          padding: 15px;
          margin: 20px 0;
        }
        button {
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          padding: 10px 20px;
          margin: 10px 10px 10px 0;
          cursor: pointer;
          font-size: 14px;
        }
        button:hover {
          background: var(--vscode-button-hoverBackground);
        }
        .error-code {
          font-family: var(--vscode-editor-font-family);
          font-size: 12px;
          color: var(--vscode-descriptionForeground);
          margin-top: 10px;
        }
      </style>
    </head>
    <body>
      <div class="error-container">
        <h1>${safeType}</h1>
        <div class="error-details">
          <strong>Error Message:</strong><br>
          ${safeMessage}
        </div>
        <div class="suggestion">
          <strong>Suggestion:</strong><br>
          ${safeSuggestion}
        </div>
        ${canRetry ? '<button onclick="window.location.reload()">Retry</button>' : ""}
        <div class="error-code">
          Error occurred ${safeDuration}ms after webview initialization
        </div>
      </div>
    </body>
    </html>
  `;
}
