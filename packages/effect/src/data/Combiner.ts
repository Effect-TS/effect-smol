/**
 * @since 4.0.0
 */
import type * as Order from "./Order.ts"

/**
 * A `Combiner` represents any type of value that can be combined
 * with another value of the same type to produce a new value.
 *
 * Examples:
 * - numbers with addition
 * - strings with concatenation
 * - arrays with merging
 *
 * @category model
 * @since 4.0.0
 */
export interface Combiner<A> {
  /**
   * Combines two values into a new value.
   */
  readonly combine: (self: A, that: A) => A
}

/**
 * Creates a `Combiner` from a `combine` function.
 *
 * @since 4.0.0
 */
export function make<A>(combine: (self: A, that: A) => A): Combiner<A> {
  return { combine }
}

/**
 * @since 4.0.0
 */
export function flip<A>(combiner: Combiner<A>): Combiner<A> {
  return make((self, that) => combiner.combine(that, self))
}

/**
 * Creates a `Combiner` that returns the smaller of two values.
 *
 * @since 4.0.0
 */
export function min<A>(order: Order.Order<A>): Combiner<A> {
  return make((self, that) => order(self, that) === -1 ? self : that)
}

/**
 * Creates a `Combiner` that returns the larger of two values.
 *
 * @since 4.0.0
 */
export function max<A>(order: Order.Order<A>): Combiner<A> {
  return make((self, that) => order(self, that) === 1 ? self : that)
}

/**
 * Creates a `Combiner` that returns the first value.
 *
 * @since 4.0.0
 */
export function first<A>(): Combiner<A> {
  return make((self, _) => self)
}

/**
 * Creates a `Combiner` that returns the last value.
 *
 * @since 4.0.0
 */
export function last<A>(): Combiner<A> {
  return make((_, that) => that)
}

/**
 * Creates a `Combiner` that returns a constant value.
 *
 * @since 4.0.0
 */
export function constant<A>(a: A): Combiner<A> {
  return make(() => a)
}

/**
 * Between each pair of elements insert `middle`.
 *
 * @since 4.0.0
 */
export function intercalate<A>(middle: A) {
  return (combiner: Combiner<A>): Combiner<A> =>
    make((self, that) => combiner.combine(self, combiner.combine(middle, that)))
}
