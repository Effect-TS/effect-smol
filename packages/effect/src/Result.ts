/**
 * @since 4.0.0
 */

import type { Yieldable } from "./Effect.ts"
import * as Equivalence from "./Equivalence.ts"
import type { LazyArg } from "./Function.ts"
import { constNull, constUndefined, dual, identity } from "./Function.ts"
import type { TypeLambda } from "./HKT.ts"
import type { Inspectable } from "./Inspectable.ts"
import * as doNotation from "./internal/doNotation.ts"
import * as option_ from "./internal/option.ts"
import * as result from "./internal/result.ts"
import type { Option } from "./Option.ts"
import type { Pipeable } from "./Pipeable.ts"
import type { Predicate, Refinement } from "./Predicate.ts"
import { isFunction } from "./Predicate.ts"
import type { Covariant, NoInfer, NotFunction } from "./Types.ts"
import type * as Unify from "./Unify.ts"
import * as Gen from "./Utils.ts"

const TypeId = "~effect/data/Result"

/**
 * Represents a computation that can either succeed with a value of type `A` or fail with an error of type `E`.
 *
 * @example
 * ```ts
 * import { Result } from "effect"
 *
 * // Create a successful result
 * const success = Result.succeed(42)
 *
 * // Create a failed result
 * const failure = Result.fail("something went wrong")
 *
 * // Pattern match on the result
 * const message = Result.match(success, {
 *   onSuccess: (value) => `Success: ${value}`,
 *   onFailure: (error) => `Error: ${error}`
 * })
 * ```
 *
 * @category Models
 * @since 4.0.0
 */
export type Result<A, E = never> = Success<A, E> | Failure<A, E>

/**
 * Represents a failed computation with an error of type `E`.
 *
 * @example
 * ```ts
 * import { Result } from "effect"
 *
 * const failure = Result.fail("Network error")
 *
 * if (Result.isFailure(failure)) {
 *   console.log(failure.failure) // "Network error"
 * }
 * ```
 *
 * @category Models
 * @since 4.0.0
 */
export interface Failure<out A, out E> extends Pipeable, Inspectable, Yieldable<Result<A, E>, A, E> {
  readonly _tag: "Failure"
  readonly _op: "Failure"
  readonly failure: E
  readonly [TypeId]: {
    readonly _A: Covariant<E>
    readonly _E: Covariant<A>
  }
  [Unify.typeSymbol]?: unknown
  [Unify.unifySymbol]?: ResultUnify<this>
  [Unify.ignoreSymbol]?: ResultUnifyIgnore
}

/**
 * Represents a successful computation with a value of type `A`.
 *
 * @example
 * ```ts
 * import { Result } from "effect"
 *
 * const success = Result.succeed(42)
 *
 * if (Result.isSuccess(success)) {
 *   console.log(success.success) // 42
 * }
 * ```
 *
 * @category Models
 * @since 4.0.0
 */
export interface Success<out A, out E> extends Pipeable, Inspectable, Yieldable<Result<A, E>, A, E> {
  readonly _tag: "Success"
  readonly _op: "Success"
  readonly success: A
  readonly [TypeId]: {
    readonly _A: Covariant<E>
    readonly _E: Covariant<A>
  }
  [Unify.typeSymbol]?: unknown
  [Unify.unifySymbol]?: ResultUnify<this>
  [Unify.ignoreSymbol]?: ResultUnifyIgnore
}

/**
 * Type-level utility for unifying Result types in generic contexts.
 *
 * @example
 * ```ts
 * import { Result } from "effect"
 *
 * // This interface helps TypeScript unify different Result types
 * const stringResult = Result.succeed("hello")
 * const numberResult = Result.succeed(42)
 * // These can be unified in generic contexts
 * ```
 *
 * @category Models
 * @since 4.0.0
 */
export interface ResultUnify<T extends { [Unify.typeSymbol]?: any }> {
  Result?: () => T[Unify.typeSymbol] extends Result<infer A, infer E> | infer _ ? Result<A, E> : never
}

/**
 * Marker interface for ignoring unification in Result types.
 *
 * @example
 * ```ts
 * import { Result } from "effect"
 *
 * // This interface is used internally by the type system
 * // to control when Result types should not be unified
 * const result = Result.succeed("hello")
 * ```
 *
 * @category Models
 * @since 4.0.0
 */
export interface ResultUnifyIgnore {}

/**
 * Higher-kinded type representation for Result.
 *
 * @example
 * ```ts
 * import type { Result } from "effect"
 *
 * // This interface allows Result to work with higher-kinded type utilities
 * declare const resultTypeLambda: Result.ResultTypeLambda
 * // Used for higher-kinded type operations
 * ```
 *
 * @category Type Lambdas
 * @since 4.0.0
 */
export interface ResultTypeLambda extends TypeLambda {
  readonly type: Result<this["Target"], this["Out1"]>
}

/**
 * Namespace containing type-level utilities for working with Result types.
 *
 * @example
 * ```ts
 * import { Result } from "effect"
 *
 * // This namespace contains type-level utilities
 * const stringResult = Result.succeed("hello")
 * const numberResult = Result.fail(404)
 * // Used for extracting types at compile time
 * ```
 *
 * @category Type Level
 * @since 4.0.0
 */
export declare namespace Result {
  /**
   * Extracts the failure type from a Result type.
   *
   * @example
   * ```ts
   * import { Result } from "effect"
   *
   * // This type utility extracts the failure type
   * const errorResult = Result.fail("error")
   * // Used for type-level operations
   * ```
   *
   * @since 4.0.0
   * @category Type Level
   */
  export type Failure<T extends Result<any, any>> = [T] extends [Result<infer _A, infer _E>] ? _E : never
  /**
   * Extracts the success type from a Result type.
   *
   * @example
   * ```ts
   * import { Result } from "effect"
   *
   * // This type utility extracts the success type
   * const successResult = Result.succeed(42)
   * // Used for type-level operations
   * ```
   *
   * @since 4.0.0
   * @category Type Level
   */
  export type Success<T extends Result<any, any>> = [T] extends [Result<infer _A, infer _E>] ? _A : never
}

/**
 * Constructs a new `Result` holding a `Success` value.
 *
 * @example
 * ```ts
 * import { Result } from "effect"
 *
 * const result = Result.succeed(42)
 *
 * console.log(Result.isSuccess(result)) // true
 * if (Result.isSuccess(result)) {
 *   console.log(result.success) // 42
 * }
 * ```
 *
 * @category Constructors
 * @since 4.0.0
 */
export const succeed: <A, E = never>(right: A) => Result<A, E> = result.succeed

/**
 * Constructs a new `Result` holding a `Failure` value.
 *
 * @example
 * ```ts
 * import { Result } from "effect"
 *
 * const result = Result.fail("Something went wrong")
 *
 * console.log(Result.isFailure(result)) // true
 * if (Result.isFailure(result)) {
 *   console.log(result.failure) // "Something went wrong"
 * }
 * ```
 *
 * @category Constructors
 * @since 4.0.0
 */
export const fail: <E, A = never>(left: E) => Result<A, E> = result.fail

const void_: Result<void> = succeed(void 0)
export {
  /**
   * Constructs a new `Result` holding a `Success` value with `void`.
   *
   * @example
   * ```ts
   * import { Result } from "effect"
   * import * as assert from "node:assert"
   *
   * const result = Result.void
   * assert.deepStrictEqual(result, Result.succeed(undefined))
   * ```
   *
   * @category Constructors
   * @since 4.0.0
   */
  void_ as void
}

/**
 * Takes a lazy default and a nullish value, if the value is not nully (`null`
 * or `undefined`), turn it into a `Success`, if the value is nully use the
 * provided default as a `Failure`.
 *
 * @example
 * ```ts
 * import { Result } from "effect"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(
 *   Result.fromNullishOr(1, () => "fallback"),
 *   Result.succeed(1)
 * )
 * assert.deepStrictEqual(
 *   Result.fromNullishOr(null, () => "fallback"),
 *   Result.fail("fallback")
 * )
 * ```
 *
 * @category Constructors
 * @since 4.0.0
 */
export const fromNullishOr: {
  <A, E>(onNullish: (a: A) => E): (self: A) => Result<NonNullable<A>, E>
  <A, E>(self: A, onNullish: (a: A) => E): Result<NonNullable<A>, E>
} = dual(
  2,
  <A, E>(self: A, onNullish: (a: A) => E): Result<NonNullable<A>, E> =>
    self == null ? fail(onNullish(self)) : succeed(self)
)

/**
 * @example
 * ```ts
 * import { Option, Result } from "effect"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(
 *   Result.fromOption(Option.some(1), () => "error"),
 *   Result.succeed(1)
 * )
 * assert.deepStrictEqual(
 *   Result.fromOption(Option.none(), () => "error"),
 *   Result.fail("error")
 * )
 * ```
 *
 * @category Constructors
 * @since 4.0.0
 */
export const fromOption: {
  <E>(onNone: () => E): <A>(self: Option<A>) => Result<A, E>
  <A, E>(self: Option<A>, onNone: () => E): Result<A, E>
} = result.fromOption

const try_: {
  <A, E>(
    options: {
      readonly try: LazyArg<A>
      readonly catch: (error: unknown) => E
    }
  ): Result<A, E>
  <A>(evaluate: LazyArg<A>): Result<A, unknown>
} = <A, E>(
  evaluate: LazyArg<A> | {
    readonly try: LazyArg<A>
    readonly catch: (error: unknown) => E
  }
) => {
  if (isFunction(evaluate)) {
    try {
      return succeed(evaluate())
    } catch (e) {
      return fail(e)
    }
  } else {
    try {
      return succeed(evaluate.try())
    } catch (e) {
      return fail(evaluate.catch(e))
    }
  }
}

export {
  /**
   * Imports a synchronous side-effect into a pure `Result` value, translating any
   * thrown exceptions into typed failed Results creating with `Failure`.
   *
   * @example
   * ```ts
   * import { Result } from "effect"
   * import * as assert from "node:assert"
   *
   * const success = Result.try(() => JSON.parse("{\"name\": \"John\"}"))
   * assert.deepStrictEqual(success, Result.succeed({ name: "John" }))
   *
   * const failure = Result.try(() => JSON.parse("invalid json"))
   * assert.deepStrictEqual(Result.isFailure(failure), true)
   * ```
   *
   * @category Constructors
   * @since 4.0.0
   */
  try_ as try
}

/**
 * Tests if a value is a `Result`.
 *
 * @example
 * ```ts
 * import { Result } from "effect"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(Result.isResult(Result.succeed(1)), true)
 * assert.deepStrictEqual(Result.isResult(Result.fail("a")), true)
 * assert.deepStrictEqual(Result.isResult({ value: 1 }), false)
 * ```
 *
 * @category Type Guards
 * @since 4.0.0
 */
export const isResult: (input: unknown) => input is Result<unknown, unknown> = result.isResult

/**
 * Determine if a `Result` is a `Failure`.
 *
 * @example
 * ```ts
 * import { Result } from "effect"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(Result.isFailure(Result.succeed(1)), false)
 * assert.deepStrictEqual(Result.isFailure(Result.fail("a")), true)
 * ```
 *
 * @category Type Guards
 * @since 4.0.0
 */
export const isFailure: <A, E>(self: Result<A, E>) => self is Failure<A, E> = result.isFailure

/**
 * Determine if a `Result` is a `Success`.
 *
 * @example
 * ```ts
 * import { Result } from "effect"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(Result.isSuccess(Result.succeed(1)), true)
 * assert.deepStrictEqual(Result.isSuccess(Result.fail("a")), false)
 * ```
 *
 * @category Type Guards
 * @since 4.0.0
 */
export const isSuccess: <A, E>(self: Result<A, E>) => self is Success<A, E> = result.isSuccess

/**
 * Converts a `Result` to an `Option` discarding the `Failure`.
 *
 * @example
 * ```ts
 * import { Option, Result } from "effect"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(
 *   Result.getSuccess(Result.succeed("ok")),
 *   Option.some("ok")
 * )
 * assert.deepStrictEqual(Result.getSuccess(Result.fail("err")), Option.none())
 * ```
 *
 * @category Getters
 * @since 4.0.0
 */
export const getSuccess: <A, E>(self: Result<A, E>) => Option<A> = result.getSuccess

/**
 * Converts a `Result` to an `Option` discarding the `Success`.
 *
 * @example
 * ```ts
 * import { Option, Result } from "effect"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(Result.getFailure(Result.succeed("ok")), Option.none())
 * assert.deepStrictEqual(
 *   Result.getFailure(Result.fail("err")),
 *   Option.some("err")
 * )
 * ```
 *
 * @category Getters
 * @since 4.0.0
 */
export const getFailure: <A, E>(self: Result<A, E>) => Option<E> = result.getFailure

/**
 * Returns an `Equivalence` for comparing two `Result` values.
 *
 * **Example**
 *
 * ```ts
 * import { Equivalence, Result } from "effect"
 *
 * const stringEquivalence = Equivalence.strictEqual<string>()
 * const numberEquivalence = Equivalence.strictEqual<number>()
 *
 * const resultEquivalence = Result.makeEquivalence(
 *   numberEquivalence,
 *   stringEquivalence
 * )
 *
 * console.log(resultEquivalence(Result.succeed(1), Result.succeed(1)))
 * // true
 * console.log(resultEquivalence(Result.succeed(1), Result.succeed(2)))
 * // false
 * console.log(resultEquivalence(Result.succeed(1), Result.fail("foo")))
 * // false
 * ```
 *
 * @category Equivalence
 * @since 4.0.0
 */
export const makeEquivalence = <A, E>(
  success: Equivalence.Equivalence<A>,
  failure: Equivalence.Equivalence<E>
): Equivalence.Equivalence<Result<A, E>> =>
  Equivalence.make((x, y) =>
    isFailure(x) ?
      isFailure(y) && failure(x.failure, y.failure) :
      isSuccess(y) && success(x.success, y.success)
  )

/**
 * Maps both the success and failure values of a `Result` using provided functions.
 *
 * @example
 * ```ts
 * import { pipe, Result } from "effect"
 * import * as assert from "node:assert"
 *
 * const success = pipe(
 *   Result.succeed(1),
 *   Result.mapBoth({
 *     onSuccess: (n) => n + 1,
 *     onFailure: (e) => `Error: ${e}`
 *   })
 * )
 * assert.deepStrictEqual(success, Result.succeed(2))
 *
 * const failure = pipe(
 *   Result.fail("not a number"),
 *   Result.mapBoth({
 *     onSuccess: (n) => n + 1,
 *     onFailure: (e) => `Error: ${e}`
 *   })
 * )
 * assert.deepStrictEqual(failure, Result.fail("Error: not a number"))
 * ```
 *
 * @category Mapping
 * @since 4.0.0
 */
export const mapBoth: {
  <E, E2, A, A2>(options: {
    readonly onFailure: (left: E) => E2
    readonly onSuccess: (right: A) => A2
  }): (self: Result<A, E>) => Result<A2, E2>
  <E, A, E2, A2>(self: Result<A, E>, options: {
    readonly onFailure: (left: E) => E2
    readonly onSuccess: (right: A) => A2
  }): Result<A2, E2>
} = dual(
  2,
  <E, A, E2, A2>(self: Result<A, E>, { onFailure, onSuccess }: {
    readonly onFailure: (left: E) => E2
    readonly onSuccess: (right: A) => A2
  }): Result<A2, E2> => isFailure(self) ? fail(onFailure(self.failure)) : succeed(onSuccess(self.success))
)

/**
 * Maps the `Failure` side of an `Result` value to a new `Result` value.
 *
 * @example
 * ```ts
 * import { pipe, Result } from "effect"
 * import * as assert from "node:assert"
 *
 * const success = pipe(
 *   Result.succeed(1),
 *   Result.mapError((e) => `Error: ${e}`)
 * )
 * assert.deepStrictEqual(success, Result.succeed(1))
 *
 * const failure = pipe(
 *   Result.fail("not a number"),
 *   Result.mapError((e) => `Error: ${e}`)
 * )
 * assert.deepStrictEqual(failure, Result.fail("Error: not a number"))
 * ```
 *
 * @category Mapping
 * @since 4.0.0
 */
export const mapError: {
  <E, E2>(f: (err: E) => E2): <A>(self: Result<A, E>) => Result<A, E2>
  <A, E, E2>(self: Result<A, E>, f: (err: E) => E2): Result<A, E2>
} = dual(
  2,
  <A, E, E2>(self: Result<A, E>, f: (err: E) => E2): Result<A, E2> =>
    isFailure(self) ? fail(f(self.failure)) : succeed(self.success)
)

/**
 * Maps the `Success` side of an `Result` value to a new `Result` value.
 *
 * @example
 * ```ts
 * import { pipe, Result } from "effect"
 * import * as assert from "node:assert"
 *
 * const success = pipe(
 *   Result.succeed(1),
 *   Result.map((n) => n + 1)
 * )
 * assert.deepStrictEqual(success, Result.succeed(2))
 *
 * const failure = pipe(
 *   Result.fail("not a number"),
 *   Result.map((n) => n + 1)
 * )
 * assert.deepStrictEqual(failure, Result.fail("not a number"))
 * ```
 *
 * @category Mapping
 * @since 4.0.0
 */
export const map: {
  <A, A2>(f: (ok: A) => A2): <E>(self: Result<A, E>) => Result<A2, E>
  <A, E, A2>(self: Result<A, E>, f: (ok: A) => A2): Result<A2, E>
} = dual(
  2,
  <A, E, A2>(self: Result<A, E>, f: (ok: A) => A2): Result<A2, E> =>
    isSuccess(self) ? succeed(f(self.success)) : fail(self.failure)
)

/**
 * Takes two functions and an `Result` value, if the value is a `Failure` the inner
 * value is applied to the `onFailure function, if the value is a `Success` the inner
 * value is applied to the `onSuccess` function.
 *
 * @example
 * ```ts
 * import { pipe, Result } from "effect"
 * import * as assert from "node:assert"
 *
 * const onFailure = (strings: ReadonlyArray<string>): string =>
 *   `strings: ${strings.join(", ")}`
 *
 * const onSuccess = (value: number): string => `Ok: ${value}`
 *
 * assert.deepStrictEqual(
 *   pipe(Result.succeed(1), Result.match({ onFailure, onSuccess })),
 *   "Ok: 1"
 * )
 * assert.deepStrictEqual(
 *   pipe(
 *     Result.fail(["string 1", "string 2"]),
 *     Result.match({ onFailure, onSuccess })
 *   ),
 *   "strings: string 1, string 2"
 * )
 * ```
 *
 * @category Pattern Matching
 * @since 4.0.0
 */
export const match: {
  <E, B, A, C = B>(options: {
    readonly onFailure: (error: E) => B
    readonly onSuccess: (ok: A) => C
  }): (self: Result<A, E>) => B | C
  <A, E, B, C = B>(self: Result<A, E>, options: {
    readonly onFailure: (error: E) => B
    readonly onSuccess: (ok: A) => C
  }): B | C
} = dual(
  2,
  <A, E, B, C = B>(self: Result<A, E>, { onFailure, onSuccess }: {
    readonly onFailure: (error: E) => B
    readonly onSuccess: (ok: A) => C
  }): B | C => isFailure(self) ? onFailure(self.failure) : onSuccess(self.success)
)

/**
 * Transforms a `Predicate` function into a `Success` of the input value if the predicate returns `true`
 * or a `Failure` of the result of the provided function if the predicate returns false
 *
 * @example
 * ```ts
 * import { pipe, Result } from "effect"
 * import * as assert from "node:assert"
 *
 * const isPositive = (n: number): boolean => n > 0
 *
 * assert.deepStrictEqual(
 *   pipe(
 *     1,
 *     Result.liftPredicate(isPositive, (n) => `${n} is not positive`)
 *   ),
 *   Result.succeed(1)
 * )
 * assert.deepStrictEqual(
 *   pipe(
 *     0,
 *     Result.liftPredicate(isPositive, (n) => `${n} is not positive`)
 *   ),
 *   Result.fail("0 is not positive")
 * )
 * ```
 *
 * @category Constructors
 * @since 4.0.0
 */
export const liftPredicate: {
  <A, B extends A, E>(refinement: Refinement<A, B>, orFailWith: (a: A) => E): (a: A) => Result<B, E>
  <B extends A, E, A = B>(
    predicate: Predicate<A>,
    orFailWith: (a: A) => E
  ): (a: B) => Result<B, E>
  <A, E, B extends A>(
    self: A,
    refinement: Refinement<A, B>,
    orFailWith: (a: A) => E
  ): Result<B, E>
  <B extends A, E, A = B>(
    self: B,
    predicate: Predicate<A>,
    orFailWith: (a: A) => E
  ): Result<B, E>
} = dual(
  3,
  <A, E>(a: A, predicate: Predicate<A>, orFailWith: (a: A) => E): Result<A, E> =>
    predicate(a) ? succeed(a) : fail(orFailWith(a))
)

/**
 * Filter the right value with the provided function.
 * If the predicate fails, set the left value with the result of the provided function.
 *
 * @example
 * ```ts
 * import { pipe, Result } from "effect"
 * import * as assert from "node:assert"
 *
 * const isPositive = (n: number): boolean => n > 0
 *
 * assert.deepStrictEqual(
 *   pipe(
 *     Result.succeed(1),
 *     Result.filterOrFail(isPositive, (n) => `${n} is not positive`)
 *   ),
 *   Result.succeed(1)
 * )
 * assert.deepStrictEqual(
 *   pipe(
 *     Result.succeed(0),
 *     Result.filterOrFail(isPositive, (n) => `${n} is not positive`)
 *   ),
 *   Result.fail("0 is not positive")
 * )
 * ```
 *
 * @since 4.0.0
 * @category Filtering
 */
export const filterOrFail: {
  <A, B extends A, E2>(
    refinement: Refinement<NoInfer<A>, B>,
    orFailWith: (value: NoInfer<A>) => E2
  ): <E>(self: Result<A, E>) => Result<B, E2 | E>
  <A, E2>(
    predicate: Predicate<NoInfer<A>>,
    orFailWith: (value: NoInfer<A>) => E2
  ): <E>(self: Result<A, E>) => Result<A, E2 | E>
  <A, E, B extends A, E2>(
    self: Result<A, E>,
    refinement: Refinement<A, B>,
    orFailWith: (value: A) => E2
  ): Result<B, E | E2>
  <A, E, E2>(self: Result<A, E>, predicate: Predicate<A>, orFailWith: (value: A) => E2): Result<A, E | E2>
} = dual(3, <A, E, E2>(
  self: Result<A, E>,
  predicate: Predicate<A>,
  orFailWith: (value: A) => E2
): Result<A, E | E2> => flatMap(self, (a) => predicate(a) ? succeed(a) : fail(orFailWith(a))))

/**
 * Returns the value from a `Result`, merging the success and failure cases.
 *
 * @example
 * ```ts
 * import { Result } from "effect"
 * import * as assert from "node:assert"
 *
 * const success = Result.succeed(42)
 * assert.deepStrictEqual(Result.merge(success), 42)
 *
 * const failure = Result.fail("error")
 * assert.deepStrictEqual(Result.merge(failure), "error")
 * ```
 *
 * @category Getters
 * @since 4.0.0
 */
export const merge: <A, E>(self: Result<A, E>) => E | A = match({ onFailure: identity, onSuccess: identity })

/**
 * Returns the wrapped value if it's a `Success` or a default value if is a `Failure`.
 *
 * @example
 * ```ts
 * import { Result } from "effect"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(
 *   Result.getOrElse(Result.succeed(1), (error) => error + "!"),
 *   1
 * )
 * assert.deepStrictEqual(
 *   Result.getOrElse(Result.fail("not a number"), (error) => error + "!"),
 *   "not a number!"
 * )
 * ```
 *
 * @category Getters
 * @since 4.0.0
 */
export const getOrElse: {
  <E, A2>(onFailure: (err: E) => A2): <A>(self: Result<A, E>) => A2 | A
  <A, E, A2>(self: Result<A, E>, onFailure: (err: E) => A2): A | A2
} = dual(
  2,
  <A, E, A2>(self: Result<A, E>, onFailure: (err: E) => A2): A | A2 =>
    isFailure(self) ? onFailure(self.failure) : self.success
)

/**
 * Returns the wrapped value if it's a `Success` or `null` if it's a `Failure`.
 *
 * @example
 * ```ts
 * import { Result } from "effect"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(Result.getOrNull(Result.succeed(1)), 1)
 * assert.deepStrictEqual(Result.getOrNull(Result.fail("a")), null)
 * ```
 *
 * @category Getters
 * @since 4.0.0
 */
export const getOrNull: <A, E>(self: Result<A, E>) => A | null = getOrElse(constNull)

/**
 * Returns the wrapped value if it's a `Success` or `undefined` if it's a `Failure`.
 *
 * @example
 * ```ts
 * import { Result } from "effect"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(Result.getOrUndefined(Result.succeed(1)), 1)
 * assert.deepStrictEqual(Result.getOrUndefined(Result.fail("a")), undefined)
 * ```
 *
 * @category Getters
 * @since 4.0.0
 */
export const getOrUndefined: <A, E>(self: Result<A, E>) => A | undefined = getOrElse(constUndefined)

/**
 * Extracts the success value of a `Result` or throws the value returned by the
 * provided function if the `Result` is a `Failure`.
 *
 * **Example**
 *
 * ```ts
 * import { Result } from "effect"
 *
 * Result.getOrThrowWith(Result.succeed(1), () => new Error("Unexpected Err"))
 * // => 1
 *
 * Result.getOrThrowWith(
 *   Result.fail("error"),
 *   (err) => new Error(`Unexpected Err: ${err}`)
 * )
 * // => throws new Error('Unexpected Err: error')
 * ```
 *
 * @see {@link getOrThrow} for a version that throws the failure value.
 *
 * @category Getters
 * @since 4.0.0
 */
export const getOrThrowWith: {
  <E>(onFailure: (err: E) => unknown): <A>(self: Result<A, E>) => A
  <A, E>(self: Result<A, E>, onFailure: (err: E) => unknown): A
} = dual(2, <A, E>(self: Result<A, E>, onFailure: (err: E) => unknown): A => {
  if (isSuccess(self)) {
    return self.success
  }
  throw onFailure(self.failure)
})

/**
 * Extracts the success value of an `Result` or throws if the `Result` is a
 * `Failure`.
 *
 * @example
 * ```ts
 * import { Result } from "effect"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(Result.getOrThrow(Result.succeed(1)), 1)
 * assert.throws(() => Result.getOrThrow(Result.fail("error")))
 * ```
 *
 * @throws `E`
 *
 * @category Getters
 * @since 4.0.0
 */
export const getOrThrow: <A, E>(self: Result<A, E>) => A = getOrThrowWith(identity)

/**
 * Returns `self` if it is a `Success` or `that` otherwise.
 *
 * @example
 * ```ts
 * import { pipe, Result } from "effect"
 * import * as assert from "node:assert"
 *
 * const success = pipe(
 *   Result.succeed(1),
 *   Result.orElse(() => Result.succeed(2))
 * )
 * assert.deepStrictEqual(success, Result.succeed(1))
 *
 * const failure = pipe(
 *   Result.fail("error"),
 *   Result.orElse(() => Result.succeed(2))
 * )
 * assert.deepStrictEqual(failure, Result.succeed(2))
 * ```
 *
 * @category Error Handling
 * @since 4.0.0
 */
export const orElse: {
  <E, A2, E2>(that: (err: E) => Result<A2, E2>): <A>(self: Result<A, E>) => Result<A | A2, E2>
  <A, E, A2, E2>(self: Result<A, E>, that: (err: E) => Result<A2, E2>): Result<A | A2, E2>
} = dual(
  2,
  <A, E, A2, E2>(self: Result<A, E>, that: (err: E) => Result<A2, E2>): Result<A | A2, E2> =>
    isFailure(self) ? that(self.failure) : succeed(self.success)
)

/**
 * Sequentially chain two `Result` values, where the second depends on the success value of the first.
 *
 * @example
 * ```ts
 * import { pipe, Result } from "effect"
 * import * as assert from "node:assert"
 *
 * const parseAndDouble = (s: string) =>
 *   pipe(
 *     Result.try(() => parseInt(s)),
 *     Result.flatMap((n) =>
 *       n > 0 ? Result.succeed(n * 2) : Result.fail("not positive")
 *     )
 *   )
 *
 * assert.deepStrictEqual(parseAndDouble("5"), Result.succeed(10))
 * assert.deepStrictEqual(parseAndDouble("-1"), Result.fail("not positive"))
 * ```
 *
 * @category Sequencing
 * @since 4.0.0
 */
export const flatMap: {
  <A, A2, E2>(f: (a: A) => Result<A2, E2>): <E>(self: Result<A, E>) => Result<A2, E | E2>
  <A, E, A2, E2>(self: Result<A, E>, f: (a: A) => Result<A2, E2>): Result<A2, E | E2>
} = dual(
  2,
  <A, E, A2, E2>(self: Result<A, E>, f: (a: A) => Result<A2, E2>): Result<A2, E | E2> =>
    isFailure(self) ? fail(self.failure) : f(self.success)
)

/**
 * Executes a sequence of two `Result`s. The second `Result` can be dependent on the result of the first `Result`.
 *
 * @example
 * ```ts
 * import { pipe, Result } from "effect"
 * import * as assert from "node:assert"
 *
 * const success = pipe(
 *   Result.succeed(1),
 *   Result.andThen((n) => Result.succeed(n + 1))
 * )
 * assert.deepStrictEqual(success, Result.succeed(2))
 *
 * const failure = pipe(
 *   Result.fail("error"),
 *   Result.andThen((n) => Result.succeed(n + 1))
 * )
 * assert.deepStrictEqual(failure, Result.fail("error"))
 * ```
 *
 * @category Sequencing
 * @since 4.0.0
 */
export const andThen: {
  <A, A2, E2>(f: (a: A) => Result<A2, E2>): <E>(self: Result<A, E>) => Result<A2, E | E2>
  <A2, E2>(f: Result<A2, E2>): <A, E>(self: Result<A, E>) => Result<A2, E | E2>
  <A, A2>(f: (a: A) => A2): <E>(self: Result<A, E>) => Result<A2, E>
  <A2>(right: NotFunction<A2>): <A, E>(self: Result<A, E>) => Result<A2, E>
  <A, E, A2, E2>(self: Result<A, E>, f: (a: A) => Result<A2, E2>): Result<A2, E | E2>
  <A, E, A2, E2>(self: Result<A, E>, f: Result<A2, E2>): Result<A2, E | E2>
  <A, E, A2>(self: Result<A, E>, f: (a: A) => A2): Result<A2, E>
  <A, E, A2>(self: Result<A, E>, f: NotFunction<A2>): Result<A2, E>
} = dual(
  2,
  <A, E, A2, E2>(
    self: Result<A, E>,
    f: ((a: A) => Result<A2, E2> | A2) | Result<A2, E2> | A2
  ): Result<A2, E | E2> =>
    flatMap(self, (a) => {
      const out = isFunction(f) ? f(a) : f
      return isResult(out) ? out : succeed(out)
    })
)

/**
 * Takes a structure of `Result`s and returns an `Result` of values with the same structure.
 *
 * - If a tuple is supplied, then the returned `Result` will contain a tuple with the same length.
 * - If a struct is supplied, then the returned `Result` will contain a struct with the same keys.
 * - If an iterable is supplied, then the returned `Result` will contain an array.
 *
 * @example
 * ```ts
 * import { Result } from "effect"
 * import * as assert from "node:assert"
 *
 * assert.deepStrictEqual(
 *   Result.all([Result.succeed(1), Result.succeed(2)]),
 *   Result.succeed([1, 2])
 * )
 * assert.deepStrictEqual(
 *   Result.all({ right: Result.succeed(1), b: Result.succeed("hello") }),
 *   Result.succeed({ right: 1, b: "hello" })
 * )
 * assert.deepStrictEqual(
 *   Result.all({ right: Result.succeed(1), b: Result.fail("error") }),
 *   Result.fail("error")
 * )
 * ```
 *
 * @category Sequencing
 * @since 4.0.0
 */
// @ts-expect-error
export const all: <const I extends Iterable<Result<any, any>> | Record<string, Result<any, any>>>(
  input: I
) => [I] extends [ReadonlyArray<Result<any, any>>] ? Result<
    { -readonly [K in keyof I]: [I[K]] extends [Result<infer R, any>] ? R : never },
    I[number] extends never ? never : [I[number]] extends [Result<any, infer L>] ? L : never
  >
  : [I] extends [Iterable<Result<infer R, infer L>>] ? Result<Array<R>, L>
  : Result<
    { -readonly [K in keyof I]: [I[K]] extends [Result<infer R, any>] ? R : never },
    I[keyof I] extends never ? never : [I[keyof I]] extends [Result<any, infer L>] ? L : never
  > = (
    input: Iterable<Result<any, any>> | Record<string, Result<any, any>>
  ): Result<any, any> => {
    if (Symbol.iterator in input) {
      const out: Array<Result<any, any>> = []
      for (const e of input) {
        if (isFailure(e)) {
          return e
        }
        out.push(e.success)
      }
      return succeed(out)
    }

    const out: Record<string, any> = {}
    for (const key of Object.keys(input)) {
      const e = input[key]
      if (isFailure(e)) {
        return e
      }
      out[key] = e.success
    }
    return succeed(out)
  }

/**
 * Returns an `Result` that swaps the error/success cases. This allows you to
 * use all methods on the error channel, possibly before flipping back.
 *
 * @example
 * ```ts
 * import { Result } from "effect"
 * import * as assert from "node:assert"
 *
 * const success = Result.succeed(42)
 * assert.deepStrictEqual(Result.flip(success), Result.fail(42))
 *
 * const failure = Result.fail("error")
 * assert.deepStrictEqual(Result.flip(failure), Result.succeed("error"))
 * ```
 *
 * @category Utilities
 * @since 4.0.0
 */
export const flip = <A, E>(self: Result<A, E>): Result<E, A> =>
  isFailure(self) ? succeed(self.failure) : fail(self.success)

/**
 * Provides a generator-based DSL for working with `Result` values in a sequential manner.
 *
 * @example
 * ```ts
 * import { Result } from "effect"
 * import * as assert from "node:assert"
 *
 * const program = Result.gen(function*() {
 *   const a = yield* Result.succeed(1)
 *   const b = yield* Result.succeed(2)
 *   return a + b
 * })
 *
 * assert.deepStrictEqual(program, Result.succeed(3))
 * ```
 *
 * @category Generators
 * @since 4.0.0
 */
export const gen: Gen.Gen<ResultTypeLambda> = (...args) => {
  const f = args.length === 1 ? args[0] : args[1].bind(args[0])
  const iterator = f()
  let state: IteratorResult<any> = iterator.next()
  while (!state.done) {
    const current = Gen.isGenKind(state.value)
      ? state.value.value
      : state.value
    if (isFailure(current)) {
      return current
    }
    state = iterator.next(current.success as never)
  }
  return succeed(state.value) as any
}

// -------------------------------------------------------------------------------------
// do notation
// -------------------------------------------------------------------------------------

/**
 * The "do simulation" in Effect allows you to write code in a more declarative style, similar to the "do notation" in other programming languages. It provides a way to define variables and perform operations on them using functions like `bind` and `let`.
 *
 * Here's how the do simulation works:
 *
 * 1. Start the do simulation using the `Do` value
 * 2. Within the do simulation scope, you can use the `bind` function to define variables and bind them to `Result` values
 * 3. You can accumulate multiple `bind` statements to define multiple variables within the scope
 * 4. Inside the do simulation scope, you can also use the `let` function to define variables and bind them to simple values
 *
 * @see {@link bind}
 * @see {@link bindTo}
 * @see {@link let_ let}
 *
 * @example
 * ```ts
 * import { pipe, Result } from "effect"
 * import * as assert from "node:assert"
 *
 * const result = pipe(
 *   Result.Do,
 *   Result.bind("x", () => Result.succeed(2)),
 *   Result.bind("y", () => Result.succeed(3)),
 *   Result.let("sum", ({ x, y }) => x + y)
 * )
 * assert.deepStrictEqual(result, Result.succeed({ x: 2, y: 3, sum: 5 }))
 * ```
 *
 * @category Do Notation
 * @since 4.0.0
 */
export const Do: Result<{}> = succeed({})

/**
 * The "do simulation" in Effect allows you to write code in a more declarative style, similar to the "do notation" in other programming languages. It provides a way to define variables and perform operations on them using functions like `bind` and `let`.
 *
 * Here's how the do simulation works:
 *
 * 1. Start the do simulation using the `Do` value
 * 2. Within the do simulation scope, you can use the `bind` function to define variables and bind them to `Result` values
 * 3. You can accumulate multiple `bind` statements to define multiple variables within the scope
 * 4. Inside the do simulation scope, you can also use the `let` function to define variables and bind them to simple values
 *
 * @see {@link Do}
 * @see {@link bindTo}
 * @see {@link let_ let}
 *
 * @example
 * ```ts
 * import { pipe, Result } from "effect"
 * import * as assert from "node:assert"
 *
 * const result = pipe(
 *   Result.Do,
 *   Result.bind("x", () => Result.succeed(2)),
 *   Result.bind("y", () => Result.succeed(3)),
 *   Result.let("sum", ({ x, y }) => x + y)
 * )
 * assert.deepStrictEqual(result, Result.succeed({ x: 2, y: 3, sum: 5 }))
 * ```
 *
 * @category Do Notation
 * @since 4.0.0
 */
export const bind: {
  <N extends string, A extends object, B, L2>(
    name: Exclude<N, keyof A>,
    f: (a: NoInfer<A>) => Result<B, L2>
  ): <L1>(self: Result<A, L1>) => Result<{ [K in N | keyof A]: K extends keyof A ? A[K] : B }, L1 | L2>
  <A extends object, L1, N extends string, B, L2>(
    self: Result<A, L1>,
    name: Exclude<N, keyof A>,
    f: (a: NoInfer<A>) => Result<B, L2>
  ): Result<{ [K in N | keyof A]: K extends keyof A ? A[K] : B }, L1 | L2>
} = doNotation.bind<ResultTypeLambda>(map, flatMap)

/**
 * The "do simulation" in Effect allows you to write code in a more declarative style, similar to the "do notation" in other programming languages. It provides a way to define variables and perform operations on them using functions like `bind` and `let`.
 *
 * Here's how the do simulation works:
 *
 * 1. Start the do simulation using the `Do` value
 * 2. Within the do simulation scope, you can use the `bind` function to define variables and bind them to `Result` values
 * 3. You can accumulate multiple `bind` statements to define multiple variables within the scope
 * 4. Inside the do simulation scope, you can also use the `let` function to define variables and bind them to simple values
 *
 * @see {@link Do}
 * @see {@link bind}
 * @see {@link let_ let}
 *
 * @example
 * ```ts
 * import { pipe, Result } from "effect"
 * import * as assert from "node:assert"
 *
 * const result = pipe(
 *   Result.Do,
 *   Result.bind("x", () => Result.succeed(2)),
 *   Result.bind("y", () => Result.succeed(3)),
 *   Result.let("sum", ({ x, y }) => x + y)
 * )
 * assert.deepStrictEqual(result, Result.succeed({ x: 2, y: 3, sum: 5 }))
 * ```
 *
 * @category Do Notation
 * @since 4.0.0
 */
export const bindTo: {
  <N extends string>(name: N): <R, L>(self: Result<R, L>) => Result<Record<N, R>, L>
  <R, L, N extends string>(self: Result<R, L>, name: N): Result<Record<N, R>, L>
} = doNotation.bindTo<ResultTypeLambda>(map)

const let_: {
  <N extends string, R extends object, B>(
    name: Exclude<N, keyof R>,
    f: (r: NoInfer<R>) => B
  ): <L>(self: Result<R, L>) => Result<{ [K in N | keyof R]: K extends keyof R ? R[K] : B }, L>
  <R extends object, L, N extends string, B>(
    self: Result<R, L>,
    name: Exclude<N, keyof R>,
    f: (r: NoInfer<R>) => B
  ): Result<{ [K in N | keyof R]: K extends keyof R ? R[K] : B }, L>
} = doNotation.let_<ResultTypeLambda>(map)

export {
  /**
   * The "do simulation" in Effect allows you to write code in a more declarative style, similar to the "do notation" in other programming languages. It provides a way to define variables and perform operations on them using functions like `bind` and `let`.
   *
   * Here's how the do simulation works:
   *
   * 1. Start the do simulation using the `Do` value
   * 2. Within the do simulation scope, you can use the `bind` function to define variables and bind them to `Result` values
   * 3. You can accumulate multiple `bind` statements to define multiple variables within the scope
   * 4. Inside the do simulation scope, you can also use the `let` function to define variables and bind them to simple values
   *
   * @see {@link Do}
   * @see {@link bindTo}
   * @see {@link bind}
   *
   * @example
   * ```ts
   * import { pipe, Result } from "effect"
   * import * as assert from "node:assert"
   *
   * const result = pipe(
   *   Result.Do,
   *   Result.bind("x", () => Result.succeed(2)),
   *   Result.bind("y", () => Result.succeed(3)),
   *   Result.let("sum", ({ x, y }) => x + y)
   * )
   * assert.deepStrictEqual(result, Result.succeed({ x: 2, y: 3, sum: 5 }))
   * ```
   * @category Do Notation
   * @since 4.0.0
   */
  let_ as let
}

/**
 * Converts an `Option` of an `Result` into an `Result` of an `Option`.
 *
 * **Details**
 *
 * This function transforms an `Option<Result<A, E>>` into an
 * `Result<Option<A>, E>`. If the `Option` is `None`, the resulting `Result`
 * will be a `Success` with a `None` value. If the `Option` is `Some`, the
 * inner `Result` will be executed, and its result wrapped in a `Some`.
 *
 * @example
 * ```ts
 * import { Option, Result } from "effect"
 *
 * //      ┌─── Option<Result<number, never>>
 * //      ▼
 * const maybe = Option.some(Result.succeed(42))
 *
 * //      ┌─── Result<Option<number>, never, never>
 * //      ▼
 * const result = Result.transposeOption(maybe)
 * ```
 *
 * @since 3.14.0
 * @category Transposing
 */
export const transposeOption = <A = never, E = never>(
  self: Option<Result<A, E>>
): Result<Option<A>, E> => {
  return option_.isNone(self) ? succeedNone : map(self.value, option_.some)
}

/**
 * Transforms an `Option` by applying a function that returns a `Result`, and then transposes the structure.
 *
 * @example
 * ```ts
 * import { Option, Result } from "effect"
 *
 * const parseNumber = (s: string) =>
 *   isNaN(Number(s)) ? Result.fail("Invalid number") : Result.succeed(Number(s))
 *
 * // Transform Some value
 * const some = Result.transposeMapOption(Option.some("42"), parseNumber)
 * // Result.succeed(Option.some(42))
 *
 * // Transform None value
 * const none = Result.transposeMapOption(Option.none(), parseNumber)
 * // Result.succeed(Option.none())
 *
 * // Handle invalid input
 * const invalid = Result.transposeMapOption(Option.some("abc"), parseNumber)
 * // Result.fail("Invalid number")
 * ```
 *
 * @since 3.15.0
 * @category Transposing
 */
export const transposeMapOption = dual<
  <A, B, E = never>(
    f: (self: A) => Result<B, E>
  ) => (self: Option<A>) => Result<Option<B>, E>,
  <A, B, E = never>(
    self: Option<A>,
    f: (self: A) => Result<B, E>
  ) => Result<Option<B>, E>
>(2, (self, f) => option_.isNone(self) ? succeedNone : map(f(self.value), option_.some))

/**
 * Creates a `Result` that succeeds with a `None` value.
 *
 * @example
 * ```ts
 * import { Option, Result } from "effect"
 * import * as assert from "node:assert"
 *
 * const result = Result.succeedNone
 * assert.deepStrictEqual(result, Result.succeed(Option.none()))
 * ```
 *
 * @category Constructors
 * @since 4.0.0
 */
export const succeedNone = succeed(option_.none)

/**
 * Creates a `Result` that succeeds with a `Some` value.
 *
 * @example
 * ```ts
 * import { Option, Result } from "effect"
 * import * as assert from "node:assert"
 *
 * const result = Result.succeedSome(42)
 * assert.deepStrictEqual(result, Result.succeed(Option.some(42)))
 * ```
 *
 * @category Constructors
 * @since 4.0.0
 */
export const succeedSome = <A, E = never>(a: A): Result<Option<A>, E> => succeed(option_.some(a))

/**
 * Applies a side-effect to the success value of a `Result` without changing the `Result` itself.
 *
 * @example
 * ```ts
 * import { pipe, Result } from "effect"
 * import * as assert from "node:assert"
 *
 * let sideEffect = 0
 * const success = pipe(
 *   Result.succeed(42),
 *   Result.tap((n) => {
 *     sideEffect = n
 *   })
 * )
 *
 * assert.deepStrictEqual(success, Result.succeed(42))
 * assert.deepStrictEqual(sideEffect, 42)
 * ```
 *
 * @category Mapping
 * @since 4.0.0
 */
export const tap: {
  <A>(f: (a: A) => void): <E>(self: Result<A, E>) => Result<A, E>
  <A, E>(self: Result<A, E>, f: (a: A) => void): Result<A, E>
} = dual(
  2,
  <A, E>(self: Result<A, E>, f: (a: A) => void): Result<A, E> => {
    if (isSuccess(self)) {
      f(self.success)
    }
    return self
  }
)
