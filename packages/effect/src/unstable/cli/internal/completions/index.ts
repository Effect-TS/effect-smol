/**
 * Dynamic completion system.
 *
 * Generates lightweight shell shims that call the CLI binary at runtime
 * to get completions. This approach is simpler to maintain and always
 * stays in sync with the actual parser.
 */

export {
  /** @internal */
  generateDynamicBashCompletion,
  /** @internal */
  generateDynamicCompletion,
  /** @internal */
  generateDynamicFishCompletion,
  /** @internal */
  generateDynamicZshCompletion,
  /** @internal */
  handleCompletionRequest,
  /** @internal */
  isCompletionRequest
} from "./dynamic/index.ts"

/** @internal */
export type { Shell, FlagDescriptor } from "./types.ts"
