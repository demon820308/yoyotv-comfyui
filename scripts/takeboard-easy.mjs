#!/usr/bin/env node
// shortcut: legacy ./scripts/takeboard-easy.mjs entry point is deprecated and will be removed in v2.0.0
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const child = spawn(process.execPath, [join(dir, "yoyotv-easy.mjs"), ...process.argv.slice(2)], {
  stdio: "inherit",
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
