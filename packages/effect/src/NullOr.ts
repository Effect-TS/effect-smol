/**
 * This module provides small, allocation-free utilities for working with values of type
 * `A | null`, where `null` means "no value".
 *
 * Why not `Option<A>`?
 * In TypeScript, `Option<A>` is often unnecessary. If `null` already models absence
 * in your domain, using `A | null` keeps types simple, avoids extra wrappers, and
 * reduces overhead. The key is that `A` itself must not include `null`; in this
 * module `null` is reserved to mean "no value".
 *
 * When to use `A | null`:
 * - Absence can be represented by `null` in your domain model.
 * - You do not need to distinguish between "no value" and "value is null".
 * - You want straightforward ergonomics and zero extra allocations.
 *
 * When to prefer `Option<A>`:
 * - You must distinguish `None` from `Some(null)` (that is, `null` is a valid
 *   payload and carries meaning on its own).
 * - You need a tagged representation for serialization or pattern matching across
 *   boundaries where `null` would be ambiguous.
 * - You want the richer `Option` API and are comfortable with the extra wrapper.
 *
 * Lawfulness note:
 * All helpers treat `null` as absence. Do not use these utilities with payloads
 * where `A` can itself be `null`, or you will lose information. If you need to
 * carry `null` as a valid payload, use `Option<A>` instead.
 *
 * @since 4.0.0
 */
import * as Combiner from "./Combiner.ts"
import type { LazyArg } from "./Function.ts"
import { dual } from "./Function.ts"
import * as Reducer from "./Reducer.ts"

/**
 * @since 4.0.0
 */
export const map: {
  <A, B>(f: (a: A) => B): (self: A | null) => B | null
  <A, B>(self: A | null, f: (a: A) => B): B | null
} = dual(2, (self, f) => (self === null ? null : f(self)))

/**
 * @since 4.0.0
 */
export const match: {
  <B, A, C = B>(options: {
    readonly onNull: LazyArg<B>
    readonly onNotNull: (a: A) => C
  }): (self: A | null) => B | C
  <A, B, C = B>(self: A | null, options: {
    readonly onNull: LazyArg<B>
    readonly onNotNull: (a: A) => C
  }): B | C
} = dual(
  2,
  <A, B, C = B>(self: A | null, { onNotNull, onNull }: {
    readonly onNull: LazyArg<B>
    readonly onNotNull: (a: A) => C
  }): B | C => self === null ? onNull() : onNotNull(self)
)

/**
 * @since 4.0.0
 */
export const getOrThrowWith: {
  (onNull: () => unknown): <A>(self: A | null) => A
  <A>(self: A | null, onNull: () => unknown): A
} = dual(2, <A>(self: A | null, onNull: () => unknown): A => {
  if (self !== null) {
    return self
  }
  throw onNull()
})

/**
 * @since 4.0.0
 */
export const getOrThrow: <A>(self: A | null) => A = getOrThrowWith(() => new Error("getOrThrow called on a null"))

/**
 * @since 4.0.0
 */
export const liftThrowable = <A extends ReadonlyArray<unknown>, B>(
  f: (...a: A) => B
): (...a: A) => B | null =>
(...a) => {
  try {
    return f(...a)
  } catch {
    return null
  }
}

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
export function makeReducer<A>(combiner: Combiner.Combiner<A>): Reducer.Reducer<A | null> {
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
 * @see {@link makeReducerFailFast} if you have a `Reducer` and want to lift it
 * to `NullOr` values.
 *
 * @since 4.0.0
 */
export function makeCombinerFailFast<A>(combiner: Combiner.Combiner<A>): Combiner.Combiner<A | null> {
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
 * @see {@link makeCombinerFailFast} if you only have a `Combiner` and want to
 * lift it to `NullOr` values.
 *
 * @since 4.0.0
 */
export function makeReducerFailFast<A>(reducer: Reducer.Reducer<A>): Reducer.Reducer<A | null> {
  const combine = makeCombinerFailFast(reducer).combine
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
