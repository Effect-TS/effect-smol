# OpenAI MCP Tool Name Fix

**Status**: PROPOSED

## Problem

OpenAI Responses API MCP output currently gets converted into Effect response parts with synthetic names like `mcp.CheckPackage`.

That breaks decoding when the toolkit only contains the single provider-defined MCP tool `OpenAiMcp`.

### Current Broken Flow

1. User registers `OpenAiTool.Mcp(...)`.
2. Toolkit contains one Effect tool named `OpenAiMcp`.
3. OpenAI returns `mcp_call` or `mcp_approval_request` with remote tool name like `CheckPackage`.
4. `OpenAiLanguageModel` emits `tool-call` / `tool-result` parts named `mcp.CheckPackage`.
5. `LanguageModel.generateText` decodes raw provider output against `Response.Part(toolkit)`.
6. Decode fails because `mcp.CheckPackage` is not a tool name in the toolkit.

## Root Cause

- `packages/ai/openai/src/OpenAiTool.ts` defines MCP as one provider-defined tool:
  - custom name: `OpenAiMcp`
  - provider name: `mcp`
- `packages/ai/openai/src/OpenAiLanguageModel.ts` converts inbound MCP responses using `mcp.${part.name}` and `mcp.${event.item.name}`.
- `packages/effect/src/unstable/ai/Response.ts` only accepts tool names declared in the toolkit.
- `packages/effect/src/unstable/ai/LanguageModel.ts` decodes provider output using that toolkit-derived schema.

## Goals

- Make inbound MCP response parts decode successfully with `OpenAiTool.Mcp`.
- Keep a single canonical Effect tool name for provider-defined MCP: `OpenAiMcp`.
- Preserve remote MCP tool identity in the result payload.
- Normalize MCP call params consistently in streaming and non-streaming paths.
- Add regression coverage for both regular MCP calls and approval flow.

## Non-Goals

- No backward compatibility for old persisted prompts containing `mcp.*` tool names.
- No metadata copy of the remote MCP tool name if it already exists in the payload.
- No change to outbound MCP request registration.
- No generic `LanguageModel` schema changes.

## Required Behavior

After this fix:

- All inbound MCP `tool-call` parts use `name: "OpenAiMcp"`.
- All inbound MCP `tool-result` parts use `name: "OpenAiMcp"`.
- All inbound MCP approval-triggered `tool-call` parts use `name: "OpenAiMcp"`.
- The remote MCP tool name remains in the MCP payload, for example `result.name === "CheckPackage"`.
- MCP params are decoded into structured values before becoming `tool-call.params`.

## Design

### 1. Canonicalize MCP part names

Replace all inbound MCP name construction based on remote tool names.

Instead of:

```ts
const toolName = `mcp.${part.name}`
```

use the canonical Effect tool name:

```ts
const toolName = toolNameMapper.getCustomName("mcp")
```

This keeps the top-level response schema aligned with the registered toolkit tool.

### 2. Keep remote tool identity in payload

The provider-specific MCP payload already contains the remote tool name.

Example expected `tool-result.result` shape:

```ts
{
  type: "call",
  name: "CheckPackage",
  arguments: { packageName: "effect" },
  server_label: "npm",
  output: ...
}
```

No extra metadata field needed.

### 3. Parse MCP args before emitting `tool-call.params`

Current MCP paths do not normalize params the same way as `function_call`.

Implementation should use one shared helper that:

- resolves canonical MCP tool name via `toolNameMapper.getCustomName("mcp")`
- securely parses JSON args when provider returns a string
- leaves already-structured args untouched
- returns both canonical tool name and parsed params

That helper must be used in:

- non-stream `mcp_call`
- non-stream `mcp_approval_request`
- stream `mcp_call`
- stream `mcp_approval_request`

### 4. Make `OpenAiTool.Mcp` accept decoded params

`OpenAiTool.Mcp` needs a permissive parameters schema for inbound MCP tool-call params.

Reason:

- `Response.Part(toolkit)` validates `tool-call.params` against the tool's parameter schema.
- MCP remote tools are dynamic, so the SDK cannot model a fixed parameter schema.

Recommended schema:

```ts
Schema.Unknown
```

If repo conventions prefer a JSON-only constraint, a JSON-object-compatible schema is also acceptable, but `Schema.Unknown` is the minimal safe choice for this provider-defined passthrough tool.

## Files To Change

### `packages/ai/openai/src/OpenAiTool.ts`

- Update `OpenAiTool.Mcp` to define a permissive `parameters` schema for inbound decoded MCP tool-call params.

### `packages/ai/openai/src/OpenAiLanguageModel.ts`

- Add a small shared helper for inbound MCP tool normalization.
- Update non-stream `mcp_call` handling.
- Update non-stream `mcp_approval_request` handling.
- Update streaming `mcp_call` handling.
- Update streaming `mcp_approval_request` handling.
- Ensure malformed MCP JSON still maps to the existing `AiError.ToolParameterValidationError` path.

### `packages/ai/openai/test/OpenAiLanguageModel.test.ts`

- Add focused regression tests for MCP call decoding and approval handling.

## Implementation Plan

### Phase 1: Add permissive MCP params schema

**File**: `packages/ai/openai/src/OpenAiTool.ts`

Tasks:

- Add `parameters: Schema.Unknown` to `OpenAiTool.Mcp`.
- Keep existing args schema unchanged; this phase only affects decoded inbound `tool-call.params`.

Expected result:

- `Response.Part(toolkit)` can decode `tool-call` parts named `OpenAiMcp` with dynamic params.

### Phase 2: Introduce shared MCP normalization helper

**File**: `packages/ai/openai/src/OpenAiLanguageModel.ts`

Add a helper near other response utilities.

Helper responsibilities:

- input: raw MCP provider name mapper context + raw args + method name for errors
- output:
  - canonical tool name: `toolNameMapper.getCustomName("mcp")`
  - parsed params: securely parsed JSON object/value or already-structured input
- on parse failure: raise `AiError.ToolParameterValidationError`

Suggested shape:

```ts
const normalizeMcpToolCall = Effect.fnUntraced(function*(...) {
  ...
})
```

This avoids duplicated MCP parsing logic in four places.

### Phase 3: Fix non-stream response conversion

**File**: `packages/ai/openai/src/OpenAiLanguageModel.ts`

Update `makeResponse` logic.

#### `mcp_call`

- Replace synthetic top-level name construction.
- Use canonical `OpenAiMcp` name.
- Use normalized params helper for `tool-call.params`.
- Keep remote tool name in `tool-result.result.name`.

Expected output pattern:

```ts
parts.push({
  type: "tool-call",
  id: toolId,
  name: "OpenAiMcp",
  params,
  providerExecuted: true
})
```

#### `mcp_approval_request`

- Same canonical name fix.
- Same params normalization.
- Preserve existing approval ID behavior.

### Phase 4: Fix streaming response conversion

**File**: `packages/ai/openai/src/OpenAiLanguageModel.ts`

Update stream event handling for:

- `mcp_call`
- `mcp_approval_request`

Behavior must match non-stream path exactly:

- top-level tool name is canonical `OpenAiMcp`
- params are parsed consistently
- remote tool name stays inside MCP result payload

### Phase 5: Add regression tests

**File**: `packages/ai/openai/test/OpenAiLanguageModel.test.ts`

Add tests grouped under a new MCP-focused describe block.

#### Test 1: non-stream `mcp_call` decodes with canonical tool name

Validate:

- `LanguageModel.generateText` succeeds with toolkit containing only `OpenAiTool.Mcp(...)`
- response contains a `tool-call` part named `OpenAiMcp`
- `tool-call.params` is parsed, not raw JSON string
- response contains a `tool-result` part named `OpenAiMcp`
- `tool-result.result.name` equals remote MCP tool name

#### Test 2: non-stream `mcp_approval_request` uses canonical name

Validate:

- generated `tool-call` uses `OpenAiMcp`
- params are parsed
- paired `tool-approval-request` is emitted
- decode does not fail

#### Test 3: stream `mcp_call` uses canonical name

Validate:

- streamed parts include `tool-call` named `OpenAiMcp`
- params are parsed
- streamed `tool-result` uses `OpenAiMcp`

#### Test 4: stream `mcp_approval_request` uses canonical name

Validate:

- streamed `tool-call` named `OpenAiMcp`
- approval request linked to generated tool call ID
- params are parsed

#### Test 5: follow-up generateText after MCP approval does not fail lookup

Construct a prompt history with:

- assistant `tool-call` named `OpenAiMcp`
- assistant `tool-approval-request`
- tool `tool-approval-response`

Then call `LanguageModel.generateText` again with toolkit containing `OpenAiTool.Mcp(...)`.

Validate:

- no `ToolNotFoundError`
- no invalid output decode error

### Phase 6: Validate repo checks

Run:

- `pnpm lint-fix`
- `pnpm test packages/ai/openai/test/OpenAiLanguageModel.test.ts`
- `pnpm check:tsgo`
- `pnpm docgen`

If `pnpm check:tsgo` fails due to cache noise, run:

- `pnpm clean`
- `pnpm check:tsgo`

## Test Data Notes

The new tests should model OpenAI MCP payloads close to provider reality.

Use values like:

```ts
{
  type: "mcp_call",
  id: "mcp_call_123",
  name: "CheckPackage",
  arguments: "{\"packageName\":\"effect\"}",
  server_label: "npm",
  output: ...
}
```

and:

```ts
{
  type: "mcp_approval_request",
  id: "approval_123",
  approval_request_id: "approval_123",
  name: "CheckPackage",
  arguments: "{\"packageName\":\"effect\"}"
}
```

Tests should assert decoded semantic behavior, not only raw transport shape.

## Risks

- If any internal test or consumer implicitly relied on synthetic names like `mcp.CheckPackage`, that behavior changes. This is intentional.
- MCP args may arrive as either strings or structured values; helper must handle both paths.
- Streaming and non-streaming logic must stay aligned or this bug will reappear in one path only.

## Acceptance Criteria

- `OpenAiTool.Mcp` toolkits decode inbound MCP response parts without invalid output errors.
- All inbound MCP `tool-call` and `tool-result` parts use `OpenAiMcp` as the Effect tool name.
- Remote MCP tool name remains available in the MCP payload.
- MCP approval flows no longer fail due to mismatched tool names.
- Added regression tests cover both non-streaming and streaming behavior.
- Required validation commands pass.

## Unresolved Questions

- None.
