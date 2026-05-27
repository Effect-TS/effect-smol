/**
 * @since 0.1.0
 */
import type * as Effect from "effect/Effect"
import type { Pipeable } from "effect/Pipeable"
import type * as Schema from "effect/Schema"
import { MatchError, ParseError, StepError } from "./internal/errors.ts"
import * as expression from "./internal/expression.ts"
import * as runner from "./internal/runner.ts"

/**
 * Error type returned by `Bdd.run`.
 *
 * @category errors
 * @since 0.1.0
 */
export type RunError = ParseError | MatchError | StepError

/**
 * Keyword metadata attached to a transition.
 *
 * @category models
 * @since 0.1.0
 */
export type StepKind = "Step" | "Given" | "When" | "Then"

/**
 * A named capture decoded from step text with a Schema.
 *
 * @category models
 * @since 0.1.0
 */
export type Capture<Name extends string, A> = expression.Capture<Name, A>

/**
 * The decoded values produced by an expression matcher.
 *
 * @category models
 * @since 0.1.0
 */
export type CapturesOf<Captures extends ReadonlyArray<Capture<string, any>>> = {
  readonly [Capture in Captures[number] as Capture["name"]]: Capture extends expression.Capture<string, infer A> ? A
    : never
}

/**
 * A compiled step expression.
 *
 * @category models
 * @since 0.1.0
 */
export type Expression<A> = expression.Matcher<A>

/**
 * A decoded DataTable argument.
 *
 * @category models
 * @since 0.1.0
 */
export interface TableArg<A> {
  readonly _tag: "TableArg"
  readonly decode: (table: runner.DataTableInput) => Effect.Effect<A, unknown>
}

/**
 * A decoded DocString argument.
 *
 * @category models
 * @since 0.1.0
 */
export interface DocStringArg<A> {
  readonly _tag: "DocStringArg"
  readonly decode: (docString: runner.DocStringInput) => Effect.Effect<A, unknown>
}

/**
 * A decoded step argument.
 *
 * @category models
 * @since 0.1.0
 */
export type StepArg<A> = TableArg<A> | DocStringArg<A>

/**
 * A transition registered on a feature definition.
 *
 * @category models
 * @since 0.1.0
 */
export interface Transition<State, E, R> {
  readonly kind: StepKind
  readonly expression: Expression<any>
  readonly argument?: StepArg<any>
  readonly run: (captures: any, table: any, state: State) => Effect.Effect<State, E, R>
}

/**
 * A local immutable feature definition used to interpret scenarios from Gherkin source.
 *
 * @category models
 * @since 0.1.0
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
 * @since 0.1.0
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
 * @category constructors
 * @since 0.1.0
 */
const capture_: <const Name extends string, A>(
  name: Name,
  schema: Schema.Schema<A>
) => Capture<Name, A> = expression.makeCapture

/**
 * Creates a DataTable decoder from a row Schema.
 *
 * @category constructors
 * @since 0.1.0
 */
const table_ = <S extends Schema.Top>(row: S): TableArg<ReadonlyArray<Schema.Schema.Type<S>>> => ({
  _tag: "TableArg",
  decode: runner.decodeTable(row)
})

/**
 * Creates a DocString decoder from a Schema.
 *
 * @category constructors
 * @since 0.1.0
 */
const docString_ = <S extends Schema.Top>(schema: S): DocStringArg<Schema.Schema.Type<S>> => ({
  _tag: "DocStringArg",
  decode: runner.decodeDocString(schema)
})

/**
 * Creates a feature definition with an explicit initial state.
 *
 * @category constructors
 * @since 0.1.0
 */
const feature_ = <State>(name: string, options: {
  readonly initial: State
}): Feature<State> => makeFeature(name, options.initial, [])

/**
 * Tagged-template transition factory that does not attach Gherkin keyword metadata.
 *
 * @category constructors
 * @since 0.1.0
 */
const step_: StepTag<"Step"> = makeStepTag("Step")

/**
 * Tagged-template transition factory for `Given` steps.
 *
 * @category constructors
 * @since 0.1.0
 */
const given_: StepTag<"Given"> = makeStepTag("Given")

/**
 * Tagged-template transition factory for `When` steps.
 *
 * @category constructors
 * @since 0.1.0
 */
const when_: StepTag<"When"> = makeStepTag("When")

/**
 * Tagged-template transition factory for `Then` steps.
 *
 * @category constructors
 * @since 0.1.0
 */
const then_: StepTag<"Then"> = makeStepTag("Then")

/**
 * Runs Gherkin source against a feature definition.
 *
 * @category running
 * @since 0.1.0
 */
const run_ = <State, E, R>(
  self: Feature<State, E, R>,
  source: string
): Effect.Effect<Report, RunError, R> => runner.run(self, source)

/**
 * Namespace-style API for building and running BDD feature definitions.
 *
 * @category models
 * @since 0.1.0
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
 * @since 0.1.0
 */
export declare namespace Bdd {
  /**
   * A local immutable feature definition used to interpret scenarios from Gherkin source.
   *
   * @since 0.1.0
   */
  export type Feature<State, E = never, R = never> = FeatureType<State, E, R>

  /**
   * Result returned after all scenarios pass.
   *
   * @since 0.1.0
   */
  export type Report = ReportType

  /**
   * Error type returned by `Bdd.run`.
   *
   * @since 0.1.0
   */
  export type RunError = RunErrorType

  /**
   * A named capture decoded from step text with a Schema.
   *
   * @since 0.1.0
   */
  export type Capture<Name extends string, A> = CaptureType<Name, A>

  /**
   * A decoded DataTable argument.
   *
   * @since 0.1.0
   */
  export type TableArg<A> = TableArgType<A>

  /**
   * A decoded DocString argument.
   *
   * @since 0.1.0
   */
  export type DocStringArg<A> = DocStringArgType<A>
}

/**
 * Tagged-template function used to register transitions.
 *
 * @category models
 * @since 0.1.0
 */
export interface StepTag<Kind extends StepKind> {
  <const Captures extends ReadonlyArray<Capture<string, any>>>(
    strings: TemplateStringsArray,
    ...captures: Captures
  ): StepBuilder<CapturesOf<Captures>, Kind>
}

/**
 * Builder returned by a tagged-template transition.
 *
 * @category models
 * @since 0.1.0
 */
export interface StepBuilder<Captures, Kind extends StepKind> {
  <State, Eff extends Effect.Effect<State, any, any>>(
    impl: (captures: Captures, state: State) => Eff
  ): <E0, R0>(self: Feature<State, E0, R0>) => Feature<State, Effect.Error<Eff> | E0, Effect.Services<Eff> | R0>
  <State, Arg, Eff extends Effect.Effect<State, any, any>>(
    arg: StepArg<Arg>,
    impl: (captures: Captures, arg: Arg, state: State) => Eff
  ): <E0, R0>(self: Feature<State, E0, R0>) => Feature<State, Effect.Error<Eff> | E0, Effect.Services<Eff> | R0>
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
  pipe(...fns: ReadonlyArray<(self: any) => any>) {
    return fns.reduce((result, f) => f(result), this)
  }
})

function makeStepTag<Kind extends StepKind>(kind: Kind): StepTag<Kind> {
  return ((strings: TemplateStringsArray, ...captures: ReadonlyArray<Capture<string, any>>) => {
    const matcher = expression.makeMatcher(strings, captures)
    const builder = ((first: any, second?: any) => (self: Feature<any, any, any>) => {
      const transition: Transition<any, any, any> = second === undefined ?
        {
          kind,
          expression: matcher,
          run: (captures, _table, state) => first(captures, state)
        } :
        {
          kind,
          expression: matcher,
          argument: first,
          run: (captures, table, state) => second(captures, table, state)
        }
      return makeFeature(self.name, self.initial, [...self.transitions, transition])
    }) as StepBuilder<any, Kind>
    Object.defineProperties(builder, {
      kind: { value: kind },
      expression: { value: matcher }
    })
    return builder
  }) as StepTag<Kind>
}
