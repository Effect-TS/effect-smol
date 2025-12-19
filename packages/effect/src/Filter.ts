/**
 * @since 4.0.0
 */
import type { Effect } from "./Effect.ts"
import * as Equal from "./Equal.ts"
import { dual } from "./Function.ts"
import * as Option from "./Option.ts"
import * as Predicate from "./Predicate.ts"
import * as Result from "./Result.ts"
import type { EqualsWith, ExcludeTag, ExtractTag, Tags } from "./Types.ts"

/**
 * Represents a filter function that can transform inputs to outputs or filter them out.
 *
 * A filter takes an input value and either returns a transformed output value or
 * the special `fail` type to indicate the value should be filtered out.
 *
 * @example
 * ```ts
 * import { Filter } from "effect"
 *
 * // A filter that only passes positive numbers
 * const positiveFilter: Filter.Filter<number> = (n) => n > 0 ? n : Filter.fail(n)
 *
 * console.log(positiveFilter(5)) // 5
 * console.log(positiveFilter(-3)) // fail
 * ```
 *
 * @since 4.0.0
 * @category Models
 */
export interface Filter<in Input, out Pass = Input, out Fail = Input> {
  (input: Input): Pass | fail<Fail>
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
 * // An effectful filter that validates user data
 * type User = { id: string; isActive: boolean }
 * type ValidationError = { message: string }
 *
 * const validateUser: Filter.FilterEffect<
 *   string,
 *   User,
 *   User,
 *   ValidationError,
 *   never
 * > = (id) =>
 *   Effect.gen(function*() {
 *     // Simple validation logic
 *     const user: User = { id, isActive: id.length > 0 }
 *     return user.isActive ? user : Filter.fail(user)
 *   })
 * ```
 *
 * @since 4.0.0
 * @category Models
 */
export interface FilterEffect<in Input, out Pass, out Fail, out E = never, out R = never> {
  (input: Input): Effect<Pass | fail<Fail>, E, R>
}

const FailTypeId = "~effect/data/Filter/fail"

/**
 * @since 4.0.0
 * @category fail
 */
export interface fail<out Fail> {
  readonly [FailTypeId]: typeof FailTypeId
  readonly fail: Fail
}

/**
 * @since 4.0.0
 * @category fail
 */
export const fail = <Fail>(value: Fail): fail<Fail> => ({
  [FailTypeId]: FailTypeId,
  fail: value
})

/**
 * @since 4.0.0
 * @category fail
 */
export const failVoid: fail<void> = fail(void 0)

/**
 * @since 4.0.0
 * @category fail
 */
export const isFail = <A = unknown>(u: unknown): u is fail<A> =>
  u === failVoid || (typeof u === "object" && u !== null && FailTypeId in u)

/**
 * @since 4.0.0
 * @category fail
 */
export const isPass = <A>(u: A): u is WithoutFail<A> => !isFail(u)

/**
 * @since 4.0.0
 * @category fail
 */
export type WithoutFail<A> = Exclude<A, fail<any>>

/**
 * Creates a Filter from a function that returns either a value or fail.
 *
 * This is the primary constructor for creating custom filters. The function
 * should return either a transformed value or the `fail` type to indicate
 * the input should be filtered out.
 *
 * @example
 * ```ts
 * import { Filter } from "effect"
 *
 * // Create a filter for positive numbers
 * const positiveFilter = Filter.make((n: number) => n > 0 ? n : Filter.fail(n))
 *
 * // Create a filter that transforms strings to uppercase
 * const uppercaseFilter = Filter.make((s: string) =>
 *   s.length > 0 ? s.toUpperCase() : Filter.fail(s)
 * )
 *
 * console.log(positiveFilter(5)) // 5
 * console.log(positiveFilter(-1)) // `fail`
 * console.log(uppercaseFilter("hi")) // "HI"
 * ```
 *
 * @since 4.0.0
 * @category Constructors
 */
export const make = <Input, Pass, Fail>(
  f: (input: Input) => Pass | fail<Fail>
): Filter<Input, WithoutFail<Pass>, Fail> => f as any

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
 *   Effect.gen(function*() {
 *     const isValid = yield* Effect.succeed(id.length > 0) // Simple validation
 *     return isValid ? id : Filter.fail(id)
 *   })
 * )
 *
 * // Use in Effect context
 * const program = Effect.gen(function*() {
 *   const result = yield* asyncValidate("user123")
 *   console.log(result) // "user123" or fail
 * })
 * ```
 *
 * @since 4.0.0
 * @category Constructors
 */
export const makeEffect = <Input, Pass, Fail, E, R>(
  f: (input: Input) => Effect<Pass | fail<Fail>, E, R>
): FilterEffect<Input, WithoutFail<Pass>, Fail, E, R> => f as any

/**
 * @since 4.0.0
 * @category Mapping
 */
export const mapFail: {
  <Fail, Fail2>(f: (fail: Fail) => Fail2): <Input, Pass>(self: Filter<Input, Pass, Fail>) => Filter<Input, Pass, Fail2>
  <Input, Pass, Fail, Fail2>(
    self: Filter<Input, Pass, Fail>,
    f: (fail: Fail) => Fail2
  ): Filter<Input, Pass, Fail2>
} = dual(2, <Input, Pass, Fail, Fail2>(
  self: Filter<Input, Pass, Fail>,
  f: (fail: Fail) => Fail2
): Filter<Input, Pass, Fail2> =>
(input: Input): Pass | fail<Fail2> => {
  const result = self(input)
  return isFail(result) ? fail(f(result.fail)) : result
})

const try_ = <Input, Output>(f: (input: Input) => Output): Filter<Input, Output> => (input) => {
  try {
    return f(input)
  } catch {
    return fail(input)
  }
}

export {
  /**
   * Creates a Filter that tries to apply a function and returns `fail` on
   * error.
   *
   * @since 4.0.0
   * @category Constructors
   */
  try_ as try
}

/**
 * Creates a Filter from a predicate or refinement function.
 *
 * This is a convenient way to create filters from boolean-returning functions.
 * When the predicate returns true, the input value is passed through unchanged.
 * When it returns false, the `fail` type is returned.
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
 * const isString = Filter.fromPredicate((x: unknown): x is string =>
 *   typeof x === "string"
 * )
 *
 * console.log(positiveNumbers(5)) // 5
 * console.log(positiveNumbers(-1)) // fail
 * console.log(isString("hello")) // "hello" (typed as string)
 * console.log(isString(42)) // fail
 * ```
 *
 * @since 4.0.0
 * @category Constructors
 */
export const fromPredicate: {
  <A, B extends A>(refinement: Predicate.Refinement<A, B>): Filter<A, B, EqualsWith<A, B, A, Exclude<A, B>>>
  <A>(predicate: Predicate.Predicate<A>): Filter<A>
} = <A, B extends A = A>(predicate: Predicate.Predicate<A> | Predicate.Refinement<A, B>): Filter<A, B> => (input: A) =>
  predicate(input) ? input as B : fail(input)

/**
 * Creates a Filter from a function that returns an Option.
 *
 * @since 4.0.0
 * @category Constructors
 */
export const fromPredicateOption = <A, B>(predicate: (a: A) => Option.Option<B>): Filter<A, B> => (input) => {
  const o = predicate(input)
  return o._tag === "None" ? fail(input) : o.value
}

/**
 * Creates a Filter from a function that returns an Result.
 *
 * @since 4.0.0
 * @category Constructors
 */
export const fromPredicateResult =
  <A, Pass, Fail>(predicate: (a: A) => Result.Result<Pass, Fail>): Filter<A, Pass, Fail> => (input) => {
    const r = predicate(input)
    return r._tag === "Success" ? r.success : fail(r.failure)
  }

/**
 * Converts a Filter into a predicate function.
 *
 * @since 4.0.0
 * @category Constructors
 */
export const toPredicate = <A, Pass, Fail>(
  self: Filter<A, Pass, Fail>
): Predicate.Predicate<A> =>
(input: A) => !isFail(self(input))

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
 * console.log(Filter.string("hello")) // "hello"
 * console.log(Filter.string(42)) // fail
 * console.log(Filter.string(true)) // fail
 * console.log(Filter.string(null)) // fail
 *
 * // Use with arrays of mixed types
 * const mixed = ["a", 1, "b", true, "c"]
 * const strings = mixed.map(Filter.string).filter((x) => Filter.isPass(x))
 * console.log(strings) // ["a", "b", "c"]
 * ```
 *
 * @since 4.0.0
 * @category Constructors
 */
export const string: Filter<unknown, string> = fromPredicate(Predicate.isString)

/**
 * @since 4.0.0
 * @category Constructors
 */
export const equalsStrict =
  <const A, Input = unknown>(value: A): Filter<Input, A, EqualsWith<Input, A, A, Exclude<Input, A>>> => (u) =>
    (u as unknown) === value ? value : fail(u as any)

/**
 * @since 4.0.0
 * @category Constructors
 */
export const has =
  <K>(key: K) => <Input extends { readonly has: (key: K) => boolean }>(input: Input): Input | fail<Input> =>
    input.has(key) ? input : fail(input)

/**
 * Creates a filter that only passes values equal to the specified value using structural equality.
 *
 * This function uses Effect's structural equality comparison, which can compare
 * complex objects and data structures deeply. Unlike `strictEquals`, this filter
 * can handle objects, arrays, and other reference types properly.
 *
 * @since 4.0.0
 * @category Constructors
 */
export const instanceOf =
  <K extends new(...args: any) => any>(constructor: K) =>
  <Input>(u: Input): InstanceType<K> | fail<Exclude<Input, InstanceType<K>>> =>
    u instanceof constructor ? u as InstanceType<K> : fail(u) as any

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
 * console.log(Filter.number(42)) // 42
 * console.log(Filter.number(3.14)) // 3.14
 * console.log(Filter.number("42")) // fail
 * console.log(Filter.number(true)) // fail
 * console.log(Filter.number(NaN)) // fail
 *
 * // Extract numbers from mixed array
 * const mixed = [1, "2", 3, true, 4.5]
 * const numbers = mixed.map(Filter.number).filter(Filter.isPass)
 * console.log(numbers) // [1, 3, 4.5]
 *
 * // Use with array filtering
 * const data: Array<unknown> = [10, "hello", 20, null, 30.5, "world"]
 * const numbersOnly = data.filter((item) =>
 *   Filter.isPass(Filter.number(item))
 * ) as Array<number>
 * console.log(numbersOnly) // [10, 20, 30.5]
 *
 * // Combine with other filters
 * const positiveNumbers = Filter.compose(
 *   Filter.number,
 *   Filter.fromPredicate((n: number) => n > 0)
 * )
 * console.log(positiveNumbers(5)) // 5
 * console.log(positiveNumbers(-1)) // fail
 * console.log(positiveNumbers("5")) // fail
 * ```
 *
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
 * @since 4.0.0
 * @category Constructors
 */
export const boolean: Filter<unknown, boolean> = fromPredicate(Predicate.isBoolean)

/**
 * A predefined filter that only passes through BigInt values.
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
 * @since 4.0.0
 * @category Constructors
 */
export const date: Filter<unknown, Date> = fromPredicate(Predicate.isDate)

/**
 * Creates a filter that checks if an input is tagged with a specific tag.
 *
 * @since 4.0.0
 * @category Constructors
 */
export const tagged: {
  <Input>(): <const Tag extends Tags<Input>>(tag: Tag) => Filter<Input, ExtractTag<Input, Tag>, ExcludeTag<Input, Tag>>
  <Input, const Tag extends Tags<Input>>(
    tag: Tag
  ): Filter<Input, ExtractTag<Input, Tag>, ExcludeTag<Input, Tag>>
  <const Tag extends string>(tag: Tag): <Input>(input: Input) => ExtractTag<Input, Tag> | fail<ExcludeTag<Input, Tag>>
} = function() {
  return arguments.length === 0 ? taggedImpl : taggedImpl(arguments[0] as any)
} as any

const taggedImpl =
  <const Tag extends string>(tag: Tag) =>
  <Input>(input: Input): ExtractTag<Input, Tag> | fail<ExcludeTag<Input, Tag>> =>
    Predicate.isTagged(input, tag) ? input as any : fail(input as ExcludeTag<Input, Tag>)

/**
 * Creates a filter that only passes values equal to the specified value using structural equality.
 *
 * @since 4.0.0
 * @category Constructors
 */
export const equals =
  <const A, Input = unknown>(value: A): Filter<Input, A, EqualsWith<Input, A, A, Exclude<Input, A>>> => (u) =>
    Equal.equals(u, value) ? value : fail(u as any)

/**
 * Combines two filters with logical OR semantics.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const or: {
  <Input2, Pass2, Fail2>(
    that: Filter<Input2, Pass2, Fail2>
  ): <Input1, Pass2, Fail2>(self: Filter<Input1, Pass2>) => Filter<Input1 & Input2, Pass2 | Pass2, Fail2>
  <Input1, Pass1, Fail1, Input2, Pass2, Fail2>(
    self: Filter<Input1, Pass1, Fail1>,
    that: Filter<Input2, Pass2, Fail2>
  ): Filter<Input1 & Input2, Pass1 | Pass2, Fail2>
} = dual(2, <Input1, Pass1, Fail1, Input2, Pass2, Fail2>(
  self: Filter<Input1, Pass1, Fail1>,
  that: Filter<Input2, Pass2, Fail2>
): Filter<Input1 & Input2, Pass1 | Pass2, Fail2> =>
(input) => {
  const selfResult = self(input)
  return !isFail(selfResult) ? selfResult : that(input)
})

/**
 * Combines two filters and applies a function to their results.
 *
 * Both filters must succeed (not return `fail`) for the combination to succeed.
 * If both filters pass, their outputs are combined using the provided function.
 * This is useful for creating complex validation and transformation pipelines.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const zipWith: {
  <PassL, InputR, PassR, FailR, A>(
    right: Filter<InputR, PassR, FailR>,
    f: (left: PassL, right: PassR) => A
  ): <InputL, FailL>(left: Filter<InputL, PassL, FailL>) => Filter<InputL & InputR, A, FailL | FailR>
  <InputL, PassL, FailL, InputR, PassR, FailR, A>(
    left: Filter<InputL, PassL, FailL>,
    right: Filter<InputR, PassR, FailR>,
    f: (left: PassL, right: PassR) => A
  ): Filter<InputL & InputR, A, FailL | FailR>
} = dual(3, <InputL, PassL, FailL, InputR, PassR, FailR, A>(
  left: Filter<InputL, PassL, FailL>,
  right: Filter<InputR, PassR, FailR>,
  f: (left: PassL, right: PassR) => A
): Filter<InputL & InputR, A, FailL | FailR> =>
(input) => {
  const leftResult = left(input)
  if (isFail(leftResult)) return leftResult
  const rightResult = right(input)
  if (isFail(rightResult)) return rightResult
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
 * console.log(positiveAndEven(4)) // [4, 4] (both filters pass)
 * console.log(positiveAndEven(3)) // fail (not even)
 * console.log(positiveAndEven(-2)) // fail (not positive)
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
  <InputR, PassR, FailR>(
    right: Filter<InputR, PassR, FailR>
  ): <InputL, PassL, FailL>(
    left: Filter<InputL, PassL, FailL>
  ) => Filter<InputL & InputR, [PassL, PassR], FailL | FailR>
  <InputL, PassL, FailL, InputR, PassR, FailR>(
    left: Filter<InputL, PassL, FailL>,
    right: Filter<InputR, PassR, FailR>
  ): Filter<InputL & InputR, [PassL, PassR], FailL | FailR>
} = dual(2, <InputL, PassL, FailL, InputR, PassR, FailR>(
  left: Filter<InputL, PassL, FailL>,
  right: Filter<InputR, PassR, FailR>
): Filter<InputL & InputR, [PassL, PassR], FailL | FailR> =>
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
 * console.log(positiveEven(4)) // 4 (both conditions met, returns left result)
 * console.log(positiveEven(3)) // fail (not even)
 * console.log(positiveEven(-2)) // fail (not positive)
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
  <InputR, PassR, FailR>(
    right: Filter<InputR, PassR, FailR>
  ): <InputL, PassL, FailL>(
    left: Filter<InputL, PassL, FailL>
  ) => Filter<InputL & InputR, PassL, FailL | FailR>
  <InputL, PassL, FailL, InputR, PassR, FailR>(
    left: Filter<InputL, PassL, FailL>,
    right: Filter<InputR, PassR, FailR>
  ): Filter<InputL & InputR, PassL, FailL | FailR>
} = dual(2, <InputL, PassL, FailL, InputR, PassR, FailR>(
  left: Filter<InputL, PassL, FailL>,
  right: Filter<InputR, PassR, FailR>
): Filter<InputL & InputR, PassL, FailL | FailR> => zipWith(left, right, (leftResult) => leftResult))

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
 * const doubleNumbers = Filter.make((n: number) => n > 0 ? n * 2 : Filter.fail(n))
 *
 * // Validate positive but return doubled value
 * const positiveDoubled = Filter.andRight(positiveNumbers, doubleNumbers)
 *
 * console.log(positiveDoubled(5)) // 10 (positive, returns doubled)
 * console.log(positiveDoubled(-3)) // fail (not positive)
 *
 * // Sequential transformations
 * const nonEmpty = Filter.fromPredicate((s: string) => s.length > 0)
 * const uppercase = Filter.make((s: string) =>
 *   s.length > 0 ? s.toUpperCase() : Filter.fail(s)
 * )
 * const transform = Filter.andRight(nonEmpty, uppercase)
 * console.log(transform("hello")) // "HELLO"
 * ```
 *
 * @since 4.0.0
 * @category Combinators
 */
export const andRight: {
  <InputR, PassR, FailR>(
    right: Filter<InputR, PassR, FailR>
  ): <InputL, PassL, FailL>(
    left: Filter<InputL, PassL, FailL>
  ) => Filter<InputL & InputR, PassR, FailL | FailR>
  <InputL, PassL, FailL, InputR, PassR, FailR>(
    left: Filter<InputL, PassL, FailL>,
    right: Filter<InputR, PassR, FailR>
  ): Filter<InputL & InputR, PassR, FailL | FailR>
} = dual(2, <InputL, PassL, FailL, InputR, PassR, FailR>(
  left: Filter<InputL, PassL, FailL>,
  right: Filter<InputR, PassR, FailR>
): Filter<InputL & InputR, PassR, FailL | FailR> => zipWith(left, right, (_, rightResult) => rightResult))

/**
 * Composes two filters sequentially, feeding the output of the first into the second.
 *
 * This creates a pipeline where the output of the left filter becomes the input
 * to the right filter. If either filter returns `fail`, the composition returns
 * `fail`. This is useful for creating multi-stage validation and transformation
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
 *   s.length > 0 ? s.toUpperCase() : Filter.fail(s)
 * )
 *
 * // Compose: unknown -> string -> uppercase string
 * const stringToUpper = Filter.compose(stringFilter, nonEmptyUpper)
 *
 * console.log(stringToUpper("hello")) // "HELLO"
 * console.log(stringToUpper("")) // fail (empty string)
 * console.log(stringToUpper(123)) // fail (not a string)
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
  <PassL, PassR, FailR>(
    right: Filter<PassL, PassR, FailR>
  ): <InputL, FailL>(left: Filter<InputL, PassL, FailL>) => Filter<InputL, PassR, FailL | FailR>
  <InputL, PassL, FailL, PassR, FailR>(
    left: Filter<InputL, PassL, FailL>,
    right: Filter<PassL, PassR, FailR>
  ): Filter<InputL, PassR, FailL | FailR>
} = dual(2, <InputL, PassL, FailL, PassR, FailR>(
  left: Filter<InputL, PassL, FailL>,
  right: Filter<PassL, PassR, FailR>
): Filter<InputL, PassR, FailL | FailR> =>
(input) => {
  const leftOut = left(input)
  if (isFail(leftOut)) return leftOut
  return right(leftOut)
})

/**
 * Composes two filters sequentially, allowing the output of the first to be
 * passed to the second.
 *
 * This is similar to `compose`, but it will always fail with the original
 * input.
 *
 * @since 4.0.0
 * @category Combinators
 */
export const composePassthrough: {
  <InputL, PassL, PassR, FailR>(
    right: Filter<PassL, PassR, FailR>
  ): <FailL>(left: Filter<InputL, PassL, FailL>) => Filter<InputL, PassR, InputL>
  <InputL, PassL, FailL, PassR, FailR>(
    left: Filter<InputL, PassL, FailL>,
    right: Filter<PassL, PassR, FailR>
  ): Filter<InputL, PassR, InputL>
} = dual(2, <InputL, PassL, FailL, PassR, FailR>(
  left: Filter<InputL, PassL, FailL>,
  right: Filter<PassL, PassR, FailR>
): Filter<InputL, PassR, InputL> =>
(input) => {
  const leftOut = left(input)
  if (isFail(leftOut)) return fail(input)
  const rightOut = right(leftOut)
  if (isFail(rightOut)) return fail(input)
  return rightOut
})

/**
 * @since 4.0.0
 * @category Conversions
 */
export const toOption = <A, Pass, Fail>(
  self: Filter<A, Pass, Fail>
): (input: A) => Option.Option<Pass> =>
(input: A) => {
  const result = self(input)
  return isFail(result) ? Option.none() : Option.some(result)
}

/**
 * @since 4.0.0
 * @category Conversions
 */
export const toResult = <A, Pass, Fail>(
  self: Filter<A, Pass, Fail>
): (input: A) => Result.Result<Pass, Fail> =>
(input: A) => {
  const result = self(input)
  return isFail(result) ? Result.fail(result.fail) : Result.succeed(result)
}
