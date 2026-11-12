# YoYoTV ComfyUI (YoYo)

<p align="right">English · <a href="README.md">简体中文</a></p>

**One unified canvas for AI image and video filmmaking.**

**YoYo** is an open-source AI creation canvas and filmmaking workstation powered by **ComfyUI**. Organize storyboard nodes, manage reference assets, connect multi-step generations, and explore multiple directions side by side in an infinite workspace.

[![CI](https://github.com/demon820308/yoyotv-comfyui/actions/workflows/ci.yml/badge.svg)](https://github.com/demon820308/yoyotv-comfyui/actions/workflows/ci.yml) [![Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-315EFB.svg)](LICENSE)

---

## 🌟 Key Features

- 🎬 **Infinite Storyboard Canvas**  
  Freely place reference images, videos, and prompt cards. Connect output frames directly into downstream generation nodes. Iterate through shots and scenes with a clear visual hierarchy.

- ⚡ **Out-of-the-Box Trust-Workflow Library**  
  Pre-configured workflows and standardized parameter bindings eliminate tedious manual graph mapping:
  - **YoYo Pika + MiniMax 2-Pass**: High-quality two-stage video generation combining agile motion with rich facial and textural detail.
  - **Z-Image Turbo / Krea2 Turbo / Qwen2.1**: High-responsiveness text-to-image and image-to-image recipes.
  - **RealEsRGAN / RelayVSR**: Integrated image super-resolution and temporal video upscaling.
  - Import custom ComfyUI workflow/API JSON files with automated schema preflight, slot detection, and persistent parameter binding.

- 📦 **Asset & Clip Export Manager**  
  Export storyboard clips, high-bitrate video concatenations, project asset packages, and lossless project ZIP archives ready for editing suites (Premiere, DaVinci Resolve, Final Cut).

- 🖥️ **Local-First & Hybrid Computing**  
  Run ComfyUI locally or connect to a remote GPU server. Projects remain safely stored on your machine, with generation outputs fetched automatically. No subscription or cloud vendor lock-in.

- 🎨 **Refined Creator Workspace**  
  Designed for film and content creators: aspect ratio presets (16:9, 9:16, 2.39:1, etc.), live VRAM and worker monitoring, session drafts, and intuitive side-by-side comparison.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: `>= 22.12`
- **pnpm**: `>= 10.0`
- **ComfyUI**: Running locally or reachable over the network

### 1. Clone & Install

```bash
git clone https://github.com/demon820308/yoyotv-comfyui.git
cd yoyotv-comfyui
pnpm install
```

### 2. Launch

**Option A: 1-Click Launchers**
- Windows: Double-click `START-YOYO.cmd`
- macOS / Linux: Run `./START-YOYO.command`

**Option B: Development Mode**
```bash
# Start backend server and web frontend simultaneously
pnpm dev
```
Open `http://127.0.0.1:48120` in your browser.

### 3. Connect ComfyUI
1. Open **Settings** in the top-right corner.
2. Enter your ComfyUI address (e.g. `http://127.0.0.1:8188` or remote host).
3. Check the connected models and nodes, and start creating on your canvas!

---

## 📁 Repository Structure

```text
├── apps/
│   ├── web/               # Web storyboard canvas UI (React + Vite + Tailwind)
│   ├── server/            # Backend generation controller, Trust-Workflow & export engine (Fastify)
│   ├── desktop/           # Cross-platform desktop shell (Tauri + Rust)
│   └── portal/            # Remote pairing & connection gateway
├── packages/
│   ├── contracts/         # Shared schemas and data contracts
│   ├── domain/            # Domain models and validation logic
│   └── executor-comfy/    # ComfyUI prompt translation, execution engine & event listener
├── Trust-Workflow/        # Preset ComfyUI workflows and verified parameter bindings
├── scripts/               # Build, packaging, and launcher scripts
├── START-YOYO.cmd         # 1-click Windows starter
└── START-YOYO.command     # 1-click macOS/Linux starter
```

---

## 📄 License

Distributed under the [Apache-2.0](LICENSE) License. Connected ComfyUI models, nodes, and weights follow their respective licenses.

<!-- release: https://github.com/demon820308/yoyotv-comfyui/releases/tag/v2.0.0 -->

