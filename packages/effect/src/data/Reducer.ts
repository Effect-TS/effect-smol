/**
 * @since 4.0.0
 */

import * as Combiner from "./Combiner.ts"

/**
 * A `Reducer` is a `Combiner` with an `initialValue` and a way to
 * combine a whole collection. Think `Array.prototype.reduce`, but reusable.
 *
 * Common initial values:
 * - numbers with addition: `0`
 * - strings with concatenation: `""`
 * - arrays with concatenation: `[]`
 *
 * @category model
 * @since 4.0.0
 */
export interface Reducer<A> extends Combiner.Combiner<A> {
  /** Neutral starting value (combining with this changes nothing). */
  readonly initialValue: A

  /** Combines all values in the collection, starting from `initialValue`. */
  readonly combineAll: (collection: Iterable<A>) => A
}

/**
 * Creates a `Reducer` from a `combine` function and an `initialValue`.
 *
 * If `combineAll` is omitted, a default implementation reduces left-to-right.
 *
 * @since 4.0.0
 */
export function make<A>(
  combine: (self: A, that: A) => A,
  initialValue: A,
  combineAll?: (collection: Iterable<A>) => A
): Reducer<A> {
  return {
    combine,
    initialValue,
    combineAll: combineAll ??
      ((collection) => {
        let acc = initialValue
        for (const value of collection) {
          acc = combine(acc, value)
        }
        return acc
      })
  }
}

/**
 * `Reducer` for `A | undefined`, using `undefined` as the neutral start.
 *
 * @since 4.0.0
 */
export function UndefinedOr<A>(reducer: Reducer<A>): Reducer<A | undefined> {
  return make(Combiner.UndefinedOr(reducer).combine, undefined)
}

/**
 * `Reducer` for `A | null`, using `null` as the neutral start.
 *
 * @since 4.0.0
 */
export function NullOr<A>(reducer: Reducer<A>): Reducer<A | null> {
  return make(Combiner.NullOr(reducer).combine, null)
}
