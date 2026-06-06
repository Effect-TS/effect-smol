import { assert, describe, it } from "@effect/vitest"
import {
  Actor,
  ActorSystem,
  Cause,
  Context,
  Data,
  Deferred,
  Effect,
  Fiber,
  Option,
  Ref,
  Schema,
  StateMachine,
  Stream
} from "effect"

class DeferredLog extends Context.Service<DeferredLog, {
  readonly push: (message: string) => Effect.Effect<void>
  readonly read: Effect.Effect<ReadonlyArray<string>>
}>()("test/Machine/DeferredLog") {}

class EntryRequirement extends Context.Service<EntryRequirement, {
  readonly entryMessage: string
}>()("test/Machine/EntryRequirement") {}

class InitialRequirement extends Context.Service<InitialRequirement, {
  readonly initialMessage: string
}>()("test/Machine/InitialRequirement") {}

class ExitRequirement extends Context.Service<ExitRequirement, {
  readonly exitMessage: string
}>()("test/Machine/ExitRequirement") {}

const makeDeferredLog = Effect.gen(function*() {
  const ref = yield* Ref.make<ReadonlyArray<string>>([])
  return DeferredLog.of({
    push: (message) => Ref.update(ref, (messages) => [...messages, message]),
    read: Ref.get(ref)
  })
})

class EntryError extends Data.TaggedError("EntryError")<{
  readonly state: string
}> {}

class InitialError extends Data.TaggedError("InitialError")<{
  readonly state: string
}> {}

class ExitError extends Data.TaggedError("ExitError")<{
  readonly state: string
}> {}

class InvokeError extends Data.TaggedError("InvokeError")<{
  readonly message: string
}> {}

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

  class Success extends Schema.TaggedClass<Success>("Success")("Success", {
    requestId: Schema.String
  }) {}

  class Failed extends Schema.TaggedClass<Failed>("Failed")("Failed", {
    message: Schema.String
  }) {}

  class Submit extends Schema.TaggedClass<Submit>("Submit")("Submit", {
    value: Schema.String
  }) {}

  class RequestSucceeded extends Schema.TaggedClass<RequestSucceeded>("RequestSucceeded")("RequestSucceeded", {
    value: Schema.String
  }) {}

  class RequestProgress extends Schema.TaggedClass<RequestProgress>("RequestProgress")("RequestProgress", {
    id: Schema.String,
    childState: Schema.String
  }) {}

  class ParentRequestProgress extends Schema.TaggedClass<ParentRequestProgress>("ParentRequestProgress")(
    "ParentRequestProgress",
    {
      id: Schema.String,
      loaded: Schema.Number
    }
  ) {}

  class RequestFailed extends Schema.TaggedClass<RequestFailed>("RequestFailed")("RequestFailed", {
    error: Schema.Any,
    cause: Schema.Any
  }) {}

  class Reset extends Schema.TaggedClass<Reset>("Reset")("Reset", {}) {}
  class Resolve extends Schema.TaggedClass<Resolve>("Resolve")("Resolve", {}) {}
  class ChildPing extends Data.TaggedClass("ChildPing")<{
    readonly reply: Deferred.Deferred<void>
  }> {}

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
      on: {
        Submit: Effect.fn(function*() {
          return new Loading({ requestId: "request-1" })
        })
      }
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

  it.effect("planInitial computes the initial state without running deferred actions", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: [Idle],
        events: [Submit],
        input: Input,
        initial: Effect.fn(function*({ userId }) {
          yield* StateMachine.action(
            Effect.gen(function*() {
              const deferredLog = yield* DeferredLog
              yield* deferredLog.push("initial")
            })
          )
          return new Idle({ userId })
        })
      })

      const planned = yield* StateMachine.planInitial(machine, { userId: "user-1" })

      assert.deepStrictEqual(planned.state, new Idle({ userId: "user-1" }))
      assert.strictEqual(planned.actions.length, 1)
      assert.deepStrictEqual(yield* deferredLog.read, [])
    }))

  it.effect("start runs deferred initial actions", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: [Idle],
        events: [Submit],
        input: Input,
        initial: Effect.fn(function*({ userId }) {
          yield* StateMachine.action(
            Effect.gen(function*() {
              const deferredLog = yield* DeferredLog
              yield* deferredLog.push("initial")
            })
          )
          return new Idle({ userId })
        })
      })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" }).pipe(
        Effect.provideService(DeferredLog, deferredLog)
      )

      assert.deepStrictEqual(yield* actor.state, new Idle({ userId: "user-1" }))
      assert.deepStrictEqual(yield* deferredLog.read, ["initial"])
    }))

  it.effect("planInitial collects initial state entry actions without running them", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: [Idle],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      }).handle("Idle", {
        entry: Effect.fn(function*({ event }) {
          const deferredLog = yield* DeferredLog
          yield* StateMachine.action(deferredLog.push(`entry:${String(event._tag)}`))
        })
      })

      const planned = yield* StateMachine.planInitial(machine, { userId: "user-1" }).pipe(
        Effect.provideService(DeferredLog, deferredLog)
      )

      assert.deepStrictEqual(planned.state, new Idle({ userId: "user-1" }))
      assert.strictEqual(planned.actions.length, 1)
      assert.deepStrictEqual(yield* deferredLog.read, [])
    }))

  it.effect("start runs initial state entry actions", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: [Idle],
        events: [Submit],
        input: Input,
        initial: Effect.fn(function*({ userId }) {
          const deferredLog = yield* DeferredLog
          yield* StateMachine.action(deferredLog.push("initial"))
          return new Idle({ userId })
        })
      }).handle("Idle", {
        entry: Effect.fn(function*({ event }) {
          const deferredLog = yield* DeferredLog
          yield* StateMachine.action(deferredLog.push(`entry:${String(event._tag)}`))
        })
      })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" }).pipe(
        Effect.provideService(DeferredLog, deferredLog)
      )

      assert.deepStrictEqual(yield* actor.state, new Idle({ userId: "user-1" }))
      assert.deepStrictEqual(yield* deferredLog.read, ["initial", "entry:Symbol(effect/StateMachine/InitialEvent)"])
    }))

  it.effect("start follows always transitions from the initial state before exposing actor state", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: [Idle, Loading],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          entry: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("entry"))
          }),
          always: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("always"))
            return new Loading({ requestId: "request-1" })
          })
        })
        .handle("Loading", {
          entry: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("loading-entry"))
          })
        })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" }).pipe(
        Effect.provideService(DeferredLog, deferredLog)
      )

      assert.deepStrictEqual(yield* actor.state, new Loading({ requestId: "request-1" }))
      assert.deepStrictEqual(yield* deferredLog.read, ["entry", "always", "loading-entry"])
    }))

  it.effect("start processes raised events from initial state entry actions", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: [Idle, Loading],
        events: [Submit, Resolve],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          entry: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("entry"))
            yield* StateMachine.raise(new Resolve({}))
          }),
          on: {
            Resolve: Effect.fn(function*() {
              const deferredLog = yield* DeferredLog
              yield* StateMachine.action(deferredLog.push("resolve"))
              return new Loading({ requestId: "request-1" })
            })
          }
        })
        .handle("Loading", {
          entry: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("loading-entry"))
          })
        })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" }).pipe(
        Effect.provideService(DeferredLog, deferredLog)
      )

      assert.deepStrictEqual(yield* actor.state, new Loading({ requestId: "request-1" }))
      assert.deepStrictEqual(yield* deferredLog.read, ["entry", "resolve", "loading-entry"])
    }))

  it.effect("carries initial action requirements", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: [Idle],
        events: [Submit],
        input: Input,
        initial: Effect.fn(function*({ userId }) {
          yield* StateMachine.action(
            Effect.gen(function*() {
              const requirement = yield* InitialRequirement
              const deferredLog = yield* DeferredLog
              yield* deferredLog.push(requirement.initialMessage)
            })
          )
          return new Idle({ userId })
        })
      })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" }).pipe(
        Effect.provideService(InitialRequirement, InitialRequirement.of({ initialMessage: "initial" })),
        Effect.provideService(DeferredLog, deferredLog)
      )

      assert.deepStrictEqual(yield* actor.state, new Idle({ userId: "user-1" }))
      assert.deepStrictEqual(yield* deferredLog.read, ["initial"])
    }))

  it.effect("propagates initial action failures", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: [Idle],
        events: [Submit],
        input: Input,
        initial: Effect.fn(function*({ userId }) {
          const state = new Idle({ userId })
          yield* StateMachine.action(Effect.fail(new InitialError({ state: state._tag })))
          return state
        })
      })

      const error = yield* Effect.flip(StateMachine.start(machine, { userId: "user-1" }))

      assert.instanceOf(error, InitialError)
      assert.strictEqual(error._tag, "InitialError")
      assert.strictEqual(error.state, "Idle")
    }))

  it.effect("propagates initial state entry action failures", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: [Idle],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      }).handle("Idle", {
        entry: ({ state }) => StateMachine.action(Effect.fail(new EntryError({ state: state._tag })))
      })

      const error = yield* Effect.flip(StateMachine.start(machine, { userId: "user-1" }))

      assert.instanceOf(error, StateMachine.StartupError)
      assert.strictEqual(error._tag, "StartupError")
      const reason = error.cause.reasons[0]
      assert.ok(reason !== undefined)
      assert.strictEqual(Cause.isFailReason(reason), true)
      if (Cause.isFailReason(reason)) {
        assert.instanceOf(reason.error, EntryError)
        assert.strictEqual(reason.error.state, "Idle")
      }
    }))

  it("handle stores handlers and sync transitions enqueue actions", () => {
    const effect = Effect.succeed("submitted")
    const machine = StateMachine.make({
      states: [Idle, Loading],
      events: [Submit],
      input: Input,
      initial: (input) => Idle.make({ userId: input.userId })
    }).handle("Idle", {
      on: {
        Submit: Effect.fn(function*() {
          yield* StateMachine.action(effect)
          return new Loading({ requestId: "request-1" })
        })
      }
    })

    assert.strictEqual("Idle" in machine.handlers, true)
    assert.strictEqual("Submit" in (machine.handlers.Idle.on ?? {}), true)
  })

  it.effect("handlers can return states directly", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: [Idle, Loading],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      }).handle("Idle", {
        on: {
          Submit: () => new Loading({ requestId: "request-1" })
        }
      })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" })

      yield* actor.send(new Submit({ value: "hello" }))

      assert.deepStrictEqual(yield* actor.state, new Loading({ requestId: "request-1" }))
    }))

  it("enabled returns the event tags handled by the current state", () => {
    const machine = StateMachine.make({
      states: [Idle, Loading],
      events: [Submit, Reset],
      input: Input,
      initial: (input) => new Idle({ userId: input.userId })
    })
      .handle("Idle", {
        on: {
          Submit: () => new Loading({ requestId: "request-1" })
        }
      })
      .handle("Loading", {
        on: {
          Reset: () => new Idle({ userId: "user-1" })
        }
      })

    assert.deepStrictEqual(StateMachine.enabled(machine, new Idle({ userId: "user-1" })), ["Submit"])
    assert.deepStrictEqual(StateMachine.enabled(machine, new Loading({ requestId: "request-1" })), ["Reset"])
  })

  it("enabled returns no event tags for final states", () => {
    const machine = StateMachine.make({
      states: [Idle, Success],
      events: [Submit],
      input: Input,
      initial: (input) => new Idle({ userId: input.userId })
    })
      .handle("Idle", {
        on: {
          Submit: () => new Success({ requestId: "request-1" })
        }
      })
      .handle("Success", {
        type: "final"
      })

    assert.deepStrictEqual(StateMachine.enabled(machine, new Success({ requestId: "request-1" })), [])
  })

  it.effect("runs final state entry actions when entering a final state", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: [Idle, Success],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          on: {
            Submit: () => new Success({ requestId: "request-1" })
          }
        })
        .handle("Success", {
          type: "final",
          entry: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("success"))
          })
        })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" })
      yield* actor.send(new Submit({ value: "hello" })).pipe(
        Effect.provideService(DeferredLog, deferredLog)
      )

      assert.deepStrictEqual(yield* actor.state, new Success({ requestId: "request-1" }))
      assert.deepStrictEqual(yield* deferredLog.read, ["success"])
    }))

  it.effect("exposes final state output from an actor", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: [Idle, Success],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          on: {
            Submit: () => new Success({ requestId: "request-1" })
          }
        })
        .handle("Success", {
          type: "final",
          output: ({ event, state }) => `${state.requestId}:${event._tag}`
        })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" })

      assert.strictEqual(yield* actor.output, undefined)

      yield* actor.send(new Submit({ value: "hello" }))

      assert.strictEqual(yield* actor.output, "request-1:Submit")
    }))

  it.effect("plans final state output without running deferred actions", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: [Idle, Success],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          on: {
            Submit: () => new Success({ requestId: "request-1" })
          }
        })
        .handle("Success", {
          type: "final",
          output: ({ state }) => state.requestId
        })

      const planned = yield* StateMachine.plan(
        machine,
        new Idle({ userId: "user-1" }),
        new Submit({ value: "hello" })
      )

      assert.strictEqual(planned.output, "request-1")
    }))

  it.effect("exposes output when the initial state is final", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: [Success],
        events: [Submit],
        initial: () => new Success({ requestId: "request-1" })
      }).handle("Success", {
        type: "final",
        output: ({ state }) => state.requestId
      })

      const planned = yield* StateMachine.planInitial(machine)
      const actor = yield* StateMachine.start(machine)

      assert.strictEqual(planned.output, "request-1")
      assert.strictEqual(yield* actor.output, "request-1")
    }))

  it.effect("defaults final state output to undefined", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: [Idle, Success],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          on: {
            Submit: () => new Success({ requestId: "request-1" })
          }
        })
        .handle("Success", {
          type: "final"
        })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" })
      yield* actor.send(new Submit({ value: "hello" }))

      assert.strictEqual(yield* actor.output, undefined)
    }))

  it.effect("does not process events after reaching a final state", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: [Idle, Success],
        events: [Submit, Reset],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          on: {
            Submit: () => new Success({ requestId: "request-1" }),
            Reset: () => new Idle({ userId: "user-2" })
          }
        })
        .handle("Success", {
          type: "final"
        })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" })
      yield* actor.send(new Submit({ value: "hello" }))
      yield* actor.send(new Reset({}))

      assert.deepStrictEqual(yield* actor.state, new Success({ requestId: "request-1" }))
    }))

  it.effect("plans no-op transitions from final states", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: [Idle, Success],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      }).handle("Success", {
        type: "final"
      })

      const state = new Success({ requestId: "request-1" })
      const planned = yield* StateMachine.plan(machine, state, new Submit({ value: "hello" }))
      const nextState = yield* StateMachine.next(machine, state, new Submit({ value: "hello" }))

      assert.deepStrictEqual(planned.next, state)
      assert.deepStrictEqual(planned.actions, [])
      assert.deepStrictEqual(planned.microsteps, [])
      assert.deepStrictEqual(nextState, state)
    }))

  it.effect("does not process raised events from final state entry actions", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: [Idle, Success],
        events: [Submit, Reset],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          on: {
            Submit: () => new Success({ requestId: "request-1" }),
            Reset: () => new Idle({ userId: "user-2" })
          }
        })
        .handle("Success", {
          type: "final",
          entry: () => StateMachine.raise(new Reset({}))
        })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" })
      yield* actor.send(new Submit({ value: "hello" }))

      assert.deepStrictEqual(yield* actor.state, new Success({ requestId: "request-1" }))
    }))

  it.effect("next computes the next state without starting an actor", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: [Idle, Loading],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      }).handle("Idle", {
        on: {
          Submit: () => new Loading({ requestId: "request-1" })
        }
      })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" })
      const state = yield* actor.state
      const nextState = yield* StateMachine.next(machine, state, new Submit({ value: "hello" }))

      assert.deepStrictEqual(nextState, new Loading({ requestId: "request-1" }))
      assert.deepStrictEqual(yield* actor.state, new Idle({ userId: "user-1" }))
    }))

  it.effect("plan computes the next state without running deferred actions", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: [Idle, Loading],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      }).handle("Idle", {
        on: {
          Submit: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("submitted"))
            return new Loading({ requestId: "request-1" })
          })
        }
      })

      const planned = yield* StateMachine.plan(
        machine,
        new Idle({ userId: "user-1" }),
        new Submit({ value: "hello" })
      ).pipe(Effect.provideService(DeferredLog, deferredLog))

      assert.deepStrictEqual(planned.next, new Loading({ requestId: "request-1" }))
      assert.deepStrictEqual(yield* deferredLog.read, [])
    }))

  it.effect("next runs deferred actions", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: [Idle, Loading],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      }).handle("Idle", {
        on: {
          Submit: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("submitted"))
            return new Loading({ requestId: "request-1" })
          })
        }
      })

      const nextState = yield* StateMachine.next(
        machine,
        new Idle({ userId: "user-1" }),
        new Submit({ value: "hello" })
      ).pipe(Effect.provideService(DeferredLog, deferredLog))

      assert.deepStrictEqual(nextState, new Loading({ requestId: "request-1" }))
      assert.deepStrictEqual(yield* deferredLog.read, ["submitted"])
    }))

  it.effect("handlers can omit returning a state for self-transitions", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: [Idle, Loading],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      }).handle("Idle", {
        on: {
          Submit: () => {}
        }
      })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" })

      yield* actor.send(new Submit({ value: "hello" }))

      assert.deepStrictEqual(yield* actor.state, new Idle({ userId: "user-1" }))
    }))

  it.effect("effect handlers can omit returning a state for self-transitions", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: [Idle, Loading],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      }).handle("Idle", {
        on: {
          Submit: Effect.fn(function*() {
            yield* StateMachine.action(
              Effect.gen(function*() {
                const deferredLog = yield* DeferredLog
                yield* deferredLog.push("submitted")
              })
            )
          })
        }
      })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" })

      yield* actor.send(new Submit({ value: "hello" })).pipe(
        Effect.provideService(DeferredLog, deferredLog)
      )

      assert.deepStrictEqual(yield* deferredLog.read, ["submitted"])
      assert.deepStrictEqual(yield* actor.state, new Idle({ userId: "user-1" }))
    }))

  it("can reuse the same machine with multiple different handlers", () => {
    const effect = Effect.succeed("submitted")
    const machine = StateMachine.make({
      states: [Idle, Loading],
      events: [Submit, Reset],
      input: Input,
      initial: (input) => new Idle({ userId: input.userId })
    })

    const machine1 = machine.handle("Idle", {
      on: {
        Submit: Effect.fn(function*() {
          yield* StateMachine.action(effect)
          return new Loading({ requestId: "request-1" })
        })
      }
    })

    const machine2 = machine.handle("Idle", {
      on: {
        Reset: Effect.fn(function*() {
          return new Idle({ userId: "user-1" })
        })
      }
    })

    assert.strictEqual("Idle" in machine1.handlers, true)
    assert.strictEqual("Submit" in (machine1.handlers.Idle.on ?? {}), true)
    assert.strictEqual("Reset" in (machine2.handlers.Idle.on ?? {}), true)
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
          on: {
            Submit: Effect.fn(function*() {
              yield* StateMachine.action(Effect.succeed("submitted"))
              return new Loading({ requestId: "request-1" })
            })
          }
        })
        .handle("Loading", {
          on: {
            Reset: () => Effect.succeed(new Idle({ userId: "user-1" }))
          }
        })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" })

      assert.deepStrictEqual(yield* actor.state, new Idle({ userId: "user-1" }))

      yield* actor.send(new Submit({ value: "hello" }))

      assert.deepStrictEqual(yield* actor.state, new Loading({ requestId: "request-1" }))
    }))

  it.effect("toActorLogic runs with actor identity and active snapshots", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: [Idle, Loading],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      }).handle("Idle", {
        on: {
          Submit: () => new Loading({ requestId: "request-1" })
        }
      })

      const actor = yield* Actor.start(StateMachine.toActorLogic(machine, { userId: "user-1" }), {
        id: "user-machine",
        systemId: "user-machine-1"
      })
      const registered = yield* actor.system.get<Submit>("user-machine-1")
      const observer = yield* actor.changes.pipe(
        Stream.filter((snapshot) => snapshot.state._tag === "Loading"),
        Stream.take(1),
        Stream.runCollect,
        Effect.forkChild
      )

      assert.strictEqual(actor.id, "user-machine")
      assert.strictEqual(actor.systemId, "user-machine-1")
      assert.strictEqual(Option.isSome(registered), true)
      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "active",
        state: new Idle({ userId: "user-1" })
      })

      yield* actor.send(new Submit({ value: "hello" }))

      const snapshots = Array.from(yield* Fiber.join(observer))
      assert.deepStrictEqual(snapshots, [{
        status: "active",
        state: new Loading({ requestId: "request-1" })
      }])
      assert.deepStrictEqual(yield* actor.state, new Loading({ requestId: "request-1" }))

      yield* actor.stop
      assert.strictEqual(Option.isNone(yield* actor.system.get("user-machine-1")), true)
    }))

  it.effect("toActorLogic completes actor output from a final state", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: [Idle, Success],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          on: {
            Submit: () => new Success({ requestId: "request-1" })
          }
        })
        .handle("Success", {
          type: "final",
          output: ({ state }) => state.requestId
        })

      const actor = yield* Actor.start(StateMachine.toActorLogic(machine, { userId: "user-1" }))

      yield* actor.send(new Submit({ value: "hello" }))

      assert.strictEqual(yield* actor.join, "request-1")
      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "done",
        state: new Success({ requestId: "request-1" }),
        output: "request-1"
      })
    }))

  it.effect("toActorLogic can be spawned and addressed by actor system id", () =>
    Effect.scoped(Effect.gen(function*() {
      const machine = StateMachine.make({
        states: [Idle, Success],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          on: {
            Submit: () => new Success({ requestId: "request-1" })
          }
        })
        .handle("Success", {
          type: "final",
          output: ({ state }) => state.requestId
        })
      const system = yield* ActorSystem.make
      const actor = yield* system.spawn(StateMachine.toActorLogic(machine, { userId: "user-1" }), {
        systemId: "user-machine-1"
      })

      const registered = yield* system.get<Submit>("user-machine-1")
      assert.strictEqual(Option.isSome(registered), true)

      yield* system.send("user-machine-1", new Submit({ value: "hello" }))

      assert.strictEqual(yield* actor.join, "request-1")
      assert.strictEqual(Option.isNone(yield* system.get("user-machine-1")), true)
    })))

  it.effect("toActorLogic provides actor identity to initial actions", () =>
    Effect.gen(function*() {
      const observed = yield* Ref.make<string | undefined>(undefined)
      const machine = StateMachine.make({
        states: [Idle],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      }).handle("Idle", {
        entry: () =>
          StateMachine.action(
            Effect.gen(function*() {
              const self = yield* StateMachine.self<Submit>()
              yield* Ref.set(observed, self.id)
            })
          )
      })

      yield* Actor.start(StateMachine.toActorLogic(machine, { userId: "user-1" }), { id: "user-machine" })

      assert.strictEqual(yield* Ref.get(observed), "user-machine")
    }))

  it.effect("toActorLogic provides actor identity to transition actions", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: [Idle, Loading, Success],
        events: [Submit, Resolve],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          on: {
            Submit: Effect.fn(function*() {
              yield* StateMachine.action(
                Effect.gen(function*() {
                  const self = yield* StateMachine.self<Submit | Resolve>()
                  yield* self.send(new Resolve({}))
                })
              )
              return new Loading({ requestId: "request-1" })
            })
          }
        })
        .handle("Loading", {
          on: {
            Resolve: () => new Success({ requestId: "request-1" })
          }
        })
        .handle("Success", {
          type: "final",
          output: ({ state }) => state.requestId
        })

      const actor = yield* Actor.start(StateMachine.toActorLogic(machine, { userId: "user-1" }))

      yield* actor.send(new Submit({ value: "hello" }))

      assert.strictEqual(yield* actor.join, "request-1")
    }))

  it.effect("toActorLogic provides parent and system scope to initial actions", () =>
    Effect.scoped(Effect.gen(function*() {
      const system = yield* ActorSystem.make
      const observedParent = yield* Ref.make<string | undefined>(undefined)
      const observedSystem = yield* Ref.make(false)
      const ready = yield* Deferred.make<void>()
      const childMachine = StateMachine.make({
        states: [Idle],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      }).handle("Idle", {
        entry: () =>
          StateMachine.action(
            Effect.gen(function*() {
              const parent = yield* StateMachine.parent
              const runtimeSystem = yield* StateMachine.system
              yield* Ref.set(observedParent, parent?.id)
              yield* Ref.set(observedSystem, runtimeSystem === system)
              yield* Deferred.succeed(ready, void 0)
            })
          )
      })
      const parentLogic = Actor.fromEffect<
        number,
        never,
        never,
        Actor.ActorChildAlreadyExistsError | StateMachine.StartupError
      >(
        0,
        ({ spawn }) =>
          Effect.gen(function*() {
            yield* spawn(StateMachine.toActorLogic(childMachine, { userId: "user-1" }), { id: "child" })
            return yield* Effect.never
          })
      )

      const parent = yield* system.spawn(parentLogic, { id: "parent" })
      yield* Deferred.await(ready)

      assert.strictEqual(yield* Ref.get(observedParent), "parent")
      assert.strictEqual(yield* Ref.get(observedSystem), true)
      yield* parent.stop
    })))

  it.effect("toActorLogic sends events from child actions to the parent", () =>
    Effect.gen(function*() {
      const childMachine = StateMachine.make({
        states: [Idle],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      }).handle("Idle", {
        entry: () =>
          StateMachine.action(
            StateMachine.sendParent(new ParentRequestProgress({ id: "request", loaded: 42 }))
          )
      })
      const parentMachine = StateMachine.make({
        states: [Idle, Success],
        events: [Submit, ParentRequestProgress],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          on: {
            Submit: Effect.fn(function*() {
              yield* StateMachine.action(
                StateMachine.actorRuntime<Submit | ParentRequestProgress>().pipe(
                  Effect.flatMap((runtime) =>
                    runtime.spawn(StateMachine.toActorLogic(childMachine, { userId: "child-user" }), {
                      id: "request"
                    })
                  ),
                  Effect.asVoid
                )
              )
            }),
            ParentRequestProgress: ({ event }) => new Success({ requestId: `${event.id}:${event.loaded}` })
          }
        })
        .handle("Success", {
          type: "final",
          output: ({ state }) => state.requestId
        })

      const actor = yield* Actor.start(StateMachine.toActorLogic(parentMachine, { userId: "parent-user" }))

      yield* actor.send(new Submit({ value: "start" }))

      assert.strictEqual(yield* actor.join, "request:42")
      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "done",
        state: new Success({ requestId: "request:42" }),
        output: "request:42"
      })
    }))

  it.effect("toActorLogic ignores sendParent when the hosting actor has no parent", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: [Idle, Success],
        events: [ParentRequestProgress],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          entry: () =>
            StateMachine.action(
              StateMachine.sendParent(new ParentRequestProgress({ id: "request", loaded: 42 }))
            ),
          on: {
            ParentRequestProgress: () => new Success({ requestId: "unexpected" })
          }
        })
        .handle("Success", {
          type: "final",
          output: ({ state }) => state.requestId
        })

      const actor = yield* Actor.start(StateMachine.toActorLogic(machine, { userId: "user-1" }))

      yield* Effect.yieldNow

      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "active",
        state: new Idle({ userId: "user-1" })
      })
      yield* actor.stop
    }))

  it.effect("toActorLogic safely handles stopOwner children spawned during initial actions", () =>
    Effect.gen(function*() {
      const childLogic = Actor.fromEffect<number, never, never, InitialError>(
        0,
        () => Effect.fail(new InitialError({ state: "child" }))
      )
      const machine = StateMachine.make({
        states: [Idle],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      }).handle("Idle", {
        entry: () =>
          StateMachine.action(
            Effect.gen(function*() {
              const runtime = yield* StateMachine.actorRuntime<Submit>()
              yield* runtime.spawn(childLogic, {
                id: "child",
                supervision: Actor.Supervision.stopOwner
              })
              yield* Effect.yieldNow
            })
          )
      })

      const actor = yield* Actor.start(StateMachine.toActorLogic(machine, { userId: "user-1" }))
      const stopped = yield* Effect.flip(actor.join)

      assert.strictEqual(stopped._tag, "ActorStoppedError")
      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "stopped",
        state: new Idle({ userId: "user-1" })
      })
    }))

  it.effect("toActorLogic spawns children from machine actions and sends to them by id", () =>
    Effect.gen(function*() {
      const childRef = yield* Deferred.make<Actor.Actor<number, ChildPing, never, void>>()
      const childLogic = Actor.fromEffect<number, ChildPing>(
        0,
        ({ receive }) =>
          receive.pipe(
            Effect.flatMap((event) => Deferred.succeed(event.reply, void 0)),
            Effect.forever
          )
      )
      const machine = StateMachine.make({
        states: [Idle, Loading, Success],
        events: [Submit, Resolve],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          on: {
            Submit: Effect.fn(function*() {
              yield* StateMachine.action(
                Effect.gen(function*() {
                  const child = yield* StateMachine.spawn(childLogic, { id: "child" })
                  const reply = yield* Deferred.make<void>()
                  yield* Deferred.succeed(childRef, child)
                  yield* StateMachine.sendTo("child", new ChildPing({ reply }))
                  yield* Deferred.await(reply)
                })
              )
              return new Loading({ requestId: "request-1" })
            })
          }
        })
        .handle("Loading", {
          on: {
            Resolve: () => new Success({ requestId: "request-1" })
          }
        })
        .handle("Success", {
          type: "final",
          entry: () => StateMachine.action(StateMachine.stopChild("child")),
          output: ({ state }) => state.requestId
        })

      const actor = yield* Actor.start(StateMachine.toActorLogic(machine, { userId: "user-1" }))
      yield* actor.send(new Submit({ value: "hello" }))
      const child = yield* Deferred.await(childRef)

      yield* actor.send(new Resolve({}))

      assert.strictEqual(yield* actor.join, "request-1")
      assert.deepStrictEqual(yield* child.snapshot, {
        status: "stopped",
        state: 0
      })
    }))

  it.effect("toActorLogic returns spawned child refs to machine actions", () =>
    Effect.gen(function*() {
      const childRef = yield* Deferred.make<Actor.Actor<number, ChildPing, never, void>>()
      const childLogic = Actor.fromEffect<number, ChildPing>(
        0,
        ({ receive }) =>
          receive.pipe(
            Effect.flatMap((event) => Deferred.succeed(event.reply, void 0)),
            Effect.forever
          )
      )
      const machine = StateMachine.make({
        states: [Idle, Loading, Success],
        events: [Submit, Resolve],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          on: {
            Submit: Effect.fn(function*() {
              yield* StateMachine.action(
                Effect.gen(function*() {
                  const child = yield* StateMachine.spawn(childLogic, { id: "child" })
                  const reply = yield* Deferred.make<void>()
                  yield* Deferred.succeed(childRef, child)
                  yield* child.send(new ChildPing({ reply }))
                  yield* Deferred.await(reply)
                })
              )
              return new Loading({ requestId: "request-1" })
            })
          }
        })
        .handle("Loading", {
          on: {
            Resolve: () => new Success({ requestId: "request-1" })
          }
        })
        .handle("Success", {
          type: "final",
          entry: () => StateMachine.action(StateMachine.stopChild("child")),
          output: ({ state }) => state.requestId
        })

      const actor = yield* Actor.start(StateMachine.toActorLogic(machine, { userId: "user-1" }))
      yield* actor.send(new Submit({ value: "hello" }))
      const child = yield* Deferred.await(childRef)

      yield* actor.send(new Resolve({}))

      assert.strictEqual(yield* actor.join, "request-1")
      assert.deepStrictEqual(yield* child.snapshot, {
        status: "stopped",
        state: 0
      })
    }))

  it.effect("toActorLogic fails when machine actions spawn duplicate child ids", () =>
    Effect.gen(function*() {
      const childLogic = Actor.fromEffect<number, never>(0, () => Effect.never)
      const machine = StateMachine.make({
        states: [Idle, Loading],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          on: {
            Submit: Effect.fn(function*() {
              yield* StateMachine.action(
                Effect.gen(function*() {
                  yield* StateMachine.spawn(childLogic, { id: "worker" })
                  yield* StateMachine.spawn(childLogic, { id: "worker" })
                })
              )
              return new Loading({ requestId: "request-1" })
            })
          }
        })
        .handle("Loading", {})

      const actor = yield* Actor.start(StateMachine.toActorLogic(machine, { userId: "user-1" }))

      yield* actor.send(new Submit({ value: "hello" }))
      const error = yield* Effect.flip(actor.join)

      assert.strictEqual(error._tag, "ActorChildAlreadyExistsError")
      if (error._tag === "ActorChildAlreadyExistsError") {
        assert.strictEqual(error.id, "worker")
      }
      const snapshot = yield* actor.snapshot
      assert.strictEqual(snapshot.status, "error")
    }))

  it.effect("toActorLogic invokes a child actor and handles its output event", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: [Idle, Loading, Success],
        events: [Submit, RequestSucceeded],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          on: {
            Submit: () => new Loading({ requestId: "request-1" })
          }
        })
        .handle("Loading", {
          invoke: StateMachine.invoke({
            id: "request",
            src: ({ state }) => Actor.fromEffect("pending", () => Effect.succeed(`done:${state.requestId}`)),
            event: ({ outcome }) =>
              outcome._tag === "Done" ? new RequestSucceeded({ value: outcome.output }) : undefined
          }),
          on: {
            RequestSucceeded: ({ event }) => new Success({ requestId: event.value })
          }
        })
        .handle("Success", {
          type: "final",
          output: ({ state }) => state.requestId
        })

      const actor = yield* Actor.start(StateMachine.toActorLogic(machine, { userId: "user-1" }))

      yield* actor.send(new Submit({ value: "hello" }))

      assert.strictEqual(yield* actor.join, "done:request-1")
      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "done",
        state: new Success({ requestId: "done:request-1" }),
        output: "done:request-1"
      })
    }))

  it.effect("toActorLogic maps invoked child failures to machine events", () =>
    Effect.gen(function*() {
      const error = new InvokeError({ message: "boom" })
      const machine = StateMachine.make({
        states: [Idle, Loading, Failed],
        events: [Submit, RequestFailed],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          on: {
            Submit: () => new Loading({ requestId: "request-1" })
          }
        })
        .handle("Loading", {
          invoke: StateMachine.invoke({
            id: "request",
            src: () => Actor.fromEffect("pending", () => Effect.fail(error)),
            event: ({ outcome }) =>
              outcome._tag === "Failure"
                ? new RequestFailed({ error: outcome.error, cause: outcome.cause })
                : undefined
          }),
          on: {
            RequestFailed: ({ event }) => new Failed({ message: event.error.message })
          }
        })
        .handle("Failed", {
          type: "final",
          output: ({ state }) => state.message
        })

      const actor = yield* Actor.start(StateMachine.toActorLogic(machine, { userId: "user-1" }))

      yield* actor.send(new Submit({ value: "hello" }))

      assert.strictEqual(yield* actor.join, "boom")
      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "done",
        state: new Failed({ message: "boom" }),
        output: "boom"
      })
    }))

  it.effect("toActorLogic maps invoked child active snapshots to machine events", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: [Idle, Loading, Success],
        events: [Submit, RequestProgress],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          on: {
            Submit: () => new Loading({ requestId: "request-1" })
          }
        })
        .handle("Loading", {
          invoke: StateMachine.invoke({
            id: "request",
            src: () => Actor.fromEffect("pending", () => Effect.never),
            snapshot: ({ id, snapshot }) => new RequestProgress({ id, childState: snapshot.state })
          }),
          on: {
            RequestProgress: ({ event }) => new Success({ requestId: `${event.id}:${event.childState}` })
          }
        })
        .handle("Success", {
          type: "final",
          output: ({ state }) => state.requestId
        })

      const actor = yield* Actor.start(StateMachine.toActorLogic(machine, { userId: "user-1" }))

      yield* actor.send(new Submit({ value: "hello" }))

      assert.strictEqual(yield* actor.join, "request:pending")
      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "done",
        state: new Success({ requestId: "request:pending" }),
        output: "request:pending"
      })
    }))

  it.effect("toActorLogic lets invoke snapshot mappers filter with undefined", () =>
    Effect.gen(function*() {
      const started = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const machine = StateMachine.make({
        states: [Idle, Loading, Success],
        events: [Submit, RequestProgress],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          on: {
            Submit: () => new Loading({ requestId: "request-1" })
          }
        })
        .handle("Loading", {
          invoke: StateMachine.invoke({
            id: "request",
            src: () =>
              Actor.fromEffect("pending", ({ setState }) =>
                Deferred.succeed(started, void 0).pipe(
                  Effect.andThen(Deferred.await(release)),
                  Effect.andThen(setState("ready")),
                  Effect.andThen(Effect.never)
                )),
            snapshot: ({ id, snapshot }) =>
              snapshot.state === "ready" ? new RequestProgress({ id, childState: snapshot.state }) : undefined
          }),
          on: {
            RequestProgress: ({ event }) => new Success({ requestId: event.childState })
          }
        })
        .handle("Success", {
          type: "final",
          output: ({ state }) => state.requestId
        })

      const actor = yield* Actor.start(StateMachine.toActorLogic(machine, { userId: "user-1" }))

      yield* actor.send(new Submit({ value: "hello" }))
      yield* Deferred.await(started)
      yield* Effect.yieldNow

      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "active",
        state: new Loading({ requestId: "request-1" })
      })

      yield* Deferred.succeed(release, void 0)

      assert.strictEqual(yield* actor.join, "ready")
      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "done",
        state: new Success({ requestId: "ready" }),
        output: "ready"
      })
    }))

  it.effect("toActorLogic allows invoked children without snapshot or event mappers", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: [Idle, Loading],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          on: {
            Submit: () => new Loading({ requestId: "request-1" })
          }
        })
        .handle("Loading", {
          invoke: StateMachine.invoke({
            id: "request",
            src: () => Actor.fromEffect("pending", () => Effect.succeed("done"))
          })
        })

      const actor = yield* Actor.start(StateMachine.toActorLogic(machine, { userId: "user-1" }))

      yield* actor.send(new Submit({ value: "hello" }))
      yield* Effect.yieldNow

      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "active",
        state: new Loading({ requestId: "request-1" })
      })

      yield* actor.stop
    }))

  it.effect("toActorLogic stops invoked children when leaving a state and ignores stale snapshots", () =>
    Effect.gen(function*() {
      const started = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const resetHandled = yield* Deferred.make<void>()
      const machine = StateMachine.make({
        states: [Idle, Loading, Success],
        events: [Submit, Reset, RequestProgress],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          on: {
            Submit: () => new Loading({ requestId: "request-1" })
          }
        })
        .handle("Loading", {
          invoke: StateMachine.invoke({
            id: "request",
            src: () =>
              Actor.fromEffect("pending", ({ setState }) =>
                Deferred.succeed(started, void 0).pipe(
                  Effect.andThen(Deferred.await(release)),
                  Effect.andThen(setState("ready")),
                  Effect.andThen(Effect.never)
                )),
            snapshot: ({ id, snapshot }) =>
              snapshot.state === "ready" ? new RequestProgress({ id, childState: snapshot.state }) : undefined
          }),
          on: {
            Reset: Effect.fn(function*() {
              yield* StateMachine.action(Deferred.succeed(resetHandled, void 0))
              return new Idle({ userId: "user-1" })
            }),
            RequestProgress: ({ event }) => new Success({ requestId: event.childState })
          }
        })
        .handle("Success", {
          type: "final"
        })

      const actor = yield* Actor.start(StateMachine.toActorLogic(machine, { userId: "user-1" }))

      yield* actor.send(new Submit({ value: "hello" }))
      yield* Deferred.await(started)
      yield* actor.send(new Reset({}))
      yield* Deferred.await(resetHandled)
      yield* Deferred.succeed(release, void 0)
      yield* Effect.yieldNow

      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "active",
        state: new Idle({ userId: "user-1" })
      })

      yield* actor.stop
    }))

  it.effect("toActorLogic stops invoked children when leaving a state and ignores stale outcomes", () =>
    Effect.gen(function*() {
      const started = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const resetHandled = yield* Deferred.make<void>()
      const machine = StateMachine.make({
        states: [Idle, Loading, Success],
        events: [Submit, Reset, RequestSucceeded],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          on: {
            Submit: () => new Loading({ requestId: "request-1" })
          }
        })
        .handle("Loading", {
          invoke: StateMachine.invoke({
            id: "request",
            src: () =>
              Actor.fromEffect("pending", () =>
                Deferred.succeed(started, void 0).pipe(
                  Effect.andThen(Deferred.await(release)),
                  Effect.as("late")
                )),
            event: ({ outcome }) =>
              outcome._tag === "Done" ? new RequestSucceeded({ value: outcome.output }) : undefined
          }),
          on: {
            Reset: Effect.fn(function*() {
              yield* StateMachine.action(Deferred.succeed(resetHandled, void 0))
              return new Idle({ userId: "user-1" })
            }),
            RequestSucceeded: ({ event }) => new Success({ requestId: event.value })
          }
        })
        .handle("Success", {
          type: "final"
        })

      const actor = yield* Actor.start(StateMachine.toActorLogic(machine, { userId: "user-1" }))

      yield* actor.send(new Submit({ value: "hello" }))
      yield* Deferred.await(started)
      yield* actor.send(new Reset({}))
      yield* Deferred.await(resetHandled)
      yield* Deferred.succeed(release, void 0)
      yield* Effect.yieldNow

      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "active",
        state: new Idle({ userId: "user-1" })
      })

      yield* actor.stop
    }))

  it.effect("toActorLogic keeps invokes on implicit self-transitions and restarts them on reentry", () =>
    Effect.gen(function*() {
      const firstStarted = yield* Deferred.make<void>()
      const secondStarted = yield* Deferred.make<void>()
      const resolved = yield* Deferred.make<void>()
      const resetHandled = yield* Deferred.make<void>()
      const starts = yield* Ref.make(0)
      const childLogic = Actor.fromEffect("pending", () =>
        Effect.gen(function*() {
          const count = yield* Ref.updateAndGet(starts, (count) => count + 1)
          if (count === 1) {
            yield* Deferred.succeed(firstStarted, void 0)
          } else if (count === 2) {
            yield* Deferred.succeed(secondStarted, void 0)
          }
          return yield* Effect.never
        }))
      const machine = StateMachine.make({
        states: [Idle, Loading],
        events: [Submit, Reset, Resolve, RequestSucceeded],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          on: {
            Submit: () => new Loading({ requestId: "request-1" })
          }
        })
        .handle("Loading", {
          invoke: StateMachine.invoke({
            id: "request",
            src: () => childLogic,
            event: ({ outcome }) =>
              outcome._tag === "Done" ? new RequestSucceeded({ value: outcome.output }) : undefined
          }),
          on: {
            Resolve: Effect.fn(function*() {
              yield* StateMachine.action(Deferred.succeed(resolved, void 0))
            }),
            Reset: {
              reenter: true,
              transition: Effect.fn(function*() {
                yield* StateMachine.action(Deferred.succeed(resetHandled, void 0))
                return new Loading({ requestId: "request-2" })
              })
            }
          }
        })

      const actor = yield* Actor.start(StateMachine.toActorLogic(machine, { userId: "user-1" }))

      yield* actor.send(new Submit({ value: "hello" }))
      yield* Deferred.await(firstStarted)
      yield* actor.send(new Resolve({}))
      yield* Deferred.await(resolved)
      yield* Effect.yieldNow

      assert.strictEqual(yield* Ref.get(starts), 1)

      yield* actor.send(new Reset({}))
      yield* Deferred.await(resetHandled)
      yield* Deferred.await(secondStarted)

      assert.strictEqual(yield* Ref.get(starts), 2)
      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "active",
        state: new Loading({ requestId: "request-2" })
      })

      yield* actor.stop
    }))

  it.effect("toActorLogic propagates startup failures through Actor.start", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: [Idle],
        events: [Submit],
        input: Input,
        initial: Effect.fn(function*({ userId }) {
          const state = new Idle({ userId })
          yield* StateMachine.action(Effect.fail(new InitialError({ state: state._tag })))
          return state
        })
      })

      const error = yield* Effect.flip(Actor.start(StateMachine.toActorLogic(machine, { userId: "user-1" })))

      assert.instanceOf(error, InitialError)
      assert.strictEqual(error._tag, "InitialError")
      assert.strictEqual(error.state, "Idle")
    }))

  it.effect("sending an event that is not handled by the current state fails", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        id: "UserMachine",
        states: [Idle, Loading],
        events: [Submit, Reset],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          on: {
            Submit: Effect.fn(function*() {
              yield* StateMachine.action(Effect.succeed("submitted"))
              return new Loading({ requestId: "request-1" })
            })
          }
        })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" })

      assert.deepStrictEqual(yield* actor.state, new Idle({ userId: "user-1" }))

      const error = yield* Effect.flip(actor.send(new Reset({})))

      assert.instanceOf(error, StateMachine.UnhandledEventError)
      assert.strictEqual(error._tag, "UnhandledEventError")
      assert.strictEqual(error.machineId, "UserMachine")
      assert.strictEqual(error.state, "Idle")
      assert.strictEqual(error.event, "Reset")
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
          on: {
            Submit: Effect.fn(function*() {
              yield* StateMachine.action(
                Effect.gen(function*() {
                  const deferredLog = yield* DeferredLog
                  yield* deferredLog.push("submitted")
                })
              )

              return new Loading({ requestId: "request-1" })
            })
          }
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
          on: {
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
          }
        })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" })

      yield* actor.send(new Submit({ value: "hello" })).pipe(
        Effect.provideService(DeferredLog, deferredLog)
      )

      assert.deepStrictEqual(yield* deferredLog.read, ["submitted1", "submitted2"])
      assert.deepStrictEqual(yield* actor.state, new Loading({ requestId: "request-1" }))
    }))

  it.effect("runs exit, transition, and entry actions in order", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: [Idle, Loading],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          exit: Effect.fn(function*({ event }) {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push(`exit:${event._tag}`))
          }),
          on: {
            Submit: Effect.fn(function*() {
              const deferredLog = yield* DeferredLog
              yield* StateMachine.action(deferredLog.push("transition"))
              return new Loading({ requestId: "request-1" })
            })
          }
        })
        .handle("Loading", {
          entry: Effect.fn(function*({ event }) {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push(`entry:${event._tag}`))
          })
        })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" })

      yield* actor.send(new Submit({ value: "hello" })).pipe(
        Effect.provideService(DeferredLog, deferredLog)
      )

      assert.deepStrictEqual(yield* deferredLog.read, ["exit:Submit", "transition", "entry:Submit"])
      assert.deepStrictEqual(yield* actor.state, new Loading({ requestId: "request-1" }))
    }))

  it.effect("plan collects entry and exit actions without running them", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: [Idle, Loading],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          exit: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("exit"))
          }),
          on: {
            Submit: Effect.fn(function*() {
              const deferredLog = yield* DeferredLog
              yield* StateMachine.action(deferredLog.push("transition"))
              return new Loading({ requestId: "request-1" })
            })
          }
        })
        .handle("Loading", {
          entry: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("entry"))
          })
        })

      const planned = yield* StateMachine.plan(
        machine,
        new Idle({ userId: "user-1" }),
        new Submit({ value: "hello" })
      ).pipe(Effect.provideService(DeferredLog, deferredLog))

      assert.deepStrictEqual(planned.next, new Loading({ requestId: "request-1" }))
      assert.strictEqual(planned.actions.length, 3)
      assert.deepStrictEqual(yield* deferredLog.read, [])
    }))

  it.effect("plan follows always transitions to a settled state", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: [Idle, Loading, Success],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          on: {
            Submit: Effect.fn(function*() {
              const deferredLog = yield* DeferredLog
              yield* StateMachine.action(deferredLog.push("submit"))
              return new Loading({ requestId: "request-1" })
            })
          }
        })
        .handle("Loading", {
          always: Effect.fn(function*({ event, state }) {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push(`always:${event._tag}`))
            return new Success({ requestId: state.requestId })
          })
        })

      const planned = yield* StateMachine.plan(
        machine,
        new Idle({ userId: "user-1" }),
        new Submit({ value: "hello" })
      ).pipe(Effect.provideService(DeferredLog, deferredLog))

      assert.deepStrictEqual(planned.next, new Success({ requestId: "request-1" }))
      assert.strictEqual(planned.microsteps.length, 2)
      assert.strictEqual(planned.actions.length, 2)
      assert.deepStrictEqual(yield* deferredLog.read, [])
    }))

  it.effect("send follows always transitions before exposing the actor state", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: [Idle, Loading, Success],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          on: {
            Submit: Effect.fn(function*() {
              const deferredLog = yield* DeferredLog
              yield* StateMachine.action(deferredLog.push("submit"))
              return new Loading({ requestId: "request-1" })
            })
          }
        })
        .handle("Loading", {
          always: Effect.fn(function*({ state }) {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("always"))
            return new Success({ requestId: state.requestId })
          })
        })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" })

      yield* actor.send(new Submit({ value: "hello" })).pipe(
        Effect.provideService(DeferredLog, deferredLog)
      )

      assert.deepStrictEqual(yield* actor.state, new Success({ requestId: "request-1" }))
      assert.deepStrictEqual(yield* deferredLog.read, ["submit", "always"])
    }))

  it.effect("plan processes raised events before settling", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: [Idle, Loading, Success],
        events: [Submit, Resolve],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          on: {
            Submit: Effect.fn(function*() {
              yield* StateMachine.raise(new Resolve({}))
              return new Loading({ requestId: "request-1" })
            })
          }
        })
        .handle("Loading", {
          on: {
            Resolve: ({ state }) => new Success({ requestId: state.requestId })
          }
        })

      const planned = yield* StateMachine.plan(
        machine,
        new Idle({ userId: "user-1" }),
        new Submit({ value: "hello" })
      )

      assert.deepStrictEqual(planned.next, new Success({ requestId: "request-1" }))
      assert.strictEqual(planned.microsteps.length, 2)
    }))

  it.effect("send processes raised events from entry actions", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: [Idle, Loading, Success],
        events: [Submit, Resolve],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          on: {
            Submit: () => new Loading({ requestId: "request-1" })
          }
        })
        .handle("Loading", {
          entry: () => StateMachine.raise(new Resolve({})),
          on: {
            Resolve: ({ state }) => new Success({ requestId: state.requestId })
          }
        })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" })

      yield* actor.send(new Submit({ value: "hello" }))

      assert.deepStrictEqual(yield* actor.state, new Success({ requestId: "request-1" }))
    }))

  it.effect("processes raised events in FIFO order", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: [Idle, Loading, Success],
        events: [Submit, Reset, Resolve],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          on: {
            Submit: Effect.fn(function*() {
              yield* StateMachine.raise(new Reset({}))
              yield* StateMachine.raise(new Resolve({}))
              return new Loading({ requestId: "request-1" })
            })
          }
        })
        .handle("Loading", {
          on: {
            Reset: ({ state }) => new Success({ requestId: state.requestId })
          }
        })
        .handle("Success", {
          on: {
            Resolve: () => new Loading({ requestId: "request-2" })
          }
        })

      const planned = yield* StateMachine.plan(
        machine,
        new Idle({ userId: "user-1" }),
        new Submit({ value: "hello" })
      )

      assert.deepStrictEqual(planned.next, new Loading({ requestId: "request-2" }))
      assert.strictEqual(planned.microsteps.length, 3)
    }))

  it.effect("queues events raised from exit actions before transition actions", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: [Idle, Loading],
        events: [Submit, Reset, Resolve],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          exit: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("exit"))
            yield* StateMachine.raise(new Reset({}))
          }),
          on: {
            Submit: Effect.fn(function*() {
              const deferredLog = yield* DeferredLog
              yield* StateMachine.action(deferredLog.push("transition"))
              yield* StateMachine.raise(new Resolve({}))
              return new Loading({ requestId: "request-1" })
            })
          }
        })
        .handle("Loading", {
          on: {
            Reset: Effect.fn(function*() {
              const deferredLog = yield* DeferredLog
              yield* StateMachine.action(deferredLog.push("reset"))
            }),
            Resolve: Effect.fn(function*() {
              const deferredLog = yield* DeferredLog
              yield* StateMachine.action(deferredLog.push("resolve"))
            })
          }
        })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" }).pipe(
        Effect.provideService(DeferredLog, deferredLog)
      )

      yield* actor.send(new Submit({ value: "hello" })).pipe(
        Effect.provideService(DeferredLog, deferredLog)
      )

      assert.deepStrictEqual(yield* deferredLog.read, ["exit", "transition", "reset", "resolve"])
      assert.deepStrictEqual(yield* actor.state, new Loading({ requestId: "request-1" }))
    }))

  it.effect("selects always transitions before raised events", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: [Idle, Loading, Success],
        events: [Submit, Reset],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          on: {
            Submit: Effect.fn(function*() {
              yield* StateMachine.raise(new Reset({}))
              return new Loading({ requestId: "request-1" })
            })
          }
        })
        .handle("Loading", {
          always: ({ state }) => new Success({ requestId: state.requestId }),
          on: {
            Reset: () => new Idle({ userId: "wrong" })
          }
        })
        .handle("Success", {
          on: {
            Reset: () => new Loading({ requestId: "request-2" })
          }
        })

      const planned = yield* StateMachine.plan(
        machine,
        new Idle({ userId: "user-1" }),
        new Submit({ value: "hello" })
      )

      assert.deepStrictEqual(planned.next, new Success({ requestId: "request-2" }))
      assert.strictEqual(planned.microsteps.length, 4)
    }))

  it.effect("stops following always transitions after a no-op microstep", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: [Idle, Loading],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          on: {
            Submit: () => new Loading({ requestId: "request-1" })
          }
        })
        .handle("Loading", {
          always: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("always"))
          })
        })

      const planned = yield* StateMachine.plan(
        machine,
        new Idle({ userId: "user-1" }),
        new Submit({ value: "hello" })
      ).pipe(Effect.provideService(DeferredLog, deferredLog))

      assert.deepStrictEqual(planned.next, new Loading({ requestId: "request-1" }))
      assert.strictEqual(planned.microsteps.length, 2)
      assert.strictEqual(planned.microsteps[1]?.changed, false)
    }))

  it.effect("fails when always transitions do not stabilize", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        id: "LoopMachine",
        states: [Idle, Loading],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          always: () => new Loading({ requestId: "request-1" }),
          on: {
            Submit: () => new Loading({ requestId: "request-1" })
          }
        })
        .handle("Loading", {
          always: () => new Idle({ userId: "user-1" })
        })

      const error = yield* Effect.flip(
        StateMachine.plan(machine, new Idle({ userId: "user-1" }), new Submit({ value: "hello" }))
      )

      assert.instanceOf(error, StateMachine.InfiniteTransitionError)
      assert.strictEqual(error._tag, "InfiniteTransitionError")
      assert.strictEqual(error.machineId, "LoopMachine")
      assert.strictEqual(error.maxIterations, 1000)
    }))

  it.effect("does not run entry or exit actions for implicit self-transitions", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: [Idle, Loading],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      }).handle("Idle", {
        entry: Effect.fn(function*() {
          const deferredLog = yield* DeferredLog
          yield* StateMachine.action(deferredLog.push("entry"))
        }),
        exit: Effect.fn(function*() {
          const deferredLog = yield* DeferredLog
          yield* StateMachine.action(deferredLog.push("exit"))
        }),
        on: {
          Submit: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("transition"))
          })
        }
      })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" }).pipe(
        Effect.provideService(DeferredLog, deferredLog)
      )

      yield* actor.send(new Submit({ value: "hello" })).pipe(
        Effect.provideService(DeferredLog, deferredLog)
      )

      assert.deepStrictEqual(yield* deferredLog.read, ["entry", "transition"])
      assert.deepStrictEqual(yield* actor.state, new Idle({ userId: "user-1" }))
    }))

  it.effect("runs exit, transition, and entry actions for reentering self-transitions", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: [Idle],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      }).handle("Idle", {
        entry: Effect.fn(function*({ event }) {
          const deferredLog = yield* DeferredLog
          yield* StateMachine.action(deferredLog.push(`entry:${String(event._tag)}`))
        }),
        exit: Effect.fn(function*({ event }) {
          const deferredLog = yield* DeferredLog
          yield* StateMachine.action(deferredLog.push(`exit:${event._tag}`))
        }),
        on: {
          Submit: {
            reenter: true,
            transition: Effect.fn(function*() {
              const deferredLog = yield* DeferredLog
              yield* StateMachine.action(deferredLog.push("transition"))
              return new Idle({ userId: "user-2" })
            })
          }
        }
      })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" }).pipe(
        Effect.provideService(DeferredLog, deferredLog)
      )

      yield* actor.send(new Submit({ value: "hello" })).pipe(
        Effect.provideService(DeferredLog, deferredLog)
      )

      assert.deepStrictEqual(yield* deferredLog.read, [
        "entry:Symbol(effect/StateMachine/InitialEvent)",
        "exit:Submit",
        "transition",
        "entry:Submit"
      ])
      assert.deepStrictEqual(yield* actor.state, new Idle({ userId: "user-2" }))
    }))

  it.effect("reentering self-transitions can omit returning a state", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: [Idle],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      }).handle("Idle", {
        entry: Effect.fn(function*({ event }) {
          const deferredLog = yield* DeferredLog
          yield* StateMachine.action(deferredLog.push(`entry:${String(event._tag)}`))
        }),
        exit: Effect.fn(function*({ event }) {
          const deferredLog = yield* DeferredLog
          yield* StateMachine.action(deferredLog.push(`exit:${event._tag}`))
        }),
        on: {
          Submit: {
            reenter: true,
            transition: Effect.fn(function*() {
              const deferredLog = yield* DeferredLog
              yield* StateMachine.action(deferredLog.push("transition"))
            })
          }
        }
      })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" }).pipe(
        Effect.provideService(DeferredLog, deferredLog)
      )

      yield* actor.send(new Submit({ value: "hello" })).pipe(
        Effect.provideService(DeferredLog, deferredLog)
      )

      assert.deepStrictEqual(yield* deferredLog.read, [
        "entry:Symbol(effect/StateMachine/InitialEvent)",
        "exit:Submit",
        "transition",
        "entry:Submit"
      ])
      assert.deepStrictEqual(yield* actor.state, new Idle({ userId: "user-1" }))
    }))

  it.effect("carries entry and exit action requirements", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: [Idle, Loading],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          exit: () =>
            ExitRequirement.pipe(
              Effect.flatMap((requirement) =>
                StateMachine.action(
                  DeferredLog.pipe(Effect.flatMap((deferredLog) => deferredLog.push(requirement.exitMessage)))
                )
              )
            ),
          on: {
            Submit: (): Loading => new Loading({ requestId: "request-1" })
          }
        })
        .handle("Loading", {
          entry: () =>
            EntryRequirement.pipe(
              Effect.flatMap((requirement) =>
                StateMachine.action(
                  DeferredLog.pipe(Effect.flatMap((deferredLog) => deferredLog.push(requirement.entryMessage)))
                )
              )
            )
        })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" })

      yield* actor.send(new Submit({ value: "hello" })).pipe(
        Effect.provideService(EntryRequirement, EntryRequirement.of({ entryMessage: "entry" })),
        Effect.provideService(ExitRequirement, ExitRequirement.of({ exitMessage: "exit" })),
        Effect.provideService(DeferredLog, deferredLog)
      )

      assert.deepStrictEqual(yield* deferredLog.read, ["exit", "entry"])
      assert.deepStrictEqual(yield* actor.state, new Loading({ requestId: "request-1" }))
    }))

  it.effect("propagates entry action failures", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: [Idle, Loading],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      })
        .handle("Idle", {
          on: {
            Submit: () => new Loading({ requestId: "request-1" })
          }
        })
        .handle("Loading", {
          entry: ({ state }) => StateMachine.action(Effect.fail(new EntryError({ state: state._tag })))
        })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" })
      const error = yield* Effect.flip(actor.send(new Submit({ value: "hello" })))

      assert.instanceOf(error, EntryError)
      assert.strictEqual(error._tag, "EntryError")
      assert.strictEqual(error.state, "Loading")
    }))

  it.effect("propagates exit action failures", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: [Idle, Loading],
        events: [Submit],
        input: Input,
        initial: (input) => new Idle({ userId: input.userId })
      }).handle("Idle", {
        exit: ({ state }) => StateMachine.action(Effect.fail(new ExitError({ state: state._tag }))),
        on: {
          Submit: () => new Loading({ requestId: "request-1" })
        }
      })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" })
      const error = yield* Effect.flip(actor.send(new Submit({ value: "hello" })))

      assert.instanceOf(error, ExitError)
      assert.strictEqual(error._tag, "ExitError")
      assert.strictEqual(error.state, "Idle")
    }))
})
