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
 * @since 4.0.0
 * @category constructors
 */
export const string = (name: string): Flag<string> => Param.string(name, "flag")

/**
 * @since 4.0.0
 * @category constructors
 */
export const boolean = (name: string): Flag<boolean> => Param.boolean(name, "flag")

/**
 * @since 4.0.0
 * @category constructors
 */
export const integer = (name: string): Flag<number> => Param.integer(name, "flag")

/**
 * @since 4.0.0
 * @category constructors
 */
export const float = (name: string): Flag<number> => Param.float(name, "flag")

/**
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
 * @since 4.0.0
 * @category constructors
 */
export const path = (name: string, options?: {
  readonly pathType?: "file" | "directory" | "either" | undefined
  readonly mustExist?: boolean | undefined
  readonly typeName?: string | undefined
}): Flag<string> => Param.path(name, "flag", options)

/**
 * @since 4.0.0
 * @category constructors
 */
export const file = (name: string, options?: {
  readonly mustExist?: boolean | undefined
}): Flag<string> => Param.file(name, "flag", options)

/**
 * @since 4.0.0
 * @category constructors
 */
export const directory = (name: string, options?: {
  readonly mustExist?: boolean | undefined
}): Flag<string> => Param.directory(name, "flag", options)

/**
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
 * @since 4.0.0
 * @category constructors
 */
export const none: Flag<never> = Param.none("flag")

/**
 * @since 1.0.0
 * @category aliasing
 */
export const withAlias: {
  <A>(alias: string): (self: Flag<A>) => Flag<A>
  <A>(self: Flag<A>, alias: string): Flag<A>
} = dual(2, <A>(self: Flag<A>, alias: string): Flag<A> => Param.withAlias(self, alias))

/**
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
 * @since 1.0.0
 * @category help documentation
 */
export const withPseudoName: {
  <A>(pseudoName: string): (self: Flag<A>) => Flag<A>
  <A>(self: Flag<A>, pseudoName: string): Flag<A>
} = dual(2, <A>(self: Flag<A>, pseudoName: string): Flag<A> => Param.withPseudoName(self, pseudoName))

/**
 * @since 1.0.0
 * @category optionality
 */
export const optional = <A>(param: Flag<A>): Flag<Option.Option<A>> => Param.optional(param)

/**
 * @since 1.0.0
 * @category optionality
 */
export const withDefault: {
  <A>(defaultValue: A): (self: Flag<A>) => Flag<A>
  <A>(self: Flag<A>, defaultValue: A): Flag<A>
} = dual(2, <A>(self: Flag<A>, defaultValue: A): Flag<A> => Param.withDefault(self, defaultValue))

/**
 * @since 1.0.0
 * @category mapping
 */
export const map: {
  <A, B>(f: (a: A) => B): (self: Flag<A>) => Flag<B>
  <A, B>(self: Flag<A>, f: (a: A) => B): Flag<B>
} = dual(2, <A, B>(self: Flag<A>, f: (a: A) => B): Flag<B> => Param.map(self, f))

/**
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
 * @since 1.0.0
 * @category repetition
 */
export const repeated = <A>(flag: Flag<A>): Flag<ReadonlyArray<A>> => Param.repeated(flag)

/**
 * @since 1.0.0
 * @category repetition
 */
export const atLeast: {
  <A>(min: number): (self: Flag<A>) => Flag<ReadonlyArray<A>>
  <A>(self: Flag<A>, min: number): Flag<ReadonlyArray<A>>
} = dual(2, <A>(self: Flag<A>, min: number): Flag<ReadonlyArray<A>> => Param.atLeast(self, min))

/**
 * @since 1.0.0
 * @category repetition
 */
export const atMost: {
  <A>(max: number): (self: Flag<A>) => Flag<ReadonlyArray<A>>
  <A>(self: Flag<A>, max: number): Flag<ReadonlyArray<A>>
} = dual(2, <A>(self: Flag<A>, max: number): Flag<ReadonlyArray<A>> => Param.atMost(self, max))

/**
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
 * @since 1.0.0
 * @category alternatives
 */
export const orElse: {
  <B>(that: LazyArg<Flag<B>>): <A>(self: Flag<A>) => Flag<A | B>
  <A, B>(self: Flag<A>, that: LazyArg<Flag<B>>): Flag<A | B>
} = dual(2, <A, B>(self: Flag<A>, that: LazyArg<Flag<B>>): Flag<A | B> => Param.orElse(self, that))

/**
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
