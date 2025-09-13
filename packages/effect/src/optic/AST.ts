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
  | Checks<any>
  | Composition

/**
 * @since 4.0.0
 */
export class Identity {
  readonly _tag = "Identity"
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
}

/**
 * @since 4.0.0
 */
export class Checks<T> {
  readonly _tag = "Checks"
  readonly checks: readonly [Check.Check<T>, ...Array<Check.Check<T>>]

  constructor(checks: readonly [Check.Check<T>, ...Array<Check.Check<T>>]) {
    this.checks = checks
  }
}

function isIdentity(ast: AST): ast is Identity {
  return ast._tag === "Identity"
}
function isComposition(ast: AST): ast is Composition {
  return ast._tag === "Composition"
}
function isPath(ast: AST): ast is Path {
  return ast._tag === "Path"
}
function isChecks(ast: AST): ast is Checks<any> {
  return ast._tag === "Checks"
}

/** Flatten an AST into a linear list of primitive nodes (no Composition). */
function flatten(ast: AST, out: Array<AST> = []): Array<AST> {
  if (isComposition(ast)) {
    for (const x of ast.asts) flatten(x, out)
  } else {
    out.push(ast)
  }
  return out
}

/**
 * Normalize a linear chain:
 * - remove Identity
 * - fuse consecutive Path
 * - fuse consecutive Checks
 * (never collapses into concrete optics)
 */
function normalizeChain(chain: Array<AST>): Array<AST> {
  const res: Array<AST> = []
  for (const node of chain) {
    if (isIdentity(node)) continue

    const last = res[res.length - 1]
    if (last && isPath(last) && isPath(node)) {
      // fuse Path
      res[res.length - 1] = new Path([...last.path, ...node.path])
      continue
    }
    if (last && isChecks(last) && isChecks(node)) {
      // fuse Checks
      res[res.length - 1] = new Checks<any>([...last.checks, ...node.checks] as any)
      continue
    }
    res.push(node)
  }
  return res
}

/**
 * Compose two ASTs without collapsing:
 * - flatten a and b
 * - concatenate
 * - normalize (fuse Path/Checks, drop Identity)
 * - return Identity if empty, single node if one, otherwise a single Composition
 *
 * @since 4.0.0
 */
export function compose(a: AST, b: AST): AST {
  const flat = [...flatten(a), ...flatten(b)]
  const norm = normalizeChain(flat)

  if (norm.length === 0) return identity
  if (norm.length === 1) return norm[0]
  return new Composition(norm as [AST, ...Array<AST>])
}
