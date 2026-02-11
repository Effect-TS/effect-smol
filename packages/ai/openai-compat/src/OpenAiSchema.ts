/**
 * @since 1.0.0
 */
import * as Schema from "effect/Schema"

const JsonObject = Schema.Record(Schema.String, Schema.Any)
const NullableString = Schema.NullOr(Schema.String)
const NullableBoolean = Schema.NullOr(Schema.Boolean)
const ItemStatus = Schema.Literals(["in_progress", "completed", "incomplete"])

const ModelIdsSharedLiterals = Schema.Literals([
  "gpt-5.2",
  "gpt-5.2-2025-12-11",
  "gpt-5.2-chat-latest",
  "gpt-5.2-pro",
  "gpt-5.2-pro-2025-12-11",
  "gpt-5.1",
  "gpt-5.1-2025-11-13",
  "gpt-5.1-codex",
  "gpt-5.1-mini",
  "gpt-5.1-chat-latest",
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-nano",
  "gpt-5-2025-08-07",
  "gpt-5-mini-2025-08-07",
  "gpt-5-nano-2025-08-07",
  "gpt-5-chat-latest",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4.1-nano",
  "gpt-4.1-2025-04-14",
  "gpt-4.1-mini-2025-04-14",
  "gpt-4.1-nano-2025-04-14",
  "o4-mini",
  "o4-mini-2025-04-16",
  "o3",
  "o3-2025-04-16",
  "o3-mini",
  "o3-mini-2025-01-31",
  "o1",
  "o1-2024-12-17",
  "o1-preview",
  "o1-preview-2024-09-12",
  "o1-mini",
  "o1-mini-2024-09-12",
  "gpt-4o",
  "gpt-4o-2024-11-20",
  "gpt-4o-2024-08-06",
  "gpt-4o-2024-05-13",
  "gpt-4o-audio-preview",
  "gpt-4o-audio-preview-2024-10-01",
  "gpt-4o-audio-preview-2024-12-17",
  "gpt-4o-audio-preview-2025-06-03",
  "gpt-4o-mini-audio-preview",
  "gpt-4o-mini-audio-preview-2024-12-17",
  "gpt-4o-search-preview",
  "gpt-4o-mini-search-preview",
  "gpt-4o-search-preview-2025-03-11",
  "gpt-4o-mini-search-preview-2025-03-11",
  "chatgpt-4o-latest",
  "codex-mini-latest",
  "gpt-4o-mini",
  "gpt-4o-mini-2024-07-18",
  "gpt-4-turbo",
  "gpt-4-turbo-2024-04-09",
  "gpt-4-0125-preview",
  "gpt-4-turbo-preview",
  "gpt-4-1106-preview",
  "gpt-4-vision-preview",
  "gpt-4",
  "gpt-4-0314",
  "gpt-4-0613",
  "gpt-4-32k",
  "gpt-4-32k-0314",
  "gpt-4-32k-0613",
  "gpt-3.5-turbo",
  "gpt-3.5-turbo-16k",
  "gpt-3.5-turbo-0301",
  "gpt-3.5-turbo-0613",
  "gpt-3.5-turbo-1106",
  "gpt-3.5-turbo-0125",
  "gpt-3.5-turbo-16k-0613"
])

/**
 * @since 1.0.0
 */
export const ModelIdsShared = Schema.Union([Schema.String, ModelIdsSharedLiterals])

/**
 * @since 1.0.0
 */
export type ModelIdsShared = typeof ModelIdsShared.Type

/**
 * @since 1.0.0
 */
export const ModelIdsResponses = Schema.String

/**
 * @since 1.0.0
 */
export type ModelIdsResponses =
  | (
    | "o1-pro"
    | "o1-pro-2025-03-19"
    | "o3-pro"
    | "o3-pro-2025-06-10"
    | "o3-deep-research"
    | "o3-deep-research-2025-06-26"
    | "o4-mini-deep-research"
    | "o4-mini-deep-research-2025-06-26"
    | "computer-use-preview"
    | "computer-use-preview-2025-03-11"
    | "gpt-5-codex"
    | "gpt-5-pro"
    | "gpt-5-pro-2025-10-06"
    | "gpt-5.1-codex-max"
  )
  | (string & {})

/**
 * @since 1.0.0
 */
export const IncludeEnum = Schema.Literals([
  "file_search_call.results",
  "web_search_call.results",
  "web_search_call.action.sources",
  "message.input_image.image_url",
  "computer_call_output.output.image_url",
  "code_interpreter_call.outputs",
  "reasoning.encrypted_content",
  "message.output_text.logprobs"
])

/**
 * @since 1.0.0
 */
export type IncludeEnum = typeof IncludeEnum.Type

/**
 * @since 1.0.0
 */
export const InputTextContent = Schema.Struct({
  type: Schema.Literal("input_text"),
  text: Schema.String
})

/**
 * @since 1.0.0
 */
export type InputTextContent = typeof InputTextContent.Type

/**
 * @since 1.0.0
 */
export const InputImageContent = Schema.Struct({
  type: Schema.Literal("input_image"),
  image_url: Schema.optionalKey(NullableString),
  file_id: Schema.optionalKey(NullableString),
  detail: Schema.optionalKey(Schema.NullOr(Schema.Literals(["low", "high", "auto"])))
})

/**
 * @since 1.0.0
 */
export type InputImageContent = typeof InputImageContent.Type

/**
 * @since 1.0.0
 */
export const InputFileContent = Schema.Struct({
  type: Schema.Literal("input_file"),
  file_id: Schema.optionalKey(NullableString),
  filename: Schema.optionalKey(Schema.String),
  file_url: Schema.optionalKey(Schema.String),
  file_data: Schema.optionalKey(Schema.String)
})

/**
 * @since 1.0.0
 */
export type InputFileContent = typeof InputFileContent.Type

/**
 * @since 1.0.0
 */
export const InputContent = Schema.Union([InputTextContent, InputImageContent, InputFileContent], { mode: "oneOf" })

/**
 * @since 1.0.0
 */
export type InputContent = typeof InputContent.Type

/**
 * @since 1.0.0
 */
export const SummaryTextContent = Schema.Struct({
  type: Schema.Literal("summary_text"),
  text: Schema.String
})

/**
 * @since 1.0.0
 */
export type SummaryTextContent = typeof SummaryTextContent.Type

const ReasoningTextContent = Schema.Struct({
  type: Schema.Literal("reasoning_text"),
  text: Schema.String
})

const FileCitationBody = Schema.Struct({
  type: Schema.Literal("file_citation"),
  file_id: Schema.String,
  index: Schema.Number,
  filename: Schema.String
})

const UrlCitationBody = Schema.Struct({
  type: Schema.Literal("url_citation"),
  url: Schema.String,
  start_index: Schema.Number,
  end_index: Schema.Number,
  title: Schema.String
})

const ContainerFileCitationBody = Schema.Struct({
  type: Schema.Literal("container_file_citation"),
  container_id: Schema.String,
  file_id: Schema.String,
  start_index: Schema.Number,
  end_index: Schema.Number,
  filename: Schema.String
})

const FilePath = Schema.Struct({
  type: Schema.Literal("file_path"),
  file_id: Schema.String,
  index: Schema.Number
})

/**
 * @since 1.0.0
 */
export const Annotation = Schema.Union([FileCitationBody, UrlCitationBody, ContainerFileCitationBody, FilePath], {
  mode: "oneOf"
})

/**
 * @since 1.0.0
 */
export type Annotation = typeof Annotation.Type

const RefusalContent = Schema.Struct({
  type: Schema.Literal("refusal"),
  refusal: Schema.String
})

const TextContent = Schema.Struct({
  type: Schema.Literal("text"),
  text: Schema.String
})

const ComputerScreenshotContent = Schema.Struct({
  type: Schema.Literal("computer_screenshot"),
  image_url: NullableString,
  file_id: NullableString
})

const OutputTextContent = Schema.Struct({
  type: Schema.Literal("output_text"),
  text: Schema.String,
  annotations: Schema.optionalKey(Schema.Array(Annotation)),
  logprobs: Schema.optionalKey(Schema.Array(Schema.Any))
})

const OutputMessageContent = Schema.Union([
  InputTextContent,
  OutputTextContent,
  TextContent,
  SummaryTextContent,
  ReasoningTextContent,
  RefusalContent,
  InputImageContent,
  ComputerScreenshotContent,
  InputFileContent
], { mode: "oneOf" })

/**
 * @since 1.0.0
 */
export const Message = Schema.Struct({
  type: Schema.Literal("message"),
  id: Schema.String,
  status: ItemStatus,
  role: Schema.Literals(["unknown", "user", "assistant", "system", "critic", "discriminator", "developer", "tool"]),
  content: Schema.Array(OutputMessageContent)
})

/**
 * @since 1.0.0
 */
export type Message = typeof Message.Type

/**
 * @since 1.0.0
 */
export const OutputMessage = Schema.Struct({
  id: Schema.String,
  type: Schema.Literal("message"),
  role: Schema.Literal("assistant"),
  content: Schema.Array(OutputMessageContent),
  status: ItemStatus
})

const FunctionAndCustomToolCallOutput = Schema.Union([InputTextContent, InputImageContent, InputFileContent], {
  mode: "oneOf"
})

/**
 * @since 1.0.0
 */
export const ReasoningItem = Schema.Struct({
  type: Schema.Literal("reasoning"),
  id: Schema.String,
  encrypted_content: Schema.optionalKey(NullableString),
  summary: Schema.Array(SummaryTextContent),
  content: Schema.optionalKey(Schema.Array(ReasoningTextContent)),
  status: Schema.optionalKey(ItemStatus)
})

/**
 * @since 1.0.0
 */
export type ReasoningItem = typeof ReasoningItem.Type

/**
 * @since 1.0.0
 */
export const FunctionToolCall = Schema.Struct({
  id: Schema.optionalKey(Schema.String),
  type: Schema.Literal("function_call"),
  call_id: Schema.String,
  name: Schema.String,
  arguments: Schema.String,
  status: Schema.optionalKey(ItemStatus)
})

const FunctionCallOutputItemParam = Schema.Struct({
  id: Schema.optionalKey(Schema.NullOr(Schema.String)),
  call_id: Schema.String,
  type: Schema.Literal("function_call_output"),
  output: Schema.Union([Schema.String, Schema.Array(FunctionAndCustomToolCallOutput)], { mode: "oneOf" }),
  status: Schema.optionalKey(Schema.NullOr(ItemStatus))
})

/**
 * @since 1.0.0
 */
export const FileSearchToolCall = Schema.Struct({
  id: Schema.String,
  type: Schema.Literal("file_search_call"),
  status: Schema.Literals(["in_progress", "searching", "completed", "incomplete", "failed"]),
  queries: Schema.Array(Schema.String),
  results: Schema.optionalKey(Schema.NullOr(Schema.Array(Schema.Any)))
})

/**
 * @since 1.0.0
 */
export const WebSearchToolCall = Schema.Struct({
  id: Schema.String,
  type: Schema.Literal("web_search_call"),
  status: Schema.Literals(["in_progress", "searching", "completed", "failed"]),
  action: Schema.Any
})

/**
 * @since 1.0.0
 */
export const ImageGenToolCall = Schema.Struct({
  type: Schema.Literal("image_generation_call"),
  id: Schema.String,
  status: Schema.Literals(["in_progress", "completed", "generating", "failed"]),
  result: NullableString
})

/**
 * @since 1.0.0
 */
export const ComputerToolCall = Schema.Struct({
  type: Schema.Literal("computer_call"),
  id: Schema.String,
  call_id: Schema.String,
  action: Schema.Any,
  pending_safety_checks: Schema.optionalKey(Schema.Array(Schema.Any)),
  status: ItemStatus
})

const ComputerCallOutputItemParam = Schema.Struct({
  id: Schema.optionalKey(NullableString),
  call_id: Schema.String,
  type: Schema.Literal("computer_call_output"),
  output: Schema.Any,
  acknowledged_safety_checks: Schema.optionalKey(Schema.NullOr(Schema.Array(Schema.Any))),
  status: Schema.optionalKey(Schema.NullOr(ItemStatus))
})

/**
 * @since 1.0.0
 */
export const CodeInterpreterToolCall = Schema.Struct({
  type: Schema.Literal("code_interpreter_call"),
  id: Schema.String,
  status: Schema.Literals(["in_progress", "completed", "incomplete", "interpreting", "failed"]),
  container_id: Schema.String,
  code: NullableString,
  outputs: Schema.NullOr(Schema.Array(Schema.Any))
})

/**
 * @since 1.0.0
 */
export const LocalShellToolCall = Schema.Struct({
  type: Schema.Literal("local_shell_call"),
  id: Schema.String,
  call_id: Schema.String,
  action: Schema.Any,
  status: ItemStatus
})

/**
 * @since 1.0.0
 */
export const LocalShellToolCallOutput = Schema.Struct({
  type: Schema.Literal("local_shell_call_output"),
  id: Schema.String,
  output: Schema.String,
  status: Schema.optionalKey(Schema.NullOr(ItemStatus)),
  call_id: Schema.Any
})

/**
 * @since 1.0.0
 */
export const FunctionShellCall = Schema.Struct({
  type: Schema.Literal("shell_call"),
  id: Schema.String,
  call_id: Schema.String,
  action: Schema.Any,
  status: ItemStatus,
  created_by: Schema.optionalKey(Schema.String)
})

const FunctionShellCallItemParam = Schema.Struct({
  id: Schema.optionalKey(NullableString),
  call_id: Schema.String,
  type: Schema.Literal("shell_call"),
  action: Schema.Any,
  status: Schema.optionalKey(Schema.NullOr(ItemStatus))
})

const FunctionShellCallOutputContent = Schema.Struct({
  stdout: Schema.String,
  stderr: Schema.String,
  outcome: Schema.Any,
  created_by: Schema.optionalKey(Schema.String)
})

/**
 * @since 1.0.0
 */
export const FunctionShellCallOutput = Schema.Struct({
  type: Schema.Literal("shell_call_output"),
  id: Schema.String,
  call_id: Schema.String,
  status: ItemStatus,
  output: Schema.Array(FunctionShellCallOutputContent),
  max_output_length: Schema.NullOr(Schema.Number),
  created_by: Schema.optionalKey(Schema.String)
})

/**
 * @since 1.0.0
 */
export const FunctionShellCallOutputItemParam = Schema.Struct({
  id: Schema.optionalKey(NullableString),
  call_id: Schema.String,
  type: Schema.Literal("shell_call_output"),
  output: Schema.Array(Schema.Any),
  status: Schema.optionalKey(Schema.NullOr(ItemStatus)),
  max_output_length: Schema.optionalKey(Schema.NullOr(Schema.Number))
})

const ApplyPatchCreateFileOperation = Schema.Struct({
  type: Schema.Literal("create_file"),
  path: Schema.String,
  diff: Schema.String
})

const ApplyPatchDeleteFileOperation = Schema.Struct({
  type: Schema.Literal("delete_file"),
  path: Schema.String
})

const ApplyPatchUpdateFileOperation = Schema.Struct({
  type: Schema.Literal("update_file"),
  path: Schema.String,
  diff: Schema.String
})

const ApplyPatchOperation = Schema.Union([
  ApplyPatchCreateFileOperation,
  ApplyPatchDeleteFileOperation,
  ApplyPatchUpdateFileOperation
], { mode: "oneOf" })

/**
 * @since 1.0.0
 */
export const ApplyPatchToolCall = Schema.Struct({
  type: Schema.Literal("apply_patch_call"),
  id: Schema.String,
  call_id: Schema.String,
  status: Schema.Literals(["in_progress", "completed"]),
  operation: ApplyPatchOperation,
  created_by: Schema.optionalKey(Schema.String)
})

const ApplyPatchToolCallItemParam = Schema.Struct({
  type: Schema.Literal("apply_patch_call"),
  id: Schema.optionalKey(NullableString),
  call_id: Schema.String,
  status: Schema.Literals(["in_progress", "completed"]),
  operation: ApplyPatchOperation
})

/**
 * @since 1.0.0
 */
export const ApplyPatchToolCallOutput = Schema.Struct({
  type: Schema.Literal("apply_patch_call_output"),
  id: Schema.String,
  call_id: Schema.String,
  status: Schema.Literals(["completed", "failed"]),
  output: Schema.optionalKey(NullableString),
  created_by: Schema.optionalKey(Schema.String)
})

const ApplyPatchToolCallOutputItemParam = Schema.Struct({
  type: Schema.Literal("apply_patch_call_output"),
  id: Schema.optionalKey(NullableString),
  call_id: Schema.String,
  status: Schema.Literals(["completed", "failed"]),
  output: Schema.optionalKey(NullableString)
})

/**
 * @since 1.0.0
 */
export const MCPApprovalRequest = Schema.Struct({
  type: Schema.Literal("mcp_approval_request"),
  id: Schema.String,
  server_label: Schema.String,
  name: Schema.String,
  arguments: Schema.String
})

/**
 * @since 1.0.0
 */
export const MCPApprovalResponse = Schema.Struct({
  type: Schema.Literal("mcp_approval_response"),
  id: Schema.optionalKey(NullableString),
  approval_request_id: Schema.String,
  approve: Schema.Boolean,
  reason: Schema.optionalKey(NullableString),
  request_id: Schema.optionalKey(Schema.Any)
})

/**
 * @since 1.0.0
 */
export const MCPListTools = Schema.Struct({
  type: Schema.Literal("mcp_list_tools"),
  id: Schema.String,
  server_label: Schema.String,
  tools: Schema.Array(Schema.Any),
  error: Schema.optionalKey(NullableString),
  status: Schema.optionalKey(Schema.String)
})

/**
 * @since 1.0.0
 */
export const MCPToolCall = Schema.Struct({
  type: Schema.Literal("mcp_call"),
  id: Schema.String,
  server_label: Schema.String,
  name: Schema.String,
  arguments: Schema.String,
  output: Schema.optionalKey(NullableString),
  error: Schema.optionalKey(NullableString),
  status: Schema.optionalKey(Schema.Literals(["in_progress", "completed", "incomplete", "calling", "failed"])),
  approval_request_id: Schema.optionalKey(NullableString)
})

/**
 * @since 1.0.0
 */
export const CustomToolCall = Schema.Struct({
  type: Schema.Literal("custom_tool_call"),
  id: Schema.optionalKey(Schema.String),
  call_id: Schema.String,
  name: Schema.String,
  input: Schema.String
})

const CustomToolCallOutput = Schema.Struct({
  type: Schema.Literal("custom_tool_call_output"),
  id: Schema.optionalKey(Schema.String),
  call_id: Schema.String,
  output: Schema.Union([Schema.String, Schema.Array(FunctionAndCustomToolCallOutput)], { mode: "oneOf" })
})

const ItemReferenceParam = Schema.Struct({
  type: Schema.optionalKey(Schema.NullOr(Schema.Literal("item_reference"))),
  id: Schema.String
})

const WebSearchApproximateLocation = Schema.NullOr(
  Schema.Struct({
    type: Schema.optionalKey(Schema.Literal("approximate")),
    country: Schema.optionalKey(NullableString),
    region: Schema.optionalKey(NullableString),
    city: Schema.optionalKey(NullableString),
    timezone: Schema.optionalKey(NullableString)
  })
)

/**
 * @since 1.0.0
 */
export const FunctionTool = Schema.Struct({
  type: Schema.Literal("function"),
  name: Schema.String,
  description: Schema.optionalKey(NullableString),
  parameters: Schema.optionalKey(Schema.NullOr(JsonObject)),
  strict: Schema.optionalKey(Schema.NullOr(Schema.Boolean))
})

/**
 * @since 1.0.0
 */
export const FileSearchTool = Schema.Struct({
  type: Schema.Literal("file_search"),
  vector_store_ids: Schema.optionalKey(Schema.Array(Schema.String)),
  max_num_results: Schema.optionalKey(Schema.Number),
  ranking_options: Schema.optionalKey(Schema.Any),
  filters: Schema.optionalKey(Schema.NullOr(Schema.Any))
})

/**
 * @since 1.0.0
 */
export const CodeInterpreterTool = Schema.Struct({
  type: Schema.Literal("code_interpreter"),
  container: Schema.optionalKey(Schema.Any)
})

/**
 * @since 1.0.0
 */
export const ImageGenTool = Schema.Struct({
  type: Schema.Literal("image_generation"),
  model: Schema.optionalKey(Schema.String),
  quality: Schema.optionalKey(Schema.String),
  size: Schema.optionalKey(Schema.String),
  output_format: Schema.optionalKey(Schema.String),
  output_compression: Schema.optionalKey(Schema.Number),
  moderation: Schema.optionalKey(Schema.String),
  background: Schema.optionalKey(Schema.String),
  input_fidelity: Schema.optionalKey(NullableString),
  input_image_mask: Schema.optionalKey(Schema.Struct({
    image_url: Schema.optionalKey(Schema.String),
    file_id: Schema.optionalKey(Schema.String)
  })),
  partial_images: Schema.optionalKey(Schema.Number),
  action: Schema.optionalKey(Schema.String)
})

/**
 * @since 1.0.0
 */
export const LocalShellToolParam = Schema.Struct({
  type: Schema.Literal("local_shell")
})

/**
 * @since 1.0.0
 */
export const FunctionShellToolParam = Schema.Struct({
  type: Schema.Literal("shell")
})

/**
 * @since 1.0.0
 */
export const WebSearchTool = Schema.Struct({
  type: Schema.Literals(["web_search", "web_search_2025_08_26"]),
  filters: Schema.optionalKey(Schema.NullOr(Schema.Any)),
  user_location: Schema.optionalKey(WebSearchApproximateLocation),
  search_context_size: Schema.optionalKey(Schema.Literals(["low", "medium", "high"]))
})

/**
 * @since 1.0.0
 */
export const WebSearchPreviewTool = Schema.Struct({
  type: Schema.Literals(["web_search_preview", "web_search_preview_2025_03_11"]),
  user_location: Schema.optionalKey(WebSearchApproximateLocation),
  search_context_size: Schema.optionalKey(Schema.Literals(["low", "medium", "high"]))
})

/**
 * @since 1.0.0
 */
export const MCPTool = Schema.Struct({
  type: Schema.Literal("mcp"),
  server_label: Schema.String,
  server_url: Schema.optionalKey(Schema.String),
  connector_id: Schema.optionalKey(Schema.String),
  authorization: Schema.optionalKey(Schema.String),
  server_description: Schema.optionalKey(Schema.String),
  allowed_tools: Schema.optionalKey(Schema.Any),
  require_approval: Schema.optionalKey(Schema.Any)
})

/**
 * @since 1.0.0
 */
export const ApplyPatchToolParam = Schema.Struct({
  type: Schema.Literal("apply_patch")
})

const ComputerUseTool = Schema.Struct({
  type: Schema.Literals(["computer_use", "computer_use_preview"]),
  environment: Schema.optionalKey(Schema.String),
  display_width: Schema.optionalKey(Schema.Number),
  display_height: Schema.optionalKey(Schema.Number)
})

const CustomToolParam = Schema.Struct({
  type: Schema.Literal("custom"),
  name: Schema.String,
  description: Schema.optionalKey(Schema.String),
  format: Schema.optionalKey(Schema.Any)
})

/**
 * @since 1.0.0
 */
export const Tool = Schema.Union([
  FunctionTool,
  FileSearchTool,
  ComputerUseTool,
  WebSearchTool,
  MCPTool,
  CodeInterpreterTool,
  ImageGenTool,
  LocalShellToolParam,
  FunctionShellToolParam,
  CustomToolParam,
  WebSearchPreviewTool,
  ApplyPatchToolParam
], { mode: "oneOf" })

/**
 * @since 1.0.0
 */
export type Tool = typeof Tool.Type

const ToolChoiceOptions = Schema.Literals(["none", "auto", "required"])
const ToolChoiceAllowed = Schema.Struct({
  type: Schema.Literal("allowed_tools"),
  mode: Schema.Literals(["auto", "required"]),
  tools: Schema.Array(JsonObject)
})
const ToolChoiceTypes = Schema.Struct({
  type: Schema.Literals([
    "file_search",
    "web_search_preview",
    "computer_use_preview",
    "web_search_preview_2025_03_11",
    "image_generation",
    "code_interpreter"
  ])
})
const ToolChoiceFunction = Schema.Struct({
  type: Schema.Literal("function"),
  name: Schema.String
})
const ToolChoiceMCP = Schema.Struct({
  type: Schema.Literal("mcp"),
  server_label: Schema.String,
  name: Schema.optionalKey(NullableString)
})
const ToolChoiceCustom = Schema.Struct({
  type: Schema.Literal("custom"),
  name: Schema.String
})
const SpecificApplyPatchParam = Schema.Struct({
  type: Schema.Literal("apply_patch")
})
const SpecificFunctionShellParam = Schema.Struct({
  type: Schema.Literal("shell")
})

const ToolChoiceParam = Schema.Union([
  ToolChoiceOptions,
  ToolChoiceAllowed,
  ToolChoiceTypes,
  ToolChoiceFunction,
  ToolChoiceMCP,
  ToolChoiceCustom,
  SpecificApplyPatchParam,
  SpecificFunctionShellParam
], { mode: "oneOf" })

/**
 * @since 1.0.0
 */
export const InputItem = Schema.Union([
  Schema.Struct({
    role: Schema.Literals(["user", "assistant", "system", "developer"]),
    content: Schema.Union([Schema.String, Schema.Array(InputContent)], { mode: "oneOf" }),
    type: Schema.optionalKey(Schema.Literal("message"))
  }),
  Schema.Struct({
    type: Schema.optionalKey(Schema.Literal("message")),
    role: Schema.Literals(["user", "system", "developer"]),
    status: Schema.optionalKey(ItemStatus),
    content: Schema.Array(InputContent)
  }),
  OutputMessage,
  FileSearchToolCall,
  ComputerToolCall,
  ComputerCallOutputItemParam,
  WebSearchToolCall,
  FunctionToolCall,
  FunctionCallOutputItemParam,
  ReasoningItem,
  ImageGenToolCall,
  CodeInterpreterToolCall,
  LocalShellToolCall,
  LocalShellToolCallOutput,
  FunctionShellCallItemParam,
  FunctionShellCallOutputItemParam,
  ApplyPatchToolCallItemParam,
  ApplyPatchToolCallOutputItemParam,
  MCPListTools,
  MCPApprovalRequest,
  MCPApprovalResponse,
  MCPToolCall,
  CustomToolCallOutput,
  CustomToolCall,
  ItemReferenceParam
])

/**
 * @since 1.0.0
 */
export type InputItem = typeof InputItem.Type

const InputParam = Schema.Union([
  Schema.String,
  Schema.Array(InputItem)
], { mode: "oneOf" })

const OutputItem = Schema.Union([
  OutputMessage,
  FileSearchToolCall,
  FunctionToolCall,
  WebSearchToolCall,
  ComputerToolCall,
  ReasoningItem,
  ImageGenToolCall,
  CodeInterpreterToolCall,
  LocalShellToolCall,
  FunctionShellCall,
  FunctionShellCallOutput,
  ApplyPatchToolCall,
  ApplyPatchToolCallOutput,
  MCPToolCall,
  MCPListTools,
  MCPApprovalRequest,
  CustomToolCall
])

const ResponseFormatText = Schema.Struct({
  type: Schema.Literal("text")
})

const ResponseFormatJsonObject = Schema.Struct({
  type: Schema.Literal("json_object")
})

const TextResponseFormatJsonSchema = Schema.Struct({
  type: Schema.Literal("json_schema"),
  description: Schema.optionalKey(Schema.String),
  name: Schema.String,
  schema: JsonObject,
  strict: Schema.optionalKey(Schema.NullOr(Schema.Boolean))
})

/**
 * @since 1.0.0
 */
export const TextResponseFormatConfiguration = Schema.Union([
  ResponseFormatText,
  TextResponseFormatJsonSchema,
  ResponseFormatJsonObject
], { mode: "oneOf" })

/**
 * @since 1.0.0
 */
export type TextResponseFormatConfiguration = typeof TextResponseFormatConfiguration.Type

const ResponseTextParam = Schema.Struct({
  format: Schema.optionalKey(TextResponseFormatConfiguration),
  verbosity: Schema.optionalKey(Schema.Literals(["low", "medium", "high"]))
})

const Metadata = Schema.NullOr(Schema.Record(Schema.String, Schema.String))

/**
 * @since 1.0.0
 */
export const CreateResponse = Schema.Struct({
  metadata: Schema.optionalKey(Metadata),
  top_logprobs: Schema.optionalKey(Schema.Number),
  temperature: Schema.optionalKey(Schema.NullOr(Schema.Number)),
  top_p: Schema.optionalKey(Schema.NullOr(Schema.Number)),
  user: Schema.optionalKey(NullableString),
  safety_identifier: Schema.optionalKey(NullableString),
  prompt_cache_key: Schema.optionalKey(NullableString),
  service_tier: Schema.optionalKey(Schema.String),
  prompt_cache_retention: Schema.optionalKey(Schema.NullOr(Schema.Literals(["in-memory", "24h"]))),
  previous_response_id: Schema.optionalKey(NullableString),
  model: Schema.optionalKey(ModelIdsResponses),
  reasoning: Schema.optionalKey(Schema.NullOr(Schema.Any)),
  background: Schema.optionalKey(NullableBoolean),
  max_output_tokens: Schema.optionalKey(Schema.NullOr(Schema.Number)),
  max_tool_calls: Schema.optionalKey(Schema.NullOr(Schema.Number)),
  text: Schema.optionalKey(ResponseTextParam),
  tools: Schema.optionalKey(Schema.Array(Tool)),
  tool_choice: Schema.optionalKey(ToolChoiceParam),
  truncation: Schema.optionalKey(Schema.NullOr(Schema.Literals(["auto", "disabled"]))),
  input: Schema.optionalKey(InputParam),
  include: Schema.optionalKey(Schema.NullOr(Schema.Array(IncludeEnum))),
  parallel_tool_calls: Schema.optionalKey(Schema.NullOr(Schema.Boolean)),
  store: Schema.optionalKey(NullableBoolean),
  instructions: Schema.optionalKey(NullableString),
  stream: Schema.optionalKey(NullableBoolean),
  conversation: Schema.optionalKey(NullableString),
  modalities: Schema.optionalKey(Schema.Array(Schema.Literals(["text", "audio"]))),
  seed: Schema.optionalKey(Schema.Number)
})

/**
 * @since 1.0.0
 */
export type CreateResponse = typeof CreateResponse.Type

/**
 * @since 1.0.0
 */
export const ResponseUsage = Schema.Struct({
  input_tokens: Schema.Number,
  output_tokens: Schema.Number,
  total_tokens: Schema.Number,
  input_tokens_details: Schema.optionalKey(Schema.Any),
  output_tokens_details: Schema.optionalKey(Schema.Any)
})

/**
 * @since 1.0.0
 */
export type ResponseUsage = typeof ResponseUsage.Type

/**
 * @since 1.0.0
 */
export const Response = Schema.Struct({
  id: Schema.String,
  object: Schema.optionalKey(Schema.Literal("response")),
  model: ModelIdsResponses,
  status: Schema.optionalKey(
    Schema.Literals(["completed", "failed", "in_progress", "cancelled", "queued", "incomplete"])
  ),
  created_at: Schema.Number,
  output: Schema.Array(OutputItem),
  usage: Schema.optionalKey(Schema.NullOr(ResponseUsage)),
  incomplete_details: Schema.optionalKey(Schema.NullOr(
    Schema.Struct({ reason: Schema.optionalKey(Schema.Literals(["max_output_tokens", "content_filter"])) })
  )),
  service_tier: Schema.optionalKey(Schema.String)
})

/**
 * @since 1.0.0
 */
export type Response = typeof Response.Type

const ResponseCreatedEvent = Schema.Struct({
  type: Schema.Literal("response.created"),
  response: Response,
  sequence_number: Schema.Number
})

const ResponseCompletedEvent = Schema.Struct({
  type: Schema.Literal("response.completed"),
  response: Response,
  sequence_number: Schema.Number
})

const ResponseIncompleteEvent = Schema.Struct({
  type: Schema.Literal("response.incomplete"),
  response: Response,
  sequence_number: Schema.Number
})

const ResponseFailedEvent = Schema.Struct({
  type: Schema.Literal("response.failed"),
  response: Response,
  sequence_number: Schema.Number
})

const ResponseOutputItemAddedEvent = Schema.Struct({
  type: Schema.Literal("response.output_item.added"),
  output_index: Schema.Number,
  sequence_number: Schema.Number,
  item: OutputItem
})

const ResponseOutputItemDoneEvent = Schema.Struct({
  type: Schema.Literal("response.output_item.done"),
  output_index: Schema.Number,
  sequence_number: Schema.Number,
  item: OutputItem
})

const ResponseTextDeltaEvent = Schema.Struct({
  type: Schema.Literal("response.output_text.delta"),
  item_id: Schema.String,
  output_index: Schema.Number,
  content_index: Schema.Number,
  delta: Schema.String,
  sequence_number: Schema.Number,
  logprobs: Schema.optionalKey(Schema.Array(Schema.Any))
})

const ResponseOutputTextAnnotationAddedEvent = Schema.Struct({
  type: Schema.Literal("response.output_text.annotation.added"),
  item_id: Schema.String,
  output_index: Schema.Number,
  content_index: Schema.Number,
  annotation_index: Schema.Number,
  sequence_number: Schema.Number,
  annotation: Annotation
})

const ResponseFunctionCallArgumentsDeltaEvent = Schema.Struct({
  type: Schema.Literal("response.function_call_arguments.delta"),
  item_id: Schema.String,
  output_index: Schema.Number,
  sequence_number: Schema.Number,
  delta: Schema.String
})

const ResponseApplyPatchCallOperationDiffDeltaEvent = Schema.Struct({
  type: Schema.Literal("response.apply_patch_call_operation_diff.delta"),
  sequence_number: Schema.Number,
  output_index: Schema.Number,
  item_id: Schema.String,
  delta: Schema.String
})

const ResponseApplyPatchCallOperationDiffDoneEvent = Schema.Struct({
  type: Schema.Literal("response.apply_patch_call_operation_diff.done"),
  sequence_number: Schema.Number,
  output_index: Schema.Number,
  item_id: Schema.String,
  delta: Schema.optionalKey(Schema.String)
})

const ResponseCodeInterpreterCallCodeDeltaEvent = Schema.Struct({
  type: Schema.Literal("response.code_interpreter_call_code.delta"),
  output_index: Schema.Number,
  item_id: Schema.String,
  delta: Schema.String,
  sequence_number: Schema.Number
})

const ResponseCodeInterpreterCallCodeDoneEvent = Schema.Struct({
  type: Schema.Literal("response.code_interpreter_call_code.done"),
  output_index: Schema.Number,
  item_id: Schema.String,
  code: Schema.String,
  sequence_number: Schema.Number
})

const ResponseImageGenCallPartialImageEvent = Schema.Struct({
  type: Schema.Literal("response.image_generation_call.partial_image"),
  output_index: Schema.Number,
  item_id: Schema.String,
  sequence_number: Schema.Number,
  partial_image_index: Schema.Number,
  partial_image_b64: Schema.String
})

const ResponseReasoningSummaryPartAddedEvent = Schema.Struct({
  type: Schema.Literal("response.reasoning_summary_part.added"),
  item_id: Schema.String,
  output_index: Schema.Number,
  summary_index: Schema.Number,
  sequence_number: Schema.Number,
  part: SummaryTextContent
})

const ResponseReasoningSummaryPartDoneEvent = Schema.Struct({
  type: Schema.Literal("response.reasoning_summary_part.done"),
  item_id: Schema.String,
  output_index: Schema.Number,
  summary_index: Schema.Number,
  sequence_number: Schema.Number,
  part: SummaryTextContent
})

const ResponseReasoningSummaryTextDeltaEvent = Schema.Struct({
  type: Schema.Literal("response.reasoning_summary_text.delta"),
  item_id: Schema.String,
  output_index: Schema.Number,
  summary_index: Schema.Number,
  delta: Schema.String,
  sequence_number: Schema.Number
})

const ResponseErrorEvent = Schema.Struct({
  type: Schema.Literal("error"),
  code: NullableString,
  message: Schema.String,
  param: NullableString,
  sequence_number: Schema.Number
})

const UnknownResponseStreamEvent = Schema.Struct({
  type: Schema.String
})

/**
 * @since 1.0.0
 */
export const ResponseStreamEvent = Schema.Union([
  ResponseCreatedEvent,
  ResponseCompletedEvent,
  ResponseIncompleteEvent,
  ResponseFailedEvent,
  ResponseOutputItemAddedEvent,
  ResponseOutputItemDoneEvent,
  ResponseTextDeltaEvent,
  ResponseOutputTextAnnotationAddedEvent,
  ResponseFunctionCallArgumentsDeltaEvent,
  ResponseApplyPatchCallOperationDiffDeltaEvent,
  ResponseApplyPatchCallOperationDiffDoneEvent,
  ResponseCodeInterpreterCallCodeDeltaEvent,
  ResponseCodeInterpreterCallCodeDoneEvent,
  ResponseImageGenCallPartialImageEvent,
  ResponseReasoningSummaryPartAddedEvent,
  ResponseReasoningSummaryPartDoneEvent,
  ResponseReasoningSummaryTextDeltaEvent,
  ResponseErrorEvent,
  UnknownResponseStreamEvent
])

/**
 * @since 1.0.0
 */
export type ResponseStreamEvent = typeof ResponseStreamEvent.Type

const Embedding = Schema.Struct({
  embedding: Schema.Union([Schema.Array(Schema.Number), Schema.String]),
  index: Schema.Number,
  object: Schema.optionalKey(Schema.String)
})

/**
 * @since 1.0.0
 */
export const CreateEmbeddingRequest = Schema.Struct({
  input: Schema.Union([
    Schema.String,
    Schema.Array(Schema.String),
    Schema.Array(Schema.Number),
    Schema.Array(Schema.Array(Schema.Number))
  ], { mode: "oneOf" }),
  model: Schema.Union([
    Schema.String,
    Schema.Literals(["text-embedding-ada-002", "text-embedding-3-small", "text-embedding-3-large"])
  ]),
  encoding_format: Schema.optionalKey(Schema.Literals(["float", "base64"])),
  dimensions: Schema.optionalKey(Schema.Number),
  user: Schema.optionalKey(Schema.String)
})

/**
 * @since 1.0.0
 */
export type CreateEmbeddingRequest = typeof CreateEmbeddingRequest.Type

/**
 * @since 1.0.0
 */
export const CreateEmbeddingResponse = Schema.Struct({
  data: Schema.Array(Embedding),
  model: Schema.String,
  object: Schema.optionalKey(Schema.Literal("list")),
  usage: Schema.optionalKey(Schema.Struct({
    prompt_tokens: Schema.Number,
    total_tokens: Schema.Number
  }))
})

/**
 * @since 1.0.0
 */
export type CreateEmbeddingResponse = typeof CreateEmbeddingResponse.Type

/**
 * @since 1.0.0
 */
export type CreateEmbeddingRequestJson = CreateEmbeddingRequest

/**
 * @since 1.0.0
 */
export const CreateEmbeddingRequestJson = CreateEmbeddingRequest

/**
 * @since 1.0.0
 */
export type CreateEmbedding200 = CreateEmbeddingResponse

/**
 * @since 1.0.0
 */
export const CreateEmbedding200 = CreateEmbeddingResponse

/**
 * @since 1.0.0
 */
export type CreateResponseRequestJson = CreateResponse

/**
 * @since 1.0.0
 */
export const CreateResponseRequestJson = CreateResponse

/**
 * @since 1.0.0
 */
export type CreateResponse200 = Response

/**
 * @since 1.0.0
 */
export const CreateResponse200 = Response

/**
 * @since 1.0.0
 */
export type CreateResponse200Sse = ResponseStreamEvent

/**
 * @since 1.0.0
 */
export const CreateResponse200Sse = ResponseStreamEvent
