/**
 * The `Function` module provides small, pure helpers for defining, composing,
 * adapting, and reusing TypeScript functions. It is the foundation for the
 * data-first and data-last APIs used throughout Effect, and it includes the
 * core pipeline utilities that make those APIs ergonomic.
 *
 * **Mental model**
 *
 * - {@link pipe} starts with a value and passes it through one unary function at
 *   a time
 * - {@link flow} composes unary functions into a reusable function
 * - {@link dual} builds APIs that support both direct calls and `pipe`-friendly
 *   data-last calls
 * - {@link identity}, {@link constant}, and the `const*` helpers model common
 *   identity and thunk patterns without allocating ad hoc callbacks
 * - {@link tupled}, {@link untupled}, {@link flip}, and {@link apply} adapt
 *   call shapes without changing the underlying behavior
 * - Type helpers such as {@link LazyArg}, {@link FunctionN}, {@link satisfies},
 *   and {@link cast} describe or constrain functions at the type level
 *
 * **Common tasks**
 *
 * - Build readable transformation pipelines: {@link pipe}
 * - Create reusable composed functions: {@link flow}, {@link compose}
 * - Define functions callable in both data-first and data-last style: {@link dual}
 * - Return a value unchanged: {@link identity}
 * - Create thunks and common constant functions: {@link constant},
 *   {@link constTrue}, {@link constFalse}, {@link constNull},
 *   {@link constUndefined}, {@link constVoid}
 * - Convert between rest-argument and tuple-argument functions: {@link tupled},
 *   {@link untupled}
 * - Express impossible branches: {@link absurd}
 * - Cache results for object keys: {@link memoize}
 *
 * **Gotchas**
 *
 * - Functions passed to {@link pipe} and {@link flow} are applied left-to-right
 *   and should be unary at each step
 * - {@link dual} uses either an arity or a predicate to decide whether a call is
 *   data-first or data-last; use a predicate when optional arguments make arity
 *   ambiguous
 * - {@link cast} changes only the static TypeScript type and performs no runtime
 *   validation
 * - {@link memoize} is intended for object keys and stores cached values in a
 *   `WeakMap`
 *
 * @since 2.0.0
 */
import type { TypeLambda } from "./HKT.ts"
import { pipeArguments } from "./Pipeable.ts"

/**
 * Type lambda for function types, used for higher-kinded type operations.
 *
 * **Example** (Creating a function type with a type lambda)
 *
 * ```ts
 * import type { FunctionTypeLambda } from "effect/Function"
 * import type { Kind } from "effect/HKT"
 *
 * // Create a function type using the type lambda
 * type StringToNumber = Kind<FunctionTypeLambda, string, never, never, number>
 * // Equivalent to: (a: string) => number
 * ```
 *
 * @category type lambdas
 * @since 2.0.0
 */
export interface FunctionTypeLambda extends TypeLambda {
  readonly type: (a: this["In"]) => this["Target"]
}

/**
 * Creates a function that can be used in a data-last (aka `pipe`able) or
 * data-first style.
 *
 * The first parameter to `dual` is either the arity of the uncurried function
 * or a predicate that determines if the function is being used in a data-first
 * or data-last style.
 *
 * Using the arity is the most common use case, but there are some cases where
 * you may want to use a predicate. For example, if you have a function that
 * takes an optional argument, you can use a predicate to determine if the
 * function is being used in a data-first or data-last style.
 *
 * You can pass either the arity of the uncurried function or a predicate
 * which determines if the function is being used in a data-first or
 * data-last style.
 *
 * **Example** (Using arity to determine data-first or data-last style)
 *
 * ```ts
 * import { dual, pipe } from "effect/Function"
 *
 * const sum = dual<
 *   (that: number) => (self: number) => number,
 *   (self: number, that: number) => number
 * >(2, (self, that) => self + that)
 *
 * console.log(sum(2, 3)) // 5
 * console.log(pipe(2, sum(3))) // 5
 * ```
 *
 * **Example** (Using call signatures to define the overloads)
 *
 * ```ts
 * import { dual, pipe } from "effect/Function"
 *
 * const sum: {
 *   (that: number): (self: number) => number
 *   (self: number, that: number): number
 * } = dual(2, (self: number, that: number): number => self + that)
 *
 * console.log(sum(2, 3)) // 5
 * console.log(pipe(2, sum(3))) // 5
 * ```
 *
 * **Example** (Using a predicate to determine data-first or data-last style)
 *
 * ```ts
 * import { dual, pipe } from "effect/Function"
 *
 * const sum = dual<
 *   (that: number) => (self: number) => number,
 *   (self: number, that: number) => number
 * >(
 *   (args) => args.length === 2,
 *   (self, that) => self + that
 * )
 *
 * console.log(sum(2, 3)) // 5
 * console.log(pipe(2, sum(3))) // 5
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export const dual: {
  <DataLast extends (...args: Array<any>) => any, DataFirst extends (...args: Array<any>) => any>(
    arity: Parameters<DataFirst>["length"],
    body: DataFirst
  ): DataLast & DataFirst
  <DataLast extends (...args: Array<any>) => any, DataFirst extends (...args: Array<any>) => any>(
    isDataFirst: (args: IArguments) => boolean,
    body: DataFirst
  ): DataLast & DataFirst
} = function(arity, body) {
  if (typeof arity === "function") {
    return function(this: any) {
      return arity(arguments)
        ? body.apply(this, arguments as any)
        : ((self: any) => body(self, ...arguments)) as any
    }
  }

  switch (arity) {
    case 0:
    case 1:
      throw new RangeError(`Invalid arity ${arity}`)

    case 2:
      return function(a, b) {
        if (arguments.length >= 2) {
          return body(a, b)
        }
        return function(self: any) {
          return body(self, a)
        }
      }

    case 3:
      return function(a, b, c) {
        if (arguments.length >= 3) {
          return body(a, b, c)
        }
        return function(self: any) {
          return body(self, a, b)
        }
      }

    default:
      return function() {
        if (arguments.length >= arity) {
          // @ts-expect-error
          return body.apply(this, arguments)
        }
        const args = arguments
        return function(self: any) {
          return body(self, ...args)
        }
      }
  }
}
/**
 * Apply a function to a given value.
 *
 * **Example** (Applying an argument to a function)
 *
 * ```ts
 * import { apply, pipe } from "effect/Function"
 * import { length } from "effect/String"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(pipe(length, apply("hello")), 5)
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export const apply = <A>(a: A) => <B>(self: (a: A) => B): B => self(a)

/**
 * A zero-argument function that produces a value when invoked.
 *
 * **Example** (Creating a lazy argument)
 *
 * ```ts
 * import { constant, type LazyArg } from "effect/Function"
 *
 * const constNull: LazyArg<null> = constant(null)
 * ```
 *
 * @category models
 * @since 2.0.0
 */
export type LazyArg<A> = () => A

/**
 * Represents a function with multiple arguments.
 *
 * **Example** (Typing a variadic function)
 *
 * ```ts
 * import type { FunctionN } from "effect/Function"
 * import * as assert from "node:assert"
 *
 * const sum: FunctionN<[number, number], number> = (a, b) => a + b
 * assert.deepStrictEqual(sum(2, 3), 5)
 * ```
 *
 * @category models
 * @since 2.0.0
 */
export type FunctionN<A extends ReadonlyArray<unknown>, B> = (...args: A) => B

/**
 * The identity function, i.e. A function that returns its input argument.
 *
 * **Example** (Returning the same value)
 *
 * ```ts
 * import { identity } from "effect/Function"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(identity(5), 5)
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export const identity = <A>(a: A): A => a

/**
 * A function that ensures that the type of an expression matches some type,
 * without changing the resulting type of that expression.
 *
 * **Example** (Checking an expression against a type)
 *
 * ```ts
 * import { satisfies } from "effect/Function"
 * import * as assert from "node:assert"
 *
 * const test1 = satisfies<number>()(5 as const)
 * // ^? const test: 5
 * // @ts-expect-error
 * const test2 = satisfies<string>()(5)
 * // ^? Argument of type 'number' is not assignable to parameter of type 'string'
 *
 * assert.deepStrictEqual(satisfies<number>()(5), 5)
 * ```
 *
 * @category type utils
 * @since 2.0.0
 */
export const satisfies = <A>() => <B extends A>(b: B) => b

/**
 * Returns the input value with a different static type.
 *
 * This is a type-level cast only; it performs no runtime validation or
 * conversion.
 *
 * @category type utils
 * @since 2.0.0
 */
export const cast: <A, B>(a: A) => B = identity as any

/**
 * Creates a zero-argument function that always returns the provided value.
 *
 * Use `constant` when an API expects a thunk or callback and every invocation
 * should return the same value.
 *
 * **Example** (Creating a constant thunk)
 *
 * ```ts
 * import { constant } from "effect/Function"
 * import * as assert from "node:assert"
 *
 * const constNull = constant(null)
 *
 * assert.deepStrictEqual(constNull(), null)
 * assert.deepStrictEqual(constNull(), null)
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const constant = <A>(value: A): LazyArg<A> => () => value

/**
 * A thunk that returns always `true`.
 *
 * **Example** (Returning true from a thunk)
 *
 * ```ts
 * import { constTrue } from "effect/Function"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(constTrue(), true)
 * ```
 *
 * @category constants
 * @since 2.0.0
 */
export const constTrue: LazyArg<boolean> = constant(true)

/**
 * A thunk that returns always `false`.
 *
 * **Example** (Returning false from a thunk)
 *
 * ```ts
 * import { constFalse } from "effect/Function"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(constFalse(), false)
 * ```
 *
 * @category constants
 * @since 2.0.0
 */
export const constFalse: LazyArg<boolean> = constant(false)

/**
 * A thunk that returns always `null`.
 *
 * **Example** (Returning null from a thunk)
 *
 * ```ts
 * import { constNull } from "effect/Function"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(constNull(), null)
 * ```
 *
 * @category constants
 * @since 2.0.0
 */
export const constNull: LazyArg<null> = constant(null)

/**
 * A thunk that returns always `undefined`.
 *
 * **Example** (Returning undefined from a thunk)
 *
 * ```ts
 * import { constUndefined } from "effect/Function"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(constUndefined(), undefined)
 * ```
 *
 * @category constants
 * @since 2.0.0
 */
export const constUndefined: LazyArg<undefined> = constant(undefined)

/**
 * A thunk that returns always `void`.
 *
 * **Example** (Returning void from a thunk)
 *
 * ```ts
 * import { constVoid } from "effect/Function"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(constVoid(), undefined)
 * ```
 *
 * @category constants
 * @since 2.0.0
 */
export const constVoid: LazyArg<void> = constUndefined

/**
 * Reverses the order of arguments for a curried function.
 *
 * **Example** (Flipping curried arguments)
 *
 * ```ts
 * import { flip } from "effect/Function"
 * import * as assert from "node:assert"
 *
 * const f = (a: number) => (b: string) => a - b.length
 *
 * assert.deepStrictEqual(flip(f)("aaa")(2), -1)
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export const flip = <A extends Array<unknown>, B extends Array<unknown>, C>(
  f: (...a: A) => (...b: B) => C
): (...b: B) => (...a: A) => C =>
(...b) =>
(...a) => f(...a)(...b)

/**
 * Composes two functions, `ab` and `bc` into a single function that takes in an argument `a` of type `A` and returns a result of type `C`.
 * The result is obtained by first applying the `ab` function to `a` and then applying the `bc` function to the result of `ab`.
 *
 * **Example** (Composing two functions)
 *
 * ```ts
 * import { compose } from "effect/Function"
 * import * as assert from "node:assert"
 *
 * const increment = (n: number) => n + 1
 * const square = (n: number) => n * n
 *
 * assert.strictEqual(compose(increment, square)(2), 9)
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export const compose: {
  <B, C>(bc: (b: B) => C): <A>(self: (a: A) => B) => (a: A) => C
  <A, B, C>(self: (a: A) => B, bc: (b: B) => C): (a: A) => C
} = dual(2, <A, B, C>(ab: (a: A) => B, bc: (b: B) => C): (a: A) => C => (a) => bc(ab(a)))

/**
 * The `absurd` function is a stub for cases where a value of type `never` is encountered in your code,
 * meaning that it should be impossible for this code to be executed.
 *
 * This function is particularly useful when it's necessary to specify that certain cases are impossible.
 *
 * **Example** (Handling impossible values)
 *
 * ```ts
 * import { absurd } from "effect/Function"
 *
 * const handleNever = (value: never) => {
 *   return absurd(value) // This will throw an error if called
 * }
 * ```
 *
 * @category utilities
 * @since 2.0.0
 */
export const absurd = <A>(_: never): A => {
  throw new Error("Called `absurd` function which should be uncallable")
}

/**
 * Creates a tupled version of this function: instead of `n` arguments, it accepts a single tuple argument.
 *
 * **Example** (Converting arguments to a tuple)
 *
 * ```ts
 * import { tupled } from "effect/Function"
 * import * as assert from "node:assert"
 *
 * const sumTupled = tupled((x: number, y: number): number => x + y)
 *
 * assert.deepStrictEqual(sumTupled([1, 2]), 3)
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export const tupled = <A extends ReadonlyArray<unknown>, B>(f: (...a: A) => B): (a: A) => B => (a) => f(...a)

/**
 * Inverse function of `tupled`
 *
 * **Example** (Converting a tuple to arguments)
 *
 * ```ts
 * import { untupled } from "effect/Function"
 * import * as assert from "node:assert"
 *
 * const getFirst = untupled(<A, B>(tuple: [A, B]): A => tuple[0])
 *
 * assert.deepStrictEqual(getFirst(1, 2), 1)
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export const untupled = <A extends ReadonlyArray<unknown>, B>(f: (a: A) => B): (...a: A) => B => (...a) => f(a)

/**
 * Pipes the value of an expression into a pipeline of functions.
 *
 * **Details**
 *
 * The `pipe` function is a utility that allows us to compose functions in a
 * readable and sequential manner. It takes the output of one function and
 * passes it as the input to the next function in the pipeline. This enables us
 * to build complex transformations by chaining multiple functions together.
 *
 * **Example** (Showing pipeline syntax)
 *
 * ```ts
 * import { pipe } from "effect"
 *
 * const result = pipe(
 *   1,
 *   (n) => n + 1,
 *   (n) => n * 2,
 *   (n) => `result: ${n}`
 * )
 *
 * console.log(result) // "result: 4"
 * ```
 *
 * In this syntax, `1` is the initial value, and each function is applied in
 * sequence. The result of each function becomes the input for the next
 * function, and the final result is returned.
 *
 * Here's an illustration of how `pipe` works:
 *
 * ```
 * ┌───┐    ┌───────┐    ┌─────────────┐    ┌────────┐
 * │ 1 │───►│ add 1 │───►│ multiply 2  │───►│ format │───► "result: 4"
 * └───┘    └───────┘    └─────────────┘    └────────┘
 * ```
 *
 * It's important to note that functions passed to `pipe` must have a **single
 * argument** because they are only called with a single argument.
 *
 * **When to Use**
 *
 * This is useful in combination with data-last functions as a simulation of
 * methods:
 *
 * **Example** (Chaining methods before conversion)
 *
 * ```ts
 * const numbers = [1, 2, 3, 4]
 * const double = (n: number) => n * 2
 * const greaterThanFour = (n: number) => n > 4
 *
 * const result = numbers.map(double).filter(greaterThanFour)
 *
 * console.log(result) // [6, 8]
 * ```
 *
 * becomes:
 *
 * **Example** (Rewriting method chains with pipe)
 *
 * ```ts
 * import { Array, pipe } from "effect"
 *
 * const numbers = [1, 2, 3, 4]
 * const double = (n: number) => n * 2
 * const greaterThanFour = (n: number) => n > 4
 *
 * const result = pipe(
 *   numbers,
 *   Array.map(double),
 *   Array.filter(greaterThanFour)
 * )
 *
 * console.log(result) // [6, 8]
 * ```
 *
 * **Example** (Chaining Arithmetic Operations)
 *
 * ```ts
 * import { pipe } from "effect"
 *
 * // Define simple arithmetic operations
 * const increment = (x: number) => x + 1
 * const double = (x: number) => x * 2
 * const subtractTen = (x: number) => x - 10
 *
 * // Sequentially apply these operations using `pipe`
 * const result = pipe(5, increment, double, subtractTen)
 *
 * console.log(result)
 * // Output: 2
 * ```
 *
 * **Example** (Building a simple transformation pipeline)
 *
 * ```ts
 * import { pipe } from "effect"
 *
 * // Simple transformation pipeline
 * const result = pipe(
 *   5,
 *   (x) => x * 2, // 10
 *   (x) => x + 1, // 11
 *   (x) => x.toString() // "11"
 * )
 *
 * console.log(result) // "11"
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export function pipe<A>(a: A): A
export function pipe<A, B = never>(a: A, ab: (a: A) => B): B
export function pipe<A, B = never, C = never>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C
): C
export function pipe<A, B = never, C = never, D = never>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D
): D
export function pipe<A, B = never, C = never, D = never, E = never>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E
): E
export function pipe<A, B = never, C = never, D = never, E = never, F = never>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F
): F
export function pipe<
  A,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never
>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G
): G
export function pipe<
  A,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never,
  H = never
>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H
): H
export function pipe<
  A,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never,
  H = never,
  I = never
>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I
): I
export function pipe<
  A,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never,
  H = never,
  I = never,
  J = never
>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
  ij: (i: I) => J
): J
export function pipe<
  A,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never,
  H = never,
  I = never,
  J = never,
  K = never
>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
  ij: (i: I) => J,
  jk: (j: J) => K
): K
export function pipe<
  A,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never,
  H = never,
  I = never,
  J = never,
  K = never,
  L = never
>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
  ij: (i: I) => J,
  jk: (j: J) => K,
  kl: (k: K) => L
): L
export function pipe<
  A,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never,
  H = never,
  I = never,
  J = never,
  K = never,
  L = never,
  M = never
>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
  ij: (i: I) => J,
  jk: (j: J) => K,
  kl: (k: K) => L,
  lm: (l: L) => M
): M
export function pipe<
  A,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never,
  H = never,
  I = never,
  J = never,
  K = never,
  L = never,
  M = never,
  N = never
>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
  ij: (i: I) => J,
  jk: (j: J) => K,
  kl: (k: K) => L,
  lm: (l: L) => M,
  mn: (m: M) => N
): N
export function pipe<
  A,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never,
  H = never,
  I = never,
  J = never,
  K = never,
  L = never,
  M = never,
  N = never,
  O = never
>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
  ij: (i: I) => J,
  jk: (j: J) => K,
  kl: (k: K) => L,
  lm: (l: L) => M,
  mn: (m: M) => N,
  no: (n: N) => O
): O
export function pipe<
  A,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never,
  H = never,
  I = never,
  J = never,
  K = never,
  L = never,
  M = never,
  N = never,
  O = never,
  P = never
>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
  ij: (i: I) => J,
  jk: (j: J) => K,
  kl: (k: K) => L,
  lm: (l: L) => M,
  mn: (m: M) => N,
  no: (n: N) => O,
  op: (o: O) => P
): P
export function pipe<
  A,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never,
  H = never,
  I = never,
  J = never,
  K = never,
  L = never,
  M = never,
  N = never,
  O = never,
  P = never,
  Q = never
>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
  ij: (i: I) => J,
  jk: (j: J) => K,
  kl: (k: K) => L,
  lm: (l: L) => M,
  mn: (m: M) => N,
  no: (n: N) => O,
  op: (o: O) => P,
  pq: (p: P) => Q
): Q
export function pipe<
  A,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never,
  H = never,
  I = never,
  J = never,
  K = never,
  L = never,
  M = never,
  N = never,
  O = never,
  P = never,
  Q = never,
  R = never
>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
  ij: (i: I) => J,
  jk: (j: J) => K,
  kl: (k: K) => L,
  lm: (l: L) => M,
  mn: (m: M) => N,
  no: (n: N) => O,
  op: (o: O) => P,
  pq: (p: P) => Q,
  qr: (q: Q) => R
): R
export function pipe<
  A,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never,
  H = never,
  I = never,
  J = never,
  K = never,
  L = never,
  M = never,
  N = never,
  O = never,
  P = never,
  Q = never,
  R = never,
  S = never
>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
  ij: (i: I) => J,
  jk: (j: J) => K,
  kl: (k: K) => L,
  lm: (l: L) => M,
  mn: (m: M) => N,
  no: (n: N) => O,
  op: (o: O) => P,
  pq: (p: P) => Q,
  qr: (q: Q) => R,
  rs: (r: R) => S
): S
export function pipe<
  A,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never,
  H = never,
  I = never,
  J = never,
  K = never,
  L = never,
  M = never,
  N = never,
  O = never,
  P = never,
  Q = never,
  R = never,
  S = never,
  T = never
>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
  ij: (i: I) => J,
  jk: (j: J) => K,
  kl: (k: K) => L,
  lm: (l: L) => M,
  mn: (m: M) => N,
  no: (n: N) => O,
  op: (o: O) => P,
  pq: (p: P) => Q,
  qr: (q: Q) => R,
  rs: (r: R) => S,
  st: (s: S) => T
): T
export function pipe(a: unknown, ...args: Array<any>): unknown {
  return pipeArguments(a, args as any)
}

/**
 * Performs left-to-right function composition. The first argument may have any arity, the remaining arguments must be unary.
 *
 * See also [`pipe`](#pipe).
 *
 * **Example** (Composing functions left to right)
 *
 * ```ts
 * import { flow } from "effect/Function"
 * import * as assert from "node:assert"
 *
 * const len = (s: string): number => s.length
 * const double = (n: number): number => n * 2
 *
 * const f = flow(len, double)
 *
 * assert.strictEqual(f("aaa"), 6)
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export function flow<A extends ReadonlyArray<unknown>, B = never>(
  ab: (...a: A) => B
): (...a: A) => B
export function flow<A extends ReadonlyArray<unknown>, B = never, C = never>(
  ab: (...a: A) => B,
  bc: (b: B) => C
): (...a: A) => C
export function flow<
  A extends ReadonlyArray<unknown>,
  B = never,
  C = never,
  D = never
>(ab: (...a: A) => B, bc: (b: B) => C, cd: (c: C) => D): (...a: A) => D
export function flow<
  A extends ReadonlyArray<unknown>,
  B = never,
  C = never,
  D = never,
  E = never
>(
  ab: (...a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E
): (...a: A) => E
export function flow<
  A extends ReadonlyArray<unknown>,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never
>(
  ab: (...a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F
): (...a: A) => F
export function flow<
  A extends ReadonlyArray<unknown>,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never
>(
  ab: (...a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G
): (...a: A) => G
export function flow<
  A extends ReadonlyArray<unknown>,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never,
  H = never
>(
  ab: (...a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H
): (...a: A) => H
export function flow<
  A extends ReadonlyArray<unknown>,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never,
  H = never,
  I = never
>(
  ab: (...a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I
): (...a: A) => I
export function flow<
  A extends ReadonlyArray<unknown>,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never,
  H = never,
  I = never,
  J = never
>(
  ab: (...a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
  ij: (i: I) => J
): (...a: A) => J
export function flow(
  ab: Function,
  bc?: Function,
  cd?: Function,
  de?: Function,
  ef?: Function,
  fg?: Function,
  gh?: Function,
  hi?: Function,
  ij?: Function
): unknown {
  switch (arguments.length) {
    case 1:
      return ab
    case 2:
      return function(this: unknown) {
        return bc!(ab.apply(this, arguments))
      }
    case 3:
      return function(this: unknown) {
        return cd!(bc!(ab.apply(this, arguments)))
      }
    case 4:
      return function(this: unknown) {
        return de!(cd!(bc!(ab.apply(this, arguments))))
      }
    case 5:
      return function(this: unknown) {
        return ef!(de!(cd!(bc!(ab.apply(this, arguments)))))
      }
    case 6:
      return function(this: unknown) {
        return fg!(ef!(de!(cd!(bc!(ab.apply(this, arguments))))))
      }
    case 7:
      return function(this: unknown) {
        return gh!(fg!(ef!(de!(cd!(bc!(ab.apply(this, arguments)))))))
      }
    case 8:
      return function(this: unknown) {
        return hi!(gh!(fg!(ef!(de!(cd!(bc!(ab.apply(this, arguments))))))))
      }
    case 9:
      return function(this: unknown) {
        return ij!(hi!(gh!(fg!(ef!(de!(cd!(bc!(ab.apply(this, arguments)))))))))
      }
  }
  return
}

/**
 * Creates a compile-time placeholder for a value of any type.
 *
 * `hole` is intended for temporary development use. If the placeholder is
 * evaluated at runtime, it throws.
 *
 * **Example** (Creating a development placeholder)
 *
 * ```ts
 * import { hole } from "effect/Function"
 *
 * // Intentionally not called: `hole` throws if the placeholder is evaluated.
 * const buildUser = (id: number): { readonly id: number; readonly name: string } => ({
 *   id,
 *   name: hole<string>()
 * })
 *
 * console.log(typeof buildUser) // "function"
 * ```
 *
 * @category utilities
 * @since 2.0.0
 */
export const hole: <T>() => T = cast(absurd)

/**
 * The SK combinator, also known as the "S-K combinator" or "S-combinator", is a fundamental combinator in the
 * lambda calculus and the SKI combinator calculus.
 *
 * This function is useful for discarding the first argument passed to it and returning the second argument.
 *
 * **Example** (Discarding the first argument)
 *
 * ```ts
 * import { SK } from "effect/Function"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(SK(0, "hello"), "hello")
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export const SK = <A, B>(_: A, b: B): B => b

/**
 * Memoizes a function whose input is an object, caching results by object
 * identity.
 *
 * @since 4.0.0
 */
export function memoize<A extends object, O>(f: (a: A) => O): (ast: A) => O {
  const cache = new WeakMap<object, O>()
  return (a) => {
    if (cache.has(a)) {
      return cache.get(a)!
    }
    const result = f(a)
    cache.set(a, result)
    return result
  }
}
