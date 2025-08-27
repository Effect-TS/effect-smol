/**
 * @since 4.0.0
 */
import { dual } from "../Function.ts"
import * as Combiner from "./Combiner.ts"
import * as Reducer from "./Reducer.ts"

/**
 * @since 4.0.0
 */
export const map: {
  <A, B>(f: (a: A) => B): (self: A | null) => B | null
  <A, B>(self: A | null, f: (a: A) => B): B | null
} = dual(2, (self, f) => (self === null ? null : f(self)))

/**
 * Creates a `Reducer` for `NullOr<A>` that prioritizes the first non-`null`
 * value and combines values when both operands are present.
 *
 * This `Reducer` is useful for scenarios where you want to:
 * - Take the first available value (like a fallback chain)
 * - Combine values when both are present
 * - Maintain a `null` state only when all values are `null`
 *
 * The `initialValue` of the `Reducer` is `null`.
 *
 * **Behavior:**
 * - `null` + `null` = `null`
 * - `a` + `null` = `a` (first value wins)
 * - `null` + `b` = `b` (second value wins)
 * - `a` + `b` = `a + b` (values combined)
 *
 * @since 4.0.0
 */
export function getReducer<A>(combiner: Combiner.Combiner<A>): Reducer.Reducer<A | null> {
  return Reducer.make((self, that) => {
    if (self === null) return that
    if (that === null) return self
    return combiner.combine(self, that)
  }, null as A | null)
}

/**
 * Creates a `Combiner` for `NullOr<A>` that only combines values when both
 * operands are not `null`, failing fast if either is `null`.
 *
 * This `Combiner` is useful for scenarios where you need both values to be
 * present to perform an operation, such as:
 * - Mathematical operations that require two operands
 * - Data validation that needs both fields
 * - Operations that can't proceed with partial data
 *
 * **Behavior:**
 * - `null` + `null` = `null`
 * - `a` + `null` = `null` (fails fast)
 * - `null` + `b` = `null` (fails fast)
 * - `a` + `b` = `a + b` (values combined)
 *
 * @see {@link getReducerFailFast} if you have a `Reducer` and want to lift it
 * to `NullOr` values.
 *
 * @since 4.0.0
 */
export function getCombinerFailFast<A>(combiner: Combiner.Combiner<A>): Combiner.Combiner<A | null> {
  return Combiner.make((self, that) => {
    if (self === null || that === null) return null
    return combiner.combine(self, that)
  })
}

/**
 * Creates a `Reducer` for `NullOr<A>` by wrapping an existing `Reducer` with
 * fail-fast semantics for `NullOr` values.
 *
 * This function lifts a regular `Reducer` into the `NullOr` context, allowing
 * you to use existing `Reducer`s with `NullOr` values while maintaining the
 * fail-fast behavior where any `null` value causes the entire reduction to fail.
 *
 * The initial value is `some(reducer.initialValue)`, ensuring the `Reducer`
 * starts with a valid `NullOr` value.
 *
 * **Behavior:**
 * - Fails fast (returns `null`) if any operand is `null`
 * - Uses the underlying reducer's combine logic when both values are present
 *
 * @see {@link getCombinerFailFast} if you only have a `Combiner` and want to
 * lift it to `NullOr` values.
 *
 * @since 4.0.0
 */
export function getReducerFailFast<A>(reducer: Reducer.Reducer<A>): Reducer.Reducer<A | null> {
  const combine = getCombinerFailFast(reducer).combine
  const initialValue = reducer.initialValue as A | null
  return Reducer.make(combine, initialValue, (collection) => {
    let out = initialValue
    for (const value of collection) {
      out = combine(out, value)
      if (out === null) return out
    }
    return out
  })
}
