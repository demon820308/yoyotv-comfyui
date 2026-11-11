import { nativeRecipePrompt } from "@takeboard/executor-comfy";
import { workflowHash } from "./workflow-bindings.js";
import { WorkflowExecutionError } from "./workflow-errors.js";

/** Maintained, content-addressed artifacts must never silently run a different graph.
 * Legacy Kino source canvases remain adapter-backed; editing them requires an editable copy.
 * shortcut: legacy Kino/TakeBoard/ path integrity check is deprecated and will be removed in v2.0.0
 */
export function assertNativeWorkflowIntegrity(path: string, source: unknown) {
  if (!path.startsWith("Kino/TakeBoard/") && !path.startsWith("Trust-Workflow/")) return;
  const address = /^(?:Kino\/TakeBoard\/|Trust-Workflow\/)([a-f0-9]{16})\//.exec(path)?.[1];
  const maintained = nativeRecipePrompt(path);
  const sourceHash = workflowHash(source);
  if (
    !address ||
    !maintained ||
    !sourceHash.startsWith(address) ||
    sourceHash !== workflowHash(maintained)
  )
    throw new WorkflowExecutionError(
      "WORKFLOW_TEMPLATE_CHANGED",
      "推荐模板已修改或需要更新。请创建可编辑副本使用修改后的配置，或添加当前版本模板。",
      path,
    );
}
