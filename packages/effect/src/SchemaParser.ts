/**
 * Build reusable runtime parsers from Effect schemas.
 *
 * `SchemaParser` is the execution layer behind schema ASTs. It walks schema
 * structure, applies transformations, merges parse options, runs checks, and
 * reports failures as `SchemaIssue.Issue` values while exposing adapters for
 * the result shape a boundary needs.
 *
 * **Mental model**
 *
 * - A schema has a decoded `Type` side and an `Encoded` side.
 * - Decoders read `Encoded` or `unknown` input and produce `Type`.
 * - Encoders read `Type` or `unknown` input and produce `Encoded`.
 * - Maker helpers construct decoded `Type` values and apply constructor
 *   defaults before validation.
 * - The same underlying parser can be adapted to `Effect`, `Promise`, `Exit`,
 *   `Result`, `Option`, a throwing synchronous function, or a type guard.
 *
 * **Common tasks**
 *
 * - Construct decoded values: {@link make}, {@link makeEffect},
 *   {@link makeOption}
 * - Decode untrusted boundary input: {@link decodeUnknownEffect},
 *   {@link decodeUnknownSync}, {@link decodeUnknownResult}
 * - Decode already typed encoded input: {@link decodeEffect},
 *   {@link decodeSync}
 * - Encode values back to their encoded representation:
 *   {@link encodeEffect}, {@link encodeSync}, {@link encodeUnknownEffect}
 * - Check values without collecting issue details: {@link is}, {@link asserts}
 * - Build directly from an AST: {@link run}
 *
 * **Gotchas**
 *
 * - `decodeUnknown*` accepts untyped input; `decode*` variants expect the
 *   schema's `Encoded` type.
 * - `encodeUnknown*` accepts untyped input; `encode*` variants expect the
 *   schema's decoded `Type`.
 * - Synchronous adapters cannot run asynchronous parsing work. Use `Effect`
 *   adapters when transformations require services or asynchronous effects.
 * - Parse options supplied when a parser is created are merged with options
 *   supplied at call time, and schema-level parse annotations can further
 *   refine behavior.
 *
 * @since 4.0.0
 */
import * as Arr from "./Array.ts"
import * as Cause from "./Cause.ts"
import * as Effect from "./Effect.ts"
import * as Exit from "./Exit.ts"
import { identity, memoize } from "./Function.ts"
import * as InternalAnnotations from "./internal/schema/annotations.ts"
import * as Option from "./Option.ts"
import * as Predicate from "./Predicate.ts"
import * as Result from "./Result.ts"
import type * as Schema from "./Schema.ts"
import * as SchemaAST from "./SchemaAST.ts"
import * as SchemaIssue from "./SchemaIssue.ts"

const recurDefaults = memoize((ast: SchemaAST.AST): SchemaAST.AST => {
  switch (ast._tag) {
    case "Declaration": {
      const getLink = ast.annotations?.[SchemaAST.ClassTypeId]
      if (Predicate.isFunction(getLink)) {
        const link = getLink(ast.typeParameters)
        const to = recurDefaults(link.to)
        return SchemaAST.replaceEncoding(ast, to === link.to ? [link] : [new SchemaAST.Link(to, link.transformation)])
      }
      return ast
    }
    case "Objects":
    case "Arrays":
      return ast.recur((ast) => {
        const defaultValue = ast.context?.defaultValue
        if (defaultValue) {
          return SchemaAST.replaceEncoding(recurDefaults(ast), defaultValue)
        }
        return recurDefaults(ast)
      })
    case "Suspend":
      return ast.recur(recurDefaults)
    default:
      return ast
  }
})

/**
 * Creates an effectful maker for the schema's decoded type side.
 *
 * **When to use**
 *
 * Use to construct decoded schema values in `Effect` while preserving
 * construction failures as `SchemaIssue.Issue` values in the error channel.
 *
 * **Details**
 *
 * The returned function accepts constructor input, applies constructor defaults,
 * runs type-side validation unless checks are disabled, and fails with a
 * `SchemaIssue.Issue` when construction fails.
 *
 * @category constructors
 * @since 4.0.0
 */
export function makeEffect<S extends Schema.Top>(schema: S) {
  const ast = recurDefaults(SchemaAST.toType(schema.ast))
  const parser = run<S["Type"], never>(ast)
  return (input: S["~type.make.in"], options?: Schema.MakeOptions): Effect.Effect<S["Type"], SchemaIssue.Issue> => {
    return parser(
      input,
      options?.disableChecks
        ? options?.parseOptions ? { ...options.parseOptions, disableChecks: true } : { disableChecks: true }
        : options?.parseOptions
    )
  }
}

/**
 * Creates a synchronous maker that returns `Option.some` with the constructed
 * value on success, or `Option.none` when construction fails.
 *
 * **When to use**
 *
 * Use when you need to validate schema constructor input and only care whether
 * construction succeeds, without exposing `SchemaIssue.Issue` details.
 *
 * @category constructors
 * @since 4.0.0
 */
export function makeOption<S extends Schema.Top>(schema: S) {
  const parser = makeEffect(schema)
  return (input: S["~type.make.in"], options?: Schema.MakeOptions): Option.Option<S["Type"]> => {
    return Exit.getSuccess(Effect.runSyncExit(parser(input, options) as any))
  }
}

/**
 * Creates a synchronous maker for the schema's decoded type side.
 *
 * **When to use**
 *
 * Use to construct decoded schema values synchronously when invalid input
 * should throw an `Error` whose cause is `SchemaIssue.Issue`.
 *
 * **Details**
 *
 * The returned function constructs a value from constructor input and throws an
 * `Error` with the `SchemaIssue.Issue` in its `cause` when construction fails.
 *
 * @category constructors
 * @since 4.0.0
 */
export function make<S extends Schema.Top>(schema: S) {
  const parser = makeEffect(schema)
  return (input: S["~type.make.in"], options?: Schema.MakeOptions): S["Type"] => {
    return Effect.runSync(
      Effect.mapErrorEager(
        parser(input, options),
        (issue) => new Error(issue.toString(), { cause: issue })
      )
    )
  }
}

/**
 * Creates a type guard that checks whether an input satisfies the schema's decoded
 * type side.
 *
 * **When to use**
 *
 * Use to build a type guard for checking the decoded side of a schema without
 * exposing issue details.
 *
 * **Details**
 *
 * The guard returns `true` on successful validation and `false` on failure, without
 * exposing issue details.
 *
 * @category Asserting
 * @since 3.10.0
 */
export function is<T>(schema: Schema.Schema<T>): <I>(input: I) => input is I & T {
  return _is<T>(schema.ast)
}

/** @internal */
export function _is<T>(ast: SchemaAST.AST) {
  const parser = asExit(run<T, never>(SchemaAST.toType(ast)))
  return <I>(input: I): input is I & T => {
    return Exit.isSuccess(parser(input, SchemaAST.defaultParseOptions))
  }
}

/** @internal */
export function _issue<T>(ast: SchemaAST.AST) {
  const parser = run<T, never>(ast)
  return (input: unknown, options: SchemaAST.ParseOptions): SchemaIssue.Issue | undefined => {
    return Effect.runSync(Effect.matchEager(parser(input, options), {
      onSuccess: () => undefined,
      onFailure: identity
    }))
  }
}

/**
 * Asserts that an input satisfies the schema's decoded type side.
 *
 * **When to use**
 *
 * Use to assert that an input satisfies the decoded side of a schema, throwing
 * an `Error` whose cause is `SchemaIssue.Issue` when validation fails.
 *
 * **Details**
 *
 * The assertion returns normally when validation succeeds and throws when the
 * input does not satisfy the schema.
 *
 * @category Asserting
 * @since 4.0.0
 */
export function asserts<S extends Schema.Top, I>(schema: S, input: I): asserts input is I & S["Type"] {
  const parser = asExit(run<S["Type"], never>(SchemaAST.toType(schema.ast)))
  const exit = parser(input, SchemaAST.defaultParseOptions)
  if (Exit.isFailure(exit)) {
    const issue = Cause.findError(exit.cause)
    if (Result.isFailure(issue)) {
      throw Cause.squash(issue.failure)
    }
    throw new Error(issue.success.toString(), { cause: issue.success })
  }
}

/**
 * Creates an effectful decoder for `unknown` input.
 *
 * **When to use**
 *
 * Use when you need to decode untyped boundary input in an `Effect` whose
 * failure channel is `SchemaIssue.Issue`, while preserving transformations
 * and service requirements.
 *
 * **Details**
 *
 * The returned function succeeds with the schema's decoded `Type` or fails with a
 * `SchemaIssue.Issue`. Decoding service requirements are preserved in the returned
 * `Effect`. Parse options may be provided when creating the decoder and overridden
 * when applying it.
 *
 * @see {@link decodeEffect} for input already typed as the schema's `Encoded` type
 *
 * @category decoding
 * @since 4.0.0
 */
export function decodeUnknownEffect<S extends Schema.Top>(
  schema: S,
  options?: SchemaAST.ParseOptions
): (
  input: unknown,
  options?: SchemaAST.ParseOptions
) => Effect.Effect<S["Type"], SchemaIssue.Issue, S["DecodingServices"]> {
  const parser = run<S["Type"], S["DecodingServices"]>(schema.ast)
  return options === undefined
    ? parser
    : (input, overrideOptions) => parser(input, mergeParseOptions(options, overrideOptions))
}

/**
 * Creates an effectful decoder for input already typed as the schema's `Encoded`
 * type.
 *
 * **When to use**
 *
 * Use when you already have input typed as the schema's `Encoded` type and
 * need an `Effect` whose failure channel is `SchemaIssue.Issue`, while
 * preserving decoding service requirements.
 *
 * **Details**
 *
 * The returned function succeeds with the decoded `Type` or fails with a
 * `SchemaIssue.Issue`, preserving any decoding service requirements in the
 * returned `Effect`.
 *
 * @see {@link decodeUnknownEffect} for untyped boundary input
 * @see {@link encodeEffect} for the opposite direction
 *
 * @category decoding
 * @since 4.0.0
 */
export const decodeEffect: <S extends Schema.Top>(
  schema: S,
  options?: SchemaAST.ParseOptions
) => (
  input: S["Encoded"],
  options?: SchemaAST.ParseOptions
) => Effect.Effect<S["Type"], SchemaIssue.Issue, S["DecodingServices"]> = decodeUnknownEffect

/**
 * Creates a Promise-based decoder for `unknown` input.
 *
 * **When to use**
 *
 * Use when you need to decode untyped input with a service-free schema and
 * return a JavaScript `Promise` that rejects with `SchemaIssue.Issue`.
 *
 * **Details**
 *
 * The returned function resolves with the decoded `Type` on success and rejects
 * with a `SchemaIssue.Issue` on decoding failure.
 *
 * @see {@link decodePromise} for input already typed as the schema's `Encoded` type
 * @see {@link decodeUnknownEffect} for schemas that require decoding services or when failures should remain in `Effect`
 *
 * @category decoding
 * @since 3.10.0
 */
export function decodeUnknownPromise<S extends Schema.Decoder<unknown>>(
  schema: S,
  options?: SchemaAST.ParseOptions
): (input: unknown, options?: SchemaAST.ParseOptions) => Promise<S["Type"]> {
  return asPromise(decodeUnknownEffect(schema, options))
}

/**
 * Creates a Promise-based decoder for input already typed as the schema's
 * `Encoded` type.
 *
 * **When to use**
 *
 * Use when you already have input typed as the schema's `Encoded` type and need
 * decoding to return a JavaScript `Promise` that rejects with `SchemaIssue.Issue`.
 *
 * **Details**
 *
 * The returned function resolves with the decoded `Type` on success and rejects
 * with a `SchemaIssue.Issue` on decoding failure.
 *
 * @see {@link decodeUnknownPromise} for untyped input returning a JavaScript `Promise`
 * @see {@link decodeEffect} for preserving decoding services and failures in `Effect`
 *
 * @category decoding
 * @since 3.10.0
 */
export function decodePromise<S extends Schema.Decoder<unknown>>(
  schema: S,
  options?: SchemaAST.ParseOptions
): (input: S["Encoded"], options?: SchemaAST.ParseOptions) => Promise<S["Type"]> {
  return asPromise(decodeEffect(schema, options))
}

/**
 * Creates a synchronous decoder for `unknown` input that reports failure safely
 * as an `Exit`.
 *
 * **When to use**
 *
 * Use when you need to decode unknown input synchronously into an `Exit` whose
 * failure contains `SchemaIssue.Issue`.
 *
 * **Details**
 *
 * The returned function produces `Exit.Success` with the decoded `Type`.
 * Schema issues are represented by an `Exit.Failure` cause containing a
 * `SchemaIssue.Issue`.
 *
 * **Gotchas**
 *
 * Because this adapter runs synchronously, async decoding work can produce an
 * `Exit.Failure` with a defect cause.
 *
 * @see {@link decodeExit} for input already typed as the schema's `Encoded` type
 * @see {@link decodeUnknownEffect} for preserving decoding services and failures in `Effect`
 * @see {@link decodeUnknownResult} for returning schema issues as data
 * @see {@link decodeUnknownSync} for throwing on decoding failure
 *
 * @category decoding
 * @since 4.0.0
 */
export function decodeUnknownExit<S extends Schema.Decoder<unknown>>(
  schema: S,
  options?: SchemaAST.ParseOptions
): (input: unknown, options?: SchemaAST.ParseOptions) => Exit.Exit<S["Type"], SchemaIssue.Issue> {
  return asExit(decodeUnknownEffect(schema, options))
}

/**
 * Creates a synchronous decoder for input already typed as the schema's `Encoded`
 * type, reporting failure safely as an `Exit`.
 *
 * **When to use**
 *
 * Use when you need synchronous decoding of already typed `Encoded` input into
 * an `Exit` whose failure contains `SchemaIssue.Issue`.
 *
 * **Details**
 *
 * The returned function produces `Exit.Success` with the decoded `Type` or
 * `Exit.Failure` with a `SchemaIssue.Issue`.
 *
 * @see {@link decodeUnknownExit} for untyped input with the same `Exit` result shape
 * @see {@link decodeEffect} for preserving decoding services and failures in `Effect`
 *
 * @category decoding
 * @since 4.0.0
 */
export const decodeExit: <S extends Schema.Decoder<unknown>>(
  schema: S,
  options?: SchemaAST.ParseOptions
) => (input: S["Encoded"], options?: SchemaAST.ParseOptions) => Exit.Exit<S["Type"], SchemaIssue.Issue> =
  decodeUnknownExit

/** @internal */
export function decodeUnknownOption<S extends Schema.Decoder<unknown>>(
  schema: S,
  options?: SchemaAST.ParseOptions
): (input: unknown, options?: SchemaAST.ParseOptions) => Option.Option<S["Type"]> {
  return asOption(decodeUnknownEffect(schema, options))
}

/** @internal */
export const decodeOption: <S extends Schema.Decoder<unknown>>(
  schema: S,
  options?: SchemaAST.ParseOptions
) => (input: S["Encoded"], options?: SchemaAST.ParseOptions) => Option.Option<S["Type"]> = decodeUnknownOption

/**
 * Creates a decoder for `unknown` input that reports failure safely as a
 * `Result`.
 *
 * **When to use**
 *
 * Use when decoding untyped boundary input and you want `SchemaIssue.Issue`
 * failures returned as data in a `Result`.
 *
 * **Details**
 *
 * The returned function produces `Result.succeed` with the decoded `Type` on
 * success or `Result.fail` with a `SchemaIssue.Issue` on decoding failure.
 *
 * **Gotchas**
 *
 * This adapter runs synchronously. Schema issues become `Result.fail`, but async
 * decoding or defects can still throw.
 *
 * @see {@link decodeResult} for input already typed as the schema's `Encoded` type
 * @see {@link decodeUnknownEffect} for effectful or service-requiring decoding
 *
 * @category decoding
 * @since 4.0.0
 */
export function decodeUnknownResult<S extends Schema.Decoder<unknown>>(
  schema: S,
  options?: SchemaAST.ParseOptions
): (input: unknown, options?: SchemaAST.ParseOptions) => Result.Result<S["Type"], SchemaIssue.Issue> {
  return asResult(decodeUnknownEffect(schema, options))
}

/**
 * Creates a decoder for input already typed as the schema's `Encoded` type,
 * reporting failure safely as a `Result`.
 *
 * **When to use**
 *
 * Use when you already have input typed as the schema's `Encoded` type and want
 * schema decoding failures represented as `Result.fail` with `SchemaIssue.Issue`.
 *
 * **Details**
 *
 * The returned function produces `Result.succeed` with the decoded `Type` on
 * success or `Result.fail` with a `SchemaIssue.Issue` on decoding failure.
 *
 * **Gotchas**
 *
 * This synchronous adapter returns `Result.fail` for schema issues, but async
 * decoding or other non-schema failures can still throw.
 *
 * @see {@link decodeUnknownResult} for untyped input with the same `Result` shape
 * @see {@link decodeEffect} for effectful or service-requiring decoding
 *
 * @category decoding
 * @since 4.0.0
 */
export const decodeResult: <S extends Schema.Decoder<unknown>>(
  schema: S,
  options?: SchemaAST.ParseOptions
) => (input: S["Encoded"], options?: SchemaAST.ParseOptions) => Result.Result<S["Type"], SchemaIssue.Issue> =
  decodeUnknownResult

/**
 * Creates a synchronous decoder for `unknown` input.
 *
 * **When to use**
 *
 * Use to decode untrusted or dynamically typed input at a synchronous boundary
 * where invalid data should throw an `Error` whose cause is `SchemaIssue.Issue`.
 *
 * **Details**
 *
 * The returned function returns the decoded `Type` on success and throws an
 * `Error` with the `SchemaIssue.Issue` in its `cause` on decoding failure.
 *
 * @see {@link decodeSync} for input already typed as the schema's `Encoded` type
 * @see {@link decodeUnknownEffect} for preserving decoding failures in `Effect`
 * @see {@link decodeUnknownResult} for returning schema issues as data
 *
 * @category decoding
 * @since 3.10.0
 */
export function decodeUnknownSync<S extends Schema.Decoder<unknown>>(
  schema: S,
  options?: SchemaAST.ParseOptions
): (input: unknown, options?: SchemaAST.ParseOptions) => S["Type"] {
  return asSync(decodeUnknownEffect(schema, options))
}

/**
 * Creates a synchronous decoder for input already typed as the schema's `Encoded`
 * type.
 *
 * **When to use**
 *
 * Use to decode values already typed as the schema's `Encoded` input when
 * decoding failure should throw an `Error` whose cause is `SchemaIssue.Issue`.
 *
 * **Details**
 *
 * The returned function returns the decoded `Type` on success and throws an
 * `Error` with the `SchemaIssue.Issue` in its `cause` on decoding failure.
 *
 * @see {@link decodeUnknownSync} for untrusted or dynamically typed input
 * @see {@link decodeResult} for returning schema issues as data
 * @see {@link decodeEffect} for preserving decoding failures in `Effect`
 *
 * @category decoding
 * @since 3.10.0
 */
export const decodeSync: <S extends Schema.Decoder<unknown>>(
  schema: S,
  options?: SchemaAST.ParseOptions
) => (input: S["Encoded"], options?: SchemaAST.ParseOptions) => S["Type"] = decodeUnknownSync

/**
 * Creates an effectful encoder for `unknown` input.
 *
 * **When to use**
 *
 * Use when you need to encode untyped boundary input in an `Effect` whose
 * failure channel is `SchemaIssue.Issue`, while preserving service
 * requirements.
 *
 * **Details**
 *
 * The returned function succeeds with the schema's `Encoded` value or fails with a
 * `SchemaIssue.Issue`. Encoding service requirements are preserved in the returned
 * `Effect`. Parse options may be provided when creating the encoder and overridden
 * when applying it.
 *
 * @see {@link encodeEffect} for the typed-input variant when the value is already typed as the schema's decoded `Type`
 *
 * @category encoding
 * @since 4.0.0
 */
export function encodeUnknownEffect<S extends Schema.Top>(
  schema: S,
  options?: SchemaAST.ParseOptions
): (
  input: unknown,
  options?: SchemaAST.ParseOptions
) => Effect.Effect<S["Encoded"], SchemaIssue.Issue, S["EncodingServices"]> {
  const parser = run<S["Encoded"], S["EncodingServices"]>(SchemaAST.flip(schema.ast))
  return options === undefined
    ? parser
    : (input, overrideOptions) => parser(input, mergeParseOptions(options, overrideOptions))
}

/**
 * Creates an effectful encoder for input already typed as the schema's decoded
 * `Type`.
 *
 * **When to use**
 *
 * Use when you need to encode values already typed as the schema's decoded
 * `Type` in an `Effect` whose failure channel is `SchemaIssue.Issue`, while
 * preserving service requirements.
 *
 * **Details**
 *
 * The returned function succeeds with the schema's `Encoded` value or fails with a
 * `SchemaIssue.Issue`, preserving any encoding service requirements in the
 * returned `Effect`.
 *
 * @see {@link encodeUnknownEffect} for encoding unknown input before the value is statically typed as the schema's `Type`
 *
 * @category encoding
 * @since 4.0.0
 */
export const encodeEffect: <S extends Schema.Top>(
  schema: S,
  options?: SchemaAST.ParseOptions
) => (
  input: S["Type"],
  options?: SchemaAST.ParseOptions
) => Effect.Effect<S["Encoded"], SchemaIssue.Issue, S["EncodingServices"]> = encodeUnknownEffect

/**
 * Creates a Promise-based encoder for `unknown` input.
 *
 * **When to use**
 *
 * Use when you need to encode untrusted or dynamically typed values with a
 * service-free schema and return a JavaScript `Promise` that rejects with
 * `SchemaIssue.Issue`.
 *
 * **Details**
 *
 * The returned function resolves with the schema's `Encoded` value on success and
 * rejects with a `SchemaIssue.Issue` on encoding failure.
 *
 * @see {@link encodePromise} for input already typed as the schema's decoded `Type`
 * @see {@link encodeUnknownEffect} for schemas that require encoding services or when failures should remain in `Effect`
 *
 * @category encoding
 * @since 3.10.0
 */
export const encodeUnknownPromise = <S extends Schema.Encoder<unknown>>(
  schema: S,
  options?: SchemaAST.ParseOptions
): (input: unknown, options?: SchemaAST.ParseOptions) => Promise<S["Encoded"]> =>
  asPromise(encodeUnknownEffect(schema, options))

/**
 * Creates a Promise-based encoder for input already typed as the schema's decoded
 * `Type`.
 *
 * **When to use**
 *
 * Use when you already have values typed as the schema's decoded `Type` and
 * need encoding to return a JavaScript `Promise` that rejects with
 * `SchemaIssue.Issue`.
 *
 * **Details**
 *
 * The returned function resolves with the schema's `Encoded` value on success and
 * rejects with a `SchemaIssue.Issue` on encoding failure.
 *
 * @see {@link encodeUnknownPromise} for encoding untyped input
 * @see {@link encodeEffect} for effectful encoding or schemas with encoding service requirements
 *
 * @category encoding
 * @since 3.10.0
 */
export const encodePromise: <S extends Schema.Encoder<unknown>>(
  schema: S,
  options?: SchemaAST.ParseOptions
) => (input: S["Type"], options?: SchemaAST.ParseOptions) => Promise<S["Encoded"]> = encodeUnknownPromise

/**
 * Creates a synchronous encoder for `unknown` input that reports failure safely
 * as an `Exit`.
 *
 * **When to use**
 *
 * Use when you need synchronous encoding of unknown input into an `Exit` whose
 * failure contains `SchemaIssue.Issue`.
 *
 * **Details**
 *
 * The returned function produces `Exit.Success` with the schema's `Encoded` value
 * or `Exit.Failure` with a `SchemaIssue.Issue`.
 *
 * @see {@link encodeExit} for input already typed as the schema's decoded `Type`
 * @see {@link encodeUnknownEffect} for effectful encoding that preserves service requirements
 *
 * @category encoding
 * @since 4.0.0
 */
export function encodeUnknownExit<S extends Schema.Encoder<unknown>>(
  schema: S,
  options?: SchemaAST.ParseOptions
): (input: unknown, options?: SchemaAST.ParseOptions) => Exit.Exit<S["Encoded"], SchemaIssue.Issue> {
  return asExit(encodeUnknownEffect(schema, options))
}

/**
 * Creates a synchronous encoder for input already typed as the schema's decoded
 * `Type`, reporting failure safely as an `Exit`.
 *
 * **When to use**
 *
 * Use when you need synchronous encoding of already typed schema values into
 * an `Exit` whose failure contains `SchemaIssue.Issue`.
 *
 * **Details**
 *
 * The returned function produces `Exit.Success` with the schema's `Encoded` value
 * or `Exit.Failure` with a `SchemaIssue.Issue`.
 *
 * @see {@link encodeUnknownExit} for unknown input with the same `Exit` result shape
 * @see {@link encodeEffect} for effectful encoding that preserves service requirements
 *
 * @category encoding
 * @since 4.0.0
 */
export const encodeExit: <S extends Schema.Encoder<unknown>>(
  schema: S,
  options?: SchemaAST.ParseOptions
) => (input: S["Type"], options?: SchemaAST.ParseOptions) => Exit.Exit<S["Encoded"], SchemaIssue.Issue> =
  encodeUnknownExit

/** @internal */
export function encodeUnknownOption<S extends Schema.Encoder<unknown>>(
  schema: S,
  options?: SchemaAST.ParseOptions
): (input: unknown, options?: SchemaAST.ParseOptions) => Option.Option<S["Encoded"]> {
  return asOption(encodeUnknownEffect(schema, options))
}

/** @internal */
export const encodeOption: <S extends Schema.Encoder<unknown>>(
  schema: S,
  options?: SchemaAST.ParseOptions
) => (input: S["Type"], options?: SchemaAST.ParseOptions) => Option.Option<S["Encoded"]> = encodeUnknownOption

/**
 * Creates an encoder for `unknown` input that reports failure safely as a
 * `Result`.
 *
 * **When to use**
 *
 * Use when encoding values from an unknown or dynamically typed boundary
 * synchronously, and you want `SchemaIssue.Issue` failures returned as `Result`
 * data.
 *
 * **Details**
 *
 * The returned function produces `Result.succeed` with the schema's `Encoded`
 * value on success or `Result.fail` with a `SchemaIssue.Issue` on encoding
 * failure.
 *
 * @see {@link encodeResult} for input already typed as the schema's decoded `Type`
 * @see {@link encodeUnknownEffect} for effectful encoding, including schemas with encoding service requirements
 *
 * @category encoding
 * @since 4.0.0
 */
export function encodeUnknownResult<S extends Schema.Encoder<unknown>>(
  schema: S,
  options?: SchemaAST.ParseOptions
): (input: unknown, options?: SchemaAST.ParseOptions) => Result.Result<S["Encoded"], SchemaIssue.Issue> {
  return asResult(encodeUnknownEffect(schema, options))
}

/**
 * Creates an encoder for input already typed as the schema's decoded `Type`,
 * reporting failure safely as a `Result`.
 *
 * **When to use**
 *
 * Use when you already have input typed as the schema's decoded `Type` and want
 * encoding failures returned as `Result.fail` with `SchemaIssue.Issue`.
 *
 * **Details**
 *
 * The returned function produces `Result.succeed` with the schema's `Encoded`
 * value on success or `Result.fail` with a `SchemaIssue.Issue` on encoding
 * failure.
 *
 * @see {@link encodeUnknownResult} for the same `Result` shape when the input is not already typed
 *
 * @category encoding
 * @since 4.0.0
 */
export const encodeResult: <S extends Schema.Encoder<unknown>>(
  schema: S,
  options?: SchemaAST.ParseOptions
) => (input: S["Type"], options?: SchemaAST.ParseOptions) => Result.Result<S["Encoded"], SchemaIssue.Issue> =
  encodeUnknownResult

/**
 * Creates a synchronous encoder for `unknown` input.
 *
 * **When to use**
 *
 * Use when you need to encode values from untyped input in synchronous code and
 * want encoding failures to throw an `Error` whose cause is `SchemaIssue.Issue`.
 *
 * **Details**
 *
 * The returned function returns the schema's `Encoded` value on success and throws
 * an `Error` with the `SchemaIssue.Issue` in its `cause` on encoding failure.
 *
 * @see {@link encodeSync} for input already typed as the schema's decoded `Type`
 * @see {@link encodeUnknownEffect} for effectful encoding that preserves service requirements
 *
 * @category encoding
 * @since 3.10.0
 */
export function encodeUnknownSync<S extends Schema.Encoder<unknown>>(
  schema: S,
  options?: SchemaAST.ParseOptions
): (input: unknown, options?: SchemaAST.ParseOptions) => S["Encoded"] {
  return asSync(encodeUnknownEffect(schema, options))
}

/**
 * Creates a synchronous encoder for input already typed as the schema's decoded
 * `Type`.
 *
 * **When to use**
 *
 * Use to encode already typed schema values synchronously when encoding failure
 * should throw an `Error` whose cause is `SchemaIssue.Issue`.
 *
 * **Details**
 *
 * The returned function returns the schema's `Encoded` value on success and throws
 * an `Error` with the `SchemaIssue.Issue` in its `cause` on encoding failure.
 *
 * @see {@link encodeUnknownSync} for unknown input with the same throwing boundary
 * @see {@link encodeResult} for returning schema issues as data
 * @see {@link encodeEffect} for effectful encoding that preserves service requirements
 *
 * @category encoding
 * @since 3.10.0
 */
export const encodeSync: <S extends Schema.Encoder<unknown>>(
  schema: S,
  options?: SchemaAST.ParseOptions
) => (input: S["Type"], options?: SchemaAST.ParseOptions) => S["Encoded"] = encodeUnknownSync

const mergeParseOptions = (
  options: SchemaAST.ParseOptions,
  overrideOptions: SchemaAST.ParseOptions | undefined
): SchemaAST.ParseOptions => overrideOptions === undefined ? options : { ...options, ...overrideOptions }

/** @internal */
export function run<T, R>(ast: SchemaAST.AST) {
  const parser = recur(ast)
  return (input: unknown, options?: SchemaAST.ParseOptions): Effect.Effect<T, SchemaIssue.Issue, R> =>
    Effect.flatMapEager(parser(Option.some(input), options ?? SchemaAST.defaultParseOptions), (oa) => {
      if (oa._tag === "None") {
        return Effect.fail(new SchemaIssue.InvalidValue(oa))
      }
      return Effect.succeed(oa.value as T)
    })
}

function asPromise<T, E>(
  parser: (input: E, options?: SchemaAST.ParseOptions) => Effect.Effect<T, SchemaIssue.Issue>
): (input: E, options?: SchemaAST.ParseOptions) => Promise<T> {
  return (input: E, options?: SchemaAST.ParseOptions) => Effect.runPromise(parser(input, options))
}

function asExit<T, E, R>(
  parser: (input: E, options?: SchemaAST.ParseOptions) => Effect.Effect<T, SchemaIssue.Issue, R>
): (input: E, options?: SchemaAST.ParseOptions) => Exit.Exit<T, SchemaIssue.Issue> {
  return (input: E, options?: SchemaAST.ParseOptions) => Effect.runSyncExit(parser(input, options) as any)
}

/** @internal */
export function asOption<T, E, R>(
  parser: (input: E, options?: SchemaAST.ParseOptions) => Effect.Effect<T, SchemaIssue.Issue, R>
): (input: E, options?: SchemaAST.ParseOptions) => Option.Option<T> {
  const parserExit = asExit(parser)
  return (input: E, options?: SchemaAST.ParseOptions) => Exit.getSuccess(parserExit(input, options))
}

function asResult<T, E, R>(
  parser: (input: E, options?: SchemaAST.ParseOptions) => Effect.Effect<T, SchemaIssue.Issue, R>
): (input: E, options?: SchemaAST.ParseOptions) => Result.Result<T, SchemaIssue.Issue> {
  const parserExit = asExit(parser)
  return (input: E, options?: SchemaAST.ParseOptions) => {
    const exit = parserExit(input, options)
    if (Exit.isSuccess(exit)) {
      return Result.succeed(exit.value)
    }
    const error = Cause.findError(exit.cause)
    if (Result.isFailure(error)) {
      throw Cause.squash(error.failure)
    }
    return Result.fail(error.success)
  }
}

function asSync<T, E, R>(
  parser: (input: E, options?: SchemaAST.ParseOptions) => Effect.Effect<T, SchemaIssue.Issue, R>
): (input: E, options?: SchemaAST.ParseOptions) => T {
  return (input: E, options?: SchemaAST.ParseOptions) =>
    Effect.runSync(
      Effect.mapErrorEager(
        parser(input, options),
        (issue) => new Error(issue.toString(), { cause: issue })
      ) as any
    )
}

/** @internal */
export interface Parser {
  (
    input: Option.Option<unknown>,
    options: SchemaAST.ParseOptions
  ): Effect.Effect<Option.Option<unknown>, SchemaIssue.Issue, any>
}

const recur = memoize(
  (ast: SchemaAST.AST): Parser => {
    let parser: Parser
    const astOptions = InternalAnnotations.resolve(ast)?.["parseOptions"]
    if (!ast.context && !ast.encoding && !ast.checks) {
      return (ou, options) => {
        parser ??= ast.getParser(recur)
        if (astOptions) {
          options = { ...options, ...astOptions }
        }
        return parser(ou, options)
      }
    }
    const isStructural = SchemaAST.isArrays(ast) || SchemaAST.isObjects(ast) ||
      (SchemaAST.isDeclaration(ast) && ast.typeParameters.length > 0)
    return (ou, options) => {
      if (astOptions) {
        options = { ...options, ...astOptions }
      }
      const encoding = ast.encoding
      let srou: Effect.Effect<Option.Option<unknown>, SchemaIssue.Issue, unknown> | undefined
      if (encoding) {
        const links = encoding
        const len = links.length
        for (let i = len - 1; i >= 0; i--) {
          const link = links[i]
          const to = link.to
          const parser = recur(to)
          srou = srou ? Effect.flatMapEager(srou, (ou) => parser(ou, options)) : parser(ou, options)
          if (link.transformation._tag === "Transformation") {
            const getter = link.transformation.decode
            srou = Effect.flatMapEager(srou, (ou) => getter.run(ou, options))
          } else {
            srou = link.transformation.decode(srou, options)
          }
        }
        srou = Effect.mapErrorEager(srou!, (issue) => new SchemaIssue.Encoding(ast, ou, issue))
      }

      parser ??= ast.getParser(recur)
      let sroa = srou ? Effect.flatMapEager(srou, (ou) => parser(ou, options)) : parser(ou, options)

      if (ast.checks && !options?.disableChecks) {
        const checks = ast.checks
        if (options?.errors === "all" && isStructural && Option.isSome(ou)) {
          sroa = Effect.catchEager(sroa, (issue) => {
            const issues: Array<SchemaIssue.Issue> = []
            SchemaAST.collectIssues(
              checks.filter((check) => check.annotations?.[SchemaAST.STRUCTURAL_ANNOTATION_KEY]),
              ou.value,
              issues,
              ast,
              options
            )
            const out: SchemaIssue.Issue = Arr.isArrayNonEmpty(issues)
              ? issue._tag === "Composite" && issue.ast === ast
                ? new SchemaIssue.Composite(ast, issue.actual, [...issue.issues, ...issues])
                : new SchemaIssue.Composite(ast, ou, [issue, ...issues])
              : issue
            return Effect.fail(out)
          })
        }
        sroa = Effect.flatMapEager(sroa, (oa) => {
          if (Option.isSome(oa)) {
            const value = oa.value
            const issues: Array<SchemaIssue.Issue> = []

            SchemaAST.collectIssues(checks, value, issues, ast, options)

            if (Arr.isArrayNonEmpty(issues)) {
              return Effect.fail(new SchemaIssue.Composite(ast, oa, issues))
            }
          }
          return Effect.succeed(oa)
        })
      }

      return sroa
    }
  }
)
