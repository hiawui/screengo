# ScreenGo - Chrome屏幕录制扩展

一个功能强大的Chrome扩展，支持屏幕录制、区域选择和多格式导出。

## 功能特性

- 🎥 屏幕录制：支持整个屏幕、窗口或标签页录制
- 📐 区域选择：拖拽选择录制区域
- 🎵 音频录制：支持系统音频和麦克风
- 📦 多格式导出：支持WebM和MP4格式
- 🌍 多语言支持：英文、简体中文、繁体中文、西班牙语
- 🎨 现代化UI：使用React构建的简洁美观的控制面板

## 技术栈

- **React 18** - UI框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Chrome Extension Manifest V3**

## 开发

### 环境要求

- Node.js 20+ (推荐使用 nvm 管理版本)

### 使用 nvm 管理 Node.js 版本

如果已安装 nvm，在项目根目录运行：

```bash
# 使用项目指定的 Node.js 版本
nvm use

# 如果版本未安装，nvm 会提示安装命令
# 例如：nvm install 20
```

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

这会启动Vite的watch模式，自动重新构建。

### 构建

```bash
npm run build
```

构建产物在 `dist/` 目录。

### 打包

```bash
./package.sh
```

这会构建项目并创建zip文件。

## 项目结构

```
screengo/
├── src/
│   ├── components/        # React组件
│   │   └── ControlPanel.tsx
│   ├── hooks/            # React Hooks
│   │   └── useRecorder.ts
│   ├── services/         # 业务逻辑
│   │   ├── i18n.ts
│   │   ├── recorder.ts
│   │   └── selector.ts
│   ├── styles/           # 样式文件
│   │   └── content.css
│   ├── types/            # TypeScript类型
│   │   └── index.ts
│   ├── content.tsx       # Content script入口
│   └── background.ts     # Background script
├── _locales/             # 多语言资源
├── icons/                # 图标文件
├── manifest.json         # 扩展配置
├── vite.config.ts        # Vite配置
├── tsconfig.json         # TypeScript配置
└── package.json          # 项目配置
```

## 安装

1. 构建项目：`npm run build`
2. 打开Chrome浏览器，访问 `chrome://extensions/`
3. 启用"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `dist` 目录

## 使用说明

1. 访问任意网页
2. 点击扩展图标显示控制面板
3. 点击"选择区域"按钮，拖拽选择录制区域
4. 选择音频选项（系统音频/麦克风）
5. 选择导出格式（WebM/MP4）
6. 点击"开始录制"按钮
7. 录制完成后点击"停止录制"
8. 文件将自动下载

## 许可证

BSD 3-Clause License
