# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.7] - 2026-01-09

### Changed
- **Automation**: Added `npm run update-media` script to automate component updates.
- **Documentation**: Added "Component Updates" section to Operations manual.

## [1.2.6] - 2026-01-09

### Changed
- **Branding**: Renamed project to "Modern PDF Preview".
- **Documentation**: Updated README, API docs, and added Troubleshooting/Operations guides.
- **Optimization**: Removed `jszip` dependency (-95% bundle size).
- **Web Compatibility**: Fixed `Buffer` runtime issues in VS Code Web (Worker) environment.

### Fixed
- **Component Usage**: Corrected API usage for `embed-pdf-viewer` (theme syncing and document loading).

## [1.2.0] - 2026-01-09

### Major Changes
- Replaced the legacy `pdf.js` implementation with `embed-pdf-viewer` for a modern, high-performance viewing experience.

### Added
- **WebAssembly (WASM) Engine**: Highly optimized PDF rendering.
- **Theme Synchronization**: Automatic switching between light and dark modes based on VS Code settings.
- **Enhanced UI**: Built-in sidebar for thumbnails/bookmarks, advanced zoom, and search functionality.
- **Robust Loading**: Adopted Blob URL loading and improved error handling for complex PDF files.
- **Security**: Implemented strict Content Security Policy (CSP) for the webview.

### Fixed
- Fixed issues with large PDF files that were failing to render on canvas.
- Improved reliability for remote (SSH) development environments.

## [1.1.2] - 2024-2-13

API is released as a full version. **Important**: Obtaining the API works differently in this version than in `1.1.0`, so if for some reason you were already using this API you need to update it.

## [1.1.0] - 2023-12-19 (As pre-release)

Extension no longer needs the internet to load the worker.

An API is now available for other extensions to use to display PDF file previews.

## [1.0.4] - 2022-12-13

This is the initial release of the extension. PDF files are displayed as a series of images on canvases.

---

[_back to top_](#changelog)
