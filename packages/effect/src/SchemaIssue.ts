/**
 * @since 4.0.0
 */

import type * as Arr from "./Array.js"
import type * as Option from "./Option.js"
import type * as SchemaAST from "./SchemaAST.js"
import type * as SchemaFilter from "./SchemaFilter.js"
import type * as SchemaMiddleware from "./SchemaMiddleware.js"

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

/**
 * Error that occurs when a transformation has an error.
 *
 * @category model
 * @since 4.0.0
 */
export class TransformationIssue {
  readonly _tag = "TransformationIssue"
  constructor(
    readonly parser: SchemaAST.Transformation["decode"],
    readonly issue: Issue
  ) {}
}

/**
 * Error that occurs when a filter has an error.
 *
 * @category model
 * @since 4.0.0
 */
export class FilterIssue {
  readonly _tag = "FilterIssue"
  constructor(
    readonly filter: SchemaFilter.Filters<unknown>,
    readonly issue: Issue,
    readonly bail: boolean
  ) {}
}

/**
 * Error that occurs when a transformation has an error.
 *
 * @category model
 * @since 4.0.0
 */
export class MiddlewareIssue {
  readonly _tag = "MiddlewareIssue"
  constructor(
    readonly middleware: SchemaMiddleware.Middleware<any, any, any, any>,
    readonly issue: Issue
  ) {}
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
export class PointerIssue {
  readonly _tag = "PointerIssue"
  constructor(
    readonly path: PropertyKeyPath,
    readonly issue: Issue
  ) {}
}

/**
 * Issue that occurs when a required key or index is missing.
 *
 * @category model
 * @since 4.0.0
 */
export class MissingIssue {
  static readonly instance = new MissingIssue()
  readonly _tag = "MissingIssue"
  private constructor() {}
}

/**
 * Issue that contains multiple issues.
 *
 * @category model
 * @since 4.0.0
 */
export class CompositeIssue {
  readonly _tag = "CompositeIssue"
  constructor(
    readonly ast: SchemaAST.AST,
    readonly actual: Option.Option<unknown>,
    readonly issues: Arr.NonEmptyReadonlyArray<Issue>
  ) {}
}

/**
 * @category model
 * @since 4.0.0
 */
export class MismatchIssue {
  readonly _tag = "MismatchIssue"
  constructor(
    readonly ast: SchemaAST.AST,
    readonly actual: Option.Option<unknown>,
    readonly message?: string
  ) {}
}

/**
 * @category model
 * @since 4.0.0
 */
export class InvalidIssue {
  readonly _tag = "InvalidIssue"
  constructor(
    readonly actual: Option.Option<unknown>,
    readonly message?: string
  ) {}
}

/**
 * The `Forbidden` variant of the `Issue` type represents a forbidden operation, such as when encountering an Effect that is not allowed to execute (e.g., using `runSync`).
 *
 * @category model
 * @since 4.0.0
 */
export class ForbiddenIssue {
  readonly _tag = "ForbiddenIssue"
  constructor(
    readonly actual: Option.Option<unknown>,
    readonly message?: string
  ) {}
}
