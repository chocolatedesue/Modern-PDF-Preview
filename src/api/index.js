import PDFEdit from "../providers/editorProvider";
import Logger from "../services/logger";
import { WEBVIEW_OPTIONS } from "../constants/index.js";
const vscode = require("vscode");

class DataTypeEnum {
  static BASE64STRING = "base64";
  static UINT8ARRAY = "u8array";
}

function decodeBase64ToUint8Array(base64) {
  if (typeof Buffer !== "undefined") {
    const buffer = Buffer.from(base64, "base64");
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

class PdfFileDataProvider {
  static DataTypeEnum = DataTypeEnum;

  type;
  data;
  name;

  /**
   * @param {DataTypeEnum} type What type the data is.
   * @param {string|Uint8Array} data The file data.
   */
  constructor(type, data) {
    this.type = type;
    this.data = data;
    this.name = "PDF Preview (via API)";
  }

  static fromBase64String(base64Data) {
    return new PdfFileDataProvider(DataTypeEnum.BASE64STRING, base64Data);
  }

  static fromUint8Array(u8array) {
    return new PdfFileDataProvider(DataTypeEnum.UINT8ARRAY, u8array);
  }

  withName(newName) {
    this.name = newName;
    return this;
  }

  async getFileData() {
    return this.getRawData();
  }

  getRawData() {
    if (this.type === DataTypeEnum.UINT8ARRAY) {
      if (this.data instanceof Uint8Array) {
        return this.data;
      }
      return new Uint8Array(this.data);
    }
    if (this.type === DataTypeEnum.BASE64STRING) {
      return decodeBase64ToUint8Array(this.data);
    }
    throw new TypeError("Unknown data type " + this.type);
  }
}

export default class PdfViewerApi {
  static PdfFileDataProvider = PdfFileDataProvider;

  static previewPdfFile(provider, options = {}) {
    const panelTitle = options.name || provider.name;
    if (options.name) {
      provider.withName(options.name);
    }

    Logger.log(`API: Creating preview for: ${panelTitle}`);
    const panel = vscode.window.createWebviewPanel(
      "modernPdfViewer.apiCreatedPreview",
      panelTitle,
      vscode.ViewColumn.Active,
      WEBVIEW_OPTIONS
    );
    PDFEdit.previewPdfFile(provider, panel, options);
  }
}
