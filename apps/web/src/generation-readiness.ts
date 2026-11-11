import type { ProjectSnapshot } from "@takeboard/contracts";
import type { WorkflowSummary } from "./api";
import type { GenerationSettings } from "./generation-model";
import { generationStepPolicy, type modelProfile } from "./model-profiles";
import { workflowAvailability } from "./workflow-library";

export function generationProblem({
  projectMode,
  selectedWorkflow,
  generationSettings,
  selectedModelProfile,
  selectedInputCounts,
  assets,
}: {
  projectMode: "demo" | "project";
  selectedWorkflow: WorkflowSummary | null;
  generationSettings: GenerationSettings;
  selectedModelProfile: ReturnType<typeof modelProfile>;
  selectedInputCounts: { reference: number; reference_video: number; reference_audio: number };
  assets: ProjectSnapshot["assets"];
}) {
  const firstFrameAsset = assets.find(
    (asset) => asset.mediaType === "image" && asset.id === generationSettings.firstFrameAssetId,
  );
  const firstFrameAvailable = Boolean(firstFrameAsset);
  const lastFrameAvailable = assets.some(
    (asset) => asset.mediaType === "image" && asset.id === generationSettings.lastFrameAssetId,
  );
  const maskAvailable =
    assets.some(
      (asset) => asset.mediaType === "image" && asset.id === generationSettings.maskAssetId,
    ) || Boolean(firstFrameAsset?.maskPath);
  if (projectMode === "demo") return null;
  if (!selectedWorkflow) return "请先选择可用模型";
  const availability = workflowAvailability(selectedWorkflow);
  if (!availability.ready) return `工作流${availability.label}：${availability.reason}`;
  const isUpscale = ["upscale_image", "upscale_video"].includes(selectedWorkflow.capability);
  const isMaskWorkflow = selectedWorkflow.inputs.includes("mask");
  if (!isUpscale && !isMaskWorkflow && !generationSettings.prompt.trim()) return "请先输入镜头提示词";
  if (selectedWorkflow.inputs.includes("first_frame") && !firstFrameAvailable) {
    return ["image_to_image", "upscale_image"].includes(selectedWorkflow.capability)
      ? "请连接一张源图"
      : "请从资产库选择一张起始帧";
  }
  if (isMaskWorkflow && !maskAvailable) {
    return "请先绘制或连接遮罩";
  }
  if (
    selectedWorkflow.capability === "upscale_video" &&
    selectedInputCounts.reference_video === 0
  ) {
    return "视频放大需要连接一段源视频";
  }
  if (selectedWorkflow.capability === "first_last_video" && !lastFrameAvailable) {
    return "首尾帧模式还需要一张结束帧";
  }
  if (
    selectedWorkflow.capability === "reference_video" &&
    selectedInputCounts.reference +
      selectedInputCounts.reference_video +
      selectedInputCounts.reference_audio ===
      0
  ) {
    return "Ref2VA 至少需要一张参考图、一段参考视频或参考音频";
  }
  const imageWorkflow = ["text_to_image", "image_to_image", "upscale_image"].includes(
    selectedWorkflow.capability,
  );
  const invalidVideoParameters =
    !imageWorkflow &&
    ((selectedWorkflow.inputs.includes("duration") &&
      (!Number.isFinite(generationSettings.durationSeconds) ||
        generationSettings.durationSeconds < 1 ||
        generationSettings.durationSeconds > 15)) ||
      (selectedWorkflow.inputs.includes("fps") &&
        (!Number.isFinite(generationSettings.fps) ||
          generationSettings.fps < 8 ||
          generationSettings.fps > 60)));
  const invalidDenoise =
    selectedWorkflow.inputs.includes("denoise") &&
    (!Number.isFinite(generationSettings.denoise) ||
      generationSettings.denoise < 0.05 ||
      generationSettings.denoise > (isUpscale ? 16 : 1));
  const stepPolicy = generationStepPolicy(selectedWorkflow);
  const invalidResolution =
    selectedWorkflow.inputs.includes("resolution") &&
    (!Number.isFinite(generationSettings.width) ||
      generationSettings.width < 256 ||
      generationSettings.width > 4096 ||
      !Number.isFinite(generationSettings.height) ||
      generationSettings.height < 256 ||
      generationSettings.height > 4096);
  const invalidSeed =
    selectedWorkflow.inputs.includes("seed") &&
    (!Number.isSafeInteger(generationSettings.seed) || generationSettings.seed < 0);
  const invalidSteps =
    selectedWorkflow.inputs.includes("steps") &&
    !stepPolicy.fixed &&
    (!Number.isSafeInteger(generationSettings.steps) ||
      generationSettings.steps < stepPolicy.min ||
      generationSettings.steps > stepPolicy.max);
  if (
    invalidResolution ||
    invalidVideoParameters ||
    invalidDenoise ||
    invalidSeed ||
    invalidSteps
  ) {
    return imageWorkflow
      ? "请检查分辨率、Steps、重绘强度和 Seed"
      : "请检查分辨率、时长、帧率和 Seed";
  }
  return null;
}
