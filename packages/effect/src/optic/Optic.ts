/**
 * @since 4.0.0
 */
import * as Arr from "../collections/Array.ts"
import * as Option from "../data/Option.ts"
import * as Result from "../data/Result.ts"
import { identity } from "../Function.ts"
import * as AST from "../schema/AST.ts"
import type * as Check from "../schema/Check.ts"
import * as Formatter from "../schema/Formatter.ts"
import * as Issue from "../schema/Issue.ts"
import * as ToParser from "../schema/ToParser.ts"

/**
 * @category Model
 * @since 4.0.0
 */
export interface Optic<in S, out T, out A, in B, out GE, out SE, in SS> {
  readonly getOptic: (s: S) => Result.Result<A, readonly [GE, T]>
  readonly setOptic: (b: B, ss: SS) => Result.Result<T, readonly [SE, T]>

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
  compose<S, T, A, B, C, D>(this: PolyOptional<S, T, A, B>, that: PolyOptional<A, B, C, D>): PolyOptional<S, T, C, D>

  /**
   * An optic that accesses the specified key of a struct or a tuple.
   *
   * @since 4.0.0
   */
  at<S, A, Key extends keyof A>(this: Lens<S, A>, key: Key): Lens<S, A[Key]>
  at<S, T, A, B, Key extends keyof A & keyof B>(
    this: PolyLens<S, T, A, B>,
    key: Key
  ): PolyLens<S, T, A[Key], B[Key]>
  at<S, A, Key extends keyof A>(
    this: Optional<S, A>,
    key: Key
  ): Optional<S, A[Key]>
  at<S, T, A, B, Key extends keyof A & keyof B>(
    this: PolyOptional<S, T, A, B>,
    key: Key
  ): PolyOptional<S, T, A[Key], B[Key]>

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
}

/**
 * @since 4.0.0
 */
export interface Top extends Optic<never, unknown, unknown, never, unknown, unknown, never> {}

/**
 * Compose two optics when the piece of the whole returned by the get
 * operator of the first optic is not needed by the set operator of the
 * second optic.
 */
const prismComposition = <S extends SS, T, A, B, GE extends GE1, SE extends SE1, SS, A1, B1, GE1, SE1>(
  self: Optic<S, T, A, B, GE, SE, SS>,
  that: Optic<A, B, A1, B1, GE1, SE1, unknown>
): Optic<S, T, A1, B1, GE1, SE1, SS> =>
  new Bottom(
    "prism",
    (s) =>
      Result.flatMap<A, readonly [GE, T], A1, [GE1, T]>(
        self.getOptic(s),
        (a) =>
          Result.orElse(that.getOptic(a), ([ge1, b]) =>
            Result.match(self.setOptic(b, s), {
              onFailure: ([_, t]) => Result.fail([ge1, t]),
              onSuccess: (t) => Result.fail([ge1, t])
            }))
      ),
    (b1, ss) =>
      Result.match(
        that.setOptic(b1, undefined),
        {
          onFailure: ([se1, b]) =>
            Result.match(self.setOptic(b, ss), {
              onFailure: ([_, T]) => Result.fail([se1, T]),
              onSuccess: (T) => Result.fail([se1, T])
            }),
          onSuccess: (b) => self.setOptic(b, ss)
        }
      )
  )

/**
 * Compose two optics when the piece of the whole returned by the first
 * optic is needed by the set operator of the second optic
 */
const lensComposition = <
  S extends SS,
  T,
  A extends SS1,
  B,
  GE extends (SE1 & GE1),
  SE extends SE1,
  SS,
  A1,
  B1,
  GE1,
  SE1,
  SS1
>(
  self: Optic<S, T, A, B, GE, SE, SS>,
  that: Optic<A, B, A1, B1, GE1, SE1, SS1>
): Optic<S, T, A1, B1, GE1, SE1, S> =>
  new Bottom(
    "lens",
    (s) =>
      Result.flatMap<A, readonly [GE, T], A1, [GE1, T]>(
        self.getOptic(s),
        (a) =>
          Result.orElse(that.getOptic(a), ([ge1, b]) =>
            Result.match(self.setOptic(b, s), {
              onFailure: ([_, t]) => Result.fail([ge1, t]),
              onSuccess: (t) => Result.fail([ge1, t])
            }))
      ),
    (b1, s) =>
      Result.flatMap(self.getOptic(s), (a) =>
        Result.match(that.setOptic(b1, a), {
          onFailure: ([se1, b]) =>
            Result.match(self.setOptic(b, s), {
              onFailure: ([_, t]) => Result.fail([se1, t] as const),
              onSuccess: (t) => Result.fail([se1, t] as const)
            }),
          onSuccess: (b) => self.setOptic(b, s)
        }))
  )

class Bottom<in S, out T, out A, in B, out GE, out SE, in SS> implements Optic<S, T, A, B, GE, SE, SS> {
  readonly _tag: "prism" | "lens"
  readonly getOptic: (s: S) => Result.Result<A, readonly [GE, T]>
  readonly setOptic: (b: B, ss: SS) => Result.Result<T, readonly [SE, T]>
  constructor(
    _tag: "prism" | "lens",
    getOptic: (s: S) => Result.Result<A, readonly [GE, T]>,
    setOptic: (b: B, ss: SS) => Result.Result<T, readonly [SE, T]>
  ) {
    this._tag = _tag
    this.getOptic = getOptic
    this.setOptic = setOptic
  }

  compose(that: any): any {
    return this._tag === "lens" || that._tag === "lens" ?
      lensComposition(this as any, that) :
      prismComposition(this as any, that)
  }

  at(key: PropertyKey) {
    return this.compose(fromAt<any, any>(key))
  }

  check(...checks: readonly [Check.Check<A>, ...Array<Check.Check<A>>]) {
    return this.compose(fromCheck(...checks))
  }

  refine<B extends A>(refine: Check.Refine<B, A>) {
    return this.compose(fromRefine(refine))
  }
}

/**
 * @since 4.0.0
 */
export interface PolyIso<in S, out T, out A, in B> extends Optic<S, T, A, B, never, never, unknown> {}

/**
 * @since 4.0.0
 */
export interface Iso<in out S, in out A> extends PolyIso<S, S, A, A> {}

/**
 * @category Constructors
 * @since 4.0.0
 */
export const makeIso: {
  <S, A>(get: (s: S) => A, set: (a: A) => S): Iso<S, A>
  <S, T, A, B>(get: (s: S) => A, set: (b: B) => T): PolyIso<S, T, A, B>
} = <S, A>(get: (s: S) => A, set: (a: A) => S): Iso<S, A> =>
  new Bottom("prism", (s) => Result.succeed(get(s)), (a) => Result.succeed(set(a)))

/**
 * @since 4.0.0
 */
export interface PolyLens<in S, out T, out A, in B> extends Optic<S, T, A, B, never, never, S> {}

/**
 * @since 4.0.0
 */
export interface Lens<in out S, in out A> extends PolyLens<S, S, A, A> {}

/**
 * @category Constructors
 * @since 4.0.0
 */
export const makeLens: {
  <S, A>(get: (s: S) => A, set: (a: A, s: S) => S): Lens<S, A>
  <S, T, A, B>(get: (s: S) => A, set: (b: B, s: S) => T): PolyLens<S, T, A, B>
} = <S, A>(get: (s: S) => A, set: (a: A, s: S) => S): Lens<S, A> =>
  new Bottom("lens", (s) => Result.succeed(get(s)), (b, s) => Result.succeed(set(b, s)))

/**
 * @since 4.0.0
 */
export interface PolyPrism<in S, out T, out A, in B> extends Optic<S, T, A, B, Error, never, unknown> {}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function makePolyPrism<S, T, A, B>(
  get: (s: S) => Result.Result<A, readonly [Error, T]>,
  set: (b: B) => T
): PolyPrism<S, T, A, B> {
  return new Bottom("prism", get, (b) => Result.succeed(set(b)))
}

/**
 * @since 4.0.0
 */
export interface Prism<in out S, in out A> extends PolyPrism<S, S, A, A> {}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function makePrism<S, A>(
  get: (s: S) => Result.Result<A, Error>,
  set: (a: A) => S
): Prism<S, A> {
  return makePolyPrism((s) => Result.mapError(get(s), (e) => [e, s]), set)
}

/**
 * @since 4.0.0
 */
export interface PolyOptional<in S, out T, out A, in B> extends Optic<S, T, A, B, Error, Error, S> {}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function makePolyOptional<S, T, A, B>(
  get: (s: S) => Result.Result<A, readonly [Error, T]>,
  set: (b: B, s: S) => Result.Result<T, readonly [Error, T]>
): PolyOptional<S, T, A, B> {
  return new Bottom("lens", get, set)
}

/**
 * @since 4.0.0
 */
export interface Optional<in out S, in out A> extends PolyOptional<S, S, A, A> {}

/**
 * @category Constructors
 * @since 4.0.0
 */
export function makeOptional<S, A>(
  get: (s: S) => Result.Result<A, Error>,
  set: (a: A, s: S) => Result.Result<S, Error>
): Optional<S, A> {
  return makePolyOptional(
    (s) => Result.mapError(get(s), (e) => [e, s]),
    (a, s) => Result.mapError(set(a, s), (e) => [e, s])
  )
}

/**
 * @since 4.0.0
 */
export interface PolySetter<in S, out T, in A> extends Optic<never, T, unknown, A, unknown, Error, S> {}

/**
 * @since 4.0.0
 */
export interface Setter<in out S, in A> extends PolySetter<S, S, A> {}

/**
 * @since 4.0.0
 */
export interface Getter<in S, out A> extends Optic<S, unknown, A, never, Error, unknown, never> {}

/**
 * @since 4.0.0
 */
export function getOption<S, A>(optic: Getter<S, A>) {
  return (s: S): Option.Option<A> => Result.getSuccess(optic.getOptic(s))
}

/**
 * Replaces a value using the optic's setter operation.
 *
 * When the optic's `setOptic` operation fails, this function returns the
 * original structure as a fallback, ensuring it always returns a value.
 *
 * This is different from {@link replaceOption} which returns `None` when
 * `setOptic` fails.
 *
 * @since 4.0.0
 */
export function replace<S, T, A>(optic: PolySetter<S, T, A>) {
  return (s: S, a: A): T => Result.getOrElse(optic.setOptic(a, s), ([_, t]) => t)
}

/**
 * Replaces a value using the optic's setter operation, returning an `Option`.
 *
 * When the optic's `setOptic` operation succeeds, returns `Some` with the
 * result. When the optic's `setOptic` operation fails, returns `None`.
 *
 * This is different from {@link replace} which returns the original structure
 * as a fallback when `setOptic` fails.
 *
 * @since 4.0.0
 */
export function replaceOption<S, T, A>(optic: PolySetter<S, T, A>) {
  return (s: S, a: A): Option.Option<T> => Result.getSuccess(optic.setOptic(a, s))
}

/**
 * Modifies a value using both the optic's getter and setter operations.
 *
 * @since 4.0.0
 */
export function modify<S, T, A, B>(optic: PolyOptional<S, T, A, B>, f: (a: A) => B) {
  return (s: S): T =>
    optic.getOptic(s).pipe(
      Result.flatMap((a) => optic.setOptic(f(a), s)),
      Result.getOrElse(([_, t]) => t)
    )
}

/**
 * The identity optic.
 *
 * @category Isos
 * @since 4.0.0
 */
export const id: {
  <S>(): Iso<S, S>
  <S, T>(): PolyIso<S, T, S, T>
} = () => makeIso(identity, identity)

/**
 * @category Lenses
 * @since 4.0.0
 */
export function fromAt<S, Key extends keyof S & (string | symbol)>(key: Key): Lens<S, S[Key]> {
  return makeLens((s) => s[key], (b, s) => {
    if (Array.isArray(s)) {
      const out: any = s.slice()
      out[key] = b
      return out
    }
    return { ...s, [key]: b }
  })
}

/**
 * @category Prisms
 * @since 4.0.0
 */
export function fromCheck<T>(...checks: readonly [Check.Check<T>, ...Array<Check.Check<T>>]): Prism<T, T> {
  return makePrism(
    (s) => {
      const issues: Array<Issue.Issue> = []
      ToParser.runChecks(checks, s, issues, AST.unknownKeyword, { errors: "all" })
      if (Arr.isArrayNonEmpty(issues)) {
        const issue = new Issue.Composite(AST.unknownKeyword, Option.some(s), issues)
        return Result.fail(new Error(Formatter.makeDefault().format(issue)))
      }
      return Result.succeed(s)
    },
    identity
  )
}

/**
 * @category Prisms
 * @since 4.0.0
 */
export function fromRefine<T extends E, E>(refine: Check.Refine<T, E>): Prism<E, T> {
  return fromCheck(refine) as any
}
