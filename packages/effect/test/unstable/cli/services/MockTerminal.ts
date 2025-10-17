import * as Array from "effect/collections/Array"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Terminal from "effect/platform/Terminal"
import * as Queue from "effect/Queue"
import type * as Scope from "effect/Scope"
import * as ServiceMap from "effect/ServiceMap"

// =============================================================================
// Models
// =============================================================================

export interface MockTerminal extends Terminal.Terminal {
  readonly inputText: (text: string) => Effect.Effect<void>
  readonly inputKey: (key: string, modifiers?: Partial<MockTerminal.Modifiers>) => Effect.Effect<void>
}

export declare namespace MockTerminal {
  export interface Modifiers {
    readonly ctrl: boolean
    readonly meta: boolean
    readonly shift: boolean
  }
}

// =============================================================================
// Service
// =============================================================================

export const MockTerminal = ServiceMap.Service<Terminal.Terminal, MockTerminal>()(
  "@effect/platform/Terminal"
)

// =============================================================================
// Constructors
// =============================================================================

export const make = Effect.gen(function*() {
  const queue = yield* Effect.acquireRelease(
    Queue.make<Terminal.UserInput, Queue.Done>(),
    (queue) => Queue.shutdown(queue)
  )

  const inputText: MockTerminal["inputText"] = (text: string) => {
    const inputs = Array.map(text.split(""), (key) => toUserInput(key))
    return Queue.offerAll(queue, inputs).pipe(Effect.asVoid)
  }

  const inputKey: MockTerminal["inputKey"] = (
    key: string,
    modifiers?: Partial<MockTerminal.Modifiers>
  ) => {
    const input = toUserInput(key, modifiers)
    return shouldQuit(input) ? Queue.end(queue) : Queue.offer(queue, input).pipe(Effect.asVoid)
  }

  const display: MockTerminal["display"] = (input) => Console.log(input)

  const readInput: MockTerminal["readInput"] = Effect.succeed(Queue.asDequeue(queue))

  const terminal = Terminal.make({
    columns: Effect.succeed(80),
    display,
    readInput,
    readLine: Effect.succeed("")
  })

  return Object.assign(terminal, {
    inputKey,
    inputText
  })
})

// =============================================================================
// Layer
// =============================================================================

export const layer: Layer.Layer<Terminal.Terminal> = Layer.effect(MockTerminal, make)

// =============================================================================
// Accessors
// =============================================================================

export const columns: Effect.Effect<number, never, Terminal.Terminal> = Effect.flatMap(
  MockTerminal.asEffect(),
  (terminal) => terminal.columns
)

export const readInput: Effect.Effect<
  Queue.Dequeue<Terminal.UserInput, Queue.Done>,
  never,
  Terminal.Terminal | Scope.Scope
> = Effect.flatMap(MockTerminal.asEffect(), (terminal) => terminal.readInput)

export const readLine: Effect.Effect<string, Terminal.QuitError, Terminal.Terminal> = Effect.flatMap(
  MockTerminal.asEffect(),
  (terminal) => terminal.readLine
)

export const inputKey = (
  key: string,
  modifiers?: Partial<MockTerminal.Modifiers>
): Effect.Effect<void, never, Terminal.Terminal> =>
  Effect.flatMap(
    MockTerminal.asEffect(),
    (terminal) => terminal.inputKey(key, modifiers)
  )

export const inputText = (text: string): Effect.Effect<void, never, Terminal.Terminal> =>
  Effect.flatMap(
    MockTerminal.asEffect(),
    (terminal) => terminal.inputText(text)
  )

// =============================================================================
// Utilities
// =============================================================================

const shouldQuit = (input: Terminal.UserInput): boolean =>
  input.key.ctrl && (input.key.name === "c" || input.key.name === "d")

const toUserInput = (
  key: string,
  modifiers: Partial<MockTerminal.Modifiers> = {}
): Terminal.UserInput => {
  const { ctrl = false, meta = false, shift = false } = modifiers
  return {
    input: key,
    key: { name: key, ctrl, meta, shift }
  }
}
