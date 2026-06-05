/**
 * Generic actor runtime.
 *
 * @since 4.0.0
 */

import * as Effect from "./Effect.ts"
import * as Fiber from "./Fiber.ts"
import * as Queue from "./Queue.ts"
import * as Ref from "./Ref.ts"

/**
 * Reference to an actor that can receive events.
 *
 * @category models
 * @since 4.0.0
 */
export interface ActorRef<in Event> {
  readonly send: (event: Event) => Effect.Effect<void>
}

/**
 * Running actor with a current snapshot and a stop action.
 *
 * @category models
 * @since 4.0.0
 */
export interface Actor<out Snapshot, in Event> extends ActorRef<Event> {
  readonly snapshot: Effect.Effect<Snapshot>
  readonly stop: Effect.Effect<void>
}

/**
 * State transition logic used by an actor runtime.
 *
 * @category models
 * @since 4.0.0
 */
export interface ActorLogic<Snapshot, Event> {
  readonly initial: Effect.Effect<Snapshot>
  readonly transition: (snapshot: Snapshot, event: Event) => Effect.Effect<Snapshot>
}

/**
 * Creates actor logic from an initial snapshot and a transition function.
 *
 * @category constructors
 * @since 4.0.0
 */
export const fromTransition = <Snapshot, Event>(
  initial: Snapshot,
  transition: (snapshot: Snapshot, event: Event) => Effect.Effect<Snapshot>
): ActorLogic<Snapshot, Event> => ({
  initial: Effect.succeed(initial),
  transition
})

/**
 * Starts an actor from actor logic.
 *
 * @category constructors
 * @since 4.0.0
 */
export const start: <Snapshot, Event>(
  logic: ActorLogic<Snapshot, Event>
) => Effect.Effect<Actor<Snapshot, Event>> = Effect.fnUntraced(function*<Snapshot, Event>(
  logic: ActorLogic<Snapshot, Event>
) {
  const initial = yield* logic.initial
  const queue = yield* Queue.unbounded<Event>()
  const current = yield* Ref.make(initial)
  const fiber = yield* Effect.forkChild(
    Queue.take(queue).pipe(
      Effect.flatMap(
        Effect.fnUntraced(function*(event) {
          const snapshot = yield* Ref.get(current)
          const newSnapshot = yield* logic.transition(snapshot, event)
          return yield* Ref.set(current, newSnapshot)
        })
      ),
      Effect.forever
    )
  )

  return {
    snapshot: Ref.get(current),
    stop: Queue.shutdown(queue).pipe(Effect.andThen(Fiber.interrupt(fiber))),
    send: (event: Event) => Queue.offer(queue, event).pipe(Effect.asVoid)
  }
})
