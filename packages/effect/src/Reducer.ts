/**
 * @since 4.0.0
 */

import type * as Combiner from "./Combiner.ts"

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
        let out = initialValue
        for (const value of collection) {
          out = combine(out, value)
        }
        return out
      })
  }
}

/**
 * @since 4.0.0
 */
export function flip<A>(reducer: Reducer<A>): Reducer<A> {
  return make((self, that) => reducer.combine(that, self), reducer.initialValue)
}
