/**
 * @since 4.0.0
 */

import { Effect } from "effect"
import { Option } from "effect/data"
import * as Result from "effect/data/Result"
import { dual } from "effect/Function"
import { type Pipeable, pipeArguments } from "effect/interfaces/Pipeable"
import type * as FileSystem from "effect/platform/FileSystem"
import type * as Path from "effect/platform/Path"
import { Schema } from "effect/schema"
import * as CliError from "../CliError.ts"
import type { Environment } from "../Command.ts"
import * as Primitive from "../Primitive.ts"
import type { ParamParseArgs } from "./types.ts"
import { createWithCommonProto } from "./utils.ts"

const ParamSymbolKey = "@effect/cli/Param"
export const ParamTypeId = Symbol.for(ParamSymbolKey)

/**
 * @since 4.0.0
 * @category models
 */
export type ParamKind = "flag" | "argument"

/**
 * @since 4.0.0
 * @category models
 */
export interface Param<out A, Kind extends ParamKind = ParamKind> extends Pipeable {
  readonly [ParamTypeId]: {
    _A: (_: never) => A
  }
  readonly _tag: "Single" | "Map" | "MapEffect" | "Optional" | "Variadic"
  readonly kind: Kind
  readonly parse: ( // NOTE: method signatures in interfaces considered harmful!
    args: ParamParseArgs
  ) => Effect.Effect<
    readonly [remainingOperands: ReadonlyArray<string>, value: A],
    CliError.CliError,
    Environment
  >
}

export interface Single<out A, Kind extends ParamKind = "flag"> extends Param<A, Kind> {
  readonly _tag: "Single"
  readonly kind: Kind
  readonly name: string
  readonly description: Option.Option<string>
  readonly aliases: ReadonlyArray<string>
  readonly primitiveType: Primitive.Primitive<A>
  readonly typeName?: string
}

const CommonProto = {
  [ParamTypeId]: {
    _A: (_: never) => _
  },
  pipe() {
    return pipeArguments(this, arguments)
  }
}

export interface Map<in out X, out A, Kind extends ParamKind = ParamKind> extends Param<A, Kind> {
  readonly _tag: "Map"
  readonly kind: Kind
  readonly param: Param<X, Kind>
  readonly f: (x: X) => A
}

export interface MapEffect<in out X, out A, Kind extends ParamKind = ParamKind> extends Param<A, Kind> {
  readonly _tag: "MapEffect"
  readonly kind: Kind
  readonly param: Param<X, Kind>
  readonly f: (x: X) => Effect.Effect<A, CliError.CliError, FileSystem.FileSystem | Path.Path>
}

export interface Optional<A, Kind extends ParamKind = ParamKind> extends Param<Option.Option<A>, Kind> {
  readonly _tag: "Optional"
  readonly kind: Kind
  readonly param: Param<A, Kind>
}

export interface Variadic<A, Kind extends ParamKind = ParamKind> extends Param<ReadonlyArray<A>, Kind> {
  readonly _tag: "Variadic"
  readonly kind: Kind
  readonly param: Param<A, Kind>
  readonly min: Option.Option<number>
  readonly max: Option.Option<number>
}

export const makeSingle = <A, K extends ParamKind>(
  params: {
    name: string
    primitiveType: Primitive.Primitive<A>
    kind: K
    typeName?: string
    description?: Option.Option<string>
    aliases?: ReadonlyArray<string>
  }
): Single<A, K> => {
  const { aliases = [], description = Option.none(), kind, name, primitiveType, typeName } = params
  return createWithCommonProto(CommonProto)({
    _tag: "Single",
    kind,
    name,
    description,
    aliases,
    primitiveType,
    ...(typeName !== undefined ? { typeName } : {}),
    parse(
      args: ParamParseArgs
    ): Effect.Effect<
      readonly [remainingOperands: ReadonlyArray<string>, value: A],
      CliError.CliError,
      Environment
    > {
      if (kind === "argument") {
        return parsePositional(name, primitiveType, args)
      } else {
        return parseOption(name, primitiveType, args)
      }
    }
  })
}

/**
 * @since 4.0.0
 * @category refinements
 */
export const isParam = (value: any): value is Param<any> => {
  return value && typeof value === "object" && ParamTypeId in value
}

/**
 * @since 4.0.0
 * @category refinements
 */
export const isSingle = <A>(value: Param<A>): value is Single<A> => {
  return value._tag === "Single"
}

// Helper functions for parsing

const parsePositional = <A>(
  name: string,
  primitiveType: Primitive.Primitive<A>,
  args: ParamParseArgs
): Effect.Effect<
  readonly [remainingOperands: ReadonlyArray<string>, value: A],
  CliError.CliError,
  FileSystem.FileSystem | Path.Path
> => {
  if (args.arguments.length === 0) {
    return Effect.fail(new CliError.MissingOption({ option: name }))
  }

  const rawValue = args.arguments[0]

  return Effect.map(
    Effect.mapError(
      primitiveType.parse(rawValue),
      (error) => new CliError.InvalidValue({ option: name, value: rawValue, expected: error })
    ),
    (value) => [args.arguments.slice(1), value] as const
  )
}

const parseOption = <A>(
  name: string,
  primitiveType: Primitive.Primitive<A>,
  args: ParamParseArgs
): Effect.Effect<
  readonly [remainingOperands: ReadonlyArray<string>, value: A],
  CliError.CliError,
  FileSystem.FileSystem | Path.Path
> => {
  const providedValues = args.flags[name]

  if (providedValues === undefined || providedValues.length === 0) {
    // Option not provided (empty array due to initialization)
    if (primitiveType._tag === "Boolean") {
      // Boolean params default to false when not present
      return Effect.succeed([args.arguments, false as A] as const)
    } else {
      return Effect.fail(new CliError.MissingOption({ option: name }))
    }
  } else {
    // Parse the first value (later we can handle multiple)
    const rawValue = providedValues[0]
    return Effect.map(
      Effect.mapError(
        primitiveType.parse(rawValue),
        (error) => new CliError.InvalidValue({ option: name, value: rawValue, expected: error })
      ),
      (value) => [args.arguments, value] as const
    )
  }
}

const parsePositionalVariadic = <A, Kind extends ParamKind>(
  single: Single<A, Kind>,
  param: Param<A, Kind>,
  min: Option.Option<number>,
  max: Option.Option<number>,
  args: ParamParseArgs
): Effect.Effect<
  readonly [remainingOperands: ReadonlyArray<string>, value: ReadonlyArray<A>],
  CliError.CliError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function*() {
    let currentOperands = args.arguments
    const results: Array<A> = []
    const minValue = Option.getOrElse(min, () => 0)
    const maxValue = Option.getOrElse(max, () => Infinity)

    let count = 0
    while (currentOperands.length > 0 && count < maxValue) {
      const [remainingOperands, value] = yield* param.parse({
        flags: args.flags,
        arguments: currentOperands
      })
      results.push(value)
      currentOperands = remainingOperands
      count++
    }

    if (count < minValue) {
      return yield* Effect.fail(
        new CliError.InvalidValue({
          option: single.name,
          value: `${count} values`,
          expected: `at least ${minValue} value${minValue === 1 ? "" : "s"}`
        })
      )
    }

    return [currentOperands, results] as const
  })

const parseOptionVariadic = <A, Kind extends ParamKind>(
  single: Single<A, Kind>,
  param: Param<A, Kind>,
  min: Option.Option<number>,
  max: Option.Option<number>,
  args: ParamParseArgs
): Effect.Effect<
  readonly [remainingOperands: ReadonlyArray<string>, value: ReadonlyArray<A>],
  CliError.CliError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function*() {
    const results: Array<A> = []
    const optionNames = [single.name, ...single.aliases]
    const allValues = optionNames.flatMap((name) => args.flags[name] || [])
    const count = allValues.length

    // Validate count constraints
    if (Option.isSome(min) && count < min.value) {
      return yield* Effect.fail(
        count === 0
          ? new CliError.MissingOption({ option: single.name })
          : new CliError.InvalidValue({
            option: single.name,
            value: `${count} occurrences`,
            expected: `at least ${min.value} value${min.value === 1 ? "" : "s"}`
          })
      )
    }

    if (Option.isSome(max) && count > max.value) {
      return yield* Effect.fail(
        new CliError.InvalidValue({
          option: single.name,
          value: `${count} occurrences`,
          expected: `at most ${max.value} value${max.value === 1 ? "" : "s"}`
        })
      )
    }

    // Parse each value individually
    for (const value of allValues) {
      const [, parsedValue] = yield* param.parse({
        flags: { [single.name]: [value] },
        arguments: []
      })
      results.push(parsedValue)
    }

    return [args.arguments, results] as const
  })

export const string = <K extends ParamKind>(
  name: string,
  kind: K
) => makeSingle({ name, primitiveType: Primitive.stringPrimitive, kind })

export const boolean = <K extends ParamKind>(
  name: string,
  kind: K
) => makeSingle({ name, primitiveType: Primitive.booleanPrimitive, kind })

export const integer = <K extends ParamKind>(
  name: string,
  kind: K
) => makeSingle({ name, primitiveType: Primitive.integerPrimitive, kind })

export const float = <K extends ParamKind>(
  name: string,
  kind: K
) => makeSingle({ name, primitiveType: Primitive.floatPrimitive, kind })

export const date = <K extends ParamKind>(
  name: string,
  kind: K
) => makeSingle({ name, primitiveType: Primitive.datePrimitive, kind })

/**
 * Constructs command-line params that represent a choice between several
 * inputs. The input will be mapped to it's associated value during parsing.
 *
 * @example
 * ```ts
 * import * as Param from "@effect/cli/Param"
 * import * as Data from "effect/Data"
 *
 * export type Animal = Dog | Cat
 *
 * export interface Dog {
 *   readonly _tag: "Dog"
 * }
 *
 * export const Dog = Data.tagged<Dog>("Dog")
 *
 * export interface Cat {
 *   readonly _tag: "Cat"
 * }
 *
 * export const Cat = Data.tagged<Cat>("Cat")
 *
 * export const animal: Param.Param<Animal> = Param.choiceWithValue("animal", [
 *   ["dog", Dog()],
 *   ["cat", Cat()]
 * ])
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const choiceWithValue = <
  const C extends ReadonlyArray<readonly [string, any]>,
  K extends ParamKind
>(
  name: string,
  choices: C,
  kind: K
): Param<C[number][1], K> => makeSingle({ name, primitiveType: Primitive.choicePrimitive(choices), kind })

/**
 * Constructs command-line params that represent a choice between several
 * string inputs.
 *
 * @example
 * ```ts
 * import * as Param from "@effect/cli/Param"
 *
 * const logLevel = Param.choice("log-level", ["debug", "info", "warn", "error"])
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const choice = <const A extends ReadonlyArray<string>, K extends ParamKind>(
  name: string,
  choices: A,
  kind: K
): Param<A[number], K> => {
  const mappedChoices = choices.map((value) => [value, value] as const)
  return choiceWithValue(name, mappedChoices, kind)
}

export const path = <K extends ParamKind>(
  name: string,
  kind: K,
  options?: {
    pathType?: Primitive.PathType
    mustExist?: boolean
    typeName?: string
  }
) =>
  makeSingle({
    name,
    primitiveType: Primitive.pathPrimitive(options?.pathType ?? "either", options?.mustExist),
    kind,
    ...(options?.typeName ? { typeName: options.typeName } : {})
  })

/**
 * Creates a directory path option.
 * This is a convenience function that creates a path option
 * with pathType="directory" and a default type name of "directory".
 *
 * @since 4.0.0
 * @category constructors
 */
export const directory = <K extends ParamKind>(
  name: string,
  kind: K,
  options?: {
    mustExist?: boolean
  }
) =>
  path(name, kind, {
    pathType: "directory",
    ...(options?.mustExist !== undefined && { mustExist: options.mustExist }),
    typeName: "directory"
  })

/**
 * Creates a file path option.
 * This is a convenience function that creates a path option
 * with pathType="file" and a default type name of "file".
 *
 * @since 4.0.0
 * @category constructors
 */
export const file = <K extends ParamKind>(
  name: string,
  kind: K,
  options?: {
    mustExist?: boolean
  }
) =>
  path(name, kind, {
    pathType: "file",
    ...(options?.mustExist !== undefined && { mustExist: options.mustExist }),
    typeName: "file"
  })

export const redacted = <K extends ParamKind>(
  name: string,
  kind: K
) => makeSingle({ name, primitiveType: Primitive.redactedPrimitive, kind })

/**
 * Creates a param that reads and returns file content as a string.
 *
 * @since 4.0.0
 * @category constructors
 */
export const fileContent = <K extends ParamKind>(
  name: string,
  kind: K
) => makeSingle({ name, primitiveType: Primitive.fileContentPrimitive, kind })

/**
 * Creates a param that reads and returns file content as a string (alias for fileContent).
 *
 * @since 4.0.0
 * @category constructors
 */
export const fileText = <K extends ParamKind>(
  name: string,
  kind: K
) => makeSingle({ name, primitiveType: Primitive.fileTextPrimitive, kind })

/**
 * Creates a param that reads and parses file content using a schema.
 *
 * @since 4.0.0
 * @category constructors
 */
export const fileParse = <A, K extends ParamKind>(
  name: string,
  schema: Schema.Codec<A, string>,
  kind: K,
  format?: string
) => makeSingle({ name, primitiveType: Primitive.fileParsePrimitive(schema, format), kind })

/**
 * Creates a param that reads and validates file content using a schema (alias for fileParse).
 *
 * @since 4.0.0
 * @category constructors
 */
export const fileSchema = <A, K extends ParamKind>(
  name: string,
  schema: Schema.Codec<A, string>,
  kind: K,
  format?: string
) => makeSingle({ name, primitiveType: Primitive.fileSchemaPrimitive(schema, format), kind })

/**
 * Creates a param that parses key=value pairs.
 * Useful for options that accept configuration values.
 *
 * @example
 * ```ts
 * import * as Param from "@effect/cli/Param"
 *
 * const env = Param.keyValueMap("env", "flag")
 * // --env FOO=bar will parse to { FOO: "bar" }
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const keyValueMap = <K extends ParamKind>(
  name: string,
  kind: K
) => makeSingle({ name, primitiveType: Primitive.keyValueMapPrimitive, kind })

/**
 * Creates an empty sentinel param that always fails to parse.
 * This is useful for creating placeholder params or for combinators.
 *
 * @since 4.0.0
 * @category constructors
 */
export const none = <K extends ParamKind>(
  kind: K
): Param<never, K> => makeSingle({ name: "__none__", primitiveType: Primitive.nonePrimitive, kind })

// NOTE: Create individual constructors for each subtype
// - Try Match.type

type AnyParam<A, K extends ParamKind> =
  | Single<A, K>
  | Map<A, any, K>
  | MapEffect<A, any, K>
  | Optional<A, K>
  | Variadic<A, K>

/**
 * Type-safe param matcher that handles the unsafe casting internally.
 * This provides a clean API for pattern matching on param types while
 * maintaining type safety at the call site.
 */
const matchParam = <A, K extends ParamKind, R>(
  param: Param<A, K>,
  patterns: {
    Single: (single: Single<A, K>) => R
    Map: <X>(mapped: Map<X, A, K>) => R
    MapEffect: <X>(mapped: MapEffect<X, A, K>) => R
    Optional: <X>(optional: Optional<X, K>) => R
    Variadic: <X>(variadic: Variadic<X, K>) => R
  }
): R => {
  const p = param as AnyParam<A, K>
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
  const _exhaustive: never = p
  void _exhaustive
}

/**
 * Recursively transforms a param by applying a function to any `Single` nodes.
 * This is used internally by combinators like `withAlias` to traverse the param tree.
 */
const transformSingle = <A, K extends ParamKind>(
  param: Param<A, K>,
  f: <X>(single: Single<X, K>) => Single<X, K>
): Param<A, K> => {
  return matchParam(param, {
    Single: (single) => f(single),
    Map: (mapped) => map(transformSingle(mapped.param, f), mapped.f),
    MapEffect: (mapped) => mapEffect(transformSingle(mapped.param, f), mapped.f),
    Optional: (p) => optional(transformSingle(p.param, f)) as Param<A, K>,
    Variadic: (p) => variadic(transformSingle(p.param, f), p.min, p.max) as Param<A, K>
  })
}

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
 * import * as Param from "./Param"
 *
 * const force = Param.boolean("force").pipe(
 *   Param.withAlias("-f"),
 *   Param.withAlias("--no-prompt")
 * )
 *
 * // Also works on composed params:
 * const count = Param.integer("count").pipe(
 *   Param.optional,
 *   Param.withAlias("-c")  // finds the underlying Single and adds alias
 * )
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const withAlias: {
  <A, K extends ParamKind>(alias: string): (self: Param<A, K>) => Param<A, K>
  <A, K extends ParamKind>(self: Param<A, K>, alias: string): Param<A, K>
} = dual(2, <A, K extends ParamKind>(self: Param<A, K>, alias: string): Param<A, K> => {
  return transformSingle(self, <X>(single: Single<X, K>) =>
    makeSingle({
      ...single,
      aliases: [...single.aliases, alias.replace(/^-+/, "")]
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
 * import * as Param from "./Param"
 *
 * const verbose = Param.boolean("verbose").pipe(
 *   Param.withAlias("-v"),
 *   Param.withDescription("Enable verbose output")
 * )
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const withDescription: {
  <A, K extends ParamKind>(description: string): (self: Param<A, K>) => Param<A, K>
  <A, K extends ParamKind>(self: Param<A, K>, description: string): Param<A, K>
} = dual(2, <A, K extends ParamKind>(self: Param<A, K>, description: string): Param<A, K> => {
  return transformSingle(self, <X>(single: Single<X, K>) =>
    makeSingle({
      ...single,
      description: Option.some(description)
    }))
})

/**
 * Transforms the parsed value of an option using a mapping function.
 *
 * @example
 * ```ts
 * import * as Param from "./Param"
 *
 * const port = Param.integer("port").pipe(
 *   Param.map(n => ({ port: n, url: `http://localhost:${n}` }))
 * )
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const map: {
  <A, B>(f: (a: A) => B): <Kind extends ParamKind>(self: Param<A, Kind>) => Param<B, Kind>
  <A, B, Kind extends ParamKind>(self: Param<A, Kind>, f: (a: A) => B): Param<B, Kind>
} = dual(2, <A, B, Kind extends ParamKind>(self: Param<A, Kind>, f: (a: A) => B): Param<B, Kind> => {
  return createWithCommonProto(CommonProto)<Map<A, B, Kind>>({
    _tag: "Map",
    kind: self.kind,
    param: self,
    f,
    parse(
      args: ParamParseArgs
    ): Effect.Effect<
      readonly [remainingOperands: ReadonlyArray<string>, value: B],
      CliError.CliError,
      Environment
    > {
      return Effect.map(
        self.parse(args),
        ([operands, value]) => [operands, f(value)] as const
      )
    }
  })
})

/**
 * Transforms the parsed value of an option using an effectful mapping function.
 *
 * @example
 * ```ts
 * import * as Param from "./Param"
 * import * as Effect from "effect/Effect"
 * import * as CliError from "./CliError"
 *
 * const validatedEmail = Param.string("email").pipe(
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
  ): <Kind extends ParamKind>(self: Param<A, Kind>) => Param<B, Kind>
  <A, B, Kind extends ParamKind>(
    self: Param<A, Kind>,
    f: (a: A) => Effect.Effect<B, CliError.CliError, FileSystem.FileSystem | Path.Path>
  ): Param<B, Kind>
} = dual(
  2,
  <A, B, Kind extends ParamKind>(
    self: Param<A, Kind>,
    f: (a: A) => Effect.Effect<B, CliError.CliError, FileSystem.FileSystem | Path.Path>
  ): Param<B, Kind> => {
    return createWithCommonProto(CommonProto)<MapEffect<A, B, Kind>>({
      _tag: "MapEffect",
      kind: self.kind,
      param: self,
      f,
      parse(
        args: ParamParseArgs
      ): Effect.Effect<
        readonly [remainingOperands: ReadonlyArray<string>, value: B],
        CliError.CliError,
        Environment
      > {
        return Effect.flatMap(
          self.parse(args),
          ([operands, a]) =>
            Effect.map(
              f(a),
              (b) => [operands, b] as const
            )
        )
      }
    })
  }
)

/**
 * Transforms the parsed value of an option using a function that may throw,
 * converting any thrown errors into failure messages.
 *
 * @example
 * ```ts
 * import * as Param from "./Param"
 *
 * const parsedJson = Param.string("config").pipe(
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
  ): <Kind extends ParamKind>(self: Param<A, Kind>) => Param<B, Kind>
  <A, B, Kind extends ParamKind>(
    self: Param<A, Kind>,
    f: (a: A) => B,
    onError: (error: unknown) => string
  ): Param<B, Kind>
} = dual(
  3,
  <A, B, Kind extends ParamKind>(
    self: Param<A, Kind>,
    f: (a: A) => B,
    onError: (error: unknown) => string
  ): Param<B, Kind> => {
    const mapped: Map<A, B, Kind> = {
      ...CommonProto,
      _tag: "Map",
      kind: self.kind,
      param: self,
      f: (a: A) => {
        try {
          return f(a)
        } catch (error) {
          throw new Error(onError(error))
        }
      },
      parse(
        args: ParamParseArgs
      ): Effect.Effect<
        readonly [remainingOperands: ReadonlyArray<string>, value: B],
        CliError.CliError,
        Environment
      > {
        return Effect.flatMap(
          self.parse(args),
          ([operands, a]) =>
            Effect.map(
              Effect.mapError(
                Effect.try({
                  try: () => f(a),
                  catch: (error) => onError(error)
                }),
                (error) => new CliError.InvalidValue({ option: "unknown", value: String(a), expected: error })
              ),
              (b) => [operands, b] as const
            )
        )
      }
    }
    return mapped
  }
)

/**
 * Creates an optional option that returns None when not provided.
 *
 * Optional options never fail with MissingOption errors. If the option is not
 * provided on the command line, Option.none() is returned instead.
 *
 * @example
 * ```ts
 * import * as Param from "./Param"
 * import { Option } from "effect/data"
 *
 * // Create an optional port option
 * const port = Param.optional(Param.integer("port"))
 *
 * // When not provided: returns Option.none()
 * // When provided: returns Option.some(parsedValue)
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const optional = <A, Kind extends ParamKind>(param: Param<A, Kind>): Param<Option.Option<A>, Kind> => {
  return createWithCommonProto(CommonProto)<Optional<A, Kind>>({
    _tag: "Optional",
    kind: param.kind,
    param,
    parse(
      args: ParamParseArgs
    ): Effect.Effect<
      readonly [remainingOperands: ReadonlyArray<string>, value: Option.Option<A>],
      CliError.CliError,
      Environment
    > {
      return Effect.catchTag(
        Effect.map(param.parse(args), ([operands, value]) => [operands, Option.some(value)] as const),
        "MissingOption",
        () => Effect.succeed([args.arguments, Option.none()] as const)
      )
    }
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
 * import * as Param from "./Param"
 *
 * // Using the pipe operator to make an option optional
 * const port = Param.integer("port").pipe(
 *   Param.withDefault(8080)
 * )
 *
 * // Can also be used with other combinators
 * const verbose = Param.boolean("verbose").pipe(
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
  <A>(defaultValue: A): <Kind extends ParamKind>(self: Param<A, Kind>) => Param<A, Kind>
  <A, Kind extends ParamKind>(self: Param<A, Kind>, defaultValue: A): Param<A, Kind>
} = dual(
  2,
  <A, Kind extends ParamKind>(self: Param<A, Kind>, defaultValue: A): Param<A, Kind> =>
    map(optional(self), Option.getOrElse(() => defaultValue))
)

/**
 * Creates a variadic option that can be specified multiple times.
 *
 * This is the base combinator for creating options that accept multiple values.
 * The min and max parameters are optional - if not provided, the option can be
 * specified any number of times (0 to infinity).
 *
 * @since 4.0.0
 * @category combinators
 */
export const variadic = <A, Kind extends ParamKind>(
  self: Param<A, Kind>,
  min: Option.Option<number> = Option.none(),
  max: Option.Option<number> = Option.none()
): Param<ReadonlyArray<A>, Kind> => {
  const single = getUnderlyingSingleOrThrow(self)
  return createWithCommonProto(CommonProto)<Variadic<A, Kind>>({
    _tag: "Variadic",
    kind: self.kind,
    param: self,
    min,
    max,
    parse(
      args: ParamParseArgs
    ): Effect.Effect<
      readonly [remainingOperands: ReadonlyArray<string>, value: ReadonlyArray<A>],
      CliError.CliError,
      Environment
    > {
      if (single.kind === "argument") {
        return parsePositionalVariadic(single, self, min, max, args)
      } else {
        return parseOptionVariadic(single, self, min, max, args)
      }
    }
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
 * import * as Param from "./Param"
 *
 * // Allow 1-3 file inputs
 * const files = Param.string("file").pipe(
 *   Param.between(1, 3),
 *   Param.withAlias("-f")
 * )
 *
 * // Parse: --file a.txt --file b.txt
 * // Result: ["a.txt", "b.txt"]
 *
 * // Allow 0 or more tags
 * const tags = Param.string("tag").pipe(
 *   Param.between(0, Infinity)
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
  <A>(min: number, max: number): <Kind extends ParamKind>(self: Param<A, Kind>) => Param<ReadonlyArray<A>, Kind>
  <A, Kind extends ParamKind>(self: Param<A, Kind>, min: number, max: number): Param<ReadonlyArray<A>, Kind>
} = dual(
  3,
  <A, Kind extends ParamKind>(self: Param<A, Kind>, min: number, max: number): Param<ReadonlyArray<A>, Kind> => {
    if (min < 0) {
      throw new Error("between: min must be non-negative")
    }
    if (max < min) {
      throw new Error("between: max must be greater than or equal to min")
    }

    return variadic(self, Option.some(min), Option.some(max))
  }
)

/**
 * Wraps an option to allow it to be specified multiple times without limit.
 *
 * This combinator transforms an option to accept any number of occurrences
 * on the command line, returning an array of all provided values.
 *
 * @example
 * ```ts
 * import * as Param from "./Param"
 *
 * // Allow unlimited file inputs
 * const files = Param.string("file").pipe(
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
export const repeated = <A, Kind extends ParamKind>(self: Param<A, Kind>): Param<ReadonlyArray<A>, Kind> =>
  variadic(self)

/**
 * Wraps an option to allow it to be specified at most `max` times.
 *
 * This combinator transforms an option to accept between 0 and `max`
 * occurrences on the command line, returning an array of all provided values.
 *
 * @example
 * ```ts
 * import * as Param from "./Param"
 *
 * // Allow at most 3 warning suppressions
 * const suppressions = Param.string("suppress").pipe(
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
  <A>(max: number): <Kind extends ParamKind>(self: Param<A, Kind>) => Param<ReadonlyArray<A>, Kind>
  <A, Kind extends ParamKind>(self: Param<A, Kind>, max: number): Param<ReadonlyArray<A>, Kind>
} = dual(2, <A, Kind extends ParamKind>(self: Param<A, Kind>, max: number): Param<ReadonlyArray<A>, Kind> => {
  if (max < 0) {
    throw new Error("atMost: max must be non-negative")
  }

  return variadic(self, Option.none(), Option.some(max))
})

/**
 * Wraps an option to require it to be specified at least `min` times.
 *
 * This combinator transforms an option to accept at least `min`
 * occurrences on the command line, returning an array of all provided values.
 *
 * @example
 * ```ts
 * import * as Param from "./Param"
 *
 * // Require at least 2 input files
 * const inputs = Param.string("input").pipe(
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
  <A>(min: number): <Kind extends ParamKind>(self: Param<A, Kind>) => Param<ReadonlyArray<A>, Kind>
  <A, Kind extends ParamKind>(self: Param<A, Kind>, min: number): Param<ReadonlyArray<A>, Kind>
} = dual(2, <A, Kind extends ParamKind>(self: Param<A, Kind>, min: number): Param<ReadonlyArray<A>, Kind> => {
  if (min < 0) {
    throw new Error("atLeast: min must be non-negative")
  }

  return variadic(self, Option.some(min), Option.none())
})

/**
 * Extracts all Single params from a potentially nested param structure.
 * This handles all param combinators including Map, MapEffect, Optional, and Variadic.
 */
export const extractSingleParams = <A, K extends ParamKind>(param: Param<A, K>): Array<Single<unknown, K>> => {
  return matchParam(param, {
    Single: (single) => [single as Single<unknown, K>],
    Map: (mapped) => extractSingleParams(mapped.param),
    MapEffect: (mapped) => extractSingleParams(mapped.param),
    Optional: (optional) => extractSingleParams(optional.param),
    Variadic: (variadic) => extractSingleParams(variadic.param)
  })
}

/**
 * Gets the underlying Single param from a potentially nested param structure.
 * Throws an error if there are no singles or multiple singles found.
 */
export const getUnderlyingSingleOrThrow = <A, Kind extends ParamKind>(param: Param<A, Kind>): Single<A, Kind> => {
  const singles = extractSingleParams(param)

  if (singles.length === 0) {
    throw new Error("No Single param found in param structure")
  }

  if (singles.length > 1) {
    throw new Error(`Multiple Single params found: ${singles.map((s) => s.name).join(", ")}`)
  }

  return singles[0] as Single<A, Kind>
}

/**
 * Gets param metadata by traversing the structure.
 */
export const getParamMetadata = <A, K extends ParamKind>(
  param: Param<A, K>
): { isOptional: boolean; isVariadic: boolean } => {
  return matchParam(param, {
    Single: () => ({ isOptional: false, isVariadic: false }),
    Map: (mapped) => getParamMetadata(mapped.param),
    MapEffect: (mapped) => getParamMetadata(mapped.param),
    Optional: (optional) => ({ ...getParamMetadata(optional.param), isOptional: true }),
    Variadic: (variadic) => ({ ...getParamMetadata(variadic.param), isVariadic: true })
  })
}

/**
 * Filters and transforms parsed values, failing with a custom error message
 * if the filter function returns None.
 *
 * This combinator is useful for validation and transformation in a single step.
 *
 * @example
 * ```ts
 * import * as Param from "./Param"
 * import { Option } from "effect"
 *
 * const positiveInt = Param.integer("count").pipe(
 *   Param.filterMap(
 *     n => n > 0 ? Option.some(n) : Option.none(),
 *     n => `Expected positive integer, got ${n}`
 *   )
 * )
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const filterMap: {
  <A, B>(
    f: (a: A) => Option.Option<B>,
    onNone: (a: A) => string
  ): <Kind extends ParamKind>(self: Param<A, Kind>) => Param<B, Kind>
  <A, B, Kind extends ParamKind>(
    self: Param<A, Kind>,
    f: (a: A) => Option.Option<B>,
    onNone: (a: A) => string
  ): Param<B, Kind>
} = dual(
  3,
  <A, B, Kind extends ParamKind>(
    self: Param<A, Kind>,
    f: (a: A) => Option.Option<B>,
    onNone: (a: A) => string
  ): Param<B, Kind> => {
    return mapEffect(self, (a) =>
      Effect.gen(function*() {
        const result = f(a)
        if (Option.isSome(result)) {
          return result.value
        }
        const single = getUnderlyingSingleOrThrow(self)
        return yield* Effect.fail(
          new CliError.InvalidValue({
            option: single.name,
            value: String(a),
            expected: onNone(a)
          })
        )
      }))
  }
)

/**
 * Filters parsed values, failing with a custom error message if the predicate returns false.
 *
 * @example
 * ```ts
 * import * as Param from "./Param"
 *
 * const evenNumber = Param.integer("num").pipe(
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
    predicate: (a: A) => boolean,
    onFalse: (a: A) => string
  ): <Kind extends ParamKind>(self: Param<A, Kind>) => Param<A, Kind>
  <A, Kind extends ParamKind>(
    self: Param<A, Kind>,
    predicate: (a: A) => boolean,
    onFalse: (a: A) => string
  ): Param<A, Kind>
} = dual(
  3,
  <A, Kind extends ParamKind>(
    self: Param<A, Kind>,
    predicate: (a: A) => boolean,
    onFalse: (a: A) => string
  ): Param<A, Kind> => {
    return filterMap(
      self,
      (a) => predicate(a) ? Option.some(a) : Option.none(),
      onFalse
    )
  }
)

/**
 * Sets a custom display name for the param type in help documentation.
 *
 * This is useful when you want to override the default type name shown in help text.
 *
 * @example
 * ```ts
 * import * as Param from "./Param"
 *
 * const port = Param.integer("port").pipe(
 *   Param.withPseudoName("PORT"),
 *   Param.filter(p => p >= 1 && p <= 65535, () => "Port must be between 1 and 65535")
 * )
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const withPseudoName: {
  <A, K extends ParamKind>(pseudoName: string): (self: Param<A, K>) => Param<A, K>
  <A, K extends ParamKind>(self: Param<A, K>, pseudoName: string): Param<A, K>
} = dual(2, <A, K extends ParamKind>(self: Param<A, K>, pseudoName: string): Param<A, K> => {
  return transformSingle(self, <X>(single: Single<X, K>) =>
    makeSingle({
      ...single,
      typeName: pseudoName
    }))
})

/**
 * Validates parsed values against a Schema, providing detailed error messages.
 *
 * @example
 * ```ts
 * import * as Param from "./Param"
 * import { Schema } from "effect"
 *
 * const Email = Schema.String.pipe(
 *   Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
 * )
 *
 * const email = Param.string("email").pipe(
 *   Param.withSchema(Email)
 * )
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const withSchema: {
  <A, B>(
    schema: Schema.Codec<B, A>
  ): <Kind extends ParamKind>(self: Param<A, Kind>) => Param<B, Kind>
  <A, B, Kind extends ParamKind>(
    self: Param<A, Kind>,
    schema: Schema.Codec<B, A>
  ): Param<B, Kind>
} = dual(
  2,
  <A, B, Kind extends ParamKind>(
    self: Param<A, Kind>,
    schema: Schema.Codec<B, A>
  ): Param<B, Kind> => {
    return mapEffect(self, (a) =>
      Effect.gen(function*() {
        const result = yield* Schema.decodeUnknownEffect(schema)(a).pipe(
          Effect.mapError((error) => {
            const single = getUnderlyingSingleOrThrow(self)
            return new CliError.InvalidValue({
              option: single.name,
              value: String(a),
              expected: `Schema validation failed: ${error.message}`
            })
          })
        )
        return result
      }))
  }
)

/**
 * Provides a fallback param to use if this param fails to parse.
 *
 * @example
 * ```ts
 * import * as Param from "./Param"
 *
 * const config = Param.file("config", "flag").pipe(
 *   Param.orElse(() => Param.string("config-url", "flag"))
 * )
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const orElse: {
  <B, Kind extends ParamKind>(
    that: () => Param<B, Kind>
  ): <A>(self: Param<A, Kind>) => Param<A | B, Kind>
  <A, B, Kind extends ParamKind>(
    self: Param<A, Kind>,
    that: () => Param<B, Kind>
  ): Param<A | B, Kind>
} = dual(
  2,
  <A, B, Kind extends ParamKind>(
    self: Param<A, Kind>,
    that: () => Param<B, Kind>
  ): Param<A | B, Kind> => {
    // Create a custom param that tries self first, then fallback
    const orElseParam = Object.create(CommonProto)
    orElseParam._tag = "MapEffect"
    orElseParam.kind = self.kind
    orElseParam.parse = function(
      args: ParamParseArgs
    ): Effect.Effect<
      readonly [remainingOperands: ReadonlyArray<string>, value: A | B],
      CliError.CliError,
      Environment
    > {
      return self.parse(args).pipe(
        Effect.catch(() => that().parse(args))
      )
    }
    return Object.freeze(orElseParam)
  }
)

/**
 * Provides a fallback param, wrapping results in Either to distinguish which param succeeded.
 *
 * @example
 * ```ts
 * import * as Param from "./Param"
 * import { Either } from "effect"
 *
 * const configSource = Param.file("config", "flag").pipe(
 *   Param.orElseEither(() => Param.string("config-url", "flag"))
 * )
 * // Returns Either<string, string> - Left for file, Right for URL
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const orElseEither: {
  <B, Kind extends ParamKind>(
    that: () => Param<B, Kind>
  ): <A>(self: Param<A, Kind>) => Param<Result.Result<A, B>, Kind>
  <A, B, Kind extends ParamKind>(
    self: Param<A, Kind>,
    that: () => Param<B, Kind>
  ): Param<Result.Result<A, B>, Kind>
} = dual(
  2,
  <A, B, Kind extends ParamKind>(
    self: Param<A, Kind>,
    that: () => Param<B, Kind>
  ): Param<Result.Result<A, B>, Kind> => {
    // Create a custom param that returns Result.succeed for self, Result.fail for fallback
    const orElseEitherParam = Object.create(CommonProto)
    orElseEitherParam._tag = "MapEffect"
    orElseEitherParam.kind = self.kind
    orElseEitherParam.parse = function(
      args: ParamParseArgs
    ): Effect.Effect<
      readonly [remainingOperands: ReadonlyArray<string>, value: Result.Result<A, B>],
      CliError.CliError,
      Environment
    > {
      return Effect.map(self.parse(args), ([ops, a]) => [ops, Result.succeed(a)] as const).pipe(
        Effect.catch(() => Effect.map(that().parse(args), ([ops, b]) => [ops, Result.fail(b)] as const))
      )
    }
    return Object.freeze(orElseEitherParam)
  }
)
