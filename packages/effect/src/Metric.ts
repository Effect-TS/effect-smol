/**
 * @since 2.0.0
 *
 * The `Metric` module provides a comprehensive system for collecting, aggregating, and observing
 * application metrics in Effect applications. It offers type-safe, concurrent metrics that can
 * be used to monitor performance, track business metrics, and gain insights into application behavior.
 *
 * ## Key Features
 *
 * - **Five Metric Types**: Counters, Gauges, Frequencies, Histograms, and Summaries
 * - **Type Safety**: Fully typed metrics with compile-time guarantees
 * - **Concurrency Safe**: Thread-safe metrics that work with Effect's concurrency model
 * - **Attributes**: Tag metrics with key-value attributes for filtering and grouping
 * - **Snapshots**: Take point-in-time snapshots of all metrics for reporting
 * - **Runtime Integration**: Automatic fiber runtime metrics collection
 *
 * ## Metric Types
 *
 * ### Counter
 * Tracks cumulative values that only increase or can be reset to zero.
 * Perfect for counting events, requests, errors, etc.
 *
 * ### Gauge
 * Represents a single numerical value that can go up or down.
 * Ideal for current resource usage, temperature, queue sizes, etc.
 *
 * ### Frequency
 * Counts occurrences of discrete string values.
 * Useful for tracking categorical data like HTTP status codes, user actions, etc.
 *
 * ### Histogram
 * Records observations in configurable buckets to analyze distribution.
 * Great for response times, request sizes, and other measured values.
 *
 * ### Summary
 * Calculates quantiles over a sliding time window.
 * Provides statistical insights into value distributions over time.
 *
 * ## Basic Usage
 *
 * ```ts
 * import { Effect, Metric } from "effect"
 *
 * // Create metrics
 * const requestCount = Metric.counter("http_requests_total", {
 *   description: "Total number of HTTP requests"
 * })
 *
 * const responseTime = Metric.histogram("http_response_time", {
 *   description: "HTTP response time in milliseconds",
 *   boundaries: Metric.linearBoundaries({ start: 0, width: 50, count: 20 })
 * })
 *
 * // Use metrics in your application
 * const handleRequest = Effect.gen(function* () {
 *   yield* Metric.update(requestCount, 1)
 *
 *   const startTime = yield* Effect.clockWith(clock => clock.currentTimeMillis)
 *
 *   // Process request...
 *   yield* Effect.sleep("100 millis")
 *
 *   const endTime = yield* Effect.clockWith(clock => clock.currentTimeMillis)
 *   yield* Metric.update(responseTime, endTime - startTime)
 * })
 * ```
 *
 * ## Attributes and Tagging
 *
 * ```ts
 * import { Effect, Metric } from "effect"
 *
 * const requestCount = Metric.counter("requests", {
 *   description: "Number of requests by endpoint and method"
 * })
 *
 * const program = Effect.gen(function* () {
 *   // Add attributes to metrics
 *   yield* Metric.update(
 *     Metric.withAttributes(requestCount, {
 *       endpoint: "/api/users",
 *       method: "GET"
 *     }),
 *     1
 *   )
 *
 *   // Or use tagged metrics
 *   yield* Metric.tagged(
 *     Metric.update(requestCount, 1),
 *     { endpoint: "/api/posts", method: "POST" }
 *   )
 * })
 * ```
 *
 * ## Advanced Examples
 *
 * ```ts
 * import { Effect, Metric, Schedule } from "effect"
 *
 * // Business metrics
 * const userSignups = Metric.counter("user_signups_total")
 * const activeUsers = Metric.gauge("active_users_current")
 * const featureUsage = Metric.frequency("feature_usage")
 *
 * // Performance metrics
 * const dbQueryTime = Metric.summary("db_query_duration", {
 *   maxAge: "5 minutes",
 *   maxSize: 1000,
 *   quantiles: [0.5, 0.9, 0.95, 0.99]
 * })
 *
 * const program = Effect.gen(function* () {
 *   // Track user signup
 *   yield* Metric.update(userSignups, 1)
 *
 *   // Update active user count
 *   yield* Metric.update(activeUsers, 1250)
 *
 *   // Record feature usage
 *   yield* Metric.update(featureUsage, "dashboard_view")
 *
 *   // Measure database query time
 *   yield* Effect.timed(performDatabaseQuery).pipe(
 *     Effect.tap(([duration]) => Metric.update(dbQueryTime, duration))
 *   )
 * })
 *
 * // Get metric snapshots
 * const getMetrics = Effect.gen(function* () {
 *   const snapshots = yield* Metric.snapshot
 *
 *   for (const metric of snapshots) {
 *     console.log(`${metric.id}: ${JSON.stringify(metric.state)}`)
 *   }
 * })
 * ```
 */

import * as Arr from "./Array.js"
import * as Duration from "./Duration.js"
import type { Effect } from "./Effect.js"
import type { Exit } from "./Exit.js"
import { dual } from "./Function.js"
import * as InternalEffect from "./internal/effect.js"
import * as InternalMetric from "./internal/metric.js"
import * as Layer from "./Layer.js"
import * as Option from "./Option.js"
import * as Order from "./Order.js"
import type { Pipeable } from "./Pipeable.js"
import { pipeArguments } from "./Pipeable.js"
import * as Predicate from "./Predicate.js"
import * as ServiceMap from "./ServiceMap.js"
import * as _String from "./String.js"
import type { Contravariant, Covariant } from "./Types.js"

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
export interface Metric<in Input, out State> extends Pipeable {
  readonly "~effect/Metric": "~effect/Metric"
  readonly Input: Contravariant<Input>
  readonly State: Covariant<State>
  readonly id: string
  readonly type: Metric.Type
  readonly description: string | undefined
  readonly attributes: Metric.AttributeSet | undefined
  readonly unsafeValue: (context: ServiceMap.ServiceMap<never>) => State
  readonly unsafeUpdate: (input: Input, context: ServiceMap.ServiceMap<never>) => void
  readonly unsafeModify: (input: Input, context: ServiceMap.ServiceMap<never>) => void
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
  readonly incremental: boolean
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
  export interface Hooks<in Input, out State> {
    readonly get: (context: ServiceMap.ServiceMap<never>) => State
    readonly update: (input: Input, context: ServiceMap.ServiceMap<never>) => void
    readonly modify: (input: Input, context: ServiceMap.ServiceMap<never>) => void
  }

  /**
   * @since 4.0.0
   */
  export interface Metadata<in Input, out State> {
    readonly id: string
    readonly type: Type
    readonly description: string | undefined
    readonly attributes: Metric.AttributeSet | undefined
    readonly hooks: Hooks<Input, State>
  }

  /**
   * @since 4.0.0
   */
  export interface SnapshotProto<T extends Type, State> {
    readonly id: string
    readonly type: T
    readonly description: string | undefined
    readonly attributes: Metric.AttributeSet | undefined
    readonly state: State
  }

  /**
   * @since 4.0.0
   */
  export type Snapshot =
    | SnapshotProto<"Counter", CounterState<number | bigint>>
    | SnapshotProto<"Gauge", GaugeState<number | bigint>>
    | SnapshotProto<"Frequency", FrequencyState>
    | SnapshotProto<"Histogram", HistogramState>
    | SnapshotProto<"Summary", SummaryState>
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
export class CurrentMetricAttributes extends ServiceMap.Reference(CurrentMetricAttributesKey, {
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
export class CurrentMetricRegistry extends ServiceMap.Reference(CurrentMetricRegistryKey, {
  defaultValue: () => new Map<string, Metric.Metadata<any, any>>()
}) {}

abstract class Metric$<in Input, out State> implements Metric<Input, State> {
  readonly "~effect/Metric" = "~effect/Metric"

  abstract readonly type: Metric.Type

  declare readonly Input: Contravariant<Input>
  declare readonly State: Covariant<State>

  readonly #metadataCache = new WeakMap<Metric.Attributes, Metric.Metadata<Input, State>>()
  #metadata: Metric.Metadata<Input, State> | undefined

  constructor(
    readonly id: string,
    readonly description: string | undefined,
    readonly attributes: Metric.AttributeSet | undefined
  ) {}

  unsafeValue(context: ServiceMap.ServiceMap<never>): State {
    return this.hook(context).get(context)
  }

  unsafeModify(input: Input, context: ServiceMap.ServiceMap<never>): void {
    return this.hook(context).modify(input, context)
  }

  unsafeUpdate(input: Input, context: ServiceMap.ServiceMap<never>): void {
    return this.hook(context).update(input, context)
  }

  abstract createHooks(): Metric.Hooks<Input, State>

  hook(context: ServiceMap.ServiceMap<never>): Metric.Hooks<Input, State> {
    const extraAttributes = ServiceMap.get(context, CurrentMetricAttributes)
    if (Object.keys(extraAttributes).length === 0) {
      if (Predicate.isNotUndefined(this.#metadata)) {
        return this.#metadata.hooks
      }
      this.#metadata = this.getOrCreate(context, this.attributes)
      return this.#metadata.hooks
    }
    const mergedAttributes = mergeAttributes(this.attributes, extraAttributes)
    let metadata = this.#metadataCache.get(mergedAttributes)
    if (Predicate.isNotUndefined(metadata)) {
      return metadata.hooks
    }
    metadata = this.getOrCreate(context, mergedAttributes)
    this.#metadataCache.set(mergedAttributes, metadata)
    return metadata.hooks
  }

  getOrCreate(
    context: ServiceMap.ServiceMap<never>,
    attributes: Metric.Attributes | undefined
  ): Metric.Metadata<Input, State> {
    const key = makeKey(this, attributes)
    const registry = ServiceMap.get(context, CurrentMetricRegistry)
    if (registry.has(key)) {
      return registry.get(key)!
    }
    const hooks = this.createHooks()
    const meta: Metric.Metadata<Input, State> = {
      id: this.id,
      type: this.type,
      description: this.description,
      attributes: attributesToRecord(attributes),
      hooks
    }
    registry.set(key, meta)
    return meta
  }

  pipe() {
    return pipeArguments(this, arguments)
  }
}

const bigint0 = BigInt(0)

class CounterMetric<Input extends number | bigint> extends Metric$<Input, CounterState<Input>> {
  readonly type = "Counter"
  readonly #bigint: boolean
  readonly #incremental: boolean

  constructor(id: string, options?: {
    readonly description?: string | undefined
    readonly attributes?: Metric.Attributes | undefined
    readonly bigint?: boolean | undefined
    readonly incremental?: boolean | undefined
  }) {
    super(id, options?.description, attributesToRecord(options?.attributes))
    this.#bigint = options?.bigint ?? false
    this.#incremental = options?.incremental ?? false
  }

  createHooks(): Metric.Hooks<Input, CounterState<Input>> {
    let count = (this.#bigint ? bigint0 : 0) as any
    const canUpdate = this.#incremental
      ? this.#bigint
        ? (value: bigint | number) => value >= bigint0
        : (value: bigint | number) => value >= 0
      : (_value: bigint | number) => true
    const update = (value: Input) => {
      if (canUpdate(value)) {
        count = (count as any) + value
      }
    }
    return makeHooks(() => ({ count, incremental: this.#incremental }), update)
  }
}

class GaugeMetric<Input extends number | bigint> extends Metric$<Input, GaugeState<Input>> {
  readonly type = "Gauge"
  readonly #bigint: boolean

  constructor(id: string, options?: {
    readonly description?: string | undefined
    readonly attributes?: Metric.Attributes | undefined
    readonly bigint?: boolean | undefined
  }) {
    super(id, options?.description, attributesToRecord(options?.attributes))
    this.#bigint = options?.bigint ?? false
  }

  createHooks(): Metric.Hooks<Input, GaugeState<Input>> {
    let value = this.#bigint ? BigInt(0) as any : 0
    const update = (input: number | bigint) => {
      value = input
    }
    const modify = (input: number | bigint) => {
      value = value + input
    }
    return makeHooks(() => ({ value }), update, modify)
  }
}

class FrequencyMetric extends Metric$<string, FrequencyState> {
  readonly type = "Frequency"
  readonly #preregisteredWords: ReadonlyArray<string> | undefined

  constructor(id: string, options?: {
    readonly description?: string | undefined
    readonly attributes?: Metric.Attributes | undefined
    readonly preregisteredWords?: ReadonlyArray<string> | undefined
  }) {
    super(id, options?.description, attributesToRecord(options?.attributes))
    this.#preregisteredWords = options?.preregisteredWords
  }

  createHooks(): Metric.Hooks<string, FrequencyState> {
    const occurrences = new Map<string, number>()
    if (Predicate.isNotUndefined(this.#preregisteredWords)) {
      for (const word of this.#preregisteredWords) {
        occurrences.set(word, 0)
      }
    }
    const update = (word: string) => {
      const count = occurrences.get(word) ?? 0
      occurrences.set(word, count + 1)
    }
    return makeHooks(() => ({ occurrences }), update)
  }
}

class HistogramMetric extends Metric$<number, HistogramState> {
  readonly type = "Histogram"
  readonly #boundaries: ReadonlyArray<number>

  constructor(id: string, options: {
    readonly description?: string | undefined
    readonly attributes?: Metric.Attributes | undefined
    readonly boundaries: ReadonlyArray<number>
  }) {
    super(id, options?.description, attributesToRecord(options?.attributes))
    this.#boundaries = options.boundaries
  }

  createHooks(): Metric.Hooks<number, HistogramState> {
    const bounds = this.#boundaries
    const size = bounds.length
    const values = new Uint32Array(size + 1)
    const boundaries = new Float32Array(size)
    let count = 0
    let sum = 0
    let min = Number.MAX_VALUE
    let max = Number.MIN_VALUE

    Arr.map(Arr.sort(bounds, Order.number), (n, i) => {
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

    return makeHooks(() => ({ buckets: getBuckets(), count, min, max, sum }), update)
  }
}

class SummaryMetric extends Metric$<readonly [value: number, timestamp: number], SummaryState> {
  readonly type = "Summary"
  readonly #maxAge: number
  readonly #maxSize: number
  readonly #quantiles: ReadonlyArray<number>

  constructor(id: string, options: {
    readonly description?: string | undefined
    readonly attributes?: Metric.Attributes | undefined
    readonly maxAge: Duration.DurationInput
    readonly maxSize: number
    readonly quantiles: ReadonlyArray<number>
  }) {
    super(id, options?.description, attributesToRecord(options?.attributes))
    this.#maxAge = Duration.toMillis(options.maxAge)
    this.#maxSize = options.maxSize
    this.#quantiles = options.quantiles
  }

  createHooks(): Metric.Hooks<readonly [value: number, timestamp: number], SummaryState> {
    const sortedQuantiles = Arr.sort(this.#quantiles, Order.number)
    const observations = Arr.allocate<[number, number]>(this.#maxSize)

    for (const quantile of this.#quantiles) {
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
      while (i < this.#maxSize) {
        const observation = observations[i]
        if (Predicate.isNotUndefined(observation)) {
          const [timestamp, value] = observation
          const age = now - timestamp
          if (age >= 0 && age <= this.#maxAge) {
            builder.push(value)
          }
        }
        i = i + 1
      }
      const samples = Arr.sort(builder, Order.number)
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
      if (this.#maxSize > 0) {
        const target = head % this.#maxSize
        observations[target] = [timestamp, value] as const
        head = head + 1
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

    const get = (context: ServiceMap.ServiceMap<never>) => {
      const clock = ServiceMap.get(context, InternalEffect.CurrentClock)
      const quantiles = snapshot(clock.unsafeCurrentTimeMillis())
      return { quantiles, count, min, max, sum }
    }

    const update = ([value, timestamp]: readonly [value: number, timestamp: number]) => observe(value, timestamp)

    return makeHooks(get, update)
  }
}

class MetricTransform<in Input, out State, in Input2> extends Metric$<Input2, State> {
  type: Metric.Type
  constructor(
    readonly metric: Metric<Input, State>,
    readonly unsafeValue: (context: ServiceMap.ServiceMap<never>) => State,
    readonly unsafeUpdate: (input: Input2, context: ServiceMap.ServiceMap<never>) => void,
    readonly unsafeModify: (input: Input2, context: ServiceMap.ServiceMap<never>) => void
  ) {
    super(metric.id, metric.description, metric.attributes)
    this.type = metric.type
  }
  createHooks(): Metric.Hooks<Input2, State> {
    return (this.metric as any).createHooks()
  }
}

/**
 * Returns `true` if the specified value is a `Metric`, otherwise returns `false`.
 *
 * This function is useful for runtime type checking and ensuring that a value
 * conforms to the Metric interface before performing metric operations.
 *
 * @example
 * ```ts
 * import { Metric } from "effect"
 *
 * const counter = Metric.counter("requests")
 * const gauge = Metric.gauge("temperature")
 * const notAMetric = { name: "fake-metric" }
 *
 * console.log(Metric.isMetric(counter))    // true
 * console.log(Metric.isMetric(gauge))      // true
 * console.log(Metric.isMetric(notAMetric)) // false
 * console.log(Metric.isMetric(null))       // false
 * ```
 *
 * @since 4.0.0
 * @category Guards
 */
export const isMetric = (u: unknown): u is Metric<unknown, never> =>
  Predicate.hasProperty(u, "~effect/Metric") && u["~effect/Metric"] === "~effect/Metric"

/**
 * Represents a Counter metric that tracks cumulative numerical values over
 * time. Counters can be incremented and decremented and provide a running total
 * of changes.
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
} = (name, options) => new CounterMetric(name, options) as any

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
} = (name, options) => new GaugeMetric(name, options) as any

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
}): Frequency => new FrequencyMetric(name, options)

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
}): Histogram<number> => new HistogramMetric(name, options)

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
      ServiceMap.get(context, InternalEffect.CurrentClock).unsafeCurrentTimeMillis()
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
}): Summary<[value: number, timestamp: number]> => new SummaryMetric(name, options)

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
  const attributes = mergeAttributes(options?.attributes, { time_unit: "milliseconds" })
  const metric = new HistogramMetric(name, { ...options, boundaries, attributes })
  return mapInput(metric, Duration.toMillis)
}

/**
 * Retrieves the current state of the specified `Metric`.
 *
 * This function returns an Effect that, when executed, will provide the current
 * aggregated state of the metric. The state type depends on the metric type:
 * - Counter: `{ count: number | bigint }`
 * - Gauge: `{ value: number | bigint }`
 * - Frequency: `{ occurrences: Map<string, number> }`
 * - Histogram: `{ buckets: Array<[number, number]>, count: number, min: number, max: number, sum: number }`
 * - Summary: `{ quantiles: Array<[number, Option<number>]>, count: number, min: number, max: number, sum: number }`
 *
 * @example
 * ```ts
 * import { Effect, Metric } from "effect"
 *
 * const requestCounter = Metric.counter("requests")
 * const responseTime = Metric.histogram("response_time", {
 *   boundaries: [100, 500, 1000, 2000]
 * })
 *
 * const program = Effect.gen(function* () {
 *   // Update metrics
 *   yield* Metric.update(requestCounter, 1)
 *   yield* Metric.update(responseTime, 750)
 *
 *   // Get current values
 *   const counterState = yield* Metric.value(requestCounter)
 *   console.log(`Request count: ${counterState.count}`)
 *
 *   const histogramState = yield* Metric.value(responseTime)
 *   console.log(`Response time stats:`, {
 *     count: histogramState.count,
 *     min: histogramState.min,
 *     max: histogramState.max,
 *     average: histogramState.sum / histogramState.count
 *   })
 * })
 * ```
 *
 * @since 2.0.0
 * @category Utilities
 */
export const value = <Input, State>(
  self: Metric<Input, State>
): Effect<State> =>
  InternalEffect.flatMap(
    InternalEffect.services(),
    (context) => InternalEffect.sync(() => self.unsafeValue(context))
  )

/**
 * Modifies the metric with the specified input.
 *
 * The behavior of `modify` depends on the metric type:
 * - **Counter**: Adds the input value to the current count
 * - **Gauge**: Adds the input value to the current gauge value
 * - **Frequency**: Same as `update` - increments the occurrence count for the input string
 * - **Histogram**: Same as `update` - records the input value in the appropriate bucket
 * - **Summary**: Same as `update` - records the input observation
 *
 * @example
 * ```ts
 * import { Effect, Metric } from "effect"
 *
 * const temperatureGauge = Metric.gauge("temperature")
 * const requestCounter = Metric.counter("requests")
 *
 * const program = Effect.gen(function* () {
 *   // Set initial temperature
 *   yield* Metric.update(temperatureGauge, 20)
 *
 *   // Modify by adding/subtracting values
 *   yield* Metric.modify(temperatureGauge, 5)  // Now 25
 *   yield* Metric.modify(temperatureGauge, -3) // Now 22
 *
 *   // For counters, modify increments by the specified amount
 *   yield* Metric.modify(requestCounter, 10)   // Add 10 to counter
 *   yield* Metric.modify(requestCounter, 5)    // Add 5 more (total: 15)
 *
 *   const temp = yield* Metric.value(temperatureGauge)
 *   const requests = yield* Metric.value(requestCounter)
 *
 *   console.log(`Temperature: ${temp.value}°C`) // 22°C
 *   console.log(`Requests: ${requests.count}`)   // 15
 * })
 * ```
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
    InternalEffect.services(),
    (context) => InternalEffect.sync(() => self.unsafeModify(input, context))
  ))

/**
 * Updates the metric with the specified input.
 *
 * The behavior of `update` depends on the metric type:
 * - **Counter**: Adds the input value to the current count (same as `modify`)
 * - **Gauge**: Sets the gauge to the specified value (replaces current value)
 * - **Frequency**: Increments the occurrence count for the input string by 1
 * - **Histogram**: Records the input value in the appropriate bucket
 * - **Summary**: Records the input value as a new observation
 *
 * @example
 * ```ts
 * import { Effect, Metric } from "effect"
 *
 * const cpuUsage = Metric.gauge("cpu_usage_percent")
 * const httpStatus = Metric.frequency("http_status_codes")
 * const responseTime = Metric.histogram("response_time_ms", {
 *   boundaries: [100, 500, 1000, 2000]
 * })
 *
 * const program = Effect.gen(function* () {
 *   // Update gauge to specific values
 *   yield* Metric.update(cpuUsage, 45.2)
 *   yield* Metric.update(cpuUsage, 67.8)  // Replaces previous value
 *
 *   // Track HTTP status code occurrences
 *   yield* Metric.update(httpStatus, "200")
 *   yield* Metric.update(httpStatus, "404")
 *   yield* Metric.update(httpStatus, "200")  // Increments 200 count
 *
 *   // Record response times
 *   yield* Metric.update(responseTime, 250)
 *   yield* Metric.update(responseTime, 750)
 *   yield* Metric.update(responseTime, 1500)
 *
 *   // Check current states
 *   const cpu = yield* Metric.value(cpuUsage)
 *   const statuses = yield* Metric.value(httpStatus)
 *   const times = yield* Metric.value(responseTime)
 *
 *   console.log(`CPU Usage: ${cpu.value}%`)
 *   console.log(`Status 200 count: ${statuses.occurrences.get("200")}`) // 2
 *   console.log(`Response time samples: ${times.count}`) // 3
 * })
 * ```
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
    InternalEffect.services(),
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
    f: (input: Input2, context: ServiceMap.ServiceMap<never>) => Input
  ): <State>(self: Metric<Input, State>) => Metric<Input2, State>
  <Input, State, Input2>(
    self: Metric<Input, State>,
    f: (input: Input2, context: ServiceMap.ServiceMap<never>) => Input
  ): Metric<Input2, State>
} = dual<
  <Input, Input2 extends Input>(
    f: (input: Input2, context: ServiceMap.ServiceMap<never>) => Input
  ) => <State>(self: Metric<Input, State>) => Metric<Input2, State>,
  <Input, State, Input2>(
    self: Metric<Input, State>,
    f: (input: Input2, context: ServiceMap.ServiceMap<never>) => Input
  ) => Metric<Input2, State>
>(2, <Input, State, Input2>(
  self: Metric<Input, State>,
  f: (input: Input2, context: ServiceMap.ServiceMap<never>) => Input
): Metric<Input2, State> =>
  new MetricTransform(
    self,
    (context) => self.unsafeValue(context),
    (input, context) => self.unsafeUpdate(f(input, context), context),
    (input, context) => self.unsafeModify(f(input, context), context)
  ))

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
 * Returns a new metric that applies the specified attributes to all operations.
 *
 * Attributes are key-value pairs that provide additional context for metrics,
 * enabling filtering, grouping, and more detailed analysis. Each combination
 * of attribute values creates a separate metric series.
 *
 * @example
 * ```ts
 * import { Effect, Metric } from "effect"
 *
 * const requestCounter = Metric.counter("http_requests_total", {
 *   description: "Total HTTP requests"
 * })
 *
 * // Create tagged versions of the metric
 * const getRequests = Metric.withAttributes(requestCounter, {
 *   method: "GET",
 *   endpoint: "/api/users"
 * })
 *
 * const postRequests = Metric.withAttributes(requestCounter, {
 *   method: "POST",
 *   endpoint: "/api/users"
 * })
 *
 * const program = Effect.gen(function* () {
 *   // These will be tracked as separate metric series
 *   yield* Metric.update(getRequests, 1)   // http_requests_total{method="GET", endpoint="/api/users"}
 *   yield* Metric.update(postRequests, 1)  // http_requests_total{method="POST", endpoint="/api/users"}
 *   yield* Metric.update(getRequests, 1)   // Increments the GET counter
 *
 *   // You can also chain attributes
 *   const taggedMetric = requestCounter.pipe(
 *     Metric.withAttributes({ service: "user-api" }),
 *     Metric.withAttributes({ version: "v1" })
 *   )
 *
 *   yield* Metric.update(taggedMetric, 1) // http_requests_total{service="user-api", version="v1"}
 * })
 *
 * // When taking snapshots, each attribute combination appears as a separate metric
 * const viewMetrics = Effect.gen(function* () {
 *   const snapshots = yield* Metric.snapshot
 *   for (const metric of snapshots) {
 *     if (metric.id === "http_requests_total") {
 *       console.log(`${metric.id}`, metric.attributes, metric.state)
 *     }
 *   }
 * })
 * ```
 *
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
  new MetricTransform(
    self,
    (context) => self.unsafeValue(addAttributesToServiceMap(context, attributes)),
    (input, context) => self.unsafeUpdate(input, addAttributesToServiceMap(context, attributes)),
    (input, context) => self.unsafeModify(input, addAttributesToServiceMap(context, attributes))
  ))

// Metric Snapshots

/**
 * @since 2.0.0
 * @category Snapshotting
 */
export const snapshot: Effect<ReadonlyArray<Metric.Snapshot>> = InternalEffect.map(
  InternalEffect.services(),
  (context) => unsafeSnapshot(context)
)

/**
 * @since 2.0.0
 * @category Debugging
 */
export const dump: Effect<string> = InternalEffect.flatMap(InternalEffect.services(), (context) => {
  const metrics = unsafeSnapshot(context)
  if (metrics.length > 0) {
    const maxNameLength = metrics.reduce((max, metric) => {
      const length = metric.id.length
      return length > max ? length : max
    }, 0) + 2
    const maxDescriptionLength = metrics.reduce((max, metric) => {
      const length = Predicate.isNotUndefined(metric.description) ? metric.description.length : 0
      return length > max ? length : max
    }, 0) + 2
    const maxTypeLength = metrics.reduce((max, metric) => {
      const length = metric.type.length
      return length > max ? length : max
    }, 0) + 2
    const maxAttributesLength = metrics.reduce((max, metric) => {
      const length = Predicate.isNotUndefined(metric.attributes) ? attributesToString(metric.attributes).length : 0
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

/**
 * @since 2.0.0
 * @category Snapshotting
 */
export const unsafeSnapshot = (services: ServiceMap.ServiceMap<never>): ReadonlyArray<Metric.Snapshot> => {
  const registry = ServiceMap.get(services, CurrentMetricRegistry)
  return Array.from(registry.values()).map(({ hooks, ...meta }) => ({
    ...meta,
    state: hooks.get(services)
  }))
}

const renderName = (metric: Metric.Snapshot, padTo: number): string => `name=${metric.id.padEnd(padTo, " ")}`

const renderDescription = (metric: Metric.Snapshot, padTo: number): string =>
  `description=${(metric.description ?? "").padEnd(padTo, " ")}`

const renderType = (metric: Metric.Snapshot, padTo: number): string => `type=${metric.type.padEnd(padTo, " ")}`

const renderAttributes = (metric: Metric.Snapshot, padTo: number): string => {
  const attrs = attributesToString(metric.attributes ?? {})
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
export interface FiberRuntimeMetricsService {
  readonly recordFiberStart: (context: ServiceMap.ServiceMap<never>) => void
  readonly recordFiberEnd: (context: ServiceMap.ServiceMap<never>, exit: Exit<unknown, unknown>) => void
}

/**
 * @since 4.0.0
 * @category Runtime Metrics
 */
export class FiberRuntimeMetrics extends ServiceMap.Reference(InternalMetric.FiberRuntimeMetricsKey, {
  defaultValue: (): FiberRuntimeMetricsService | undefined => undefined
}) {}

/**
 * @since 4.0.0
 * @category Runtime Metrics
 */
export const FiberRuntimeMetricsImpl: FiberRuntimeMetricsService = {
  recordFiberStart(context: ServiceMap.ServiceMap<never>) {
    fibersStarted.unsafeUpdate(1, context)
    fibersActive.unsafeModify(1, context)
  },
  recordFiberEnd(context: ServiceMap.ServiceMap<never>, exit: Exit<unknown, unknown>) {
    fibersActive.unsafeModify(-1, context)
    if (InternalEffect.exitIsSuccess(exit)) {
      fiberSuccesses.unsafeUpdate(1, context)
    } else {
      fiberFailures.unsafeUpdate(1, context)
    }
  }
}

/**
 * @since 4.0.0
 * @category Runtime Metrics
 */
export const enableRuntimeMetricsLayer = Layer.succeed(FiberRuntimeMetrics, FiberRuntimeMetricsImpl)

/**
 * @since 4.0.0
 * @category Runtime Metrics
 */
export const disableRuntimeMetricsLayer = Layer.succeed(FiberRuntimeMetrics, undefined)

/**
 * @since 4.0.0
 * @category Runtime Metrics
 */
export const enableRuntimeMetrics: <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, R> = InternalEffect.provideService(
  FiberRuntimeMetrics,
  FiberRuntimeMetricsImpl
)

/**
 * @since 4.0.0
 * @category Runtime Metrics
 */
export const disableRuntimeMetrics: <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, R> = InternalEffect.provideService(
  FiberRuntimeMetrics,
  undefined
)

// Utilities

function makeKey<Input, State>(
  metric: Metric<Input, State>,
  attributes: Metric.Attributes | undefined
) {
  let key = `${metric.type}:${metric.id}`
  if (Predicate.isNotUndefined(metric.description)) {
    key += `:${metric.description}`
  }
  if (Predicate.isNotUndefined(attributes)) {
    key += `:${serializeAttributes(attributes)}`
  }
  return key
}

function makeHooks<Input, State>(
  get: (context: ServiceMap.ServiceMap<never>) => State,
  update: (input: Input, context: ServiceMap.ServiceMap<never>) => void,
  modify?: (input: Input, context: ServiceMap.ServiceMap<never>) => void
): Metric.Hooks<Input, State> {
  return { get, update, modify: modify ?? update }
}

function serializeAttributes(attributes: Metric.Attributes): string {
  return serializeEntries(Array.isArray(attributes) ? attributes : Object.entries(attributes))
}

function serializeEntries(entries: ReadonlyArray<[string, string]>): string {
  return entries.map(([key, value]) => `${key}=${value}`).join(",")
}

function mergeAttributes(
  self: Metric.Attributes | undefined,
  other: Metric.Attributes | undefined
): Metric.AttributeSet {
  return { ...attributesToRecord(self), ...attributesToRecord(other) }
}

function attributesToRecord(attributes?: Metric.Attributes): Metric.AttributeSet | undefined {
  if (Predicate.isNotUndefined(attributes) && Array.isArray(attributes)) {
    return attributes.reduce((acc, [key, value]) => {
      acc[key] = value
      return acc
    }, {} as Metric.AttributeSet)
  }
  return attributes as Metric.AttributeSet | undefined
}

function addAttributesToServiceMap(
  context: ServiceMap.ServiceMap<never>,
  attributes: Metric.Attributes
): ServiceMap.ServiceMap<never> {
  const current = ServiceMap.get(context, CurrentMetricAttributes)
  const updated = mergeAttributes(current, attributes)
  return ServiceMap.add(context, CurrentMetricAttributes, updated)
}
