/**
 * @since 2.0.0
 */

import * as Arr from "./Array.js"
import * as Context from "./Context.js"
import * as Duration from "./Duration.js"
import type { Effect } from "./Effect.js"
import type { Exit } from "./Exit.js"
import { dual, identity } from "./Function.js"
import * as InternalEffect from "./internal/effect.js"
import * as InternalMetric from "./internal/metric.js"
import * as _Number from "./Number.js"
import * as Option from "./Option.js"
import type { Pipeable } from "./Pipeable.js"
import { pipeArguments } from "./Pipeable.js"
import * as Predicate from "./Predicate.js"
import * as _String from "./String.js"
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
export interface Metric<in Input, out State> extends Metric.Variance<Input, State> {
  <A extends Input, E, R>(effect: Effect<A, E, R>): Effect<A, E, R>
  readonly id: string
  readonly type: Metric.Type
  readonly description: string
  readonly attributes: Metric.AttributeSet
  readonly unsafeValue: (context: Context.Context<never>) => State
  readonly unsafeUpdate: (input: Input, context: Context.Context<never>) => void
  readonly unsafeModify: (input: Input, context: Context.Context<never>) => void
}

/**
 * @since 2.0.0
 * @category Metrics
 */
export interface Counter<in Input extends number | bigint> extends Metric<Input, CounterState<Input>> {}

/**
 * @since 2.0.0
 * @category Counter
 */
export interface CounterState<in Input extends number | bigint> {
  readonly count: Input extends bigint ? bigint : number
}

/**
 * @since 2.0.0
 * @category Metrics
 */
export interface Frequency extends Metric<string, FrequencyState> {}

/**
 * @since 2.0.0
 * @category Metrics
 */
export interface FrequencyState {
  readonly occurrences: ReadonlyMap<string, number>
}

/**
 * @since 2.0.0
 * @category Metrics
 */
export interface Gauge<in Input extends number | bigint> extends Metric<Input, GaugeState<Input>> {}

/**
 * @since 2.0.0
 * @category Metrics
 */
export interface GaugeState<in Input extends number | bigint> {
  readonly value: Input extends bigint ? bigint : number
}

/**
 * @since 2.0.0
 * @category Metrics
 */
export interface Histogram<Input> extends Metric<Input, HistogramState> {}

/**
 * @since 2.0.0
 * @category Metrics
 */
export interface HistogramState {
  readonly buckets: ReadonlyArray<[number, number]>
  readonly count: number
  readonly min: number
  readonly max: number
  readonly sum: number
}

/**
 * @since 2.0.0
 * @category Metrics
 */
export interface Summary<Input> extends Metric<Input, SummaryState> {}

/**
 * @since 2.0.0
 * @category Metrics
 */
export interface SummaryState {
  readonly quantiles: ReadonlyArray<readonly [number, Option.Option<number>]>
  readonly count: number
  readonly min: number
  readonly max: number
  readonly sum: number
}

/**
 * @since 2.0.0
 */
export declare namespace Metric {
  /**
   * @since 2.0.0
   */
  export interface Variance<in Input, out State> extends Pipeable {
    readonly [TypeId]: VarianceStruct<Input, State>
  }

  /**
   * @since 2.0.0
   */
  export interface VarianceStruct<in Input, out State> {
    readonly _Input: Contravariant<Input>
    readonly _State: Covariant<State>
  }

  /**
   * @since 2.0.0
   */
  export type Type = "Counter" | "Frequency" | "Gauge" | "Histogram" | "Summary"

  /**
   * @since 2.0.0
   */
  export type Attributes = AttributeSet | ReadonlyArray<[string, string]>

  /**
   * @since 2.0.0
   */
  export type AttributeSet = Readonly<Record<string, string>>

  /**
   * @since 2.0.0
   */
  export type Config<MetricType extends Type> = {
    readonly Counter: {
      readonly bigint?: boolean
      readonly incremental?: boolean
    }
    readonly Frequency: {
      readonly preregisteredWords?: ReadonlyArray<string> | undefined
    }
    readonly Gauge: {
      readonly bigint?: boolean
    }
    readonly Histogram: {
      readonly boundaries: ReadonlyArray<number>
    }
    readonly Summary: {
      readonly maxAge: Duration.DurationInput
      readonly maxSize: number
      readonly quantiles: ReadonlyArray<number>
    }
  }[MetricType]

  /**
   * @since 2.0.0
   */
  export type Input<A> = A extends Metric<infer _Input, infer _State> ? _Input
    : never

  /**
   * @since 2.0.0
   */
  export type State<A> = A extends Metric<infer _Input, infer _State> ? _State
    : never

  /**
   * @since 2.0.0
   */
  export type TypeToInput<MetricType extends Type> = {
    readonly Counter: number | bigint
    readonly Frequency: string
    readonly Gauge: number | bigint
    readonly Histogram: number
    readonly Summary: number | readonly [value: number, timestamp: number]
  }[MetricType]

  /**
   * @since 2.0.0
   */
  export type TypeToState<MetricType extends Type> = {
    readonly Counter: CounterState<number | bigint>
    readonly Frequency: FrequencyState
    readonly Gauge: GaugeState<number | bigint>
    readonly Histogram: HistogramState
    readonly Summary: SummaryState
  }[MetricType]

  /**
   * @since 2.0.0
   */
  export interface Hooks<in Input, out State> {
    readonly get: (context: Context.Context<never>) => State
    readonly update: (input: Input, context: Context.Context<never>) => void
    readonly modify: (input: Input, context: Context.Context<never>) => void
  }

  /**
   * @since 4.0.0
   */
  export interface Metadata<in Input, out State> {
    readonly id: string
    readonly type: Type
    readonly description: string
    readonly attributes: Metric.AttributeSet
    readonly hooks: Hooks<Input, State>
  }

  /**
   * @since 4.0.0
   */
  export interface Snapshot {
    readonly id: string
    readonly type: Type
    readonly description: string
    readonly attributes: Metric.AttributeSet
    readonly state:
      | CounterState<bigint | number>
      | GaugeState<bigint | number>
      | FrequencyState
      | HistogramState
      | SummaryState
  }
}

/**
 * @since 4.0.0
 * @category References
 */
export const CurrentMetricAttributesKey = "effect/Metric/CurrentMetricAttributes" as const

/**
 * @since 4.0.0
 * @category References
 */
export class CurrentMetricAttributes extends Context.Reference(CurrentMetricAttributesKey, {
  defaultValue: () => ({}) as Metric.AttributeSet
}) {}

/**
 * @since 4.0.0
 * @category References
 */
export const CurrentMetricRegistryKey = "effect/Metric/CurrentMetricRegistry" as const

/**
 * @since 4.0.0
 * @category References
 */
export class CurrentMetricRegistry extends Context.Reference(CurrentMetricRegistryKey, {
  defaultValue: () => new Map<string, Metric.Metadata<any, any>>()
}) {}

const make = <Type extends Metric.Type>(
  type: Type,
  id: string,
  description: string | undefined,
  attributes: Metric.Attributes | undefined,
  config: Metric.Config<Type>
): Metric<Metric.TypeToInput<Type>, Metric.TypeToState<Type>> => {
  let untaggedMeta: Metric.Metadata<Metric.TypeToInput<Type>, Metric.TypeToState<Type>> | undefined
  const metaCache = new WeakMap<Metric.Attributes, Metric.Metadata<any, any>>()

  function hook(context: Context.Context<never>): Metric.Hooks<
    Metric.TypeToInput<Type>,
    Metric.TypeToState<Type>
  > {
    const extraAttributes = Context.get(context, CurrentMetricAttributes)
    if (Object.keys(extraAttributes).length === 0) {
      if (Predicate.isNotUndefined(untaggedMeta)) {
        return untaggedMeta.hooks
      }
      untaggedMeta = getOrCreateMetric(type, id, description, attributes, config, context)
      return untaggedMeta.hooks
    }
    const mergedAttributes = mergeAttributes(attributes, extraAttributes)
    let meta = metaCache.get(mergedAttributes)
    if (Predicate.isNotUndefined(meta)) {
      return meta.hooks
    }
    meta = getOrCreateMetric(type, id, description, mergedAttributes, config, context)
    metaCache.set(mergedAttributes, meta)
    return meta.hooks
  }

  return makeMetric(type, {
    id,
    description: description ?? "",
    attributes: attributesToRecord(attributes) ?? {},
    unsafeValue: (context) => hook(context).get(context),
    unsafeUpdate: (input, context) => hook(context).update(input, context),
    unsafeModify: (input, context) => hook(context).modify(input, context)
  })
}

const makeMetric = <
  Type extends Metric.Type,
  Input extends Metric.TypeToInput<Type>,
  State extends Metric.TypeToState<Type>
>(type: Type, options: {
  readonly id: string
  readonly description: string
  readonly attributes: Metric.AttributeSet
  readonly unsafeValue: (context: Context.Context<never>) => State
  readonly unsafeUpdate: (input: Input, context: Context.Context<never>) => void
  readonly unsafeModify: (input: Input, context: Context.Context<never>) => void
}): Metric<Input, State> => {
  const metric = Object.assign(
    <A extends Input, E, R>(self: Effect<A, any, any>): Effect<A, E, R> =>
      InternalEffect.tap(self, (input) => update(metric, input)),
    {
      [TypeId]: {
        _Input: identity,
        _State: identity
      },
      type,
      ...options,
      pipe() {
        return pipeArguments(this, arguments)
      }
    }
  )
  return metric
}

/**
 * Represents a Counter metric that tracks cumulative numerical values over time.
 * Counters can be incremented and decremented and provide a running total of changes.
 *
 * **Options**
 *
 * - `description` - A description of the `Counter`.
 * - `attributes`  - The attributes to associate with the `Counter`.
 * - `bigint`      - Indicates if the `Counter` should use the `bigint` type.
 * - `incremental` - Set to `true` to create a `Counter` that can only ever be
 *                   incremented.
 *
 * @example
 * ```ts
 * import { Metric } from "effect"
 *
 * const numberCounter = Metric.counter("count", {
 *   description: "A number counter"
 * });
 *
 * const bigintCounter = Metric.counter("count", {
 *   description: "A bigint counter",
 *   bigint: true
 * });
 * ```
 *
 * @since 2.0.0
 * @category Constructors
 */
export const counter: {
  (
    name: string,
    options?: {
      readonly description?: string | undefined
      readonly attributes?: Metric.Attributes | undefined
      readonly bigint?: false | undefined
      readonly incremental?: boolean | undefined
    }
  ): Counter<number>
  (
    name: string,
    options: {
      readonly description?: string | undefined
      readonly attributes?: Metric.Attributes | undefined
      readonly bigint: true
      readonly incremental?: boolean | undefined
    }
  ): Counter<bigint>
} = (name, options) =>
  make("Counter", name, options?.description, options?.attributes, {
    bigint: options?.bigint ?? false,
    incremental: options?.incremental ?? false
  })

/**
 * Represents a `Gauge` metric that tracks and reports a single numerical value
 * at a specific moment.
 *
 * Gauges are most suitable for metrics that represent instantaneous values,
 * such as memory usage or CPU load.
 *
 * **Options**
 *
 * - `description` - A description of the `Gauge`.
 * - `attributes`  - The attributes to associate with the `Gauge`.
 * - `bigint`      - Indicates if the `Gauge` should use the `bigint` type.
 *
 * @example
 * ```ts
 * import { Metric } from "effect"
 *
 * const numberGauge = Metric.gauge("memory_usage", {
 *   description: "A gauge for memory usage"
 * });
 *
 * const bigintGauge = Metric.gauge("cpu_load", {
 *   description: "A gauge for CPU load",
 *   bigint: true
 * });
 * ```
 *
 * @since 2.0.0
 * @category Constructors
 */
export const gauge: {
  (name: string, options?: {
    readonly description?: string | undefined
    readonly attributes?: Metric.Attributes | undefined
    readonly bigint?: false | undefined
  }): Gauge<number>
  (name: string, options: {
    readonly description?: string | undefined
    readonly attributes?: Metric.Attributes | undefined
    readonly bigint: true
  }): Gauge<bigint>
} = (name, options) =>
  make("Gauge", name, options?.description, options?.attributes, {
    bigint: options?.bigint ?? false
  })

/**
 * Creates a `Frequency` metric which can be used to count the number of
 * occurrences of a string.
 *
 * Frequency metrics are most suitable for counting the number of times a
 * specific event or incident occurs.
 *
 * **Options**
 *
 * - `description` - A description of the `Frequency`.
 * - `attributes`  - The attributes to associate with the `Frequency`.
 * - `preregisteredWords` - Occurrences which are pre-registered with the
 *                          `Frequency` metric occurrences.
 *
 * @example
 * ```ts
 * import { Metric } from "effect"
 *
 * const errorFrequency = Metric.frequency("error_frequency", {
 *   description: "Counts the occurrences of errors"
 * })
 * ```
 *
 * @since 2.0.0
 * @category Constructors
 */
export const frequency = (name: string, options?: {
  readonly description?: string | undefined
  readonly attributes?: Metric.Attributes | undefined
  readonly preregisteredWords?: ReadonlyArray<string> | undefined
}): Frequency =>
  make("Frequency", name, options?.description, options?.attributes, {
    preregisteredWords: options?.preregisteredWords
  })

/**
 * Represents a `Histogram` metric that records observations into buckets.
 *
 * Histogram metrics are most suitable for measuring the distribution of values
 * within a range.
 *
 * **Options**
 *
 * - `description` - A description of the `Histogram`.
 * - `attributes`  - The attributes to associate with the `Histogram`.
 * - `boundaries`  - The bucket boundaries of the `Histogram`
 *
 * @example
 * ```ts
 * import { Metric } from "effect"
 *
 * const latencyHistogram = Metric.histogram("latency_histogram", {
 *   description: "Measures the distribution of request latency",
 *   boundaries: Metric.linearBoundaries({ start: 0, width: 10, count: 11 }),
 * })
 * ```
 *
 * @since 2.0.0
 * @category Constructors
 */
export const histogram = (name: string, options: {
  readonly description?: string | undefined
  readonly attributes?: Metric.Attributes | undefined
  readonly boundaries: ReadonlyArray<number>
}): Histogram<number> =>
  make("Histogram", name, options?.description, options?.attributes, {
    boundaries: options.boundaries
  })

/**
 * Creates a `Summary` metric that records observations and calculates quantiles
 * which takes a value as input and uses the current time.
 *
 * Summary metrics are most suitable for providing statistical information about
 * a set of values, including quantiles.
 *
 * **Options**
 *
 * - `description` - An description of the `Summary`.
 * - `attributes`  - The attributes to associate with the `Summary`.
 * - `maxAge`      - The maximum age of observations to retain.
 * - `maxSize`     - The maximum number of observations to keep.
 * - `quantiles`   - An array of quantiles to calculate (e.g., [0.5, 0.9]).
 *
 * @example
 * ```ts
 * import { Metric } from "effect"
 *
 * const responseTimesSummary = Metric.summary("response_times_summary", {
 *   description: "Measures the distribution of response times",
 *   maxAge: "60 seconds", // Retain observations for 60 seconds.
 *   maxSize: 1000, // Keep a maximum of 1000 observations.
 *   quantiles: [0.5, 0.9, 0.99], // Calculate 50th, 90th, and 99th quantiles.
 * })
 * ```
 *
 * @since 2.0.0
 * @category Constructors
 */
export const summary = (name: string, options: {
  readonly description?: string | undefined
  readonly attributes?: Metric.Attributes | undefined
  readonly maxAge: Duration.DurationInput
  readonly maxSize: number
  readonly quantiles: ReadonlyArray<number>
}): Summary<number> =>
  mapInput(summaryWithTimestamp(name, options), (input, context) =>
    [
      input,
      Context.get(context, InternalEffect.CurrentClock).unsafeCurrentTimeMillis()
    ] as [number, number])

/**
 * Creates a `Summary` metric that records observations and calculates quantiles
 * which takes a value and the current timestamp as input.
 *
 * Summary metrics are most suitable for providing statistical information about
 * a set of values, including quantiles.
 *
 * **Options**
 *
 * - `description` - An description of the `Summary`.
 * - `attributes`  - The attributes to associate with the `Summary`.
 * - `maxAge`      - The maximum age of observations to retain.
 * - `maxSize`     - The maximum number of observations to keep.
 * - `quantiles`   - An array of quantiles to calculate (e.g., [0.5, 0.9]).
 *
 * @example
 * ```ts
 * import { Metric } from "effect"
 *
 * const responseTimesSummary = Metric.summaryWithTimestamp("response_times_summary", {
 *   description: "Measures the distribution of response times",
 *   maxAge: "60 seconds", // Retain observations for 60 seconds.
 *   maxSize: 1000, // Keep a maximum of 1000 observations.
 *   quantiles: [0.5, 0.9, 0.99], // Calculate 50th, 90th, and 99th quantiles.
 * })
 * ```
 *
 * @since 2.0.0
 * @category Constructors
 */
export const summaryWithTimestamp = (name: string, options: {
  readonly description?: string | undefined
  readonly attributes?: Metric.Attributes | undefined
  readonly maxAge: Duration.DurationInput
  readonly maxSize: number
  readonly quantiles: ReadonlyArray<number>
}): Summary<[value: number, timestamp: number]> =>
  make("Summary", name, options?.description, options?.attributes, {
    maxAge: options.maxAge,
    maxSize: options.maxSize,
    quantiles: options.quantiles
  })

/**
 * Creates a timer metric, based on a `Histogram`, which keeps track of
 * durations in milliseconds.
 *
 * The unit of time will automatically be added to the metric as a tag (i.e.
 * `"time_unit: milliseconds"`).
 *
 * If `options.boundaries` is not provided, the boundaries will be computed
 * using `Metric.exponentialBoundaries({ start: 0.5, factor: 2, count: 35 })`.
 *
 * @since 2.0.0
 * @category Constructors
 */
export const timer = (name: string, options?: {
  readonly description?: string | undefined
  readonly attributes?: Metric.Attributes | undefined
  readonly boundaries?: ReadonlyArray<number>
}): Histogram<Duration.Duration> => {
  const boundaries = Predicate.isNotUndefined(options?.boundaries)
    ? options.boundaries
    : exponentialBoundaries({ start: 0.5, factor: 2, count: 35 })
  const metric = histogram(name, {
    ...options,
    boundaries,
    attributes: mergeAttributes(options?.attributes, { time_unit: "milliseconds" })
  })
  return mapInput(metric, Duration.toMillis)
}

const getOrCreateMetric = <Type extends Metric.Type>(
  type: Type,
  id: string,
  description: string | undefined,
  attributes: Metric.Attributes | undefined,
  config: Metric.Config<Type>,
  context: Context.Context<never>
): Metric.Metadata<Metric.TypeToInput<Type>, Metric.TypeToState<Type>> => {
  const key = makeKey(type, id, description, attributes)
  const registry = Context.get(context, CurrentMetricRegistry)
  if (registry.has(key)) {
    return registry.get(key)!
  }
  const hooks = makeHooks(type, config)
  const meta: Metric.Metadata<Metric.TypeToInput<Type>, Metric.TypeToState<Type>> = {
    id,
    type,
    description: description ?? "",
    attributes: attributesToRecord(attributes) ?? {},
    hooks
  }
  registry.set(key, meta)
  return meta
}

const makeKey = <Type extends Metric.Type>(
  type: Type,
  name: string,
  description: string | undefined,
  attributes: Metric.Attributes | undefined
) => {
  let key = `${type}:${name}`
  if (Predicate.isNotUndefined(description)) {
    key += `:${description}`
  }
  if (Predicate.isNotUndefined(attributes)) {
    key += `:${serializeAttributes(attributes)}`
  }
  return key
}

const serializeAttributes = (attributes: Metric.Attributes): string =>
  serializeEntries(Array.isArray(attributes) ? attributes : Object.entries(attributes))

const serializeEntries = (entries: ReadonlyArray<[string, string]>): string =>
  entries.map(([key, value]) => `${key}=${value}`).join(",")

const mergeAttributes = (
  self: Metric.Attributes | undefined,
  other: Metric.Attributes | undefined
): Metric.AttributeSet => ({
  ...attributesToRecord(self),
  ...attributesToRecord(other)
})

const attributesToRecord = (attributes?: Metric.Attributes): Metric.AttributeSet | undefined => {
  if (Predicate.isNotUndefined(attributes) && Array.isArray(attributes)) {
    return attributes.reduce((acc, [key, value]) => {
      acc[key] = value
      return acc
    }, {} as Metric.AttributeSet)
  }
  return attributes as Metric.AttributeSet | undefined
}

const addAttributesToContext = (
  context: Context.Context<never>,
  attributes: Metric.Attributes
): Context.Context<never> => {
  const current = Context.get(context, CurrentMetricAttributes)
  const updated = mergeAttributes(current, attributes)
  return Context.add(context, CurrentMetricAttributes, updated)
}

const bigint0 = BigInt(0)

const makeHooks = <Type extends Metric.Type>(type: Type, config: Metric.Config<Type>): Metric.Hooks<
  Metric.TypeToInput<Type>,
  Metric.TypeToState<Type>
> => {
  switch (type) {
    case "Counter": {
      return makeCounterHooks(config as Metric.Config<"Counter">) as any
    }
    case "Frequency": {
      return makeFrequencyHooks(config as Metric.Config<"Frequency">) as any
    }
    case "Gauge": {
      return makeGaugeHooks(config as Metric.Config<"Gauge">) as any
    }
    case "Histogram": {
      return makeHistogramHooks(config as Metric.Config<"Histogram">) as any
    }
    case "Summary": {
      return makeSummaryHooks(config as Metric.Config<"Summary">) as any
    }
  }
}

const makeCounterHooks = (config: Metric.Config<"Counter">): Metric.Hooks<
  bigint | number,
  CounterState<bigint | number>
> => {
  let count = (config.bigint ? bigint0 : 0) as bigint | number
  const canUpdate = config.incremental
    ? config.bigint
      ? (value: bigint | number) => value >= bigint0
      : (value: bigint | number) => value >= 0
    : (_value: bigint | number) => true
  const update = (value: bigint | number) => {
    if (canUpdate(value)) {
      count = (count as any) + value
    }
  }
  return {
    get: () => ({ count }),
    update,
    modify: update
  }
}

const makeFrequencyHooks = (config: Metric.Config<"Frequency">): Metric.Hooks<string, FrequencyState> => {
  const occurrences = new Map<string, number>()
  if (Predicate.isNotUndefined(config.preregisteredWords)) {
    for (const word of config.preregisteredWords) {
      occurrences.set(word, 0)
    }
  }
  const update = (word: string) => {
    const count = occurrences.get(word) ?? 0
    occurrences.set(word, count + 1)
  }
  return {
    get: () => ({ occurrences }),
    update,
    modify: update
  }
}

const makeGaugeHooks = (config: Metric.Config<"Gauge">): Metric.Hooks<
  bigint | number,
  GaugeState<bigint | number>
> => {
  let value = config.bigint ? BigInt(0) as any : 0
  const update = (input: number | bigint) => {
    value = input
  }
  const modify = (input: number | bigint) => {
    value = value + input
  }
  return {
    get: () => ({ value }),
    update,
    modify
  }
}

const makeHistogramHooks = (config: Metric.Config<"Histogram">): Metric.Hooks<number, HistogramState> => {
  const bounds = config.boundaries
  const size = bounds.length
  const values = new Uint32Array(size + 1)
  const boundaries = new Float32Array(size)
  let count = 0
  let sum = 0
  let min = Number.MAX_VALUE
  let max = Number.MIN_VALUE

  Arr.map(Arr.sort(bounds, _Number.Order), (n, i) => {
    boundaries[i] = n
  })

  // Insert the value into the right bucket with a binary search
  const update = (value: number) => {
    let from = 0
    let to = size
    while (from !== to) {
      const mid = Math.floor(from + (to - from) / 2)
      const boundary = boundaries[mid]
      if (value <= boundary) {
        to = mid
      } else {
        from = mid
      }
      // The special case when to / from have a distance of one
      if (to === from + 1) {
        if (value <= boundaries[from]) {
          to = from
        } else {
          from = to
        }
      }
    }
    values[from] = values[from] + 1
    count = count + 1
    sum = sum + value
    if (value < min) {
      min = value
    }
    if (value > max) {
      max = value
    }
  }

  const getBuckets = (): ReadonlyArray<[number, number]> => {
    const builder: Array<[number, number]> = Arr.allocate(size) as any
    let cumulated = 0
    for (let i = 0; i < size; i++) {
      const boundary = boundaries[i]
      const value = values[i]
      cumulated = cumulated + value
      builder[i] = [boundary, cumulated]
    }
    return builder
  }

  return {
    get: () => ({
      buckets: getBuckets(),
      count,
      min,
      max,
      sum
    }),
    update,
    modify: update
  }
}

const makeSummaryHooks = (config: Metric.Config<"Summary">): Metric.Hooks<readonly [number, number], SummaryState> => {
  const { maxSize, quantiles } = config
  const maxAge = Duration.toMillis(config.maxAge)
  const sortedQuantiles = Arr.sort(quantiles, _Number.Order)
  const observations = Arr.allocate<[number, number]>(maxSize)

  for (const quantile of quantiles) {
    if (quantile < 0 || quantile > 1) {
      throw new Error(`Quantile must be between 0 and 1, found: ${quantile}`)
    }
  }

  let head = 0
  let count = 0
  let sum = 0
  let min = Number.MAX_VALUE
  let max = Number.MIN_VALUE

  const snapshot = (now: number): ReadonlyArray<[number, Option.Option<number>]> => {
    const builder: Array<number> = []
    let i = 0
    while (i !== maxSize - 1) {
      const observation = observations[i]
      if (Predicate.isNotUndefined(observation)) {
        const [timestamp, value] = observation
        const age = now - timestamp
        if (age >= 0 && age <= maxAge) {
          builder.push(value)
        }
      }
      i = i + 1
    }
    const samples = Arr.sort(builder, _Number.Order)
    const sampleSize = samples.length
    if (sampleSize === 0) {
      return sortedQuantiles.map((q) => [q, Option.none()])
    }
    // Compute the value of the quantile in terms of rank:
    // > For a given quantile `q`, return the maximum value `v` such that at
    // > most `q * n` values are less than or equal to `v`.
    return sortedQuantiles.map((q) => {
      if (q <= 0) return [q, Option.some(samples[0])]
      if (q >= 1) return [q, Option.some(samples[sampleSize - 1])]
      const index = Math.ceil(q * sampleSize) - 1
      return [q, Option.some(samples[index])]
    })
  }

  const observe = (value: number, timestamp: number) => {
    if (maxSize > 0) {
      head = head + 1
      const target = head % maxSize
      observations[target] = [timestamp, value] as const
    }
    count = count + 1
    sum = sum + value
    if (value < min) {
      min = value
    }
    if (value > max) {
      max = value
    }
  }

  return {
    get: (context) => {
      const clock = Context.get(context, InternalEffect.CurrentClock)
      return {
        quantiles: snapshot(clock.unsafeCurrentTimeMillis()),
        count,
        min,
        max,
        sum
      }
    },
    update: ([value, timestamp]) => observe(value, timestamp),
    modify: ([value, timestamp]) => observe(value, timestamp)
  }
}

/**
 * Updates the provided `Metric` every time the wrapped `Effect` is executed.
 *
 * The metric will be updated regardless of whether the wrapped `Effect`
 * resulted in success or failure.
 *
 * @since 4.0.0
 * @category Tracking
 */
export const track = dual<
  <State>(metric: Metric<unknown, State>) => <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, R>,
  <A, E, R, State>(self: Effect<A, E, R>, metric: Metric<unknown, State>) => Effect<A, E, R>
>(2, (self, metric) => trackWith(self, metric, identity))

/**
 * Updates the provided `Metric` by applying the provided function to the `Exit`
 * value of the wrapped `Effect`.
 *
 * **Note**: The provided function **must** produce a valid `Input` value for
 * the `Metric`.
 *
 * @since 4.0.0
 * @category Tracking
 */
export const trackWith = dual<
  <Input, State, A, E>(
    metric: Metric<Input, State>,
    f: (exit: Exit<A, E>) => Input
  ) => <R>(self: Effect<A, E, R>) => Effect<A, E, R>,
  <A, E, R, Input, State>(
    self: Effect<A, E, R>,
    metric: Metric<Input, State>,
    f: (exit: Exit<A, E>) => Input
  ) => Effect<A, E, R>
>(3, (self, metric, f) => InternalEffect.onExit(self, (exit) => update(metric, f(exit))))

/**
 * Updates the provided `Metric` every time the wrapped `Effect` results in an
 * **expected** error.
 *
 * @since 4.0.0
 * @category Tracking
 */
export const trackErrors = dual<
  <State>(metric: Metric<unknown, State>) => <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, R>,
  <A, E, R, State>(self: Effect<A, E, R>, metric: Metric<unknown, State>) => Effect<A, E, R>
>(2, (self, metric) => trackErrorsWith(self, metric, identity))

/**
 * Updates the provided `Metric` by applying the provided function to any
 * **expected** errors returned by the wrapped `Effect`.
 *
 * **Note**: The provided function **must** produce a valid `Input` value for
 * the `Metric`.
 *
 * @since 4.0.0
 * @category Tracking
 */
export const trackErrorsWith = dual<
  <Input, State, E>(
    metric: Metric<Input, State>,
    f: (error: E) => Input
  ) => <A, R>(self: Effect<A, E, R>) => Effect<A, E, R>,
  <A, E, R, Input, State>(
    self: Effect<A, E, R>,
    metric: Metric<Input, State>,
    f: (error: E) => Input
  ) => Effect<A, E, R>
>(3, (self, metric, f) => InternalEffect.tapError(self, (error) => update(metric, f(error))))

/**
 * Updates the provided `Metric` every time the wrapped `Effect` results in an
 * **unexpected** error (i.e. a defect).
 *
 * @since 4.0.0
 * @category Tracking
 */
export const trackDefects = dual<
  <State>(metric: Metric<unknown, State>) => <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, R>,
  <A, E, R, State>(self: Effect<A, E, R>, metric: Metric<unknown, State>) => Effect<A, E, R>
>(2, (self, metric) => trackDefectsWith(self, metric, identity))

/**
 * Updates the provided `Metric` by applying the provided function to any
 * **unexpected** errors (i.e. defects) raised by the wrapped `Effect`.
 *
 * **Note**: The provided function **must** produce a valid `Input` value for
 * the `Metric`.
 *
 * @since 4.0.0
 * @category Tracking
 */
export const trackDefectsWith = dual<
  <Input, State, E>(
    metric: Metric<Input, State>,
    f: (defect: unknown) => Input
  ) => <A, R>(self: Effect<A, E, R>) => Effect<A, E, R>,
  <A, E, R, Input, State>(
    self: Effect<A, E, R>,
    metric: Metric<Input, State>,
    f: (defect: unknown) => Input
  ) => Effect<A, E, R>
>(3, (self, metric, f) => InternalEffect.tapDefect(self, (defect) => update(metric, f(defect))))

/**
 * Updates the provided `Metric` with the `Duration` of time (in nanoseconds)
 * that the wrapped `Effect` took to complete.
 *
 * The metric will be updated regardless of whether the wrapped `Effect`
 * resulted in success or failure.
 *
 * @since 4.0.0
 * @category Tracking
 */
export const trackDuration = dual<
  <State>(metric: Metric<Duration.Duration, State>) => <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, R>,
  <A, E, R, State>(self: Effect<A, E, R>, metric: Metric<Duration.Duration, State>) => Effect<A, E, R>
>(2, (self, metric) => trackDurationWith(self, metric, identity))

/**
 * Updates the provided `Metric` by applying the provided function to the
 * `Duration` of time (in nanoseconds) that the wrapped `Effect` took to
 * complete.
 *
 * **Note**: The provided function **must** produce a valid `Input` value for
 * the `Metric`.
 *
 * @since 4.0.0
 * @category Tracking
 */
export const trackDurationWith = dual<
  <Input, State, E>(
    metric: Metric<Input, State>,
    f: (duration: Duration.Duration) => Input
  ) => <A, R>(self: Effect<A, E, R>) => Effect<A, E, R>,
  <A, E, R, Input, State>(
    self: Effect<A, E, R>,
    metric: Metric<Input, State>,
    f: (duration: Duration.Duration) => Input
  ) => Effect<A, E, R>
>(3, (self, metric, f) =>
  InternalEffect.clockWith((clock) => {
    const startTime = clock.unsafeCurrentTimeNanos()
    return InternalEffect.onExit(self, () => {
      const endTime = clock.unsafeCurrentTimeNanos()
      const duration = Duration.subtract(endTime, startTime)
      return update(metric, f(duration))
    })
  }))

/**
 * Retrieves the current state of the specified `Metric`.
 *
 * @since 2.0.0
 * @category Utilities
 */
export const value = <Input, State>(
  self: Metric<Input, State>
): Effect<State> =>
  InternalEffect.flatMap(
    InternalEffect.context(),
    (context) => InternalEffect.sync(() => self.unsafeValue(context))
  )

/**
 * Modifies the metric with the specified input.
 *
 * For example, if the metric were a `Gauge`, modifying would add the specified
 * value to the `Gauge`.
 *
 * @since 2.0.0
 * @category Utilities
 */
export const modify: {
  <Input>(input: Input): <State>(self: Metric<Input, State>) => Effect<void>
  <Input, State>(self: Metric<Input, State>, input: Input): Effect<void>
} = dual<
  <Input>(input: Input) => <State>(self: Metric<Input, State>) => Effect<void>,
  <Input, State>(self: Metric<Input, State>, input: Input) => Effect<void>
>(2, (self, input) =>
  InternalEffect.flatMap(
    InternalEffect.context(),
    (context) => InternalEffect.sync(() => self.unsafeModify(input, context))
  ))

/**
 * Updates the metric with the specified input.
 *
 * For example, if the metric were a `Gauge`, updating would set the `Gauge` to
 * the specified value.
 *
 * @since 2.0.0
 * @category Utilities
 */
export const update: {
  <Input>(input: Input): <State>(self: Metric<Input, State>) => Effect<void>
  <Input, State>(self: Metric<Input, State>, input: Input): Effect<void>
} = dual<
  <Input>(input: Input) => <State>(self: Metric<Input, State>) => Effect<void>,
  <Input, State>(self: Metric<Input, State>, input: Input) => Effect<void>
>(2, (self, input) =>
  InternalEffect.flatMap(
    InternalEffect.context(),
    (context) => InternalEffect.sync(() => self.unsafeUpdate(input, context))
  ))

/**
 * Returns a new metric that is powered by this one, but which accepts updates
 * of the specified new type, which must be transformable to the input type of
 * this metric.
 *
 * @since 2.0.0
 * @category Mapping
 */
export const mapInput: {
  <Input, Input2 extends Input>(
    f: (input: Input2, context: Context.Context<never>) => Input
  ): <State>(self: Metric<Input, State>) => Metric<Input2, State>
  <Input, State, Input2>(
    self: Metric<Input, State>,
    f: (input: Input2, context: Context.Context<never>) => Input
  ): Metric<Input2, State>
} = dual<
  <Input, Input2 extends Input>(
    f: (input: Input2, context: Context.Context<never>) => Input
  ) => <State>(self: Metric<Input, State>) => Metric<Input2, State>,
  <Input, State, Input2>(
    self: Metric<Input, State>,
    f: (input: Input2, context: Context.Context<never>) => Input
  ) => Metric<Input2, State>
>(2, <Input, State, Input2>(
  self: Metric<Input, State>,
  f: (input: Input2, context: Context.Context<never>) => Input
): Metric<Input2, State> =>
  makeMetric<any, Input2, State>(self.type, {
    id: self.name,
    description: self.description,
    attributes: self.attributes,
    unsafeValue: (context) => self.unsafeValue(context),
    unsafeUpdate: (input, context) => self.unsafeUpdate(f(input, context), context),
    unsafeModify: (input, context) => self.unsafeModify(f(input, context), context)
  }))

/**
 * Returns a new metric that is powered by this one, but which accepts updates
 * of any type, and translates them to updates with the specified constant
 * update value.
 *
 * @since 2.0.0
 * @category Input
 */
export const withConstantInput: {
  <Input>(input: Input): <State>(self: Metric<Input, State>) => Metric<unknown, State>
  <Input, State>(self: Metric<Input, State>, input: Input): Metric<unknown, State>
} = dual<
  <Input>(input: Input) => <State>(self: Metric<Input, State>) => Metric<unknown, State>,
  <Input, State>(self: Metric<Input, State>, input: Input) => Metric<unknown, State>
>(2, (self, input) => mapInput(self, () => input))

/**
 * @since 4.0.0
 * @category Attributes
 */
export const withAttributes: {
  (attributes: Metric.Attributes): <Input, State>(self: Metric<Input, State>) => Metric<Input, State>
  <Input, State>(self: Metric<Input, State>, attributes: Metric.Attributes): Metric<Input, State>
} = dual<
  (attributes: Metric.Attributes) => <Input, State>(self: Metric<Input, State>) => Metric<Input, State>,
  <Input, State>(self: Metric<Input, State>, attributes: Metric.Attributes) => Metric<Input, State>
>(2, <Input, State>(
  self: Metric<Input, State>,
  attributes: Metric.Attributes
): Metric<Input, State> =>
  makeMetric<any, Input, State>(self.type, {
    id: self.name,
    description: self.description,
    attributes: self.attributes,
    unsafeValue: (context) => self.unsafeValue(addAttributesToContext(context, attributes)),
    unsafeUpdate: (input, context) => self.unsafeUpdate(input, addAttributesToContext(context, attributes)),
    unsafeModify: (input, context) => self.unsafeModify(input, addAttributesToContext(context, attributes))
  }))

// Metric Snapshots

/**
 * @since 2.0.0
 * @category Snapshotting
 */
export const snapshot: Effect<ReadonlyArray<Metric.Snapshot>> = InternalEffect.map(
  InternalEffect.context(),
  (context) => makeSnapshot(context)
)

/**
 * @since 2.0.0
 * @category Debugging
 */
export const dump: Effect<string> = InternalEffect.flatMap(InternalEffect.context(), (context) => {
  const metrics = makeSnapshot(context)
  if (metrics.length > 0) {
    const maxNameLength = metrics.reduce((max, metric) => {
      const length = metric.id.length
      return length > max ? length : max
    }, 0) + 2
    const maxDescriptionLength = metrics.reduce((max, metric) => {
      const length = metric.description.length === 0 ? 0 : metric.description.length
      return length > max ? length : max
    }, 0) + 2
    const maxTypeLength = metrics.reduce((max, metric) => {
      const length = metric.type.length
      return length > max ? length : max
    }, 0) + 2
    const maxAttributesLength = metrics.reduce((max, metric) => {
      const length = attributesToString(metric.attributes).length
      return length > max ? length : max
    }, 0) + 2
    const grouped = Object.entries(Arr.groupBy(metrics, (metric) => metric.id))
    const sorted = Arr.sortWith(grouped, (entry) => entry[0], _String.Order)
    const rendered = sorted.map(([, group]) =>
      group.map((metric) =>
        renderName(metric, maxNameLength) +
        renderDescription(metric, maxDescriptionLength) +
        renderType(metric, maxTypeLength) +
        renderAttributes(metric, maxAttributesLength) +
        renderState(metric)
      ).join("\n")
    ).join("\n")
    return InternalEffect.succeed(rendered)
  }
  return InternalEffect.succeed("")
})

const makeSnapshot = (context: Context.Context<never>): ReadonlyArray<Metric.Snapshot> => {
  const registry = Context.get(context, CurrentMetricRegistry)
  return Array.from(registry.values()).map(({ hooks, ...meta }) => ({
    ...meta,
    state: hooks.get(context)
  }))
}

const renderName = (metric: Metric.Snapshot, padTo: number): string => `name=${metric.id.padEnd(padTo, " ")}`

const renderDescription = (metric: Metric.Snapshot, padTo: number): string =>
  `description=${metric.description.padEnd(padTo, " ")}`

const renderType = (metric: Metric.Snapshot, padTo: number): string => `type=${metric.type.padEnd(padTo, " ")}`

const renderAttributes = (metric: Metric.Snapshot, padTo: number): string => {
  const attrs = attributesToString(metric.attributes)
  const padding = " ".repeat(Math.max(0, padTo - attrs.length))
  return `${attrs}${padding}`
}

const renderState = (metric: Metric.Snapshot): string => {
  const prefix: string = "state="
  switch (metric.type) {
    case "Counter": {
      const state = metric.state as CounterState<number | bigint>
      return `${prefix}[count: [${state.count}]]`
    }
    case "Frequency": {
      const state = metric.state as FrequencyState
      return `${prefix}[occurrences: ${renderKeyValues(state.occurrences)}]`
    }
    case "Gauge": {
      const state = metric.state as GaugeState<number | bigint>
      return `${prefix}[value: [${state.value}]]`
    }
    case "Histogram": {
      const state = metric.state as HistogramState
      const buckets = `buckets: [${renderKeyValues(state.buckets)}]`
      const count = `count: [${state.count}]`
      const min = `min: [${state.min}]`
      const max = `max: [${state.max}]`
      const sum = `sum: [${state.sum}]`
      return `${prefix}[${buckets}, ${count}, ${min}, ${max}, ${sum}]`
    }
    case "Summary": {
      const state = metric.state as SummaryState
      const printableQuantiles = state.quantiles.map(([key, value]) =>
        [key, Option.getOrElse(value, () => 0)] as [number, number]
      )
      const quantiles = `quantiles: [${renderKeyValues(printableQuantiles)}]`
      const count = `count: [${state.count}]`
      const min = `min: [${state.min}]`
      const max = `max: [${state.max}]`
      const sum = `sum: [${state.sum}]`
      return `${prefix}[${quantiles}, ${count}, ${min}, ${max}, ${sum}]`
    }
  }
}

const renderKeyValues = (keyValues: Iterable<[number | string, string | number]>): string =>
  Array.from(keyValues).map(([key, value]) => `(${key} -> ${value})`).join(", ")

const attributesToString = (attributes: Metric.AttributeSet): string => {
  const attrs = Object.entries(attributes)
  const sorted = Arr.sortWith(attrs, (attr) => attr[0], _String.Order)
  return `attributes=[${sorted.map(([key, value]) => `${key}: ${value}`).join(", ")}]`
}

// Metric Boundaries

/**
 * A helper method to create histogram bucket boundaries from an iterable set
 * of values.
 *
 * @since 2.0.0
 * @category Boundaries
 */
export const boundariesFromIterable = (iterable: Iterable<number>): ReadonlyArray<number> =>
  Arr.append(Arr.filter(new Set(iterable), (n) => n > 0), Number.POSITIVE_INFINITY)

/**
 * A helper method to create histogram bucket boundaries with linearly
 * increasing values.
 *
 * @since 2.0.0
 * @category Boundaries
 */
export const linearBoundaries = (options: {
  readonly start: number
  readonly width: number
  readonly count: number
}): ReadonlyArray<number> =>
  boundariesFromIterable(Arr.makeBy(options.count - 1, (n) => options.start + n + options.width))

/**
 * A helper method to create histogram bucket boundaries with exponentially
 * increasing values.
 *
 * @since 2.0.0
 * @category Boundaries
 */
export const exponentialBoundaries = (options: {
  readonly start: number
  readonly factor: number
  readonly count: number
}): ReadonlyArray<number> =>
  boundariesFromIterable(Arr.makeBy(options.count - 1, (i) => options.start * Math.pow(options.factor, i)))

// Fiber Runtime Metrics

const fibersActive = gauge("child_fibers_active", {
  description: "The current count of active child fibers"
})
const fibersStarted = counter("child_fibers_started", {
  description: "The total number of child fibers that have been started",
  incremental: true
})
const fiberSuccesses = counter("child_fiber_successes", {
  description: "The total number of child fibers that have succeeded",
  incremental: true
})
const fiberFailures = counter("child_fiber_failures", {
  description: "The total number of child fibers that have failed",
  incremental: true
})

/**
 * @since 4.0.0
 * @category Runtime Metrics
 */
export const FiberRuntimeMetricsKey: typeof InternalMetric.FiberRuntimeMetricsKey =
  InternalMetric.FiberRuntimeMetricsKey

/**
 * @since 4.0.0
 * @category Runtime Metrics
 */
export class FiberRuntimeMetrics extends Context.Tag<FiberRuntimeMetrics, {
  readonly recordFiberStart: (context: Context.Context<never>) => void
  readonly recordFiberEnd: (context: Context.Context<never>, exit: Exit<unknown, unknown>) => void
}>()(InternalMetric.FiberRuntimeMetricsKey) {}

/**
 * @since 4.0.0
 * @category Runtime Metrics
 */
export const enableRuntimeMetrics = <A, E, R>(self: Effect<A, E, R>): Effect<A, E, R> =>
  InternalEffect.provideService(self, FiberRuntimeMetrics, {
    recordFiberStart: (context) => {
      fibersStarted.unsafeUpdate(1, context)
      fibersActive.unsafeModify(1, context)
    },
    recordFiberEnd: (context, exit) => {
      fibersActive.unsafeModify(-1, context)
      if (InternalEffect.exitIsSuccess(exit)) {
        fiberSuccesses.unsafeUpdate(1, context)
      } else {
        fiberFailures.unsafeUpdate(1, context)
      }
    }
  })
