import PDFEdit from "./editor";
import Logger from "./logger";
const vscode = require("vscode");

class DataTypeEnum {
  static BASE64STRING = "base64";
  static UINT8ARRAY = "u8array";
}

class PdfFileDataProvider {
  static DataTypeEnum = DataTypeEnum;

  type;
  data;
  name;

  /**
   *
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


  /**
   * Get file data as Uint8Array.
   * @returns {Promise<Uint8Array>}
   */
  async getFileData() {
    return this.getRawData();
  }

  /**
   * Get raw binary data.
   * @returns {Uint8Array}
   */
  getRawData() {
    if (this.type === DataTypeEnum.UINT8ARRAY) {
      if (this.data instanceof Uint8Array) {
        return this.data;
      }
      return new Uint8Array(this.data);
    }
    if (this.type === DataTypeEnum.BASE64STRING) {
      // Node.js env in VS Code provides Buffer
      const buffer = Buffer.from(this.data, 'base64');
      return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }
    throw new TypeError("Unknown data type " + this.type);
  }

}


export default class PdfViewerApi {
  static PdfFileDataProvider = PdfFileDataProvider;

  /**
   * Create a data provider and webview panel for a given pdf file and display it.
   * @param {PdfFileDataProvider} provider A holder for the file data.
   */
  static previewPdfFile(provider) {
    Logger.log(`API: Creating preview for: ${provider.name}`);
    const panel = vscode.window.createWebviewPanel(
      "modernPdfViewer.apiCreatedPreview",
      provider.name,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );
    PDFEdit.previewPdfFile(provider, panel);
  }
}
