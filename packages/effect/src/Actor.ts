/**
 * Generic actor runtime.
 *
 * @since 4.0.0
 */

import * as Effect from "./Effect.ts"
import * as Fiber from "./Fiber.ts"
import * as Queue from "./Queue.ts"
import * as SynchronizedRef from "./SynchronizedRef.ts"

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
 * Runtime context available to an effect-backed actor.
 *
 * @category models
 * @since 4.0.0
 */
export interface ActorContext<Snapshot, Event> {
  readonly receive: Effect.Effect<Event>
  readonly snapshot: Effect.Effect<Snapshot>
  readonly setSnapshot: (snapshot: Snapshot) => Effect.Effect<void>
  readonly updateSnapshot: <E, R>(
    f: (snapshot: Snapshot) => Effect.Effect<Snapshot, E, R>
  ) => Effect.Effect<void, E, R>
}

/**
 * State transition logic used by an actor runtime.
 *
 * @category models
 * @since 4.0.0
 */
export interface ActorLogic<Snapshot, Event, out E = never, out R = never> {
  readonly initial: Effect.Effect<Snapshot>
  readonly run: (context: ActorContext<Snapshot, Event>) => Effect.Effect<void, E, R>
}

/**
 * Creates actor logic from an initial snapshot and an effectful actor process.
 *
 * @category constructors
 * @since 4.0.0
 */
export const fromEffect = <Snapshot, Event, E = never, R = never>(
  initial: Snapshot,
  effect: (context: ActorContext<Snapshot, Event>) => Effect.Effect<void, E, R>
): ActorLogic<Snapshot, Event, E, R> => ({
  initial: Effect.succeed(initial),
  run: effect
})

/**
 * Creates actor logic from an initial snapshot and a transition function.
 *
 * @category constructors
 * @since 4.0.0
 */
export const fromTransition = <Snapshot, Event, E = never, R = never>(
  initial: Snapshot,
  transition: (snapshot: Snapshot, event: Event) => Effect.Effect<Snapshot, E, R>
): ActorLogic<Snapshot, Event, E, R> =>
  fromEffect(initial, ({ receive, updateSnapshot }) =>
    receive.pipe(
      Effect.flatMap((event) => updateSnapshot((snapshot) => transition(snapshot, event))),
      Effect.forever
    ))

/**
 * Starts an actor from actor logic.
 *
 * @category constructors
 * @since 4.0.0
 */
export const start: <Snapshot, Event, E = never, R = never>(
  logic: ActorLogic<Snapshot, Event, E, R>
) => Effect.Effect<Actor<Snapshot, Event>, never, R> = Effect.fnUntraced(function*<Snapshot, Event, E, R>(
  logic: ActorLogic<Snapshot, Event, E, R>
) {
  const initial = yield* logic.initial
  const queue = yield* Queue.unbounded<Event>()
  const current = yield* SynchronizedRef.make(initial)
  const context: ActorContext<Snapshot, Event> = {
    receive: Queue.take(queue),
    snapshot: SynchronizedRef.get(current),
    setSnapshot: (snapshot) => SynchronizedRef.set(current, snapshot),
    updateSnapshot: (f) => SynchronizedRef.updateEffect(current, f)
  }
  const fiber = yield* Effect.forkChild(logic.run(context))

  return {
    snapshot: SynchronizedRef.get(current),
    stop: Queue.shutdown(queue).pipe(Effect.andThen(Fiber.interrupt(fiber))),
    send: (event: Event) => Queue.offer(queue, event).pipe(Effect.asVoid)
  }
})
