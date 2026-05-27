import { Bdd as bdd } from "./Bdd.ts"
import type {
  Capture as Capture_,
  DocStringArg as DocStringArg_,
  Feature as Feature_,
  Report as Report_,
  RunError as RunError_,
  TableArg as TableArg_
} from "./Bdd.ts"

/**
 * Namespace-style API for building and running BDD feature definitions.
 *
 * @category re-exports
 * @since 0.1.0
 */
export const Bdd = bdd

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
  export type Feature<State, E = never, R = never> = Feature_<State, E, R>

  /**
   * Result returned after all scenarios pass.
   *
   * @since 0.1.0
   */
  export type Report = Report_

  /**
   * Error type returned by `Bdd.run`.
   *
   * @since 0.1.0
   */
  export type RunError = RunError_

  /**
   * A named capture decoded from step text with a Schema.
   *
   * @since 0.1.0
   */
  export type Capture<Name extends string, A> = Capture_<Name, A>

  /**
   * A decoded DataTable argument.
   *
   * @since 0.1.0
   */
  export type TableArg<A> = TableArg_<A>

  /**
   * A decoded DocString argument.
   *
   * @since 0.1.0
   */
  export type DocStringArg<A> = DocStringArg_<A>
}
