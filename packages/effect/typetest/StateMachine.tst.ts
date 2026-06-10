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
