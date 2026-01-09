import EmbedPDF from './embed-pdf-viewer.min.js';

const vscode = acquireVsCodeApi();
const oldState = vscode.getState();

let viewer;
let currentBlobUrl;

function showError(err) {
  console.error(err);
  const errorDiv = document.getElementById("error");
  const errorMessage = document.getElementById("error-message");
  const loadingDiv = document.getElementById("loading");

  if (loadingDiv) loadingDiv.style.display = "none";
  if (errorDiv) {
    errorDiv.style.display = "block";
    errorMessage.textContent = err.stack || err.message || String(err);
  }
}

function getTheme() {
  if (document.body.classList.contains('vscode-dark')) {
    return 'dark';
  } else if (document.body.classList.contains('vscode-high-contrast')) {
    return 'dark';
  } else {
    return 'light';
  }
}

// Watch for theme changes
const observer = new MutationObserver(() => {
  if (viewer) {
    viewer.setTheme(getTheme());
  }
});
observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

if (oldState && oldState.data) {
  previewPdf(null, oldState.data, oldState.wasmUri, oldState.workerUri).catch(showError);
}

window.addEventListener('message', async event => {
  const message = event.data;
  switch (message.command) {
    case 'preview':
      previewPdf(message.pdfUri, message.data, message.wasmUri, message.workerUri);
      vscode.setState({
        pdfUri: message.pdfUri,
        data: message.data,
        wasmUri: message.wasmUri,
        workerUri: message.workerUri
      });
      break;
    case 'base64': // Backward compatibility
      previewPdf(null, message.data, message.wasmUri, message.workerUri);
      vscode.setState({
        data: message.data,
        wasmUri: message.wasmUri,
        workerUri: message.workerUri
      });
      break;
    case 'error':
      showError(message.error);
      break;
  }
});

async function previewPdf(pdfUri, base64Data, wasmUri, workerUri) {
  try {
    let source = pdfUri;

    if (!source && base64Data) {
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
      const buffer = base64ToArrayBuffer(base64Data);
      const blob = new Blob([buffer], { type: 'application/pdf' });
      source = URL.createObjectURL(blob);
      currentBlobUrl = source;
    }

    if (!source) {
      console.warn("No PDF source provided.");
      document.getElementById("loading")?.remove();
      return;
    }

    if (!viewer) {
      viewer = EmbedPDF.init({
        type: 'container',
        target: document.getElementById('pdf-viewer'),
        src: source,
        wasmUrl: wasmUri,
        worker: true,
        theme: getTheme(),
      });
    } else {
      // Correctly use the DocumentManagerPlugin to open the new document
      // We assume EmbedPDF exports the plugin class or we can access it via the namespace
      try {
        const registry = await viewer.registry;
        const DocPlugin = EmbedPDF.DocumentManagerPlugin;
        if (DocPlugin) {
          const docManager = registry.getPlugin(DocPlugin);
          await docManager.openDocumentUrl({ url: source });
        } else {
          // Fallback: Re-initialize if we can't access the plugin class
          // This ensures robustness if the import structure varies
          const target = document.getElementById('pdf-viewer');
          target.innerHTML = ''; // Clean up
          viewer = EmbedPDF.init({
            type: 'container',
            target: target,
            src: source,
            wasmUrl: wasmUri,
            worker: true,
            theme: getTheme(),
          });
        }
      } catch (err) {
        console.warn("Update failed, attempting re-init", err);
        const target = document.getElementById('pdf-viewer');
        target.innerHTML = '';
        viewer = EmbedPDF.init({
          type: 'container',
          target: target,
          src: source,
          wasmUrl: wasmUri,
          worker: true,
          theme: getTheme(),
        });
      }
    }

    document.getElementById("loading")?.remove();
  } catch (e) {
    showError(e);
  }
}

function base64ToArrayBuffer(base64) {
  var binary_string = window.atob(base64);
  var len = binary_string.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

// Signal to the extension that the webview is ready to receive messages
vscode.postMessage({ command: 'ready' });
