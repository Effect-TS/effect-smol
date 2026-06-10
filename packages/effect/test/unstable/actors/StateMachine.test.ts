import { assert, describe, it } from "@effect/vitest"
import { Cause, Context, Data, Deferred, Effect, Fiber, Option, Ref, Schema, Stream } from "effect"
import { Actor, ActorSystem, StateMachine } from "effect/unstable/actors"

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

const waitForSnapshot = <State, Event, Error, Output>(
  actor: Actor.Actor<State, Event, Error, Output>,
  predicate: (snapshot: Actor.Snapshot<State, Error, Output>) => boolean
) =>
  actor.changes.pipe(
    Stream.filter(predicate),
    Stream.take(1),
    Stream.runCollect,
    Effect.map((snapshots) => Array.from(snapshots)[0] as Actor.Snapshot<State, Error, Output>)
  )

const sendAndWaitForSnapshot = <State, Event, Error, Output>(
  actor: Actor.Actor<State, Event, Error, Output>,
  event: Event,
  predicate: (snapshot: Actor.Snapshot<State, Error, Output>) => boolean
) =>
  Effect.gen(function*() {
    const observer = yield* waitForSnapshot(actor, predicate).pipe(Effect.forkChild)
    yield* actor.send(event)
    return yield* Fiber.join(observer)
  })

const assertStateSnapshot = <Path extends string, Value>(
  actual: StateMachine.Machine.AtomicSnapshot<Path, Value>,
  path: Path,
  value: Value
) => {
  assert.strictEqual(actual.path, path)
  assert.deepStrictEqual(actual.value, value)
}

const assertCompoundStateSnapshot = <Path extends string, Value, Child>(
  actual: StateMachine.Machine.CompoundSnapshot<Path, Value, Child>,
  path: Path,
  value: Value,
  state: Child
) => {
  assert.strictEqual(actual.path, path)
  assert.deepStrictEqual(actual.value, value)
  assert.deepStrictEqual(actual.state, state)
}

const assertParallelStateSnapshot = <Path extends string, Value, States>(
  actual: StateMachine.Machine.ParallelSnapshot<Path, Value, States>,
  path: Path,
  value: Value,
  states: States
) => {
  assert.strictEqual(actual.path, path)
  assert.deepStrictEqual(actual.value, value)
  assert.deepStrictEqual(actual.states, states)
}

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

  class Duplicate extends Schema.TaggedClass<Duplicate>("Duplicate")("Duplicate", {
    value: Schema.String
  }) {}

  class Payment extends Schema.TaggedClass<Payment>("Payment")("Payment", {
    id: Schema.String
  }) {}

  class EnteringPayment extends Schema.TaggedClass<EnteringPayment>("EnteringPayment")("EnteringPayment", {
    amount: Schema.Number
  }) {}

  class AuthorizedPayment extends Schema.TaggedClass<AuthorizedPayment>("AuthorizedPayment")("AuthorizedPayment", {
    code: Schema.String
  }) {}

  class Fulfillment extends Schema.TaggedClass<Fulfillment>("Fulfillment")("Fulfillment", {
    id: Schema.String
  }) {}

  class Inventory extends Schema.TaggedClass<Inventory>("Inventory")("Inventory", {
    warehouse: Schema.String
  }) {}

  class CheckingInventory extends Schema.TaggedClass<CheckingInventory>("CheckingInventory")("CheckingInventory", {
    sku: Schema.String
  }) {}

  class InventoryReserved extends Schema.TaggedClass<InventoryReserved>("InventoryReserved")("InventoryReserved", {
    reservationId: Schema.String
  }) {}

  class Shipping extends Schema.TaggedClass<Shipping>("Shipping")("Shipping", {
    address: Schema.String
  }) {}

  class QuotingShipping extends Schema.TaggedClass<QuotingShipping>("QuotingShipping")("QuotingShipping", {
    postalCode: Schema.String
  }) {}

  class ShippingQuoted extends Schema.TaggedClass<ShippingQuoted>("ShippingQuoted")("ShippingQuoted", {
    quoteId: Schema.String
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
  class Authorize extends Schema.TaggedClass<Authorize>("Authorize")("Authorize", {
    code: Schema.String
  }) {}
  class ReserveInventory extends Schema.TaggedClass<ReserveInventory>("ReserveInventory")("ReserveInventory", {
    reservationId: Schema.String
  }) {}
  class ChildPing extends Data.TaggedClass("ChildPing")<{
    readonly reply: Deferred.Deferred<void>
  }> {}

  const FlatInitial = StateMachine.defineStates({ Idle, Loading, Success, Failed }).initial
  const LowercaseInitial = StateMachine.defineStates({ idle: Idle, loading: Loading, success: Success }).initial
  const DuplicateInitial = StateMachine.defineStates({ a: Duplicate, b: Duplicate }).initial

  it.effect("make constructs the initial state from input", () =>
    Effect.gen(function*() {
      const states = StateMachine.defineStates({ Idle })
      const machine = StateMachine.make({
        states: states.states,
        events: [Submit],
        input: Input,
        initial: (input) => states.initial.Idle(new Idle({ userId: input.userId }))
      })

      const planned = yield* StateMachine.planInitial(machine, { userId: "user-1" })

      assert.strictEqual(StateMachine.isMachine(machine), true)
      assert.deepStrictEqual(planned.state.value, new Idle({ userId: "user-1" }))
    }))

  it("make stores the machine id", () => {
    const states = StateMachine.defineStates({ Idle, Loading })
    const machine = StateMachine.make({
      id: "UserMachine",
      states: states.states,
      events: [Submit],
      input: Input,
      initial: (input) => states.initial.Idle(new Idle({ userId: input.userId }))
    }).handle("Idle", {
      on: {
        Submit: Effect.fn(function*() {
          return new Loading({ requestId: "request-1" })
        })
      }
    })

    assert.strictEqual(machine.id, "UserMachine")
  })

  it.effect("defineStates returns states accepted by make", () =>
    Effect.gen(function*() {
      const states = { idle: Idle, loading: Loading }
      const defined = StateMachine.defineStates(states)
      const machine = StateMachine.make({
        states: defined.states,
        events: [Submit],
        initial: () => defined.initial.idle(new Idle({ userId: "user-1" }))
      })

      const planned = yield* StateMachine.planInitial(machine)

      assert.strictEqual(defined.states, states)
      assert.strictEqual(planned.state.path, "idle")
      assert.deepStrictEqual(planned.state.value, new Idle({ userId: "user-1" }))
    }))

  it.effect("initial builder constructs effectful atomic initial snapshots", () =>
    Effect.gen(function*() {
      const states = StateMachine.defineStates({ Idle })
      const machine = StateMachine.make({
        states: states.states,
        events: [Submit],
        input: Input,
        initial: Effect.fn(function*({ userId }) {
          return states.initial.Idle(new Idle({ userId }))
        })
      })

      const planned = yield* StateMachine.planInitial(machine, { userId: "user-1" })

      assertStateSnapshot(planned.state, "Idle", new Idle({ userId: "user-1" }))
    }))

  it.effect("initial builder constructs compound initial snapshots", () =>
    Effect.gen(function*() {
      const states = StateMachine.defineStates({
        payment: {
          schema: Payment,
          initial: "entering",
          states: {
            entering: EnteringPayment,
            authorized: AuthorizedPayment
          }
        }
      })
      const payment = new Payment({ id: "payment-1" })
      const entering = new EnteringPayment({ amount: 100 })
      const machine = StateMachine.make({
        states: states.states,
        events: [Authorize],
        initial: () =>
          states.initial.payment(
            payment,
            (payment) => payment.entering(entering)
          )
      })

      const planned = yield* StateMachine.planInitial(machine)

      assertCompoundStateSnapshot(planned.state, "payment", payment, {
        path: "payment.entering",
        value: entering
      })
    }))

  it.effect("initial builder constructs parallel initial snapshots", () =>
    Effect.gen(function*() {
      const states = StateMachine.defineStates({
        fulfillment: {
          schema: Fulfillment,
          type: "parallel",
          states: {
            inventory: {
              schema: Inventory,
              initial: "checking",
              states: {
                checking: CheckingInventory,
                reserved: InventoryReserved
              }
            },
            shipping: {
              schema: Shipping,
              initial: "quoting",
              states: {
                quoting: QuotingShipping,
                quoted: ShippingQuoted
              }
            }
          }
        }
      })
      const fulfillment = new Fulfillment({ id: "fulfillment-1" })
      const inventory = new Inventory({ warehouse: "warehouse-1" })
      const checking = new CheckingInventory({ sku: "sku-1" })
      const shipping = new Shipping({ address: "Main Street" })
      const quoting = new QuotingShipping({ postalCode: "12345" })
      const machine = StateMachine.make({
        states: states.states,
        events: [ReserveInventory],
        initial: () =>
          states.initial.fulfillment(
            fulfillment,
            (fulfillment) =>
              fulfillment
                .inventory(
                  inventory,
                  (inventory) => inventory.checking(checking)
                )
                .shipping(
                  shipping,
                  (shipping) => shipping.quoting(quoting)
                )
          )
      })

      const planned = yield* StateMachine.planInitial(machine)

      assertParallelStateSnapshot(planned.state, "fulfillment", fulfillment, {
        inventory: {
          path: "fulfillment.inventory",
          value: inventory,
          state: {
            path: "fulfillment.inventory.checking",
            value: checking
          }
        },
        shipping: {
          path: "fulfillment.shipping",
          value: shipping,
          state: {
            path: "fulfillment.shipping.quoting",
            value: quoting
          }
        }
      })
    }))

  it.effect("supports flat object states with path-aware handlers", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: {
          idle: Idle,
          loading: Loading
        },
        events: [Submit],
        input: Input,
        initial: (input) => LowercaseInitial.idle(new Idle({ userId: input.userId }))
      }).handle("idle", {
        on: {
          Submit: ({ event, state }) => new Loading({ requestId: `${state.userId}:${event.value}` })
        }
      })

      const planned = yield* StateMachine.plan(
        machine,
        new Idle({ userId: "user-1" }),
        new Submit({ value: "request-1" })
      )

      assert.deepStrictEqual(planned.next.value, new Loading({ requestId: "user-1:request-1" }))
      assert.strictEqual(planned.next.path, "loading")
      assert.deepStrictEqual(StateMachine.enabled(machine, new Idle({ userId: "user-1" })), ["Submit"])
    }))

  it.effect("uses path identity for duplicate decoded state tags", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: {
          a: Duplicate,
          b: Duplicate
        },
        events: [Submit, Reset],
        initial: () => DuplicateInitial.a(new Duplicate({ value: "a" }))
      })
        .handle("a", {
          on: {
            Submit: ({ event, target }) => target.full.b(new Duplicate({ value: event.value }))
          }
        })
        .handle("b", {
          on: {
            Reset: ({ target }) => target.full.a(new Duplicate({ value: "reset" }))
          }
        })

      const initial = yield* StateMachine.planInitial(machine)
      assertStateSnapshot(initial.state, "a", new Duplicate({ value: "a" }))
      assert.deepStrictEqual(StateMachine.enabled(machine, initial.state), ["Submit"])
      assert.deepStrictEqual(
        StateMachine.enabled(machine, {
          path: "b",
          value: new Duplicate({ value: "b" })
        }),
        ["Reset"]
      )

      const submitted = yield* StateMachine.plan(machine, initial.state, new Submit({ value: "b" }))
      assertStateSnapshot(submitted.next, "b", new Duplicate({ value: "b" }))

      const reset = yield* StateMachine.plan(machine, submitted.next, new Reset({}))
      assertStateSnapshot(reset.next, "a", new Duplicate({ value: "reset" }))
    }))

  it.effect("exposes path identity through actor snapshots", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: {
          a: Duplicate,
          b: Duplicate
        },
        events: [Submit],
        initial: () => DuplicateInitial.a(new Duplicate({ value: "a" }))
      }).handle("a", {
        on: {
          Submit: ({ event, target }) => target.full.b(new Duplicate({ value: event.value }))
        }
      })

      const actor = yield* StateMachine.start(machine)
      assertStateSnapshot(yield* actor.state, "a", new Duplicate({ value: "a" }))

      const snapshot = yield* sendAndWaitForSnapshot(
        actor,
        new Submit({ value: "b" }),
        (snapshot) => snapshot.status === "active" && snapshot.state.path === "b"
      )
      assert.strictEqual(snapshot.status, "active")
      assertStateSnapshot(snapshot.state, "b", new Duplicate({ value: "b" }))
    }))

  it.effect("honors final flat object state node configs", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: {
          idle: Idle,
          success: {
            schema: Success,
            type: "final"
          }
        },
        events: [Submit],
        initial: () => LowercaseInitial.idle(new Idle({ userId: "user-1" }))
      }).handle("idle", {
        on: {
          Submit: ({ event }) => new Success({ requestId: event.value })
        }
      })

      const planned = yield* StateMachine.plan(
        machine,
        new Idle({ userId: "user-1" }),
        new Submit({ value: "request-1" })
      )

      assert.deepStrictEqual(planned.next.value, new Success({ requestId: "request-1" }))
      assert.strictEqual(planned.next.path, "success")
      assert.strictEqual(StateMachine.isFinal(machine, planned.next), true)
      assert.deepStrictEqual(StateMachine.enabled(machine, planned.next), [])
    }))

  it.effect("expands compound initial states and enters parent before child", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const initialPayment = new Payment({ id: "payment-1" })
      const initialEntering = new EnteringPayment({ amount: 100 })
      const machine = StateMachine.make({
        states: {
          payment: {
            schema: Payment,
            initial: "entering",
            states: {
              entering: EnteringPayment,
              authorized: {
                schema: AuthorizedPayment,
                type: "final"
              }
            }
          }
        },
        events: [Authorize],
        initial: () => ({
          path: "payment",
          value: initialPayment,
          state: {
            path: "payment.entering" as const,
            value: initialEntering
          }
        })
      })
        .handle("payment", {
          entry: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("entry:payment"))
          })
        })
        .handle("payment.entering", {
          entry: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("entry:entering"))
          })
        })

      const actor = yield* StateMachine.start(machine).pipe(Effect.provideService(DeferredLog, deferredLog))

      assertCompoundStateSnapshot(yield* actor.state, "payment", initialPayment, {
        path: "payment.entering" as const,
        value: initialEntering
      })
      assert.deepStrictEqual(yield* deferredLog.read, ["entry:payment", "entry:entering"])
    }))

  it.effect("selects child handlers before ancestor handlers", () =>
    Effect.gen(function*() {
      const payment = new Payment({ id: "payment-1" })
      const entering = new EnteringPayment({ amount: 100 })
      const machine = StateMachine.make({
        states: {
          payment: {
            schema: Payment,
            initial: "entering",
            states: {
              entering: EnteringPayment,
              authorized: AuthorizedPayment
            }
          },
          failed: Failed
        },
        events: [Authorize],
        initial: () => ({
          path: "payment",
          value: payment,
          state: {
            path: "payment.entering" as const,
            value: entering
          }
        })
      })
        .handle("payment", {
          on: {
            Authorize: () => new Failed({ message: "parent" })
          }
        })
        .handle("payment.entering", {
          on: {
            Authorize: ({ event }) => new AuthorizedPayment({ code: event.code })
          }
        })

      const initial = yield* StateMachine.planInitial(machine)
      const planned = yield* StateMachine.plan(machine, initial.state, new Authorize({ code: "auth-1" }))

      assertCompoundStateSnapshot(planned.next as any, "payment", payment, {
        path: "payment.authorized" as const,
        value: new AuthorizedPayment({ code: "auth-1" })
      })
    }))

  it.effect("lets ancestor handlers catch events from active descendants", () =>
    Effect.gen(function*() {
      const payment = new Payment({ id: "payment-1" })
      const entering = new EnteringPayment({ amount: 100 })
      const machine = StateMachine.make({
        states: {
          idle: Idle,
          payment: {
            schema: Payment,
            initial: "entering",
            states: {
              entering: EnteringPayment,
              authorized: AuthorizedPayment
            }
          }
        },
        events: [Reset],
        initial: () => ({
          path: "payment",
          value: payment,
          state: {
            path: "payment.entering" as const,
            value: entering
          }
        })
      }).handle("payment", {
        on: {
          Reset: () => new Idle({ userId: "user-1" })
        }
      })

      const initial = yield* StateMachine.planInitial(machine)
      assert.deepStrictEqual(StateMachine.enabled(machine, initial.state), ["Reset"])

      const planned = yield* StateMachine.plan(machine, initial.state, new Reset({}))

      assertStateSnapshot(planned.next as any, "idle", new Idle({ userId: "user-1" }))
    }))

  it.effect("runs compound exits deepest-first and entries parent-first", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: {
          idle: Idle,
          payment: {
            schema: Payment,
            initial: "entering",
            states: {
              entering: EnteringPayment,
              authorized: AuthorizedPayment
            }
          }
        },
        events: [Reset],
        initial: () => ({
          path: "payment",
          value: new Payment({ id: "payment-1" }),
          state: {
            path: "payment.entering" as const,
            value: new EnteringPayment({ amount: 100 })
          }
        })
      })
        .handle("idle", {
          entry: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("entry:idle"))
          })
        })
        .handle("payment", {
          entry: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("entry:payment"))
          }),
          exit: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("exit:payment"))
          }),
          on: {
            Reset: () => new Idle({ userId: "user-1" })
          }
        })
        .handle("payment.entering", {
          entry: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("entry:entering"))
          }),
          exit: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("exit:entering"))
          })
        })

      const actor = yield* StateMachine.start(machine).pipe(Effect.provideService(DeferredLog, deferredLog))

      yield* sendAndWaitForSnapshot(
        actor,
        new Reset({}),
        (snapshot) => snapshot.status === "active" && snapshot.state.path === "idle"
      )
      yield* Effect.yieldNow

      assert.deepStrictEqual(yield* deferredLog.read, [
        "entry:payment",
        "entry:entering",
        "exit:entering",
        "exit:payment",
        "entry:idle"
      ])
    }))

  it.effect("preserves parent values for same-parent child transitions", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const payment = new Payment({ id: "payment-1" })
      const machine = StateMachine.make({
        states: {
          payment: {
            schema: Payment,
            initial: "entering",
            states: {
              entering: EnteringPayment,
              authorized: AuthorizedPayment
            }
          }
        },
        events: [Authorize],
        initial: () => ({
          path: "payment",
          value: payment,
          state: {
            path: "payment.entering" as const,
            value: new EnteringPayment({ amount: 100 })
          }
        })
      })
        .handle("payment", {
          entry: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("entry:payment"))
          }),
          exit: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("exit:payment"))
          })
        })
        .handle("payment.entering", {
          exit: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("exit:entering"))
          }),
          on: {
            Authorize: ({ event }) => new AuthorizedPayment({ code: event.code })
          }
        })
        .handle("payment.authorized", {
          entry: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("entry:authorized"))
          })
        })

      const actor = yield* StateMachine.start(machine).pipe(Effect.provideService(DeferredLog, deferredLog))
      const snapshot = yield* sendAndWaitForSnapshot(
        actor,
        new Authorize({ code: "auth-1" }),
        (snapshot) => {
          const state = snapshot.state as any
          return snapshot.status === "active" && state.path === "payment" && state.state.path === "payment.authorized"
        }
      )
      yield* Effect.yieldNow

      assert.strictEqual(snapshot.status, "active")
      assertCompoundStateSnapshot(snapshot.state as any, "payment", payment, {
        path: "payment.authorized" as const,
        value: new AuthorizedPayment({ code: "auth-1" })
      })
      assert.deepStrictEqual(yield* deferredLog.read, [
        "entry:payment",
        "exit:entering",
        "entry:authorized"
      ])
    }))

  it.effect("uses target.full when targeting a nested state from outside", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: {
          idle: Idle,
          payment: {
            schema: Payment,
            initial: "entering",
            states: {
              entering: EnteringPayment,
              authorized: AuthorizedPayment
            }
          }
        },
        events: [Submit],
        initial: () => LowercaseInitial.idle(new Idle({ userId: "user-1" }))
      })
        .handle("idle", {
          on: {
            Submit: ({ event, target }) =>
              target.full.payment(
                new Payment({ id: event.value }),
                (payment) => payment.entering(new EnteringPayment({ amount: event.value.length }))
              )
          }
        })
        .handle("payment", {
          entry: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("entry:payment"))
          })
        })
        .handle("payment.entering", {
          entry: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("entry:entering"))
          })
        })

      const actor = yield* StateMachine.start(machine).pipe(Effect.provideService(DeferredLog, deferredLog))
      const snapshot = yield* sendAndWaitForSnapshot(
        actor,
        new Submit({ value: "payment-1" }),
        (snapshot) => snapshot.status === "active" && snapshot.state.path === "payment"
      )
      yield* Effect.yieldNow

      assert.strictEqual(snapshot.status, "active")
      assertCompoundStateSnapshot(snapshot.state as any, "payment", new Payment({ id: "payment-1" }), {
        path: "payment.entering" as const,
        value: new EnteringPayment({ amount: "payment-1".length })
      })
      assert.deepStrictEqual(yield* deferredLog.read, ["entry:payment", "entry:entering"])
    }))

  it.effect("uses target.full to enter an inactive parallel root", () =>
    Effect.gen(function*() {
      const states = StateMachine.defineStates({
        idle: Idle,
        fulfillment: {
          schema: Fulfillment,
          type: "parallel",
          states: {
            inventory: {
              schema: Inventory,
              initial: "checking",
              states: {
                checking: CheckingInventory,
                reserved: {
                  schema: InventoryReserved,
                  type: "final"
                }
              }
            },
            shipping: {
              schema: Shipping,
              initial: "quoting",
              states: {
                quoting: QuotingShipping,
                quoted: {
                  schema: ShippingQuoted,
                  type: "final"
                }
              }
            }
          }
        }
      })
      const machine = StateMachine.make({
        states: states.states,
        events: [Submit],
        initial: () => states.initial.idle(new Idle({ userId: "user-1" }))
      }).handle("idle", {
        on: {
          Submit: ({ event, target }) =>
            target.full.fulfillment(
              new Fulfillment({ id: event.value }),
              (fulfillment) =>
                fulfillment
                  .inventory(
                    new Inventory({ warehouse: "warehouse-1" }),
                    (inventory) => inventory.reserved(new InventoryReserved({ reservationId: event.value }))
                  )
                  .shipping(
                    new Shipping({ address: "Main Street" }),
                    (shipping) => shipping.quoted(new ShippingQuoted({ quoteId: event.value }))
                  )
            )
        }
      })

      const planned = yield* StateMachine.plan(
        machine,
        states.initial.idle(new Idle({ userId: "user-1" })),
        new Submit({ value: "order-1" })
      )

      assertParallelStateSnapshot(planned.next as any, "fulfillment", new Fulfillment({ id: "order-1" }), {
        inventory: {
          path: "fulfillment.inventory",
          value: new Inventory({ warehouse: "warehouse-1" }),
          state: {
            path: "fulfillment.inventory.reserved",
            value: new InventoryReserved({ reservationId: "order-1" })
          }
        },
        shipping: {
          path: "fulfillment.shipping",
          value: new Shipping({ address: "Main Street" }),
          state: {
            path: "fulfillment.shipping.quoted",
            value: new ShippingQuoted({ quoteId: "order-1" })
          }
        }
      })
    }))

  it.effect("treats compound states as final when their active child is final", () =>
    Effect.gen(function*() {
      const payment = new Payment({ id: "payment-1" })
      const machine = StateMachine.make({
        states: {
          payment: {
            schema: Payment,
            initial: "entering",
            states: {
              entering: EnteringPayment,
              authorized: {
                schema: AuthorizedPayment,
                type: "final"
              }
            }
          }
        },
        events: [Authorize, Reset],
        initial: () => ({
          path: "payment",
          value: payment,
          state: {
            path: "payment.entering" as const,
            value: new EnteringPayment({ amount: 100 })
          }
        })
      })
        .handle("payment", {
          on: {
            Reset: () => new EnteringPayment({ amount: 0 })
          }
        })
        .handle("payment.entering", {
          on: {
            Authorize: ({ event }) => new AuthorizedPayment({ code: event.code })
          }
        })
        .handle("payment.authorized", {
          type: "final",
          output: ({ state }) => state.code
        })

      const initial = yield* StateMachine.planInitial(machine)
      const planned = yield* StateMachine.plan(machine, initial.state, new Authorize({ code: "auth-1" }))

      assertCompoundStateSnapshot(planned.next as any, "payment", payment, {
        path: "payment.authorized" as const,
        value: new AuthorizedPayment({ code: "auth-1" })
      })
      assert.strictEqual(StateMachine.isFinal(machine, planned.next), true)
      assert.deepStrictEqual(StateMachine.enabled(machine, planned.next), [])
      assert.strictEqual(planned.output, "auth-1")
    }))

  it.effect("produces output from an initially active nested final state", () =>
    Effect.gen(function*() {
      const payment = new Payment({ id: "payment-1" })
      const authorized = new AuthorizedPayment({ code: "auth-1" })
      const machine = StateMachine.make({
        states: {
          payment: {
            schema: Payment,
            initial: "authorized",
            states: {
              authorized: {
                schema: AuthorizedPayment,
                type: "final"
              }
            }
          }
        },
        events: [Reset],
        initial: () => ({
          path: "payment",
          value: payment,
          state: {
            path: "payment.authorized" as const,
            value: authorized
          }
        })
      }).handle("payment.authorized", {
        type: "final",
        output: ({ state }) => state.code
      })

      const planned = yield* StateMachine.planInitial(machine)

      assertCompoundStateSnapshot(planned.state as any, "payment", payment, {
        path: "payment.authorized" as const,
        value: authorized
      })
      assert.strictEqual(StateMachine.isFinal(machine, planned.state), true)
      assert.deepStrictEqual(StateMachine.enabled(machine, planned.state), [])
      assert.strictEqual(planned.output, "auth-1")
    }))

  it.effect("joins with output from nested final completion and ignores later events", () =>
    Effect.gen(function*() {
      const payment = new Payment({ id: "payment-1" })
      const machine = StateMachine.make({
        states: {
          idle: Idle,
          payment: {
            schema: Payment,
            initial: "entering",
            states: {
              entering: EnteringPayment,
              authorized: {
                schema: AuthorizedPayment,
                type: "final"
              }
            }
          }
        },
        events: [Authorize, Reset],
        initial: () => ({
          path: "payment",
          value: payment,
          state: {
            path: "payment.entering" as const,
            value: new EnteringPayment({ amount: 100 })
          }
        })
      })
        .handle("payment", {
          on: {
            Reset: () => new Idle({ userId: "user-1" })
          }
        })
        .handle("payment.entering", {
          on: {
            Authorize: ({ event }) => new AuthorizedPayment({ code: event.code })
          }
        })
        .handle("payment.authorized", {
          type: "final",
          output: ({ state }) => state.code
        })

      const actor = yield* StateMachine.start(machine)

      yield* actor.send(new Authorize({ code: "auth-1" }))
      assert.strictEqual(yield* actor.join, "auth-1")
      yield* actor.send(new Reset({}))

      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "done",
        state: {
          path: "payment",
          value: payment,
          state: {
            path: "payment.authorized",
            value: new AuthorizedPayment({ code: "auth-1" })
          }
        },
        output: "auth-1"
      })
    }))

  it.effect("does not process raised events from nested final state entry actions", () =>
    Effect.gen(function*() {
      const payment = new Payment({ id: "payment-1" })
      const machine = StateMachine.make({
        states: {
          payment: {
            schema: Payment,
            initial: "entering",
            states: {
              entering: EnteringPayment,
              authorized: {
                schema: AuthorizedPayment,
                type: "final"
              }
            }
          },
          failed: Failed
        },
        events: [Authorize, Reset],
        initial: () => ({
          path: "payment",
          value: payment,
          state: {
            path: "payment.entering" as const,
            value: new EnteringPayment({ amount: 100 })
          }
        })
      })
        .handle("payment", {
          on: {
            Reset: () => new Failed({ message: "raised" })
          }
        })
        .handle("payment.entering", {
          on: {
            Authorize: ({ event }) => new AuthorizedPayment({ code: event.code })
          }
        })
        .handle("payment.authorized", {
          type: "final",
          entry: ({ runtime }) => Effect.flatMap(runtime, (stateMachine) => stateMachine.raise(new Reset({})))
        })

      const initial = yield* StateMachine.planInitial(machine)
      const planned = yield* StateMachine.plan(machine, initial.state, new Authorize({ code: "auth-1" }))

      assertCompoundStateSnapshot(planned.next as any, "payment", payment, {
        path: "payment.authorized" as const,
        value: new AuthorizedPayment({ code: "auth-1" })
      })
      assert.strictEqual(StateMachine.isFinal(machine, planned.next), true)
    }))

  it.effect("expands parallel initial states and enters all regions", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const fulfillment = new Fulfillment({ id: "fulfillment-1" })
      const inventory = new Inventory({ warehouse: "warehouse-1" })
      const checking = new CheckingInventory({ sku: "sku-1" })
      const shipping = new Shipping({ address: "Main Street" })
      const quoting = new QuotingShipping({ postalCode: "12345" })
      const machine = StateMachine.make({
        states: {
          fulfillment: {
            schema: Fulfillment,
            type: "parallel",
            states: {
              inventory: {
                schema: Inventory,
                initial: "checking",
                states: {
                  checking: CheckingInventory,
                  reserved: {
                    schema: InventoryReserved,
                    type: "final"
                  }
                }
              },
              shipping: {
                schema: Shipping,
                initial: "quoting",
                states: {
                  quoting: QuotingShipping,
                  quoted: {
                    schema: ShippingQuoted,
                    type: "final"
                  }
                }
              }
            }
          }
        },
        events: [ReserveInventory],
        initial: () => ({
          path: "fulfillment",
          value: fulfillment,
          states: {
            inventory: {
              path: "fulfillment.inventory" as const,
              value: inventory,
              state: {
                path: "fulfillment.inventory.checking" as const,
                value: checking
              }
            },
            shipping: {
              path: "fulfillment.shipping" as const,
              value: shipping,
              state: {
                path: "fulfillment.shipping.quoting" as const,
                value: quoting
              }
            }
          }
        })
      })
        .handle("fulfillment", {
          entry: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("entry:fulfillment"))
          })
        })
        .handle("fulfillment.inventory", {
          entry: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("entry:inventory"))
          })
        })
        .handle("fulfillment.inventory.checking", {
          entry: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("entry:checking"))
          })
        })
        .handle("fulfillment.shipping", {
          entry: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("entry:shipping"))
          })
        })
        .handle("fulfillment.shipping.quoting", {
          entry: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("entry:quoting"))
          })
        })

      const actor = yield* StateMachine.start(machine).pipe(Effect.provideService(DeferredLog, deferredLog))

      assertParallelStateSnapshot(yield* actor.state, "fulfillment", fulfillment, {
        inventory: {
          path: "fulfillment.inventory",
          value: inventory,
          state: {
            path: "fulfillment.inventory.checking",
            value: checking
          }
        },
        shipping: {
          path: "fulfillment.shipping",
          value: shipping,
          state: {
            path: "fulfillment.shipping.quoting",
            value: quoting
          }
        }
      })
      assert.deepStrictEqual(yield* deferredLog.read, [
        "entry:fulfillment",
        "entry:inventory",
        "entry:checking",
        "entry:shipping",
        "entry:quoting"
      ])
    }))

  it.effect("updates one parallel region while preserving sibling regions and parent value", () =>
    Effect.gen(function*() {
      const fulfillment = new Fulfillment({ id: "fulfillment-1" })
      const inventory = new Inventory({ warehouse: "warehouse-1" })
      const shipping = new Shipping({ address: "Main Street" })
      const quoting = new QuotingShipping({ postalCode: "12345" })
      const machine = StateMachine.make({
        states: {
          fulfillment: {
            schema: Fulfillment,
            type: "parallel",
            states: {
              inventory: {
                schema: Inventory,
                initial: "checking",
                states: {
                  checking: CheckingInventory,
                  reserved: {
                    schema: InventoryReserved,
                    type: "final"
                  }
                }
              },
              shipping: {
                schema: Shipping,
                initial: "quoting",
                states: {
                  quoting: QuotingShipping,
                  quoted: {
                    schema: ShippingQuoted,
                    type: "final"
                  }
                }
              }
            }
          }
        },
        events: [ReserveInventory],
        initial: () => ({
          path: "fulfillment",
          value: fulfillment,
          states: {
            inventory: {
              path: "fulfillment.inventory" as const,
              value: inventory,
              state: {
                path: "fulfillment.inventory.checking" as const,
                value: new CheckingInventory({ sku: "sku-1" })
              }
            },
            shipping: {
              path: "fulfillment.shipping" as const,
              value: shipping,
              state: {
                path: "fulfillment.shipping.quoting" as const,
                value: quoting
              }
            }
          }
        })
      }).handle("fulfillment.inventory.checking", {
        on: {
          ReserveInventory: ({ event }) => new InventoryReserved({ reservationId: event.reservationId })
        }
      })

      const initial = yield* StateMachine.planInitial(machine)
      const planned = yield* StateMachine.plan(machine, initial.state, new ReserveInventory({ reservationId: "res-1" }))

      assertParallelStateSnapshot(planned.next as any, "fulfillment", fulfillment, {
        inventory: {
          path: "fulfillment.inventory",
          value: inventory,
          state: {
            path: "fulfillment.inventory.reserved",
            value: new InventoryReserved({ reservationId: "res-1" })
          }
        },
        shipping: {
          path: "fulfillment.shipping",
          value: shipping,
          state: {
            path: "fulfillment.shipping.quoting",
            value: quoting
          }
        }
      })
      assert.strictEqual(StateMachine.isFinal(machine, planned.next), false)
    }))

  it.effect("completes a parallel parent when every region is final and aggregates region outputs", () =>
    Effect.gen(function*() {
      const fulfillment = new Fulfillment({ id: "fulfillment-1" })
      const inventory = new Inventory({ warehouse: "warehouse-1" })
      const checking = new CheckingInventory({ sku: "sku-1" })
      const shipping = new Shipping({ address: "Main Street" })
      const quoting = new QuotingShipping({ postalCode: "12345" })
      const machine = StateMachine.make({
        states: {
          fulfillment: {
            schema: Fulfillment,
            type: "parallel",
            states: {
              inventory: {
                schema: Inventory,
                initial: "checking",
                states: {
                  checking: CheckingInventory,
                  reserved: {
                    schema: InventoryReserved,
                    type: "final"
                  }
                }
              },
              shipping: {
                schema: Shipping,
                initial: "quoting",
                states: {
                  quoting: QuotingShipping,
                  quoted: {
                    schema: ShippingQuoted,
                    type: "final"
                  }
                }
              }
            }
          }
        },
        events: [ReserveInventory],
        initial: () => ({
          path: "fulfillment",
          value: fulfillment,
          states: {
            inventory: {
              path: "fulfillment.inventory" as const,
              value: inventory,
              state: {
                path: "fulfillment.inventory.checking" as const,
                value: checking
              }
            },
            shipping: {
              path: "fulfillment.shipping" as const,
              value: shipping,
              state: {
                path: "fulfillment.shipping.quoting" as const,
                value: quoting
              }
            }
          }
        })
      })
        .handle("fulfillment", {
          output: ({ outputs }) => ({
            inventory: outputs.inventory,
            shipping: outputs.shipping
          })
        })
        .handle("fulfillment.inventory.checking", {
          on: {
            ReserveInventory: ({ event }) => new InventoryReserved({ reservationId: event.reservationId })
          }
        })
        .handle("fulfillment.inventory.reserved", {
          type: "final",
          output: ({ state }) => state.reservationId
        })
        .handle("fulfillment.shipping.quoting", {
          on: {
            ReserveInventory: ({ event }) => new ShippingQuoted({ quoteId: event.reservationId })
          }
        })
        .handle("fulfillment.shipping.quoted", {
          type: "final",
          output: ({ state }) => state.quoteId
        })

      const initial = yield* StateMachine.planInitial(machine)
      const planned = yield* StateMachine.plan(machine, initial.state, new ReserveInventory({ reservationId: "res-1" }))

      assertParallelStateSnapshot(planned.next as any, "fulfillment", fulfillment, {
        inventory: {
          path: "fulfillment.inventory",
          value: inventory,
          state: {
            path: "fulfillment.inventory.reserved",
            value: new InventoryReserved({ reservationId: "res-1" })
          }
        },
        shipping: {
          path: "fulfillment.shipping",
          value: shipping,
          state: {
            path: "fulfillment.shipping.quoted",
            value: new ShippingQuoted({ quoteId: "res-1" })
          }
        }
      })
      assert.strictEqual(StateMachine.isFinal(machine, planned.next), true)
      assert.deepStrictEqual(StateMachine.enabled(machine, planned.next), [])
      assert.deepStrictEqual(planned.output, {
        inventory: "res-1",
        shipping: "res-1"
      })

      const actor = yield* StateMachine.start(machine)
      yield* actor.send(new ReserveInventory({ reservationId: "res-2" }))

      assert.deepStrictEqual(yield* actor.join, {
        inventory: "res-2",
        shipping: "res-2"
      })
    }))

  it.effect("preserves completed parallel region outputs across separate events", () =>
    Effect.gen(function*() {
      const fulfillment = new Fulfillment({ id: "fulfillment-1" })
      const inventory = new Inventory({ warehouse: "warehouse-1" })
      const shipping = new Shipping({ address: "Main Street" })
      const quoting = new QuotingShipping({ postalCode: "12345" })
      const machine = StateMachine.make({
        states: {
          fulfillment: {
            schema: Fulfillment,
            type: "parallel",
            states: {
              inventory: {
                schema: Inventory,
                initial: "checking",
                states: {
                  checking: CheckingInventory,
                  reserved: {
                    schema: InventoryReserved,
                    type: "final"
                  }
                }
              },
              shipping: {
                schema: Shipping,
                initial: "quoting",
                states: {
                  quoting: QuotingShipping,
                  quoted: {
                    schema: ShippingQuoted,
                    type: "final"
                  }
                }
              }
            }
          }
        },
        events: [ReserveInventory, Resolve],
        initial: () => ({
          path: "fulfillment",
          value: fulfillment,
          states: {
            inventory: {
              path: "fulfillment.inventory" as const,
              value: inventory,
              state: {
                path: "fulfillment.inventory.checking" as const,
                value: new CheckingInventory({ sku: "sku-1" })
              }
            },
            shipping: {
              path: "fulfillment.shipping" as const,
              value: shipping,
              state: {
                path: "fulfillment.shipping.quoting" as const,
                value: quoting
              }
            }
          }
        })
      })
        .handle("fulfillment", {
          output: ({ outputs }) => outputs
        })
        .handle("fulfillment.inventory.checking", {
          on: {
            ReserveInventory: ({ event }) => new InventoryReserved({ reservationId: event.reservationId })
          }
        })
        .handle("fulfillment.inventory.reserved", {
          type: "final",
          output: ({ event, state }) => `${state.reservationId}:${String(event._tag)}`
        })
        .handle("fulfillment.shipping.quoting", {
          on: {
            Resolve: () => new ShippingQuoted({ quoteId: "quote-1" })
          }
        })
        .handle("fulfillment.shipping.quoted", {
          type: "final",
          output: ({ event, state }) => `${state.quoteId}:${String(event._tag)}`
        })

      const initial = yield* StateMachine.planInitial(machine)
      const reserved = yield* StateMachine.plan(
        machine,
        initial.state,
        new ReserveInventory({ reservationId: "res-1" })
      )
      const quoted = yield* StateMachine.plan(machine, reserved.next, new Resolve({}))

      assert.strictEqual(StateMachine.isFinal(machine, reserved.next), false)
      assert.strictEqual(reserved.output, undefined)
      assert.strictEqual(StateMachine.isFinal(machine, quoted.next), true)
      assert.deepStrictEqual(quoted.output, {
        inventory: "res-1:ReserveInventory",
        shipping: "quote-1:Resolve"
      })

      const actor = yield* StateMachine.start(machine)
      yield* sendAndWaitForSnapshot(
        actor,
        new ReserveInventory({ reservationId: "res-2" }),
        (snapshot) =>
          snapshot.status === "active" &&
          snapshot.state.path === "fulfillment" &&
          snapshot.state.states.inventory.state.path === "fulfillment.inventory.reserved"
      )
      yield* actor.send(new Resolve({}))

      assert.deepStrictEqual(yield* actor.join, {
        inventory: "res-2:ReserveInventory",
        shipping: "quote-1:Resolve"
      })
    }))

  it.effect("does not process raised events after parallel final completion", () =>
    Effect.gen(function*() {
      const fulfillment = new Fulfillment({ id: "fulfillment-1" })
      const inventory = new Inventory({ warehouse: "warehouse-1" })
      const checking = new CheckingInventory({ sku: "sku-1" })
      const shipping = new Shipping({ address: "Main Street" })
      const quoting = new QuotingShipping({ postalCode: "12345" })
      const machine = StateMachine.make({
        states: {
          fulfillment: {
            schema: Fulfillment,
            type: "parallel",
            states: {
              inventory: {
                schema: Inventory,
                initial: "checking",
                states: {
                  checking: CheckingInventory,
                  reserved: {
                    schema: InventoryReserved,
                    type: "final"
                  }
                }
              },
              shipping: {
                schema: Shipping,
                initial: "quoting",
                states: {
                  quoting: QuotingShipping,
                  quoted: {
                    schema: ShippingQuoted,
                    type: "final"
                  }
                }
              }
            }
          },
          failed: Failed
        },
        events: [ReserveInventory, Reset],
        initial: () => ({
          path: "fulfillment",
          value: fulfillment,
          states: {
            inventory: {
              path: "fulfillment.inventory" as const,
              value: inventory,
              state: {
                path: "fulfillment.inventory.checking" as const,
                value: checking
              }
            },
            shipping: {
              path: "fulfillment.shipping" as const,
              value: shipping,
              state: {
                path: "fulfillment.shipping.quoting" as const,
                value: quoting
              }
            }
          }
        })
      })
        .handle("fulfillment", {
          on: {
            Reset: () => new Failed({ message: "raised" })
          }
        })
        .handle("fulfillment.inventory.checking", {
          on: {
            ReserveInventory: ({ event }) => new InventoryReserved({ reservationId: event.reservationId })
          }
        })
        .handle("fulfillment.shipping.quoting", {
          on: {
            ReserveInventory: ({ event }) => new ShippingQuoted({ quoteId: event.reservationId })
          }
        })
        .handle("fulfillment.shipping.quoted", {
          type: "final",
          entry: ({ runtime }) => Effect.flatMap(runtime, (stateMachine) => stateMachine.raise(new Reset({})))
        })

      const initial = yield* StateMachine.planInitial(machine)
      const planned = yield* StateMachine.plan(machine, initial.state, new ReserveInventory({ reservationId: "res-1" }))

      assert.strictEqual(StateMachine.isFinal(machine, planned.next), true)
      assertParallelStateSnapshot(planned.next as any, "fulfillment", fulfillment, {
        inventory: {
          path: "fulfillment.inventory",
          value: inventory,
          state: {
            path: "fulfillment.inventory.reserved",
            value: new InventoryReserved({ reservationId: "res-1" })
          }
        },
        shipping: {
          path: "fulfillment.shipping",
          value: shipping,
          state: {
            path: "fulfillment.shipping.quoted",
            value: new ShippingQuoted({ quoteId: "res-1" })
          }
        }
      })
    }))

  it.effect("transitions all matching parallel regions for the same event", () =>
    Effect.gen(function*() {
      const fulfillment = new Fulfillment({ id: "fulfillment-1" })
      const inventory = new Inventory({ warehouse: "warehouse-1" })
      const checking = new CheckingInventory({ sku: "sku-1" })
      const shipping = new Shipping({ address: "Main Street" })
      const quoting = new QuotingShipping({ postalCode: "12345" })
      const machine = StateMachine.make({
        states: {
          fulfillment: {
            schema: Fulfillment,
            type: "parallel",
            states: {
              inventory: {
                schema: Inventory,
                initial: "checking",
                states: {
                  checking: CheckingInventory,
                  reserved: InventoryReserved
                }
              },
              shipping: {
                schema: Shipping,
                initial: "quoting",
                states: {
                  quoting: QuotingShipping,
                  quoted: ShippingQuoted
                }
              }
            }
          }
        },
        events: [ReserveInventory],
        initial: () => ({
          path: "fulfillment",
          value: fulfillment,
          states: {
            inventory: {
              path: "fulfillment.inventory" as const,
              value: inventory,
              state: {
                path: "fulfillment.inventory.checking" as const,
                value: checking
              }
            },
            shipping: {
              path: "fulfillment.shipping" as const,
              value: shipping,
              state: {
                path: "fulfillment.shipping.quoting" as const,
                value: quoting
              }
            }
          }
        })
      })
        .handle("fulfillment.inventory.checking", {
          on: {
            ReserveInventory: ({ event }) => new InventoryReserved({ reservationId: event.reservationId })
          }
        })
        .handle("fulfillment.shipping.quoting", {
          on: {
            ReserveInventory: ({ event }) => new ShippingQuoted({ quoteId: event.reservationId })
          }
        })

      const initial = yield* StateMachine.planInitial(machine)
      const planned = yield* StateMachine.plan(machine, initial.state, new ReserveInventory({ reservationId: "res-1" }))

      assertParallelStateSnapshot(planned.next as any, "fulfillment", fulfillment, {
        inventory: {
          path: "fulfillment.inventory",
          value: inventory,
          state: {
            path: "fulfillment.inventory.reserved",
            value: new InventoryReserved({ reservationId: "res-1" })
          }
        },
        shipping: {
          path: "fulfillment.shipping",
          value: shipping,
          state: {
            path: "fulfillment.shipping.quoted",
            value: new ShippingQuoted({ quoteId: "res-1" })
          }
        }
      })
    }))

  it.effect("prefers child transitions over conflicting ancestor transitions", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const fulfillment = new Fulfillment({ id: "fulfillment-1" })
      const inventory = new Inventory({ warehouse: "warehouse-1" })
      const checking = new CheckingInventory({ sku: "sku-1" })
      const shipping = new Shipping({ address: "Main Street" })
      const quoting = new QuotingShipping({ postalCode: "12345" })
      const machine = StateMachine.make({
        states: {
          fulfillment: {
            schema: Fulfillment,
            type: "parallel",
            states: {
              inventory: {
                schema: Inventory,
                initial: "checking",
                states: {
                  checking: CheckingInventory,
                  reserved: InventoryReserved
                }
              },
              shipping: {
                schema: Shipping,
                initial: "quoting",
                states: {
                  quoting: QuotingShipping,
                  quoted: ShippingQuoted
                }
              }
            }
          },
          failed: Failed
        },
        events: [ReserveInventory],
        initial: () => ({
          path: "fulfillment",
          value: fulfillment,
          states: {
            inventory: {
              path: "fulfillment.inventory" as const,
              value: inventory,
              state: {
                path: "fulfillment.inventory.checking" as const,
                value: checking
              }
            },
            shipping: {
              path: "fulfillment.shipping" as const,
              value: shipping,
              state: {
                path: "fulfillment.shipping.quoting" as const,
                value: quoting
              }
            }
          }
        })
      })
        .handle("fulfillment", {
          on: {
            ReserveInventory: Effect.fn(function*() {
              const deferredLog = yield* DeferredLog
              yield* StateMachine.action(deferredLog.push("transition:parent"))
              return new Failed({ message: "parent" })
            })
          }
        })
        .handle("fulfillment.inventory.checking", {
          on: {
            ReserveInventory: Effect.fn(function*({ event }) {
              const deferredLog = yield* DeferredLog
              yield* StateMachine.action(deferredLog.push("transition:child"))
              return new InventoryReserved({
                reservationId: event.reservationId
              })
            })
          }
        })

      const actor = yield* StateMachine.start(machine).pipe(Effect.provideService(DeferredLog, deferredLog))
      const snapshot = yield* sendAndWaitForSnapshot(
        actor,
        new ReserveInventory({ reservationId: "res-1" }),
        (snapshot) =>
          snapshot.status === "active" &&
          snapshot.state.path === "fulfillment" &&
          snapshot.state.states.inventory.state.path === "fulfillment.inventory.reserved"
      )
      yield* Effect.yieldNow

      assertParallelStateSnapshot(snapshot.state as any, "fulfillment", fulfillment, {
        inventory: {
          path: "fulfillment.inventory",
          value: inventory,
          state: {
            path: "fulfillment.inventory.reserved",
            value: new InventoryReserved({ reservationId: "res-1" })
          }
        },
        shipping: {
          path: "fulfillment.shipping",
          value: shipping,
          state: {
            path: "fulfillment.shipping.quoting",
            value: quoting
          }
        }
      })
      assert.deepStrictEqual(yield* deferredLog.read, ["transition:child"])
    }))

  it.effect("runs parallel exit, transition, and entry actions in deterministic order", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const fulfillment = new Fulfillment({ id: "fulfillment-1" })
      const inventory = new Inventory({ warehouse: "warehouse-1" })
      const checking = new CheckingInventory({ sku: "sku-1" })
      const shipping = new Shipping({ address: "Main Street" })
      const quoting = new QuotingShipping({ postalCode: "12345" })
      const machine = StateMachine.make({
        states: {
          fulfillment: {
            schema: Fulfillment,
            type: "parallel",
            states: {
              inventory: {
                schema: Inventory,
                initial: "checking",
                states: {
                  checking: CheckingInventory,
                  reserved: InventoryReserved
                }
              },
              shipping: {
                schema: Shipping,
                initial: "quoting",
                states: {
                  quoting: QuotingShipping,
                  quoted: ShippingQuoted
                }
              }
            }
          }
        },
        events: [ReserveInventory],
        initial: () => ({
          path: "fulfillment",
          value: fulfillment,
          states: {
            inventory: {
              path: "fulfillment.inventory" as const,
              value: inventory,
              state: {
                path: "fulfillment.inventory.checking" as const,
                value: checking
              }
            },
            shipping: {
              path: "fulfillment.shipping" as const,
              value: shipping,
              state: {
                path: "fulfillment.shipping.quoting" as const,
                value: quoting
              }
            }
          }
        })
      })
        .handle("fulfillment.inventory.checking", {
          exit: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("exit:inventory.checking"))
          }),
          on: {
            ReserveInventory: Effect.fn(function*({ event }) {
              const deferredLog = yield* DeferredLog
              yield* StateMachine.action(deferredLog.push("transition:inventory"))
              return new InventoryReserved({
                reservationId: event.reservationId
              })
            })
          }
        })
        .handle("fulfillment.inventory.reserved", {
          entry: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("entry:inventory.reserved"))
          })
        })
        .handle("fulfillment.shipping.quoting", {
          exit: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("exit:shipping.quoting"))
          }),
          on: {
            ReserveInventory: Effect.fn(function*({ event }) {
              const deferredLog = yield* DeferredLog
              yield* StateMachine.action(deferredLog.push("transition:shipping"))
              return new ShippingQuoted({ quoteId: event.reservationId })
            })
          }
        })
        .handle("fulfillment.shipping.quoted", {
          entry: Effect.fn(function*() {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("entry:shipping.quoted"))
          })
        })

      const actor = yield* StateMachine.start(machine).pipe(Effect.provideService(DeferredLog, deferredLog))
      yield* sendAndWaitForSnapshot(
        actor,
        new ReserveInventory({ reservationId: "res-1" }),
        (snapshot) =>
          snapshot.status === "active" &&
          snapshot.state.path === "fulfillment" &&
          snapshot.state.states.inventory.state.path === "fulfillment.inventory.reserved" &&
          snapshot.state.states.shipping.state.path === "fulfillment.shipping.quoted"
      )
      yield* Effect.yieldNow

      assert.deepStrictEqual(yield* deferredLog.read, [
        "exit:shipping.quoting",
        "exit:inventory.checking",
        "transition:inventory",
        "transition:shipping",
        "entry:inventory.reserved",
        "entry:shipping.quoted"
      ])
    }))

  it.effect("processes raised events from one parallel region after the current microstep", () =>
    Effect.gen(function*() {
      const fulfillment = new Fulfillment({ id: "fulfillment-1" })
      const inventory = new Inventory({ warehouse: "warehouse-1" })
      const checking = new CheckingInventory({ sku: "sku-1" })
      const shipping = new Shipping({ address: "Main Street" })
      const quoting = new QuotingShipping({ postalCode: "12345" })
      const machine = StateMachine.make({
        states: {
          fulfillment: {
            schema: Fulfillment,
            type: "parallel",
            states: {
              inventory: {
                schema: Inventory,
                initial: "checking",
                states: {
                  checking: CheckingInventory,
                  reserved: InventoryReserved
                }
              },
              shipping: {
                schema: Shipping,
                initial: "quoting",
                states: {
                  quoting: QuotingShipping,
                  quoted: ShippingQuoted
                }
              }
            }
          }
        },
        events: [ReserveInventory, Resolve],
        initial: () => ({
          path: "fulfillment",
          value: fulfillment,
          states: {
            inventory: {
              path: "fulfillment.inventory" as const,
              value: inventory,
              state: {
                path: "fulfillment.inventory.checking" as const,
                value: checking
              }
            },
            shipping: {
              path: "fulfillment.shipping" as const,
              value: shipping,
              state: {
                path: "fulfillment.shipping.quoting" as const,
                value: quoting
              }
            }
          }
        })
      })
        .handle("fulfillment.inventory.checking", {
          on: {
            ReserveInventory: Effect.fn(function*({ event, runtime }) {
              const stateMachine = yield* runtime
              yield* stateMachine.raise(new Resolve({}))
              return new InventoryReserved({
                reservationId: event.reservationId
              })
            })
          }
        })
        .handle("fulfillment.shipping.quoting", {
          on: {
            Resolve: () => new ShippingQuoted({ quoteId: "raised" })
          }
        })

      const initial = yield* StateMachine.planInitial(machine)
      const planned = yield* StateMachine.plan(machine, initial.state, new ReserveInventory({ reservationId: "res-1" }))

      assertParallelStateSnapshot(planned.next as any, "fulfillment", fulfillment, {
        inventory: {
          path: "fulfillment.inventory",
          value: inventory,
          state: {
            path: "fulfillment.inventory.reserved",
            value: new InventoryReserved({ reservationId: "res-1" })
          }
        },
        shipping: {
          path: "fulfillment.shipping",
          value: shipping,
          state: {
            path: "fulfillment.shipping.quoted",
            value: new ShippingQuoted({ quoteId: "raised" })
          }
        }
      })
      assert.strictEqual(planned.microsteps.length, 2)
    }))

  it.effect("starts a machine without input", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: { Idle },
        events: [Submit],
        initial: () => FlatInitial.Idle(new Idle({ userId: "user-1" }))
      })

      const actor = yield* StateMachine.start(machine)

      assert.deepStrictEqual((yield* actor.state).value, new Idle({ userId: "user-1" }))
    }))

  it.effect("planInitial computes the initial state without running deferred actions", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: { Idle },
        events: [Submit],
        input: Input,
        initial: Effect.fn(function*({ userId }) {
          yield* StateMachine.action(
            Effect.gen(function*() {
              const deferredLog = yield* DeferredLog
              yield* deferredLog.push("initial")
            })
          )
          return FlatInitial.Idle(new Idle({ userId }))
        })
      })

      const planned = yield* StateMachine.planInitial(machine, { userId: "user-1" })

      assert.deepStrictEqual(planned.state.value, new Idle({ userId: "user-1" }))
      assert.strictEqual(planned.actions.length, 1)
      assert.deepStrictEqual(yield* deferredLog.read, [])
    }))

  it.effect("start runs deferred initial actions", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: { Idle },
        events: [Submit],
        input: Input,
        initial: Effect.fn(function*({ userId }) {
          yield* StateMachine.action(
            Effect.gen(function*() {
              const deferredLog = yield* DeferredLog
              yield* deferredLog.push("initial")
            })
          )
          return FlatInitial.Idle(new Idle({ userId }))
        })
      })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" }).pipe(
        Effect.provideService(DeferredLog, deferredLog)
      )

      assert.deepStrictEqual((yield* actor.state).value, new Idle({ userId: "user-1" }))
      assert.deepStrictEqual(yield* deferredLog.read, ["initial"])
    }))

  it.effect("planInitial collects initial state entry actions without running them", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: { Idle },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
      }).handle("Idle", {
        entry: Effect.fn(function*({ event }) {
          const deferredLog = yield* DeferredLog
          yield* StateMachine.action(deferredLog.push(`entry:${String(event._tag)}`))
        })
      })

      const planned = yield* StateMachine.planInitial(machine, { userId: "user-1" }).pipe(
        Effect.provideService(DeferredLog, deferredLog)
      )

      assert.deepStrictEqual(planned.state.value, new Idle({ userId: "user-1" }))
      assert.strictEqual(planned.actions.length, 1)
      assert.deepStrictEqual(yield* deferredLog.read, [])
    }))

  it.effect("start runs initial state entry actions", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: { Idle },
        events: [Submit],
        input: Input,
        initial: Effect.fn(function*({ userId }) {
          const deferredLog = yield* DeferredLog
          yield* StateMachine.action(deferredLog.push("initial"))
          return FlatInitial.Idle(new Idle({ userId }))
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

      assert.deepStrictEqual((yield* actor.state).value, new Idle({ userId: "user-1" }))
      assert.deepStrictEqual(yield* deferredLog.read, ["initial", "entry:Symbol(effect/StateMachine/InitialEvent)"])
    }))

  it.effect("start follows always transitions from the initial state before exposing actor state", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: { Idle, Loading },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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

      assert.deepStrictEqual((yield* actor.state).value, new Loading({ requestId: "request-1" }))
      assert.deepStrictEqual(yield* deferredLog.read, ["entry", "always", "loading-entry"])
    }))

  it.effect("start processes raised events from initial state entry actions", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: { Idle, Loading },
        events: [Submit, Resolve],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
      })
        .handle("Idle", {
          entry: Effect.fn(function*({ runtime }) {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("entry"))
            const stateMachine = yield* runtime
            yield* stateMachine.raise(new Resolve({}))
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

      assert.deepStrictEqual((yield* actor.state).value, new Loading({ requestId: "request-1" }))
      assert.deepStrictEqual(yield* deferredLog.read, ["entry", "resolve", "loading-entry"])
    }))

  it.effect("carries initial action requirements", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: { Idle },
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
          return FlatInitial.Idle(new Idle({ userId }))
        })
      })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" }).pipe(
        Effect.provideService(InitialRequirement, InitialRequirement.of({ initialMessage: "initial" })),
        Effect.provideService(DeferredLog, deferredLog)
      )

      assert.deepStrictEqual((yield* actor.state).value, new Idle({ userId: "user-1" }))
      assert.deepStrictEqual(yield* deferredLog.read, ["initial"])
    }))

  it.effect("propagates initial action failures", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: { Idle },
        events: [Submit],
        input: Input,
        initial: Effect.fn(function*({ userId }) {
          const state = new Idle({ userId })
          yield* StateMachine.action(Effect.fail(new InitialError({ state: state._tag })))
          return FlatInitial.Idle(state)
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
        states: { Idle },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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
      states: { Idle, Loading },
      events: [Submit],
      input: Input,
      initial: (input) => FlatInitial.Idle(Idle.make({ userId: input.userId }))
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
        states: { Idle, Loading },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
      }).handle("Idle", {
        on: {
          Submit: () => new Loading({ requestId: "request-1" })
        }
      })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" })

      const snapshot = yield* sendAndWaitForSnapshot(
        actor,
        new Submit({ value: "hello" }),
        (snapshot) => snapshot.state.value._tag === "Loading"
      )

      assert.deepStrictEqual(snapshot, {
        status: "active",
        state: { path: "Loading", value: new Loading({ requestId: "request-1" }) }
      })
    }))

  it("enabled returns the event tags handled by the current state", () => {
    const machine = StateMachine.make({
      states: { Idle, Loading },
      events: [Submit, Reset],
      input: Input,
      initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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
      states: { Idle, Success },
      events: [Submit],
      input: Input,
      initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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
        states: { Idle, Success },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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

      const actor = yield* StateMachine.start(machine, { userId: "user-1" }).pipe(
        Effect.provideService(DeferredLog, deferredLog)
      )

      yield* actor.send(new Submit({ value: "hello" }))

      assert.strictEqual(yield* actor.join, undefined)
      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "done",
        state: { path: "Success", value: new Success({ requestId: "request-1" }) },
        output: undefined
      })
      assert.deepStrictEqual(yield* deferredLog.read, ["success"])
    }))

  it.effect("exposes final state output from an actor", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: { Idle, Success },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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

      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "active",
        state: { path: "Idle", value: new Idle({ userId: "user-1" }) }
      })

      yield* actor.send(new Submit({ value: "hello" }))

      assert.strictEqual(yield* actor.join, "request-1:Submit")
    }))

  it.effect("plans final state output without running deferred actions", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: { Idle, Success },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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
        states: { Success },
        events: [Submit],
        initial: () => FlatInitial.Success(new Success({ requestId: "request-1" }))
      }).handle("Success", {
        type: "final",
        output: ({ state }) => state.requestId
      })

      const planned = yield* StateMachine.planInitial(machine)
      const actor = yield* StateMachine.start(machine)

      assert.strictEqual(planned.output, "request-1")
      assert.strictEqual(yield* actor.join, "request-1")
      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "done",
        state: { path: "Success", value: new Success({ requestId: "request-1" }) },
        output: "request-1"
      })
    }))

  it.effect("defaults final state output to undefined", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: { Idle, Success },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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

      assert.strictEqual(yield* actor.join, undefined)
      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "done",
        state: { path: "Success", value: new Success({ requestId: "request-1" }) },
        output: undefined
      })
    }))

  it.effect("does not process events after reaching a final state", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: { Idle, Success },
        events: [Submit, Reset],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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
      yield* actor.join
      yield* actor.send(new Reset({}))

      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "done",
        state: { path: "Success", value: new Success({ requestId: "request-1" }) },
        output: undefined
      })
    }))

  it.effect("start ignores events sent after stop", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: { Idle, Loading },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
      }).handle("Idle", {
        on: {
          Submit: () => new Loading({ requestId: "request-1" })
        }
      })
      const actor = yield* StateMachine.start(machine, { userId: "user-1" })

      yield* actor.stop
      yield* actor.send(new Submit({ value: "hello" }))

      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "stopped",
        state: { path: "Idle", value: new Idle({ userId: "user-1" }) }
      })
    }))

  it.effect("plans no-op transitions from final states", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: { Idle, Success },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
      }).handle("Success", {
        type: "final"
      })

      const state = new Success({ requestId: "request-1" })
      const planned = yield* StateMachine.plan(machine, state, new Submit({ value: "hello" }))

      assert.deepStrictEqual(planned.next.value, state)
      assert.deepStrictEqual(planned.actions, [])
      assert.deepStrictEqual(planned.microsteps, [])
    }))

  it.effect("does not process raised events from final state entry actions", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: { Idle, Success },
        events: [Submit, Reset],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
      })
        .handle("Idle", {
          on: {
            Submit: () => new Success({ requestId: "request-1" }),
            Reset: () => new Idle({ userId: "user-2" })
          }
        })
        .handle("Success", {
          type: "final",
          entry: ({ runtime }) => Effect.flatMap(runtime, (stateMachine) => stateMachine.raise(new Reset({})))
        })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" })
      yield* actor.send(new Submit({ value: "hello" }))
      yield* actor.join

      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "done",
        state: { path: "Success", value: new Success({ requestId: "request-1" }) },
        output: undefined
      })
    }))

  it.effect("plan computes the next state without running deferred actions", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: { Idle, Loading },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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

      assert.deepStrictEqual(planned.next.value, new Loading({ requestId: "request-1" }))
      assert.deepStrictEqual(yield* deferredLog.read, [])
    }))

  it.effect("handlers can omit returning a state for self-transitions", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: { Idle, Loading },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
      }).handle("Idle", {
        on: {
          Submit: () => {}
        }
      })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" })

      yield* actor.send(new Submit({ value: "hello" }))
      yield* Effect.yieldNow

      assert.deepStrictEqual((yield* actor.state).value, new Idle({ userId: "user-1" }))
    }))

  it.effect("effect handlers can omit returning a state for self-transitions", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: { Idle, Loading },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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

      const actor = yield* StateMachine.start(machine, { userId: "user-1" }).pipe(
        Effect.provideService(DeferredLog, deferredLog)
      )

      yield* actor.send(new Submit({ value: "hello" }))
      yield* Effect.yieldNow

      assert.deepStrictEqual(yield* deferredLog.read, ["submitted"])
      assert.deepStrictEqual((yield* actor.state).value, new Idle({ userId: "user-1" }))
    }))

  it("can reuse the same machine with multiple different handlers", () => {
    const effect = Effect.succeed("submitted")
    const machine = StateMachine.make({
      states: { Idle, Loading },
      events: [Submit, Reset],
      input: Input,
      initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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
        states: { Idle, Loading },
        events: [Submit, Reset],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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

      assert.deepStrictEqual((yield* actor.state).value, new Idle({ userId: "user-1" }))

      const snapshot = yield* sendAndWaitForSnapshot(
        actor,
        new Submit({ value: "hello" }),
        (snapshot) => snapshot.state.value._tag === "Loading"
      )

      assert.deepStrictEqual(snapshot, {
        status: "active",
        state: { path: "Loading", value: new Loading({ requestId: "request-1" }) }
      })
    }))

  it.effect("start returns an actor-backed runtime with lifecycle snapshots", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: { Idle, Loading },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
      }).handle("Idle", {
        on: {
          Submit: () => new Loading({ requestId: "request-1" })
        }
      })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" })
      const observer = yield* actor.changes.pipe(
        Stream.filter((snapshot) => snapshot.state.value._tag === "Loading"),
        Stream.take(1),
        Stream.runCollect,
        Effect.forkChild
      )

      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "active",
        state: { path: "Idle", value: new Idle({ userId: "user-1" }) }
      })

      yield* actor.send(new Submit({ value: "hello" }))

      const snapshots = Array.from(yield* Fiber.join(observer))
      assert.deepStrictEqual(snapshots, [{
        status: "active",
        state: { path: "Loading", value: new Loading({ requestId: "request-1" }) }
      }])
      assert.deepStrictEqual((yield* actor.state).value, new Loading({ requestId: "request-1" }))

      yield* actor.stop
      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "stopped",
        state: { path: "Loading", value: new Loading({ requestId: "request-1" }) }
      })
    }))

  it.effect("start completes actor output from a final state", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: { Idle, Success },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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

      const actor = yield* StateMachine.start(machine, { userId: "user-1" })

      yield* actor.send(new Submit({ value: "hello" }))

      assert.strictEqual(yield* actor.join, "request-1")
      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "done",
        state: { path: "Success", value: new Success({ requestId: "request-1" }) },
        output: "request-1"
      })
    }))

  it.effect("start surfaces transition failures through the actor lifecycle", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        id: "UserMachine",
        states: { Idle, Loading },
        events: [Submit, Reset],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
      }).handle("Idle", {
        on: {
          Submit: () => new Loading({ requestId: "request-1" })
        }
      })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" })

      yield* actor.send(new Reset({}))

      const error = yield* Effect.flip(actor.join)
      assert.instanceOf(error, StateMachine.UnhandledEventError)
      assert.strictEqual(error._tag, "UnhandledEventError")
      assert.strictEqual(error.machineId, "UserMachine")
      assert.strictEqual(error.state, "Idle")
      assert.strictEqual(error.event, "Reset")

      const snapshot = yield* actor.snapshot
      assert.strictEqual(snapshot.status, "error")
      if (snapshot.status === "error") {
        assert.deepStrictEqual(snapshot.state.value, new Idle({ userId: "user-1" }))
        const reason = snapshot.cause.reasons[0]
        assert.ok(reason !== undefined)
        assert.strictEqual(Cause.isFailReason(reason), true)
        if (Cause.isFailReason(reason)) {
          assert.instanceOf(reason.error, StateMachine.UnhandledEventError)
        }
      }
    }))

  it.effect("start provides actor runtime to initial actions", () =>
    Effect.gen(function*() {
      const observed = yield* Ref.make(false)
      const machine = StateMachine.make({
        states: { Idle },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
      }).handle("Idle", {
        entry: () =>
          StateMachine.action(
            StateMachine.self<Submit>().pipe(
              Effect.flatMap((self) => Ref.set(observed, self.id.length > 0 && self.sessionId.length > 0))
            )
          )
      })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" })

      assert.strictEqual(yield* Ref.get(observed), true)
      yield* actor.stop
    }))

  it.effect("start runs invoke configs", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: { Idle, Loading, Success },
        events: [Submit, RequestSucceeded],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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

      const actor = yield* StateMachine.start(machine, { userId: "user-1" })

      yield* actor.send(new Submit({ value: "hello" }))

      assert.strictEqual(yield* actor.join, "done:request-1")
      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "done",
        state: { path: "Success", value: new Success({ requestId: "done:request-1" }) },
        output: "done:request-1"
      })
    }))

  it.effect("toActorLogic runs with actor identity and active snapshots", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: { Idle, Loading },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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
        Stream.filter((snapshot) => snapshot.state.value._tag === "Loading"),
        Stream.take(1),
        Stream.runCollect,
        Effect.forkChild
      )

      assert.strictEqual(actor.id, "user-machine")
      assert.strictEqual(actor.systemId, "user-machine-1")
      assert.strictEqual(Option.isSome(registered), true)
      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "active",
        state: { path: "Idle", value: new Idle({ userId: "user-1" }) }
      })

      yield* actor.send(new Submit({ value: "hello" }))

      const snapshots = Array.from(yield* Fiber.join(observer))
      assert.deepStrictEqual(snapshots, [{
        status: "active",
        state: { path: "Loading", value: new Loading({ requestId: "request-1" }) }
      }])
      assert.deepStrictEqual((yield* actor.state).value, new Loading({ requestId: "request-1" }))

      yield* actor.stop
      assert.strictEqual(Option.isNone(yield* actor.system.get("user-machine-1")), true)
    }))

  it.effect("toActorLogic completes actor output from a final state", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: { Idle, Success },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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
        state: { path: "Success", value: new Success({ requestId: "request-1" }) },
        output: "request-1"
      })
    }))

  it.effect("toActorLogic can be spawned and addressed by actor system id", () =>
    Effect.scoped(Effect.gen(function*() {
      const machine = StateMachine.make({
        states: { Idle, Success },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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
        states: { Idle },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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
        states: { Idle, Loading, Success },
        events: [Submit, Resolve],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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
        states: { Idle },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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
        states: { Idle },
        events: [Submit],
        emits: [ParentRequestProgress],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
      }).handle("Idle", {
        entry: ({ runtime }) =>
          StateMachine.action(
            Effect.gen(function*() {
              const stateMachine = yield* runtime
              yield* stateMachine.sendParent(new ParentRequestProgress({ id: "request", loaded: 42 }))
            })
          )
      })
      const parentMachine = StateMachine.make({
        states: { Idle, Success },
        events: [Submit, ParentRequestProgress],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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
        state: { path: "Success", value: new Success({ requestId: "request:42" }) },
        output: "request:42"
      })
    }))

  it.effect("toActorLogic ignores sendParent when the hosting actor has no parent", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: { Idle, Success },
        events: [ParentRequestProgress],
        emits: [ParentRequestProgress],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
      })
        .handle("Idle", {
          entry: ({ runtime }) =>
            StateMachine.action(
              Effect.gen(function*() {
                const stateMachine = yield* runtime
                yield* stateMachine.sendParent(new ParentRequestProgress({ id: "request", loaded: 42 }))
              })
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
        state: { path: "Idle", value: new Idle({ userId: "user-1" }) }
      })
      yield* actor.stop
    }))

  it.effect("runtime raises events from local deferred actions", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: { Idle, Success },
        events: [Resolve],
        initial: () => FlatInitial.Idle(new Idle({ userId: "user-1" }))
      })
        .handle("Idle", {
          entry: ({ runtime }) =>
            StateMachine.action(
              Effect.gen(function*() {
                const stateMachine = yield* runtime
                yield* stateMachine.raise(new Resolve({}))
              })
            ),
          on: {
            Resolve: ({ state }) => new Success({ requestId: state.userId })
          }
        })
        .handle("Success", {
          type: "final",
          output: ({ state }) => state.requestId
        })

      const actor = yield* StateMachine.start(machine)

      assert.strictEqual(yield* actor.join, "user-1")
      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "done",
        state: { path: "Success", value: new Success({ requestId: "user-1" }) },
        output: "user-1"
      })
    }))

  it.effect("runtime sends emitted events to the parent from external action helpers", () =>
    Effect.gen(function*() {
      const notifyWorkerDone = Effect.gen(function*() {
        const runtime = yield* StateMachine.runtime<{
          events: Resolve
          emits: ParentRequestProgress
        }>()
        yield* runtime.sendParent(new ParentRequestProgress({ id: "request", loaded: 42 }))
        yield* runtime.raise(new Resolve({}))
      })

      const childMachine = StateMachine.make({
        states: { Idle, Success },
        events: [Resolve],
        emits: [ParentRequestProgress],
        initial: () => FlatInitial.Idle(new Idle({ userId: "child-user" }))
      })
        .handle("Idle", {
          entry: () => StateMachine.action(notifyWorkerDone),
          on: {
            Resolve: ({ state }) => new Success({ requestId: state.userId })
          }
        })
        .handle("Success", {
          type: "final",
          output: ({ state }) => state.requestId
        })

      const parentMachine = StateMachine.make({
        states: { Idle, Success },
        events: [Submit, ParentRequestProgress],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
      })
        .handle("Idle", {
          on: {
            Submit: Effect.fn(function*() {
              yield* StateMachine.action(
                StateMachine.actorRuntime<Submit | ParentRequestProgress>().pipe(
                  Effect.flatMap((runtime) =>
                    runtime.spawn(StateMachine.toActorLogic(childMachine), {
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
        state: { path: "Success", value: new Success({ requestId: "request:42" }) },
        output: "request:42"
      })
    }))

  it.effect("toActorLogic safely handles stopOwner children spawned during initial actions", () =>
    Effect.gen(function*() {
      const childLogic = Actor.fromEffect<number, never, never, InitialError>(
        0,
        () => Effect.fail(new InitialError({ state: "child" }))
      )
      const machine = StateMachine.make({
        states: { Idle },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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
        state: { path: "Idle", value: new Idle({ userId: "user-1" }) }
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
        states: { Idle, Loading, Success },
        events: [Submit, Resolve],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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

  it.effect("toActorLogic sends to spawned child actors by typed child address", () =>
    Effect.gen(function*() {
      const Child = StateMachine.child<ChildPing>("child")
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
        states: { Idle, Loading, Success },
        events: [Submit, Resolve],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
      })
        .handle("Idle", {
          on: {
            Submit: Effect.fn(function*() {
              yield* StateMachine.action(
                Effect.gen(function*() {
                  const child = yield* StateMachine.spawn(childLogic, { id: Child })
                  const reply = yield* Deferred.make<void>()
                  yield* Deferred.succeed(childRef, child)
                  yield* StateMachine.sendTo(Child, new ChildPing({ reply }))
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
          entry: () => StateMachine.action(StateMachine.stopChild(Child)),
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
        states: { Idle, Loading, Success },
        events: [Submit, Resolve],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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
        states: { Idle, Loading },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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
        states: { Idle, Loading, Success },
        events: [Submit, RequestSucceeded],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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
        state: { path: "Success", value: new Success({ requestId: "done:request-1" }) },
        output: "done:request-1"
      })
    }))

  it.effect("toActorLogic invokes a child actor by typed child address", () =>
    Effect.gen(function*() {
      const Request = StateMachine.child<ChildPing>("request")
      const childLogic = Actor.fromEffect<string, ChildPing, string>(
        "pending",
        () => Effect.succeed("done:request-1")
      )
      const machine = StateMachine.make({
        states: { Idle, Loading, Success },
        events: [Submit, RequestSucceeded],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
      })
        .handle("Idle", {
          on: {
            Submit: () => new Loading({ requestId: "request-1" })
          }
        })
        .handle("Loading", {
          invoke: StateMachine.invoke({
            id: Request,
            src: () => childLogic,
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
        state: { path: "Success", value: new Success({ requestId: "done:request-1" }) },
        output: "done:request-1"
      })
    }))

  it.effect("toActorLogic maps invoked child failures to machine events", () =>
    Effect.gen(function*() {
      const error = new InvokeError({ message: "boom" })
      const machine = StateMachine.make({
        states: { Idle, Loading, Failed },
        events: [Submit, RequestFailed],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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
        state: { path: "Failed", value: new Failed({ message: "boom" }) },
        output: "boom"
      })
    }))

  it.effect("toActorLogic maps invoked child active snapshots to machine events", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: { Idle, Loading, Success },
        events: [Submit, RequestProgress],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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
        state: { path: "Success", value: new Success({ requestId: "request:pending" }) },
        output: "request:pending"
      })
    }))

  it.effect("toActorLogic lets invoke snapshot mappers filter with undefined", () =>
    Effect.gen(function*() {
      const started = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const machine = StateMachine.make({
        states: { Idle, Loading, Success },
        events: [Submit, RequestProgress],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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
        state: { path: "Loading", value: new Loading({ requestId: "request-1" }) }
      })

      yield* Deferred.succeed(release, void 0)

      assert.strictEqual(yield* actor.join, "ready")
      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "done",
        state: { path: "Success", value: new Success({ requestId: "ready" }) },
        output: "ready"
      })
    }))

  it.effect("toActorLogic allows invoked children without snapshot or event mappers", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: { Idle, Loading },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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
        state: { path: "Loading", value: new Loading({ requestId: "request-1" }) }
      })

      yield* actor.stop
    }))

  it.effect("toActorLogic stops invoked children when leaving a state and ignores stale snapshots", () =>
    Effect.gen(function*() {
      const started = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const resetHandled = yield* Deferred.make<void>()
      const machine = StateMachine.make({
        states: { Idle, Loading, Success },
        events: [Submit, Reset, RequestProgress],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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
        state: { path: "Idle", value: new Idle({ userId: "user-1" }) }
      })

      yield* actor.stop
    }))

  it.effect("toActorLogic stops invoked children when leaving a state and ignores stale outcomes", () =>
    Effect.gen(function*() {
      const started = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const resetHandled = yield* Deferred.make<void>()
      const machine = StateMachine.make({
        states: { Idle, Loading, Success },
        events: [Submit, Reset, RequestSucceeded],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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
        state: { path: "Idle", value: new Idle({ userId: "user-1" }) }
      })

      yield* actor.stop
    }))

  it.effect("toActorLogic finishes invoke cleanup before leaving a state", () =>
    Effect.gen(function*() {
      const childStarted = yield* Deferred.make<void>()
      const childStopping = yield* Deferred.make<void>()
      const releaseChildStop = yield* Deferred.make<void>()
      const resetHandled = yield* Deferred.make<void>()
      let stoppedOutcomes = 0
      const childLogic = Actor.fromEffect("pending", () =>
        Deferred.succeed(childStarted, void 0).pipe(
          Effect.andThen(Effect.never),
          Effect.onInterrupt(() =>
            Deferred.succeed(childStopping, void 0).pipe(
              Effect.andThen(Deferred.await(releaseChildStop))
            )
          )
        ))
      const machine = StateMachine.make({
        states: { Idle, Loading, Success },
        events: [Submit, Reset, RequestSucceeded],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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
            event: ({ outcome }) => {
              if (outcome._tag === "Stopped") {
                stoppedOutcomes++
                return new RequestSucceeded({ value: "stopped" })
              }
              return undefined
            }
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
      yield* Deferred.await(childStarted)
      yield* actor.send(new Reset({}))
      yield* Deferred.await(childStopping)

      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "active",
        state: { path: "Loading", value: new Loading({ requestId: "request-1" }) }
      })

      yield* Deferred.succeed(releaseChildStop, void 0)
      yield* Deferred.await(resetHandled)
      yield* Effect.yieldNow

      assert.strictEqual(stoppedOutcomes, 0)
      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "active",
        state: { path: "Idle", value: new Idle({ userId: "user-1" }) }
      })

      yield* actor.stop
    }))

  it.effect("toActorLogic stops active invokes before final join completes", () =>
    Effect.gen(function*() {
      const childStarted = yield* Deferred.make<void>()
      const childStopping = yield* Deferred.make<void>()
      const releaseChildStop = yield* Deferred.make<void>()
      const joinDone = yield* Ref.make(false)
      let stoppedOutcomes = 0
      const childLogic = Actor.fromEffect("pending", () =>
        Deferred.succeed(childStarted, void 0).pipe(
          Effect.andThen(Effect.never),
          Effect.onInterrupt(() =>
            Deferred.succeed(childStopping, void 0).pipe(
              Effect.andThen(Deferred.await(releaseChildStop))
            )
          )
        ))
      const machine = StateMachine.make({
        states: { Idle, Loading, Success },
        events: [Submit, Resolve, RequestSucceeded],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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
            event: ({ outcome }) => {
              if (outcome._tag === "Stopped") {
                stoppedOutcomes++
                return new RequestSucceeded({ value: "stopped" })
              }
              return undefined
            }
          }),
          on: {
            Resolve: () => new Success({ requestId: "request-1" }),
            RequestSucceeded: ({ event }) => new Success({ requestId: event.value })
          }
        })
        .handle("Success", {
          type: "final",
          output: ({ state }) => state.requestId
        })

      const actor = yield* Actor.start(StateMachine.toActorLogic(machine, { userId: "user-1" }))
      const joinFiber = yield* actor.join.pipe(
        Effect.tap(() => Ref.set(joinDone, true)),
        Effect.forkChild
      )

      yield* actor.send(new Submit({ value: "hello" }))
      yield* Deferred.await(childStarted)
      yield* actor.send(new Resolve({}))
      yield* Deferred.await(childStopping)

      assert.strictEqual(yield* Ref.get(joinDone), false)
      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "active",
        state: { path: "Loading", value: new Loading({ requestId: "request-1" }) }
      })

      yield* Deferred.succeed(releaseChildStop, void 0)

      assert.strictEqual(yield* Fiber.join(joinFiber), "request-1")
      assert.strictEqual(stoppedOutcomes, 0)
      assert.deepStrictEqual(yield* actor.snapshot, {
        status: "done",
        state: { path: "Success", value: new Success({ requestId: "request-1" }) },
        output: "request-1"
      })
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
        states: { Idle, Loading },
        events: [Submit, Reset, Resolve, RequestSucceeded],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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
        state: { path: "Loading", value: new Loading({ requestId: "request-2" }) }
      })

      yield* actor.stop
    }))

  it.effect("toActorLogic scopes invokes to entered and exited compound state nodes", () =>
    Effect.gen(function*() {
      const payment = new Payment({ id: "payment-1" })
      const entering = new EnteringPayment({ amount: 100 })
      const parentStarted = yield* Deferred.make<void>()
      const enteringStarted = yield* Deferred.make<void>()
      const authorizedStarted = yield* Deferred.make<void>()
      const stopped = yield* Ref.make<ReadonlyArray<string>>([])
      const makeInvokeLogic = (label: string, started: Deferred.Deferred<void>) =>
        Actor.fromEffect("pending", () =>
          Deferred.succeed(started, void 0).pipe(
            Effect.andThen(Effect.never),
            Effect.onInterrupt(() => Ref.update(stopped, (labels) => [...labels, label]))
          ))
      const machine = StateMachine.make({
        states: {
          payment: {
            schema: Payment,
            initial: "entering",
            states: {
              entering: EnteringPayment,
              authorized: AuthorizedPayment
            }
          }
        },
        events: [Authorize],
        initial: () => ({
          path: "payment",
          value: payment,
          state: {
            path: "payment.entering" as const,
            value: entering
          }
        })
      })
        .handle("payment", {
          invoke: StateMachine.invoke({
            id: "request",
            src: () => makeInvokeLogic("parent", parentStarted)
          })
        })
        .handle("payment.entering", {
          invoke: StateMachine.invoke({
            id: "request",
            src: () => makeInvokeLogic("entering", enteringStarted)
          }),
          on: {
            Authorize: ({ event }) => new AuthorizedPayment({ code: event.code })
          }
        })
        .handle("payment.authorized", {
          invoke: StateMachine.invoke({
            id: "request",
            src: () => makeInvokeLogic("authorized", authorizedStarted)
          })
        })

      const actor = yield* Actor.start(StateMachine.toActorLogic(machine))
      yield* Deferred.await(parentStarted)
      yield* Deferred.await(enteringStarted)

      yield* sendAndWaitForSnapshot(
        actor,
        new Authorize({ code: "auth-1" }),
        (snapshot) =>
          snapshot.status === "active" &&
          snapshot.state.path === "payment" &&
          (snapshot.state as any).state.path === "payment.authorized"
      )
      yield* Deferred.await(authorizedStarted)

      assert.deepStrictEqual(yield* Ref.get(stopped), ["entering"])

      yield* actor.stop

      const stoppedLabels = yield* Ref.get(stopped)
      assert.deepStrictEqual([...stoppedLabels].sort(), ["authorized", "entering", "parent"])
    }))

  it.effect("toActorLogic stops parent and parallel region invokes before final completion", () =>
    Effect.gen(function*() {
      const fulfillment = new Fulfillment({ id: "fulfillment-1" })
      const inventory = new Inventory({ warehouse: "warehouse-1" })
      const shipping = new Shipping({ address: "Main Street" })
      const releaseStops = yield* Deferred.make<void>()
      const parentStarted = yield* Deferred.make<void>()
      const inventoryStarted = yield* Deferred.make<void>()
      const shippingStarted = yield* Deferred.make<void>()
      const parentStopping = yield* Deferred.make<void>()
      const inventoryStopping = yield* Deferred.make<void>()
      const shippingStopping = yield* Deferred.make<void>()
      const joinDone = yield* Ref.make(false)
      const makeInvokeLogic = (started: Deferred.Deferred<void>, stopping: Deferred.Deferred<void>) =>
        Actor.fromEffect("pending", () =>
          Deferred.succeed(started, void 0).pipe(
            Effect.andThen(Effect.never),
            Effect.onInterrupt(() =>
              Deferred.succeed(stopping, void 0).pipe(
                Effect.andThen(Deferred.await(releaseStops))
              )
            )
          ))
      const machine = StateMachine.make({
        states: {
          fulfillment: {
            schema: Fulfillment,
            type: "parallel",
            states: {
              inventory: {
                schema: Inventory,
                initial: "checking",
                states: {
                  checking: CheckingInventory
                }
              },
              shipping: {
                schema: Shipping,
                initial: "quoting",
                states: {
                  quoting: QuotingShipping
                }
              }
            }
          },
          success: {
            schema: Success,
            type: "final"
          }
        },
        events: [ReserveInventory],
        initial: () => ({
          path: "fulfillment",
          value: fulfillment,
          states: {
            inventory: {
              path: "fulfillment.inventory" as const,
              value: inventory,
              state: {
                path: "fulfillment.inventory.checking" as const,
                value: new CheckingInventory({ sku: "sku-1" })
              }
            },
            shipping: {
              path: "fulfillment.shipping" as const,
              value: shipping,
              state: {
                path: "fulfillment.shipping.quoting" as const,
                value: new QuotingShipping({ postalCode: "12345" })
              }
            }
          }
        })
      })
        .handle("fulfillment", {
          invoke: StateMachine.invoke({
            id: "request",
            src: () => makeInvokeLogic(parentStarted, parentStopping)
          })
        })
        .handle("fulfillment.inventory", {
          invoke: StateMachine.invoke({
            id: "request",
            src: () => makeInvokeLogic(inventoryStarted, inventoryStopping)
          })
        })
        .handle("fulfillment.shipping", {
          invoke: StateMachine.invoke({
            id: "request",
            src: () => makeInvokeLogic(shippingStarted, shippingStopping)
          })
        })
        .handle("fulfillment.inventory.checking", {
          on: {
            ReserveInventory: () => new Success({ requestId: "done" })
          }
        })
        .handle("success", {
          type: "final",
          output: ({ state }) => state.requestId
        })

      const actor = yield* Actor.start(StateMachine.toActorLogic(machine))
      const joinFiber = yield* actor.join.pipe(
        Effect.tap(() => Ref.set(joinDone, true)),
        Effect.forkChild
      )
      yield* Deferred.await(parentStarted)
      yield* Deferred.await(inventoryStarted)
      yield* Deferred.await(shippingStarted)

      const sendFiber = yield* actor.send(new ReserveInventory({ reservationId: "res-1" })).pipe(
        Effect.forkChild
      )
      yield* Deferred.await(parentStopping)
      yield* Deferred.await(inventoryStopping)
      yield* Deferred.await(shippingStopping)

      assert.strictEqual(yield* Ref.get(joinDone), false)

      yield* Deferred.succeed(releaseStops, void 0)
      yield* Fiber.join(sendFiber)

      assert.strictEqual(yield* Fiber.join(joinFiber), "done")
    }))

  it.effect("toActorLogic keeps state-scoped invokes separate from spawned children", () =>
    Effect.gen(function*() {
      const spawnedStarted = yield* Deferred.make<void>()
      const spawnedStopped = yield* Deferred.make<void>()
      const invokeStarted = yield* Deferred.make<void>()
      const invokeStops = yield* Ref.make(0)
      const spawnedLogic = Actor.fromEffect("pending", () =>
        Deferred.succeed(spawnedStarted, void 0).pipe(
          Effect.andThen(Effect.never),
          Effect.onInterrupt(() => Deferred.succeed(spawnedStopped, void 0))
        ))
      const invokeLogic = Actor.fromEffect("pending", () =>
        Deferred.succeed(invokeStarted, void 0).pipe(
          Effect.andThen(Effect.never),
          Effect.onInterrupt(() => Ref.update(invokeStops, (count) => count + 1))
        ))
      const machine = StateMachine.make({
        states: { Idle },
        events: [Resolve],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
      }).handle("Idle", {
        entry: () =>
          StateMachine.action(
            StateMachine.spawn(spawnedLogic, { id: "worker" }).pipe(
              Effect.asVoid
            )
          ),
        invoke: StateMachine.invoke({
          id: "worker",
          src: () => invokeLogic
        }),
        on: {
          Resolve: () => StateMachine.action(StateMachine.stopChild("worker"))
        }
      })

      const actor = yield* Actor.start(StateMachine.toActorLogic(machine, { userId: "user-1" }))
      yield* Deferred.await(spawnedStarted)
      yield* Deferred.await(invokeStarted)

      yield* actor.send(new Resolve({}))
      yield* Deferred.await(spawnedStopped)

      assert.strictEqual(yield* Ref.get(invokeStops), 0)

      yield* actor.stop

      assert.strictEqual(yield* Ref.get(invokeStops), 1)
    }))

  it.effect("toActorLogic propagates startup failures through Actor.start", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: { Idle },
        events: [Submit],
        input: Input,
        initial: Effect.fn(function*({ userId }) {
          const state = new Idle({ userId })
          yield* StateMachine.action(Effect.fail(new InitialError({ state: state._tag })))
          return FlatInitial.Idle(state)
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
        states: { Idle, Loading },
        events: [Submit, Reset],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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

      assert.deepStrictEqual((yield* actor.state).value, new Idle({ userId: "user-1" }))

      yield* actor.send(new Reset({}))
      const error = yield* Effect.flip(actor.join)

      assert.instanceOf(error, StateMachine.UnhandledEventError)
      assert.strictEqual(error._tag, "UnhandledEventError")
      assert.strictEqual(error.machineId, "UserMachine")
      assert.strictEqual(error.state, "Idle")
      assert.strictEqual(error.event, "Reset")
      const snapshot = yield* actor.snapshot
      assert.strictEqual(snapshot.status, "error")
      if (snapshot.status === "error") {
        assert.deepStrictEqual(snapshot.state.value, new Idle({ userId: "user-1" }))
      }
    }))

  it.effect("handles required services in actions", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: { Idle, Loading },
        events: [Submit, Reset],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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

      const actor = yield* StateMachine.start(machine, { userId: "user-1" }).pipe(
        Effect.provideService(DeferredLog, deferredLog)
      )

      const snapshot = yield* sendAndWaitForSnapshot(
        actor,
        new Submit({ value: "hello" }),
        (snapshot) => snapshot.state.value._tag === "Loading"
      )
      yield* Effect.yieldNow

      assert.deepStrictEqual(yield* deferredLog.read, ["submitted"])
      assert.deepStrictEqual(snapshot, {
        status: "active",
        state: { path: "Loading", value: new Loading({ requestId: "request-1" }) }
      })
    }))

  it.effect("runs the actions in sequential order", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: { Idle, Loading },
        events: [Submit, Reset],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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

      const actor = yield* StateMachine.start(machine, { userId: "user-1" }).pipe(
        Effect.provideService(DeferredLog, deferredLog)
      )

      const snapshot = yield* sendAndWaitForSnapshot(
        actor,
        new Submit({ value: "hello" }),
        (snapshot) => snapshot.state.value._tag === "Loading"
      )
      yield* Effect.yieldNow

      assert.deepStrictEqual(yield* deferredLog.read, ["submitted1", "submitted2"])
      assert.deepStrictEqual(snapshot, {
        status: "active",
        state: { path: "Loading", value: new Loading({ requestId: "request-1" }) }
      })
    }))

  it.effect("runs exit, transition, and entry actions in order", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: { Idle, Loading },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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

      const actor = yield* StateMachine.start(machine, { userId: "user-1" }).pipe(
        Effect.provideService(DeferredLog, deferredLog)
      )

      const snapshot = yield* sendAndWaitForSnapshot(
        actor,
        new Submit({ value: "hello" }),
        (snapshot) => snapshot.state.value._tag === "Loading"
      )
      yield* Effect.yieldNow

      assert.deepStrictEqual(yield* deferredLog.read, ["exit:Submit", "transition", "entry:Submit"])
      assert.deepStrictEqual(snapshot, {
        status: "active",
        state: { path: "Loading", value: new Loading({ requestId: "request-1" }) }
      })
    }))

  it.effect("plan collects entry and exit actions without running them", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: { Idle, Loading },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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

      assert.deepStrictEqual(planned.next.value, new Loading({ requestId: "request-1" }))
      assert.strictEqual(planned.actions.length, 3)
      assert.deepStrictEqual(yield* deferredLog.read, [])
    }))

  it.effect("plan follows always transitions to a settled state", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: { Idle, Loading, Success },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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

      assert.deepStrictEqual(planned.next.value, new Success({ requestId: "request-1" }))
      assert.strictEqual(planned.microsteps.length, 2)
      assert.strictEqual(planned.actions.length, 2)
      assert.deepStrictEqual(yield* deferredLog.read, [])
    }))

  it.effect("send follows always transitions before exposing the actor state", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: { Idle, Loading, Success },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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

      const actor = yield* StateMachine.start(machine, { userId: "user-1" }).pipe(
        Effect.provideService(DeferredLog, deferredLog)
      )

      const snapshot = yield* sendAndWaitForSnapshot(
        actor,
        new Submit({ value: "hello" }),
        (snapshot) => snapshot.state.value._tag === "Success"
      )
      yield* Effect.yieldNow

      assert.deepStrictEqual(snapshot, {
        status: "active",
        state: { path: "Success", value: new Success({ requestId: "request-1" }) }
      })
      assert.deepStrictEqual(yield* deferredLog.read, ["submit", "always"])
    }))

  it.effect("plan processes raised events before settling", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: { Idle, Loading, Success },
        events: [Submit, Resolve],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
      })
        .handle("Idle", {
          on: {
            Submit: Effect.fn(function*({ runtime }) {
              const stateMachine = yield* runtime
              yield* stateMachine.raise(new Resolve({}))
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

      assert.deepStrictEqual(planned.next.value, new Success({ requestId: "request-1" }))
      assert.strictEqual(planned.microsteps.length, 2)
    }))

  it.effect("send processes raised events from entry actions", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: { Idle, Loading, Success },
        events: [Submit, Resolve],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
      })
        .handle("Idle", {
          on: {
            Submit: () => new Loading({ requestId: "request-1" })
          }
        })
        .handle("Loading", {
          entry: ({ runtime }) => Effect.flatMap(runtime, (stateMachine) => stateMachine.raise(new Resolve({}))),
          on: {
            Resolve: ({ state }) => new Success({ requestId: state.requestId })
          }
        })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" })

      const snapshot = yield* sendAndWaitForSnapshot(
        actor,
        new Submit({ value: "hello" }),
        (snapshot) => snapshot.state.value._tag === "Success"
      )

      assert.deepStrictEqual(snapshot, {
        status: "active",
        state: { path: "Success", value: new Success({ requestId: "request-1" }) }
      })
    }))

  it.effect("processes raised events in FIFO order", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: { Idle, Loading, Success },
        events: [Submit, Reset, Resolve],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
      })
        .handle("Idle", {
          on: {
            Submit: Effect.fn(function*({ runtime }) {
              const stateMachine = yield* runtime
              yield* stateMachine.raise(new Reset({}))
              yield* stateMachine.raise(new Resolve({}))
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

      assert.deepStrictEqual(planned.next.value, new Loading({ requestId: "request-2" }))
      assert.strictEqual(planned.microsteps.length, 3)
    }))

  it.effect("queues events raised from exit actions before transition actions", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: { Idle, Loading },
        events: [Submit, Reset, Resolve],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
      })
        .handle("Idle", {
          exit: Effect.fn(function*({ runtime }) {
            const deferredLog = yield* DeferredLog
            yield* StateMachine.action(deferredLog.push("exit"))
            const stateMachine = yield* runtime
            yield* stateMachine.raise(new Reset({}))
          }),
          on: {
            Submit: Effect.fn(function*({ runtime }) {
              const deferredLog = yield* DeferredLog
              yield* StateMachine.action(deferredLog.push("transition"))
              const stateMachine = yield* runtime
              yield* stateMachine.raise(new Resolve({}))
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

      const snapshot = yield* sendAndWaitForSnapshot(
        actor,
        new Submit({ value: "hello" }),
        (snapshot) => snapshot.state.value._tag === "Loading"
      )
      yield* Effect.yieldNow

      assert.deepStrictEqual(yield* deferredLog.read, ["exit", "transition", "reset", "resolve"])
      assert.deepStrictEqual(snapshot, {
        status: "active",
        state: { path: "Loading", value: new Loading({ requestId: "request-1" }) }
      })
    }))

  it.effect("selects always transitions before raised events", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: { Idle, Loading, Success },
        events: [Submit, Reset],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
      })
        .handle("Idle", {
          on: {
            Submit: Effect.fn(function*({ runtime }) {
              const stateMachine = yield* runtime
              yield* stateMachine.raise(new Reset({}))
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

      assert.deepStrictEqual(planned.next.value, new Success({ requestId: "request-2" }))
      assert.strictEqual(planned.microsteps.length, 4)
    }))

  it.effect("stops following always transitions after a no-op microstep", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: { Idle, Loading },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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

      assert.deepStrictEqual(planned.next.value, new Loading({ requestId: "request-1" }))
      assert.strictEqual(planned.microsteps.length, 2)
      assert.strictEqual(planned.microsteps[1]?.changed, false)
    }))

  it.effect("fails when always transitions do not stabilize", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        id: "LoopMachine",
        states: { Idle, Loading },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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
        states: { Idle, Loading },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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

      yield* actor.send(new Submit({ value: "hello" }))
      yield* Effect.yieldNow

      assert.deepStrictEqual(yield* deferredLog.read, ["entry", "transition"])
      assert.deepStrictEqual((yield* actor.state).value, new Idle({ userId: "user-1" }))
    }))

  it.effect("runs exit, transition, and entry actions for reentering self-transitions", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: { Idle },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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

      const snapshot = yield* sendAndWaitForSnapshot(
        actor,
        new Submit({ value: "hello" }),
        (snapshot) => snapshot.state.value._tag === "Idle" && snapshot.state.value.userId === "user-2"
      )
      yield* Effect.yieldNow

      assert.deepStrictEqual(yield* deferredLog.read, [
        "entry:Symbol(effect/StateMachine/InitialEvent)",
        "exit:Submit",
        "transition",
        "entry:Submit"
      ])
      assert.deepStrictEqual(snapshot, {
        status: "active",
        state: { path: "Idle", value: new Idle({ userId: "user-2" }) }
      })
    }))

  it.effect("reentering self-transitions can omit returning a state", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: { Idle },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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

      yield* actor.send(new Submit({ value: "hello" }))
      yield* Effect.yieldNow

      assert.deepStrictEqual(yield* deferredLog.read, [
        "entry:Symbol(effect/StateMachine/InitialEvent)",
        "exit:Submit",
        "transition",
        "entry:Submit"
      ])
      assert.deepStrictEqual((yield* actor.state).value, new Idle({ userId: "user-1" }))
    }))

  it.effect("carries entry and exit action requirements", () =>
    Effect.gen(function*() {
      const deferredLog = yield* makeDeferredLog
      const machine = StateMachine.make({
        states: { Idle, Loading },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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

      const actor = yield* StateMachine.start(machine, { userId: "user-1" }).pipe(
        Effect.provideService(EntryRequirement, EntryRequirement.of({ entryMessage: "entry" })),
        Effect.provideService(ExitRequirement, ExitRequirement.of({ exitMessage: "exit" })),
        Effect.provideService(DeferredLog, deferredLog)
      )

      const snapshot = yield* sendAndWaitForSnapshot(
        actor,
        new Submit({ value: "hello" }),
        (snapshot) => snapshot.state.value._tag === "Loading"
      )
      yield* Effect.yieldNow

      assert.deepStrictEqual(yield* deferredLog.read, ["exit", "entry"])
      assert.deepStrictEqual(snapshot, {
        status: "active",
        state: { path: "Loading", value: new Loading({ requestId: "request-1" }) }
      })
    }))

  it.effect("propagates entry action failures", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: { Idle, Loading },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
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
      yield* actor.send(new Submit({ value: "hello" }))
      const error = yield* Effect.flip(actor.join)

      assert.instanceOf(error, EntryError)
      assert.strictEqual(error._tag, "EntryError")
      assert.strictEqual(error.state, "Loading")
    }))

  it.effect("propagates exit action failures", () =>
    Effect.gen(function*() {
      const machine = StateMachine.make({
        states: { Idle, Loading },
        events: [Submit],
        input: Input,
        initial: (input) => FlatInitial.Idle(new Idle({ userId: input.userId }))
      }).handle("Idle", {
        exit: ({ state }) => StateMachine.action(Effect.fail(new ExitError({ state: state._tag }))),
        on: {
          Submit: () => new Loading({ requestId: "request-1" })
        }
      })

      const actor = yield* StateMachine.start(machine, { userId: "user-1" })
      yield* actor.send(new Submit({ value: "hello" }))
      const error = yield* Effect.flip(actor.join)

      assert.instanceOf(error, ExitError)
      assert.strictEqual(error._tag, "ExitError")
      assert.strictEqual(error.state, "Idle")
    }))
})
