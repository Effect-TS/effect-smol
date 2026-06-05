import { assert, describe, it } from "@effect/vitest"
import { Actor, Cause, Data, Deferred, Effect, Fiber, Match, Queue, Stream } from "effect"

class Increment extends Data.TaggedClass("Increment")<{
  readonly by: number
}> {}

class BlockedIncrement extends Data.TaggedClass("BlockedIncrement")<{
  readonly by: number
  readonly processing: Deferred.Deferred<void>
  readonly release: Deferred.Deferred<void>
}> {}

class ReadCount extends Data.TaggedClass("ReadCount")<{
  readonly reply: Deferred.Deferred<number>
}> {}

class SetCount extends Data.TaggedClass("SetCount")<{
  readonly value: number
}> {}

class ConcurrentIncrement extends Data.TaggedClass("ConcurrentIncrement")<{
  readonly processing: Deferred.Deferred<void>
  readonly release: Deferred.Deferred<void>
  readonly secondStarted: Deferred.Deferred<void>
  readonly reply: Deferred.Deferred<number>
}> {}

class BumpSelf extends Data.TaggedClass("BumpSelf")<{
  readonly by: number
  readonly reply: Deferred.Deferred<number>
}> {}

class SpawnCounter extends Data.TaggedClass("SpawnCounter")<{
  readonly by: number
  readonly reply: Deferred.Deferred<number>
}> {}

class LogicError extends Data.TaggedError("LogicError")<{
  readonly message: string
}> {}

type CounterEvent = Increment | BlockedIncrement | ReadCount
type EffectCounterEvent = Increment | ReadCount | SetCount | ConcurrentIncrement

const transition = (count: number) =>
  Match.type<CounterEvent>().pipe(
    Match.tagsExhaustive({
      Increment: (event) => Effect.succeed(count + event.by),
      BlockedIncrement: (event) =>
        Deferred.succeed(event.processing, void 0).pipe(
          Effect.andThen(Deferred.await(event.release)),
          Effect.as(count + event.by)
        ),
      ReadCount: (event) =>
        Deferred.succeed(event.reply, count).pipe(
          Effect.as(count)
        )
    })
  )

const counterLogic = Actor.fromTransition(0, (count, event: CounterEvent) => transition(count)(event))
const effectCounterLogic = Actor.fromEffect<number, EffectCounterEvent>(
  0,
  ({ receive, setState, state, updateState }) =>
    receive.pipe(
      Effect.flatMap(
        Match.type<EffectCounterEvent>().pipe(
          Match.tagsExhaustive({
            Increment: (event) => updateState((count) => Effect.succeed(count + event.by)),
            SetCount: (event) => setState(event.value),
            ReadCount: (event) =>
              state.pipe(
                Effect.flatMap((count) => Deferred.succeed(event.reply, count))
              ),
            ConcurrentIncrement: (event) =>
              Effect.gen(function*() {
                const first = yield* updateState((count) =>
                  Deferred.succeed(event.processing, void 0).pipe(
                    Effect.andThen(Deferred.await(event.release)),
                    Effect.as(count + 1)
                  )
                ).pipe(Effect.forkChild)
                yield* Deferred.await(event.processing)
                const second = yield* updateState((count) => Effect.succeed(count + 1)).pipe(Effect.forkChild)
                yield* Deferred.succeed(event.secondStarted, void 0)
                yield* Fiber.join(first)
                yield* Fiber.join(second)
                const count = yield* state
                yield* Deferred.succeed(event.reply, count)
              })
          })
        )
      ),
      Effect.forever
    )
)

describe("Actor", () => {
  it.effect("updates the state from sent events", () =>
    Effect.gen(function*() {
      const reply = yield* Deferred.make<number>()
      const actor = yield* Actor.start(counterLogic)

      yield* actor.send(new Increment({ by: 1 }))
      yield* actor.send(new ReadCount({ reply }))

      assert.strictEqual(yield* Deferred.await(reply), 1)
      assert.strictEqual(yield* actor.state, 1)
      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "active",
        state: 1
      })

      yield* actor.stop
    }))

  it.effect("send only waits for the event to be enqueued", () =>
    Effect.gen(function*() {
      const processing = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const reply = yield* Deferred.make<number>()
      const actor = yield* Actor.start(counterLogic)

      yield* actor.send(new BlockedIncrement({ by: 1, processing, release }))
      yield* Deferred.await(processing)
      assert.strictEqual(yield* actor.state, 0)

      yield* actor.send(new ReadCount({ reply }))
      yield* Deferred.succeed(release, void 0)

      assert.strictEqual(yield* Deferred.await(reply), 1)
      assert.strictEqual(yield* actor.state, 1)

      yield* actor.stop
    }))

  it.effect("runs actor logic from an effect", () =>
    Effect.gen(function*() {
      const reply = yield* Deferred.make<number>()
      const actor = yield* Actor.start(effectCounterLogic)

      yield* actor.send(new Increment({ by: 2 }))
      yield* actor.send(new SetCount({ value: 10 }))
      yield* actor.send(new Increment({ by: 1 }))
      yield* actor.send(new ReadCount({ reply }))

      assert.strictEqual(yield* Deferred.await(reply), 11)
      assert.strictEqual(yield* actor.state, 11)

      yield* actor.stop
    }))

  it.effect("serializes effect-backed snapshot updates", () =>
    Effect.gen(function*() {
      const processing = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const secondStarted = yield* Deferred.make<void>()
      const reply = yield* Deferred.make<number>()
      const actor = yield* Actor.start(effectCounterLogic)

      yield* actor.send(new ConcurrentIncrement({ processing, release, secondStarted, reply }))
      yield* Deferred.await(processing)
      yield* Deferred.await(secondStarted)
      assert.strictEqual(yield* actor.state, 0)

      yield* Deferred.succeed(release, void 0)

      assert.strictEqual(yield* Deferred.await(reply), 2)
      assert.strictEqual(yield* actor.state, 2)

      yield* actor.stop
    }))

  it.effect("provides a self reference to actor logic", () =>
    Effect.gen(function*() {
      type SelfEvent = BumpSelf | Increment | ReadCount
      const reply = yield* Deferred.make<number>()
      const actor = yield* Actor.start(Actor.fromEffect<number, SelfEvent>(
        0,
        ({ receive, self, state, updateState }) =>
          receive.pipe(
            Effect.flatMap(
              Match.type<SelfEvent>().pipe(
                Match.tagsExhaustive({
                  BumpSelf: (event) =>
                    self.send(new Increment({ by: event.by })).pipe(
                      Effect.andThen(self.send(new ReadCount({ reply: event.reply })))
                    ),
                  Increment: (event) => updateState((count) => Effect.succeed(count + event.by)),
                  ReadCount: (event) =>
                    state.pipe(
                      Effect.flatMap((count) => Deferred.succeed(event.reply, count))
                    )
                })
              )
            ),
            Effect.forever
          )
      ))

      yield* actor.send(new BumpSelf({ by: 2, reply }))

      assert.strictEqual(yield* Deferred.await(reply), 2)
      yield* actor.stop
    }))

  it.effect("spawns child actors from actor logic", () =>
    Effect.gen(function*() {
      const reply = yield* Deferred.make<number>()
      const actor = yield* Actor.start(Actor.fromEffect<number, SpawnCounter>(
        0,
        ({ receive, spawn }) =>
          receive.pipe(
            Effect.flatMap((event) =>
              Effect.gen(function*() {
                const child = yield* spawn(counterLogic)
                const childReply = yield* Deferred.make<number>()
                yield* child.send(new Increment({ by: event.by }))
                yield* child.send(new ReadCount({ reply: childReply }))
                const count = yield* Deferred.await(childReply)
                yield* Deferred.succeed(event.reply, count)
              })
            ),
            Effect.forever
          )
      ))

      yield* actor.send(new SpawnCounter({ by: 3, reply }))

      assert.strictEqual(yield* Deferred.await(reply), 3)
      yield* actor.stop
    }))

  it.effect("stops spawned children when the parent is stopped", () =>
    Effect.gen(function*() {
      const childRef = yield* Deferred.make<Actor.Actor<number, never, never, void>>()
      const actor = yield* Actor.start(Actor.fromEffect<number, never>(
        0,
        ({ spawn }) =>
          Effect.gen(function*() {
            const child = yield* spawn(Actor.fromEffect<number, never>(0, () => Effect.never))
            yield* Deferred.succeed(childRef, child)
            return yield* Effect.never
          })
      ))
      const child = yield* Deferred.await(childRef)

      yield* actor.stop

      assert.deepStrictEqual(yield* child.snapshot, {
        status: "stopped",
        state: 0
      })
      const error = yield* Effect.flip(child.join)
      assert.strictEqual(error._tag, "ActorStoppedError")
    }))

  it.effect("stops spawned children when the parent completes", () =>
    Effect.gen(function*() {
      const childRef = yield* Deferred.make<Actor.Actor<number, never, never, void>>()
      const actor = yield* Actor.start(Actor.fromEffect<number, never, string>(
        0,
        ({ spawn }) =>
          Effect.gen(function*() {
            const child = yield* spawn(Actor.fromEffect<number, never>(0, () => Effect.never))
            yield* Deferred.succeed(childRef, child)
            return "done"
          })
      ))
      const child = yield* Deferred.await(childRef)

      assert.strictEqual(yield* actor.join, "done")
      assert.deepStrictEqual(yield* child.snapshot, {
        status: "stopped",
        state: 0
      })
    }))

  it.effect("stops spawned children when the parent fails", () =>
    Effect.gen(function*() {
      const error = new LogicError({ message: "boom" })
      const childRef = yield* Deferred.make<Actor.Actor<number, never, never, void>>()
      const actor = yield* Actor.start(Actor.fromEffect<number, never, never, LogicError>(
        0,
        ({ spawn }) =>
          Effect.gen(function*() {
            const child = yield* spawn(Actor.fromEffect<number, never>(0, () => Effect.never))
            yield* Deferred.succeed(childRef, child)
            return yield* Effect.fail(error)
          })
      ))
      const child = yield* Deferred.await(childRef)

      assert.deepStrictEqual(yield* Effect.flip(actor.join), error)
      assert.deepStrictEqual(yield* child.snapshot, {
        status: "stopped",
        state: 0
      })
    }))

  it.effect("does not fail the parent when a spawned child fails", () =>
    Effect.gen(function*() {
      const error = new LogicError({ message: "boom" })
      const childRef = yield* Deferred.make<Actor.Actor<number, never, LogicError, never>>()
      const actor = yield* Actor.start(Actor.fromEffect<number, never>(
        0,
        ({ spawn }) =>
          Effect.gen(function*() {
            const child = yield* spawn(Actor.fromEffect<number, never, never, LogicError>(
              0,
              () => Effect.fail(error)
            ))
            yield* Deferred.succeed(childRef, child)
            return yield* Effect.never
          })
      ))
      const child = yield* Deferred.await(childRef)

      assert.deepStrictEqual(yield* Effect.flip(child.join), error)
      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "active",
        state: 0
      })

      yield* actor.stop
    }))

  it.effect("streams lifecycle changes over time", () =>
    Effect.gen(function*() {
      const actor = yield* Actor.start(counterLogic)
      const observed = yield* Queue.unbounded<Actor.Snapshot<number>>()
      const observedInitial = yield* Deferred.make<void>()
      const observer = yield* actor.changes.pipe(
        Stream.take(3),
        Stream.runForEach((snapshot) =>
          Queue.offer(observed, snapshot).pipe(
            Effect.andThen(
              snapshot.status === "active" && snapshot.state === 0
                ? Deferred.succeed(observedInitial, void 0)
                : Effect.void
            )
          )
        ),
        Effect.forkChild
      )

      yield* Deferred.await(observedInitial)
      yield* actor.send(new Increment({ by: 1 }))
      yield* actor.send(new Increment({ by: 1 }))

      const snapshots = [
        yield* Queue.take(observed),
        yield* Queue.take(observed),
        yield* Queue.take(observed)
      ]

      assert.deepStrictEqual(snapshots, [
        { status: "active", state: 0 },
        { status: "active", state: 1 },
        { status: "active", state: 2 }
      ])

      yield* Fiber.join(observer)
      yield* actor.stop
    }))

  it.effect("emits the terminal snapshot and completes changes when actor logic completes", () =>
    Effect.gen(function*() {
      const release = yield* Deferred.make<void>()
      const actor = yield* Actor.start(
        Actor.fromEffect<number, never, string>(
          0,
          ({ setState }) =>
            Deferred.await(release).pipe(
              Effect.andThen(setState(1)),
              Effect.as("done")
            )
        )
      )
      const observed = yield* Queue.unbounded<Actor.Snapshot<number, never, string>>()
      const observer = yield* actor.changes.pipe(
        Stream.runForEach((snapshot) => Queue.offer(observed, snapshot)),
        Effect.forkChild
      )

      const initial = yield* Queue.take(observed)
      yield* Deferred.succeed(release, void 0)
      const updated = yield* Queue.take(observed)
      const terminal = yield* Queue.take(observed)

      yield* Fiber.join(observer)

      assert.deepStrictEqual([initial, updated, terminal], [
        { status: "active", state: 0 },
        { status: "active", state: 1 },
        { status: "done", state: 1, output: "done" }
      ])
    }))

  it.effect("joins with the output when actor logic completes", () =>
    Effect.gen(function*() {
      const actor = yield* Actor.start(
        Actor.fromEffect(0, ({ setState }) => setState(1).pipe(Effect.as("done")))
      )

      assert.strictEqual(yield* actor.join, "done")
      assert.strictEqual(yield* actor.state, 1)
      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "done",
        state: 1,
        output: "done"
      })
    }))

  it.effect("preserves typed failures in join and error snapshots", () =>
    Effect.gen(function*() {
      const error = new LogicError({ message: "boom" })
      const actor = yield* Actor.start(Actor.fromEffect(0, () => Effect.fail(error)))

      assert.deepStrictEqual(yield* Effect.flip(actor.join), error)

      const snapshot = yield* actor.snapshot
      assert.strictEqual(snapshot.status, "error")
      if (snapshot.status === "error") {
        const reason = snapshot.cause.reasons[0]
        assert.strictEqual(Cause.isFailReason(reason), true)
        if (Cause.isFailReason(reason)) {
          assert.deepStrictEqual(reason.error, error)
        }
      }

      const snapshots = Array.from(yield* actor.changes.pipe(Stream.runCollect))
      assert.strictEqual(snapshots.length, 1)
      assert.strictEqual(snapshots[0].status, "error")
    }))

  it.effect("stops active actors and fails join with ActorStoppedError", () =>
    Effect.gen(function*() {
      const actor = yield* Actor.start(Actor.fromEffect(0, () => Effect.never))
      const observed = yield* Queue.unbounded<Actor.Snapshot<number>>()
      const observer = yield* actor.changes.pipe(
        Stream.runForEach((snapshot) => Queue.offer(observed, snapshot)),
        Effect.forkChild
      )

      assert.deepStrictEqual(yield* Queue.take(observed), {
        status: "active",
        state: 0
      })
      yield* actor.stop

      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "stopped",
        state: 0
      })
      assert.deepStrictEqual(yield* Queue.take(observed), {
        status: "stopped",
        state: 0
      })
      yield* Fiber.join(observer)

      assert.deepStrictEqual(Array.from(yield* actor.changes.pipe(Stream.runCollect)), [
        { status: "stopped", state: 0 }
      ])
      const error = yield* Effect.flip(actor.join)
      assert.strictEqual(error._tag, "ActorStoppedError")
    }))

  it.effect("ignores events sent after terminal states", () =>
    Effect.gen(function*() {
      const stopped = yield* Actor.start(Actor.fromEffect<number, Increment>(0, () => Effect.never))
      yield* stopped.stop
      yield* stopped.send(new Increment({ by: 1 }))
      assert.deepStrictEqual(yield* stopped.snapshot, {
        status: "stopped",
        state: 0
      })

      const done = yield* Actor.start(
        Actor.fromEffect<number, Increment, string>(0, () => Effect.succeed("done"))
      )
      yield* done.join
      yield* done.send(new Increment({ by: 1 }))
      assert.deepStrictEqual(yield* done.snapshot, {
        status: "done",
        state: 0,
        output: "done"
      })

      const error = new LogicError({ message: "boom" })
      const failed = yield* Actor.start(
        Actor.fromEffect<number, Increment, never, LogicError>(0, () => Effect.fail(error))
      )
      yield* Effect.flip(failed.join)
      yield* failed.send(new Increment({ by: 1 }))
      const snapshot = yield* failed.snapshot
      assert.strictEqual(snapshot.status, "error")
      if (snapshot.status === "error") {
        const reason = snapshot.cause.reasons[0]
        assert.strictEqual(Cause.isFailReason(reason), true)
        if (Cause.isFailReason(reason)) {
          assert.deepStrictEqual(reason.error, error)
        }
      }
    }))
})
