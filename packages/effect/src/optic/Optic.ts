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
export type OpticError<T> = [message: string, recovered: T]

/**
 * @category Model
 * @since 4.0.0
 */
export interface Optic<in S, out T, out A, in B> {
  readonly getOptic: (s: S) => Result.Result<A, OpticError<T>>
  readonly setOptic: (b: B, s: S) => Result.Result<T, OpticError<T>>

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

  modifyResult(f: (a: A) => B): (s: S) => Result.Result<T, OpticError<T>>

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
  key<S, A extends object, Key extends keyof A>(this: Lens<S, A>, key: Key): Lens<S, A[Key]>
  key<S, T, A extends object, B extends object, Key extends keyof A & keyof B>(
    this: PolyLens<S, T, A, B>,
    key: Key
  ): PolyLens<S, T, A[Key], B[Key]>
  key<S, A extends object, Key extends keyof A>(this: Optional<S, A>, key: Key): Optional<S, A[Key]>

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
    false,
    (s) =>
      Result.flatMap<A, OpticError<T>, C, OpticError<T>>(
        self.getOptic(s),
        (a) =>
          Result.orElse(that.getOptic(a), ([err, b]) =>
            Result.match(self.setOptic(b, s), {
              onFailure: ([_, t]) => Result.fail([err, t]),
              onSuccess: (t) => Result.fail([err, t])
            }))
      ),
    self.setterIgnoresSource && that.setterIgnoresSource ?
      /**
       * Compose two optics when the piece of the whole returned by the get
       * operator of the first optic is not needed by the set operator of the
       * second optic (see the `as any` cast).
       */
      (d, s) =>
        Result.match(
          that.setOptic(d, s as any),
          {
            onFailure: ([err, b]) =>
              Result.match(self.setOptic(b, s), {
                onFailure: ([_, t]) => Result.fail([err, t]),
                onSuccess: (t) => Result.fail([err, t])
              }),
            onSuccess: (b) => self.setOptic(b, s)
          }
        ) :
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
          }))
  )
}

/** @internal */
export class OpticBuilder<in S, out T, out A, in B> implements Optic<S, T, A, B> {
  readonly setterIgnoresSource: boolean
  readonly getOptic: (s: S) => Result.Result<A, OpticError<T>>
  readonly setOptic: (b: B, s: S) => Result.Result<T, OpticError<T>>
  constructor(
    setterIgnoresSource: boolean,
    getOptic: (s: S) => Result.Result<A, OpticError<T>>,
    setOptic: (b: B, s: S) => Result.Result<T, OpticError<T>>
  ) {
    this.setterIgnoresSource = setterIgnoresSource
    this.getOptic = getOptic
    this.setOptic = setOptic
  }

  get(s: S): A {
    return Result.getOrThrowWith(this.getOptic(s), ([message]) => new Error(message))
  }

  set(b: B): T {
    return Result.getOrThrowWith(this.setOptic(b, undefined as any), ([message]) => new Error(message))
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
    const modifyResult = this.modifyResult(f)
    return (s: S): T => Result.getOrElse(modifyResult(s), ([_, t]) => t)
  }

  modifyResult(f: (a: A) => B): (s: S) => Result.Result<T, OpticError<T>> {
    return (s) =>
      this.getOptic(s).pipe(
        Result.flatMap((a) => this.setOptic(f(a), s))
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
  new OpticBuilder(true, (s) => Result.succeed(get(s)), (a) => Result.succeed(set(a)))

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
  new OpticBuilder(false, (s) => Result.succeed(get(s)), (b, s) => Result.succeed(replace(b, s)))

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
  getOptic: (s: S) => Result.Result<A, OpticError<T>>,
  set: (b: B) => T
): PolyPrism<S, T, A, B> {
  return new OpticBuilder(true, getOptic, (b) => Result.succeed(set(b)))
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
  getOptic: (s: S) => Result.Result<A, OpticError<T>>,
  replace: (b: B, s: S) => Result.Result<T, OpticError<T>>
): PolyOptional<S, T, A, B> {
  return new OpticBuilder(false, getOptic, (b, s) => replace(b, s))
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
  setResult: (a: A, s: S) => Result.Result<S, string>
): Optional<S, A> {
  return makePolyOptional(
    (s) => Result.mapError(getResult(s), (e) => [e, s]),
    (a, s) => Result.mapError(setResult(a, s), (e) => [e, s])
  )
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
 * An optic that accesses the specified key of a struct or a tuple.
 *
 * @category Lens
 * @since 4.0.0
 */
export function fromKey<S extends object, Key extends keyof S>(key: Key): Lens<S, S[Key]> {
  return makeLens((s) => {
    if (Object.hasOwn(s, key)) {
      return s[key]
    }
    throw new Error(`Key ${format(key)} not found`)
  }, (b, s) => {
    if (Object.hasOwn(s, key)) {
      return replace(key, b, s)
    }
    throw new Error(`Key ${format(key)} not found`)
  })
}

function replace<S, Key extends keyof S>(key: Key, b: S[Key], s: S): S {
  if (Array.isArray(s)) {
    const out: any = s.slice()
    out[key] = b
    return out
  } else {
    return { ...s, [key]: b }
  }
}

/**
 * An optic that accesses the specified optional key of a struct or a tuple.
 *
 * @category Lens
 * @since 4.0.0
 */
export function fromOptionalKey<S, Key extends keyof S>(
  key: Key
): Lens<S, S[Key] | undefined> {
  return makeLens<S, S[Key] | undefined>(
    (s) => s[key],
    (b, s) => (b === undefined ? remove(key, s) : replace(key, b, s))
  )
}

function remove<S, Key extends keyof S>(key: Key, s: S): S {
  if (Array.isArray(s)) {
    const k = key as number
    if (k === s.length - 1) {
      const out: any = s.slice()
      out.splice(k, 1)
      return out
    } else {
      throw new Error(`Cannot remove element at index ${format(key)}`)
    }
  } else {
    const out = { ...s }
    delete out[key]
    return out
  }
}

/**
 * An optic that checks the specified checks of a value.
 *
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
 * An optic that refines the specified refine of a value.
 *
 * @category Prism
 * @since 4.0.0
 */
export function fromRefine<T extends E, E>(refine: Check.Refine<T, E>): Prism<E, T> {
  return fromCheck(refine) as unknown as Prism<E, T>
}

/**
 * An optic that accesses the specified tag of a tagged union.
 *
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
 * An optic that accesses the specified key of a record or an array.
 *
 * @category Optional
 * @since 4.0.0
 */
export function fromAt<S extends object, Key extends keyof S>(key: Key): Optional<S, S[Key]> {
  return makeOptional(
    (s) => Object.hasOwn(s, key) ? Result.succeed(s[key]) : Result.fail(`Key ${format(key)} not found`),
    (b, s) => Object.hasOwn(s, key) ? Result.succeed(replace(key, b, s)) : Result.fail(`Key ${format(key)} not found`)
  )
}

/**
 * An optic that accesses the value of a `Some` value.
 *
 * @category Prism
 * @since 4.0.0
 */
export function some<A>(): Prism<Option.Option<A>, A> {
  return makePrism(Result.fromOption(() => "Expected a Some value, got none()"), Option.some)
}

/**
 * An optic that accesses the specified index of a `string`.
 *
 * @category Optional
 * @since 4.0.0
 */
export function charAt(i: number): Optional<string, string> {
  return makeOptional(
    (s) => {
      if (i < 0 || i >= s.length) {
        return Result.fail(`Missing character at index ${i}`)
      }
      return Result.succeed(s.charAt(i))
    },
    (char, s) => {
      if (char.length !== 1) {
        return Result.fail(`Expected a single character, got ${format(char)}`)
      }
      if (i >= 0 && i < s.length) {
        return Result.succeed(s.substring(0, i) + char.charAt(0) + s.substring(i + 1))
      }
      return Result.fail(`Missing character at index ${i}`)
    }
  )
}
