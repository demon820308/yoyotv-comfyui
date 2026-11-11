import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPortal } from "./app.js";
import { getPortalEnv, syncPortalEnv } from "./env.js";

syncPortalEnv();

const port = Number.parseInt(getPortalEnv("PORT") ?? "49200", 10);
const host = getPortalEnv("BIND_HOST") ?? "127.0.0.1";
const hostname = getPortalEnv("HOSTNAME") ?? "localhost";
const publicOrigin = getPortalEnv("ORIGIN") ?? `http://${hostname}:${port}`;
const moduleRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const masterKey = getPortalEnv("MASTER_KEY");
const bootstrapToken = getPortalEnv("BOOTSTRAP_TOKEN");
const webRootEnv = getPortalEnv("WEB_ROOT");
const app = buildPortal({
  databasePath: resolve(getPortalEnv("DATABASE") ?? ".yoyotv-portal/portal.db"),
  hostname,
  publicOrigin,
  webRoot: webRootEnv ? resolve(webRootEnv) : resolve(moduleRoot, "ui"),
  secureCookies:
    getPortalEnv("SECURE_COOKIES") === "1" || new URL(publicOrigin).protocol === "https:",
  allowRegistration: getPortalEnv("ALLOW_REGISTRATION") === "1",
  auditRetentionDays: Number.parseInt(getPortalEnv("AUDIT_RETENTION_DAYS") ?? "180", 10),
  ...(masterKey ? { masterKey } : {}),
  ...(bootstrapToken ? { bootstrapToken } : {}),
});

try {
  await app.listen({ host, port });
  let closing = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (closing) return;
    closing = true;
    app.log.info({ signal }, "closing YoYoTV Portal");
    const forcedExit = setTimeout(() => {
      app.log.error("Portal did not close within 15 seconds");
      process.exit(1);
    }, 15_000);
    forcedExit.unref();
    try {
      await app.close();
      clearTimeout(forcedExit);
    } catch (error) {
      app.log.error(error, "Portal shutdown failed");
      process.exitCode = 1;
    }
  };
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
  await app.close();
}
