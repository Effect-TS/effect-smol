/**
 * This module provides utilities for creating data types with structural equality
 * semantics. Unlike regular JavaScript objects, `Data` types support value-based
 * equality comparison using the `Equal` module.
 *
 * The main benefits of using `Data` types are:
 * - **Structural equality**: Two `Data` objects are equal if their contents are equal
 * - **Immutability**: `Data` types are designed to be immutable
 * - **Type safety**: Constructors ensure type safety and consistency
 * - **Effect integration**: Error types work seamlessly with Effect's error handling
 *
 * @example
 * ```ts
 * import { Equal } from "effect/interfaces"
 * import { Data } from "effect/data"
 *
 * // Basic struct usage
 * const person1 = Data.struct({ name: "Alice", age: 30 })
 * const person2 = Data.struct({ name: "Alice", age: 30 })
 *
 * console.log(Equal.equals(person1, person2)) // true
 * console.log(person1 === person2) // false (different references)
 *
 * // Regular objects don't have structural equality
 * const obj1 = { name: "Alice", age: 30 }
 * const obj2 = { name: "Alice", age: 30 }
 * console.log(Equal.equals(obj1, obj2)) // false
 *
 * // Tagged enums for discriminated unions
 * const { Success, Failure, $match } = Data.taggedEnum<
 *   | { _tag: "Success"; value: number }
 *   | { _tag: "Failure"; error: string }
 * >()
 *
 * const result1 = Success({ value: 42 })
 * const result2 = Failure({ error: "Not found" })
 *
 * // Pattern matching
 * const message = $match(result1, {
 *   Success: ({ value }) => `Got value: ${value}`,
 *   Failure: ({ error }) => `Error: ${error}`
 * })
 * ```
 *
 * @since 2.0.0
 */
import * as Predicate from "../data/Predicate.ts"
import * as core from "../internal/core.ts"
import { StructuralPrototype } from "../internal/core.ts"
import * as internal from "../internal/data.ts"
import type * as Types from "../types/Types.ts"
import type { Unify } from "../types/Unify.ts"
import type * as Cause from "./Cause.ts"

/**
 * A namespace providing utilities for Case constructors.
 *
 * This namespace contains types and utilities for creating case constructors
 * that provide structural equality semantics for data types.
 *
 * @example
 * ```ts
 * import { Data } from "effect/data"
 *
 * interface User {
 *   readonly name: string
 *   readonly age: number
 * }
 *
 * const User = Data.case<User>()
 *
 * const user1 = User({ name: "Alice", age: 30 })
 * const user2 = User({ name: "Alice", age: 30 })
 *
 * // Structural equality
 * console.log(user1 === user2) // false (different references)
 * ```
 *
 * @since 2.0.0
 * @category types
 */
export declare namespace Case {
  /**
   * A constructor type for creating Case instances with structural equality.
   *
   * This type represents a constructor function that takes arguments (excluding
   * the specified tag fields) and returns an instance of type `A` with
   * structural equality semantics.
   *
   * @example
   * ```ts
   * import { Data } from "effect/data"
   *
   * interface User {
   *   readonly name: string
   *   readonly age: number
   * }
   *
   * // Constructor type for User
   * type UserConstructor = Data.Case.Constructor<User>
   * // Type: (args: { readonly name: string; readonly age: number }) => User
   *
   * interface TaggedUser {
   *   readonly _tag: "User"
   *   readonly name: string
   *   readonly age: number
   * }
   *
   * // Constructor type for TaggedUser (excluding _tag field)
   * type TaggedUserConstructor = Data.Case.Constructor<TaggedUser, "_tag">
   * // Type: (args: { readonly name: string; readonly age: number }) => TaggedUser
   * ```
   *
   * @since 2.0.0
   * @category models
   */
  export type Constructor<A, Tag extends keyof A = never> = (
    args: Types.Equals<Omit<A, Tag>, {}> extends true ? void
      : { readonly [P in keyof A as P extends Tag ? never : P]: A[P] }
  ) => A
}

/**
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Equal } from "effect/interfaces"
 * import { Data } from "effect/data"
 *
 * const alice = Data.struct({ name: "Alice", age: 30 })
 *
 * const bob = Data.struct({ name: "Bob", age: 40 })
 *
 * assert.deepStrictEqual(Equal.equals(alice, alice), true)
 * assert.deepStrictEqual(Equal.equals(alice, Data.struct({ name: "Alice", age: 30 })), true)
 *
 * assert.deepStrictEqual(Equal.equals(alice, { name: "Alice", age: 30 }), false)
 * assert.deepStrictEqual(Equal.equals(alice, bob), false)
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const struct: <A extends Record<string, any>>(
  a: A
) => { readonly [P in keyof A]: A[P] } = internal.struct

/**
 * Create a `Data` struct from an object without copying it.
 *
 * **Warning**: This function directly modifies the input object's prototype
 * to enable structural equality without creating a copy. Use `struct` if you
 * need immutability guarantees.
 *
 * @example
 * ```ts
 * import { Equal } from "effect/interfaces"
 * import { Data } from "effect/data"
 *
 * const obj = { name: "Alice", age: 30 }
 * const person = Data.structUnsafe(obj)
 *
 * // obj and person reference the same object
 * console.log(obj === person) // true
 * console.log(Equal.equals(person, Data.struct({ name: "Alice", age: 30 }))) // true
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const structUnsafe = <A extends Record<string, any>>(
  as: A
): { readonly [P in keyof A]: A[P] } => Object.setPrototypeOf(as, StructuralPrototype)

/**
 * Create a `Data` tuple with structural equality from the provided elements.
 *
 * Unlike regular arrays, `Data` tuples support structural equality comparison
 * using the `Equal` module.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Equal } from "effect/interfaces"
 * import { Data } from "effect/data"
 *
 * const alice = Data.tuple("Alice", 30)
 * const bob = Data.tuple("Bob", 40)
 *
 * assert.deepStrictEqual(Equal.equals(alice, alice), true)
 * assert.deepStrictEqual(Equal.equals(alice, Data.tuple("Alice", 30)), true)
 *
 * assert.deepStrictEqual(Equal.equals(alice, ["Alice", 30]), false)
 * assert.deepStrictEqual(Equal.equals(alice, bob), false)
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const tuple = <As extends ReadonlyArray<any>>(...as: As): Readonly<As> => arrayUnsafe(as)

/**
 * Create a `Data` array with structural equality from the provided array.
 *
 * This function creates a copy of the input array and enables structural
 * equality comparison using the `Equal` module.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Equal } from "effect/interfaces"
 * import { Data } from "effect/data"
 *
 * const alice = Data.struct({ name: "Alice", age: 30 })
 * const bob = Data.struct({ name: "Bob", age: 40 })
 *
 * const persons = Data.array([alice, bob])
 *
 * assert.deepStrictEqual(
 *   Equal.equals(
 *     persons,
 *     Data.array([
 *       Data.struct({ name: "Alice", age: 30 }),
 *       Data.struct({ name: "Bob", age: 40 })
 *     ])
 *   ),
 *   true
 * )
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const array = <As extends ReadonlyArray<any>>(as: As): Readonly<As> => arrayUnsafe(as.slice(0) as unknown as As)

/**
 * Create a `Data` array from an array without copying it.
 *
 * **Warning**: This function directly modifies the input array's prototype
 * to enable structural equality without creating a copy. Use `array` if you
 * need immutability guarantees.
 *
 * @example
 * ```ts
 * import { Equal } from "effect/interfaces"
 * import { Data } from "effect/data"
 *
 * const originalArray = [1, 2, 3]
 * const dataArray = Data.arrayUnsafe(originalArray)
 *
 * // originalArray and dataArray reference the same array
 * console.log(originalArray === dataArray) // true
 * console.log(Equal.equals(dataArray, Data.array([1, 2, 3]))) // true
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const arrayUnsafe = <As extends ReadonlyArray<any>>(
  as: As
): Readonly<As> => Object.setPrototypeOf(as, internal.ArrayProto)

const _case = <A>(): Case.Constructor<A> => (args) =>
  (args === undefined
    ? Object.create(StructuralPrototype)
    : struct(args)) as any

export {
  /**
   * Provides a constructor for the specified `Case`.
   *
   * @example
   * ```ts
   * import * as assert from "node:assert"
   * import { Equal } from "effect/interfaces"
   * import { Data } from "effect/data"
   *
   * interface Person {
   *   readonly name: string
   * }
   *
   * // Creating a constructor for the specified Case
   * const Person = Data.case<Person>()
   *
   * // Creating instances of Person
   * const mike1 = Person({ name: "Mike" })
   * const mike2 = Person({ name: "Mike" })
   * const john = Person({ name: "John" })
   *
   * // Checking equality
   * assert.deepStrictEqual(Equal.equals(mike1, mike2), true)
   * assert.deepStrictEqual(Equal.equals(mike1, john), false)
   *
   * ```
   * @since 2.0.0
   * @category constructors
   */
  _case as case
}

/**
 * Provides a tagged constructor for the specified `Case`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Data } from "effect/data"
 *
 * interface Person {
 *   readonly _tag: "Person" // the tag
 *   readonly name: string
 * }
 *
 * const Person = Data.tagged<Person>("Person")
 *
 * const mike = Person({ name: "Mike" })
 *
 * assert.deepEqual(mike, { _tag: "Person", name: "Mike" })
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const tagged = <A extends { readonly _tag: string }>(
  tag: A["_tag"]
): Case.Constructor<A, "_tag"> =>
(args) => {
  const value = args === undefined ? Object.create(StructuralPrototype) : struct(args)
  value._tag = tag
  return value
}

/**
 * Provides a constructor for a Case Class.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Equal } from "effect/interfaces"
 * import { Data } from "effect/data"
 *
 * class Person extends Data.Class<{ readonly name: string }> {}
 *
 * // Creating instances of Person
 * const mike1 = new Person({ name: "Mike" })
 * const mike2 = new Person({ name: "Mike" })
 * const john = new Person({ name: "John" })
 *
 * // Checking equality
 * assert.deepStrictEqual(Equal.equals(mike1, mike2), true)
 * assert.deepStrictEqual(Equal.equals(mike1, john), false)
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const Class: new<A extends Record<string, any> = {}>(
  args: Types.Equals<A, {}> extends true ? void
    : { readonly [P in keyof A]: A[P] }
) => Readonly<A> = internal.Structural as any

/**
 * Provides a Tagged constructor for a Case Class.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Equal } from "effect/interfaces"
 * import { Data } from "effect/data"
 *
 * class Person extends Data.TaggedClass("Person")<{ readonly name: string }> {}
 *
 * // Creating instances of Person
 * const mike1 = new Person({ name: "Mike" })
 * const mike2 = new Person({ name: "Mike" })
 * const john = new Person({ name: "John" })
 *
 * // Checking equality
 * assert.deepStrictEqual(Equal.equals(mike1, mike2), true)
 * assert.deepStrictEqual(Equal.equals(mike1, john), false)
 *
 * assert.deepStrictEqual(mike1._tag, "Person")
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const TaggedClass = <Tag extends string>(
  tag: Tag
): new<A extends Record<string, any> = {}>(
  args: Types.Equals<A, {}> extends true ? void
    : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P] }
) => Readonly<A> & { readonly _tag: Tag } => {
  class Base extends Class<any> {
    readonly _tag = tag
  }
  return Base as any
}

/**
 * A base constructor for creating structural data types.
 *
 * This provides the underlying implementation for creating objects with
 * structural equality semantics.
 *
 * @example
 * ```ts
 * import { Equal } from "effect/interfaces"
 * import { Data } from "effect/data"
 *
 * class Person extends Data.Structural<{ name: string; age: number }> {}
 *
 * const person1 = new Person({ name: "Alice", age: 30 })
 * const person2 = new Person({ name: "Alice", age: 30 })
 *
 * console.log(Equal.equals(person1, person2)) // true
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const Structural: new<A>(
  args: Types.Equals<A, {}> extends true ? void
    : { readonly [P in keyof A]: A[P] }
) => {} = internal.Structural as any

/**
 * Create a tagged enum data type, which is a union of `Data` structs.
 *
 * A `TaggedEnum` transforms a record of variant definitions into a discriminated
 * union type where each variant has a `_tag` field for type discrimination.
 *
 * @example
 * ```ts
 * import { Data } from "effect/data"
 *
 * // Define a tagged enum type
 * type HttpError = Data.TaggedEnum<{
 *   BadRequest: { readonly status: 400; readonly message: string }
 *   NotFound: { readonly status: 404; readonly message: string }
 *   InternalError: { readonly status: 500; readonly details: string }
 * }>
 *
 * // This is equivalent to the union type:
 * type HttpErrorExpanded =
 *   | { readonly _tag: "BadRequest"; readonly status: 400; readonly message: string }
 *   | { readonly _tag: "NotFound"; readonly status: 404; readonly message: string }
 *   | { readonly _tag: "InternalError"; readonly status: 500; readonly details: string }
 *
 * // Usage with constructors
 * const { BadRequest, NotFound, InternalError } = Data.taggedEnum<HttpError>()
 *
 * const error: HttpError = BadRequest({ status: 400, message: "Invalid request" })
 * console.log(error._tag) // "BadRequest"
 * console.log(error.status) // 400
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export type TaggedEnum<
  A extends Record<string, Record<string, any>> & UntaggedChildren<A>
> = keyof A extends infer Tag ? Tag extends keyof A ? Types.Simplify<
      { readonly _tag: Tag } & { readonly [K in keyof A[Tag]]: A[Tag][K] }
    >
  : never
  : never

type ChildrenAreTagged<A> = keyof A extends infer K ? K extends keyof A ? "_tag" extends keyof A[K] ? true
    : false
  : never
  : never

type UntaggedChildren<A> = true extends ChildrenAreTagged<A>
  ? "It looks like you're trying to create a tagged enum, but one or more of its members already has a `_tag` property."
  : unknown

/**
 * A namespace providing utilities for TaggedEnum types.
 *
 * This namespace contains types and utilities for working with tagged enums,
 * which are discriminated unions with structural equality semantics.
 *
 * @example
 * ```ts
 * import { Data } from "effect/data"
 *
 * // Basic tagged enum usage
 * const { Success, Failure } = Data.taggedEnum<
 *   | { readonly _tag: "Success"; readonly value: number }
 *   | { readonly _tag: "Failure"; readonly error: string }
 * >()
 *
 * const result = Success({ value: 42 })
 * console.log(result._tag) // "Success"
 * console.log(result.value) // 42
 * ```
 *
 * @since 2.0.0
 * @category types
 */
export declare namespace TaggedEnum {
  /**
   * A type-level helper for tagged enums that support generic type parameters.
   * This interface is used to define the structure of tagged enum definitions
   * that can accept generic type parameters.
   *
   * @example
   * ```ts
   * import { Data } from "effect/data"
   *
   * // Define a tagged enum with generic parameters
   * interface MyTaggedEnum<A, B> extends Data.TaggedEnum.WithGenerics<2> {
   *   readonly taggedEnum:
   *     | { readonly _tag: "Success"; readonly value: A }
   *     | { readonly _tag: "Failure"; readonly error: B }
   * }
   *
   * // The number of generics is tracked in the type
   * type NumGenerics = MyTaggedEnum<string, Error>["numberOfGenerics"] // 2
   * ```
   *
   * @since 2.0.0
   * @category models
   */
  export interface WithGenerics<Count extends number> {
    readonly taggedEnum: { readonly _tag: string }
    readonly numberOfGenerics: Count

    readonly A: unknown
    readonly B: unknown
    readonly C: unknown
    readonly D: unknown
  }

  /**
   * Utility type for applying generic type parameters to a tagged enum definition.
   *
   * This type takes a `WithGenerics` definition and applies the provided type
   * parameters to create a concrete tagged enum type.
   *
   * @example
   * ```ts
   * import { Data } from "effect/data"
   *
   * // Define a generic Option type
   * type Option<A> = Data.TaggedEnum<{
   *   None: {}
   *   Some: { readonly value: A }
   * }>
   *
   * interface OptionDefinition extends Data.TaggedEnum.WithGenerics<1> {
   *   readonly taggedEnum: Option<this["A"]>
   * }
   *
   * // Apply specific type to get concrete type
   * type StringOption = Data.TaggedEnum.Kind<OptionDefinition, string>
   * // Result: { readonly _tag: "None" } | { readonly _tag: "Some"; readonly value: string }
   *
   * type NumberOption = Data.TaggedEnum.Kind<OptionDefinition, number>
   * // Result: { readonly _tag: "None" } | { readonly _tag: "Some"; readonly value: number }
   *
   * // Usage in type-safe functions
   * const processOption = (opt: StringOption): string => {
   *   switch (opt._tag) {
   *     case "None":
   *       return "No value"
   *     case "Some":
   *       return `Value: ${opt.value}`
   *   }
   * }
   * ```
   *
   * @since 2.0.0
   * @category models
   */
  export type Kind<
    Z extends WithGenerics<number>,
    A = unknown,
    B = unknown,
    C = unknown,
    D = unknown
  > = (Z & {
    readonly A: A
    readonly B: B
    readonly C: C
    readonly D: D
  })["taggedEnum"]

  /**
   * Extracts the argument types for a tagged enum constructor.
   *
   * This utility type extracts the required arguments for constructing
   * a specific variant of a tagged enum, excluding the `_tag` field.
   *
   * @example
   * ```ts
   * import { Data } from "effect/data"
   *
   * type Result =
   *   | { readonly _tag: "Success"; readonly value: number }
   *   | { readonly _tag: "Failure"; readonly error: string }
   *
   * // Extract arguments for Success variant
   * type SuccessArgs = Data.TaggedEnum.Args<Result, "Success">
   * // Result: { readonly value: number }
   *
   * // Extract arguments for Failure variant
   * type FailureArgs = Data.TaggedEnum.Args<Result, "Failure">
   * // Result: { readonly error: string }
   * ```
   *
   * @since 2.0.0
   * @category types
   */
  export type Args<
    A extends { readonly _tag: string },
    K extends A["_tag"],
    E = Extract<A, { readonly _tag: K }>
  > = {
    readonly [K in keyof E as K extends "_tag" ? never : K]: E[K]
  } extends infer T ? {} extends T ? void
    : T
    : never

  /**
   * Extracts the complete value type for a tagged enum variant.
   *
   * This utility type extracts the full type (including the `_tag` field)
   * for a specific variant of a tagged enum.
   *
   * @example
   * ```ts
   * import { Data } from "effect/data"
   *
   * type Result =
   *   | { readonly _tag: "Success"; readonly value: number }
   *   | { readonly _tag: "Failure"; readonly error: string }
   *
   * // Extract complete Success type
   * type SuccessValue = Data.TaggedEnum.Value<Result, "Success">
   * // Result: { readonly _tag: "Success"; readonly value: number }
   *
   * // Extract complete Failure type
   * type FailureValue = Data.TaggedEnum.Value<Result, "Failure">
   * // Result: { readonly _tag: "Failure"; readonly error: string }
   * ```
   *
   * @since 2.0.0
   * @category types
   */
  export type Value<
    A extends { readonly _tag: string },
    K extends A["_tag"]
  > = Extract<A, { readonly _tag: K }>

  /**
   * Provides a complete constructor interface for tagged enums.
   *
   * This type creates a constructor object that includes:
   * - Individual constructors for each variant
   * - `$is` for type predicates
   * - `$match` for pattern matching
   *
   * @example
   * ```ts
   * import { Data } from "effect/data"
   *
   * type HttpError =
   *   | { readonly _tag: "BadRequest"; readonly message: string }
   *   | { readonly _tag: "NotFound"; readonly resource: string }
   *
   * const { BadRequest, NotFound, $is, $match } = Data.taggedEnum<HttpError>()
   *
   * const error = BadRequest({ message: "Invalid input" })
   *
   * // Type predicate
   * if ($is("BadRequest")(error)) {
   *   console.log(error.message) // TypeScript knows this is BadRequest
   * }
   *
   * // Pattern matching
   * const result = $match(error, {
   *   BadRequest: ({ message }) => `Bad request: ${message}`,
   *   NotFound: ({ resource }) => `Not found: ${resource}`
   * })
   * ```
   *
   * @since 3.1.0
   * @category types
   */
  export type Constructor<A extends { readonly _tag: string }> = Types.Simplify<
    {
      readonly [Tag in A["_tag"]]: Case.Constructor<
        Extract<A, { readonly _tag: Tag }>,
        "_tag"
      >
    } & {
      readonly $is: <Tag extends A["_tag"]>(
        tag: Tag
      ) => (u: unknown) => u is Extract<A, { readonly _tag: Tag }>
      readonly $match: {
        <
          Cases extends {
            readonly [Tag in A["_tag"]]: (
              args: Extract<A, { readonly _tag: Tag }>
            ) => any
          }
        >(
          cases: Cases
        ): (value: A) => Unify<ReturnType<Cases[A["_tag"]]>>
        <
          Cases extends {
            readonly [Tag in A["_tag"]]: (
              args: Extract<A, { readonly _tag: Tag }>
            ) => any
          }
        >(
          value: A,
          cases: Cases
        ): Unify<ReturnType<Cases[A["_tag"]]>>
      }
    }
  >

  /**
   * Provides type-safe pattern matching for generic tagged enums.
   *
   * This interface provides `$is` and `$match` utilities for tagged enums
   * that use generics, ensuring type safety across different generic instantiations.
   *
   * @example
   * ```ts
   * import { Data } from "effect/data"
   *
   * type Result<E, A> = Data.TaggedEnum<{
   *   Failure: { readonly error: E }
   *   Success: { readonly value: A }
   * }>
   *
   * interface ResultDefinition extends Data.TaggedEnum.WithGenerics<2> {
   *   readonly taggedEnum: Result<this["A"], this["B"]>
   * }
   *
   * const { Failure, Success, $is, $match } = Data.taggedEnum<ResultDefinition>()
   *
   * const stringResult = Success({ value: "hello" })
   * const numberResult = Failure({ error: 404 })
   *
   * // Generic type checking
   * if ($is("Success")(stringResult)) {
   *   console.log(stringResult.value) // TypeScript knows this is string
   * }
   *
   * // Generic pattern matching
   * const message = $match(numberResult, {
   *   Success: ({ value }) => `Value: ${value}`,
   *   Failure: ({ error }) => `Error: ${error}`
   * })
   * ```
   *
   * @since 3.2.0
   * @category types
   */
  export interface GenericMatchers<Z extends WithGenerics<number>> {
    readonly $is: <Tag extends Z["taggedEnum"]["_tag"]>(
      tag: Tag
    ) => {
      <T extends TaggedEnum.Kind<Z, any, any, any, any>>(
        u: T
      ): u is T & { readonly _tag: Tag }
      (u: unknown): u is Extract<TaggedEnum.Kind<Z>, { readonly _tag: Tag }>
    }
    readonly $match: {
      <
        A,
        B,
        C,
        D,
        Cases extends {
          readonly [Tag in Z["taggedEnum"]["_tag"]]: (
            args: Extract<
              TaggedEnum.Kind<Z, A, B, C, D>,
              { readonly _tag: Tag }
            >
          ) => any
        }
      >(
        cases: Cases
      ): (
        self: TaggedEnum.Kind<Z, A, B, C, D>
      ) => Unify<ReturnType<Cases[Z["taggedEnum"]["_tag"]]>>
      <
        A,
        B,
        C,
        D,
        Cases extends {
          readonly [Tag in Z["taggedEnum"]["_tag"]]: (
            args: Extract<
              TaggedEnum.Kind<Z, A, B, C, D>,
              { readonly _tag: Tag }
            >
          ) => any
        }
      >(
        self: TaggedEnum.Kind<Z, A, B, C, D>,
        cases: Cases
      ): Unify<ReturnType<Cases[Z["taggedEnum"]["_tag"]]>>
    }
  }
}

/**
 * Create a constructor for a tagged union of `Data` structs.
 *
 * You can also pass a `TaggedEnum.WithGenerics` if you want to add generics to
 * the constructor.
 *
 * @example
 * ```ts
 * import { Data } from "effect/data"
 *
 * const { BadRequest, NotFound } = Data.taggedEnum<
 *   | { readonly _tag: "BadRequest"; readonly status: 400; readonly message: string }
 *   | { readonly _tag: "NotFound"; readonly status: 404; readonly message: string }
 * >()
 *
 * const notFound = NotFound({ status: 404, message: "Not Found" })
 * ```
 *
 * @example
 * import { Data } from "effect/data"
 *
 * type MyResult<E, A> = Data.TaggedEnum<{
 *   Failure: { readonly error: E }
 *   Success: { readonly value: A }
 * }>
 * interface MyResultDefinition extends Data.TaggedEnum.WithGenerics<2> {
 *   readonly taggedEnum: MyResult<this["A"], this["B"]>
 * }
 * const { Failure, Success } = Data.taggedEnum<MyResultDefinition>()
 *
 * const success = Success({ value: 1 })
 *
 * @category constructors
 * @since 2.0.0
 */
export const taggedEnum: {
  <Z extends TaggedEnum.WithGenerics<1>>(): Types.Simplify<
    {
      readonly [Tag in Z["taggedEnum"]["_tag"]]: <A>(
        args: TaggedEnum.Args<
          TaggedEnum.Kind<Z, A>,
          Tag,
          Extract<TaggedEnum.Kind<Z, A>, { readonly _tag: Tag }>
        >
      ) => TaggedEnum.Value<TaggedEnum.Kind<Z, A>, Tag>
    } & TaggedEnum.GenericMatchers<Z>
  >

  <Z extends TaggedEnum.WithGenerics<2>>(): Types.Simplify<
    {
      readonly [Tag in Z["taggedEnum"]["_tag"]]: <A, B>(
        args: TaggedEnum.Args<
          TaggedEnum.Kind<Z, A, B>,
          Tag,
          Extract<TaggedEnum.Kind<Z, A, B>, { readonly _tag: Tag }>
        >
      ) => TaggedEnum.Value<TaggedEnum.Kind<Z, A, B>, Tag>
    } & TaggedEnum.GenericMatchers<Z>
  >

  <Z extends TaggedEnum.WithGenerics<3>>(): Types.Simplify<
    {
      readonly [Tag in Z["taggedEnum"]["_tag"]]: <A, B, C>(
        args: TaggedEnum.Args<
          TaggedEnum.Kind<Z, A, B, C>,
          Tag,
          Extract<TaggedEnum.Kind<Z, A, B, C>, { readonly _tag: Tag }>
        >
      ) => TaggedEnum.Value<TaggedEnum.Kind<Z, A, B, C>, Tag>
    } & TaggedEnum.GenericMatchers<Z>
  >

  <Z extends TaggedEnum.WithGenerics<4>>(): Types.Simplify<
    {
      readonly [Tag in Z["taggedEnum"]["_tag"]]: <A, B, C, D>(
        args: TaggedEnum.Args<
          TaggedEnum.Kind<Z, A, B, C, D>,
          Tag,
          Extract<TaggedEnum.Kind<Z, A, B, C, D>, { readonly _tag: Tag }>
        >
      ) => TaggedEnum.Value<TaggedEnum.Kind<Z, A, B, C, D>, Tag>
    } & TaggedEnum.GenericMatchers<Z>
  >

  <A extends { readonly _tag: string }>(): TaggedEnum.Constructor<A>
} = () =>
  new Proxy(
    {},
    {
      get(_target, tag, _receiver) {
        if (tag === "$is") {
          return Predicate.isTagged
        } else if (tag === "$match") {
          return taggedMatch
        }
        return tagged(tag as string)
      }
    }
  ) as any

function taggedMatch<
  A extends { readonly _tag: string },
  Cases extends {
    readonly [K in A["_tag"]]: (args: Extract<A, { readonly _tag: K }>) => any
  }
>(self: A, cases: Cases): ReturnType<Cases[A["_tag"]]>
function taggedMatch<
  A extends { readonly _tag: string },
  Cases extends {
    readonly [K in A["_tag"]]: (args: Extract<A, { readonly _tag: K }>) => any
  }
>(cases: Cases): (value: A) => ReturnType<Cases[A["_tag"]]>
function taggedMatch<
  A extends { readonly _tag: string },
  Cases extends {
    readonly [K in A["_tag"]]: (args: Extract<A, { readonly _tag: K }>) => any
  }
>(): any {
  if (arguments.length === 1) {
    const cases = arguments[0] as Cases
    return function(value: A): ReturnType<Cases[A["_tag"]]> {
      return cases[value._tag as A["_tag"]](value as any)
    }
  }
  const value = arguments[0] as A
  const cases = arguments[1] as Cases
  return cases[value._tag as A["_tag"]](value as any)
}

/**
 * Create a structured error constructor that supports Effect's error handling.
 *
 * This constructor creates errors that are both `Cause.YieldableError` (can be
 * yielded in Effect generators) and have structural equality semantics.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Data, Exit } from "effect/data"

 *
 * class NetworkError extends Data.Error<{ code: number; message: string }> {}
 *
 * const program = Effect.gen(function* () {
 *   yield* new NetworkError({ code: 500, message: "Server error" })
 * })
 *
 * Effect.runSync(Effect.exit(program))
 * // Exit.fail(NetworkError({ code: 500, message: "Server error" }))
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const Error: new<A extends Record<string, any> = {}>(
  args: Types.Equals<A, {}> extends true ? void
    : { readonly [P in keyof A]: A[P] }
) => Cause.YieldableError & Readonly<A> = core.Error

/**
 * Create a tagged error constructor with a specific tag for discriminated unions.
 *
 * This constructor creates errors with a `_tag` property that are both
 * `Cause.YieldableError` and have structural equality semantics.
 *
 * @example
 * ```ts
 * import { Effect, pipe } from "effect"
 * import { Data } from "effect/data"
 *
 * class NetworkError extends Data.TaggedError("NetworkError")<{
 *   code: number
 *   message: string
 * }> {}
 *
 * class ValidationError extends Data.TaggedError("ValidationError")<{
 *   field: string
 *   message: string
 * }> {}
 *
 * const program = Effect.gen(function* () {
 *   yield* new NetworkError({ code: 500, message: "Server error" })
 * })
 *
 * const result = pipe(
 *   program,
 *   Effect.catchTag("NetworkError", (error) =>
 *     Effect.succeed(`Network error: ${error.message}`)
 *   )
 * )
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const TaggedError: <Tag extends string>(
  tag: Tag
) => new<A extends Record<string, any> = {}>(
  args: Types.Equals<A, {}> extends true ? void
    : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P] }
) => Cause.YieldableError & { readonly _tag: Tag } & Readonly<A> = core.TaggedError as any
