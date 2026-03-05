# Previous Response ID Tracking

## Overview

Add a core mechanism for tracking provider response IDs (e.g., OpenAI's `resp_123`)
and filtering prompts to only include unsent parts. When a response ID is stored, the
core `LanguageModel` module computes an incremental prompt (the delta since the last
assistant turn) and passes it alongside the full prompt in `ProviderOptions`. Providers
ignore these new fields for now — this spec builds the foundation for a future change
where providers that support incremental input (OpenAI Responses API) use the filtered
prompt + `previous_response_id`.

This is transport-agnostic: the same filtered prompt will serve both HTTP and future
WebSocket mode, where each turn sends `{ type: "response.create", previous_response_id, input: <incremental> }`.

## Goals

- Add a `ResponseIdTracker` service that stores the last response ID in memory per LanguageModel client.
- Automatically extract `ResponseMetadataPart.id` from provider responses and store it.
- Compute an incremental prompt (new parts only) in the core `LanguageModel.make` orchestrator — not in providers.
- Pass both the full prompt and the incremental prompt to providers via `ProviderOptions`.
- Proactively clear the tracker when a session/connection is known to have dropped, avoiding a wasted round-trip with a stale response ID.
- Ensure the architecture enables a future WebSocket transport without changes to the filtering logic.

## Non-Goals

- Changing provider behavior. All providers continue to use `options.prompt` (the full prompt). The new `ProviderOptions` fields are populated by the core but ignored by providers. A future spec will wire `incrementalPrompt` and `previousResponseId` into provider request construction, `previous_response_not_found` retry logic, etc.
- WebSocket transport implementation (separate spec). This spec provides the foundation: response ID tracking, prompt filtering, and `ProviderOptions` fields that a WebSocket transport will consume.
- WebSocket connection lifecycle management (connect, 60-min reconnect, `generate: false` warmup).
- Persistence of response IDs across process restarts (in-memory only).
- Changes to the `Chat` service — `Chat` implicitly benefits since it calls `LanguageModel.generateText`/`streamText`.
- Changes to `Prompt` or `Response` module schemas.

## Current State

### Response ID Capture

`Response.ResponseMetadataPart` already has an `id` field (`Response.ts:2191-2195`) populated by providers:

- **OpenAI non-streaming** (`OpenAiLanguageModel.ts:954-955`): `id: rawResponse.id`
- **OpenAI streaming** (`OpenAiLanguageModel.ts:1392-1393`): `id: event.response.id`

### Response ID Not Forwarded

The response ID is captured in `ResponseMetadataPart` but never forwarded to subsequent requests:

1. `Prompt.fromResponseParts()` (`Prompt.ts:1930-2041`) drops `ResponseMetadataPart` — no `case "response-metadata"`.
2. `LanguageModel.ProviderOptions` (`LanguageModel.ts:571-625`) has no field for a previous response ID.
3. The OpenAI provider's `Config` includes `previous_response_id` implicitly (via `Partial<Omit<CreateResponse.Encoded, ...>>`) but it is static configuration, not automatically managed.

### OpenAI Config Mechanism

`Config` (`OpenAiLanguageModel.ts:62-102`) spreads into the request at line 377-378:

```ts
const request: typeof Generated.CreateResponse.Encoded = {
  ...config,
  input: messages,
  ...
}
```

`previous_response_id` from Config already flows into the request. The gap is that nothing automatically sets it.

### Transport Surface

`OpenAiClient` (`OpenAiClient.ts`) exposes two methods:

- `createResponse` (line 187) — HTTP POST to `/responses`, returns `[body, response]`
- `createResponseStream` (line 224) — HTTP POST to `/responses` with `stream: true`, returns `[response, eventStream]`

Both consume the same request body shape (`Generated.CreateResponse.Encoded`). A future WebSocket transport would wrap this same body in `{ type: "response.create", ...body }` and send it over `wss://api.openai.com/v1/responses`. The request body construction (`makeRequest`) is already decoupled from transport — no changes needed for WebSocket readiness.

### Other Providers

- **Anthropic**: Emits `response-metadata` parts but does not support `previous_response_id`. No changes needed.
- **OpenRouter**: Same as Anthropic.

## Proposed Design

### Step 1: Add Fields to `ProviderOptions`

Add two optional fields to `LanguageModel.ProviderOptions`:

```ts
// LanguageModel.ts:571
export interface ProviderOptions {
  readonly prompt: Prompt.Prompt
  readonly tools: ReadonlyArray<Tool.Any>
  readonly responseFormat: ...
  readonly toolChoice: ToolChoice<any>
  readonly span: Span
  readonly previousResponseId: string | undefined       // NEW
  readonly incrementalPrompt: Prompt.Prompt | undefined  // NEW
}
```

- `prompt` — always the full conversation prompt (unchanged).
- `previousResponseId` — the response ID from the prior turn (if tracked). Provider-agnostic hint.
- `incrementalPrompt` — the prompt filtered to only include messages after the last assistant turn. `undefined` when no prior response ID exists (first turn) or when the tracker is not active.

Providers that support incremental input use `incrementalPrompt` when available, falling back to `prompt` for retry or when `incrementalPrompt` is undefined. Providers that don't support incremental input ignore both new fields and use `prompt` as before. Adding optional fields to a parameter type is non-breaking.

### Step 2: Create `ResponseIdTracker` Service

Create `packages/effect/src/unstable/ai/ResponseIdTracker.ts`:

```ts
import * as Effect from "../../Effect.ts"
import * as Option from "../../Option.ts"
import * as Ref from "../../Ref.ts"
import * as ServiceMap from "../../ServiceMap.ts"

export class ResponseIdTracker extends ServiceMap.Service<ResponseIdTracker, Service>()(
  "effect/unstable/ai/ResponseIdTracker"
) {}

export interface Service {
  readonly get: Effect.Effect<Option.Option<string>>
  readonly set: (id: string) => Effect.Effect<void>
  readonly clear: Effect.Effect<void>
  readonly onSessionDrop: Effect.Effect<void>
  readonly markParts: (parts: ReadonlyArray<object>) => void
  readonly hasPart: (part: object) => boolean
}

export const make: Effect.Effect<Service> = Effect.sync(() => {
  const ref = Ref.makeUnsafe<Option.Option<string>>(Option.none())
  const sentParts = new WeakSet<object>()
  return {
    get: Ref.get(ref),
    set: (id: string) => Ref.set(ref, Option.some(id)),
    clear: Ref.set(ref, Option.none()),
    onSessionDrop: Ref.set(ref, Option.none()),
    markParts: (parts) => {
      for (const part of parts) {
        sentParts.add(part)
      }
    },
    hasPart: (part) => sentParts.has(part)
  }
})

export const layer: Layer.Layer<ResponseIdTracker> =
  Layer.effect(ResponseIdTracker, make)
```

A `Ref` holding `Option<string>` for the response ID, plus a `WeakSet<object>` tracking which prompt parts have been sent. The `WeakSet` enables the core to detect when sent context has changed (e.g., system prompt replaced) by checking object identity — since prompt parts are immutable, a new object means new content.

`markParts` and `hasPart` are synchronous because `WeakSet.add`/`WeakSet.has` are pure data structure operations with no async behavior.

`onSessionDrop` is semantically identical to `clear` but exists as a separate method to make the intent explicit at call sites: transports call `onSessionDrop` when a connection is lost, while `clear` is used for error recovery and manual resets. Both reset the response ID ref to `None`. Neither clears the `WeakSet` — this is intentional. The `WeakSet` doesn't need clearing because: (1) after the response ID is cleared, the next request sends the full prompt regardless, (2) after that request succeeds all current parts are re-marked, and (3) stale entries in the `WeakSet` are garbage-collected when the part objects are no longer referenced by any prompt.

**Session drop contract:** Any transport layer that manages a persistent session (e.g., WebSocket) MUST call `onSessionDrop` when the session is lost. This proactively invalidates the stale response ID so the next request uses the full prompt immediately, avoiding a wasted round-trip that would fail with `previous_response_not_found`. For stateless transports (HTTP), there is no session to drop — a future `previous_response_not_found` retry mechanism (deferred to the provider consumption spec) will serve as the safety net.

**Concurrency note:** `Ref` is fiber-safe. The tracker stores a single "last response ID" — if two calls run concurrently, the tracker holds whichever was written last. This is acceptable: `Chat` serializes via semaphore, and concurrent use of the same LanguageModel instance for the same conversation is unusual.

### Step 3: Core Prompt Filtering in `LanguageModel.make`

This is the key architectural decision: **prompt filtering lives in the core, not in providers.** The `LanguageModel.make` orchestrator computes `incrementalPrompt` before calling the provider.

#### Filtering Algorithm

The algorithm uses the tracker's `WeakSet` to determine which parts the server has already seen. Since prompt parts are immutable objects, object identity in the `WeakSet` reliably indicates whether the server has that exact content.

```ts
type IncrementalResult =
  | { readonly _tag: "Incremental"; readonly prompt: Prompt.Prompt }
  | { readonly _tag: "Diverged" }   // context changed, must clear tracker and send full
  | { readonly _tag: "None" }       // no new content

const computeIncrementalPrompt = (
  prompt: Prompt.Prompt,
  tracker: Service
): IncrementalResult => {
  const parts = prompt.content

  // Find the last assistant message — this is the boundary of what
  // the server generated in the previous turn
  let lastAssistantIndex = -1
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i].role === "assistant") {
      lastAssistantIndex = i
      break
    }
  }

  // No assistant message → first turn, no incremental
  if (lastAssistantIndex === -1) {
    return { _tag: "None" }
  }

  // Verify all parts BEFORE the last assistant message are in the WeakSet.
  // These are parts that were sent in prior requests. If any is missing,
  // it means the context has changed (e.g., system prompt replaced, user
  // message edited) and the server's cached context is stale.
  // The last assistant part itself is NOT checked — it was generated by
  // the server, not sent by us, so it won't be in the WeakSet.
  for (let i = 0; i < lastAssistantIndex; i++) {
    if (!tracker.hasPart(parts[i])) {
      return { _tag: "Diverged" }
    }
  }

  // Parts after the last assistant message are new content to send
  const newParts = parts.slice(lastAssistantIndex + 1)
  if (newParts.length === 0) {
    return { _tag: "None" }
  }

  return { _tag: "Incremental", prompt: Prompt.fromMessages(newParts) }
}
```

**Why check parts before the last assistant message, not including it?** The last assistant message corresponds to the response the server generated for `previousResponseId`. The server inherently has it — we never sent it. It won't be in the `WeakSet` because only parts from the *sent prompt* are marked. Everything before it was part of a prompt we sent in a prior request and should be in the `WeakSet` if the context hasn't changed.

**Automatic system prompt change detection:** A changed system prompt is a new object that won't be in the `WeakSet`, so `computeIncrementalPrompt` returns `Diverged` automatically. The orchestrator clears the tracker and sends the full prompt — no caller awareness needed.

**Boundary cases:**

| Scenario | Result |
|----------|--------|
| First turn: `[sys, user1]` | `None` (no assistant turn yet) |
| Simple follow-up: `[sys, user1, asst1, user2]` | `Incremental([user2])` — `sys`, `user1` in WeakSet ✓ |
| Tool results: `[sys, user1, asst1(calls), tool(results)]` | `Incremental([tool(results)])` |
| Multi-step: `[..., asst(calls), tool(results), user2]` | `Incremental([tool(results), user2])` |
| No new messages after assistant: `[sys, user1, asst1]` | `None` |
| Multi-turn, no new: `[sys, user1, asst1, user2, asst2]` | `None` (server already has everything) |
| System prompt changed: `[sys_new, user1, asst1, user2]` | `Diverged` — `sys_new` not in WeakSet |
| Middle user message edited: `[sys, user1_edited, asst1, user2]` | `Diverged` — `user1_edited` not in WeakSet |
| Multiple edits: `[sys_new, user1_edited, asst1, user2]` | `Diverged` — `sys_new` not in WeakSet (first miss short-circuits) |
| After session drop + reconnect (fresh full send): `[sys, user1, asst1, user2]` | `Incremental([user2])` — all pre-assistant parts re-marked by the full send |

#### Integration in `LanguageModel.make`

```ts
export const make: (params: ConstructorParams) => Effect.Effect<Service> =
  Effect.fnUntraced(function*(params) {
    const tracker = yield* ResponseIdTracker
    // ... existing setup ...
  })
```

**All three methods (`generateText`, `generateObject`, `streamText`):**

Both `generateText` and `generateObject` delegate to the shared `generateContent` helper (`LanguageModel.ts:882`), which constructs `ProviderOptions` and calls `params.generateText(providerOptions)`. The tracker logic should be placed at the `generateContent` level — not duplicated in each call site. `streamText` has its own path via `streamContent` (`LanguageModel.ts:1043`).

Before calling the provider, read the tracker and compute `incrementalPrompt`:

```ts
let previousResponseId: string | undefined = undefined
let incrementalPrompt: Prompt.Prompt | undefined = undefined

const storedId = yield* tracker.get.pipe(Effect.map(Option.getOrUndefined))

if (storedId !== undefined) {
  const result = computeIncrementalPrompt(prompt, tracker)
  switch (result._tag) {
    case "Incremental":
      previousResponseId = storedId
      incrementalPrompt = result.prompt
      break
    case "Diverged":
      // Context changed (e.g., system prompt replaced) — server's
      // cached context is stale. Clear the tracker and send full.
      yield* tracker.clear
      break
    case "None":
      // No new content after the last assistant turn.
      // Keep previousResponseId undefined — nothing to send.
      break
  }
}

const providerOptions: ProviderOptions = {
  prompt,
  tools: [],
  toolChoice: "none",
  responseFormat: { type: "text" },
  span,
  previousResponseId,
  incrementalPrompt
}
```

**Note on tool approval resolution:** `generateContent` may mutate `providerOptions.prompt` during tool approval resolution (`LanguageModel.ts:979-998`), appending tool result messages. This happens *after* the initial `incrementalPrompt` computation but *before* the provider is called with the mutated prompt. Since tool approval adds new messages to the *end* of the prompt, and `incrementalPrompt` already captures messages after the last assistant turn, the approval-added messages will be part of what the provider sees via `prompt`. However, `incrementalPrompt` will not contain them. The correct approach: recompute `incrementalPrompt` from the (potentially mutated) `prompt` immediately before calling the provider, not at initial construction. The pseudo-code above shows the initial computation for clarity; the implementation should recompute after approval resolution.

After the provider returns, mark sent parts in the `WeakSet` and store the response ID:

**Non-streaming (`generateText`, `generateObject`):**

```ts
const content = yield* generateContent(options, providerOptions)

// Mark all prompt parts as "server has seen" in the WeakSet.
// This includes parts already in the set (no-op) and any new parts
// (e.g., tool results appended during approval resolution).
tracker.markParts(providerOptions.prompt.content)

const metadataPart = content.find((p) => p.type === "response-metadata")
if (metadataPart && metadataPart.id) {
  yield* tracker.set(metadataPart.id)
}
```

**Streaming (`streamText`):**

```ts
const stream = yield* streamContent(options, providerOptions)

// Mark prompt parts immediately — the request has been sent
tracker.markParts(providerOptions.prompt.content)

return stream.pipe(
  Stream.mapArrayEffect((part) => {
    if (part.type === "response-metadata" && part.id) {
      return tracker.set(part.id).pipe(Effect.as(part))
    }
    return Effect.succeed(part)
  })
)
```

**Note on `markParts` timing:** Parts are marked after the request succeeds (non-streaming) or after the stream is established (streaming). If the request fails, parts are not marked, which is correct — the server never saw them.

### Step 4: Provide Tracker in Provider Layers

`OpenAiLanguageModel.make` creates and provides a tracker per instance:

```ts
export const make = Effect.fnUntraced(function*({ model, config: providerConfig }) {
  const client = yield* OpenAiClient
  const trackerService = yield* ResponseIdTracker.make

  // ... existing makeConfig, makeRequest, etc. ...

  return yield* LanguageModel.make({ generateText, streamText }).pipe(
    Effect.provideService(ResponseIdTracker, trackerService),
    // ... existing providers
  )
})
```

Every `OpenAiLanguageModel` instance gets its own tracker. The tracker lifecycle is tied to the LanguageModel instance.

**No provider behavior changes.** The OpenAI provider continues to use `options.prompt` (the full prompt) for all requests. The new `ProviderOptions` fields (`previousResponseId`, `incrementalPrompt`) are populated by the core but ignored by all providers for now. A future spec will wire these fields into the provider's `prepareMessages` and `makeRequest` to enable incremental input and `previous_response_not_found` retry.

The `trackerService` reference is also available to the transport layer. A future WebSocket transport receives the tracker and calls `trackerService.onSessionDrop` whenever the connection closes (network error, 60-min limit, explicit server close). For the current HTTP transport, no session lifecycle exists, so no wiring is needed.

## WebSocket Mode Compatibility

This design is explicitly structured to enable a future WebSocket transport with no changes to the filtering or tracking logic.

### What WebSocket mode requires (from OpenAI docs)

1. Persistent connection to `wss://api.openai.com/v1/responses`
2. Each turn sends `{ type: "response.create", previous_response_id, input: <incremental>, model, tools, ... }`
3. Server keeps ONE previous-response state in connection-local memory — continuing from that is fast
4. One in-flight response at a time per connection (sequential, no multiplexing)
5. 60-minute connection limit; must reconnect
6. `previous_response_not_found` when cached ID is evicted (or `store=false` + reconnect)
7. Server events match HTTP streaming event model

### How this spec provides the foundation

| WebSocket need | Provided by this spec |
|----------------|----------------------|
| `previous_response_id` | `ProviderOptions.previousResponseId` + `ResponseIdTracker` |
| Incremental input items | `ProviderOptions.incrementalPrompt` computed by core |
| `previous_response_not_found` recovery | `tracker.clear` + `ProviderOptions.prompt` (full) available for future retry logic |
| Session drop / reconnect | `tracker.onSessionDrop` clears stale ID; next request sends full prompt |
| Same request body shape | `makeRequest` produces transport-neutral `CreateResponse.Encoded` body |
| Sequential processing | `Chat` serializes via semaphore; tracker stores single ID |

### What a future WebSocket spec adds (not in this spec)

- **WebSocket transport service**: An alternative to `OpenAiClient.createResponse`/`createResponseStream` that wraps the request body in `{ type: "response.create", ...body }` and sends over WebSocket.
- **Connection lifecycle**: Connect, reconnect on 60-min limit, handle `websocket_connection_limit_reached`. On any connection close, call `tracker.onSessionDrop` before reconnecting.
- **Error normalization**: WebSocket error events (`{ "type": "error", ... }`) must be normalized to the same `AiError` shape so `isPreviousResponseNotFound` works unchanged.
- **`generate: false` warmup**: Pre-warm server state by sending `response.create` with `generate: false`. Returns a response ID storable in the tracker.
- **Compaction integration**: After standalone `/responses/compact`, start a new chain with compacted input by clearing the tracker and sending full compacted prompt.

### Reconnection and tracker behavior

When a session or connection drops, the transport MUST call `tracker.onSessionDrop` immediately. This proactively clears the stale response ID so the next request sends the full prompt without first attempting (and failing with) the old ID.

**WebSocket reconnection flow:**
1. WebSocket connection drops (network error, 60-min limit, server close).
2. Transport detects the close event and calls `tracker.onSessionDrop`.
3. Tracker resets to `None`.
4. Transport establishes a new connection.
5. Next request sees no `previousResponseId` → sends full prompt → server processes normally.
6. Response ID from the new response is stored in the tracker, resuming the chain on the new connection.

**HTTP transport:** No persistent session exists, so there is no session drop to detect. If the server evicts a cached response between HTTP requests, a future `previous_response_not_found` retry mechanism (deferred to the provider consumption spec) will handle recovery.

**Safety net:** Even with proactive clearing via `onSessionDrop`, a future `previous_response_not_found` retry mechanism will provide an additional safety net for edge cases where the drop notification races with an in-flight request, or where the server evicts the response for reasons unrelated to a connection drop (e.g., `store: false`, server-side TTL expiry).

## Impacted Files

### Core

- `packages/effect/src/unstable/ai/LanguageModel.ts` — Add `previousResponseId` and `incrementalPrompt` to `ProviderOptions`; add `computeIncrementalPrompt` utility; read/update tracker in all three methods inside `make`.
- `packages/effect/src/unstable/ai/ResponseIdTracker.ts` — **New file.** `ResponseIdTracker` service.

### OpenAI Provider

- `packages/ai/openai/src/OpenAiLanguageModel.ts` — Create and provide tracker in `make`. No changes to request construction or prompt handling.

### OpenAI Compat Provider

- `packages/ai/openai-compat/src/OpenAiLanguageModel.ts` — Same as OpenAI provider: create and provide tracker.

### Unaffected

- `packages/ai/anthropic/src/AnthropicLanguageModel.ts` — No changes.
- `packages/ai/openrouter/src/OpenRouterLanguageModel.ts` — No changes.
- `packages/effect/src/unstable/ai/Prompt.ts` — No changes.
- `packages/effect/src/unstable/ai/Response.ts` — No changes.
- `packages/effect/src/unstable/ai/Chat.ts` — No changes. Implicitly benefits.

### Barrel Files

- `packages/effect/src/unstable/ai/index.ts` — Auto-generated via `pnpm codegen`.

## Implementation Plan (PR Sequence)

### PR 1: Foundation (Steps 1 + 2)
- Add `previousResponseId` and `incrementalPrompt` to `ProviderOptions`
- Create `ResponseIdTracker` module
- Add `computeIncrementalPrompt` utility in `LanguageModel`
- Run `pnpm codegen` for barrel files
- Unit tests for `ResponseIdTracker` and `computeIncrementalPrompt`
- **Risk:** Low. Purely additive.

### PR 2: Core Integration (Steps 3 + 4)
- Thread tracker through `LanguageModel.make` for all three methods
- Compute `incrementalPrompt` and pass in `ProviderOptions`
- Write response ID to tracker after provider returns
- Mark sent parts in the `WeakSet` after provider returns
- Wire tracker creation into `OpenAiLanguageModel.make` and `OpenAiCompatLanguageModel.make`
- Integration tests verifying tracker lifecycle, prompt filtering, and context divergence detection
- **Risk:** Medium. Modifies core orchestration.

### Future: Provider Consumption (separate spec)
- Wire `incrementalPrompt` and `previousResponseId` into OpenAI provider's `prepareMessages` and `makeRequest`
- Add `previous_response_not_found` error detection and retry logic
- Port to OpenAI compat provider

### Future: WebSocket Transport (separate spec)
- PRs 1-2 provide the full foundation. A WebSocket transport PR would:
  - Add a `WebSocketTransport` service as an alternative to HTTP `createResponse`/`createResponseStream`
  - Wrap request body in `{ type: "response.create", ...body }`
  - Parse server events (same event model as HTTP streaming)
  - Normalize WebSocket error events to `AiError`
  - Manage connection lifecycle (60-min limit, reconnection)
- **No changes to filtering, tracking, or ProviderOptions needed.**

## Test Plan

### `computeIncrementalPrompt` Unit Tests

All tests below assume a tracker whose `WeakSet` has been populated by prior `markParts` calls as noted.

- `[sys, user1]`, no parts marked → `None` (no assistant, first turn)
- `[sys, user1, asst1, user2]`, `{sys, user1}` marked → `Incremental([user2])`
- `[sys, user1, asst1(tool-calls), tool(results)]`, `{sys, user1}` marked → `Incremental([tool(results)])`
- `[..., asst(calls), tool(results), user2]`, prior parts marked → `Incremental([tool(results), user2])`
- `[sys, user1, asst1]`, `{sys, user1}` marked → `None` (no new messages)
- `[sys, user1, asst1, user2, asst2]`, `{sys, user1, asst1, user2}` marked → `None` (multi-turn, no new messages after last assistant)
- Empty messages → `None`

**Context divergence (system prompt / message edits):**

- `[sys_new, user1, asst1, user2]`, `{sys, user1}` marked (sys ≠ sys_new) → `Diverged`
- `[sys, user1_edited, asst1, user2]`, `{sys, user1}` marked (user1 ≠ user1_edited) → `Diverged`
- `[sys_new, user1_edited, asst1, user2]`, `{sys, user1}` marked → `Diverged` (first miss short-circuits)

**After divergence recovery:**

- `[sys_new, user1, asst1, user2]`, `{sys_new, user1}` marked (after full re-send) → `Incremental([user2])`

### ResponseIdTracker Unit Tests
- `make` starts with `None`
- `set("resp_123")` → `get` returns `Some("resp_123")`
- `set("resp_123")` → `clear` → `get` returns `None`
- `set("resp_1")` → `set("resp_2")` → `get` returns `Some("resp_2")`
- `set("resp_123")` → `onSessionDrop` → `get` returns `None` (session drop clears tracker)
- `set("resp_123")` → `onSessionDrop` → `set("resp_456")` → `get` returns `Some("resp_456")` (tracker resumes after reconnect)
- Concurrent `set`/`clear` from two fibers does not corrupt state (verifies `Ref` safety)

### LanguageModel Integration Tests
- `generateText`: extracts response ID, stores in tracker, passes `incrementalPrompt` on next call
- `generateObject`: extracts response ID via shared `generateContent` path, stores in tracker, passes `incrementalPrompt` on next call
- `streamText`: stores response ID when `response-metadata` part is emitted
- First call: `incrementalPrompt` is `undefined`, `previousResponseId` is `undefined`
- Second call: `incrementalPrompt` contains only new messages, `previousResponseId` is set
- Tool approval adds messages → `incrementalPrompt` is recomputed after approval resolution

### Chat Implicit Integration
- `Chat.generateText` tracks response IDs across sequential turns (implicit via LanguageModel)

### Session Drop / Reconnect Tests
- After `onSessionDrop`, next `generateText` sends full prompt with no `previousResponseId`
- After `onSessionDrop`, next `streamText` sends full prompt with no `previousResponseId`
- `onSessionDrop` during idle (no in-flight request): next request uses full prompt
- `onSessionDrop` racing with in-flight request: request completes normally or fails (no stale ID used on next request either way)
- Full cycle: track ID → session drop → full prompt → new ID tracked → incremental prompt resumes

## Validation

- `pnpm lint-fix`
- `pnpm test <affected_test_files>`
- `pnpm check:tsgo` (run `pnpm clean` if check fails)
