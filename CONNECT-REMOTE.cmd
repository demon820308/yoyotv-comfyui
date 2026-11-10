@echo off
chcp 65001 >nul
cd /d "%~dp0"
set YOYO_REMOTE_HOST=
set /p YOYO_REMOTE_HOST=请输入 SSH 主机名、IP 或 SSH 别名（直接回车连接上次服务器）：
node scripts\takeboard-easy.mjs remote "%YOYO_REMOTE_HOST%"
pause
