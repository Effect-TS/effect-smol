import { assert, describe, it } from "@effect/vitest"
import { Cause, Context, Data, Effect, Ref, Schema, StateMachine } from "effect"

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

  class Submit extends Schema.TaggedClass<Submit>("Submit")("Submit", {
    value: Schema.String
  }) {}

  class Reset extends Schema.TaggedClass<Reset>("Reset")("Reset", {}) {}
  class Resolve extends Schema.TaggedClass<Resolve>("Resolve")("Resolve", {}) {}

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
