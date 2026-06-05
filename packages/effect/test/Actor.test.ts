import { assert, describe, it } from "@effect/vitest"
import { Actor, Data, Deferred, Effect, Fiber, Match } from "effect"

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
  ({ receive, setSnapshot, snapshot, updateSnapshot }) =>
    receive.pipe(
      Effect.flatMap(
        Match.type<EffectCounterEvent>().pipe(
          Match.tagsExhaustive({
            Increment: (event) => updateSnapshot((count) => Effect.succeed(count + event.by)),
            SetCount: (event) => setSnapshot(event.value),
            ReadCount: (event) =>
              snapshot.pipe(
                Effect.flatMap((count) => Deferred.succeed(event.reply, count))
              ),
            ConcurrentIncrement: (event) =>
              Effect.gen(function*() {
                const first = yield* updateSnapshot((count) =>
                  Deferred.succeed(event.processing, void 0).pipe(
                    Effect.andThen(Deferred.await(event.release)),
                    Effect.as(count + 1)
                  )
                ).pipe(Effect.forkChild)
                yield* Deferred.await(event.processing)
                const second = yield* updateSnapshot((count) => Effect.succeed(count + 1)).pipe(Effect.forkChild)
                yield* Deferred.succeed(event.secondStarted, void 0)
                yield* Fiber.join(first)
                yield* Fiber.join(second)
                const count = yield* snapshot
                yield* Deferred.succeed(event.reply, count)
              })
          })
        )
      ),
      Effect.forever
    )
)

describe("Actor", () => {
  it.effect("updates the snapshot from sent events", () =>
    Effect.gen(function*() {
      const reply = yield* Deferred.make<number>()
      const actor = yield* Actor.start(counterLogic)

      yield* actor.send(new Increment({ by: 1 }))
      yield* actor.send(new ReadCount({ reply }))

      assert.strictEqual(yield* Deferred.await(reply), 1)
      assert.strictEqual(yield* actor.snapshot, 1)

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
      assert.strictEqual(yield* actor.snapshot, 0)

      yield* actor.send(new ReadCount({ reply }))
      yield* Deferred.succeed(release, void 0)

      assert.strictEqual(yield* Deferred.await(reply), 1)
      assert.strictEqual(yield* actor.snapshot, 1)

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
      assert.strictEqual(yield* actor.snapshot, 11)

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
      assert.strictEqual(yield* actor.snapshot, 0)

      yield* Deferred.succeed(release, void 0)

      assert.strictEqual(yield* Deferred.await(reply), 2)
      assert.strictEqual(yield* actor.snapshot, 2)

      yield* actor.stop
    }))
})
