/**
 * @since 4.0.0
 */

import * as Arr from "../collections/Array.ts"
import * as Option from "../data/Option.ts"
import * as Result from "../data/Result.ts"
import { identity } from "../Function.ts"
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

class OpticBuilder {
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
    return make(
      AST.compose(
        this.ast,
        new AST.Optional(
          (s) => Object.hasOwn(s, key) ? Result.succeed(s[key]) : Result.fail(`Key ${format(key)} not found`),
          (a, s) => {
            if (Object.hasOwn(s, key)) {
              const copy = shallowCopy(s)
              copy[key] = a
              return copy
            } else {
              return s
            }
          }
        )
      )
    )
  }
}

class IsoBuilder<S, A> extends OpticBuilder implements Iso<S, A> {
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
  replace(a: A, _: S): S {
    return this.set(a)
  }
  modify(f: (a: A) => A): (s: S) => S {
    return (s) => this.set(f(this.get(s)))
  }
}

class LensBuilder<S, A> extends OpticBuilder implements Lens<S, A> {
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
  modify(f: (a: A) => A): (s: S) => S {
    return (s) => this.replace(f(this.get(s)), s)
  }
}

class PrismBuilder<S, A> extends OpticBuilder implements Prism<S, A> {
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
  modify(f: (a: A) => A): (s: S) => S {
    return (s) => Result.getOrElse(Result.map(this.getResult(s), (a) => this.set(f(a))), () => s)
  }
}

class OptionalBuilder<S, A> extends OpticBuilder implements Optional<S, A> {
  readonly getResult: (s: S) => Result.Result<A, string>
  readonly replace: (a: A, s: S) => S
  constructor(ast: AST.AST, getResult: (s: S) => Result.Result<A, string>, replace: (a: A, s: S) => S) {
    super(ast)
    this.getResult = getResult
    this.replace = replace
  }
  modify(f: (a: A) => A): (s: S) => S {
    return (s) => Result.getOrElse(Result.map(this.getResult(s), (a) => this.replace(f(a), s)), () => s)
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
      return new IsoBuilder(ast, op.get, op.set) as O
    case "Lens":
      return new LensBuilder(ast, op.get, op.set) as O
    case "Prism":
      return new PrismBuilder(ast, op.get, op.set) as O
    case "Optional":
      return new OptionalBuilder(ast, op.get, op.set) as O
  }
}

const shallowCopy = (s: any) => Array.isArray(s) ? s.slice() : { ...s }

type Op = {
  readonly _tag: "Iso" | "Lens" | "Prism" | "Optional"
  readonly get: any
  readonly set: any
}

function go(ast: AST.AST): Op {
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
          let out: any = s
          for (const key of ast.path) {
            out = out[key]
          }
          return out
        },
        set: (a: any, s: any) => {
          const path = ast.path
          const out = shallowCopy(s)

          let current = out
          for (let i = 0; i < path.length - 1; i++) {
            const key = path[i]
            current[key] = shallowCopy(current[key])
            current = current[key]
          }

          const finalKey = path.at(-1)!
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
      let _tag: Op["_tag"] = "Iso"
      for (const op of ops) {
        _tag = getComposition(_tag, op._tag)
      }
      return {
        _tag,
        get: (s: any) => {
          for (let i = 0; i < ops.length; i++) {
            const op = ops[i]
            const result = op.get(s)
            if (op._tag === "Prism" || op._tag === "Optional") {
              if (Result.isFailure(result)) {
                return result
              }
              s = result.success
            } else {
              s = result
            }
          }
          return _tag === "Prism" || _tag === "Optional" ? Result.succeed(s) : s
        },
        set: (a: any, s: any) => {
          const failure = s
          const ss = [s]
          for (let i = 0; i < ops.length; i++) {
            const op = ops[i]
            if (op._tag === "Prism" || op._tag === "Optional") {
              const result = op.get(s)
              if (Result.isFailure(result)) {
                return failure
              }
              s = result.success
              ss.push(s)
            } else {
              s = op.get(s)
              ss.push(s)
            }
          }
          for (let i = ops.length - 1; i >= 0; i--) {
            const op = ops[i]
            if (op._tag === "Iso" || op._tag === "Prism") {
              a = op.set(a)
            } else {
              a = op.set(a, ss[i])
            }
          }
          return a
        }
      }
    }
  }
}

function getComposition(a: Op["_tag"], b: Op["_tag"]): Op["_tag"] {
  return composition[a][b]
}

const composition: Record<Op["_tag"], Record<Op["_tag"], Op["_tag"]>> = {
  Iso: {
    Iso: "Iso",
    Lens: "Lens",
    Prism: "Prism",
    Optional: "Optional"
  },
  Lens: {
    Iso: "Lens",
    Lens: "Lens",
    Prism: "Optional",
    Optional: "Optional"
  },
  Prism: {
    Iso: "Prism",
    Lens: "Optional",
    Prism: "Prism",
    Optional: "Optional"
  },
  Optional: {
    Iso: "Optional",
    Lens: "Optional",
    Prism: "Optional",
    Optional: "Optional"
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
