/**
 * @since 4.0.0
 */
import type * as Result from "../data/Result.ts"
import type * as Check from "../schema/Check.ts"

/**
 * @since 4.0.0
 */
export type AST =
  | Identity
  | Iso<any, any>
  | Lens<any, any>
  | Prism<any, any>
  | Optional<any, any>
  | Path
  | Checks
  | Composition

/**
 * @since 4.0.0
 */
export class Identity {
  readonly _tag = "Identity"
  compose(ast: AST): AST {
    return ast
  }
}

/**
 * @since 4.0.0
 */
export const identity = new Identity()

/**
 * @since 4.0.0
 */
export class Composition {
  readonly _tag = "Composition"
  readonly asts: readonly [AST, ...Array<AST>]

  constructor(asts: readonly [AST, ...Array<AST>]) {
    this.asts = asts
  }
  compose(ast: AST): AST {
    return new Composition([...this.asts, ast])
  }
}

/**
 * @since 4.0.0
 */
export class Iso<S, A> {
  readonly _tag = "Iso"
  readonly get: (s: S) => A
  readonly set: (a: A) => S

  constructor(get: (s: S) => A, set: (a: A) => S) {
    this.get = get
    this.set = set
  }
  compose(ast: AST): AST {
    return new Composition([this, ast])
  }
}

/**
 * @since 4.0.0
 */
export class Lens<S, A> {
  readonly _tag = "Lens"
  readonly get: (s: S) => A
  readonly set: (a: A, s: S) => S

  constructor(get: (s: S) => A, set: (a: A, s: S) => S) {
    this.get = get
    this.set = set
  }
  compose(ast: AST): AST {
    return new Composition([this, ast])
  }
}

/**
 * @since 4.0.0
 */
export class Prism<S, A> {
  readonly _tag = "Prism"
  readonly get: (s: S) => Result.Result<A, string>
  readonly set: (a: A) => S

  constructor(get: (s: S) => Result.Result<A, string>, set: (a: A) => S) {
    this.get = get
    this.set = set
  }
  compose(ast: AST): AST {
    return new Composition([this, ast])
  }
}

/**
 * @since 4.0.0
 */
export class Optional<S, A> {
  readonly _tag = "Optional"
  readonly get: (s: S) => Result.Result<A, string>
  readonly set: (a: A, s: S) => S

  constructor(get: (s: S) => Result.Result<A, string>, set: (a: A, s: S) => S) {
    this.get = get
    this.set = set
  }
  compose(ast: AST): AST {
    return new Composition([this, ast])
  }
}

/**
 * @since 4.0.0
 */
export class Path {
  readonly _tag = "Path"
  readonly path: ReadonlyArray<PropertyKey>

  constructor(path: ReadonlyArray<PropertyKey>) {
    this.path = path
  }
  compose(ast: AST): AST {
    switch (ast._tag) {
      case "Path":
        return new Path([...this.path, ...ast.path])
      default:
        return new Composition([this, ast])
    }
  }
}

/**
 * @since 4.0.0
 */
export class Checks {
  readonly _tag = "Checks"
  readonly checks: readonly [Check.Check<any>, ...Array<Check.Check<any>>]

  constructor(checks: readonly [Check.Check<any>, ...Array<Check.Check<any>>]) {
    this.checks = checks
  }
  compose(ast: AST): AST {
    switch (ast._tag) {
      case "Checks":
        return new Checks([...this.checks, ...ast.checks])
      default:
        return new Composition([this, ast])
    }
  }
}
