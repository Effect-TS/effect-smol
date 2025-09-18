/**
 * @since 4.0.0
 */

import * as Arr from "../collections/Array.ts"
import * as Option from "../data/Option.ts"
import * as Result from "../data/Result.ts"
import { identity, memoize } from "../Function.ts"
import { format } from "../interfaces/Inspectable.ts"
import type { Literal } from "../schema/AST.ts"
import { unknownKeyword } from "../schema/AST.ts"
import type * as Check from "../schema/Check.ts"
import * as Issue from "../schema/Issue.ts"
import * as ToParser from "../schema/ToParser.ts"

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
 * @category Optional
 * @since 4.0.0
 */
export interface Optional<in out S, in out A> {
  readonly ast: AST
  readonly getResult: (s: S) => Result.Result<A, string>
  readonly replace: (a: A, s: S) => S
  readonly replaceResult: (a: A, s: S) => Result.Result<S, string>
  compose<B>(this: Iso<S, A>, that: Iso<A, B>): Iso<S, B>
  compose<B>(this: Lens<S, A>, that: Lens<A, B>): Lens<S, B>
  compose<B>(this: Prism<S, A>, that: Prism<A, B>): Prism<S, B>
  compose<B>(this: Optional<S, A>, that: Optional<A, B>): Optional<S, B>

  modify(f: (a: A) => A): (s: S) => S

  key<S, A extends object, Key extends keyof A>(this: Lens<S, A>, key: Key): Lens<S, A[Key]>
  key<S, A extends object, Key extends keyof A>(this: Optional<S, A>, key: Key): Optional<S, A[Key]>

  optionalKey<S, A extends object, Key extends keyof A>(this: Lens<S, A>, key: Key): Lens<S, A[Key] | undefined>
  optionalKey<S, A extends object, Key extends keyof A>(this: Optional<S, A>, key: Key): Optional<S, A[Key] | undefined>

  check<S, A>(this: Prism<S, A>, ...checks: readonly [Check.Check<A>, ...Array<Check.Check<A>>]): Prism<S, A>
  check<S, A>(this: Optional<S, A>, ...checks: readonly [Check.Check<A>, ...Array<Check.Check<A>>]): Optional<S, A>

  refine<S, A, B extends A>(this: Prism<S, A>, refine: Check.Refine<B, A>): Prism<S, B>
  refine<S, A, B extends A>(this: Optional<S, A>, refine: Check.Refine<B, A>): Optional<S, B>

  tag<S, A extends { readonly _tag: Literal }, Tag extends A["_tag"]>(
    this: Prism<S, A>,
    tag: Tag
  ): Prism<S, Extract<A, { readonly _tag: Tag }>>
  tag<S, A extends { readonly _tag: Literal }, Tag extends A["_tag"]>(
    this: Optional<S, A>,
    tag: Tag
  ): Optional<S, Extract<A, { readonly _tag: Tag }>>

  at<S, A extends object, Key extends keyof A>(this: Optional<S, A>, key: Key): Optional<S, A[Key]>
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

class OptionalImpl<S, A> implements Optional<S, A> {
  readonly ast: AST
  readonly getResult: (s: S) => Result.Result<A, string>
  readonly replaceResult: (a: A, s: S) => Result.Result<S, string>
  constructor(
    ast: AST,
    getResult: (s: S) => Result.Result<A, string>,
    replaceResult: (a: A, s: S) => Result.Result<S, string>
  ) {
    this.ast = ast
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
    return make(compose(this.ast, that.ast))
  }
  key(key: PropertyKey): any {
    return make(compose(this.ast, new PathNode([key])))
  }
  optionalKey(key: PropertyKey): any {
    return make(
      compose(
        this.ast,
        new LensNode(
          (s) => s[key],
          (a, s) => {
            const copy = shallowCopy(s)
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
  check(...checks: readonly [Check.Check<any>, ...Array<Check.Check<any>>]): any {
    return make(compose(this.ast, new CheckNode(checks)))
  }
  refine(refine: Check.Refine<any, any>): any {
    return make(compose(this.ast, new CheckNode([refine])))
  }
  tag(tag: string): any {
    return make(
      compose(
        this.ast,
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
  at(key: PropertyKey): any {
    const err = Result.fail(`Key ${format(key)} not found`)
    return make(
      compose(
        this.ast,
        new OptionalNode(
          (s) => Object.hasOwn(s, key) ? Result.succeed(s[key]) : err,
          (a, s) => {
            if (Object.hasOwn(s, key)) {
              const copy = shallowCopy(s)
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
}

class IsoImpl<S, A> extends OptionalImpl<S, A> implements Iso<S, A> {
  readonly get: (s: S) => A
  readonly set: (a: A) => S
  constructor(ast: AST, get: (s: S) => A, set: (a: A) => S) {
    super(ast, (s) => Result.succeed(get(s)), (a) => Result.succeed(set(a)))
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
  constructor(ast: AST, get: (s: S) => A, replace: (a: A, s: S) => S) {
    super(ast, (s) => Result.succeed(get(s)), (a, s) => Result.succeed(replace(a, s)))
    this.get = get
    this.replace = replace
  }
  override modify(f: (a: A) => A): (s: S) => S {
    return (s) => this.replace(f(this.get(s)), s)
  }
}

class PrismImpl<S, A> extends OptionalImpl<S, A> implements Prism<S, A> {
  readonly set: (a: A) => S
  constructor(ast: AST, getResult: (s: S) => Result.Result<A, string>, set: (a: A) => S) {
    super(ast, getResult, (a, _) => Result.succeed(set(a)))
    this.set = set
  }
  override replace(a: A, _: S): S {
    return this.set(a)
  }
  override modify(f: (a: A) => A): (s: S) => S {
    return (s) => Result.getOrElse(Result.map(this.getResult(s), (a) => this.set(f(a))), () => s)
  }
}

function make(ast: AST): any {
  const op = go(ast)
  switch (op._tag) {
    case "Iso":
      return new IsoImpl(ast, op.get, op.set)
    case "Lens":
      return new LensImpl(ast, op.get, op.set)
    case "Prism":
      return new PrismImpl(ast, op.get, op.set)
    case "Optional":
      return new OptionalImpl(ast, op.get, op.set)
  }
}

function shallowCopy(s: any) {
  return Array.isArray(s) ? s.slice() : { ...s }
}

type Op = {
  readonly _tag: "Iso" | "Lens" | "Prism" | "Optional"
  readonly get: (s: unknown) => any
  readonly set: (a: unknown, s?: unknown) => any
}

const go = memoize((ast: AST): Op => {
  switch (ast._tag) {
    case "Identity":
      return { _tag: "Iso", get: identity, set: identity }
    case "Iso":
    case "Lens":
    case "Prism":
    case "Optional":
      return { _tag: ast._tag, get: ast.get, set: ast.set }
    case "Path": {
      return {
        _tag: "Lens",
        get: (s: any) => {
          const path = ast.path
          let out: any = s
          for (let i = 0, n = path.length; i < n; i++) {
            out = out[path[i]]
          }
          return out
        },
        set: (a: any, s: any) => {
          const path = ast.path
          const out = shallowCopy(s)
          if (path.length === 1) {
            out[path[0]] = a
            return out
          }

          let current = out
          for (let i = 0; i < path.length - 1; i++) {
            const key = path[i]
            current[key] = shallowCopy(current[key])
            current = current[key]
          }

          const finalKey = path[path.length - 1]
          current[finalKey] = a

          return out
        }
      }
    }
    case "Checks":
      return {
        _tag: "Prism",
        get: (s: any) => {
          const issues: Array<Issue.Issue> = []
          ToParser.runChecks(ast.checks, s, issues, unknownKeyword, { errors: "all" })
          if (Arr.isArrayNonEmpty(issues)) {
            const issue = new Issue.Composite(unknownKeyword, Option.some(s), issues)
            return Result.fail(issue.toString())
          }
          return Result.succeed(s)
        },
        set: identity
      }
    case "Composition": {
      const ops = ast.asts.map(go)
      const _tag = ops.reduce<Op["_tag"]>((tag, op) => getCompositionTag(tag, op._tag), "Iso")
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
                return _tag === "Optional" ? result : source
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
            } else if (op._tag === "Lens") {
              a = op.set(a, ss[i])
            } else {
              const result = op.set(a, ss[i])
              if (Result.isFailure(result)) {
                return result
              }
              a = result.success
            }
          }
          return _tag === "Optional" ? Result.succeed(a) : a
        }
      }
    }
  }
})

function hasFailingGet(tag: Op["_tag"]): boolean {
  return tag === "Prism" || tag === "Optional"
}

function hasSet(tag: Op["_tag"]): boolean {
  return tag === "Iso" || tag === "Prism"
}

function getCompositionTag(a: Op["_tag"], b: Op["_tag"]): Op["_tag"] {
  switch (a) {
    case "Iso":
      return b
    case "Lens":
      return hasFailingGet(b) ? "Optional" : "Lens"
    case "Prism":
      return hasSet(b) ? "Prism" : "Optional"
    case "Optional":
      return "Optional"
  }
}

// ---------------------------------------------
// AST
// ---------------------------------------------

type AST =
  | IdentityNode
  | IsoNode<any, any>
  | LensNode<any, any>
  | PrismNode<any, any>
  | OptionalNode<any, any>
  | PathNode
  | CheckNode<any>
  | CompositionNode

class IdentityNode {
  readonly _tag = "Identity"
}

/** @internal */
export const identityNode = new IdentityNode()

class CompositionNode {
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

class LensNode<S, A> {
  readonly _tag = "Lens"
  readonly get: (s: S) => A
  readonly set: (a: A, s: S) => S

  constructor(get: (s: S) => A, set: (a: A, s: S) => S) {
    this.get = get
    this.set = set
  }
}

class PrismNode<S, A> {
  readonly _tag = "Prism"
  readonly get: (s: S) => Result.Result<A, string>
  readonly set: (a: A) => S

  constructor(get: (s: S) => Result.Result<A, string>, set: (a: A) => S) {
    this.get = get
    this.set = set
  }
}

class OptionalNode<S, A> {
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
