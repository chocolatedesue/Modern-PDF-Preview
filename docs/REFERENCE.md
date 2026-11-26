# Reference Repository

`references/vscode-pdf` is a Git submodule used only for comparison.

## Setup

```bash
git submodule update --init --recursive
```

Refresh later:

```bash
git submodule update --remote references/vscode-pdf
```

## What To Compare

- Custom editor lifecycle
- Webview setup
- Message flow
- Multi-panel handling

## Useful Files

- `references/vscode-pdf/src/extension.ts`
- `references/vscode-pdf/src/pdf-viewer-provider.ts`
- `references/vscode-pdf/src/webview-collection.ts`
- `src/extension.js`
- `src/providers/editorProvider.js`
- `src/managers/editorManager.js`

## Guardrails

- Do not import runtime code from the submodule.
- Do not edit the submodule unless you intend to update the pinned reference.
- Prefer this repository's `src/webview/*` for viewer behavior.
