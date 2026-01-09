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

  getFileData() {
    var _data = this.data;
    var _type = this.type;
    return new Promise(function (resolve, reject) {
      if (typeof _data === "undefined") {
        reject(new TypeError("Cannot get file data because data is undefined."));
      }
      switch (_type) {
        case DataTypeEnum.BASE64STRING:
          resolve(_data);
          break;
        case DataTypeEnum.UINT8ARRAY:
          try {
            // Web-compatible way to convert Uint8Array to base64
            let base64;
            if (typeof globalThis !== 'undefined' && typeof globalThis.btoa === 'function') {
              let binary = '';
              const len = _data.byteLength;
              for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(_data[i]);
              }
              base64 = globalThis.btoa(binary);
            } else if (typeof Window !== 'undefined' && typeof Window.prototype.btoa === 'function') {
              // Fallback for some older browser envs if globalThis is missing
              let binary = '';
              const len = _data.byteLength;
              for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(_data[i]);
              }
              base64 = window.btoa(binary);
            } else if (typeof Buffer !== 'undefined') {
              base64 = Buffer.from(_data).toString('base64');
            } else {
              throw new Error("Environment does not support Base64 conversion (no btoa or Buffer)");
            }
            resolve(base64);
          } catch (err) {
            reject(err);
            console.error("HINT from PDF Viewer API: Error converting Uint8Array to Base64 in this environment: " + err.message);
          }
          break;

        default:
          reject(new TypeError("Unknown data type " + _type));
          break;
      }
    });
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
    const panel = vscode.window.createWebviewPanel("modernPdfViewer.apiCreatedPreview", provider.name);
    PDFEdit.previewPdfFile(provider, panel);
  }
}
