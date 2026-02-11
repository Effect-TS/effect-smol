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
import * as OpenAiSchema from "./OpenAiSchema.ts"

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
  id: "openai.apply_patch",
  customName: "OpenAiApplyPatch",
  providerName: "apply_patch",
  requiresHandler: true,
  parameters: Schema.Struct({
    call_id: OpenAiSchema.ApplyPatchToolCall.fields.call_id,
    operation: OpenAiSchema.ApplyPatchToolCall.fields.operation
  }),
  success: Schema.Struct({
    status: OpenAiSchema.ApplyPatchToolCallOutput.fields.status,
    output: OpenAiSchema.ApplyPatchToolCallOutput.fields.output
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
  id: "openai.code_interpreter",
  customName: "OpenAiCodeInterpreter",
  providerName: "code_interpreter",
  args: Schema.Struct({
    container: OpenAiSchema.CodeInterpreterTool.fields.container
  }),
  parameters: Schema.Struct({
    code: OpenAiSchema.CodeInterpreterToolCall.fields.code,
    container_id: OpenAiSchema.CodeInterpreterToolCall.fields.container_id
  }),
  success: Schema.Struct({
    outputs: OpenAiSchema.CodeInterpreterToolCall.fields.outputs
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
  id: "openai.file_search",
  customName: "OpenAiFileSearch",
  providerName: "file_search",
  args: Schema.Struct({
    filters: OpenAiSchema.FileSearchTool.fields.filters,
    max_num_results: OpenAiSchema.FileSearchTool.fields.max_num_results,
    ranking_options: OpenAiSchema.FileSearchTool.fields.ranking_options,
    vector_store_ids: OpenAiSchema.FileSearchTool.fields.vector_store_ids
  }),
  success: Schema.Struct({
    status: OpenAiSchema.FileSearchToolCall.fields.status,
    queries: OpenAiSchema.FileSearchToolCall.fields.queries,
    results: OpenAiSchema.FileSearchToolCall.fields.results
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
  id: "openai.image_generation",
  customName: "OpenAiImageGeneration",
  providerName: "image_generation",
  args: Schema.Struct({
    background: OpenAiSchema.ImageGenTool.fields.background,
    input_fidelity: OpenAiSchema.ImageGenTool.fields.input_fidelity,
    input_image_mask: OpenAiSchema.ImageGenTool.fields.input_image_mask,
    model: OpenAiSchema.ImageGenTool.fields.model,
    moderation: OpenAiSchema.ImageGenTool.fields.moderation,
    output_compression: OpenAiSchema.ImageGenTool.fields.output_compression,
    output_format: OpenAiSchema.ImageGenTool.fields.output_format,
    partial_images: OpenAiSchema.ImageGenTool.fields.partial_images,
    quality: OpenAiSchema.ImageGenTool.fields.quality,
    size: OpenAiSchema.ImageGenTool.fields.size
  }),
  success: Schema.Struct({
    result: OpenAiSchema.ImageGenToolCall.fields.result
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
  id: "openai.local_shell",
  customName: "OpenAiLocalShell",
  providerName: "local_shell",
  requiresHandler: true,
  parameters: Schema.Struct({
    action: OpenAiSchema.LocalShellToolCall.fields.action
  }),
  success: Schema.Struct({
    output: OpenAiSchema.LocalShellToolCallOutput.fields.output
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
  id: "openai.mcp",
  customName: "OpenAiMcp",
  providerName: "mcp",
  args: Schema.Struct({
    allowed_tools: OpenAiSchema.MCPTool.fields.allowed_tools,
    authorization: OpenAiSchema.MCPTool.fields.authorization,
    connector_id: OpenAiSchema.MCPTool.fields.connector_id,
    require_approval: OpenAiSchema.MCPTool.fields.require_approval,
    server_description: OpenAiSchema.MCPTool.fields.server_description,
    server_label: OpenAiSchema.MCPTool.fields.server_label,
    server_url: OpenAiSchema.MCPTool.fields.server_url
  }),
  success: Schema.Struct({
    type: OpenAiSchema.MCPToolCall.fields.type,
    name: OpenAiSchema.MCPToolCall.fields.name,
    arguments: OpenAiSchema.MCPToolCall.fields.arguments,
    output: OpenAiSchema.MCPToolCall.fields.output,
    error: OpenAiSchema.MCPToolCall.fields.error,
    server_label: OpenAiSchema.MCPToolCall.fields.server_label
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
  id: "openai.shell",
  customName: "OpenAiShell",
  providerName: "shell",
  requiresHandler: true,
  parameters: Schema.Struct({
    action: OpenAiSchema.FunctionShellCall.fields.action
  }),
  success: Schema.Struct({
    output: OpenAiSchema.FunctionShellCallOutputItemParam.fields.output
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
  id: "openai.web_search",
  customName: "OpenAiWebSearch",
  providerName: "web_search",
  args: Schema.Struct({
    filters: OpenAiSchema.WebSearchTool.fields.filters,
    user_location: OpenAiSchema.WebSearchTool.fields.user_location,
    search_context_size: OpenAiSchema.WebSearchTool.fields.search_context_size
  }),
  parameters: Schema.Struct({
    action: OpenAiSchema.WebSearchToolCall.fields.action
  }),
  success: Schema.Struct({
    action: OpenAiSchema.WebSearchToolCall.fields.action,
    status: OpenAiSchema.WebSearchToolCall.fields.status
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
  id: "openai.web_search_preview",
  customName: "OpenAiWebSearchPreview",
  providerName: "web_search_preview",
  args: Schema.Struct({
    user_location: OpenAiSchema.WebSearchPreviewTool.fields.user_location,
    search_context_size: OpenAiSchema.WebSearchPreviewTool.fields.search_context_size
  }),
  success: Schema.Struct({
    action: OpenAiSchema.WebSearchToolCall.fields.action,
    status: OpenAiSchema.WebSearchToolCall.fields.status
  })
})
