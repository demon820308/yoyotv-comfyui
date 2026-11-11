const KNOWN_ENV_KEYS = [
  "PORT",
  "HOST",
  "AUTH_MODE",
  "DATA_ROOT",
  "DEMO_DIRECTORY",
  "AUTH_DATABASE",
  "INSTANCE_ID",
  "INSTANCE_NAME",
  "PUBLIC_URL",
  "SECURE_COOKIES",
  "DESKTOP",
  "ALLOWED_HOSTS",
  "ALLOWED_ORIGINS",
  "ALLOW_NON_LOOPBACK",
  "WEB_ROOT",
  "BACKUP_DESTINATION",
  "BACKUP_INTERVAL_HOURS",
  "BACKUP_KEEP_LOCAL",
  "BACKUP_KEEP_DAILY",
  "BACKUP_KEEP_WEEKLY",
  "BACKUP_KEEP_MONTHLY",
  "BACKUP_DRILL_INTERVAL_DAYS",
  "TRUST_WORKFLOW_DIR",
  "CANVAS_LOAD_BUDGET_MS",
  "PROJECT_PACKAGE_MAX_BYTES",
  "GPU_POOL_CONFIG",
  "GPU_LANE",
  "MIN_FREE_DISK_GB",
  "ALLOW_INSECURE_REMOTE_WORKER",
  "REMOTE_PORT",
  "CONFIG_FILE",
  "REAL_GPU_TEST",
  "REAL_LIFECYCLE_TEST",
];

export function syncProcessEnv(): void {
  for (const key of KNOWN_ENV_KEYS) {
    const val = process.env[`YOYOTV_${key}`];
    if (val !== undefined) {
      process.env[`YOYOTV_${key}`] = val;
    }
  }
}

export function getEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[`YOYOTV_${key}`] ?? defaultValue;
}

syncProcessEnv();
