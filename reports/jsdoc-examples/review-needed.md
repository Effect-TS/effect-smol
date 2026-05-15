# JSDoc Example Review Needed

Generated from `reports/jsdoc-examples/**/*.md` on 2026-05-15.

This document consolidates the review queues from the per-package and per-wave JSDoc example reports. Each block keeps the original report text and records the source report so follow-up cleanup can be split by package or module.

## Summary

- Source reports scanned: 50
- Source reports with review-needed entries: 44
- Review-needed entries: 248

## Entries

## reports/jsdoc-examples/cross-package-ai-codegen.md

### Review-needed Items

| File                                      | Original line | API/declaration                                                       | Generated title                  | Quality                 | Reason                                                                                                                                    | Snippet/summary                                                       |
| ----------------------------------------- | ------------: | --------------------------------------------------------------------- | -------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `packages/tools/ai-codegen/src/Config.ts` |            13 | Intended for `CodegenConfig`; currently detached from the declaration | Decoding a codegen configuration | Needs structural review | The JSDoc block is followed by another JSDoc block for `Replacement`, so the example may not attach to `CodegenConfig` in generated docs. | Decodes `Config.CodegenConfig` from an object and logs `config.spec`. |

## reports/jsdoc-examples/effect.md

### Review Needed

#### `packages/effect/src/Redacted.ts:58`

- API: `Redacted.Variance`
- Kind: `interface`
- Generated title: `Creating redacted values with different types`
- Confidence: `medium`
- Quality: `poor`
- Flags: `does not demonstrate the documented API`, `unclear type-level behavior`
- Reason: The example creates `Redacted` values with different element types, but it does not directly demonstrate covariance or the `Variance` interface.
- Current example:

```ts
import { Redacted } from "effect"

// Variance interface ensures type safety for covariant type parameter
const stringSecret = Redacted.make("secret")
const numberSecret = Redacted.make(42)

// TypeScript will infer the types with proper variance
```

#### `packages/effect/src/Redacted.ts:80`

- API: `Redacted.Value`
- Kind: `type alias`
- Generated title: `Extracting the redacted value type`
- Confidence: `medium`
- Quality: `poor`
- Flags: `does not demonstrate the documented API`, `runtime example for type-level API`
- Reason: The documented API is the `Redacted.Value<T>` type alias, but the example demonstrates the runtime `Redacted.value` function instead.
- Current example:

```ts
import { Redacted } from "effect"

// Extract the value type from a Redacted instance
const secret = Redacted.make("my-secret")
const extractedValue: string = Redacted.value(secret)
```

#### `packages/effect/src/RcRef.ts:69`

- API: `RcRef.RcRef.Variance`
- Kind: `interface`
- Generated title: `Referencing variance types`
- Confidence: `medium`
- Quality: `poor`
- Flags: `does not demonstrate the documented API`, `unclear type-level behavior`
- Reason: The example names the variance type but does not show assignability or another concrete covariance behavior for either type parameter.
- Current example:

```ts
import type { RcRef } from "effect"

// Variance interface defines covariance for type parameters
type StringRcRefVariance = RcRef.RcRef.Variance<string, Error>

// Shows that both A and E are covariant
declare const variance: StringRcRefVariance
```

## reports/jsdoc-examples/effect/batch-001.md

### Review Needed

#### `packages/effect/src/testing/TestConsole.ts:54`

- file: `packages/effect/src/testing/TestConsole.ts`
- line: 54
- API: `TestConsole`
- kind: namespace
- generated title: `Using test console utilities`
- confidence: medium
- quality: poor
- flags: `mostly comments`, `does not demonstrate the documented API`, `no visible result or assertion`
- reason: The snippet is only explanatory comments, so it does not provide executable or checkable usage for LLM training.
- current example snippet:

```ts
// The TestConsole namespace provides types for testing
// Use TestConsole.make to create a test console instance
// Use TestConsole.layer to provide the service in tests
```

#### `packages/effect/src/testing/TestConsole.ts:69`

- file: `packages/effect/src/testing/TestConsole.ts`
- line: 69
- API: `TestConsole.Method`
- kind: type
- generated title: `Listing console methods`
- confidence: medium
- quality: poor
- flags: `mostly comments`, `does not demonstrate the documented API`, `no visible result or assertion`
- reason: The snippet describes the type in comments instead of showing a type-level or value-level usage.
- current example snippet:

```ts
// Method represents console method names like:
// "log", "error", "warn", "debug", "info", etc.
// All methods from the Console interface are supported
```

#### `packages/effect/src/testing/TestConsole.ts:85`

- file: `packages/effect/src/testing/TestConsole.ts`
- line: 85
- API: `TestConsole.Entry`
- kind: type
- generated title: `Describing captured console entries`
- confidence: medium
- quality: poor
- flags: `mostly comments`, `does not demonstrate the documented API`, `no visible result or assertion`
- reason: The snippet is comment-only and does not construct or type-check an `Entry` value.
- current example snippet:

```ts
// Entry represents captured console calls with their method and parameters
// Each entry contains: { method: string, parameters: ReadonlyArray<unknown> }
// Used internally by TestConsole to track all console operations
```

#### `packages/effect/src/ErrorReporter.ts:297`

- file: `packages/effect/src/ErrorReporter.ts`
- line: 297
- API: `ErrorReporter.ignore`
- kind: type
- generated title: `Ignoring expected errors`
- confidence: high
- quality: needs review
- flags: `runtime example for type-level API`
- reason: The documented API is the type alias, but the example demonstrates the runtime `ErrorReporter.ignore` value.
- current example snippet:

```ts
import { Data, ErrorReporter } from "effect"

class NotFoundError extends Data.TaggedError("NotFoundError")<{}> {
  readonly [ErrorReporter.ignore] = true
}
```

#### `packages/effect/src/ErrorReporter.ts:348`

- file: `packages/effect/src/ErrorReporter.ts`
- line: 348
- API: `ErrorReporter.severity`
- kind: type
- generated title: `Overriding error severity`
- confidence: high
- quality: needs review
- flags: `runtime example for type-level API`
- reason: The documented API is the type alias, but the example demonstrates the runtime `ErrorReporter.severity` value.
- current example snippet:

```ts
import { Data, ErrorReporter } from "effect"

class DeprecationWarning extends Data.TaggedError("DeprecationWarning")<{}> {
  readonly [ErrorReporter.severity] = "Warn" as const
}
```

#### `packages/effect/src/ErrorReporter.ts:404`

- file: `packages/effect/src/ErrorReporter.ts`
- line: 404
- API: `ErrorReporter.attributes`
- kind: type
- generated title: `Attaching error attributes`
- confidence: high
- quality: needs review
- flags: `runtime example for type-level API`
- reason: The documented API is the type alias, but the example demonstrates the runtime `ErrorReporter.attributes` value.
- current example snippet:

```ts
import { Data, ErrorReporter } from "effect"

class PaymentError extends Data.TaggedError("PaymentError")<{
  readonly orderId: string
}> {
  readonly [ErrorReporter.attributes] = {
    orderId: this.orderId
  }
}
```

#### `packages/effect/src/unstable/ai/Chat.ts:553`

- file: `packages/effect/src/unstable/ai/Chat.ts`
- line: 553
- API: `Chat.fromExport`
- kind: value
- generated title: `Restoring chat data`
- confidence: medium
- quality: needs review
- flags: `placeholder declarations`, `unclear setup`, `no visible result or assertion`
- reason: The snippet depends on a placeholder persistence function and does not expose the restored response, so it is less useful as a standalone training example.
- current example snippet:

```ts
import { Effect } from "effect"
import { Chat } from "effect/unstable/ai"

declare const loadFromDatabase: (sessionId: string) => Effect.Effect<unknown>

const restoreChat = Effect.gen(function*() {
  // Assume we have previously exported data
  const savedData = yield* loadFromDatabase("chat-session-123")

  const restoredChat = yield* Chat.fromExport(savedData)

  // Continue the conversation from where it left off
  const response = yield* restoredChat.generateText({
    prompt: "Let's continue our discussion"
  })
}).pipe(
  Effect.catchTag("SchemaError", (error) => {
    console.log("Failed to restore chat:", error.message)
    return Effect.void
  })
)
```

## reports/jsdoc-examples/effect/batch-002.md

### Review Needed

#### `packages/effect/src/testing/TestClock.ts:148`

- File: `packages/effect/src/testing/TestClock.ts`
- Line: 148
- API: `TestClock.State`
- Kind: `interface`
- Generated title: `Inspecting test clock state`
- Confidence: `medium`
- Quality: `poor`
- Flags: `does not demonstrate the documented API`, `mostly comments`, `unclear setup`
- Reason: The snippet reads the live TestClock instance but never uses the `TestClock.State` interface or annotates the state shape; the documented state structure is only described in comments.
- Current example:

```ts
import { Effect } from "effect"
import { TestClock } from "effect/testing"

const program = Effect.gen(function*() {
  const testClock = yield* TestClock.make()

  // The state represents the current timestamp and scheduled sleeps
  const timestamp = testClock.currentTimeMillisUnsafe()
  console.log(timestamp) // Current test time

  // Internal state structure: { timestamp: number, sleeps: Array<[number, Latch.Latch]> }
})
```

#### `packages/effect/src/Unify.ts:13`

- File: `packages/effect/src/Unify.ts`
- Line: 13
- API: `Unify.unifySymbol`
- Kind: `value`
- Generated title: `Declaring unification symbols`
- Confidence: `medium`
- Quality: `poor`
- Flags: `placeholder declarations`, `mostly comments`, `no visible result or assertion`
- Reason: The example declares a placeholder object with the symbol but does not show a concrete type-level result or observable behavior for the internal protocol.
- Current example:

```ts
import type { Unify } from "effect"

// The unifySymbol is used internally in Effect types
// to enable automatic type unification
declare const effect: {
  readonly [Unify.unifySymbol]?: any
}
```

#### `packages/effect/src/Unify.ts:36`

- File: `packages/effect/src/Unify.ts`
- Line: 36
- API: `Unify.unifySymbol`
- Kind: `type alias`
- Generated title: `Referencing the unification symbol type`
- Confidence: `medium`
- Quality: `poor`
- Flags: `placeholder declarations`, `no visible result or assertion`
- Reason: The example creates an illustrative object type but does not show how the `unifySymbol` type alias changes assignability or inference.
- Current example:

```ts
import type { Unify } from "effect"

// The unifySymbol type is used in type declarations
// to enable unification behavior
type UnifyableType = {
  [Unify.unifySymbol]?: any
}
```

#### `packages/effect/src/Unify.ts:58`

- File: `packages/effect/src/Unify.ts`
- Line: 58
- API: `Unify.typeSymbol`
- Kind: `value`
- Generated title: `Declaring type metadata symbols`
- Confidence: `medium`
- Quality: `poor`
- Flags: `placeholder declarations`, `mostly comments`, `no visible result or assertion`
- Reason: The example declares a placeholder object with the metadata symbol but leaves the type-level effect of the symbol implicit.
- Current example:

```ts
import type { Unify } from "effect"

// The typeSymbol is used internally in Effect types
// to store type information for unification
declare const effect: {
  readonly [Unify.typeSymbol]?: any
}
```

#### `packages/effect/src/Unify.ts:81`

- File: `packages/effect/src/Unify.ts`
- Line: 81
- API: `Unify.typeSymbol`
- Kind: `type alias`
- Generated title: `Referencing the type metadata symbol type`
- Confidence: `medium`
- Quality: `poor`
- Flags: `placeholder declarations`, `no visible result or assertion`
- Reason: The example demonstrates a shape using the symbol but not the documented type alias as an extracted or checked type.
- Current example:

```ts
import type { Unify } from "effect"

// The typeSymbol type is used in type declarations
// to store type information for unification
type TypedValue = {
  [Unify.typeSymbol]?: string
}
```

#### `packages/effect/src/Unify.ts:104`

- File: `packages/effect/src/Unify.ts`
- Line: 104
- API: `Unify.ignoreSymbol`
- Kind: `value`
- Generated title: `Declaring ignored unification fields`
- Confidence: `medium`
- Quality: `poor`
- Flags: `placeholder declarations`, `mostly comments`, `no visible result or assertion`
- Reason: The example marks a placeholder object with the ignore symbol but does not show any field actually being excluded during unification.
- Current example:

```ts
import type { Unify } from "effect"

// The ignoreSymbol is used internally in Effect types
// to mark types that should be ignored during unification
declare const effect: {
  readonly [Unify.ignoreSymbol]?: any
}
```

#### `packages/effect/src/Unify.ts:127`

- File: `packages/effect/src/Unify.ts`
- Line: 127
- API: `Unify.ignoreSymbol`
- Kind: `type alias`
- Generated title: `Referencing the ignored field symbol type`
- Confidence: `medium`
- Quality: `poor`
- Flags: `placeholder declarations`, `no visible result or assertion`
- Reason: The example defines an illustrative type shape but does not demonstrate the alias in a way that makes ignored keys visible.
- Current example:

```ts
import type { Unify } from "effect"

// The ignoreSymbol type is used in type declarations
// to mark types that should be ignored during unification
type IgnorableType = {
  [Unify.ignoreSymbol]?: unknown
}
```

#### `packages/effect/src/HKT.ts:46`

- File: `packages/effect/src/HKT.ts`
- Line: 46
- API: `HKT.URI`
- Kind: `value`
- Generated title: `Defining type classes`
- Confidence: `medium`
- Quality: `poor`
- Flags: `does not demonstrate the documented API`, `mostly comments`
- Reason: The snippet extends `HKT.TypeClass` but never references `HKT.URI` directly, so the documented symbol is only explained in comments.
- Current example:

```ts
import type { HKT } from "effect"

interface MyTypeClass<F extends HKT.TypeLambda> extends HKT.TypeClass<F> {
  // TypeClass methods here
}

// The URI symbol helps TypeScript understand the relationship
// between the type class and its type lambda
```

#### `packages/effect/src/Runtime.ts:87`

- File: `packages/effect/src/Runtime.ts`
- Line: 87
- API: `Runtime.defaultTeardown`
- Kind: `function`
- Generated title: `Using default teardown`
- Confidence: `high`
- Quality: `poor`
- Flags: `incorrect expected result`, `no visible result or assertion`
- Reason: The example comment says interruption exits with code 0, but the current implementation returns 130 for interrupt-only failures.
- Current example:

```ts
import { Effect, Exit, Runtime } from "effect"

// The default teardown behavior
const program1 = Effect.succeed(42)
const program2 = Effect.fail("error")
const program3 = Effect.interrupt

// Using defaultTeardown directly
const logExitCode = (exit: Exit.Exit<any, any>) => {
  Runtime.defaultTeardown(exit, (code) => {
    console.log(`Exit code: ${code}`)
  })
}

// Success case - exit code 0
logExitCode(Exit.succeed(42))

// Failure case - exit code 1
logExitCode(Exit.fail("error"))

// Interruption case - exit code 0
logExitCode(Exit.interrupt(123))
```

## reports/jsdoc-examples/effect/batch-003.md

### Review Needed

#### 1. SpanStatus uses wall-clock time directly

- file: `packages/effect/src/Tracer.ts`
- line: 43
- API: `SpanStatus`
- kind: type
- generated title: Creating span statuses
- confidence: high
- quality: needs review
- flags: `unclear setup`
- reason: The snippet demonstrates the type, but it uses `Date.now()` for timestamps. Local repository guidance prefers the `Clock` module and `TestClock` for time-sensitive examples.
- current example snippet:

````md
- **Example** (Creating span statuses)
-
- ```ts
  ```
- import type { Tracer } from "effect"
- import { Exit } from "effect"
-
- // Started span status
- const startedStatus: Tracer.SpanStatus = {
- _tag: "Started",
- startTime: BigInt(Date.now() * 1000000)
- }
-
- // Ended span status
- const endedStatus: Tracer.SpanStatus = {
- _tag: "Ended",
- startTime: BigInt(Date.now() * 1000000),
- endTime: BigInt(Date.now() * 1000000 + 1000000),
- exit: Exit.succeed("result")
- }
- ```
  ```
````

#### 2. Span example does not show a span value

- file: `packages/effect/src/Tracer.ts`
- line: 239
- API: `Span`
- kind: type
- generated title: Working with spans
- confidence: high
- quality: poor
- flags: `does not demonstrate the documented API`, `mostly comments`, `no visible result or assertion`
- reason: The snippet uses `Effect.withSpan` but never accesses or demonstrates the documented `Span` interface members.
- current example snippet:

````md
- **Example** (Working with spans)
-
- ```ts
  ```
- import { Effect } from "effect"
-
- // Working with spans using withSpan
- const program = Effect.succeed("Hello World").pipe(
- Effect.withSpan("my-operation")
- )
-
- // The span interface defines the properties available
- // when working with tracing in your effects
- ```
  ```
````

#### 3. around uses wall-clock time directly

- file: `packages/effect/src/RequestResolver.ts`
- line: 583
- API: `around`
- kind: value
- generated title: Running effects around request resolution
- confidence: high
- quality: needs review
- flags: `unclear setup`
- reason: The example demonstrates the API, but measures elapsed time with `Date.now()` instead of using Effect time APIs.
- current example snippet:

````md
- **Example** (Running effects around request resolution)
-
- ```ts
  ```
- import { Effect, Exit, Request, RequestResolver } from "effect"
-
- interface GetDataRequest extends Request.Request<string> {
- readonly _tag: "GetDataRequest"
- }
- const GetDataRequest = Request.tagged<GetDataRequest>("GetDataRequest")
-
- const resolver = RequestResolver.make<GetDataRequest>((entries) =>
- Effect.sync(() => {
- for (const entry of entries) {
- entry.completeUnsafe(Exit.succeed("data"))
- }
- })
- )
-
- // Add setup and cleanup around request execution
- const resolverWithAround = RequestResolver.around(
- resolver,
- (entries) =>
- Effect.gen(function*() {
- yield* Effect.log(`Starting batch of ${entries.length} requests`)
- return Date.now()
- }),
- (entries, startTime) =>
- Effect.gen(function*() {
- const duration = Date.now() - startTime
- yield* Effect.log(`Batch completed in ${duration}ms`)
- })
- )
- ```
  ```
````

#### 4. CurrentLogSpans uses wall-clock time directly

- file: `packages/effect/src/References.ts`
- line: 201
- API: `CurrentLogSpans`
- kind: value
- generated title: Tracking log spans
- confidence: high
- quality: needs review
- flags: `unclear setup`
- reason: The snippet demonstrates manual log-span references, but it uses `Date.now()` for span start times instead of Effect time APIs.
- current example snippet:

````md
- **Example** (Tracking log spans)
-
- ```ts
  ```
- import { Console, Effect, References } from "effect"
-
- const logSpanExample = Effect.gen(function*() {
- // Get current spans (empty by default)
- const current = yield* References.CurrentLogSpans
- console.log(current.length) // 0
-
- // Add a log span manually
- const startTime = Date.now()
- yield* Effect.provideService(
- Effect.gen(function*() {
- // Simulate some work
- yield* Effect.sleep("100 millis")
- yield* Console.log("Database operation in progress")
-
- const spans = yield* References.CurrentLogSpans
- console.log("Active spans:", spans.map(([label]) => label)) // ["database-connection"]
- }),
- References.CurrentLogSpans,
- [["database-connection", startTime]]
- )
-
- // Add another span
- yield* Effect.provideService(
- Effect.gen(function*() {
- const spans = yield* References.CurrentLogSpans
- console.log("Active spans:", spans.map(([label]) => label)) // ["database-connection", "data-processing"]
-
- yield* Console.log("Multiple operations in progress")
- }),
- References.CurrentLogSpans,
- [
- ["database-connection", startTime],
- ["data-processing", Date.now()]
- ]
- )
-
- // Clear spans when operations complete
- yield* Effect.provideService(
- Effect.gen(function*() {
- const spans = yield* References.CurrentLogSpans
- console.log("Active spans:", spans.length) // 0
- }),
- References.CurrentLogSpans,
- []
- )
- })
- ```
  ```
````

#### 5. Toolkit module example uses wall-clock time directly

- file: `packages/effect/src/unstable/ai/Toolkit.ts`
- line: 6
- API: `module`
- kind: module
- generated title: Creating and implementing toolkits
- confidence: high
- quality: needs review
- flags: `no visible result or assertion`
- reason: The example is useful, but the implementation uses `Date.now()` and does not show a visible result from the toolkit layer.
- current example snippet:

````md
- **Example** (Creating and implementing toolkits)
-
- ```ts
  ```
- import { Effect, Schema } from "effect"
- import { Tool, Toolkit } from "effect/unstable/ai"
-
- // Create individual tools
- const GetCurrentTime = Tool.make("GetCurrentTime", {
- description: "Get the current timestamp",
- success: Schema.Number
- })
-
- const GetWeather = Tool.make("GetWeather", {
- description: "Get weather for a location",
- parameters: Schema.Struct({ location: Schema.String }),
- success: Schema.Struct({
- temperature: Schema.Number,
- condition: Schema.String
- })
- })
-
- // Create a toolkit with multiple tools
- const MyToolkit = Toolkit.make(GetCurrentTime, GetWeather)
-
- const MyToolkitLayer = MyToolkit.toLayer({
- GetCurrentTime: () => Effect.succeed(Date.now()),
- GetWeather: ({ location }) =>
- Effect.succeed({
- temperature: 72,
- condition: "sunny"
- })
- })
- ```
  ```
````

#### 6. Toolkit interface example uses wall-clock time directly

- file: `packages/effect/src/unstable/ai/Toolkit.ts`
- line: 63
- API: `Toolkit`
- kind: type
- generated title: Defining AI toolkits
- confidence: high
- quality: needs review
- flags: `no visible result or assertion`
- reason: The example demonstrates the toolkit shape, but the implementation uses `Date.now()` and does not show a visible result.
- current example snippet:

````md
- **Example** (Defining AI toolkits)
-
- ```ts
  ```
- import { Effect, Schema } from "effect"
- import { Tool, Toolkit } from "effect/unstable/ai"
-
- // Create individual tools
- const GetCurrentTime = Tool.make("GetCurrentTime", {
- description: "Get the current timestamp",
- success: Schema.Number
- })
-
- const GetWeather = Tool.make("GetWeather", {
- description: "Get weather for a location",
- parameters: Schema.Struct({ location: Schema.String }),
- success: Schema.Struct({
- temperature: Schema.Number,
- condition: "sunny"
- })
- })
-
- // Create a toolkit with multiple tools
- const MyToolkit = Toolkit.make(GetCurrentTime, GetWeather)
-
- const MyToolkitLayer = MyToolkit.toLayer({
- GetCurrentTime: () => Effect.succeed(Date.now()),
- GetWeather: ({ location }) =>
- Effect.succeed({
- temperature: 72,
- condition: "sunny"
- })
- })
- ```
  ```
````

#### 7. nonEmpty symbol example relies on placeholder declarations

- file: `packages/effect/src/NonEmptyIterable.ts`
- line: 139
- API: `nonEmpty`
- kind: value
- generated title: Branding non-empty iterables
- confidence: medium
- quality: poor
- flags: `placeholder declarations`, `mostly comments`
- reason: The snippet explains branding but relies on `declare const data` and mostly comments rather than a concrete construction path.
- current example snippet:

````md
- **Example** (Branding non-empty iterables)
-
- ```ts
  ```
- import type * as NonEmptyIterable from "effect/NonEmptyIterable"
-
- // The symbol is used internally for type branding
- declare const data: NonEmptyIterable.NonEmptyIterable<number>
-
- // This has the nonEmpty symbol property (not accessible at runtime)
- // but is still a regular Iterable for all practical purposes
- for (const item of data) {
- console.log(item) // Works normally
- }
-
- // Can be used with any function expecting an Iterable
- const array = Array.from(data)
- const set = new Set(data)
- ```
  ```
````

## reports/jsdoc-examples/effect/batch-004.md

### Review Needed

#### `packages/effect/src/Hash.ts:67`

- File: `packages/effect/src/Hash.ts`
- Line: 67
- API: `Hash.hash`
- Kind: `function`
- Generated title: `Hashing different values`
- Confidence: `high`
- Quality: `needs review`
- Flags: `uses Date constructor`
- Reason: The snippet demonstrates `Hash.hash`, but it includes `new Date(...)`, which conflicts with repository guidance to avoid direct Date construction in examples.
- Current example snippet:

```ts
import { Hash } from "effect"

// Hash primitive values
console.log(Hash.hash(42)) // numeric hash
console.log(Hash.hash("hello")) // string hash
console.log(Hash.hash(true)) // boolean hash

// Hash objects and arrays
console.log(Hash.hash({ name: "John", age: 30 }))
console.log(Hash.hash([1, 2, 3]))
console.log(Hash.hash(new Date("2023-01-01")))
```

#### `packages/effect/src/unstable/ai/IdGenerator.ts:88`

- File: `packages/effect/src/unstable/ai/IdGenerator.ts`
- Line: 88
- API: `IdGenerator.Service`
- Kind: `interface`
- Generated title: `Implementing a custom ID generator`
- Confidence: `high`
- Quality: `needs review`
- Flags: `uses Date.now`
- Reason: The example shows a valid service shape, but it teaches `Date.now()` for ID generation in a repository that prefers time access through Effect services.
- Current example snippet:

```ts
import { Effect } from "effect"
import type { IdGenerator } from "effect/unstable/ai"

// Custom implementation
const customService: IdGenerator.Service = {
  generateId: () => Effect.succeed(`custom_${Date.now()}`)
}

const program = Effect.gen(function*() {
  const id = yield* customService.generateId()
  console.log(id) // "custom_1234567890"
  return id
})
```

#### `packages/effect/src/RcMap.ts:68`

- File: `packages/effect/src/RcMap.ts`
- Line: 68
- API: `RcMap.State`
- Kind: `type alias`
- Generated title: `Narrowing map state`
- Confidence: `high`
- Quality: `poor`
- Flags: `placeholder declarations`, `unclear setup`
- Reason: The snippet demonstrates narrowing, but all values are `declare const` placeholders and there is no concrete `RcMap` state value.
- Current example snippet:

```ts
import type { RcMap } from "effect"

// State is a union type that can be either:
declare const openState: RcMap.State.Open<string, number, never>
declare const closedState: RcMap.State.Closed

// Check the state type
declare const state: RcMap.State<string, number, never>
if (state._tag === "Open") {
  // Access the internal map when open
  console.log("Map is open, contains entries")
} else {
  // State is closed
  console.log("Map is closed")
}
```

#### `packages/effect/src/RcMap.ts:95`

- File: `packages/effect/src/RcMap.ts`
- Line: 95
- API: `RcMap.State`
- Kind: `namespace`
- Generated title: `Referencing state types`
- Confidence: `high`
- Quality: `poor`
- Flags: `placeholder declarations`, `mostly comments`, `no visible result or assertion`
- Reason: The example is mostly descriptive comments plus placeholder type declarations, so it does not give a concrete usage pattern beyond listing namespace members.
- Current example snippet:

```ts
import type { RcMap } from "effect"

// The State namespace contains types for RcMap internal state:
// - Open: Contains the active resource map
// - Closed: Indicates the map is shut down
// - Entry: Individual resource entries with metadata

declare const openState: RcMap.State.Open<string, number, never>
declare const closedState: RcMap.State.Closed
declare const entry: RcMap.State.Entry<number, never>
```

#### `packages/effect/src/RcMap.ts:117`

- File: `packages/effect/src/RcMap.ts`
- Line: 117
- API: `RcMap.State.Open`
- Kind: `interface`
- Generated title: `Inspecting open state`
- Confidence: `high`
- Quality: `poor`
- Flags: `placeholder declarations`, `unclear setup`
- Reason: The example reads from `openState`, but that state is only a placeholder declaration and not derived from a realistic `RcMap` workflow.
- Current example snippet:

```ts
import type { RcMap } from "effect"
import * as MutableHashMap from "effect/MutableHashMap"

// State.Open contains the active resource map
declare const openState: RcMap.State.Open<string, number, never>

// Access the internal map when state is open
if (openState._tag === "Open") {
  // The map contains Entry objects indexed by keys
  const hasKey = MutableHashMap.has(openState.map, "someKey")
  console.log(`Map contains key: ${hasKey}`)
}
```

#### `packages/effect/src/RcMap.ts:145`

- File: `packages/effect/src/RcMap.ts`
- Line: 145
- API: `RcMap.State.Closed`
- Kind: `interface`
- Generated title: `Checking closed state`
- Confidence: `high`
- Quality: `poor`
- Flags: `placeholder declarations`, `unclear setup`
- Reason: The example checks the closed-state tag, but the value is a placeholder declaration and the comment carries the behavioral explanation.
- Current example snippet:

```ts
import type { RcMap } from "effect"

// State.Closed indicates the RcMap is shut down
declare const closedState: RcMap.State.Closed

// Check for closed state
if (closedState._tag === "Closed") {
  console.log("RcMap is closed, no operations allowed")
  // Any attempt to get resources will result in interruption
}
```

#### `packages/effect/src/RcMap.ts:170`

- File: `packages/effect/src/RcMap.ts`
- Line: 170
- API: `RcMap.State.Entry`
- Kind: `interface`
- Generated title: `Inspecting entry metadata`
- Confidence: `high`
- Quality: `poor`
- Flags: `placeholder declarations`, `mostly comments`, `unclear setup`
- Reason: The snippet logs fields from a placeholder entry and explains most of the API in comments instead of deriving an entry through executable setup.
- Current example snippet:

```ts
import type { RcMap } from "effect"

// Entry contains all metadata for a resource in the map
declare const entry: RcMap.State.Entry<string, never>

// Entry properties:
// - deferred: Promise-like structure for the resource value
// - scope: Manages the resource's lifecycle
// - finalizer: Effect to run when cleaning up
// - fiber: Optional background fiber for expiration
// - expiresAt: Timestamp when resource expires
// - refCount: Number of active references

console.log(`Reference count: ${entry.refCount}`)
console.log(`Expires at: ${entry.expiresAt}`)
```

## reports/jsdoc-examples/effect/wave-002-channel.md

### Review Needed

#### `packages/effect/src/Channel.ts:811`

- File: `packages/effect/src/Channel.ts`
- Original line: 811
- API/declaration: `Channel.sync`
- Generated title: `Computing values lazily`
- Quality: `needs review`
- Reason: The example uses `Math.random()` in documentation for lazy evaluation. It is valid illustrative code, but it is less suitable for LLM training because the repository guidance prefers controlled Effect APIs for nondeterministic behavior.
- Current example summary:

```ts
const channel = Channel.sync(() => Math.random())
// Emits a random number computed when the channel runs
```

#### `packages/effect/src/Channel.ts:909`

- File: `packages/effect/src/Channel.ts`
- Original line: 909
- API/declaration: `Channel.failSync`
- Generated title: `Failing with a lazy error`
- Quality: `needs review`
- Reason: The example demonstrates lazy error construction with `Math.random()` and `Date.now()`. It should eventually be rewritten to avoid nondeterministic time/random APIs in docs.
- Current example summary:

```ts
const conditionalError = Channel.failSync(() => Math.random() > 0.5 ? "Error A" : "Error B")

const expensiveError = Channel.failSync(() => {
  const timestamp = Date.now()
  return new Error(`Failed at: ${timestamp}`)
})
```

#### `packages/effect/src/Channel.ts:965`

- File: `packages/effect/src/Channel.ts`
- Original line: 965
- API/declaration: `Channel.failCauseSync`
- Generated title: `Failing with lazy causes`
- Quality: `needs review`
- Reason: The example uses both `Math.random()` and `Date.now()` while illustrating lazy cause construction. It is structurally valid, but should be replaced with deterministic values or Effect clock APIs later.
- Current example summary:

```ts
const failedChannel = Channel.failCauseSync(() => {
  const errorType = Math.random() > 0.5 ? "A" : "B"
  return Cause.fail(`Runtime error ${errorType}`)
})

const dieCauseChannel = Channel.failCauseSync(() => {
  const timestamp = Date.now()
  return Cause.die(`Error at ${timestamp}`)
})
```

#### `packages/effect/src/Channel.ts:1295`

- File: `packages/effect/src/Channel.ts`
- Original line: 1295
- API/declaration: `Channel.fromSubscriptionArray`
- Generated title: `Aggregating subscription metrics`
- Quality: `needs review`
- Reason: The metrics aggregation example stamps output with `Date.now()`. A later cleanup should use a deterministic timestamp source or an Effect clock-oriented example.
- Current example summary:

```ts
const aggregatedChannel = Channel.map(metricsChannel, (metrics) => {
  // calculates count, sum, average, min, max
  return {
    count: values.length,
    timestamp: Date.now()
  }
})
```

#### `packages/effect/src/Channel.ts:1375`

- File: `packages/effect/src/Channel.ts`
- Original line: 1375
- API/declaration: `Channel.fromPubSub`
- Generated title: `Streaming PubSub notifications`
- Quality: `needs review`
- Reason: The example adds timestamps and generated ids with `new Date()` and `Math.random()`. This is realistic but conflicts with repository guidance for examples that should train deterministic Effect-style code.
- Current example summary:

```ts
const timestampedChannel = Channel.map(notificationChannel, (message) => ({
  message,
  timestamp: new Date().toISOString(),
  id: Math.random().toString(36).substr(2, 9)
}))
```

#### `packages/effect/src/Channel.ts:1400`

- File: `packages/effect/src/Channel.ts`
- Original line: 1400
- API/declaration: `Channel.fromPubSub`
- Generated title: `Processing PubSub events`
- Quality: `needs review`
- Reason: The event processing example uses `Date.now()` when marking events as processed. It should be revisited for deterministic time handling.
- Current example summary:

```ts
const processedChannel = Channel.map(eventChannel, (event) => {
  if (event.type === "user.created") {
    return {
      ...event,
      processed: true,
      processedAt: Date.now()
    }
  }
  return event
})
```

#### `packages/effect/src/Channel.ts:1479`

- File: `packages/effect/src/Channel.ts`
- Original line: 1479
- API/declaration: `Channel.fromPubSubArray`
- Generated title: `Processing PubSub orders in batches`
- Quality: `needs review`
- Reason: The batch order example records `processedAt: Date.now()`. It should eventually use deterministic test data or an Effect clock example.
- Current example summary:

```ts
const processedChannel = Channel.map(orderChannel, (orderBatch) => ({
  batchSize: orderBatch.length,
  totalRevenue,
  uniqueCustomers: customerCount,
  processedAt: Date.now(),
  orders: orderBatch
}))
```

#### `packages/effect/src/Channel.ts:1521`

- File: `packages/effect/src/Channel.ts`
- Original line: 1521
- API/declaration: `Channel.fromPubSubArray`
- Generated title: `Processing PubSub logs in batches`
- Quality: `needs review`
- Reason: The log aggregation example generates a batch id with `Math.random()`. It is acceptable as a preserved legacy example, but should be made deterministic later.
- Current example summary:

```ts
const analysisChannel = Channel.map(logChannel, (logBatch) => ({
  batchId: Math.random().toString(36).substr(2, 9),
  totalEntries: logBatch.length,
  sources: [...new Set(logBatch.map((log) => log.source))]
}))
```

#### `packages/effect/src/Channel.ts:6227`

- File: `packages/effect/src/Channel.ts`
- Original line: 6227
- API/declaration: `Channel.embedInput`
- Generated title: `Embedding custom input handling`
- Quality: `needs review`
- Reason: The example is explicitly simplified and passes `Effect.void` as the input handler, so it shows the call shape but not meaningful input handling behavior.
- Current example summary:

```ts
const embeddedChannel = Channel.embedInput(
  baseChannel,
  (_upstream) => Effect.void
)
```

## reports/jsdoc-examples/effect/wave-002-chunk.md

### Review Needed

#### `packages/effect/src/Chunk.ts:56`

- File: `packages/effect/src/Chunk.ts`
- Original line: 56
- API / declaration: `Chunk` module overview
- Generated title: `Processing chunks with Effect`
- Quality: `needs review`
- Reason: The snippet defines a function that returns `Effect.gen`; local guidance prefers `Effect.fnUntraced` for reusable functions returning effects.
- Snippet / summary:

```ts
const processChunk = (chunk: Chunk.Chunk<number>) =>
  Effect.gen(function*() {
    const mapped = Chunk.map(chunk, (n) => n * 2)
    const filtered = Chunk.filter(mapped, (n) => n > 5)
    return Chunk.toReadonlyArray(filtered)
  })
```

#### `packages/effect/src/Chunk.ts:360`

- File: `packages/effect/src/Chunk.ts`
- Original line: 360
- API / declaration: `Chunk.make`
- Generated title: `Creating a non-empty chunk`
- Quality: `needs review`
- Reason: The example logs the `Chunk` inspection representation instead of using a public conversion helper like `Chunk.toArray`.
- Snippet / summary: `console.log(chunk) // { _id: 'Chunk', values: [ 1, 2, 3, 4 ] }`

#### `packages/effect/src/Chunk.ts:378`

- File: `packages/effect/src/Chunk.ts`
- Original line: 378
- API / declaration: `Chunk.of`
- Generated title: `Creating a single-element chunk`
- Quality: `needs review`
- Reason: The example logs the `Chunk` inspection representation instead of using a public conversion helper like `Chunk.toArray`.
- Snippet / summary: `console.log(chunk) // { _id: 'Chunk', values: [ "hello" ] }`

#### `packages/effect/src/Chunk.ts:395`

- File: `packages/effect/src/Chunk.ts`
- Original line: 395
- API / declaration: `Chunk.fromIterable`
- Generated title: `Creating chunks from iterables`
- Quality: `needs review`
- Reason: The example logs the `Chunk` inspection representation instead of using a public conversion helper like `Chunk.toArray`.
- Snippet / summary: `console.log(chunk) // { _id: 'Chunk', values: [ 1, 2, 3 ] }`

#### `packages/effect/src/Chunk.ts:538`

- File: `packages/effect/src/Chunk.ts`
- Original line: 538
- API / declaration: `Chunk.reverse`
- Generated title: `Reversing chunks`
- Quality: `needs review`
- Reason: The example logs the `Chunk` inspection representation instead of using a public conversion helper like `Chunk.toArray`.
- Snippet / summary: `console.log(result) // { _id: 'Chunk', values: [ 3, 2, 1 ] }`

#### `packages/effect/src/Chunk.ts:632`

- File: `packages/effect/src/Chunk.ts`
- Original line: 632
- API / declaration: `Chunk.getUnsafe`
- Generated title: `Accessing elements unsafely`
- Quality: `needs review`
- Reason: The example demonstrates throwing behavior with `try` / `catch`, which conflicts with repository guidance to avoid `try` / `catch` in examples.
- Snippet / summary:

```ts
try {
  Chunk.getUnsafe(chunk, 10)
} catch (error) {
  console.log((error as Error).message)
}
```

#### `packages/effect/src/Chunk.ts:737`

- File: `packages/effect/src/Chunk.ts`
- Original line: 737
- API / declaration: `Chunk.take`
- Generated title: `Taking elements from the start`
- Quality: `needs review`
- Reason: The example logs the `Chunk` inspection representation instead of using a public conversion helper like `Chunk.toArray`.
- Snippet / summary: `console.log(result) // { _id: 'Chunk', values: [ 1, 2, 3 ] }`

#### `packages/effect/src/Chunk.ts:794`

- File: `packages/effect/src/Chunk.ts`
- Original line: 794
- API / declaration: `Chunk.drop`
- Generated title: `Dropping elements from the start`
- Quality: `needs review`
- Reason: The example logs the `Chunk` inspection representation instead of using a public conversion helper like `Chunk.toArray`.
- Snippet / summary: `console.log(result) // { _id: 'Chunk', values: [ 3, 4, 5 ] }`

#### `packages/effect/src/Chunk.ts:850`

- File: `packages/effect/src/Chunk.ts`
- Original line: 850
- API / declaration: `Chunk.dropRight`
- Generated title: `Dropping elements from the end`
- Quality: `needs review`
- Reason: The example logs the `Chunk` inspection representation instead of using a public conversion helper like `Chunk.toArray`.
- Snippet / summary: `console.log(result) // { _id: 'Chunk', values: [ 1, 2, 3 ] }`

#### `packages/effect/src/Chunk.ts:871`

- File: `packages/effect/src/Chunk.ts`
- Original line: 871
- API / declaration: `Chunk.dropWhile`
- Generated title: `Dropping elements while a predicate matches`
- Quality: `needs review`
- Reason: The example logs the `Chunk` inspection representation instead of using a public conversion helper like `Chunk.toArray`.
- Snippet / summary: `console.log(result) // { _id: 'Chunk', values: [ 3, 4, 5 ] }`

#### `packages/effect/src/Chunk.ts:1116`

- File: `packages/effect/src/Chunk.ts`
- Original line: 1116
- API / declaration: `Chunk.compact`
- Generated title: `Compacting optional values`
- Quality: `needs review`
- Reason: The example logs the `Chunk` inspection representation instead of using a public conversion helper like `Chunk.toArray`.
- Snippet / summary: `console.log(result) // { _id: 'Chunk', values: [ 1, 3 ] }`

#### `packages/effect/src/Chunk.ts:1387`

- File: `packages/effect/src/Chunk.ts`
- Original line: 1387
- API / declaration: `Chunk.headUnsafe`
- Generated title: `Getting the first element unsafely`
- Quality: `needs review`
- Reason: The example demonstrates throwing behavior with `try` / `catch`, which conflicts with repository guidance to avoid `try` / `catch` in examples.
- Snippet / summary:

```ts
try {
  Chunk.headUnsafe(Chunk.empty())
} catch (error) {
  console.log((error as Error).message)
}
```

#### `packages/effect/src/Chunk.ts:1453`

- File: `packages/effect/src/Chunk.ts`
- Original line: 1453
- API / declaration: `Chunk.lastUnsafe`
- Generated title: `Getting the last element unsafely`
- Quality: `needs review`
- Reason: The example demonstrates throwing behavior with `try` / `catch`, which conflicts with repository guidance to avoid `try` / `catch` in examples.
- Snippet / summary:

```ts
try {
  Chunk.lastUnsafe(Chunk.empty())
} catch (error) {
  console.log((error as Error).message)
}
```

#### `packages/effect/src/Chunk.ts:1652`

- File: `packages/effect/src/Chunk.ts`
- Original line: 1652
- API / declaration: `Chunk.map`
- Generated title: `Mapping values`
- Quality: `needs review`
- Reason: The example logs the `Chunk` inspection representation instead of using a public conversion helper like `Chunk.toArray`.
- Snippet / summary: `console.log(result) // { _id: 'Chunk', values: [ 2, 3 ] }`

#### `packages/effect/src/Chunk.ts:2404`

- File: `packages/effect/src/Chunk.ts`
- Original line: 2404
- API / declaration: `Chunk.makeBy`
- Generated title: `Generating chunks from indices`
- Quality: `needs review`
- Reason: The example logs the `Chunk` inspection representation instead of using a public conversion helper like `Chunk.toArray`.
- Snippet / summary: `console.log(chunk) // { _id: 'Chunk', values: [ 0, 2, 4, 6, 8 ] }`

#### `packages/effect/src/Chunk.ts:2424`

- File: `packages/effect/src/Chunk.ts`
- Original line: 2424
- API / declaration: `Chunk.range`
- Generated title: `Creating a range`
- Quality: `needs review`
- Reason: The example logs the `Chunk` inspection representation instead of using a public conversion helper like `Chunk.toArray`.
- Snippet / summary: `console.log(chunk) // { _id: 'Chunk', values: [ 1, 2, 3, 4, 5 ] }`

## reports/jsdoc-examples/effect/wave-002-datetime.md

### Review Needed

#### `packages/effect/src/DateTime.ts:419`

- File: `packages/effect/src/DateTime.ts`
- Original line: 419
- API/declaration: `fromDateUnsafe`
- Generated title: `Creating DateTime values from Dates`
- Quality: `needs review`
- Reason: The example demonstrates the correct API shape, but it constructs a `Date` directly. Repository guidance prefers avoiding direct `new Date` usage in examples.
- Current example summary:

```ts
const date = new Date("2024-01-01T12:00:00Z")
const dateTime = DateTime.fromDateUnsafe(date)
```

#### `packages/effect/src/DateTime.ts:445`

- File: `packages/effect/src/DateTime.ts`
- Original line: 445
- API/declaration: `makeUnsafe`
- Generated title: `Creating DateTime values unsafely`
- Quality: `needs review`
- Reason: The snippet includes `new Date()` and has no visible result or assertion for the three constructor input forms.
- Current example summary:

```ts
DateTime.makeUnsafe(new Date())
DateTime.makeUnsafe({ year: 2024 })
DateTime.makeUnsafe("2024-01-01")
```

#### `packages/effect/src/DateTime.ts:477`

- File: `packages/effect/src/DateTime.ts`
- Original line: 477
- API/declaration: `makeZonedUnsafe`
- Generated title: `Creating zoned DateTime values unsafely`
- Quality: `needs review`
- Reason: The example uses `new Date()` and returns no visible result, making the zoned conversion hard to verify.
- Current example summary:

```ts
DateTime.makeZonedUnsafe(new Date(), { timeZone: "Europe/London" })
```

#### `packages/effect/src/DateTime.ts:508`

- File: `packages/effect/src/DateTime.ts`
- Original line: 508
- API/declaration: `makeZoned`
- Generated title: `Creating optional zoned DateTime values`
- Quality: `needs review`
- Reason: The example uses `new Date()` and does not inspect the returned `Option`, so it is weak as standalone training material.
- Current example summary:

```ts
DateTime.makeZoned(new Date(), { timeZone: "Europe/London" })
```

#### `packages/effect/src/DateTime.ts:537`

- File: `packages/effect/src/DateTime.ts`
- Original line: 537
- API/declaration: `make`
- Generated title: `Creating optional DateTime values`
- Quality: `needs review`
- Reason: The snippet includes `new Date()` and does not inspect any returned `Option`, so the safe constructor behavior is not visible.
- Current example summary:

```ts
DateTime.make(new Date())
DateTime.make({ year: 2024 })
DateTime.make("2024-01-01")
```

#### `packages/effect/src/DateTime.ts:600`

- File: `packages/effect/src/DateTime.ts`
- Original line: 600
- API/declaration: `nowAsDate`
- Generated title: `Getting the current Date`
- Quality: `poor`
- Reason: The documented API is `DateTime.nowAsDate`, but the example yields `DateTime.now`, so it demonstrates the preceding API instead.
- Current example summary:

```ts
Effect.gen(function*() {
  const now = yield* DateTime.now
})
```

#### `packages/effect/src/DateTime.ts:808`

- File: `packages/effect/src/DateTime.ts`
- Original line: 808
- API/declaration: `zoneMakeLocal`
- Generated title: `Creating local time zones`
- Quality: `needs review`
- Reason: The example depends on the host local time zone and current time, so output is environment-dependent.
- Current example summary:

```ts
const localZone = DateTime.zoneMakeLocal()
const now = DateTime.nowUnsafe()
const localTime = DateTime.setZone(now, localZone)
```

#### `packages/effect/src/DateTime.ts:1295`

- File: `packages/effect/src/DateTime.ts`
- Original line: 1295
- API/declaration: `toEpochMillis`
- Generated title: `Reading epoch milliseconds`
- Quality: `needs review`
- Reason: The example demonstrates `toEpochMillis`, but its verification uses `new Date(...)`, which conflicts with local guidance for examples.
- Current example summary:

```ts
const epochMillis = DateTime.toEpochMillis(dt)
console.log(new Date(epochMillis).toISOString())
```

#### `packages/effect/src/DateTime.ts:1584`

- File: `packages/effect/src/DateTime.ts`
- Original line: 1584
- API/declaration: `withCurrentZoneOffset`
- Generated title: `Providing a fixed-offset time zone`
- Quality: `poor`
- Reason: The snippet uses `withCurrentZoneOffset`, but its inline comment says it will use the system local time zone, which is misleading.
- Current example summary:

```ts
Effect.gen(function*() {
  // will use the system's local time zone
  const now = yield* DateTime.nowInCurrentZone
}).pipe(DateTime.withCurrentZoneOffset(3 * 60 * 60 * 1000))
```

#### `packages/effect/src/DateTime.ts:1794`

- File: `packages/effect/src/DateTime.ts`
- Original line: 1794
- API/declaration: `match`
- Generated title: `Pattern matching DateTime variants`
- Quality: `needs review`
- Reason: The example uses `DateTime.nowUnsafe()` and `new Date()`, making the values nondeterministic and less suitable for training examples.
- Current example summary:

```ts
const dt1 = DateTime.nowUnsafe()
const dt2 = DateTime.makeZonedUnsafe(new Date(), { timeZone: "Europe/London" })
```

#### `packages/effect/src/DateTime.ts:2061`

- File: `packages/effect/src/DateTime.ts`
- Original line: 2061
- API/declaration: `formatLocal`
- Generated title: `Formatting DateTime values locally`
- Quality: `needs review`
- Reason: The example intentionally depends on system locale and time zone, so it is valid but less deterministic than most examples.
- Current example summary:

```ts
const local = DateTime.formatLocal(dt, {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit"
})
```

## reports/jsdoc-examples/effect/wave-002-graph.md

### Review Needed

#### `packages/effect/src/Graph.ts:394`

- File: `packages/effect/src/Graph.ts`
- Original line: 394
- API/declaration: `Graph.mutate`
- Generated title: `Applying scoped mutations`
- Quality: `poor`
- Reason: The snippet calls `Graph.mutate`, but the mutation callback contains only comments and does not demonstrate an actual graph change or observable result.
- Current example snippet:

```ts
const graph = Graph.directed<string, number>()
const newGraph = Graph.mutate(graph, (mutable) => {
  // Safe mutations go here
  // mutable gets automatically converted back to immutable
})
```

#### `packages/effect/src/Graph.ts:775`

- File: `packages/effect/src/Graph.ts`
- Original line: 775
- API/declaration: `Graph.updateEdge`
- Generated title: `Updating edge data`
- Quality: `needs review`
- Reason: The example demonstrates the API, but the output comment for `Graph.getEdge` shows a direct `Graph.Edge` even though the function returns an `Option`.
- Current example snippet:

```ts
const edgeData = Graph.getEdge(result, 0)
console.log(edgeData) // new Graph.Edge({ source: 0, target: 1, data: 20 })
```

#### `packages/effect/src/Graph.ts:810`

- File: `packages/effect/src/Graph.ts`
- Original line: 810
- API/declaration: `Graph.mapNodes`
- Generated title: `Mapping node data`
- Quality: `needs review`
- Reason: The output comment references `Graph.Node`, which is not a public declaration in this module, and it also does not reflect that `Graph.getNode` returns an `Option`.
- Current example snippet:

```ts
const nodeData = Graph.getNode(graph, 0)
console.log(nodeData) // new Graph.Node("NODE A")
```

#### `packages/effect/src/Graph.ts:842`

- File: `packages/effect/src/Graph.ts`
- Original line: 842
- API/declaration: `Graph.mapEdges`
- Generated title: `Mapping edge data`
- Quality: `needs review`
- Reason: The example demonstrates mapping edge data, but the output comment omits the `Option` wrapper returned by `Graph.getEdge`.
- Current example snippet:

```ts
const edgeData = Graph.getEdge(graph, 0)
console.log(edgeData) // new Graph.Edge({ source: 0, target: 1, data: 20 })
```

#### `packages/effect/src/Graph.ts:879`

- File: `packages/effect/src/Graph.ts`
- Original line: 879
- API/declaration: `Graph.reverse`
- Generated title: `Reversing edge directions`
- Quality: `needs review`
- Reason: The example demonstrates reversing edges, but the output comment omits the `Option` wrapper returned by `Graph.getEdge`.
- Current example snippet:

```ts
const edge0 = Graph.getEdge(graph, 0)
console.log(edge0) // new Graph.Edge({ source: 1, target: 0, data: 1 }) - B -> A
```

#### `packages/effect/src/Graph.ts:1393`

- File: `packages/effect/src/Graph.ts`
- Original line: 1393
- API/declaration: `Graph.getEdge`
- Generated title: `Getting edge data`
- Quality: `needs review`
- Reason: The snippet is otherwise useful, but the output comments format `NodeIndex` like a constructor even though `NodeIndex` is a number type alias.
- Current example snippet:

```ts
console.log(edgeData.value.source) // NodeIndex(0)
console.log(edgeData.value.target) // NodeIndex(1)
```

#### `packages/effect/src/Graph.ts:1520`

- File: `packages/effect/src/Graph.ts`
- Original line: 1520
- API/declaration: `Graph.neighbors`
- Generated title: `Getting outgoing neighbors`
- Quality: `needs review`
- Reason: The output comment formats node indices as `NodeIndex(...)`, which may teach a non-existent runtime wrapper for plain numeric node indices.
- Current example snippet:

```ts
const neighborsA = Graph.neighbors(graph, nodeA)
console.log(neighborsA) // [NodeIndex(1), NodeIndex(2)]
```

#### `packages/effect/src/Graph.ts:3839`

- File: `packages/effect/src/Graph.ts`
- Original line: 3839
- API/declaration: `Graph.topo`
- Generated title: `Sorting topologically`
- Quality: `needs review`
- Reason: The example uses `try` / `catch`, which conflicts with the repository guidance for examples and should be rewritten in a follow-up without changing this conversion pass.
- Current example snippet:

```ts
try {
  Graph.topo(cyclicGraph) // Throws: "Cannot perform topological sort on cyclic graph"
} catch (error) {
  console.log((error as Error).message)
}
```

## reports/jsdoc-examples/effect/wave-002-match.md

### Review Needed

#### `packages/effect/src/Match.ts:168`

- File: `packages/effect/src/Match.ts`
- Original line: 168
- API / declaration: `Case`
- Generated title: `Referencing match case types`
- Quality: `poor`
- Reason: The snippet is mostly explanatory comments and a type alias. It describes the internal `Case = When | Not` relationship but does not show a concrete matcher or checkable result.
- Current example snippet:

```ts
import type { Match } from "effect"

// Case is a union type representing pattern matching cases
// It combines When (positive) and Not (negative) matching logic

// When you write this:
// Match.when(pattern, handler)  // Creates a When case
// Match.not(pattern, handler)   // Creates a Not case

// The Match module internally uses Case = When | Not
type MyCaseType = Match.Case // When | Not
```

#### `packages/effect/src/Match.ts:1467`

- File: `packages/effect/src/Match.ts`
- Original line: 1467
- API / declaration: `date`
- Generated title: `Matching Date instances`
- Quality: `needs review`
- Reason: The example demonstrates the predicate, but it teaches direct `new Date(...)` construction, which conflicts with repository guidance to prefer `Clock` / `TestClock` for time-sensitive code.
- Current example summary: Matches `Match.date`, then constructs dates with `new Date("2024-01-01")`, `new Date("invalid")`, and `new Date(num).toISOString()`.

#### `packages/effect/src/Match.ts:1504`

- File: `packages/effect/src/Match.ts`
- Original line: 1504
- API / declaration: `record`
- Generated title: `Matching record objects`
- Quality: `needs review`
- Reason: The example is otherwise useful, but it includes `new Date()` as a test input. That conflicts with repository guidance and makes the snippet less suitable as an LLM-training example.
- Current example summary: Matches records, arrays, dates, and other values; one logged case calls `analyzeValue(new Date())`.

#### `packages/effect/src/Match.ts:1543`

- File: `packages/effect/src/Match.ts`
- Original line: 1543
- API / declaration: `instanceOf`
- Generated title: `Matching class instances`
- Quality: `poor`
- Reason: The snippet uses `new Date()` and then documents a fixed ISO timestamp output, making the visible result nondeterministic or inaccurate. It also conflicts with repository guidance around direct Date construction.
- Current example summary: Demonstrates `Match.instanceOf(CustomError)`, `Match.instanceOf(Error)`, `Match.instanceOf(Date)`, and `Match.instanceOf(Array)`, then logs `handleValue(new Date())` with a fixed timestamp comment.

#### `packages/effect/src/Match.ts:1862`

- File: `packages/effect/src/Match.ts`
- Original line: 1862
- API / declaration: `Types`
- Generated title: `Referencing Match utility types`
- Quality: `needs review`
- Reason: The example states that most users will not need `Types` and demonstrates internal type utilities without assertions or visible outputs. It may be better as internal reference documentation than a public training example.
- Current example summary: Defines `Match.Types.PatternBase` and `Match.Types.WhenMatch` aliases, then shows a matcher to explain how those types power inference.

#### `packages/effect/src/Match.ts:2087`

- File: `packages/effect/src/Match.ts`
- Original line: 2087
- API / declaration: `Types.PatternPrimitive`
- Generated title: `Matching primitive patterns`
- Quality: `needs review`
- Reason: The example documents a type-level API but mostly lists standalone `Match.when` calls. It does not directly declare or check a `PatternPrimitive` value/type, so the relationship to the documented declaration is indirect.
- Current example summary: Lists literal values, predicates, and custom refinements with standalone `Match.when(...)` calls.

## reports/jsdoc-examples/effect/wave-002-stream.md

### Review Needed

#### `packages/effect/src/Stream.ts:111`

- file: `packages/effect/src/Stream.ts`
- original line: 111
- API/declaration: `StreamUnify`
- generated title: `Unifying stream types`
- quality: `needs review`
- reason: The snippet documents an internal type-level unification hook with placeholder `declare const` values and does not directly demonstrate the declared interface.
- current example summary: Imports `Effect` and `Stream`, declares a `Stream.Stream<number>` and an `Effect.Effect<string>`, then calls `Effect.zip(stream.pipe(Stream.runCollect), effect)`.

#### `packages/effect/src/Stream.ts:133`

- file: `packages/effect/src/Stream.ts`
- original line: 133
- API/declaration: `StreamUnifyIgnore`
- generated title: `Ignoring stream unification`
- quality: `poor`
- reason: The snippet is mostly explanatory comments for an internal marker and does not show an actionable usage pattern.
- current example summary: Imports `Stream` types, comments that users typically do not interact with this directly, and aliases `Stream.StreamUnifyIgnore`.

#### `packages/effect/src/Stream.ts:1396`

- file: `packages/effect/src/Stream.ts`
- original line: 1396
- API/declaration: `fromAsyncIterable`
- generated title: `Creating a stream from an AsyncIterable`
- quality: `needs review`
- reason: The snippet uses an `async function*`, which should be reviewed against the repository guideline to avoid async/await-style examples.
- current example summary: Defines an async generator yielding `1`, `2`, and `3`, converts it with `Stream.fromAsyncIterable`, and collects the stream.

#### `packages/effect/src/Stream.ts:1519`

- file: `packages/effect/src/Stream.ts`
- original line: 1519
- API/declaration: `fromEventListener`
- generated title: `Creating a stream from an event listener`
- quality: `needs review`
- reason: The snippet uses a declared event target and shows an output that is not produced by any visible event source.
- current example summary: Declares `target: Stream.EventListener<number>`, listens for `"data"`, takes three events, and shows `[ 1, 2, 3 ]`.

#### `packages/effect/src/Stream.ts:5673`

- file: `packages/effect/src/Stream.ts`
- original line: 5673
- API/declaration: `ignore`
- generated title: `Configuring ignore logging`
- quality: `needs review`
- reason: The second `ignore` example only constructs a stream value and does not run it or show any visible result.
- current example summary: Creates `Stream.fail("boom")` and pipes it through `Stream.ignore({ log: "Error" })`.

#### `packages/effect/src/Stream.ts:5710`

- file: `packages/effect/src/Stream.ts`
- original line: 5710
- API/declaration: `ignoreCause`
- generated title: `Ignoring stream failure causes`
- quality: `needs review`
- reason: The snippet assigns `program = Stream.runCollect(stream)` but never runs or observes the program, and it imports `Effect` without using it.
- current example summary: Builds a stream that fails with `"boom"`, applies `Stream.ignoreCause({ log: "Error" })`, then assigns the collected effect to `program`.

#### `packages/effect/src/Stream.ts:8415`

- file: `packages/effect/src/Stream.ts`
- original line: 8415
- API/declaration: `pipeThroughChannelOrFail`
- generated title: `Piping through a channel with failures`
- quality: `needs review`
- reason: The snippet depends on a placeholder `declare const transformChannel`, so the shown output cannot be produced by the example as written.
- current example summary: Declares a channel from number chunks to string chunks, pipes `Stream.make(1, 2, 3)` through it, and shows `["1", "2", "3"]`.

#### `packages/effect/src/Stream.ts:10526`

- file: `packages/effect/src/Stream.ts`
- original line: 10526
- API/declaration: `toAsyncIterableWith`
- generated title: `Converting to an AsyncIterable with services`
- quality: `needs review`
- reason: The snippet defines an `async` collector with `for await`, does not use the collector, and does not show a visible result.
- current example summary: Converts `Stream.make(1, 2, 3)` with `Context.empty()` and defines `collect = async () => { ... }`.

#### `packages/effect/src/Stream.ts:10594`

- file: `packages/effect/src/Stream.ts`
- original line: 10594
- API/declaration: `toAsyncIterableEffect`
- generated title: `Creating an AsyncIterable effect`
- quality: `needs review`
- reason: The snippet uses `Effect.promise(async () => { for await ... })`, which should be reviewed against the repository guideline to avoid async/await-style examples.
- current example summary: Gets an async iterable from `Stream.toAsyncIterableEffect`, iterates over it inside `Effect.promise`, logs the collected values, and runs the program.

#### `packages/effect/src/Stream.ts:10628`

- file: `packages/effect/src/Stream.ts`
- original line: 10628
- API/declaration: `toAsyncIterable`
- generated title: `Converting to an async iterable`
- quality: `needs review`
- reason: The snippet uses `Effect.promise(async () => { for await ... })` and returns the program result without running or displaying it.
- current example summary: Converts a stream to an async iterable, collects values with `for await`, and returns the collected array from an `Effect.gen` program.

## reports/jsdoc-examples/effect/wave-003-bigdecimal.md

### Review Needed

#### `BigDecimal`

- File: `packages/effect/src/BigDecimal.ts`
- Original line: 36
- API/declaration: `BigDecimal`
- Generated title: `Inspecting BigDecimal storage`
- Quality: `needs review`
- Reason: The example uses `fromNumberUnsafe(123.45)` in the model example even though the module documentation cautions against direct floating-point conversion. It also shows expected fields only as comments instead of assertions.
- Snippet/summary: `const d = BigDecimal.fromNumberUnsafe(123.45)` followed by `d.value // 12345n` and `d.scale // 2`.

#### `divide`

- File: `packages/effect/src/BigDecimal.ts`
- Original line: 479
- API/declaration: `divide`
- Generated title: `Dividing decimals safely`
- Quality: `needs review`
- Reason: The surrounding prose says non-multiple division is rounded down to the nearest integer, but the example returns `Option.some(BigDecimal.fromStringUnsafe("1.5"))` for `6 / 4`.
- Snippet/summary: Safe division examples include `6 / 3`, `6 / 4`, and division by zero with `Option.none()`.

#### `divideUnsafe`

- File: `packages/effect/src/BigDecimal.ts`
- Original line: 538
- API/declaration: `divideUnsafe`
- Generated title: `Dividing decimals unsafely`
- Quality: `needs review`
- Reason: The surrounding prose repeats the rounded-down integer division wording, but the example returns `fromStringUnsafe("1.5")` for `6 / 4`.
- Snippet/summary: Unsafe division examples include `divideUnsafe("6", "3")` and `divideUnsafe("6", "4")`.

#### `Equivalence`

- File: `packages/effect/src/BigDecimal.ts`
- Original line: 995
- API/declaration: `Equivalence`
- Generated title: `Checking decimal equivalence`
- Quality: `poor`
- Reason: `fromNumberUnsafe(1.50)` and `fromNumberUnsafe(1.5)` receive the same JavaScript number before conversion, so the example does not really demonstrate scale-insensitive decimal equivalence.
- Snippet/summary: `const a = BigDecimal.fromNumberUnsafe(1.50)` and `const b = BigDecimal.fromNumberUnsafe(1.5)` are compared with `BigDecimal.Equivalence(a, b)`.

#### `equals`

- File: `packages/effect/src/BigDecimal.ts`
- Original line: 1025
- API/declaration: `equals`
- Generated title: `Checking decimal equality`
- Quality: `poor`
- Reason: Like the `Equivalence` example, `fromNumberUnsafe(1.5)` and `fromNumberUnsafe(1.50)` are identical JavaScript numbers before conversion, so the example does not show equality across different decimal scales.
- Snippet/summary: `const a = BigDecimal.fromNumberUnsafe(1.5)` and `const b = BigDecimal.fromNumberUnsafe(1.50)` are compared with `BigDecimal.equals(a, b)`.

#### `truncate`

- File: `packages/effect/src/BigDecimal.ts`
- Original line: 1487
- API/declaration: `truncate`
- Generated title: `Truncating decimals`
- Quality: `needs review`
- Reason: The surrounding prose says truncation is the same as rounding away from zero, but the example and implementation show truncation toward zero for `-14.5 -> -14`.
- Snippet/summary: `truncate(fromStringUnsafe("145"), -1)` returns `"140"` and `truncate(fromStringUnsafe("-14.5"))` returns `"-14"`.

## reports/jsdoc-examples/effect/wave-003-duration.md

### Review Needed

#### `packages/effect/src/Duration.ts:804` - `toNanosUnsafe`

- Generated title: `Reading nanoseconds unsafely`
- Quality: `poor`
- Reason: The example demonstrates `try`/`catch` for thrown error handling, which conflicts with the repository guidance to avoid `try`/`catch` in training examples. The body was preserved to keep the conversion scoped to JSDoc structure.
- Snippet:

```ts
// This will throw an error
try {
  Duration.toNanosUnsafe(Duration.infinity)
} catch (error) {
  console.log((error as Error).message) // "Cannot convert infinite duration to nanos"
}
```

## reports/jsdoc-examples/effect/wave-003-iterable.md

### Review Needed

#### `packages/effect/src/Iterable.ts:457`

- File: `packages/effect/src/Iterable.ts`
- Original line: 457
- API/declaration: `headUnsafe`
- Generated title: `Getting the first element unsafely`
- Quality: `needs review`
- Reason: The example demonstrates the throwing branch with `try` / `catch`, which conflicts with the repository guidance to avoid `try` / `catch` in examples. It should be rewritten in a follow-up while preserving the unsafe failure behavior.
- Current example summary: Calls `Iterable.headUnsafe` on non-empty iterables, then wraps an empty iterable call in `try` / `catch` and logs the thrown error message.

## reports/jsdoc-examples/effect/wave-003-metric.md

### Review Needed

#### `packages/effect/src/Metric.ts:2500`

- File: `packages/effect/src/Metric.ts`
- Original line: 2500
- API/declaration: `summary`
- Generated title: `Creating summary metrics`
- Quality: `needs review`
- Reason: The example uses `Math.random()` and time delays to generate observations, making the documented summary statistics nondeterministic and weak as standalone training material.
- Current example snippet:

```ts
for (let i = 0; i < 20; i++) {
  const responseTime = 50 + Math.random() * 200 // 50-250ms
  yield * Metric.update(responseTimeSummary, responseTime)
  yield * Effect.sleep(Duration.millis(100))
}
```

#### `packages/effect/src/Metric.ts:2624`

- File: `packages/effect/src/Metric.ts`
- Original line: 2624
- API/declaration: `timer`
- Generated title: `Recording durations with a timer`
- Quality: `poor`
- Reason: The example measures elapsed time with `Date.now()`, which conflicts with repository guidance to use Effect clock APIs for time-dependent code.
- Current example snippet:

```ts
const start = Date.now()
yield * Effect.sleep(Duration.millis(100))
const duration = Duration.millis(Date.now() - start)
yield * Metric.update(apiRequestTimer, duration)
```

#### `packages/effect/src/Metric.ts:3160`

- File: `packages/effect/src/Metric.ts`
- Original line: 3160
- API/declaration: `snapshotUnsafe`
- Generated title: `Capturing snapshots from a context`
- Quality: `needs review`
- Reason: The exporter payload uses `Date.now()`, which conflicts with repository guidance for time-dependent examples and should be rewritten with clock-based APIs if kept.
- Current example snippet:

```ts
const exportData = snapshots.map((snapshot) => ({
  name: snapshot.id,
  type: snapshot.type,
  value: snapshot.state,
  timestamp: Date.now()
}))
```

#### `packages/effect/src/Metric.ts:3356`

- File: `packages/effect/src/Metric.ts`
- Original line: 3356
- API/declaration: `linearBoundaries`
- Generated title: `Creating linear boundaries`
- Quality: `needs review`
- Reason: The expected output comment for `Metric.linearBoundaries({ start: 0, width: 100, count: 5 })` should be checked against the current implementation before using it as training material.
- Current example snippet:

```ts
const responseBoundaries = Metric.linearBoundaries({
  start: 0,
  width: 100,
  count: 5
})
console.log(responseBoundaries) // [100, 200, 300, 400, Infinity]
```

#### `packages/effect/src/Metric.ts:3898`

- File: `packages/effect/src/Metric.ts`
- Original line: 3898
- API/declaration: `disableRuntimeMetrics`
- Generated title: `Disabling runtime metrics for an effect`
- Quality: `needs review`
- Reason: The performance-oriented snippet uses `Math.random()`, making behavior nondeterministic and less suitable as a crisp example for LLM training.
- Current example snippet:

```ts
const hotPath = Array.from(
  { length: 1000 },
  (_, i) =>
    Effect.gen(function*() {
      const result = i * i + Math.random()
      return result
    })
)
```

## reports/jsdoc-examples/effect/wave-003-schedule.md

### Review Needed

#### `packages/effect/src/Schedule.ts:56`

- File: `packages/effect/src/Schedule.ts`
- Original line: 56
- API/declaration: `Schedule`
- Generated title: `Defining retry and repeat schedules`
- Quality: `needs review`
- Reason: The example uses `Math.random()` to model transient failure. It is valid illustrative code, but later cleanup should prefer deterministic Effect-style examples for LLM training.
- Current example summary: Defines retry and repeat schedules, then retries an `Effect.suspend(() => Math.random() > 0.5 ? ...)` program and repeats a heartbeat.

#### `packages/effect/src/Schedule.ts:130`

- File: `packages/effect/src/Schedule.ts`
- Original line: 130
- API/declaration: `Metadata`
- Generated title: `Logging schedule output metadata`
- Quality: `poor`
- Reason: The snippet claims to log metadata including attempts and elapsed time, but it only taps the schedule output and does not demonstrate reading `Metadata`.
- Current example summary: Builds `loggingSchedule` with `Schedule.unfold`, `Schedule.addDelay`, and `Schedule.tapOutput((output) => Console.log(...))`, followed by comments showing attempt and elapsed fields that the code does not log.

#### `packages/effect/src/Schedule.ts:253`

- File: `packages/effect/src/Schedule.ts`
- Original line: 253
- API/declaration: `Schedule.VarianceStruct`
- Generated title: `Inspecting schedule variance annotations`
- Quality: `needs review`
- Reason: The snippet documents an internal variance structure through explanatory comments and unused example types rather than an actionable usage pattern.
- Current example summary: Imports `Effect` and `Schedule`, defines `Animal` and `Dog`, and comments on covariant output and contravariant input relationships.

#### `packages/effect/src/Schedule.ts:325`

- File: `packages/effect/src/Schedule.ts`
- Original line: 325
- API/declaration: `fromStep`
- Generated title: `Choosing simpler schedule constructors`
- Quality: `poor`
- Reason: The example does not use `Schedule.fromStep`; it only says the API is advanced and shows simpler constructors.
- Current example summary: Creates `Schedule.exponential`, `Schedule.spaced`, and `Schedule.recurs`, then combines `simpleSchedule` with `Schedule.both`.

#### `packages/effect/src/Schedule.ts:374`

- File: `packages/effect/src/Schedule.ts`
- Original line: 374
- API/declaration: `fromStepWithMetadata`
- Generated title: `Creating metadata-aware schedules`
- Quality: `poor`
- Reason: The example does not use `Schedule.fromStepWithMetadata`; it points users to `collectWhile` and `tapOutput` instead.
- Current example summary: Builds `metadataSchedule` from `Schedule.spaced(...).pipe(Schedule.collectWhile(...))` and `conditionalSchedule` from `Schedule.exponential(...).pipe(Schedule.tapOutput(...))`.

#### `packages/effect/src/Schedule.ts:410`

- File: `packages/effect/src/Schedule.ts`
- Original line: 410
- API/declaration: `toStep`
- Generated title: `Extracting a schedule step function`
- Quality: `needs review`
- Reason: The example uses `Date.now()` directly. A later cleanup should use `Clock` or `TestClock` patterns where appropriate.
- Current example summary: Extracts `stepFn` with `Schedule.toStep(schedule)`, then calls `stepFn(Date.now(), "input")`.

#### `packages/effect/src/Schedule.ts:524`

- File: `packages/effect/src/Schedule.ts`
- Original line: 524
- API/declaration: `addDelay`
- Generated title: `Adding jitter to retry delays`
- Quality: `needs review`
- Reason: The long example relies on `Math.random()` and `new Date()` in several snippets. It should be rewritten later with deterministic values or Effect random/clock APIs.
- Current example summary: Demonstrates jitter, adaptive delay, dynamic delay, result-based delay, and progressive retry schedules.

#### `packages/effect/src/Schedule.ts:818`

- File: `packages/effect/src/Schedule.ts`
- Original line: 818
- API/declaration: `both`
- Generated title: `Combining time and attempt limits`
- Quality: `needs review`
- Reason: The example logs timestamps with `new Date()`, which conflicts with the repository guidance for time-dependent examples.
- Current example summary: Combines `Schedule.spaced(...).pipe(Schedule.take(5))` with `Schedule.recurs(3)` and logs task execution time.

#### `packages/effect/src/Schedule.ts:1138`

- File: `packages/effect/src/Schedule.ts`
- Original line: 1138
- API/declaration: `collectWhile`
- Generated title: `Collecting outputs while a condition holds`
- Quality: `needs review`
- Reason: The example uses `Math.random()`, `Date.now()`, and `new Date()` while demonstrating collection predicates. It should be revisited for deterministic sample data and clock usage.
- Current example summary: Shows time-limited collection, conditional collection, effectful predicates, and sample averaging.

#### `packages/effect/src/Schedule.ts:1267`

- File: `packages/effect/src/Schedule.ts`
- Original line: 1267
- API/declaration: `cron`
- Generated title: `Scheduling work with cron expressions`
- Quality: `needs review`
- Reason: The cron example includes multiple `new Date()`, `Date.now()`, and `Math.random()` usages in generated reports, invoice counts, health checks, and simulated failures.
- Current example summary: Demonstrates minute, daily, weekly, business-hours, monthly, and error-handled cron schedules.

#### `packages/effect/src/Schedule.ts:1404`

- File: `packages/effect/src/Schedule.ts`
- Original line: 1404
- API/declaration: `delays`
- Generated title: `Extracting schedule delays`
- Quality: `needs review`
- Reason: The adaptive delay example returns `Date.now()` from a repeated effect. Later cleanup should use clock-aware or deterministic values.
- Current example summary: Extracts delays from exponential, fibonacci, spaced, and unfold-based schedules.

#### `packages/effect/src/Schedule.ts:1518`

- File: `packages/effect/src/Schedule.ts`
- Original line: 1518
- API/declaration: `during`
- Generated title: `Repeating work during a duration`
- Quality: `needs review`
- Reason: The example uses `Date.now()`, `new Date()`, and `Math.random()` to model elapsed time, burst output, and retry failures.
- Current example summary: Runs a task during a five-second window, combines duration with count limits, and demonstrates burst and retry windows.

#### `packages/effect/src/Schedule.ts:1612`

- File: `packages/effect/src/Schedule.ts`
- Original line: 1612
- API/declaration: `either`
- Generated title: `Combining schedules with either semantics`
- Quality: `needs review`
- Reason: The example logs timestamps with `new Date()` and ends with a comment comparing `either` to `intersect`, which does not match the nearby `both` API name used elsewhere in this module.
- Current example summary: Combines time-based and count-based schedules, then combines aggressive and fallback retry schedules.

#### `packages/effect/src/Schedule.ts:1978`

- File: `packages/effect/src/Schedule.ts`
- Original line: 1978
- API/declaration: `fibonacci`
- Generated title: `Retrying with fibonacci backoff`
- Quality: `needs review`
- Reason: The heartbeat snippet logs `new Date().toISOString()`. A later pass should use a deterministic clock-oriented example.
- Current example summary: Demonstrates fibonacci retry delays, a heartbeat with fibonacci intervals, and a comparison with exponential delays.

#### `packages/effect/src/Schedule.ts:2066`

- File: `packages/effect/src/Schedule.ts`
- Original line: 2066
- API/declaration: `fixed`
- Generated title: `Repeating on fixed intervals`
- Quality: `needs review`
- Reason: The health check snippet logs `new Date().toISOString()`. It should be updated to avoid direct wall-clock access.
- Current example summary: Compares fixed and spaced schedules for a long-running task.

#### `packages/effect/src/Schedule.ts:2144`

- File: `packages/effect/src/Schedule.ts`
- Original line: 2144
- API/declaration: `map`
- Generated title: `Mapping schedule outputs`
- Quality: `needs review`
- Reason: The structured mapping example constructs timestamps with `new Date()`. Later cleanup should use stable data or an Effect clock.
- Current example summary: Maps schedule outputs to strings, readable delay messages, structured iteration data, and effectful transformations.

#### `packages/effect/src/Schedule.ts:2352`

- File: `packages/effect/src/Schedule.ts`
- Original line: 2352
- API/declaration: `recurs`
- Generated title: `Limiting recurrences`
- Quality: `needs review`
- Reason: One repeat example returns `Math.random()`. It should be replaced with deterministic output for LLM-training quality.
- Current example summary: Shows retry limits, composing `recurs` with exponential backoff, repeating ten times, and tapping recurrence counts.

#### `packages/effect/src/Schedule.ts:2412`

- File: `packages/effect/src/Schedule.ts`
- Original line: 2412
- API/declaration: `reduce`
- Generated title: `Reducing schedule outputs`
- Quality: `needs review`
- Reason: The history example records timestamps with `Date.now()`. It should eventually use clock-aware Effect APIs or deterministic values.
- Current example summary: Sums counts, builds execution history, accumulates metrics, and updates configuration state.

#### `packages/effect/src/Schedule.ts:2562`

- File: `packages/effect/src/Schedule.ts`
- Original line: 2562
- API/declaration: `spaced`
- Generated title: `Repeating with fixed spacing`
- Quality: `needs review`
- Reason: The heartbeat snippet logs `new Date().toISOString()`. A later cleanup should avoid direct wall-clock access.
- Current example summary: Demonstrates a recurring heartbeat, limited spacing, and combining spacing with recurrence limits.

#### `packages/effect/src/Schedule.ts:2617`

- File: `packages/effect/src/Schedule.ts`
- Original line: 2617
- API/declaration: `tapInput`
- Generated title: `Tapping retry inputs`
- Quality: `needs review`
- Reason: The example includes `new Date()`, `Math.random()`, and `Date.now()` while demonstrating input monitoring and validation.
- Current example summary: Logs retry errors, monitors input frequency, validates inputs, conditionally alerts, and chains multiple input taps.

#### `packages/effect/src/Schedule.ts:2760`

- File: `packages/effect/src/Schedule.ts`
- Original line: 2760
- API/declaration: `tapOutput`
- Generated title: `Tapping schedule outputs`
- Quality: `needs review`
- Reason: The health check snippet uses `Math.random()` and several logging examples use decorative symbols. The example is structurally valid but should be cleaned up for deterministic, plain training data.
- Current example summary: Logs retry delay outputs, records metrics, alerts on high delays, performs health checks, and chains output taps.

#### `packages/effect/src/Schedule.ts:2864`

- File: `packages/effect/src/Schedule.ts`
- Original line: 2864
- API/declaration: `take`
- Generated title: `Taking a limited number of recurrences`
- Quality: `needs review`
- Reason: The heartbeat and sampling snippets use `new Date()` and `Math.random()`. Later cleanup should use deterministic samples or Effect services.
- Current example summary: Limits a heartbeat, limits retry attempts, and samples exactly ten values.

#### `packages/effect/src/Schedule.ts:2956`

- File: `packages/effect/src/Schedule.ts`
- Original line: 2956
- API/declaration: `unfold`
- Generated title: `Unfolding schedule state`
- Quality: `needs review`
- Reason: The jittered schedule uses `Math.random()`. It should be rewritten with deterministic state transitions or Effect random APIs.
- Current example summary: Creates counter, fibonacci, exponential-state, random-jitter, and state-machine schedules.

#### `packages/effect/src/Schedule.ts:3124`

- File: `packages/effect/src/Schedule.ts`
- Original line: 3124
- API/declaration: `windowed`
- Generated title: `Repeating on aligned windows`
- Quality: `needs review`
- Reason: The example logs `new Date().toISOString()`. A later cleanup should avoid direct wall-clock access in docs.
- Current example summary: Repeats a task on `Schedule.windowed("5 seconds")` and logs each window execution time.

#### `packages/effect/src/Schedule.ts:3306`

- File: `packages/effect/src/Schedule.ts`
- Original line: 3306
- API/declaration: `satisfiesServicesType`
- Generated title: `Constraining schedule service types`
- Quality: `needs review`
- Reason: The type-level service example defines a `Database.query` method returning `Promise<unknown>`. It should be reviewed to align service examples with Effect-style APIs.
- Current example summary: Defines `Logger` and `Database` interfaces, then constrains schedules with `Schedule.satisfiesServicesType<Logger>()` and `Schedule.satisfiesServicesType<Logger | Database>()`.

## reports/jsdoc-examples/effect/wave-003-string.md

### Review Needed

#### `packages/effect/src/String.ts:634`

- File: `packages/effect/src/String.ts`
- Original line: 634
- API / declaration: `match`
- Generated title: `Matching regular expressions`
- Quality: `needs review`
- Reason: The snippet demonstrates the API, but the visible `Option.some(["ll"])` output is a simplified `RegExpMatchArray`; actual match arrays also carry metadata such as `index`, `input`, and `groups`.
- Snippet / summary:

```ts
pipe("hello", String.match(/l+/)) // Option.some(["ll"])
pipe("hello", String.match(/x/)) // Option.none()
```

#### `packages/effect/src/String.ts:652`

- File: `packages/effect/src/String.ts`
- Original line: 652
- API / declaration: `matchAll`
- Generated title: `Iterating regular expression matches`
- Quality: `needs review`
- Reason: The snippet demonstrates the API, but the logged output is simplified. `Array.from(matches)` contains `RegExpMatchArray` values with match metadata, not plain one-element arrays.
- Snippet / summary:

```ts
const matches = pipe("hello world", String.matchAll(/l/g))
console.log(Array.from(matches)) // [["l"], ["l"], ["l"]]
```

## reports/jsdoc-examples/effect/wave-004-cli-flag.md

### Review Needed

#### `none`

- File: `packages/effect/src/unstable/cli/Flag.ts`
- Original line: 344
- API/declaration: `none`
- Generated title: `Creating sentinel flags`
- Quality: `needs review`
- Reason: The conditional example uses a constant `true`, so the `Flag.none` branch is unreachable and the sentinel use case is only nominally demonstrated.
- Snippet/summary: `const conditionalFlag = true ? Flag.string("value") : Flag.none`.

#### `withSchema`

- File: `packages/effect/src/unstable/cli/Flag.ts`
- Original line: 851
- API/declaration: `withSchema`
- Generated title: `Validating with schemas`
- Quality: `needs review`
- Reason: The email validation predicate only checks for `"@"` while the message says the value must be a valid email address.
- Snippet/summary: `Schema.isIncludes("@", { message: "Must be a valid email address" })`.

## reports/jsdoc-examples/effect/wave-004-cli-param.md

### Review Needed

#### `none`

- File: `packages/effect/src/unstable/cli/Param.ts`
- Original line: 821
- API/declaration: `none`
- Generated title: `Creating sentinel parameters`
- Quality: `needs review`
- Reason: The conditional example appears to enable a development flag in the production branch, and the standalone snippet relies on ambient `process.env`.
- Snippet/summary: `process.env.NODE_ENV === "production" ? Param.string(Param.flagKind, "my-dev-flag") : Param.none(Param.flagKind)`.

#### `variadic`

- File: `packages/effect/src/unstable/cli/Param.ts`
- Original line: 1277
- API/declaration: `variadic`
- Generated title: `Accepting multiple values`
- Quality: `poor`
- Reason: The example comment contradicts the configured maximum: `{ max: 2 }` is documented inline as `at most 5 times`.
- Snippet/summary: `const limited = Param.variadic(Param.string(Param.flagKind, "item"), { min: 2, max: 2 })` with the `max` comment saying `at most 5 times`.

## reports/jsdoc-examples/effect/wave-004-hashmap.md

### Review Needed

#### HashMap.HashMap.Entry

- File: `packages/effect/src/HashMap.ts`
- Original line: 163
- Generated title: Extracting entry types
- Quality: Medium
- Reason: The example logs `HashMap.toEntries(catalog).map(processEntry)` with a fixed output order, but HashMap iteration order should not be used as training guidance without sorting.
- Snippet: Converts catalog entries to descriptions and logs `["laptop: $999 (...)", "book: $29 (...)"]`.

#### HashMap.hasHash

- File: `packages/effect/src/HashMap.ts`
- Original line: 420
- Generated title: Checking keys with a hash
- Quality: Medium
- Reason: The "case-insensitive" wording is misleading because supplying a different hash does not make key equality case-insensitive.
- Snippet: Uses `Hash.string("admin".toLowerCase())` with key `"admin"` and explains the false result as a different hash.

#### HashMap.entries

- File: `packages/effect/src/HashMap.ts`
- Original line: 562
- Generated title: Iterating entries
- Quality: Medium
- Reason: The example prints entries in insertion order, which can train callers to rely on HashMap iteration ordering.
- Snippet: Iterates configuration entries and shows three `Setting ...` lines in creation order.

#### HashMap.findFirst

- File: `packages/effect/src/HashMap.ts`
- Original line: 1053
- Generated title: Finding the first matching entry
- Quality: Medium
- Reason: The example asserts a specific matching entry even though "first" depends on HashMap iteration order.
- Snippet: Finds `value > 1` and comments the result as `Option.some(["c", 3])`.

## reports/jsdoc-examples/effect/wave-004-layer.md

### Review Needed

#### `packages/effect/src/Layer.ts:1449`

- File: `packages/effect/src/Layer.ts`
- Original line: 1449
- API/declaration: `orDie`
- Generated title: `Converting layer failures to defects`
- Quality: `needs review`
- Reason: The example uses `Math.random()` to simulate a flaky database connection. It is valid illustrative code, but later cleanup should prefer deterministic Effect-style examples for LLM training.
- Current example summary: Builds a database layer that may fail with `DatabaseError`, applies `Layer.orDie`, and comments that failures become fiber defects instead of typed errors.

#### `packages/effect/src/Layer.ts:1601`

- File: `packages/effect/src/Layer.ts`
- Original line: 1601
- API/declaration: `catchCause`
- Generated title: `Recovering from layer failures by cause`
- Quality: `poor`
- Reason: The primary database layer returns a failure and then includes unreachable service-construction code, which makes the control flow a poor pattern for LLM training.
- Current example summary: Forces `primaryDatabaseLayer` to fail with `DatabaseError`, then uses `Layer.catchCause` to fall back to in-memory database and logger layers.

#### `packages/effect/src/Layer.ts:1714`

- File: `packages/effect/src/Layer.ts`
- Original line: 1714
- API/declaration: `fresh`
- Generated title: `Creating non-shared layer instances`
- Quality: `poor`
- Reason: The comments imply that yielding the same service twice from one provided environment produces different instances with `Layer.fresh`, which is misleading; freshness applies to layer sharing during construction, not repeated context lookup.
- Current example summary: Creates a counter layer, compares a shared program to a fresh program, and comments that two `Counter` lookups are different instances.

#### `packages/effect/src/Layer.ts:1958`

- File: `packages/effect/src/Layer.ts`
- Original line: 1958
- API/declaration: `satisfiesSuccessType`
- Generated title: `Constraining layer success types`
- Quality: `needs review`
- Reason: The type-error comment appears to state the assignability direction incorrectly for `StringLayer` against a `number` success constraint.
- Current example summary: Declares number and string success layers, applies `Layer.satisfiesSuccessType<number>()`, and comments out an invalid string layer call.

#### `packages/effect/src/Layer.ts:2021`

- File: `packages/effect/src/Layer.ts`
- Original line: 2021
- API/declaration: `satisfiesServicesType`
- Generated title: `Constraining layer service requirements`
- Quality: `needs review`
- Reason: The snippet demonstrates service requirement constraints, but one comment says "success type" instead of describing the requirements/services type.
- Current example summary: Declares layers with numeric and string service requirements, applies `Layer.satisfiesServicesType<number>()`, and comments out an invalid string requirement layer.

## reports/jsdoc-examples/effect/wave-004-pubsub.md

### Review Needed

#### Module documentation

- File: `packages/effect/src/PubSub.ts`
- Original line: 8
- API/declaration: module documentation
- Generated title: Creating and using a PubSub
- Quality: semantically suspect
- Reason: Publishes messages before subscribing to a PubSub without replay; non-replay PubSub messages are only retained for active subscribers, so the later `take` calls can suspend instead of receiving those messages.
- Snippet/summary: Publishes `"Hello"` and `"World"`, then opens a scope, subscribes, and takes two messages.

#### PubSub interface

- File: `packages/effect/src/PubSub.ts`
- Original line: 54
- API/declaration: `PubSub`
- Generated title: Publishing and subscribing to messages
- Quality: semantically suspect
- Reason: Publishes messages before subscribing to a PubSub without replay; the example expects late subscribers to receive messages that were not retained for them.
- Snippet/summary: Creates `PubSub.bounded<string>(10)`, publishes `"Hello"` and `"World"`, then subscribes and takes two messages.

#### Subscription interface

- File: `packages/effect/src/PubSub.ts`
- Original line: 213
- API/declaration: `Subscription`
- Generated title: Taking messages from a subscription
- Quality: incomplete behavior
- Reason: Subscribes and immediately calls `PubSub.take(subscription)` without any publisher, so the example suspends before demonstrating the later `takeUpTo` and `takeAll` calls.
- Snippet/summary: Creates a subscription, then takes one message and multiple messages without publishing any messages.

#### dropping

- File: `packages/effect/src/PubSub.ts`
- Original line: 342
- API/declaration: `dropping`
- Generated title: Dropping messages when full
- Quality: semantically incorrect
- Reason: The example fills a PubSub before any subscribers exist. Without active subscribers, messages are not stored in the bounded buffer, so the fourth publish is not dropped as shown.
- Snippet/summary: Publishes four messages to a dropping PubSub of capacity 3 and expects the fourth publish to return `false`.

#### sliding

- File: `packages/effect/src/PubSub.ts`
- Original line: 386
- API/declaration: `sliding`
- Generated title: Sliding old messages when full
- Quality: semantically incorrect
- Reason: Publishes before subscribing to a PubSub without replay, then expects the later subscription to observe the retained sliding window.
- Snippet/summary: Publishes `"msg1"` through `"msg4"`, then subscribes and expects `["msg2", "msg3", "msg4"]`.

#### unbounded

- File: `packages/effect/src/PubSub.ts`
- Original line: 432
- API/declaration: `unbounded`
- Generated title: Creating an unbounded PubSub
- Quality: semantically suspect
- Reason: Publishes 1000 messages before any subscriber exists, then subscribes and takes one message. Without replay, the late subscription has no prior messages to consume.
- Snippet/summary: Publishes `message-${i}` in a loop, then subscribes and takes the first message.

#### size

- File: `packages/effect/src/PubSub.ts`
- Original line: 533
- API/declaration: `size`
- Generated title: Getting PubSub size
- Quality: semantically incorrect
- Reason: The example expects size to become 2 after publishing with no subscribers, but non-replay PubSub storage only advances for active subscribers.
- Snippet/summary: Publishes `"msg1"` and `"msg2"` before any subscriber and logs `After publishing: 2`.

#### isFull

- File: `packages/effect/src/PubSub.ts`
- Original line: 588
- API/declaration: `isFull`
- Generated title: Checking whether a PubSub is full
- Quality: semantically incorrect
- Reason: The example publishes to a bounded PubSub before subscribing and expects the buffer to become full; without subscribers, those messages do not occupy capacity.
- Snippet/summary: Publishes two messages to capacity 2 and expects `isFull` to return `true`.

#### isEmpty

- File: `packages/effect/src/PubSub.ts`
- Original line: 618
- API/declaration: `isEmpty`
- Generated title: Checking whether a PubSub is empty
- Quality: semantically incorrect
- Reason: Publishes before any subscriber exists and expects the PubSub to be non-empty, but no message is retained for inactive subscribers.
- Snippet/summary: Publishes `"Hello"` and expects `isEmpty` to return `false`.

#### shutdown

- File: `packages/effect/src/PubSub.ts`
- Original line: 647
- API/declaration: `shutdown`
- Generated title: Shutting down a PubSub
- Quality: semantically incorrect
- Reason: The example expects a publisher to suspend on the second publish due to capacity 1, but without active subscribers the first publish does not occupy the buffer, so the second publish need not suspend.
- Snippet/summary: Forks a publisher that publishes two messages to capacity 1, shuts down, and expects the publisher fiber to fail.

#### publish

- File: `packages/effect/src/PubSub.ts`
- Original line: 775
- API/declaration: `publish`
- Generated title: Publishing a message
- Quality: semantically suspect
- Reason: The backpressure section constructs a publish effect before any active subscriber and then subscribes later expecting a take to free space. The earlier publish does not fill capacity without subscribers.
- Snippet/summary: Publishes to a capacity-1 PubSub, creates a second publish effect, then subscribes and takes.

#### publishAll

- File: `packages/effect/src/PubSub.ts`
- Original line: 873
- API/declaration: `publishAll`
- Generated title: Publishing multiple messages
- Quality: semantically suspect
- Reason: The example describes suspension until space is available, but `publishAll` is created before any subscriber exists, so the bounded PubSub may not retain or backpressure the messages as described.
- Snippet/summary: Calls `PubSub.publishAll(smallPubsub, manyMessages)`, then subscribes and takes all messages.

#### subscribe

- File: `packages/effect/src/PubSub.ts`
- Original line: 932
- API/declaration: `subscribe`
- Generated title: Subscribing to messages
- Quality: semantically incorrect
- Reason: Publishes messages before subscribing and later expects subscribers to receive them. The broadcast section also publishes before creating the two subscribers.
- Snippet/summary: Publishes `"Hello"` and `"World"` before subscribing, then publishes `"Broadcast"` before creating two subscribers.

#### takeAll

- File: `packages/effect/src/PubSub.ts`
- Original line: 1065
- API/declaration: `takeAll`
- Generated title: Taking all available messages
- Quality: semantically incorrect
- Reason: Publishes all messages before subscribing to a non-replay PubSub, then expects `takeAll` to return those prior messages.
- Snippet/summary: Publishes `["msg1", "msg2", "msg3"]`, then subscribes and calls `takeAll`.

#### takeUpTo

- File: `packages/effect/src/PubSub.ts`
- Original line: 1135
- API/declaration: `takeUpTo`
- Generated title: Taking up to a maximum number of messages
- Quality: semantically incorrect
- Reason: Publishes messages before subscribing, so the subscription has no queued messages and `takeUpTo` would return an empty collection instead of the expected batches.
- Snippet/summary: Publishes five messages, then subscribes and expects batches of three and two messages.

#### remaining

- File: `packages/effect/src/PubSub.ts`
- Original line: 1264
- API/declaration: `remaining`
- Generated title: Checking remaining messages
- Quality: semantically incorrect
- Reason: Publishes messages before creating the subscription, so the new subscription should not report those messages as remaining.
- Snippet/summary: Publishes three messages, subscribes, and expects `remaining` to be 3 then 2.

#### DroppingStrategy

- File: `packages/effect/src/PubSub.ts`
- Original line: 2315
- API/declaration: `DroppingStrategy`
- Generated title: Using a dropping strategy
- Quality: semantically incorrect
- Reason: Demonstrates dropping by publishing before any subscribers exist. With no active subscribers, the bounded buffer does not fill, so the third publish is not dropped as shown.
- Snippet/summary: Publishes three messages to capacity 2 and expects `[true, true, false]`, then subscribes and expects the first two messages.

#### SlidingStrategy

- File: `packages/effect/src/PubSub.ts`
- Original line: 2391
- API/declaration: `SlidingStrategy`
- Generated title: Using a sliding strategy
- Quality: semantically incorrect
- Reason: Publishes before subscribing to a non-replay PubSub, then expects a later subscriber to observe the recent sliding-window messages.
- Snippet/summary: Publishes four messages to capacity 2, then subscribes and expects `["msg3", "msg4"]`.

## reports/jsdoc-examples/effect/wave-004-queue.md

### Review Needed

#### `packages/effect/src/Queue.ts:76`

- File: `packages/effect/src/Queue.ts`
- Original line: 76
- API/declaration: `Enqueue`
- Generated title: `Offering through enqueue handles`
- Quality: `needs review`
- Reason: The example demonstrates a write-only enqueue handle, but casts it back to the full `Queue.Queue` type before calling `offer` and `offerAll`. This weakens the intended API lesson.
- Snippet / summary:

```ts
const producer = (enqueue: Queue.Enqueue<string>) =>
  Effect.gen(function*() {
    yield* Queue.offer(enqueue as Queue.Queue<string>, "hello")
    yield* Queue.offerAll(enqueue as Queue.Queue<string>, ["world", "!"])
  })
```

#### `packages/effect/src/Queue.ts:309`

- File: `packages/effect/src/Queue.ts`
- Original line: 309
- API/declaration: `make`
- Generated title: `Creating queues`
- Quality: `poor`
- Reason: The example ends the queue, observes the done signal, and then comments that it is signaling failure. At that point the queue is already done, so `Queue.fail` cannot actually fail it.
- Snippet / summary:

```ts
yield * Queue.end(queue)
const done = yield * Effect.flip(Queue.takeAll(queue))
assert.deepStrictEqual(done, Cause.Done)

// signal that the queue has failed
yield * Queue.fail(queue, "boom")
```

#### `packages/effect/src/Queue.ts:458`

- File: `packages/effect/src/Queue.ts`
- Original line: 458
- API/declaration: `unbounded`
- Generated title: `Creating unbounded queues`
- Quality: `needs review`
- Reason: The example comment says `Queue.size` returns `Some(5)`, but the current API returns a plain number.
- Snippet / summary:

```ts
const size = yield * Queue.size(queue)
console.log(size) // Some(5)
```

#### `packages/effect/src/Queue.ts:595`

- File: `packages/effect/src/Queue.ts`
- Original line: 595
- API/declaration: `offerAll`
- Generated title: `Offering multiple values`
- Quality: `poor`
- Reason: The example uses the default suspend strategy on a bounded queue and offers more values than capacity without a consumer, so the effect will wait instead of returning the leftover values shown in the comment.
- Snippet / summary:

```ts
const queue = yield * Queue.bounded<number>(3)
const remaining1 = yield * Queue.offerAll(queue, [1, 2, 3, 4, 5])
console.log(remaining1) // [4, 5] - couldn't fit the last 2
```

#### `packages/effect/src/Queue.ts:690`

- File: `packages/effect/src/Queue.ts`
- Original line: 690
- API/declaration: `fail`
- Generated title: `Failing queues with an error`
- Quality: `needs review`
- Reason: The example fails a queue that still has buffered messages, then comments that taking from the failed queue will fail. Existing messages can still be consumed before the failure is observed.
- Snippet / summary:

```ts
yield * Queue.offer(queue, 1)
yield * Queue.offer(queue, 2)
const failed = yield * Queue.fail(queue, "Something went wrong")
// Taking from failed queue will fail with the error
```

#### `packages/effect/src/Queue.ts:719`

- File: `packages/effect/src/Queue.ts`
- Original line: 719
- API/declaration: `failCause`
- Generated title: `Failing queues with a cause`
- Quality: `needs review`
- Reason: The example has a buffered message when `failCause` is called, so the queue transitions through closing rather than immediately becoming a fully done failed queue.
- Snippet / summary:

```ts
yield * Queue.offer(queue, 1)
const cause = Cause.fail("Queue processing failed")
const failed = yield * Queue.failCause(queue, cause)
```

#### `packages/effect/src/Queue.ts:756`

- File: `packages/effect/src/Queue.ts`
- Original line: 756
- API/declaration: `failCauseUnsafe`
- Generated title: `Failing queues with a cause synchronously`
- Quality: `poor`
- Reason: The example logs the queue state as `"Done"` immediately after failing with a buffered message, but this path leaves the queue in a closing state until buffered messages are drained.
- Snippet / summary:

```ts
Queue.offerUnsafe(queue, 1)
const failed = Queue.failCauseUnsafe(queue, cause)
console.log(queue.state._tag) // "Done"
```

#### `packages/effect/src/Queue.ts:837`

- File: `packages/effect/src/Queue.ts`
- Original line: 837
- API/declaration: `endUnsafe`
- Generated title: `Ending queues synchronously`
- Quality: `poor`
- Reason: The example logs the queue state as `"Done"` immediately after ending a queue with buffered messages, but completion is graceful and the queue remains closing until those messages are consumed.
- Snippet / summary:

```ts
Queue.offerUnsafe(queue, 1)
Queue.offerUnsafe(queue, 2)
const ended = Queue.endUnsafe(queue)
console.log(queue.state._tag) // "Done"
```

#### `packages/effect/src/Queue.ts:911`

- File: `packages/effect/src/Queue.ts`
- Original line: 911
- API/declaration: `shutdown`
- Generated title: `Shutting down queues`
- Quality: `poor`
- Reason: The example says it creates a pending offer, but `Queue.offer(queue, 3)` only constructs a lazy effect. Since it is never forked or yielded, no pending operation exists for shutdown to cancel.
- Snippet / summary:

```ts
// Try to add more than capacity (will be pending)
const pendingOffer = Queue.offer(queue, 3)
const wasShutdown = yield * Queue.shutdown(queue)
```

#### `packages/effect/src/Queue.ts:1082`

- File: `packages/effect/src/Queue.ts`
- Original line: 1082
- API/declaration: `takeN`
- Generated title: `Taking a fixed number of values`
- Quality: `poor`
- Reason: After ending the queue with two buffered values remaining, the example asks `takeN` for five values. The current implementation waits for the requested minimum instead of returning the two buffered values.
- Snippet / summary:

```ts
yield * Queue.end(queue)
const remaining = yield * Queue.takeN(queue, 5)
console.log(remaining) // [6, 7]
```

#### `packages/effect/src/Queue.ts:1166`

- File: `packages/effect/src/Queue.ts`
- Original line: 1166
- API/declaration: `take`
- Generated title: `Taking one value`
- Quality: `needs review`
- Reason: The code correctly handles `Cause.Done`, but the comment says the ended queue fails with `None`, which is the wrong failure signal for this API.
- Snippet / summary:

```ts
// Taking from ended queue fails with None
const result = yield * Effect.match(Queue.take(queue), {
  onFailure: (error: Cause.Done) => true,
  onSuccess: (value: string) => false
})
```

## reports/jsdoc-examples/effect/wave-004-record.md

### Review Needed

#### `packages/effect/src/Record.ts:114`

- File: `packages/effect/src/Record.ts`
- Original line: 114
- API/declaration: `ReadonlyRecordTypeLambda`
- Generated title: `Using a readonly record type lambda`
- Quality: `needs review`
- Reason: The example references the raw `["type"]` member directly and the explanatory comment mentions the unresolved `Target` placeholder. A stronger example should apply the type lambda with `HKT.Kind`, matching the HKT examples elsewhere.
- Snippet / summary:

```ts
type RecordTypeLambda = Record.ReadonlyRecordTypeLambda<"key1" | "key2">
type StringRecord = RecordTypeLambda["type"] // ReadonlyRecord<"key1" | "key2", Target>
```

#### `packages/effect/src/Record.ts:995`

- File: `packages/effect/src/Record.ts`
- Original line: 995
- API/declaration: `isSubrecordBy`
- Generated title: `Checking subrecords with a custom equivalence`
- Quality: `needs review`
- Reason: The snippet creates an `isSubrecord` helper from `Record.isSubrecordBy`, but the assertions call `Record.isSubrecord` instead, so the custom-equivalence API is not actually demonstrated.
- Snippet / summary:

```ts
const isSubrecord = Record.isSubrecordBy(Equal.asEquivalence<number>())

assert.deepStrictEqual(
  Record.isSubrecord({ a: 1 } as Record<string, number>, { a: 1, b: 2 }),
  true
)
```

## reports/jsdoc-examples/effect/wave-004-txhashmap.md

### Review Needed

#### `values`

- File: `packages/effect/src/TxHashMap.ts`
- Original line: 833
- API/declaration: `values`
- Generated title: `Reading values`
- Quality: `needs review`
- Reason: The example logs an unrounded JavaScript division result, but the comment shows `91.33`; the actual output would include more decimal places.
- Snippet/summary: `const average = allScores.reduce((sum, score) => sum + score, 0) / allScores.length` followed by `console.log(average) // 91.33`.

#### `entries`

- File: `packages/effect/src/TxHashMap.ts`
- Original line: 870
- API/declaration: `entries`
- Generated title: `Reading entries`
- Quality: `needs review`
- Reason: The example prints an exact `HashMap` entry array order, which may teach callers to rely on iteration order unless that ordering is explicitly guaranteed.
- Snippet/summary: `console.log(allEntries)` with `// [["host", "localhost"], ["port", "3000"], ["ssl", "false"]]`.

#### `getHash`

- File: `packages/effect/src/TxHashMap.ts`
- Original line: 1168
- API/declaration: `getHash`
- Generated title: `Looking up values with precomputed hashes`
- Quality: `poor`
- Reason: The example uses `Date.now()`, which conflicts with repository guidance to use `Clock` APIs instead of direct wall-clock access.
- Snippet/summary: Session values set `lastActive: Date.now()` before demonstrating `TxHashMap.getHash`.

#### `hasBy`

- File: `packages/effect/src/TxHashMap.ts`
- Original line: 1575
- API/declaration: `hasBy`
- Generated title: `Checking entries with a predicate`
- Quality: `poor`
- Reason: The example uses `Date.now()` in both fixture data and the predicate, which conflicts with repository guidance to use `Clock` APIs.
- Snippet/summary: User statuses use `lastSeen: Date.now()` and later check `Date.now() - user.lastSeen < 1800000`.

#### `compact`

- File: `packages/effect/src/TxHashMap.ts`
- Original line: 1947
- API/declaration: `compact`
- Generated title: `Compacting optional values`
- Quality: `needs review`
- Reason: The example prints an exact entry array order after reading entries from a hash map, which may imply deterministic ordering.
- Snippet/summary: `console.log(ageEntries) // [["alice", 30], ["charlie", 25], ["eve", 28]]`.

#### `toEntries`

- File: `packages/effect/src/TxHashMap.ts`
- Original line: 1999
- API/declaration: `toEntries`
- Generated title: `Converting to entries`
- Quality: `needs review`
- Reason: The example prints an exact entry array order and then converts it to an object, which may imply stable hash-map iteration order.
- Snippet/summary: `console.log(allEntries)` with `// [["theme", "dark"], ["language", "en-US"], ["timezone", "UTC"]]`.

#### `toValues`

- File: `packages/effect/src/TxHashMap.ts`
- Original line: 2037
- API/declaration: `toValues`
- Generated title: `Converting to values`
- Quality: `poor`
- Reason: The total inventory value comment is incorrect for the shown values: `999 * 5 + 29 * 50 + 79 * 20` is `8025`, not `8435`. The example also prints values in an exact array order from a hash map.
- Snippet/summary: The template-literal log reports `// $8,435` after summing the three products.

## reports/jsdoc-examples/effect/wave-004-txqueue.md

### Review Needed

#### `packages/effect/src/TxQueue.ts:73` - `TxEnqueue`

- File: `packages/effect/src/TxQueue.ts`
- Original line: 73
- API / declaration: `TxEnqueue` namespace
- Generated title: `Referencing TxEnqueue variance`
- Quality: `needs review`
- Reason: The example only declares an internal variance annotation type and does not show practical queue usage.
- Snippet / summary:

```ts
declare const variance: TxQueue.TxEnqueue.Variance<number, Error>
```

#### `packages/effect/src/TxQueue.ts:88` - `TxEnqueue.Variance`

- File: `packages/effect/src/TxQueue.ts`
- Original line: 88
- API / declaration: `TxEnqueue.Variance`
- Generated title: `Using TxEnqueue variance annotations`
- Quality: `needs review`
- Reason: The example only declares an internal variance annotation type and does not demonstrate observable behavior.
- Snippet / summary:

```ts
declare const variance: TxQueue.TxEnqueue.Variance<string, Error>
```

#### `packages/effect/src/TxQueue.ts:108` - `TxDequeue`

- File: `packages/effect/src/TxQueue.ts`
- Original line: 108
- API / declaration: `TxDequeue` namespace
- Generated title: `Referencing TxDequeue variance`
- Quality: `needs review`
- Reason: The example only declares an internal variance annotation type and does not show practical queue usage.
- Snippet / summary:

```ts
declare const variance: TxQueue.TxDequeue.Variance<number, Error>
```

#### `packages/effect/src/TxQueue.ts:123` - `TxDequeue.Variance`

- File: `packages/effect/src/TxQueue.ts`
- Original line: 123
- API / declaration: `TxDequeue.Variance`
- Generated title: `Using TxDequeue variance annotations`
- Quality: `needs review`
- Reason: The example only declares an internal variance annotation type and does not demonstrate observable behavior.
- Snippet / summary:

```ts
declare const variance: TxQueue.TxDequeue.Variance<string, Error>
```

#### `packages/effect/src/TxQueue.ts:143` - `TxQueue`

- File: `packages/effect/src/TxQueue.ts`
- Original line: 143
- API / declaration: `TxQueue` namespace
- Generated title: `Referencing TxQueue variance`
- Quality: `needs review`
- Reason: The example only declares an internal variance annotation type and does not show practical queue usage.
- Snippet / summary:

```ts
declare const variance: TxQueue.TxQueue.Variance<number, Error>
```

#### `packages/effect/src/TxQueue.ts:158` - `TxQueue.Variance`

- File: `packages/effect/src/TxQueue.ts`
- Original line: 158
- API / declaration: `TxQueue.Variance`
- Generated title: `Using TxQueue variance annotations`
- Quality: `needs review`
- Reason: The example only declares an internal variance annotation type and does not demonstrate observable behavior.
- Snippet / summary:

```ts
declare const variance: TxQueue.TxQueue.Variance<string, Error>
```

#### `packages/effect/src/TxQueue.ts:230` - `TxDequeue`

- File: `packages/effect/src/TxQueue.ts`
- Original line: 230
- API / declaration: `TxDequeue` interface
- Generated title: `Taking values through dequeue handles`
- Quality: `poor`
- Reason: The first `take` is performed on an empty queue, so the copied program would retry indefinitely before reaching the rest of the example.
- Snippet / summary:

```ts
const queue = yield * TxQueue.bounded<number>(10)
const item = yield * TxQueue.take(queue)
```

#### `packages/effect/src/TxQueue.ts:261` - `TxQueue`

- File: `packages/effect/src/TxQueue.ts`
- Original line: 261
- API / declaration: `TxQueue` interface
- Generated title: `Combining enqueue and dequeue operations`
- Quality: `needs review`
- Reason: The shutdown path is hard to learn from because `shutdown` interrupts the queue while the example's queue is typed with a `string` error channel and the comment says the flipped result is `never`.
- Snippet / summary:

```ts
yield * TxQueue.shutdown(faultTolerantQueue)
const result = yield * Effect.flip(TxQueue.take(faultTolerantQueue)) // never
```

#### `packages/effect/src/TxQueue.ts:625` - `offerAll`

- File: `packages/effect/src/TxQueue.ts`
- Original line: 625
- API / declaration: `offerAll`
- Generated title: `Offering multiple values`
- Quality: `needs review`
- Reason: The snippet imports `Chunk` but never uses it, which is noisy for generated training examples.
- Snippet / summary:

```ts
import { Chunk, Effect, TxQueue } from "effect"
```

#### `packages/effect/src/TxQueue.ts:844` - `takeN`

- File: `packages/effect/src/TxQueue.ts`
- Original line: 844
- API / declaration: `takeN`
- Generated title: `Taking a fixed number of values`
- Quality: `poor`
- Reason: The example requests four items after offering three, so the program retries indefinitely before it can reach the later `takeN(queue, 10)` line.
- Snippet / summary:

```ts
yield * TxQueue.offerAll(queue, [1, 2, 3])
const items = yield * TxQueue.takeN(queue, 4)
```

#### `packages/effect/src/TxQueue.ts:1257` - `end`

- File: `packages/effect/src/TxQueue.ts`
- Original line: 1257
- API / declaration: `end`
- Generated title: `Ending queues`
- Quality: `poor`
- Reason: The queue still contains items when `end` is called, so it transitions through `Closing`; the subsequent `take` and `peek` calls can observe buffered items instead of immediately failing with `Cause.Done`.
- Snippet / summary:

```ts
yield * TxQueue.offer(queue, 1)
yield * TxQueue.offer(queue, 2)
const result = yield * TxQueue.end(queue)
const takeResult = yield * Effect.flip(TxQueue.take(queue))
```

## reports/jsdoc-examples/effect/wave-005-ai-error.md

### Review Needed

#### `ToolResultEncodingError`

- File: `packages/effect/src/unstable/ai/AiError.ts`
- Original line: 1082
- API/declaration: `ToolResultEncodingError`
- Generated title: `Creating a tool result encoding error`
- Quality: `needs review`
- Reason: The example describes a circular-reference encoding failure, but the shown `toolResult` is a plain object and does not actually contain a circular reference.
- Snippet/summary: `toolResult: { circular: "ref" }` with description `"Cannot encode circular reference"`.

## reports/jsdoc-examples/effect/wave-005-ai-prompt.md

### Review Needed

#### 1. ReasoningPart

- File: `packages/effect/src/unstable/ai/Prompt.ts`
- Original line: 334
- API/declaration: `ReasoningPart`
- Generated title: `Creating reasoning parts`
- Quality: medium
- Reason: The example is structurally valid, but the sample reasoning text uses chain-of-thought style phrasing that may be undesirable for LLM-training documentation.
- Snippet/summary: Creates a `Prompt.ReasoningPart` with text beginning `Let me think step by step`.

#### 2. makeMessage

- File: `packages/effect/src/unstable/ai/Prompt.ts`
- Original line: 1025
- API/declaration: `makeMessage`
- Generated title: `Creating messages`
- Quality: medium
- Reason: The example is valid TypeScript, but the variable named `filePart` actually contains a user message, which is confusing for training data.
- Snippet/summary: Creates `textPart`, then assigns `Prompt.makeMessage("user", { content: [textPart] })` to `filePart`.

#### 3. AssistantMessage

- File: `packages/effect/src/unstable/ai/Prompt.ts`
- Original line: 1355
- API/declaration: `AssistantMessage`
- Generated title: `Creating assistant messages`
- Quality: medium
- Reason: The example is structurally valid, but the first text part exposes assistant planning before a tool call, which may be undesirable in LLM-training examples.
- Snippet/summary: Creates an assistant message whose first text part says the user is asking about weather and that the assistant should use the weather tool.

## reports/jsdoc-examples/effect/wave-005-cache.md

### Review Needed

#### `make`

- File: `packages/effect/src/Cache.ts`
- Original line: 199
- API/declaration: `make`
- Generated title: `Creating a cache with TTL and async lookup`
- Quality: `needs review`
- Reason: The example depends on ambient `fetch` and a placeholder `/api/users/...` endpoint, and it accepts unvalidated JSON as the cache value.
- Snippet/summary: Uses `Effect.tryPromise` with `fetch(`/api/users/${userId}`).then((r) => r.json())` inside the cache lookup.

#### `getOption`

- File: `packages/effect/src/Cache.ts`
- Original line: 465
- API/declaration: `getOption`
- Generated title: `Waiting for pending lookups`
- Quality: `needs review`
- Reason: The example starts `getFiber` only to trigger the lookup and never observes or interrupts it, which may teach ignoring forked fibers.
- Snippet/summary: `const getFiber = yield* Effect.forkChild(Cache.get(cache, "key"))` is declared before forking `Cache.getOption`, but only `optionFiber` is joined.

#### `keys`

- File: `packages/effect/src/Cache.ts`
- Original line: 1105
- API/declaration: `keys`
- Generated title: `Reading active keys`
- Quality: `needs review`
- Reason: The example prints an exact array order for `Cache.keys`, which may imply a stable public iteration order beyond the API description.
- Snippet/summary: Converts keys with `Array.from(keys)` and comments the result as `["hello", "world", "cache"]`.

## reports/jsdoc-examples/effect/wave-005-console.md

### Review Needed

#### `packages/effect/src/Console.ts:269`

- File: `packages/effect/src/Console.ts`
- Original line: 269
- API/declaration: `dirxml`
- Generated title: `Inspecting DOM nodes`
- Quality: `needs review`
- Reason: The example is browser-specific and references the global `document`, so it may be less useful for Node-first LLM training examples or non-DOM documentation extraction environments. The snippet was preserved as requested.
- Snippet / summary:

```ts
// In a browser environment
const element = document.getElementById("myElement")
yield * Console.dirxml(element)
```

## reports/jsdoc-examples/effect/wave-005-context.md

### Review Needed

#### `packages/effect/src/Context.ts:583`

- File: `packages/effect/src/Context.ts`
- Original line: 583
- API/declaration: `getOrElse`
- Generated title: `Falling back for missing services`
- Quality: `poor`
- Reason: The example compares objects containing freshly-created function values with `assert.deepStrictEqual`, which would not pass by reference equality even though the API usage is illustrative.
- Snippet / summary:

```ts
const logger = Context.getOrElse(context, Logger, () => ({ log: () => {} }))
const database = Context.getOrElse(
  context,
  Database,
  () => ({ query: () => "fallback" })
)

assert.deepStrictEqual(logger, { log: (msg: string) => console.log(msg) })
assert.deepStrictEqual(database, { query: () => "fallback" })
```

#### `packages/effect/src/Context.ts:706`

- File: `packages/effect/src/Context.ts`
- Original line: 706
- API/declaration: `getReferenceUnsafe`
- Generated title: `Getting reference defaults unsafely`
- Quality: `poor`
- Reason: The example compares an object containing a default-created function against a new function literal with `assert.deepStrictEqual`, which is a weak pattern for LLM training and would fail if executed.
- Snippet / summary:

```ts
const LoggerRef = Context.Reference("Logger", {
  defaultValue: () => ({ log: (msg: string) => console.log(msg) })
})

const context = Context.empty()
const logger = Context.getReferenceUnsafe(context, LoggerRef)

assert.deepStrictEqual(logger, { log: (msg: string) => console.log(msg) })
```

## reports/jsdoc-examples/effect/wave-005-function.md

### Review Needed

#### `pipe` syntax

- File: `packages/effect/src/Function.ts`
- Original line: 473
- API/declaration: `pipe`
- Generated title: `Showing pipeline syntax`
- Quality: `poor`
- Reason: The example is intentionally pseudo-code with placeholder identifiers and an ellipsis, so it is useful as syntax documentation but weak for executable LLM training data.
- Snippet/summary: Shows `pipe(input, func1, func2, ..., funcN)` under a `ts skip-type-checking` fence.

#### `pipe` method chain

- File: `packages/effect/src/Function.ts`
- Original line: 500
- API/declaration: `pipe`
- Generated title: `Chaining methods before conversion`
- Quality: `poor`
- Reason: The example is intentionally pseudo-code for the pre-conversion method-chain style and depends on placeholder identifiers.
- Snippet/summary: Shows `as.map(f).filter(g)` under a `ts skip-type-checking` fence.

#### `pipe` rewrite

- File: `packages/effect/src/Function.ts`
- Original line: 506
- API/declaration: `pipe`
- Generated title: `Rewriting method chains with pipe`
- Quality: `needs review`
- Reason: The example illustrates the rewritten `pipe` form but still depends on placeholder identifiers, so it remains non-executable documentation.
- Snippet/summary: Shows `pipe(as, Array.map(f), Array.filter(g))` under a `ts skip-type-checking` fence.

#### `dual`

- File: `packages/effect/src/Function.ts`
- Original line: 44
- API/declaration: `dual`
- Generated title: `Creating a dual API with arity`
- Quality: `needs review`
- Reason: The example is substantially redundant with the immediately following canonical `dual` example, so it is low-signal for LLM training even though the API usage is valid.
- Snippet/summary: Defines `sum` with `dual(2, ...)` and demonstrates both `sum(2, 3)` and `pipe(2, sum(3))`.

#### `hole`

- File: `packages/effect/src/Function.ts`
- Original line: 1188
- API/declaration: `hole`
- Generated title: `Creating a development placeholder`
- Quality: `poor`
- Reason: The example assigns `hole<string>()` to a value; this documents the placeholder use case, but executing it would throw because `hole` is implemented via `absurd`.
- Snippet/summary: Uses `const placeholder: string = hole<string>()` as a development placeholder.

## reports/jsdoc-examples/effect/wave-005-logger.md

### Review Needed

#### `formatJson`

- File: `packages/effect/src/Logger.ts`
- Original line: 706
- API/declaration: `formatJson`
- Generated title: `Formatting logs as JSON`
- Quality: `poor`
- Reason: The example demonstrates sending to an external logging service by placing a `console.log` side effect inside `Logger.map`, which may train readers to use an output transformation for effectful delivery.
- Snippet/summary: Maps `Logger.formatJson` with a callback that logs `"Sending to external service:"` and returns the same JSON string.

#### `toFile`

- File: `packages/effect/src/Logger.ts`
- Original line: 1201
- API/declaration: `toFile`
- Generated title: `Writing logs to files`
- Quality: `needs review`
- Reason: The example creates file loggers inside `Effect.gen` and yields `Logger.toFile`, which has a scoped lifetime requirement; preserving it keeps the original structure, but an LLM-training example should probably show the intended scoping more explicitly.
- Snippet/summary: Builds basic, batched, and multi-logger file logging programs with `Logger.toFile`, `NodeFileSystem.layer`, and paths such as `/tmp/app.log` and `/var/log/myapp.log`.

## reports/jsdoc-examples/effect/wave-005-number.md

### Review Needed

#### `packages/effect/src/Number.ts:138`

- File: `packages/effect/src/Number.ts`
- Original line: 138
- API/declaration: `divideUnsafe`
- Generated title: `Dividing numbers unsafely`
- Quality: `needs review`
- Reason: The snippet documents the throwing behavior, but includes an unhandled call that throws if copied into a runnable example. The snippet was preserved as requested.
- Snippet / summary:

```ts
Number.divideUnsafe(6, 3) // 2
Number.divideUnsafe(6, 0) // throws RangeError("Division by zero")
```

## reports/jsdoc-examples/effect/wave-005-subscriptionref.md

### Review Needed

#### `changes`

- File: `packages/effect/src/SubscriptionRef.ts`
- Original line: 88
- API/declaration: `changes`
- Generated title: `Streaming changes`
- Quality: `needs review`
- Reason: The example forks a scoped stream consumer and never observes, joins, or interrupts the fiber, so it may teach ignoring forked fibers in long-running stream examples.
- Snippet/summary: Creates `const fiber = yield* Stream.runForEach(...).pipe(Effect.forkScoped)` before setting values on the `SubscriptionRef`.

## reports/jsdoc-examples/effect/wave-005-txchunk.md

### Review Needed

#### 1. `packages/effect/src/TxChunk.ts:257`

- API/declaration: `update`
- Generated title: `Updating the stored chunk`
- Quality: Duplicated explanatory comment
- Reason: The example body was preserved, but it repeats the same instruction on consecutive comment lines.
- Snippet/summary: Reverses a transactional chunk with `TxChunk.update(txChunk, (chunk) => Chunk.reverse(chunk))`.

#### 2. `packages/effect/src/TxChunk.ts:592`

- API/declaration: `map`
- Generated title: `Mapping elements`
- Quality: Duplicated explanatory comment
- Reason: The example body was preserved, but it repeats the same instruction on consecutive comment lines.
- Snippet/summary: Doubles every element with `TxChunk.map(txChunk, (n) => n * 2)`.

#### 3. `packages/effect/src/TxChunk.ts:625`

- API/declaration: `filter`
- Generated title: `Filtering elements`
- Quality: Duplicated explanatory comment
- Reason: The example body was preserved, but it repeats the same instruction on consecutive comment lines.
- Snippet/summary: Keeps even numbers with `TxChunk.filter(txChunk, (n) => n % 2 === 0)`.

#### 4. `packages/effect/src/TxChunk.ts:661`

- API/declaration: `appendAll`
- Generated title: `Appending another chunk`
- Quality: Duplicated explanatory comment
- Reason: The example body was preserved, but it repeats the same instruction on consecutive comment lines.
- Snippet/summary: Appends `otherChunk` to `txChunk` with `TxChunk.appendAll(txChunk, otherChunk)`.

#### 5. `packages/effect/src/TxChunk.ts:696`

- API/declaration: `prependAll`
- Generated title: `Prepending another chunk`
- Quality: Duplicated explanatory comment
- Reason: The example body was preserved, but it repeats the same instruction on consecutive comment lines.
- Snippet/summary: Prepends `otherChunk` to `txChunk` with `TxChunk.prependAll(txChunk, otherChunk)`.

## reports/jsdoc-examples/effect/wave-005-txhashset.md

### Review Needed

#### 1. `packages/effect/src/TxHashSet.ts:119`

- API/declaration: `TxHashSet.TxHashSet.Value`
- Generated title: `Extracting a TxHashSet value type`
- Quality: Misleading type-level example
- Reason: `TxHashSet.make(...)` returns an `Effect.Effect<TxHashSet<...>>`, so `TxHashSet.TxHashSet.Value<typeof fruits>` does not extract the value type from an actual `TxHashSet` in this snippet.
- Snippet/summary: `const fruits = TxHashSet.make("apple", "banana", "cherry")`; then `type Fruit = TxHashSet.TxHashSet.Value<typeof fruits>`.

#### 2. `packages/effect/src/TxHashSet.ts:208`

- API/declaration: `fromIterable`
- Generated title: `Creating a transactional hash set from an iterable`
- Quality: Potentially unstable output expectation
- Reason: The example converts a `HashSet` snapshot to an array and shows a specific order. This may teach that `HashSet` iteration order should be relied on.
- Snippet/summary: Builds a set from `"hello"`, then logs `Array.from(values)` as `["h", "e", "l", "o"]`.

## reports/jsdoc-examples/effect/wave-006-batch-001.md

### Review Needed

| File                                    | Original line | API / declaration | Generated title             | Quality      | Reason                                                                                                              | Snippet / summary                                                                 |
| --------------------------------------- | ------------: | ----------------- | --------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `packages/effect/src/HashSet.ts`        |           213 | `has`             | Checking HashSet membership | Poor         | The preserved import line contains an inline `// false` comment that appears to belong to an example assertion.     | `import * as HashSet from "effect/HashSet" // false`                              |
| `packages/effect/src/FileSystem.ts`     |           377 | `Size` type       | Creating branded file sizes | Poor         | The preserved generator returns `fs.truncate(...)` instead of yielding it, so it demonstrates a nested effect.      | `return fs.truncate(path, size)` inside `Effect.gen`.                             |
| `packages/effect/src/FileSystem.ts`     |           530 | `GiB`             | Creating gibibyte sizes     | Needs review | The example says it checks available space by calling `fs.stat(".")`, but file stat metadata does not provide that. | Calls `const stats = yield* fs.stat(".")` before creating a large temporary file. |
| `packages/effect/src/FileSystem.ts`     |          1101 | `File.Info`       | Inspecting file information | Needs review | The preserved example uses `new Date(0)`, while local guidance prefers Effect time APIs over direct Date creation.  | `Option.getOrElse(info.mtime, () => new Date(0))`.                                |
| `packages/effect/src/ManagedRuntime.ts` |           136 | `make`            | Creating a managed runtime  | Needs review | The preserved example uses `async` / `await`; local guidance asks examples and code to avoid async/await.           | Defines `async function main()` and awaits `runtime.runPromise` / `dispose`.      |

## reports/jsdoc-examples/effect/wave-006-batch-002.md

### Review Needed

#### `packages/effect/src/FiberMap.ts:28`

- File: `packages/effect/src/FiberMap.ts`
- Original line: 28
- API/declaration: `FiberMap`
- Generated title: `Managing fibers in a map`
- Quality: `needs review`
- Reason: The example runs two immediately succeeding effects and then expects the map size to be `2`, but completed fibers are automatically removed, so the observed size can be `0`.
- Snippet/summary: Creates a `FiberMap`, runs `"task1"` and `"task2"` with `Effect.succeed`, then logs `FiberMap.size(map) // 2`.

#### `packages/effect/src/FiberMap.ts:157`

- File: `packages/effect/src/FiberMap.ts`
- Original line: 157
- API/declaration: `makeRuntime`
- Generated title: `Creating a scoped runtime`
- Quality: `poor`
- Reason: The example uses `Fiber.await` but comments the awaited values as raw success values. `Fiber.await` returns an `Exit`, so the displayed output is misleading.
- Snippet/summary: Awaits two fibers with `Fiber.await(fiber1)` and `Fiber.await(fiber2)`, then logs them as `"Hello", "World"`.

#### `packages/effect/src/FiberMap.ts:251`

- File: `packages/effect/src/FiberMap.ts`
- Original line: 251
- API/declaration: `setUnsafe`
- Generated title: `Adding a fiber unsafely`
- Quality: `poor`
- Reason: The snippet awaits a fiber with `Fiber.await` and comments the result as `"Hello"`, but the API returns an `Exit`.
- Snippet/summary: Forks `Effect.succeed("Hello")`, adds the fiber with `FiberMap.setUnsafe`, then logs `Fiber.await(fiber) // "Hello"`.

#### `packages/effect/src/FiberMap.ts:341`

- File: `packages/effect/src/FiberMap.ts`
- Original line: 341
- API/declaration: `set`
- Generated title: `Adding a fiber`
- Quality: `poor`
- Reason: Like the unsafe variant, the example treats `Fiber.await` as if it returns the fiber success value rather than an `Exit`.
- Snippet/summary: Adds a forked `"Hello"` fiber with `FiberMap.set`, awaits it, and logs the awaited result as `"Hello"`.

#### `packages/effect/src/FiberMap.ts:392`

- File: `packages/effect/src/FiberMap.ts`
- Original line: 392
- API/declaration: `getUnsafe`
- Generated title: `Retrieving a fiber unsafely`
- Quality: `poor`
- Reason: The retrieved fiber is awaited with `Fiber.await`, but the comment shows the raw success value instead of an `Exit`.
- Snippet/summary: Retrieves a fiber from `Option.Some`, awaits it, and logs `result // "Hello"`.

#### `packages/effect/src/FiberMap.ts:430`

- File: `packages/effect/src/FiberMap.ts`
- Original line: 430
- API/declaration: `get`
- Generated title: `Retrieving a fiber`
- Quality: `poor`
- Reason: The Effect-wrapped retrieval example has the same `Fiber.await` result mismatch as `getUnsafe`.
- Snippet/summary: Uses `yield* FiberMap.get(map, "greeting")`, awaits the retrieved fiber, and logs it as `"Hello"`.

#### `packages/effect/src/FiberMap.ts:465`

- File: `packages/effect/src/FiberMap.ts`
- Original line: 465
- API/declaration: `hasUnsafe`
- Generated title: `Checking if a key exists unsafely`
- Quality: `needs review`
- Reason: The example stores an immediately succeeding effect and then checks for the key, but completed fibers are removed automatically, so the key may no longer be present.
- Snippet/summary: Runs `Effect.succeed("Hello")` under `"task1"`, then logs `FiberMap.hasUnsafe(map, "task1") // true`.

#### `packages/effect/src/FiberMap.ts:497`

- File: `packages/effect/src/FiberMap.ts`
- Original line: 497
- API/declaration: `has`
- Generated title: `Checking if a key exists`
- Quality: `needs review`
- Reason: The Effect-wrapped `has` example has the same immediate-completion race as `hasUnsafe`.
- Snippet/summary: Runs `Effect.succeed("Hello")`, checks `yield* FiberMap.has(map, "task1")`, and expects `true`.

#### `packages/effect/src/FiberMap.ts:625`

- File: `packages/effect/src/FiberMap.ts`
- Original line: 625
- API/declaration: `run`
- Generated title: `Forking effects into a map`
- Quality: `poor`
- Reason: The example awaits fibers with `Fiber.await` but comments the values as direct successes instead of `Exit` values.
- Snippet/summary: Runs two successful effects, awaits both fibers with `Fiber.await`, and logs them as `"Hello", "World"`.

#### `packages/effect/src/Symbol.ts:10`

- File: `packages/effect/src/Symbol.ts`
- Original line: 10
- API/declaration: `isSymbol`
- Generated title: `Checking for symbols`
- Quality: `poor`
- Reason: The example is attached to `effect/Symbol` but imports `effect/Predicate` and demonstrates `Predicate.isSymbol` instead of the declared `isSymbol` export.
- Snippet/summary: Imports `* as Predicate from "effect/Predicate"` and calls `Predicate.isSymbol(...)`.

## reports/jsdoc-examples/effect/wave-006-batch-003.md

### Review Needed

| File                              | Original line | API / declaration     | Generated title                       | Quality | Reason                                                                                                                                                                                          | Snippet / summary                                                                                    |
| --------------------------------- | ------------: | --------------------- | ------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `packages/effect/src/Pipeable.ts` |           505 | `pipeArguments`       | Implementing custom piping            | Poor    | Internal helper example appears to pass the wrapper's full `arguments` object, including `self`, into `pipeArguments`, so it likely misrepresents correct direct usage and may fail at runtime. | Defines `customPipe(5, add(2), multiply(3))` using `Pipeable.pipeArguments(self, arguments as any)`. |
| `packages/effect/src/Sink.ts`     |            83 | `SinkUnify`           | Unifying sink and effect types        | Low     | Internal type-system machinery example with declared placeholders and a synthetic type alias; limited value as user-facing API training data.                                                   | Declares `sink` and `effect`, then aliases `Sink.SinkUnify<{ [Unify.typeSymbol]?: any }>`            |
| `packages/effect/src/Sink.ts`     |           117 | `SinkUnifyIgnore`     | Configuring sink unification ignores  | Low     | Only aliases an internal ignore configuration type and does not demonstrate practical behavior.                                                                                                 | `type IgnoreConfig = Sink.SinkUnifyIgnore`                                                           |
| `packages/effect/src/Sink.ts`     |           135 | `Sink` namespace      | Referencing sink type definitions     | Low     | Documents namespace internals rather than a concrete user workflow.                                                                                                                             | Aliases `Sink.Sink<A, In, L, E, R>` through `SinkType`.                                              |
| `packages/effect/src/Sink.ts`     |           152 | `Sink.Variance`       | Referencing sink variance annotations | Low     | Internal variance marker example uses a synthetic intersection type and is not useful for normal API usage.                                                                                     | `type SinkWithVariance = Sink.Sink<string> & { variance: "internal" }`                               |
| `packages/effect/src/Sink.ts`     |           171 | `Sink.VarianceStruct` | Referencing sink variance structure   | Low     | Internal variance-structure example only aliases a sink type and does not demonstrate the declared structure.                                                                                   | `type SinkInstance = Sink.Sink<number, string>`                                                      |

## reports/jsdoc-examples/effect/wave-006-batch-004.md

### Review Needed

#### `isProviderDefined`

- File: `packages/effect/src/unstable/ai/Tool.ts`
- Original line: 529
- API/declaration: `isProviderDefined`
- Generated title: `Checking for provider-defined tools`
- Quality: `needs review`
- Reason: The example is structurally valid, but it appears to demonstrate the wrong guard by calling `Tool.isUserDefined` in the `isProviderDefined` documentation block. The expected output for the provider-defined tool is also inconsistent with that call.
- Snippet/summary: The preserved example logs `Tool.isUserDefined(UserDefinedTool) // false` and `Tool.isUserDefined(ProviderDefinedTool) // true`.

## reports/jsdoc-examples/effect/wave-006-batch-005.md

### Review Needed

#### `packages/effect/src/MutableList.ts:800`

- File: `packages/effect/src/MutableList.ts`
- Original line: 800
- API/declaration: `filter`
- Generated title: `Filtering in place`
- Quality: `poor`
- Reason: The preserved example asserts that `list.length` is updated after filtering, but the current implementation rebuilds the internal bucket without updating `self.length`, so the output comments appear inconsistent with current behavior.
- Snippet / summary:

```ts
MutableList.filter(list, (n) => n % 2 === 0)

console.log(list.length) // 5
console.log(MutableList.takeAll(list)) // [2, 4, 6, 8, 10]
```

#### `packages/effect/src/MutableList.ts:863`

- File: `packages/effect/src/MutableList.ts`
- Original line: 863
- API/declaration: `remove`
- Generated title: `Removing matching values`
- Quality: `poor`
- Reason: The preserved example relies on `remove` updating `list.length` and returning only remaining elements via `takeAll`, but `remove` delegates to `filter`, whose current implementation does not update `self.length`.
- Snippet / summary:

```ts
MutableList.remove(list, "apple")

console.log(list.length) // 2
console.log(MutableList.takeAll(list)) // ["banana", "cherry"]
```

## reports/jsdoc-examples/effect/wave-006-batch-006.md

### Review Needed

| File                                            | Original line | API / declaration | Generated title                    | Quality      | Reason                                                                                                                                                                       | Snippet / summary                                                                 |
| ----------------------------------------------- | ------------: | ----------------- | ---------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `packages/effect/src/unstable/cli/Primitive.ts` |           421 | `fileText`        | Reading file text                  | Needs review | Preserved example parses file contents with raw `JSON.parse` inside `Effect.gen`; this may throw outside the Effect error channel and is weak for LLM-training.              | Reads `./config.json`, logs file text, then calls `JSON.parse(content)`.          |
| `packages/effect/src/unstable/cli/Primitive.ts` |           552 | `fileSchema`      | Parsing file content with a schema | Needs review | Preserved example combines `Schema.fromJsonString` with `fileSchema(..., { format: "json" })`, which appears to decode already-parsed JSON and may be misleading at runtime. | Builds a JSON string schema, parses `./config.json`, and logs the decoded config. |
