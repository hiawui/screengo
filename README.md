# ScreenGo - Chrome 屏幕录制扩展

ScreenGo 是一个功能强大的 Chrome 浏览器扩展，支持全屏、窗口及标签页录制，并提供高性能的区域裁剪功能。它基于现代 Web 技术栈构建，界面简洁美观，使用体验流畅。

## ✨ 主要特性

- **🎥 多模式录制**：支持录制整个屏幕、特定应用窗口或 Chrome 标签页。
- **📐 高性能区域裁剪**：使用 `OffscreenCanvas` 和 `WebCodecs` API 实现的零延迟区域裁剪。
- **🎵 音频支持**：可同时录制系统音频和麦克风声音（支持回声消除和降噪）。
- **💾 导出格式**：支持导出为 WebM 或 MP4 格式 (内置 FFmpeg 转码)。
- **✂️ 视频剪辑**：录制完成后提供视频预览，支持快速裁剪视频长度。
- **🌍 多语言支持**：内置英文、简体中文、繁体中文、西班牙语支持，自动跟随系统语言。
- **🎨 现代化 UI**：基于 React 18 构建的响应式控制面板，支持拖拽移动。
- **⏱️ 实用工具**：包含录制倒计时、实时时长显示、状态指示器。

## 🛠️ 技术栈

- **UI 框架**: [React 18](https://react.dev/)
- **构建工具**: [Vite 5](https://vitejs.dev/)
- **语言**: [TypeScript](https://www.typescriptlang.org/)
- **扩展规范**: Chrome Extension Manifest V3
- **核心 API**:
  - `desktopCapture`: 屏幕捕获
  - `MediaRecorder`: 媒体流录制
  - `OffscreenCanvas`: 离屏渲染
  - `MediaStreamTrackProcessor/Generator`: 视频流处理
  - `FFmpeg.wasm`: 浏览器端视频转码与剪辑

## 🚀 安装说明

1. **下载构建产物**
   - 克隆本项目并构建（见下文开发指南）。
   - 或者下载最新的发布包解压。

2. **加载到 Chrome**
   - 打开 Chrome 浏览器，访问 `chrome://extensions/`。
   - 打开右上角的 **"开发者模式"** 开关。
   - 点击左上角的 **"加载已解压的扩展程序"**。
   - 选择项目中的 `dist` 目录。

## 📖 使用指南

1. **启动录制**
   - 点击浏览器工具栏中的 ScreenGo 图标，打开控制面板。
   - (可选) 点击 **"选择区域"** 按钮，在屏幕上拖拽选择要录制的特定区域。
   - (可选) 勾选 **"系统音频"** 或 **"麦克风"**。
   - 点击 **"开始录制"**。

2. **录制控制**
   - 录制过程中，你可以随时点击控制面板上的 **"暂停"** / **"继续"** 按钮。
   - 拖拽控制面板标题栏可将其移动到不遮挡视线的位置。

3. **结束与保存**
   - 点击 **"停止录制"** 按钮。
   - 录制结束后会自动打开预览页面。
   - 在预览页面中，你可以播放视频、拖动滑块裁剪视频长度。
   - 点击 **"下载 WebM"** 或 **"导出 MP4"** 保存文件。

## 💻 开发指南

### 环境要求
- Node.js 20+ (推荐使用 nvm)
- npm 10+

### 常用命令

```bash
# 安装依赖
npm install

# 启动开发模式 (支持热更新)
npm run dev

# 构建生产版本
npm run build

# 打包扩展 (生成 .zip 文件，自动同步版本号)
npm run package

# 仅打包不生成 zip
npm run package:no-zip
```

### 项目结构

```
screengo/
├── src/
│   ├── components/     # React UI 组件 (控制面板等)
│   ├── services/       # 核心业务逻辑
│   │   ├── recorder.ts # 录制与流处理逻辑
│   │   ├── selector.ts # 区域选择与 Overlay 逻辑
│   │   └── i18n.ts     # 国际化服务
│   ├── hooks/          # React Hooks
│   ├── background.ts   # Service Worker
│   └── content.tsx     # Content Script 入口
├── _locales/           # 多语言资源文件
├── scripts/            # 自动化脚本 (如打包脚本)
├── public/             # 静态资源
└── dist/               # 构建输出目录
```

## 🔒 权限说明

本扩展仅申请实现功能所必需的权限：

- `desktopCapture`:用于捕获屏幕画面。
- `activeTab`: 用于在当前标签页注入控制面板。
- `storage`: 用于保存用户偏好设置（如语言选择）。
- `downloads`: 用于将录制好的视频文件保存到本地。

## 📄 许可证

[BSD 3-Clause License](LICENSE)
