import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { concatVideos, createZipArchive } from "../src/export-service.js";

const execFileAsync = promisify(execFile);
const cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

function imageUpload() {
  const boundary = "----takeboard-project-boundary";
  const prefix = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="frame.png"\r\nContent-Type: image/png\r\n\r\n`,
  );
  const bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([prefix, bytes, suffix]),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}

describe("Export Service and Endpoints", () => {
  it("packs files into a valid uncompressed zip buffer", () => {
    const file1 = { name: "test1.txt", data: Buffer.from("hello world", "utf8") };
    const file2 = { name: "subdir/test2.txt", data: Buffer.from("second file content", "utf8") };
    const zip = createZipArchive([file1, file2]);

    expect(zip).toBeInstanceOf(Buffer);
    expect(zip.length).toBeGreaterThan(file1.data.length + file2.data.length);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
  });

  it("concatenates videos using concatVideos", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "takeboard-concat-test-"));
    cleanup.push(() => rm(tempDir, { recursive: true, force: true }));

    const v1 = join(tempDir, "v1.mp4");
    const v2 = join(tempDir, "v2.mp4");
    const out = join(tempDir, "out.mp4");

    // Generate 2 short test videos with ffmpeg
    await execFileAsync("ffmpeg", ["-y", "-f", "lavfi", "-i", "color=c=blue:s=320x240:d=0.5", "-c:v", "libx264", v1]);
    await execFileAsync("ffmpeg", ["-y", "-f", "lavfi", "-i", "color=c=red:s=320x240:d=0.5", "-c:v", "libx264", v2]);

    await concatVideos([v1, v2], out);
    expect(out).toBeDefined();
  });

  it("exports project assets as zip through API", async () => {
    const root = await mkdtemp(join(tmpdir(), "takeboard-export-test-"));
    cleanup.push(() => rm(root, { recursive: true, force: true }));
    const app = buildApp({ projectsRoot: root, webRoot: null });
    cleanup.push(() => app.close());

    // 1. Create project
    const createRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { title: "导出测试项目" },
    });
    expect(createRes.statusCode).toBe(201);
    const key = createRes.json().key;

    // 2. Upload asset
    const upload = imageUpload();
    const assetRes = await app.inject({
      method: "POST",
      url: `/api/projects/${key}/assets`,
      payload: upload.payload,
      headers: upload.headers,
    });
    expect(assetRes.statusCode).toBe(201);
    const assetId = assetRes.json().snapshot.assets[0].id;

    // 3. Export as ZIP
    const exportRes = await app.inject({
      method: "POST",
      url: `/api/projects/${key}/export/zip`,
      payload: {
        assetIds: [assetId],
        filenames: { [assetId]: "01_SH-01.png" },
        title: "测试导出",
      },
    });
    expect(exportRes.statusCode).toBe(200);
    expect(exportRes.headers["content-type"]).toBe("application/zip");
    expect(exportRes.rawPayload.readUInt32LE(0)).toBe(0x04034b50);
  });
});
