/**
 * Collection of active editors and their state
 * @type {Map<string, {
 *   panel: import("vscode").WebviewPanel,
 *   stateKey?: string,
 *   messageDisposable: import("vscode").Disposable | null,
 *   changeDisposable?: import("vscode").Disposable | null,
 *   disposeDisposable?: import("vscode").Disposable | null,
 *   lastViewState?: Record<string, unknown> | null,
 *   dataProvider?: unknown,
 *   pendingSave?: {
 *     requestId: string,
 *     destinationUri: import("vscode").Uri,
 *     timeout: ReturnType<typeof setTimeout>,
 *     cancellationDisposable: import("vscode").Disposable,
 *     resolve: () => void,
 *     reject: (error: Error) => void
 *   } | null
 * }>}
 */
export const activeEditors = new Map();
