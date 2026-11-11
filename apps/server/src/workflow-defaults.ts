import type { ComfyPrompt } from "@takeboard/executor-comfy";
import type { WorkflowBinding, WorkflowParameterKey } from "./workflow-bindings.js";

function resolveInputNumber(
  prompt: ComfyPrompt,
  nodeId: string,
  input: string,
): number | undefined {
  const raw = prompt[nodeId]?.inputs[input];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (Array.isArray(raw) && typeof raw[0] === "string") {
    const source = prompt[raw[0]];
    if (source?.class_type === "ResolutionSelector") {
      const mp = typeof source.inputs.megapixels === "number" ? source.inputs.megapixels : 0.6;
      const mult =
        typeof source.inputs.multiple === "number" && source.inputs.multiple > 0
          ? source.inputs.multiple
          : 32;
      const match = /(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/.exec(
        String(source.inputs.aspect_ratio ?? "16:9"),
      );
      const rw = match ? Number(match[1]) : 16;
      const rh = match ? Number(match[2]) : 9;
      const total = mp * 1024 * 1024;
      return input === "height" || raw[1] === 1
        ? Math.round(Math.sqrt((total * rh) / rw) / mult) * mult
        : Math.round(Math.sqrt((total * rw) / rh) / mult) * mult;
    }
  }
  return undefined;
}

/** Only expose unambiguous literal defaults, never infer values from node names. */
export function workflowDefaults(prompt: ComfyPrompt, binding: WorkflowBinding) {
  const defaults: Partial<
    Record<"width" | "height" | "fps" | "steps" | "denoise" | "seed" | "durationSeconds", number>
  > = {};
  const literal = (key: WorkflowParameterKey) => {
    const targets = binding.parameters[key] ?? [];
    const values = targets.map((target) => resolveInputNumber(prompt, target.nodeId, target.input));
    const first = values[0];
    return typeof first === "number" &&
      Number.isFinite(first) &&
      values.every((value) => value === first)
      ? first
      : undefined;
  };
  for (const key of ["width", "height", "fps", "steps", "denoise", "seed"] as const) {
    const value = literal(key);
    if (value !== undefined) defaults[key] = value;
  }
  const duration = binding.parameters.duration ?? [];
  const durations = duration.map((target) => {
    const value = prompt[target.nodeId]?.inputs[target.input];
    if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
    if (!target.transform) return value;
    if (!defaults.fps || defaults.fps <= 0) return undefined;
    const offset =
      target.transform === "seconds_to_frames_plus_one"
        ? 1
        : target.transform === "seconds_to_frames_minus_one"
          ? -1
          : 0;
    return (value - offset) / defaults.fps;
  });
  const seconds = durations[0];
  if (seconds !== undefined && seconds > 0 && durations.every((value) => value === seconds))
    defaults.durationSeconds = seconds;
  return defaults;
}
