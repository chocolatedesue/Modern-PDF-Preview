# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
