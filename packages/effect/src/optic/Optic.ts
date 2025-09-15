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
import * as Formatter from "../schema/Formatter.ts"
import * as Issue from "../schema/Issue.ts"
import * as ToParser from "../schema/ToParser.ts"
import * as AST from "./AST.ts"

/**
 * @category Iso
 * @since 4.0.0
 */
export interface Iso<in out S, in out A> extends Lens<S, A>, Prism<S, A> {}

/**
 * @category Lens
 * @since 4.0.0
 */
export interface Lens<in out S, in out A> extends Optional<S, A> {
  readonly get: (s: S) => A
}

/**
 * @category Prism
 * @since 4.0.0
 */
export interface Prism<in out S, in out A> extends Optional<S, A> {
  readonly set: (a: A) => S
}

/**
 * @category Optional
 * @since 4.0.0
 */
export interface Optional<in out S, in out A> extends Optic<S, A> {
  readonly getResult: (s: S) => Result.Result<A, string>
  readonly replace: (a: A, s: S) => S
  readonly replaceResult: (a: A, s: S) => Result.Result<S, string>
}

/**
 * @category Optic
 * @since 4.0.0
 */
export interface Optic<in out S, in out A> {
  readonly ast: AST.AST
  compose<B>(this: Iso<S, A>, that: Iso<A, B>): Iso<S, B>
  compose<B>(this: Lens<S, A>, that: Lens<A, B>): Lens<S, B>
  compose<B>(this: Prism<S, A>, that: Prism<A, B>): Prism<S, B>
  compose<B>(this: Optional<S, A>, that: Optional<A, B>): Optional<S, B>

  modify(f: (a: A) => A): (s: S) => S

  key<S, A extends object, Key extends keyof A>(this: Lens<S, A>, key: Key): Lens<S, A[Key]>
  key<S, A extends object, Key extends keyof A>(this: Optional<S, A>, key: Key): Optional<S, A[Key]>

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

class OpticImpl {
  readonly ast: AST.AST
  constructor(ast: AST.AST) {
    this.ast = ast
  }
  compose(that: any): any {
    return make(AST.compose(this.ast, that.ast))
  }
  key(key: PropertyKey): any {
    return make(AST.compose(this.ast, new AST.Path([key])))
  }
  check(...checks: readonly [Check.Check<any>, ...Array<Check.Check<any>>]): any {
    return make(AST.compose(this.ast, new AST.Checks(checks)))
  }
  refine(refine: Check.Refine<any, any>): any {
    return make(AST.compose(this.ast, new AST.Checks([refine])))
  }
  tag(tag: string): any {
    return make(
      AST.compose(
        this.ast,
        new AST.Prism(
          (s) =>
            s._tag === tag
              ? Result.succeed(s as any)
              : Result.fail(`Expected ${format(tag)} tag, got ${format(s._tag)}`),
          identity
        )
      )
    )
  }
  at(key: PropertyKey): any {
    const failure = Result.fail(`Key ${format(key)} not found`)
    return make(
      AST.compose(
        this.ast,
        new AST.Optional(
          (s) => Object.hasOwn(s, key) ? Result.succeed(s[key]) : failure,
          (a, s) => {
            if (Object.hasOwn(s, key)) {
              const copy = shallowCopy(s)
              copy[key] = a
              return Result.succeed(copy)
            } else {
              return failure
            }
          }
        )
      )
    )
  }
}

class IsoImpl<S, A> extends OpticImpl implements Iso<S, A> {
  readonly get: (s: S) => A
  readonly set: (a: A) => S
  constructor(ast: AST.AST, get: (s: S) => A, set: (a: A) => S) {
    super(ast)
    this.get = get
    this.set = set
  }
  getResult(s: S): Result.Result<A, string> {
    return Result.succeed(this.get(s))
  }
  replaceResult(a: A, _: S): Result.Result<S, string> {
    return Result.succeed(this.set(a))
  }
  replace(a: A, _: S): S {
    return this.set(a)
  }
  modify(f: (a: A) => A): (s: S) => S {
    return (s) => this.set(f(this.get(s)))
  }
}

class LensImpl<S, A> extends OpticImpl implements Lens<S, A> {
  readonly get: (s: S) => A
  readonly replace: (a: A, s: S) => S
  constructor(ast: AST.AST, get: (s: S) => A, replace: (a: A, s: S) => S) {
    super(ast)
    this.get = get
    this.replace = replace
  }
  getResult(s: S): Result.Result<A, string> {
    return Result.succeed(this.get(s))
  }
  replaceResult(a: A, _: S): Result.Result<S, string> {
    return Result.succeed(this.replace(a, _))
  }
  modify(f: (a: A) => A): (s: S) => S {
    return (s) => this.replace(f(this.get(s)), s)
  }
}

class PrismImpl<S, A> extends OpticImpl implements Prism<S, A> {
  readonly getResult: (s: S) => Result.Result<A, string>
  readonly set: (a: A) => S
  constructor(ast: AST.AST, getResult: (s: S) => Result.Result<A, string>, set: (a: A) => S) {
    super(ast)
    this.getResult = getResult
    this.set = set
  }
  replace(a: A, _: S): S {
    return this.set(a)
  }
  replaceResult(a: A, _: S): Result.Result<S, string> {
    return Result.succeed(this.set(a))
  }
  modify(f: (a: A) => A): (s: S) => S {
    return (s) => Result.getOrElse(Result.map(this.getResult(s), (a) => this.set(f(a))), () => s)
  }
}

class OptionalImpl<S, A> extends OpticImpl implements Optional<S, A> {
  readonly getResult: (s: S) => Result.Result<A, string>
  readonly replaceResult: (a: A, s: S) => Result.Result<S, string>
  constructor(
    ast: AST.AST,
    getResult: (s: S) => Result.Result<A, string>,
    replaceResult: (a: A, s: S) => Result.Result<S, string>
  ) {
    super(ast)
    this.getResult = getResult
    this.replaceResult = replaceResult
  }
  replace(a: A, s: S): S {
    return Result.getOrElse(this.replaceResult(a, s), () => s)
  }
  modify(f: (a: A) => A): (s: S) => S {
    return (s) => Result.getOrElse(Result.flatMap(this.getResult(s), (a) => this.replaceResult(f(a), s)), () => s)
  }
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function make<O>(ast: AST.AST): O {
  const op = go(ast)
  switch (op._tag) {
    case "Iso":
      return new IsoImpl(ast, op.get, op.set) as O
    case "Lens":
      return new LensImpl(ast, op.get, op.set) as O
    case "Prism":
      return new PrismImpl(ast, op.get, op.set) as O
    case "Optional":
      return new OptionalImpl(ast, op.get, op.set) as O
  }
}

function shallowCopy(s: any) {
  return Array.isArray(s) ? s.slice() : { ...s }
}

type Op = {
  readonly _tag: "Iso" | "Lens" | "Prism" | "Optional"
  readonly get: any
  readonly set: any
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
            return Result.fail(Formatter.makeDefault().format(issue))
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

const identityIso = make<Iso<any, any>>(AST.identity)

/**
 * The identity optic.
 *
 * @category Iso
 * @since 4.0.0
 */
export function id<S>(): Iso<S, S> {
  return identityIso
}
