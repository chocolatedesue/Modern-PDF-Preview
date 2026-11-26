const fs = require("fs");
const path = require("path");
const webpack = require("webpack");

class CopyEmbedPdfAssetsPlugin {
  apply(compiler) {
    compiler.hooks.afterEmit.tap("CopyEmbedPdfAssetsPlugin", () => {
      const srcDir = path.resolve(__dirname, "node_modules/@embedpdf/viewer/dist");
      const outDir = path.resolve(__dirname, "media");
      fs.mkdirSync(outDir, { recursive: true });

      for (const file of ["embedpdf.wasm", "embedpdf-worker.js", "encoder-worker.js"]) {
        const src = path.join(srcDir, file);
        const dest = path.join(outDir, file);
        if (!fs.existsSync(src)) {
          throw new Error(`Missing EmbedPDF runtime asset: ${src}`);
        }
        fs.copyFileSync(src, dest);
      }

      const legacyWasm = path.join(outDir, "pdfium.wasm");
      if (fs.existsSync(legacyWasm)) {
        fs.unlinkSync(legacyWasm);
      }
    });
  }
}

const extensionNodeConfig = {
  entry: {
    extension: "./src/extension.js",
  },
  output: {
    filename: "[name].node.js",
    path: path.resolve(__dirname, "dist"),
  },
  devtool: "source-map",
  externals: {
    vscode: "commonjs vscode",
  },
  mode: "production",
  target: "node",
  optimization: {
    minimize: true,
  },
};

const extensionWebConfig = {
  entry: {
    extension: "./src/extension.js",
  },
  output: {
    filename: "[name].browser.js",
    path: path.resolve(__dirname, "dist"),
    libraryTarget: "commonjs",
  },
  devtool: "source-map",
  externals: {
    vscode: "commonjs vscode",
  },
  resolve: {
    fallback: {
      path: false,
      fs: false,
    },
  },
  mode: "production",
  target: "webworker",
  optimization: {
    minimize: true,
  },
};

const webviewConfig = {
  entry: {
    webview: "./src/webview/index.js",
  },
  output: {
    filename: "webview-bundle.js",
    path: path.resolve(__dirname, "media"),
    publicPath: "auto",
    assetModuleFilename: "[name][ext]",
  },
  resolve: {
    extensions: [".mjs", ".js"],
    mainFields: ["browser", "module", "main"],
    conditionNames: ["browser", "import", "default"],
  },
  module: {
    rules: [
      {
        test: /\.wasm$/,
        type: "asset/resource",
        generator: {
          filename: "embedpdf.wasm",
        },
      },
      {
        test: /node_modules\/@embedpdf\/.*\.m?js$/,
        resolve: {
          fullySpecified: false,
        },
      },
    ],
  },
  mode: "production",
  target: "web",
  performance: {
    hints: false,
  },
  optimization: {
    minimize: true,
    splitChunks: false,
    moduleIds: "deterministic",
    chunkIds: "deterministic",
  },
  plugins: [
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1,
    }),
    new CopyEmbedPdfAssetsPlugin(),
  ],
};

module.exports = [extensionNodeConfig, extensionWebConfig, webviewConfig];
