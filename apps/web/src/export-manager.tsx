import type { Asset, ProjectSnapshot, Shot, Take } from "@takeboard/contracts";
import { useEffect, useMemo, useRef, useState } from "react";
import { projectApi } from "./api";
import { LayerBackdrop } from "./layer-backdrop";
import { VideoThumbnail } from "./video-preview";

export type ExportManagerProps = {
  snapshot: ProjectSnapshot;
  projectKey: string | null;
  onClose: () => void;
};

type ItemEntry = {
  asset: Asset;
  shot: Shot | null;
  take: Take | null;
  isApproved: boolean;
  suggestedFilename: string;
};

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ExportManager({ snapshot, projectKey, onClose }: ExportManagerProps) {
  const [tab, setTab] = useState<"video" | "image">("video");
  const [onlyApproved, setOnlyApproved] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [concatSequenceIds, setConcatSequenceIds] = useState<string[]>([]);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLElement>(null);

  // Map Takes and Shots for quick lookup
  const { takeMap, shotMap } = useMemo(() => {
    const tMap = new Map<string, Take>();
    for (const t of snapshot.takes) tMap.set(t.assetId, t);
    const sMap = new Map<string, Shot>();
    for (const s of snapshot.shots) sMap.set(s.id, s);
    return { takeMap: tMap, shotMap: sMap };
  }, [snapshot.takes, snapshot.shots]);

  // Build items categorized by media type
  const allEntries = useMemo<ItemEntry[]>(() => {
    return snapshot.assets
      .filter((asset) => asset.mediaType === "video" || asset.mediaType === "image")
      .map((asset) => {
        const take = takeMap.get(asset.id) ?? null;
        const shot = take ? (shotMap.get(take.shotId) ?? null) : null;
        const isApproved = Boolean(shot && shot.approvedTakeId === take?.id);
        const ext = asset.storagePath.includes(".")
          ? `.${asset.storagePath.split(".").pop()}`
          : asset.mediaType === "video"
            ? ".mp4"
            : ".png";
        let suggested = asset.originalName || `${asset.id}${ext}`;
        if (shot) {
          const prefix = String(shot.order + 1).padStart(2, "0");
          suggested = isApproved
            ? `${prefix}_${shot.label}${ext}`
            : `${prefix}_${shot.label}_take${ext}`;
        }
        return { asset, shot, take, isApproved, suggestedFilename: suggested };
      })
      .sort((a, b) => {
        if (a.isApproved !== b.isApproved) return a.isApproved ? -1 : 1;
        const orderA = a.shot ? a.shot.order : 999;
        const orderB = b.shot ? b.shot.order : 999;
        return orderA - orderB || a.asset.id.localeCompare(b.asset.id);
      });
  }, [snapshot.assets, takeMap, shotMap]);

  // Current tab filtered items
  const currentItems = useMemo(() => {
    return allEntries.filter((item) => {
      if (item.asset.mediaType !== tab) return false;
      if (onlyApproved && !item.isApproved) return false;
      return true;
    });
  }, [allEntries, tab, onlyApproved]);

  // Initialize selected IDs with approved items
  useEffect(() => {
    const approved = allEntries
      .filter((item) => item.asset.mediaType === tab && item.isApproved)
      .map((item) => item.asset.id);
    setSelectedIds(new Set(approved));
    if (tab === "video") {
      setConcatSequenceIds(approved);
    }
  }, [tab, allEntries]);

  // Toggle selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (tab === "video") {
          setConcatSequenceIds((seq) => seq.filter((itemId) => itemId !== id));
        }
      } else {
        next.add(id);
        if (tab === "video") {
          setConcatSequenceIds((seq) => (seq.includes(id) ? seq : [...seq, id]));
        }
      }
      return next;
    });
  };

  const selectAll = () => {
    const ids = currentItems.map((item) => item.asset.id);
    setSelectedIds(new Set(ids));
    if (tab === "video") {
      setConcatSequenceIds(ids);
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    if (tab === "video") {
      setConcatSequenceIds([]);
    }
  };

  // Move video order in concat sequence
  const moveVideo = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= concatSequenceIds.length) return;
    setConcatSequenceIds((prev) => {
      const next = [...prev];
      const temp = next[index]!;
      next[index] = next[target]!;
      next[target] = temp;
      return next;
    });
  };

  const removeVideoFromSequence = (id: string) => {
    setConcatSequenceIds((prev) => prev.filter((item) => item !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const resetToShotOrder = () => {
    const sorted = [...concatSequenceIds].sort((idA, idB) => {
      const itemA = allEntries.find((e) => e.asset.id === idA);
      const itemB = allEntries.find((e) => e.asset.id === idB);
      const orderA = itemA?.shot ? itemA.shot.order : 999;
      const orderB = itemB?.shot ? itemB.shot.order : 999;
      return orderA - orderB;
    });
    setConcatSequenceIds(sorted);
  };

  // Total duration of concat sequence
  const concatTotalDuration = useMemo(() => {
    let total = 0;
    for (const id of concatSequenceIds) {
      const entry = allEntries.find((e) => e.asset.id === id);
      if (entry?.asset.durationSeconds) {
        total += entry.asset.durationSeconds;
      } else if (entry?.shot?.durationSeconds) {
        total += entry.shot.durationSeconds;
      }
    }
    return total;
  }, [concatSequenceIds, allEntries]);

  // Export actions
  const handleExportZip = async () => {
    if (!projectKey || selectedIds.size === 0) return;
    setBusyMessage("正在将选中素材打包为 ZIP...");
    setErrorMessage(null);
    setStatusNotice(null);
    try {
      const assetIds = Array.from(selectedIds);
      const filenames: Record<string, string> = {};
      for (const id of assetIds) {
        const item = allEntries.find((e) => e.asset.id === id);
        if (item) filenames[id] = item.suggestedFilename;
      }
      const title = `${snapshot.project.title || "yoyotv"}_${tab === "video" ? "视频" : "图片"}`;
      const blob = await projectApi.exportZip(projectKey, assetIds, filenames, title);
      triggerBlobDownload(blob, `${title}_打包导出.zip`);
      setStatusNotice(`已成功打包并导出 ${assetIds.length} 个文件`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "打包导出失败");
    } finally {
      setBusyMessage(null);
    }
  };

  const handleConcatExport = async () => {
    if (!projectKey || concatSequenceIds.length === 0) return;
    setBusyMessage(`正在调用本地 FFmpeg 拼接 ${concatSequenceIds.length} 个视频...`);
    setErrorMessage(null);
    setStatusNotice(null);
    try {
      const title = `${snapshot.project.title || "yoyotv"}_成片`;
      const blob = await projectApi.exportConcat(projectKey, concatSequenceIds, title);
      triggerBlobDownload(blob, `${title}_拼接.mp4`);
      setStatusNotice(`视频拼接成功！已导出包含 ${concatSequenceIds.length} 个镜头的完整成片`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "视频拼接导出失败");
    } finally {
      setBusyMessage(null);
    }
  };

  // Keyboard escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <LayerBackdrop className="export-manager-backdrop" onClose={onClose}>
      <style>{`
        .export-dialog {
          position: relative;
          display: flex;
          flex-direction: column;
          width: min(1200px, 94vw);
          height: min(88vh, 860px);
          margin: auto;
          background: var(--surface-root, #0b0f0e);
          border: 1px solid var(--line, #24302c);
          border-radius: 14px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.6);
          color: var(--text-1, #e3eae7);
          overflow: hidden;
          z-index: 999;
        }
        .export-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          border-bottom: 1px solid var(--line, #24302c);
          background: color-mix(in srgb, var(--surface-2, #141b19) 40%, transparent);
        }
        .export-header h2 {
          margin: 0;
          font-size: calc(18px * var(--ui-scale, 1));
          font-weight: 650;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .export-header h2 span {
          font-size: calc(11px * var(--ui-scale, 1));
          font-weight: normal;
          color: var(--accent-strong, #3dd68c);
          padding: 2px 7px;
          border: 1px solid color-mix(in srgb, var(--accent, #2eb875) 40%, transparent);
          border-radius: 6px;
        }
        .export-tabs {
          display: flex;
          gap: 6px;
          background: var(--surface-2, #141b19);
          padding: 3px;
          border-radius: 8px;
          border: 1px solid var(--line, #24302c);
        }
        .export-tabs button {
          padding: 6px 16px;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: var(--text-2, #94a3a0);
          cursor: pointer;
          font-size: calc(12px * var(--ui-scale, 1));
          font-weight: 550;
          transition: all 0.15s ease;
        }
        .export-tabs button.active {
          background: var(--accent-strong, #3dd68c);
          color: #05140d;
          font-weight: 700;
        }
        .export-close {
          background: transparent;
          border: 0;
          color: var(--text-2, #94a3a0);
          font-size: 20px;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
        }
        .export-close:hover {
          color: var(--text-1, #fff);
          background: var(--surface-2, #141b19);
        }
        .export-body {
          display: grid;
          flex: 1;
          min-height: 0;
          grid-template-columns: ${tab === "video" ? "1fr minmax(320px, 380px)" : "1fr"};
          overflow: hidden;
        }
        .export-source-column {
          display: flex;
          flex-direction: column;
          min-height: 0;
          border-right: ${tab === "video" ? "1px solid var(--line, #24302c)" : "none"};
          overflow: hidden;
        }
        .export-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 20px;
          border-bottom: 1px solid var(--line, #24302c);
          background: color-mix(in srgb, var(--surface-root, #0b0f0e) 60%, transparent);
          font-size: calc(11px * var(--ui-scale, 1));
        }
        .export-toolbar-left, .export-toolbar-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .export-filter-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          color: var(--text-2, #94a3a0);
        }
        .export-filter-toggle input {
          cursor: pointer;
        }
        .export-grid {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
          gap: 14px;
          align-content: start;
        }
        .export-card {
          position: relative;
          display: flex;
          flex-direction: column;
          background: var(--surface-2, #141b19);
          border: 1px solid var(--line, #24302c);
          border-radius: 10px;
          overflow: hidden;
          transition: border-color 0.15s ease, transform 0.15s ease;
        }
        .export-card.selected {
          border-color: var(--accent-strong, #3dd68c);
          box-shadow: 0 0 0 1px var(--accent-strong, #3dd68c);
        }
        .export-card-media {
          position: relative;
          aspect-ratio: 16 / 9;
          background: #000;
          overflow: hidden;
        }
        .export-card-media :is(img, video) {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .export-card-checkbox {
          position: absolute;
          top: 8px;
          left: 8px;
          z-index: 2;
          width: 18px;
          height: 18px;
          accent-color: var(--accent-strong, #3dd68c);
          cursor: pointer;
        }
        .export-card-badge {
          position: absolute;
          top: 8px;
          right: 8px;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          color: var(--accent-strong, #3dd68c);
        }
        .export-card-badge.candidate {
          color: var(--text-2, #94a3a0);
        }
        .export-card-info {
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .export-card-title {
          font-weight: 600;
          font-size: calc(12px * var(--ui-scale, 1));
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .export-card-specs {
          font-size: 10px;
          color: var(--faint, #637571);
        }
        .export-card-actions {
          margin-top: 6px;
          display: flex;
          justify-content: flex-end;
        }
        .export-btn-single {
          background: color-mix(in srgb, var(--surface-root, #0b0f0e) 80%, transparent);
          border: 1px solid var(--line, #24302c);
          color: var(--text-2, #94a3a0);
          border-radius: 5px;
          padding: 3px 8px;
          font-size: 10px;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.15s ease;
        }
        .export-btn-single:hover {
          color: var(--text-1, #fff);
          border-color: var(--accent, #2eb875);
        }
        .export-concat-column {
          display: flex;
          flex-direction: column;
          min-height: 0;
          background: color-mix(in srgb, var(--surface-2, #141b19) 30%, transparent);
          overflow: hidden;
        }
        .export-concat-header {
          padding: 14px 18px;
          border-bottom: 1px solid var(--line, #24302c);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .export-concat-header strong {
          font-size: calc(13px * var(--ui-scale, 1));
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .export-concat-list {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .export-concat-item {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--surface-root, #0b0f0e);
          border: 1px solid var(--line, #24302c);
          padding: 6px 10px;
          border-radius: 8px;
        }
        .export-concat-idx {
          font-weight: 700;
          font-size: 11px;
          color: var(--accent-strong, #3dd68c);
          min-width: 18px;
        }
        .export-concat-thumb {
          width: 54px;
          height: 32px;
          border-radius: 4px;
          overflow: hidden;
          background: #000;
          flex-shrink: 0;
        }
        .export-concat-thumb :is(img, video) {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .export-concat-meta {
          flex: 1;
          min-width: 0;
          overflow: hidden;
        }
        .export-concat-meta strong {
          display: block;
          font-size: 11px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .export-concat-meta small {
          font-size: 9px;
          color: var(--faint, #637571);
        }
        .export-concat-btns {
          display: flex;
          gap: 4px;
        }
        .export-concat-btns button {
          background: var(--surface-2, #141b19);
          border: 1px solid var(--line, #24302c);
          color: var(--text-2, #94a3a0);
          border-radius: 4px;
          width: 24px;
          height: 24px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          cursor: pointer;
        }
        .export-concat-btns button:disabled {
          opacity: 0.3;
          cursor: default;
        }
        .export-concat-btns button:not(:disabled):hover {
          color: #fff;
          border-color: var(--accent, #2eb875);
        }
        .export-concat-footer {
          padding: 16px;
          border-top: 1px solid var(--line, #24302c);
          background: var(--surface-root, #0b0f0e);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .export-btn-primary {
          background: var(--accent-strong, #3dd68c);
          color: #05140d;
          font-weight: 750;
          border: 0;
          padding: 10px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-size: calc(12px * var(--ui-scale, 1));
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: filter 0.15s ease;
        }
        .export-btn-primary:hover:not(:disabled) {
          filter: brightness(1.1);
        }
        .export-btn-primary:disabled {
          opacity: 0.5;
          cursor: default;
        }
        .export-btn-secondary {
          background: var(--surface-2, #141b19);
          color: var(--text-1, #e3eae7);
          border: 1px solid var(--line, #24302c);
          padding: 8px 14px;
          border-radius: 8px;
          cursor: pointer;
          font-size: calc(11px * var(--ui-scale, 1));
          transition: all 0.15s ease;
        }
        .export-btn-secondary:hover:not(:disabled) {
          border-color: var(--accent, #2eb875);
        }
        .export-btn-secondary:disabled {
          opacity: 0.5;
          cursor: default;
        }
        .export-footer-bar {
          padding: 12px 20px;
          border-top: 1px solid var(--line, #24302c);
          background: var(--surface-root, #0b0f0e);
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: calc(11px * var(--ui-scale, 1));
        }
        .export-empty {
          grid-column: 1 / -1;
          text-align: center;
          padding: 40px;
          color: var(--faint, #637571);
          font-size: calc(12px * var(--ui-scale, 1));
        }
        .export-message-banner {
          padding: 8px 16px;
          font-size: 11px;
          font-weight: 550;
        }
        .export-message-banner.busy {
          background: color-mix(in srgb, var(--accent, #2eb875) 15%, transparent);
          color: var(--accent-strong, #3dd68c);
        }
        .export-message-banner.success {
          background: rgba(61, 214, 140, 0.15);
          color: #3dd68c;
        }
        .export-message-banner.error {
          background: rgba(235, 87, 87, 0.15);
          color: #ff6b6b;
        }
      `}</style>

      <section
        className="export-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="导出与成片交付管理"
        ref={dialogRef}
      >
        <header className="export-header">
          <h2>
            交付与导出管理
            <span>{snapshot.project.title}</span>
          </h2>
          <div className="export-tabs">
            <button
              type="button"
              className={tab === "video" ? "active" : ""}
              onClick={() => setTab("video")}
            >
              🎬 视频素材 ({allEntries.filter((e) => e.asset.mediaType === "video").length})
            </button>
            <button
              type="button"
              className={tab === "image" ? "active" : ""}
              onClick={() => setTab("image")}
            >
              🖼️ 图片素材 ({allEntries.filter((e) => e.asset.mediaType === "image").length})
            </button>
          </div>
          <button type="button" className="export-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>

        {busyMessage ? (
          <div className="export-message-banner busy">{busyMessage}</div>
        ) : errorMessage ? (
          <div className="export-message-banner error">{errorMessage}</div>
        ) : statusNotice ? (
          <div className="export-message-banner success">{statusNotice}</div>
        ) : null}

        <div className="export-body">
          <div className="export-source-column">
            <div className="export-toolbar">
              <div className="export-toolbar-left">
                <label className="export-filter-toggle">
                  <input
                    type="checkbox"
                    checked={onlyApproved}
                    onChange={(e) => setOnlyApproved(e.target.checked)}
                  />
                  仅显示已采用定剪镜头 (Approved)
                </label>
              </div>
              <div className="export-toolbar-right">
                <button
                  type="button"
                  className="export-btn-secondary"
                  style={{ padding: "3px 8px", fontSize: "11px" }}
                  onClick={selectAll}
                >
                  全选当前
                </button>
                <button
                  type="button"
                  className="export-btn-secondary"
                  style={{ padding: "3px 8px", fontSize: "11px" }}
                  onClick={clearSelection}
                >
                  清空已选
                </button>
              </div>
            </div>

            <div className="export-grid">
              {currentItems.map((item) => {
                const isSelected = selectedIds.has(item.asset.id);
                const assetUrl = projectKey
                  ? projectApi.assetUrl(projectKey, item.asset.id, false)
                  : "";
                const proxyUrl = projectKey
                  ? projectApi.assetUrl(projectKey, item.asset.id, true)
                  : "";

                return (
                  <article
                    key={item.asset.id}
                    className={`export-card ${isSelected ? "selected" : ""}`}
                  >
                    <div className="export-card-media">
                      <input
                        type="checkbox"
                        className="export-card-checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.asset.id)}
                        aria-label={`选择 ${item.suggestedFilename}`}
                      />
                      <span
                        className={`export-card-badge ${item.isApproved ? "approved" : "candidate"}`}
                      >
                        {item.isApproved ? "✓ 已定剪" : "候选 Take"}
                      </span>
                      {item.asset.mediaType === "video" ? (
                        <VideoThumbnail src={assetUrl} label={item.suggestedFilename} />
                      ) : (
                        <img src={proxyUrl || assetUrl} alt={item.suggestedFilename} />
                      )}
                    </div>
                    <div className="export-card-info">
                      <div className="export-card-title">
                        <span>{item.shot ? item.shot.label : "独立素材"}</span>
                        <small style={{ color: "var(--faint)" }}>
                          {item.asset.durationSeconds
                            ? `${item.asset.durationSeconds.toFixed(1)}s`
                            : ""}
                        </small>
                      </div>
                      <div className="export-card-specs">
                        {item.asset.width && item.asset.height
                          ? `${item.asset.width}×${item.asset.height}`
                          : ""}
                        {item.asset.frameRate ? ` · ${item.asset.frameRate}fps` : ""} ·{" "}
                        {formatBytes(item.asset.byteSize)}
                      </div>
                      <div className="export-card-actions">
                        <a
                          className="export-btn-single"
                          href={`${assetUrl}${assetUrl.includes("?") ? "&" : "?"}download=1`}
                          download={item.suggestedFilename}
                        >
                          ⬇ 单个导出
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
              {currentItems.length === 0 ? (
                <div className="export-empty">
                  {onlyApproved ? "当前分类暂无已采用的定剪素材" : "暂无可导出的素材"}
                </div>
              ) : null}
            </div>

            {tab === "image" ? (
              <div className="export-footer-bar">
                <span>已选择 {selectedIds.size} 张图片素材</span>
                <button
                  type="button"
                  className="export-btn-primary"
                  disabled={selectedIds.size === 0 || Boolean(busyMessage)}
                  onClick={handleExportZip}
                >
                  📦 批量打包已选图片为 ZIP
                </button>
              </div>
            ) : null}
          </div>

          {tab === "video" ? (
            <div className="export-concat-column">
              <div className="export-concat-header">
                <strong>
                  视频拼接序列
                  <small style={{ color: "var(--accent-strong)" }}>
                    ({concatSequenceIds.length} 镜 · {concatTotalDuration.toFixed(1)}s)
                  </small>
                </strong>
                <button
                  type="button"
                  className="export-btn-secondary"
                  style={{ padding: "3px 8px", fontSize: "10px" }}
                  onClick={resetToShotOrder}
                  title="按分镜默认镜头序号重排"
                >
                  按镜头号重排
                </button>
              </div>

              <div className="export-concat-list">
                {concatSequenceIds.map((id, index) => {
                  const item = allEntries.find((e) => e.asset.id === id);
                  if (!item) return null;
                  const assetUrl = projectKey
                    ? projectApi.assetUrl(projectKey, item.asset.id, false)
                    : "";

                  return (
                    <div key={id} className="export-concat-item">
                      <span className="export-concat-idx">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="export-concat-thumb">
                        <VideoThumbnail src={assetUrl} label={item.suggestedFilename} />
                      </div>
                      <div className="export-concat-meta">
                        <strong>{item.shot ? item.shot.label : item.suggestedFilename}</strong>
                        <small>
                          {item.asset.durationSeconds
                            ? `${item.asset.durationSeconds.toFixed(1)}s`
                            : ""}
                          {item.isApproved ? " · 定剪" : ""}
                        </small>
                      </div>
                      <div className="export-concat-btns">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => moveVideo(index, -1)}
                          title="向前移动"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={index === concatSequenceIds.length - 1}
                          onClick={() => moveVideo(index, 1)}
                          title="向后移动"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => removeVideoFromSequence(id)}
                          title="移出拼接序列"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
                {concatSequenceIds.length === 0 ? (
                  <div className="export-empty" style={{ padding: "30px 10px" }}>
                    在左侧勾选视频素材，即可在此自由调整前后顺序并拼接成完整成片。
                  </div>
                ) : null}
              </div>

              <div className="export-concat-footer">
                <button
                  type="button"
                  className="export-btn-primary"
                  disabled={concatSequenceIds.length === 0 || Boolean(busyMessage)}
                  onClick={handleConcatExport}
                >
                  🎬 拼接并导出完整成片 (MP4)
                </button>
                <button
                  type="button"
                  className="export-btn-secondary"
                  disabled={selectedIds.size === 0 || Boolean(busyMessage)}
                  onClick={handleExportZip}
                >
                  📦 批量打包已选视频为 ZIP ({selectedIds.size})
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </LayerBackdrop>
  );
}
