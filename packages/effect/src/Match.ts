/**
 * The `effect/match` module provides a type-safe pattern matching system for
 * TypeScript. Inspired by functional programming, it simplifies conditional
 * logic by replacing verbose if/else or switch statements with a structured and
 * expressive API.
 *
 * This module supports matching against types, values, and discriminated unions
 * while enforcing exhaustiveness checking to ensure all cases are handled.
 *
 * Although pattern matching is not yet a native JavaScript feature,
 * `effect/match` offers a reliable implementation that is available today.
 *
 * **How Pattern Matching Works**
 *
 * Pattern matching follows a structured process:
 *
 * - **Creating a matcher**: Define a `Matcher` that operates on either a
 *   specific `Match.type` or `Match.value`.
 *
 * - **Defining patterns**: Use combinators such as `Match.when`, `Match.not`,
 *   and `Match.tag` to specify matching conditions.
 *
 * - **Completing the match**: Apply a finalizer such as `Match.exhaustive`,
 *   `Match.orElse`, or `Match.option` to determine how unmatched cases should
 *   be handled.
 *
 * @since 4.0.0
 */
import * as internal from "./internal/matcher.ts"
import type * as Option from "./Option.ts"
import type { Pipeable } from "./Pipeable.ts"
import * as Predicate from "./Predicate.ts"
import type * as Result from "./Result.ts"
import type * as T from "./Types.ts"
import type { Unify } from "./Unify.ts"

/**
 * Unique identifier for `Matcher` instances.
 *
 * This symbol serves as a type brand to distinguish `Matcher` objects from other values
 * and enables TypeScript to provide better type checking and IntelliSense support.
 *
 * @example
 * ```ts
 * import { Match } from "effect"
 *
 * // The MatcherTypeId is used internally for type checking
 * const matcher = Match.type<string | number>()
 *
 * // TypeScript can detect if something is a Matcher using this symbol
 * console.log(Match.MatcherTypeId in matcher) // true
 * ```
 *
 * @category symbols
 * @since 4.0.0
 */
export const MatcherTypeId: MatcherTypeId = internal.TypeId

/**
 * Type-level identifier for `Matcher` instances.
 *
 * This type represents the unique symbol used to brand `Matcher` objects,
 * ensuring type safety and proper discrimination from other Effect types.
 *
 * @example
 * ```ts
 * import { Match } from "effect"
 *
 * // MatcherTypeId is used in the internal type structure
 * type MyMatcher = {
 *   readonly [Match.MatcherTypeId]: {
 *     readonly _input: unknown
 *     readonly _result: string
 *   }
 * }
 * ```
 *
 * @category symbols
 * @since 4.0.0
 */
export type MatcherTypeId = "~effect/Match/Matcher"

/**
 * Pattern matching follows a structured process:
 *
 * - **Creating a matcher**: Define a `Matcher` that operates on either a
 *   specific `Match.type` or `Match.value`.
 *
 * - **Defining patterns**: Use combinators such as `Match.when`, `Match.not`,
 *   and `Match.tag` to specify matching conditions.
 *
 * - **Completing the match**: Apply a finalizer such as `Match.exhaustive`,
 *   `Match.orElse`, or `Match.option` to determine how unmatched cases should
 *   be handled.
 *
 * @example
 * ```ts
 * import { Match } from "effect"
 *
 * // Simulated dynamic input that can be a string or a number
 * const input: string | number = "some input"
 *
 * //      ┌─── string
 * //      ▼
 * const result = Match.value(input).pipe(
 *   // Match if the value is a number
 *   Match.when(Match.number, (n) => `number: ${n}`),
 *   // Match if the value is a string
 *   Match.when(Match.string, (s) => `string: ${s}`),
 *   // Ensure all possible cases are covered
 *   Match.exhaustive
 * )
 *
 * console.log(result)
 * // Output: "string: some input"
 * ```
 *
 * @category Model
 * @since 4.0.0
 */
export type Matcher<Input, Filters, RemainingApplied, Result, Provided, Return = any> =
  | TypeMatcher<Input, Filters, RemainingApplied, Result, Return>
  | ValueMatcher<Input, Filters, RemainingApplied, Result, Provided, Return>

/**
 * Represents a pattern matcher that operates on types rather than specific values.
 *
 * A `TypeMatcher` is created when using `Match.type<T>()` and allows you to define
 * patterns that will be applied to values of the specified type. It maintains
 * type-level information about the input type, applied filters, remaining cases,
 * and expected results.
 *
 * @example
 * ```ts
 * import { Match } from "effect"
 *
 * // Create a TypeMatcher for string | number
 * const matcher = Match.type<string | number>().pipe(
 *   Match.when(Match.string, (s) => `String: ${s}`),
 *   Match.when(Match.number, (n) => `Number: ${n}`),
 *   Match.exhaustive
 * )
 *
 * console.log(matcher("hello")) // "String: hello"
 * console.log(matcher(42)) // "Number: 42"
 * ```
 *
 * @category models
 * @since 4.0.0
 */
export interface TypeMatcher<in Input, out Filters, out Remaining, out Result, out Return = any> extends Pipeable {
  readonly _tag: "TypeMatcher"
  readonly [MatcherTypeId]: {
    readonly _input: T.Contravariant<Input>
    readonly _filters: T.Covariant<Filters>
    readonly _remaining: T.Covariant<Remaining>
    readonly _result: T.Covariant<Result>
    readonly _return: T.Covariant<Return>
  }
  readonly cases: ReadonlyArray<Case>
  add<I, R, RA, A>(_case: Case): TypeMatcher<I, R, RA, A>
}

/**
 * Represents a pattern matcher that operates on a specific provided value.
 *
 * A `ValueMatcher` is created when using `Match.value(someValue)` and contains
 * the actual value to be matched against. It tracks both the provided value
 * and the result of applying patterns to determine matches.
 *
 * @example
 * ```ts
 * import { Match } from "effect"
 *
 * const input = { type: "user", name: "Alice", age: 30 }
 *
 * // Create a ValueMatcher for the specific input
 * const result = Match.value(input).pipe(
 *   Match.when({ type: "user" }, (user) => `User: ${user.name}`),
 *   Match.when({ type: "admin" }, (admin) => `Admin: ${admin.name}`),
 *   Match.orElse(() => "Unknown type")
 * )
 *
 * console.log(result) // "User: Alice"
 * ```
 *
 * @category models
 * @since 4.0.0
 */
export interface ValueMatcher<in Input, Filters, out Remaining, out Result, Provided, out Return = any>
  extends Pipeable
{
  readonly _tag: "ValueMatcher"
  readonly [MatcherTypeId]: {
    readonly _input: T.Contravariant<Input>
    readonly _filters: T.Covariant<Filters>
    readonly _result: T.Covariant<Result>
    readonly _return: T.Covariant<Return>
  }
  readonly provided: Provided
  readonly value: Result.Result<Provided, Remaining>
  add<I, R, RA, A, Pr>(_case: Case): ValueMatcher<I, R, RA, A, Pr>
}

/**
 * Represents a single pattern matching case.
 *
 * A `Case` can be either a positive match (`When`) or a negative match (`Not`).
 * Cases are the building blocks of pattern matching logic and determine
 * how values are tested and transformed.
 *
 * @example
 * ```ts
 * import { Match } from "effect"
 *
 * // Case is a union type representing pattern matching cases
 * // It combines When (positive) and Not (negative) matching logic
 *
 * // When you write this:
 * // Match.when(pattern, handler)  // Creates a When case
 * // Match.not(pattern, handler)   // Creates a Not case
 *
 * // The Match module internally uses Case = When | Not
 * type MyCaseType = Match.Case // When | Not
 * ```
 *
 * @category models
 * @since 4.0.0
 */
export type Case = When | Not

/**
 * Represents a positive pattern matching case.
 *
 * A `When` case contains the logic to test if a value matches a specific pattern
 * and the function to evaluate when the pattern matches. It's the primary
 * building block for pattern matching conditions.
 *
 * @example
 * ```ts
 * import { Match } from "effect"
 *
 * // When creates cases that match specific patterns
 * const stringMatcher = Match.type<string | number>().pipe(
 *   Match.when(Match.string, (s: string) => `Got string: ${s}`),
 *   Match.when(Match.number, (n: number) => `Got number: ${n}`),
 *   Match.exhaustive
 * )
 *
 * console.log(stringMatcher("hello")) // "Got string: hello"
 * console.log(stringMatcher(42)) // "Got number: 42"
 * ```
 *
 * @category models
 * @since 4.0.0
 */
export interface When {
  readonly _tag: "When"
  guard(u: unknown): boolean
  evaluate(input: unknown): any
}

/**
 * Represents a negative pattern matching case.
 *
 * A `Not` case contains the logic to test if a value does NOT match a specific
 * pattern and the function to evaluate when the pattern doesn't match. It's used
 * for exclusion-based pattern matching.
 *
 * @example
 * ```ts
 * import { Match } from "effect"
 *
 * // Not creates cases that exclude specific patterns
 * const matcher = Match.type<string>().pipe(
 *   // Match any string except "forbidden"
 *   Match.not("forbidden", (s) => `Allowed: ${s}`),
 *   Match.orElse(() => "This string is forbidden")
 * )
 *
 * console.log(matcher("hello")) // "Allowed: hello"
 * console.log(matcher("forbidden")) // "This string is forbidden"
 * ```
 *
 * @category models
 * @since 4.0.0
 */
export interface Not {
  readonly _tag: "Not"
  guard(u: unknown): boolean
  evaluate(input: unknown): any
}

/**
 * Creates a matcher for a specific type.
 *
 * **Details**
 *
 * This function defines a `Matcher` that operates on a given type, allowing you
 * to specify conditions for handling different cases. Once the matcher is
 * created, you can use pattern-matching functions like {@link when} to define
 * how different values should be processed.
 *
 * @example (Matching Numbers and Strings)
 *
 * ```ts
 * import { Match } from "effect"
 *
 * // Create a matcher for values that are either strings or numbers
 * //
 * //      ┌─── (u: string | number) => string
 * //      ▼
 * const match = Match.type<string | number>().pipe(
 *   // Match when the value is a number
 *   Match.when(Match.number, (n) => `number: ${n}`),
 *   // Match when the value is a string
 *   Match.when(Match.string, (s) => `string: ${s}`),
 *   // Ensure all possible cases are handled
 *   Match.exhaustive
 * )
 *
 * console.log(match(0))
 * // Output: "number: 0"
 *
 * console.log(match("hello"))
 * // Output: "string: hello"
 * ```
 *
 * @see {@link value} for creating a matcher from a specific value.
 *
 * @category Creating a matcher
 * @since 4.0.0
 */
export const type: <I>() => Matcher<I, Types.Without<never>, I, never, never> = internal.type

/**
 * Creates a matcher from a specific value.
 *
 * **Details**
 *
 * This function allows you to define a `Matcher` directly from a given value,
 * rather than from a type. This is useful when working with known values,
 * enabling structured pattern matching on objects, primitives, or any data
 * structure.
 *
 * Once the matcher is created, you can use pattern-matching functions like
 * {@link when} to define how different cases should be handled.
 *
 * @example (Matching an Object by Property)
 *
 * ```ts
 * import { Match } from "effect"
 *
 * const input = { name: "John", age: 30 }
 *
 * // Create a matcher for the specific object
 * const result = Match.value(input).pipe(
 *   // Match when the 'name' property is "John"
 *   Match.when(
 *     { name: "John" },
 *     (user) => `${user.name} is ${user.age} years old`
 *   ),
 *   // Provide a fallback if no match is found
 *   Match.orElse(() => "Oh, not John")
 * )
 *
 * console.log(result)
 * // Output: "John is 30 years old"
 * ```
 *
 * @see {@link type} for creating a matcher from a specific type.
 *
 * @category Creating a matcher
 * @since 4.0.0
 */
export const value: <const I>(
  i: I
) => Matcher<I, Types.Without<never>, I, never, I> = internal.value

/**
 * Creates a match function for a specific value with discriminated union handling.
 *
 * This function provides a convenient way to pattern match on discriminated unions
 * by providing an object that maps each `_tag` value to its corresponding handler.
 * It's similar to a switch statement but with better type safety and exhaustiveness checking.
 *
 * @example
 * ```ts
 * import { Match } from "effect"
 *
 * type Status = { readonly _tag: "Success"; readonly data: string }
 *
 * const success: Status = { _tag: "Success", data: "Hello" }
 *
 * // Simple valueTags usage
 * const message = Match.valueTags(success, {
 *   Success: (result) => `Success: ${result.data}`
 * })
 *
 * console.log(message) // "Success: Hello"
 * ```
 *
 * @category Creating a matcher
 * @since 4.0.0
 */
export const valueTags: {
  <
    const I,
    P extends
      & { readonly [Tag in Types.Tags<"_tag", I> & string]: (_: Extract<I, { readonly _tag: Tag }>) => any }
      & { readonly [Tag in Exclude<keyof P, Types.Tags<"_tag", I>>]: never }
  >(fields: P): (input: I) => Unify<ReturnType<P[keyof P]>>
  <
    const I,
    P extends
      & { readonly [Tag in Types.Tags<"_tag", I> & string]: (_: Extract<I, { readonly _tag: Tag }>) => any }
      & { readonly [Tag in Exclude<keyof P, Types.Tags<"_tag", I>>]: never }
  >(input: I, fields: P): Unify<ReturnType<P[keyof P]>>
} = internal.valueTags

/**
 * Creates a type-safe match function for discriminated unions based on `_tag` field.
 *
 * This function allows you to define exhaustive pattern matching for discriminated unions
 * by providing handlers for each possible `_tag` value. It ensures type safety and
 * can optionally enforce a specific return type across all branches.
 *
 * @example
 * ```ts
 * import { Match } from "effect"
 *
 * type Result =
 *   | { readonly _tag: "Success"; readonly data: string }
 *   | { readonly _tag: "Error"; readonly message: string }
 *   | { readonly _tag: "Loading" }
 *
 * // Create a matcher with specific return type
 * const formatResult = Match.typeTags<Result, string>()({
 *   Success: (result) => `Data: ${result.data}`,
 *   Error: (result) => `Error: ${result.message}`,
 *   Loading: () => "Loading..."
 * })
 *
 * console.log(formatResult({ _tag: "Success", data: "Hello World" }))
 * // Output: "Data: Hello World"
 *
 * console.log(formatResult({ _tag: "Error", message: "Network failed" }))
 * // Output: "Error: Network failed"
 *
 * // Create a matcher with inferred return type
 * const processResult = Match.typeTags<Result>()({
 *   Success: (result) => ({ type: "ok", value: result.data }),
 *   Error: (result) => ({ type: "error", error: result.message }),
 *   Loading: () => ({ type: "pending" })
 * })
 *
 * console.log(processResult({ _tag: "Loading" }))
 * // Output: { type: "pending" }
 * ```
 *
 * @category Creating a matcher
 * @since 4.0.0
 */
export const typeTags: {
  <I, Ret>(): <
    P extends
      & {
        readonly [Tag in Types.Tags<"_tag", I> & string]: (
          _: Extract<I, { readonly _tag: Tag }>
        ) => Ret
      }
      & { readonly [Tag in Exclude<keyof P, Types.Tags<"_tag", I>>]: never }
  >(fields: P) => (input: I) => Ret
  <I>(): <
    P extends
      & {
        readonly [Tag in Types.Tags<"_tag", I> & string]: (
          _: Extract<I, { readonly _tag: Tag }>
        ) => any
      }
      & { readonly [Tag in Exclude<keyof P, Types.Tags<"_tag", I>>]: never }
  >(fields: P) => (input: I) => Unify<ReturnType<P[keyof P]>>
} = internal.typeTags

/**
 * Ensures that all branches of a matcher return a specific type.
 *
 * **Details**
 *
 * This function enforces a consistent return type across all pattern-matching
 * branches. By specifying a return type, TypeScript will check that every
 * matching condition produces a value of the expected type.
 *
 * **Important:** This function must be the first step in the matcher pipeline.
 * If used later, TypeScript will not enforce type consistency correctly.
 *
 * @example (Validating Return Type Consistency)
 *
 * ```ts
 * import { Match } from "effect"
 *
 * const match = Match.type<{ a: number } | { b: string }>().pipe(
 *   // Ensure all branches return a string
 *   Match.withReturnType<string>(),
 *   // ❌ Type error: 'number' is not assignable to type 'string'
 *   // @ts-expect-error
 *   Match.when({ a: Match.number }, (_) => _.a),
 *   // ✅ Correct: returns a string
 *   Match.when({ b: Match.string }, (_) => _.b),
 *   Match.exhaustive
 * )
 * ```
 *
 * @category utils
 * @since 4.0.0
 */
export const withReturnType: <Ret>() => <I, F, R, A, Pr, _>(
  self: Matcher<I, F, R, A, Pr, _>
) => [Ret] extends [[A] extends [never] ? any : A] ? Matcher<I, F, R, A, Pr, Ret>
  : "withReturnType constraint does not extend Result type" = internal.withReturnType

/**
 * Defines a condition for matching values.
 *
 * **Details**
 *
 * This function enables pattern matching by checking whether a given value
 * satisfies a condition. It supports both direct value comparisons and
 * predicate functions. If the condition is met, the associated function is
 * executed.
 *
 * This function is useful when defining matchers that need to check for
 * specific values or apply logical conditions to determine a match. It works
 * well with structured objects and primitive types.
 *
 * @example (Matching with Values and Predicates)
 *
 * ```ts
 * import { Match } from "effect"
 *
 * // Create a matcher for objects with an "age" property
 * const match = Match.type<{ age: number }>().pipe(
 *   // Match when age is greater than 18
 *   Match.when({ age: (age: number) => age > 18 }, (user: { age: number }) => `Age: ${user.age}`),
 *   // Match when age is exactly 18
 *   Match.when({ age: 18 }, () => "You can vote"),
 *   // Fallback case for all other ages
 *   Match.orElse((user: { age: number }) => `${user.age} is too young`)
 * )
 *
 * console.log(match({ age: 20 }))
 * // Output: "Age: 20"
 *
 * console.log(match({ age: 18 }))
 * // Output: "You can vote"
 *
 * console.log(match({ age: 4 }))
 * // Output: "4 is too young"
 * ```
 *
 * @see {@link whenOr} Use this when multiple patterns should match in a single
 * condition.
 * @see {@link whenAnd} Use this when a value must match all provided patterns.
 * @see {@link orElse} Provides a fallback when no patterns match.
 *
 * @category Defining patterns
 * @since 4.0.0
 */
export const when: <
  R,
  const P extends Types.PatternPrimitive<R> | Types.PatternBase<R>,
  Ret,
  Fn extends (_: Types.WhenMatch<R, P>) => Ret
>(
  pattern: P,
  f: Fn
) => <I, F, A, Pr>(
  self: Matcher<I, F, R, A, Pr, Ret>
) => Matcher<
  I,
  Types.AddWithout<F, Types.PForExclude<P>>,
  Types.ApplyFilters<I, Types.AddWithout<F, Types.PForExclude<P>>>,
  A | ReturnType<Fn>,
  Pr,
  Ret
> = internal.when

/**
 * Matches one of multiple patterns in a single condition.
 *
 * **Details**
 *
 * This function allows defining a condition where a value matches any of the
 * provided patterns. If a match is found, the associated function is executed.
 * It simplifies cases where multiple patterns share the same handling logic.
 *
 * Unlike {@link when}, which requires separate conditions for each pattern,
 * this function enables combining them into a single statement, making the
 * matcher more concise.
 *
 * @example
 * ```ts
 * import { Match } from "effect"
 *
 * type ErrorType =
 *   | { readonly _tag: "NetworkError"; readonly message: string }
 *   | { readonly _tag: "TimeoutError"; readonly duration: number }
 *   | { readonly _tag: "ValidationError"; readonly field: string }
 *
 * const handleError = Match.type<ErrorType>().pipe(
 *   Match.whenOr(
 *     { _tag: "NetworkError" },
 *     { _tag: "TimeoutError" },
 *     () => "Retry the request"
 *   ),
 *   Match.when({ _tag: "ValidationError" }, (_) => `Invalid field: ${_.field}`),
 *   Match.exhaustive
 * )
 *
 * console.log(handleError({ _tag: "NetworkError", message: "No connection" }))
 * // Output: "Retry the request"
 *
 * console.log(handleError({ _tag: "ValidationError", field: "email" }))
 * // Output: "Invalid field: email"
 * ```
 *
 * @category Defining patterns
 * @since 4.0.0
 */
export const whenOr: <
  R,
  const P extends ReadonlyArray<Types.PatternPrimitive<R> | Types.PatternBase<R>>,
  Ret,
  Fn extends (_: Types.WhenMatch<R, P[number]>) => Ret
>(
  ...args: [...patterns: P, f: Fn]
) => <I, F, A, Pr>(
  self: Matcher<I, F, R, A, Pr, Ret>
) => Matcher<
  I,
  Types.AddWithout<F, Types.PForExclude<P[number]>>,
  Types.ApplyFilters<I, Types.AddWithout<F, Types.PForExclude<P[number]>>>,
  A | ReturnType<Fn>,
  Pr,
  Ret
> = internal.whenOr

/**
 * Matches a value that satisfies all provided patterns.
 *
 * **Details**
 *
 * This function allows defining a condition where a value must match all the
 * given patterns simultaneously. If the value satisfies every pattern, the
 * associated function is executed.
 *
 * Unlike {@link when}, which matches a single pattern at a time, this function
 * ensures that multiple conditions are met before executing the callback. It is
 * useful when checking for values that need to fulfill multiple criteria at
 * once.
 *
 * @example
 * ```ts
 * import { Match } from "effect"
 *
 * type User = { readonly age: number; readonly role: "admin" | "user" }
 *
 * const checkUser = Match.type<User>().pipe(
 *   Match.whenAnd(
 *     { age: (n) => n >= 18 },
 *     { role: "admin" },
 *     () => "Admin access granted"
 *   ),
 *   Match.orElse(() => "Access denied")
 * )
 *
 * console.log(checkUser({ age: 20, role: "admin" }))
 * // Output: "Admin access granted"
 *
 * console.log(checkUser({ age: 20, role: "user" }))
 * // Output: "Access denied"
 * ```
 *
 * @category Defining patterns
 * @since 4.0.0
 */
export const whenAnd: <
  R,
  const P extends ReadonlyArray<Types.PatternPrimitive<R> | Types.PatternBase<R>>,
  Ret,
  Fn extends (_: Types.WhenMatch<R, T.UnionToIntersection<P[number]>>) => Ret
>(
  ...args: [...patterns: P, f: Fn]
) => <I, F, A, Pr>(
  self: Matcher<I, F, R, A, Pr, Ret>
) => Matcher<
  I,
  Types.AddWithout<F, Types.PForExclude<T.UnionToIntersection<P[number]>>>,
  Types.ApplyFilters<I, Types.AddWithout<F, Types.PForExclude<T.UnionToIntersection<P[number]>>>>,
  A | ReturnType<Fn>,
  Pr
> = internal.whenAnd

/**
 * Matches values based on a specified discriminant field.
 *
 * **Details**
 *
 * This function is used to define pattern matching on objects that follow a
 * **discriminated union** structure, where a specific field (e.g., `type`,
 * `kind`, `_tag`) determines the variant of the object. It allows matching
 * multiple values of the discriminant and provides a function to handle the
 * matched cases.
 *
 * @example
 * ```ts
 * import { Match, pipe } from "effect"
 *
 * const match = pipe(
 *   Match.type<{ type: "A"; a: string } | { type: "B"; b: number } | { type: "C"; c: boolean }>(),
 *   Match.discriminator("type")("A", "B", (_) => `A or B: ${_.type}`),
 *   Match.discriminator("type")("C", (_) => `C(${_.c})`),
 *   Match.exhaustive
 * )
 * ```
 *
 * @category Defining patterns
 * @since 4.0.0
 */
export const discriminator: <D extends string>(
  field: D
) => <R, P extends Types.Tags<D, R> & string, Ret, Fn extends (_: Extract<R, Record<D, P>>) => Ret>(
  ...pattern: [first: P, ...values: Array<P>, f: Fn]
) => <I, F, A, Pr>(
  self: Matcher<I, F, R, A, Pr, Ret>
) => Matcher<
  I,
  Types.AddWithout<F, Extract<R, Record<D, P>>>,
  Types.ApplyFilters<I, Types.AddWithout<F, Extract<R, Record<D, P>>>>,
  A | ReturnType<Fn>,
  Pr,
  Ret
> = internal.discriminator

/**
 * Matches values where a specified field starts with a given prefix.
 *
 * **Details**
 *
 * This function is useful for working with discriminated unions where the
 * discriminant field follows a hierarchical or namespaced structure. It allows
 * you to match values based on whether the specified field starts with a given
 * prefix, making it easier to handle grouped cases.
 *
 * Instead of checking for exact matches, this function lets you match values
 * that share a common prefix. For example, if your discriminant field contains
 * hierarchical names like `"A"`, `"A.A"`, and `"B"`, you can match all values
 * starting with `"A"` using a single rule.
 *
 * @example
 * ```ts
 * import { Match, pipe } from "effect"
 *
 * const match = pipe(
 *   Match.type<{ type: "A" } | { type: "B" } | { type: "A.A" } | {}>(),
 *   Match.discriminatorStartsWith("type")("A", (_) => 1 as const),
 *   Match.discriminatorStartsWith("type")("B", (_) => 2 as const),
 *   Match.orElse((_) => 3 as const)
 * )
 *
 * console.log(match({ type: "A" })) // 1
 * console.log(match({ type: "B" })) // 2
 * console.log(match({ type: "A.A" })) // 1
 * ```
 *
 * @category Defining patterns
 * @since 4.0.0
 */
export const discriminatorStartsWith: <D extends string>(
  field: D
) => <R, P extends string, Ret, Fn extends (_: Extract<R, Record<D, `${P}${string}`>>) => Ret>(
  pattern: P,
  f: Fn
) => <I, F, A, Pr>(
  self: Matcher<I, F, R, A, Pr, Ret>
) => Matcher<
  I,
  Types.AddWithout<F, Extract<R, Record<D, `${P}${string}`>>>,
  Types.ApplyFilters<I, Types.AddWithout<F, Extract<R, Record<D, `${P}${string}`>>>>,
  A | ReturnType<Fn>,
  Pr,
  Ret
> = internal.discriminatorStartsWith

/**
 * Matches values based on a field that serves as a discriminator, mapping each
 * possible value to a corresponding handler.
 *
 * **Details**
 *
 * This function simplifies working with discriminated unions by letting you
 * define a set of handlers for each possible value of a given field. Instead of
 * chaining multiple calls to {@link discriminator}, this function allows
 * defining all possible cases at once using an object where the keys are the
 * possible values of the field, and the values are the corresponding handler
 * functions.
 *
 * @example
 * ```ts
 * import { Match, pipe } from "effect"
 *
 * const match = pipe(
 *   Match.type<{ type: "A"; a: string } | { type: "B"; b: number } | { type: "C"; c: boolean }>(),
 *   Match.discriminators("type")({
 *     A: (a) => a.a,
 *     B: (b) => b.b,
 *     C: (c) => c.c
 *   }),
 *   Match.exhaustive
 * )
 * ```
 *
 * @category Defining patterns
 * @since 4.0.0
 */
export const discriminators: <D extends string>(
  field: D
) => <
  R,
  Ret,
  P extends
    & { readonly [Tag in Types.Tags<D, R> & string]?: ((_: Extract<R, Record<D, Tag>>) => Ret) | undefined }
    & { readonly [Tag in Exclude<keyof P, Types.Tags<D, R>>]: never }
>(
  fields: P
) => <I, F, A, Pr>(
  self: Matcher<I, F, R, A, Pr, Ret>
) => Matcher<
  I,
  Types.AddWithout<F, Extract<R, Record<D, keyof P>>>,
  Types.ApplyFilters<I, Types.AddWithout<F, Extract<R, Record<D, keyof P>>>>,
  A | ReturnType<P[keyof P] & {}>,
  Pr,
  Ret
> = internal.discriminators

/**
 * Matches values based on a discriminator field and **ensures all cases are
 * handled**.
 *
 * **Details*+
 *
 * This function is similar to {@link discriminators}, but **requires that all
 * possible cases** are explicitly handled. It is useful when working with
 * discriminated unions, where a specific field (e.g., `"type"`) determines the
 * shape of an object. Each possible value of the field must have a
 * corresponding handler, ensuring **exhaustiveness checking** at compile time.
 *
 * This function **does not require** `Match.exhaustive` at the end of the
 * pipeline because it enforces exhaustiveness by design.
 *
 * @example
 * ```ts
 * import { Match, pipe } from "effect"
 *
 * const match = pipe(
 *   Match.type<{ type: "A"; a: string } | { type: "B"; b: number } | { type: "C"; c: boolean }>(),
 *   Match.discriminatorsExhaustive("type")({
 *     A: (a) => a.a,
 *     B: (b) => b.b,
 *     C: (c) => c.c
 *   })
 * )
 * ```
 *
 * @category Defining patterns
 * @since 4.0.0
 */
export const discriminatorsExhaustive: <D extends string>(
  field: D
) => <
  R,
  Ret,
  P extends
    & { readonly [Tag in Types.Tags<D, R> & string]: (_: Extract<R, Record<D, Tag>>) => Ret }
    & { readonly [Tag in Exclude<keyof P, Types.Tags<D, R>>]: never }
>(
  fields: P
) => <I, F, A, Pr>(
  self: Matcher<I, F, R, A, Pr, Ret>
) => [Pr] extends [never] ? (u: I) => Unify<A | ReturnType<P[keyof P]>> : Unify<A | ReturnType<P[keyof P]>> =
  internal.discriminatorsExhaustive

/**
 * The `Match.tag` function allows pattern matching based on the `_tag` field in
 * a [Discriminated Union](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes-func.html#discriminated-unions).
 * You can specify multiple tags to match within a single pattern.
 *
 * **Note**
 *
 * The `Match.tag` function relies on the convention within the Effect ecosystem
 * of naming the tag field as `"_tag"`. Ensure that your discriminated unions
 * follow this naming convention for proper functionality.
 *
 * @example (Matching a Discriminated Union by Tag)
 *
 * ```ts
 * import { Match } from "effect"
 *
 * type Event =
 *   | { readonly _tag: "fetch" }
 *   | { readonly _tag: "success"; readonly data: string }
 *   | { readonly _tag: "error"; readonly error: Error }
 *   | { readonly _tag: "cancel" }
 *
 * const match = Match.type<Event>().pipe(
 *   // Match either "fetch" or "success"
 *   Match.tag("fetch", "success", () => `Ok!`),
 *   // Match "error" and extract the error message
 *   Match.tag("error", (event) => `Error: ${event.error.message}`),
 *   // Match "cancel"
 *   Match.tag("cancel", () => "Cancelled"),
 *   Match.exhaustive
 * )
 *
 * console.log(match({ _tag: "success", data: "Hello" }))
 * // Output: "Ok!"
 *
 * console.log(match({ _tag: "error", error: new Error("Oops!") }))
 * // Output: "Error: Oops!"
 * ```
 *
 * @category Defining patterns
 * @since 4.0.0
 */
export const tag: <
  R,
  P extends Types.Tags<"_tag", R> & string,
  Ret,
  Fn extends (_: Extract<R, Record<"_tag", P>>) => Ret
>(
  ...pattern: [first: P, ...values: Array<P>, f: Fn]
) => <I, F, A, Pr>(
  self: Matcher<I, F, R, A, Pr, Ret>
) => Matcher<
  I,
  Types.AddWithout<F, Extract<R, Record<"_tag", P>>>,
  Types.ApplyFilters<I, Types.AddWithout<F, Extract<R, Record<"_tag", P>>>>,
  ReturnType<Fn> | A,
  Pr,
  Ret
> = internal.tag

/**
 * Matches values where the `_tag` field starts with a given prefix.
 *
 * **Details**
 *
 * This function allows you to match on values in a **discriminated union**
 * based on whether the `_tag` field starts with a specified prefix. It is
 * useful for handling hierarchical or namespaced tags, where multiple related
 * cases share a common prefix.
 *
 * @example
  ```ts
 * import { Match, pipe } from "effect"
 *
 * const match = pipe(
 *   Match.type<{ _tag: "A" } | { _tag: "B" } | { _tag: "A.A" } | {}>(),
 *   Match.tagStartsWith("A", (_) => 1 as const),
 *   Match.tagStartsWith("B", (_) => 2 as const),
 *   Match.orElse((_) => 3 as const)
 * )
 *
 * console.log(match({ _tag: "A" })) // 1
 * console.log(match({ _tag: "B" })) // 2
 * console.log(match({ _tag: "A.A" })) // 1
 * ```
 *
 * @category Defining patterns
 * @since 4.0.0
 */
export const tagStartsWith: <
  R,
  P extends string,
  Ret,
  Fn extends (_: Extract<R, Record<"_tag", `${P}${string}`>>) => Ret
>(
  pattern: P,
  f: Fn
) => <I, F, A, Pr>(
  self: Matcher<I, F, R, A, Pr, Ret>
) => Matcher<
  I,
  Types.AddWithout<F, Extract<R, Record<"_tag", `${P}${string}`>>>,
  Types.ApplyFilters<I, Types.AddWithout<F, Extract<R, Record<"_tag", `${P}${string}`>>>>,
  ReturnType<Fn> | A,
  Pr,
  Ret
> = internal.tagStartsWith

/**
 * Matches values based on their `_tag` field, mapping each tag to a
 * corresponding handler.
 *
 * **Details**
 *
 * This function provides a way to handle discriminated unions by mapping `_tag`
 * values to specific functions. Each handler receives the matched value and
 * returns a transformed result. If all possible tags are handled, you can
 * enforce exhaustiveness using `Match.exhaustive` to ensure no case is missed.
 *
 * @example
 * ```ts
 * import { Match, pipe } from "effect"
 *
 * const match = pipe(
 *   Match.type<{ _tag: "A"; a: string } | { _tag: "B"; b: number } | { _tag: "C"; c: boolean }>(),
 *   Match.tags({
 *     A: (a) => a.a,
 *     B: (b) => b.b,
 *     C: (c) => c.c
 *   }),
 *   Match.exhaustive
 * )
 * ```
 *
 * @category Defining patterns
 * @since 4.0.0
 */
export const tags: <
  R,
  Ret,
  P extends
    & { readonly [Tag in Types.Tags<"_tag", R> & string]?: ((_: Extract<R, Record<"_tag", Tag>>) => Ret) | undefined }
    & { readonly [Tag in Exclude<keyof P, Types.Tags<"_tag", R>>]: never }
>(
  fields: P
) => <I, F, A, Pr>(
  self: Matcher<I, F, R, A, Pr, Ret>
) => Matcher<
  I,
  Types.AddWithout<F, Extract<R, Record<"_tag", keyof P>>>,
  Types.ApplyFilters<I, Types.AddWithout<F, Extract<R, Record<"_tag", keyof P>>>>,
  A | ReturnType<P[keyof P] & {}>,
  Pr,
  Ret
> = internal.tags

/**
 * Matches values based on their `_tag` field and requires handling of all
 * possible cases.
 *
 * **Details**
 *
 * This function is designed for **discriminated unions** where every possible
 * `_tag` value must have a corresponding handler. Unlike {@link tags}, this
 * function ensures **exhaustiveness**, meaning all cases must be explicitly
 * handled. If a `_tag` value is missing from the mapping, TypeScript will
 * report an error.
 *
 * @example
 * ```ts
 * import { Match, pipe } from "effect"
 *
 * const match = pipe(
 *   Match.type<{ _tag: "A"; a: string } | { _tag: "B"; b: number } | { _tag: "C"; c: boolean }>(),
 *   Match.tagsExhaustive({
 *     A: (a) => a.a,
 *     B: (b) => b.b,
 *     C: (c) => c.c
 *   })
 * )
 * ```
 *
 * @category Defining patterns
 * @since 4.0.0
 */
export const tagsExhaustive: <
  R,
  Ret,
  P extends
    & { readonly [Tag in Types.Tags<"_tag", R> & string]: (_: Extract<R, Record<"_tag", Tag>>) => Ret }
    & { readonly [Tag in Exclude<keyof P, Types.Tags<"_tag", R>>]: never }
>(
  fields: P
) => <I, F, A, Pr>(
  self: Matcher<I, F, R, A, Pr, Ret>
) => [Pr] extends [never] ? (u: I) => Unify<A | ReturnType<P[keyof P]>> : Unify<A | ReturnType<P[keyof P]>> =
  internal.tagsExhaustive

/**
 * Excludes a specific value from matching while allowing all others.
 *
 * **Details**
 *
 * This function is useful when you need to **handle all values except one or
 * more specific cases**. Instead of listing all possible matches manually, this
 * function simplifies the logic by allowing you to specify values to exclude.
 * Any excluded value will bypass the provided function and continue matching
 * through other cases.
 *
 * @example (Ignoring a Specific Value)
 *
 * ```ts
 * import { Match } from "effect"
 *
 * // Create a matcher for string or number values
 * const match = Match.type<string | number>().pipe(
 *   // Match any value except "hi", returning "ok"
 *   Match.not("hi", () => "ok"),
 *   // Fallback case for when the value is "hi"
 *   Match.orElse(() => "fallback")
 * )
 *
 * console.log(match("hello"))
 * // Output: "ok"
 *
 * console.log(match("hi"))
 * // Output: "fallback"
 * ```
 *
 * @category Defining patterns
 * @since 4.0.0
 */
export const not: <
  R,
  const P extends Types.PatternPrimitive<R> | Types.PatternBase<R>,
  Ret,
  Fn extends (_: Types.NotMatch<R, P>) => Ret
>(
  pattern: P,
  f: Fn
) => <I, F, A, Pr>(
  self: Matcher<I, F, R, A, Pr, Ret>
) => Matcher<
  I,
  Types.AddOnly<F, Types.WhenMatch<R, P>>,
  Types.ApplyFilters<I, Types.AddOnly<F, Types.WhenMatch<R, P>>>,
  A | ReturnType<Fn>,
  Pr,
  Ret
> = internal.not

/**
 * Matches non-empty strings.
 *
 * This predicate matches any string that contains at least one character,
 * effectively filtering out empty strings ("").
 *
 * @example
 * ```ts
 * import { Match } from "effect"
 *
 * const processInput = Match.type<string>()
 *   .pipe(
 *     Match.when(Match.nonEmptyString, (str) => `Valid input: ${str}`),
 *     Match.orElse(() => "Input cannot be empty")
 *   )
 *
 * console.log(processInput("hello"))
 * // Output: "Valid input: hello"
 *
 * console.log(processInput(""))
 * // Output: "Input cannot be empty"
 *
 * console.log(processInput("   "))
 * // Output: "Valid input:    " (whitespace-only strings are considered non-empty)
 * ```
 *
 * @category Predicates
 * @since 4.0.0
 */
export const nonEmptyString: SafeRefinement<string, never> = internal.nonEmptyString

/**
 * Matches a specific set of literal values (e.g., `Match.is("a", 42, true)`).
 *
 * This function creates a predicate that matches any of the provided literal values.
 * It's useful for matching against multiple specific values in a single pattern.
 *
 * @example
 * ```ts
 * import { Match } from "effect"
 *
 * const handleStatus = Match.type<string | number>()
 *   .pipe(
 *     Match.when(Match.is("success", "ok", 200), () => "Operation successful"),
 *     Match.when(Match.is("error", "failed", 500), () => "Operation failed"),
 *     Match.when(Match.is(0, false, null), () => "Falsy value"),
 *     Match.orElse((value) => `Unknown status: ${value}`)
 *   )
 *
 * console.log(handleStatus("success"))
 * // Output: "Operation successful"
 *
 * console.log(handleStatus(200))
 * // Output: "Operation successful"
 *
 * console.log(handleStatus("failed"))
 * // Output: "Operation failed"
 *
 * console.log(handleStatus(0))
 * // Output: "Falsy value"
 *
 * console.log(handleStatus("pending"))
 * // Output: "Unknown status: pending"
 * ```
 *
 * @category Predicates
 * @since 4.0.0
 */
export const is: <
  Literals extends ReadonlyArray<string | number | bigint | boolean | null>
>(...literals: Literals) => SafeRefinement<Literals[number]> = internal.is

/**
 * Matches values of type `string`.
 *
 * This predicate refines unknown values to strings, allowing pattern matching
 * on string types. It's commonly used in type-based matchers to handle string cases.
 *
 * @example
 * ```ts
 * import { Match } from "effect"
 *
 * const processValue = Match.type<string | number | boolean>().pipe(
 *   Match.when(Match.string, (str) => `String: ${str.toUpperCase()}`),
 *   Match.when(Match.number, (num) => `Number: ${num * 2}`),
 *   Match.when(Match.boolean, (bool) => `Boolean: ${bool ? "yes" : "no"}`),
 *   Match.exhaustive
 * )
 *
 * console.log(processValue("hello")) // "String: HELLO"
 * console.log(processValue(42)) // "Number: 84"
 * console.log(processValue(true)) // "Boolean: yes"
 * ```
 *
 * @category predicates
 * @since 4.0.0
 */
export const string: Predicate.Refinement<unknown, string> = Predicate.isString

/**
 * Matches values of type `number`.
 *
 * This predicate refines unknown values to numbers, allowing pattern matching
 * on numeric types. It matches all number values including integers, floats,
 * `Infinity`, `-Infinity`, and `NaN`.
 *
 * @example
 * ```ts
 * import { Match } from "effect"
 *
 * const categorizeNumber = Match.type<unknown>().pipe(
 *   Match.when(Match.number, (num) => {
 *     if (Number.isNaN(num)) return "Not a number"
 *     if (!Number.isFinite(num)) return "Infinite"
 *     if (Number.isInteger(num)) return `Integer: ${num}`
 *     return `Float: ${num.toFixed(2)}`
 *   }),
 *   Match.orElse(() => "Not a number type")
 * )
 *
 * console.log(categorizeNumber(42)) // "Integer: 42"
 * console.log(categorizeNumber(3.14)) // "Float: 3.14"
 * console.log(categorizeNumber(NaN)) // "Not a number"
 * console.log(categorizeNumber("hello")) // "Not a number type"
 * ```
 *
 * @category predicates
 * @since 4.0.0
 */
export const number: Predicate.Refinement<unknown, number> = Predicate.isNumber

/**
 * Matches any value without restrictions.
 *
 * This predicate matches absolutely any value, including `undefined`, `null`,
 * objects, primitives, functions, etc. It's useful as a catch-all pattern
 * or when you need to match any remaining cases.
 *
 * @example
 * ```ts
 * import { Match } from "effect"
 *
 * const describeValue = Match.type<unknown>()
 *   .pipe(
 *     Match.when(Match.string, (str) => `String: ${str}`),
 *     Match.when(Match.number, (num) => `Number: ${num}`),
 *     Match.when(Match.boolean, (bool) => `Boolean: ${bool}`),
 *     Match.when(Match.any, (value) => `Other: ${typeof value}`),
 *     Match.exhaustive
 *   )
 *
 * console.log(describeValue("hello"))
 * // Output: "String: hello"
 *
 * console.log(describeValue(42))
 * // Output: "Number: 42"
 *
 * console.log(describeValue([1, 2, 3]))
 * // Output: "Other: object"
 *
 * console.log(describeValue(null))
 * // Output: "Other: object"
 * ```
 *
 * @category Predicates
 * @since 4.0.0
 */
export const any: SafeRefinement<unknown, any> = internal.any

/**
 * Matches any defined (non-null and non-undefined) value.
 *
 * This predicate matches values that are neither `null` nor `undefined`,
 * effectively filtering out nullish values while preserving all other types.
 *
 * @example
 * ```ts
 * import { Match } from "effect"
 *
 * const processValue = Match.type<string | number | null | undefined>()
 *   .pipe(
 *     Match.when(Match.defined, (value) => `Defined value: ${value}`),
 *     Match.orElse(() => "Value is null or undefined")
 *   )
 *
 * console.log(processValue("hello"))
 * // Output: "Defined value: hello"
 *
 * console.log(processValue(42))
 * // Output: "Defined value: 42"
 *
 * console.log(processValue(0))
 * // Output: "Defined value: 0"
 *
 * console.log(processValue(""))
 * // Output: "Defined value: "
 *
 * console.log(processValue(null))
 * // Output: "Value is null or undefined"
 *
 * console.log(processValue(undefined))
 * // Output: "Value is null or undefined"
 * ```
 *
 * @category Predicates
 * @since 4.0.0
 */
export const defined: <A>(u: A) => u is A & {} = internal.defined

/**
 * Matches values of type `boolean`.
 *
 * This predicate refines unknown values to booleans, allowing pattern matching
 * on boolean types. It only matches the primitive boolean values `true` and `false`.
 *
 * @example
 * ```ts
 * import { Match } from "effect"
 *
 * const describeTruthiness = Match.type<unknown>().pipe(
 *   Match.when(Match.boolean, (bool) =>
 *     bool ? "Definitely true" : "Definitely false"
 *   ),
 *   Match.when(0, () => "Falsy number"),
 *   Match.when("", () => "Empty string"),
 *   Match.when(Match.null, () => "Null value"),
 *   Match.orElse(() => "Some other truthy value")
 * )
 *
 * console.log(describeTruthiness(true)) // "Definitely true"
 * console.log(describeTruthiness(false)) // "Definitely false"
 * console.log(describeTruthiness(0)) // "Falsy number"
 * console.log(describeTruthiness(1)) // "Some other truthy value"
 * ```
 *
 * @category predicates
 * @since 4.0.0
 */
export const boolean: Predicate.Refinement<unknown, boolean> = Predicate.isBoolean

const _undefined: Predicate.Refinement<unknown, undefined> = Predicate.isUndefined
export {
  /**
   * Matches the value `undefined`.
   *
   * @category Predicates
   * @since 4.0.0
   */
  _undefined as undefined
}

const _null: Predicate.Refinement<unknown, null> = Predicate.isNull
export {
  /**
   * Matches the value `null`.
   *
   * @category Predicates
   * @since 4.0.0
   */
  _null as null
}

/**
 * Matches values of type `bigint`.
 *
 * This predicate refines unknown values to bigints, allowing pattern matching
 * on bigint types. BigInts are used for representing integers with arbitrary precision.
 *
 * @example
 * ```ts
 * import { Match } from "effect"
 *
 * const processLargeNumber = Match.type<unknown>().pipe(
 *   Match.when(Match.bigint, (big) => {
 *     if (big > 9007199254740991n) {
 *       return `Large integer: ${big.toString()}`
 *     }
 *     return `BigInt: ${big.toString()}`
 *   }),
 *   Match.when(Match.number, (num) => `Regular number: ${num}`),
 *   Match.orElse(() => "Not a numeric type")
 * )
 *
 * console.log(processLargeNumber(123n)) // "BigInt: 123"
 * console.log(processLargeNumber(9007199254740992n)) // "Large integer: 9007199254740992"
 * console.log(processLargeNumber(123)) // "Regular number: 123"
 * console.log(processLargeNumber("123")) // "Not a numeric type"
 * ```
 *
 * @category predicates
 * @since 4.0.0
 */
export const bigint: Predicate.Refinement<unknown, bigint> = Predicate.isBigInt

/**
 * Matches values of type `symbol`.
 *
 * This predicate refines unknown values to symbols, allowing pattern matching
 * on symbol types. Symbols are unique identifiers that are often used as
 * object keys or for creating private properties.
 *
 * @example
 * ```ts
 * import { Match } from "effect"
 *
 * const mySymbol = Symbol("my-symbol")
 * const globalSymbol = Symbol.for("global-symbol")
 *
 * const handleSymbol = Match.type<unknown>().pipe(
 *   Match.when(Match.symbol, (sym) => {
 *     const description = sym.description
 *     if (description) {
 *       return `Symbol with description: ${description}`
 *     }
 *     return "Symbol without description"
 *   }),
 *   Match.orElse(() => "Not a symbol")
 * )
 *
 * console.log(handleSymbol(mySymbol)) // "Symbol with description: my-symbol"
 * console.log(handleSymbol(Symbol())) // "Symbol without description"
 * console.log(handleSymbol("string")) // "Not a symbol"
 * ```
 *
 * @category predicates
 * @since 4.0.0
 */
export const symbol: Predicate.Refinement<unknown, symbol> = Predicate.isSymbol

/**
 * Matches values that are instances of `Date`.
 *
 * This predicate refines unknown values to Date instances, allowing pattern
 * matching on Date objects. It only matches actual Date instances, not
 * date strings or timestamps.
 *
 * @example
 * ```ts
 * import { Match } from "effect"
 *
 * const processDateValue = Match.type<unknown>().pipe(
 *   Match.when(Match.date, (date) => {
 *     if (isNaN(date.getTime())) {
 *       return "Invalid date"
 *     }
 *     return `Date: ${date.toISOString().split('T')[0]}`
 *   }),
 *   Match.when(Match.string, (str) => `Date string: ${str}`),
 *   Match.when(Match.number, (num) => `Timestamp: ${new Date(num).toISOString()}`),
 *   Match.orElse(() => "Not a date-related value")
 * )
 *
 * console.log(processDateValue(new Date('2024-01-01'))) // "Date: 2024-01-01"
 * console.log(processDateValue(new Date('invalid'))) // "Invalid date"
 * console.log(processDateValue('2024-01-01')) // "Date string: 2024-01-01"
 * console.log(processDateValue(1704067200000)) // "Timestamp: 2024-01-01T00:00:00.000Z"
 * ```
 *
 * @category predicates
 * @since 4.0.0
 */
export const date: Predicate.Refinement<unknown, Date> = Predicate.isDate

/**
 * Matches objects where keys are `string` or `symbol` and values are `unknown`.
 *
 * This predicate refines unknown values to record objects, allowing pattern
 * matching on plain objects. It excludes arrays, functions, dates, and other
 * special object types, matching only plain objects and object literals.
 *
 * @example
 * ```ts
 * import { Match } from "effect"
 *
 * const analyzeValue = Match.type<unknown>().pipe(
 *   Match.when(Match.record, (obj) => {
 *     const keys = Object.keys(obj)
 *     const valueCount = keys.length
 *     return `Object with ${valueCount} properties: [${keys.join(", ")}]`
 *   }),
 *   Match.when(Match.instanceOf(Array), (arr) => `Array with ${arr.length} items`),
 *   Match.when(Match.date, () => "Date object"),
 *   Match.orElse(() => "Not an object")
 * )
 *
 * console.log(analyzeValue({ name: "Alice", age: 30 }))
 * // "Object with 2 properties: [name, age]"
 * console.log(analyzeValue([1, 2, 3]))
 * // "Array with 3 items"
 * console.log(analyzeValue(new Date()))
 * // "Date object"
 * console.log(analyzeValue("hello"))
 * // "Not an object"
 * ```
 *
 * @category predicates
 * @since 4.0.0
 */
export const record: Predicate.Refinement<unknown, { [x: string | symbol]: unknown }> = Predicate.isRecord

/**
 * Matches instances of a given class.
 *
 * This predicate checks if a value is an instance of the specified constructor,
 * providing type-safe matching for class instances and built-in objects.
 *
 * @example
 * ```ts
 * import { Match } from "effect"
 *
 * class CustomError extends Error {
 *   constructor(message: string, public code: number) {
 *     super(message)
 *   }
 * }
 *
 * const handleValue = Match.type<unknown>()
 *   .pipe(
 *     Match.when(Match.instanceOf(CustomError), (err) =>
 *       `Custom error: ${err.message} (code: ${err.code})`
 *     ),
 *     Match.when(Match.instanceOf(Error), (err) =>
 *       `Standard error: ${err.message}`
 *     ),
 *     Match.when(Match.instanceOf(Date), (date) =>
 *       `Date: ${date.toISOString()}`
 *     ),
 *     Match.when(Match.instanceOf(Array), (arr) =>
 *       `Array with ${arr.length} items`
 *     ),
 *     Match.orElse((value) => `Other: ${typeof value}`)
 *   )
 *
 * console.log(handleValue(new CustomError("Failed", 404)))
 * // Output: "Custom error: Failed (code: 404)"
 *
 * console.log(handleValue(new Error("Generic error")))
 * // Output: "Standard error: Generic error"
 *
 * console.log(handleValue(new Date()))
 * // Output: "Date: 2024-01-01T00:00:00.000Z"
 *
 * console.log(handleValue([1, 2, 3]))
 * // Output: "Array with 3 items"
 * ```
 *
 * @category Predicates
 * @since 4.0.0
 */
export const instanceOf: <A extends abstract new(...args: any) => any>(
  constructor: A
) => SafeRefinement<InstanceType<A>, never> = internal.instanceOf

/**
 * Unsafe variant of `instanceOf` that allows matching without type narrowing.
 *
 * This predicate checks if a value is an instance of the specified constructor
 * but doesn't provide the same type safety guarantees as the regular `instanceOf`.
 * Use this when you need more flexibility but understand the type safety implications.
 *
 * @example
 * ```ts
 * import { Match } from "effect"
 *
 * class CustomError extends Error {
 *   constructor(message: string, public code: number) {
 *     super(message)
 *   }
 * }
 *
 * // When you need to match instances but handle type narrowing manually
 * const handleError = Match.type<unknown>().pipe(
 *   Match.when(Match.instanceOfUnsafe(CustomError), (err: any) => {
 *     // Manual type assertion needed
 *     const customErr = err as CustomError
 *     return `Custom error ${customErr.code}: ${customErr.message}`
 *   }),
 *   Match.orElse(() => "Not a CustomError")
 * )
 * ```
 *
 * @category predicates
 * @since 4.0.0
 */
export const instanceOfUnsafe: <A extends abstract new(...args: any) => any>(
  constructor: A
) => SafeRefinement<InstanceType<A>, InstanceType<A>> = internal.instanceOf

/**
 * Provides a fallback value when no patterns match.
 *
 * **Details**
 *
 * This function ensures that a matcher always returns a valid result, even if
 * no defined patterns match. It acts as a default case, similar to the
 * `default` clause in a `switch` statement or the final `else` in an `if-else`
 * chain.
 *
 * @example (Providing a Default Value When No Patterns Match)
 *
 * ```ts
 * import { Match } from "effect"
 *
 * // Create a matcher for string or number values
 * const match = Match.type<string | number>().pipe(
 *   // Match when the value is "a"
 *   Match.when("a", () => "ok"),
 *   // Fallback when no patterns match
 *   Match.orElse(() => "fallback")
 * )
 *
 * console.log(match("a"))
 * // Output: "ok"
 *
 * console.log(match("b"))
 * // Output: "fallback"
 * ```
 *
 * @category Completion
 * @since 4.0.0
 */
export const orElse: <RA, Ret, F extends (_: RA) => Ret>(
  f: F
) => <I, R, A, Pr>(
  self: Matcher<I, R, RA, A, Pr, Ret>
) => [Pr] extends [never] ? (input: I) => Unify<ReturnType<F> | A> : Unify<ReturnType<F> | A> = internal.orElse

// TODO(4.0): Rename to "orThrow"? Like Result.getOrThrow
/**
 * Throws an error if no pattern matches.
 *
 * **Details**
 *
 * This function finalizes a matcher by ensuring that if no patterns match, an
 * error is thrown. It is useful when all cases should be covered, and any
 * unexpected input should trigger an error instead of returning a default
 * value.
 *
 * When used, this function removes the need for an explicit fallback case and
 * ensures that an unmatched value is never silently ignored.
 *
 * @example
 * ```ts
 * import { Match } from "effect"
 *
 * const strictMatcher = Match.type<"a" | "b">().pipe(
 *   Match.when("a", () => "Found A"),
 *   Match.when("b", () => "Found B"),
 *   // Will throw if input is neither "a" nor "b"
 *   Match.orElseAbsurd
 * )
 *
 * console.log(strictMatcher("a")) // "Found A"
 * console.log(strictMatcher("b")) // "Found B"
 *
 * // This would throw an error at runtime:
 * // strictMatcher("c" as any) // throws
 * ```
 *
 * @category completion
 * @since 4.0.0
 */
export const orElseAbsurd: <I, R, RA, A, Pr, Ret>(
  self: Matcher<I, R, RA, A, Pr, Ret>
) => [Pr] extends [never] ? (input: I) => Unify<A> : Unify<A> = internal.orElseAbsurd

/**
 * Wraps the match result in a `Result`, distinguishing matched and unmatched
 * cases.
 *
 * **Details**
 *
 * This function ensures that the result of a matcher is always wrapped in an
 * `Result`, allowing clear differentiation between successful matches
 * (`Ok(value)`) and cases where no pattern matched (`Err(unmatched
 * value)`).
 *
 * This approach is particularly useful when handling optional values or when an
 * unmatched case should be explicitly handled rather than returning a default
 * value or throwing an error.
 *
 * @example (Extracting a User Role with `Match.result`)
 *
 * ```ts
 * import { Match } from "effect"
 *
 * type User = { readonly role: "admin" | "editor" | "viewer" }
 *
 * // Create a matcher to extract user roles
 * const getRole = Match.type<User>().pipe(
 *   Match.when({ role: "admin" }, () => "Has full access"),
 *   Match.when({ role: "editor" }, () => "Can edit content"),
 *   Match.result // Wrap the result in an Result
 * )
 *
 * console.log(getRole({ role: "admin" }))
 * // Output: { _id: 'Result', _tag: 'Ok', ok: 'Has full access' }
 *
 * console.log(getRole({ role: "viewer" }))
 * // Output: { _id: 'Result', _tag: 'Err', err: { role: 'viewer' } }
 * ```
 *
 * @category Completion
 * @since 4.0.0
 */
export const result: <I, F, R, A, Pr, Ret>(
  self: Matcher<I, F, R, A, Pr, Ret>
) => [Pr] extends [never] ? (input: I) => Result.Result<Unify<A>, R> : Result.Result<Unify<A>, R> = internal.result

/**
 * Wraps the match result in an `Option`, representing an optional match.
 *
 * **Details**
 *
 * This function ensures that the result of a matcher is wrapped in an `Option`,
 * making it easy to handle cases where no pattern matches. If a match is found,
 * it returns `Some(value)`, otherwise, it returns `None`.
 *
 * This is useful in cases where a missing match is expected and should be
 * handled explicitly rather than throwing an error or returning a default
 * value.
 *
 * @example (Extracting a User Role with `Match.option`)
 *
 * ```ts
 * import { Match } from "effect"
 *
 * type User = { readonly role: "admin" | "editor" | "viewer" }
 *
 * // Create a matcher to extract user roles
 * const getRole = Match.type<User>().pipe(
 *   Match.when({ role: "admin" }, () => "Has full access"),
 *   Match.when({ role: "editor" }, () => "Can edit content"),
 *   Match.option // Wrap the result in an Option
 * )
 *
 * console.log(getRole({ role: "admin" }))
 * // Output: { _id: 'Option', _tag: 'Some', value: 'Has full access' }
 *
 * console.log(getRole({ role: "viewer" }))
 * // Output: { _id: 'Option', _tag: 'None' }
 * ```
 *
 * @category Completion
 * @since 4.0.0
 */
export const option: <I, F, R, A, Pr, Ret>(
  self: Matcher<I, F, R, A, Pr, Ret>
) => [Pr] extends [never] ? (input: I) => Option.Option<Unify<A>> : Option.Option<Unify<A>> = internal.option

/**
 * The `Match.exhaustive` method finalizes the pattern matching process by
 * ensuring that all possible cases are accounted for. If any case is missing,
 * TypeScript will produce a type error. This is particularly useful when
 * working with unions, as it helps prevent unintended gaps in pattern matching.
 *
 * @example (Ensuring All Cases Are Covered)
 *
 * ```ts
 * import { Match } from "effect"
 *
 * // Create a matcher for string or number values
 * const match = Match.type<string | number>().pipe(
 *   // Match when the value is a number
 *   Match.when(Match.number, (n) => `number: ${n}`),
 *   // Mark the match as exhaustive, ensuring all cases are handled
 *   // TypeScript will throw an error if any case is missing
 *   // @ts-expect-error Type 'string' is not assignable to type 'never'
 *   Match.exhaustive
 * )
 * ```
 *
 * @category Completion
 * @since 4.0.0
 */
export const exhaustive: <I, F, A, Pr, Ret>(
  self: Matcher<I, F, never, A, Pr, Ret>
) => [Pr] extends [never] ? (u: I) => Unify<A> : Unify<A> = internal.exhaustive

/**
 * Unique identifier for `SafeRefinement` instances.
 *
 * This symbol serves as a type brand to distinguish `SafeRefinement` objects
 * from other predicates and functions, enabling better type checking and
 * runtime identification.
 *
 * @example
 * ```ts
 * import { Match } from "effect"
 *
 * // SafeRefinement predicates carry this identifier
 * const customPredicate = Match.string
 *
 * // Can be used to identify SafeRefinement instances
 * if (Match.SafeRefinementId in customPredicate) {
 *   console.log("This is a SafeRefinement")
 * }
 * ```
 *
 * @category symbols
 * @since 4.0.0
 */
export const SafeRefinementId: SafeRefinementId = "~effect/SafeRefinement"

/**
 * Type-level identifier for `SafeRefinement` instances.
 *
 * This type represents the unique symbol used to brand `SafeRefinement` objects,
 * ensuring type safety and proper discrimination from regular predicates.
 *
 * @example
 * ```ts
 * import { Match } from "effect"
 *
 * // SafeRefinementId is used in the type structure
 * type MySafeRefinement = {
 *   readonly [Match.SafeRefinementId]: (a: unknown) => string
 * }
 * ```
 *
 * @category symbols
 * @since 4.0.0
 */
export type SafeRefinementId = "~effect/SafeRefinement"

/**
 * A safe refinement that narrows types without runtime errors.
 *
 * `SafeRefinement` provides a way to refine types in pattern matching while
 * maintaining type safety. Unlike regular predicates, safe refinements can
 * transform the matched value's type without throwing runtime errors.
 *
 * @example
 * ```ts
 * import { Match } from "effect"
 *
 * // Built-in safe refinements
 * const processValue = Match.type<unknown>().pipe(
 *   Match.when(Match.string, (s) => s.toUpperCase()),
 *   Match.when(Match.number, (n) => n * 2),
 *   Match.when(Match.defined, (value) => `Defined: ${value}`),
 *   Match.orElse(() => "Undefined or null")
 * )
 *
 * console.log(processValue("hello")) // "HELLO"
 * console.log(processValue(21)) // 42
 * console.log(processValue(true)) // "Defined: true"
 * console.log(processValue(null)) // "Undefined or null"
 * ```
 *
 * @category models
 * @since 4.0.0
 */
export interface SafeRefinement<in A, out R = A> {
  readonly [SafeRefinementId]: (a: A) => R
}

const Fail = Symbol.for("effect/Fail")
type Fail = typeof Fail

/**
 * A namespace containing utility types for Match operations.
 *
 * This namespace provides advanced type-level utilities used internally by the
 * Match module to perform complex pattern matching, type narrowing, and filter
 * application. These types enable the sophisticated type inference that makes
 * pattern matching both type-safe and ergonomic.
 *
 * @example
 * ```ts
 * import { Match } from "effect"
 *
 * // Most users won't need to use Types directly, but it powers the type system:
 * type MyPattern = Match.Types.PatternBase<{ name: string; age: number }>
 * type MyWhenMatch = Match.Types.WhenMatch<string | number, typeof Match.string>
 *
 * // These types are used internally to provide accurate type inference
 * const matcher = Match.type<string | number>().pipe(
 *   Match.when(Match.string, (s) => s.length), // s is correctly typed as string
 *   Match.when(Match.number, (n) => n * 2),    // n is correctly typed as number
 *   Match.exhaustive
 * )
 * ```
 *
 * @category types
 * @since 4.0.0
 */
export declare namespace Types {
  /**
   * Computes the matched type when a pattern P is applied to type R.
   *
   * This utility type determines what type a value will have after successfully
   * matching against a pattern. It handles refinements, predicates, and complex
   * object patterns to provide accurate type narrowing.
   *
   * @example
   * ```ts
   * import { Match } from "effect"
   *
   * // WhenMatch computes the narrowed type after pattern matching
   * type StringMatch = Match.Types.WhenMatch<string | number, typeof Match.string>
   * // Result: string
   *
   * type ObjectMatch = Match.Types.WhenMatch<
   *   { type: "user"; name: string } | { type: "admin"; permissions: string[] },
   *   { type: "user" }
   * >
   * // Result: { type: "user"; name: string }
   * ```
   *
   * @category types
   * @since 4.0.0
   */
  export type WhenMatch<R, P> =
    // check for any
    [0] extends [1 & R] ? ResolvePred<P> :
      P extends SafeRefinement<infer SP, never> ? SP
      : P extends Predicate.Refinement<infer _R, infer RP>
      // try to narrow refinement
        ? [Extract<R, RP>] extends [infer X] ? [X] extends [never]
            // fallback to original refinement
            ? RP
          : X
        : never
      : P extends PredicateA<infer PP> ? PP
      : ExtractMatch<R, P>

  /**
   * Computes the remaining type when a pattern P is excluded from type R.
   *
   * This utility type determines what type remains after a `Match.not` pattern
   * excludes certain values. It's the complement of `WhenMatch`, calculating
   * what's left after removing the matched portion.
   *
   * @example
   * ```ts
   * import { Match } from "effect"
   *
   * // NotMatch computes what remains after exclusion
   * type NotString = Match.Types.NotMatch<string | number | boolean, typeof Match.string>
   * // Result: number | boolean
   *
   * type NotSpecificValue = Match.Types.NotMatch<"a" | "b" | "c", "a">
   * // Result: "b" | "c"
   * ```
   *
   * @category types
   * @since 4.0.0
   */
  export type NotMatch<R, P> = Exclude<R, ExtractMatch<R, PForNotMatch<P>>>

  type PForNotMatch<P> = [ToInvertedRefinement<P>] extends [infer X] ? X
    : never

  /**
   * Resolves a pattern to its matched type for use in type computations.
   *
   * This utility type processes patterns (predicates, refinements, objects)
   * and resolves them to their corresponding matched types. It's used internally
   * to compute type transformations during pattern matching.
   *
   * @example
   * ```ts
   * import { Match } from "effect"
   *
   * // PForMatch resolves patterns to their matched types
   * type StringPattern = Match.Types.PForMatch<typeof Match.string>
   * // Result: string
   *
   * type ObjectPattern = Match.Types.PForMatch<{ name: string }>
   * // Result: { name: string }
   * ```
   *
   * @category types
   * @since 4.0.0
   */
  export type PForMatch<P> = [ResolvePred<P>] extends [infer X] ? X
    : never

  /**
   * Computes the excluded type when a pattern P is used for exclusion.
   *
   * This utility type determines what should be excluded from a union type
   * when a pattern is used in filtering operations. It transforms patterns
   * into their exclusion-safe representations.
   *
   * @example
   * ```ts
   * import { Match } from "effect"
   *
   * // PForExclude computes what to exclude from type operations
   * type ExcludeString = Match.Types.PForExclude<typeof Match.string>
   * // Used internally to filter out string types
   *
   * type ExcludeObject = Match.Types.PForExclude<{ type: "admin" }>
   * // Used internally to filter out admin objects
   * ```
   *
   * @category types
   * @since 4.0.0
   */
  export type PForExclude<P> = [SafeRefinementR<ToSafeRefinement<P>>] extends [infer X] ? X
    : never

  // utilities
  type PredicateA<A> = Predicate.Predicate<A> | Predicate.Refinement<A, A>

  type SafeRefinementR<A> = A extends never ? never
    : A extends SafeRefinement<infer _, infer R> ? R
    : A extends Function ? A
    : A extends Record<string, any> ? { [K in keyof A]: SafeRefinementR<A[K]> }
    : A

  type ResolvePred<A, Input = any> = A extends never ? never
    : A extends SafeRefinement<infer _A, infer _R> ? _A
    : A extends Predicate.Refinement<Input, infer P> ? P
    : A extends Predicate.Predicate<infer P> ? P
    : A extends Record<string, any> ? { [K in keyof A]: ResolvePred<A[K]> }
    : A

  type ToSafeRefinement<A> = A extends never ? never
    : A extends Predicate.Refinement<any, infer P> ? SafeRefinement<P, P>
    : A extends Predicate.Predicate<infer P> ? SafeRefinement<P, never>
    : A extends SafeRefinement<any> ? A
    : A extends Record<string, any> ? { [K in keyof A]: ToSafeRefinement<A[K]> }
    : NonLiteralsTo<A, never>

  type ToInvertedRefinement<A> = A extends never ? never
    : A extends Predicate.Refinement<any, infer P> ? SafeRefinement<P>
    : A extends Predicate.Predicate<infer _P> ? SafeRefinement<never>
    : A extends SafeRefinement<infer _A, infer _R> ? SafeRefinement<_R>
    : A extends Record<string, any> ? { [K in keyof A]: ToInvertedRefinement<A[K]> }
    : NonLiteralsTo<A, never>

  type NonLiteralsTo<A, T> = [A] extends [string | number | boolean | bigint] ? [string] extends [A] ? T
    : [number] extends [A] ? T
    : [boolean] extends [A] ? T
    : [bigint] extends [A] ? T
    : A
    : A

  /**
   * Defines the structure for complex object and array patterns.
   *
   * This type represents patterns that can match against complex data structures
   * like objects and arrays. It supports nested pattern matching and partial
   * object matching, enabling sophisticated pattern compositions.
   *
   * @example
   * ```ts
   * import { Match } from "effect"
   *
   * // PatternBase enables complex object patterns
   * type UserPattern = Match.Types.PatternBase<{
   *   name: string
   *   age: number
   *   role: "admin" | "user"
   * }>
   * // Allows: { name?: string | Predicate, age?: number | Predicate, ... }
   *
   * // Example usage:
   * Match.value({ name: "Alice", age: 30, role: "admin" as const }).pipe(
   *   Match.when({ age: (n: number) => n >= 18, role: "admin" }, (user: { name: string; age: number; role: "admin" }) => `Admin: ${user.name}`),
   *   Match.orElse(() => "Not an adult admin")
   * )
   * ```
   *
   * @category types
   * @since 4.0.0
   */
  export type PatternBase<A> = A extends ReadonlyArray<infer _T> ? ReadonlyArray<any> | PatternPrimitive<A>
    : A extends Record<string, any> ? Partial<
        { [K in keyof A]: PatternPrimitive<A[K] & {}> | PatternBase<A[K] & {}> }
      >
    : never

  /**
   * Defines primitive patterns that can match simple values.
   *
   * This type represents the building blocks of pattern matching: predicates,
   * literal values, and safe refinements. These are the atomic patterns that
   * can be composed into more complex matching logic.
   *
   * @example
   * ```ts
   * import { Match } from "effect"
   *
   * // PatternPrimitive includes various pattern types:
   *
   * // Literal values
   * Match.when("exact", () => "matched exact")
   * Match.when(42, () => "matched number")
   *
   * // Predicates
   * Match.when(Match.string, (s) => `string: ${s}`)
   * Match.when((x: number) => x > 10, (n: number) => `large number: ${n}`)
   *
   * // Custom refinements
   * Match.when(Match.defined, (value) => `defined: ${value}`)
   * ```
   *
   * @category types
   * @since 4.0.0
   */
  export type PatternPrimitive<A> = PredicateA<A> | A | SafeRefinement<any>

  /**
   * Represents a filter that excludes specific types from a union.
   *
   * `Without` is used internally to track which types should be excluded
   * from consideration during pattern matching. It helps implement the
   * type-level logic for `Match.not` and other exclusion operations.
   *
   * @example
   * ```ts
   * import { Match } from "effect"
   *
   * // Without is used internally when you write:
   * Match.type<string | number | boolean>().pipe(
   *   Match.not(Match.string, (value) => `not string: ${value}`),
   *   // At this point, type system uses Without<string> to track exclusion
   *   Match.orElse(() => "was a string")
   * )
   * ```
   *
   * @category types
   * @since 4.0.0
   */
  export interface Without<out X> {
    readonly _tag: "Without"
    readonly _X: X
  }

  /**
   * Represents a filter that includes only specific types from a union.
   *
   * `Only` is used internally to track which types should be exclusively
   * considered during pattern matching. It helps implement the type-level
   * logic for positive matches and type narrowing.
   *
   * @example
   * ```ts
   * import { Match } from "effect"
   *
   * // Only is used internally when you write:
   * Match.type<string | number | boolean>().pipe(
   *   Match.when(Match.string, (s) => `string: ${s}`),
   *   // At this point, type system uses Only<string> for the match
   *   Match.orElse((value) => `not string: ${value}`)
   * )
   * ```
   *
   * @category types
   * @since 4.0.0
   */
  export interface Only<out X> {
    readonly _tag: "Only"
    readonly _X: X
  }

  /**
   * Adds a type to the exclusion filter, expanding what should be filtered out.
   *
   * This utility type manages the accumulation of excluded types during
   * pattern matching. When multiple exclusions are applied, it combines
   * them into a single filter representation.
   *
   * @example
   * ```ts
   * import { Match } from "effect"
   *
   * // AddWithout is used when combining multiple exclusions:
   * Match.type<string | number | boolean | null>().pipe(
   *   Match.not(Match.string, () => "not string"),
   *   Match.not(Match.number, () => "not number"),
   *   // Type system uses AddWithout to combine exclusions
   *   Match.orElse(() => "was string or number")
   * )
   * ```
   *
   * @category types
   * @since 4.0.0
   */
  export type AddWithout<A, X> = [A] extends [Without<infer WX>] ? Without<X | WX>
    : [A] extends [Only<infer OX>] ? Only<Exclude<OX, X>>
    : never

  /**
   * Adds a type to the inclusion filter, refining what should be included.
   *
   * This utility type manages the refinement of included types during
   * pattern matching. It ensures that only the most specific type
   * constraints are maintained when multiple positive matches are applied.
   *
   * @example
   * ```ts
   * import { Match } from "effect"
   *
   * // AddOnly is used when refining positive matches:
   * Match.type<{ type: "user" | "admin"; name: string }>().pipe(
   *   Match.when({ type: "admin" }, (admin) => admin.name),
   *   // Type system uses AddOnly to refine the constraint
   *   Match.orElse(() => "not admin")
   * )
   * ```
   *
   * @category types
   * @since 4.0.0
   */
  export type AddOnly<A, X> = [A] extends [Without<infer WX>] ? [X] extends [WX] ? never
    : Only<X>
    : [A] extends [Only<infer OX>] ? [X] extends [OX] ? Only<X>
      : never
    : never

  /**
   * Applies accumulated filters to an input type, producing the final narrowed type.
   *
   * This utility type takes the collected inclusion/exclusion filters and
   * applies them to the input type to compute the final narrowed result.
   * It's the culmination of the type-level filtering process.
   *
   * @example
   * ```ts
   * import { Match } from "effect"
   *
   * // ApplyFilters computes the final narrowed type:
   * type Result = Match.Types.ApplyFilters<
   *   string | number | boolean,
   *   Match.Types.Only<string>
   * >
   * // Result: string
   *
   * type ExclusionResult = Match.Types.ApplyFilters<
   *   string | number | boolean,
   *   Match.Types.Without<string>
   * >
   * // Result: number | boolean
   * ```
   *
   * @category types
   * @since 4.0.0
   */
  export type ApplyFilters<I, A> = A extends Only<infer X> ? X
    : A extends Without<infer X> ? Exclude<I, X>
    : never

  /**
   * Extracts tag values from a discriminated union based on a discriminant field.
   *
   * This utility type extracts the possible values of a discriminant field
   * from a union type. It's used internally to implement tag-based pattern
   * matching for discriminated unions.
   *
   * @example
   * ```ts
   * import { Match } from "effect"
   *
   * type Events =
   *   | { _tag: "click"; x: number; y: number }
   *   | { _tag: "keypress"; key: string }
   *   | { _tag: "scroll"; delta: number }
   *
   * type EventTags = Match.Types.Tags<"_tag", Events>
   * // Result: "click" | "keypress" | "scroll"
   *
   * type CustomTags = Match.Types.Tags<"type",
   *   | { type: "user"; name: string }
   *   | { type: "admin"; permissions: string[] }
   * >
   * // Result: "user" | "admin"
   * ```
   *
   * @category types
   * @since 4.0.0
   */
  export type Tags<D extends string, P> = P extends Record<D, infer X> ? X : never

  /**
   * Converts an array type to an intersection of its element types.
   *
   * This utility type takes an array of types and converts them into a single
   * intersection type. It's used internally when multiple patterns need to
   * be satisfied simultaneously (like in `Match.whenAnd`).
   *
   * @example
   * ```ts
   * import { Match } from "effect"
   *
   * type Combined = Match.Types.ArrayToIntersection<[
   *   { name: string },
   *   { age: number },
   *   { active: boolean }
   * ]>
   * // Result: { name: string } & { age: number } & { active: boolean }
   * //         = { name: string; age: number; active: boolean }
   *
   * // This type utility enables complex type intersections
   * // Complex type operations are handled by this utility type
   * // for advanced pattern matching scenarios
   * ```
   *
   * @category types
   * @since 4.0.0
   */
  export type ArrayToIntersection<A extends ReadonlyArray<any>> = T.UnionToIntersection<
    A[number]
  >

  /**
   * Extracts and narrows the matched type from an input type given a pattern.
   *
   * This is the core type utility that performs the actual type extraction
   * and narrowing logic. It handles the complex type-level computation that
   * determines what type results from applying a pattern to an input type.
   *
   * @example
   * ```ts
   * import { Match } from "effect"
   *
   * type StringExtract = Match.Types.ExtractMatch<
   *   string | number | boolean,
   *   typeof Match.string
   * >
   * // Result: string
   *
   * type ObjectExtract = Match.Types.ExtractMatch<
   *   { type: "user"; name: string } | { type: "admin"; role: string },
   *   { type: "user" }
   * >
   * // Result: { type: "user"; name: string }
   *
   * // This powers the type narrowing in:
   * Match.when(Match.string, (s) => s.toUpperCase())
   * //                      ^^^ s is correctly typed as string
   * ```
   *
   * @category types
   * @since 4.0.0
   */
  export type ExtractMatch<I, P> = [ExtractAndNarrow<I, P>] extends [infer EI] ? EI
    : never

  type Replace<A, B> = A extends Function ? A
    : A extends Record<string | number, any> ? { [K in keyof A]: K extends keyof B ? Replace<A[K], B[K]> : A[K] }
    : [B] extends [A] ? B
    : A

  type MaybeReplace<I, P> = [P] extends [I] ? P
    : [I] extends [P] ? Replace<I, P>
    : Fail

  type BuiltInObjects =
    | Function
    | Date
    | RegExp
    | Generator
    | { readonly [Symbol.toStringTag]: string }

  type IsPlainObject<T> = T extends BuiltInObjects ? false
    : T extends Record<string, any> ? true
    : false

  type Simplify<A> = { [K in keyof A]: A[K] } & {}

  type ExtractAndNarrow<Input, P> = P extends Predicate.Refinement<infer _In, infer _Out> ?
    _Out extends Input ? Extract<_Out, Input>
    : Extract<Input, _Out> :
    P extends SafeRefinement<infer _In, infer _R> ? [0] extends [1 & _R] ? Input
      : _In extends Input ? Extract<_In, Input>
      : Extract<Input, _In>
    : P extends Predicate.Predicate<infer _In> ? Extract<Input, _In>
    : Input extends infer I ? Exclude<
        I extends ReadonlyArray<any> ? P extends ReadonlyArray<any> ? {
              readonly [K in keyof I]: K extends keyof P ? ExtractAndNarrow<I[K], P[K]>
                : I[K]
            } extends infer R ? Fail extends R[keyof R] ? never
              : R
            : never
          : never
          : IsPlainObject<I> extends true ? string extends keyof I ? I extends P ? I
              : never
            : symbol extends keyof I ? I extends P ? I
              : never
            : Simplify<
              & { [RK in Extract<keyof I, keyof P>]-?: ExtractAndNarrow<I[RK], P[RK]> }
              & Omit<I, keyof P>
            > extends infer R ? keyof P extends NonFailKeys<R> ? R
              : never
            : never
          : MaybeReplace<I, P> extends infer R ? [I] extends [R] ? I
            : R
          : never,
        Fail
      > :
    never

  type NonFailKeys<A> = keyof A & {} extends infer K ? K extends keyof A ? A[K] extends Fail ? never : K
    : never :
    never
}
