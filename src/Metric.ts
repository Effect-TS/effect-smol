/**
 * @since 2.0.0
 */

import * as Arr from "./Array.js"
import * as Context from "./Context.js"
import * as Duration from "./Duration.js"
import * as Effect from "./Effect.js"
import { dual, identity } from "./Function.js"
import { CurrentClock } from "./internal/effect.js"
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
  readonly id: string
  readonly type: Metric.Type
  readonly description: string
  readonly attributes: Metric.Attributes
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
export interface Histogram<Input> extends Metric<Input, HistogramState> {}

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
    readonly get: (context: Context.Context<never>) => State
    readonly update: (input: Input, context: Context.Context<never>) => void
    readonly modify: (input: Input, context: Context.Context<never>) => void
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
  id: string,
  description: string | undefined,
  attributes: Metric.Attributes | undefined,
  config: Metric.Config<Type>
): Metric<Metric.TypeToInput<Type>, Metric.TypeToState<Type>> => {
  let untaggedHooks: Metric.Hooks<Metric.TypeToInput<Type>, Metric.TypeToState<Type>> | undefined
  const hooksCache = new WeakMap<Metric.Attributes, Metric.Hooks<any, any>>()

  function hook(extraAttributes?: Metric.Attributes): Metric.Hooks<
    Metric.TypeToInput<Type>,
    Metric.TypeToState<Type>
  > {
    if (
      Predicate.isUndefined(extraAttributes) ||
      (Array.isArray(extraAttributes) && extraAttributes.length === 0) ||
      Object.keys(extraAttributes).length === 0
    ) {
      if (Predicate.isNotUndefined(untaggedHooks)) {
        return untaggedHooks
      }
      untaggedHooks = getOrCreateHooks(type, id, description, attributes, config)
      return untaggedHooks
    }
    const mergedAttributes = Predicate.isUndefined(attributes)
      ? extraAttributes
      : mergeAttributes(attributes, extraAttributes)
    let hooks = hooksCache.get(mergedAttributes)
    if (Predicate.isNotUndefined(hooks)) {
      return hooks
    }
    hooks = getOrCreateHooks(type, id, description, mergedAttributes, config)
    hooksCache.set(mergedAttributes, hooks)
    return hooks
  }

  return makeMetric(type, {
    id,
    description: description ?? `A ${type}`,
    attributes: attributes ?? [],
    unsafeValue: (context) => hook(Context.get(context, CurrentMetricAttributes)).get(context),
    unsafeUpdate: (input, context) => hook(Context.get(context, CurrentMetricAttributes)).update(input, context),
    unsafeModify: (input, context) => hook(Context.get(context, CurrentMetricAttributes)).modify(input, context)
  })
}

const makeMetric = <
  Type extends Metric.Type,
  Input extends Metric.TypeToInput<Type>,
  State extends Metric.TypeToState<Type>
>(type: Type, options: {
  readonly id: string
  readonly description: string
  readonly attributes: Metric.Attributes
  readonly unsafeValue: (context: Context.Context<never>) => State
  readonly unsafeUpdate: (input: Input, context: Context.Context<never>) => void
  readonly unsafeModify: (input: Input, context: Context.Context<never>) => void
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

const makeCounterHooks = (config: Metric.Config<"Counter">): Metric.Hooks<bigint | number, CounterState> => {
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

const makeGaugeHooks = (config: Metric.Config<"Gauge">): Metric.Hooks<bigint | number, GaugeState> => {
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

const makeSummaryHooks = (config: Metric.Config<"Summary">): Metric.Hooks<readonly [number, number], SummaryState> => {
  const { maxSize, quantiles } = config
  const maxAge = Duration.toMillis(config.maxAge)
  const sortedQuantiles = Arr.sort(quantiles, _Number.Order)
  const observations = Arr.allocate<[number, number]>(maxSize)

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
    if (length === 0) return sortedQuantiles.map((q) => [q, Option.none()])
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
      const clock = Context.get(context, CurrentClock)
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
 * Retrieves the current state of the specified `Metric`.
 *
 * @since 2.0.0
 * @category State
 */
export const value = <Input, State>(
  self: Metric<Input, State>
): Effect.Effect<State> =>
  Effect.flatMap(
    Effect.context(),
    (context) => Effect.sync(() => self.unsafeValue(context))
  )

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
  Effect.flatMap(
    Effect.context(),
    (context) => Effect.sync(() => self.unsafeUpdate(input, context))
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
    id: self.name,
    description: self.description,
    attributes: self.attributes,
    unsafeValue: (context) => self.unsafeValue(context),
    unsafeUpdate: (input, context) => self.unsafeUpdate(f(input), context),
    unsafeModify: (input, context) => self.unsafeModify(f(input), context)
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
