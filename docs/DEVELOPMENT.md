# Development

## Prerequisites

- Bun recommended
- Node.js 16+ supported
- VS Code for local testing

## Setup

```bash
bun install
git submodule update --init --recursive
```

## Build

```bash
bun run build
bunx webpack --watch
```

## Test

Web:

```bash
bun run test-web
```

Headless Web:

```bash
bun run test-web-headless
```

Desktop:

1. Open the repo in VS Code.
2. Press `F5`.
3. Open a `.pdf`.

## Release

Update:

- `package.json` version
- `CHANGELOG.md`

Package:

```bash
bun run package
```

Publish:

```bash
bun run deploy
```

If direct publishing is needed:

```bash
set -a; source .env
bunx vsce publish -p "$VSCE_PAT" -i ./modern-pdf-preview-<version>.vsix --no-dependencies
bunx ovsx publish -p "$OVSX_TOKEN" -i ./modern-pdf-preview-<version>.vsix
```

## Notes

- `references/vscode-pdf` is reference-only.
- Do not import runtime code from the reference submodule.
