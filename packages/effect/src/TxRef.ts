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
import { dual } from "./Function.js"
import type { NoInfer } from "./Types.js"

/**
 * @since 4.0.0
 * @category Symbols
 */
export const TypeId: TypeId = "~effect/TxRef"

/**
 * @since 4.0.0
 * @category Symbols
 */
export type TypeId = "~effect/TxRef"

/**
 * TxRef is a transactional value, it can be read and modified within the body of a transaction.
 *
 * Accessed values are tracked by the transaction in order to detect conflicts and in order to
 * track changes, a transaction will retry whenever a conflict is detected or whenever the
 * transaction explicitely calls to `Effect.retryTransaction` and any of the accessed TxRef values
 * change.
 *
 * @since 4.0.0
 * @category Models
 */
export interface TxRef<in out A> {
  readonly [TypeId]: TypeId

  version: number
  pending: Map<unknown, () => void>
  value: A
}

/**
 * Creates a new `TxRef` with the specified initial value.
 *
 * @since 4.0.0
 * @category Constructors
 */
export const make = <A>(initial: A) => Effect.sync(() => unsafeMake(initial))

/**
 * Creates a new `TxRef` with the specified initial value.
 *
 * @since 4.0.0
 * @category Constructors
 */
export const unsafeMake = <A>(initial: A): TxRef<A> => ({
  [TypeId]: TypeId,
  pending: new Map(),
  version: 0,
  value: initial
})

/**
 * Modifies the value of the `TxRef` using the provided function.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const modify: {
  <A, R>(f: (current: NoInfer<A>) => [returnValue: R, newValue: A]): (self: TxRef<A>) => Effect.Effect<R>
  <A, R>(self: TxRef<A>, f: (current: A) => [returnValue: R, newValue: A]): Effect.Effect<R>
} = dual(
  2,
  <A, R>(self: TxRef<A>, f: (current: A) => [returnValue: R, newValue: A]): Effect.Effect<R> =>
    Effect.transactionWith((state) =>
      Effect.sync(() => {
        if (!state.journal.has(self)) {
          state.journal.set(self, { version: self.version, value: self.value })
        }
        const current = state.journal.get(self)!
        const [returnValue, next] = f(current.value)
        current.value = next
        return returnValue
      })
    )
)

/**
 * Updates the value of the `TxRef` using the provided function.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const update: {
  <A>(f: (current: NoInfer<A>) => A): (self: TxRef<A>) => Effect.Effect<void>
  <A>(self: TxRef<A>, f: (current: A) => A): Effect.Effect<void>
} = dual(
  2,
  <A>(self: TxRef<A>, f: (current: A) => A): Effect.Effect<void> => modify(self, (current) => [void 0, f(current)])
)

/**
 * Reads the current value of the `TxRef`.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const get = <A>(self: TxRef<A>): Effect.Effect<A> => modify(self, (current) => [current, current])

/**
 * Sets the value of the `TxRef`.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const set: {
  <A>(value: A): (self: TxRef<A>) => Effect.Effect<void>
  <A>(self: TxRef<A>, value: A): Effect.Effect<void>
} = dual(2, <A>(self: TxRef<A>, value: A): Effect.Effect<void> => update(self, () => value))
