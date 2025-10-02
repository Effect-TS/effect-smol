import type * as Result from "../../data/Result.ts"
import type * as Check from "../../schema/Check.ts"

/** @internal */
export type AST =
  | IdentityNode
  | IsoNode<any, any>
  | LensNode<any, any>
  | PrismNode<any, any>
  | OptionalNode<any, any>
  | PathNode
  | CheckNode<any>
  | CompositionNode

/** @internal */
export class IdentityNode {
  readonly _tag = "Identity"
}

/** @internal */
export const identityNode = new IdentityNode()

/** @internal */
export class CompositionNode {
  readonly _tag = "Composition"
  readonly asts: readonly [AST, ...Array<AST>]

  constructor(asts: readonly [AST, ...Array<AST>]) {
    this.asts = asts
  }
}

/** @internal */
export class IsoNode<S, A> {
  readonly _tag = "Iso"
  readonly get: (s: S) => A
  readonly set: (a: A) => S

  constructor(get: (s: S) => A, set: (a: A) => S) {
    this.get = get
    this.set = set
  }
}

/** @internal */
export class LensNode<S, A> {
  readonly _tag = "Lens"
  readonly get: (s: S) => A
  readonly set: (a: A, s: S) => S

  constructor(get: (s: S) => A, set: (a: A, s: S) => S) {
    this.get = get
    this.set = set
  }
}

/** @internal */
export class PrismNode<S, A> {
  readonly _tag = "Prism"
  readonly get: (s: S) => Result.Result<A, string>
  readonly set: (a: A) => S

  constructor(get: (s: S) => Result.Result<A, string>, set: (a: A) => S) {
    this.get = get
    this.set = set
  }
}

/** @internal */
export class OptionalNode<S, A> {
  readonly _tag = "Optional"
  readonly get: (s: S) => Result.Result<A, string>
  readonly set: (a: A, s: S) => Result.Result<S, string>

  constructor(get: (s: S) => Result.Result<A, string>, set: (a: A, s: S) => Result.Result<S, string>) {
    this.get = get
    this.set = set
  }
}

/** @internal */
export class PathNode {
  readonly _tag = "Path"
  readonly path: ReadonlyArray<PropertyKey>

  constructor(path: ReadonlyArray<PropertyKey>) {
    this.path = path
  }
}

/** @internal */
export class CheckNode<T> {
  readonly _tag = "Checks"
  readonly checks: readonly [Check.Check<T>, ...Array<Check.Check<T>>]

  constructor(checks: readonly [Check.Check<T>, ...Array<Check.Check<T>>]) {
    this.checks = checks
  }
}

// Nodes that can appear in a normalized chain (no Identity/Composition)
type NormalizedNode = Exclude<AST, IdentityNode | CompositionNode>

// Fuse with tail when possible, else push.
function pushNormalized(acc: Array<NormalizedNode>, node: NormalizedNode): void {
  const last = acc[acc.length - 1]
  if (last) {
    if (last._tag === "Path" && node._tag === "Path") {
      // fuse Path
      acc[acc.length - 1] = new PathNode([...last.path, ...node.path])
      return
    }
    if (last._tag === "Checks" && node._tag === "Checks") {
      // fuse Checks
      acc[acc.length - 1] = new CheckNode<any>([...last.checks, ...node.checks])
      return
    }
  }
  acc.push(node)
}

// Collect nodes from an AST into `acc`, flattening & normalizing on the fly.
function collect(ast: AST, acc: Array<NormalizedNode>): void {
  if (ast._tag === "Identity") return
  if (ast._tag === "Composition") {
    // flatten without extra arrays
    for (let i = 0; i < ast.asts.length; i++) collect(ast.asts[i], acc)
    return
  }
  // primitive node
  pushNormalized(acc, ast)
}

/** @internal */
export function compose(a: AST, b: AST): AST {
  const nodes: Array<NormalizedNode> = []
  collect(a, nodes)
  collect(b, nodes)

  switch (nodes.length) {
    case 0:
      return identityNode
    case 1:
      return nodes[0]
    default:
      return new CompositionNode(nodes as [AST, ...Array<AST>])
  }
}
