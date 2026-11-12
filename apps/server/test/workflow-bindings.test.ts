import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  applyWorkflowBinding,
  clearComfyObjectInfoCache,
  disableTrustWorkflow,
  discoverBindingCandidates,
  fetchComfyObjectInfo,
  loadExecutableWorkflow,
  readTrustWorkflow,
  suggestedBinding,
  validateWorkflowBinding,
  type WorkflowBinding,
  workflowHash,
  writeTrustWorkflow,
} from "../src/workflow-bindings.js";

const binding: WorkflowBinding = {
  version: 1,
  workflowPath: "TakeBoard/custom.json",
  workflowHash: "hash",
  capability: "image_to_video",
  outputMediaType: "video",
  parameters: {
    prompt: [{ nodeId: "text", input: "value" }],
    seed: [{ nodeId: "sampler", input: "seed" }],
    denoise: [{ nodeId: "sampler", input: "denoise" }],
    duration: [{ nodeId: "video", input: "duration", transform: "seconds_to_frames" }],
  },
  media: { first_frame: [{ nodeId: "image", input: "image" }] },
  trusted: true,
  verifiedAt: "2026-08-27T00:00:00.000Z",
};

describe("workflow binding execution", () => {
  it("injects project values into a cloned prompt and scopes output filenames", () => {
    const source = {
      text: { class_type: "TextNode", inputs: { value: "old" } },
      image: { class_type: "LoadImage", inputs: { image: "old.png" } },
      sampler: { class_type: "Sampler", inputs: { seed: 1, denoise: 1 } },
      video: { class_type: "VideoNode", inputs: { duration: 3 } },
      save: { class_type: "SaveVideo", inputs: { filename_prefix: "unsafe/default" } },
    };
    const result = applyWorkflowBinding(source, binding, {
      prompt: "new prompt",
      seed: 42,
      denoise: 0.55,
      duration: 7,
      fps: 24,
      firstFrame: "takeboard/input.png",
      filenamePrefix: "takeboard/project/shot/run/result",
    });
    expect(result.text?.inputs.value).toBe("new prompt");
    expect(result.image?.inputs.image).toBe("takeboard/input.png");
    expect(result.sampler?.inputs.seed).toBe(42);
    expect(result.sampler?.inputs.denoise).toBe(0.55);
    expect(result.video?.inputs.duration).toBe(168);
    expect(result.save?.inputs.filename_prefix).toBe("takeboard/project/shot/run/result");
    expect(source.text.inputs.value).toBe("old");
  });

  it("recognizes frame-count controls and suggests a safe FPS conversion", () => {
    const candidates = discoverBindingCandidates({
      video: {
        class_type: "CreateVideo",
        inputs: { num_frames: 81, frame_rate: 24 },
        _meta: { title: "Video length" },
      },
    });
    expect(candidates.parameters.duration).toEqual([
      expect.objectContaining({
        nodeId: "video",
        input: "num_frames",
        suggestedTransform: "seconds_to_frames",
      }),
    ]);
    expect(candidates.parameters.fps).toEqual([
      expect.objectContaining({ nodeId: "video", input: "frame_rate" }),
    ]);
  });

  it("uses a canonical content hash and rejects missing binding targets", () => {
    expect(workflowHash({ b: 2, a: { d: 4, c: 3 } })).toBe(
      workflowHash({ a: { c: 3, d: 4 }, b: 2 }),
    );
    const issues = validateWorkflowBinding(
      { save: { class_type: "SaveVideo", inputs: { filename_prefix: "output" } } },
      binding,
    );
    expect(issues).toEqual(
      expect.arrayContaining([expect.stringContaining("节点 text.value 不存在")]),
    );
  });
  it("requires an explicit FPS binding for frame-count conversion", () => {
    const prompt = {
      video: { class_type: "CreateVideo", inputs: { frames: 121, fps: 24, text: "a cat" } },
    };
    const frames: WorkflowBinding = {
      ...binding,
      capability: "text_to_video",
      media: {},
      parameters: {
        prompt: [{ nodeId: "video", input: "text" }],
        duration: [{ nodeId: "video", input: "frames", transform: "seconds_to_frames_plus_one" }],
      },
    };
    expect(validateWorkflowBinding(prompt, frames)).toContain(
      "duration：使用秒到帧数换算时，必须绑定输出帧率 FPS，避免表单帧率与实际视频不一致",
    );
    expect(
      validateWorkflowBinding(prompt, {
        ...frames,
        parameters: { ...frames.parameters, fps: [{ nodeId: "video", input: "fps" }] },
      }),
    ).toEqual([]);
  });

  it("suggests reference-only bindings for reference_video and prunes unsupplied reference slots", () => {
    const prompt = {
      ref0: { class_type: "LoadImage", inputs: { image: "ref0.png" } },
      ref1: { class_type: "LoadImage", inputs: { image: "ref1.png" } },
      h3: {
        class_type: "MiniMaxH3ReferenceToVideo",
        inputs: {
          prompt: "shot",
          "ref_images.ref_image_0": ["ref0", 0],
          "ref_images.ref_image_1": ["ref1", 0],
        },
      },
      save: { class_type: "SaveVideo", inputs: { filename_prefix: "out" } },
    };
    const candidates = discoverBindingCandidates(prompt);
    const suggested = suggestedBinding(
      "custom-ref2v.json",
      "test-hash",
      "reference_video",
      "video",
      candidates,
    );
    expect(suggested.media.first_frame).toBeUndefined();
    expect(suggested.media.reference_image).toEqual([
      { nodeId: "ref0", input: "image" },
      { nodeId: "ref1", input: "image" },
    ]);

    const singleImageResult = applyWorkflowBinding(
      prompt,
      {
        ...suggested,
        trusted: true,
        verifiedAt: "2026-11-08T00:00:00.000Z",
      } as unknown as WorkflowBinding,
      {
        prompt: "action",
        referenceImages: ["actual-char.png"],
        filenamePrefix: "test",
      },
    );
    expect(singleImageResult.ref0?.inputs.image).toBe("actual-char.png");
    expect(singleImageResult.ref1).toBeUndefined();
    expect(singleImageResult.h3?.inputs["ref_images.ref_image_0"]).toEqual(["ref0", 0]);
    expect(singleImageResult.h3?.inputs["ref_images.ref_image_1"]).toBeUndefined();
  });

  it("saves, reads, executes and disables snapshots in Trust-Workflow directory", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "trust-wf-test-"));
    try {
      const mockWorkflow = {
        nodes: [
          { type: "PromptNode", id: 1, widgets_values: ["hello"] },
          { type: "SaveImage", id: 2, widgets_values: [] },
        ],
      };
      const mockBinding: WorkflowBinding = {
        version: 1,
        workflowPath: "test_workflow.json",
        workflowHash: workflowHash(mockWorkflow),
        capability: "text_to_image",
        outputMediaType: "image",
        parameters: { prompt: [{ nodeId: "1", input: "prompt" }] },
        media: {},
        trusted: true,
        verifiedAt: new Date().toISOString(),
      };

      writeTrustWorkflow("test_workflow.json", mockWorkflow, mockBinding, tempDir);
      const snapshot = readTrustWorkflow("test_workflow.json", tempDir);
      expect(snapshot).not.toBeNull();
      expect(snapshot?.binding.workflowHash).toBe(mockBinding.workflowHash);

      // Verify loadExecutableWorkflow reads snapshot without error
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: string | URL | Request) => {
          const url = String(input);
          if (url.includes("/object_info")) {
            return Response.json({
              PromptNode: { input: { required: { prompt: ["STRING", {}] } } },
              SaveImage: { input: { required: {} } },
            });
          }
          return Response.json({});
        }),
      );

      process.env.YOYOTV_TRUST_WORKFLOW_DIR = tempDir;
      const loaded = await loadExecutableWorkflow("http://127.0.0.1:8188", "test_workflow.json");
      expect(loaded.binding.workflowHash).toBe(mockBinding.workflowHash);

      // Test disable
      disableTrustWorkflow("test_workflow.json", tempDir);
      expect(readTrustWorkflow("test_workflow.json", tempDir)).toBeNull();

      // Test upscale binding round-trip
      const upscaleBinding: WorkflowBinding = {
        ...mockBinding,
        capability: "upscale_image",
        outputMediaType: "image",
      };
      writeTrustWorkflow("test_upscale.json", mockWorkflow, upscaleBinding, tempDir);
      const readUpscale = readTrustWorkflow("test_upscale.json", tempDir);
      expect(readUpscale?.binding.capability).toBe("upscale_image");
      expect(readUpscale?.binding.trusted).toBe(true);
    } finally {
      delete process.env.YOYOTV_TRUST_WORKFLOW_DIR;
      delete process.env.TAKEBOARD_TRUST_WORKFLOW_DIR;
      vi.unstubAllGlobals();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("applies model override bindings during execution", () => {
    const source = {
      unet: { class_type: "UNETLoader", inputs: { unet_name: "default_model.safetensors" } },
      save: { class_type: "SaveImage", inputs: { filename_prefix: "out" } },
    };
    const bindingWithModel: WorkflowBinding = {
      ...binding,
      capability: "text_to_image",
      outputMediaType: "image",
      parameters: {},
      media: {},
      models: {
        "unet.unet_name": {
          nodeId: "unet",
          input: "unet_name",
          defaultModel: "default_model.safetensors",
          selectedModel: "custom_fp8_model.safetensors",
        },
      },
    };
    const result = applyWorkflowBinding(source, bindingWithModel, {
      filenamePrefix: "test/prefix",
    });
    expect(result.unet?.inputs.unet_name).toBe("custom_fp8_model.safetensors");
    expect(source.unet.inputs.unet_name).toBe("default_model.safetensors");
  });

  it("caches object_info responses when maxAgeMs is set and re-fetches on force", async () => {
    clearComfyObjectInfoCache();
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      calls++;
      return new Response(JSON.stringify({ TestNode: {} }), { status: 200 });
    }));
    try {
      const first = await fetchComfyObjectInfo("http://127.0.0.1:9999", { maxAgeMs: 5000 });
      const second = await fetchComfyObjectInfo("http://127.0.0.1:9999", { maxAgeMs: 5000 });
      expect(calls).toBe(1);
      expect(first).toEqual(second);

      await fetchComfyObjectInfo("http://127.0.0.1:9999", { force: true, maxAgeMs: 5000 });
      expect(calls).toBe(2);
    } finally {
      clearComfyObjectInfoCache();
      vi.unstubAllGlobals();
    }
  });
});
