import { type ResolutionPolicy, resolveGenerationResolution } from "@yoyotv/contracts/generation";

export function generationResolutionPolicy(native: boolean, family: string): ResolutionPolicy {
  if (!native) return "exact";
  if (family === "qwen_image") return "qwen_image_2512";
  if (family === "minimax_h3") return "minimax_h3";
  return "multiple_32";
}

export const standardAspectRatios = [
  ["1:1 (Square)", 1, 1],
  ["2:3 (Portrait Photo)", 2, 3],
  ["3:2 (Photo)", 3, 2],
  ["3:4 (Portrait Standard)", 3, 4],
  ["4:3 (Standard)", 4, 3],
  ["9:16 (Portrait Widescreen)", 9, 16],
  ["16:9 (Widescreen)", 16, 9],
  ["21:9 (Ultrawide)", 21, 9],
] as const;

export function megapixelsFromResolution(width: number, height: number) {
  return Math.max(0.1, Math.round(((width * height) / (1024 * 1024)) * 10) / 10);
}

function fitDimensions(wRatio: number, hRatio: number, totalPixels: number) {
  const scale = Math.sqrt(totalPixels / (wRatio * hRatio));
  let width = Math.max(256, Math.round((wRatio * scale) / 32) * 32);
  let height = Math.max(256, Math.round((hRatio * scale) / 32) * 32);
  if (width > 8192) {
    width = 8192;
    height = Math.max(256, Math.round((width * (hRatio / wRatio)) / 32) * 32);
  } else if (height > 8192) {
    height = 8192;
    width = Math.max(256, Math.round((height * (wRatio / hRatio)) / 32) * 32);
  }
  return { width, height };
}

/** Presets are concrete generation dimensions from the 32-multiple standard aspect ratio table. */
export function resolutionPresets(
  width: number,
  height: number,
  policy: ResolutionPolicy = "exact",
  _outputLabel?: "图片" | "视频",
) {
  const megapixels = megapixelsFromResolution(width, height);
  const totalPixels = megapixels * 1024 * 1024;
  return standardAspectRatios.map(([label, wRatio, hRatio]) => {
    const fitted = fitDimensions(wRatio, hRatio, totalPixels);
    const size = resolveGenerationResolution(policy, fitted.width, fitted.height).effective;
    return { label, ...size };
  });
}

export function scaleResolutionToMegapixels(
  width: number,
  height: number,
  megapixels: number,
  policy: ResolutionPolicy = "exact",
) {
  const currentPresets = resolutionPresets(width, height, policy);
  const matched = currentPresets.find((p) => p.width === width && p.height === height);
  const ratioEntry = matched
    ? standardAspectRatios.find(([label]) => label === matched.label)
    : undefined;
  const wRatio = ratioEntry ? ratioEntry[1] : width;
  const hRatio = ratioEntry ? ratioEntry[2] : height;
  const totalPixels = Math.max(0.1, megapixels) * 1024 * 1024;
  const fitted = fitDimensions(wRatio, hRatio, totalPixels);
  return resolveGenerationResolution(policy, fitted.width, fitted.height).effective;
}

export function closestAspectRatio(
  width: number,
  height: number,
  presets?: ReadonlyArray<{ label: string; width: number; height: number }>,
) {
  const candidatePresets = presets ?? resolutionPresets(width, height, "exact");
  const exact = candidatePresets.find(
    (preset) => preset.width === width && preset.height === height,
  );
  return exact ? exact.label : "custom";
}
