/**
 * @since 4.0.0
 */

import * as Duration from "./Duration.ts"
import * as Effect from "./Effect.ts"
import * as Option from "./Option.ts"
import * as Predicate from "./Predicate.ts"
import type * as AST from "./SchemaAST.ts"
import * as Getter from "./SchemaGetter.ts"
import * as Issue from "./SchemaIssue.ts"

/**
 * @category model
 * @since 4.0.0
 */
export class Middleware<in out T, in out E, RDE, RDT, RET, REE> {
  readonly _tag = "Middleware"
  readonly decode: (
    effect: Effect.Effect<Option.Option<E>, Issue.Issue, RDE>,
    options: AST.ParseOptions
  ) => Effect.Effect<Option.Option<T>, Issue.Issue, RDT>
  readonly encode: (
    effect: Effect.Effect<Option.Option<T>, Issue.Issue, RET>,
    options: AST.ParseOptions
  ) => Effect.Effect<Option.Option<E>, Issue.Issue, REE>

  constructor(
    decode: (
      effect: Effect.Effect<Option.Option<E>, Issue.Issue, RDE>,
      options: AST.ParseOptions
    ) => Effect.Effect<Option.Option<T>, Issue.Issue, RDT>,
    encode: (
      effect: Effect.Effect<Option.Option<T>, Issue.Issue, RET>,
      options: AST.ParseOptions
    ) => Effect.Effect<Option.Option<E>, Issue.Issue, REE>
  ) {
    this.decode = decode
    this.encode = encode
  }
  flip(): Middleware<E, T, RET, REE, RDE, RDT> {
    return new Middleware(this.encode, this.decode)
  }
}

const TypeId = "~effect/SchemaTransformation/Transformation"

/**
 * @category model
 * @since 4.0.0
 */
export class Transformation<in out T, in out E, RD = never, RE = never> {
  readonly [TypeId] = TypeId
  readonly _tag = "Transformation"
  readonly decode: Getter.Getter<T, E, RD>
  readonly encode: Getter.Getter<E, T, RE>

  constructor(
    decode: Getter.Getter<T, E, RD>,
    encode: Getter.Getter<E, T, RE>
  ) {
    this.decode = decode
    this.encode = encode
  }
  flip(): Transformation<E, T, RE, RD> {
    return new Transformation(this.encode, this.decode)
  }
  compose<T2, RD2, RE2>(other: Transformation<T2, T, RD2, RE2>): Transformation<T2, E, RD | RD2, RE | RE2> {
    return new Transformation(
      this.decode.compose(other.decode),
      other.encode.compose(this.encode)
    )
  }
}

/**
 * @since 4.0.0
 */
export function isTransformation(u: unknown): u is Transformation<any, any, unknown, unknown> {
  return Predicate.hasProperty(u, TypeId)
}

/**
 * @since 4.0.0
 */
export const make = <T, E, RD = never, RE = never>(options: {
  readonly decode: Getter.Getter<T, E, RD>
  readonly encode: Getter.Getter<E, T, RE>
}): Transformation<T, E, RD, RE> => {
  if (isTransformation(options)) {
    return options as any
  }
  return new Transformation(options.decode, options.encode)
}

/**
 * @since 4.0.0
 */
export function transformOrFail<T, E, RD = never, RE = never>(options: {
  readonly decode: (e: E, options: AST.ParseOptions) => Effect.Effect<T, Issue.Issue, RD>
  readonly encode: (t: T, options: AST.ParseOptions) => Effect.Effect<E, Issue.Issue, RE>
}): Transformation<T, E, RD, RE> {
  return new Transformation(
    Getter.transformOrFail(options.decode),
    Getter.transformOrFail(options.encode)
  )
}

/**
 * @since 4.0.0
 */
export function transform<T, E>(options: {
  readonly decode: (input: E) => T
  readonly encode: (input: T) => E
}): Transformation<T, E> {
  return new Transformation(
    Getter.transform(options.decode),
    Getter.transform(options.encode)
  )
}

/**
 * @since 4.0.0
 */
export function transformOptional<T, E>(options: {
  readonly decode: (input: Option.Option<E>) => Option.Option<T>
  readonly encode: (input: Option.Option<T>) => Option.Option<E>
}): Transformation<T, E> {
  return new Transformation(
    Getter.transformOptional(options.decode),
    Getter.transformOptional(options.encode)
  )
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function trim(): Transformation<string, string> {
  return new Transformation(
    Getter.trim(),
    Getter.passthrough()
  )
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function snakeToCamel(): Transformation<string, string> {
  return new Transformation(
    Getter.snakeToCamel(),
    Getter.camelToSnake()
  )
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function toLowerCase(): Transformation<string, string> {
  return new Transformation(
    Getter.toLowerCase(),
    Getter.passthrough()
  )
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function toUpperCase(): Transformation<string, string> {
  return new Transformation(
    Getter.toUpperCase(),
    Getter.passthrough()
  )
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function capitalize(): Transformation<string, string> {
  return new Transformation(
    Getter.capitalize(),
    Getter.passthrough()
  )
}

/**
 * @category String transformations
 * @since 4.0.0
 */
export function uncapitalize(): Transformation<string, string> {
  return new Transformation(
    Getter.uncapitalize(),
    Getter.passthrough()
  )
}

/**
 * A transformation that decodes a string into a record of key-value pairs and
 * encodes a record of key-value pairs into a string.
 *
 * **Options**
 *
 * - `separator`: The separator between key-value pairs. Defaults to `,`.
 * - `keyValueSeparator`: The separator between key and value. Defaults to `=`.
 *
 * @category String transformations
 * @since 4.0.0
 */
export function splitKeyValue(options?: {
  readonly separator?: string | undefined
  readonly keyValueSeparator?: string | undefined
}): Transformation<Record<string, string>, string> {
  return new Transformation(
    Getter.splitKeyValue(options),
    Getter.joinKeyValue(options)
  )
}

const passthrough_ = new Transformation(
  Getter.passthrough<any>(),
  Getter.passthrough<any>()
)

/**
 * @since 4.0.0
 */
export function passthrough<T, E>(options: { readonly strict: false }): Transformation<T, E>
export function passthrough<T>(): Transformation<T, T>
export function passthrough<T>(): Transformation<T, T> {
  return passthrough_
}

/**
 * @since 4.0.0
 */
export function passthroughSupertype<T extends E, E>(): Transformation<T, E>
export function passthroughSupertype<T>(): Transformation<T, T> {
  return passthrough_
}

/**
 * @since 4.0.0
 */
export function passthroughSubtype<T, E extends T>(): Transformation<T, E>
export function passthroughSubtype<T>(): Transformation<T, T> {
  return passthrough_
}

/**
 * @category Coercions
 * @since 4.0.0
 */
export const numberFromString = new Transformation(
  Getter.Number(),
  Getter.String()
)

/**
 * @category Coercions
 * @since 4.0.0
 */
export const bigintFromString = new Transformation(
  Getter.BigInt(),
  Getter.String()
)

/**
 * @since 4.0.0
 */
export const durationFromNanos: Transformation<Duration.Duration, bigint> = transformOrFail({
  decode: (i) => Effect.succeed(Duration.nanos(i)),
  encode: (a) => {
    const nanos = Duration.toNanos(a)
    if (Predicate.isUndefined(nanos)) {
      return Effect.fail(
        new Issue.InvalidValue(Option.some(a), { message: `Unable to encode ${a} into a bigint` })
      )
    }
    return Effect.succeed(nanos)
  }
})

/**
 * @since 4.0.0
 */
export const durationFromMillis: Transformation<Duration.Duration, number> = transform({
  decode: (i) => Duration.millis(i),
  encode: (a) => Duration.toMillis(a)
})

/** @internal */
export const errorFromErrorJsonEncoded: Transformation<Error, {
  message: string
  name?: string
  stack?: string
}> = transform({
  decode: (i) => {
    const err = new Error(i.message)
    if (typeof i.name === "string" && i.name !== "Error") err.name = i.name
    if (typeof i.stack === "string") err.stack = i.stack
    return err
  },
  encode: (a) => {
    return {
      name: a.name,
      message: a.message
      // no stack because of security reasons
    }
  }
})

/**
 * @since 4.0.0
 */
export function optionFromNullOr<T>(): Transformation<Option.Option<T>, T | null> {
  return transform({
    decode: Option.fromNullOr,
    encode: Option.getOrNull
  })
}

/**
 * @since 4.0.0
 */
export function optionFromOptionalKey<T>(): Transformation<Option.Option<T>, T> {
  return transformOptional({
    decode: Option.some,
    encode: Option.flatten
  })
}

/**
 * @since 4.0.0
 */
export function optionFromOptional<T>(): Transformation<Option.Option<T>, T | undefined> {
  return transformOptional<Option.Option<T>, T | undefined>({
    decode: (ot) => ot.pipe(Option.filter(Predicate.isNotUndefined), Option.some),
    encode: Option.flatten
  })
}

/**
 * @since 4.0.0
 */
export const urlFromString: Transformation<URL, string> = transformOrFail<URL, string>({
  decode: (s) =>
    Effect.try({
      try: () => new URL(s),
      catch: (e) => new Issue.InvalidValue(Option.some(s), { message: globalThis.String(e) })
    }),
  encode: (url) => Effect.succeed(url.href)
})

/**
 * @since 4.0.0
 */
export const uint8ArrayFromBase64String: Transformation<Uint8Array<ArrayBufferLike>, string> = new Transformation(
  Getter.decodeBase64(),
  Getter.encodeBase64()
)

/**
 * @since 4.0.0
 */
export const fromJsonString = new Transformation<unknown, string>(
  Getter.parseJson(),
  Getter.stringifyJson()
)

/**
 * @since 4.0.0
 */
export const fromFormData = new Transformation<unknown, FormData>(
  Getter.decodeFormData(),
  Getter.encodeFormData()
)

/**
 * @since 4.0.0
 */
export const fromURLSearchParams = new Transformation<unknown, URLSearchParams>(
  Getter.decodeURLSearchParams(),
  Getter.encodeURLSearchParams()
)
