/**
 * @since 4.0.0
 */

import type { EffectIterator, Yieldable } from "./Effect.js"
import * as Equivalence from "./Equivalence.js"
import type { LazyArg } from "./Function.js"
import { constNull, constUndefined, dual, identity } from "./Function.js"
import type { TypeLambda } from "./HKT.js"
import type { Inspectable } from "./Inspectable.js"
import * as doNotation from "./internal/doNotation.js"
import * as option_ from "./internal/option.js"
import * as result from "./internal/result.js"
import type { Option } from "./Option.js"
import type { Pipeable } from "./Pipeable.js"
import type { Predicate, Refinement } from "./Predicate.js"
import { isFunction } from "./Predicate.js"
import type { Covariant, NoInfer, NotFunction } from "./Types.js"
import type * as Unify from "./Unify.js"
import * as Gen from "./Utils.js"

/**
 * @category Models
 * @since 4.0.0
 */
export type Result<A, E = never> = Ok<A, E> | Err<A, E>

/**
 * @category Symbols
 * @since 4.0.0
 */
export const TypeId: unique symbol = result.TypeId

/**
 * @category Symbols
 * @since 4.0.0
 */
export type TypeId = typeof TypeId

/**
 * @category Models
 * @since 4.0.0
 */
export interface Err<out A, out E> extends Pipeable, Inspectable, Yieldable<A, E> {
  readonly _tag: "Err"
  readonly _op: "Err"
  readonly err: E
  readonly [TypeId]: {
    readonly _A: Covariant<E>
    readonly _E: Covariant<A>
  }
  [Symbol.iterator](): EffectIterator<Result<A, E>>
  [Unify.typeSymbol]?: unknown
  [Unify.unifySymbol]?: ResultUnify<this>
  [Unify.ignoreSymbol]?: ResultUnifyIgnore
}

/**
 * @category Models
 * @since 4.0.0
 */
export interface Ok<out A, out E> extends Pipeable, Inspectable, Yieldable<A, E> {
  readonly _tag: "Ok"
  readonly _op: "Ok"
  readonly ok: A
  readonly [TypeId]: {
    readonly _A: Covariant<E>
    readonly _E: Covariant<A>
  }
  [Symbol.iterator](): EffectIterator<Result<A, E>>
  [Unify.typeSymbol]?: unknown
  [Unify.unifySymbol]?: ResultUnify<this>
  [Unify.ignoreSymbol]?: ResultUnifyIgnore
}

/**
 * @category Models
 * @since 4.0.0
 */
export interface ResultUnify<T extends { [Unify.typeSymbol]?: any }> {
  Result?: () => T[Unify.typeSymbol] extends Result<infer A, infer E> | infer _ ? Result<A, E> : never
}

/**
 * @category Models
 * @since 4.0.0
 */
export interface ResultUnifyIgnore {}

/**
 * @category Type Lambdas
 * @since 4.0.0
 */
export interface ResultTypeLambda extends TypeLambda {
  readonly type: Result<this["Target"], this["Out1"]>
}

/**
 * @category Type Level
 * @since 4.0.0
 */
export declare namespace Result {
  /**
   * @since 4.0.0
   * @category Type Level
   */
  export type Err<T extends Result<any, any>> = [T] extends [Result<infer _A, infer _E>] ? _E : never
  /**
   * @since 4.0.0
   * @category Type Level
   */
  export type Ok<T extends Result<any, any>> = [T] extends [Result<infer _A, infer _E>] ? _A : never
}

/**
 * Constructs a new `Result` holding an `Ok` value.
 *
 * @category Constructors
 * @since 4.0.0
 */
export const ok: <A>(right: A) => Result<A> = result.ok

/**
 * Constructs a new `Result` holding an `Err` value.
 *
 * @category Constructors
 * @since 4.0.0
 */
export const err: <E>(left: E) => Result<never, E> = result.err

const void_: Result<void> = ok(void 0)
export {
  /**
   * @category Constructors
   * @since 4.0.0
   */
  void_ as void
}

/**
 * Takes a lazy default and a nullable value, if the value is not nully (`null`
 * or `undefined`), turn it into an `Ok`, if the value is nully use the
 * provided default as an `Err`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Result } from "effect"
 *
 * assert.deepStrictEqual(Result.fromNullable(1, () => 'fallback'), Result.ok(1))
 * assert.deepStrictEqual(Result.fromNullable(null, () => 'fallback'), Result.err('fallback'))
 * ```
 *
 * @category Constructors
 * @since 4.0.0
 */
export const fromNullable: {
  <A, E>(onNullable: (ok: A) => E): (self: A) => Result<NonNullable<A>, E>
  <A, E>(self: A, onNullable: (ok: A) => E): Result<NonNullable<A>, E>
} = dual(
  2,
  <A, E>(self: A, onNullable: (ok: A) => E): Result<NonNullable<A>, E> =>
    self == null ? err(onNullable(self)) : ok(self)
)

/**
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Result, Option } from "effect"
 *
 * assert.deepStrictEqual(Result.fromOption(Option.some(1), () => 'error'), Result.ok(1))
 * assert.deepStrictEqual(Result.fromOption(Option.none(), () => 'error'), Result.err('error'))
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
      return ok(evaluate())
    } catch (e) {
      return err(e)
    }
  } else {
    try {
      return ok(evaluate.try())
    } catch (e) {
      return err(evaluate.catch(e))
    }
  }
}

export {
  /**
   * Imports a synchronous side-effect into a pure `Result` value, translating any
   * thrown exceptions into typed failed Results creating with `Err`.
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
 * import * as assert from "node:assert"
 * import { Result } from "effect"
 *
 * assert.deepStrictEqual(Result.isResult(Result.ok(1)), true)
 * assert.deepStrictEqual(Result.isResult(Result.err("a")), true)
 * assert.deepStrictEqual(Result.isResult({ ok: 1 }), false)
 * ```
 *
 * @category Type Guards
 * @since 4.0.0
 */
export const isResult: (input: unknown) => input is Result<unknown, unknown> = result.isResult

/**
 * Determine if a `Result` is an `Err`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Result } from "effect"
 *
 * assert.deepStrictEqual(Result.isErr(Result.ok(1)), false)
 * assert.deepStrictEqual(Result.isErr(Result.err("a")), true)
 * ```
 *
 * @category Type Guards
 * @since 4.0.0
 */
export const isErr: <A, E>(self: Result<A, E>) => self is Err<A, E> = result.isErr

/**
 * Determine if a `Result` is an `Ok`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Result } from "effect"
 *
 * assert.deepStrictEqual(Result.isOk(Result.ok(1)), true)
 * assert.deepStrictEqual(Result.isOk(Result.err("a")), false)
 * ```
 *
 * @category Type Guards
 * @since 4.0.0
 */
export const isOk: <A, E>(self: Result<A, E>) => self is Ok<A, E> = result.isOk

/**
 * Converts a `Result` to an `Option` discarding the `Err`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Result, Option } from "effect"
 *
 * assert.deepStrictEqual(Result.getOk(Result.ok('ok')), Option.some('ok'))
 * assert.deepStrictEqual(Result.getOk(Result.err('err')), Option.none())
 * ```
 *
 * @category Getters
 * @since 4.0.0
 */
export const getOk: <R, L>(self: Result<R, L>) => Option<R> = result.getOk

/**
 * Converts a `Result` to an `Option` discarding the `Ok`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Result, Option } from "effect"
 *
 * assert.deepStrictEqual(Result.getErr(Result.ok('ok')), Option.none())
 * assert.deepStrictEqual(Result.getErr(Result.err('err')), Option.some('err'))
 * ```
 *
 * @category Getters
 * @since 4.0.0
 */
export const getErr: <R, L>(self: Result<R, L>) => Option<L> = result.getErr

/**
 * @category Equivalence
 * @since 4.0.0
 */
export const getEquivalence = <A, E>({ err, ok }: {
  ok: Equivalence.Equivalence<A>
  err: Equivalence.Equivalence<E>
}): Equivalence.Equivalence<Result<A, E>> =>
  Equivalence.make((x, y) =>
    isErr(x) ?
      isErr(y) && err(x.err, y.err) :
      isOk(y) && ok(x.ok, y.ok)
  )

/**
 * @category Mapping
 * @since 4.0.0
 */
export const mapBoth: {
  <E, E2, A, A2>(options: {
    readonly onErr: (left: E) => E2
    readonly onOk: (right: A) => A2
  }): (self: Result<A, E>) => Result<A2, E2>
  <E, A, E2, A2>(self: Result<A, E>, options: {
    readonly onErr: (left: E) => E2
    readonly onOk: (right: A) => A2
  }): Result<A2, E2>
} = dual(
  2,
  <E, A, E2, A2>(self: Result<A, E>, { onErr, onOk }: {
    readonly onErr: (left: E) => E2
    readonly onOk: (right: A) => A2
  }): Result<A2, E2> => isErr(self) ? err(onErr(self.err)) : ok(onOk(self.ok))
)

/**
 * Maps the `Err` side of an `Result` value to a new `Result` value.
 *
 * @category Mapping
 * @since 4.0.0
 */
export const mapErr: {
  <E, E2>(f: (err: E) => E2): <A>(self: Result<A, E>) => Result<A, E2>
  <A, E, E2>(self: Result<A, E>, f: (err: E) => E2): Result<A, E2>
} = dual(
  2,
  <A, E, E2>(self: Result<A, E>, f: (err: E) => E2): Result<A, E2> => isErr(self) ? err(f(self.err)) : ok(self.ok)
)

/**
 * Maps the `Ok` side of an `Result` value to a new `Result` value.
 *
 * @category Mapping
 * @since 4.0.0
 */
export const map: {
  <A, A2>(f: (ok: A) => A2): <E>(self: Result<A, E>) => Result<A2, E>
  <A, E, A2>(self: Result<A, E>, f: (ok: A) => A2): Result<A2, E>
} = dual(
  2,
  <A, E, A2>(self: Result<A, E>, f: (ok: A) => A2): Result<A2, E> => isOk(self) ? ok(f(self.ok)) : err(self.err)
)

/**
 * Takes two functions and an `Result` value, if the value is a `Err` the inner
 * value is applied to the `onErr function, if the value is a `Ok` the inner
 * value is applied to the `onOk` function.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { pipe, Result } from "effect"
 *
 * const onErr  = (strings: ReadonlyArray<string>): string => `strings: ${strings.join(', ')}`
 *
 * const onOk = (value: number): string => `Ok: ${value}`
 *
 * assert.deepStrictEqual(pipe(Result.ok(1), Result.match({ onErr, onOk })), 'Ok: 1')
 * assert.deepStrictEqual(
 *   pipe(Result.err(['string 1', 'string 2']), Result.match({ onErr, onOk })),
 *   'strings: string 1, string 2'
 * )
 * ```
 *
 * @category Pattern Matching
 * @since 4.0.0
 */
export const match: {
  <E, B, A, C = B>(options: {
    readonly onErr: (error: E) => B
    readonly onOk: (ok: A) => C
  }): (self: Result<A, E>) => B | C
  <A, E, B, C = B>(self: Result<A, E>, options: {
    readonly onErr: (error: E) => B
    readonly onOk: (ok: A) => C
  }): B | C
} = dual(
  2,
  <A, E, B, C = B>(self: Result<A, E>, { onErr, onOk }: {
    readonly onErr: (error: E) => B
    readonly onOk: (ok: A) => C
  }): B | C => isErr(self) ? onErr(self.err) : onOk(self.ok)
)

/**
 * Transforms a `Predicate` function into a `Ok` of the input value if the predicate returns `true`
 * or `Err` of the result of the provided function if the predicate returns false
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { pipe, Result } from "effect"
 *
 * const isPositive = (n: number): boolean => n > 0
 *
 * assert.deepStrictEqual(
 *   pipe(
 *     1,
 *     Result.liftPredicate(isPositive, n => `${n} is not positive`)
 *   ),
 *   Result.ok(1)
 * )
 * assert.deepStrictEqual(
 *   pipe(
 *     0,
 *     Result.liftPredicate(isPositive, n => `${n} is not positive`)
 *   ),
 *   Result.err("0 is not positive")
 * )
 * ```
 *
 * @since 4.0.0
 */
export const liftPredicate: {
  <A, B extends A, E>(
    refinement: Refinement<NoInfer<A>, B>,
    orErrWith: (value: NoInfer<A>) => E
  ): (value: A) => Result<B, E>
  <A, E>(
    predicate: Predicate<NoInfer<A>>,
    orErrWith: (value: NoInfer<A>) => E
  ): (value: A) => Result<A, E>
  <A, E, B extends A>(
    value: A,
    refinement: Refinement<A, B>,
    orErrWith: (value: A) => E
  ): Result<B, E>
  <A, E>(
    value: A,
    predicate: Predicate<NoInfer<A>>,
    orErrWith: (value: NoInfer<A>) => E
  ): Result<A, E>
} = dual(
  3,
  <A, E>(value: A, predicate: Predicate<A>, orErrWith: (value: A) => E): Result<A, E> =>
    predicate(value) ? ok(value) : err(orErrWith(value))
)

/**
 * Filter the right value with the provided function.
 * If the predicate fails, set the left value with the result of the provided function.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { pipe, Result } from "effect"
 *
 * const isPositive = (n: number): boolean => n > 0
 *
 * assert.deepStrictEqual(
 *   pipe(
 *     Result.ok(1),
 *     Result.filterOrErr(isPositive, n => `${n} is not positive`)
 *   ),
 *   Result.ok(1)
 * )
 * assert.deepStrictEqual(
 *   pipe(
 *     Result.ok(0),
 *     Result.filterOrErr(isPositive, n => `${n} is not positive`)
 *   ),
 *   Result.err("0 is not positive")
 * )
 * ```
 *
 * @since 4.0.0
 * @category Filtering
 */
export const filterOrErr: {
  <A, B extends A, E2>(
    refinement: Refinement<NoInfer<A>, B>,
    orErrWith: (value: NoInfer<A>) => E2
  ): <E>(self: Result<A, E>) => Result<B, E2 | E>
  <A, E2>(
    predicate: Predicate<NoInfer<A>>,
    orErrWith: (value: NoInfer<A>) => E2
  ): <E>(self: Result<A, E>) => Result<A, E2 | E>
  <A, E, B extends A, E2>(
    self: Result<A, E>,
    refinement: Refinement<A, B>,
    orErrWith: (value: A) => E2
  ): Result<B, E | E2>
  <A, E, E2>(self: Result<A, E>, predicate: Predicate<A>, orErrWith: (value: A) => E2): Result<A, E | E2>
} = dual(3, <A, E, E2>(
  self: Result<A, E>,
  predicate: Predicate<A>,
  orErrWith: (value: A) => E2
): Result<A, E | E2> => flatMap(self, (a) => predicate(a) ? ok(a) : err(orErrWith(a))))

/**
 * @category Getters
 * @since 4.0.0
 */
export const merge: <A, E>(self: Result<A, E>) => E | A = match({ onErr: identity, onOk: identity })

/**
 * Returns the wrapped value if it's an `Ok` or a default value if is an `Err`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Result } from "effect"
 *
 * assert.deepStrictEqual(Result.getOrElse(Result.ok(1), (error) => error + "!"), 1)
 * assert.deepStrictEqual(Result.getOrElse(Result.err("not a number"), (error) => error + "!"), "not a number!")
 * ```
 *
 * @category Getters
 * @since 4.0.0
 */
export const getOrElse: {
  <E, A2>(onLeft: (err: E) => A2): <A>(self: Result<A, E>) => A2 | A
  <A, E, A2>(self: Result<A, E>, onLeft: (err: E) => A2): A | A2
} = dual(
  2,
  <A, E, A2>(self: Result<A, E>, onLeft: (err: E) => A2): A | A2 => isErr(self) ? onLeft(self.err) : self.ok
)

/**
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Result } from "effect"
 *
 * assert.deepStrictEqual(Result.getOrNull(Result.ok(1)), 1)
 * assert.deepStrictEqual(Result.getOrNull(Result.err("a")), null)
 * ```
 *
 * @category Getters
 * @since 4.0.0
 */
export const getOrNull: <A, E>(self: Result<A, E>) => A | null = getOrElse(constNull)

/**
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Result } from "effect"
 *
 * assert.deepStrictEqual(Result.getOrUndefined(Result.ok(1)), 1)
 * assert.deepStrictEqual(Result.getOrUndefined(Result.err("a")), undefined)
 * ```
 *
 * @category Getters
 * @since 4.0.0
 */
export const getOrUndefined: <A, E>(self: Result<A, E>) => A | undefined = getOrElse(constUndefined)

/**
 * Extracts the value of an `Result` or throws if the `Result` is an `Err`.
 *
 * If a default error is sufficient for your use case and you don't need to configure the thrown error, see {@link getOrThrow}.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Result } from "effect"
 *
 * assert.deepStrictEqual(
 *   Result.getOrThrowWith(Result.ok(1), () => new Error('Unexpected Err')),
 *   1
 * )
 * assert.throws(() => Result.getOrThrowWith(Result.err("error"), () => new Error('Unexpected Err')))
 * ```
 *
 * @category Getters
 * @since 4.0.0
 */
export const getOrThrowWith: {
  <E>(onErr: (err: E) => unknown): <A>(self: Result<A, E>) => A
  <A, E>(self: Result<A, E>, onErr: (err: E) => unknown): A
} = dual(2, <A, E>(self: Result<A, E>, onErr: (err: E) => unknown): A => {
  if (isOk(self)) {
    return self.ok
  }
  throw onErr(self.err)
})

/**
 * Extracts the value of an `Result` or throws if the `Result` is an `Err`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Result } from "effect"
 *
 * assert.deepStrictEqual(Result.getOrThrow(Result.ok(1)), 1)
 * assert.throws(() => Result.getOrThrow(Result.err("error")))
 * ```
 *
 * @throws `E`
 *
 * @category Getters
 * @since 4.0.0
 */
export const getOrThrow: <A, E>(self: Result<A, E>) => A = getOrThrowWith(identity)

/**
 * Returns `self` if it is a `Ok` or `that` otherwise.
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
    isErr(self) ? that(self.err) : ok(self.ok)
)

/**
 * @category Sequencing
 * @since 4.0.0
 */
export const flatMap: {
  <A, A2, E2>(f: (ok: A) => Result<A2, E2>): <E>(self: Result<A, E>) => Result<A2, E | E2>
  <A, E, A2, E2>(self: Result<A, E>, f: (ok: A) => Result<A2, E2>): Result<A2, E | E2>
} = dual(
  2,
  <A, E, A2, E2>(self: Result<A, E>, f: (ok: A) => Result<A2, E2>): Result<A2, E | E2> =>
    isErr(self) ? err(self.err) : f(self.ok)
)

/**
 * Executes a sequence of two `Result`s. The second `Result` can be dependent on the result of the first `Result`.
 *
 * @category Sequencing
 * @since 4.0.0
 */
export const andThen: {
  <A, A2, E2>(f: (ok: A) => Result<A2, E2>): <E>(self: Result<A, E>) => Result<A2, E | E2>
  <A2, E2>(f: Result<A2, E2>): <A, E>(self: Result<A, E>) => Result<A2, E | E2>
  <A, A2>(f: (ok: A) => A2): <E>(self: Result<A, E>) => Result<A2, E>
  <A2>(right: NotFunction<A2>): <A, E>(self: Result<A, E>) => Result<A2, E>
  <A, E, A2, E2>(self: Result<A, E>, f: (ok: A) => Result<A2, E2>): Result<A2, E | E2>
  <A, E, A2, E2>(self: Result<A, E>, f: Result<A2, E2>): Result<A2, E | E2>
  <A, E, A2>(self: Result<A, E>, f: (ok: A) => A2): Result<A2, E>
  <A, E, A2>(self: Result<A, E>, f: NotFunction<A2>): Result<A2, E>
} = dual(
  2,
  <A, E, A2, E2>(
    self: Result<A, E>,
    f: ((ok: A) => Result<A2, E2> | A2) | Result<A2, E2> | A2
  ): Result<A2, E | E2> =>
    flatMap(self, (a) => {
      const out = isFunction(f) ? f(a) : f
      return isResult(out) ? out : ok(out)
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
 * import * as assert from "node:assert"
 * import { Result } from "effect"
 *
 * assert.deepStrictEqual(Result.all([Result.ok(1), Result.ok(2)]), Result.ok([1, 2]))
 * assert.deepStrictEqual(Result.all({ right: Result.ok(1), b: Result.ok("hello") }), Result.ok({ right: 1, b: "hello" }))
 * assert.deepStrictEqual(Result.all({ right: Result.ok(1), b: Result.err("error") }), Result.err("error"))
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
        if (isErr(e)) {
          return e
        }
        out.push(e.ok)
      }
      return ok(out)
    }

    const out: Record<string, any> = {}
    for (const key of Object.keys(input)) {
      const e = input[key]
      if (isErr(e)) {
        return e
      }
      out[key] = e.ok
    }
    return ok(out)
  }

/**
 * Returns an `Result` that swaps the error/success cases. This allows you to
 * use all methods on the error channel, possibly before flipping back.
 *
 * @since 4.0.0
 */
export const flip = <A, E>(self: Result<A, E>): Result<E, A> => isErr(self) ? ok(self.err) : err(self.ok)

const adapter = Gen.adapter<ResultTypeLambda>()

/**
 * @category Generators
 * @since 4.0.0
 */
export const gen: Gen.Gen<ResultTypeLambda, Gen.Adapter<ResultTypeLambda>> = (...args) => {
  const f = args.length === 1 ? args[0] : args[1].bind(args[0])
  const iterator = f(adapter)
  let state: IteratorResult<any> = iterator.next()
  while (!state.done) {
    const current = Gen.isGenKind(state.value)
      ? state.value.value
      : Gen.yieldWrapGet(state.value)
    if (isErr(current)) {
      return current
    }
    state = iterator.next(current.ok as never)
  }
  return ok(state.value) as any
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
 * import * as assert from "node:assert"
 * import { Result, pipe } from "effect"
 *
 * const result = pipe(
 *   Result.Do,
 *   Result.bind("x", () => Result.ok(2)),
 *   Result.bind("y", () => Result.ok(3)),
 *   Result.let("sum", ({ x, y }) => x + y)
 * )
 * assert.deepStrictEqual(result, Result.ok({ x: 2, y: 3, sum: 5 }))
 * ```
 *
 * @category Do Notation
 * @since 4.0.0
 */
export const Do: Result<{}> = ok({})

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
 * import * as assert from "node:assert"
 * import { Result, pipe } from "effect"
 *
 * const result = pipe(
 *   Result.Do,
 *   Result.bind("x", () => Result.ok(2)),
 *   Result.bind("y", () => Result.ok(3)),
 *   Result.let("sum", ({ x, y }) => x + y)
 * )
 * assert.deepStrictEqual(result, Result.ok({ x: 2, y: 3, sum: 5 }))
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
 * import * as assert from "node:assert"
 * import { Result, pipe } from "effect"
 *
 * const result = pipe(
 *   Result.Do,
 *   Result.bind("x", () => Result.ok(2)),
 *   Result.bind("y", () => Result.ok(3)),
 *   Result.let("sum", ({ x, y }) => x + y)
 * )
 * assert.deepStrictEqual(result, Result.ok({ x: 2, y: 3, sum: 5 }))
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
   * import * as assert from "node:assert"
   * import { Result, pipe } from "effect"
   *
   * const result = pipe(
   *   Result.Do,
   *   Result.bind("x", () => Result.ok(2)),
   *   Result.bind("y", () => Result.ok(3)),
   *   Result.let("sum", ({ x, y }) => x + y)
   * )
   * assert.deepStrictEqual(result, Result.ok({ x: 2, y: 3, sum: 5 }))
   *
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
 * will be a `Right` with a `None` value. If the `Option` is `Some`, the
 * inner `Result` will be executed, and its result wrapped in a `Some`.
 *
 * @example
 * ```ts
 * import { Effect, Result, Option } from "effect"
 *
 * //      ┌─── Option<Result<number, never>>
 * //      ▼
 * const maybe = Option.some(Result.ok(42))
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
  return option_.isNone(self) ? ok(option_.none) : map(self.value, option_.some)
}

/**
 * @since 4.0.0
 */
export const none = ok(option_.none)
