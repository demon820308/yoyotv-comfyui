# YoYoTV ComfyUI (YoYo)

<p align="right">简体中文 · <a href="README.en.md">English</a></p>

**把 AI 图像与视频创作，装进同一张无限分镜画布。**

**YoYo** 是一套专为影视与视觉创作者打造的开源 AI 创作画布与工作站，深度结合 **ComfyUI** 强大的生成后端。在统一的画布中自由排布分镜、管理素材资产、无缝串联多阶段生成，让日常 AI 视觉创作完全围绕连续的画面展开。

[![CI](https://github.com/demon820308/yoyotv-comfyui/actions/workflows/ci.yml/badge.svg)](https://github.com/demon820308/yoyotv-comfyui/actions/workflows/ci.yml) [![Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-315EFB.svg)](LICENSE)

---

## 🌟 核心特性

- 🎬 **无限分镜画布，连续多步创作**  
  在画布中自由放置参考图、视频与提示词卡片，生成节点之间可直接连线引用上一阶段的结果。无论是单帧探索、首尾帧过渡还是连续镜头分镜，创作过程一目了然。

- ⚡ **开箱即用的受信任工作流库 (Trust-Workflow)**  
  内置预设工作流与标准化参数映射，无需每次手动配置底层连线：
  - **YoYo Pika + MiniMax 二采**：高质量两阶段动态生成，兼顾动作灵动与画面细节。
  - **Z-Image Turbo / Krea2 Turbo / Qwen2.1**：高响应文生图与图生图模版。
  - **RealEsRGAN / RelayVSR**：集成专业级图片超分辨率放大与视频时序超分。
  - 支持直接导入用户自定义 Workflow / API Prompt JSON，自动校验依赖并建立持久化参数绑定。

- 📦 **资产与分镜导出中心 (Export Manager)**  
  支持一键打包导出分镜镜头、渲染资产、高码率视频合并（Concat）与工程归档 ZIP，方便快速对接剪辑调色软件。

- 🖥️ **本地优先与多端混合运行**  
  支持本地启动或一键连接远程 GPU 算力服务器，项目文件完全保存在创作者自己的设备上，生成结果自动回传，保护资产隐私，不依赖商业云端订阅。

- 🎨 **反模板化的视觉工程设计**  
  专为高阶内容创作者打磨的黑暗模式界面，清晰的显存与计算资源指示器、比例预设（16:9、9:16、2.39:1 等）、会话草稿与差异化比较。

---

## 🚀 快速开始

### 运行环境要求
- **Node.js**：`>= 22.12`
- **pnpm**：`>= 10.0`
- **ComfyUI**：本机运行或网络可访问的远程 ComfyUI 实例

### 1. 克隆与安装

```bash
git clone https://github.com/demon820308/yoyotv-comfyui.git
cd yoyotv-comfyui
pnpm install
```

### 2. 启动服务

**方法 A：一键脚本**
- Windows：双击运行 `START-YOYO.cmd`
- macOS / Linux：终端运行 `./START-YOYO.command`

**方法 B：开发调试**
```bash
# 同时启动后端服务与前端界面
pnpm dev
```
启动后在浏览器中访问：`http://127.0.0.1:48120`。

### 3. 连接 ComfyUI
1. 打开界面右上方 **设置中心 (Settings)**。
2. 填写 ComfyUI 运行地址（默认 `http://127.0.0.1:8188` 或填入远程 GPU 地址）。
3. 检查已加载的节点与模型，开始新建画布项目进行创作！

---

## 📁 目录结构

```text
├── apps/
│   ├── web/               # 前端分镜画布与交互界面 (React + Vite + Tailwind)
│   ├── server/            # 后端生成任务调度、受信任工作流与导出服务 (Fastify + TypeScript)
│   ├── desktop/           # 跨平台桌面端壳工程 (Tauri + Rust)
│   └── portal/            # 设备连接与身份网关
├── packages/
│   ├── contracts/         # 跨端协议与数据契约
│   ├── domain/            # 领域核心模型与校验规则
│   └── executor-comfy/    # ComfyUI API 转换器、执行协议与事件监听
├── Trust-Workflow/        # 内置受信任 ComfyUI 预设工作流与绑定快照
├── scripts/               # 构建、打包与便捷启动运维脚本
├── START-YOYO.cmd         # Windows 一键启动脚本
└── START-YOYO.command     # macOS/Linux 一键启动脚本
```

---

## 🛠️ 常用命令

```bash
# 构建所有工程
pnpm build

# 运行全套单元测试
pnpm test

# 代码检查与格式化
pnpm lint
pnpm format

# 远程算力服务器快速连接
node scripts/yoyotv-easy.mjs remote <host>
```

---

## 📄 开源许可证

本项目基于 [Apache-2.0](LICENSE) 许可证开源。所连接的各 ComfyUI 模型与第三方插件遵循其各自的开源协议。

<!-- release: https://github.com/demon820308/yoyotv-comfyui/releases/tag/v2.0.0 -->

