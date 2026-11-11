import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function crc32(buffer: Buffer): number {
  let crc = ~0;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i]!;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return ~crc >>> 0;
}

export type ZipEntry = {
  name: string;
  data: Buffer;
};

/** Build an uncompressed (Store, method 0) standard ZIP buffer without external dependencies. */
export function createZipArchive(entries: readonly ZipEntry[]): Buffer {
  const parts: Buffer[] = [];
  const records: Array<{ nameBuf: Buffer; crc: number; size: number; offset: number }> = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const dataBuf = entry.data;
    const crc = crc32(dataBuf);
    const size = dataBuf.length;

    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // Local file header signature
    localHeader.writeUInt16LE(20, 4); // Min version (2.0)
    localHeader.writeUInt16LE(0x0800, 6); // Flags: UTF-8 encoding
    localHeader.writeUInt16LE(0, 8); // Compression: Store (0)
    localHeader.writeUInt16LE(0, 10); // Last mod file time
    localHeader.writeUInt16LE(0, 12); // Last mod file date
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(size, 18); // Compressed size
    localHeader.writeUInt32LE(size, 22); // Uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // Extra field length
    nameBuf.copy(localHeader, 30);

    parts.push(localHeader, dataBuf);
    records.push({ nameBuf, crc, size, offset });
    offset += localHeader.length + dataBuf.length;
  }

  const centralStart = offset;
  for (const rec of records) {
    const cd = Buffer.alloc(46 + rec.nameBuf.length);
    cd.writeUInt32LE(0x02014b50, 0); // Central directory header signature
    cd.writeUInt16LE(20, 4); // Version made by
    cd.writeUInt16LE(20, 6); // Min version to extract
    cd.writeUInt16LE(0x0800, 8); // Flags: UTF-8
    cd.writeUInt16LE(0, 10); // Compression method: 0
    cd.writeUInt16LE(0, 12); // Last mod time
    cd.writeUInt16LE(0, 14); // Last mod date
    cd.writeUInt32LE(rec.crc, 16);
    cd.writeUInt32LE(rec.size, 20);
    cd.writeUInt32LE(rec.size, 24);
    cd.writeUInt16LE(rec.nameBuf.length, 28);
    cd.writeUInt16LE(0, 30); // Extra field length
    cd.writeUInt16LE(0, 32); // File comment length
    cd.writeUInt16LE(0, 34); // Disk number
    cd.writeUInt16LE(0, 36); // Internal file attributes
    cd.writeUInt32LE(0, 38); // External file attributes
    cd.writeUInt32LE(rec.offset, 42); // Relative offset of local header
    rec.nameBuf.copy(cd, 46);
    parts.push(cd);
    offset += cd.length;
  }

  const centralSize = offset - centralStart;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
  eocd.writeUInt16LE(0, 4); // Disk number
  eocd.writeUInt16LE(0, 6); // Start disk
  eocd.writeUInt16LE(records.length, 8); // Disk entries
  eocd.writeUInt16LE(records.length, 10); // Total entries
  eocd.writeUInt32LE(centralSize, 12); // Central directory size
  eocd.writeUInt32LE(centralStart, 16); // Central directory offset
  eocd.writeUInt16LE(0, 20); // Comment length
  parts.push(eocd);

  return Buffer.concat(parts);
}

function runFfmpeg(args: readonly string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      "ffmpeg",
      args as string[],
      { maxBuffer: 10 * 1024 * 1024 },
      (err, _stdout, stderr) => {
        if (err) {
          reject(new Error(stderr || err.message));
        } else {
          resolve();
        }
      },
    );
  });
}

/** Concatenate a list of video files using FFmpeg (stream-copy first, transcoding fallback). */
export async function concatVideos(
  filePaths: readonly string[],
  outputPath: string,
): Promise<void> {
  if (filePaths.length === 0) {
    throw new Error("No video files provided for concatenation");
  }
  const tempId = randomUUID();
  const listFile = join(tmpdir(), `takeboard_concat_${tempId}.txt`);
  const content = filePaths
    .map((filePath) => `file '${filePath.split("\\").join("/")}'`)
    .join("\n");
  await writeFile(listFile, content, "utf8");

  try {
    try {
      // Fast path: stream copy when codec and parameters match
      await runFfmpeg([
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listFile,
        "-c",
        "copy",
        outputPath,
      ]);
    } catch {
      // Fallback path: re-encode to ensure diverse resolutions/frame rates concatenate cleanly
      await runFfmpeg([
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listFile,
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        outputPath,
      ]);
    }
  } finally {
    await unlink(listFile).catch(() => {});
  }
}
