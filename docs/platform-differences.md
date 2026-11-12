# YoYoTV 三端差异总表

> 维护规则：以后新增平台差异先改本表再改代码。代码、流水线与文档凡涉及三端差异事实，一律以本表为唯一事实源并引用本表。
> 依据口径：依据《三端规范-通用复用版》条 8 规定之最低集，基于代码库静态核查与运行时契约建立，已全部核验代码与构建配置消除「待核实」状态。

## 一、三端差异维度总表

| 维度 | Windows | macOS | Linux |
|---|---|---|---|
| **架构口径（正式通道）** | x64（ARM64 仅在预览通道提供） | x86_64 与 arm64 双架构分包（非通用二进制，见注 1） | x64 缺位（正式发布流水线未覆盖，仅在预览通道提供，见件二降级申报） |
| **外部命名（构建目标）** | 正式：`x86_64-pc-windows-msvc`<br>预览：`x86_64-pc-windows-msvc`、`aarch64-pc-windows-msvc` | 正式与预览：`x86_64-apple-darwin`、`aarch64-apple-darwin` | 预览：`x86_64-unknown-linux-gnu`（x64）、`aarch64-unknown-linux-gnu`（arm64） |
| **应用标识** | `app.takeboard.desktop`（三端同一标识，ADR-012 登记长期保留） | `app.takeboard.desktop`（同左） | `app.takeboard.desktop`（同左） |
| **本地数据目录名** | `TakeBoardData`（ADR-012 登记；由 Tauri `app.path().home_dir()` 推导，全路径为 `%USERPROFILE%\TakeBoardData`，如 `C:\Users\<user>\TakeBoardData`） | `TakeBoardData`（ADR-012 登记；由 Tauri `app.path().home_dir()` 推导，全路径为 `$HOME/TakeBoardData`，即 `~/TakeBoardData`） | `TakeBoardData`（ADR-012 登记；由 Tauri `app.path().home_dir()` 推导，全路径为 `$HOME/TakeBoardData`，即 `~/TakeBoardData`） |
| **配置目录** | 服务端数据根：项目根下 `.yoyotv-data`（环境变量 `YOYOTV_DATA_ROOT` / `TAKEBOARD_DATA_ROOT` 覆盖，桌面端启动时显式注入为上述 `TakeBoardData`）<br>桌面端偏好落点：由 Tauri `app.path().app_config_dir()` 推导为 `%APPDATA%\app.takeboard.desktop`（存储 `remote-connections.json` 与 `update-check.json`）<br>命令行状态目录：`%LOCALAPPDATA%\TakeBoard` | 服务端数据根：项目根下 `.yoyotv-data`（环境变量覆盖，桌面端启动注入同左）<br>桌面端偏好落点：`~/Library/Application Support/app.takeboard.desktop`<br>命令行状态目录：`$XDG_STATE_HOME/takeboard` 或 `~/.local/state/takeboard` | 服务端数据根：项目根下 `.yoyotv-data`（环境变量覆盖，桌面端启动注入同左）<br>桌面端偏好落点：`$XDG_CONFIG_HOME/app.takeboard.desktop` 或 `~/.config/app.takeboard.desktop`<br>命令行状态目录：`$XDG_STATE_HOME/takeboard` 或 `~/.local/state/takeboard` |
| **可执行文件名** | 主程序：`takeboard-desktop.exe`<br>Sidecar 内置运行时：构建时 `takeboard-node-x86_64-pc-windows-msvc.exe`，安装包解压后为 `takeboard-node.exe` | 主程序：`takeboard-desktop`（位于 `YoYoTV.app/Contents/MacOS/takeboard-desktop`）<br>Sidecar：打包后位于 `YoYoTV.app/Contents/MacOS/takeboard-node` | 主程序：`takeboard-desktop`（安装后位于 `/usr/bin/takeboard-desktop`）<br>Sidecar：安装后位于 `/usr/lib/takeboard-desktop/takeboard-node` |
| **打开文件夹/文件** | 打开文件夹：`explorer.exe`（`apps/desktop/src-tauri/src/local_files.rs:296`）<br>打开外部 URL：`open::that_detached` | 打开文件夹：`open`（同一文件 `local_files.rs:294` 实现）<br>打开外部 URL：`open::that_detached` | 打开文件夹：`xdg-open`（同一文件 `local_files.rs:298` 实现）<br>打开外部 URL：`open::that_detached` |
| **结束进程方式** | ComfyUI 进程：`taskkill.exe /PID <pid> /T /F`（`apps/server/src/comfy-launcher.ts:77`）<br>桌面端子进程：跨端统一经 stdin 写入 `takeboard.launcher.shutdown\n` 优雅停机，28 秒超时后调 Tauri kill 强杀（Windows 底层为 `TerminateProcess`） | ComfyUI 进程：优先向负 PID 发送信号杀进程组 `process.kill(-pid, "SIGTERM")`，失败退化为进程自身 `process.kill(pid, "SIGTERM")`（`comfy-launcher.ts:84-91`）<br>桌面端子进程：跨端统一经 stdin 优雅停机，28 秒超时后调 Tauri kill 强杀（Unix 底层为 `SIGKILL`） | ComfyUI 进程：与 macOS 相同，优先负 PID 杀进程组 `process.kill(-pid, "SIGTERM")`，失败退化为单进程终止 `process.kill(pid, "SIGTERM")`<br>桌面端子进程：同 macOS，优雅停机超时后调 Tauri kill 强杀 |
| **脚本格式** | 批处理：`START-YOYO.cmd`（简易启动）、`CONNECT-REMOTE.cmd`（远程连接） | 终端可执行脚本：`START-YOYO.command`、`CONNECT-REMOTE.command` | Shell 脚本：`scripts/install-service.sh`、`scripts/install-comfy-bridge.sh`；服务以 systemd user unit 守护运行（`deploy/systemd/yoyotv.service.in`、`deploy/systemd/yoyotv-comfy.service`） |
| **路径分隔语义** | 反斜杠 `\`；代码内一律通过 `std::path::PathBuf`（Rust）或 `node:path` / `path.resolve` / `path.join`（TS）拼接，杜绝硬编码斜杠（遵从规范条 9） | 正斜杠 `/`；代码内一律通过标准库路径方法拼接 | 正斜杠 `/`；代码内一律通过标准库路径方法拼接 |
| **渲染引擎** | Microsoft Edge WebView2（系统自带或由 Evergreen Bootstrapper 引导安装；若系统彻底缺失且无网络安装能力，Tauri 会弹出 Windows 原生错误弹窗提示安装 Microsoft Edge WebView2 Runtime） | Apple WebKit / WKWebView（macOS 系统内置，开箱即用，无需额外依赖） | WebKitGTK（系统依赖：`libwebkit2gtk-4.1-0`；若缺失动态链接库，启动报 `error while loading shared libraries: libwebkit2gtk-4.1.so.0`；由 deb 包依赖自动声明拉取，手动运行时需 `apt install libwebkit2gtk-4.1-dev`） |
| **文件系统语义** | 文件占用敏感（文件处于打开读写状态时删除或重命名报 `EBUSY`/`EPERM`，写盘采用临时文件原子替换与重试机制）；路径大小写不敏感（代码一律按最严端 Linux 规则编写，遵守条 10） | 大小写默认不敏感（APFS/HFS+ 默认行为）；无强制文件占用锁 | 大小写严格敏感（ext4 等）；无强制文件占用锁（全仓代码、import 与静态资源大小写必须严格匹配） |
| **窗口形态** | Tauri 默认原生窗口（Windows 10/11 原生亚克力与窗体控制按钮），初始尺寸 1440x900，最小尺寸 920x620，`create: false`，setup 就绪后 `window.show()`（`apps/desktop/src-tauri/src/main.rs:369`） | Tauri 默认原生窗口（macOS 原生左侧红绿灯交通灯按钮与原生标题栏），初始尺寸 1440x900，最小尺寸 920x620，`create: false`，setup 就绪后 `window.show()` | Tauri 默认原生窗口（GTK 桌面环境原生窗体装饰），初始尺寸 1440x900，最小尺寸 920x620，`create: false`，setup 就绪后 `window.show()` |
| **安装包型** | NSIS 安装包（`.exe`，正式发布通道与预览通道均使用） | DMG 磁盘映像（`.dmg`，内含 `YoYoTV.app`，正式发布通道与预览通道均使用） | DEB 软件包（`.deb`，由 `.github/workflows/desktop-preview.yml` 构建，配置 `bundles: "deb"`，目前仅在预览通道提供；未提供 AppImage/RPM） |
| **签名与公证** | Authenticode 代码签名（正式流水线基于 Azure Artifact Signing 对主程序 `takeboard-desktop.exe`、sidecar `takeboard-node.exe` 以及最终 NSIS 安装包执行双阶段签名与时间戳验证） | Developer ID Application 代码签名＋Notarization 公证＋Stapling 票据装订（正式流水线配置 Hardened Runtime 与 `entitlements.plist`） | 无操作系统级证书代码签名机制（随 deb 分发，流水线附带 GitHub Artifact Attestation 构建来源证明供 `gh attestation verify` 验证） |
| **构建通道** | 正式通道（Signed production release，仅覆盖 x64）＋ 预览通道（desktop-preview，覆盖 x64 与 arm64） | 正式通道（Signed production release，覆盖 x86_64 与 arm64 双架构）＋ 预览通道（desktop-preview，覆盖双架构） | 仅 desktop-preview 预览通道（正式发布流水线 `production-release.yml` 缺位） |

---

## 二、代码事实与依据索引

1. **构建目标与包型**:
   - `.github/workflows/production-release.yml`: 正式流水线仅包含 `x86_64-apple-darwin`、`aarch64-apple-darwin` 与 `x86_64-pc-windows-msvc`。
   - `.github/workflows/desktop-preview.yml`: 预览流水线覆盖 6 平台，Linux target 为 `x86_64-unknown-linux-gnu` 与 `aarch64-unknown-linux-gnu`，包型为 `deb`。
   - `scripts/prepare-desktop-runtime.mjs`: `triples` 对象映射平台至 Rust target triple。
2. **应用标识与数据目录**:
   - `apps/desktop/src-tauri/tauri.conf.json`: `"identifier": "app.takeboard.desktop"`。
   - `apps/desktop/src-tauri/src/main.rs`: `app.path().home_dir()?.join("TakeBoardData")`。
   - `docs/decisions.md` (ADR-012): 长期保留 `app.takeboard.desktop`、`TakeBoardData` 与 `takeboard-desktop://`。
3. **配置与偏好目录**:
   - `apps/desktop/src-tauri/src/connections.rs` / `updates.rs`: `app.path().app_config_dir()`。
   - `apps/server/src/app.ts`: 默认 `.yoyotv-data`。
   - `scripts/yoyotv-easy.mjs`: `LOCALAPPDATA/TakeBoard` 或 `XDG_STATE_HOME/takeboard`。
4. **可执行文件与进程终止**:
   - `apps/desktop/src-tauri/Cargo.toml`: package name `takeboard-desktop`。
   - `apps/server/src/comfy-launcher.ts`: Windows 使用 `taskkill.exe /PID <pid> /T /F`，非 Windows 使用 `process.kill(-pid, "SIGTERM")`。
   - `apps/desktop/src-tauri/src/main.rs`: `stop_server` 优雅停机 28 秒超时后强杀。
5. **打开文件夹**:
   - `apps/desktop/src-tauri/src/local_files.rs`: `#[cfg(target_os = "macos")] Command::new("open")`，`#[cfg(target_os = "windows")] Command::new("explorer.exe")`，`#[cfg(all(unix, not(target_os = "macos")))] Command::new("xdg-open")`。
6. **项目默认路径单一来源**:
   - `apps/server/src/device-routes.ts`: `resolveSuggestedProjectsRoot` 依据规范条 7 统一推导并由 `/api/device` 下发，前端 `apps/web/src/project-location-picker.tsx` 直接使用该字段。

---

> 注 1：macOS 通用二进制（条 15）现状为 x86_64 与 arm64 双架构分包（签名与公证完整），暂未合并为 Universal 二进制，属于已知待立项优化项。
