# Modern PDF Preview (WASM) - 记录与故障排除 (Troubleshooting)

本文档记录了项目从旧版 `pdf.js` 迁移到现代 `embed-pdf-viewer` (WASM) 过程中遇到的核心挑战及其解决方案，特别针对 **VS Code Web (vscode.dev)** 环境的适配。

---

## 1. 引擎与架构迁移 (Engine Migration)

### 问题：旧版 `pdf.js` 在渲染大文件时卡顿且 UI 过时
- **原因**：原版插件使用的 `pdf.js` 版本较旧，且主要依赖 CPU 软渲染 canvas，缺乏现代交互功能。
- **解决方案**：引入基于 **WebAssembly (WASM)** 的 `embed-pdf-viewer`。
  - **优势**：渲染速度极快、内存占用低、自带现代化的工具栏和主题同步功能。

### 问题：加载本地 PDF 时出现 "Loading..." 挂起
- **原因**：VS Code Webview 通讯存在延迟，且传统的 `Buffer` 传递在某些环境下会导致序列化失败。
- **解决方案**：切换到 **Blob URL** 机制。
  - **实现**：前端接收到 Base64 数据后转换为 `Uint8Array` -> `Blob` -> `URL.createObjectURL`，极大提高了加载稳定性。

---

## 2. VS Code Web 适配 (Web Adaptations)

### 问题：插件在 Web 端 (vscode.dev) 无法加载
- **原因**：`package.json` 缺少对 Web 运行环境的声明。
- **解决方案**：
  - 添加 `"extensionKind": ["ui", "workspace"]`。
  - 加入 `"capabilities": { "virtualWorkspaces": true }` 以支持 GitHub 远程文件预览。
  - 修正入口点为相对路径 `./dist/main.js`。

### 问题：WebAssembly 实例化失败 (CSP 拦截)
- **现象**：控制台报错 `CompileError: WebAssembly.instantiate() violates Content Security Policy`.
- **原因**：VS Code Web 端沙箱由于安全策略，默认禁止在 Webview 中动态编译 WASM 字节码。
- **解决方案**：
  - 在 `src/editor.js` 的 **Content Security Policy (CSP)** 标签中新增以下权限：
    - `script-src`: 加入 `'unsafe-eval'` 和 `'wasm-unsafe-eval'`。
    - `worker-src`: 加入 `blob:`（允许 Worker 加载）及 `'wasm-unsafe-eval'`。
    - `connect-src`: 加入 `blob:` 和 `data:`（处理数据流）。

---

## 3. 发布与安全 (Publishing & Security)

### 问题：`vsce` 报错拒绝包含 `.env` 文件
- **原因**：为了防止开发者误将敏感 Token（如 Open VSX Token）打包发布，`vsce` 默认会拦截。
- **解决方案**：
  - 更新 `.vscodeignore`，将 `.env` 显式隔离。
  - 创建 `.env.example` 作为公共模板。

---

## 4. 开发调试技能 (Dev Tips)

### 在无图形界面的服务器上运行 Web 测试
- **命令**：`npx @vscode/test-web --extensionDevelopmentPath=. --headless`
- **注意**：必须使用 `--headless`，否则 Playwright 会因为找不到 X Server 而启动失败。

---

> **项目状态**：目前 `Modern PDF Preview (WASM)` 已完美支持桌面版与 Web 版，具备工业级的稳定性和安全性。

---

## 5. 2026 技术重构记录 (Refactoring Logs)

### 问题：`Buffer is not defined` (Web Extension Environment)
- **现象**：在 VS Code Web (Worker) 环境运行时，控制台报错 `Buffer is not defined`。
- **原因**：`src/api.js` 使用了 Node.js 原生 `Buffer` 进行 Base64 转换，而 Web Worker 环境下没有该 Polyfill。
- **解决方案**：
  - 改用同构 (Isomorphic) 写法：
  - 优先检测 `globalThis.btoa` (Web Worker 标准)。
  - 降级检测 `window.btoa` (老旧浏览器)。
  - 最后回退到 `Buffer.from` (Node environment)。

### 问题：冗余依赖 `jszip`
- **现象**：`src/api.js` 仅仅为了将 `Uint8Array` 转为 Base64 而引入了整个 `jszip` 库。
- **原因**：历史代码遗留，导致插件体积膨胀 (~100KB)。
- **解决方案**：移除 `jszip`，使用上述的原生 Base64 转换方案。插件体积缩减至 ~4KB。

### 问题：`embed-pdf-viewer` API 误用
- **现象**：前端 `media/editor.js` 尝试通过直接修改 `viewer.config` 属性来切换主题或文档。
- **原因**：未能遵循组件文档，`config` 属性通常只用于初始化，不支持响应式更新。
- **解决方案**：
  - 切换主题：使用 `viewer.setTheme()`。
  - 切换文档：使用 `DocumentManagerPlugin.openDocumentUrl()`。
  - **健壮性**：增加了 Fallback 机制，若无法访问插件类，则回退到销毁并重建 Viewer 实例。
