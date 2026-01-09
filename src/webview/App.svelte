<script lang="ts">
  import { onMount } from "svelte";
  import Loading from "./components/Loading.svelte";
  import ErrorMessage from "./components/ErrorMessage.svelte";
  import PdfViewer from "./components/PdfViewer.svelte";
  import { pdfState } from "./state/pdfStore.svelte.js";
  import { vscodeService } from "./services/vscode.js";

  async function handleMessage(event: MessageEvent) {
    const message = event.data;
    if (!message || !message.command) return;

    console.log("[Webview] Received message command:", message.command);

    switch (message.command) {
      case "preview":
        pdfState.setPreview(message);
        break;
      case "save":
        await pdfState.handleSave(message);
        break;
      case "error":
        pdfState.error = message.error;
        pdfState.loading = false;
        break;
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    const isCloseKey =
      (isMac && e.metaKey && e.key === "w") ||
      (!isMac && e.ctrlKey && e.key === "w");

    if (isCloseKey) {
      e.preventDefault();
      e.stopPropagation();
      vscodeService.postMessage({ command: "close" });
    }
  }

  onMount(() => {
    console.log("[Webview] App mounted");

    window.addEventListener("keydown", handleKeyDown, true);

    const observer = new MutationObserver(() => pdfState.updateTheme());
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });
    pdfState.updateTheme();

    window.addEventListener("message", handleMessage);
    vscodeService.postMessage({ command: "ready" });

    const oldState = vscodeService.getState();
    if (oldState && (oldState.pdfUri || oldState.data)) {
      handleMessage({ data: { command: "preview", ...oldState } } as MessageEvent);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      observer.disconnect();
      window.removeEventListener("message", handleMessage);
      if (pdfState.activeBlobUrl) {
        URL.revokeObjectURL(pdfState.activeBlobUrl);
      }
    };
  });
</script>

<main>
  {#if pdfState.loading && !pdfState.error}
    <Loading />
  {/if}

  {#if pdfState.error}
    <ErrorMessage error={pdfState.error} />
  {/if}

  {#if pdfState.pdfSrc}
    <PdfViewer />
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
</style>
