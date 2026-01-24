# OpenAI makeStreamResponse Alignment with Vercel AI SDK

**Status: COMPLETED**

## Overview

Update the `makeStreamResponse` method in `packages/ai/openai/src/OpenAiLanguageModel.ts` to align with the Vercel AI SDK's `doStream` implementation, adding support for missing streaming events, provider-defined tools, and improved state management.

## Problem Statement

The current Effect AI SDK `makeStreamResponse` implementation handles basic streaming events but lacks:

1. **Provider-defined tool streaming**: Code interpreter code deltas, image generation partial results
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
| **JSON Escaping**           | Add `escapeJSONDelta` helper            | Required for streaming JSON-embedded content (code interpreter)                            |
| **Annotation Collection**   | Track in `ongoingAnnotations` array     | Include in `text-end` metadata like Vercel                                                 |

## Implementation Phases

### Phase 1: Add Internal Utilities

**Goal**: Add helper functions for streaming response processing.

**Files to modify**:

- `packages/ai/openai/src/internal/utilities.ts`

**Tasks**:

- [x] **1.1** Add `escapeJSONDelta` function that escapes delta strings for JSON embedding: `JSON.stringify(delta).slice(1, -1)`
- [x] **1.2** Run `pnpm check` to verify no type errors

**Verification**: `pnpm check` passes

### Phase 2: Update Provider Metadata for Annotations

**Goal**: Extend metadata types to support annotation tracking.

**Files to modify**:

- `packages/ai/openai/src/OpenAiLanguageModel.ts`

**Tasks**:

- [x] **2.1** Add module augmentation for `Response.TextEndPartMetadata` with `openai.annotations` field
- [x] **2.2** Run `pnpm check` to verify augmentations compile

**Verification**: `pnpm check` passes

### Phase 3: Enhanced State Tracking

**Goal**: Implement comprehensive state tracking for streaming.

**Files to modify**:

- `packages/ai/openai/src/OpenAiLanguageModel.ts`

**Tasks**:

- [x] **3.1** Update `activeReasoning` state to track `summaryParts` as `Record<string, 'active' | 'can-conclude' | 'concluded'>` instead of `Array<number>`
- [x] **3.2** Add `ongoingAnnotations` array to track annotations for current message
- [x] **3.3** Update `activeToolCalls` to include optional `codeInterpreter` state with `containerId`
- [x] ~~**3.4** Update `activeToolCalls` to include optional `applyPatch` state with `hasDiff` and `endEmitted` flags~~ (Skipped: apply_patch streaming events not in current API)
- [x] **3.5** Run `pnpm check` to verify state types

**Verification**: `pnpm check` passes

### Phase 4: Code Interpreter Streaming

**Goal**: Add support for code interpreter code streaming.

**Files to modify**:

- `packages/ai/openai/src/OpenAiLanguageModel.ts`

**Tasks**:

- [x] **4.1** Handle `response.output_item.added` with `item.type === "code_interpreter_call"`: emit `tool-params-start` and initial JSON delta with containerId
- [x] **4.2** Handle `response.code_interpreter_call_code.delta` event: emit `tool-params-delta` with escaped delta
- [x] **4.3** Handle `response.code_interpreter_call_code.done` event: emit closing JSON, `tool-params-end`, and `tool-call` with full params
- [x] **4.4** Handle `response.output_item.done` with `item.type === "code_interpreter_call"`: emit `tool-result`
- [x] **4.5** Run `pnpm check` to verify implementation

**Verification**: `pnpm check` passes

### Phase 5: Apply Patch Streaming

**Status**: SKIPPED - Apply patch streaming events (`response.apply_patch_call_operation_diff.delta`, `response.apply_patch_call_operation_diff.done`) do not exist in the current OpenAI API.

### Phase 6: Image Generation Streaming

**Goal**: Add support for partial image generation results.

**Files to modify**:

- `packages/ai/openai/src/OpenAiLanguageModel.ts`

**Tasks**:

- [x] **6.1** Handle `response.output_item.added` with `item.type === "image_generation_call"`: emit `tool-call` immediately
- [x] **6.2** Handle `response.image_generation_call.partial_image` event: emit `tool-result` with partial base64 image (identified by `partial_image_index`)
- [x] **6.3** Handle `response.output_item.done` with `item.type === "image_generation_call"`: emit final `tool-result` with complete result
- [x] ~~**6.4** Add `preliminary?: boolean` field to tool-result parts~~ (Skipped: use `partial_image_index` in result to identify partial results)
- [x] **6.5** Run `pnpm check` to verify implementation

**Verification**: `pnpm check` passes

### Phase 7: Shell Tool Streaming

**Goal**: Add support for local shell and function shell streaming.

**Files to modify**:

- `packages/ai/openai/src/OpenAiLanguageModel.ts`

**Tasks**:

- [x] **7.1** Handle `response.output_item.added` with `item.type === "local_shell_call"`: track in `activeToolCalls`
- [x] **7.2** Handle `response.output_item.done` with `item.type === "local_shell_call"`: emit `tool-call` with action params
- [x] **7.3** Handle `response.output_item.added` with `item.type === "shell_call"`: track in `activeToolCalls`
- [x] **7.4** Handle `response.output_item.done` with `item.type === "shell_call"`: emit `tool-call` with action params
- [x] **7.5** Run `pnpm check` to verify implementation

**Verification**: `pnpm check` passes

### Phase 8: MCP Tool Streaming

**Goal**: Add support for MCP tool calls, approvals, and list tools.

**Files to modify**:

- `packages/ai/openai/src/OpenAiLanguageModel.ts`

**Tasks**:

- [x] ~~**8.1** Add `approvalRequestIdToToolCallId` mapping~~ (Simplified: direct handling)
- [x] **8.2** Handle `response.output_item.done` with `item.type === "mcp_call"`: emit `tool-call` and `tool-result`
- [x] **8.3** Handle `response.output_item.done` with `item.type === "mcp_list_tools"`: skip (no UI representation)
- [x] **8.4** Handle `response.output_item.done` with `item.type === "mcp_approval_request"`: emit `tool-call` with approval request info
- [x] ~~**8.5** Add `ToolApprovalRequestPart` type~~ (Skipped: not needed for current implementation)
- [x] **8.6** Run `pnpm check` to verify implementation

**Verification**: `pnpm check` passes

### Phase 9: Reasoning State Machine

**Goal**: Implement proper reasoning concluding logic with store awareness.

**Files to modify**:

- `packages/ai/openai/src/OpenAiLanguageModel.ts`

**Tasks**:

- [x] ~~**9.1** Pass `store` config value to `makeStreamResponse`~~ (Simplified: state machine handles all cases)
- [x] **9.2** Handle `response.reasoning_summary_part.done` event: mark as `can-conclude` (will be concluded when new part starts or item done)
- [x] **9.3** Update `response.reasoning_summary_part.added` handler: when new summary part starts, conclude all `can-conclude` parts first
- [x] **9.4** Update `response.output_item.done` with `item.type === "reasoning"`: conclude all `active` or `can-conclude` parts with final encrypted content
- [x] **9.5** Run `pnpm check` to verify implementation

**Verification**: `pnpm check` passes

### Phase 10: Annotation Tracking

**Goal**: Track annotations and include in text-end metadata.

**Files to modify**:

- `packages/ai/openai/src/OpenAiLanguageModel.ts`

**Tasks**:

- [x] **10.1** Clear `ongoingAnnotations` when `response.output_item.added` with `item.type === "message"` is received
- [x] **10.2** Push annotation to `ongoingAnnotations` in `response.output_text.annotation.added` handler
- [x] **10.3** Update `response.output_item.done` with `item.type === "message"` handler to include annotations in `text-end` metadata
- [x] **10.4** Add support for `container_file_citation` annotation type (in addition to existing `file_citation` and `url_citation`)
- [x] **10.5** Add support for `file_path` annotation type
- [x] **10.6** Run `pnpm check` to verify implementation

**Verification**: `pnpm check` passes

### Phase 11: Computer Use Placeholder

**Status**: Already has TODO placeholder in the existing implementation.

### Phase 12: Error Handling

**Goal**: Ensure proper error event handling.

**Tasks**:

- [x] **12.1** Handle `response.failed` event in addition to `response.completed` and `response.incomplete` (already implemented)
- [x] **12.2** Run `pnpm check` to verify implementation

**Verification**: `pnpm check` passes

### Phase 13: Testing

**Status**: Tests pass with existing test coverage.

### Phase 14: Final Verification

**Goal**: Ensure all quality checks pass.

**Tasks**:

- [x] **14.1** Run `pnpm lint-fix` to format all files
- [x] **14.2** Run `pnpm check` to verify type checking
- [x] **14.3** Run `pnpm test packages/ai/openai/test/OpenAiLanguageModel.test.ts` to run all package tests
- [x] **14.4** Run `pnpm docgen` to verify JSDoc examples compile

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
  } | undefined
> = {}

// Enhanced activeReasoning tracking
const activeReasoning: Record<string, {
  readonly encryptedContent: string | undefined
  readonly summaryParts: Record<number, "active" | "can-conclude" | "concluded">
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
    // Mark as can-conclude; will be concluded when new part starts or item done
    reasoning.summaryParts[event.summary_index] = 'can-conclude'
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

| OpenAI Event                                         | Effect Part                             | Status         |
| ---------------------------------------------------- | --------------------------------------- | -------------- |
| `response.created`                                   | `response-metadata`                     | ✅ Implemented |
| `response.completed/incomplete/failed`               | `finish`                                | ✅ Implemented |
| `error`                                              | `error`                                 | ✅ Implemented |
| `response.output_item.added` (message)               | `text-start`                            | ✅ Implemented |
| `response.output_item.added` (reasoning)             | `reasoning-start`                       | ✅ Implemented |
| `response.output_item.added` (function_call)         | `tool-params-start`                     | ✅ Implemented |
| `response.output_item.added` (code_interpreter_call) | `tool-params-start` + delta             | ✅ Implemented |
| `response.output_item.added` (image_generation_call) | `tool-call`                             | ✅ Implemented |
| `response.output_item.added` (local_shell_call)      | track only                              | ✅ Implemented |
| `response.output_item.added` (shell_call)            | track only                              | ✅ Implemented |
| `response.output_item.added` (computer_call)         | (TODO)                                  | ⚠️ Placeholder  |
| `response.output_item.done` (message)                | `text-end` with annotations             | ✅ Implemented |
| `response.output_item.done` (reasoning)              | `reasoning-end` (all parts)             | ✅ Implemented |
| `response.output_item.done` (function_call)          | `tool-params-end` + `tool-call`         | ✅ Implemented |
| `response.output_item.done` (code_interpreter_call)  | `tool-result`                           | ✅ Implemented |
| `response.output_item.done` (image_generation_call)  | `tool-result`                           | ✅ Implemented |
| `response.output_item.done` (local_shell_call)       | `tool-call`                             | ✅ Implemented |
| `response.output_item.done` (shell_call)             | `tool-call`                             | ✅ Implemented |
| `response.output_item.done` (computer_call)          | (TODO)                                  | ⚠️ Placeholder  |
| `response.output_item.done` (mcp_call)               | `tool-call` + `tool-result`             | ✅ Implemented |
| `response.output_item.done` (mcp_list_tools)         | skip                                    | ✅ Implemented |
| `response.output_item.done` (mcp_approval_request)   | `tool-call`                             | ✅ Implemented |
| `response.output_text.delta`                         | `text-delta`                            | ✅ Implemented |
| `response.output_text.annotation.added`              | `source`                                | ✅ Implemented |
| `response.function_call_arguments.delta`             | `tool-params-delta`                     | ✅ Implemented |
| `response.code_interpreter_call_code.delta`          | `tool-params-delta`                     | ✅ Implemented |
| `response.code_interpreter_call_code.done`           | close + `tool-params-end` + `tool-call` | ✅ Implemented |
| `response.image_generation_call.partial_image`       | `tool-result` (partial)                 | ✅ Implemented |
| `response.reasoning_summary_part.added`              | `reasoning-start`                       | ✅ Implemented |
| `response.reasoning_summary_part.done`               | state transition                        | ✅ Implemented |
| `response.reasoning_summary_text.delta`              | `reasoning-delta`                       | ✅ Implemented |

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
