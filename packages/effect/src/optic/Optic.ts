/**
 * Design: "pretty good" persistency.
 * Real updates copy only the path; unrelated branches keep referential identity.
 * No-op updates may still allocate a new root/parents — callers must not rely on identity for no-ops.
 *
 * @since 4.0.0
 */

import * as Option from "../data/Option.ts"
import * as Result from "../data/Result.ts"
import * as Struct from "../data/Struct.ts"
import { identity, memoize } from "../Function.ts"
import { format } from "../interfaces/Inspectable.ts"
import type { Literal } from "../schema/AST.ts"
import { runChecks, runRefine } from "../schema/AST.ts"
import * as Check from "../schema/Check.ts"
import * as AST from "./AST.ts"

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
  return make(new AST.Iso(get, set))
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
  return make(new AST.Lens(get, replace))
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
  return make(new AST.Prism(getResult, set))
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function fromChecks<T>(...checks: readonly [Check.Check<T>, ...Array<Check.Check<T>>]): Prism<T, T> {
  return make(new AST.Check(checks))
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function fromRefine<T extends E, E>(refine: Check.Refine<T, E>): Prism<E, T> {
  return make(new AST.Check([refine]))
}

/**
 * @category Optional
 * @since 4.0.0
 */
export interface Optional<in out S, in out A> {
  readonly ast: AST.AST
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

  /**
   * An optic that accesses a group of keys of a struct.
   */
  pick<S, A, Keys extends ReadonlyArray<keyof A>>(this: Lens<S, A>, keys: Keys): Lens<S, Pick<A, Keys[number]>>
  pick<S, A, Keys extends ReadonlyArray<keyof A>>(this: Optional<S, A>, keys: Keys): Optional<S, Pick<A, Keys[number]>>

  /**
   * An optic that excludes a group of keys of a struct.
   *
   * @since 1.0.0
   */
  omit<S, A, Keys extends ReadonlyArray<keyof A>>(this: Lens<S, A>, keys: Keys): Lens<S, Omit<A, Keys[number]>>
  omit<S, A, Keys extends ReadonlyArray<keyof A>>(this: Optional<S, A>, keys: Keys): Optional<S, Omit<A, Keys[number]>>

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
  return make(new AST.Optional(getResult, set))
}

/**
 * @category Traversal
 * @since 4.0.0
 */
export interface Traversal<in out S, in out A> extends Optional<S, ReadonlyArray<A>> {}

class OptionalImpl<S, A> implements Optional<S, A> {
  readonly ast: AST.AST
  readonly getResult: (s: S) => Result.Result<A, string>
  readonly replaceResult: (a: A, s: S) => Result.Result<S, string>
  constructor(
    ast: AST.AST,
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
    return make(AST.compose(this.ast, that.ast))
  }
  key(key: PropertyKey): any {
    return make(AST.compose(this.ast, new AST.Path([key])))
  }
  optionalKey(key: PropertyKey): any {
    return make(
      AST.compose(
        this.ast,
        new AST.Lens(
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
    return make(AST.compose(this.ast, new AST.Check(checks)))
  }
  refine(refine: Check.Refine<any, any>): any {
    return make(AST.compose(this.ast, new AST.Check([refine])))
  }
  tag(tag: string): any {
    return make(
      AST.compose(
        this.ast,
        new AST.Prism(
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
      AST.compose(
        this.ast,
        new AST.Optional(
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
  pick(keys: any) {
    return this.compose(makeLens(Struct.pick(keys), (p, a) => ({ ...a, ...p })))
  }
  omit(keys: any) {
    return this.compose(makeLens(Struct.omit(keys), (o, a) => ({ ...a, ...o })))
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
  constructor(ast: AST.AST, get: (s: S) => A, set: (a: A) => S) {
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
  constructor(ast: AST.AST, get: (s: S) => A, replace: (a: A, s: S) => S) {
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
  constructor(ast: AST.AST, getResult: (s: S) => Result.Result<A, string>, set: (a: A) => S) {
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

function make(ast: AST.AST): any {
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

function shallowCopy(s: object): any {
  return Array.isArray(s) ? s.slice() : { ...s }
}

type Op = {
  readonly _tag: "Iso" | "Lens" | "Prism" | "Optional"
  readonly get: (s: unknown) => any
  readonly set: (a: unknown, s?: unknown) => any
}

const go = memoize((ast: AST.AST): Op => {
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

          let current = out
          let i = 0
          for (; i < path.length - 1; i++) {
            const key = path[i]
            current[key] = shallowCopy(current[key])
            current = current[key]
          }

          const finalKey = path[i]
          current[finalKey] = a

          return out
        }
      }
    }
    case "Checks":
      return {
        _tag: "Prism",
        get: (s: any) => Result.mapError(runChecks(ast.checks, s), String),
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
// Built-in Optics
// ---------------------------------------------

const identityIso = make(AST.identity)

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
  return make(new AST.Iso(Object.entries, Object.fromEntries))
}

/**
 * @category Prism
 * @since 4.0.0
 */
export function some<A>(): Prism<Option.Option<A>, A> {
  return makePrism(
    (s) =>
      Result.mapBoth(runRefine(Check.some<A>(), s), {
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
  return makePrism(
    (s) =>
      Result.mapBoth(runRefine(Check.none<A>(), s), {
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
  return makePrism(
    (s) =>
      Result.mapBoth(runRefine(Check.success<A, E>(), s), {
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
  return makePrism(
    (s) =>
      Result.mapBoth(runRefine(Check.failure<A, E>(), s), {
        onFailure: String,
        onSuccess: (s) => s.failure
      }),
    Result.fail
  )
}
