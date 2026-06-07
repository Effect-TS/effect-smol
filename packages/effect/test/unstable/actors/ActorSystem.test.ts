import { assert, describe, it } from "@effect/vitest"
import { Effect, Exit, Fiber, Option, Queue, Scope, Stream } from "effect"
import { Actor, ActorSystem } from "effect/unstable/actors"

const neverLogic = Actor.fromEffect(0, () => Effect.never)

describe("ActorSystem", () => {
  it.effect("streams lifecycle and registry events for system-spawned actors", () =>
    Effect.scoped(Effect.gen(function*() {
      const system = yield* ActorSystem.make
      const observed = yield* Queue.unbounded<ActorSystem.Event>()
      yield* system.events.pipe(
        Stream.runForEach((event) => Queue.offer(observed, event)),
        Effect.forkScoped
      )
      yield* Effect.yieldNow

      const actor = yield* system.spawn(neverLogic, { systemId: "worker" })
      yield* system.stop("worker")

      const events = [
        yield* Queue.take(observed),
        yield* Queue.take(observed),
        yield* Queue.take(observed),
        yield* Queue.take(observed)
      ]

      assert.deepStrictEqual(events.map((event) => event._tag), [
        "ActorStarted",
        "ActorRegistered",
        "ActorStopped",
        "ActorUnregistered"
      ])

      const [started, registered, stopped, unregistered] = events
      if (started._tag === "ActorStarted") {
        assert.strictEqual(started.ref.sessionId, actor.sessionId)
        assert.strictEqual(started.parent, undefined)
      }
      if (registered._tag === "ActorRegistered") {
        assert.strictEqual(registered.systemId, "worker")
        assert.strictEqual(registered.ref.sessionId, actor.sessionId)
      }
      if (stopped._tag === "ActorStopped") {
        assert.strictEqual(stopped.ref.sessionId, actor.sessionId)
        assert.strictEqual(Exit.isSuccess(stopped.exit), true)
      }
      if (unregistered._tag === "ActorUnregistered") {
        assert.strictEqual(unregistered.systemId, "worker")
      }
    })))

  it.effect("includes the parent reference in child start events", () =>
    Effect.scoped(Effect.gen(function*() {
      const system = yield* ActorSystem.make
      const observer = yield* system.events.pipe(
        Stream.take(4),
        Stream.runCollect,
        Effect.forkScoped
      )
      yield* Effect.yieldNow
      const parent = yield* system.spawn(
        Actor.fromEffect<
          number,
          never,
          never,
          Actor.ActorChildAlreadyExistsError | ActorSystem.ActorSystemIdAlreadyExistsError
        >(
          0,
          ({ spawn }) =>
            Effect.gen(function*() {
              yield* spawn(neverLogic, { id: "child", systemId: "child" })
              return yield* Effect.never
            })
        ),
        { id: "parent", systemId: "parent" }
      )

      const events = Array.from(yield* Fiber.join(observer))

      assert.deepStrictEqual(events.map((event) => event._tag), [
        "ActorStarted",
        "ActorRegistered",
        "ActorStarted",
        "ActorRegistered"
      ])

      const [parentStarted, parentRegistered, childStarted, childRegistered] = events
      if (parentStarted._tag === "ActorStarted") {
        assert.strictEqual(parentStarted.ref.sessionId, parent.sessionId)
        assert.strictEqual(parentStarted.parent, undefined)
      }
      if (parentRegistered._tag === "ActorRegistered") {
        assert.strictEqual(parentRegistered.systemId, "parent")
      }
      if (childStarted._tag === "ActorStarted") {
        assert.strictEqual(childStarted.parent?.sessionId, parent.sessionId)
      }
      if (childRegistered._tag === "ActorRegistered") {
        assert.strictEqual(childRegistered.systemId, "child")
      }

      yield* parent.stop
    })))

  it.effect("does not emit lifecycle events for duplicate system id reservations", () =>
    Effect.scoped(Effect.gen(function*() {
      const system = yield* ActorSystem.make
      const observed = yield* Queue.unbounded<ActorSystem.Event>()
      const duplicateInitials = yield* Queue.unbounded<void>()
      const duplicateLogic: Actor.ActorLogic<number, never> = {
        initial: () => Queue.offer(duplicateInitials, void 0).pipe(Effect.as(0)),
        run: () => Effect.never
      }
      yield* system.events.pipe(
        Stream.runForEach((event) => Queue.offer(observed, event)),
        Effect.forkScoped
      )
      yield* Effect.yieldNow

      const actor = yield* system.spawn(neverLogic, { systemId: "worker" })
      const duplicateError = yield* Effect.flip(system.spawn(duplicateLogic, { systemId: "worker" }))
      yield* actor.stop

      const events = [
        yield* Queue.take(observed),
        yield* Queue.take(observed),
        yield* Queue.take(observed),
        yield* Queue.take(observed)
      ]

      assert.strictEqual(duplicateError._tag, "ActorSystemIdAlreadyExistsError")
      assert.strictEqual(duplicateError.systemId, "worker")
      assert.strictEqual(yield* Queue.size(duplicateInitials), 0)
      assert.deepStrictEqual(events.map((event) => event._tag), [
        "ActorStarted",
        "ActorRegistered",
        "ActorStopped",
        "ActorUnregistered"
      ])

      yield* Effect.yieldNow
      assert.strictEqual(yield* Queue.size(observed), 0)
    })))

  it.effect("reserves a parent system id before running initial logic", () =>
    Effect.scoped(Effect.gen(function*() {
      const system = yield* ActorSystem.make
      const childSpawnResult = yield* Queue.unbounded<string>()
      const parentLogic: Actor.ActorLogic<number, never> = {
        initial: ({ spawn }) =>
          Effect.gen(function*() {
            yield* spawn(neverLogic, { systemId: "worker" }).pipe(
              Effect.matchEffect({
                onFailure: (error) => Queue.offer(childSpawnResult, error.systemId),
                onSuccess: (child) =>
                  Queue.offer(childSpawnResult, "started").pipe(
                    Effect.andThen(child.stop)
                  )
              })
            )
            return 0
          }),
        run: () => Effect.never
      }

      const actor = yield* system.spawn(parentLogic, { systemId: "worker" })

      assert.strictEqual(yield* Queue.take(childSpawnResult), "worker")
      const registered = yield* system.get("worker")
      assert.strictEqual(Option.isSome(registered), true)
      if (Option.isSome(registered)) {
        assert.strictEqual(registered.value.sessionId, actor.sessionId)
      }

      yield* actor.stop
    })))

  it.effect("ignores sends to stopped system ids", () =>
    Effect.scoped(Effect.gen(function*() {
      const system = yield* ActorSystem.make
      const actor = yield* system.spawn(neverLogic, { systemId: "worker" })

      yield* actor.stop
      yield* system.send("worker", { _tag: "Ping" })

      assert.strictEqual(Option.isNone(yield* system.get("worker")), true)
    })))

  it.effect("completes the events stream when the system scope closes", () =>
    Effect.gen(function*() {
      const scope = yield* Scope.make()
      const system = yield* ActorSystem.make.pipe(Scope.provide(scope))
      const observer = yield* system.events.pipe(
        Stream.runCollect,
        Effect.forkChild
      )
      yield* Effect.yieldNow
      const actor = yield* system.spawn(neverLogic, { systemId: "worker" })

      yield* Scope.close(scope, Exit.void)

      const events = Array.from(yield* Fiber.join(observer))
      assert.deepStrictEqual(events.map((event) => event._tag), [
        "ActorStarted",
        "ActorRegistered",
        "ActorStopped",
        "ActorUnregistered"
      ])
      const started = events[0]
      if (started?._tag === "ActorStarted") {
        assert.strictEqual(started.ref.sessionId, actor.sessionId)
      }
    }))
})
