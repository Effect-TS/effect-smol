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

const NullableString = Schema.NullOr(Schema.String)

const ApplyPatchOperation = Schema.Union([
  Schema.Struct({
    type: Schema.Literal("create_file"),
    path: Schema.String,
    diff: Schema.String
  }),
  Schema.Struct({
    type: Schema.Literal("delete_file"),
    path: Schema.String
  }),
  Schema.Struct({
    type: Schema.Literal("update_file"),
    path: Schema.String,
    diff: Schema.String
  })
], { mode: "oneOf" })

const WebSearchApproximateLocation = Schema.NullOr(
  Schema.Struct({
    type: Schema.optionalKey(Schema.Literal("approximate")),
    country: Schema.optionalKey(NullableString),
    region: Schema.optionalKey(NullableString),
    city: Schema.optionalKey(NullableString),
    timezone: Schema.optionalKey(NullableString)
  })
)

const WebSearchCallStatus = Schema.Literals(["in_progress", "searching", "completed", "failed"])

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
    call_id: Schema.String,
    operation: ApplyPatchOperation
  }),
  success: Schema.Struct({
    status: Schema.Literals(["completed", "failed"]),
    output: Schema.optionalKey(NullableString)
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
    container: Schema.optionalKey(Schema.Any)
  }),
  parameters: Schema.Struct({
    code: NullableString,
    container_id: Schema.String
  }),
  success: Schema.Struct({
    outputs: Schema.NullOr(Schema.Array(Schema.Any))
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
    filters: Schema.optionalKey(Schema.NullOr(Schema.Any)),
    max_num_results: Schema.optionalKey(Schema.Number),
    ranking_options: Schema.optionalKey(Schema.Any),
    vector_store_ids: Schema.optionalKey(Schema.Array(Schema.String))
  }),
  success: Schema.Struct({
    status: Schema.Literals(["in_progress", "searching", "completed", "incomplete", "failed"]),
    queries: Schema.Array(Schema.String),
    results: Schema.optionalKey(Schema.NullOr(Schema.Array(Schema.Any)))
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
    background: Schema.optionalKey(Schema.String),
    input_fidelity: Schema.optionalKey(NullableString),
    input_image_mask: Schema.optionalKey(Schema.Struct({
      image_url: Schema.optionalKey(Schema.String),
      file_id: Schema.optionalKey(Schema.String)
    })),
    model: Schema.optionalKey(Schema.String),
    moderation: Schema.optionalKey(Schema.String),
    output_compression: Schema.optionalKey(Schema.Number),
    output_format: Schema.optionalKey(Schema.String),
    partial_images: Schema.optionalKey(Schema.Number),
    quality: Schema.optionalKey(Schema.String),
    size: Schema.optionalKey(Schema.String)
  }),
  success: Schema.Struct({
    result: NullableString
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
    action: Schema.Any
  }),
  success: Schema.Struct({
    output: Schema.String
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
    allowed_tools: Schema.optionalKey(Schema.Any),
    authorization: Schema.optionalKey(Schema.String),
    connector_id: Schema.optionalKey(Schema.String),
    require_approval: Schema.optionalKey(Schema.Any),
    server_description: Schema.optionalKey(Schema.String),
    server_label: Schema.String,
    server_url: Schema.optionalKey(Schema.String)
  }),
  success: Schema.Struct({
    type: Schema.Literal("mcp_call"),
    name: Schema.String,
    arguments: Schema.String,
    output: Schema.optionalKey(NullableString),
    error: Schema.optionalKey(NullableString),
    server_label: Schema.String
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
    action: Schema.Any
  }),
  success: Schema.Struct({
    output: Schema.Array(Schema.Any)
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
    filters: Schema.optionalKey(Schema.NullOr(Schema.Any)),
    user_location: Schema.optionalKey(WebSearchApproximateLocation),
    search_context_size: Schema.optionalKey(Schema.Literals(["low", "medium", "high"]))
  }),
  parameters: Schema.Struct({
    action: Schema.Any
  }),
  success: Schema.Struct({
    action: Schema.Any,
    status: WebSearchCallStatus
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
    user_location: Schema.optionalKey(WebSearchApproximateLocation),
    search_context_size: Schema.optionalKey(Schema.Literals(["low", "medium", "high"]))
  }),
  success: Schema.Struct({
    action: Schema.Any,
    status: WebSearchCallStatus
  })
})
