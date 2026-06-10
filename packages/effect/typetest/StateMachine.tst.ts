import { Effect, Schema } from "effect"
import { StateMachine } from "effect/unstable/actors"
import { describe, expect, it } from "tstyche"

describe("StateMachine", () => {
  class Up extends Schema.TaggedClass<Up>("Up")("Up", {
    id: Schema.String
  }) {}

  class Down extends Schema.TaggedClass<Down>("Down")("Down", {}) {}

  class Auth extends Schema.TaggedClass<Auth>("Auth")("Auth", {
    userId: Schema.String
  }) {}

  class SignedOut extends Schema.TaggedClass<SignedOut>("SignedOut")("SignedOut", {}) {}

  class SignedIn extends Schema.TaggedClass<SignedIn>("SignedIn")("SignedIn", {
    userId: Schema.String
  }) {}

  class Sync extends Schema.TaggedClass<Sync>("Sync")("Sync", {
    enabled: Schema.Boolean
  }) {}

  class SyncIdle extends Schema.TaggedClass<SyncIdle>("SyncIdle")("SyncIdle", {}) {}

  class Syncing extends Schema.TaggedClass<Syncing>("Syncing")("Syncing", {
    requestId: Schema.String
  }) {}

  class SignIn extends Schema.TaggedClass<SignIn>("SignIn")("SignIn", {
    userId: Schema.String
  }) {}

  const UpStates = StateMachine.defineStates({
    up: {
      schema: Up,
      type: "parallel",
      states: {
        auth: {
          schema: Auth,
          initial: "signedOut",
          states: {
            signedOut: SignedOut,
            signedIn: SignedIn
          }
        },
        sync: {
          schema: Sync,
          initial: "idle",
          states: {
            idle: SyncIdle,
            syncing: Syncing
          }
        }
      }
    },
    down: Down
  })

  type ChildBuilder<Method> = Method extends (value: any, build: (builder: infer Builder) => any) => any ? Builder
    : never
  type IsCallable<A> = A extends (...args: ReadonlyArray<any>) => any ? true : false

  type SignInContext = StateMachine.Machine.HandlerContext<
    typeof UpStates.states,
    readonly [typeof SignIn],
    [],
    "down",
    "SignIn",
    never,
    never
  >

  type SignedOutContext = StateMachine.Machine.HandlerContext<
    typeof UpStates.states,
    readonly [typeof SignIn],
    [],
    "up.auth.signedOut",
    "SignIn",
    never,
    never
  >

  type AuthContext = StateMachine.Machine.HandlerContext<
    typeof UpStates.states,
    readonly [typeof SignIn],
    [],
    "up.auth",
    "SignIn",
    never,
    never
  >

  it("defineStates preserves literal state paths", () => {
    expect<StateMachine.Machine.StateIdentifier<typeof UpStates.states>>().type.toBe<
      | "up"
      | "up.auth"
      | "up.auth.signedOut"
      | "up.auth.signedIn"
      | "up.sync"
      | "up.sync.idle"
      | "up.sync.syncing"
      | "down"
    >()
  })

  it("make accepts defined states", () => {
    const machine = StateMachine.make({
      states: UpStates.states,
      events: [SignIn],
      initial: () => UpStates.initial.down(new Down({}))
    })

    expect(machine.states).type.toBe<typeof UpStates.states>()
  })

  it("make rejects raw decoded initial states", () => {
    expect(StateMachine.make).type.not.toBeCallableWith({
      states: UpStates.states,
      events: [SignIn],
      initial: () => new Down({})
    })
  })

  it("make accepts effectful initial snapshots", () => {
    const machine = StateMachine.make({
      states: UpStates.states,
      events: [SignIn],
      initial: () => Effect.succeed(UpStates.initial.down(new Down({})))
    })

    expect(machine.states).type.toBe<typeof UpStates.states>()
  })

  it("plan and getters require snapshots", () => {
    const machine = StateMachine.make({
      states: UpStates.states,
      events: [SignIn],
      initial: () => UpStates.initial.down(new Down({}))
    })

    expect(StateMachine.plan).type.toBeCallableWith(
      machine,
      UpStates.initial.down(new Down({})),
      new SignIn({
        userId: "user-1"
      })
    )
    expect(StateMachine.enabled).type.toBeCallableWith(machine, UpStates.initial.down(new Down({})))
    expect(StateMachine.isFinal).type.toBeCallableWith(machine, UpStates.initial.down(new Down({})))

    expect(StateMachine.plan).type.not.toBeCallableWith(machine, new Down({}), new SignIn({ userId: "user-1" }))
    expect(StateMachine.enabled).type.not.toBeCallableWith(machine, new Down({}))
    expect(StateMachine.isFinal).type.not.toBeCallableWith(machine, new Down({}))
  })

  it("handlers reject raw decoded state returns", () => {
    const machine = StateMachine.make({
      states: UpStates.states,
      events: [SignIn],
      initial: () => UpStates.initial.down(new Down({}))
    })

    expect(machine.handle).type.not.toBeCallableWith("down", {
      on: {
        SignIn: () => new Down({})
      }
    })
    expect(machine.handle).type.not.toBeCallableWith("down", {
      on: {
        SignIn: () => Effect.succeed(new Down({}))
      }
    })
  })

  it("initial builder constructs typed initial snapshots", () => {
    const snapshot = UpStates.initial.up(
      new Up({ id: "up-1" }),
      (up) =>
        up
          .auth(
            new Auth({ userId: "guest" }),
            (auth) => auth.signedOut(new SignedOut({}))
          )
          .sync(
            new Sync({ enabled: true }),
            (sync) => sync.idle(new SyncIdle({}))
          )
    )

    expect(snapshot).type.toBeAssignableTo<
      StateMachine.Machine.SnapshotByIdentifier<typeof UpStates.states, "up">
    >()
    expect(snapshot.path).type.toBe<"up">()
    expect(snapshot.value).type.toBe<Up>()
    expect(snapshot.states.auth.value).type.toBe<Auth>()
    expect(snapshot.states.auth.state.path).type.toBe<"up.auth.signedOut">()
    expect(snapshot.states.sync.value).type.toBe<Sync>()
    expect(snapshot.states.sync.state.path).type.toBe<"up.sync.idle">()
  })

  it("initial builder rejects incomplete parallel callbacks", () => {
    expect(UpStates.initial.up).type.not.toBeCallableWith(
      new Up({ id: "up-1" }),
      (up: ChildBuilder<typeof UpStates.initial.up>) =>
        up.auth(
          new Auth({ userId: "guest" }),
          (auth) => auth.signedOut(new SignedOut({}))
        )
    )
  })

  it("initial builder exposes only the declared compound initial child", () => {
    const up = null as unknown as ChildBuilder<typeof UpStates.initial.up>
    const auth = null as unknown as ChildBuilder<typeof up.auth>

    expect(auth.signedOut).type.toBeCallableWith(new SignedOut({}))
    expect(auth).type.not.toHaveProperty("signedIn")
  })

  it("initial builder checks values at parent and leaf nodes", () => {
    const up = null as unknown as ChildBuilder<typeof UpStates.initial.up>
    const sync = null as unknown as ChildBuilder<typeof up.sync>

    expect(UpStates.initial.down).type.not.toBeCallableWith(new Up({ id: "up-1" }))
    expect(UpStates.initial.up).type.not.toBeCallableWith(
      new Auth({ userId: "guest" }),
      (up: ChildBuilder<typeof UpStates.initial.up>) =>
        up
          .auth(
            new Auth({ userId: "guest" }),
            (auth) => auth.signedOut(new SignedOut({}))
          )
          .sync(
            new Sync({ enabled: true }),
            (sync) => sync.idle(new SyncIdle({}))
          )
    )
    expect(up.auth).type.not.toBeCallableWith(
      new Up({ id: "up-1" }),
      (auth: ChildBuilder<typeof up.auth>) => auth.signedOut(new SignedOut({}))
    )
    expect(sync.idle).type.not.toBeCallableWith(new Syncing({ requestId: "sync-1" }))
  })

  it("initial builder removes parallel region methods after they are called", () => {
    const up = null as unknown as ChildBuilder<typeof UpStates.initial.up>
    const afterAuth = up.auth(
      new Auth({ userId: "guest" }),
      (auth) => auth.signedOut(new SignedOut({}))
    )
    const complete = afterAuth.sync(
      new Sync({ enabled: true }),
      (sync) => sync.idle(new SyncIdle({}))
    )

    expect(afterAuth).type.not.toHaveProperty("auth")
    expect(afterAuth).type.toHaveProperty("sync")
    expect(complete).type.not.toHaveProperty("sync")
    expect(complete).type.not.toHaveProperty("done")
  })

  it("target.full constructs typed full snapshots", () => {
    const context = null as unknown as SignInContext
    const snapshot = context.target.full.up(
      new Up({ id: "up-1" }),
      (up) =>
        up
          .auth(
            new Auth({ userId: "guest" }),
            (auth) => auth.signedIn(new SignedIn({ userId: "user-1" }))
          )
          .sync(
            new Sync({ enabled: true }),
            (sync) => sync.syncing(new Syncing({ requestId: "sync-1" }))
          )
    )

    expect(snapshot).type.toBeAssignableTo<
      StateMachine.Machine.SnapshotByIdentifier<typeof UpStates.states, "up">
    >()
    expect(snapshot.path).type.toBe<"up">()
    expect(snapshot.states.auth.state.path).type.toBe<"up.auth.signedOut" | "up.auth.signedIn">()
    expect(snapshot.states.sync.state.path).type.toBe<"up.sync.idle" | "up.sync.syncing">()
  })

  it("target.full requires every parallel region", () => {
    const context = null as unknown as SignInContext

    expect(context.target.full.up).type.not.toBeCallableWith(
      new Up({ id: "up-1" }),
      (up: ChildBuilder<typeof context.target.full.up>) =>
        up.auth(
          new Auth({ userId: "guest" }),
          (auth) => auth.signedIn(new SignedIn({ userId: "user-1" }))
        )
    )
  })

  it("target.full exposes every compound child", () => {
    const context = null as unknown as SignInContext
    const up = null as unknown as ChildBuilder<typeof context.target.full.up>
    const auth = null as unknown as ChildBuilder<typeof up.auth>

    expect(auth.signedOut).type.toBeCallableWith(new SignedOut({}))
    expect(auth.signedIn).type.toBeCallableWith(new SignedIn({ userId: "user-1" }))
  })

  it("target.local constructs typed local leaf targets", () => {
    const context = null as unknown as SignedOutContext
    const target = context.target.local.signedIn(new SignedIn({ userId: "user-1" }))

    expect(target).type.toBeAssignableTo<
      StateMachine.Machine.Target<typeof UpStates.states, "up.auth.signedIn">
    >()
    expect(target.path).type.toBe<"up.auth.signedIn">()
    expect(target.value).type.toBe<SignedIn>()
  })

  it("target.local exposes the source compound children when the source is compound", () => {
    const context = null as unknown as AuthContext

    expect(context.target.local.signedOut).type.toBeCallableWith(new SignedOut({}))
    expect(context.target.local.signedIn).type.toBeCallableWith(new SignedIn({ userId: "user-1" }))
  })

  it("target.local.with checks the local compound value", () => {
    const context = null as unknown as SignedOutContext
    const target = context.target.local.with(
      new Auth({ userId: "user-1" }),
      (auth) => auth.signedIn(new SignedIn({ userId: "user-1" }))
    )

    expect(target.path).type.toBe<"up.auth.signedIn">()
    expect(context.target.local.with).type.not.toBeCallableWith(
      new Up({ id: "up-1" }),
      (auth: ChildBuilder<typeof context.target.local.with>) => auth.signedIn(new SignedIn({ userId: "user-1" }))
    )
  })

  it("target.local rejects unrelated children and wrong values", () => {
    const context = null as unknown as SignedOutContext

    expect(context.target.local).type.not.toHaveProperty("sync")
    expect(context.target.local).type.not.toHaveProperty("down")
    expect(context.target.local).type.not.toHaveProperty("idle")
    expect(context.target.local.signedIn).type.not.toBeCallableWith(new SignedOut({}))
  })

  it("target.local exposes no methods outside a compound scope", () => {
    const context = null as unknown as SignInContext

    expect(context.target.local).type.not.toHaveProperty("up")
    expect(context.target.local).type.not.toHaveProperty("down")
    expect(context.target.local).type.not.toHaveProperty("with")
  })

  it("target.branch exposes only the source root", () => {
    const context = null as unknown as SignedOutContext
    const downContext = null as unknown as SignInContext

    expect(context.target.branch).type.toHaveProperty("up")
    expect(context.target.branch).type.not.toHaveProperty("down")
    expect(downContext.target.branch).type.toHaveProperty("down")
    expect(downContext.target.branch).type.not.toHaveProperty("up")
  })

  it("target.branch constructs typed partial branch targets", () => {
    const context = null as unknown as SignedOutContext
    const target = context.target.branch.up.sync(
      new Sync({ enabled: true }),
      (sync) => sync.syncing(new Syncing({ requestId: "sync-1" }))
    )

    expect(target).type.toBeAssignableTo<
      StateMachine.Machine.Target<typeof UpStates.states, "up.sync.syncing">
    >()
    expect(target.path).type.toBe<"up.sync.syncing">()
    expect(target.value).type.toBe<Syncing>()
  })

  it("target.branch can replace ancestors before selecting a leaf", () => {
    const context = null as unknown as SignedOutContext
    const target = context.target.branch.up(
      new Up({ id: "up-2" }),
      (up) =>
        up.auth(
          new Auth({ userId: "user-1" }),
          (auth) => auth.signedIn(new SignedIn({ userId: "user-1" }))
        )
    )

    expect(target.path).type.toBe<"up.auth.signedIn">()
    expect(target.value).type.toBe<SignedIn>()
  })

  it("target.branch rejects non-leaf targets and wrong values", () => {
    const context = null as unknown as SignedOutContext

    expect(context.target.branch.up).type.not.toBeCallableWith(new Up({ id: "up-1" }))
    expect(context.target.branch.up.sync).type.not.toBeCallableWith(new Sync({ enabled: true }))
    expect(context.target.branch.up.sync).type.not.toBeCallableWith(
      new Auth({ userId: "user-1" }),
      (sync: ChildBuilder<typeof context.target.branch.up.sync>) => sync.syncing(new Syncing({ requestId: "sync-1" }))
    )
    expect(context.target.branch.up.auth.signedIn).type.not.toBeCallableWith(new SignedOut({}))
  })

  it("target is not callable", () => {
    const context = null as unknown as SignInContext

    expect<IsCallable<typeof context.target>>().type.toBe<false>()
  })

  it("rejects invalid compound initial keys", () => {
    expect(StateMachine.defineStates).type.not.toBeCallableWith({
      up: {
        schema: Up,
        initial: "missing",
        states: {
          signedOut: SignedOut
        }
      }
    })
  })

  it("rejects initial keys on parallel states", () => {
    expect(StateMachine.defineStates).type.not.toBeCallableWith({
      up: {
        schema: Up,
        type: "parallel",
        initial: "auth",
        states: {
          auth: Auth
        }
      }
    })
  })

  it("rejects invalid nested state definitions", () => {
    expect(StateMachine.defineStates).type.not.toBeCallableWith({
      up: {
        schema: Up,
        type: "parallel",
        states: {
          auth: {
            schema: Auth,
            initial: "missing",
            states: {
              signedOut: SignedOut
            }
          }
        }
      }
    })
  })

  it("rejects child states on final states", () => {
    expect(StateMachine.defineStates).type.not.toBeCallableWith({
      down: {
        schema: Down,
        type: "final",
        states: {
          child: SignedOut
        }
      }
    })
  })
})
