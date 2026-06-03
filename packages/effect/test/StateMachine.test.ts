import { assert, describe, it } from "@effect/vitest"
import { Context, Effect, Ref, Schema, StateMachine } from "effect"

class DeferredLog extends Context.Service<DeferredLog, {
  readonly push: (message: string) => Effect.Effect<void>
  readonly read: Effect.Effect<ReadonlyArray<string>>
}>()("test/Machine/DeferredLog") {}

const makeDeferredLog = Effect.gen(function*() {
  const ref = yield* Ref.make<ReadonlyArray<string>>([])
  return DeferredLog.of({
    push: (message) => Ref.update(ref, (messages) => [...messages, message]),
    read: Ref.get(ref)
  })
})

describe("StateMachine", () => {
  const Input = Schema.Struct({
    userId: Schema.String
  })
  class Idle extends Schema.TaggedClass<Idle>("Idle")("Idle", {
    userId: Schema.String
  }) {}

  class Loading extends Schema.TaggedClass<Loading>("Loading")("Loading", {
    requestId: Schema.String
  }) {}

  class Submit extends Schema.TaggedClass<Submit>("Submit")("Submit", {
    value: Schema.String
  }) {}

  class Reset extends Schema.TaggedClass<Reset>("Reset")("Reset", {}) {}

  it("make constructs the initial state from input", () => {
    const machine = StateMachine.make({
      states: [Idle],
      events: [Submit],
      input: Input,
      initial: (input) => new Idle({ userId: input.userId })
    })

    assert.strictEqual(StateMachine.isMachine(machine), true)
    assert.deepStrictEqual(StateMachine.initial(machine, { userId: "user-1" }), new Idle({ userId: "user-1" }))
  })

  it("make stores the machine id", () => {
    const machine = StateMachine.make({
      id: "UserMachine",
      states: [Idle, Loading],
      events: [Submit],
      input: Input,
      initial: (input) => new Idle({ userId: input.userId })
    }).handle("Idle", {
      Submit: Effect.fn(function*() {
        return new Loading({ requestId: "request-1" })
      })
    })

    assert.strictEqual(machine.id, "UserMachine")
  })

  it.effect("starts a machine without input", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: [Idle],
        events: [Submit],
        initial: () => new Idle({ userId: "user-1" })
      })

      const actor = yield* StateMachine.start(machine)

      assert.deepStrictEqual(StateMachine.initial(machine), new Idle({ userId: "user-1" }))
      assert.deepStrictEqual(yield* actor.state, new Idle({ userId: "user-1" }))
    }))

  it("handle stores handlers and sync transitions enqueue actions", () => {
    const effect = Effect.succeed("submitted")
    const machine = StateMachine.make({
      states: [Idle, Loading],
      events: [Submit],
      input: Input,
      initial: (input) => Idle.make({ userId: input.userId })
    }).handle("Idle", {
      Submit: Effect.fn(function*() {
        yield* StateMachine.action(effect)
        return new Loading({ requestId: "request-1" })
      })
    })

    assert.strictEqual("Idle" in machine.handlers, true)
    assert.strictEqual("Submit" in machine.handlers.Idle, true)
  })

  it("can reuse the same machine with multiple different handlers", () => {
    const effect = Effect.succeed("submitted")
    const machine = StateMachine.make({
      states: [Idle, Loading],
      events: [Submit, Reset],
      input: Input,
      initial: (input) => new Idle({ userId: input.userId })
    })

    const machine1 = machine.handle("Idle", {
      Submit: Effect.fn(function*() {
        yield* StateMachine.action(effect)
        return new Loading({ requestId: "request-1" })
      })
    })

    const machine2 = machine.handle("Idle", {
      Reset: Effect.fn(function*() {
        return new Idle({ userId: "user-1" })
      })
    })

    assert.strictEqual("Idle" in machine1.handlers, true)
    assert.strictEqual("Submit" in machine1.handlers.Idle, true)
    assert.strictEqual("Reset" in machine2.handlers.Idle, true)
  })

  it.effect("start creates a runtime that sends events and stops", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: [Idle, Loading],
        events: [Submit, Reset],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          Submit: Effect.fn(function*() {
            yield* StateMachine.action(Effect.succeed("submitted"))
            return new Loading({ requestId: "request-1" })
          })
        })
        .handle("Loading", {
          Reset: () => Effect.succeed(new Idle({ userId: "user-1" }))
        })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" })

      assert.deepStrictEqual(yield* actor.state, new Idle({ userId: "user-1" }))

      yield* actor.send(new Submit({ value: "hello" }))

      assert.deepStrictEqual(yield* actor.state, new Loading({ requestId: "request-1" }))
    }))

  it.effect("sending an event that is not handled by the current state does nothing", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: [Idle, Loading],
        events: [Submit, Reset],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          Submit: Effect.fn(function*() {
            yield* StateMachine.action(Effect.succeed("submitted"))
            return new Loading({ requestId: "request-1" })
          })
        })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" })

      assert.deepStrictEqual(yield* actor.state, new Idle({ userId: "user-1" }))

      yield* actor.send(new Reset({}))

      assert.deepStrictEqual(yield* actor.state, new Idle({ userId: "user-1" }))
    }))

  it.effect("handles required services in actions", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: [Idle, Loading],
        events: [Submit, Reset],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          Submit: Effect.fn(function*() {
            yield* StateMachine.action(
              Effect.gen(function*() {
                const deferredLog = yield* DeferredLog
                yield* deferredLog.push("submitted")
              })
            )

            return new Loading({ requestId: "request-1" })
          })
        })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" })

      yield* actor.send(new Submit({ value: "hello" })).pipe(
        Effect.provideService(DeferredLog, deferredLog)
      )

      assert.deepStrictEqual(yield* deferredLog.read, ["submitted"])
      assert.deepStrictEqual(yield* actor.state, new Loading({ requestId: "request-1" }))
    }))

  it.effect("runs the actions in sequential order", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: [Idle, Loading],
        events: [Submit, Reset],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          Submit: Effect.fn(function*() {
            yield* StateMachine.action(
              Effect.gen(function*() {
                const deferredLog = yield* DeferredLog
                yield* deferredLog.push("submitted1")
                yield* deferredLog.push("submitted2")
              })
            )

            return new Loading({ requestId: "request-1" })
          })
        })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" })

      yield* actor.send(new Submit({ value: "hello" })).pipe(
        Effect.provideService(DeferredLog, deferredLog)
      )

      assert.deepStrictEqual(yield* deferredLog.read, ["submitted1", "submitted2"])
      assert.deepStrictEqual(yield* actor.state, new Loading({ requestId: "request-1" }))
    }))
})
