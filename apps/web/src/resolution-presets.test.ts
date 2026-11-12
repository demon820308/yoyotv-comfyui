import { resolveGenerationResolution } from "@yoyotv/contracts";
import { describe, expect, it } from "vitest";
import {
  closestAspectRatio,
  megapixelsFromResolution,
  resolutionPresets,
  scaleResolutionToMegapixels,
} from "./resolution-presets";

describe("generation aspect presets", () => {
  it.each(["exact", "multiple_32"] as const)(
    "keeps %s presets inside executable bounds",
    (policy) => {
      for (const preset of resolutionPresets(1344, 768, policy)) {
        expect(preset.width).toBeGreaterThanOrEqual(256);
        expect(preset.height).toBeGreaterThanOrEqual(256);
        expect(preset.width).toBeLessThanOrEqual(2048);
        expect(preset.height).toBeLessThanOrEqual(2048);
        expect(resolveGenerationResolution(policy, preset.width, preset.height).effective).toEqual({
          width: preset.width,
          height: preset.height,
        });
        expect(closestAspectRatio(preset.width, preset.height)).toBe(preset.label);
      }
    },
  );
  it("does not relabel arbitrary user dimensions as a standard aspect", () => {
    expect(closestAspectRatio(1000, 600)).toBe("custom");
    expect(closestAspectRatio(736, 416)).toBe("16:9 (Widescreen)");
  });
  it("builds all 8 ComfyUI ResolutionSelector aspect ratios for image and video workflows", () => {
    const presets = resolutionPresets(1248, 1664, "exact");
    expect(presets.map((p) => p.label)).toEqual([
      "1:1 (Square)",
      "2:3 (Portrait Photo)",
      "3:2 (Photo)",
      "3:4 (Portrait Standard)",
      "4:3 (Standard)",
      "9:16 (Portrait Widescreen)",
      "16:9 (Widescreen)",
      "21:9 (Ultrawide)",
    ]);
    expect(closestAspectRatio(1248, 1664, presets)).toBe("3:4 (Portrait Standard)");
    expect(megapixelsFromResolution(1376, 768)).toBe(1);
    expect(scaleResolutionToMegapixels(1376, 768, 2)).toEqual({ width: 1920, height: 1088 });
    expect(scaleResolutionToMegapixels(736, 416, 0.4)).toEqual({ width: 864, height: 480 });
    expect(scaleResolutionToMegapixels(2048, 2048, 8)).toEqual({ width: 2912, height: 2912 });
    expect(scaleResolutionToMegapixels(2048, 2048, 16)).toEqual({ width: 4096, height: 4096 });
    expect(scaleResolutionToMegapixels(1920, 1088, 16)).toEqual({ width: 5472, height: 3072 });
    expect(scaleResolutionToMegapixels(2560, 1088, 16)).toEqual({ width: 6272, height: 2688 });
  });
});
