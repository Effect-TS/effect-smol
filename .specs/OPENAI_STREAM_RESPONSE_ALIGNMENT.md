# OpenAI makeStreamResponse Alignment with Vercel AI SDK

**Status: DRAFT**

## Overview

Update the `makeStreamResponse` method in `packages/ai/openai/src/OpenAiLanguageModel.ts` to align with the Vercel AI SDK's `doStream` implementation, adding support for missing streaming events, provider-defined tools, and improved state management.

## Problem Statement

The current Effect AI SDK `makeStreamResponse` implementation handles basic streaming events but lacks:

1. **Provider-defined tool streaming**: Code interpreter code deltas, apply patch diff deltas, image generation partial results
2. **MCP tool support**: MCP call completion, approval requests, list tools events
3. **Reasoning state machine**: Proper `store`-aware concluding logic with `active`/`can-conclude`/`concluded` states
4. **Annotation tracking**: Collecting annotations for `text-end` metadata
5. **Shell tool streaming**: Local shell and function shell call completion events
6. **Computer use**: Computer call events (placeholder for future support)

## Design Decisions

| Decision                    | Choice                                  | Rationale                                                                                  |
| --------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------ |
| **State Tracking**          | Mutable records in Effect generator     | Match Vercel's `ongoingToolCalls`, `activeReasoning`, `ongoingAnnotations` pattern         |
| **Reasoning State Machine** | `active` → `can-conclude` → `concluded` | Support `store=true` (immediate conclude) vs `store=false` (delayed for encrypted content) |
| **Tool Input Naming**       | Keep `tool-params-*`                    | Effect naming convention; semantically equivalent to Vercel's `tool-input-*`               |
| **JSON Escaping**           | Add `escapeJSONDelta` helper            | Required for streaming JSON-embedded content (code interpreter, apply patch)               |
| **Annotation Collection**   | Track in `ongoingAnnotations` array     | Include in `text-end` metadata like Vercel                                                 |

## Implementation Phases

### Phase 1: Add Internal Utilities

**Goal**: Add helper functions for streaming response processing.

**Files to modify**:

- `packages/ai/openai/src/internal/utilities.ts`

**Tasks**:

- [ ] **1.1** Add `escapeJSONDelta` function that escapes delta strings for JSON embedding: `JSON.stringify(delta).slice(1, -1)`
- [ ] **1.2** Run `pnpm check` to verify no type errors

**Verification**: `pnpm check` passes

### Phase 2: Update Provider Metadata for Annotations

**Goal**: Extend metadata types to support annotation tracking.

**Files to modify**:

- `packages/ai/openai/src/OpenAiLanguageModel.ts`

**Tasks**:

- [ ] **2.1** Add module augmentation for `Response.TextEndPartMetadata` with `openai.annotations` field
- [ ] **2.2** Run `pnpm check` to verify augmentations compile

**Verification**: `pnpm check` passes

### Phase 3: Enhanced State Tracking

**Goal**: Implement comprehensive state tracking for streaming.

**Files to modify**:

- `packages/ai/openai/src/OpenAiLanguageModel.ts`

**Tasks**:

- [ ] **3.1** Update `activeReasoning` state to track `summaryParts` as `Record<string, 'active' | 'can-conclude' | 'concluded'>` instead of `Array<number>`
- [ ] **3.2** Add `ongoingAnnotations` array to track annotations for current message
- [ ] **3.3** Update `activeToolCalls` to include optional `codeInterpreter` state with `containerId`
- [ ] **3.4** Update `activeToolCalls` to include optional `applyPatch` state with `hasDiff` and `endEmitted` flags
- [ ] **3.5** Run `pnpm check` to verify state types

**Verification**: `pnpm check` passes

### Phase 4: Code Interpreter Streaming

**Goal**: Add support for code interpreter code streaming.

**Files to modify**:

- `packages/ai/openai/src/OpenAiLanguageModel.ts`

**Tasks**:

- [ ] **4.1** Handle `response.output_item.added` with `item.type === "code_interpreter_call"`: emit `tool-params-start` and initial JSON delta with containerId
- [ ] **4.2** Handle `response.code_interpreter_call_code.delta` event: emit `tool-params-delta` with escaped delta
- [ ] **4.3** Handle `response.code_interpreter_call_code.done` event: emit closing JSON, `tool-params-end`, and `tool-call` with full params
- [ ] **4.4** Handle `response.output_item.done` with `item.type === "code_interpreter_call"`: emit `tool-result`
- [ ] **4.5** Run `pnpm check` to verify implementation

**Verification**: `pnpm check` passes

### Phase 5: Apply Patch Streaming

**Goal**: Add support for apply patch diff streaming.

**Files to modify**:

- `packages/ai/openai/src/OpenAiLanguageModel.ts`

**Tasks**:

- [ ] **5.1** Handle `response.output_item.added` with `item.type === "apply_patch_call"`: emit `tool-params-start` and initial JSON structure
- [ ] **5.2** For `delete_file` operations, emit complete tool input immediately and set `endEmitted: true`
- [ ] **5.3** For `create_file`/`update_file` operations, emit partial JSON with diff placeholder
- [ ] **5.4** Handle `response.apply_patch_call_operation_diff.delta` event: emit `tool-params-delta` with escaped diff delta
- [ ] **5.5** Handle `response.apply_patch_call_operation_diff.done` event: emit closing JSON and `tool-params-end` if not already emitted
- [ ] **5.6** Handle `response.output_item.done` with `item.type === "apply_patch_call"`: emit `tool-call` with complete operation, handle edge case where diff wasn't streamed
- [ ] **5.7** Run `pnpm check` to verify implementation

**Verification**: `pnpm check` passes

### Phase 6: Image Generation Streaming

**Goal**: Add support for partial image generation results.

**Files to modify**:

- `packages/ai/openai/src/OpenAiLanguageModel.ts`

**Tasks**:

- [ ] **6.1** Handle `response.output_item.added` with `item.type === "image_generation_call"`: emit `tool-call` immediately
- [ ] **6.2** Handle `response.image_generation_call.partial_image` event: emit preliminary `tool-result` with partial base64 image
- [ ] **6.3** Handle `response.output_item.done` with `item.type === "image_generation_call"`: emit final `tool-result` with complete result
- [ ] **6.4** Add `preliminary?: boolean` field to tool-result parts (if not already present in Response types)
- [ ] **6.5** Run `pnpm check` to verify implementation

**Verification**: `pnpm check` passes

### Phase 7: Shell Tool Streaming

**Goal**: Add support for local shell and function shell streaming.

**Files to modify**:

- `packages/ai/openai/src/OpenAiLanguageModel.ts`

**Tasks**:

- [ ] **7.1** Handle `response.output_item.added` with `item.type === "local_shell_call"`: track in `activeToolCalls`
- [ ] **7.2** Handle `response.output_item.done` with `item.type === "local_shell_call"`: emit `tool-call` with action params
- [ ] **7.3** Handle `response.output_item.added` with `item.type === "shell_call"`: track in `activeToolCalls`
- [ ] **7.4** Handle `response.output_item.done` with `item.type === "shell_call"`: emit `tool-call` with action params
- [ ] **7.5** Run `pnpm check` to verify implementation

**Verification**: `pnpm check` passes

### Phase 8: MCP Tool Streaming

**Goal**: Add support for MCP tool calls, approvals, and list tools.

**Files to modify**:

- `packages/ai/openai/src/OpenAiLanguageModel.ts`

**Tasks**:

- [ ] **8.1** Add `approvalRequestIdToToolCallId` mapping (from prompt + from stream)
- [ ] **8.2** Handle `response.output_item.done` with `item.type === "mcp_call"`: emit `tool-call` and `tool-result` with aliased tool call ID if approval request exists
- [ ] **8.3** Handle `response.output_item.done` with `item.type === "mcp_list_tools"`: skip (no UI representation)
- [ ] **8.4** Handle `response.output_item.done` with `item.type === "mcp_approval_request"`: generate dummy tool call ID, emit `tool-call`, and emit `tool-approval-request` part
- [ ] **8.5** Add `ToolApprovalRequestPart` type to Response module if not present (or skip if not applicable to Effect)
- [ ] **8.6** Run `pnpm check` to verify implementation

**Verification**: `pnpm check` passes

### Phase 9: Reasoning State Machine

**Goal**: Implement proper reasoning concluding logic with store awareness.

**Files to modify**:

- `packages/ai/openai/src/OpenAiLanguageModel.ts`

**Tasks**:

- [ ] **9.1** Pass `store` config value to `makeStreamResponse`
- [ ] **9.2** Handle `response.reasoning_summary_part.done` event: if `store=true`, immediately emit `reasoning-end` and mark `concluded`; if `store=false`, mark as `can-conclude`
- [ ] **9.3** Update `response.reasoning_summary_part.added` handler: when new summary part starts, conclude all `can-conclude` parts first
- [ ] **9.4** Update `response.output_item.done` with `item.type === "reasoning"`: conclude all `active` or `can-conclude` parts with final encrypted content
- [ ] **9.5** Run `pnpm check` to verify implementation

**Verification**: `pnpm check` passes

### Phase 10: Annotation Tracking

**Goal**: Track annotations and include in text-end metadata.

**Files to modify**:

- `packages/ai/openai/src/OpenAiLanguageModel.ts`

**Tasks**:

- [ ] **10.1** Clear `ongoingAnnotations` when `response.output_item.added` with `item.type === "message"` is received
- [ ] **10.2** Push annotation to `ongoingAnnotations` in `response.output_text.annotation.added` handler
- [ ] **10.3** Update `response.output_item.done` with `item.type === "message"` handler to include annotations in `text-end` metadata
- [ ] **10.4** Add support for `container_file_citation` annotation type (in addition to existing `file_citation` and `url_citation`)
- [ ] **10.5** Add support for `file_path` annotation type
- [ ] **10.6** Run `pnpm check` to verify implementation

**Verification**: `pnpm check` passes

### Phase 11: Computer Use Placeholder

**Goal**: Add placeholder handling for computer use events.

**Files to modify**:

- `packages/ai/openai/src/OpenAiLanguageModel.ts`

**Tasks**:

- [ ] **11.1** Handle `response.output_item.added` with `item.type === "computer_call"`: track in `activeToolCalls`, emit `tool-params-start`
- [ ] **11.2** Handle `response.output_item.done` with `item.type === "computer_call"`: emit `tool-params-end`, `tool-call`, and `tool-result` with status
- [ ] **11.3** Add TODO comment for full computer use implementation
- [ ] **11.4** Run `pnpm check` to verify implementation

**Verification**: `pnpm check` passes

### Phase 12: Error Handling

**Goal**: Ensure proper error event handling.

**Files to modify**:

- `packages/ai/openai/src/OpenAiLanguageModel.ts`

**Tasks**:

- [ ] **12.1** Handle `response.failed` event in addition to `response.completed` and `response.incomplete`
- [ ] **12.2** Set finish reason to `error` when parsing/validation fails
- [ ] **12.3** Run `pnpm check` to verify implementation

**Verification**: `pnpm check` passes

### Phase 13: Testing

**Goal**: Add comprehensive tests for streaming scenarios.

**Files to modify**:

- `packages/ai/openai/test/OpenAiLanguageModel.test.ts`

**Tasks**:

- [ ] **13.1** Add test for code interpreter streaming (code delta → done → result)
- [ ] **13.2** Add test for apply patch streaming (diff delta → done)
- [ ] **13.3** Add test for apply patch delete_file (immediate complete)
- [ ] **13.4** Add test for image generation partial results
- [ ] **13.5** Add test for reasoning state machine with `store=true`
- [ ] **13.6** Add test for reasoning state machine with `store=false`
- [ ] **13.7** Add test for local shell call streaming
- [ ] **13.8** Add test for annotation tracking in text-end
- [ ] **13.9** Add test for container_file_citation annotations
- [ ] **13.10** Run `pnpm test packages/ai/openai/test/OpenAiLanguageModel.test.ts`

**Verification**: All tests pass

### Phase 14: Final Verification

**Goal**: Ensure all quality checks pass.

**Tasks**:

- [ ] **14.1** Run `pnpm lint-fix` to format all files
- [ ] **14.2** Run `pnpm check` to verify type checking
- [ ] **14.3** Run `pnpm test packages/ai/openai` to run all package tests
- [ ] **14.4** Run `pnpm docgen` to verify JSDoc examples compile
- [ ] **14.5** Run `pnpm build` to verify build succeeds

**Verification**: All commands pass with no errors

## Technical Details

### State Tracking Types

```typescript
// Enhanced activeToolCalls tracking
const activeToolCalls: Record<
  number,
  {
    readonly id: string
    readonly name: string
    readonly codeInterpreter?: {
      readonly containerId: string
    }
    readonly applyPatch?: {
      hasDiff: boolean
      endEmitted: boolean
    }
  } | undefined
> = {}

// Enhanced activeReasoning tracking
const activeReasoning: Record<string, {
  readonly encryptedContent: string | undefined
  readonly summaryParts: Record<string, "active" | "can-conclude" | "concluded">
}> = {}

// Annotation tracking
const ongoingAnnotations: Array<typeof Generated.Annotation.Encoded> = []
```

### escapeJSONDelta Utility

```typescript
// packages/ai/openai/src/internal/utilities.ts

/** @internal */
export const escapeJSONDelta = (delta: string): string => JSON.stringify(delta).slice(1, -1)
```

### Code Interpreter Streaming Pattern

```typescript
// On response.output_item.added with code_interpreter_call
case "code_interpreter_call": {
  activeToolCalls[event.output_index] = {
    id: event.item.id,
    name: "OpenAiCodeInterpreter",
    codeInterpreter: { containerId: event.item.container_id }
  }
  parts.push({
    type: "tool-params-start",
    id: event.item.id,
    name: "OpenAiCodeInterpreter",
    providerName: "code_interpreter",
    providerExecuted: true
  })
  parts.push({
    type: "tool-params-delta",
    id: event.item.id,
    delta: `{"containerId":"${event.item.container_id}","code":"`
  })
  break
}

// On response.code_interpreter_call_code.delta
case "response.code_interpreter_call_code.delta": {
  const toolCall = activeToolCalls[event.output_index]
  if (toolCall != null) {
    parts.push({
      type: "tool-params-delta",
      id: toolCall.id,
      delta: escapeJSONDelta(event.delta)
    })
  }
  break
}

// On response.code_interpreter_call_code.done
case "response.code_interpreter_call_code.done": {
  const toolCall = activeToolCalls[event.output_index]
  if (toolCall != null) {
    parts.push({
      type: "tool-params-delta",
      id: toolCall.id,
      delta: '"}'
    })
    parts.push({ type: "tool-params-end", id: toolCall.id })
    parts.push({
      type: "tool-call",
      id: toolCall.id,
      name: "OpenAiCodeInterpreter",
      params: { code: event.code, container_id: toolCall.codeInterpreter!.containerId },
      providerName: "code_interpreter",
      providerExecuted: true
    })
  }
  break
}
```

### Reasoning State Machine

```typescript
// On response.reasoning_summary_part.done
case "response.reasoning_summary_part.done": {
  const reasoning = activeReasoning[event.item_id]
  if (reasoning != null) {
    if (store === true) {
      // Immediately conclude when storing
      parts.push({
        type: "reasoning-end",
        id: `${event.item_id}:${event.summary_index}`,
        metadata: { openai: { itemId: event.item_id } }
      })
      reasoning.summaryParts[event.summary_index] = 'concluded'
    } else {
      // Mark as can-conclude; will be concluded when new part starts or item done
      reasoning.summaryParts[event.summary_index] = 'can-conclude'
    }
  }
  break
}

// On response.reasoning_summary_part.added (index > 0)
// Conclude all can-conclude parts before starting new one
for (const [idx, status] of Object.entries(reasoning.summaryParts)) {
  if (status === 'can-conclude') {
    parts.push({
      type: "reasoning-end",
      id: `${event.item_id}:${idx}`,
      metadata: { openai: { itemId: event.item_id } }
    })
    reasoning.summaryParts[idx] = 'concluded'
  }
}
```

## Stream Events Reference

| OpenAI Event                                         | Effect Part                                     | Status                                       |
| ---------------------------------------------------- | ----------------------------------------------- | -------------------------------------------- |
| `response.created`                                   | `response-metadata`                             | ✅ Implemented                               |
| `response.completed/incomplete/failed`               | `finish`                                        | ⚠️ Missing `failed`                           |
| `error`                                              | `error`                                         | ✅ Implemented                               |
| `response.output_item.added` (message)               | `text-start`                                    | ✅ Implemented                               |
| `response.output_item.added` (reasoning)             | `reasoning-start`                               | ✅ Implemented                               |
| `response.output_item.added` (function_call)         | `tool-params-start`                             | ✅ Implemented                               |
| `response.output_item.added` (code_interpreter_call) | `tool-params-start` + delta                     | ❌ Missing                                   |
| `response.output_item.added` (apply_patch_call)      | `tool-params-start` + delta                     | ❌ Missing                                   |
| `response.output_item.added` (image_generation_call) | `tool-call`                                     | ❌ Missing                                   |
| `response.output_item.added` (local_shell_call)      | track only                                      | ❌ Missing                                   |
| `response.output_item.added` (shell_call)            | track only                                      | ❌ Missing                                   |
| `response.output_item.added` (computer_call)         | `tool-params-start`                             | ❌ Missing                                   |
| `response.output_item.done` (message)                | `text-end`                                      | ⚠️ Missing annotations                        |
| `response.output_item.done` (reasoning)              | `reasoning-end` (all parts)                     | ⚠️ Missing state machine                      |
| `response.output_item.done` (function_call)          | `tool-params-end` + `tool-call`                 | ✅ Implemented                               |
| `response.output_item.done` (code_interpreter_call)  | `tool-result`                                   | ✅ Implemented                               |
| `response.output_item.done` (apply_patch_call)       | close + `tool-call`                             | ❌ Missing                                   |
| `response.output_item.done` (image_generation_call)  | `tool-result`                                   | ❌ Missing                                   |
| `response.output_item.done` (local_shell_call)       | `tool-call`                                     | ❌ Missing                                   |
| `response.output_item.done` (shell_call)             | `tool-call`                                     | ❌ Missing                                   |
| `response.output_item.done` (computer_call)          | `tool-params-end` + `tool-call` + `tool-result` | ❌ Missing                                   |
| `response.output_item.done` (mcp_call)               | `tool-call` + `tool-result`                     | ❌ Missing                                   |
| `response.output_item.done` (mcp_list_tools)         | skip                                            | ❌ Missing                                   |
| `response.output_item.done` (mcp_approval_request)   | `tool-call` + approval request                  | ❌ Missing                                   |
| `response.output_text.delta`                         | `text-delta`                                    | ✅ Implemented                               |
| `response.output_text.annotation.added`              | `source`                                        | ⚠️ Missing container_file_citation, file_path |
| `response.function_call_arguments.delta`             | `tool-params-delta`                             | ✅ Implemented                               |
| `response.code_interpreter_call_code.delta`          | `tool-params-delta`                             | ❌ Missing                                   |
| `response.code_interpreter_call_code.done`           | close + `tool-params-end` + `tool-call`         | ❌ Missing                                   |
| `response.apply_patch_call_operation_diff.delta`     | `tool-params-delta`                             | ❌ Missing                                   |
| `response.apply_patch_call_operation_diff.done`      | close + `tool-params-end`                       | ❌ Missing                                   |
| `response.image_generation_call.partial_image`       | preliminary `tool-result`                       | ❌ Missing                                   |
| `response.reasoning_summary_part.added`              | `reasoning-start`                               | ✅ Implemented                               |
| `response.reasoning_summary_part.done`               | conditional `reasoning-end`                     | ❌ Missing                                   |
| `response.reasoning_summary_text.delta`              | `reasoning-delta`                               | ✅ Implemented                               |

## Dependencies

- `OpenAiClient` - For streaming response
- `Generated` - Stream event types
- `IdGenerator` - For generating unique IDs
- `Stream` - Effect stream utilities

## Related Specs

- `OPENAI_LANGUAGE_MODEL_PORT.md` - Base implementation (completed)
- `OPENAI_ERROR_MAPPING.md` - Error handling

## References

- [Vercel AI SDK OpenAI Responses](https://github.com/vercel/ai/blob/main/packages/openai/src/responses/openai-responses-language-model.ts)
- [OpenAI Responses Streaming API](https://platform.openai.com/docs/api-reference/responses-streaming)
