# API Reference

`Modern PDF Preview` 暴露了一个简单 API，供其他 VS Code 扩展打开 PDF 预览。

## Get API

```js
const ext = vscode.extensions.getExtension("chocolatedesue.modern-pdf-preview");
const api = await ext.activate();
const pdfApi = api.getV1Api();
```

## Preview

```js
pdfApi.previewPdfFile(provider, options);
```

- `provider`: `PdfFileDataProvider`
- `options.name`: 覆盖标签标题
- `options.documentKey`: 视图状态持久化 key
- `options.config`: 单次预览配置
- `options.viewState`: 初始视图状态

常用 `viewState` 字段：

- `pageNumber`
- `pageCoordinates`
- `zoomLevel`
- `spreadMode`
- `rotation`
- `scrollStrategy`

## Data Provider

```js
const provider = pdfApi.PdfFileDataProvider.fromUint8Array(fileData);
```

可用方法：

- `fromUint8Array(data)`
- `fromBase64String(data)`
- `withName(name)`

## Example

```js
const fileData = await vscode.workspace.fs.readFile(uri);

const provider = pdfApi.PdfFileDataProvider
  .fromUint8Array(fileData)
  .withName("Release Notes");

pdfApi.previewPdfFile(provider, {
  documentKey: `preview:${uri.toString()}`,
  viewState: {
    pageNumber: 5,
    zoomLevel: "fit-width",
  },
  config: {
    tabBar: "never",
  },
});
```
