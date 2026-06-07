import { assert, describe, it } from "@effect/vitest"
import { Cause, Data, Deferred, Effect, Fiber, HashMap, Match, Option, Queue, Ref, Schedule, Stream } from "effect"
import { TestClock } from "effect/testing"
import { Actor, ActorSystem } from "effect/unstable/actors"

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
  it("child creates string ids at runtime", () => {
    const Counter = Actor.child<CounterEvent>("counter")

    assert.strictEqual(Counter, "counter")
    assert.strictEqual(typeof Counter, "string")
  })

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

  it.effect("runs actor logic from make", () =>
    Effect.gen(function*() {
      type MakeEvent =
        | {
          readonly _tag: "Add"
          readonly by: number
        }
        | {
          readonly _tag: "Get"
          readonly reply: Deferred.Deferred<number>
        }

      const initialized = yield* Deferred.make<string>()
      const reply = yield* Deferred.make<number>()
      const logic = Actor.make({
        initial: ({ self }: Actor.ActorScope<MakeEvent>) => Deferred.succeed(initialized, self.id).pipe(Effect.as(1)),
        run: ({ receive, state, updateState }) =>
          receive.pipe(
            Effect.flatMap((event) => {
              switch (event._tag) {
                case "Add": {
                  return updateState((count) => Effect.succeed(count + event.by))
                }
                case "Get": {
                  return state.pipe(Effect.flatMap((count) => Deferred.succeed(event.reply, count)))
                }
              }
            }),
            Effect.forever
          )
      })
      const actor = yield* Actor.start(logic, { id: "made-counter" })

      yield* actor.send({ _tag: "Add", by: 2 })
      yield* actor.send({ _tag: "Get", reply })

      assert.strictEqual(yield* Deferred.await(initialized), "made-counter")
      assert.strictEqual(yield* Deferred.await(reply), 3)
      assert.strictEqual(yield* actor.state, 3)

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

  it.effect("exposes explicit and generated root actor identities", () =>
    Effect.gen(function*() {
      const explicit = yield* Actor.start(counterLogic, { id: "root" })
      const generated = yield* Actor.start(counterLogic)

      assert.strictEqual(explicit.id, "root")
      assert.notStrictEqual(explicit.sessionId, "")
      assert.notStrictEqual(explicit.id, explicit.sessionId)
      assert.strictEqual(generated.id, generated.sessionId)

      yield* explicit.stop
      yield* generated.stop
    }))

  it.effect("registers root actors by system id", () =>
    Effect.gen(function*() {
      const actor = yield* Actor.start(counterLogic, { id: "root", systemId: "root-system" })

      assert.strictEqual(actor.systemId, "root-system")
      const registered = yield* actor.system.get<CounterEvent>("root-system")
      assert.strictEqual(Option.isSome(registered), true)
      if (Option.isSome(registered)) {
        assert.strictEqual(registered.value.sessionId, actor.sessionId)
      }
      assert.strictEqual(HashMap.size(yield* actor.system.getAll), 1)

      yield* actor.stop

      assert.strictEqual(Option.isNone(yield* actor.system.get("root-system")), true)
    }))

  it.effect("registers spawned actors in the shared actor system", () =>
    Effect.gen(function*() {
      const reply = yield* Deferred.make<number>()
      const actor = yield* Actor.start(
        Actor.fromEffect<
          number,
          never,
          never,
          Actor.ActorChildAlreadyExistsError | Actor.ActorSystemIdAlreadyExistsError
        >(
          0,
          ({ spawn, system }) =>
            Effect.gen(function*() {
              yield* spawn(counterLogic, { id: "counter", systemId: "counter-system" })
              yield* system.send("counter-system", new Increment({ by: 6 }))
              yield* system.send("counter-system", new ReadCount({ reply }))
              return yield* Effect.never
            })
        )
      )

      assert.strictEqual(yield* Deferred.await(reply), 6)
      assert.strictEqual(Option.isSome(yield* actor.system.get("counter-system")), true)

      yield* actor.stop

      assert.strictEqual(Option.isNone(yield* actor.system.get("counter-system")), true)
    }))

  it.effect("fails when spawning a duplicate system id", () =>
    Effect.gen(function*() {
      const errorRef = yield* Deferred.make<Actor.ActorSystemIdAlreadyExistsError>()
      const started = yield* Queue.unbounded<void>()
      const childLogic = Actor.fromEffect<number, never>(
        0,
        () => Queue.offer(started, void 0).pipe(Effect.andThen(Effect.never))
      )
      const actor = yield* Actor.start(Actor.fromEffect<number, never, never, Actor.ActorSystemIdAlreadyExistsError>(
        0,
        ({ spawn }) =>
          Effect.gen(function*() {
            yield* spawn(childLogic, { systemId: "worker" })
            yield* spawn(childLogic, { systemId: "worker" }).pipe(
              Effect.catchTag("ActorSystemIdAlreadyExistsError", (error) => Deferred.succeed(errorRef, error))
            )
            return yield* Effect.never
          })
      ))

      assert.deepStrictEqual(yield* Queue.take(started), void 0)
      const error = yield* Deferred.await(errorRef)
      assert.strictEqual(error._tag, "ActorSystemIdAlreadyExistsError")
      assert.strictEqual(error.systemId, "worker")
      yield* Effect.yieldNow
      assert.strictEqual(yield* Queue.size(started), 0)

      yield* actor.stop
    }))

  it.effect("spawns system-owned actors and reuses released system ids", () =>
    Effect.gen(function*() {
      const firstRef = yield* Deferred.make<Actor.Actor<number, CounterEvent>>()
      const secondRef = yield* Deferred.make<Actor.Actor<number, CounterEvent>>()
      const actor = yield* Actor.start(Actor.fromEffect<number, never, never, Actor.ActorSystemIdAlreadyExistsError>(
        0,
        ({ system }) =>
          Effect.gen(function*() {
            const first = yield* system.spawn(counterLogic, { systemId: "worker" })
            yield* Deferred.succeed(firstRef, first)
            yield* system.stop("worker")
            const second = yield* system.spawn(counterLogic, { systemId: "worker" })
            yield* Deferred.succeed(secondRef, second)
            return yield* Effect.never
          })
      ))

      const first = yield* Deferred.await(firstRef)
      const second = yield* Deferred.await(secondRef)
      const registered = yield* actor.system.get<CounterEvent>("worker")

      assert.notStrictEqual(first, second)
      assert.deepStrictEqual(yield* first.snapshot, {
        status: "stopped",
        state: 0
      })
      assert.strictEqual(Option.isSome(registered), true)
      if (Option.isSome(registered)) {
        assert.strictEqual(registered.value.sessionId, second.sessionId)
      }

      yield* actor.stop

      assert.deepStrictEqual(yield* second.snapshot, {
        status: "stopped",
        state: 0
      })
      assert.strictEqual(Option.isNone(yield* actor.system.get("worker")), true)
    }))

  it.effect("cleans spawned children when initial fails", () =>
    Effect.scoped(Effect.gen(function*() {
      const system = yield* ActorSystem.make
      const error = new LogicError({ message: "boom" })
      const childRef = yield* Deferred.make<Actor.Actor<number, never, never, void>>()
      const childLogic = Actor.fromEffect<number, never>(0, () => Effect.never)
      const parentLogic = Actor.make({
        initial: ({ spawn }: Actor.ActorScope<never>) =>
          Effect.gen(function*() {
            const child = yield* spawn(childLogic, { id: "child", systemId: "startup-child" })
            yield* Deferred.succeed(childRef, child)
            return yield* Effect.fail(error)
          }),
        run: () => Effect.never
      })

      const startError = yield* Effect.flip(system.spawn(parentLogic, { systemId: "startup-parent" }))
      const child = yield* Deferred.await(childRef)

      assert.deepStrictEqual(startError, error)
      assert.deepStrictEqual(yield* child.snapshot, {
        status: "stopped",
        state: 0
      })
      assert.strictEqual(Option.isNone(yield* system.get("startup-child")), true)
      assert.strictEqual(Option.isNone(yield* system.get("startup-parent")), true)

      const replacement = yield* system.spawn(childLogic, { systemId: "startup-child" })
      yield* replacement.stop
    })))

  it.effect("provides root actor identity and no parent to actor logic", () =>
    Effect.gen(function*() {
      const observed = yield* Deferred.make<{
        readonly id: string
        readonly sessionId: string
        readonly hasParent: boolean
      }>()
      const actor = yield* Actor.start(
        Actor.fromEffect<number, never, string>(
          0,
          ({ parent, self }) =>
            Deferred.succeed(observed, {
              id: self.id,
              sessionId: self.sessionId,
              hasParent: parent !== undefined
            }).pipe(Effect.as("done"))
        ),
        { id: "root" }
      )

      assert.deepStrictEqual(yield* Deferred.await(observed), {
        id: "root",
        sessionId: actor.sessionId,
        hasParent: false
      })
      assert.strictEqual(yield* actor.join, "done")
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

  it.effect("provides parent identity to named child actor logic", () =>
    Effect.gen(function*() {
      const childRef = yield* Deferred.make<Actor.Actor<number, never, never, void>>()
      const observed = yield* Deferred.make<{
        readonly childId: string
        readonly childSessionId: string
        readonly parentId: string | undefined
        readonly parentSessionId: string | undefined
      }>()
      const actor = yield* Actor.start(
        Actor.fromEffect<number, never, never, Actor.ActorChildAlreadyExistsError>(
          0,
          ({ spawn }) =>
            Effect.gen(function*() {
              const child = yield* spawn(
                Actor.fromEffect<number, never>(
                  0,
                  ({ parent, self }) =>
                    Deferred.succeed(observed, {
                      childId: self.id,
                      childSessionId: self.sessionId,
                      parentId: parent?.id,
                      parentSessionId: parent?.sessionId
                    }).pipe(Effect.andThen(Effect.never))
                ),
                { id: "child" }
              )
              yield* Deferred.succeed(childRef, child)
              return yield* Effect.never
            })
        ),
        { id: "parent" }
      )

      const child = yield* Deferred.await(childRef)
      assert.deepStrictEqual(yield* Deferred.await(observed), {
        childId: "child",
        childSessionId: child.sessionId,
        parentId: "parent",
        parentSessionId: actor.sessionId
      })
      assert.strictEqual(child.id, "child")
      assert.notStrictEqual(child.sessionId, actor.sessionId)

      yield* actor.stop
    }))

  it.effect("generates ids for anonymous spawned actors", () =>
    Effect.gen(function*() {
      const childRef = yield* Deferred.make<Actor.Actor<number, never, never, void>>()
      const observed = yield* Deferred.make<{
        readonly id: string
        readonly sessionId: string
        readonly parentId: string | undefined
      }>()
      const actor = yield* Actor.start(
        Actor.fromEffect<number, never>(
          0,
          ({ spawn }) =>
            Effect.gen(function*() {
              const child = yield* spawn(Actor.fromEffect<number, never>(
                0,
                ({ parent, self }) =>
                  Deferred.succeed(observed, {
                    id: self.id,
                    sessionId: self.sessionId,
                    parentId: parent?.id
                  }).pipe(Effect.andThen(Effect.never))
              ))
              yield* Deferred.succeed(childRef, child)
              return yield* Effect.never
            })
        ),
        { id: "parent" }
      )

      const child = yield* Deferred.await(childRef)
      assert.strictEqual(child.id, child.sessionId)
      assert.deepStrictEqual(yield* Deferred.await(observed), {
        id: child.id,
        sessionId: child.sessionId,
        parentId: "parent"
      })

      yield* actor.stop
    }))

  it.effect("allows child logic to send events to the parent reference", () =>
    Effect.gen(function*() {
      type ParentEvent = Increment | ReadCount
      const reply = yield* Deferred.make<number>()
      const actor = yield* Actor.start(
        Actor.fromEffect<number, ParentEvent, never, Actor.ActorChildAlreadyExistsError>(
          0,
          ({ receive, spawn, state, updateState }) =>
            Effect.gen(function*() {
              yield* spawn(
                Actor.fromEffect<number, never>(
                  0,
                  ({ parent }) =>
                    parent === undefined
                      ? Effect.void
                      : parent.send(new Increment({ by: 2 })).pipe(
                        Effect.andThen(parent.send(new ReadCount({ reply })))
                      )
                ),
                { id: "child" }
              )
              return yield* receive.pipe(
                Effect.flatMap(
                  Match.type<ParentEvent>().pipe(
                    Match.tagsExhaustive({
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
            })
        ),
        { id: "parent" }
      )

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

  it.effect("spawns child actors with parent-local ids", () =>
    Effect.gen(function*() {
      const reply = yield* Deferred.make<number>()
      const actor = yield* Actor.start(
        Actor.fromEffect<number, SpawnCounter, never, Actor.ActorChildAlreadyExistsError>(
          0,
          ({ receive, spawn }) =>
            receive.pipe(
              Effect.flatMap((event) =>
                Effect.gen(function*() {
                  const child = yield* spawn(counterLogic, { id: "counter" })
                  const childReply = yield* Deferred.make<number>()
                  yield* child.send(new Increment({ by: event.by }))
                  yield* child.send(new ReadCount({ reply: childReply }))
                  const count = yield* Deferred.await(childReply)
                  yield* Deferred.succeed(event.reply, count)
                })
              ),
              Effect.forever
            )
        )
      )

      yield* actor.send(new SpawnCounter({ by: 4, reply }))

      assert.strictEqual(yield* Deferred.await(reply), 4)
      yield* actor.stop
    }))

  it.effect("sends events to named child actors by id", () =>
    Effect.gen(function*() {
      const reply = yield* Deferred.make<number>()
      const actor = yield* Actor.start(Actor.fromEffect<number, never, never, Actor.ActorChildAlreadyExistsError>(
        0,
        ({ sendTo, spawn }) =>
          Effect.gen(function*() {
            yield* spawn(counterLogic, { id: "counter" })
            yield* sendTo("counter", new Increment({ by: 5 }))
            yield* sendTo("counter", new ReadCount({ reply }))
            return yield* Effect.never
          })
      ))

      assert.strictEqual(yield* Deferred.await(reply), 5)
      yield* actor.stop
    }))

  it.effect("sends events to named child actors by typed child address", () =>
    Effect.gen(function*() {
      const Counter = Actor.child<CounterEvent>("counter")
      const reply = yield* Deferred.make<number>()
      const actor = yield* Actor.start(Actor.fromEffect<number, never, never, Actor.ActorChildAlreadyExistsError>(
        0,
        ({ sendTo, spawn }) =>
          Effect.gen(function*() {
            yield* spawn(counterLogic, { id: Counter })
            yield* sendTo(Counter, new Increment({ by: 5 }))
            yield* sendTo(Counter, new ReadCount({ reply }))
            return yield* Effect.never
          })
      ))

      assert.strictEqual(yield* Deferred.await(reply), 5)
      yield* actor.stop
    }))

  it.effect("ignores unknown child ids when sending by id", () =>
    Effect.gen(function*() {
      const actor = yield* Actor.start(Actor.fromEffect<number, never>(
        0,
        ({ sendTo }) => sendTo("missing", new Increment({ by: 1 }))
      ))

      assert.strictEqual(yield* actor.join, void 0)
      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "done",
        state: 0,
        output: undefined
      })
    }))

  it.effect("does not send to a stopped child id", () =>
    Effect.gen(function*() {
      const childRef = yield* Deferred.make<Actor.Actor<number, CounterEvent>>()
      const actor = yield* Actor.start(Actor.fromEffect<number, never, void, Actor.ActorChildAlreadyExistsError>(
        0,
        ({ sendTo, spawn, stopChild }) =>
          Effect.gen(function*() {
            const child = yield* spawn(counterLogic, { id: "counter" })
            yield* Deferred.succeed(childRef, child)
            yield* stopChild("counter")
            yield* sendTo("counter", new Increment({ by: 1 }))
          })
      ))

      const child = yield* Deferred.await(childRef)
      yield* actor.join

      assert.deepStrictEqual(yield* child.snapshot, {
        status: "stopped",
        state: 0
      })
    }))

  it.effect("fails when spawning a duplicate child id", () =>
    Effect.gen(function*() {
      const errorRef = yield* Deferred.make<Actor.ActorChildAlreadyExistsError>()
      const started = yield* Queue.unbounded<void>()
      const childLogic = Actor.fromEffect<number, never>(
        0,
        () => Queue.offer(started, void 0).pipe(Effect.andThen(Effect.never))
      )
      const actor = yield* Actor.start(Actor.fromEffect<number, never, never, Actor.ActorChildAlreadyExistsError>(
        0,
        ({ spawn }) =>
          Effect.gen(function*() {
            yield* spawn(childLogic, { id: "worker" })
            yield* spawn(childLogic, { id: "worker" }).pipe(
              Effect.catchTag("ActorChildAlreadyExistsError", (error) => Deferred.succeed(errorRef, error))
            )
            return yield* Effect.never
          })
      ))

      assert.deepStrictEqual(yield* Queue.take(started), void 0)
      const error = yield* Deferred.await(errorRef)
      assert.strictEqual(error._tag, "ActorChildAlreadyExistsError")
      assert.strictEqual(error.id, "worker")
      yield* Effect.yieldNow
      assert.strictEqual(yield* Queue.size(started), 0)

      yield* actor.stop
    }))

  it.effect("allows the same child id under different parents", () =>
    Effect.gen(function*() {
      const firstChildRef = yield* Deferred.make<Actor.Actor<number, CounterEvent>>()
      const secondChildRef = yield* Deferred.make<Actor.Actor<number, CounterEvent>>()
      const makeParent = (childRef: Deferred.Deferred<Actor.Actor<number, CounterEvent>>) =>
        Actor.fromEffect<number, never, never, Actor.ActorChildAlreadyExistsError>(
          0,
          ({ spawn }) =>
            Effect.gen(function*() {
              const child = yield* spawn(counterLogic, { id: "counter" })
              yield* Deferred.succeed(childRef, child)
              return yield* Effect.never
            })
        )
      const firstParent = yield* Actor.start(makeParent(firstChildRef))
      const secondParent = yield* Actor.start(makeParent(secondChildRef))

      const firstChild = yield* Deferred.await(firstChildRef)
      const secondChild = yield* Deferred.await(secondChildRef)
      assert.notStrictEqual(firstChild, secondChild)

      yield* firstParent.stop
      yield* secondParent.stop
    }))

  it.effect("releases a child id when the child is stopped", () =>
    Effect.gen(function*() {
      const firstChildRef = yield* Deferred.make<Actor.Actor<number, CounterEvent>>()
      const secondChildRef = yield* Deferred.make<Actor.Actor<number, CounterEvent>>()
      const actor = yield* Actor.start(Actor.fromEffect<number, never, never, Actor.ActorChildAlreadyExistsError>(
        0,
        ({ spawn }) =>
          Effect.gen(function*() {
            const firstChild = yield* spawn(counterLogic, { id: "counter" })
            yield* Deferred.succeed(firstChildRef, firstChild)
            yield* firstChild.stop
            const secondChild = yield* spawn(counterLogic, { id: "counter" })
            yield* Deferred.succeed(secondChildRef, secondChild)
            return yield* Effect.never
          })
      ))

      const firstChild = yield* Deferred.await(firstChildRef)
      const secondChild = yield* Deferred.await(secondChildRef)

      assert.notStrictEqual(firstChild, secondChild)
      assert.strictEqual(firstChild.id, "counter")
      assert.strictEqual(secondChild.id, "counter")
      assert.notStrictEqual(firstChild.sessionId, secondChild.sessionId)
      assert.deepStrictEqual(yield* firstChild.snapshot, {
        status: "stopped",
        state: 0
      })

      yield* actor.stop
    }))

  it.effect("stops a named child by id", () =>
    Effect.gen(function*() {
      const childRef = yield* Deferred.make<Actor.Actor<number, never, never, void>>()
      const stopped = yield* Deferred.make<void>()
      const actor = yield* Actor.start(Actor.fromEffect<number, never, never, Actor.ActorChildAlreadyExistsError>(
        0,
        ({ spawn, stopChild }) =>
          Effect.gen(function*() {
            const child = yield* spawn(Actor.fromEffect<number, never>(0, () => Effect.never), { id: "child" })
            yield* Deferred.succeed(childRef, child)
            yield* stopChild("child")
            yield* Deferred.succeed(stopped, void 0)
            return yield* Effect.never
          })
      ))
      const child = yield* Deferred.await(childRef)
      yield* Deferred.await(stopped)

      assert.deepStrictEqual(yield* child.snapshot, {
        status: "stopped",
        state: 0
      })
      const error = yield* Effect.flip(child.join)
      assert.strictEqual(error._tag, "ActorStoppedError")

      yield* actor.stop
    }))

  it.effect("releases a child id when stopped by id", () =>
    Effect.gen(function*() {
      const firstChildRef = yield* Deferred.make<Actor.Actor<number, CounterEvent>>()
      const secondChildRef = yield* Deferred.make<Actor.Actor<number, CounterEvent>>()
      const actor = yield* Actor.start(Actor.fromEffect<number, never, never, Actor.ActorChildAlreadyExistsError>(
        0,
        ({ spawn, stopChild }) =>
          Effect.gen(function*() {
            const firstChild = yield* spawn(counterLogic, { id: "counter" })
            yield* Deferred.succeed(firstChildRef, firstChild)
            yield* stopChild("counter")
            const secondChild = yield* spawn(counterLogic, { id: "counter" })
            yield* Deferred.succeed(secondChildRef, secondChild)
            return yield* Effect.never
          })
      ))

      const firstChild = yield* Deferred.await(firstChildRef)
      const secondChild = yield* Deferred.await(secondChildRef)

      assert.notStrictEqual(firstChild, secondChild)
      assert.strictEqual(firstChild.id, "counter")
      assert.strictEqual(secondChild.id, "counter")
      assert.notStrictEqual(firstChild.sessionId, secondChild.sessionId)
      assert.deepStrictEqual(yield* firstChild.snapshot, {
        status: "stopped",
        state: 0
      })
      assert.deepStrictEqual(yield* secondChild.snapshot, {
        status: "active",
        state: 0
      })

      yield* actor.stop
    }))

  it.effect("ignores unknown child ids when stopping by id", () =>
    Effect.gen(function*() {
      const actor = yield* Actor.start(Actor.fromEffect<number, never>(
        0,
        ({ stopChild }) => stopChild("missing")
      ))

      assert.strictEqual(yield* actor.join, void 0)
      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "done",
        state: 0,
        output: undefined
      })
    }))

  it.effect("stops named children when the parent is stopped", () =>
    Effect.gen(function*() {
      const childRef = yield* Deferred.make<Actor.Actor<number, never, never, void>>()
      const actor = yield* Actor.start(Actor.fromEffect<number, never, never, Actor.ActorChildAlreadyExistsError>(
        0,
        ({ spawn }) =>
          Effect.gen(function*() {
            const child = yield* spawn(Actor.fromEffect<number, never>(0, () => Effect.never), { id: "child" })
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

  it.effect("stops the parent when a child fails with stopOwner supervision", () =>
    Effect.gen(function*() {
      const error = new LogicError({ message: "boom" })
      const actor = yield* Actor.start(Actor.fromEffect<number, never, never, Actor.ActorChildAlreadyExistsError>(
        0,
        ({ spawn }) =>
          Effect.gen(function*() {
            yield* spawn(
              Actor.fromEffect<number, never, never, LogicError>(
                0,
                () => Effect.fail(error)
              ),
              {
                id: "child",
                supervision: Actor.Supervision.stopOwner
              }
            )
            return yield* Effect.never
          })
      ))

      const stopped = yield* Effect.flip(actor.join)

      assert.strictEqual(stopped._tag, "ActorStoppedError")
      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "stopped",
        state: 0
      })
    }))

  it.effect("restarts a failed child from its initial state", () =>
    Effect.gen(function*() {
      const error = new LogicError({ message: "boom" })
      const observedStates = yield* Queue.unbounded<number>()
      const childRef = yield* Deferred.make<Actor.Actor<number, never, LogicError, never>>()
      let runs = 0
      const childLogic = Actor.fromEffect<number, never, never, LogicError>(
        0,
        ({ setState, state }) =>
          Effect.gen(function*() {
            const run = yield* Effect.sync(() => runs++)
            const current = yield* state
            yield* Queue.offer(observedStates, current)
            if (run === 0) {
              yield* setState(1)
              return yield* Effect.fail(error)
            }
            return yield* Effect.never
          })
      )
      const actor = yield* Actor.start(Actor.fromEffect<number, never, never, Actor.ActorChildAlreadyExistsError>(
        0,
        ({ spawn }) =>
          Effect.gen(function*() {
            const child = yield* spawn(childLogic, {
              id: "child",
              supervision: Actor.Supervision.restart(Schedule.recurs(1))
            })
            yield* Deferred.succeed(childRef, child)
            return yield* Effect.never
          })
      ))
      const child = yield* Deferred.await(childRef)

      assert.strictEqual(yield* Queue.take(observedStates), 0)
      assert.strictEqual(yield* Queue.take(observedStates), 0)
      assert.deepStrictEqual(yield* child.snapshot, {
        status: "active",
        state: 0
      })

      yield* actor.stop
    }))

  it.effect("restarts with a fresh child scope before running initial", () =>
    Effect.gen(function*() {
      const error = new LogicError({ message: "boom" })
      const runs = yield* Ref.make(0)
      const workerStarts = yield* Ref.make(0)
      const workerInterrupts = yield* Ref.make(0)
      const firstWorkerInterrupted = yield* Deferred.make<void>()
      const secondInitialStarted = yield* Deferred.make<void>()
      const secondWorkerStarted = yield* Deferred.make<void>()
      const workerLogic = Actor.make({
        initial: (_: Actor.ActorScope<never>) =>
          Ref.updateAndGet(workerStarts, (count) => count + 1).pipe(
            Effect.flatMap((count) => count === 2 ? Deferred.succeed(secondWorkerStarted, void 0) : Effect.void),
            Effect.as(0)
          ),
        run: () =>
          Effect.never.pipe(
            Effect.onInterrupt(() =>
              Ref.updateAndGet(workerInterrupts, (count) => count + 1).pipe(
                Effect.flatMap((count) => count === 1 ? Deferred.succeed(firstWorkerInterrupted, void 0) : Effect.void)
              )
            )
          )
      })
      const childLogic = Actor.make({
        initial: ({ spawn }: Actor.ActorScope<never>) =>
          Effect.gen(function*() {
            const run = yield* Ref.updateAndGet(runs, (count) => count + 1)
            if (run === 2) {
              yield* Deferred.await(firstWorkerInterrupted)
              yield* Deferred.succeed(secondInitialStarted, void 0)
            }
            yield* spawn(workerLogic, { id: "worker" })
            return 0
          }),
        run: () =>
          Effect.gen(function*() {
            const run = yield* Ref.get(runs)
            if (run === 1) {
              return yield* Effect.fail(error)
            }
            return yield* Effect.never
          })
      })
      const actor = yield* Actor.start(Actor.fromEffect<number, never, never, Actor.ActorChildAlreadyExistsError>(
        0,
        ({ spawn }) =>
          Effect.gen(function*() {
            yield* spawn(childLogic, {
              id: "child",
              supervision: Actor.Supervision.restart(Schedule.recurs(1))
            })
            return yield* Effect.never
          })
      ))

      yield* Deferred.await(secondInitialStarted)
      yield* Deferred.await(secondWorkerStarted)
      yield* Effect.yieldNow

      assert.strictEqual(yield* Ref.get(runs), 2)
      assert.strictEqual(yield* Ref.get(workerStarts), 2)
      assert.strictEqual(yield* Ref.get(workerInterrupts), 1)

      yield* actor.stop
    }))

  it.effect("stops supervised actors during restart backoff without restarting", () =>
    Effect.gen(function*() {
      const error = new LogicError({ message: "boom" })
      const failFirstRun = yield* Deferred.make<void>()
      const runs = yield* Ref.make(0)
      const started = yield* Queue.unbounded<number>()
      const childRef = yield* Deferred.make<Actor.Actor<number, never, LogicError, never>>()
      const childLogic = Actor.fromEffect<number, never, never, LogicError>(
        0,
        () =>
          Effect.gen(function*() {
            const run = yield* Ref.updateAndGet(runs, (count) => count + 1)
            yield* Queue.offer(started, run)
            yield* Deferred.await(failFirstRun)
            return yield* Effect.fail(error)
          })
      )
      const actor = yield* Actor.start(Actor.fromEffect<number, never, never, Actor.ActorChildAlreadyExistsError>(
        0,
        ({ spawn }) =>
          Effect.gen(function*() {
            const child = yield* spawn(childLogic, {
              id: "child",
              supervision: Actor.Supervision.restart(
                Schedule.recurs(1).pipe(Schedule.addDelay(() => Effect.succeed("1 minute")))
              )
            })
            yield* Deferred.succeed(childRef, child)
            return yield* Effect.never
          })
      ))
      const child = yield* Deferred.await(childRef)

      assert.strictEqual(yield* Queue.take(started), 1)
      yield* Deferred.succeed(failFirstRun, void 0)
      yield* Effect.yieldNow
      yield* child.stop
      yield* TestClock.adjust("1 minute")
      yield* Effect.yieldNow

      assert.strictEqual(yield* Ref.get(runs), 1)
      assert.strictEqual(yield* Queue.size(started), 0)
      assert.deepStrictEqual(yield* child.snapshot, {
        status: "stopped",
        state: 0
      })

      yield* actor.stop
    }))

  it.effect("leaves a restarted child in error state when the restart schedule is exhausted", () =>
    Effect.gen(function*() {
      const error = new LogicError({ message: "boom" })
      const runsQueue = yield* Queue.unbounded<number>()
      const childRef = yield* Deferred.make<Actor.Actor<number, never, LogicError, never>>()
      let runs = 0
      const childLogic = Actor.fromEffect<number, never, never, LogicError>(
        0,
        () =>
          Effect.gen(function*() {
            const run = yield* Effect.sync(() => runs++)
            yield* Queue.offer(runsQueue, run)
            return yield* Effect.fail(error)
          })
      )
      const actor = yield* Actor.start(Actor.fromEffect<number, never, never, Actor.ActorChildAlreadyExistsError>(
        0,
        ({ spawn }) =>
          Effect.gen(function*() {
            const child = yield* spawn(childLogic, {
              id: "child",
              supervision: Actor.Supervision.restart(Schedule.recurs(1))
            })
            yield* Deferred.succeed(childRef, child)
            return yield* Effect.never
          })
      ))
      const child = yield* Deferred.await(childRef)

      assert.strictEqual(yield* Queue.take(runsQueue), 0)
      assert.strictEqual(yield* Queue.take(runsQueue), 1)
      assert.deepStrictEqual(yield* Effect.flip(child.join), error)
      const snapshot = yield* child.snapshot
      assert.strictEqual(snapshot.status, "error")

      yield* actor.stop
    }))

  it.effect("does not restart a supervised child when it is explicitly stopped", () =>
    Effect.gen(function*() {
      const started = yield* Queue.unbounded<void>()
      const childRef = yield* Deferred.make<Actor.Actor<number, never, never, void>>()
      const stopped = yield* Deferred.make<void>()
      const childLogic = Actor.fromEffect<number, never>(
        0,
        () => Queue.offer(started, void 0).pipe(Effect.andThen(Effect.never))
      )
      const actor = yield* Actor.start(Actor.fromEffect<number, never, never, Actor.ActorChildAlreadyExistsError>(
        0,
        ({ spawn, stopChild }) =>
          Effect.gen(function*() {
            const child = yield* spawn(childLogic, {
              id: "child",
              supervision: Actor.Supervision.restart(Schedule.recurs(1))
            })
            yield* Deferred.succeed(childRef, child)
            yield* Queue.take(started)
            yield* stopChild("child")
            yield* Deferred.succeed(stopped, void 0)
            return yield* Effect.never
          })
      ))
      const child = yield* Deferred.await(childRef)
      yield* Deferred.await(stopped)
      yield* Effect.yieldNow

      assert.deepStrictEqual(yield* child.snapshot, {
        status: "stopped",
        state: 0
      })
      assert.strictEqual(yield* Queue.size(started), 0)

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

  it.effect("publishes terminal snapshots after child and registry cleanup", () =>
    Effect.gen(function*() {
      const releaseParent = yield* Deferred.make<void>()
      const childStarted = yield* Deferred.make<void>()
      const childStopping = yield* Deferred.make<void>()
      const releaseChildStop = yield* Deferred.make<void>()
      const childRef = yield* Deferred.make<Actor.Actor<number, never, never, void>>()
      const joinDone = yield* Ref.make(false)
      const terminalObserved = yield* Deferred.make<{
        readonly childSnapshot: Actor.Snapshot<number, never, void>
        readonly childRegistered: boolean
        readonly parentRegistered: boolean
        readonly snapshot: Actor.Snapshot<
          number,
          Actor.ActorChildAlreadyExistsError | Actor.ActorSystemIdAlreadyExistsError,
          string
        >
      }>()
      const childLogic = Actor.fromEffect<number, never>(
        0,
        () =>
          Deferred.succeed(childStarted, void 0).pipe(
            Effect.andThen(Effect.never),
            Effect.onInterrupt(() =>
              Deferred.succeed(childStopping, void 0).pipe(
                Effect.andThen(Deferred.await(releaseChildStop))
              )
            )
          )
      )
      const actor = yield* Actor.start(
        Actor.fromEffect<
          number,
          never,
          string,
          Actor.ActorChildAlreadyExistsError | Actor.ActorSystemIdAlreadyExistsError
        >(
          0,
          ({ spawn }) =>
            Effect.gen(function*() {
              const child = yield* spawn(childLogic, { id: "child", systemId: "child-system" })
              yield* Deferred.succeed(childRef, child)
              yield* Deferred.await(releaseParent)
              return "done"
            })
        ),
        { systemId: "parent-system" }
      )
      const child = yield* Deferred.await(childRef)
      yield* Deferred.await(childStarted)
      const observer = yield* actor.changes.pipe(
        Stream.filter((snapshot) => snapshot.status !== "active"),
        Stream.take(1),
        Stream.runForEach((snapshot) =>
          Effect.gen(function*() {
            const parentRegistered = Option.isSome(yield* actor.system.get("parent-system"))
            const childRegistered = Option.isSome(yield* actor.system.get("child-system"))
            const childSnapshot = yield* child.snapshot
            yield* Deferred.succeed(terminalObserved, {
              childRegistered,
              childSnapshot,
              parentRegistered,
              snapshot
            })
          })
        ),
        Effect.forkChild
      )
      const joinFiber = yield* actor.join.pipe(
        Effect.tap(() => Ref.set(joinDone, true)),
        Effect.forkChild
      )

      yield* Deferred.succeed(releaseParent, void 0)
      yield* Deferred.await(childStopping)

      assert.strictEqual(yield* Ref.get(joinDone), false)
      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "active",
        state: 0
      })
      assert.strictEqual(Option.isSome(yield* actor.system.get("parent-system")), true)

      yield* Deferred.succeed(releaseChildStop, void 0)

      const observed = yield* Deferred.await(terminalObserved)
      assert.deepStrictEqual(observed.snapshot, {
        status: "done",
        state: 0,
        output: "done"
      })
      assert.deepStrictEqual(observed.childSnapshot, {
        status: "stopped",
        state: 0
      })
      assert.strictEqual(observed.parentRegistered, false)
      assert.strictEqual(observed.childRegistered, false)
      assert.strictEqual(yield* Fiber.join(joinFiber), "done")
      yield* Fiber.join(observer)
    }))

  it.effect("publishes error snapshots after child and registry cleanup", () =>
    Effect.gen(function*() {
      const error = new LogicError({ message: "boom" })
      const releaseParent = yield* Deferred.make<void>()
      const childStarted = yield* Deferred.make<void>()
      const childStopping = yield* Deferred.make<void>()
      const releaseChildStop = yield* Deferred.make<void>()
      const childRef = yield* Deferred.make<Actor.Actor<number, never, never, void>>()
      const joinDone = yield* Ref.make(false)
      const terminalObserved = yield* Deferred.make<{
        readonly childSnapshot: Actor.Snapshot<number, never, void>
        readonly childRegistered: boolean
        readonly parentRegistered: boolean
        readonly snapshot: Actor.Snapshot<
          number,
          Actor.ActorChildAlreadyExistsError | Actor.ActorSystemIdAlreadyExistsError | LogicError,
          never
        >
      }>()
      const childLogic = Actor.fromEffect<number, never>(
        0,
        () =>
          Deferred.succeed(childStarted, void 0).pipe(
            Effect.andThen(Effect.never),
            Effect.onInterrupt(() =>
              Deferred.succeed(childStopping, void 0).pipe(
                Effect.andThen(Deferred.await(releaseChildStop))
              )
            )
          )
      )
      const actor = yield* Actor.start(
        Actor.fromEffect<
          number,
          never,
          never,
          Actor.ActorChildAlreadyExistsError | Actor.ActorSystemIdAlreadyExistsError | LogicError
        >(
          0,
          ({ spawn }) =>
            Effect.gen(function*() {
              const child = yield* spawn(childLogic, { id: "child", systemId: "failure-child-system" })
              yield* Deferred.succeed(childRef, child)
              yield* Deferred.await(releaseParent)
              return yield* Effect.fail(error)
            })
        ),
        { systemId: "failure-parent-system" }
      )
      const child = yield* Deferred.await(childRef)
      yield* Deferred.await(childStarted)
      const observer = yield* actor.changes.pipe(
        Stream.filter((snapshot) => snapshot.status !== "active"),
        Stream.take(1),
        Stream.runForEach((snapshot) =>
          Effect.gen(function*() {
            const parentRegistered = Option.isSome(yield* actor.system.get("failure-parent-system"))
            const childRegistered = Option.isSome(yield* actor.system.get("failure-child-system"))
            const childSnapshot = yield* child.snapshot
            yield* Deferred.succeed(terminalObserved, {
              childRegistered,
              childSnapshot,
              parentRegistered,
              snapshot
            })
          })
        ),
        Effect.forkChild
      )
      const joinFiber = yield* actor.join.pipe(
        Effect.flip,
        Effect.tap(() => Ref.set(joinDone, true)),
        Effect.forkChild
      )

      yield* Deferred.succeed(releaseParent, void 0)
      yield* Deferred.await(childStopping)

      assert.strictEqual(yield* Ref.get(joinDone), false)
      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "active",
        state: 0
      })
      assert.strictEqual(Option.isSome(yield* actor.system.get("failure-parent-system")), true)

      yield* Deferred.succeed(releaseChildStop, void 0)

      const observed = yield* Deferred.await(terminalObserved)
      assert.strictEqual(observed.snapshot.status, "error")
      if (observed.snapshot.status === "error") {
        const reason = observed.snapshot.cause.reasons[0]
        assert.strictEqual(Cause.isFailReason(reason), true)
        if (Cause.isFailReason(reason)) {
          assert.deepStrictEqual(reason.error, error)
        }
      }
      assert.deepStrictEqual(observed.childSnapshot, {
        status: "stopped",
        state: 0
      })
      assert.strictEqual(observed.parentRegistered, false)
      assert.strictEqual(observed.childRegistered, false)
      assert.deepStrictEqual(yield* Fiber.join(joinFiber), error)
      yield* Fiber.join(observer)
    }))

  it.effect("watches completion as a done event", () =>
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
      const observer = yield* Actor.watch(actor).pipe(
        Stream.runCollect,
        Effect.forkChild
      )

      yield* Deferred.succeed(release, void 0)

      const events = Array.from(yield* Fiber.join(observer))
      assert.strictEqual(events.length, 1)
      assert.strictEqual(events[0]?._tag, "Done")
      const event = events[0]
      if (event?._tag === "Done") {
        assert.strictEqual(event.output, "done")
        assert.deepStrictEqual(event.snapshot, {
          status: "done",
          state: 1,
          output: "done"
        })
      }
    }))

  it.effect("watches explicit stops as stopped events", () =>
    Effect.gen(function*() {
      const actor = yield* Actor.start(Actor.fromEffect<number, never>(0, () => Effect.never))
      const observer = yield* Actor.watch(actor).pipe(
        Stream.runCollect,
        Effect.forkChild
      )

      yield* actor.stop

      const events = Array.from(yield* Fiber.join(observer))
      assert.strictEqual(events.length, 1)
      assert.strictEqual(events[0]?._tag, "Stopped")
      const event = events[0]
      if (event?._tag === "Stopped") {
        assert.deepStrictEqual(event.snapshot, {
          status: "stopped",
          state: 0
        })
      }
    }))

  it.effect("replays already terminal actor snapshots", () =>
    Effect.gen(function*() {
      const actor = yield* Actor.start(Actor.fromEffect<number, never>(0, () => Effect.never))
      yield* actor.stop

      const events = Array.from(yield* Actor.watch(actor).pipe(Stream.runCollect))

      assert.strictEqual(events.length, 1)
      assert.strictEqual(events[0]?._tag, "Stopped")
    }))

  it.effect("classifies typed failures before defects", () =>
    Effect.gen(function*() {
      const error = new LogicError({ message: "boom" })
      const defect = new Error("defect")
      const actor = yield* Actor.start(
        Actor.fromEffect<number, never, never, LogicError>(
          0,
          () => Effect.failCause(Cause.combine(Cause.die(defect), Cause.fail(error)))
        )
      )

      const events = Array.from(yield* Actor.watch(actor).pipe(Stream.runCollect))

      assert.strictEqual(events.length, 1)
      assert.strictEqual(events[0]?._tag, "Failure")
      const event = events[0]
      if (event?._tag === "Failure") {
        assert.deepStrictEqual(event.error, error)
        assert.strictEqual(event.cause.reasons.length, 2)
        assert.strictEqual(event.snapshot.status, "error")
      }
    }))

  it.effect("classifies defects, interruptions, and empty causes", () =>
    Effect.gen(function*() {
      const defect = new Error("defect")
      const defectActor = yield* Actor.start(Actor.fromEffect<number, never>(0, () => Effect.die(defect)))
      const interruptedActor = yield* Actor.start(Actor.fromEffect<number, never>(0, () => Effect.interrupt))
      const emptyCauseActor = yield* Actor.start(
        Actor.fromEffect<number, never>(0, () => Effect.failCause(Cause.empty))
      )

      const defectEvents = Array.from(yield* Actor.watch(defectActor).pipe(Stream.runCollect))
      const interruptedEvents = Array.from(yield* Actor.watch(interruptedActor).pipe(Stream.runCollect))
      const emptyCauseEvents = Array.from(yield* Actor.watch(emptyCauseActor).pipe(Stream.runCollect))

      assert.strictEqual(defectEvents[0]?._tag, "Defect")
      if (defectEvents[0]?._tag === "Defect") {
        assert.strictEqual(defectEvents[0].defect, defect)
      }
      assert.strictEqual(interruptedEvents[0]?._tag, "Interrupted")
      assert.strictEqual(emptyCauseEvents[0]?._tag, "Cause")
    }))

  it.effect("does not watch restarted failures before the child becomes terminal", () =>
    Effect.gen(function*() {
      const error = new LogicError({ message: "boom" })
      const observed = yield* Queue.unbounded<Actor.WatchEvent<number, LogicError>>()
      const childRef = yield* Deferred.make<Actor.Actor<number, never, LogicError, never>>()
      const secondStarted = yield* Deferred.make<void>()
      const releaseSecond = yield* Deferred.make<void>()
      let runs = 0
      const childLogic = Actor.fromEffect<number, never, never, LogicError>(
        0,
        () =>
          Effect.gen(function*() {
            const run = yield* Effect.sync(() => runs++)
            if (run === 0) {
              return yield* Effect.fail(error)
            }
            yield* Deferred.succeed(secondStarted, void 0)
            yield* Deferred.await(releaseSecond)
            return yield* Effect.fail(error)
          })
      )
      const actor = yield* Actor.start(Actor.fromEffect<number, never, never, Actor.ActorChildAlreadyExistsError>(
        0,
        ({ spawn }) =>
          Effect.gen(function*() {
            const child = yield* spawn(childLogic, {
              id: "child",
              supervision: Actor.Supervision.restart(Schedule.recurs(1))
            })
            yield* Deferred.succeed(childRef, child)
            return yield* Effect.never
          })
      ))
      const child = yield* Deferred.await(childRef)
      const observer = yield* Actor.watch(child).pipe(
        Stream.runForEach((event) => Queue.offer(observed, event)),
        Effect.forkChild
      )

      yield* Deferred.await(secondStarted)
      assert.strictEqual(yield* Queue.size(observed), 0)
      yield* Deferred.succeed(releaseSecond, void 0)

      const event = yield* Queue.take(observed)
      assert.strictEqual(event._tag, "Failure")
      yield* Fiber.join(observer)

      yield* actor.stop
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

  it.effect("terminalizes only once when stop is requested repeatedly", () =>
    Effect.scoped(Effect.gen(function*() {
      const system = yield* ActorSystem.make
      const observed = yield* Queue.unbounded<ActorSystem.Event>()
      yield* system.events.pipe(
        Stream.runForEach((event) => Queue.offer(observed, event)),
        Effect.forkScoped
      )
      yield* Effect.yieldNow
      const actor = yield* system.spawn(Actor.fromEffect<number, never>(0, () => Effect.never), {
        systemId: "idempotent-worker"
      })
      const changesFiber = yield* actor.changes.pipe(
        Stream.runCollect,
        Effect.forkChild
      )

      yield* Effect.all([
        actor.stop,
        actor.stop,
        system.stop("idempotent-worker"),
        actor.stop
      ], { concurrency: "unbounded", discard: true })

      const snapshots = Array.from(yield* Fiber.join(changesFiber))
      const events = [
        yield* Queue.take(observed),
        yield* Queue.take(observed),
        yield* Queue.take(observed),
        yield* Queue.take(observed)
      ]

      assert.deepStrictEqual(snapshots.filter((snapshot) => snapshot.status !== "active"), [
        { status: "stopped", state: 0 }
      ])
      assert.deepStrictEqual(events.map((event) => event._tag), [
        "ActorStarted",
        "ActorRegistered",
        "ActorStopped",
        "ActorUnregistered"
      ])
      assert.strictEqual(Option.isNone(yield* system.get("idempotent-worker")), true)
      yield* Effect.yieldNow
      assert.strictEqual(yield* Queue.size(observed), 0)

      const error = yield* Effect.flip(actor.join)
      assert.strictEqual(error._tag, "ActorStoppedError")
    })))

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
