/**
 * OpenAI provider-defined tools for use with the LanguageModel.
 *
 * Provides tools that are natively supported by OpenAI's API, including
 * code interpreter, file search, and web search functionality.
 *
 * @since 1.0.0
 */
import * as Schema from "effect/Schema"
import * as Tool from "effect/unstable/ai/Tool"
import * as Generated from "./Generated.ts"

/**
 * Union of all OpenAI provider-defined tools.
 *
 * @since 1.0.0
 * @category models
 */
export type OpenAiTool =
  | ReturnType<typeof ApplyPatch>
  | ReturnType<typeof CodeInterpreter>
  | ReturnType<typeof FileSearch>
  | ReturnType<typeof Shell>
  | ReturnType<typeof ImageGeneration>
  | ReturnType<typeof LocalShell>
  | ReturnType<typeof Mcp>
  | ReturnType<typeof WebSearch>
  | ReturnType<typeof WebSearchPreview>

/**
 * OpenAI Apply Patch tool.
 *
 * Allows the model to apply diffs by creating, deleting, or updating files.
 * This is a local tool that runs in your environment and requires a handler
 * to execute file operations.
 *
 * @since 1.0.0
 * @category tools
 */
export const ApplyPatch = Tool.providerDefined({
  customName: "OpenAiApplyPatch",
  providerName: "apply_patch",
  requiresHandler: true,
  args: {},
  parameters: {
    call_id: Generated.ApplyPatchToolCall.fields.call_id,
    operation: Generated.ApplyPatchToolCall.fields.operation
  },
  success: Schema.Struct({
    status: Generated.ApplyPatchToolCallOutput.fields.status,
    output: Generated.ApplyPatchToolCallOutput.fields.output
  })
})

/**
 * OpenAI Code Interpreter tool.
 *
 * Allows the model to execute Python code in a sandboxed environment.
 *
 * @since 1.0.0
 * @category tools
 */
export const CodeInterpreter = Tool.providerDefined({
  customName: "OpenAiCodeInterpreter",
  providerName: "code_interpreter",
  args: {
    container: Generated.CodeInterpreterTool.fields.container
  },
  parameters: {
    code: Generated.CodeInterpreterToolCall.fields.code,
    container_id: Generated.CodeInterpreterToolCall.fields.container_id
  },
  success: Schema.Struct({
    outputs: Generated.CodeInterpreterToolCall.fields.outputs
  })
})

/**
 * OpenAI File Search tool.
 *
 * Enables the model to search through uploaded files and vector stores.
 *
 * @since 1.0.0
 * @category tools
 */
export const FileSearch = Tool.providerDefined({
  customName: "OpenAiFileSearch",
  providerName: "file_search",
  args: {
    filters: Generated.FileSearchTool.fields.filters,
    max_num_results: Generated.FileSearchTool.fields.max_num_results,
    ranking_options: Generated.FileSearchTool.fields.ranking_options,
    vector_store_ids: Generated.FileSearchTool.fields.vector_store_ids
  },
  success: Schema.Struct({
    status: Generated.FileSearchToolCall.fields.status,
    queries: Generated.FileSearchToolCall.fields.queries,
    results: Generated.FileSearchToolCall.fields.results
  })
})

/**
 * OpenAI Image Generation tool.
 *
 * Enables the model to generate images using the GPT image models.
 *
 * @since 1.0.0
 * @category tools
 */
export const ImageGeneration = Tool.providerDefined({
  customName: "OpenAiImageGeneration",
  providerName: "image_generation",
  args: {
    background: Generated.ImageGenTool.fields.background,
    input_fidelity: Generated.ImageGenTool.fields.input_fidelity,
    input_image_mask: Generated.ImageGenTool.fields.input_image_mask,
    model: Generated.ImageGenTool.fields.model,
    moderation: Generated.ImageGenTool.fields.moderation,
    output_compression: Generated.ImageGenTool.fields.output_compression,
    output_format: Generated.ImageGenTool.fields.output_format,
    partial_images: Generated.ImageGenTool.fields.partial_images,
    quality: Generated.ImageGenTool.fields.quality,
    size: Generated.ImageGenTool.fields.size
  },
  success: Schema.Struct({
    result: Generated.ImageGenToolCall.fields.result
  })
})

/**
 * OpenAI Local Shell tool.
 *
 * Enables the model to run a command with a local shell. This is a local tool
 * that runs in your environment and requires a handler to execute commands.
 *
 * @since 1.0.0
 * @category tools
 */
export const LocalShell = Tool.providerDefined({
  customName: "OpenAiLocalShell",
  providerName: "local_shell",
  requiresHandler: true,
  args: {},
  parameters: {
    action: Generated.LocalShellToolCall.fields.action
  },
  success: Schema.Struct({
    output: Generated.LocalShellToolCallOutput.fields.output
  })
})

/**
 * OpenAI MCP tool.
 *
 * Gives the model access to additional tools via remote Model Context Protocol
 * (MCP) servers
 *
 * @since 1.0.0
 * @category tools
 */
export const Mcp = Tool.providerDefined({
  customName: "OpenAiMcp",
  providerName: "mcp",
  args: {
    allowed_tools: Generated.MCPTool.fields.allowed_tools,
    authorization: Generated.MCPTool.fields.authorization,
    connector_id: Generated.MCPTool.fields.connector_id,
    require_approval: Generated.MCPTool.fields.require_approval,
    server_description: Generated.MCPTool.fields.server_description,
    server_label: Generated.MCPTool.fields.server_label,
    server_url: Generated.MCPTool.fields.server_url
  },
  success: Schema.Struct({
    type: Generated.MCPToolCall.fields.type,
    name: Generated.MCPToolCall.fields.name,
    arguments: Generated.MCPToolCall.fields.arguments,
    output: Generated.MCPToolCall.fields.output,
    error: Generated.MCPToolCall.fields.error,
    server_label: Generated.MCPToolCall.fields.server_label
  })
})

/**
 * OpenAI Function Shell tool.
 *
 * Enables the model to execute one or more shell commands in a managed
 * environment. This is a local tool that runs in your environment and requires
 * a handler to execute commands.
 *
 * @since 1.0.0
 * @category tools
 */
export const Shell = Tool.providerDefined({
  customName: "OpenAiShell",
  providerName: "shell",
  requiresHandler: true,
  args: {},
  parameters: {
    action: Generated.FunctionShellCall.fields.action
  },
  success: Schema.Struct({
    output: Generated.FunctionShellCallOutputItemParam.fields.output
  })
})

/**
 * OpenAI Web Search tool.
 *
 * Enables the model to search the web for information.
 *
 * @since 1.0.0
 * @category tools
 */
export const WebSearch = Tool.providerDefined({
  customName: "OpenAiWebSearch",
  providerName: "web_search",
  args: {
    filters: Generated.WebSearchTool.fields.filters,
    user_location: Generated.WebSearchTool.fields.user_location,
    search_context_size: Generated.WebSearchTool.fields.search_context_size
  },
  parameters: {
    action: Generated.WebSearchToolCall.fields.action
  },
  success: Schema.Struct({
    action: Generated.WebSearchToolCall.fields.action,
    status: Generated.WebSearchToolCall.fields.status
  })
})

/**
 * OpenAI Web Search Preview tool.
 *
 * Preview version of the web search tool with additional features.
 *
 * @since 1.0.0
 * @category tools
 */
export const WebSearchPreview = Tool.providerDefined({
  customName: "OpenAiWebSearchPreview",
  providerName: "web_search_preview",
  args: {
    user_location: Generated.WebSearchPreviewTool.fields.user_location,
    search_context_size: Generated.WebSearchPreviewTool.fields.search_context_size
  },
  parameters: {},
  success: Schema.Struct({
    action: Generated.WebSearchToolCall.fields.action,
    status: Generated.WebSearchToolCall.fields.status
  })
})

/**
 * Creates an OpenAI-specific tool name mapper.
 *
 * @since 1.0.0
 * @category utilities
 */
export const createToolNameMapper = Tool.NameMapper.forProvider({
  OpenAiApplyPatch: "apply_patch",
  OpenAiCodeInterpreter: "code_interpreter",
  OpenAiFileSearch: "file_search",
  OpenAiShell: "shell",
  OpenAiImageGeneration: "image_generation",
  OpenAiLocalShell: "local_shell",
  OpenAiMcp: "mcp",
  OpenAiWebSearch: "web_search",
  OpenAiWebSearchPreview: "web_search_preview"
})
