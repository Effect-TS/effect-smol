import { assert, describe, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import * as Machine from "effect/unstable/machine/Machine"

describe("Machine", () => {
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

  class AuthenticatedIdle extends Schema.TaggedClass<AuthenticatedIdle, { readonly _: unique symbol }>()(
    "Authenticated.Idle",
    { userId: Schema.String }
  ) {}

  class AuthenticatedRefreshing extends Schema.TaggedClass<AuthenticatedRefreshing, { readonly _: unique symbol }>()(
    "Authenticated.Refreshing",
    { userId: Schema.String }
  ) {}

  class Logout extends Schema.TaggedClass<Logout, { readonly _: unique symbol }>()(
    "Logout",
    {}
  ) {}

  class Refresh extends Schema.TaggedClass<Refresh, { readonly _: unique symbol }>()(
    "Refresh",
    {}
  ) {}

  class Unauthenticated extends Schema.TaggedClass<Unauthenticated, { readonly _: unique symbol }>()(
    "Unauthenticated",
    {}
  ) {}

  const UserMachine = Machine.make({
    id: "UserMachine",
    events: [Create, Rename, Delete],
    initial: () => new Uncreated({}),
    states: [Uncreated, Created, Deleted]
  })
    .handlers("Uncreated")({
      Create: ({ event }) => Effect.succeed(new Created({ user: { id: "user-1", email: event.email } }))
    })
    .handlers("Created")({
      Rename: ({ state, event }) => new Created({ user: { ...state.user, email: event.email } }),
      Delete: ({ state }) => new Deleted({ userId: state.user.id })
    })

  it.effect("supports state-dependent snapshots", () =>
    Effect.gen(function*() {
      const initial = yield* Machine.initial(UserMachine)
      const created = yield* Machine.next(UserMachine, initial, new Create({ email: "a@example.com" }))
      const renamed = yield* Machine.next(UserMachine, created, new Rename({ email: "b@example.com" }))
      const deleted = yield* Machine.next(UserMachine, renamed, new Delete({}))

      assert.instanceOf(initial, Uncreated)
      assert.strictEqual(initial._tag, "Uncreated")

      assert.instanceOf(created, Created)
      assert.strictEqual(created._tag, "Created")
      assert.deepStrictEqual(created.user, {
        id: "user-1",
        email: "a@example.com"
      })

      assert.instanceOf(renamed, Created)
      assert.strictEqual(renamed._tag, "Created")
      assert.deepStrictEqual(renamed.user, {
        id: "user-1",
        email: "b@example.com"
      })

      assert.instanceOf(deleted, Deleted)
      assert.strictEqual(deleted._tag, "Deleted")
      assert.strictEqual(deleted.userId, "user-1")
    }))

  it.effect("returns enabled event tags for the current state", () =>
    Effect.gen(function*() {
      const initial = yield* Machine.initial(UserMachine)
      const created = yield* Machine.next(UserMachine, initial, new Create({ email: "a@example.com" }))

      assert.deepStrictEqual(Machine.enabled(UserMachine, initial), ["Create"])
      assert.deepStrictEqual(Machine.enabled(UserMachine, created), ["Rename", "Delete"])
    }))

  it.effect("machine actor processes events sequentially", () =>
    Effect.gen(function*() {
      const actor = yield* Machine.start(UserMachine)

      yield* actor.send(new Create({ email: "a@example.com" }))
      yield* actor.send(new Rename({ email: "b@example.com" }))

      const snapshot = yield* actor.snapshot
      assert.instanceOf(snapshot, Created)
      assert.strictEqual(snapshot._tag, "Created")
      assert.deepStrictEqual(snapshot.user, {
        id: "user-1",
        email: "b@example.com"
      })
    }))

  it.effect("fails with UnhandledEventError for invalid events in the current state", () =>
    Effect.gen(function*() {
      const initial = yield* Machine.initial(UserMachine)
      const planError = yield* Effect.flip(Machine.next(UserMachine, initial, new Rename({ email: "x@example.com" })))

      assert.instanceOf(planError, Machine.UnhandledEventError)
      assert.strictEqual(planError._tag, "UnhandledEventError")
      assert.strictEqual(planError.machineId, "UserMachine")
      assert.strictEqual(planError.state, "Uncreated")
      assert.strictEqual(planError.event, "Rename")

      const actor = yield* Machine.start(UserMachine)
      const sendError = yield* Effect.flip(actor.send(new Rename({ email: "x@example.com" })))

      assert.instanceOf(sendError, Machine.UnhandledEventError)
      assert.strictEqual(sendError._tag, "UnhandledEventError")
      assert.strictEqual(sendError.machineId, "UserMachine")
      assert.strictEqual(sendError.state, "Uncreated")
      assert.strictEqual(sendError.event, "Rename")
    }))

  it.effect("supports schema-backed input for initial state", () =>
    Effect.gen(function*() {
      const ExistingUserInput = Schema.Struct({
        user: User
      })

      const InputMachine = Machine.make({
        input: ExistingUserInput,
        events: [Rename, Delete],
        states: [Uncreated, Created, Deleted],
        initial: ({ input }) => new Created({ user: input.user })
      })
        .handlers("Created")({
          Rename: ({ state, event }) => new Created({ user: { ...state.user, email: event.email } }),
          Delete: ({ state }) => new Deleted({ userId: state.user.id })
        })

      const initial = yield* Machine.initial(InputMachine, {
        user: {
          id: "seed",
          email: "seed@example.com"
        }
      })

      assert.instanceOf(initial, Created)
      assert.deepStrictEqual(initial.user, {
        id: "seed",
        email: "seed@example.com"
      })
    }))

  it.effect("starts an actor with schema-backed input", () =>
    Effect.gen(function*() {
      const ExistingUserInput = Schema.Struct({
        user: User
      })

      const InputMachine = Machine.make({
        input: ExistingUserInput,
        events: [Rename, Delete],
        states: [Uncreated, Created, Deleted],
        initial: ({ input }) => new Created({ user: input.user })
      })
        .handlers("Created")({
          Rename: ({ state, event }) => new Created({ user: { ...state.user, email: event.email } }),
          Delete: ({ state }) => new Deleted({ userId: state.user.id })
        })

      const actor = yield* Machine.start(InputMachine, {
        user: {
          id: "seed",
          email: "seed@example.com"
        }
      })

      const initial = yield* actor.snapshot

      assert.instanceOf(initial, Created)
      assert.deepStrictEqual(initial.user, {
        id: "seed",
        email: "seed@example.com"
      })

      yield* actor.send(new Rename({ email: "updated@example.com" }))

      const updated = yield* actor.snapshot

      assert.instanceOf(updated, Created)
      assert.deepStrictEqual(updated.user, {
        id: "seed",
        email: "updated@example.com"
      })
    }))

  it.effect("bubbles handler lookup through dotted parent scopes", () =>
    Effect.gen(function*() {
      const LoginInput = Schema.Struct({
        userId: Schema.String
      })

      const RefreshMachine = Machine.make({
        input: LoginInput,
        events: [Logout, Refresh],
        states: [Unauthenticated, AuthenticatedIdle, AuthenticatedRefreshing],
        initial: ({ input }) => new AuthenticatedIdle({ userId: input.userId })
      })
        .handlers("Authenticated")({
          Logout: () => new Unauthenticated({})
        })
        .handlers("Authenticated.Idle")({
          Refresh: ({ state }) => new AuthenticatedRefreshing({ userId: state.userId })
        })

      const initial = yield* Machine.initial(RefreshMachine, { userId: "user-1" })
      const loggedOut = yield* Machine.next(RefreshMachine, initial, new Logout({}))

      assert.instanceOf(initial, AuthenticatedIdle)
      assert.instanceOf(loggedOut, Unauthenticated)
      assert.deepStrictEqual(Machine.enabled(RefreshMachine, initial), ["Refresh", "Logout"])
    }))
})
