import {
  Handle,
  type Node,
  type NodeProps,
  NodeResizer,
  Position,
  useUpdateNodeInternals,
} from "@xyflow/react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { NumericInput } from "./numeric-input";
import {
  closestAspectRatio,
  megapixelsFromResolution,
  resolutionPresets,
  scaleResolutionToMegapixels,
} from "./resolution-presets";
import { CanvasVideo } from "./video-preview";
import {
  removePromptMention,
  splitPromptMentionSegments,
  togglePromptMention,
} from "./generation-draft";

export type BoardNodeData = {
  kind: "text" | "entity" | "asset" | "shot" | "take_stack";
  eyebrow: string;
  title: string;
  body: string;
  status?: "draft" | "generating" | "review" | "approved" | undefined;
  duration?: number | undefined;
  takeCount?: number;
  rejectedCount?: number;
  selected?: boolean;
  engine?: string;
  mediaUrl?: string | undefined;
  mediaType?: "image" | "video" | "audio" | undefined;
  mediaWidth?: number | undefined;
  mediaHeight?: number | undefined;
  aspectRatio?: string | undefined;
  details?: string[];
  progress?:
    | {
        phase: "preparing" | "queued" | "running" | "collecting";
        label: string;
        detail: string;
        percent: number | null;
        elapsedSeconds: number;
      }
    | null
    | undefined;
  inputSlots?: Array<{
    id: "first_frame" | "last_frame" | "reference" | "reference_video" | "reference_audio";
    label: string;
    connectedCount: number;
    maxCount: number;
    required: boolean;
    mediaType: "image" | "video" | "audio";
  }>;
  inlineControls?: {
    workflowPath: string;
    workflows: Array<{
      path: string;
      name: string;
      capability: string;
      capabilityLabel: string;
    }>;
    workflowLocked: boolean;
    prompt: string;
    promptPlaceholder?: string;
    width: number;
    height: number;
    durationSeconds: number;
    fps?: number;
    seed: number;
    outputLabel: "图片" | "视频";
    minDurationSeconds: number;
    resolutionOptions?: Array<{ label: string; width: number; height: number }>;
    resolutionPolicy?: import("@takeboard/contracts").ResolutionPolicy;
    supportsDuration?: boolean;
    supportsFps?: boolean;
    supportsResolution?: boolean;
    supportsSeed?: boolean;
    supportsDenoise?: boolean;
    denoiseLabel?: string;
    denoiseMin?: number;
    denoiseMax?: number;
    denoiseStep?: number;
    denoise?: number;
    mentionAliases: string[];
    busy: boolean;
    progress: {
      phase: "preparing" | "queued" | "running" | "collecting";
      label: string;
      detail: string;
      percent: number | null;
      elapsedSeconds: number;
    } | null;
    disabledReason: string | null;
    onWorkflowChange: (path: string) => void;
    onSettingsChange: (input: {
      prompt?: string;
      width?: number;
      height?: number;
      durationSeconds?: number;
      fps?: number;
      seed?: number;
      denoise?: number;
    }) => void;
    onGenerate: (input: {
      prompt: string;
      width: number;
      height: number;
      durationSeconds: number;
      fps?: number;
      seed: number;
      denoise?: number;
    }) => void;
    onOpenDetails: () => void;
    onOpenWorkflows: () => void;
    onCommitTitle: (title: string) => void;
  };
  onResizeItem?:
    | ((params: { x: number; y: number; width: number; height: number }) => void)
    | undefined;
};

export type BoardNode = Node<BoardNodeData>;

function Port({
  type,
  position,
  id,
  className = "",
}: {
  type: "source" | "target";
  position: Position;
  id?: string | null;
  className?: string;
}) {
  return (
    <Handle
      id={id ?? null}
      type={type}
      position={position}
      className={`board-handle ${className}`}
    />
  );
}

function NodeShell({
  children,
  selected,
  output = true,
}: {
  children: ReactNode;
  selected: boolean | undefined;
  output?: boolean;
}) {
  return (
    <div className={`board-node-shell ${selected ? "selected" : ""}`}>
      {output ? (
        <Port id="media" type="source" position={Position.Right} className="board-output-handle" />
      ) : null}
      {children}
    </div>
  );
}

function NodeFacts({ details }: { details: string[] | undefined }) {
  return details?.length ? (
    <div className="node-facts">
      {details.map((detail) => (
        <span key={detail}>{detail}</span>
      ))}
    </div>
  ) : null;
}

function TextNode({ data }: NodeProps<BoardNode>) {
  return (
    <NodeShell selected={data.selected}>
      <article className="board-card text-node">
        <div className="node-heading">
          <span className="node-icon text-icon">文</span>
          <span>{data.eyebrow}</span>
        </div>
        <h3>{data.title}</h3>
        <p>{data.body}</p>
        <footer>剧本资产 · 可作为生成来源</footer>
      </article>
    </NodeShell>
  );
}

function EntityNode({ data }: NodeProps<BoardNode>) {
  return (
    <NodeShell selected={data.selected}>
      <article className="board-card entity-node">
        <div className="node-media portrait-art" role="img" aria-label="人物或场景参考图">
          {data.mediaUrl ? (
            <img src={data.mediaUrl} alt="" />
          ) : (
            <div className="portrait-silhouette" />
          )}
          <span>CHARACTER REF</span>
        </div>
        <div className="node-heading compact">
          <span className="node-icon entity-icon">角</span>
          <span>{data.eyebrow}</span>
        </div>
        <h3>{data.title}</h3>
        <p>{data.body}</p>
        <NodeFacts details={data.details} />
      </article>
    </NodeShell>
  );
}

function AssetNode({ id, data, selected }: NodeProps<BoardNode>) {
  const [naturalResolution, setNaturalResolution] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const width = data.mediaWidth ?? naturalResolution?.width;
  const height = data.mediaHeight ?? naturalResolution?.height;
  const resolutionText = width && height ? `${width} × ${height}` : null;
  const mediaStyle = width && height ? { aspectRatio: `${width} / ${height}` } : undefined;
  const isSelected = Boolean(selected ?? data.selected);

  return (
    <NodeShell selected={isSelected}>
      <NodeResizer
        nodeId={id}
        isVisible={isSelected}
        minWidth={180}
        minHeight={100}
        color="#8b724b"
        handleClassName="board-handle"
        keepAspectRatio={Boolean(width && height)}
        onResizeEnd={(_event, params) => {
          data.onResizeItem?.(params);
        }}
      />
      <article className="board-card asset-node">
        <div
          className="node-media harbor-art"
          role="img"
          aria-label={`完整原图：${data.title}`}
          style={mediaStyle}
        >
          {data.mediaUrl && data.mediaType === "video" ? (
            <CanvasVideo
              src={data.mediaUrl}
              label={`${data.title} 参考视频`}
              onDimensions={(dimensions) => {
                if (!data.mediaWidth) {
                  setNaturalResolution(dimensions);
                }
              }}
            />
          ) : data.mediaUrl && data.mediaType === "audio" ? (
            <div className="asset-audio-preview">
              <span aria-hidden="true">
                <svg
                  viewBox="0 0 16 16"
                  width="13"
                  height="13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 13V3l7-1v10" />
                  <circle cx="4" cy="13" r="2" />
                  <circle cx="11" cy="12" r="2" />
                </svg>
              </span>
              {/* biome-ignore lint/a11y/useMediaCaption: raw reference audio has no authored caption track */}
              <audio src={data.mediaUrl} controls preload="metadata" />
            </div>
          ) : data.mediaUrl ? (
            <img
              src={data.mediaUrl}
              alt={data.title}
              onLoad={(event) => {
                const img = event.currentTarget;
                if (!data.mediaWidth && img.naturalWidth && img.naturalHeight) {
                  setNaturalResolution({ width: img.naturalWidth, height: img.naturalHeight });
                }
              }}
            />
          ) : (
            <>
              <span className="harbor-sun" />
              <span className="harbor-line line-one" />
              <span className="harbor-line line-two" />
              <span className="harbor-boat" />
            </>
          )}
          <span className="asset-label">SOURCE</span>
          {resolutionText ? (
            <span className="asset-label asset-resolution">{resolutionText}</span>
          ) : null}
        </div>
      </article>
    </NodeShell>
  );
}

export function shotMediaFactsText({
  mediaType,
  width,
  height,
  duration,
}: {
  mediaType?: "image" | "video" | "audio" | undefined;
  width?: number | undefined;
  height?: number | undefined;
  duration?: number | undefined;
}) {
  const resolutionText = width && height ? `${width} × ${height}` : null;
  return mediaType === "image"
    ? [resolutionText, "图片"].filter(Boolean).join(" · ")
    : [resolutionText, duration ? `${Number(duration.toFixed(2))} 秒` : null, "视频"]
        .filter(Boolean)
        .join(" · ");
}

function ShotNode({ data, id }: NodeProps<BoardNode>) {
  const updateNodeInternals = useUpdateNodeInternals();
  const inputSlotSignature = (data.inputSlots ?? []).map((slot) => slot.id).join(":");
  useEffect(() => {
    // A workflow may replace handles without changing the card's dimensions.
    // Refresh their geometry explicitly instead of hiding/re-measuring the whole node.
    void inputSlotSignature;
    updateNodeInternals(id);
  }, [id, inputSlotSignature, updateNodeInternals]);
  const [titleDraft, setTitleDraft] = useState(data.title);
  const [failedMediaUrl, setFailedMediaUrl] = useState<string | null>(null);
  const [loadedMediaUrl, setLoadedMediaUrl] = useState<string | null>(null);
  const [naturalResolution, setNaturalResolution] = useState<{
    width: number;
    height: number;
    duration?: number | undefined;
  } | null>(null);
  useEffect(() => {
    setNaturalResolution(null);
  }, [data.mediaUrl]);
  const mediaWidth = data.mediaWidth ?? naturalResolution?.width;
  const mediaHeight = data.mediaHeight ?? naturalResolution?.height;
  const duration = data.duration ?? naturalResolution?.duration;
  const quickSettingsId = useId();
  useEffect(() => setTitleDraft(data.title), [data.title]);
  const mediaFailed = Boolean(data.mediaUrl && failedMediaUrl === data.mediaUrl);
  const mediaLoading = Boolean(
    data.mediaType === "video" && data.mediaUrl && loadedMediaUrl !== data.mediaUrl && !mediaFailed,
  );
  const [settingsDraft, setSettingsDraft] = useState(() => ({
    prompt: data.inlineControls?.prompt ?? "",
    width: data.inlineControls?.width ?? 736,
    height: data.inlineControls?.height ?? 416,
    durationSeconds: data.inlineControls?.durationSeconds ?? 5,
    fps: data.inlineControls?.fps ?? 16,
    seed: data.inlineControls?.seed ?? 0,
    denoise: data.inlineControls?.denoise ?? 1.0,
  }));
  const [numericDraftValidity, setNumericDraftValidity] = useState({
    width: true,
    height: true,
    duration: true,
    fps: true,
    seed: true,
    denoise: true,
  });
  const updateNumericDraftValidity = (field: keyof typeof numericDraftValidity, valid: boolean) => {
    setNumericDraftValidity((current) =>
      current[field] === valid ? current : { ...current, [field]: valid },
    );
  };
  const settingsDraftRef = useRef(settingsDraft);
  settingsDraftRef.current = settingsDraft;
  const promptBackdropRef = useRef<HTMLDivElement>(null);
  const updateSettingsDraft = (input: Partial<typeof settingsDraft>) => {
    const next = { ...settingsDraftRef.current, ...input };
    settingsDraftRef.current = next;
    setSettingsDraft(next);
  };
  const inlinePrompt = data.inlineControls?.prompt;
  const inlineWidth = data.inlineControls?.width;
  const inlineHeight = data.inlineControls?.height;
  const inlineDurationSeconds = data.inlineControls?.durationSeconds;
  const inlineFps = data.inlineControls?.fps;
  const inlineSeed = data.inlineControls?.seed;
  const inlineDenoise = data.inlineControls?.denoise;
  useEffect(() => {
    if (
      inlinePrompt === undefined ||
      inlineWidth === undefined ||
      inlineHeight === undefined ||
      inlineDurationSeconds === undefined ||
      inlineSeed === undefined
    ) {
      return;
    }
    const next = {
      prompt: inlinePrompt,
      width: inlineWidth,
      height: inlineHeight,
      durationSeconds: inlineDurationSeconds,
      fps: inlineFps ?? settingsDraftRef.current.fps ?? 16,
      seed: inlineSeed,
      denoise: inlineDenoise ?? settingsDraftRef.current.denoise ?? 1.0,
    };
    settingsDraftRef.current = next;
    setSettingsDraft(next);
  }, [
    inlineDenoise,
    inlineDurationSeconds,
    inlineFps,
    inlineHeight,
    inlinePrompt,
    inlineSeed,
    inlineWidth,
  ]);
  const statusLabel = {
    draft: "待生成",
    generating: "生成中",
    review: "待选择",
    approved: "已批准",
  }[data.status ?? "draft"];
  const isGenerating = data.status === "generating" || Boolean(data.inlineControls?.progress);
  const progress = data.inlineControls?.progress ?? data.progress;
  const progressText = progress
    ? [
        progress.label,
        progress.detail,
        typeof progress.elapsedSeconds === "number" ? `${progress.elapsedSeconds}s` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "正在生成镜头…";
  const generatedStyle =
    mediaWidth && mediaHeight
      ? { aspectRatio: `${mediaWidth} / ${mediaHeight}` }
      : data.aspectRatio?.includes(":")
        ? { aspectRatio: data.aspectRatio.replace(":", " / ") }
        : undefined;
  const currentWorkflow = data.inlineControls?.workflows.find(
    (workflow) => workflow.path === data.inlineControls?.workflowPath,
  );
  const capabilityGroups = Array.from(
    new Map(
      data.inlineControls?.workflows.map((workflow) => [
        workflow.capability,
        workflow.capabilityLabel,
      ]) ?? [],
    ),
  );
  const visibleWorkflows = currentWorkflow
    ? (data.inlineControls?.workflows.filter(
        (workflow) => workflow.capability === currentWorkflow.capability,
      ) ?? [])
    : (data.inlineControls?.workflows ?? []);
  const isUpscale = Boolean(
    currentWorkflow && ["upscale_image", "upscale_video"].includes(currentWorkflow.capability),
  );
  const draftParameterInvalid =
    (Boolean(data.inlineControls?.supportsResolution) &&
      (!numericDraftValidity.width ||
        !numericDraftValidity.height ||
        !Number.isFinite(settingsDraft.width) ||
        settingsDraft.width < 256 ||
        settingsDraft.width > 4096 ||
        !Number.isFinite(settingsDraft.height) ||
        settingsDraft.height < 256 ||
        settingsDraft.height > 4096)) ||
    (Boolean(data.inlineControls?.supportsSeed) &&
      (!numericDraftValidity.seed ||
        !Number.isSafeInteger(settingsDraft.seed) ||
        settingsDraft.seed < 0)) ||
    (data.inlineControls?.outputLabel === "视频" &&
      Boolean(data.inlineControls.supportsDuration) &&
      (!numericDraftValidity.duration ||
        !Number.isFinite(settingsDraft.durationSeconds) ||
        settingsDraft.durationSeconds < 1 ||
        settingsDraft.durationSeconds > 15)) ||
    (data.inlineControls?.outputLabel === "视频" &&
      Boolean(data.inlineControls.supportsFps) &&
      (!numericDraftValidity.fps ||
        !Number.isFinite(settingsDraft.fps) ||
        settingsDraft.fps < 8 ||
        settingsDraft.fps > 60)) ||
    (Boolean(data.inlineControls?.supportsDenoise) &&
      (!numericDraftValidity.denoise ||
        !Number.isFinite(settingsDraft.denoise) ||
        settingsDraft.denoise < (data.inlineControls?.denoiseMin ?? 0.05) ||
        settingsDraft.denoise > (data.inlineControls?.denoiseMax ?? 16)));
  const draftDisabledReason =
    !isUpscale && !settingsDraft.prompt.trim()
      ? "请先输入镜头提示词"
      : draftParameterInvalid
        ? isUpscale
          ? "请检查参数设置"
          : "请检查分辨率、时长、帧率和 Seed"
        : data.inlineControls?.disabledReason === "请先输入镜头提示词"
          ? null
          : data.inlineControls?.disabledReason;
  return (
    <NodeShell selected={data.selected}>
      <Port type="target" position={Position.Left} className="board-provenance-handle" />
      <div className="shot-inputs">
        {(data.inputSlots ?? []).map((slot, index) => (
          <div
            className={`shot-input ${slot.connectedCount > 0 ? "connected" : ""}`}
            style={{ top: `${((index + 1) / ((data.inputSlots?.length ?? 0) + 1)) * 100}%` }}
            key={slot.id}
          >
            <Port
              id={slot.id}
              type="target"
              position={Position.Left}
              className={`slot-${slot.id}`}
            />
            <span>
              {slot.label} {slot.connectedCount}/{slot.maxCount}
              {slot.required ? <i>必需</i> : null}
            </span>
          </div>
        ))}
      </div>
      <article
        className={`board-card shot-node ${data.mediaUrl ? "has-generated-media" : "is-planning"} ${data.selected ? "selected" : ""}`}
      >
        {data.mediaUrl ? (
          <div
            className={`shot-generated-media ${data.mediaType === "video" ? "is-video" : ""}`}
            style={generatedStyle}
          >
            {data.mediaType === "video" ? (
              <CanvasVideo
                src={data.mediaUrl}
                label={`${data.title} 生成视频`}
                onError={() => setFailedMediaUrl(data.mediaUrl ?? null)}
                onLoaded={() => {
                  setFailedMediaUrl(null);
                  setLoadedMediaUrl(data.mediaUrl ?? null);
                }}
                onDimensions={(dimensions) => {
                  if (!data.mediaWidth) {
                    setNaturalResolution(dimensions);
                  }
                }}
              />
            ) : (
              <img
                src={data.mediaUrl}
                alt={`${data.title} 生成画面`}
                onLoad={(event) => {
                  const img = event.currentTarget;
                  if (!data.mediaWidth && img.naturalWidth && img.naturalHeight) {
                    setNaturalResolution({ width: img.naturalWidth, height: img.naturalHeight });
                  }
                }}
              />
            )}
            {mediaLoading ? (
              <div className="shot-video-loading" role="status">
                <span aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <strong>正在读取视频预览</strong>
                <small>原文件已安全保留</small>
              </div>
            ) : null}
            {mediaFailed ? (
              <div className="shot-video-fallback">
                <strong>浏览器无法直接播放这个视频</strong>
                <a href={data.mediaUrl} target="_blank" rel="noreferrer">
                  打开原视频
                </a>
              </div>
            ) : null}
            <div className="shot-generated-overlay">
              <span className="shot-label">{data.title}</span>
              <span className="shot-generated-facts">
                <strong>{data.engine}</strong>
                <i>
                  {shotMediaFactsText({
                    mediaType: data.mediaType,
                    width: mediaWidth,
                    height: mediaHeight,
                    duration,
                  })}
                </i>
              </span>
            </div>
          </div>
        ) : (
          <>
            <div className="shot-topline">
              <span className="shot-label">{data.title}</span>
              <span className={`shot-status status-${data.status}`}>{statusLabel}</span>
            </div>
            <div className="shot-planning-surface">
              <span className="shot-planning-mark" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <div>
                <strong>
                  {isGenerating ? "生成创作中……" : data.body.trim() ? "提示已就绪" : "等待创作"}
                </strong>
                <p title={isGenerating ? progressText : data.body.trim() || undefined}>
                  {isGenerating
                    ? progressText
                    : data.body.trim() || "写下镜头，或连接一张参考素材。"}
                </p>
              </div>
            </div>
            <NodeFacts details={data.details} />
            <footer>
              {data.duration ? <span>{Number(data.duration.toFixed(2))} 秒</span> : null}
              <span>{data.takeCount ?? 0} Takes</span>
              <span>{data.engine ?? "I2V"}</span>
            </footer>
          </>
        )}
      </article>
      {data.selected && data.inlineControls ? (
        <fieldset
          className="shot-inline-console nodrag nopan nowheel"
          aria-label="画布镜头快速设置"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          onBlur={(event) => {
            if (event.currentTarget.contains(event.relatedTarget)) return;
            window.requestAnimationFrame(() =>
              data.inlineControls?.onSettingsChange(settingsDraftRef.current),
            );
          }}
        >
          <div className="shot-inline-title-row">
            <input
              aria-label="画布镜头名称"
              value={titleDraft}
              maxLength={80}
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={() => {
                const title = titleDraft.trim();
                if (title && title !== data.title) data.inlineControls?.onCommitTitle(title);
              }}
            />
            <button
              type="button"
              onClick={() => {
                data.inlineControls?.onSettingsChange(settingsDraftRef.current);
                data.inlineControls?.onOpenDetails();
              }}
            >
              详细设置
            </button>
          </div>
          <div className="shot-inline-workflow-row">
            <select
              aria-label="画布生成方式"
              value={currentWorkflow?.capability ?? ""}
              disabled={data.inlineControls.workflowLocked}
              onChange={(event) => {
                data.inlineControls?.onSettingsChange(settingsDraftRef.current);
                const workflow = data.inlineControls?.workflows.find(
                  (candidate) => candidate.capability === event.target.value,
                );
                if (workflow) data.inlineControls?.onWorkflowChange(workflow.path);
              }}
            >
              {!currentWorkflow ? (
                <option value="" disabled>
                  选择生成方式
                </option>
              ) : null}
              {capabilityGroups.map(([capability, label]) => (
                <option value={capability} key={capability}>
                  {label}
                </option>
              ))}
            </select>
            <select
              aria-label="画布工作流"
              value={data.inlineControls.workflowPath}
              disabled={data.inlineControls.workflowLocked}
              onChange={(event) => {
                data.inlineControls?.onSettingsChange(settingsDraftRef.current);
                data.inlineControls?.onWorkflowChange(event.target.value);
              }}
            >
              {!currentWorkflow ? (
                <option value={data.inlineControls.workflowPath || ""} disabled>
                  {data.inlineControls.workflowPath ? "未知工作流" : "选择工作流"}
                </option>
              ) : null}
              {visibleWorkflows.map((workflow) => (
                <option value={workflow.path} key={workflow.path}>
                  {workflow.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label="选择或管理工作流"
              onClick={() => {
                data.inlineControls?.onSettingsChange(settingsDraftRef.current);
                data.inlineControls?.onOpenWorkflows();
              }}
            >
              选择工作流
            </button>
          </div>
          {data.inlineControls.mentionAliases.some((alias) =>
            settingsDraft.prompt.includes(`@${alias}`),
          ) ? (
            <div className="shot-inline-active-mentions" role="status" aria-label="已关联素材">
              <span className="shot-inline-active-title">已引用:</span>
              {data.inlineControls.mentionAliases
                .filter((alias) => settingsDraft.prompt.includes(`@${alias}`))
                .map((alias) => (
                  <span key={alias} className="shot-inline-active-pill">
                    <span>@{alias}</span>
                    <button
                      type="button"
                      aria-label={`移除 @${alias}`}
                      onClick={() =>
                        updateSettingsDraft({
                          prompt: removePromptMention(settingsDraftRef.current.prompt, alias),
                        })
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
            </div>
          ) : null}
          <div className="prompt-mirror-wrap">
            <div ref={promptBackdropRef} className="prompt-mirror-backdrop" aria-hidden="true">
              {splitPromptMentionSegments(
                settingsDraft.prompt,
                data.inlineControls.mentionAliases,
              ).map((segment, index) =>
                segment.isMention ? (
                  <mark key={index} className="prompt-mention-highlight">
                    {segment.text}
                  </mark>
                ) : (
                  <span key={index}>{segment.text}</span>
                ),
              )}
              {settingsDraft.prompt.endsWith("\n") ? "\n" : null}
            </div>
            <textarea
              rows={2}
              aria-label="画布提示词"
              className="prompt-mirror-textarea"
              value={settingsDraft.prompt}
              placeholder={data.inlineControls.promptPlaceholder}
              onScroll={(event) => {
                if (promptBackdropRef.current) {
                  promptBackdropRef.current.scrollTop = event.currentTarget.scrollTop;
                }
              }}
              onChange={(event) => updateSettingsDraft({ prompt: event.target.value })}
            />
          </div>
          {data.inlineControls.resolutionOptions?.length ? (
            <label className="shot-inline-aspect">
              <span>比例</span>
              <select
                aria-label="画布生成比例"
                value={closestAspectRatio(
                  settingsDraft.width,
                  settingsDraft.height,
                  resolutionPresets(
                    settingsDraft.width,
                    settingsDraft.height,
                    data.inlineControls.resolutionPolicy ?? "exact",
                  ),
                )}
                onChange={(event) => {
                  const options = resolutionPresets(
                    settingsDraft.width,
                    settingsDraft.height,
                    data.inlineControls?.resolutionPolicy ?? "exact",
                  );
                  const preset = options.find((item) => item.label === event.target.value);
                  if (preset) updateSettingsDraft({ width: preset.width, height: preset.height });
                }}
              >
                <option value="custom" disabled>
                  自定义
                </option>
                {resolutionPresets(
                  settingsDraft.width,
                  settingsDraft.height,
                  data.inlineControls.resolutionPolicy ?? "exact",
                ).map((preset) => (
                  <option key={preset.label} value={preset.label}>
                    {preset.label} · {preset.width} × {preset.height}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {data.inlineControls.mentionAliases.length ? (
            <div className="shot-inline-mentions">
              {data.inlineControls.mentionAliases.map((alias) => {
                const isActive = settingsDraft.prompt.includes(`@${alias}`);
                return (
                  <button
                    type="button"
                    key={alias}
                    className={isActive ? "is-active" : ""}
                    onClick={() =>
                      updateSettingsDraft({
                        prompt: togglePromptMention(settingsDraftRef.current.prompt, alias),
                      })
                    }
                  >
                    {isActive ? <span className="shot-inline-mention-check">✓</span> : null}
                    @{alias}
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="shot-inline-parameters">
            {data.inlineControls.supportsResolution !== false ? (
              <label className="shot-inline-resolution" htmlFor={`${quickSettingsId}-width`}>
                <span>尺寸</span>
                <div>
                  <NumericInput
                    id={`${quickSettingsId}-width`}
                    draftKey={`${id}:${data.inlineControls.workflowPath}:width`}
                    aria-label="画布宽度"
                    min={256}
                    max={4096}
                    step={32}
                    value={settingsDraft.width}
                    preserveEmptyOnBlur
                    onDraftValidityChange={(valid) => updateNumericDraftValidity("width", valid)}
                    onValueChange={(width) => updateSettingsDraft({ width })}
                  />
                  <i>×</i>
                  <NumericInput
                    id={`${quickSettingsId}-height`}
                    draftKey={`${id}:${data.inlineControls.workflowPath}:height`}
                    aria-label="画布高度"
                    min={256}
                    max={4096}
                    step={32}
                    value={settingsDraft.height}
                    preserveEmptyOnBlur
                    onDraftValidityChange={(valid) => updateNumericDraftValidity("height", valid)}
                    onValueChange={(height) => updateSettingsDraft({ height })}
                  />
                </div>
              </label>
            ) : null}
            {data.inlineControls.supportsResolution !== false ? (
              <label className="shot-inline-megapixels" htmlFor={`${quickSettingsId}-megapixels`}>
                <span>百万像素</span>
                <NumericInput
                  id={`${quickSettingsId}-megapixels`}
                  draftKey={`${id}:${data.inlineControls.workflowPath}:megapixels`}
                  aria-label="画布百万像素"
                  min={0.1}
                  max={data.inlineControls.outputLabel === "图片" ? 4 : 2}
                  step={0.1}
                  value={megapixelsFromResolution(settingsDraft.width, settingsDraft.height)}
                  onValueChange={(mp) =>
                    updateSettingsDraft(
                      scaleResolutionToMegapixels(
                        settingsDraft.width,
                        settingsDraft.height,
                        mp,
                        data.inlineControls?.resolutionPolicy ?? "exact",
                      ),
                    )
                  }
                />
              </label>
            ) : null}
            {data.inlineControls.outputLabel === "视频" &&
            Boolean(data.inlineControls.supportsDuration) ? (
              <label className="shot-inline-duration" htmlFor={`${quickSettingsId}-duration`}>
                <span>时长</span>
                <NumericInput
                  id={`${quickSettingsId}-duration`}
                  draftKey={`${id}:${data.inlineControls.workflowPath}:duration`}
                  aria-label="画布时长"
                  min={data.inlineControls.minDurationSeconds}
                  max={15}
                  step={0.5}
                  value={settingsDraft.durationSeconds}
                  preserveEmptyOnBlur
                  onDraftValidityChange={(valid) => updateNumericDraftValidity("duration", valid)}
                  onValueChange={(durationSeconds) => updateSettingsDraft({ durationSeconds })}
                />
              </label>
            ) : null}
            {data.inlineControls.outputLabel === "视频" &&
            Boolean(data.inlineControls.supportsFps) ? (
              <label className="shot-inline-fps" htmlFor={`${quickSettingsId}-fps`}>
                <span>帧率</span>
                <NumericInput
                  id={`${quickSettingsId}-fps`}
                  draftKey={`${id}:${data.inlineControls.workflowPath}:fps`}
                  aria-label="画布帧率"
                  min={8}
                  max={60}
                  step={1}
                  value={settingsDraft.fps}
                  preserveEmptyOnBlur
                  onDraftValidityChange={(valid) => updateNumericDraftValidity("fps", valid)}
                  onValueChange={(fps) => updateSettingsDraft({ fps })}
                />
              </label>
            ) : null}
            {data.inlineControls.supportsSeed !== false ? (
              <label
                className="shot-inline-seed"
                htmlFor={`${quickSettingsId}-seed`}
                title={`当前种子: ${settingsDraft.seed}`}
              >
                <span>Seed</span>
                <NumericInput
                  id={`${quickSettingsId}-seed`}
                  draftKey={`${id}:${data.inlineControls.workflowPath}:seed`}
                  aria-label="画布 Seed"
                  min={0}
                  max={Number.MAX_SAFE_INTEGER}
                  step={1}
                  value={settingsDraft.seed}
                  preserveEmptyOnBlur
                  title={`当前种子: ${settingsDraft.seed}`}
                  onDraftValidityChange={(valid) => updateNumericDraftValidity("seed", valid)}
                  onValueChange={(seed) => updateSettingsDraft({ seed })}
                />
              </label>
            ) : null}
            {Boolean(data.inlineControls.supportsDenoise) ? (
              <label
                className="shot-inline-denoise"
                htmlFor={`${quickSettingsId}-denoise`}
                title={`${data.inlineControls.denoiseLabel ?? "细节程度"}: ${settingsDraft.denoise}`}
              >
                <span>{data.inlineControls.denoiseLabel ?? "细节程度"}</span>
                <NumericInput
                  id={`${quickSettingsId}-denoise`}
                  draftKey={`${id}:${data.inlineControls.workflowPath}:denoise`}
                  aria-label={data.inlineControls.denoiseLabel ?? "细节程度"}
                  min={data.inlineControls.denoiseMin ?? 0.05}
                  max={data.inlineControls.denoiseMax ?? 2.0}
                  step={data.inlineControls.denoiseStep ?? 0.05}
                  value={settingsDraft.denoise}
                  preserveEmptyOnBlur
                  title={`${data.inlineControls.denoiseLabel ?? "细节程度"}: ${settingsDraft.denoise}`}
                  onDraftValidityChange={(valid) => updateNumericDraftValidity("denoise", valid)}
                  onValueChange={(denoise) => updateSettingsDraft({ denoise })}
                />
              </label>
            ) : null}
          </div>
          <button
            className="shot-inline-generate"
            type="button"
            disabled={data.inlineControls.busy || Boolean(draftDisabledReason)}
            title={draftDisabledReason ?? ""}
            onClick={() => {
              data.inlineControls?.onSettingsChange(settingsDraftRef.current);
              data.inlineControls?.onGenerate(settingsDraftRef.current);
            }}
          >
            <span>
              {data.inlineControls.busy
                ? (data.inlineControls.progress?.label ?? "生成中…")
                : `生成${data.inlineControls.outputLabel === "图片" ? "图片" : "镜头"}`}
            </span>
            {data.inlineControls.progress ? (
              <>
                <b>
                  {data.inlineControls.progress.percent === null
                    ? "实时"
                    : `${data.inlineControls.progress.percent}%`}
                </b>
                <i
                  className={`shot-inline-progress-track ${data.inlineControls.progress.percent === null ? "indeterminate" : ""}`}
                  aria-hidden="true"
                >
                  <i
                    style={
                      data.inlineControls.progress.percent === null
                        ? undefined
                        : { width: `${data.inlineControls.progress.percent}%` }
                    }
                  />
                </i>
              </>
            ) : null}
          </button>
          {data.inlineControls.progress ? (
            <small className="shot-inline-progress-detail" aria-live="polite">
              {data.inlineControls.progress.label} · {data.inlineControls.progress.detail} ·{" "}
              {data.inlineControls.progress.elapsedSeconds}s
            </small>
          ) : draftDisabledReason ? (
            <small>{draftDisabledReason}</small>
          ) : null}
        </fieldset>
      ) : null}
    </NodeShell>
  );
}

function TakeStackNode({ data }: NodeProps<BoardNode>) {
  const takeCount = data.takeCount ?? 0;
  return (
    <NodeShell selected={data.selected}>
      <Port type="target" position={Position.Left} />
      <article className={`board-card stack-node ${data.selected ? "selected" : ""}`}>
        <div className="node-heading">
          <span className="node-icon stack-icon">选</span>
          <span>TAKE STACK</span>
          <span className="stack-count">{takeCount}</span>
        </div>
        <h3>{data.title} 候选</h3>
        <div className="stack-grid">
          {[1, 2, 3, 4].slice(0, Math.min(takeCount, 4)).map((slot) => (
            <span className={`mini-take mini-take-${slot}`} key={`take-slot-${slot}`}>
              {slot}
            </span>
          ))}
        </div>
        <footer>
          <span>{data.rejectedCount ?? 0} 已淘汰</span>
          <span>{data.status === "approved" ? "1 已批准" : "等待选择"}</span>
        </footer>
      </article>
    </NodeShell>
  );
}

export const boardNodeTypes = {
  text: TextNode,
  entity: EntityNode,
  asset: AssetNode,
  shot: ShotNode,
  take_stack: TakeStackNode,
};
