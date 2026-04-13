import * as Predicate from "effect/Predicate"
import type * as Response from "effect/unstable/ai/Response"
import type { StopReason } from "../AmazonBedrockSchema.ts"

const finishReasonMap: Record<StopReason, Response.FinishReason> = {
  content_filtered: "content-filter",
  end_turn: "stop",
  guardrail_intervened: "content-filter",
  max_tokens: "length",
  stop_sequence: "stop",
  tool_use: "tool-calls"
}

/** @internal */
export const resolveFinishReason = (stopReason: StopReason): Response.FinishReason => {
  const reason = finishReasonMap[stopReason]
  return Predicate.isUndefined(reason) ? "unknown" : reason
}
