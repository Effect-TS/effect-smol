/**
 * Design: "pretty good" persistency.
 * Real updates copy only the path; unrelated branches keep referential identity.
 * No-op updates may still allocate a new root/parents — callers must not rely on identity for no-ops.
 *
 * @since 4.0.0
 */

import { format } from "./Formatter.ts"
import { identity, memoize } from "./Function.ts"
import * as Option from "./Option.ts"
import * as Predicate from "./Predicate.ts"
import * as Result from "./Result.ts"
import type * as Schema from "./Schema.ts"
import * as AST from "./SchemaAST.ts"
import type * as Issue from "./SchemaIssue.ts"
import * as Struct from "./Struct.ts"
import type { IsUnion } from "./Types.ts"

/**
 * @category Iso
 * @since 4.0.0
 */
export interface Iso<in out S, in out A> extends Lens<S, A>, Prism<S, A> {}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function makeIso<S, A>(get: (s: S) => A, set: (a: A) => S): Iso<S, A> {
  return make(new IsoNode(get, set))
}

/**
 * @category Lens
 * @since 4.0.0
 */
export interface Lens<in out S, in out A> extends Optional<S, A> {
  readonly get: (s: S) => A
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function makeLens<S, A>(get: (s: S) => A, replace: (a: A, s: S) => S): Lens<S, A> {
  return make(new LensNode(get, replace))
}

/**
 * @category Prism
 * @since 4.0.0
 */
export interface Prism<in out S, in out A> extends Optional<S, A> {
  readonly set: (a: A) => S
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function makePrism<S, A>(getResult: (s: S) => Result.Result<A, string>, set: (a: A) => S): Prism<S, A> {
  return make(new PrismNode(getResult, set))
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function fromChecks<T>(...checks: readonly [AST.Check<T>, ...Array<AST.Check<T>>]): Prism<T, T> {
  return make(new CheckNode(checks))
}

type Node =
  | IdentityNode
  | IsoNode<any, any>
  | LensNode<any, any>
  | PrismNode<any, any>
  | OptionalNode<any, any>
  | PathNode
  | CheckNode<any>
  | CompositionNode

class IdentityNode {
  readonly _tag = "IdentityNode"
}

const identityNode = new IdentityNode()

class CompositionNode {
  readonly _tag = "CompositionNode"
  readonly nodes: readonly [Node, ...Array<Node>]

  constructor(nodes: readonly [Node, ...Array<Node>]) {
    this.nodes = nodes
  }
}

class IsoNode<S, A> {
  readonly _tag = "IsoNode"
  readonly get: (s: S) => A
  readonly set: (a: A) => S

  constructor(get: (s: S) => A, set: (a: A) => S) {
    this.get = get
    this.set = set
  }
}

class LensNode<S, A> {
  readonly _tag = "LensNode"
  readonly get: (s: S) => A
  readonly set: (a: A, s: S) => S

  constructor(get: (s: S) => A, set: (a: A, s: S) => S) {
    this.get = get
    this.set = set
  }
}

class PrismNode<S, A> {
  readonly _tag = "PrismNode"
  readonly get: (s: S) => Result.Result<A, string>
  readonly set: (a: A) => S

  constructor(get: (s: S) => Result.Result<A, string>, set: (a: A) => S) {
    this.get = get
    this.set = set
  }
}

class OptionalNode<S, A> {
  readonly _tag = "OptionalNode"
  readonly get: (s: S) => Result.Result<A, string>
  readonly set: (a: A, s: S) => Result.Result<S, string>

  constructor(get: (s: S) => Result.Result<A, string>, set: (a: A, s: S) => Result.Result<S, string>) {
    this.get = get
    this.set = set
  }
}

class PathNode {
  readonly _tag = "PathNode"
  readonly path: ReadonlyArray<PropertyKey>

  constructor(path: ReadonlyArray<PropertyKey>) {
    this.path = path
  }
}

class CheckNode<T> {
  readonly _tag = "CheckNode"
  readonly checks: readonly [AST.Check<T>, ...Array<AST.Check<T>>]

  constructor(checks: readonly [AST.Check<T>, ...Array<AST.Check<T>>]) {
    this.checks = checks
  }
}

// Nodes that can appear in a normalized chain (no Identity/Composition)
type NormalizedNode = Exclude<Node, IdentityNode | CompositionNode>

// Fuse with tail when possible, else push.
function pushNormalized(acc: Array<NormalizedNode>, node: NormalizedNode): void {
  const last = acc[acc.length - 1]
  if (last) {
    if (last._tag === "PathNode" && node._tag === "PathNode") {
      // fuse Path
      acc[acc.length - 1] = new PathNode([...last.path, ...node.path])
      return
    }
    if (last._tag === "CheckNode" && node._tag === "CheckNode") {
      // fuse Checks
      acc[acc.length - 1] = new CheckNode<any>([...last.checks, ...node.checks])
      return
    }
  }
  acc.push(node)
}

// Collect nodes from a node into `acc`, flattening & normalizing on the fly.
function collect(node: Node, acc: Array<NormalizedNode>): void {
  if (node._tag === "IdentityNode") return
  if (node._tag === "CompositionNode") {
    // flatten without extra arrays
    for (let i = 0; i < node.nodes.length; i++) collect(node.nodes[i], acc)
    return
  }
  // primitive node
  pushNormalized(acc, node)
}

function compose(a: Node, b: Node): Node {
  const nodes: Array<NormalizedNode> = []
  collect(a, nodes)
  collect(b, nodes)

  switch (nodes.length) {
    case 0:
      return identityNode
    case 1:
      return nodes[0]
    default:
      return new CompositionNode(nodes as [Node, ...Array<Node>])
  }
}

type ForbidUnion<A, Message extends string> = IsUnion<A> extends true ? [Message] : []

/**
 * @category Optional
 * @since 4.0.0
 */
export interface Optional<in out S, in out A> {
  readonly node: Node
  readonly getResult: (s: S) => Result.Result<A, string>
  readonly replace: (a: A, s: S) => S
  readonly replaceResult: (a: A, s: S) => Result.Result<S, string>
  compose<B>(this: Iso<S, A>, that: Iso<A, B>): Iso<S, B>
  compose<B>(this: Lens<S, A>, that: Lens<A, B>): Lens<S, B>
  compose<B>(this: Prism<S, A>, that: Prism<A, B>): Prism<S, B>
  compose<B>(this: Optional<S, A>, that: Optional<A, B>): Optional<S, B>

  modify(f: (a: A) => A): (s: S) => S

  key<S, A extends object, Key extends keyof A>(
    this: Lens<S, A>,
    key: Key,
    ..._err: ForbidUnion<A, "cannot use `key` on a union type">
  ): Lens<S, A[Key]>
  key<S, A extends object, Key extends keyof A>(
    this: Optional<S, A>,
    key: Key,
    ..._err: ForbidUnion<A, "cannot use `key` on a union type">
  ): Optional<S, A[Key]>

  optionalKey<S, A extends object, Key extends keyof A>(
    this: Lens<S, A>,
    key: Key,
    ..._err: ForbidUnion<A, "cannot use `optionalKey` on a union type">
  ): Lens<S, A[Key] | undefined>
  optionalKey<S, A extends object, Key extends keyof A>(
    this: Optional<S, A>,
    key: Key,
    ..._err: ForbidUnion<A, "cannot use `optionalKey` on a union type">
  ): Optional<S, A[Key] | undefined>

  check<S, A>(this: Prism<S, A>, ...checks: readonly [AST.Check<A>, ...Array<AST.Check<A>>]): Prism<S, A>
  check<S, A>(this: Optional<S, A>, ...checks: readonly [AST.Check<A>, ...Array<AST.Check<A>>]): Optional<S, A>

  refine<S, A, B extends A>(
    this: Prism<S, A>,
    refinement: (a: A) => a is B,
    annotations?: Schema.Annotations.Filter
  ): Prism<S, B>
  refine<S, A, B extends A>(
    this: Optional<S, A>,
    refinement: (a: A) => a is B,
    annotations?: Schema.Annotations.Filter
  ): Optional<S, B>

  tag<S, A extends { readonly _tag: AST.LiteralValue }, Tag extends A["_tag"]>(
    this: Prism<S, A>,
    tag: Tag
  ): Prism<S, Extract<A, { readonly _tag: Tag }>>
  tag<S, A extends { readonly _tag: AST.LiteralValue }, Tag extends A["_tag"]>(
    this: Optional<S, A>,
    tag: Tag
  ): Optional<S, Extract<A, { readonly _tag: Tag }>>

  at<S, A extends object, Key extends keyof A>(
    this: Optional<S, A>,
    key: Key,
    ..._err: ForbidUnion<A, "cannot use `at` on a union type">
  ): Optional<S, A[Key]>

  /**
   * An optic that accesses a group of keys of a struct.
   */
  pick<S, A, Keys extends ReadonlyArray<keyof A>>(
    this: Lens<S, A>,
    keys: Keys,
    ..._err: ForbidUnion<A, "cannot use `pick` on a union type">
  ): Lens<S, Pick<A, Keys[number]>>
  pick<S, A, Keys extends ReadonlyArray<keyof A>>(
    this: Optional<S, A>,
    keys: Keys,
    ..._err: ForbidUnion<A, "cannot use `pick` on a union type">
  ): Optional<S, Pick<A, Keys[number]>>

  /**
   * An optic that excludes a group of keys of a struct.
   *
   * @since 1.0.0
   */
  omit<S, A, Keys extends ReadonlyArray<keyof A>>(
    this: Lens<S, A>,
    keys: Keys,
    ..._err: ForbidUnion<A, "cannot use `omit` on a union type">
  ): Lens<S, Omit<A, Keys[number]>>
  omit<S, A, Keys extends ReadonlyArray<keyof A>>(
    this: Optional<S, A>,
    keys: Keys,
    ..._err: ForbidUnion<A, "cannot use `omit` on a union type">
  ): Optional<S, Omit<A, Keys[number]>>

  /**
   * Omits `undefined` values.
   *
   * @since 4.0.0
   */
  notUndefined(): Prism<S, Exclude<A, undefined>>
  notUndefined(): Optional<S, Exclude<A, undefined>>

  /**
   * Focuses **all elements** of an array-like focus and then narrows to a
   * **subset** using an element-level optic.
   *
   * Semantics:
   * - **getResult**: collects the values focused by `f(id<A>())` for each
   *   element, returning them as a `ReadonlyArray<B>` (non-focusable elements
   *   are skipped).
   * - **setResult**: expects exactly as many `B`s as were collected by
   *   `getResult` and writes them back **in order** to the corresponding
   *   elements; other elements are left unchanged. If the counts differ, it
   *   fails with a length-mismatch error.
   */
  forEach<S, A, B>(this: Traversal<S, A>, f: (iso: Iso<A, A>) => Optional<A, B>): Traversal<S, B>

  modifyAll<S, A>(this: Traversal<S, A>, f: (a: A) => A): (s: S) => S
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function makeOptional<S, A>(
  getResult: (s: S) => Result.Result<A, string>,
  set: (a: A, s: S) => Result.Result<S, string>
): Optional<S, A> {
  return make(new OptionalNode(getResult, set))
}

/**
 * @category Traversal
 * @since 4.0.0
 */
export interface Traversal<in out S, in out A> extends Optional<S, ReadonlyArray<A>> {}

class OptionalImpl<S, A> implements Optional<S, A> {
  readonly node: Node
  readonly getResult: (s: S) => Result.Result<A, string>
  readonly replaceResult: (a: A, s: S) => Result.Result<S, string>
  constructor(
    node: Node,
    getResult: (s: S) => Result.Result<A, string>,
    replaceResult: (a: A, s: S) => Result.Result<S, string>
  ) {
    this.node = node
    this.getResult = getResult
    this.replaceResult = replaceResult
  }
  replace(a: A, s: S): S {
    return Result.getOrElse(this.replaceResult(a, s), () => s)
  }
  modify(f: (a: A) => A): (s: S) => S {
    return (s) => Result.getOrElse(Result.flatMap(this.getResult(s), (a) => this.replaceResult(f(a), s)), () => s)
  }
  compose(that: any): any {
    return make(compose(this.node, that.node))
  }
  key(key: PropertyKey): any {
    return make(compose(this.node, new PathNode([key])))
  }
  optionalKey(key: PropertyKey): any {
    return make(
      compose(
        this.node,
        new LensNode(
          (s) => s[key],
          (a, s) => {
            const copy = cloneShallow(s)
            if (a === undefined) {
              if (Array.isArray(copy) && typeof key === "number") {
                copy.splice(key, 1)
              } else {
                delete copy[key]
              }
            } else {
              copy[key] = a
            }
            return copy
          }
        )
      )
    )
  }
  check(...checks: readonly [AST.Check<any>, ...Array<AST.Check<any>>]): any {
    return make(compose(this.node, new CheckNode(checks)))
  }
  refine<B extends A>(refinement: (a: A) => a is B, annotations?: Schema.Annotations.Filter): any {
    return make(compose(this.node, new CheckNode([AST.makeFilterByGuard(refinement, annotations)])))
  }
  tag(tag: string): any {
    return make(
      compose(
        this.node,
        new PrismNode(
          (s) =>
            s._tag === tag
              ? Result.succeed(s)
              : Result.fail(`Expected ${format(tag)} tag, got ${format(s._tag)}`),
          identity
        )
      )
    )
  }
  at(key: PropertyKey, ..._rest: Array<any>): any {
    const err = Result.fail(`Key ${format(key)} not found`)
    return make(
      compose(
        this.node,
        new OptionalNode(
          (s) => Object.hasOwn(s, key) ? Result.succeed(s[key]) : err,
          (a, s) => {
            if (Object.hasOwn(s, key)) {
              const copy = cloneShallow(s)
              copy[key] = a
              return Result.succeed(copy)
            } else {
              return err
            }
          }
        )
      )
    )
  }
  pick(keys: any) {
    return this.compose(makeLens(Struct.pick(keys), (p, a) => ({ ...a, ...p })))
  }
  omit(keys: any) {
    return this.compose(makeLens(Struct.omit(keys), (o, a) => ({ ...a, ...o })))
  }
  notUndefined(): Prism<S, Exclude<A, undefined>> {
    return this.refine(Predicate.isNotUndefined, { expected: "a value other than `undefined`" })
  }
  forEach<S, A, B>(this: Traversal<S, A>, f: (iso: Iso<A, A>) => Optional<A, B>): Traversal<S, B> {
    const inner = f(id<A>())
    return makeOptional<S, ReadonlyArray<B>>(
      // GET: collect focused Bs
      (s) =>
        Result.map(this.getResult(s), (as) => {
          const bs: Array<B> = []
          for (let i = 0; i < as.length; i++) {
            const r = inner.getResult(as[i])
            if (Result.isSuccess(r)) bs.push(r.success)
          }
          return bs
        }),
      // SET: bs must match the number of focusable elements
      (bs, s) =>
        Result.flatMap(this.getResult(s), (as) => {
          // 1) collect focusable indices
          const idxs: Array<number> = []
          for (let i = 0; i < as.length; i++) {
            if (Result.isSuccess(inner.getResult(as[i]))) idxs.push(i)
          }

          // 2) arity check
          if (bs.length !== idxs.length) {
            return Result.fail(
              `each: replacement length mismatch: ${bs.length} !== ${idxs.length}`
            )
          }

          // 3) update those indices
          const out: Array<A> = as.slice()
          for (let k = 0; k < idxs.length; k++) {
            const i = idxs[k]
            const r = inner.replaceResult(bs[k], as[i])
            if (Result.isFailure(r)) {
              return Result.fail(`each: could not set element ${i}`)
            }
            out[i] = r.success
          }
          return this.replaceResult(out, s)
        })
    )
  }
  modifyAll<S, A>(this: Traversal<S, A>, f: (a: A) => A): (s: S) => S {
    return (s) =>
      Result.getOrElse(
        Result.flatMap(this.getResult(s), (as) => this.replaceResult(as.map(f), s)),
        () => s
      )
  }
}

class IsoImpl<S, A> extends OptionalImpl<S, A> implements Iso<S, A> {
  readonly get: (s: S) => A
  readonly set: (a: A) => S
  constructor(node: Node, get: (s: S) => A, set: (a: A) => S) {
    super(node, (s) => Result.succeed(get(s)), (a) => Result.succeed(set(a)))
    this.get = get
    this.set = set
  }
  override replace(a: A, _: S): S {
    return this.set(a)
  }
  override modify(f: (a: A) => A): (s: S) => S {
    return (s) => this.set(f(this.get(s)))
  }
}

class LensImpl<S, A> extends OptionalImpl<S, A> implements Lens<S, A> {
  readonly get: (s: S) => A
  constructor(node: Node, get: (s: S) => A, replace: (a: A, s: S) => S) {
    super(node, (s) => Result.succeed(get(s)), (a, s) => Result.succeed(replace(a, s)))
    this.get = get
    this.replace = replace
  }
  override modify(f: (a: A) => A): (s: S) => S {
    return (s) => this.replace(f(this.get(s)), s)
  }
}

class PrismImpl<S, A> extends OptionalImpl<S, A> implements Prism<S, A> {
  readonly set: (a: A) => S
  constructor(node: Node, getResult: (s: S) => Result.Result<A, string>, set: (a: A) => S) {
    super(node, getResult, (a, _) => Result.succeed(set(a)))
    this.set = set
  }
  override replace(a: A, _: S): S {
    return this.set(a)
  }
  override modify(f: (a: A) => A): (s: S) => S {
    return (s) => Result.getOrElse(Result.map(this.getResult(s), (a) => this.set(f(a))), () => s)
  }
}

function make(node: Node): any {
  const op = recur(node)
  switch (op._tag) {
    case "IsoNode":
      return new IsoImpl(node, op.get, op.set)
    case "LensNode":
      return new LensImpl(node, op.get, op.set)
    case "PrismNode":
      return new PrismImpl(node, op.get, op.set)
    case "OptionalNode":
      return new OptionalImpl(node, op.get, op.set)
  }
}

function cloneShallow<T>(pojo: T): T {
  if (Array.isArray(pojo)) return pojo.slice() as T
  if (typeof pojo === "object" && pojo !== null) {
    const proto = Object.getPrototypeOf(pojo)
    if (proto !== Object.prototype && proto !== null) {
      throw new Error("Cannot clone object with non-Object constructor or null prototype")
    }
    return { ...pojo } as T
  }
  return pojo
}

type Op = {
  readonly _tag: "IsoNode" | "LensNode" | "PrismNode" | "OptionalNode"
  readonly get: (s: unknown) => any
  readonly set: (a: unknown, s?: unknown) => any
}

const recur = memoize((node: Node): Op => {
  switch (node._tag) {
    case "IdentityNode":
      return { _tag: "IsoNode", get: identity, set: identity }
    case "IsoNode":
    case "LensNode":
    case "PrismNode":
    case "OptionalNode":
      return { _tag: node._tag, get: node.get, set: node.set }
    case "PathNode": {
      return {
        _tag: "LensNode",
        get: (s: any) => {
          const path = node.path
          let out: any = s
          for (let i = 0, n = path.length; i < n; i++) {
            out = out[path[i]]
          }
          return out
        },
        set: (a: any, s: any) => {
          const path = node.path
          const out = cloneShallow(s)

          let current = out
          let i = 0
          for (; i < path.length - 1; i++) {
            const key = path[i]
            current[key] = cloneShallow(current[key])
            current = current[key]
          }

          const finalKey = path[i]
          current[finalKey] = a

          return out
        }
      }
    }
    case "CheckNode":
      return {
        _tag: "PrismNode",
        get: (s: any) => Result.mapError(AST.runChecks(node.checks, s), String),
        set: identity
      }
    case "CompositionNode": {
      const ops = node.nodes.map(recur)
      const _tag = ops.reduce<Op["_tag"]>((tag, op) => getCompositionTag(tag, op._tag), "IsoNode")
      return {
        _tag,
        get: (s: any) => {
          for (let i = 0; i < ops.length; i++) {
            const op = ops[i]
            const result = op.get(s)
            if (hasFailingGet(op._tag)) {
              if (Result.isFailure(result)) {
                return result
              }
              s = result.success
            } else {
              s = result
            }
          }
          return hasFailingGet(_tag) ? Result.succeed(s) : s
        },
        set: (a: any, s: any) => {
          const source = s
          const len = ops.length
          const ss = new Array(len + 1)
          ss[0] = s
          for (let i = 0; i < len; i++) {
            const op = ops[i]
            if (hasFailingGet(op._tag)) {
              const result = op.get(s)
              if (Result.isFailure(result)) {
                return _tag === "OptionalNode" ? result : source
              }
              s = result.success
            } else {
              s = op.get(s)
            }
            ss[i + 1] = s
          }
          for (let i = len - 1; i >= 0; i--) {
            const op = ops[i]
            if (hasSet(op._tag)) {
              a = op.set(a)
            } else if (op._tag === "LensNode") {
              a = op.set(a, ss[i])
            } else {
              const result = op.set(a, ss[i])
              if (Result.isFailure(result)) {
                return result
              }
              a = result.success
            }
          }
          return _tag === "OptionalNode" ? Result.succeed(a) : a
        }
      }
    }
  }
})

function hasFailingGet(tag: Op["_tag"]): boolean {
  return tag === "PrismNode" || tag === "OptionalNode"
}

function hasSet(tag: Op["_tag"]): boolean {
  return tag === "IsoNode" || tag === "PrismNode"
}

function getCompositionTag(a: Op["_tag"], b: Op["_tag"]): Op["_tag"] {
  switch (a) {
    case "IsoNode":
      return b
    case "LensNode":
      return hasFailingGet(b) ? "OptionalNode" : "LensNode"
    case "PrismNode":
      return hasSet(b) ? "PrismNode" : "OptionalNode"
    case "OptionalNode":
      return "OptionalNode"
  }
}
// ---------------------------------------------
// Derived APIs
// ---------------------------------------------

/**
 * Returns all the elements focused by the traversal.
 *
 * @category Traversal
 * @since 4.0.0
 */
export function getAll<S, A>(traversal: Traversal<S, A>): (s: S) => Array<A> {
  return (s) =>
    Result.match(traversal.getResult(s), {
      onFailure: () => [],
      onSuccess: (as) => [...as]
    })
}

// ---------------------------------------------
// Built-in Optics
// ---------------------------------------------

const identityIso = make(identityNode)

/**
 * The identity optic.
 *
 * @category Iso
 * @since 4.0.0
 */
export function id<S>(): Iso<S, S> {
  return identityIso
}

/**
 * @category Iso
 * @since 4.0.0
 */
export function entries<A>(): Iso<Record<string, A>, ReadonlyArray<readonly [string, A]>> {
  return make(new IsoNode(Object.entries, Object.fromEntries))
}

/**
 * @category Prism
 * @since 4.0.0
 */
export function some<A>(): Prism<Option.Option<A>, A> {
  const run = runRefinement(Option.isSome, { expected: "a Some value" })
  return makePrism(
    (s) =>
      Result.mapBoth(run(s), {
        onFailure: String,
        onSuccess: (s) => s.value
      }),
    Option.some
  )
}

/**
 * @category Prism
 * @since 4.0.0
 */
export function none<A>(): Prism<Option.Option<A>, undefined> {
  const run = runRefinement(Option.isNone, { expected: "a None value" })
  return makePrism(
    (s) =>
      Result.mapBoth(run(s), {
        onFailure: String,
        onSuccess: () => undefined
      }),
    () => Option.none()
  )
}

/**
 * @category Prism
 * @since 4.0.0
 */
export function success<A, E>(): Prism<Result.Result<A, E>, A> {
  const run = runRefinement(Result.isSuccess, { expected: "a Result.Success value" })
  return makePrism(
    (s) =>
      Result.mapBoth(run(s), {
        onFailure: String,
        onSuccess: (s) => s.success
      }),
    Result.succeed
  )
}

/**
 * @category Prism
 * @since 4.0.0
 */
export function failure<A, E>(): Prism<Result.Result<A, E>, E> {
  const run = runRefinement(Result.isFailure, { expected: "a Result.Failure value" })
  return makePrism(
    (s) =>
      Result.mapBoth(run(s), {
        onFailure: String,
        onSuccess: (s) => s.failure
      }),
    Result.fail
  )
}

function runRefinement<T extends E, E>(
  refinement: (e: E) => e is T,
  annotations?: Schema.Annotations.Filter
): (e: E) => Result.Result<T, Issue.Issue> {
  return (e) => AST.runChecks([AST.makeFilterByGuard(refinement, annotations)], e) as any
}
