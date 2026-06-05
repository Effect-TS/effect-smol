import { assert, describe, it } from "@effect/vitest"
import { Actor, Data, Deferred, Effect, Match } from "effect"

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

type CounterEvent = Increment | BlockedIncrement | ReadCount

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
})
