import * as Effect from "./Effect.js"
import { identity } from "./Function.js"

export interface TxRef<A> {
  version: number
  pending: Map<any, () => void>
  value: A
}

export const make = <A>(initial: A) => Effect.sync(() => unsafeMake(initial))

export const unsafeMake = <A>(initial: A): TxRef<A> => ({ pending: new Map(), version: 0, value: initial })

export const update = Effect.fnUntraced(
  function*<A>(self: TxRef<A>, f: (current: A) => A) {
    const state = yield* Effect.Journal
    if (!state.changes.has(self)) {
      state.changes.set(self, { version: self.version, value: self.value })
    }
    const current = state.changes.get(self)!
    const updated = f(current.value)
    state.changes.set(self, { version: current.version, value: updated })
    return updated
  },
  Effect.transaction
)

export const get = <A>(self: TxRef<A>) => update(self, identity)

export const set = <A>(self: TxRef<A>, value: A) => update(self, () => value)
