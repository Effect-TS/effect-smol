import { Schema } from "effect"
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
      initial: () => new Down({})
    })

    expect(machine.states).type.toBe<typeof UpStates.states>()
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
