/**
 * @since 4.0.0
 */
import { dual } from "../Function.ts"
import * as Combiner from "./Combiner.ts"
import * as Reducer from "./Reducer.ts"

/**
 * @since 4.0.0
 */
export type UndefinedOr<A> = A | undefined

/**
 * @since 4.0.0
 */
export const map: {
  <A, B>(f: (a: A) => B): (self: UndefinedOr<A>) => UndefinedOr<B>
  <A, B>(self: UndefinedOr<A>, f: (a: A) => B): UndefinedOr<B>
} = dual(2, (self, f) => (self === undefined ? undefined : f(self)))

/**
 * Creates a `Reducer` for `UndefinedOr<A>` that prioritizes the first non-`undefined`
 * value and combines values when both operands are present.
 *
 * This `Reducer` is useful for scenarios where you want to:
 * - Take the first available value (like a fallback chain)
 * - Combine values when both are present
 * - Maintain a `undefined` state only when all values are `undefined`
 *
 * The `initialValue` of the `Reducer` is `undefined`.
 *
 * **Behavior:**
 * - `undefined` + `undefined` = `undefined`
 * - `a` + `undefined` = `a` (first value wins)
 * - `undefined` + `b` = `b` (second value wins)
 * - `a` + `b` = `a + b` (values combined)
 *
 * @since 4.0.0
 */
export function getReducer<A>(combiner: Combiner.Combiner<A>): Reducer.Reducer<UndefinedOr<A>> {
  return Reducer.make((self, that) => {
    if (self === undefined) return that
    if (that === undefined) return self
    return combiner.combine(self, that)
  }, undefined as UndefinedOr<A>)
}

/**
 * Creates a `Combiner` for `UndefinedOr<A>` that only combines values when both
 * operands are not `undefined`, failing fast if either is `undefined`.
 *
 * This `Combiner` is useful for scenarios where you need both values to be
 * present to perform an operation, such as:
 * - Mathematical operations that require two operands
 * - Data validation that needs both fields
 * - Operations that can't proceed with partial data
 *
 * **Behavior:**
 * - `undefined` + `undefined` = `undefined`
 * - `a` + `undefined` = `undefined` (fails fast)
 * - `undefined` + `b` = `undefined` (fails fast)
 * - `a` + `b` = `a + b` (values combined)
 *
 * @see {@link getReducerFailFast} if you have a `Reducer` and want to lift it
 * to `UndefinedOr` values.
 *
 * @since 4.0.0
 */
export function getCombinerFailFast<A>(combiner: Combiner.Combiner<A>): Combiner.Combiner<UndefinedOr<A>> {
  return Combiner.make((self, that) => {
    if (self === undefined || that === undefined) return undefined
    return combiner.combine(self, that)
  })
}

/**
 * Creates a `Reducer` for `UndefinedOr<A>` by wrapping an existing `Reducer` with
 * fail-fast semantics for `UndefinedOr` values.
 *
 * This function lifts a regular `Reducer` into the `UndefinedOr` context, allowing
 * you to use existing `Reducer`s with `UndefinedOr` values while maintaining the
 * fail-fast behavior where any `undefined` value causes the entire reduction to fail.
 *
 * The initial value is `some(reducer.initialValue)`, ensuring the `Reducer`
 * starts with a valid `UndefinedOr` value.
 *
 * **Behavior:**
 * - Fails fast (returns `undefined`) if any operand is `undefined`
 * - Uses the underlying reducer's combine logic when both values are present
 *
 * @see {@link getCombinerFailFast} if you only have a `Combiner` and want to
 * lift it to `UndefinedOr` values.
 *
 * @since 4.0.0
 */
export function getReducerFailFast<A>(reducer: Reducer.Reducer<A>): Reducer.Reducer<UndefinedOr<A>> {
  const combine = getCombinerFailFast(reducer).combine
  const initialValue = reducer.initialValue as UndefinedOr<A>
  return Reducer.make(combine, initialValue, (collection) => {
    let out = initialValue
    for (const value of collection) {
      out = combine(out, value)
      if (out === undefined) return out
    }
    return out
  })
}
