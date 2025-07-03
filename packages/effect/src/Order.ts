/**
 * This module provides an implementation of the `Order` type class which is used to define a total ordering on some type `A`.
 * An order is defined by a relation `<=`, which obeys the following laws:
 *
 * - either `x <= y` or `y <= x` (totality)
 * - if `x <= y` and `y <= x`, then `x == y` (antisymmetry)
 * - if `x <= y` and `y <= z`, then `x <= z` (transitivity)
 *
 * The truth table for compare is defined as follows:
 *
 * | `x <= y` | `x >= y` | Ordering |                       |
 * | -------- | -------- | -------- | --------------------- |
 * | `true`   | `true`   | `0`      | corresponds to x == y |
 * | `true`   | `false`  | `< 0`    | corresponds to x < y  |
 * | `false`  | `true`   | `> 0`    | corresponds to x > y  |
 *
 * @since 2.0.0
 */
import { dual } from "./Function.js"
import type { TypeLambda } from "./HKT.js"

/**
 * @category type class
 * @since 2.0.0
 */
export interface Order<in A> {
  (self: A, that: A): -1 | 0 | 1
}

/**
 * @category type lambdas
 * @since 2.0.0
 */
export interface OrderTypeLambda extends TypeLambda {
  readonly type: Order<this["Target"]>
}

/**
 * Creates a new `Order` instance from a comparison function.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Order } from "effect"
 *
 * const byAge = Order.make<{ name: string, age: number }>((self, that) => {
 *   if (self.age < that.age) return -1
 *   if (self.age > that.age) return 1
 *   return 0
 * })
 *
 * assert.deepStrictEqual(byAge({ name: "Alice", age: 30 }, { name: "Bob", age: 25 }), 1)
 * assert.deepStrictEqual(byAge({ name: "Alice", age: 25 }, { name: "Bob", age: 30 }), -1)
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const make = <A>(
  compare: (self: A, that: A) => -1 | 0 | 1
): Order<A> =>
(self, that) => self === that ? 0 : compare(self, that)

/**
 * An `Order` instance for strings that compares them lexicographically.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Order } from "effect"
 *
 * assert.deepStrictEqual(Order.string("apple", "banana"), -1)
 * assert.deepStrictEqual(Order.string("banana", "apple"), 1)
 * assert.deepStrictEqual(Order.string("apple", "apple"), 0)
 * ```
 *
 * @category instances
 * @since 2.0.0
 */
export const string: Order<string> = make((self, that) => self < that ? -1 : 1)

/**
 * An `Order` instance for numbers that compares them numerically.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Order } from "effect"
 *
 * assert.deepStrictEqual(Order.number(1, 2), -1)
 * assert.deepStrictEqual(Order.number(2, 1), 1)
 * assert.deepStrictEqual(Order.number(1, 1), 0)
 * ```
 *
 * @category instances
 * @since 2.0.0
 */
export const number: Order<number> = make((self, that) => self < that ? -1 : 1)

/**
 * An `Order` instance for booleans where `false` is considered less than `true`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Order } from "effect"
 *
 * assert.deepStrictEqual(Order.boolean(false, true), -1)
 * assert.deepStrictEqual(Order.boolean(true, false), 1)
 * assert.deepStrictEqual(Order.boolean(true, true), 0)
 * ```
 *
 * @category instances
 * @since 2.0.0
 */
export const boolean: Order<boolean> = make((self, that) => self < that ? -1 : 1)

/**
 * An `Order` instance for bigints that compares them numerically.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Order } from "effect"
 *
 * assert.deepStrictEqual(Order.bigint(1n, 2n), -1)
 * assert.deepStrictEqual(Order.bigint(2n, 1n), 1)
 * assert.deepStrictEqual(Order.bigint(1n, 1n), 0)
 * ```
 *
 * @category instances
 * @since 2.0.0
 */
export const bigint: Order<bigint> = make((self, that) => self < that ? -1 : 1)

/**
 * Creates a new `Order` that reverses the comparison order of the input `Order`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Order } from "effect"
 *
 * const reverseNumber = Order.reverse(Order.number)
 *
 * assert.deepStrictEqual(reverseNumber(1, 2), 1)
 * assert.deepStrictEqual(reverseNumber(2, 1), -1)
 * assert.deepStrictEqual(reverseNumber(1, 1), 0)
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export const reverse = <A>(O: Order<A>): Order<A> => make((self, that) => O(that, self))

/**
 * Combines two `Order` instances to create a new `Order` that first compares using the first `Order`,
 * and if the values are equal, then compares using the second `Order`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Order } from "effect"
 *
 * const byAge = Order.mapInput(Order.number, (person: { name: string, age: number }) => person.age)
 * const byName = Order.mapInput(Order.string, (person: { name: string, age: number }) => person.name)
 * const byAgeAndName = Order.combine(byAge, byName)
 *
 * const person1 = { name: "Alice", age: 30 }
 * const person2 = { name: "Bob", age: 30 }
 * const person3 = { name: "Charlie", age: 25 }
 *
 * assert.deepStrictEqual(byAgeAndName(person1, person2), -1) // Same age, Alice < Bob
 * assert.deepStrictEqual(byAgeAndName(person1, person3), 1) // Alice (30) > Charlie (25)
 * ```
 *
 * @category combining
 * @since 2.0.0
 */
export const combine: {
  <A>(that: Order<A>): (self: Order<A>) => Order<A>
  <A>(self: Order<A>, that: Order<A>): Order<A>
} = dual(2, <A>(self: Order<A>, that: Order<A>): Order<A> =>
  make((a1, a2) => {
    const out = self(a1, a2)
    if (out !== 0) {
      return out
    }
    return that(a1, a2)
  }))

/**
 * Combines multiple `Order` instances with a primary `Order` to create a new `Order` that compares using the
 * primary `Order` first, then falls back to the provided collection of `Order` instances in sequence.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Order } from "effect"
 *
 * const byAge = Order.mapInput(Order.number, (person: { name: string, age: number, city: string }) => person.age)
 * const byName = Order.mapInput(Order.string, (person: { name: string, age: number, city: string }) => person.name)
 * const byCity = Order.mapInput(Order.string, (person: { name: string, age: number, city: string }) => person.city)
 *
 * const multiOrder = Order.combineMany(byAge, [byName, byCity])
 *
 * const person1 = { name: "Alice", age: 30, city: "New York" }
 * const person2 = { name: "Bob", age: 30, city: "New York" }
 *
 * assert.deepStrictEqual(multiOrder(person1, person2), -1) // Same age and city, Alice < Bob
 * ```
 *
 * @category combining
 * @since 2.0.0
 */
export const combineMany: {
  <A>(collection: Iterable<Order<A>>): (self: Order<A>) => Order<A>
  <A>(self: Order<A>, collection: Iterable<Order<A>>): Order<A>
} = dual(2, <A>(self: Order<A>, collection: Iterable<Order<A>>): Order<A> =>
  make((a1, a2) => {
    let out = self(a1, a2)
    if (out !== 0) {
      return out
    }
    for (const O of collection) {
      out = O(a1, a2)
      if (out !== 0) {
        return out
      }
    }
    return out
  }))

/**
 * Creates an `Order` that considers all values as equal.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Order } from "effect"
 *
 * const emptyOrder = Order.empty<number>()
 *
 * assert.deepStrictEqual(emptyOrder(1, 2), 0)
 * assert.deepStrictEqual(emptyOrder(2, 1), 0)
 * assert.deepStrictEqual(emptyOrder(1, 1), 0)
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const empty = <A>(): Order<A> => make(() => 0)

/**
 * Combines all `Order` instances in the provided collection into a single `Order`.
 * The resulting `Order` compares using each `Order` in sequence until a non-zero result is found.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Order } from "effect"
 *
 * const byAge = Order.mapInput(Order.number, (person: { name: string, age: number }) => person.age)
 * const byName = Order.mapInput(Order.string, (person: { name: string, age: number }) => person.name)
 *
 * const combinedOrder = Order.combineAll([byAge, byName])
 *
 * const person1 = { name: "Alice", age: 30 }
 * const person2 = { name: "Bob", age: 30 }
 *
 * assert.deepStrictEqual(combinedOrder(person1, person2), -1) // Same age, Alice < Bob
 * ```
 *
 * @category combining
 * @since 2.0.0
 */
export const combineAll = <A>(collection: Iterable<Order<A>>): Order<A> => combineMany(empty(), collection)

/**
 * Transforms an `Order` on type `A` into an `Order` on type `B` by providing a function that
 * maps values of type `B` to values of type `A`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Order } from "effect"
 *
 * const byLength = Order.mapInput(Order.number, (s: string) => s.length)
 *
 * assert.deepStrictEqual(byLength("a", "bb"), -1)
 * assert.deepStrictEqual(byLength("bb", "a"), 1)
 * assert.deepStrictEqual(byLength("aa", "bb"), 0)
 * ```
 *
 * @category mapping
 * @since 2.0.0
 */
export const mapInput: {
  <B, A>(f: (b: B) => A): (self: Order<A>) => Order<B>
  <A, B>(self: Order<A>, f: (b: B) => A): Order<B>
} = dual(
  2,
  <A, B>(self: Order<A>, f: (b: B) => A): Order<B> => make((b1, b2) => self(f(b1), f(b2)))
)

/**
 * An `Order` instance for `Date` objects that compares them chronologically.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Order } from "effect"
 *
 * const date1 = new Date("2023-01-01")
 * const date2 = new Date("2023-01-02")
 *
 * assert.deepStrictEqual(Order.Date(date1, date2), -1)
 * assert.deepStrictEqual(Order.Date(date2, date1), 1)
 * assert.deepStrictEqual(Order.Date(date1, date1), 0)
 * ```
 *
 * @category instances
 * @since 2.0.0
 */
export const Date: Order<Date> = mapInput(number, (date) => date.getTime())

/**
 * Combines two `Order` instances to create an `Order` for tuples.
 * The resulting `Order` compares the first elements first, then the second elements if the first are equal.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Order } from "effect"
 *
 * const tupleOrder = Order.product(Order.number, Order.string)
 *
 * assert.deepStrictEqual(tupleOrder([1, "a"], [2, "b"]), -1)
 * assert.deepStrictEqual(tupleOrder([1, "b"], [1, "a"]), 1)
 * assert.deepStrictEqual(tupleOrder([1, "a"], [1, "a"]), 0)
 * ```
 *
 * @category combining
 * @since 2.0.0
 */
export const product: {
  <B>(that: Order<B>): <A>(self: Order<A>) => Order<readonly [A, B]> // readonly because invariant
  <A, B>(self: Order<A>, that: Order<B>): Order<readonly [A, B]> // readonly because invariant
} = dual(2, <A, B>(self: Order<A>, that: Order<B>): Order<readonly [A, B]> =>
  make(([xa, xb], [ya, yb]) => {
    const o = self(xa, ya)
    return o !== 0 ? o : that(xb, yb)
  }))

/**
 * Creates an `Order` for arrays by applying the provided collection of `Order` instances to corresponding elements.
 * The comparison stops at the first non-zero result or when either array is exhausted.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Order } from "effect"
 *
 * const arrayOrder = Order.all([Order.number, Order.number])
 *
 * assert.deepStrictEqual(arrayOrder([1, 10], [2, 20]), -1)
 * assert.deepStrictEqual(arrayOrder([1, 20], [1, 10]), 1)
 * assert.deepStrictEqual(arrayOrder([1, 10], [1, 10]), 0)
 * ```
 *
 * @category combining
 * @since 2.0.0
 */
export const all = <A>(collection: Iterable<Order<A>>): Order<ReadonlyArray<A>> => {
  return make((x, y) => {
    const len = Math.min(x.length, y.length)
    let collectionLength = 0
    for (const O of collection) {
      if (collectionLength >= len) {
        break
      }
      const o = O(x[collectionLength], y[collectionLength])
      if (o !== 0) {
        return o
      }
      collectionLength++
    }
    return 0
  })
}

/**
 * Combines a primary `Order` with multiple `Order` instances to create an `Order` for non-empty tuples.
 * The first element is compared using the primary `Order`, and subsequent elements are compared using the collection.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Order } from "effect"
 *
 * const tupleOrder = Order.productMany(Order.number, [Order.number, Order.number])
 *
 * assert.deepStrictEqual(tupleOrder([1, 2, 3], [2, 3, 4]), -1)
 * assert.deepStrictEqual(tupleOrder([1, 3, 2], [1, 2, 3]), 1)
 * assert.deepStrictEqual(tupleOrder([1, 2, 3], [1, 2, 3]), 0)
 * ```
 *
 * @category combining
 * @since 2.0.0
 */
export const productMany: {
  <A>(collection: Iterable<Order<A>>): (self: Order<A>) => Order<readonly [A, ...Array<A>]> // readonly because invariant
  <A>(self: Order<A>, collection: Iterable<Order<A>>): Order<readonly [A, ...Array<A>]> // readonly because invariant
} = dual(2, <A>(self: Order<A>, collection: Iterable<Order<A>>): Order<readonly [A, ...Array<A>]> => {
  const O = all(collection)
  return make((x, y) => {
    const o = self(x[0], y[0])
    return o !== 0 ? o : O(x.slice(1), y.slice(1))
  })
})

/**
 * Similar to `Promise.all` but operates on `Order`s.
 *
 * ```
 * [Order<A>, Order<B>, ...] -> Order<[A, B, ...]>
 * ```
 *
 * This function creates and returns a new `Order` for a tuple of values based on the given `Order`s for each element in the tuple.
 * The returned `Order` compares two tuples of the same type by applying the corresponding `Order` to each element in the tuple.
 * It is useful when you need to compare two tuples of the same type and you have a specific way of comparing each element
 * of the tuple.
 *
 * @category combinators
 * @since 2.0.0
 */
export const tuple = <Elements extends ReadonlyArray<Order<any>>>(
  elements: Elements
): Order<{ readonly [I in keyof Elements]: [Elements[I]] extends [Order<infer A>] ? A : never }> => all(elements) as any

/**
 * This function creates and returns a new `Order` for an array of values based on a given `Order` for the elements of the array.
 * The returned `Order` compares two arrays by applying the given `Order` to each element in the arrays.
 * If all elements are equal, the arrays are then compared based on their length.
 * It is useful when you need to compare two arrays of the same type and you have a specific way of comparing each element of the array.
 *
 * @category combinators
 * @since 2.0.0
 */
export const array = <A>(O: Order<A>): Order<ReadonlyArray<A>> =>
  make((self, that) => {
    const aLen = self.length
    const bLen = that.length
    const len = Math.min(aLen, bLen)
    for (let i = 0; i < len; i++) {
      const o = O(self[i], that[i])
      if (o !== 0) {
        return o
      }
    }
    return number(aLen, bLen)
  })

/**
 * This function creates and returns a new `Order` for a struct of values based on the given `Order`s
 * for each property in the struct.
 *
 * @category combinators
 * @since 2.0.0
 */
export const struct = <R extends { readonly [x: string]: Order<any> }>(
  fields: R
): Order<{ [K in keyof R]: [R[K]] extends [Order<infer A>] ? A : never }> => {
  const keys = Object.keys(fields)
  return make((self, that) => {
    for (const key of keys) {
      const o = fields[key](self[key], that[key])
      if (o !== 0) {
        return o
      }
    }
    return 0
  })
}

/**
 * Test whether one value is _strictly less than_ another.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Order } from "effect"
 *
 * const lessThanNumber = Order.lessThan(Order.number)
 *
 * assert.deepStrictEqual(lessThanNumber(1, 2), true)
 * assert.deepStrictEqual(lessThanNumber(2, 1), false)
 * assert.deepStrictEqual(lessThanNumber(1, 1), false)
 * ```
 *
 * @category predicates
 * @since 2.0.0
 */
export const lessThan = <A>(O: Order<A>): {
  (that: A): (self: A) => boolean
  (self: A, that: A): boolean
} => dual(2, (self: A, that: A) => O(self, that) === -1)

/**
 * Test whether one value is _strictly greater than_ another.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Order } from "effect"
 *
 * const greaterThanNumber = Order.greaterThan(Order.number)
 *
 * assert.deepStrictEqual(greaterThanNumber(2, 1), true)
 * assert.deepStrictEqual(greaterThanNumber(1, 2), false)
 * assert.deepStrictEqual(greaterThanNumber(1, 1), false)
 * ```
 *
 * @category predicates
 * @since 2.0.0
 */
export const greaterThan = <A>(O: Order<A>): {
  (that: A): (self: A) => boolean
  (self: A, that: A): boolean
} => dual(2, (self: A, that: A) => O(self, that) === 1)

/**
 * Test whether one value is _non-strictly less than_ another.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Order } from "effect"
 *
 * const lessThanOrEqualToNumber = Order.lessThanOrEqualTo(Order.number)
 *
 * assert.deepStrictEqual(lessThanOrEqualToNumber(1, 2), true)
 * assert.deepStrictEqual(lessThanOrEqualToNumber(1, 1), true)
 * assert.deepStrictEqual(lessThanOrEqualToNumber(2, 1), false)
 * ```
 *
 * @category predicates
 * @since 2.0.0
 */
export const lessThanOrEqualTo = <A>(O: Order<A>): {
  (that: A): (self: A) => boolean
  (self: A, that: A): boolean
} => dual(2, (self: A, that: A) => O(self, that) !== 1)

/**
 * Test whether one value is _non-strictly greater than_ another.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Order } from "effect"
 *
 * const greaterThanOrEqualToNumber = Order.greaterThanOrEqualTo(Order.number)
 *
 * assert.deepStrictEqual(greaterThanOrEqualToNumber(2, 1), true)
 * assert.deepStrictEqual(greaterThanOrEqualToNumber(1, 1), true)
 * assert.deepStrictEqual(greaterThanOrEqualToNumber(1, 2), false)
 * ```
 *
 * @category predicates
 * @since 2.0.0
 */
export const greaterThanOrEqualTo = <A>(O: Order<A>): {
  (that: A): (self: A) => boolean
  (self: A, that: A): boolean
} => dual(2, (self: A, that: A) => O(self, that) !== -1)

/**
 * Take the minimum of two values. If they are considered equal, the first argument is chosen.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Order } from "effect"
 *
 * const minNumber = Order.min(Order.number)
 *
 * assert.deepStrictEqual(minNumber(1, 2), 1)
 * assert.deepStrictEqual(minNumber(2, 1), 1)
 * assert.deepStrictEqual(minNumber(1, 1), 1)
 * ```
 *
 * @category comparisons
 * @since 2.0.0
 */
export const min = <A>(O: Order<A>): {
  (that: A): (self: A) => A
  (self: A, that: A): A
} => dual(2, (self: A, that: A) => self === that || O(self, that) < 1 ? self : that)

/**
 * Take the maximum of two values. If they are considered equal, the first argument is chosen.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Order } from "effect"
 *
 * const maxNumber = Order.max(Order.number)
 *
 * assert.deepStrictEqual(maxNumber(1, 2), 2)
 * assert.deepStrictEqual(maxNumber(2, 1), 2)
 * assert.deepStrictEqual(maxNumber(1, 1), 1)
 * ```
 *
 * @category comparisons
 * @since 2.0.0
 */
export const max = <A>(O: Order<A>): {
  (that: A): (self: A) => A
  (self: A, that: A): A
} => dual(2, (self: A, that: A) => self === that || O(self, that) > -1 ? self : that)

/**
 * Clamp a value between a minimum and a maximum.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Order, Number } from "effect"
 *
 * const clamp = Order.clamp(Number.Order)({ minimum: 1, maximum: 5 })
 *
 * assert.equal(clamp(3), 3)
 * assert.equal(clamp(0), 1)
 * assert.equal(clamp(6), 5)
 * ```
 *
 * @since 2.0.0
 */
export const clamp = <A>(O: Order<A>): {
  (options: {
    minimum: A
    maximum: A
  }): (self: A) => A
  (self: A, options: {
    minimum: A
    maximum: A
  }): A
} =>
  dual(
    2,
    (self: A, options: {
      minimum: A
      maximum: A
    }): A => min(O)(options.maximum, max(O)(options.minimum, self))
  )

/**
 * Test whether a value is between a minimum and a maximum (inclusive).
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Order } from "effect"
 *
 * const betweenNumber = Order.between(Order.number)
 *
 * assert.deepStrictEqual(betweenNumber(5, { minimum: 1, maximum: 10 }), true)
 * assert.deepStrictEqual(betweenNumber(1, { minimum: 1, maximum: 10 }), true)
 * assert.deepStrictEqual(betweenNumber(10, { minimum: 1, maximum: 10 }), true)
 * assert.deepStrictEqual(betweenNumber(0, { minimum: 1, maximum: 10 }), false)
 * assert.deepStrictEqual(betweenNumber(11, { minimum: 1, maximum: 10 }), false)
 * ```
 *
 * @category predicates
 * @since 2.0.0
 */
export const between = <A>(O: Order<A>): {
  (options: {
    minimum: A
    maximum: A
  }): (self: A) => boolean
  (self: A, options: {
    minimum: A
    maximum: A
  }): boolean
} =>
  dual(
    2,
    (self: A, options: {
      minimum: A
      maximum: A
    }): boolean => !lessThan(O)(self, options.minimum) && !greaterThan(O)(self, options.maximum)
  )
