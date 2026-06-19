<script lang="ts">
  import { onDestroy } from "svelte";
  import { PDFViewer, ZoomMode, SpreadMode } from "@embedpdf/svelte-pdf-viewer";
  import { pdfState } from "../state/pdfStore.svelte.js";
  import { vscodeService } from "../services/vscode.js";
  import { createViewerRuntime } from "../viewer/runtime.js";

  const viewerRuntime = createViewerRuntime({ pdfState, vscodeService });
  const initialViewState = $derived(pdfState.persistedViewState || {});

  $effect(() => {
    if (pdfState.container) {
      console.log("[Webview] Syncing theme preference:", pdfState.themePreference);
      pdfState.container.setTheme({ preference: pdfState.themePreference });
    }
  });

  onDestroy(() => {
    viewerRuntime.destroy();
  });
</script>

<div id="pdf-container" class="viewer-wrapper">
  <PDFViewer
    oninit={viewerRuntime.handleInit}
    onready={viewerRuntime.handleReady}
    config={{
      src: pdfState.pdfSrc,
      worker: pdfState.messageConfig?.worker ?? false,
      wasmUrl: pdfState.wasmUrl,
      theme: { preference: pdfState.themePreference },
      tabBar: pdfState.messageConfig?.tabBar,
      disabledCategories: ["print", "export", "redaction", "document"],
      annotations: {
        autoOpenLinks: false,
      },
      render: {
        defaultImageType: "image/bmp",
      },
      scroll: {
        defaultStrategy: initialViewState.scrollStrategy || pdfState.messageConfig?.scrollStrategy || "vertical",
      },
      rotation: {
        defaultRotation:
          typeof initialViewState.rotation === "number"
            ? initialViewState.rotation
            : pdfState.messageConfig?.rotation || 0,
      },
      spread: {
        defaultSpreadMode: initialViewState.spreadMode || pdfState.messageConfig?.spreadMode || SpreadMode.Odd,
      },
      zoom: {
        defaultZoomLevel: initialViewState.zoomLevel || pdfState.messageConfig?.zoomLevel || ZoomMode.FitWidth,
      },
    }}
    style="width: 100%; height: 100%;"
  />
</div>

<style>
  .viewer-wrapper {
    width: 100%;
    height: 100%;
  }
</style>
