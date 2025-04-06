/**
 * @since 2.0.0
 */

import * as Arr from "./Array.js"
import * as Context from "./Context.js"
import * as Duration from "./Duration.js"
import * as Effect from "./Effect.js"
import { dual, identity } from "./Function.js"
import * as _Number from "./Number.js"
import * as Option from "./Option.js"
import type { Pipeable } from "./Pipeable.js"
import { pipeArguments } from "./Pipeable.js"
import * as Predicate from "./Predicate.js"
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
  <A extends Input, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R>
  readonly label: string
  readonly type: Metric.Type
  readonly description: string
  readonly attributes: Metric.Attributes
  readonly unsafeValue: (attributes?: Metric.Attributes) => State
  readonly unsafeUpdate: (input: Input, attributes?: Metric.Attributes) => void
  readonly unsafeModify: (input: Input, attributes?: Metric.Attributes) => void
}

/**
 * @since 2.0.0
 * @category Models
 */
export type MetricState = CounterState | FrequencyState | GaugeState | HistogramState | SummaryState

/**
 * @since 2.0.0
 * @category Metrics
 */
export interface Counter<in Input extends number | bigint> extends Metric<Input, CounterState> {}

/**
 * @since 2.0.0
 * @category Counter
 */
export interface CounterState {
  readonly count: number
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
export interface Gauge<in Input extends number | bigint> extends Metric<Input, GaugeState> {}

/**
 * @since 2.0.0
 * @category Metrics
 */
export interface GaugeState {
  readonly value: number
}

/**
 * @since 2.0.0
 * @category Metrics
 */
export interface Histogram extends Metric<number, HistogramState> {}

/**
 * @since 2.0.0
 * @category Metrics
 */
export interface HistogramState {
  readonly buckets: ReadonlyArray<readonly [number, number]>
  readonly count: number
  readonly min: number
  readonly max: number
  readonly sum: number
}

/**
 * @since 2.0.0
 * @category Metrics
 */
export interface Summary<Input extends number | readonly [value: string, timestamp: number]>
  extends Metric<Input, SummaryState>
{}

/**
 * @since 2.0.0
 * @category Metrics
 */
export interface SummaryState {
  readonly error: number
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
  export type Attributes = ReadonlyArray<[string, string]> | Record<string, string>

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
      readonly name: string
      readonly maxAge: Duration.DurationInput
      readonly maxSize: number
      readonly error: number
      readonly quantiles: ReadonlyArray<number>
      readonly description?: string | undefined
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
    readonly Counter: CounterState
    readonly Frequency: FrequencyState
    readonly Gauge: GaugeState
    readonly Histogram: HistogramState
    readonly Summary: SummaryState
  }[MetricType]

  /**
   * @since 2.0.0
   */
  export interface Hooks<in Input, out State> {
    readonly get: () => State
    readonly update: (input: Input) => void
    readonly modify: (input: Input) => void
  }
}

/**
 * @since 4.0.0
 * @category References
 */
export const CurrentMetricAttributesKey = "effect/Metric/CurrentMetricAttributes"

/**
 * @since 4.0.0
 * @category References
 */
export class CurrentMetricAttributes extends Context.Reference(CurrentMetricAttributesKey, {
  defaultValue: () => [] as Metric.Attributes
}) {}

/**
 * @since 2.0.0
 * @category Registry
 */
export const globalMetricRegistry = new Map<string, Metric.Hooks<any, any>>()

const make = <Type extends Metric.Type>(
  type: Type,
  label: string,
  description: string | undefined,
  attributes: Metric.Attributes | undefined,
  config: Metric.Config<Type>
): Metric<Metric.TypeToInput<Type>, Metric.TypeToState<Type>> => {
  let untaggedHooks: Metric.Hooks<Metric.TypeToInput<Type>, Metric.TypeToState<Type>> | undefined
  const hooksCache = new WeakMap<Metric.Attributes, Metric.Hooks<any, any>>()

  function hook(extraAttributes?: Metric.Attributes): Metric.Hooks<Metric.TypeToInput<Type>, Metric.TypeToState<Type>> {
    if (
      Predicate.isUndefined(extraAttributes) ||
      (Array.isArray(extraAttributes) && extraAttributes.length === 0) ||
      Object.keys(extraAttributes).length === 0
    ) {
      if (Predicate.isNotUndefined(untaggedHooks)) {
        return untaggedHooks
      }
      untaggedHooks = getOrCreateHooks(type, label, description, attributes, config)
      return untaggedHooks
    }
    const mergedAttributes = Predicate.isUndefined(attributes)
      ? extraAttributes
      : mergeAttributes(attributes, extraAttributes)
    let hooks = hooksCache.get(mergedAttributes)
    if (Predicate.isNotUndefined(hooks)) {
      return hooks
    }
    hooks = getOrCreateHooks(type, label, description, mergedAttributes, config)
    hooksCache.set(mergedAttributes, hooks)
    return hooks
  }

  return makeMetric(type, {
    label,
    description: description ?? `A ${type}`,
    attributes: attributes ?? [],
    unsafeValue: (attributes) => hook(attributes).get(),
    unsafeUpdate: (input, attributes) => hook(attributes).update(input),
    unsafeModify: (input, attributes) => hook(attributes).modify(input)
  })
}

const makeMetric = <
  Type extends Metric.Type,
  Input extends Metric.TypeToInput<Type>,
  State extends Metric.TypeToState<Type>
>(type: Type, options: {
  readonly label: string
  readonly description: string
  readonly attributes: Metric.Attributes
  readonly unsafeUpdate: (input: Input, attributes?: Metric.Attributes) => void
  readonly unsafeModify: (input: Input, attributes?: Metric.Attributes) => void
  readonly unsafeValue: (attributes?: Metric.Attributes) => State
}): Metric<Input, State> => {
  const metric = Object.assign(
    <A extends Input, E, R>(self: Effect.Effect<A, any, any>): Effect.Effect<A, E, R> =>
      Effect.tap(self, (input) => update(metric, input)),
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

const getOrCreateHooks = <Type extends Metric.Type>(
  type: Type,
  name: string,
  description: string | undefined,
  attributes: Metric.Attributes | undefined,
  config: Metric.Config<Type>
): Metric.Hooks<Metric.TypeToInput<Type>, Metric.TypeToState<Type>> => {
  const key = makeKey(type, name, description, attributes)
  let hooks = globalMetricRegistry.get(key)
  if (Predicate.isNotUndefined(hooks)) {
    return hooks
  }
  hooks = makeHooks(type, config)
  globalMetricRegistry.set(key, hooks)
  return hooks
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
): Metric.Attributes => ({
  ...attributesToRecord(self),
  ...attributesToRecord(other)
})

const attributesToRecord = (attributes?: Metric.Attributes): Record<string, string> | undefined => {
  if (Predicate.isNotUndefined(attributes) && Array.isArray(attributes)) {
    return attributes.reduce((acc, [key, value]) => {
      acc[key] = value
      return acc
    }, {} as Record<string, string>)
  }
  return attributes as Record<string, string> | undefined
}

const bigint0 = BigInt(0)

const makeHooks = <Type extends Metric.Type>(
  type: Type,
  config: Metric.Config<Type>
): Metric.Hooks<Metric.TypeToInput<Type>, Metric.TypeToState<Type>> => {
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

const makeCounterHooks = (
  config: Metric.Config<"Counter">
): Metric.Hooks<bigint | number, CounterState> => {
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
    get: () => ({ count }) as CounterState,
    update,
    modify: update
  }
}

const makeFrequencyHooks = (
  config: Metric.Config<"Frequency">
): Metric.Hooks<string, FrequencyState> => {
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

const makeGaugeHooks = (
  config: Metric.Config<"Gauge">
): Metric.Hooks<bigint | number, GaugeState> => {
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

const makeHistogramHooks = (
  config: Metric.Config<"Histogram">
): Metric.Hooks<number, HistogramState> => {
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
    values[from] = values[from]! + 1
    count = count + 1
    sum = sum + value
    if (value < min) {
      min = value
    }
    if (value > max) {
      max = value
    }
  }

  const getBuckets = (): ReadonlyArray<readonly [number, number]> => {
    const builder: Array<readonly [number, number]> = Arr.allocate(size) as any
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

const makeSummaryHooks = (
  config: Metric.Config<"Summary">
): Metric.Hooks<readonly [number, number], SummaryState> => {
  const { error, maxAge, maxSize, quantiles } = config
  const sortedQuantiles = Arr.sort(quantiles, _Number.Order)
  const values = Arr.allocate<readonly [number, number]>(maxSize)

  let head = 0
  let count = 0
  let sum = 0
  let min = Number.MAX_VALUE
  let max = Number.MIN_VALUE

  // Just before the snapshot we filter out all values older than maxAge
  const snapshot = (now: number): ReadonlyArray<readonly [number, Option.Option<number>]> => {
    const builder: Array<number> = []
    // If the buffer is not full yet it contains valid items at the 0..last
    // indices and null values at the rest of the positions.
    //
    // If the buffer is already full then all elements contains a valid
    // measurement with timestamp.
    //
    // At any given point in time we can enumerate all the non-null elements in
    // the buffer and filter them by timestamp to get a valid view of a time
    // window.
    //
    // The order does not matter because it gets sorted before passing to
    // `calculateQuantiles`.
    let i = 0
    while (i !== maxSize - 1) {
      const item = values[i]
      if (item != null) {
        const [t, v] = item
        const age = Duration.millis(now - t)
        if (Duration.greaterThanOrEqualTo(age, Duration.zero) && age <= maxAge) {
          builder.push(v)
        }
      }
      i = i + 1
    }
    return calculateQuantiles(
      error,
      sortedQuantiles,
      Arr.sort(builder, _Number.Order)
    )
  }

  const observe = (value: number, timestamp: number) => {
    if (maxSize > 0) {
      head = head + 1
      const target = head % maxSize
      values[target] = [timestamp, value] as const
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
    get: () => ({
      error,
      quantiles: snapshot(Date.now()),
      count,
      min,
      max,
      sum
    }),
    update: ([value, timestamp]) => observe(value, timestamp),
    modify: ([value, timestamp]) => observe(value, timestamp)
  }
}
/**
 * Retrieves the current state of the specified `Metric`.
 *
 * @since 2.0.0
 * @category State
 */
export const value = <Input, State>(
  self: Metric<Input, State>
): Effect.Effect<State> =>
  Effect.withFiber((fiber) => {
    const attributes = fiber.getRef(CurrentMetricAttributes)
    return Effect.sync(() => self.unsafeValue(attributes))
  })

/**
 * Retrieves the current state of the specified `Metric`.
 *
 * @since 2.0.0
 * @category Metric Updates
 */
export const update: {
  <Input>(input: Input): <State>(self: Metric<Input, State>) => Effect.Effect<void>
  <Input, State>(self: Metric<Input, State>, input: Input): Effect.Effect<void>
} = dual<
  <Input>(input: Input) => <State>(self: Metric<Input, State>) => Effect.Effect<void>,
  <Input, State>(self: Metric<Input, State>, input: Input) => Effect.Effect<void>
>(2, (self, input) =>
  Effect.withFiber((fiber) => {
    const attributes = fiber.getRef(CurrentMetricAttributes)
    return Effect.sync(() => self.unsafeUpdate(input, attributes))
  }))

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
    f: (input: Input2) => Input
  ): <State>(self: Metric<Input, State>) => Metric<Input2, State>
  <Input, State, Input2>(self: Metric<Input, State>, f: (input: Input2) => Input): Metric<Input2, State>
} = dual<
  <Input, Input2 extends Input>(
    f: (input: Input2) => Input
  ) => <State>(self: Metric<Input, State>) => Metric<Input2, State>,
  <Input, State, Input2>(self: Metric<Input, State>, f: (input: Input2) => Input) => Metric<Input2, State>
>(2, <Input, State, Input2>(
  self: Metric<Input, State>,
  f: (input: Input2) => Input
): Metric<Input2, State> =>
  makeMetric<any, Input2, State>(self.type, {
    label: self.name,
    description: self.description,
    attributes: self.attributes,
    unsafeValue: (attributes) => self.unsafeValue(attributes),
    unsafeUpdate: (input, attributes) => self.unsafeUpdate(f(input), attributes),
    unsafeModify: (input, attributes) => self.unsafeModify(f(input), attributes)
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
    label: self.name,
    description: self.description,
    attributes: self.attributes,
    unsafeValue: (extraAttributes) => self.unsafeValue(mergeAttributes(attributes, extraAttributes)),
    unsafeUpdate: (input, extraAttributes) => self.unsafeUpdate(input, mergeAttributes(attributes, extraAttributes)),
    unsafeModify: (input, extraAttributes) => self.unsafeModify(input, mergeAttributes(attributes, extraAttributes))
  }))

// Utilities

interface ResolvedQuantile {
  /**
   * The quantile that shall be resolved.
   */
  readonly quantile: number
  /**
   * `Some<number>` if a value for the quantile could be found, otherwise
   * `None`.
   */
  readonly value: Option.Option<number>
  /**
   * How many samples have been consumed prior to this quantile.
   */
  readonly consumed: number
  /**
   * The rest of the samples after the quantile has been resolved.
   */
  readonly rest: ReadonlyArray<number>
}

const calculateQuantiles = (
  error: number,
  sortedQuantiles: ReadonlyArray<number>,
  sortedSamples: ReadonlyArray<number>
): ReadonlyArray<readonly [number, Option.Option<number>]> => {
  // The number of samples examined
  const sampleCount = sortedSamples.length
  if (!Arr.isNonEmptyReadonlyArray(sortedQuantiles)) {
    return Arr.empty()
  }
  const head = sortedQuantiles[0]
  const tail = sortedQuantiles.slice(1)
  const resolvedHead = resolveQuantile(
    error,
    sampleCount,
    Option.none(),
    0,
    head,
    sortedSamples
  )
  const resolved = Arr.of(resolvedHead)
  tail.forEach((quantile) => {
    resolved.push(
      resolveQuantile(
        error,
        sampleCount,
        resolvedHead.value,
        resolvedHead.consumed,
        quantile,
        resolvedHead.rest
      )
    )
  })
  return Arr.map(resolved, (rq) => [rq.quantile, rq.value] as const)
}

const resolveQuantile = (
  error: number,
  sampleCount: number,
  current: Option.Option<number>,
  consumed: number,
  quantile: number,
  rest: ReadonlyArray<number>
): ResolvedQuantile => {
  let error_1 = error
  let sampleCount_1 = sampleCount
  let current_1 = current
  let consumed_1 = consumed
  let quantile_1 = quantile
  let rest_1 = rest
  let error_2 = error
  let sampleCount_2 = sampleCount
  let current_2 = current
  let consumed_2 = consumed
  let quantile_2 = quantile
  let rest_2 = rest
  // eslint-disable-next-line no-constant-condition
  while (1) {
    // If the remaining list of samples is empty, there is nothing more to resolve
    if (!Arr.isNonEmptyReadonlyArray(rest_1)) {
      return {
        quantile: quantile_1,
        value: Option.none(),
        consumed: consumed_1,
        rest: []
      }
    }
    // If the quantile is the 100% quantile, we can take the maximum of all the
    // remaining values as the result
    if (quantile_1 === 1) {
      return {
        quantile: quantile_1,
        value: Option.some(Arr.lastNonEmpty(rest_1)),
        consumed: consumed_1 + rest_1.length,
        rest: []
      }
    }
    // Split into two chunks - the first chunk contains all elements of the same
    // value as the chunk head
    const sameHead = Arr.span(rest_1, (n) => n <= rest_1[0])
    // How many elements do we want to accept for this quantile
    const desired = quantile_1 * sampleCount_1
    // The error margin
    const allowedError = (error_1 / 2) * desired
    // Taking into account the elements consumed from the samples so far and the
    // number of same elements at the beginning of the chunk, calculate the number
    // of elements we would have if we selected the current head as result
    const candConsumed = consumed_1 + sameHead[0].length
    const candError = Math.abs(candConsumed - desired)
    // If we haven't got enough elements yet, recurse
    if (candConsumed < desired - allowedError) {
      error_2 = error_1
      sampleCount_2 = sampleCount_1
      current_2 = Arr.head(rest_1)
      consumed_2 = candConsumed
      quantile_2 = quantile_1
      rest_2 = sameHead[1]
      error_1 = error_2
      sampleCount_1 = sampleCount_2
      current_1 = current_2
      consumed_1 = consumed_2
      quantile_1 = quantile_2
      rest_1 = rest_2
      continue
    }
    // If we have too many elements, select the previous value and hand back the
    // the rest as leftover
    if (candConsumed > desired + allowedError) {
      return {
        quantile: quantile_1,
        value: current_1,
        consumed: consumed_1,
        rest: rest_1
      }
    }
    // If we are in the target interval, select the current head and hand back the leftover after dropping all elements
    // from the sample chunk that are equal to the current head
    switch (current_1._tag) {
      case "None": {
        error_2 = error_1
        sampleCount_2 = sampleCount_1
        current_2 = Arr.head(rest_1)
        consumed_2 = candConsumed
        quantile_2 = quantile_1
        rest_2 = sameHead[1]
        error_1 = error_2
        sampleCount_1 = sampleCount_2
        current_1 = current_2
        consumed_1 = consumed_2
        quantile_1 = quantile_2
        rest_1 = rest_2
        continue
      }
      case "Some": {
        const prevError = Math.abs(desired - current_1.value)
        if (candError < prevError) {
          error_2 = error_1
          sampleCount_2 = sampleCount_1
          current_2 = Arr.head(rest_1)
          consumed_2 = candConsumed
          quantile_2 = quantile_1
          rest_2 = sameHead[1]
          error_1 = error_2
          sampleCount_1 = sampleCount_2
          current_1 = current_2
          consumed_1 = consumed_2
          quantile_1 = quantile_2
          rest_1 = rest_2
          continue
        }
        return {
          quantile: quantile_1,
          value: Option.some(current_1.value),
          consumed: consumed_1,
          rest: rest_1
        }
      }
    }
  }
  throw new Error(
    "BUG: Metric.resolveQuantiles - please report an issue at https://github.com/Effect-TS/effect/issues"
  )
}
