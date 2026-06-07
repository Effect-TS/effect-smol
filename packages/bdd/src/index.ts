import { Bdd as bdd } from "./Bdd.ts"
import type {
  Capture as Capture_,
  DocStringArg as DocStringArg_,
  Feature as Feature_,
  GherkinCompiler as GherkinCompiler_,
  Report as Report_,
  RunError as RunError_,
  TableArg as TableArg_
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
   * Service used to compile Gherkin source into executable scenarios.
   *
   * @since 4.0.0
   */
  export type GherkinCompiler = GherkinCompiler_

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
 * A decoded DocString argument.
 *
 * @category re-exports
 * @since 4.0.0
 */
export type DocStringArg<A> = DocStringArg_<A>

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
 * Service used to compile Gherkin source into executable scenarios.
 *
 * @category re-exports
 * @since 4.0.0
 */
export type GherkinCompiler = GherkinCompiler_

/**
 * A decoded DataTable argument.
 *
 * @category re-exports
 * @since 4.0.0
 */
export type TableArg<A> = TableArg_<A>
