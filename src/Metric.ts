/**
 * @since 2.0.0
 */

import type { Contravariant, Covariant } from "./Types.js"

/**
 * @since 4.0.0
 * @category Symbols
 */
export const TypeId: unique symbol = Symbol.for("effect/Metric")

/**
 * @since 4.0.0
 * @category Symbols
 */
export type TypeId = typeof TypeId

/**
 * A `Metric<Input, State>` represents a concurrent metric which accepts update
 * values of type `Input` and are aggregated to a value of type `State`.
 *
 * For example, a counter metric would have type `Metric<number, number>`,
 * representing the fact that the metric can be updated with numbers (the amount
 * to increment or decrement the counter by), and the state of the counter is a
 * number.
 *
 * There are five primitive metric types supported by Effect:
 *
 *   - Counters
 *   - Frequencies
 *   - Gauges
 *   - Histograms
 *   - Summaries
 *
 * @since 2.0.0
 * @category Models
 */
export interface Metric<in Input, out State> extends Metric.Variance<Input, State> {}

/**
 * @since 2.0.0
 * @category Models
 */
export interface Counter<in Input extends number | bigint> extends Metric<Input, CounterState> {}

/**
 * @since 2.0.0
 * @category Models
 */
export interface CounterState {
  readonly count: number
}

/**
 * @since 2.0.0
 */
export declare namespace Metric {
  /**
   * @since 2.0.0
   */
  export interface Variance<in Input, out State> {
    readonly [TypeId]: VarianceStruct<Input, State>
  }

  /**
   * @since 2.0.0
   */
  export interface VarianceStruct<in Input, out State> {
    readonly _Input: Contravariant<Input>
    readonly _State: Covariant<State>
  }
}

export declare const counter: {
  (
    name: string,
    options?: {
      readonly description?: string | undefined
      readonly bigint?: false | undefined
      readonly incremental?: boolean | undefined
    }
  ): Counter<number>
  (
    name: string,
    options: {
      readonly description?: string | undefined
      readonly bigint: true
      readonly incremental?: boolean | undefined
    }
  ): Counter<bigint>
}
