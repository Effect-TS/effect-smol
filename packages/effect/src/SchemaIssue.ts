/**
 * @since 4.0.0
 */

import type * as Arr from "./Array.js"
import type * as Option from "./Option.js"
import { hasProperty } from "./Predicate.js"
import type * as SchemaAST from "./SchemaAST.js"
import type * as SchemaCheck from "./SchemaCheck.js"

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
  | InvalidType
  | InvalidData
  | MissingKey
  | Forbidden
  // composite
  | Check
  | Transformation
  | Pointer
  | Composite

class Base {
  readonly [TypeId] = TypeId
}

/**
 * Error that occurs when a transformation has an error.
 *
 * @category model
 * @since 4.0.0
 */
export class Transformation extends Base {
  readonly _tag = "Transformation"
  constructor(
    readonly parser: SchemaAST.Transformation["decode"],
    readonly issue: Issue
  ) {
    super()
  }
}

/**
 * Error that occurs when a check has an error.
 *
 * @category model
 * @since 4.0.0
 */
export class Check extends Base {
  readonly _tag = "Check"
  constructor(
    readonly check: SchemaCheck.Check<unknown>,
    readonly issue: Issue,
    readonly abort: boolean
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
export class Pointer extends Base {
  readonly _tag = "Pointer"
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
export class MissingKey extends Base {
  readonly _tag = "MissingKey"
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
export class InvalidType extends Base {
  readonly _tag = "InvalidType"
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
export class InvalidData extends Base {
  readonly _tag = "InvalidData"
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
export class Forbidden extends Base {
  readonly _tag = "Forbidden"
  constructor(
    readonly actual: Option.Option<unknown>,
    readonly message?: string
  ) {
    super()
  }
}
