/**
 * @since 1.0.0
 */
import * as Schema from "effect/Schema"
import * as Tool from "effect/unstable/ai/Tool"
import * as Generated from "./Generated.ts"

export const Bash_20241022 = Tool.providerDefined({
  customName: "AnthropicBash_20241022",
  providerName: "bash",
  requiresHandler: true,
  args: {},
  success: Schema.String,
  parameters: {
    /**
     * The Bash command to run.
     */
    command: Schema.String,
    /**
     * If `true`, restart the Bash session.
     */
    restart: Schema.optional(Schema.Boolean)
  }
})

export const Bash_20250124 = Tool.providerDefined({
  customName: "AnthropicBash_20250124",
  providerName: "bash",
  requiresHandler: true,
  args: {},
  success: Schema.String,
  parameters: {
    /**
     * The Bash command to run.
     */
    command: Schema.String,
    /**
     * If `true`, restart the Bash session.
     */
    restart: Schema.optional(Schema.Boolean)
  }
})
