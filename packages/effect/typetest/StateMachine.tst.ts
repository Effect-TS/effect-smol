import { Schema, StateMachine } from "effect"
import { describe, expect, it } from "tstyche"

describe("StateMachine", () => {
  it("make", () => {
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

    const machine = StateMachine.make({
      states: [Idle, Loading],
      events: [Submit],
      input: Input,
      initial: (input) => Idle.make({ userId: input.userId })
    })

    expect(machine).type.toBe<
      StateMachine.Machine<
        readonly [
          Schema.TaggedStruct<"Idle", { readonly userId: Schema.String }>,
          Schema.TaggedStruct<"Loading", { readonly requestId: Schema.String }>
        ],
        readonly [
          Schema.TaggedStruct<"Submit", { readonly value: Schema.String }>
        ],
        Schema.Struct<{ readonly userId: Schema.String }>
      >
    >()
    expect(machine).type.toBeAssignableTo<StateMachine.Machine.Any>()
    expect(machine.initial).type.toBe<
      (input: { readonly userId: string }) =>
        | { readonly _tag: "Idle"; readonly userId: string }
        | { readonly _tag: "Loading"; readonly requestId: string }
    >()

    expect(StateMachine.make).type.not.toBeCallableWith({
      states: [Idle],
      events: [],
      input: Input,
      initial: "missing"
    })

    expect(StateMachine.make).type.not.toBeCallableWith({
      states: [Schema.Struct({})],
      events: [],
      input: Input,
      initial: () => ({})
    })

    expect(StateMachine.make).type.not.toBeCallableWith({
      states: [Idle],
      events: [],
      input: Input,
      initial: () => ({ _tag: "Missing" })
    })
  })
})
