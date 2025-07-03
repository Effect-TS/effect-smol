/**
 * This module provides utilities for creating and working with filters in TypeScript.
 *
 * Filters are functions that can selectively pass through values while potentially
 * transforming them. They are similar to predicates but can also refine types and
 * transform values during the filtering process.
 *
 * The key concept is the `absent` symbol, which represents values that should be
 * filtered out. Filters return either a transformed value or `absent` to indicate
 * that the input should be excluded from the result.
 *
 * @example
 * ```ts
 * import { Filter } from "effect"
 *
 * // Create a simple number filter
 * const positiveNumbers = Filter.fromPredicate((n: number) => n > 0)
 *
 * console.log(positiveNumbers(5))   // 5
 * console.log(positiveNumbers(-3))  // Symbol.for("effect/Filter/absent")
 *
 * // Combine filters
 * const evenPositive = Filter.zip(
 *   Filter.fromPredicate((n: number) => n > 0),
 *   Filter.fromPredicate((n: number) => n % 2 === 0)
 * )
 * ```
 *
 * @since 4.0.0
 */
import type { Effect } from "./Effect.js"
import * as Equal from "./Equal.js"
import { dual } from "./Function.js"
import * as Predicate from "./Predicate.js"

/**
 * Represents a filter function that can transform inputs to outputs or filter them out.
 *
 * A filter takes an input value and either returns a transformed output value or
 * the special `absent` symbol to indicate the value should be filtered out.
 *
 * @example
 * ```ts
 * import { Filter } from "effect"
 *
 * // A filter that only passes positive numbers
 * const positiveFilter: Filter.Filter<number, number> = (n) =>
 *   n > 0 ? n : Filter.absent
 *
 * console.log(positiveFilter(5))   // 5
 * console.log(positiveFilter(-3))  // Symbol.for("effect/Filter/absent")
 * ```
 *
 * @since 4.0.0
 * @category Models
 */
export interface Filter<in Input, out Output = Input> {
  (input: Input): Output | absent
}

/**
 * Represents an effectful filter function that can produce Effects.
 *
 * Similar to a regular Filter, but the filtering operation itself can be effectful,
 * allowing for asynchronous operations, error handling, and dependency injection.
 *
 * @example
 * ```ts
 * import { Effect, Filter } from "effect"
 *
 * // An effectful filter that validates against a service
 * const validateUser: Filter.FilterEffect<string, User, ValidationError, UserService> = (id) =>
 *   Effect.gen(function* () {
 *     const userService = yield* UserService
 *     const user = yield* userService.findById(id)
 *     return user.isActive ? user : Filter.absent
 *   })
 * ```
 *
 * @since 4.0.0
 * @category Models
 */
export interface FilterEffect<in Input, out Output, out E = never, out R = never> {
  (input: Input): Effect<Output | absent, E, R>
}

/**
 * A unique symbol representing the absence of a value in filter operations.
 *
 * When a filter function returns this symbol, it indicates that the input value
 * should be excluded from the filtered result. This provides a type-safe way
 * to represent "no value" without using null or undefined.
 *
 * @example
 * ```ts
 * import { Filter } from "effect"
 *
 * const evenNumbers = (n: number) => n % 2 === 0 ? n : Filter.absent
 *
 * console.log(evenNumbers(4))  // 4
 * console.log(evenNumbers(3))  // Symbol.for("effect/Filter/absent")
 * console.log(evenNumbers(3) === Filter.absent)  // true
 * ```
 *
 * @since 4.0.0
 * @category absent
 */
export const absent: unique symbol = Symbol.for("effect/Filter/absent")

/**
 * @since 4.0.0
 * @category absent
 */
export type absent = typeof absent

/**
 * @since 4.0.0
 * @category absent
 */
export type WithoutAbsent<A> = Exclude<A, absent>

/**
 * Creates a Filter from a function that returns either a value or absent.
 *
 * This is the primary constructor for creating custom filters. The function
 * should return either a transformed value or the `absent` symbol to indicate
 * the input should be filtered out.
 *
 * @example
 * ```ts
 * import { Filter } from "effect"
 *
 * // Create a filter for positive numbers
 * const positiveFilter = Filter.make((n: number) =>
 *   n > 0 ? n : Filter.absent
 * )
 *
 * // Create a filter that transforms strings to uppercase
 * const uppercaseFilter = Filter.make((s: string) =>
 *   s.length > 0 ? s.toUpperCase() : Filter.absent
 * )
 *
 * console.log(positiveFilter(5))     // 5
 * console.log(positiveFilter(-1))    // Symbol.for("effect/Filter/absent")
 * console.log(uppercaseFilter("hi")) // "HI"
 * ```
 *
 * @since 4.0.0
 * @category Constructors
 */
export const make = <Input, Output>(f: (input: Input) => Output | absent): Filter<Input, WithoutAbsent<Output>> =>
  f as any

/**
 * Creates an effectful Filter from a function that returns an Effect.
 *
 * This constructor is used when the filtering operation needs to perform
 * effectful computations, such as async operations, error handling, or
 * accessing services from the environment.
 *
 * @example
 * ```ts
 * import { Effect, Filter } from "effect"
 *
 * // Create an effectful filter that validates async
 * const asyncValidate = Filter.makeEffect((id: string) =>
 *   Effect.gen(function* () {
 *     const isValid = yield* validateAsync(id)
 *     return isValid ? id : Filter.absent
 *   })
 * )
 *
 * // Use in Effect context
 * const program = Effect.gen(function* () {
 *   const result = yield* asyncValidate("user123")
 *   console.log(result) // "user123" or absent
 * })
 * ```
 *
 * @since 4.0.0
 * @category Constructors
 */
export const makeEffect = <Input, Output, E, R>(
  f: (input: Input) => Effect<Output | absent, E, R>
): FilterEffect<Input, WithoutAbsent<Output>, E, R> => f as any

/**
 * Creates a Filter from a predicate or refinement function.
 *
 * This is a convenient way to create filters from boolean-returning functions.
 * When the predicate returns true, the input value is passed through unchanged.
 * When it returns false, the `absent` symbol is returned.
 *
 * @example
 * ```ts
 * import { Filter } from "effect"
 *
 * // Create filter from predicate
 * const positiveNumbers = Filter.fromPredicate((n: number) => n > 0)
 * const nonEmptyStrings = Filter.fromPredicate((s: string) => s.length > 0)
 *
 * // Type refinement
 * const isString = Filter.fromPredicate((x: unknown): x is string => typeof x === "string")
 *
 * console.log(positiveNumbers(5))    // 5
 * console.log(positiveNumbers(-1))   // absent
 * console.log(isString("hello"))     // "hello" (typed as string)
 * console.log(isString(42))          // absent
 * ```
 *
 * @since 4.0.0
 * @category Constructors
 */
export const fromPredicate: {
  <A, B extends A>(refinement: Predicate.Refinement<A, B>): Filter<A, B>
  <A>(predicate: Predicate.Predicate<A>): Filter<A, A>
} = <A, B extends A = A>(predicate: Predicate.Predicate<A> | Predicate.Refinement<A, B>): Filter<A, B> => (input) =>
  predicate(input) ? input as B : absent

/**
 * Converts a Filter into a predicate function.
 *
 * This is useful when you need a boolean-returning function that tells you
 * whether a Filter would accept or reject a given input, without actually
 * performing the transformation.
 *
 * @example
 * ```ts
 * import { Filter } from "effect"
 *
 * const positiveFilter = Filter.fromPredicate((n: number) => n > 0)
 * const isPositive = Filter.toPredicate(positiveFilter)
 *
 * console.log(isPositive(5))   // true
 * console.log(isPositive(-1))  // false
 *
 * // Use with array methods
 * const numbers = [1, -2, 3, -4, 5]
 * const positiveCount = numbers.filter(isPositive).length // 3
 * ```
 *
 * @since 4.0.0
 * @category Constructors
 */
export const toPredicate = <A, B>(
  self: Filter<A, B>
): Predicate.Predicate<A> =>
(input: A) => self(input) !== absent

/**
 * A predefined filter that only passes through string values.
 *
 * This filter accepts any unknown value and only allows strings to pass through,
 * filtering out all other types. It's useful for type-safe string extraction
 * from mixed-type data.
 *
 * @example
 * ```ts
 * import { Filter } from "effect"
 *
 * console.log(Filter.string("hello"))  // "hello"
 * console.log(Filter.string(42))       // absent
 * console.log(Filter.string(true))     // absent
 * console.log(Filter.string(null))     // absent
 *
 * // Use with arrays of mixed types
 * const mixed = ["a", 1, "b", true, "c"]
 * const strings = mixed.map(Filter.string).filter(x => x !== Filter.absent)
 * console.log(strings) // ["a", "b", "c"]
 * ```
 *
 * @since 4.0.0
 * @category Constructors
 */
export const string: Filter<unknown, string> = fromPredicate(Predicate.isString)

/**
 * A predefined filter that only passes through number values.
 *
 * This filter accepts any unknown value and only allows numbers to pass through,
 * filtering out all other types including NaN. It's useful for type-safe number
 * extraction from mixed-type data.
 *
 * @example
 * ```ts
 * import { Filter } from "effect"
 *
 * console.log(Filter.number(42))       // 42
 * console.log(Filter.number(3.14))     // 3.14
 * console.log(Filter.number("42"))     // absent
 * console.log(Filter.number(true))     // absent
 * console.log(Filter.number(NaN))      // absent
 *
 * // Extract numbers from mixed array
 * const mixed = [1, "2", 3, true, 4.5]
 * const numbers = mixed.map(Filter.number).filter(x => x !== Filter.absent)
 * console.log(numbers) // [1, 3, 4.5]
 * ```
 *
 * @since 4.0.0
 * @category Combinators
 */
export const strictEquals = <const A>(value: A): Filter<unknown, A> => (u) => u === value ? value : absent

/**
 * @since 4.0.0
 * @category Combinators
 */
export const equals = <const A>(value: A): Filter<unknown, A> => (u) => Equal.equals(u, value) ? value : absent

/**
 * @since 4.0.0
 * @category Constructors
 */
export const number: Filter<unknown, number> = fromPredicate(Predicate.isNumber)

/**
 * A predefined filter that only passes through boolean values.
 *
 * This filter accepts any unknown value and only allows true boolean values
 * to pass through, filtering out all other types including truthy/falsy values
 * that aren't actual booleans.
 *
 * @example
 * ```ts
 * import { Filter } from "effect"
 *
 * console.log(Filter.boolean(true))    // true
 * console.log(Filter.boolean(false))   // false
 * console.log(Filter.boolean(1))       // absent
 * console.log(Filter.boolean(0))       // absent
 * console.log(Filter.boolean("true"))  // absent
 *
 * // Extract booleans from mixed array
 * const mixed = [true, 1, false, "yes", 0]
 * const booleans = mixed.map(Filter.boolean).filter(x => x !== Filter.absent)
 * console.log(booleans) // [true, false]
 * ```
 *
 * @since 4.0.0
 * @category Constructors
 */
export const boolean: Filter<unknown, boolean> = fromPredicate(Predicate.isBoolean)

/**
 * A predefined filter that only passes through BigInt values.
 *
 * This filter accepts any unknown value and only allows BigInt values to pass
 * through, filtering out regular numbers and all other types.
 *
 * @example
 * ```ts
 * import { Filter } from "effect"
 *
 * console.log(Filter.bigint(123n))         // 123n
 * console.log(Filter.bigint(BigInt(456)))  // 456n
 * console.log(Filter.bigint(123))          // absent
 * console.log(Filter.bigint("123"))        // absent
 *
 * // Extract BigInts from mixed array
 * const mixed = [123n, 456, 789n, "1000"]
 * const bigints = mixed.map(Filter.bigint).filter(x => x !== Filter.absent)
 * console.log(bigints) // [123n, 789n]
 * ```
 *
 * @since 4.0.0
 * @category Constructors
 */
export const bigint: Filter<unknown, bigint> = fromPredicate(Predicate.isBigInt)

/**
 * A predefined filter that only passes through Symbol values.
 *
 * This filter accepts any unknown value and only allows Symbol values to pass
 * through, filtering out all other types.
 *
 * @example
 * ```ts
 * import { Filter } from "effect"
 *
 * const sym1 = Symbol("test")
 * const sym2 = Symbol.for("global")
 *
 * console.log(Filter.symbol(sym1))         // Symbol(test)
 * console.log(Filter.symbol(sym2))         // Symbol.for(global)
 * console.log(Filter.symbol("symbol"))     // absent
 * console.log(Filter.symbol(123))          // absent
 *
 * // Extract symbols from mixed array
 * const mixed = [sym1, "text", sym2, 42]
 * const symbols = mixed.map(Filter.symbol).filter(x => x !== Filter.absent)
 * console.log(symbols) // [Symbol(test), Symbol.for(global)]
 * ```
 *
 * @since 4.0.0
 * @category Constructors
 */
export const symbol: Filter<unknown, symbol> = fromPredicate(Predicate.isSymbol)

/**
 * A predefined filter that only passes through Date objects.
 *
 * This filter accepts any unknown value and only allows Date instances to pass
 * through, filtering out date strings, timestamps, and all other types.
 *
 * @example
 * ```ts
 * import { Filter } from "effect"
 *
 * const now = new Date()
 * const epoch = new Date(0)
 *
 * console.log(Filter.date(now))            // Date object
 * console.log(Filter.date(epoch))          // Date object
 * console.log(Filter.date("2023-01-01"))   // absent
 * console.log(Filter.date(1640995200000))  // absent
 *
 * // Extract dates from mixed array
 * const mixed = [now, "2023-01-01", epoch, 123456789]
 * const dates = mixed.map(Filter.date).filter(x => x !== Filter.absent)
 * console.log(dates) // [now, epoch]
 * ```
 *
 * @since 4.0.0
 * @category Constructors
 */
export const date: Filter<unknown, Date> = fromPredicate(Predicate.isDate)

/**
 * Combines two filters with logical OR semantics.
 *
 * This operator tries the first filter, and if it returns `absent`, tries the
 * second filter. The first successful result is returned. This is useful for
 * creating fallback filtering logic.
 *
 * @example
 * ```ts
 * import { Filter } from "effect"
 *
 * const positiveNumbers = Filter.fromPredicate((n: number) => n > 0)
 * const evenNumbers = Filter.fromPredicate((n: number) => n % 2 === 0)
 *
 * // Accept numbers that are either positive OR even
 * const positiveOrEven = Filter.or(positiveNumbers, evenNumbers)
 *
 * console.log(positiveOrEven(5))   // 5 (positive)
 * console.log(positiveOrEven(-4))  // -4 (even)
 * console.log(positiveOrEven(-3))  // absent (neither)
 *
 * // With different output types
 * const stringFilter = Filter.string
 * const numberFilter = Filter.number
 * const stringOrNumber = Filter.or(stringFilter, numberFilter)
 * ```
 *
 * @since 4.0.0
 * @category Combinators
 */
export const or: {
  <Input2, Output2>(
    that: Filter<Input2, Output2>
  ): <Input1, Output1>(self: Filter<Input1, Output1>) => Filter<Input1 & Input2, Output1 | Output2>
  <Input1, Output1, Input2, Output2>(
    self: Filter<Input1, Output1>,
    that: Filter<Input2, Output2>
  ): Filter<Input1 & Input2, Output1 | Output2>
} = dual(2, <Input1, Output1, Input2, Output2>(
  self: Filter<Input1, Output1>,
  that: Filter<Input2, Output2>
): Filter<Input1 & Input2, Output1 | Output2> =>
(input) => {
  const selfResult = self(input)
  return selfResult !== absent ? selfResult : that(input)
})

/**
 * Combines two filters and applies a function to their results.
 *
 * Both filters must succeed (not return `absent`) for the combination to succeed.
 * If both filters pass, their outputs are combined using the provided function.
 * This is useful for creating complex validation and transformation pipelines.
 *
 * @example
 * ```ts
 * import { Filter } from "effect"
 *
 * const positiveNumbers = Filter.fromPredicate((n: number) => n > 0)
 * const evenNumbers = Filter.fromPredicate((n: number) => n % 2 === 0)
 *
 * // Combine results with a function
 * const positiveEvenSum = Filter.zipWith(
 *   positiveNumbers,
 *   evenNumbers,
 *   (pos, even) => pos + even
 * )
 *
 * console.log(positiveEvenSum(4))  // 8 (4 + 4, both filters pass)
 * console.log(positiveEvenSum(3))  // absent (3 is positive but not even)
 * console.log(positiveEvenSum(-2)) // absent (-2 is even but not positive)
 *
 * // Create validation messages
 * const required = Filter.fromPredicate((s: string) => s.length > 0)
 * const maxLength = Filter.fromPredicate((s: string) => s.length <= 10)
 * const validate = Filter.zipWith(required, maxLength, (a, b) => `Valid: ${a}`)
 * ```
 *
 * @since 4.0.0
 * @category Combinators
 */
export const zipWith: {
  <InputR, OutputR, OutputL, A>(
    right: Filter<InputR, OutputR>,
    f: (left: OutputL, right: OutputR) => A
  ): <InputL>(left: Filter<InputL, OutputL>) => Filter<InputL & InputR, A>
  <InputL, OutputL, InputR, OutputR, A>(
    left: Filter<InputL, OutputL>,
    right: Filter<InputR, OutputR>,
    f: (left: OutputL, right: OutputR) => A
  ): Filter<InputL & InputR, A>
} = dual(3, <InputL, OutputL, InputR, OutputR, A>(
  left: Filter<InputL, OutputL>,
  right: Filter<InputR, OutputR>,
  f: (left: OutputL, right: OutputR) => A
): Filter<InputL & InputR, A> =>
(input) => {
  const leftResult = left(input)
  if (leftResult === absent) return absent
  const rightResult = right(input)
  if (rightResult === absent) return absent
  return f(leftResult, rightResult)
})

/**
 * Combines two filters into a tuple of their results.
 *
 * Both filters must succeed for the combination to succeed. If both pass,
 * their outputs are combined into a tuple. This is a specialized version
 * of `zipWith` that creates tuples.
 *
 * @example
 * ```ts
 * import { Filter } from "effect"
 *
 * const positiveNumbers = Filter.fromPredicate((n: number) => n > 0)
 * const evenNumbers = Filter.fromPredicate((n: number) => n % 2 === 0)
 *
 * // Combine into tuple
 * const positiveAndEven = Filter.zip(positiveNumbers, evenNumbers)
 *
 * console.log(positiveAndEven(4))  // [4, 4] (both filters pass)
 * console.log(positiveAndEven(3))  // absent (not even)
 * console.log(positiveAndEven(-2)) // absent (not positive)
 *
 * // Different types
 * const stringFilter = Filter.string
 * const numberToString = Filter.make((n: number) => n.toString())
 * const combined = Filter.zip(stringFilter, numberToString)
 * // Type: Filter<string & number, [string, string]>
 * ```
 *
 * @since 4.0.0
 * @category Combinators
 */
export const zip: {
  <InputR, OutputR>(
    right: Filter<InputR, OutputR>
  ): <InputL, OutputL>(left: Filter<InputL, OutputL>) => Filter<InputL & InputR, [OutputL, OutputR]>
  <InputL, OutputL, InputR, OutputR>(
    left: Filter<InputL, OutputL>,
    right: Filter<InputR, OutputR>
  ): Filter<InputL & InputR, [OutputL, OutputR]>
} = dual(2, <InputL, OutputL, InputR, OutputR>(
  left: Filter<InputL, OutputL>,
  right: Filter<InputR, OutputR>
): Filter<InputL & InputR, [OutputL, OutputR]> =>
  zipWith(left, right, (leftResult, rightResult) => [leftResult, rightResult]))

/**
 * Combines two filters but only returns the result of the left filter.
 *
 * Both filters must succeed, but only the output of the left filter is returned.
 * This is useful when you want to validate with multiple filters but only
 * care about one result.
 *
 * @example
 * ```ts
 * import { Filter } from "effect"
 *
 * const positiveNumbers = Filter.fromPredicate((n: number) => n > 0)
 * const evenNumbers = Filter.fromPredicate((n: number) => n % 2 === 0)
 *
 * // Validate both conditions but return the original number
 * const positiveEven = Filter.andLeft(positiveNumbers, evenNumbers)
 *
 * console.log(positiveEven(4))  // 4 (both conditions met, returns left result)
 * console.log(positiveEven(3))  // absent (not even)
 * console.log(positiveEven(-2)) // absent (not positive)
 *
 * // Useful for validation pipelines
 * const nonEmpty = Filter.fromPredicate((s: string) => s.length > 0)
 * const maxLength = Filter.fromPredicate((s: string) => s.length <= 10)
 * const validString = Filter.andLeft(nonEmpty, maxLength)
 * console.log(validString("hello")) // "hello"
 * ```
 *
 * @since 4.0.0
 * @category Combinators
 */
export const andLeft: {
  <InputR, OutputR>(
    right: Filter<InputR, OutputR>
  ): <InputL, OutputL>(left: Filter<InputL, OutputL>) => Filter<InputL & InputR, OutputL>
  <InputL, OutputL, InputR, OutputR>(
    left: Filter<InputL, OutputL>,
    right: Filter<InputR, OutputR>
  ): Filter<InputL & InputR, OutputL>
} = dual(2, <InputL, OutputL, InputR, OutputR>(
  left: Filter<InputL, OutputL>,
  right: Filter<InputR, OutputR>
): Filter<InputL & InputR, OutputL> => zipWith(left, right, (leftResult) => leftResult))

/**
 * Combines two filters but only returns the result of the right filter.
 *
 * Both filters must succeed, but only the output of the right filter is returned.
 * This is useful when you want to validate with multiple filters but only
 * care about the final result.
 *
 * @example
 * ```ts
 * import { Filter } from "effect"
 *
 * const positiveNumbers = Filter.fromPredicate((n: number) => n > 0)
 * const doubleNumbers = Filter.make((n: number) => n > 0 ? n * 2 : Filter.absent)
 *
 * // Validate positive but return doubled value
 * const positiveDoubled = Filter.andRight(positiveNumbers, doubleNumbers)
 *
 * console.log(positiveDoubled(5))  // 10 (positive, returns doubled)
 * console.log(positiveDoubled(-3)) // absent (not positive)
 *
 * // Sequential transformations
 * const nonEmpty = Filter.fromPredicate((s: string) => s.length > 0)
 * const uppercase = Filter.make((s: string) => s.length > 0 ? s.toUpperCase() : Filter.absent)
 * const transform = Filter.andRight(nonEmpty, uppercase)
 * console.log(transform("hello")) // "HELLO"
 * ```
 *
 * @since 4.0.0
 * @category Combinators
 */
export const andRight: {
  <InputR, OutputR>(
    right: Filter<InputR, OutputR>
  ): <InputL, OutputL>(left: Filter<InputL, OutputL>) => Filter<InputL & InputR, OutputR>
  <InputL, OutputL, InputR, OutputR>(
    left: Filter<InputL, OutputL>,
    right: Filter<InputR, OutputR>
  ): Filter<InputL & InputR, OutputR>
} = dual(2, <InputL, OutputL, InputR, OutputR>(
  left: Filter<InputL, OutputL>,
  right: Filter<InputR, OutputR>
): Filter<InputL & InputR, OutputR> => zipWith(left, right, (_, rightResult) => rightResult))

/**
 * Composes two filters sequentially, feeding the output of the first into the second.
 *
 * This creates a pipeline where the output of the left filter becomes the input
 * to the right filter. If either filter returns `absent`, the composition returns
 * `absent`. This is useful for creating multi-stage validation and transformation
 * pipelines.
 *
 * @example
 * ```ts
 * import { Filter } from "effect"
 *
 * // First filter: only pass strings
 * const stringFilter = Filter.string
 * // Second filter: only pass non-empty strings and uppercase them
 * const nonEmptyUpper = Filter.make((s: string) =>
 *   s.length > 0 ? s.toUpperCase() : Filter.absent
 * )
 *
 * // Compose: unknown -> string -> uppercase string
 * const stringToUpper = Filter.compose(stringFilter, nonEmptyUpper)
 *
 * console.log(stringToUpper("hello"))  // "HELLO"
 * console.log(stringToUpper(""))       // absent (empty string)
 * console.log(stringToUpper(123))      // absent (not a string)
 *
 * // Multi-stage number processing
 * const positiveFilter = Filter.fromPredicate((n: number) => n > 0)
 * const doubleFilter = Filter.make((n: number) => n * 2)
 * const positiveDouble = Filter.compose(positiveFilter, doubleFilter)
 * ```
 *
 * @since 4.0.0
 * @category Combinators
 */
export const compose: {
  <OutputL, InputR extends OutputL, OutputR>(
    right: Filter<InputR, OutputR>
  ): <InputL>(left: Filter<InputL, OutputL>) => Filter<InputL, OutputR>
  <InputL, OutputL, InputR extends OutputL, OutputR>(
    left: (input: InputL) => OutputL | absent,
    right: Filter<InputR, OutputR>
  ): (input: InputL) => OutputR | absent
} = dual(2, <InputL, OutputL, InputR extends OutputL, OutputR>(
  left: Filter<InputL, OutputL>,
  right: Filter<InputR, OutputR>
): Filter<InputL, OutputR> =>
(input) => {
  const leftOut = left(input)
  if (leftOut === absent) return absent
  return right(leftOut as InputR)
})
