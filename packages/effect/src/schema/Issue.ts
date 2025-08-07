/**
 * @since 4.0.0
 */
import * as Option from "../data/Option.ts"
import { hasProperty } from "../data/Predicate.ts"
import type * as Annotations from "./Annotations.ts"
import type * as AST from "./AST.ts"
import type * as Check from "./Check.ts"

/**
 * @since 4.0.0
 * @category Symbols
 */
export const TypeId: TypeId = "~effect/schema/Issue"

/**
 * @since 4.0.0
 * @category Symbols
 */
export type TypeId = "~effect/schema/Issue"

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
export type Leaf =
  | InvalidType
  | InvalidValue
  | MissingKey
  | UnexpectedKey
  | Forbidden
  | OneOf

/**
 * @category model
 * @since 4.0.0
 */
export type Issue =
  | Leaf
  // composite
  | Filter
  | Encoding
  | Pointer
  | Composite
  | AnyOf

class Base {
  readonly [TypeId] = TypeId
}

/**
 * Issue that occurs when a filter fails.
 *
 * @category model
 * @since 4.0.0
 */
export class Filter extends Base {
  readonly _tag = "Filter"
  /**
   * The input value that caused the issue.
   */
  readonly actual: unknown
  /**
   * The filter that failed.
   */
  readonly filter: Check.Filter<unknown>
  /**
   * The issue that occurred.
   */
  readonly issue: Issue

  constructor(
    /**
     * The input value that caused the issue.
     */
    actual: unknown,
    /**
     * The filter that failed.
     */
    filter: Check.Filter<unknown>,
    /**
     * The issue that occurred.
     */
    issue: Issue
  ) {
    super()
    this.actual = actual
    this.filter = filter
    this.issue = issue
  }
}

/**
 * Issue that occurs when a transformation fails.
 *
 * @category model
 * @since 4.0.0
 */
export class Encoding extends Base {
  readonly _tag = "Encoding"
  /**
   * The schema that caused the issue.
   */
  readonly ast: AST.AST
  /**
   * The input value that caused the issue.
   */
  readonly actual: Option.Option<unknown>
  /**
   * The issue that occurred.
   */
  readonly issue: Issue

  constructor(
    /**
     * The schema that caused the issue.
     */
    ast: AST.AST,
    /**
     * The input value that caused the issue.
     */
    actual: Option.Option<unknown>,
    /**
     * The issue that occurred.
     */
    issue: Issue
  ) {
    super()
    this.ast = ast
    this.actual = actual
    this.issue = issue
  }
}

/**
 * Issue that points to a specific location in the input.
 *
 * @category model
 * @since 4.0.0
 */
export class Pointer extends Base {
  readonly _tag = "Pointer"
  /**
   * The path to the location in the input that caused the issue.
   */
  readonly path: ReadonlyArray<PropertyKey>
  /**
   * The issue that occurred.
   */
  readonly issue: Issue

  constructor(
    /**
     * The path to the location in the input that caused the issue.
     */
    path: ReadonlyArray<PropertyKey>,
    /**
     * The issue that occurred.
     */
    issue: Issue
  ) {
    super()
    this.path = path
    this.issue = issue
  }
}

/**
 * Issue that occurs when a required key or index is missing.
 *
 * @category model
 * @since 4.0.0
 */
export class MissingKey extends Base {
  readonly _tag = "MissingKey"
  /**
   * The metadata for the issue.
   */
  readonly annotations: Annotations.Key | undefined

  constructor(
    /**
     * The metadata for the issue.
     */
    annotations: Annotations.Key | undefined
  ) {
    super()
    this.annotations = annotations
  }
}

/**
 * Issue that occurs when an unexpected key or index is encountered.
 *
 * @category model
 * @since 4.0.0
 */
export class UnexpectedKey extends Base {
  readonly _tag = "UnexpectedKey"
  /**
   * The schema that caused the issue.
   */
  readonly ast: AST.AST
  /**
   * The input value that caused the issue.
   */
  readonly actual: unknown

  constructor(
    /**
     * The schema that caused the issue.
     */
    ast: AST.AST,
    /**
     * The input value that caused the issue.
     */
    actual: unknown
  ) {
    super()
    this.ast = ast
    this.actual = actual
  }
}

/**
 * Issue that contains multiple issues.
 *
 * @category model
 * @since 4.0.0
 */
export class Composite extends Base {
  readonly _tag = "Composite"
  /**
   * The schema that caused the issue.
   */
  readonly ast: AST.AST
  /**
   * The input value that caused the issue.
   */
  readonly actual: Option.Option<unknown>
  /**
   * The issues that occurred.
   */
  readonly issues: readonly [Issue, ...ReadonlyArray<Issue>]

  constructor(
    /**
     * The schema that caused the issue.
     */
    ast: AST.AST,
    /**
     * The input value that caused the issue.
     */
    actual: Option.Option<unknown>,
    /**
     * The issues that occurred.
     */
    issues: readonly [Issue, ...ReadonlyArray<Issue>]
  ) {
    super()
    this.ast = ast
    this.actual = actual
    this.issues = issues
  }
}

/**
 * Issue that occurs when the type of the input is different from the expected
 * type.
 *
 * @category model
 * @since 4.0.0
 */
export class InvalidType extends Base {
  readonly _tag = "InvalidType"
  /**
   * The schema that caused the issue.
   */
  readonly ast: AST.AST
  /**
   * The input value that caused the issue.
   */
  readonly actual: Option.Option<unknown>

  constructor(
    /**
     * The schema that caused the issue.
     */
    ast: AST.AST,
    /**
     * The input value that caused the issue.
     */
    actual: Option.Option<unknown>
  ) {
    super()
    this.ast = ast
    this.actual = actual
  }
}

/**
 * Issue that occurs when the data of the input is invalid.
 *
 * @category model
 * @since 4.0.0
 */
export class InvalidValue extends Base {
  readonly _tag = "InvalidValue"
  /**
   * The value that caused the issue.
   */
  readonly actual: Option.Option<unknown>
  /**
   * The metadata for the issue.
   */
  readonly annotations?: Annotations.Annotations | undefined

  constructor(
    /**
     * The value that caused the issue.
     */
    actual: Option.Option<unknown>,
    /**
     * The metadata for the issue.
     */
    annotations?: Annotations.Annotations | undefined
  ) {
    super()
    this.actual = actual
    this.annotations = annotations
  }
}

/**
 * Issue that occurs when a forbidden operation is encountered, such as when
 * encountering an Effect that is not allowed to execute (e.g., using
 * `runSync`).
 *
 * @category model
 * @since 4.0.0
 */
export class Forbidden extends Base {
  readonly _tag = "Forbidden"
  /**
   * The input value that caused the issue.
   */
  readonly actual: Option.Option<unknown>
  /**
   * The metadata for the issue.
   */
  readonly annotations: Annotations.Annotations | undefined

  constructor(
    /**
     * The input value that caused the issue.
     */
    actual: Option.Option<unknown>,
    /**
     * The metadata for the issue.
     */
    annotations: Annotations.Annotations | undefined
  ) {
    super()
    this.actual = actual
    this.annotations = annotations
  }
}

/**
 * Issue that occurs when a value does not match any of the schemas in the
 * union.
 *
 * @category model
 * @since 4.0.0
 */
export class AnyOf extends Base {
  readonly _tag = "AnyOf"
  /**
   * The schema that caused the issue.
   */
  readonly ast: AST.AST
  /**
   * The input value that caused the issue.
   */
  readonly actual: Option.Option<unknown>
  /**
   * The issues that occurred.
   */
  readonly issues: ReadonlyArray<Issue>

  constructor(
    /**
     * The schema that caused the issue.
     */
    ast: AST.AST,
    /**
     * The input value that caused the issue.
     */
    actual: Option.Option<unknown>,
    /**
     * The issues that occurred.
     */
    issues: ReadonlyArray<Issue>
  ) {
    super()
    this.ast = ast
    this.actual = actual
    this.issues = issues
  }
}

/**
 * Issue that occurs when a value matches multiple union members but the
 * schema is configured to only allow one.
 *
 * @category model
 * @since 4.0.0
 */
export class OneOf extends Base {
  readonly _tag = "OneOf"
  /**
   * The schema that caused the issue.
   */
  readonly ast: AST.UnionType
  /**
   * The input value that caused the issue.
   */
  readonly actual: unknown
  /**
   * The schemas that were successful.
   */
  readonly successes: ReadonlyArray<AST.AST>

  constructor(
    /**
     * The schema that caused the issue.
     */
    ast: AST.UnionType,
    /**
     * The input value that caused the issue.
     */
    actual: unknown,
    /**
     * The schemas that were successful.
     */
    successes: ReadonlyArray<AST.AST>
  ) {
    super()
    this.ast = ast
    this.actual = actual
    this.successes = successes
  }
}

/**
 * @since 4.0.0
 */
export function getActual(issue: Issue): Option.Option<unknown> {
  switch (issue._tag) {
    case "Pointer":
    case "MissingKey":
      return Option.none()
    case "InvalidType":
    case "InvalidValue":
    case "Forbidden":
    case "Encoding":
    case "Composite":
    case "AnyOf":
      return issue.actual
    case "UnexpectedKey":
    case "OneOf":
    case "Filter":
      return Option.some(issue.actual)
  }
}
