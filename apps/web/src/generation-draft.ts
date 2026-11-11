import type { ProjectSnapshot, Shot } from "@yoyotv/contracts";
import type { WorkflowSummary } from "./api";
import { defaultGenerationSettings, type GenerationSettings } from "./generation-model";
import { modelProfile } from "./model-profiles";

/** Defaults are scoped to the actual shot/workflow, never the previously selected draft. */
export function initialGenerationDraft(
  snapshot: ProjectSnapshot | null,
  shot: Shot | null,
  workflow: WorkflowSummary | null,
  preferences: Partial<GenerationSettings> = {},
): GenerationSettings {
  if (!shot || !snapshot) return { ...defaultGenerationSettings };
  const preferred = {
    ...modelProfile(workflow, shot.aspectRatio).defaults,
    ...workflow?.parameterDefaults,
    ...preferences,
  };
  const lastRun = [...snapshot.runs].reverse().find((run) => run.shotId === shot.id);
  const number = (name: string, fallback: number) =>
    typeof lastRun?.parameters[name] === "number" ? (lastRun.parameters[name] as number) : fallback;
  return {
    ...defaultGenerationSettings,
    ...preferred,
    recipePath: workflow?.path ?? shot.workflowPath ?? defaultGenerationSettings.recipePath,
    prompt:
      typeof lastRun?.parameters.promptSource === "string"
        ? lastRun.parameters.promptSource
        : typeof lastRun?.parameters.prompt === "string"
          ? lastRun.parameters.prompt
          : shot.intent,
    negativePrompt:
      typeof lastRun?.parameters.negativePrompt === "string"
        ? lastRun.parameters.negativePrompt
        : "",
    width: number("width", preferred.width),
    height: number("height", preferred.height),
    durationSeconds: number(
      "durationSeconds",
      workflow?.parameterDefaults?.durationSeconds ?? shot.durationSeconds,
    ),
    fps: number("fps", preferred.fps),
    steps: number("steps", preferred.steps),
    denoise: number("denoise", preferred.denoise),
    seed: number("seed", workflow?.parameterDefaults?.seed ?? defaultGenerationSettings.seed),
    referenceImageSize: lastRun?.parameters.referenceImageSize === "max" ? "max" : "match",
    referenceVideoAudio:
      typeof lastRun?.parameters.referenceVideoAudio === "boolean"
        ? lastRun.parameters.referenceVideoAudio
        : Boolean(lastRun),
    executionPolicy: lastRun?.execution?.policy ?? defaultGenerationSettings.executionPolicy,
  };
}

export function removePromptMention(prompt: string, alias: string): string {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return prompt
    .replace(new RegExp(`@${escaped}(?=[\\s，。；：、,.!?！？<>()\\[\\]{}“”‘’「」]|$)`, "g"), "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function togglePromptMention(prompt: string, alias: string, cursor?: number): string {
  if (prompt.includes(`@${alias}`)) {
    return removePromptMention(prompt, alias);
  }
  if (typeof cursor === "number" && cursor >= 0 && cursor <= prompt.length) {
    const before = prompt.slice(0, cursor).replace(/@[^\s，。；：,.!?]*$/, "");
    const after = prompt.slice(cursor);
    const beforeSpacer = before && !/\s$/.test(before) ? " " : "";
    const afterTrimmed = after.replace(/^\s+/, "");
    return `${before}${beforeSpacer}@${alias} ${afterTrimmed}`;
  }
  return `${prompt}${prompt && !/\s$/.test(prompt) ? " " : ""}@${alias} `;
}

export function splitPromptMentionSegments(
  prompt: string,
  aliases: string[] = [],
): { text: string; isMention: boolean }[] {
  if (!prompt) return [];
  const pattern = /@([^\s@，。；：、,.!?！？<>()[\]{}“”‘’「」]+)/g;
  const segments: { text: string; isMention: boolean }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(prompt)) !== null) {
    const [token, alias] = match;
    const offset = match.index;
    if (offset > lastIndex) {
      segments.push({ text: prompt.slice(lastIndex, offset), isMention: false });
    }
    const isMention = Boolean(alias && (aliases.length === 0 || aliases.includes(alias)));
    segments.push({ text: token, isMention });
    lastIndex = offset + token.length;
  }

  if (lastIndex < prompt.length) {
    segments.push({ text: prompt.slice(lastIndex), isMention: false });
  }

  return segments;
}
