/**
 * @since 4.0.0
 */

import type * as Effect from "./Effect.js"
import * as Function from "./Function.js"
import * as Option from "./Option.js"
import type * as SchemaAST from "./SchemaAST.js"
import * as SchemaIssue from "./SchemaIssue.js"
import * as SchemaResult from "./SchemaResult.js"

/**
 * @category model
 * @since 4.0.0
 */
export type Annotations = SchemaAST.Annotations.Documentation

/**
 * @category model
 * @since 4.0.0
 */
export class Middleware<E, RE, T, RT> {
  constructor(
    readonly run: (
      sr: SchemaResult.SchemaResult<Option.Option<E>, RE>,
      ast: SchemaAST.AST,
      options: SchemaAST.ParseOptions
    ) => SchemaResult.SchemaResult<Option.Option<T>, RT>,
    readonly annotations: Annotations | undefined
  ) {}
}

/**
 * @since 4.0.0
 */
export function identity<T, R>(): Middleware<T, R, T, R> {
  return new Middleware(Function.identity, { title: "identity" })
}

/**
 * @since 4.0.0
 */
export function fail<T, R>(
  message: string,
  annotations?: Annotations | undefined
): Middleware<T, R, T, never> {
  return new Middleware(() => SchemaResult.fail(new SchemaIssue.ForbiddenIssue(Option.none(), message)), {
    title: "fail",
    ...annotations
  })
}

/**
 * @since 4.0.0
 */
export function onEffect<T, R1, R2>(
  f: (
    eff: Effect.Effect<Option.Option<T>, SchemaIssue.Issue, R1>
  ) => Effect.Effect<Option.Option<T>, SchemaIssue.Issue, R2>,
  annotations?: Annotations | undefined
): Middleware<T, R1, T, R2> {
  return new Middleware((sr) => f(SchemaResult.asEffect(sr)), annotations)
}

const catch_ = <T, R = never>(
  f: (issue: SchemaIssue.Issue) => SchemaResult.SchemaResult<Option.Option<T>, R>,
  annotations?: Annotations | undefined
): Middleware<T, R, T, R> => {
  return new Middleware((sr) => SchemaResult.catch(sr, f), { title: "catch", ...annotations })
}

export {
  /**
   * @since 4.0.0
   */
  catch_ as catch
}
