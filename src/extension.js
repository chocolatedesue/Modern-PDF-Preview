import PDFEdit from "./providers/editorProvider.js";
import PdfViewerApi from "./api/index.js";
import { statusBarManager } from "./managers/statusBarManager.js";

const vscode = require("vscode");

exports.activate = function (context) {
  const providerDisposable = PDFEdit.register(context);
  context.subscriptions.push(providerDisposable);

  const commandDisposable = vscode.commands.registerCommand("modernPdfViewer.forceSave", () => {
    PDFEdit.forceSave(context);
  });
  context.subscriptions.push(commandDisposable);

  const configDisposable = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("modernPdfViewer.showStatusBar")) {
      statusBarManager.refresh();
    }
  });
  context.subscriptions.push(configDisposable);

  return {
    getV1Api: function () {
      return PdfViewerApi;
    },
  };
};

exports.deactivate = function () {
  statusBarManager.dispose();
};
