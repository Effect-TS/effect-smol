/**
 * @since 4.0.0
 */

import * as Function from "./Function.js"
import type * as Option from "./Option.js"
import type * as SchemaAST from "./SchemaAST.js"
import type * as SchemaIssue from "./SchemaIssue.js"
import * as SchemaResult from "./SchemaResult.js"

/**
 * @category model
 * @since 4.0.0
 */
export class Middleware<E, R1, T, R2> {
  readonly _tag = "Middleware"
  constructor(
    readonly run: (
      sr: SchemaResult.SchemaResult<Option.Option<E>, R1>,
      options: SchemaAST.ParseOptions
    ) => SchemaResult.SchemaResult<Option.Option<T>, R2>,
    readonly annotations: SchemaAST.Annotations.Documentation | undefined
  ) {}
}

/**
 * @since 4.0.0
 */
export const identity = <T, R = never>(): Middleware<T, R, T, R> =>
  new Middleware(Function.identity, { title: "identity" })

const catch_ = <T, R = never>(f: (issue: SchemaIssue.Issue) => SchemaResult.SchemaResult<Option.Option<T>, R>) =>
  new Middleware((sr) => SchemaResult.catch(sr, f), { title: "catch" })

export {
  /**
   * @since 4.0.0
   */
  catch_ as catch
}
