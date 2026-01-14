/**
 * A collection of types that are commonly used types.
 *
 * @since 2.0.0
 */

type TupleOf_<T, N extends number, R extends Array<unknown>> = `${N}` extends `-${number}` ? never
  : R["length"] extends N ? R
  : TupleOf_<T, N, [T, ...R]>

/**
 * Represents a tuple with a fixed number of elements of type `T`.
 *
 * This type constructs a tuple that has exactly `N` elements of type `T`.
 *
 * @typeParam N - The number of elements in the tuple.
 * @typeParam T - The type of elements in the tuple.
 *
 * @example
 * ```ts
 * import type { TupleOf } from "effect/Types"
 *
 * // A tuple with exactly 3 numbers
 * const example1: TupleOf<3, number> = [1, 2, 3] // valid
 * // @ts-expect-error
 * const example2: TupleOf<3, number> = [1, 2] // invalid
 * // @ts-expect-error
 * const example3: TupleOf<3, number> = [1, 2, 3, 4] // invalid
 * ```
 *
 * @category tuples
 * @since 3.3.0
 */
export type TupleOf<N extends number, T> = N extends N ? number extends N ? Array<T> : TupleOf_<T, N, []> : never

/**
 * Represents a tuple with at least `N` elements of type `T`.
 *
 * This type constructs a tuple that has a fixed number of elements `N` of type `T` at the start,
 * followed by any number (including zero) of additional elements of the same type `T`.
 *
 * @typeParam N - The minimum number of elements in the tuple.
 * @typeParam T - The type of elements in the tuple.
 *
 * @example
 * ```ts
 * import type { TupleOfAtLeast } from "effect/Types"
 *
 * // A tuple with at least 3 numbers
 * const example1: TupleOfAtLeast<3, number> = [1, 2, 3] // valid
 * const example2: TupleOfAtLeast<3, number> = [1, 2, 3, 4, 5] // valid
 * // @ts-expect-error
 * const example3: TupleOfAtLeast<3, number> = [1, 2] // invalid
 * ```
 *
 * @category tuples
 * @since 3.3.0
 */
export type TupleOfAtLeast<N extends number, T> = [...TupleOf<N, T>, ...Array<T>]

/**
 * Returns the tags in a type.
 * @example
 * ```ts
 * import type * as Types from "effect/Types"
 *
 * type Res = Types.Tags<string | { _tag: "a" } | { _tag: "b" }> // "a" | "b"
 * ```
 *
 * @category types
 * @since 2.0.0
 */
export type Tags<E> = E extends { readonly _tag: string } ? E["_tag"] : never

/**
 * Excludes the tagged object from the type.
 * @example
 * ```ts
 * import type * as Types from "effect/Types"
 *
 * type Res = Types.ExcludeTag<string | { _tag: "a" } | { _tag: "b" }, "a"> // string | { _tag: "b" }
 * ```
 *
 * @category types
 * @since 2.0.0
 */
export type ExcludeTag<E, K extends string> = Exclude<E, { readonly _tag: K }>

/**
 * Extracts the type of the given tag.
 *
 * @example
 * ```ts
 * import type * as Types from "effect/Types"
 *
 * type Res = Types.ExtractTag<
 *   { _tag: "a"; a: number } | { _tag: "b"; b: number },
 *   "b"
 * > // { _tag: "b", b: number }
 * ```
 *
 * @category types
 * @since 2.0.0
 */
export type ExtractTag<E, K extends string> = Extract<E, { readonly _tag: K }>

/**
 * A utility type that transforms a union type `T` into an intersection type.
 *
 * @example
 * ```ts
 * import type * as Types from "effect/Types"
 *
 * type Union = { a: string } | { b: number }
 * type Intersection = Types.UnionToIntersection<Union> // { a: string } & { b: number }
 * ```
 *
 * @since 2.0.0
 * @category types
 */
export type UnionToIntersection<T> = (T extends any ? (x: T) => any : never) extends (x: infer R) => any ? R
  : never

/**
 * Simplifies the type signature of a type.
 *
 * @example
 * ```ts
 * import type * as Types from "effect/Types"
 *
 * type Res = Types.Simplify<{ a: number } & { b: number }> // { a: number; b: number; }
 * ```
 *
 * @since 2.0.0
 * @category types
 */
export type Simplify<A> = {
  [K in keyof A]: A[K]
} extends infer B ? B : never

/**
 * Determines if two types are equal.
 *
 * @example
 * ```ts
 * import type * as Types from "effect/Types"
 *
 * type Res1 = Types.Equals<{ a: number }, { a: number }> // true
 * type Res2 = Types.Equals<{ a: number }, { b: number }> // false
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export type Equals<X, Y> = (<T>() => T extends X ? 1 : 2) extends <
  T
>() => T extends Y ? 1 : 2 ? true
  : false

/**
 * Determines if two types are equal, allowing to specify the return types.
 *
 * @example
 * ```ts
 * import type * as Types from "effect/Types"
 *
 * type Result1 = Types.EqualsWith<string, string, "yes", "no"> // "yes"
 * type Result2 = Types.EqualsWith<string, number, "yes", "no"> // "no"
 * ```
 *
 * @since 3.15.0
 * @category models
 */
export type EqualsWith<A, B, Y, N> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? Y : N

/**
 * Determines if a record contains any of the given keys.
 *
 * @example
 * ```ts
 * import type * as Types from "effect/Types"
 *
 * type Res1 = Types.Has<{ a: number }, "a" | "b"> // true
 * type Res2 = Types.Has<{ c: number }, "a" | "b"> // false
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export type Has<A, Key extends string> = (Key extends infer K ? K extends keyof A ? true : never : never) extends never
  ? false
  : true

/**
 * Merges two object where the keys of the left object take precedence in the case of a conflict.
 *
 * @example
 * ```ts
 * import type * as Types from "effect/Types"
 *
 * type MergeLeft = Types.MergeLeft<{ a: number; b: number }, { a: string }> // { a: number; b: number; }
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export type MergeLeft<Source, Target> = MergeRight<Target, Source>

/**
 * Merges two object where the keys of the right object take precedence in the case of a conflict.
 *
 * @example
 * ```ts
 * import type * as Types from "effect/Types"
 *
 * type MergeRight = Types.MergeRight<{ a: number; b: number }, { a: string }> // { a: string; b: number; }
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export type MergeRight<Target, Source> = Simplify<
  & Source
  & {
    [Key in keyof Target as Key extends keyof Source ? never : Key]: Target[Key]
  }
>

/**
 * Merges two object where the keys of the left object take precedence in the case of a conflict.
 *
 * @example
 * ```ts
 * import type * as Types from "effect/Types"
 *
 * type Result = Types.MergeRecord<
 *   { a: number; b: number },
 *   { a: string; c: boolean }
 * > // { a: number; b: number; c: boolean }
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export type MergeRecord<Source, Target> = MergeLeft<Source, Target>

/**
 * Describes the concurrency to use when executing multiple Effect's.
 *
 * @example
 * ```ts
 * import type * as Types from "effect/Types"
 *
 * const unbounded: Types.Concurrency = "unbounded"
 * const inherit: Types.Concurrency = "inherit"
 * const limited: Types.Concurrency = 5
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export type Concurrency = number | "unbounded" | "inherit"

/**
 * Make all properties in `T` mutable. Supports arrays, tuples, and records as well.
 *
 * @example
 * ```ts
 * import type * as Types from "effect/Types"
 *
 * type MutableStruct = Types.Mutable<{ readonly a: string; readonly b: number }> // { a: string; b: number; }
 *
 * type MutableArray = Types.Mutable<ReadonlyArray<string>> // string[]
 *
 * type MutableTuple = Types.Mutable<readonly [string, number]> // [string, number]
 *
 * type MutableRecord = Types.Mutable<{ readonly [_: string]: number }> // { [x: string]: number; }
 * ```
 *
 * @since 2.0.0
 * @category types
 */
export type Mutable<T> = {
  -readonly [P in keyof T]: T[P]
}

/**
 * Like `Types.Mutable`, but works recursively.
 *
 * @example
 * ```ts
 * import type * as Types from "effect/Types"
 *
 * type DeepMutableStruct = Types.DeepMutable<{
 *   readonly a: string
 *   readonly b: ReadonlyArray<string>
 * }>
 * // { a: string; b: string[] }
 * ```
 *
 * @since 3.1.0
 * @category types
 */
export type DeepMutable<T> = T extends ReadonlyMap<infer K, infer V> ? Map<DeepMutable<K>, DeepMutable<V>>
  : T extends ReadonlySet<infer V> ? Set<DeepMutable<V>>
  : T extends string | number | boolean | bigint | symbol | Function ? T
  : { -readonly [K in keyof T]: DeepMutable<T[K]> }

/**
 * Avoid inference on a specific parameter
 *
 * @example
 * ```ts
 * import type * as Types from "effect/Types"
 *
 * declare function fn<T>(value: T, noInfer: Types.NoInfer<T>): T
 *
 * // T is inferred as "hello" from the first parameter
 * // The second parameter must also be "hello" due to NoInfer
 * const result = fn("hello", "hello") // T = "hello"
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export type NoInfer<A> = [A][A extends any ? 0 : never]

/**
 * Invariant helper.
 *
 * @example
 * ```ts
 * import type * as Types from "effect/Types"
 *
 * // Invariant type for phantom types
 * type UserId = Types.Invariant<string>
 * type UserName = Types.Invariant<string>
 *
 * // These are now distinct types even though they wrap the same type
 * declare const userId: UserId
 * declare const userName: UserName
 *
 * // This would be a type error if using proper branded types
 * // Invariant alone doesn't prevent assignability in this example
 * const invalid: UserId = userName
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export type Invariant<A> = (_: A) => A

/**
 * @example
 * ```ts
 * import type * as Types from "effect/Types"
 *
 * type MyInvariant = Types.Invariant<number>
 * type ExtractedType = Types.Invariant.Type<MyInvariant> // number
 * ```
 *
 * @since 3.9.0
 * @category models
 */
export declare namespace Invariant {
  /**
   * @example
   * ```ts
   * import type * as Types from "effect/Types"
   *
   * type MyInvariant = Types.Invariant<number>
   * type ExtractedType = Types.Invariant.Type<MyInvariant> // number
   * ```
   *
   * @since 3.9.0
   * @category models
   */
  export type Type<A> = A extends Invariant<infer U> ? U : never
}

/**
 * Covariant helper.
 *
 * @example
 * ```ts
 * import type * as Types from "effect/Types"
 *
 * // Covariant type for producer types
 * type Producer<T> = Types.Covariant<T>
 * type StringProducer = Producer<string>
 * type ValueProducer = Producer<string | number>
 *
 * // Covariance allows assignment from more specific to less specific
 * const producer: ValueProducer = undefined as any as StringProducer
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export type Covariant<A> = (_: never) => A

/**
 * @example
 * ```ts
 * import type * as Types from "effect/Types"
 *
 * type MyCovariant = Types.Covariant<string>
 * type ExtractedType = Types.Covariant.Type<MyCovariant> // string
 * ```
 *
 * @since 3.9.0
 * @category models
 */
export declare namespace Covariant {
  /**
   * @example
   * ```ts
   * import type * as Types from "effect/Types"
   *
   * type MyCovariant = Types.Covariant<string>
   * type ExtractedType = Types.Covariant.Type<MyCovariant> // string
   * ```
   *
   * @since 3.9.0
   * @category models
   */
  export type Type<A> = A extends Covariant<infer U> ? U : never
}

/**
 * Contravariant helper.
 *
 * @example
 * ```ts
 * import type * as Types from "effect/Types"
 *
 * // Contravariant type for consumer types
 * type Consumer<T> = Types.Contravariant<T>
 * type StringConsumer = Consumer<string>
 * type ValueConsumer = Consumer<string | number>
 *
 * // Contravariance allows assignment from less specific to more specific
 * const consumer: StringConsumer = undefined as any as ValueConsumer
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export type Contravariant<A> = (_: A) => void

/**
 * @example
 * ```ts
 * import type * as Types from "effect/Types"
 *
 * type MyContravariant = Types.Contravariant<string>
 * type ExtractedType = Types.Contravariant.Type<MyContravariant> // string
 * ```
 *
 * @since 3.9.0
 * @category models
 */
export declare namespace Contravariant {
  /**
   * @example
   * ```ts
   * import type * as Types from "effect/Types"
   *
   * type MyContravariant = Types.Contravariant<string>
   * type ExtractedType = Types.Contravariant.Type<MyContravariant> // string
   * ```
   *
   * @since 3.9.0
   * @category models
   */
  export type Type<A> = A extends Contravariant<infer U> ? U : never
}

/**
 * A utility type that checks if a type `S` is an empty object and returns different types based on the result.
 *
 * @example
 * ```ts
 * import type * as Types from "effect/Types"
 *
 * type EmptyResult = Types.MatchRecord<{}, "empty", "not empty"> // "empty"
 * type NonEmptyResult = Types.MatchRecord<{ a: number }, "empty", "not empty"> // "not empty"
 * ```
 *
 * @since 2.0.0
 * @category types
 */
export type MatchRecord<S, onTrue, onFalse> = {} extends S ? onTrue : onFalse

/**
 * A utility type that excludes function types from a union.
 *
 * @example
 * ```ts
 * import type * as Types from "effect/Types"
 *
 * type Result = Types.NotFunction<string | number | (() => void)> // string | number
 * type NoFunctions = Types.NotFunction<string> // string
 * type Empty = Types.NotFunction<() => void> // never
 * ```
 *
 * @since 2.0.0
 * @category types
 */
export type NotFunction<T> = T extends Function ? never : T

/**
 * A utility type that prevents excess properties in object types.
 *
 * @example
 * ```ts
 * import type * as Types from "effect/Types"
 *
 * type Expected = { a: number; b: string }
 * type Input = { a: number; b: string; c: boolean }
 *
 * type Result = Types.NoExcessProperties<Expected, Input>
 * // Result: { a: number; b: string; readonly c: never }
 * ```
 *
 * @since 3.9.0
 * @category types
 */
export type NoExcessProperties<T, U> = T & Readonly<Record<Exclude<keyof U, keyof T>, never>>

/**
 * @since 4.0.0
 * @category types
 */
export interface unassigned {
  readonly _: unique symbol
}

/**
 * @since 4.0.0
 * @category types
 */
export interface unhandled {
  readonly _: unique symbol
}

/**
 * @since 4.0.0
 * @category types
 */
export type IsUnion<T> = [T] extends [UnionToIntersection<T>] ? false : true

/**
 * Extracts the reason type from an error that has a `reason` field.
 * @example
 * ```ts
 * import type * as Types from "effect/Types"
 *
 * type RateLimitError = { readonly _tag: "RateLimitError"; readonly retryAfter: number }
 * type QuotaError = { readonly _tag: "QuotaError"; readonly limit: number }
 * type AiError = { readonly _tag: "AiError"; readonly reason: RateLimitError | QuotaError }
 *
 * type Res = Types.ReasonOf<AiError>
 * // RateLimitError | QuotaError
 * ```
 *
 * @since 4.0.0
 * @category types
 */
export type ReasonOf<E> = E extends { readonly reason: infer R } ? R : never

/**
 * Extracts the `_tag` values from nested reason types.
 * @example
 * ```ts
 * import type * as Types from "effect/Types"
 *
 * type RateLimitError = { readonly _tag: "RateLimitError"; readonly retryAfter: number }
 * type QuotaError = { readonly _tag: "QuotaError"; readonly limit: number }
 * type AiError = { readonly _tag: "AiError"; readonly reason: RateLimitError | QuotaError }
 *
 * type Res = Types.ReasonTags<AiError>
 * // "RateLimitError" | "QuotaError"
 * ```
 *
 * @since 4.0.0
 * @category types
 */
export type ReasonTags<E> = E extends { readonly reason: { readonly _tag: string } } ? E["reason"]["_tag"]
  : never

/**
 * Extracts a specific reason variant by its `_tag`.
 * @example
 * ```ts
 * import type * as Types from "effect/Types"
 *
 * type RateLimitError = { readonly _tag: "RateLimitError"; readonly retryAfter: number }
 * type QuotaError = { readonly _tag: "QuotaError"; readonly limit: number }
 * type AiError = { readonly _tag: "AiError"; readonly reason: RateLimitError | QuotaError }
 *
 * type Res = Types.ExtractReason<AiError, "RateLimitError">
 * // { readonly _tag: "RateLimitError"; readonly retryAfter: number }
 * ```
 *
 * @since 4.0.0
 * @category types
 */
export type ExtractReason<E, K extends string> = E extends { readonly reason: infer R }
  ? Extract<R, { readonly _tag: K }>
  : never
