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
  readonly set: (a: A, s: S) => Result.Result<S, string>

  constructor(get: (s: S) => Result.Result<A, string>, set: (a: A, s: S) => Result.Result<S, string>) {
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

function isPath(ast: AST): ast is Path {
  return ast._tag === "Path"
}
function isChecks(ast: AST): ast is Checks<any> {
  return ast._tag === "Checks"
}

// Nodes that can appear in a normalized chain (no Identity/Composition)
type Node = Exclude<AST, Identity | Composition>

// Fuse with tail when possible, else push.
function pushNormalized(acc: Array<Node>, node: Node): void {
  const last = acc[acc.length - 1]
  if (last) {
    if (isPath(last) && isPath(node)) {
      // fuse Path
      acc[acc.length - 1] = new Path([...last.path, ...node.path])
      return
    }
    if (isChecks(last) && isChecks(node)) {
      // fuse Checks
      acc[acc.length - 1] = new Checks<any>([...last.checks, ...node.checks])
      return
    }
  }
  acc.push(node)
}

// Collect nodes from an AST into `acc`, flattening & normalizing on the fly.
function collect(ast: AST, acc: Array<Node>): void {
  if (ast._tag === "Identity") return
  if (ast._tag === "Composition") {
    // flatten without extra arrays
    for (let i = 0; i < ast.asts.length; i++) collect(ast.asts[i], acc)
    return
  }
  // primitive node
  pushNormalized(acc, ast)
}

/**
 * @since 4.0.0
 */
export function compose(a: AST, b: AST): AST {
  const nodes: Array<Node> = []
  collect(a, nodes)
  collect(b, nodes)

  switch (nodes.length) {
    case 0:
      return identity
    case 1:
      return nodes[0]
    default:
      return new Composition(nodes as [AST, ...Array<AST>])
  }
}
