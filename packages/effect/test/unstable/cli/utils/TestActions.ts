import { Effect, Layer, Ref, ServiceMap } from "effect"

/**
 * Represents an action that a command would take
 */
export interface TestAction {
  readonly command: string
  readonly details: Record<string, unknown>
}

/**
 * Service for collecting test actions that commands perform
 */
export interface TestActions {
  readonly log: (action: TestAction) => Effect.Effect<void>
  readonly getActions: Effect.Effect<ReadonlyArray<TestAction>>
}

/**
 * Service tag for TestActions service
 */
export const TestActions = ServiceMap.Key<TestActions>("@effect/cli/test/TestActions")

/**
 * Implementation of TestActions using Ref
 */
const make: Effect.Effect<TestActions> = Effect.gen(function*() {
  const ref = yield* Ref.make<ReadonlyArray<TestAction>>([])

  return {
    log: (action: TestAction) => Ref.update(ref, (actions: ReadonlyArray<TestAction>) => [...actions, action]),

    getActions: Ref.get(ref)
  }
})

/**
 * Layer that provides TestActions service
 */
export const layer = Layer.effect(TestActions)(make)

/**
 * Helper function to log an action from within a command handler
 */
export const logAction = (command: string, details: Record<string, unknown> = {}) =>
  Effect.gen(function*() {
    const testActions = yield* TestActions
    yield* testActions.log({ command, details })
  })

/**
 * Helper function to get all logged actions
 */
export const getActions = Effect.gen(function*() {
  const testActions = yield* TestActions
  return yield* testActions.getActions
})
