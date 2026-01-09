# Operations Manual

This document outlines the operational procedures for maintaining and releasing the **Modern PDF Preview** extension.

## 1. Development Environment

### Prerequisites
- Node.js (v16+)
- npm
- VS Code (for testing)

### Setup
```bash
npm install
```

## 2. Build Process

The extension uses `webpack` to bundle dependencies and assets.

```bash
# Production Build
npm run build

# Watch Mode (for development)
npx webpack --watch
```

**Note**: The build output is located in the `dist/` directory.

## 3. Testing

### Headless Web Testing
Run the following command to verify the extension in a headless web environment:

```bash
npx @vscode/test-web --extensionDevelopmentPath=. --headless
```

### Manual Testing
1. Press `F5` in VS Code to launch the **Extension Development Host**.
2. Open a PDF file.
3. Verify that the viewer loads and functions correctly.

## 4. Release & Publishing

### Versioning
1. Update version in `package.json`.
2. Update `CHANGELOG.md` with new features/fixes.

### Publishing to Marketplace

The project includes a helper script `scripts/publish.sh` that checks for environment variables and publishes to both VS Code Marketplace and Open VSX Registry.

**Prerequisites:**
- `.env` file with `VSCE_PAT` and optionally `OVSX_TOKEN`.

**Command:**
```bash
npm run deploy
```

OR manually:

```bash
# VS Code Marketplace
npx vsce publish

# Open VSX
npx ovsx publish
```

## 5. Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common runtime issues and solutions.

## 6. Component Updates

This project vendors third-party components in the `media/` directory.

## 6. Component Updates

This project vendors third-party components in the `media/` directory.

### Updating `embed-pdf-viewer` & `pdfium`

The update process is automated via the `update-media` script.

1.  **Install Latest Package**:
    ```bash
    npm install @embedpdf/snippet@latest
    ```

2.  **Run Update Script**:
    ```bash
    npm run update-media
    ```

    This script will:
    - Clean old `embed-pdf-viewer` files from `media/`.
    - Copy the new assets (JS/WASM) from `node_modules/@embedpdf/snippet/dist`.
    - Automatically handle hashed filenames.

3.  **Verify**:
    - Run the extension (F5) to confirm functionality.
    - Check that `media/` contains the new files.
