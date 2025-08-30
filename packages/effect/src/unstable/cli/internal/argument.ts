/**
 * Thin facade around `Param` that only exposes *positional argument* constructors & combinators.
 * We publish this under the name **Argument** to provide a clear API for positional arguments.
 * Everything here is guaranteed to be of kind `"argument"`.
 *
 * @since 4.0.0
 */

import * as Option from "../../../data/Option.ts"
import type * as Redacted from "../../../data/Redacted.ts"
import type * as Effect from "../../../Effect.ts"
import { dual } from "../../../Function.ts"
import type * as FileSystem from "../../../platform/FileSystem.ts"
import type * as Path from "../../../platform/Path.ts"
import type * as Schema from "../../../schema/Schema.ts"
import type * as CliError from "../CliError.ts"
import type { Environment } from "../Command.ts"
import * as Param from "./param.ts"

/* -------------------------------------------------------------------------------------------------
 * branding
 * -------------------------------------------------------------------------------------------------*/

const ArgumentBrand: unique symbol = Symbol("@effect/cli/ArgumentBrand")

/**
 * Branded args type. It behaves exactly like `Param.Param<A, "argument">` but carries
 * an extra field keyed by a private symbol so that external code cannot construct it directly.
 *
 * @since 4.0.0
 * @category models
 */
export interface Argument<A> extends Param.Param<A, "argument"> {
  readonly [ArgumentBrand]: { _A: (_: never) => A }
}

/* -------------------------------------------------------------------------------------------------
 * internal helper
 * -------------------------------------------------------------------------------------------------*/

function asArgument<A>(param: Param.Param<A, "argument">): Argument<A> {
  // Attach the unique brand without altering runtime behaviour.
  return param as Argument<A>
}

/* -------------------------------------------------------------------------------------------------
 * constructors
 * -------------------------------------------------------------------------------------------------*/

/**
 * Creates a positional string argument.
 *
 * @example
 * ```ts
 * import * as Argument from "@effect/cli/Argument"
 *
 * const filename = Argument.string("filename")
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const string = (name: string): Argument<string> => asArgument(Param.string(name, "argument"))

/**
 * Creates a positional integer argument.
 *
 * @example
 * ```ts
 * import * as Argument from "@effect/cli/Argument"
 *
 * const count = Argument.integer("count")
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const integer = (name: string): Argument<number> => asArgument(Param.integer(name, "argument"))

/**
 * Creates a positional file path argument.
 *
 * @example
 * ```ts
 * import * as Argument from "@effect/cli/Argument"
 *
 * const inputFile = Argument.file("input", { mustExist: true }) // Must exist
 * const outputFile = Argument.file("output", { mustExist: false }) // Must not exist
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const file = (name: string, options?: { mustExist?: boolean }): Argument<string> =>
  asArgument(Param.file(name, "argument", options))

/**
 * Creates a positional directory path argument.
 *
 * @example
 * ```ts
 * import * as Argument from "@effect/cli/Argument"
 *
 * const workspace = Argument.directory("workspace", { mustExist: true }) // Must exist
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const directory = (name: string, options?: { mustExist?: boolean }): Argument<string> =>
  asArgument(Param.directory(name, "argument", options))

/**
 * Creates a positional float argument.
 *
 * @example
 * ```ts
 * import * as Argument from "@effect/cli/Argument"
 *
 * const ratio = Argument.float("ratio")
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const float = (name: string): Argument<number> => asArgument(Param.float(name, "argument"))

/**
 * Creates a positional date argument.
 *
 * @example
 * ```ts
 * import * as Argument from "@effect/cli/Argument"
 *
 * const startDate = Argument.date("start-date")
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const date = (name: string): Argument<Date> => asArgument(Param.date(name, "argument"))

/**
 * Creates a positional choice argument.
 *
 * @example
 * ```ts
 * import * as Argument from "@effect/cli/Argument"
 *
 * const environment = Argument.choice("environment", ["dev", "staging", "prod"])
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const choice = <const A extends ReadonlyArray<string>>(
  name: string,
  choices: A
): Argument<A[number]> => asArgument(Param.choice(name, choices, "argument"))

/**
 * Creates a positional path argument.
 *
 * @example
 * ```ts
 * import * as Argument from "@effect/cli/Argument"
 *
 * const configPath = Argument.path("config")
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const path = (name: string, options?: {
  pathType?: "file" | "directory" | "either"
  mustExist?: boolean
}): Argument<string> => asArgument(Param.path(name, "argument", options))

/**
 * Creates a positional redacted argument that obscures its value.
 *
 * @example
 * ```ts
 * import * as Argument from "@effect/cli/Argument"
 *
 * const secret = Argument.redacted("secret")
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const redacted = (name: string): Argument<Redacted.Redacted<string>> =>
  asArgument(Param.redacted(name, "argument"))

/**
 * Creates a positional argument that reads file content.
 *
 * @example
 * ```ts
 * import * as Argument from "@effect/cli/Argument"
 *
 * const config = Argument.fileContent("config-file")
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const fileContent = (name: string): Argument<string> => asArgument(Param.fileContent(name, "argument"))

/**
 * Creates a positional argument that reads file content (alias for fileContent).
 *
 * @since 4.0.0
 * @category constructors
 */
export const fileText = (name: string): Argument<string> => asArgument(Param.fileText(name, "argument"))

/**
 * Creates a positional argument that reads and parses file content using a schema.
 *
 * @example
 * ```ts
 * import * as Argument from "@effect/cli/Argument"
 * import { Schema } from "effect"
 *
 * const ConfigSchema = Schema.Struct({
 *   port: Schema.Number,
 *   host: Schema.String
 * })
 *
 * const config = Argument.fileParse("config", ConfigSchema, "JSON")
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const fileParse = <A>(
  name: string,
  schema: Schema.Codec<A, string>,
  format?: string
): Argument<A> => asArgument(Param.fileParse(name, schema, "argument", format))

/**
 * Creates a positional argument that reads and validates file content using a schema.
 *
 * @since 4.0.0
 * @category constructors
 */
export const fileSchema = <A>(
  name: string,
  schema: Schema.Codec<A, string>,
  format?: string
): Argument<A> => asArgument(Param.fileSchema(name, schema, "argument", format))

/**
 * Creates an empty sentinel argument that always fails to parse.
 *
 * @since 4.0.0
 * @category constructors
 */
export const none: Argument<never> = asArgument(Param.none("argument"))

/* -------------------------------------------------------------------------------------------------
 * combinators
 * -------------------------------------------------------------------------------------------------*/

/**
 * Makes a positional argument optional.
 *
 * @example
 * ```ts
 * import * as Argument from "@effect/cli/Argument"
 *
 * const optionalVersion = Argument.string("version").pipe(Argument.optional)
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const optional = <A>(arg: Argument<A>): Argument<Option.Option<A>> => asArgument(Param.optional(arg))

/**
 * Adds a description to a positional argument.
 *
 * @example
 * ```ts
 * import * as Argument from "@effect/cli/Argument"
 *
 * const filename = Argument.string("filename").pipe(
 *   Argument.withDescription("The input file to process")
 * )
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const withDescription: {
  <A>(description: string): (self: Argument<A>) => Argument<A>
  <A>(self: Argument<A>, description: string): Argument<A>
} = dual(
  2,
  <A>(self: Argument<A>, description: string): Argument<A> => asArgument(Param.withDescription(self, description))
)

/**
 * Provides a default value for a positional argument.
 *
 * @example
 * ```ts
 * import * as Argument from "@effect/cli/Argument"
 *
 * const port = Argument.integer("port").pipe(Argument.withDefault(8080))
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const withDefault: {
  <A>(defaultValue: A): (self: Argument<A>) => Argument<A>
  <A>(self: Argument<A>, defaultValue: A): Argument<A>
} = dual(2, <A>(self: Argument<A>, defaultValue: A): Argument<A> => asArgument(Param.withDefault(self, defaultValue)))

/**
 * Creates a variadic positional argument that accepts multiple values.
 *
 * @example
 * ```ts
 * import * as Argument from "@effect/cli/Argument"
 *
 * // Accept any number of files
 * const files = Argument.string("files").pipe(Argument.variadic)
 *
 * // Accept at least 1 file
 * const files = Argument.string("files").pipe(Argument.variadic({ min: 1 }))
 *
 * // Accept between 1 and 5 files
 * const files = Argument.string("files").pipe(Argument.variadic({ min: 1, max: 5 }))
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const variadic: {
  (options?: { min?: number; max?: number }): <A>(self: Argument<A>) => Argument<ReadonlyArray<A>>
  <A>(self: Argument<A>, options?: { min?: number; max?: number }): Argument<ReadonlyArray<A>>
} = dual(
  2,
  <A>(self: Argument<A>, options?: { min?: number; max?: number }): Argument<ReadonlyArray<A>> =>
    asArgument(Param.variadic(
      self,
      options?.min !== undefined ? Option.some(options.min) : Option.none(),
      options?.max !== undefined ? Option.some(options.max) : Option.none()
    ))
)

/**
 * Transforms the parsed value of a positional argument.
 *
 * @example
 * ```ts
 * import * as Argument from "@effect/cli/Argument"
 *
 * const port = Argument.integer("port").pipe(
 *   Argument.map(p => ({ port: p, url: `http://localhost:${p}` }))
 * )
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const map: {
  <A, B>(f: (a: A) => B): (self: Argument<A>) => Argument<B>
  <A, B>(self: Argument<A>, f: (a: A) => B): Argument<B>
} = dual(2, <A, B>(self: Argument<A>, f: (a: A) => B): Argument<B> => asArgument(Param.map(self, f)))

/**
 * Transforms the parsed value of a positional argument using an effectful function.
 *
 * @example
 * ```ts
 * import * as Argument from "@effect/cli/Argument"
 * import { Effect } from "effect"
 *
 * const files = Argument.string("files").pipe(
 *   Argument.mapEffect(file =>
 *     file.endsWith(".txt")
 *       ? Effect.succeed(file)
 *       : Effect.fail("Only .txt files allowed")
 *   )
 * )
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const mapEffect: {
  <A, B>(
    f: (a: A) => Effect.Effect<B, CliError.CliError, Environment>
  ): (self: Argument<A>) => Argument<B>
  <A, B>(
    self: Argument<A>,
    f: (a: A) => Effect.Effect<B, CliError.CliError, Environment>
  ): Argument<B>
} = dual(2, <A, B>(
  self: Argument<A>,
  f: (a: A) => Effect.Effect<B, CliError.CliError, FileSystem.FileSystem | Path.Path>
): Argument<B> => asArgument(Param.mapEffect(self, f)))

/**
 * Transforms the parsed value of a positional argument using a function that may throw.
 *
 * @example
 * ```ts
 * import * as Argument from "@effect/cli/Argument"
 *
 * const json = Argument.string("data").pipe(
 *   Argument.mapTryCatch(
 *     str => JSON.parse(str),
 *     error => `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`
 *   )
 * )
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const mapTryCatch: {
  <A, B>(
    f: (a: A) => B,
    onError: (error: unknown) => string
  ): (self: Argument<A>) => Argument<B>
  <A, B>(self: Argument<A>, f: (a: A) => B, onError: (error: unknown) => string): Argument<B>
} = dual(3, <A, B>(
  self: Argument<A>,
  f: (a: A) => B,
  onError: (error: unknown) => string
): Argument<B> => asArgument(Param.mapTryCatch(self, f, onError)))

/**
 * Creates a variadic argument that accepts multiple values (same as variadic).
 *
 * @example
 * ```ts
 * import * as Argument from "@effect/cli/Argument"
 *
 * const files = Argument.string("files").pipe(Argument.repeated)
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const repeated = <A>(arg: Argument<A>): Argument<ReadonlyArray<A>> => asArgument(Param.repeated(arg))

/**
 * Creates a variadic argument that requires at least n values.
 *
 * @example
 * ```ts
 * import * as Argument from "@effect/cli/Argument"
 *
 * const files = Argument.string("files").pipe(Argument.atLeast(1))
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const atLeast: {
  <A>(min: number): (self: Argument<A>) => Argument<ReadonlyArray<A>>
  <A>(self: Argument<A>, min: number): Argument<ReadonlyArray<A>>
} = dual(2, <A>(self: Argument<A>, min: number): Argument<ReadonlyArray<A>> => asArgument(Param.atLeast(self, min)))

/**
 * Creates a variadic argument that accepts at most n values.
 *
 * @example
 * ```ts
 * import * as Argument from "@effect/cli/Argument"
 *
 * const files = Argument.string("files").pipe(Argument.atMost(5))
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const atMost: {
  <A>(max: number): (self: Argument<A>) => Argument<ReadonlyArray<A>>
  <A>(self: Argument<A>, max: number): Argument<ReadonlyArray<A>>
} = dual(2, <A>(self: Argument<A>, max: number): Argument<ReadonlyArray<A>> => asArgument(Param.atMost(self, max)))

/**
 * Creates a variadic argument that accepts between min and max values.
 *
 * @example
 * ```ts
 * import * as Argument from "@effect/cli/Argument"
 *
 * const files = Argument.string("files").pipe(Argument.between(1, 5))
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const between: {
  <A>(min: number, max: number): (self: Argument<A>) => Argument<ReadonlyArray<A>>
  <A>(self: Argument<A>, min: number, max: number): Argument<ReadonlyArray<A>>
} = dual(
  3,
  <A>(self: Argument<A>, min: number, max: number): Argument<ReadonlyArray<A>> =>
    asArgument(Param.between(self, min, max))
)

/**
 * Validates parsed values against a Schema.
 *
 * @example
 * ```ts
 * import * as Argument from "@effect/cli/Argument"
 * import { Schema } from "effect"
 *
 * const Email = Schema.String.pipe(
 *   Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
 * )
 *
 * const email = Argument.string("email").pipe(
 *   Argument.withSchema(Email)
 * )
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const withSchema: {
  <A, B>(schema: Schema.Codec<B, A>): (self: Argument<A>) => Argument<B>
  <A, B>(self: Argument<A>, schema: Schema.Codec<B, A>): Argument<B>
} = dual(
  2,
  <A, B>(self: Argument<A>, schema: Schema.Codec<B, A>): Argument<B> => asArgument(Param.withSchema(self, schema))
)
