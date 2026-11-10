import type { ProjectSnapshot } from "@takeboard/contracts";
import { describe, expect, it } from "vitest";
import type { WorkflowSummary } from "./api";
import { shotMediaFactsText, type BoardNode } from "./board-nodes";
import {
  boardEdges,
  boardNodes,
  connectedAssetId,
  resolveSnapshotEdge,
  retainNodeMeasurements,
} from "./canvas-projection";
import type { ShotCanvasControls } from "./generation-model";

it("labels image editing inputs as source images and avoids duplicating port labels", () => {
  const workflow = {
    path: "custom/edit.json",
    capability: "image_to_image",
    inputs: ["first_frame"],
  } as WorkflowSummary;
  const snapshot = {
    canvasEdges: [
      { id: "edge", sourceItemId: "source", targetItemId: "target", targetSlot: "first_frame" },
    ],
    canvasItems: [{ id: "target", refId: "shot" }],
    shots: [{ id: "shot", workflowPath: workflow.path }],
    runs: [],
  } as unknown as ProjectSnapshot;
  expect(boardEdges(snapshot, [workflow], workflow, "shot", null)[0]?.label).toBeUndefined();
  expect(boardEdges(snapshot, [workflow], workflow, "shot", "edge")[0]).toMatchObject({
    label: "源图",
    targetHandle: "first_frame",
  });
  const video = { ...workflow, capability: "image_to_video" as const };
  expect(boardEdges(snapshot, [video], video, "shot", "edge")[0]?.label).toBe("首帧");
});

it("only exposes duration and fps controls for workflows that actually declare them", () => {
  const videoWorkflow = {
    path: "builtin/wan.json",
    capability: "text_to_video",
    inputs: ["resolution", "duration", "fps", "seed"],
    name: "Wan Video",
  } as WorkflowSummary;
  const imageWorkflow = {
    path: "builtin/qwen.json",
    capability: "text_to_image",
    inputs: ["resolution", "seed"],
    name: "Qwen Image",
  } as WorkflowSummary;
  const snapshot = {
    canvasEdges: [],
    canvasItems: [{ id: "shot-node", refType: "shot", refId: "shot-1", x: 0, y: 0, width: 470 }],
    shots: [{ id: "shot-1", label: "Shot 1", workflowPath: videoWorkflow.path }],
    runs: [],
    assets: [],
    takes: [],
    entities: [],
    textItems: [],
  } as unknown as ProjectSnapshot;
  const mockControls = {
    settings: {
      recipePath: videoWorkflow.path,
      prompt: "test",
      negativePrompt: "",
      width: 736,
      height: 416,
      durationSeconds: 5,
      fps: 24,
      steps: 20,
      denoise: 0.65,
      seed: 2762597745,
    } as unknown as ShotCanvasControls["settings"],
    workflows: [videoWorkflow],
    workflowLocked: false,
    mentionAliases: [],
    busy: true,
    progress: {
      phase: "running" as const,
      label: "正在执行：VAEDecode",
      detail: "此节点没有提供步进百分比",
      percent: null,
      elapsedSeconds: 278,
    },
    disabledReason: null,
    onWorkflowChange: () => {},
    onSettingsChange: () => {},
    onGenerate: () => {},
    onOpenDetails: () => {},
    onOpenWorkflows: () => {},
    onCommitTitle: () => {},
  };

  const videoNodes = boardNodes(
    snapshot,
    "shot-node",
    null,
    [videoWorkflow],
    videoWorkflow,
    "shot-1",
    mockControls,
  );
  expect(videoNodes[0]?.data.inlineControls).toMatchObject({
    fps: 24,
    supportsDuration: true,
    supportsFps: true,
    supportsSeed: true,
  });
  expect(videoNodes[0]?.data.progress).toEqual({
    phase: "running",
    label: "正在执行：VAEDecode",
    detail: "此节点没有提供步进百分比",
    percent: null,
    elapsedSeconds: 278,
  });

  const imageSnapshot = {
    ...snapshot,
    shots: [{ id: "shot-1", label: "Shot 1", workflowPath: imageWorkflow.path }],
  } as unknown as ProjectSnapshot;
  const imageNodes = boardNodes(
    imageSnapshot,
    "shot-node",
    null,
    [imageWorkflow],
    imageWorkflow,
    "shot-1",
    { ...mockControls, settings: { ...mockControls.settings, recipePath: imageWorkflow.path } },
  );
  expect(imageNodes[0]?.data.inlineControls).toMatchObject({
    supportsDuration: false,
    supportsFps: false,
    supportsSeed: true,
  });

  const unexpandedNodes = boardNodes(
    snapshot,
    null,
    null,
    [videoWorkflow],
    null,
    null,
    null,
    {
      "shot-1": {
        phase: "running",
        label: "正在生成: SamplerCustomAdvanced",
        detail: "真实步进 2 / 3",
        percent: 67,
        elapsedSeconds: 79,
      },
    },
  );
  expect(unexpandedNodes[0]?.data.inlineControls).toBeUndefined();
  expect(unexpandedNodes[0]?.data.progress).toEqual({
    phase: "running",
    label: "正在生成: SamplerCustomAdvanced",
    detail: "真实步进 2 / 3",
    percent: 67,
    elapsedSeconds: 79,
  });
});

describe("canvas measurement reconciliation", () => {
  it("projects 500 mixed media/shot nodes without mutating media names or reusing stale indexes", () => {
    const workflow = {
      path: "custom/image.json",
      capability: "image_to_image",
      execution: "bound",
      inputs: ["first_frame"],
      name: "Custom image",
    } as WorkflowSummary;
    const assets = Array.from({ length: 300 }, (_, index) => ({
      id: `asset-${index}`,
      originalName: `ferry-${index}.webp`,
      mediaType: "image",
      mimeType: "image/webp",
      width: 750,
      height: 900,
    }));
    const shots = Array.from({ length: 200 }, (_, index) => ({
      id: `shot-${index}`,
      label: `镜头${index}`,
      workflowPath: workflow.path,
      approvedTakeId: `take-${index}`,
      aspectRatio: "16:9",
    }));
    const mixed = {
      assets,
      shots,
      entities: [],
      textItems: [],
      runs: [],
      takes: shots.map((shot, index) => ({
        id: `take-${index}`,
        shotId: shot.id,
        assetId: `asset-${index}`,
        status: "approved",
      })),
      canvasItems: [
        ...shots.map((shot, index) => ({
          id: `shot-node-${index}`,
          refId: shot.id,
          refType: "shot",
          x: index * 500,
          y: 0,
          width: 470,
        })),
        ...assets.map((asset, index) => ({
          id: `asset-node-${index}`,
          refId: asset.id,
          refType: "asset",
          x: index * 320,
          y: 600,
          width: 320,
        })),
      ],
      canvasEdges: shots.map((_, index) => ({
        sourceItemId: `asset-node-${index}`,
        targetItemId: `shot-node-${index}`,
        targetSlot: "first_frame",
      })),
    } as unknown as ProjectSnapshot;
    const original = structuredClone(mixed);
    const nodes = boardNodes(mixed, null, "mixed.takeboard", [workflow], null, null, null);
    expect(nodes).toHaveLength(500);
    expect(nodes[199]?.data).toMatchObject({
      title: "镜头199",
      mediaWidth: 750,
      mediaHeight: 900,
      inputSlots: [expect.objectContaining({ id: "first_frame", connectedCount: 1 })],
    });
    expect(nodes[200]?.data.title).toBe("ferry-0.webp");
    expect(mixed).toEqual(original);
    const changed = structuredClone(mixed);
    if (changed.assets[0]) changed.assets[0].originalName = "用户改名.webp";
    expect(boardNodes(changed, null, null, [workflow], null, null, null)[200]?.data.title).toBe(
      "用户改名.webp",
    );
  });
  it("renders legacy resized items at stable widths without mutating stored dimensions", () => {
    const legacy = {
      canvasItems: [
        {
          id: "shot-node",
          refType: "shot",
          refId: "missing",
          x: 80,
          y: 90,
          width: 180,
          height: 100,
          sizeMode: "manual",
        },
        {
          id: "image-node",
          refType: "asset",
          refId: "missing",
          x: 700,
          y: 90,
          width: 4000,
          height: 3000,
          sizeMode: "manual",
        },
      ],
      shots: [],
      takes: [],
      runs: [],
      assets: [],
      entities: [],
      textItems: [],
      canvasEdges: [],
    } as unknown as ProjectSnapshot;
    const before = structuredClone(legacy);
    const nodes = boardNodes(legacy, null, null, [], null, null, null);
    expect(nodes.map((node) => node.style)).toEqual([{ width: 470 }, { width: 4000 }]);
    expect(nodes[0]?.position).toEqual({ x: 80, y: 90 });
    expect(legacy).toEqual(before);
  });
  const node: BoardNode = {
    id: "shot",
    type: "shot",
    position: { x: 0, y: 0 },
    data: { kind: "shot", title: "SH-01", eyebrow: "SHOT", body: "" },
    measured: { width: 470, height: 650 },
  };
  it("keeps measurements without replacing new position, data or selection", () => {
    const next: BoardNode = {
      ...node,
      position: { x: 120, y: 80 },
      selected: true,
      data: { ...node.data, title: "New title" },
    };
    delete next.measured;
    expect(retainNodeMeasurements([node], [next])).toEqual([{ ...next, measured: node.measured }]);
    expect(next.measured).toBeUndefined();
  });
  it("does not retain removed nodes or reuse another node type's dimensions", () => {
    const replacement: BoardNode = { ...node, type: "asset" };
    delete replacement.measured;
    expect(retainNodeMeasurements([node], [replacement])).toEqual([replacement]);
    expect(retainNodeMeasurements([node], [])).toEqual([]);
    expect(retainNodeMeasurements([], [replacement])).toEqual([replacement]);
  });
  it("projects resizable asset nodes preserving manual width and media dimensions", () => {
    const assetSnapshot = {
      canvasItems: [
        {
          id: "asset-item",
          refType: "asset",
          refId: "asset-1",
          x: 100,
          y: 200,
          width: 560,
          height: 315,
          sizeMode: "manual",
        },
      ],
      assets: [
        {
          id: "asset-1",
          originalName: "hero.png",
          mediaType: "image",
          mimeType: "image/png",
          width: 1920,
          height: 1080,
        },
      ],
      shots: [],
      takes: [],
      runs: [],
      entities: [],
      textItems: [],
      canvasEdges: [],
    } as unknown as ProjectSnapshot;

    const [assetNode] = boardNodes(assetSnapshot, null, null, [], null, null, null);
    expect(assetNode?.style?.width).toBe(560);
    expect(assetNode?.data.mediaWidth).toBe(1920);
    expect(assetNode?.data.mediaHeight).toBe(1080);
    expect(assetNode?.data.details?.[0]).toBe("1920 × 1080");
  });
});

const edge = {
  id: "actual",
  sourceItemId: "source",
  targetItemId: "shot",
  targetSlot: "first_frame",
};
const snapshot = { canvasEdges: [edge] } as ProjectSnapshot;
describe("canvas edge resolution", () => {
  it("resolves a persisted ID and an exact source/target/slot tuple", () => {
    expect(resolveSnapshotEdge(snapshot, { id: "actual", source: "source", target: "shot" })).toBe(
      edge,
    );
    expect(
      resolveSnapshotEdge(snapshot, {
        id: "stale",
        source: "source",
        target: "shot",
        targetHandle: "first_frame",
      }),
    ).toBe(edge);
  });
  it("never guesses a different source or slot just because the target has one edge", () => {
    expect(
      resolveSnapshotEdge(snapshot, {
        id: "stale",
        source: "other",
        target: "shot",
        targetHandle: "first_frame",
      }),
    ).toBeUndefined();
    expect(
      resolveSnapshotEdge(snapshot, {
        id: "stale",
        source: "source",
        target: "shot",
        targetHandle: "last_frame",
      }),
    ).toBeUndefined();
  });
  it("resolves source asset for first_frame even when edge was connected without explicit slot handle", () => {
    const snap = {
      assets: [{ id: "asset-1", mediaType: "image" }],
      takes: [{ id: "take-1", shotId: "shot-prev", assetId: "asset-1", status: "approved" }],
      shots: [{ id: "shot-prev", approvedTakeId: "take-1" }, { id: "shot-target" }],
      canvasItems: [
        { id: "item-prev", refType: "shot", refId: "shot-prev" },
        { id: "item-target", refType: "shot", refId: "shot-target" },
      ],
      canvasEdges: [
        { id: "edge-1", sourceItemId: "item-prev", targetItemId: "item-target", targetSlot: null },
      ],
    } as unknown as ProjectSnapshot;
    expect(connectedAssetId(snap, "shot-target", "first_frame")).toBe("asset-1");
  });
  it("projects upscale controls without seed, resolution, fps or duration, and exposes detail as denoise for video", () => {
    const upscaleWorkflow = {
      id: "relayvsr",
      path: "RelayVSR_Workflow.json",
      name: "RelayVSR",
      capability: "upscale_video" as const,
      capabilityLabel: "视频放大",
      inputs: ["reference_videos", "denoise"],
      mediaInputs: { first_frame: 0, last_frame: 0, reference: 0, reference_video: 1, reference_audio: 0 },
      models: [],
      nodeCount: 10,
      source: "comfyui" as const,
      editorUrl: "http://127.0.0.1:8188",
      execution: "native" as const,
    };
    const snap = {
      canvasEdges: [],
      canvasItems: [{ id: "shot-node", refType: "shot", refId: "shot-1", x: 0, y: 0, width: 470 }],
      shots: [{ id: "shot-1", label: "Shot 1", workflowPath: upscaleWorkflow.path }],
      runs: [],
      assets: [],
      takes: [],
      entities: [],
      textItems: [],
    } as unknown as ProjectSnapshot;
    const controls = {
      settings: {
        recipePath: upscaleWorkflow.path,
        prompt: "",
        denoise: 1.0,
      } as unknown as ShotCanvasControls["settings"],
      workflows: [upscaleWorkflow],
      workflowLocked: false,
      mentionAliases: [],
      busy: false,
      progress: null,
      disabledReason: null,
      onWorkflowChange: () => {},
      onSettingsChange: () => {},
      onGenerate: () => {},
      onOpenDetails: () => {},
      onOpenWorkflows: () => {},
      onCommitTitle: () => {},
    };
    const nodes = boardNodes(snap, "shot-node", "demo", [upscaleWorkflow], upscaleWorkflow, "shot-1", controls);
    const shotNode = nodes.find((n) => n.id === "shot-node");
    expect(shotNode?.data.inlineControls?.supportsResolution).toBe(false);
    expect(shotNode?.data.inlineControls?.supportsSeed).toBe(false);
    expect(shotNode?.data.inlineControls?.supportsDuration).toBe(false);
    expect(shotNode?.data.inlineControls?.supportsFps).toBe(false);
    expect(shotNode?.data.inlineControls?.supportsDenoise).toBe(true);
    expect(shotNode?.data.inlineControls?.denoise).toBe(1.0);
  });
  it("projects image upscale controls with 放大倍数 and hides resolution / seed", () => {
    const upscaleImageWorkflow = {
      id: "realesrgan",
      path: "RealEsRGAN.json",
      name: "RealEsRGAN",
      capability: "upscale_image" as const,
      capabilityLabel: "图片放大",
      inputs: ["first_frame", "denoise"],
      mediaInputs: { first_frame: 1, last_frame: 0, reference: 0, reference_video: 0, reference_audio: 0 },
      models: [],
      nodeCount: 3,
      source: "comfyui" as const,
      editorUrl: "http://127.0.0.1:8188",
      execution: "native" as const,
    };
    const snap = {
      canvasEdges: [],
      canvasItems: [{ id: "shot-node", refType: "shot", refId: "shot-1", x: 0, y: 0, width: 470 }],
      shots: [{ id: "shot-1", label: "Shot 1", workflowPath: upscaleImageWorkflow.path }],
      runs: [],
      assets: [],
      takes: [],
      entities: [],
      textItems: [],
    } as unknown as ProjectSnapshot;
    const controls = {
      settings: {
        recipePath: upscaleImageWorkflow.path,
        prompt: "",
        denoise: 2,
      } as unknown as ShotCanvasControls["settings"],
      workflows: [upscaleImageWorkflow],
      workflowLocked: false,
      mentionAliases: [],
      busy: false,
      progress: null,
      disabledReason: null,
      onWorkflowChange: () => {},
      onSettingsChange: () => {},
      onGenerate: () => {},
      onOpenDetails: () => {},
      onOpenWorkflows: () => {},
      onCommitTitle: () => {},
    };
    const nodes = boardNodes(snap, "shot-node", "demo", [upscaleImageWorkflow], upscaleImageWorkflow, "shot-1", controls);
    const shotNode = nodes.find((n) => n.id === "shot-node");
    expect(shotNode?.data.inlineControls?.supportsResolution).toBe(false);
    expect(shotNode?.data.inlineControls?.supportsSeed).toBe(false);
    expect(shotNode?.data.inlineControls?.supportsDuration).toBe(false);
    expect(shotNode?.data.inlineControls?.supportsFps).toBe(false);
    expect(shotNode?.data.inlineControls?.supportsDenoise).toBe(true);
    expect(shotNode?.data.inlineControls?.denoiseLabel).toBe("放大倍数");
    expect(shotNode?.data.inlineControls?.denoise).toBe(2);
    expect(shotNode?.data.inlineControls?.denoiseMin).toBe(1);
    expect(shotNode?.data.inlineControls?.denoiseMax).toBe(8);
  });

  it("formats shot overlay facts with resolution in bottom right corner", () => {
    expect(
      shotMediaFactsText({
        mediaType: "image",
        width: 1024,
        height: 1024,
      }),
    ).toBe("1024 × 1024 · 图片");

    expect(
      shotMediaFactsText({
        mediaType: "image",
      }),
    ).toBe("图片");

    expect(
      shotMediaFactsText({
        mediaType: "video",
        width: 1280,
        height: 720,
        duration: 5.17,
      }),
    ).toBe("1280 × 720 · 5.17 秒 · 视频");

    expect(
      shotMediaFactsText({
        mediaType: "video",
        width: 1920,
        height: 1080,
      }),
    ).toBe("1920 × 1080 · 视频");

    expect(
      shotMediaFactsText({
        mediaType: "video",
        duration: 5.17,
      }),
    ).toBe("5.17 秒 · 视频");
  });
});
