<script lang="ts">
  import { onMount } from "svelte";
  import {
    PDFViewer,
    ZoomMode,
    SpreadMode,
    type EmbedPdfContainer,
    type PluginRegistry,
  } from "@embedpdf/svelte-pdf-viewer";

  /* global acquireVsCodeApi */
  const vscode =
    typeof (window as any).acquireVsCodeApi !== "undefined"
      ? (window as any).acquireVsCodeApi()
      : null;

  let themePreference = $state<"light" | "dark">(getTheme());
  let pdfSrc = $state<string | null>(null);
  let wasmUrl = $state<string>("");

  let container = $state<EmbedPdfContainer | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let currentDocumentUri = null;
  let messageConfig = $state<any>(null);

  function getTheme(): "light" | "dark" {
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

  function updateTheme() {
    const newTheme = getTheme();
    if (themePreference !== newTheme) {
      console.log("[Webview] Theme changed to:", newTheme);
      themePreference = newTheme;
    }
  }

  const handleInit = (c: EmbedPdfContainer) => {
    console.log("[Webview] PDF Viewer Initialized");
    container = c;
  };

  const handleReady = (registry: PluginRegistry) => {
    console.log("[Webview] PDF Viewer Ready with Registry");
  };

  $effect(() => {
    if (container) {
      console.log("[Webview] Syncing theme preference:", themePreference);
      container.setTheme({ preference: themePreference });
    }
  });

  async function handleMessage(event) {
    const message = event.data;
    if (!message || !message.command) return;

    console.log("[Webview] Received message command:", message.command);

    switch (message.command) {
      case "preview":
        const newDocUri = message.pdfUri || "base64-data";
        if (currentDocumentUri === newDocUri && pdfSrc) {
          console.log("[Webview] Ignoring duplicate document URI");
          return;
        }

        console.log("[Webview] Processing preview for:", newDocUri);
        currentDocumentUri = newDocUri;
        wasmUrl = message.wasmUri;
        messageConfig = message.config;
        console.log(
          "[Webview] Received config:",
          JSON.stringify(messageConfig),
        );

        // Use Blob URL for data injection mode
        let src = message.pdfUri;
        if (!src && message.data) {
          console.log("[Webview] Converting base64 to blob");
          const buffer = base64ToArrayBuffer(message.data);
          const blob = new Blob([buffer], { type: "application/pdf" });
          src = URL.createObjectURL(blob);
        }

        if (src) {
          console.log("[Webview] Setting pdfSrc");
          pdfSrc = src;
          loading = false;
        } else {
          console.warn("[Webview] No source resolved for PDF");
          error = "Failed to resolve PDF source";
          loading = false;
        }

        if (vscode) {
          vscode.setState({
            pdfUri: message.pdfUri,
            data: message.data,
            wasmUri: message.wasmUri,
            workerUri: message.workerUri,
            viewState: vscode.getState()?.viewState || null,
            config: message.config,
          });
        }
        break;
      case "error":
        console.error("[Webview] Error message from extension:", message.error);
        error = message.error;
        loading = false;
        break;
      default:
        console.log("[Webview] Unhandled command:", message.command);
    }
  }

  function base64ToArrayBuffer(base64) {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
  }

  onMount(() => {
    console.log("[Webview] App mounted");

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    window.addEventListener("message", handleMessage);

    // Initial theme
    updateTheme();

    // Signal ready
    if (vscode) {
      console.log("[Webview] Sending ready signal to host");
      vscode.postMessage({ command: "ready" });
    }

    // Restore state
    if (vscode) {
      const oldState = vscode.getState();
      if (oldState && (oldState.pdfUri || oldState.data)) {
        console.log("[Webview] Restoring state");
        handleMessage({ data: { command: "preview", ...oldState } });
      }
    }

    return () => {
      observer.disconnect();
      window.removeEventListener("message", handleMessage);
    };
  });
</script>

<main>
  {#if loading && !error}
    <div id="loading">
      <h1>Your PDF is loading...</h1>
      <p>
        If you see this screen for more than a few seconds, close this editor
        tab and reopen the file.
      </p>
    </div>
  {/if}

  {#if error}
    <div id="error">
      <h1>Error Loading PDF</h1>
      <pre>{error}</pre>
    </div>
  {/if}

  {#if pdfSrc}
    <div id="pdf-container" class="viewer-wrapper">
      <PDFViewer
        oninit={handleInit}
        onready={handleReady}
        config={{
          src: pdfSrc,
          wasmUrl: wasmUrl,
          theme: { preference: themePreference },
          spread: {
            defaultSpreadMode: messageConfig?.spreadMode || SpreadMode.Odd,
          },
          zoom: {
            defaultZoomLevel: messageConfig?.zoomLevel || ZoomMode.FitWidth,
          },
        }}
        style="width: 100%; height: 100%;"
      />
    </div>
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
    background-color: var(--vscode-editor-background);
  }

  main {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    position: relative;
  }

  .viewer-wrapper {
    width: 100%;
    height: 100%;
  }

  #loading,
  #error {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    padding: 20px;
    z-index: 10;
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    font-family: var(--vscode-font-family);
    box-sizing: border-box;
  }

  #error {
    color: var(--vscode-errorForeground);
  }

  pre {
    white-space: pre-wrap;
    word-break: break-all;
  }
</style>
