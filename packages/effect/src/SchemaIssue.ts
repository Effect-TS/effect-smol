/**
 * @since 4.0.0
 */

import type * as Option from "./Option.js"
import { hasProperty } from "./Predicate.js"
import type * as SchemaAnnotations from "./SchemaAnnotations.js"
import type * as SchemaAST from "./SchemaAST.js"
import type * as SchemaCheck from "./SchemaCheck.js"

/**
 * @since 4.0.0
 * @category Symbols
 */
export const TypeId: unique symbol = Symbol.for("effect/SchemaIssue") as TypeId

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
  | InvalidType
  | InvalidValue
  | MissingKey
  | UnexpectedKey
  | Forbidden
  | OneOf
  // composite
  | Check
  | Encoding
  | Pointer
  | Composite
  | AnyOf

class Base {
  readonly [TypeId] = TypeId
}

/**
 * Issue that occurs when a check fails.
 *
 * @category model
 * @since 4.0.0
 */
export class Check extends Base {
  readonly _tag = "Check"
  constructor(
    /**
     * The input value that caused the issue.
     */
    readonly actual: unknown,
    /**
     * The check that failed.
     */
    readonly check: SchemaCheck.Filter<unknown>,
    /**
     * The issue that occurred.
     */
    readonly issue: Issue
  ) {
    super()
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
  constructor(
    /**
     * The schema that caused the issue.
     */
    readonly ast: SchemaAST.AST,
    /**
     * The input value that caused the issue.
     */
    readonly actual: Option.Option<unknown>,
    /**
     * The issue that occurred.
     */
    readonly issue: Issue
  ) {
    super()
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
  constructor(
    /**
     * The path to the location in the input that caused the issue.
     */
    readonly path: ReadonlyArray<PropertyKey>,
    /**
     * The issue that occurred.
     */
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
export class MissingKey extends Base {
  readonly _tag = "MissingKey"
  constructor(
    /**
     * The metadata for the issue.
     */
    readonly annotations: SchemaAnnotations.Key | undefined
  ) {
    super()
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
  constructor(
    /**
     * The schema that caused the issue.
     */
    readonly ast: SchemaAST.AST,
    /**
     * The input value that caused the issue.
     */
    readonly actual: Option.Option<unknown>
  ) {
    super()
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
  constructor(
    /**
     * The schema that caused the issue.
     */
    readonly ast: SchemaAST.AST,
    /**
     * The input value that caused the issue.
     */
    readonly actual: Option.Option<unknown>,
    /**
     * The issues that occurred.
     */
    readonly issues: readonly [Issue, ...ReadonlyArray<Issue>]
  ) {
    super()
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
  constructor(
    /**
     * The schema that caused the issue.
     */
    readonly ast: SchemaAST.AST,
    /**
     * The input value that caused the issue.
     */
    readonly actual: Option.Option<unknown>
  ) {
    super()
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
  constructor(
    /**
     * The value that caused the issue.
     */
    readonly actual: Option.Option<unknown>,
    /**
     * The metadata for the issue.
     */
    readonly annotations?: SchemaAnnotations.Annotations | undefined
  ) {
    super()
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
  constructor(
    /**
     * The input value that caused the issue.
     */
    readonly actual: Option.Option<unknown>,
    /**
     * The metadata for the issue.
     */
    readonly annotations: SchemaAnnotations.Annotations | undefined
  ) {
    super()
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
  constructor(
    /**
     * The schema that caused the issue.
     */
    readonly ast: SchemaAST.AST,
    /**
     * The input value that caused the issue.
     */
    readonly actual: Option.Option<unknown>,
    /**
     * The issues that occurred.
     */
    readonly issues: readonly [Issue, ...ReadonlyArray<Issue>]
  ) {
    super()
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
  constructor(
    /**
     * The schema that caused the issue.
     */
    readonly ast: SchemaAST.UnionType,
    /**
     * The input value that caused the issue.
     */
    readonly actual: unknown,
    /**
     * The schemas that were successful.
     */
    readonly successes: ReadonlyArray<SchemaAST.AST>
  ) {
    super()
  }
}
