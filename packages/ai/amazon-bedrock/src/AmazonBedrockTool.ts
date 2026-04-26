/**
 * Amazon Bedrock provider-defined tools.
 *
 * Re-exports Anthropic tools for use with Amazon Bedrock when running
 * Anthropic models (e.g., Claude) on the Bedrock platform.
 *
 * @since 1.0.0
 */
import * as AnthropicTool from "@effect/ai-anthropic/AnthropicTool"

/**
 * @since 1.0.0
 * @category tools
 */
export const AnthropicBash_20241022 = AnthropicTool.Bash_20241022

/**
 * @since 1.0.0
 * @category tools
 */
export const AnthropicBash_20250124 = AnthropicTool.Bash_20250124

/**
 * @since 1.0.0
 * @category tools
 */
export const AnthropicComputerUse_20241022 = AnthropicTool.ComputerUse_20241022

/**
 * @since 1.0.0
 * @category tools
 */
export const AnthropicComputerUse_20250124 = AnthropicTool.ComputerUse_20250124

/**
 * @since 1.0.0
 * @category tools
 */
export const AnthropicComputerUse_20251124 = AnthropicTool.ComputerUse_20251124

/**
 * @since 1.0.0
 * @category tools
 */
export const AnthropicTextEditor_20241022 = AnthropicTool.TextEditor_20241022

/**
 * @since 1.0.0
 * @category tools
 */
export const AnthropicTextEditor_20250124 = AnthropicTool.TextEditor_20250124

/**
 * @since 1.0.0
 * @category tools
 */
export const AnthropicTextEditor_20250429 = AnthropicTool.TextEditor_20250429

/**
 * @since 1.0.0
 * @category tools
 */
export const AnthropicTextEditor_20250728 = AnthropicTool.TextEditor_20250728

/**
 * @since 1.0.0
 * @category tools
 */
export const AnthropicCodeExecution_20250522 = AnthropicTool.CodeExecution_20250522

/**
 * @since 1.0.0
 * @category tools
 */
export const AnthropicCodeExecution_20250825 = AnthropicTool.CodeExecution_20250825

/**
 * @since 1.0.0
 * @category tools
 */
export const AnthropicMemory_20250818 = AnthropicTool.Memory_20250818

/**
 * @since 1.0.0
 * @category tools
 */
export const AnthropicWebSearch_20250305 = AnthropicTool.WebSearch_20250305

/**
 * @since 1.0.0
 * @category tools
 */
export const AnthropicWebFetch_20250910 = AnthropicTool.WebFetch_20250910
