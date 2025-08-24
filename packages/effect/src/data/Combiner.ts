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
 * Creates a `Combiner` for `A | undefined`.
 *
 * If one of the values is `undefined`, the other is returned.
 * If both values are defined, they are combined using the provided `Combiner`.
 *
 * @since 4.0.0
 */
export function UndefinedOr<A>(combiner: Combiner<A>): Combiner<A | undefined> {
  return make((self, that) => (self === undefined ? that : that === undefined ? self : combiner.combine(self, that)))
}

/**
 * Creates a `Combiner` for `A | null`.
 *
 * If one of the values is `null`, the other is returned.
 * If both values are non-null, they are combined using the provided `Combiner`.
 *
 * @since 4.0.0
 */
export function NullOr<A>(combiner: Combiner<A>): Combiner<A | null> {
  return make((self, that) => (self === null ? that : that === null ? self : combiner.combine(self, that)))
}

/**
 * Creates a `Combiner` for a struct (object) shape.
 *
 * Each property is combined using its corresponding property-specific
 * `Combiner`. Optionally, properties can be omitted from the result when the
 * merged value matches `omitKeyWhen`.
 *
 * @since 4.0.0
 */
export function Struct<A>(
  combiners: { readonly [K in keyof A]: Combiner<A[K]> },
  options?: {
    readonly omitKeyWhen?: ((a: A[keyof A]) => boolean) | undefined
  }
): Combiner<A> {
  const omitKeyWhen = options?.omitKeyWhen ?? (() => false)
  return make((self, that) => {
    const keys = Reflect.ownKeys(combiners) as Array<keyof A>
    const out = {} as A
    for (const key of keys) {
      const merge = combiners[key].combine(self[key], that[key])
      if (omitKeyWhen(merge)) continue
      out[key] = merge
    }
    return out
  })
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
