import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Load contracts and server helpers
const contractsPath = "K:/YoYo/Takeboard/packages/contracts/dist/snapshot.js";
const { projectSnapshotSchema } = await import(pathToFileURL(contractsPath).href);

const inspectionPath = "K:/YoYo/Takeboard/apps/server/dist/asset-inspection.js";
const { inspectVideo, inspectImage } = await import(pathToFileURL(inspectionPath).href);

const sqlitePath = "K:/YoYo/Takeboard/apps/server/node_modules/better-sqlite3/lib/index.js";
const { default: BetterSqlite3 } = await import(pathToFileURL(sqlitePath).href);

const comfyOutRoot = "K:/ComfyUi/ComfyUI/ComfyUI/output/takeboard";
const comfyInRoot = "K:/ComfyUi/ComfyUI/ComfyUI/input";
const destinationRoot = "K:/YoYo-Projects";
const instanceProjectsRoot = "K:/YoYo/Takeboard/apps/server/.takeboard-data/projects";

fs.mkdirSync(destinationRoot, { recursive: true });
fs.mkdirSync(path.join(instanceProjectsRoot, ".system"), { recursive: true });

function extractPromptIntent(pngPath) {
  try {
    const buf = fs.readFileSync(pngPath);
    let offset = 8;
    while (offset < buf.length) {
      const length = buf.readUInt32BE(offset);
      const type = buf.toString("ascii", offset + 4, offset + 8);
      if (type === "tEXt") {
        const textData = buf.subarray(offset + 8, offset + 8 + length);
        const nullIdx = textData.indexOf(0);
        const keyword = textData.subarray(0, nullIdx).toString("ascii");
        const text = textData.subarray(nullIdx + 1).toString("utf8");
        if (keyword === "prompt") {
          const json = JSON.parse(text);
          for (const [nid, node] of Object.entries(json)) {
            if (
              node.inputs &&
              typeof node.inputs.value === "string" &&
              node.inputs.value.length > 5
            ) {
              return node.inputs.value;
            }
          }
        }
      }
      offset += 12 + length;
    }
  } catch {}
  return "";
}

function computeSha256(filePath) {
  const hash = crypto.createHash("sha256");
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return { sha256: hash.digest("hex"), byteSize: data.length, buffer: data };
}

function initDatabase(dbPath, snapshot) {
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  const client = new BetterSqlite3(dbPath);
  client.pragma("foreign_keys = ON");
  client.pragma("journal_mode = WAL");
  client.pragma("busy_timeout = 5000");

  client.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    );
    CREATE TABLE project_state (
      project_id TEXT PRIMARY KEY NOT NULL,
      schema_version TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK (revision > 0),
      updated_at TEXT NOT NULL
    );
    CREATE TABLE event_log (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX event_log_project_sequence_idx ON event_log(project_id, sequence);
    CREATE TABLE command_log (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      command_type TEXT NOT NULL,
      request_id TEXT,
      request_json TEXT NOT NULL,
      inverse_json TEXT,
      result_json TEXT NOT NULL,
      effects_json TEXT NOT NULL,
      summary TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('applied', 'undone')),
      applied_revision INTEGER NOT NULL CHECK (applied_revision > 0),
      created_at TEXT NOT NULL,
      undone_at TEXT,
      undo_command_id TEXT
    );
    CREATE UNIQUE INDEX command_log_project_request_idx ON command_log(project_id, request_id) WHERE request_id IS NOT NULL;
    CREATE INDEX command_log_project_created_idx ON command_log(project_id, created_at DESC);
  `);

  const now = new Date().toISOString();
  client
    .prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)")
    .run("001_project_state", now);
  client
    .prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)")
    .run("002_command_log", now);

  const snapshotJson = JSON.stringify(snapshot, null, 2);
  client
    .prepare(`
    INSERT INTO project_state (project_id, schema_version, snapshot_json, revision, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `)
    .run(snapshot.project.id, snapshot.schemaVersion, snapshotJson, 1, snapshot.project.updatedAt);

  client
    .prepare(`
    INSERT INTO event_log (project_id, event_type, payload_json, created_at)
    VALUES (?, ?, ?, ?)
  `)
    .run(snapshot.project.id, "project.restored", JSON.stringify({ revision: 1 }), now);

  client.close();
}

const projectsConfig = [
  {
    projectId: "project_01a1c3ca-7b14-7d52-a711-042354ecded7",
    title: "一公升的眼泪-致敬精典",
    key: "mwa7o4cx-bc56b1b1.takeboard",
  },
  {
    projectId: "project_01a1ba12-ddc2-7d04-8061-3f2c7012cfd2",
    title: "香港武侠电影",
    key: "mw7h7ego-b9ff7c90.takeboard",
  },
];

for (const cfg of projectsConfig) {
  console.log(`\n========================================`);
  console.log(`Restoring project: ${cfg.title} (${cfg.key})`);
  console.log(`========================================`);

  const projectDir = path.join(destinationRoot, cfg.key);
  const sourceDir = path.join(comfyOutRoot, cfg.projectId);

  // Create standard directories
  for (const sub of [
    "assets/originals",
    "assets/proxies",
    "renders",
    "runs",
    "recipes",
    "logs",
    "exports",
    "backups",
    "trash",
  ]) {
    fs.mkdirSync(path.join(projectDir, sub), { recursive: true });
  }

  const nowIso = new Date().toISOString();
  const sceneId = `scene_${crypto.randomUUID()}`;

  const snapshot = {
    schemaVersion: "0.1.0",
    exportedAt: nowIso,
    project: {
      id: cfg.projectId,
      schemaVersion: "0.1.0",
      title: cfg.title,
      defaultAspectRatio: "16:9",
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    scenes: [
      {
        id: sceneId,
        projectId: cfg.projectId,
        label: "SC-01",
        title: "工作画板",
        order: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
    textItems: [],
    entities: [],
    assets: [],
    shots: [],
    runs: [],
    takes: [],
    approvals: [],
    canvasItems: [],
    canvasEdges: [],
  };

  // 1. Restore input reference assets from ComfyUI input folder
  const inputFiles = fs
    .readdirSync(comfyInRoot)
    .filter((f) => f.startsWith(`takeboard_${cfg.projectId}_`));
  const seenAssetIds = new Set();

  for (const file of inputFiles) {
    const match = file.match(
      /asset_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i,
    );
    if (!match) continue;
    const assetId = `asset_${match[1]}`;
    if (seenAssetIds.has(assetId)) continue;
    seenAssetIds.add(assetId);

    const ext = path.extname(file).toLowerCase();
    const srcPath = path.join(comfyInRoot, file);
    const destPath = path.join(projectDir, "assets", "originals", `${assetId}${ext}`);
    fs.copyFileSync(srcPath, destPath);

    const { sha256, byteSize, buffer } = computeSha256(destPath);
    let mimeType =
      ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : ext === ".webp"
          ? "image/webp"
          : "image/png";
    let imgInfo = null;
    try {
      imgInfo = inspectImage(buffer, mimeType);
    } catch {
      for (const alt of ["image/jpeg", "image/png", "image/webp"]) {
        try {
          imgInfo = inspectImage(buffer, alt);
          if (imgInfo) {
            mimeType = alt;
            break;
          }
        } catch {}
      }
    }

    snapshot.assets.push({
      id: assetId,
      projectId: cfg.projectId,
      mediaType: "image",
      originalName: `ref-${file.slice(0, 30)}${ext}`,
      mimeType,
      byteSize,
      sha256,
      storagePath: `assets/originals/${assetId}${ext}`,
      proxyPath: null,
      width: imgInfo?.width ?? 1280,
      height: imgInfo?.height ?? 720,
      customTags: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }
  console.log(`Restored ${seenAssetIds.size} reference input assets`);

  // 2. Scan shots and runs
  const shotDirs = fs
    .readdirSync(sourceDir)
    .filter((d) => fs.statSync(path.join(sourceDir, d)).isDirectory());
  // Sort shotDirs by directory mtime
  shotDirs.sort((a, b) => {
    return (
      fs.statSync(path.join(sourceDir, a)).mtimeMs - fs.statSync(path.join(sourceDir, b)).mtimeMs
    );
  });

  let firstValidCoverPath = null;

  shotDirs.forEach((shotDirName, shotIdx) => {
    const shotPath = path.join(sourceDir, shotDirName);
    const runDirs = fs
      .readdirSync(shotPath)
      .filter((d) => fs.statSync(path.join(shotPath, d)).isDirectory());
    runDirs.sort((a, b) => {
      return (
        fs.statSync(path.join(shotPath, a)).mtimeMs - fs.statSync(path.join(shotPath, b)).mtimeMs
      );
    });

    const shotId = shotDirName; // e.g. shot_01a1c3f5-8642-7e0f-aa4b-bc7d2c206fee
    let shotIntent = "";
    const shotTakes = [];

    runDirs.forEach((runDirName) => {
      const runPath = path.join(shotPath, runDirName);
      const files = fs.readdirSync(runPath);
      const runId = runDirName;

      // Extract intent if available
      const pngFile = files.find((f) => f.endsWith(".png"));
      if (pngFile && !shotIntent) {
        shotIntent = extractPromptIntent(path.join(runPath, pngFile));
      }
      if (pngFile && !firstValidCoverPath) {
        firstValidCoverPath = path.join(runPath, pngFile);
      }

      // Find primary video / image output
      const audioMp4 = files.find((f) => f.endsWith("-audio.mp4"));
      const normalMp4 = files.find((f) => f.endsWith(".mp4") && !f.endsWith("-audio.mp4"));
      const bestMedia = audioMp4 || normalMp4 || pngFile;

      if (!bestMedia) return;

      const mediaExt = path.extname(bestMedia).toLowerCase();
      const isVideo = mediaExt === ".mp4" || mediaExt === ".webm";
      const assetId = `asset_${crypto.randomUUID()}`;
      const takeId = `take_${crypto.randomUUID()}`;

      // Create target render directory
      const renderRelDir = `renders/${shotId}/${runId}`;
      fs.mkdirSync(path.join(projectDir, renderRelDir), { recursive: true });

      const destMediaFile = `${assetId}${mediaExt}`;
      const destFullPath = path.join(projectDir, renderRelDir, destMediaFile);
      fs.copyFileSync(path.join(runPath, bestMedia), destFullPath);

      // Also copy other files if present
      for (const f of files) {
        if (f !== bestMedia) {
          fs.copyFileSync(path.join(runPath, f), path.join(projectDir, renderRelDir, f));
        }
      }

      const { sha256, byteSize, buffer } = computeSha256(destFullPath);
      let mimeType = isVideo ? "video/mp4" : "image/png";
      let videoInfo = null;
      let imgInfo = null;
      if (isVideo) {
        try {
          videoInfo = inspectVideo(buffer, mimeType);
        } catch {}
      } else {
        try {
          imgInfo = inspectImage(buffer, mimeType);
        } catch {
          for (const alt of ["image/jpeg", "image/png", "image/webp"]) {
            try {
              imgInfo = inspectImage(buffer, alt);
              if (imgInfo) {
                mimeType = alt;
                break;
              }
            } catch {}
          }
        }
      }

      const asset = {
        id: assetId,
        projectId: cfg.projectId,
        mediaType: isVideo ? "video" : "image",
        originalName: bestMedia,
        mimeType,
        byteSize,
        sha256,
        storagePath: `${renderRelDir}/${destMediaFile}`,
        proxyPath: null,
        width: videoInfo?.width ?? imgInfo?.width ?? 1280,
        height: videoInfo?.height ?? imgInfo?.height ?? 720,
        durationSeconds: videoInfo?.durationSeconds ?? (isVideo ? 5 : null),
        frameRate: videoInfo?.frameRate ?? (isVideo ? 24 : null),
        customTags: [],
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      snapshot.assets.push(asset);

      const run = {
        id: runId,
        shotId,
        recipeId: `recipe_${crypto.randomUUID()}`,
        recipeVersion: "1.0.0",
        workflowSha256: "0".repeat(64),
        workerId: `worker_${crypto.randomUUID()}`,
        promptId: null,
        status: "completed",
        inputs: [],
        parameters: {},
        execution: null,
        estimatedCost: {
          amount: null,
          currency: "CNY",
          accuracy: "unknown",
          source: "unavailable",
          computeSeconds: null,
          unitRatePerHour: null,
          recordedAt: null,
        },
        actualCost: {
          amount: null,
          currency: "CNY",
          accuracy: "unknown",
          source: "unavailable",
          computeSeconds: null,
          unitRatePerHour: null,
          recordedAt: null,
        },
        errorCode: null,
        errorMessage: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      snapshot.runs.push(run);

      const take = {
        id: takeId,
        runId,
        shotId,
        assetId,
        status: "candidate",
        rejectionReasons: [],
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      shotTakes.push(take);
    });

    // Pick latest take as approved
    let approvedTake = null;
    if (shotTakes.length > 0) {
      approvedTake = shotTakes[shotTakes.length - 1];
      approvedTake.status = "approved";
      shotTakes.forEach((t) => snapshot.takes.push(t));

      const approval = {
        id: `approval_${crypto.randomUUID()}`,
        shotId,
        takeId: approvedTake.id,
        status: "active",
        reason: null,
        actorUserId: null,
        actorName: "系统自动恢复",
        createdAt: nowIso,
        revokedAt: null,
      };
      snapshot.approvals.push(approval);
    }

    const shot = {
      id: shotId,
      projectId: cfg.projectId,
      sceneId,
      label: `SH-${String(shotIdx + 1).padStart(2, "0")}`,
      order: shotIdx,
      intent: shotIntent || `镜头 ${shotIdx + 1}`,
      durationSeconds: 5,
      aspectRatio: "16:9",
      workflowPath: null,
      status: approvedTake ? "approved" : "draft",
      approvedTakeId: approvedTake ? approvedTake.id : null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    snapshot.shots.push(shot);

    const canvasItem = {
      id: `canvas_item_${crypto.randomUUID()}`,
      sceneId,
      refType: "shot",
      refId: shotId,
      x: 80 + (shotIdx % 4) * 360,
      y: 80 + Math.floor(shotIdx / 4) * 320,
      width: 320,
      height: 220,
      sizeMode: "auto",
      zIndex: shotIdx + 1,
      parentGroupId: null,
      collapsed: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    snapshot.canvasItems.push(canvasItem);
  });

  console.log(
    `Built snapshot: ${snapshot.shots.length} shots, ${snapshot.runs.length} runs, ${snapshot.assets.length} assets`,
  );

  // Validate snapshot against Zod schema
  console.log("Validating snapshot with projectSnapshotSchema...");
  const validated = projectSnapshotSchema.parse(snapshot);
  console.log("Validation passed successfully!");

  // Copy cover
  if (firstValidCoverPath) {
    fs.copyFileSync(firstValidCoverPath, path.join(projectDir, "cover.png"));
    console.log("Copied project cover.png");
  }

  // Write project.takeboard.json
  const jsonPath = path.join(projectDir, "project.takeboard.json");
  fs.writeFileSync(jsonPath, JSON.stringify(validated, null, 2) + "\n", "utf8");

  // Init SQLite database
  const dbPath = path.join(projectDir, "takeboard.db");
  initDatabase(dbPath, validated);
  console.log(`Initialized takeboard.db at ${dbPath}`);

  // Now create the location pointer in instance root
  const indexDir = path.join(instanceProjectsRoot, cfg.key);
  fs.mkdirSync(indexDir, { recursive: true });
  const locationMarker = {
    version: 1,
    path: projectDir,
    projectId: cfg.projectId,
    title: cfg.title,
    updatedAt: nowIso,
  };
  fs.writeFileSync(
    path.join(indexDir, ".takeboard-location.json"),
    JSON.stringify(locationMarker, null, 2),
    "utf8",
  );
  if (firstValidCoverPath) {
    fs.copyFileSync(firstValidCoverPath, path.join(indexDir, "cover.png"));
  }
  console.log(`Created location marker in instance index at ${indexDir}`);
}

// Update project-storage-roots.json
const nativeRoot = fs.realpathSync.native(destinationRoot);
const rootId = crypto.createHash("sha256").update(nativeRoot).digest("hex").slice(0, 24);
const rootsConfig = {
  version: 1,
  roots: [
    {
      id: rootId,
      name: "YoYo Projects (K:\\YoYo-Projects)",
      path: nativeRoot,
    },
  ],
};

const rootsConfigFile = path.join(instanceProjectsRoot, ".system", "project-storage-roots.json");
fs.writeFileSync(rootsConfigFile, JSON.stringify(rootsConfig, null, 2), "utf8");
console.log(`Registered storage root in ${rootsConfigFile}`);
console.log("\nAll projects restored successfully to K:\\YoYo-Projects!");
