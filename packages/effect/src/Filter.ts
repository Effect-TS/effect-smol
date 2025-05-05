/**
 * @since 4.0.0
 */
import type { Effect } from "./Effect.js"
import { dual } from "./Function.js"
import * as Predicate from "./Predicate.js"

/**
 * @since 4.0.0
 * @category Models
 */
export interface Filter<in Input, out Output> {
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
export const fromPredicate =
  <A, B extends A = A>(predicate: Predicate.Predicate<A> | Predicate.Refinement<A, B>): Filter<A, B> => (input) =>
    predicate(input) ? input as B : absent

/**
 * @since 4.0.0
 * @category Constructors
 */
export const string: Filter<unknown, string> = fromPredicate(Predicate.isString)

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
): Filter<InputL & InputR, OutputL> =>
(input) => {
  const leftResult = left(input)
  return leftResult !== absent && right(input) !== absent ? leftResult : absent
})

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
): Filter<InputL & InputR, OutputR> =>
(input) => {
  const rightResult = right(input)
  return rightResult !== absent && left(input) !== absent ? rightResult : absent
})
