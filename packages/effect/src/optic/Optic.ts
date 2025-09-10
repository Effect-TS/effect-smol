/**
 * @since 4.0.0
 */
import * as Arr from "../collections/Array.ts"
import * as Option from "../data/Option.ts"
import * as Result from "../data/Result.ts"
import { identity } from "../Function.ts"
import { format } from "../interfaces/Inspectable.ts"
import * as AST from "../schema/AST.ts"
import type * as Check from "../schema/Check.ts"
import * as Formatter from "../schema/Formatter.ts"
import * as Issue from "../schema/Issue.ts"
import * as ToParser from "../schema/ToParser.ts"

/**
 * @category Model
 * @since 4.0.0
 */
export interface Optic<in S, out T, out A, in B> {
  readonly getOptic: (s: S) => Result.Result<A, [string, T]>
  readonly setOptic: (b: B, s: S) => Result.Result<T, [string, T]>

  /**
   * @since 4.0.0
   */
  compose<S, A, B>(this: Iso<S, A>, that: Iso<A, B>): Iso<S, B>
  compose<S, T, A, B, C, D>(this: PolyIso<S, T, A, B>, that: PolyIso<A, B, C, D>): PolyIso<S, T, C, D>
  compose<S, A, B>(this: Lens<S, A>, that: Lens<A, B>): Lens<S, B>
  compose<S, T, A, B, C, D>(this: PolyLens<S, T, A, B>, that: PolyLens<A, B, C, D>): PolyLens<S, T, C, D>
  compose<S, A, B>(this: Prism<S, A>, that: Prism<A, B>): Prism<S, B>
  compose<S, T, A, B, C, D>(this: PolyPrism<S, T, A, B>, that: PolyPrism<A, B, C, D>): PolyPrism<S, T, C, D>
  compose<S, A, B>(this: Optional<S, A>, that: Optional<A, B>): Optional<S, B>
  compose<S, T, A, B, C, D>(this: Optic<S, T, A, B>, that: Optic<A, B, C, D>): Optic<S, T, C, D>

  /**
   * Modifies a value using both the optic's getter and setter operations.
   *
   * @since 4.0.0
   */
  modify(f: (a: A) => B): (s: S) => T

  /**
   * @since 4.0.0
   */
  tag<S, A extends { readonly _tag: AST.Literal }, Tag extends A["_tag"]>(
    this: Prism<S, A>, // works for prisms
    tag: Tag
  ): Prism<S, Extract<A, { readonly _tag: Tag }>>
  tag<S, A extends { readonly _tag: AST.Literal }, Tag extends A["_tag"]>(
    this: Optional<S, A>, // works for isos, lenses, and optionals
    tag: Tag
  ): Optional<S, Extract<A, { readonly _tag: Tag }>>

  /**
   * An optic that accesses the specified key of a struct or a tuple.
   *
   * @since 4.0.0
   */
  key<S, A, Key extends keyof A>(this: Lens<S, A>, key: Key): Lens<S, A[Key]>
  key<S, T, A, B, Key extends keyof A & keyof B>(this: PolyLens<S, T, A, B>, key: Key): PolyLens<S, T, A[Key], B[Key]>
  key<S, A, Key extends keyof A>(this: Optional<S, A>, key: Key): Optional<S, A[Key]>

  /**
   * An optic that accesses the specified key of a struct or a tuple.
   *
   * @since 4.0.0
   */
  optionalKey<S, A, Key extends keyof A>(this: Lens<S, A>, key: Key): Lens<S, A[Key] | undefined>
  optionalKey<S, T, A, B, Key extends keyof A & keyof B>(
    this: PolyLens<S, T, A, B>,
    key: Key
  ): PolyLens<S, T, A[Key] | undefined, B[Key] | undefined>
  optionalKey<S, A, Key extends keyof A>(this: Optional<S, A>, key: Key): Optional<S, A[Key] | undefined>

  /**
   * @since 4.0.0
   */
  check<S, A>(
    this: Prism<S, A>, // works for prisms
    ...checks: readonly [Check.Check<A>, ...Array<Check.Check<A>>]
  ): Prism<S, A>
  check<S, A>(
    this: Optional<S, A>, // works for isos, lenses, and optionals
    ...checks: readonly [Check.Check<A>, ...Array<Check.Check<A>>]
  ): Optional<S, A>

  /**
   * @since 4.0.0
   */
  refine<S, A, B extends A>(
    this: Prism<S, A>, // works for prisms
    refine: Check.Refine<B, A>
  ): Prism<S, B>
  refine<S, A, B extends A>(
    this: Optional<S, A>, // works for isos, lenses, and optionals
    refine: Check.Refine<B, A>
  ): Optional<S, B>

  /**
   * An optic that accesses the specified key of a record or an array.
   *
   * @since 4.0.0
   */
  at<S, A extends object, Key extends keyof A>(this: Optional<S, A>, key: Key): Optional<S, A[Key]>
}

function compose<S, T, A, B, C, D>(
  self: OpticBuilder<S, T, A, B>,
  that: OpticBuilder<A, B, C, D>
): Optic<S, T, C, D> {
  return new OpticBuilder(
    "lens",
    (s) =>
      Result.flatMap<A, [string, T], C, [string, T]>(
        self.getOptic(s),
        (a) =>
          Result.orElse(that.getOptic(a), ([err, b]) =>
            Result.match(self.setOptic(b, s), {
              onFailure: ([_, t]) => Result.fail([err, t]),
              onSuccess: (t) => Result.fail([err, t])
            }))
      ),
    self._tag === "lens" || that._tag === "lens" ?
      /**
       * Compose two optics when the piece of the whole returned by the first
       * optic is needed by the set operator of the second optic
       */
      (d, s) =>
        Result.flatMap(self.getOptic(s), (a) =>
          Result.match(that.setOptic(d, a), {
            onFailure: ([err, b]) =>
              Result.match(self.setOptic(b, s), {
                onFailure: ([_, t]) => Result.fail([err, t]),
                onSuccess: (t) => Result.fail([err, t])
              }),
            onSuccess: (b) => self.setOptic(b, s)
          })) :
      /**
       * Compose two optics when the piece of the whole returned by the get
       * operator of the first optic is not needed by the set operator of the
       * second optic (see the `as any` cast).
       */
      (d, s) =>
        Result.match(
          that.setOptic(d, undefined as any),
          {
            onFailure: ([err, b]) =>
              Result.match(self.setOptic(b, s), {
                onFailure: ([_, t]) => Result.fail([err, t]),
                onSuccess: (t) => Result.fail([err, t])
              }),
            onSuccess: (b) => self.setOptic(b, s)
          }
        )
  )
}

class OpticBuilder<in S, out T, out A, in B> implements Optic<S, T, A, B> {
  readonly _tag: "lens" | "prism"
  readonly getOptic: (s: S) => Result.Result<A, [string, T]>
  readonly setOptic: (b: B, s: S) => Result.Result<T, [string, T]>
  constructor(
    _tag: "lens" | "prism",
    getOptic: (s: S) => Result.Result<A, [string, T]>,
    setOptic: (b: B, s: S) => Result.Result<T, [string, T]>
  ) {
    this._tag = _tag
    this.getOptic = getOptic
    this.setOptic = setOptic
  }

  get(s: S): A {
    return Result.getOrThrowWith(this.getOptic(s), (s) => new Error(s[0]))
  }

  set(b: B): T {
    return Result.getOrThrowWith(this.setOptic(b, undefined as any), (s) => new Error(s[0]))
  }

  replace(b: B, s: S): T {
    return Result.getOrElse(this.setOptic(b, s), ([_, t]) => t)
  }

  getOption(s: S): Option.Option<A> {
    return Result.getSuccess(this.getOptic(s))
  }

  compose(that: any): any {
    return compose(this, that)
  }

  modify(f: (a: A) => B): (s: S) => T {
    return (s: S): T =>
      this.getOptic(s).pipe(
        Result.flatMap((a) => this.setOptic(f(a), s)),
        Result.getOrElse(([_, t]) => t)
      )
  }

  tag(tag: string) {
    return this.compose(fromTag(tag))
  }

  key(key: PropertyKey) {
    return this.compose(fromKey<any, any>(key))
  }

  optionalKey(key: PropertyKey) {
    return this.compose(fromOptionalKey<any, any>(key))
  }

  check(...checks: readonly [Check.Check<A>, ...Array<Check.Check<A>>]) {
    return this.compose(fromCheck(...checks))
  }

  refine<B extends A>(refine: Check.Refine<B, A>) {
    return this.compose(fromRefine(refine))
  }

  at(key: PropertyKey) {
    return this.compose(fromAt<any, any>(key))
  }
}

/**
 * @category Iso
 * @since 4.0.0
 */
export interface PolyIso<in S, out T, out A, in B> extends PolyLens<S, T, A, B>, PolyPrism<S, T, A, B> {}

/**
 * @since 4.0.0
 */
export interface Iso<in out S, in out A> extends PolyIso<S, S, A, A> {}

/**
 * @category Iso
 * @since 4.0.0
 */
export const makeIso: {
  <S, A>(get: (s: S) => A, set: (a: A) => S): Iso<S, A>
  <S, T, A, B>(get: (s: S) => A, set: (b: B) => T): PolyIso<S, T, A, B>
} = <S, A>(get: (s: S) => A, set: (a: A) => S): Iso<S, A> =>
  new OpticBuilder("prism", (s) => Result.succeed(get(s)), (a) => Result.succeed(set(a)))

/**
 * @category Lens
 * @since 4.0.0
 */
export interface PolyLens<in S, out T, out A, in B> extends PolyOptional<S, T, A, B> {
  readonly get: (s: S) => A
}

/**
 * @category Lens
 * @since 4.0.0
 */
export interface Lens<in out S, in out A> extends PolyLens<S, S, A, A> {}

/**
 * @category Lens
 * @since 4.0.0
 */
export const makeLens: {
  <S, A>(get: (s: S) => A, replace: (a: A, s: S) => S): Lens<S, A>
  <S, T, A, B>(get: (s: S) => A, replace: (b: B, s: S) => T): PolyLens<S, T, A, B>
} = <S, A>(get: (s: S) => A, replace: (a: A, s: S) => S): Lens<S, A> =>
  new OpticBuilder("lens", (s) => Result.succeed(get(s)), (b, s) => Result.succeed(replace(b, s)))

/**
 * @since 4.0.0
 */
export interface PolyPrism<in S, out T, out A, in B> extends PolyOptional<S, T, A, B> {
  readonly set: (b: B) => T
}

/**
 * @category Prism
 * @since 4.0.0
 */
export function makePolyPrism<S, T, A, B>(
  getOptic: (s: S) => Result.Result<A, [string, T]>,
  set: (b: B) => T
): PolyPrism<S, T, A, B> {
  return new OpticBuilder("prism", getOptic, (b) => Result.succeed(set(b)))
}

/**
 * @category Prism
 * @since 4.0.0
 */
export interface Prism<in out S, in out A> extends PolyPrism<S, S, A, A> {}

/**
 * @category Prism
 * @since 4.0.0
 */
export function makePrism<S, A>(
  getResult: (s: S) => Result.Result<A, string>,
  set: (a: A) => S
): Prism<S, A> {
  return makePolyPrism((s) => Result.mapError(getResult(s), (e) => [e, s]), set)
}

/**
 * @since 4.0.0
 */
export interface PolyOptional<in S, out T, out A, in B> extends Optic<S, T, A, B> {
  readonly getOption: (s: S) => Option.Option<A>
  readonly replace: (b: B, s: S) => T
}

/**
 * @since 4.0.0
 */
export function makePolyOptional<S, T, A, B>(
  getOptic: (s: S) => Result.Result<A, [string, T]>,
  replace: (b: B, s: S) => T
): PolyOptional<S, T, A, B> {
  return new OpticBuilder("lens", getOptic, (b, s) => Result.succeed(replace(b, s)))
}

/**
 * @category Optional
 * @since 4.0.0
 */
export interface Optional<in out S, in out A> extends PolyOptional<S, S, A, A> {}

/**
 * @category Optional
 * @since 4.0.0
 */
export function makeOptional<S, A>(
  getResult: (s: S) => Result.Result<A, string>,
  set: (a: A, s: S) => S
): Optional<S, A> {
  return makePolyOptional((s) => Result.mapError(getResult(s), (e) => [e, s]), set)
}

/**
 * The identity optic.
 *
 * @category Iso
 * @since 4.0.0
 */
export const id: {
  <S>(): Iso<S, S>
  <S, T>(): PolyIso<S, T, S, T>
} = () => makeIso(identity, identity)

/**
 * @category Lens
 * @since 4.0.0
 */
export function fromKey<S, Key extends keyof S>(key: Key): Lens<S, S[Key]> {
  return makeLens((s) => s[key], (b, s) => replaceUnsafe(key, b, s) ?? s)
}

function replaceUnsafe<S, Key extends keyof S>(key: Key, b: S[Key], s: S): S {
  if (Array.isArray(s)) {
    const out: any = s.slice()
    out[key] = b
    return out
  } else {
    return { ...s, [key]: b }
  }
}

/**
 * @category Lens
 * @since 4.0.0
 */
export function fromOptionalKey<S, Key extends keyof S>(
  key: Key
): Lens<S, S[Key] | undefined> {
  return makeLens<S, S[Key] | undefined>(
    (s) => s[key],
    (b, s) => (b === undefined ? removeUnsafe(key, s) : replaceUnsafe(key, b, s))
  )
}

function removeUnsafe<S, Key extends keyof S>(key: Key, s: S): S {
  if (Array.isArray(s)) {
    const out = s.slice()
    out.splice(key as number, 1)
    return out as S
  } else {
    const out = { ...s }
    delete out[key]
    return out
  }
}

/**
 * @category Prism
 * @since 4.0.0
 */
export function fromCheck<T>(...checks: readonly [Check.Check<T>, ...Array<Check.Check<T>>]): Prism<T, T> {
  return makePrism(
    (s) => {
      const issues: Array<Issue.Issue> = []
      ToParser.runChecks(checks, s, issues, AST.unknownKeyword, { errors: "all" })
      if (Arr.isArrayNonEmpty(issues)) {
        const issue = new Issue.Composite(AST.unknownKeyword, Option.some(s), issues)
        return Result.fail(Formatter.makeDefault().format(issue))
      }
      return Result.succeed(s)
    },
    identity
  )
}

/**
 * @category Prism
 * @since 4.0.0
 */
export function fromRefine<T extends E, E>(refine: Check.Refine<T, E>): Prism<E, T> {
  return fromCheck(refine) as any
}

/**
 * @category Prism
 * @since 4.0.0
 */
export function fromTag<S extends { readonly _tag: AST.Literal }, Tag extends S["_tag"]>(
  tag: Tag
): Prism<S, Extract<S, { readonly _tag: Tag }>> {
  return makePrism(
    (s: S) =>
      s._tag === tag ? Result.succeed(s as any) : Result.fail(`Expected ${format(tag)} tag, got ${format(s._tag)}`),
    identity
  )
}

/**
 * @category Optional
 * @since 4.0.0
 */
export function fromAt<S extends object, Key extends keyof S>(key: Key): Optional<S, S[Key]> {
  return makeOptional(
    (s) => Object.hasOwn(s, key) ? Result.succeed(s[key]) : Result.fail(`Key ${format(key)} not found`),
    (b, s) => replaceUnsafe(key, b, s)
  )
}
