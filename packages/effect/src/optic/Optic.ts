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
export interface Optic<in out S, in out A> {
  readonly getResult: (s: S) => Result.Result<A, string>
  readonly replaceResult: (a: A, s: S) => Result.Result<S, string>

  /**
   * @since 4.0.0
   */
  compose<S, A, B>(this: Iso<S, A>, that: Iso<A, B>): Iso<S, B>
  compose<S, A, B>(this: Lens<S, A>, that: Lens<A, B>): Lens<S, B>
  compose<S, A, B>(this: Prism<S, A>, that: Prism<A, B>): Prism<S, B>
  compose<S, A, B>(this: Optional<S, A>, that: Optional<A, B>): Optional<S, B>

  /**
   * Modifies a value using both the optic's getter and setter operations.
   *
   * @since 4.0.0
   */
  modify(f: (a: A) => A): (s: S) => S

  modifyResult(f: (a: A) => A): (s: S) => Result.Result<S, string>

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
  key<S, A extends object, Key extends keyof A>(this: Optional<S, A>, key: Key): Optional<S, A[Key]>

  /**
   * An optic that accesses the specified key of a struct or a tuple.
   *
   * @since 4.0.0
   */
  optionalKey<S, A, Key extends keyof A>(this: Lens<S, A>, key: Key): Lens<S, A[Key] | undefined>
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

function compose<S, A, B>(
  self: OpticBuilder<S, A>,
  that: OpticBuilder<A, B>
): Optic<S, B> {
  const getUnsafe = self.getUnsafe && that.getUnsafe ? (s: S) => that.getUnsafe!(self.getUnsafe!(s)) : undefined

  const setUnsafe = self.setUnsafe && that.setUnsafe ? (b: B) => self.setUnsafe!(that.setUnsafe!(b)) : undefined

  const getResult = getUnsafe
    ? (s: S) => Result.succeed(getUnsafe(s))
    : (s: S) => Result.flatMap(self.getResult(s), (a) => that.getResult(a))

  // If RHS doesn't need the source we can avoid reading A entirely.
  if (that.setUnsafe) {
    const replaceResult = (b: B, s: S) => self.replaceResult(that.setUnsafe!(b), s)
    return new OpticBuilder(getResult, replaceResult, getUnsafe, setUnsafe)
  }

  // RHS needs the current A
  if (self.getUnsafe) {
    const replaceResult = (b: B, s: S) =>
      Result.flatMap(that.replaceResult(b, self.getUnsafe!(s)), (a2) => self.replaceResult(a2, s))
    return new OpticBuilder(getResult, replaceResult, getUnsafe, setUnsafe)
  }

  const replaceResult = (b: B, s: S) =>
    Result.flatMap(
      self.getResult(s),
      (a) => Result.flatMap(that.replaceResult(b, a), (a2) => self.replaceResult(a2, s))
    )

  return new OpticBuilder(getResult, replaceResult, getUnsafe, setUnsafe)
}

/** @internal */
export class OpticBuilder<in out S, in out A> implements Optic<S, A> {
  readonly getResult: (s: S) => Result.Result<A, string>
  readonly replaceResult: (a: A, s: S) => Result.Result<S, string>
  // fast paths (optional)
  readonly getUnsafe: ((s: S) => A) | undefined
  readonly setUnsafe: ((a: A) => S) | undefined

  constructor(
    getResult: (s: S) => Result.Result<A, string>,
    replaceResult: (a: A, s: S) => Result.Result<S, string>,
    getUnsafe?: (s: S) => A,
    setUnsafe?: (a: A) => S
  ) {
    this.getResult = getResult
    this.replaceResult = replaceResult
    this.getUnsafe = getUnsafe
    this.setUnsafe = setUnsafe
  }

  get(s: S): A {
    return this.getUnsafe!(s)
  }

  set(a: A): S {
    return this.setUnsafe!(a)
  }

  replace(a: A, s: S): S {
    return Result.getOrElse(this.replaceResult(a, s), () => s)
  }

  getOption(s: S): Option.Option<A> {
    if (this.getUnsafe) return Option.some(this.getUnsafe(s))
    return Result.getSuccess(this.getResult(s))
  }

  compose(that: any): any {
    return compose(this, that)
  }

  modify(f: (a: A) => A): (s: S) => S {
    const modifyResult = this.modifyResult(f)
    return (s: S): S => Result.getOrElse(modifyResult(s), () => s)
  }

  modifyResult(f: (a: A) => A): (s: S) => Result.Result<S, string> {
    return (s) =>
      this.getResult(s).pipe(
        Result.flatMap((a) => this.replaceResult(f(a), s))
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
export interface Iso<in out S, in out A> extends Lens<S, A>, Prism<S, A> {}

/**
 * @category Iso
 * @since 4.0.0
 */
export function makeIso<S, A>(get: (s: S) => A, set: (a: A) => S): Iso<S, A> {
  return new OpticBuilder((s) => Result.succeed(get(s)), (a) => Result.succeed(set(a)), get, set)
}

/**
 * @category Lens
 * @since 4.0.0
 */
export interface Lens<in out S, in out A> extends Optional<S, A> {
  readonly get: (s: S) => A
}

/**
 * @category Lens
 * @since 4.0.0
 */
export function makeLens<S, A>(get: (s: S) => A, replace: (a: A, s: S) => S): Lens<S, A> {
  return new OpticBuilder((s) => Result.succeed(get(s)), (b, s) => Result.succeed(replace(b, s)), get)
}

/**
 * @category Prism
 * @since 4.0.0
 */
export interface Prism<in out S, in out A> extends Optional<S, A> {
  readonly set: (a: A) => S
}

/**
 * @category Prism
 * @since 4.0.0
 */
export function makePrism<S, A>(
  getResult: (s: S) => Result.Result<A, string>,
  set: (a: A) => S
): Prism<S, A> {
  return new OpticBuilder(getResult, (b) => Result.succeed(set(b)), undefined, set)
}

/**
 * @category Optional
 * @since 4.0.0
 */
export interface Optional<in out S, in out A> extends Optic<S, A> {
  readonly getOption: (s: S) => Option.Option<A>
  readonly replace: (a: A, s: S) => S
}

/**
 * @category Optional
 * @since 4.0.0
 */
export function makeOptional<S, A>(
  getResult: (s: S) => Result.Result<A, string>,
  setResult: (a: A, s: S) => Result.Result<S, string>
): Optional<S, A> {
  return new OpticBuilder(getResult, setResult)
}

/**
 * The identity optic.
 *
 * @category Iso
 * @since 4.0.0
 */
export function id<S>(): Iso<S, S> {
  return makeIso(identity, identity)
}

/**
 * An optic that accesses the specified key of a struct or a tuple.
 *
 * @category Lens
 * @since 4.0.0
 */
export function fromKey<S extends object, Key extends keyof S>(key: Key): Lens<S, S[Key]> {
  return makeLens(
    (s) => s[key],
    (a, s) => replace(key, a, s)
  )
}

function replace<S, Key extends keyof S>(key: Key, a: S[Key], s: S): S {
  if (Array.isArray(s)) {
    const out: any = s.slice()
    out[key] = a
    return out
  } else {
    return { ...s, [key]: a }
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
    (a, s) => (a === undefined ? remove(key, s) : replace(key, a, s))
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
