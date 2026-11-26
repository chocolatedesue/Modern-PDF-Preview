/* global acquireVsCodeApi */

class VsCodeService {
  vscode = typeof acquireVsCodeApi !== "undefined" ? acquireVsCodeApi() : null;

  postMessage(message) {
    if (this.vscode) {
      this.vscode.postMessage(message);
    }
  }

  getState() {
    return this.vscode ? this.vscode.getState() : null;
  }

  setState(state) {
    if (this.vscode) {
      this.vscode.setState(state);
    }
  }
}

export const vscodeService = new VsCodeService();
