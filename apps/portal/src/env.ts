const PORTAL_ENV_KEYS = [
  "PORT",
  "BIND_HOST",
  "HOSTNAME",
  "ORIGIN",
  "DATABASE",
  "WEB_ROOT",
  "SECURE_COOKIES",
  "ALLOW_REGISTRATION",
  "AUDIT_RETENTION_DAYS",
  "MASTER_KEY",
  "BOOTSTRAP_TOKEN",
];

export function syncPortalEnv(): void {
  for (const key of PORTAL_ENV_KEYS) {
    const yoyoVal = process.env[`YOYOTV_PORTAL_${key}`];
    const takeboardVal = process.env[`TAKEBOARD_PORTAL_${key}`];
    const val = yoyoVal ?? takeboardVal;
    if (val !== undefined) {
      process.env[`YOYOTV_PORTAL_${key}`] = val;
      process.env[`TAKEBOARD_PORTAL_${key}`] = val;
    }
  }
}

export function getPortalEnv(key: string, defaultValue?: string): string | undefined {
  return (
    process.env[`YOYOTV_PORTAL_${key}`] ?? process.env[`TAKEBOARD_PORTAL_${key}`] ?? defaultValue
  );
}

syncPortalEnv();
