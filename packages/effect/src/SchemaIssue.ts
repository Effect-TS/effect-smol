/**
 * @since 4.0.0
 */

import type * as Arr from "./Array.js"
import type * as Option from "./Option.js"
import { hasProperty } from "./Predicate.js"
import type * as SchemaAST from "./SchemaAST.js"
import type * as SchemaFilter from "./SchemaFilter.js"
import type * as SchemaMiddleware from "./SchemaMiddleware.js"

/**
 * @since 4.0.0
 * @category Symbols
 */
export const TypeId: unique symbol = Symbol.for("effect/SchemaIssue")

/**
 * @since 4.0.0
 * @category Symbols
 */
export type TypeId = typeof TypeId

/**
 * @since 4.0.0
 */
export function isIssue(u: unknown): u is Issue {
  return hasProperty(u, TypeId)
}

/**
 * @category model
 * @since 4.0.0
 */
export type Issue =
  // leaf
  | MismatchIssue
  | InvalidIssue
  | MissingIssue
  | ForbiddenIssue
  // composite
  | FilterIssue
  | MiddlewareIssue
  | TransformationIssue
  | PointerIssue
  | CompositeIssue

class Base {
  readonly [TypeId] = TypeId
}

/**
 * Error that occurs when a transformation has an error.
 *
 * @category model
 * @since 4.0.0
 */
export class TransformationIssue extends Base {
  readonly _tag = "TransformationIssue"
  constructor(
    readonly parser: SchemaAST.Transformation["decode"],
    readonly issue: Issue
  ) {
    super()
  }
}

/**
 * Error that occurs when a filter has an error.
 *
 * @category model
 * @since 4.0.0
 */
export class FilterIssue extends Base {
  readonly _tag = "FilterIssue"
  constructor(
    readonly filter: SchemaFilter.Filters<unknown>,
    readonly issue: Issue,
    readonly bail: boolean
  ) {
    super()
  }
}

/**
 * Error that occurs when a transformation has an error.
 *
 * @category model
 * @since 4.0.0
 */
export class MiddlewareIssue extends Base {
  readonly _tag = "MiddlewareIssue"
  constructor(
    readonly middleware: SchemaMiddleware.Middleware<any, any, any, any>,
    readonly issue: Issue
  ) {
    super()
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export type PropertyKeyPath = ReadonlyArray<PropertyKey>

/**
 * Issue that points to a specific location in the input.
 *
 * @category model
 * @since 4.0.0
 */
export class PointerIssue extends Base {
  readonly _tag = "PointerIssue"
  constructor(
    readonly path: PropertyKeyPath,
    readonly issue: Issue
  ) {
    super()
  }
}

/**
 * Issue that occurs when a required key or index is missing.
 *
 * @category model
 * @since 4.0.0
 */
export class MissingIssue extends Base {
  static readonly instance = new MissingIssue()
  readonly _tag = "MissingIssue"
  private constructor() {
    super()
  }
}

/**
 * Issue that contains multiple issues.
 *
 * @category model
 * @since 4.0.0
 */
export class CompositeIssue extends Base {
  readonly _tag = "CompositeIssue"
  constructor(
    readonly ast: SchemaAST.AST,
    readonly actual: Option.Option<unknown>,
    readonly issues: Arr.NonEmptyReadonlyArray<Issue>
  ) {
    super()
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class MismatchIssue extends Base {
  readonly _tag = "MismatchIssue"
  constructor(
    readonly ast: SchemaAST.AST,
    readonly actual: Option.Option<unknown>,
    readonly message?: string
  ) {
    super()
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class InvalidIssue extends Base {
  readonly _tag = "InvalidIssue"
  constructor(
    readonly actual: Option.Option<unknown>,
    readonly message?: string
  ) {
    super()
  }
}

/**
 * The `Forbidden` variant of the `Issue` type represents a forbidden operation, such as when encountering an Effect that is not allowed to execute (e.g., using `runSync`).
 *
 * @category model
 * @since 4.0.0
 */
export class ForbiddenIssue extends Base {
  readonly _tag = "ForbiddenIssue"
  constructor(
    readonly actual: Option.Option<unknown>,
    readonly message?: string
  ) {
    super()
  }
}
