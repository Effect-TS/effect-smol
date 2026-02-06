import { identity } from "../../../Function.ts"
import * as ServiceMap from "../../../ServiceMap.ts"
import type { CodecTransformer } from "../LanguageModel.ts"

/** @internal */
export const CurrentCodecTransformer = ServiceMap.Reference(
  "effect/unstable/ai/CodecTransformer",
  { defaultValue: () => identity as CodecTransformer }
)
