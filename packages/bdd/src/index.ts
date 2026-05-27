import { Bdd as bdd } from "./Bdd.ts"
import type {
  Capture as Capture_,
  CapturesOf as CapturesOf_,
  DocStringArg as DocStringArg_,
  Expression as Expression_,
  Feature as Feature_,
  Report as Report_,
  RunError as RunError_,
  StepArg as StepArg_,
  StepBuilder as StepBuilder_,
  StepKind as StepKind_,
  StepTag as StepTag_,
  TableArg as TableArg_,
  Transition as Transition_
} from "./Bdd.ts"
import { MatchError as matchError, ParseError as parseError, StepError as stepError } from "./Errors.ts"

/**
 * Namespace-style API for building and running BDD feature definitions.
 *
 * @category re-exports
 * @since 4.0.0
 */
export const Bdd = bdd

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
  export type Feature<State, E = never, R = never> = Feature_<State, E, R>

  /**
   * Result returned after all scenarios pass.
   *
   * @since 4.0.0
   */
  export type Report = Report_

  /**
   * Error type returned by `Bdd.run`.
   *
   * @since 4.0.0
   */
  export type RunError = RunError_

  /**
   * A named capture decoded from step text with a Schema.
   *
   * @since 4.0.0
   */
  export type Capture<Name extends string, A> = Capture_<Name, A>

  /**
   * A decoded DataTable argument.
   *
   * @since 4.0.0
   */
  export type TableArg<A> = TableArg_<A>

  /**
   * A decoded DocString argument.
   *
   * @since 4.0.0
   */
  export type DocStringArg<A> = DocStringArg_<A>
}

/**
 * Error raised when a Gherkin step cannot be matched or decoded.
 *
 * @category re-exports
 * @since 4.0.0
 */
export const MatchError = matchError

/**
 * Error raised when Gherkin source cannot be parsed.
 *
 * @category re-exports
 * @since 4.0.0
 */
export const ParseError = parseError

/**
 * Error raised when a matched step implementation fails.
 *
 * @category re-exports
 * @since 4.0.0
 */
export const StepError = stepError

/**
 * A named capture decoded from step text with a Schema.
 *
 * @category re-exports
 * @since 4.0.0
 */
export type Capture<Name extends string, A> = Capture_<Name, A>

/**
 * The decoded values produced by an expression matcher.
 *
 * @category re-exports
 * @since 4.0.0
 */
export type CapturesOf<Captures extends ReadonlyArray<Capture<string, unknown>>> = CapturesOf_<Captures>

/**
 * A decoded DocString argument.
 *
 * @category re-exports
 * @since 4.0.0
 */
export type DocStringArg<A> = DocStringArg_<A>

/**
 * A compiled step expression.
 *
 * @category re-exports
 * @since 4.0.0
 */
export type Expression<A> = Expression_<A>

/**
 * A local immutable feature definition used to interpret scenarios from Gherkin source.
 *
 * @category re-exports
 * @since 4.0.0
 */
export type Feature<State, E = never, R = never> = Feature_<State, E, R>

/**
 * Result returned after all scenarios pass.
 *
 * @category re-exports
 * @since 4.0.0
 */
export type Report = Report_

/**
 * Error type returned by `Bdd.run`.
 *
 * @category re-exports
 * @since 4.0.0
 */
export type RunError = RunError_

/**
 * A decoded step argument.
 *
 * @category re-exports
 * @since 4.0.0
 */
export type StepArg<A> = StepArg_<A>

/**
 * Builder returned by a tagged-template transition.
 *
 * @category re-exports
 * @since 4.0.0
 */
export type StepBuilder<Captures, Kind extends StepKind> = StepBuilder_<Captures, Kind>

/**
 * Keyword metadata attached to a transition.
 *
 * @category re-exports
 * @since 4.0.0
 */
export type StepKind = StepKind_

/**
 * Tagged-template function used to register transitions.
 *
 * @category re-exports
 * @since 4.0.0
 */
export type StepTag<Kind extends StepKind> = StepTag_<Kind>

/**
 * A decoded DataTable argument.
 *
 * @category re-exports
 * @since 4.0.0
 */
export type TableArg<A> = TableArg_<A>

/**
 * A transition registered on a feature definition.
 *
 * @category re-exports
 * @since 4.0.0
 */
export type Transition<State, E, R> = Transition_<State, E, R>
