# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
 
## [1.4.6]
- **Config**: Added dynamic `tabBar` configuration support (App.svelte now respects the setting).
- **Fix**: Implemented Blob URL cleanup to prevent memory leaks in the webview.

## [1.4.5]
- Optimization: Improved internal code structure and documentation.
- Refactor: Updated task management and analysis reports.

## [1.4.4] - 2026-01-09
 
### Fixed
- **Rendering**: Fixed issue where PDF content wouldn't render on initial load due to incorrect configuration mapping.
- **Config**: Added support for percentage zoom levels (e.g., 100%) and corrected zoom mode mapping strings.
 
## [1.4.3] - 2026-01-09
 
### Fixed
- **Release Integrity**: Re-publishing to fix an issue where 1.4.2 was released with stale build artifacts.
- **Workflow**: Automated build process during deployment to prevent future stale releases.

## [1.4.2] - 2026-01-09

### Added
- **Configurable Settings**: Users can now set default zoom level and spread mode via VS Code settings (`modernPdfViewer.defaultZoomLevel` and `modernPdfViewer.defaultSpreadMode`).

### Documentation
- **Consolidation**: Simplified documentation by merging operational guides into `DEVELOPMENT.md` and removing redundant files.
- **Cleanup**: Improved `README.md` with clear configuration instructions and project credits.

## [1.4.0] - 2026-01-09

### Performance
- **Direct URI Loading**: Implemented direct file streaming for Desktop, enabling instant opening of large PDF files (GB+) with zero memory copy overhead.
- **WASM Preloading**: Added critical resource preloading to parallelize engine download and compilation, significantly reducing time-to-first-render.
- **Lazy Activation**: Removed explicit activation events to improve VS Code startup performance.
- **Lifecycle Optimization**: Implemented visibility-aware state polling (auto-pause in background) to eliminate CPU usage for hidden tabs.
- **LRU Cache**: Increased cache capacity to 5 documents.

### Fixed
- **Tab Reload**: Fixed issue where Webview would reload when switching tabs (properly enabled `retainContextWhenHidden`).
- **Web Compatibility**: Fixed `path` module errors in Web Worker environments (vscode.dev).
- **API Compliance**: Corrected usage of EmbedPDF Zoom/Scroll Plugin APIs.

## [1.3.2] - 2026-01-09

### Fixed
- **Packaging**: Fixed critical `ENOENT` issue where `webview.html` was missing from the VSIX package.

## [1.3.1] - 2026-01-09

### Fixed
- **Documentation**: Corrected `README.md` attribution link to point to the original upstream repository.

## [1.3.0] - 2026-01-09

### Major Changes
- **Modern PDF Preview**: Complete re-brand and architecture overhaul.
- **Engine**: Replaced legacy viewer with `embed-pdf-viewer` (WASM-based) for high performance.
- **Web Compatibility**: Full support for VS Code Web (vscode.dev) with native Base64 handling.
- **Automation**: Introduced `npm run update-media` for one-click engine updates.

### Added
- **Operations Manual**: Comprehensive guide for building, testing, and updating.
- **Architecture Docs**: Detailed breakdown of the hybrid loading strategy.

### Removed
- **Bloat**: Removed `jszip` dependency, reducing bundle size by 95% (to ~4KB).
