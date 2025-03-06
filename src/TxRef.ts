/**
 * TxRef is a transactional value, it can be read and modified within the body of a transaction.
 *
 * Accessed values are tracked by the transaction in order to detect conflicts and in order to
 * track changes, a transaction will retry whenever a conflict is detected or whenever the
 * transaction explicitely calls to `Effect.retryTransaction` and any of the accessed TxRef values
 * change.
 *
 * @since 4.0.0
 */

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
    const state = yield* Effect.Transaction
    if (!state.journal.has(self)) {
      state.journal.set(self, { version: self.version, value: self.value })
    }
    const current = state.journal.get(self)!
    current.value = f(current.value)
    return current.value as A
  },
  Effect.transaction
)

export const get = <A>(self: TxRef<A>) => update(self, identity)

export const set = <A>(self: TxRef<A>, value: A) => update(self, () => value)
