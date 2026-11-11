import {
  authModeFromEnvironment,
  buildApp,
  resolveDefaultProjectsRoot,
  yoyotvVersion,
} from "./app.js";
import { completionFor, hasUnfinishedWork } from "./background-completion.js";
import { getEnv, syncProcessEnv } from "./env.js";
import { acquireInstanceLease } from "./instance-lease.js";
import { assertSafeBindHost } from "./request-security.js";

syncProcessEnv();

// Match runtime-launcher: local device access stays login-free, accounts become available.
process.env.YOYOTV_AUTH_MODE ??= "optional";

const host = getEnv("HOST") ?? "127.0.0.1";
const port = Number.parseInt(getEnv("PORT") ?? "48120", 10);
assertSafeBindHost(host, getEnv("ALLOW_NON_LOOPBACK") === "1", authModeFromEnvironment());
const lease = acquireInstanceLease(resolveDefaultProjectsRoot());
process.env.YOYOTV_INSTANCE_ID = lease.instanceId;
process.once("exit", lease.release);
const app = (() => {
  try {
    return buildApp();
  } catch (error) {
    lease.release();
    throw error;
  }
})();
let shutdownPromise: Promise<void> | null = null;

function disconnectParent() {
  if (process.connected) process.disconnect();
}

function closeServer(reason: string) {
  shutdownPromise ??= (async () => {
    app.log.info({ reason }, "YoYoTV server is stopping");
    try {
      await app.close();
    } catch (error) {
      app.log.error(error, "YoYoTV server could not stop cleanly");
      process.exitCode = 1;
    } finally {
      lease.release();
      disconnectParent();
    }
  })();
  return shutdownPromise;
}
let completing: Promise<void> | null = null;
function shutdown(reason: string) {
  if (getEnv("DESKTOP") !== "1" || reason === "startup-failure") return closeServer(reason);
  // Acknowledge before scanning databases; the launcher must not escalate to SIGKILL.
  if (process.connected) {
    try {
      process.send?.({ type: "yoyotv.server.background" }, () => {});
      process.send?.({ type: "takeboard.server.background" }, () => {});
    } catch {
      /* parent already exited */
    }
  }
  completing ??= completionFor(app)
    .drain(
      () => hasUnfinishedWork(resolveDefaultProjectsRoot()),
      () => closeServer(reason),
    )
    .finally(() => {
      completing = null;
    });
  return completing;
}

const onControlMessage = (message: unknown) => {
  if (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    (message.type === "yoyotv.server.shutdown" || message.type === "takeboard.server.shutdown")
  ) {
    void shutdown("launcher");
  }
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.on("message", onControlMessage);
// Only a spawned/IPC-owned server follows its launcher. Standalone servers have
// no IPC parent, and a desktop that merely borrows a server never owns this channel.
if (process.connected) process.once("disconnect", () => void shutdown("launcher-disconnected"));

try {
  await app.listen({ host, port });
  const address = app.server.address();
  if (address && typeof address !== "string") lease.publish(address.port, yoyotvVersion);
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
  await shutdown("startup-failure");
}
