import { Bdd } from "@effect/bdd"
import { Effect, Schema } from "effect"

type Account = {
  readonly username: string
  readonly status: string
  readonly signedIn: boolean
}

const username = Bdd.capture("username", Schema.String)
const status = Bdd.capture("status", Schema.String)

export const accountAccess = Bdd.feature<Account>("CLI account access", {
  initial: {
    username: "",
    status: "locked",
    signedIn: false
  }
}).pipe(
  Bdd.given`account ${username} is ${status}`(({ username, status }) => {
    const account: Account = {
      username,
      status,
      signedIn: false
    }
    return Effect.succeed(account)
  }),
  Bdd.when`the account signs in`((_captures, state) => {
    const account: Account = {
      ...state,
      signedIn: true
    }
    return Effect.succeed(account)
  }),
  Bdd.then`access is granted`((_captures, state) =>
    state.signedIn && state.status === "active"
      ? Effect.succeed(state)
      : Effect.fail(`expected access for active account ${state.username}` as const)
  ),
  Bdd.then`access is denied`((_captures, state) =>
    state.signedIn && state.status === "locked"
      ? Effect.succeed(state)
      : Effect.fail(`expected denial for locked account ${state.username}` as const)
  )
)
