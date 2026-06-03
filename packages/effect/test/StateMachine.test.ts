import { assert, describe, it } from "@effect/vitest"
import { Effect, Schema, StateMachine } from "effect"

describe("StateMachine", () => {
  const Input = Schema.Struct({
    userId: Schema.String
  })
  const Idle = Schema.TaggedStruct("Idle", {
    userId: Schema.String
  })
  const Loading = Schema.TaggedStruct("Loading", {
    requestId: Schema.String
  })
  const Submit = Schema.TaggedStruct("Submit", {
    value: Schema.String
  })
  const Reset = Schema.TaggedStruct("Reset", {})

  it("make constructs the initial state from input", () => {
    const machine = StateMachine.make({
      states: [Idle],
      events: [Submit],
      input: Input,
      initial: (input) => Idle.make({ userId: input.userId })
    })

    assert.strictEqual(StateMachine.isMachine(machine), true)
    assert.deepStrictEqual(machine.initial({ userId: "user-1" }), {
      _tag: "Idle",
      userId: "user-1"
    })
  })

  it("handle stores handlers and sync transitions enqueue actions", () => {
    const effect = Effect.succeed("submitted")
    const machine = StateMachine.make({
      states: [Idle, Loading],
      events: [Submit],
      input: Input,
      initial: (input) => Idle.make({ userId: input.userId })
    }).handle("Idle", {
      Submit: ({ enqueue }) => {
        enqueue.action(effect)
        return Loading.make({ requestId: "request-1" })
      }
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
      initial: (input) => Idle.make({ userId: input.userId })
    })

    const machine1 = machine.handle("Idle", {
      Submit: ({ enqueue }) => {
        enqueue.action(effect)
        return Loading.make({ requestId: "request-1" })
      }
    })

    const machine2 = machine.handle("Idle", {
      Reset: () => Idle.make({ userId: "user-1" })
    })

    assert.strictEqual("Idle" in machine1.handlers, true)
    assert.strictEqual("Submit" in machine1.handlers.Idle, true)
    assert.strictEqual("Reset" in machine2.handlers.Idle, true)
  })
})
