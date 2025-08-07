/**
 * Thin facade around `Param` that only exposes *option* constructors & combinators.
 * We deliberately publish this under the name **Flag** to avoid confusion with
 * `effect/data/Option`.  Everything here is guaranteed to be of kind `"flag"`.
 *
 * Internally we still use `Param`, but we tag the result with an un-exported
 * brand so user code cannot fabricate an `Flag.Option` without going through
 * these helpers (providing light nominal typing and opacity).
 *
 * @since 4.0.0
 */

import type { Effect } from "effect"
import type { Option, Redacted } from "effect/data"
import type * as Result from "effect/data/Result"
import { dual } from "effect/Function"
import type * as FileSystem from "effect/platform/FileSystem"
import type * as Path from "effect/platform/Path"
import type { Schema } from "effect/schema"
import type * as CliError from "../CliError.ts"
import type { Environment } from "../Command.ts"
import * as Param from "./param.ts"

/* -------------------------------------------------------------------------------------------------
 * branding
 * -------------------------------------------------------------------------------------------------*/

const FlagBrand: unique symbol = Symbol("@effect/cli/FlagBrand")

/**
 * Branded options type.  It behaves exactly like `Param.Param<A, "flag">` (and therefore
 * like `Param.Single<A, "flag">`) but carries an extra field keyed by a private symbol
 * so that external code cannot construct it directly.
 *
 * @since 4.0.0
 * @category models
 */
export interface Flag<A> extends Param.Param<A, "flag"> {
  readonly [FlagBrand]: { _A: (_: never) => A }
}

/* -------------------------------------------------------------------------------------------------
 * internal helper
 * -------------------------------------------------------------------------------------------------*/

function asFlag<A>(param: Param.Param<A, "flag">): Flag<A> {
  return param as Flag<A>
}

/* -------------------------------------------------------------------------------------------------
 * constructors (demonstration subset)
 * -------------------------------------------------------------------------------------------------*/

export const string = (name: string): Flag<string> => asFlag(Param.string(name, "flag"))

export const boolean = (name: string): Flag<boolean> => asFlag(Param.boolean(name, "flag"))

export const integer = (name: string): Flag<number> => asFlag(Param.integer(name, "flag"))

export const float = (name: string): Flag<number> => asFlag(Param.float(name, "flag"))

export const date = (name: string): Flag<Date> => asFlag(Param.date(name, "flag"))

/* -------------------------------------------------------------------------------------------------
 * choice options
 * -------------------------------------------------------------------------------------------------*/

/**
 * Constructs option parameters that represent a choice between several inputs.
 * Each tuple maps a string flag value to an associated typed value.
 *
 * @example
 * ```ts
 * import * as Flag from "@effect/cli/Flag"
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
 */
export const choiceWithValue = <const C extends ReadonlyArray<readonly [string, any]>>(
  name: string,
  choices: C
): Flag<C[number][1]> => asFlag(Param.choiceWithValue(name, choices, "flag"))

/**
 * Simpler variant of `choiceWithValue` which maps each string to itself.
 *
 * @since 4.0.0
 */
export const choice = <const A extends ReadonlyArray<string>>(name: string, choices: A): Flag<A[number]> =>
  asFlag(Param.choice(name, choices, "flag"))

export const path = (name: string, options?: {
  pathType?: "file" | "directory" | "either"
  mustExist?: boolean
  typeName?: string
}): Flag<string> => asFlag(Param.path(name, "flag", options))

export const file = (name: string, options?: {
  mustExist?: boolean
}): Flag<string> => asFlag(Param.file(name, "flag", options))

export const directory = (name: string, options?: {
  mustExist?: boolean
}): Flag<string> => asFlag(Param.directory(name, "flag", options))

export const redacted = (name: string): Flag<Redacted.Redacted<string>> => asFlag(Param.redacted(name, "flag"))

/**
 * Creates a flag that reads and returns file content as a string.
 *
 * @example
 * ```ts
 * import * as Flag from "@effect/cli/Flag"
 *
 * const config = Flag.fileContent("config-file")
 * // --config-file ./app.json will read the file content
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const fileContent = (name: string): Flag<string> => asFlag(Param.fileContent(name, "flag"))

/**
 * Creates a flag that reads and returns file content as a string (alias for fileContent).
 *
 * @since 4.0.0
 * @category constructors
 */
export const fileText = (name: string): Flag<string> => asFlag(Param.fileText(name, "flag"))

/**
 * Creates a flag that reads and parses file content using a schema.
 *
 * @example
 * ```ts
 * import * as Flag from "@effect/cli/Flag"
 * import { Schema } from "effect"
 *
 * const ConfigSchema = Schema.Struct({
 *   port: Schema.Number,
 *   host: Schema.String
 * })
 *
 * const config = Flag.fileParse("config", ConfigSchema, "JSON")
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const fileParse = <A>(
  name: string,
  schema: Schema.Codec<A, string>,
  format?: string
): Flag<A> => asFlag(Param.fileParse(name, schema, "flag", format))

/**
 * Creates a flag that reads and validates file content using a schema (alias for fileParse).
 *
 * @since 4.0.0
 * @category constructors
 */
export const fileSchema = <A>(
  name: string,
  schema: Schema.Codec<A, string>,
  format?: string
): Flag<A> => asFlag(Param.fileSchema(name, schema, "flag", format))

/**
 * Creates a flag that parses key=value pairs.
 * Useful for options that accept configuration values.
 *
 * @example
 * ```ts
 * import * as Flag from "@effect/cli/Flag"
 *
 * const env = Flag.keyValueMap("env")
 * // --env FOO=bar will parse to { FOO: "bar" }
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const keyValueMap = (name: string): Flag<Record<string, string>> => asFlag(Param.keyValueMap(name, "flag"))

/**
 * Creates an empty sentinel flag that always fails to parse.
 * This is useful for creating placeholder flags or for combinators.
 *
 * @since 4.0.0
 * @category constructors
 */
export const none: Flag<never> = asFlag(Param.none("flag"))

/* -------------------------------------------------------------------------------------------------
 * combinators
 * -------------------------------------------------------------------------------------------------*/

export const withAlias: {
  <A>(alias: string): (self: Flag<A>) => Flag<A>
  <A>(self: Flag<A>, alias: string): Flag<A>
} = dual(2, <A>(self: Flag<A>, alias: string): Flag<A> => asFlag(Param.withAlias(self, alias)))

export const withDescription: {
  <A>(description: string): (self: Flag<A>) => Flag<A>
  <A>(self: Flag<A>, description: string): Flag<A>
} = dual(
  2,
  <A>(self: Flag<A>, description: string): Flag<A> => asFlag(Param.withDescription(self, description))
)

export const optional = <A>(param: Flag<A>): Flag<Option.Option<A>> => asFlag(Param.optional(param))

export const withDefault: {
  <A>(defaultValue: A): (self: Flag<A>) => Flag<A>
  <A>(self: Flag<A>, defaultValue: A): Flag<A>
} = dual(2, <A>(self: Flag<A>, defaultValue: A): Flag<A> => asFlag(Param.withDefault(self, defaultValue)))

export const map: {
  <A, B>(f: (a: A) => B): (self: Flag<A>) => Flag<B>
  <A, B>(self: Flag<A>, f: (a: A) => B): Flag<B>
} = dual(2, <A, B>(self: Flag<A>, f: (a: A) => B): Flag<B> => asFlag(Param.map(self, f)))

export const mapEffect: {
  <A, B>(
    f: (a: A) => Effect.Effect<B, CliError.CliError, Environment>
  ): (self: Flag<A>) => Flag<B>
  <A, B>(self: Flag<A>, f: (a: A) => Effect.Effect<B, CliError.CliError, FileSystem.FileSystem | Path.Path>): Flag<B>
} = dual(2, <A, B>(
  self: Flag<A>,
  f: (a: A) => Effect.Effect<B, CliError.CliError, FileSystem.FileSystem | Path.Path>
): Flag<B> => asFlag(Param.mapEffect(self, f)))

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
): Flag<B> => asFlag(Param.mapTryCatch(self, f, onError)))

export const repeated = <A>(flag: Flag<A>): Flag<ReadonlyArray<A>> => asFlag(Param.repeated(flag))

export const atLeast: {
  <A>(min: number): (self: Flag<A>) => Flag<ReadonlyArray<A>>
  <A>(self: Flag<A>, min: number): Flag<ReadonlyArray<A>>
} = dual(2, <A>(self: Flag<A>, min: number): Flag<ReadonlyArray<A>> => asFlag(Param.atLeast(self, min)))

export const atMost: {
  <A>(max: number): (self: Flag<A>) => Flag<ReadonlyArray<A>>
  <A>(self: Flag<A>, max: number): Flag<ReadonlyArray<A>>
} = dual(2, <A>(self: Flag<A>, max: number): Flag<ReadonlyArray<A>> => asFlag(Param.atMost(self, max)))

export const between: {
  <A>(min: number, max: number): (self: Flag<A>) => Flag<ReadonlyArray<A>>
  <A>(self: Flag<A>, min: number, max: number): Flag<ReadonlyArray<A>>
} = dual(
  3,
  <A>(self: Flag<A>, min: number, max: number): Flag<ReadonlyArray<A>> => asFlag(Param.between(self, min, max))
)

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
): Flag<B> => asFlag(Param.filterMap(self, f, onNone)))

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
): Flag<A> => asFlag(Param.filter(self, predicate, onFalse)))

export const withPseudoName: {
  <A>(pseudoName: string): (self: Flag<A>) => Flag<A>
  <A>(self: Flag<A>, pseudoName: string): Flag<A>
} = dual(2, <A>(self: Flag<A>, pseudoName: string): Flag<A> => asFlag(Param.withPseudoName(self, pseudoName)))

export const withSchema: {
  <A, B>(schema: Schema.Codec<B, A>): (self: Flag<A>) => Flag<B>
  <A, B>(self: Flag<A>, schema: Schema.Codec<B, A>): Flag<B>
} = dual(
  2,
  <A, B>(self: Flag<A>, schema: Schema.Codec<B, A>): Flag<B> => asFlag(Param.withSchema(self, schema))
)

export const orElse: {
  <B>(that: () => Flag<B>): <A>(self: Flag<A>) => Flag<A | B>
  <A, B>(self: Flag<A>, that: () => Flag<B>): Flag<A | B>
} = dual(2, <A, B>(self: Flag<A>, that: () => Flag<B>): Flag<A | B> => asFlag(Param.orElse(self, that)))

export const orElseEither: {
  <B>(that: () => Flag<B>): <A>(self: Flag<A>) => Flag<Result.Result<A, B>>
  <A, B>(self: Flag<A>, that: () => Flag<B>): Flag<Result.Result<A, B>>
} = dual(
  2,
  <A, B>(self: Flag<A>, that: () => Flag<B>): Flag<Result.Result<A, B>> => asFlag(Param.orElseEither(self, that))
)
