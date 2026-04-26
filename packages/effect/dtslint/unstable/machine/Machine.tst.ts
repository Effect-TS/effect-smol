import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Context from "effect/Context"
import * as Machine from "effect/unstable/machine/Machine"
import { describe, expect, it } from "tstyche"

describe("Machine", () => {
  it("infers machine state schemas from state definitions", () => {
    const User = Schema.Struct({
      id: Schema.String,
      email: Schema.String
    })

    class Create extends Schema.TaggedClass<Create, { readonly _: unique symbol }>()(
      "Create",
      { email: Schema.String }
    ) {}

    class Rename extends Schema.TaggedClass<Rename, { readonly _: unique symbol }>()(
      "Rename",
      { email: Schema.String }
    ) {}

    class Delete extends Schema.TaggedClass<Delete, { readonly _: unique symbol }>()(
      "Delete",
      {}
    ) {}

    class Uncreated extends Schema.TaggedClass<Uncreated, { readonly _: unique symbol }>()(
      "Uncreated",
      {}
    ) {}

    class Created extends Schema.TaggedClass<Created, { readonly _: unique symbol }>()(
      "Created",
      { user: User }
    ) {}

    class Deleted extends Schema.TaggedClass<Deleted, { readonly _: unique symbol }>()(
      "Deleted",
      { userId: Schema.String }
    ) {}

    const UserMachine = Machine.make({
      events: [Create, Rename, Delete],
      initial: () => new Uncreated({}),
      states: [Uncreated, Created, Deleted]
    })
      .handlers("Uncreated")({
        Create: ({ event }) => new Created({ user: { id: "user-1", email: event.email } })
      })
      .handlers("Created")({
        Rename: ({ state, event }) => new Created({ user: { ...state.user, email: event.email } }),
        Delete: ({ state }) => new Deleted({ userId: state.user.id })
      })

    expect<Machine.Snapshot<Machine.StateSchemasOf<typeof UserMachine>>>().type.toBe<
      | Uncreated
      | Created
      | Deleted
    >()
    expect<Machine.DeferredServicesOf<typeof UserMachine>>().type.toBe<never>()
    const next = Machine.next(UserMachine, Machine.initial(UserMachine), new Create({ email: "a@example.com" }))
    expect<typeof next>().type.toBe<Effect.Effect<Uncreated | Created | Deleted, Machine.UnhandledEventError>>()
  })

  it("contextually types handlers", () => {
    class Create extends Schema.TaggedClass<Create, { readonly _: unique symbol }>()(
      "Create",
      { email: Schema.String }
    ) {}

    class Uncreated extends Schema.TaggedClass<Uncreated, { readonly _: unique symbol }>()(
      "Uncreated",
      { count: Schema.Number }
    ) {}

    class Created extends Schema.TaggedClass<Created, { readonly _: unique symbol }>()(
      "Created",
      { email: Schema.String }
    ) {}

    Machine.make({
      events: [Create],
      initial: () => new Uncreated({ count: 0 }),
      states: [Uncreated, Created]
    }).handlers("Uncreated")({
      Create: ({ event, state }) => {
        expect<typeof event>().type.toBe<Create>()
        expect<typeof state>().type.toBe<Uncreated>()
        return new Created({ email: event.email })
      }
    })
  })

  it("does not infer deferred requirements from plain effectful handlers", () => {
    class Create extends Schema.TaggedClass<Create, { readonly _: unique symbol }>()(
      "Create",
      { email: Schema.String }
    ) {}

    class Uncreated extends Schema.TaggedClass<Uncreated, { readonly _: unique symbol }>()(
      "Uncreated",
      {}
    ) {}

    class Created extends Schema.TaggedClass<Created, { readonly _: unique symbol }>()(
      "Created",
      { email: Schema.String }
    ) {}

    const machine = Machine.make({
      events: [Create],
      initial: () => new Uncreated({}),
      states: [Uncreated, Created]
    }).handlers("Uncreated")({
      Create: ({ event }) => Effect.succeed(new Created({ email: event.email }))
    })

    expect<Machine.DeferredErrorOf<typeof machine>>().type.toBe<never>()
    expect<Machine.DeferredServicesOf<typeof machine>>().type.toBe<never>()
  })

  it("accepts events as a tuple of tagged schemas", () => {
    class Create extends Schema.TaggedClass<Create, { readonly _: unique symbol }>()(
      "Create",
      { email: Schema.String }
    ) {}

    class Rename extends Schema.TaggedClass<Rename, { readonly _: unique symbol }>()(
      "Rename",
      { email: Schema.String }
    ) {}

    class Idle extends Schema.TaggedClass<Idle, { readonly _: unique symbol }>()(
      "Idle",
      {}
    ) {}

    class Running extends Schema.TaggedClass<Running, { readonly _: unique symbol }>()(
      "Running",
      { email: Schema.String }
    ) {}

    const machine = Machine.make({
      events: [Create, Rename],
      initial: () => new Idle({}),
      states: [Idle, Running]
    })
      .handlers("Idle")({
        Create: ({ event }) => {
          expect<typeof event>().type.toBe<Create>()
          return new Running({ email: event.email })
        }
      })
      .handlers("Running")({
        Rename: ({ event }) => {
          expect<typeof event>().type.toBe<Rename>()
          return new Running({ email: event.email })
        }
      })

    expect<Machine.Event<typeof machine.event>>().type.toBe<Create | Rename>()
    expect<Machine.MachineErrorOf<typeof machine>>().type.toBe<Machine.UnhandledEventError>()
  })

  it("accepts schema-backed input for initial state", () => {
    const Input = Schema.Struct({
      email: Schema.String
    })

    class Create extends Schema.TaggedClass<Create, { readonly _: unique symbol }>()(
      "Create",
      { email: Schema.String }
    ) {}

    class Uncreated extends Schema.TaggedClass<Uncreated, { readonly _: unique symbol }>()(
      "Uncreated",
      {}
    ) {}

    class Created extends Schema.TaggedClass<Created, { readonly _: unique symbol }>()(
      "Created",
      { email: Schema.String }
    ) {}

    const machine = Machine.make({
      input: Input,
      events: [Create],
      initial: ({ input }) => new Created({ email: input.email }),
      states: [Uncreated, Created]
    }).handlers("Uncreated")({
      Create: ({ event }) => new Created({ email: event.email })
    })

    expect<Machine.InputOf<typeof machine>>().type.toBe<{ readonly email: string }>()
  })

  it("uses unions for parent-scope snapshot and data", () => {
    class Logout extends Schema.TaggedClass<Logout, { readonly _: unique symbol }>()(
      "Logout",
      {}
    ) {}

    class Idle extends Schema.TaggedClass<Idle, { readonly _: unique symbol }>()(
      "Authenticated.Idle",
      { userId: Schema.String }
    ) {}

    class Refreshing extends Schema.TaggedClass<Refreshing, { readonly _: unique symbol }>()(
      "Authenticated.Refreshing",
      { userId: Schema.String, retryCount: Schema.Number }
    ) {}

    class Unauthenticated extends Schema.TaggedClass<Unauthenticated, { readonly _: unique symbol }>()(
      "Unauthenticated",
      {}
    ) {}

    Machine.make({
      events: [Logout],
      initial: () => new Idle({ userId: "user-1" }),
      states: [Unauthenticated, Idle, Refreshing]
    }).handlers("Authenticated")({
      Logout: ({ event, state }) => {
        expect<typeof event>().type.toBe<Logout>()
        expect<typeof state>().type.toBe<Idle | Refreshing>()
        return new Unauthenticated({})
      }
    })
  })

  it("tracks deferred effect errors and services separately from plan requirements", () => {
    class DeferredError extends Schema.TaggedErrorClass<DeferredError, { readonly _: unique symbol }>()(
      "DeferredError",
      {}
    ) {}

    class DeferredDependency extends Context.Service<DeferredDependency, {
      readonly emit: Effect.Effect<void, DeferredError>
    }>()("test/Machine/DeferredDependency") {}

    class Create extends Schema.TaggedClass<Create, { readonly _: unique symbol }>()(
      "Create",
      {}
    ) {}

    class Idle extends Schema.TaggedClass<Idle, { readonly _: unique symbol }>()(
      "Idle",
      {}
    ) {}

    const machine = Machine.make({
      events: [Create],
      initial: () => new Idle({}),
      states: [Idle]
    }).handlers("Idle")({
      Create: () =>
        Effect.gen(function*() {
          yield* Machine.defer(DeferredDependency.use((deferred) => deferred.emit))
          return new Idle({})
        })
    })

    const planned = Machine.plan(machine, Machine.initial(machine), new Create({}))

    expect<Machine.PlanErrorOf<typeof machine>>().type.toBe<never>()
    expect<Machine.PlanServicesOf<typeof machine>>().type.toBe<never>()
    expect<Machine.DeferredErrorOf<typeof machine>>().type.toBe<DeferredError>()
    expect<Machine.DeferredServicesOf<typeof machine>>().type.toBe<DeferredDependency>()
    expect<Machine.ErrorOf<typeof machine>>().type.toBe<DeferredError>()
    expect<Machine.ServicesOf<typeof machine>>().type.toBe<DeferredDependency>()
    expect<typeof planned>().type.toBe<
      Effect.Effect<Machine.Plan<Machine.StateSchemasOf<typeof machine>, typeof machine.event, Idle>, Machine.UnhandledEventError>
    >()
  })
})
