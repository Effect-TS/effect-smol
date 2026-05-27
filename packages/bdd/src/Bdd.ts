/**
 * @since 4.0.0
 */
import type * as Effect from "effect/Effect"
import { type Pipeable, pipeArguments } from "effect/Pipeable"
import type * as Schema from "effect/Schema"
import { MatchError, ParseError, StepError } from "./Errors.ts"
import * as expression from "./internal/expression.ts"
import * as runner from "./internal/runner.ts"

/**
 * Error type returned by `Bdd.run`.
 *
 * @category errors
 * @since 4.0.0
 */
export type RunError = ParseError | MatchError | StepError

/**
 * Keyword metadata attached to a transition.
 *
 * @category models
 * @since 4.0.0
 */
export type StepKind = "Step" | "Given" | "When" | "Then"

/**
 * A named capture decoded from step text with a Schema.
 *
 * @category models
 * @since 4.0.0
 */
export type Capture<Name extends string, A> = expression.Capture<Name, A>

/**
 * The decoded values produced by an expression matcher.
 *
 * @category models
 * @since 4.0.0
 */
export type CapturesOf<Captures extends ReadonlyArray<Capture<string, unknown>>> = {
  readonly [Capture in Captures[number] as Capture["name"]]: Capture extends expression.Capture<string, infer A> ? A
    : never
}

/**
 * A compiled step expression.
 *
 * @category models
 * @since 4.0.0
 */
export type Expression<A> = expression.Matcher<A>

/**
 * A decoded DataTable argument.
 *
 * @category models
 * @since 4.0.0
 */
export interface TableArg<A> {
  readonly _tag: "TableArg"
  readonly decode: (table: runner.DataTableInput) => Effect.Effect<A, unknown>
}

/**
 * A decoded DocString argument.
 *
 * @category models
 * @since 4.0.0
 */
export interface DocStringArg<A> {
  readonly _tag: "DocStringArg"
  readonly decode: (docString: runner.DocStringInput) => Effect.Effect<A, unknown>
}

/**
 * A decoded step argument.
 *
 * @category models
 * @since 4.0.0
 */
export type StepArg<A> = TableArg<A> | DocStringArg<A>

/**
 * A transition registered on a feature definition.
 *
 * @category models
 * @since 4.0.0
 */
export interface Transition<State, E, R> {
  readonly kind: StepKind
  readonly expression: Expression<unknown>
  readonly argument?: StepArg<unknown>
  readonly run: (captures: unknown, argument: unknown, state: State) => Effect.Effect<State, E, R>
}

/**
 * A local immutable feature definition used to interpret scenarios from Gherkin source.
 *
 * @category models
 * @since 4.0.0
 */
export interface Feature<State, E = never, R = never> extends Pipeable {
  readonly _tag: "Feature"
  readonly name: string
  readonly initial: State
  readonly transitions: ReadonlyArray<Transition<State, E, R>>
}

/**
 * Result returned after all scenarios pass.
 *
 * @category models
 * @since 4.0.0
 */
export interface Report {
  readonly feature: string
  readonly scenarios: ReadonlyArray<{
    readonly name: string
    readonly steps: number
    readonly tags: ReadonlyArray<string>
  }>
}

type FeatureType<State, E, R> = Feature<State, E, R>
type ReportType = Report
type RunErrorType = RunError
type CaptureType<Name extends string, A> = Capture<Name, A>
type TableArgType<A> = TableArg<A>
type DocStringArgType<A> = DocStringArg<A>

/**
 * Creates a named capture decoded from step text.
 *
 * **When to use**
 *
 * Use a capture when a Gherkin step contains a value that should be decoded
 * before it reaches the step implementation.
 *
 * **Example** (Capturing a number)
 *
 * ```ts
 * import { Bdd } from "@effect/bdd"
 * import { Schema } from "effect"
 *
 * const qty = Bdd.capture("qty", Schema.NumberFromString)
 *
 * const step = Bdd.when`${qty} items are added`
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
const capture_: <const Name extends string, A>(
  name: Name,
  schema: Schema.Decoder<A>
) => Capture<Name, A> = expression.makeCapture

/**
 * Creates a DataTable decoder from a row Schema.
 *
 * **Details**
 *
 * The first row of the Gherkin table is interpreted as the header row. Each
 * following row is converted into an object and decoded with the supplied
 * Schema.
 *
 * **Example** (Decoding table rows)
 *
 * ```ts
 * import { Bdd } from "@effect/bdd"
 * import { Schema } from "effect"
 *
 * const Item = Schema.Struct({
 *   sku: Schema.String,
 *   qty: Schema.NumberFromString
 * })
 *
 * const items = Bdd.table(Item)
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
const table_ = <S extends Schema.Decoder<unknown, never>>(row: S): TableArg<ReadonlyArray<S["Type"]>> => ({
  _tag: "TableArg",
  decode: runner.decodeTable(row)
})

/**
 * Creates a DocString decoder from a Schema.
 *
 * **When to use**
 *
 * Use `docString` for larger step arguments, such as JSON payloads or plain
 * text blocks, that should be decoded before the step implementation runs.
 *
 * **Example** (Decoding JSON)
 *
 * ```ts
 * import { Bdd } from "@effect/bdd"
 * import { Schema } from "effect"
 *
 * const Payload = Schema.Struct({
 *   sku: Schema.String,
 *   qty: Schema.Number
 * })
 *
 * const payload = Bdd.docString(Schema.fromJsonString(Payload))
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
const docString_ = <S extends Schema.Decoder<unknown, never>>(schema: S): DocStringArg<S["Type"]> => ({
  _tag: "DocStringArg",
  decode: runner.decodeDocString(schema)
})

/**
 * Creates a feature definition with an explicit initial state.
 *
 * **Details**
 *
 * A feature definition is an immutable state machine. Each registered step
 * receives the current state and returns the next state in an `Effect`.
 *
 * **Example** (Building a feature)
 *
 * ```ts
 * import { Bdd } from "@effect/bdd"
 * import { Effect } from "effect"
 *
 * const feature = Bdd.feature("Counter", { initial: 0 }).pipe(
 *   Bdd.given`zero`(() => Effect.succeed(0)),
 *   Bdd.when`increment`((_captures, state) => Effect.succeed(state + 1))
 * )
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
const feature_ = <State>(name: string, options: {
  readonly initial: State
}): Feature<State> => makeFeature(name, options.initial, [])

/**
 * Tagged-template transition factory that does not attach Gherkin keyword metadata.
 *
 * **When to use**
 *
 * Use `step` for a transition that may match any Gherkin step kind.
 *
 * @category constructors
 * @since 4.0.0
 */
const step_: StepTag<"Step"> = makeStepTag("Step")

/**
 * Tagged-template transition factory for `Given` steps.
 *
 * **Details**
 *
 * `And` and `But` steps inherit the previous concrete Gherkin keyword before
 * matching, so they can match a `given` transition when they follow a `Given`.
 *
 * @category constructors
 * @since 4.0.0
 */
const given_: StepTag<"Given"> = makeStepTag("Given")

/**
 * Tagged-template transition factory for `When` steps.
 *
 * **Details**
 *
 * `And` and `But` steps inherit the previous concrete Gherkin keyword before
 * matching, so they can match a `when` transition when they follow a `When`.
 *
 * @category constructors
 * @since 4.0.0
 */
const when_: StepTag<"When"> = makeStepTag("When")

/**
 * Tagged-template transition factory for `Then` steps.
 *
 * **Details**
 *
 * `And` and `But` steps inherit the previous concrete Gherkin keyword before
 * matching, so they can match a `then` transition when they follow a `Then`.
 *
 * @category constructors
 * @since 4.0.0
 */
const then_: StepTag<"Then"> = makeStepTag("Then")

/**
 * Runs Gherkin source against a feature definition.
 *
 * **Details**
 *
 * Every scenario starts from the feature's initial state. Background steps run
 * before each scenario, then scenario steps run in source order.
 *
 * **Example** (Running Gherkin)
 *
 * ```ts
 * import { Bdd } from "@effect/bdd"
 * import { Effect } from "effect"
 *
 * const feature = Bdd.feature("Counter", { initial: 0 }).pipe(
 *   Bdd.given`zero`(() => Effect.succeed(0)),
 *   Bdd.when`increment`((_captures, state) => Effect.succeed(state + 1))
 * )
 *
 * const program = Bdd.run(feature, `
 * Feature: Counter
 *
 *   Scenario: Increment
 *     Given zero
 *     When increment
 * `)
 * ```
 *
 * @category running
 * @since 4.0.0
 */
const run_ = <State, E, R>(
  self: Feature<State, E, R>,
  source: string
): Effect.Effect<Report, RunError, R> => runner.run(self, source)

/**
 * Namespace-style API for building and running BDD feature definitions.
 *
 * **Details**
 *
 * The namespace contains constructors for captures, step arguments, feature
 * definitions, step transitions, and the Gherkin runner.
 *
 * **Example** (Defining and running a feature)
 *
 * ```ts
 * import { Bdd } from "@effect/bdd"
 * import { Effect, Schema } from "effect"
 *
 * const qty = Bdd.capture("qty", Schema.NumberFromString)
 *
 * const feature = Bdd.feature("Counter", { initial: 0 }).pipe(
 *   Bdd.given`zero`(() => Effect.succeed(0)),
 *   Bdd.when`increment by ${qty}`(({ qty }, state) => Effect.succeed(state + qty))
 * )
 *
 * const program = Bdd.run(feature, `
 * Feature: Counter
 *
 *   Scenario: Increment
 *     Given zero
 *     When increment by 2
 * `)
 * ```
 *
 * @category models
 * @since 4.0.0
 */
export const Bdd = {
  ParseError,
  MatchError,
  StepError,
  capture: capture_,
  table: table_,
  docString: docString_,
  feature: feature_,
  step: step_,
  given: given_,
  when: when_,
  // oxlint-disable-next-line unicorn/no-thenable
  then: then_,
  run: run_
}

/**
 * Type helpers for the {@link Bdd} value namespace.
 *
 * @since 4.0.0
 */
export declare namespace Bdd {
  /**
   * A local immutable feature definition used to interpret scenarios from Gherkin source.
   *
   * @since 4.0.0
   */
  export type Feature<State, E = never, R = never> = FeatureType<State, E, R>

  /**
   * Result returned after all scenarios pass.
   *
   * @since 4.0.0
   */
  export type Report = ReportType

  /**
   * Error type returned by `Bdd.run`.
   *
   * @since 4.0.0
   */
  export type RunError = RunErrorType

  /**
   * A named capture decoded from step text with a Schema.
   *
   * @since 4.0.0
   */
  export type Capture<Name extends string, A> = CaptureType<Name, A>

  /**
   * A decoded DataTable argument.
   *
   * @since 4.0.0
   */
  export type TableArg<A> = TableArgType<A>

  /**
   * A decoded DocString argument.
   *
   * @since 4.0.0
   */
  export type DocStringArg<A> = DocStringArgType<A>
}

/**
 * Tagged-template function used to register transitions.
 *
 * @category models
 * @since 4.0.0
 */
export interface StepTag<Kind extends StepKind> {
  <const Captures extends ReadonlyArray<Capture<string, unknown>>>(
    strings: TemplateStringsArray,
    ...captures: Captures
  ): StepBuilder<CapturesOf<Captures>, Kind>
}

/**
 * Builder returned by a tagged-template transition.
 *
 * @category models
 * @since 4.0.0
 */
export interface StepBuilder<Captures, Kind extends StepKind> {
  <State, E, R>(
    impl: (captures: Captures, state: State) => Effect.Effect<State, E, R>
  ): <E0, R0>(self: Feature<State, E0, R0>) => Feature<State, E | E0, R | R0>
  <State, Arg, E, R>(
    arg: StepArg<Arg>,
    impl: (captures: Captures, arg: Arg, state: State) => Effect.Effect<State, E, R>
  ): <E0, R0>(self: Feature<State, E0, R0>) => Feature<State, E | E0, R | R0>
  readonly kind: Kind
  readonly expression: Expression<Captures>
}

const makeFeature = <State, E, R>(
  name: string,
  initial: State,
  transitions: ReadonlyArray<Transition<State, E, R>>
): Feature<State, E, R> => ({
  _tag: "Feature",
  name,
  initial,
  transitions,
  pipe() {
    return pipeArguments(this, arguments)
  }
})

function makeStepTag<Kind extends StepKind>(kind: Kind): StepTag<Kind> {
  return ((strings: TemplateStringsArray, ...captures: ReadonlyArray<Capture<string, unknown>>) => {
    const matcher = expression.makeMatcher(strings, captures)
    const builder = ((first: unknown, second?: unknown) => (self: Feature<unknown, unknown, unknown>) => {
      const transition: Transition<unknown, unknown, unknown> = second === undefined ?
        {
          kind,
          expression: matcher,
          run: (captures, _argument, state) =>
            (first as (captures: unknown, state: unknown) => Effect.Effect<unknown, unknown, unknown>)(captures, state)
        } :
        {
          kind,
          expression: matcher,
          argument: first as StepArg<unknown>,
          run: (captures, argument, state) =>
            (second as (
              captures: unknown,
              argument: unknown,
              state: unknown
            ) => Effect.Effect<unknown, unknown, unknown>)(captures, argument, state)
        }
      return makeFeature(self.name, self.initial, [...self.transitions, transition])
    }) as StepBuilder<unknown, Kind>
    Object.defineProperties(builder, {
      kind: { value: kind },
      expression: { value: matcher }
    })
    return builder
  }) as StepTag<Kind>
}
