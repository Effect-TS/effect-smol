/**
 * @since 4.0.0
 */
import type * as Option from "../../data/Option.ts"
import type * as Redacted from "../../data/Redacted.ts"
import type * as Result from "../../data/Result.ts"
import type * as Effect from "../../Effect.ts"
import { dual, type LazyArg } from "../../Function.ts"
import type * as FileSystem from "../../platform/FileSystem.ts"
import type * as Path from "../../platform/Path.ts"
import type * as Schema from "../../schema/Schema.ts"
import type * as CliError from "./CliError.ts"
import * as Param from "./Param.ts"

/**
 * Represents a command-line flag.
 *
 * @since 4.0.0
 * @category models
 */
export interface Flag<A> extends Param.Param<A, "flag"> {}

/**
 * Creates a string flag that accepts text input.
 *
 * @example
 * ```ts
 * import { Flag } from "effect/unstable/cli"
 *
 * const nameFlag = Flag.string("name")
 * // Usage: --name "John Doe"
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const string = (name: string): Flag<string> => Param.string(name, "flag")

/**
 * Creates a boolean flag that can be enabled or disabled.
 *
 * @example
 * ```ts
 * import { Flag } from "effect/unstable/cli"
 *
 * const verboseFlag = Flag.boolean("verbose")
 * // Usage: --verbose (true) or --no-verbose (false)
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const boolean = (name: string): Flag<boolean> => Param.boolean(name, "flag")

/**
 * Creates an integer flag that accepts whole number input.
 *
 * @example
 * ```ts
 * import { Flag } from "effect/unstable/cli"
 *
 * const portFlag = Flag.integer("port")
 * // Usage: --port 8080
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const integer = (name: string): Flag<number> => Param.integer(name, "flag")

/**
 * Creates a float flag that accepts decimal number input.
 *
 * @example
 * ```ts
 * import { Flag } from "effect/unstable/cli"
 *
 * const rateFlag = Flag.float("rate")
 * // Usage: --rate 3.14
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const float = (name: string): Flag<number> => Param.float(name, "flag")

/**
 * Creates a date flag that accepts date input in ISO format.
 *
 * @example
 * ```ts
 * import { Flag } from "effect/unstable/cli"
 *
 * const startDateFlag = Flag.date("start-date")
 * // Usage: --start-date 2023-12-25
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const date = (name: string): Flag<Date> => Param.date(name, "flag")

/**
 * Constructs option parameters that represent a choice between several inputs.
 * Each tuple maps a string flag value to an associated typed value.
 *
 * @example
 * ```ts
 * import { Flag } from "effect/unstable/cli"
 *
 * // simple enum like choice mapping directly to string union
 * const color = Flag.choice("color", ["red", "green", "blue"])
 *
 * // choice with custom value mapping
 * const logLevel = Flag.choiceWithValue("log-level", [
 *   ["debug", "Debug" as const],
 *   ["info", "Info" as const],
 *   ["error", "Error" as const]
 * ])
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const choiceWithValue = <const C extends ReadonlyArray<readonly [string, any]>>(
  name: string,
  choices: C
): Flag<C[number][1]> => Param.choiceWithValue(name, choices, "flag")

/**
 * Simpler variant of `choiceWithValue` which maps each string to itself.
 *
 * @since 4.0.0
 * @category constructors
 */
export const choice = <const A extends ReadonlyArray<string>>(
  name: string,
  choices: A
): Flag<A[number]> => Param.choice(name, choices, "flag")

/**
 * Creates a path flag that accepts file system path input with validation options.
 *
 * @example
 * ```ts
 * import { Flag } from "effect/unstable/cli"
 *
 * // Basic path flag
 * const pathFlag = Flag.path("config-path")
 *
 * // File-only path that must exist
 * const fileFlag = Flag.path("input-file", {
 *   pathType: "file",
 *   mustExist: true
 * })
 *
 * // Directory path with custom type name
 * const dirFlag = Flag.path("output-dir", {
 *   pathType: "directory",
 *   typeName: "OUTPUT_DIRECTORY"
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const path = (name: string, options?: {
  readonly pathType?: "file" | "directory" | "either" | undefined
  readonly mustExist?: boolean | undefined
  readonly typeName?: string | undefined
}): Flag<string> => Param.path(name, "flag", options)

/**
 * Creates a file path flag that accepts file paths with optional existence validation.
 *
 * @example
 * ```ts
 * import { Flag } from "effect/unstable/cli"
 *
 * // Basic file flag
 * const inputFlag = Flag.file("input")
 * // Usage: --input ./data.json
 *
 * // File that must exist
 * const configFlag = Flag.file("config", { mustExist: true })
 * // Usage: --config ./config.yaml (file must exist)
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const file = (name: string, options?: {
  readonly mustExist?: boolean | undefined
}): Flag<string> => Param.file(name, "flag", options)

/**
 * Creates a directory path flag that accepts directory paths with optional existence validation.
 *
 * @example
 * ```ts
 * import { Flag } from "effect/unstable/cli"
 *
 * // Basic directory flag
 * const outputFlag = Flag.directory("output")
 * // Usage: --output ./build
 *
 * // Directory that must exist
 * const sourceFlag = Flag.directory("source", { mustExist: true })
 * // Usage: --source ./src (directory must exist)
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const directory = (name: string, options?: {
  readonly mustExist?: boolean | undefined
}): Flag<string> => Param.directory(name, "flag", options)

/**
 * Creates a redacted flag that securely handles sensitive string input.
 *
 * @example
 * ```ts
 * import { Flag } from "effect/unstable/cli"
 * import { Effect, Redacted } from "effect"
 *
 * const passwordFlag = Flag.redacted("password")
 *
 * const program = Effect.gen(function* () {
 *   const password = yield* passwordFlag
 *   const value = Redacted.value(password) // Access the underlying value
 *   console.log("Password length:", value.length)
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const redacted = (name: string): Flag<Redacted.Redacted<string>> => Param.redacted(name, "flag")

/**
 * Creates a flag that reads and returns file content as a string.
 *
 * @example
 * ```ts
 * import { Flag } from "effect/unstable/cli"
 *
 * const config = Flag.fileContent("config-file")
 * // --config-file ./app.json will read the file content
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const fileString = (name: string): Flag<string> => Param.fileString(name, "flag")

/**
 * Creates a flag that reads and validates file content using the specified
 * schema.
 *
 * @example
 * ```ts
 * import { Flag } from "effect/unstable/cli"
 * import { Schema } from "effect"
 *
 * const ConfigSchema = Schema.Struct({
 *   port: Schema.Number,
 *   host: Schema.String
 * })
 *
 * const config = Flag.fileSchema("config", ConfigSchema, "JSON")
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const fileSchema = <A>(
  name: string,
  schema: Schema.Codec<A, string>,
  format?: string | undefined
): Flag<A> => Param.fileSchema(name, schema, "flag", format)

/**
 * Creates a flag that parses key=value pairs.
 * Useful for options that accept configuration values.
 *
 * @example
 * ```ts
 * import { Flag } from "effect/unstable/cli"
 *
 * const env = Flag.keyValueMap("env")
 * // --env FOO=bar will parse to { FOO: "bar" }
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const keyValueMap = (name: string): Flag<Record<string, string>> => Param.keyValueMap(name, "flag")

/**
 * Creates an empty sentinel flag that always fails to parse.
 * This is useful for creating placeholder flags or for combinators.
 *
 * @example
 * ```ts
 * import { Flag } from "effect/unstable/cli"
 *
 * // Used as a placeholder in flag combinators
 * const conditionalFlag = someCondition ? Flag.string("value") : Flag.none
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const none: Flag<never> = Param.none("flag")

/**
 * Adds an alias to a flag, allowing it to be referenced by multiple names.
 *
 * @example
 * ```ts
 * import { Flag } from "effect/unstable/cli"
 *
 * // Flag can be used as both --verbose and -v
 * const verboseFlag = Flag.boolean("verbose").pipe(
 *   Flag.withAlias("v")
 * )
 *
 * // Multiple aliases can be chained
 * const helpFlag = Flag.boolean("help").pipe(
 *   Flag.withAlias("h"),
 *   Flag.withAlias("?")
 * )
 * ```
 *
 * @since 1.0.0
 * @category aliasing
 */
export const withAlias: {
  <A>(alias: string): (self: Flag<A>) => Flag<A>
  <A>(self: Flag<A>, alias: string): Flag<A>
} = dual(2, <A>(self: Flag<A>, alias: string): Flag<A> => Param.withAlias(self, alias))

/**
 * Adds a description to a flag for help documentation.
 *
 * @example
 * ```ts
 * import { Flag } from "effect/unstable/cli"
 *
 * const portFlag = Flag.integer("port").pipe(
 *   Flag.withDescription("The port number to listen on")
 * )
 *
 * const configFlag = Flag.file("config").pipe(
 *   Flag.withDescription("Path to the configuration file")
 * )
 * ```
 *
 * @since 1.0.0
 * @category help documentation
 */
export const withDescription: {
  <A>(description: string): (self: Flag<A>) => Flag<A>
  <A>(self: Flag<A>, description: string): Flag<A>
} = dual(2, <A>(
  self: Flag<A>,
  description: string
): Flag<A> => Param.withDescription(self, description))

/**
 * Adds a pseudo name to a flag for help documentation display.
 *
 * @example
 * ```ts
 * import { Flag } from "effect/unstable/cli"
 *
 * const databaseFlag = Flag.string("database-url").pipe(
 *   Flag.withPseudoName("URL"),
 *   Flag.withDescription("Database connection URL")
 * )
 * // In help: --database-url URL
 *
 * const timeoutFlag = Flag.integer("timeout").pipe(
 *   Flag.withPseudoName("SECONDS")
 * )
 * // In help: --timeout SECONDS
 * ```
 *
 * @since 1.0.0
 * @category help documentation
 */
export const withPseudoName: {
  <A>(pseudoName: string): (self: Flag<A>) => Flag<A>
  <A>(self: Flag<A>, pseudoName: string): Flag<A>
} = dual(2, <A>(self: Flag<A>, pseudoName: string): Flag<A> => Param.withPseudoName(self, pseudoName))

/**
 * Makes a flag optional, returning an Option type that can be None if not provided.
 *
 * @example
 * ```ts
 * import { Flag } from "effect/unstable/cli"
 * import { Option, Effect } from "effect"
 *
 * const optionalPort = Flag.optional(Flag.integer("port"))
 *
 * const program = Effect.gen(function* () {
 *   const port = yield* optionalPort
 *   if (Option.isSome(port)) {
 *     console.log("Port specified:", port.value)
 *   } else {
 *     console.log("No port specified, using default")
 *   }
 * })
 * ```
 *
 * @since 1.0.0
 * @category optionality
 */
export const optional = <A>(param: Flag<A>): Flag<Option.Option<A>> => Param.optional(param)

/**
 * Provides a default value for a flag when it's not specified.
 *
 * @example
 * ```ts
 * import { Flag } from "effect/unstable/cli"
 *
 * const portFlag = Flag.integer("port").pipe(
 *   Flag.withDefault(8080)
 * )
 * // If --port is not provided, defaults to 8080
 *
 * const hostFlag = Flag.string("host").pipe(
 *   Flag.withDefault("localhost")
 * )
 * // If --host is not provided, defaults to "localhost"
 * ```
 *
 * @since 1.0.0
 * @category optionality
 */
export const withDefault: {
  <A>(defaultValue: A): (self: Flag<A>) => Flag<A>
  <A>(self: Flag<A>, defaultValue: A): Flag<A>
} = dual(2, <A>(self: Flag<A>, defaultValue: A): Flag<A> => Param.withDefault(self, defaultValue))

/**
 * Transforms the parsed value of a flag using a mapping function.
 *
 * @example
 * ```ts
 * import { Flag } from "effect/unstable/cli"
 *
 * // Convert string to uppercase
 * const nameFlag = Flag.string("name").pipe(
 *   Flag.map(name => name.toUpperCase())
 * )
 *
 * // Convert port to URL
 * const urlFlag = Flag.integer("port").pipe(
 *   Flag.map(port => `http://localhost:${port}`)
 * )
 * ```
 *
 * @since 1.0.0
 * @category mapping
 */
export const map: {
  <A, B>(f: (a: A) => B): (self: Flag<A>) => Flag<B>
  <A, B>(self: Flag<A>, f: (a: A) => B): Flag<B>
} = dual(2, <A, B>(self: Flag<A>, f: (a: A) => B): Flag<B> => Param.map(self, f))

/**
 * Transforms the parsed value using an Effect that can perform IO operations.
 *
 * @example
 * ```ts
 * import { Flag } from "effect/unstable/cli"
 * import { Effect, FileSystem } from "effect"
 *
 * // Read file size from path flag
 * const fileSizeFlag = Flag.file("input").pipe(
 *   Flag.mapEffect(path =>
 *     Effect.gen(function* () {
 *       const fs = yield* FileSystem.FileSystem
 *       const stats = yield* fs.stat(path)
 *       return stats.size
 *     })
 *   )
 * )
 * ```
 *
 * @since 1.0.0
 * @category mapping
 */
export const mapEffect: {
  <A, B>(
    f: (a: A) => Effect.Effect<B, CliError.CliError, FileSystem.FileSystem | Path.Path>
  ): (self: Flag<A>) => Flag<B>
  <A, B>(self: Flag<A>, f: (a: A) => Effect.Effect<B, CliError.CliError, FileSystem.FileSystem | Path.Path>): Flag<B>
} = dual(2, <A, B>(
  self: Flag<A>,
  f: (a: A) => Effect.Effect<B, CliError.CliError, FileSystem.FileSystem | Path.Path>
): Flag<B> => Param.mapEffect(self, f))

/**
 * Transforms the parsed value using a function that might throw, with error handling.
 *
 * @example
 * ```ts
 * import { Flag } from "effect/unstable/cli"
 *
 * // Parse JSON string with error handling
 * const jsonFlag = Flag.string("config").pipe(
 *   Flag.mapTryCatch(
 *     json => JSON.parse(json),
 *     error => `Invalid JSON: ${error}`
 *   )
 * )
 *
 * // Parse URL with error handling
 * const urlFlag = Flag.string("url").pipe(
 *   Flag.mapTryCatch(
 *     url => new URL(url),
 *     error => `Invalid URL: ${error}`
 *   )
 * )
 * ```
 *
 * @since 1.0.0
 * @category mapping
 */
export const mapTryCatch: {
  <A, B>(
    f: (a: A) => B,
    onError: (error: unknown) => string
  ): (self: Flag<A>) => Flag<B>
  <A, B>(self: Flag<A>, f: (a: A) => B, onError: (error: unknown) => string): Flag<B>
} = dual(3, <A, B>(
  self: Flag<A>,
  f: (a: A) => B,
  onError: (error: unknown) => string
): Flag<B> => Param.mapTryCatch(self, f, onError))

/**
 * Allows a flag to be specified multiple times, collecting all values into an array.
 *
 * @example
 * ```ts
 * import { Flag } from "effect/unstable/cli"
 *
 * const includeFlag = Flag.repeated(Flag.file("include"))
 * // Usage: --include file1.ts --include file2.ts --include file3.ts
 * // Result: ["file1.ts", "file2.ts", "file3.ts"]
 *
 * const verbosityFlag = Flag.repeated(Flag.boolean("verbose"))
 * // Usage: --verbose --verbose --verbose
 * // Result: [true, true, true]
 * ```
 *
 * @since 1.0.0
 * @category repetition
 */
export const repeated = <A>(flag: Flag<A>): Flag<ReadonlyArray<A>> => Param.repeated(flag)

/**
 * Requires a flag to be specified at least a minimum number of times.
 *
 * @example
 * ```ts
 * import { Flag } from "effect/unstable/cli"
 *
 * const sourceFlag = Flag.atLeast(Flag.file("source"), 2)
 * // Requires at least 2 source files
 * // Usage: --source file1.ts --source file2.ts
 *
 * const tagFlag = Flag.string("tag").pipe(
 *   Flag.atLeast(1)
 * )
 * // Requires at least 1 tag
 * ```
 *
 * @since 1.0.0
 * @category repetition
 */
export const atLeast: {
  <A>(min: number): (self: Flag<A>) => Flag<ReadonlyArray<A>>
  <A>(self: Flag<A>, min: number): Flag<ReadonlyArray<A>>
} = dual(2, <A>(self: Flag<A>, min: number): Flag<ReadonlyArray<A>> => Param.atLeast(self, min))

/**
 * Limits a flag to be specified at most a maximum number of times.
 *
 * @example
 * ```ts
 * import { Flag } from "effect/unstable/cli"
 *
 * const warningFlag = Flag.atMost(Flag.string("warning"), 3)
 * // Allows up to 3 warning flags
 * // Usage: --warning w1 --warning w2 --warning w3
 *
 * const debugFlag = Flag.string("debug").pipe(
 *   Flag.atMost(1)
 * )
 * // Allows at most 1 debug flag
 * ```
 *
 * @since 1.0.0
 * @category repetition
 */
export const atMost: {
  <A>(max: number): (self: Flag<A>) => Flag<ReadonlyArray<A>>
  <A>(self: Flag<A>, max: number): Flag<ReadonlyArray<A>>
} = dual(2, <A>(self: Flag<A>, max: number): Flag<ReadonlyArray<A>> => Param.atMost(self, max))

/**
 * Constrains a flag to be specified between a minimum and maximum number of times.
 *
 * @example
 * ```ts
 * import { Flag } from "effect/unstable/cli"
 *
 * const hostFlag = Flag.between(Flag.string("host"), 1, 3)
 * // Requires 1-3 host flags
 * // Usage: --host host1 --host host2
 *
 * const excludeFlag = Flag.string("exclude").pipe(
 *   Flag.between(0, 5)
 * )
 * // Allows 0-5 exclude patterns
 * ```
 *
 * @since 1.0.0
 * @category repetition
 */
export const between: {
  <A>(min: number, max: number): (self: Flag<A>) => Flag<ReadonlyArray<A>>
  <A>(self: Flag<A>, min: number, max: number): Flag<ReadonlyArray<A>>
} = dual(
  3,
  <A>(self: Flag<A>, min: number, max: number): Flag<ReadonlyArray<A>> => Param.between(self, min, max)
)

/**
 * Transforms and filters a flag value, failing with a custom error if the transformation returns None.
 *
 * @example
 * ```ts
 * import { Flag } from "effect/unstable/cli"
 * import { Option } from "effect"
 *
 * // Parse positive integers only
 * const positiveInt = Flag.integer("count").pipe(
 *   Flag.filterMap(
 *     n => n > 0 ? Option.some(n) : Option.none(),
 *     n => `Expected positive integer, got ${n}`
 *   )
 * )
 *
 * // Parse valid email addresses
 * const emailFlag = Flag.string("email").pipe(
 *   Flag.filterMap(
 *     email => email.includes("@") ? Option.some(email) : Option.none(),
 *     email => `Invalid email address: ${email}`
 *   )
 * )
 * ```
 *
 * @since 1.0.0
 * @category filtering
 */
export const filterMap: {
  <A, B>(
    f: (a: A) => Option.Option<B>,
    onNone: (a: A) => string
  ): (self: Flag<A>) => Flag<B>
  <A, B>(self: Flag<A>, f: (a: A) => Option.Option<B>, onNone: (a: A) => string): Flag<B>
} = dual(3, <A, B>(
  self: Flag<A>,
  f: (a: A) => Option.Option<B>,
  onNone: (a: A) => string
): Flag<B> => Param.filterMap(self, f, onNone))

/**
 * Filters a flag value based on a predicate, failing with a custom error if the predicate returns false.
 *
 * @example
 * ```ts
 * import { Flag } from "effect/unstable/cli"
 *
 * // Ensure port is in valid range
 * const portFlag = Flag.integer("port").pipe(
 *   Flag.filter(
 *     port => port >= 1 && port <= 65535,
 *     port => `Port ${port} is out of range (1-65535)`
 *   )
 * )
 *
 * // Ensure non-empty string
 * const nameFlag = Flag.string("name").pipe(
 *   Flag.filter(
 *     name => name.trim().length > 0,
 *     () => "Name cannot be empty"
 *   )
 * )
 * ```
 *
 * @since 1.0.0
 * @category filtering
 */
export const filter: {
  <A>(
    predicate: (a: A) => boolean,
    onFalse: (a: A) => string
  ): (self: Flag<A>) => Flag<A>
  <A>(self: Flag<A>, predicate: (a: A) => boolean, onFalse: (a: A) => string): Flag<A>
} = dual(3, <A>(
  self: Flag<A>,
  predicate: (a: A) => boolean,
  onFalse: (a: A) => string
): Flag<A> => Param.filter(self, predicate, onFalse))

/**
 * Provides an alternative flag if the first one fails to parse.
 *
 * @example
 * ```ts
 * import { Flag } from "effect/unstable/cli"
 *
 * // Try parsing as integer, fallback to string
 * const valueFlag = Flag.orElse(
 *   Flag.integer("value"),
 *   () => Flag.string("value")
 * )
 *
 * // Multiple input sources with fallback
 * const configFlag = Flag.orElse(
 *   Flag.file("config"),
 *   () => Flag.string("config-url")
 * )
 * ```
 *
 * @since 1.0.0
 * @category alternatives
 */
export const orElse: {
  <B>(that: LazyArg<Flag<B>>): <A>(self: Flag<A>) => Flag<A | B>
  <A, B>(self: Flag<A>, that: LazyArg<Flag<B>>): Flag<A | B>
} = dual(2, <A, B>(self: Flag<A>, that: LazyArg<Flag<B>>): Flag<A | B> => Param.orElse(self, that))

/**
 * Tries to parse with the first flag, then the second, returning a Result that indicates which succeeded.
 *
 * @example
 * ```ts
 * import { Flag } from "effect/unstable/cli"
 * import { Result, Effect } from "effect"
 *
 * // Try file path, fallback to URL
 * const sourceFlag = Flag.orElseResult(
 *   Flag.file("source"),
 *   () => Flag.string("source-url")
 * )
 *
 * const program = Effect.gen(function* () {
 *   const source = yield* sourceFlag
 *   if (Result.isSuccess(source)) {
 *     console.log("Using file:", source.success)
 *   } else {
 *     console.log("Using URL:", source.failure)
 *   }
 * })
 * ```
 *
 * @since 1.0.0
 * @category alternatives
 */
export const orElseResult: {
  <B>(that: LazyArg<Flag<B>>): <A>(self: Flag<A>) => Flag<Result.Result<A, B>>
  <A, B>(self: Flag<A>, that: LazyArg<Flag<B>>): Flag<Result.Result<A, B>>
} = dual(2, <A, B>(
  self: Flag<A>,
  that: LazyArg<Flag<B>>
): Flag<Result.Result<A, B>> => Param.orElseResult(self, that))

/**
 * Validates and transforms a flag value using a Schema codec.
 *
 * @example
 * ```ts
 * import { Flag } from "effect/unstable/cli"
 * import { Schema } from "effect"
 *
 * // Parse and validate email with custom schema
 * const EmailSchema = Schema.String.pipe(
 *   Schema.filter(email => email.includes("@"), {
 *     message: () => "Must be a valid email address"
 *   })
 * )
 *
 * const emailFlag = Flag.string("email").pipe(
 *   Flag.withSchema(EmailSchema)
 * )
 *
 * // Parse JSON configuration with schema validation
 * const ConfigSchema = Schema.Struct({
 *   port: Schema.Number,
 *   host: Schema.String,
 *   ssl: Schema.optional(Schema.Boolean)
 * })
 *
 * const configFlag = Flag.string("config").pipe(
 *   Flag.withSchema(Schema.parseJson(ConfigSchema))
 * )
 * ```
 *
 * @since 1.0.0
 * @category schemas
 */
export const withSchema: {
  <A, B>(schema: Schema.Codec<B, A>): (self: Flag<A>) => Flag<B>
  <A, B>(self: Flag<A>, schema: Schema.Codec<B, A>): Flag<B>
} = dual(2, <A, B>(
  self: Flag<A>,
  schema: Schema.Codec<B, A>
): Flag<B> => Param.withSchema(self, schema))
