/**
 * @since 4.0.0
 */
import * as Option from "../../data/Option.ts"
import * as Predicate from "../../data/Predicate.ts"
import type * as Redacted from "../../data/Redacted.ts"
import * as Result from "../../data/Result.ts"
import * as Effect from "../../Effect.ts"
import type { LazyArg } from "../../Function.ts"
import { dual, identity } from "../../Function.ts"
import { type Pipeable, pipeArguments } from "../../interfaces/Pipeable.ts"
import type * as FileSystem from "../../platform/FileSystem.ts"
import type * as Path from "../../platform/Path.ts"
import * as Schema from "../../schema/Schema.ts"
import type { Covariant } from "../../types/Types.ts"
import * as CliError from "./CliError.ts"
import * as Primitive from "./Primitive.ts"

const TypeId = "~effect/cli/Param"

/**
 * @since 4.0.0
 * @category models
 */
export interface Param<Kind extends ParamKind, out A> extends Param.Variance<A> {
  readonly _tag: "Single" | "Map" | "MapEffect" | "Optional" | "Variadic"
  readonly kind: Kind
  readonly parse: Parse<A>
}

/**
 * @since 4.0.0
 * @category models
 */
export type ParamKind = "argument" | "flag"

/**
 * @since 4.0.0
 * @category constants
 */
export const Argument: "argument" = "argument" as const

/**
 * @since 4.0.0
 * @category constants
 */
export const Flag: "flag" = "flag" as const

/**
 * Represents any parameter.
 *
 * @since 4.0.0
 * @category models
 */
export type Any = Param<ParamKind, any>

/**
 * Represents any positional argument parameter.
 *
 * @since 4.0.0
 * @category models
 */
export type AnyArgument = Param<typeof Argument, any>

/**
 * Represents any flag parameter.
 *
 * @since 4.0.0
 * @category models
 */
export type AnyFlag = Param<typeof Flag, any>

/**
 * @since 4.0.0
 * @category models
 */
export type Parse<A> = (args: ParsedArgs) => Effect.Effect<
  readonly [leftover: ReadonlyArray<string>, value: A],
  CliError.CliError,
  FileSystem.FileSystem | Path.Path
>

/**
 * @since 4.0.0
 */
export declare namespace Param {
  /**
   * @since 4.0.0
   * @category models
   */
  export interface Variance<out A> extends Pipeable {
    readonly [TypeId]: VarianceStruct<A>
  }

  /**
   * @since 4.0.0
   * @category models
   */
  export interface VarianceStruct<out A> {
    readonly _A: Covariant<A>
  }
}

/**
 * Map of flag names to their provided string values.
 * Multiple occurrences of a flag produce multiple values.
 *
 * @since 4.0.0
 * @category models
 */
export type Flags = Record<string, ReadonlyArray<string>>

/**
 * Input context passed to `Param.parse` implementations.
 * - `flags`: already-collected flag values by canonical flag name
 * - `arguments`: remaining positional arguments to be consumed
 *
 * @since 4.0.0
 * @category models
 */
export interface ParsedArgs {
  readonly flags: Flags
  readonly arguments: ReadonlyArray<string>
}

/**
 * @since 4.0.0
 * @category models
 */
export interface Single<Kind extends ParamKind, out A> extends Param<Kind, A> {
  readonly _tag: "Single"
  readonly kind: Kind
  readonly name: string
  readonly description: string | undefined
  readonly aliases: ReadonlyArray<string>
  readonly primitiveType: Primitive.Primitive<A>
  readonly typeName?: string | undefined
}

/**
 * @since 4.0.0
 * @category models
 */
export interface Map<Kind extends ParamKind, in out A, out B> extends Param<Kind, B> {
  readonly _tag: "Map"
  readonly kind: Kind
  readonly param: Param<Kind, A>
  readonly f: (value: A) => B
}

/**
 * @since 4.0.0
 * @category models
 */
export interface MapEffect<Kind extends ParamKind, in out A, out B> extends Param<Kind, B> {
  readonly _tag: "MapEffect"
  readonly kind: Kind
  readonly param: Param<Kind, A>
  readonly f: (value: A) => Effect.Effect<B, CliError.CliError, FileSystem.FileSystem | Path.Path>
}

/**
 * @since 4.0.0
 * @category models
 */
export interface Optional<Kind extends ParamKind, A> extends Param<Kind, Option.Option<A>> {
  readonly _tag: "Optional"
  readonly kind: Kind
  readonly param: Param<Kind, A>
}

/**
 * @since 4.0.0
 * @category models
 */
export interface Variadic<Kind extends ParamKind, A> extends Param<Kind, ReadonlyArray<A>> {
  readonly _tag: "Variadic"
  readonly kind: Kind
  readonly param: Param<Kind, A>
  readonly min: number | undefined
  readonly max: number | undefined
}

const Proto = {
  [TypeId]: {
    _A: identity
  },
  pipe() {
    return pipeArguments(this, arguments)
  }
}

/**
 * Type guard to check if a value is a Param.
 *
 * @example
 * ```ts
 * import { Param } from "effect/unstable/cli"
 *
 * const maybeParam = Param.string(Param.Flag, "name")
 *
 * if (Param.isParam(maybeParam)) {
 *   console.log("This is a Param")
 * }
 * ```
 *
 * @since 4.0.0
 * @category refinements
 */
export const isParam = (u: unknown): u is Param<any, ParamKind> => Predicate.hasProperty(u, TypeId)

/**
 * Type guard to check if a param is a Single param (not composed).
 *
 * @example
 * ```ts
 * import { Param } from "effect/unstable/cli"
 *
 * const nameParam = Param.string(Param.Flag, "name")
 * const optionalParam = Param.optional(nameParam)
 *
 * console.log(Param.isSingle(nameParam))    // true
 * console.log(Param.isSingle(optionalParam)) // false
 * ```
 *
 * @since 4.0.0
 * @category refinements
 */
export const isSingle = <const Kind extends ParamKind, A>(
  param: Param<Kind, A>
): param is Single<Kind, A> => Predicate.isTagged(param, "Single")

/**
 * @since 4.0.0
 * @category constructors
 */
export const makeSingle = <const Kind extends ParamKind, A>(params: {
  readonly kind: Kind
  readonly name: string
  readonly primitiveType: Primitive.Primitive<A>
  readonly typeName?: string | undefined
  readonly description?: string | undefined
  readonly aliases?: ReadonlyArray<string> | undefined
}): Single<Kind, A> => {
  const parse: Parse<A> = (args) =>
    params.kind === Argument
      ? parsePositional(params.name, params.primitiveType, args)
      : parseOption(params.name, params.primitiveType, args)
  return Object.assign(Object.create(Proto), {
    _tag: "Single",
    ...params,
    description: params.description,
    aliases: params.aliases ?? [],
    parse
  })
}

/**
 * Creates a string parameter.
 *
 * @example
 * ```ts
 * import { Param } from "effect/unstable/cli"
 *
 * // Create a string flag
 * const nameFlag = Param.string(Param.Flag, "name")
 *
 * // Create a string argument
 * const fileArg = Param.string(Param.Argument, "file")
 *
 * // Usage in CLI: --name "John Doe" or as positional argument
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const string = <const Kind extends ParamKind>(
  kind: Kind,
  name: string
): Param<Kind, string> =>
  makeSingle({
    name,
    primitiveType: Primitive.string,
    kind
  })

/**
 * Creates a boolean parameter.
 *
 * @example
 * ```ts
 * import { Param } from "effect/unstable/cli"
 *
 * // Create a boolean flag
 * const verboseFlag = Param.boolean(Param.Flag, "verbose")
 *
 * // Create a boolean argument
 * const enableArg = Param.boolean(Param.Argument, "enable")
 *
 * // Usage in CLI: --verbose (defaults to true when present, false when absent)
 * // or as positional: true/false
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const boolean = <const Kind extends ParamKind>(
  kind: Kind,
  name: string
): Param<Kind, boolean> =>
  makeSingle({
    name,
    primitiveType: Primitive.boolean,
    kind
  })

/**
 * Creates an integer parameter.
 *
 * @example
 * ```ts
 * import { Param } from "effect/unstable/cli"
 *
 * // Create an integer flag
 * const portFlag = Param.integer(Param.Flag, "port")
 *
 * // Create an integer argument
 * const countArg = Param.integer(Param.Argument, "count")
 *
 * // Usage in CLI: --port 8080 or as positional argument: 42
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const integer = <const Kind extends ParamKind>(
  kind: Kind,
  name: string
): Param<Kind, number> =>
  makeSingle({
    name,
    primitiveType: Primitive.integer,
    kind
  })

/**
 * Creates a floating-point number parameter.
 *
 * @example
 * ```ts
 * import { Param } from "effect/unstable/cli"
 *
 * // Create a float flag
 * const rateFlag = Param.float(Param.Flag, "rate")
 *
 * // Create a float argument
 * const thresholdArg = Param.float(Param.Argument, "threshold")
 *
 * // Usage in CLI: --rate 0.95 or as positional argument: 3.14159
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const float = <const Kind extends ParamKind>(
  kind: Kind,
  name: string
): Param<Kind, number> =>
  makeSingle({
    name,
    primitiveType: Primitive.float,
    kind
  })

/**
 * Creates a date parameter that parses ISO date strings.
 *
 * @example
 * ```ts
 * import { Param } from "effect/unstable/cli"
 *
 * // Create a date flag
 * const startFlag = Param.date(Param.Flag, "start-date")
 *
 * // Create a date argument
 * const dueDateArg = Param.date(Param.Argument, "due-date")
 *
 * // Usage in CLI: --start-date "2023-12-25" or as positional: "2023-01-01"
 * // Parses to JavaScript Date object
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const date = <const Kind extends ParamKind>(
  kind: Kind,
  name: string
): Param<Kind, Date> =>
  makeSingle({
    name,
    primitiveType: Primitive.date,
    kind
  })

/**
 * Constructs command-line params that represent a choice between several
 * inputs. The input will be mapped to it's associated value during parsing.
 *
 * @example
 * ```ts
 * import { Param } from "effect/unstable/cli"
 *
 * type Animal = Dog | Cat
 *
 * interface Dog {
 *   readonly _tag: "Dog"
 * }
 *
 * interface Cat {
 *   readonly _tag: "Cat"
 * }
 *
 * const animal = Param.choiceWithValue(Param.Flag, "animal", [
 *   ["dog", { _tag: "Dog" }],
 *   ["cat", { _tag: "Cat" }]
 * ])
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const choiceWithValue = <
  const Kind extends ParamKind,
  const Choices extends ReadonlyArray<readonly [string, any]>
>(kind: Kind, name: string, choices: Choices): Param<Kind, Choices[number][1]> =>
  makeSingle({
    name,
    primitiveType: Primitive.choice(choices),
    kind
  })

/**
 * Constructs command-line params that represent a choice between several
 * string inputs.
 *
 * @example
 * ```ts
 * import { Param } from "effect/unstable/cli"
 *
 * const logLevel = Param.choice(Param.Flag, "log-level", [
 *   "debug",
 *   "info",
 *   "warn",
 *   "error"
 * ])
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const choice = <
  const Kind extends ParamKind,
  const Choices extends ReadonlyArray<string>
>(kind: Kind, name: string, choices: Choices): Param<Kind, Choices[number]> => {
  const mappedChoices = choices.map((value) => [value, value] as const)
  return choiceWithValue(kind, name, mappedChoices)
}

/**
 * Creates a path parameter that accepts file or directory paths.
 *
 * @example
 * ```ts
 * import { Param } from "effect/unstable/cli"
 *
 * // Basic path parameter
 * const outputPath = Param.path(Param.Flag, "output")
 *
 * // Path that must exist
 * const inputPath = Param.path(Param.Flag, "input", { mustExist: true })
 *
 * // File-only path
 * const configFile = Param.path(Param.Flag, "config", {
 *   pathType: "file",
 *   mustExist: true,
 *   typeName: "config-file"
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const path = <Kind extends ParamKind>(
  kind: Kind,
  name: string,
  options?: {
    readonly pathType?: Primitive.PathType | undefined
    readonly mustExist?: boolean | undefined
    readonly typeName?: string | undefined
  }
): Param<Kind, string> =>
  makeSingle({
    name,
    kind,
    primitiveType: Primitive.path(options?.pathType ?? "either", options?.mustExist),
    typeName: options?.typeName
  })

/**
 * Creates a directory path parameter.
 *
 * This is a convenience function that creates a path parameter with the
 * `pathType` set to `"directory"` and a default type name of `"directory"`.
 *
 * @example
 * ```ts
 * import { Param } from "effect/unstable/cli"
 *
 * // Basic directory parameter
 * const outputDir = Param.directory(Param.Flag, "output-dir")
 *
 * // Directory that must exist
 * const sourceDir = Param.directory(Param.Flag, "source", { mustExist: true })
 *
 * // Usage: --output-dir /path/to/dir --source /existing/dir
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const directory = <Kind extends ParamKind>(
  kind: Kind,
  name: string,
  options?: {
    readonly mustExist?: boolean | undefined
  }
): Param<Kind, string> =>
  path(kind, name, {
    pathType: "directory",
    typeName: "directory",
    mustExist: options?.mustExist
  })

/**
 * Creates a file path parameter.
 *
 * This is a convenience function that creates a path parameter with a
 * `pathType` set to `"file"` and a default type name of `"file"`.
 *
 * @example
 * ```ts
 * import { Param } from "effect/unstable/cli"
 *
 * // Basic file parameter
 * const outputFile = Param.file(Param.Flag, "output")
 *
 * // File that must exist
 * const inputFile = Param.file(Param.Flag, "input", { mustExist: true })
 *
 * // Usage: --output result.txt --input existing-file.txt
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const file = <Kind extends ParamKind>(
  kind: Kind,
  name: string,
  options?: {
    readonly mustExist?: boolean | undefined
  }
): Param<Kind, string> =>
  path(kind, name, {
    pathType: "file",
    typeName: "file",
    mustExist: options?.mustExist
  })

/**
 * Creates a redacted parameter for sensitive data like passwords.
 * The value is masked in help output and logging.
 *
 * @example
 * ```ts
 * import { Param } from "effect/unstable/cli"
 *
 * // Create a password parameter
 * const password = Param.redacted(Param.Flag, "password")
 *
 * // Create an API key argument
 * const apiKey = Param.redacted(Param.Argument, "api-key")
 *
 * // Usage: --password (value will be hidden in help/logs)
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const redacted = <Kind extends ParamKind>(
  kind: Kind,
  name: string
): Param<Kind, Redacted.Redacted<string>> =>
  makeSingle({
    name,
    primitiveType: Primitive.redacted,
    kind
  })

/**
 * Creates a parameter that reads and returns file content as a string.
 *
 * @example
 * ```ts
 * import { Param } from "effect/unstable/cli"
 *
 * // Read a config file as string
 * const configContent = Param.fileString(Param.Flag, "config")
 *
 * // Read a template file as argument
 * const templateContent = Param.fileString(Param.Argument, "template")
 *
 * // Usage: --config config.txt (reads file content into string)
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const fileString = <Kind extends ParamKind>(kind: Kind, name: string): Param<Kind, string> =>
  makeSingle({
    name,
    primitiveType: Primitive.fileString,
    kind
  })

/**
 * Creates a param that reads and parses the content of the specified file.
 *
 * The parser that is utilized will depend on the specified `format`, or the
 * extension of the file passed on the command-line if no `format` is specified.
 *
 * @example
 * ```ts
 * import { Param } from "effect/unstable/cli"
 *
 * // Will use the extension of the file passed on the command line to determine
 * // the parser to use
 * const config = Param.fileParse(Param.Flag, "config")
 *
 * // Will use the JSON parser
 * const jsonConfig = Param.fileParse(Param.Flag, "json-config", { format: "json" })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const fileParse = <Kind extends ParamKind>(
  kind: Kind,
  name: string,
  options?: Primitive.FileParseOptions | undefined
): Param<Kind, unknown> =>
  makeSingle({
    name,
    primitiveType: Primitive.fileParse(options),
    kind
  })

/**
 * Creates a parameter that reads and validates file content using a schema.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 * import { Param } from "effect/unstable/cli"
 *
 * // Parse JSON config file
 * const configSchema = Schema.Struct({
 *   port: Schema.Number,
 *   host: Schema.String
 * }).pipe(Schema.fromJsonString)
 *
 * const config = Param.fileSchema(Param.Flag, "config", configSchema, {
 *   format: "json"
 * })
 *
 * // Parse YAML file
 * const yamlConfig = Param.fileSchema(Param.Flag, "config", configSchema, {
 *   format: "yaml"
 * })
 *
 * // Usage: --config config.json (reads and validates file content)
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const fileSchema = <Kind extends ParamKind, A>(
  kind: Kind,
  name: string,
  schema: Schema.Codec<A, string>,
  options?: Primitive.FileSchemaOptions | undefined
): Param<Kind, A> =>
  makeSingle({
    name,
    primitiveType: Primitive.fileSchema(schema, options),
    kind
  })

/**
 * Creates a param that parses key=value pairs.
 * Useful for options that accept configuration values.
 *
 * @example
 * ```ts
 * import { Param } from "effect/unstable/cli"
 *
 * const env = Param.keyValueMap(Param.Flag, "env")
 * // --env FOO=bar --env BAZ=qux will parse to { FOO: "bar", BAZ: "qux" }
 *
 * const props = Param.keyValueMap(Param.Flag, "property")
 * // --property name=value --property debug=true
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const keyValueMap = <Kind extends ParamKind>(
  kind: Kind,
  name: string
): Param<Kind, Record<string, string>> =>
  map(
    variadic(
      makeSingle({
        name,
        primitiveType: Primitive.keyValueMap,
        kind
      }),
      { min: 1 }
    ),
    (objects) => Object.assign({}, ...objects)
  )

/**
 * Creates an empty sentinel parameter that always fails to parse.
 *
 * This is useful for creating placeholder parameters or for combinators.
 *
 * @example
 * ```ts
 * import { Param } from "effect/unstable/cli"
 *
 * // Create a none parameter for composition
 * const noneParam = Param.none(Param.Flag)
 *
 * // Often used in conditional parameter creation
 * const conditionalParam = process.env.NODE_ENV === "production"
 *   ? Param.string(Param.Flag, "my-dev-flag")
 *   : Param.none(Param.Flag)
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const none = <Kind extends ParamKind>(kind: Kind): Param<Kind, never> =>
  makeSingle({
    name: "__none__",
    primitiveType: Primitive.none,
    kind
  })

const FLAG_DASH_REGEX = /^-+/

/**
 * Adds an alias to an option.
 *
 * Aliases allow params to be specified with alternative names,
 * typically single-character shortcuts like "-f" for "--force".
 *
 * This works on any param structure by recursively finding the underlying
 * `Single` node and applying the alias there.
 *
 * @example
 * ```ts
 * import { Param } from "effect/unstable/cli"
 *
 * const force = Param.boolean(Param.Flag, "force").pipe(
 *   Param.withAlias("-f"),
 *   Param.withAlias("--no-prompt")
 * )
 *
 * // Also works on composed params:
 * const count = Param.integer(Param.Flag, "count").pipe(
 *   Param.optional,
 *   Param.withAlias("-c")  // finds the underlying Single and adds alias
 * )
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const withAlias: {
  <Kind extends ParamKind, A>(alias: string): (self: Param<Kind, A>) => Param<Kind, A>
  <Kind extends ParamKind, A>(self: Param<Kind, A>, alias: string): Param<Kind, A>
} = dual(2, <Kind extends ParamKind, A>(self: Param<Kind, A>, alias: string) => {
  return transformSingle(self, <X>(single: Single<Kind, X>) =>
    makeSingle({
      ...single,
      aliases: [...single.aliases, alias.replace(FLAG_DASH_REGEX, "")]
    }))
})

/**
 * Adds a description to an option for help text.
 *
 * Descriptions provide users with information about what the option does
 * when they view help documentation.
 *
 * @example
 * ```ts
 * import { Param } from "effect/unstable/cli"
 *
 * const verbose = Param.boolean(Param.Flag, "verbose").pipe(
 *   Param.withAlias("-v"),
 *   Param.withDescription("Enable verbose output")
 * )
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const withDescription: {
  <Kind extends ParamKind, A>(description: string): (self: Param<Kind, A>) => Param<Kind, A>
  <Kind extends ParamKind, A>(self: Param<Kind, A>, description: string): Param<Kind, A>
} = dual(2, <Kind extends ParamKind, A>(self: Param<Kind, A>, description: string) => {
  return transformSingle(self, <X>(single: Single<Kind, X>) =>
    makeSingle({
      ...single,
      description
    }))
})

/**
 * Transforms the parsed value of an option using a mapping function.
 *
 * @example
 * ```ts
 * import { Param } from "effect/unstable/cli"
 *
 * const port = Param.integer(Param.Flag, "port").pipe(
 *   Param.map(n => ({ port: n, url: `http://localhost:${n}` }))
 * )
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const map: {
  <A, B>(f: (a: A) => B): <Kind extends ParamKind>(self: Param<Kind, A>) => Param<Kind, B>
  <Kind extends ParamKind, A, B>(self: Param<Kind, A>, f: (a: A) => B): Param<Kind, B>
} = dual(2, <Kind extends ParamKind, A, B>(self: Param<Kind, A>, f: (a: A) => B) => {
  const parse: Parse<B> = (args: ParsedArgs) =>
    Effect.map(
      self.parse(args),
      ([operands, value]) => [operands, f(value)] as const
    )
  return Object.assign(Object.create(Proto), {
    _tag: "Map",
    kind: self.kind,
    param: self,
    f,
    parse
  })
})

/**
 * Transforms the parsed value of an option using an effectful mapping function.
 *
 * @example
 * ```ts
 * import { Param, CliError } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * const validatedEmail = Param.string(Param.Flag, "email").pipe(
 *   Param.mapEffect(email =>
 *     email.includes("@")
 *       ? Effect.succeed(email)
 *       : Effect.fail(new CliError.InvalidValue({
 *         option: "email",
 *         value: email,
 *         expected: "valid email format"
 *       }))
 *   )
 * )
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const mapEffect: {
  <A, B>(
    f: (a: A) => Effect.Effect<B, CliError.CliError, FileSystem.FileSystem | Path.Path>
  ): <Kind extends ParamKind>(self: Param<Kind, A>) => Param<Kind, B>
  <Kind extends ParamKind, A, B>(
    self: Param<Kind, A>,
    f: (a: A) => Effect.Effect<B, CliError.CliError, FileSystem.FileSystem | Path.Path>
  ): Param<Kind, B>
} = dual(2, <Kind extends ParamKind, A, B>(
  self: Param<Kind, A>,
  f: (a: A) => Effect.Effect<B, CliError.CliError, FileSystem.FileSystem | Path.Path>
) => {
  const parse: Parse<B> = (args) =>
    Effect.flatMap(
      self.parse(args),
      ([operands, a]) => Effect.map(f(a), (b) => [operands, b] as const)
    )
  return Object.assign(Object.create(Proto), {
    _tag: "MapEffect",
    kind: self.kind,
    param: self,
    f,
    parse
  })
})

/**
 * Transforms the parsed value of an option using a function that may throw,
 * converting any thrown errors into failure messages.
 *
 * @example
 * ```ts
 * import { Param } from "effect/unstable/cli"
 *
 * const parsedJson = Param.string(Param.Flag, "config").pipe(
 *   Param.mapTryCatch(
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
  ): <Kind extends ParamKind>(self: Param<Kind, A>) => Param<Kind, B>
  <Kind extends ParamKind, A, B>(
    self: Param<Kind, A>,
    f: (a: A) => B,
    onError: (error: unknown) => string
  ): Param<Kind, B>
} = dual(3, <Kind extends ParamKind, A, B>(
  self: Param<Kind, A>,
  f: (a: A) => B,
  onError: (error: unknown) => string
) => {
  const parse: Parse<B> = (args) =>
    Effect.flatMap(self.parse(args), ([leftover, a]) =>
      Effect.try({
        try: () => f(a),
        catch: (error) => onError(error)
      }).pipe(
        Effect.mapError(
          (error) =>
            new CliError.InvalidValue({
              option: "unknown",
              value: String(a),
              expected: error
            })
        ),
        Effect.map((b) => [leftover, b] as const)
      ))
  return Object.assign(Object.create(Proto), {
    _tag: "MapEffect",
    kind: self.kind,
    param: self,
    f: (a: A) =>
      Effect.orDie(
        Effect.try({
          try: () => f(a),
          catch: (error) => onError(error)
        })
      ),
    parse
  })
})

/**
 * Creates an optional option that returns None when not provided.
 *
 * Optional options never fail with MissingOption errors. If the option is not
 * provided on the command line, Option.none() is returned instead.
 *
 * @example
 * ```ts
 * import { Param } from "effect/unstable/cli"
 *
 * // Create an optional port option
 * // - When not provided: returns Option.none()
 * // - When provided: returns Option.some(parsedValue)
 * const port = Param.optional(Param.integer(Param.Flag, "port"))
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const optional = <Kind extends ParamKind, A>(
  param: Param<Kind, A>
): Param<Kind, Option.Option<A>> => {
  const parse: Parse<Option.Option<A>> = (args) =>
    param.parse(args).pipe(
      Effect.map(
        ([leftover, value]) => [leftover, Option.some(value)] as const
      ),
      Effect.catchTag("MissingOption", () => Effect.succeed([args.arguments, Option.none()] as const))
    )
  return Object.assign(Object.create(Proto), {
    _tag: "Optional",
    kind: param.kind,
    param,
    parse
  })
}

/**
 * Makes an option optional by providing a default value.
 *
 * This combinator is useful when you want to make an existing option optional
 * by providing a fallback value that will be used when the option is not
 * provided on the command line.
 *
 * @example
 * ```ts
 * import { Param } from "effect/unstable/cli"
 *
 * // Using the pipe operator to make an option optional
 * const port = Param.integer(Param.Flag, "port").pipe(
 *   Param.withDefault(8080)
 * )
 *
 * // Can also be used with other combinators
 * const verbose = Param.boolean(Param.Flag, "verbose").pipe(
 *   Param.withAlias("-v"),
 *   Param.withDescription("Enable verbose output"),
 *   Param.withDefault(false)
 * )
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const withDefault: {
  <A>(defaultValue: A): <Kind extends ParamKind>(self: Param<Kind, A>) => Param<Kind, A>
  <Kind extends ParamKind, A>(self: Param<Kind, A>, defaultValue: A): Param<Kind, A>
} = dual(2, <Kind extends ParamKind, A>(
  self: Param<Kind, A>,
  defaultValue: A
) => map(optional(self), Option.getOrElse(() => defaultValue)))

/**
 * Represent options which can be used to configure variadic parameters.
 *
 * @since 4.0.0
 * @category models
 */
export type VariadicParamOptions = {
  /**
   * The minimum number of times the parameter can be specified.
   */
  readonly min?: number | undefined
  /**
   * The maximum number of times the parameter can be specified.
   */
  readonly max?: number | undefined
}

/**
 * Creates a variadic parameter that can be specified multiple times.
 *
 * This is the base combinator for creating parameters that accept multiple values.
 * The min and max parameters are optional - if not provided, the parameter can be
 * specified any number of times (0 to infinity).
 *
 * @example
 * ```ts
 * import { Param } from "effect/unstable/cli"
 *
 * // Basic variadic parameter (0 to infinity)
 * const tags = Param.variadic(Param.string(Param.Flag, "tag"))
 *
 * // Variadic with minimum count
 * const inputs = Param.variadic(
 *   Param.string(Param.Flag, "input"),
 *   { min: 1 }  // at least 1 required
 * )
 *
 * // Variadic with both min and max
 * const limited = Param.variadic(Param.string(Param.Flag, "item"), {
 *   min: 2, // at least 2 times
 *   max: 2, // at most 5 times
 * })
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const variadic = <Kind extends ParamKind, A>(
  self: Param<Kind, A>,
  options?: VariadicParamOptions | undefined
): Param<Kind, ReadonlyArray<A>> => {
  const single = getUnderlyingSingleOrThrow(self)
  const parse: Parse<ReadonlyArray<A>> = (args) => {
    if (single.kind === "argument") {
      return parsePositionalVariadic(self, single, args, options)
    } else {
      return parseOptionVariadic(self, single, args, options)
    }
  }
  return Object.assign(Object.create(Proto), {
    _tag: "Variadic",
    kind: self.kind,
    param: self,
    min: options?.min,
    max: options?.max,
    parse
  })
}

/**
 * Wraps an option to allow it to be specified multiple times within a range.
 *
 * This combinator transforms an option to accept between `min` and `max`
 * occurrences on the command line, returning an array of all provided values.
 *
 * @example
 * ```ts
 * import { Param } from "effect/unstable/cli"
 *
 * // Allow 1-3 file inputs
 * const files = Param.string(Param.Flag, "file").pipe(
 *   Param.between(1, 3),
 *   Param.withAlias("-f")
 * )
 *
 * // Parse: --file a.txt --file b.txt
 * // Result: ["a.txt", "b.txt"]
 *
 * // Allow 0 or more tags
 * const tags = Param.string(Param.Flag, "tag").pipe(
 *   Param.between(0, Number.MAX_SAFE_INTEGER)
 * )
 *
 * // Parse: --tag dev --tag staging --tag v1.0
 * // Result: ["dev", "staging", "v1.0"]
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const between: {
  <A>(min: number, max: number): <Kind extends ParamKind>(self: Param<Kind, A>) => Param<Kind, ReadonlyArray<A>>
  <Kind extends ParamKind, A>(self: Param<Kind, A>, min: number, max: number): Param<Kind, ReadonlyArray<A>>
} = dual(3, <Kind extends ParamKind, A>(self: Param<Kind, A>, min: number, max: number) => {
  if (min < 0) {
    throw new Error("between: min must be non-negative")
  }
  if (max < min) {
    throw new Error("between: max must be greater than or equal to min")
  }

  return variadic(self, { min, max })
})

/**
 * Wraps an option to allow it to be specified multiple times without limit.
 *
 * This combinator transforms an option to accept any number of occurrences
 * on the command line, returning an array of all provided values.
 *
 * @example
 * ```ts
 * import { Param } from "effect/unstable/cli"
 *
 * // Allow unlimited file inputs
 * const files = Param.string(Param.Flag, "file").pipe(
 *   Param.repeated,
 *   Param.withAlias("-f")
 * )
 *
 * // Parse: --file a.txt --file b.txt --file c.txt --file d.txt
 * // Result: ["a.txt", "b.txt", "c.txt", "d.txt"]
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const repeated = <Kind extends ParamKind, A>(
  self: Param<Kind, A>
): Param<Kind, ReadonlyArray<A>> => variadic(self)

/**
 * Wraps an option to allow it to be specified at most `max` times.
 *
 * This combinator transforms an option to accept between 0 and `max`
 * occurrences on the command line, returning an array of all provided values.
 *
 * @example
 * ```ts
 * import { Param } from "effect/unstable/cli"
 *
 * // Allow at most 3 warning suppressions
 * const suppressions = Param.string(Param.Flag, "suppress").pipe(
 *   Param.atMost(3)
 * )
 *
 * // Parse: --suppress warning1 --suppress warning2
 * // Result: ["warning1", "warning2"]
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const atMost: {
  <A>(max: number): <Kind extends ParamKind>(self: Param<Kind, A>) => Param<Kind, ReadonlyArray<A>>
  <Kind extends ParamKind, A>(self: Param<Kind, A>, max: number): Param<Kind, ReadonlyArray<A>>
} = dual(2, <Kind extends ParamKind, A>(self: Param<Kind, A>, max: number) => {
  if (max < 0) {
    throw new Error("atMost: max must be non-negative")
  }
  return variadic(self, { max })
})

/**
 * Wraps an option to require it to be specified at least `min` times.
 *
 * This combinator transforms an option to accept at least `min`
 * occurrences on the command line, returning an array of all provided values.
 *
 * @example
 * ```ts
 * import { Param } from "effect/unstable/cli"
 *
 * // Require at least 2 input files
 * const inputs = Param.string(Param.Flag, "input").pipe(
 *   Param.atLeast(2),
 *   Param.withAlias("-i")
 * )
 *
 * // Parse: --input file1.txt --input file2.txt --input file3.txt
 * // Result: ["file1.txt", "file2.txt", "file3.txt"]
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const atLeast: {
  <A>(min: number): <Kind extends ParamKind>(self: Param<Kind, A>) => Param<Kind, ReadonlyArray<A>>
  <Kind extends ParamKind, A>(self: Param<Kind, A>, min: number): Param<Kind, ReadonlyArray<A>>
} = dual(2, <Kind extends ParamKind, A>(self: Param<Kind, A>, min: number) => {
  if (min < 0) {
    throw new Error("atLeast: min must be non-negative")
  }
  return variadic(self, { min })
})

/**
 * Filters and transforms parsed values, failing with a custom error message
 * if the filter function returns None.
 *
 * This combinator is useful for validation and transformation in a single step.
 *
 * @example
 * ```ts
 * import { Option } from "effect/data"
 * import { Param } from "effect/unstable/cli"
 *
 * const positiveInt = Param.integer(Param.Flag, "count").pipe(
 *   Param.filterMap(
 *     (n) => n > 0 ? Option.some(n) : Option.none(),
 *     (n) => `Expected positive integer, got ${n}`
 *   )
 * )
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const filterMap: {
  <A, B>(
    filter: (a: A) => Option.Option<B>,
    onNone: (a: A) => string
  ): <Kind extends ParamKind>(self: Param<Kind, A>) => Param<Kind, B>
  <Kind extends ParamKind, A, B>(
    self: Param<Kind, A>,
    filter: (a: A) => Option.Option<B>,
    onNone: (a: A) => string
  ): Param<Kind, B>
} = dual(3, <Kind extends ParamKind, A, B>(
  self: Param<Kind, A>,
  filter: (a: A) => Option.Option<B>,
  onNone: (a: A) => string
) =>
  mapEffect(
    self,
    Effect.fnUntraced(function*(a) {
      const result = filter(a)
      if (Option.isSome(result)) {
        return result.value
      }
      const single = getUnderlyingSingleOrThrow(self)
      return yield* new CliError.InvalidValue({
        option: single.name,
        value: String(a),
        expected: onNone(a)
      })
    })
  ))

/**
 * Filters parsed values, failing with a custom error message if the predicate returns false.
 *
 * @example
 * ```ts
 * import { Param } from "effect/unstable/cli"
 *
 * const evenNumber = Param.integer(Param.Flag, "num").pipe(
 *   Param.filter(
 *     n => n % 2 === 0,
 *     n => `Expected even number, got ${n}`
 *   )
 * )
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const filter: {
  <A>(
    predicate: Predicate.Predicate<A>,
    onFalse: (a: A) => string
  ): <Kind extends ParamKind>(self: Param<Kind, A>) => Param<Kind, A>
  <Kind extends ParamKind, A>(
    self: Param<Kind, A>,
    predicate: Predicate.Predicate<A>,
    onFalse: (a: A) => string
  ): Param<Kind, A>
} = dual(3, <Kind extends ParamKind, A>(
  self: Param<Kind, A>,
  predicate: Predicate.Predicate<A>,
  onFalse: (a: A) => string
) => filterMap(self, Option.liftPredicate(predicate), onFalse))

/**
 * Sets a custom display name for the param type in help documentation.
 *
 * This is useful when you want to override the default type name shown in help text.
 *
 * @example
 * ```ts
 * import { Param } from "effect/unstable/cli"
 *
 * const port = Param.integer(Param.Flag, "port").pipe(
 *   Param.withPseudoName("PORT"),
 *   Param.filter(p => p >= 1 && p <= 65535, () => "Port must be between 1 and 65535")
 * )
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const withPseudoName: {
  <K extends ParamKind>(pseudoName: string): <A>(self: Param<K, A>) => Param<K, A>
  <K extends ParamKind, A>(self: Param<K, A>, pseudoName: string): Param<K, A>
} = dual(2, <K extends ParamKind, A>(
  self: Param<K, A>,
  pseudoName: string
) =>
  transformSingle(self, (single) =>
    makeSingle({
      ...single,
      typeName: pseudoName
    })))

/**
 * Validates parsed values against a Schema, providing detailed error messages.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 * import { Param } from "effect/unstable/cli"
 *
 * const isEmail = Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
 *
 * const Email = Schema.String.pipe(
 *   Schema.check(isEmail)
 * )
 *
 * const email = Param.string(Param.Flag, "email").pipe(
 *   Param.withSchema(Email)
 * )
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const withSchema: {
  <A, B>(schema: Schema.Codec<B, A>): <Kind extends ParamKind>(self: Param<Kind, A>) => Param<Kind, B>
  <Kind extends ParamKind, A, B>(self: Param<Kind, A>, schema: Schema.Codec<B, A>): Param<Kind, B>
} = dual(2, <Kind extends ParamKind, A, B>(
  self: Param<Kind, A>,
  schema: Schema.Codec<B, A>
) => {
  const decodeParam = Schema.decodeUnknownEffect(schema)
  return mapEffect(self, (value) =>
    Effect.mapError(decodeParam(value), (error) => {
      const single = getUnderlyingSingleOrThrow(self)
      return new CliError.InvalidValue({
        option: single.name,
        value: String(value),
        expected: `Schema validation failed: ${error.message}`
      })
    }))
})

/**
 * Provides a fallback param to use if this param fails to parse.
 *
 * @example
 * ```ts
 * import { Param } from "effect/unstable/cli"
 *
 * const config = Param.file(Param.Flag, "config").pipe(
 *   Param.orElse(() => Param.string(Param.Flag, "config-url"))
 * )
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const orElse: {
  <B, Kind extends ParamKind>(orElse: LazyArg<Param<Kind, B>>): <A>(self: Param<Kind, A>) => Param<Kind, A | B>
  <Kind extends ParamKind, A, B>(
    self: Param<Kind, A>,
    orElse: LazyArg<Param<Kind, B>>
  ): Param<Kind, A | B>
} = dual(2, <Kind extends ParamKind, A, B>(
  self: Param<Kind, A>,
  orElse: LazyArg<Param<Kind, B>>
) => {
  const parse: Parse<A | B> = (args) => Effect.catch(self.parse(args), () => orElse().parse(args))
  return Object.assign(Object.create(Proto), {
    _tag: "MapEffect",
    kind: self.kind,
    parse
  })
})

/**
 * Provides a fallback param, wrapping results in Either to distinguish which param succeeded.
 *
 * @example
 * ```ts
 * import { Param } from "effect/unstable/cli"
 *
 * const configSource = Param.file(Param.Flag, "config").pipe(
 *   Param.orElseResult(() => Param.string(Param.Flag, "config-url"))
 * )
 * // Returns Result<string, string>
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const orElseResult: {
  <Kind extends ParamKind, B>(
    orElse: LazyArg<Param<Kind, B>>
  ): <A>(self: Param<Kind, A>) => Param<Kind, Result.Result<A, B>>
  <Kind extends ParamKind, A, B>(
    self: Param<Kind, A>,
    orElse: LazyArg<Param<Kind, B>>
  ): Param<Kind, Result.Result<A, B>>
} = dual(2, <Kind extends ParamKind, A, B>(
  self: Param<Kind, A>,
  orElse: LazyArg<Param<Kind, B>>
) => {
  const parse: Parse<Result.Result<A, B>> = (args) =>
    self.parse(args).pipe(
      Effect.map(([leftover, value]) => [leftover, Result.succeed(value)] as const),
      Effect.catch(() =>
        Effect.map(
          orElse().parse(args),
          ([leftover, value]) => [leftover, Result.fail(value)] as const
        )
      )
    )
  return Object.assign(Object.create(Proto), {
    _tag: "MapEffect",
    kind: self.kind,
    parse
  })
})

// =============================================================================
// Parsing Utilities
// =============================================================================

const parsePositional: <A>(
  name: string,
  primitiveType: Primitive.Primitive<A>,
  args: ParsedArgs
) => Effect.Effect<
  readonly [leftover: ReadonlyArray<string>, value: A],
  CliError.CliError,
  FileSystem.FileSystem | Path.Path
> = Effect.fnUntraced(function*(name, primitiveType, args) {
  if (args.arguments.length === 0) {
    return yield* new CliError.MissingArgument({ argument: name })
  }

  const arg = args.arguments[0]
  const value = yield* Effect.mapError(
    primitiveType.parse(arg),
    (error) =>
      new CliError.InvalidValue({
        option: name,
        value: arg,
        expected: error
      })
  )

  return [args.arguments.slice(1), value] as const
})

const parseOption: <A>(
  name: string,
  primitiveType: Primitive.Primitive<A>,
  args: ParsedArgs
) => Effect.Effect<
  readonly [remainingOperands: ReadonlyArray<string>, value: A],
  CliError.CliError,
  FileSystem.FileSystem | Path.Path
> = Effect.fnUntraced(function*(name, primitiveType, args) {
  const providedValues = args.flags[name]

  if (providedValues === undefined || providedValues.length === 0) {
    // Option not provided (empty array due to initialization)
    if (primitiveType._tag === "Boolean") {
      // Boolean params default to false when not present
      return [args.arguments, false as any] as const
    } else {
      return yield* new CliError.MissingOption({ option: name })
    }
  }

  // Parse the first value (later we can handle multiple)
  const arg = providedValues[0]
  const value = yield* Effect.mapError(
    primitiveType.parse(arg),
    (error) =>
      new CliError.InvalidValue({
        option: name,
        value: arg,
        expected: error
      })
  )

  return [args.arguments, value] as const
})

const parsePositionalVariadic: <Kind extends ParamKind, A>(
  self: Param<Kind, A>,
  single: Single<Kind, A>,
  args: ParsedArgs,
  options?: VariadicParamOptions | undefined
) => Effect.Effect<
  readonly [remainingOperands: ReadonlyArray<string>, value: ReadonlyArray<A>],
  CliError.CliError,
  FileSystem.FileSystem | Path.Path
> = Effect.fnUntraced(function*<A, Kind extends ParamKind>(
  self: Param<Kind, A>,
  single: Single<Kind, A>,
  args: ParsedArgs,
  options?: VariadicParamOptions | undefined
) {
  const results: Array<A> = []
  const minValue = options?.min ?? 0
  const maxValue = options?.max ?? Number.POSITIVE_INFINITY

  let count = 0
  let currentArgs = args.arguments
  while (currentArgs.length > 0 && count < maxValue) {
    const [remainingArgs, value] = yield* self.parse({
      flags: args.flags,
      arguments: currentArgs
    })
    results.push(value)
    currentArgs = remainingArgs
    count++
  }

  if (count < minValue) {
    return yield* new CliError.InvalidValue({
      option: single.name,
      value: `${count} values`,
      expected: `at least ${minValue} value${minValue === 1 ? "" : "s"}`
    })
  }

  return [currentArgs, results] as const
})

const parseOptionVariadic: <Kind extends ParamKind, A>(
  self: Param<Kind, A>,
  single: Single<Kind, A>,
  args: ParsedArgs,
  options?: VariadicParamOptions | undefined
) => Effect.Effect<
  readonly [remainingOperands: ReadonlyArray<string>, value: ReadonlyArray<A>],
  CliError.CliError,
  FileSystem.FileSystem | Path.Path
> = Effect.fnUntraced(function*<A, Kind extends ParamKind>(
  self: Param<Kind, A>,
  single: Single<Kind, A>,
  args: ParsedArgs,
  options?: VariadicParamOptions | undefined
) {
  const results: Array<A> = []
  const names = [single.name, ...single.aliases]
  const values = names.flatMap((name) => args.flags[name] ?? [])
  const count = values.length

  // Validate count constraints
  if (Predicate.isNotUndefined(options?.min) && count < options.min) {
    return yield* count === 0
      ? new CliError.MissingOption({ option: single.name })
      : new CliError.InvalidValue({
        option: single.name,
        value: `${count} occurrences`,
        expected: `at least ${options.min} value${options.min === 1 ? "" : "s"}`
      })
  }

  if (Predicate.isNotUndefined(options?.max) && count > options.max) {
    return yield* new CliError.InvalidValue({
      option: single.name,
      value: `${count} occurrences`,
      expected: `at most ${options.max} value${options.max === 1 ? "" : "s"}`
    })
  }

  // Parse each value individually
  for (const value of values) {
    const [, parsedValue] = yield* self.parse({
      flags: { [single.name]: [value] },
      arguments: []
    })
    results.push(parsedValue)
  }

  return [args.arguments, results] as const
})

type AnyParam<Kind extends ParamKind, A> =
  | Single<Kind, A>
  | Map<Kind, any, A>
  | MapEffect<Kind, any, A>
  | Optional<Kind, A>
  | Variadic<Kind, A>

/**
 * Type-safe param matcher that handles the unsafe casting internally.
 * This provides a clean API for pattern matching on param types while
 * maintaining type safety at the call site.
 */
const matchParam = <Kind extends ParamKind, A, R>(
  param: Param<Kind, A>,
  patterns: {
    Single: (single: Single<Kind, A>) => R
    Map: <X>(mapped: Map<Kind, X, A>) => R
    MapEffect: <X>(mapped: MapEffect<Kind, X, A>) => R
    Optional: <X>(optional: Optional<Kind, X>) => R
    Variadic: <X>(variadic: Variadic<Kind, X>) => R
  }
): R => {
  const p = param as AnyParam<Kind, A>
  switch (p._tag) {
    case "Single":
      return patterns.Single(p)
    case "Map":
      return patterns.Map(p)
    case "MapEffect":
      return patterns.MapEffect(p)
    case "Optional":
      return patterns.Optional(p)
    case "Variadic":
      return patterns.Variadic(p)
  }
}

/**
 * Recursively transforms a param by applying a function to any `Single` nodes.
 * This is used internally by combinators like `withAlias` to traverse the param tree.
 */
const transformSingle = <Kind extends ParamKind, A>(
  param: Param<Kind, A>,
  f: <X>(single: Single<Kind, X>) => Single<Kind, X>
): Param<Kind, A> => {
  return matchParam(param, {
    Single: (single) => f(single),
    Map: (mapped) => map(transformSingle(mapped.param, f), mapped.f),
    MapEffect: (mapped) => mapEffect(transformSingle(mapped.param, f), mapped.f),
    Optional: (p) => optional(transformSingle(p.param, f)) as Param<Kind, A>,
    Variadic: (p) => variadic(transformSingle(p.param, f), { min: p.min, max: p.max }) as Param<Kind, A>
  })
}

/**
 * Extracts all Single params from a potentially nested param structure.
 * This handles all param combinators including Map, MapEffect, Optional, and Variadic.
 *
 * @internal
 */
export const extractSingleParams = <Kind extends ParamKind, A>(
  param: Param<Kind, A>
): Array<Single<Kind, unknown>> => {
  return matchParam(param, {
    Single: (single) => [single as Single<Kind, unknown>],
    Map: (mapped) => extractSingleParams(mapped.param),
    MapEffect: (mapped) => extractSingleParams(mapped.param),
    Optional: (optional) => extractSingleParams(optional.param),
    Variadic: (variadic) => extractSingleParams(variadic.param)
  })
}

/**
 * Gets the underlying Single param from a potentially nested param structure.
 * Throws an error if there are no singles or multiple singles found.
 *
 * @internal
 */
export const getUnderlyingSingleOrThrow = <Kind extends ParamKind, A>(
  param: Param<Kind, A>
): Single<Kind, A> => {
  const singles = extractSingleParams(param)

  if (singles.length === 0) {
    throw new Error("No Single param found in param structure")
  }

  if (singles.length > 1) {
    throw new Error(
      `Multiple Single params found: ${singles.map((s) => s.name).join(", ")}`
    )
  }

  return singles[0] as Single<Kind, A>
}

/**
 * Gets param metadata by traversing the structure.
 *
 * @internal
 */
export const getParamMetadata = <Kind extends ParamKind, A>(
  param: Param<Kind, A>
): { isOptional: boolean; isVariadic: boolean } => {
  return matchParam(param, {
    Single: () => ({ isOptional: false, isVariadic: false }),
    Map: (mapped) => getParamMetadata(mapped.param),
    MapEffect: (mapped) => getParamMetadata(mapped.param),
    Optional: (optional) => ({
      ...getParamMetadata(optional.param),
      isOptional: true
    }),
    Variadic: (variadic) => ({
      ...getParamMetadata(variadic.param),
      isVariadic: true
    })
  })
}
