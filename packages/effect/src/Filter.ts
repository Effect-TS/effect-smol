/**
 * @since 4.0.0
 */
import type { Effect } from "./Effect.js"
import * as Equal from "./Equal.js"
import { dual } from "./Function.js"
import * as Predicate from "./Predicate.js"

/**
 * @since 4.0.0
 * @category Models
 */
export interface Filter<in Input, out Output = Input> {
  (input: Input): Output | absent
}

/**
 * @since 4.0.0
 * @category Models
 */
export interface FilterEffect<in Input, out Output, out E = never, out R = never> {
  (input: Input): Effect<Output | absent, E, R>
}

/**
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
 * @since 4.0.0
 * @category Constructors
 */
export const make = <Input, Output>(f: (input: Input) => Output | absent): Filter<Input, WithoutAbsent<Output>> =>
  f as any

/**
 * @since 4.0.0
 * @category Constructors
 */
export const makeEffect = <Input, Output, E, R>(
  f: (input: Input) => Effect<Output | absent, E, R>
): FilterEffect<Input, WithoutAbsent<Output>, E, R> => f as any

/**
 * @since 4.0.0
 * @category Constructors
 */
export const fromPredicate: {
  <A, B extends A>(refinement: Predicate.Refinement<A, B>): Filter<A, B>
  <A>(predicate: Predicate.Predicate<A>): Filter<A, A>
} = <A, B extends A = A>(predicate: Predicate.Predicate<A> | Predicate.Refinement<A, B>): Filter<A, B> => (input) =>
  predicate(input) ? input as B : absent

/**
 * @since 4.0.0
 * @category Constructors
 */
export const toPredicate = <A, B>(
  self: Filter<A, B>
): Predicate.Predicate<A> =>
(input: A) => self(input) !== absent

/**
 * @since 4.0.0
 * @category Constructors
 */
export const string: Filter<unknown, string> = fromPredicate(Predicate.isString)

/**
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
 * @since 4.0.0
 * @category Constructors
 */
export const boolean: Filter<unknown, boolean> = fromPredicate(Predicate.isBoolean)

/**
 * @since 4.0.0
 * @category Constructors
 */
export const bigint: Filter<unknown, bigint> = fromPredicate(Predicate.isBigInt)

/**
 * @since 4.0.0
 * @category Constructors
 */
export const symbol: Filter<unknown, symbol> = fromPredicate(Predicate.isSymbol)

/**
 * @since 4.0.0
 * @category Constructors
 */
export const date: Filter<unknown, Date> = fromPredicate(Predicate.isDate)

/**
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
