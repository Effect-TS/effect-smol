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
 * OpenAI Code Interpreter tool.
 *
 * Allows the model to execute Python code in a sandboxed environment.
 *
 * @since 1.0.0
 * @category tools
 */
export const CodeInterpreter = Tool.providerDefined({
  id: "openai.code_interpreter",
  toolkitName: "OpenAiCodeInterpreter",
  providerName: "code_interpreter",
  args: {
    container: Schema.Union([
      Schema.String,
      Schema.Struct({
        type: Schema.Literal("auto"),
        file_ids: Schema.optional(Schema.Array(Schema.String))
      })
    ])
  },
  parameters: {
    code: Schema.NullOr(Schema.String),
    container_id: Schema.String
  },
  success: Schema.NullOr(Schema.Array(Schema.Union([
    Generated.CodeInterpreterOutputLogs,
    Generated.CodeInterpreterOutputImage
  ])))
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
  toolkitName: "OpenAiFileSearch",
  providerName: "file_search",
  args: {
    vector_store_ids: Schema.Array(Schema.String),
    max_num_results: Schema.optional(Schema.Number),
    ranking_options: Schema.optional(Schema.Struct({
      ranker: Schema.optional(Schema.Literals(["auto", "default-2024-11-15"])),
      score_threshold: Schema.optional(Schema.Number)
    }))
  },
  success: Schema.Struct({
    status: Schema.Literals(["in_progress", "searching", "completed", "failed"]),
    queries: Schema.optional(Schema.Array(Schema.Struct({
      query: Schema.String,
      file_ids: Schema.optional(Schema.Array(Schema.String))
    }))),
    results: Schema.optional(Schema.Array(Schema.Unknown))
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
  toolkitName: "OpenAiWebSearch",
  providerName: "web_search",
  args: {
    filters: Schema.optional(Schema.NullOr(Schema.Struct({
      allowed_domains: Schema.optional(Schema.NullOr(Schema.Array(Schema.String)))
    }))),
    user_location: Schema.optional(Schema.NullOr(Schema.Struct({
      type: Schema.optional(Schema.Literal("approximate")),
      country: Schema.optional(Schema.NullOr(Schema.String)),
      region: Schema.optional(Schema.NullOr(Schema.String)),
      city: Schema.optional(Schema.NullOr(Schema.String)),
      timezone: Schema.optional(Schema.NullOr(Schema.String))
    }))),
    search_context_size: Schema.optional(Schema.Literals(["low", "medium", "high"]))
  },
  parameters: {
    action: Schema.Union([
      Generated.WebSearchActionSearch,
      Generated.WebSearchActionOpenPage,
      Generated.WebSearchActionFind
    ])
  },
  success: Schema.Struct({
    status: Schema.Literals(["in_progress", "searching", "completed", "failed"])
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
  toolkitName: "OpenAiWebSearchPreview",
  providerName: "web_search_preview",
  args: {
    user_location: Schema.optional(Schema.NullOr(Schema.Struct({
      type: Schema.Literal("approximate"),
      country: Schema.optional(Schema.NullOr(Schema.String)),
      region: Schema.optional(Schema.NullOr(Schema.String)),
      city: Schema.optional(Schema.NullOr(Schema.String)),
      timezone: Schema.optional(Schema.NullOr(Schema.String))
    }))),
    search_context_size: Schema.optional(Schema.Literals(["low", "medium", "high"]))
  },
  parameters: {
    action: Schema.Union([
      Generated.WebSearchActionSearch,
      Generated.WebSearchActionOpenPage,
      Generated.WebSearchActionFind
    ])
  },
  success: Schema.Struct({
    status: Schema.Literals(["in_progress", "searching", "completed", "failed"])
  })
})

type ProviderToolNames = "code_interpreter" | "file_search" | "web_search" | "web_search_preview"

const ProviderToolNamesMap: Map<ProviderToolNames | (string & {}), string> = new Map([
  ["code_interpreter", "OpenAiCodeInterpreter"],
  ["file_search", "OpenAiFileSearch"],
  ["web_search", "OpenAiWebSearch"],
  ["web_search_preview", "OpenAiWebSearchPreview"]
])

/** @internal */
export const getProviderDefinedToolName = (name: string): string | undefined => ProviderToolNamesMap.get(name)
