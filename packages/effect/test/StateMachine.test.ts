import { assert, describe, it } from "@effect/vitest"
import { Schema, StateMachine } from "effect"

describe("StateMachine", () => {
  const Input = Schema.Struct({
    userId: Schema.String
  })
  const Idle = Schema.TaggedStruct("Idle", {
    userId: Schema.String
  })
  const Submit = Schema.TaggedStruct("Submit", {
    value: Schema.String
  })

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
})
