/**
 * @since 4.0.0
 */
import * as Option from "../../data/Option.ts"
import type * as Redacted from "../../data/Redacted.ts"
import type * as Effect from "../../Effect.ts"
import { dual } from "../../Function.ts"
import type * as FileSystem from "../../platform/FileSystem.ts"
import type * as Path from "../../platform/Path.ts"
import type * as Schema from "../../schema/Schema.ts"
import type * as CliError from "./CliError.ts"
import type { Environment } from "./Command.ts"
import * as Param from "./Param.ts"

/**
 * Represents a positional command-line argument.
 *
 * @since 4.0.0
 * @category models
 */
export interface Argument<A> extends Param.Param<A, "argument"> {}

/**
 * Creates a positional string argument.
 *
 * @example
 * ```ts
 * import { Argument } from "effect/unstable/cli"
 *
 * const filename = Argument.string("filename")
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const string = (name: string): Argument<string> => Param.string(name, "argument")

/**
 * Creates a positional integer argument.
 *
 * @example
 * ```ts
 * import { Argument } from "effect/unstable/cli"
 *
 * const count = Argument.integer("count")
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const integer = (name: string): Argument<number> => Param.integer(name, "argument")

/**
 * Creates a positional file path argument.
 *
 * @example
 * ```ts
 * import { Argument } from "effect/unstable/cli"
 *
 * const inputFile = Argument.file("input", { mustExist: true }) // Must exist
 * const outputFile = Argument.file("output", { mustExist: false }) // Must not exist
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const file = (name: string, options?: {
  readonly mustExist?: boolean | undefined
}): Argument<string> => Param.file(name, "argument", options)

/**
 * Creates a positional directory path argument.
 *
 * @example
 * ```ts
 * import { Argument } from "effect/unstable/cli"
 *
 * const workspace = Argument.directory("workspace", { mustExist: true }) // Must exist
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const directory = (name: string, options?: {
  readonly mustExist?: boolean | undefined
}): Argument<string> => Param.directory(name, "argument", options)

/**
 * Creates a positional float argument.
 *
 * @example
 * ```ts
 * import { Argument } from "effect/unstable/cli"
 *
 * const ratio = Argument.float("ratio")
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const float = (name: string): Argument<number> => Param.float(name, "argument")

/**
 * Creates a positional date argument.
 *
 * @example
 * ```ts
 * import { Argument } from "effect/unstable/cli"
 *
 * const startDate = Argument.date("start-date")
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const date = (name: string): Argument<Date> => Param.date(name, "argument")

/**
 * Creates a positional choice argument.
 *
 * @example
 * ```ts
 * import { Argument } from "effect/unstable/cli"
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
): Argument<A[number]> => Param.choice(name, choices, "argument")

/**
 * Creates a positional path argument.
 *
 * @example
 * ```ts
 * import { Argument } from "effect/unstable/cli"
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
}): Argument<string> => Param.path(name, "argument", options)

/**
 * Creates a positional redacted argument that obscures its value.
 *
 * @example
 * ```ts
 * import { Argument } from "effect/unstable/cli"
 *
 * const secret = Argument.redacted("secret")
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const redacted = (name: string): Argument<Redacted.Redacted<string>> => Param.redacted(name, "argument")

/**
 * Creates a positional argument that reads file content as a string.
 *
 * @example
 * ```ts
 * import { Argument } from "effect/unstable/cli"
 *
 * const config = Argument.fileString("config-file")
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const fileText = (name: string): Argument<string> => Param.fileString(name, "argument")

/**
 * Creates a positional argument that reads and validates file content using a schema.
 *
 * @example
 * ```ts
 * import { Argument } from "effect/unstable/cli"
 * import { Schema } from "effect"
 *
 * const ConfigSchema = Schema.Struct({
 *   port: Schema.Number,
 *   host: Schema.String
 * })
 *
 * const config = Argument.fileSchema("config", ConfigSchema, "JSON")
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const fileSchema = <A>(
  name: string,
  schema: Schema.Codec<A, string>,
  format?: string
): Argument<A> => Param.fileSchema(name, schema, "argument", format)

/**
 * Creates an empty sentinel argument that always fails to parse.
 *
 * @since 4.0.0
 * @category constructors
 */
export const none: Argument<never> = Param.none("argument")

/**
 * Makes a positional argument optional.
 *
 * @example
 * ```ts
 * import { Argument } from "effect/unstable/cli"
 *
 * const optionalVersion = Argument.string("version").pipe(Argument.optional)
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const optional = <A>(arg: Argument<A>): Argument<Option.Option<A>> => Param.optional(arg)

/**
 * Adds a description to a positional argument.
 *
 * @example
 * ```ts
 * import { Argument } from "effect/unstable/cli"
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
  <A>(self: Argument<A>, description: string): Argument<A> => Param.withDescription(self, description)
)

/**
 * Provides a default value for a positional argument.
 *
 * @example
 * ```ts
 * import { Argument } from "effect/unstable/cli"
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
} = dual(2, <A>(self: Argument<A>, defaultValue: A): Argument<A> => Param.withDefault(self, defaultValue))

/**
 * Creates a variadic positional argument that accepts multiple values.
 *
 * @example
 * ```ts
 * import { Argument } from "effect/unstable/cli"
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
    Param.variadic(
      self,
      options?.min !== undefined ? Option.some(options.min) : Option.none(),
      options?.max !== undefined ? Option.some(options.max) : Option.none()
    )
)

/**
 * Transforms the parsed value of a positional argument.
 *
 * @example
 * ```ts
 * import { Argument } from "effect/unstable/cli"
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
} = dual(2, <A, B>(self: Argument<A>, f: (a: A) => B): Argument<B> => Param.map(self, f))

/**
 * Transforms the parsed value of a positional argument using an effectful function.
 *
 * @example
 * ```ts
 * import { Argument } from "effect/unstable/cli"
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
): Argument<B> => Param.mapEffect(self, f))

/**
 * Transforms the parsed value of a positional argument using a function that may throw.
 *
 * @example
 * ```ts
 * import { Argument } from "effect/unstable/cli"
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
): Argument<B> => Param.mapTryCatch(self, f, onError))

/**
 * Creates a variadic argument that accepts multiple values (same as variadic).
 *
 * @example
 * ```ts
 * import { Argument } from "effect/unstable/cli"
 *
 * const files = Argument.string("files").pipe(Argument.repeated)
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const repeated = <A>(arg: Argument<A>): Argument<ReadonlyArray<A>> => Param.repeated(arg)

/**
 * Creates a variadic argument that requires at least n values.
 *
 * @example
 * ```ts
 * import { Argument } from "effect/unstable/cli"
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
} = dual(2, <A>(self: Argument<A>, min: number): Argument<ReadonlyArray<A>> => Param.atLeast(self, min))

/**
 * Creates a variadic argument that accepts at most n values.
 *
 * @example
 * ```ts
 * import { Argument } from "effect/unstable/cli"
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
} = dual(2, <A>(
  self: Argument<A>,
  max: number
): Argument<ReadonlyArray<A>> => Param.atMost(self, max))

/**
 * Creates a variadic argument that accepts between min and max values.
 *
 * @example
 * ```ts
 * import { Argument } from "effect/unstable/cli"
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
} = dual(3, <A>(
  self: Argument<A>,
  min: number,
  max: number
): Argument<ReadonlyArray<A>> => Param.between(self, min, max))

/**
 * Validates parsed values against a Schema.
 *
 * @example
 * ```ts
 * import { Argument } from "effect/unstable/cli"
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
} = dual(2, <A, B>(
  self: Argument<A>,
  schema: Schema.Codec<B, A>
): Argument<B> => Param.withSchema(self, schema))
