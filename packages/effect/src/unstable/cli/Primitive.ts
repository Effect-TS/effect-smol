/**
 * @since 4.0.0
 */
import * as Redacted from "../../data/Redacted.ts"
import * as Effect from "../../Effect.ts"
import { identity } from "../../Function.ts"
import * as FileSystem from "../../platform/FileSystem.ts"
import * as Path from "../../platform/Path.ts"
import * as Schema from "../../schema/Schema.ts"
import * as Transformation from "../../schema/Transformation.ts"
import type { Covariant } from "../../types/Types.ts"

const TypeId = "~effect/cli/Primitive"

/**
 * Represents a primitive type that can parse string input into a typed value.
 *
 * @example
 * ```ts
 * import { Primitive } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * // Using built-in primitives
 * const parseString = Effect.gen(function* () {
 *   const stringResult = yield* Primitive.string.parse("hello")
 *   const numberResult = yield* Primitive.integer.parse("42")
 *   const boolResult = yield* Primitive.boolean.parse("true")
 *
 *   return { stringResult, numberResult, boolResult }
 * })
 *
 * // Creating custom primitive
 * const emailPrimitive: Primitive<string> = {
 *   [Primitive.TypeId]: { _A: (_: never) => _ },
 *   _tag: "Email",
 *   parse: (value) => {
 *     if (value.includes("@")) {
 *       return Effect.succeed(value)
 *     }
 *     return Effect.fail("Invalid email format")
 *   }
 * }
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export interface Primitive<out A> extends Primitive.Variance<A> {
  readonly _tag: string
  readonly parse: (value: string) => Effect.Effect<A, string, FileSystem.FileSystem | Path.Path>
}

/**
 * @since 4.0.0
 */
export declare namespace Primitive {
  /**
   * @since 4.0.0
   * @category models
   */
  export interface Variance<out A> {
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

const Proto = {
  [TypeId]: {
    _A: identity
  }
}

/** @internal */
export const trueValues = Schema.Literals(["true", "1", "y", "yes", "on"])

/** @internal */
export const isTrueValue = Schema.is(trueValues)

/** @internal */
export const falseValues = Schema.Literals(["false", "0", "n", "no", "off"])

/** @internal */
export const isFalseValue = Schema.is(falseValues)

const makePrimitive = <A>(
  tag: string,
  parse: (
    value: string
  ) => Effect.Effect<A, string, FileSystem.FileSystem | Path.Path>
): Primitive<A> =>
  Object.assign(Object.create(Proto), {
    _tag: tag,
    parse
  })

const makeSchemaPrimitive = <A>(
  tag: string,
  schema: Schema.Codec<A, string>,
  errorPrefix: string
): Primitive<A> => {
  const decode = Schema.decodeUnknownEffect(schema)
  return makePrimitive(tag, (value) =>
    Effect.mapError(
      decode(value),
      (error) => `${errorPrefix}: ${error.message}`
    ))
}

/**
 * Creates a primitive that parses boolean values from string input.
 *
 * Recognizes various forms of true/false values:
 * - True values: "true", "1", "y", "yes", "on"
 * - False values: "false", "0", "n", "no", "off"
 *
 * @example
 * ```ts
 * import { Primitive } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * const parseBoolean = Effect.gen(function* () {
 *   const result1 = yield* Primitive.boolean.parse("true")
 *   console.log(result1) // true
 *
 *   const result2 = yield* Primitive.boolean.parse("yes")
 *   console.log(result2) // true
 *
 *   const result3 = yield* Primitive.boolean.parse("false")
 *   console.log(result3) // false
 *
 *   const result4 = yield* Primitive.boolean.parse("0")
 *   console.log(result4) // false
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const boolean: Primitive<boolean> = makePrimitive("Boolean", (value) => {
  if (isTrueValue(value)) return Effect.succeed(true)
  if (isFalseValue(value)) return Effect.succeed(false)
  return Effect.fail(`Unable to recognize '${value}' as a valid boolean`)
})

/**
 * Creates a primitive that parses floating-point numbers from string input.
 *
 * @example
 * ```ts
 * import { Primitive } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * const parseFloat = Effect.gen(function* () {
 *   const result1 = yield* Primitive.float.parse("3.14")
 *   console.log(result1) // 3.14
 *
 *   const result2 = yield* Primitive.float.parse("-42.5")
 *   console.log(result2) // -42.5
 *
 *   const result3 = yield* Primitive.float.parse("0")
 *   console.log(result3) // 0
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const float: Primitive<number> = makeSchemaPrimitive(
  "Float",
  Schema.String.pipe(
    Schema.decodeTo(Schema.Finite, Transformation.numberFromString)
  ),
  "Failed to parse number"
)

/**
 * Creates a primitive that parses integer numbers from string input.
 *
 * @example
 * ```ts
 * import { Primitive } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * const parseInteger = Effect.gen(function* () {
 *   const result1 = yield* Primitive.integer.parse("42")
 *   console.log(result1) // 42
 *
 *   const result2 = yield* Primitive.integer.parse("-123")
 *   console.log(result2) // -123
 *
 *   const result3 = yield* Primitive.integer.parse("0")
 *   console.log(result3) // 0
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const integer: Primitive<number> = makeSchemaPrimitive(
  "Integer",
  Schema.String.pipe(
    Schema.decodeTo(Schema.Int, Transformation.numberFromString)
  ),
  "Failed to parse integer"
)

// Date
const DateFromString = Schema.String.pipe(
  Schema.decodeTo(
    Schema.Date,
    Transformation.transform({
      decode: (input: string) => {
        const date = new Date(input)
        if (isNaN(date.getTime())) {
          return new Date("invalid") // will be rejected by validation layer
        }
        return date
      },
      encode: (date) => date.toISOString()
    })
  )
)

/**
 * Creates a primitive that parses Date objects from string input.
 *
 * @example
 * ```ts
 * import { Primitive } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * const parseDate = Effect.gen(function* () {
 *   const result1 = yield* Primitive.date.parse("2023-12-25")
 *   console.log(result1) // Date object for December 25, 2023
 *
 *   const result2 = yield* Primitive.date.parse("2023-12-25T10:30:00Z")
 *   console.log(result2) // Date object with time
 *
 *   const result3 = yield* Primitive.date.parse("Dec 25, 2023")
 *   console.log(result3) // Date object parsed from natural format
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const date: Primitive<Date> = makeSchemaPrimitive(
  "Date",
  DateFromString,
  "Failed to parse date"
)

/**
 * Creates a primitive that accepts any string value without validation.
 *
 * @example
 * ```ts
 * import { Primitive } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * const parseString = Effect.gen(function* () {
 *   const result1 = yield* Primitive.string.parse("hello world")
 *   console.log(result1) // "hello world"
 *
 *   const result2 = yield* Primitive.string.parse("")
 *   console.log(result2) // ""
 *
 *   const result3 = yield* Primitive.string.parse("123")
 *   console.log(result3) // "123"
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const string: Primitive<string> = makePrimitive("String", (value) => Effect.succeed(value))

/**
 * Creates a primitive that accepts only specific choice values mapped to custom types.
 *
 * @example
 * ```ts
 * import { Primitive } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * type LogLevel = "debug" | "info" | "warn" | "error"
 *
 * const logLevelPrimitive = Primitive.choice<LogLevel>([
 *   ["debug", "debug"],
 *   ["info", "info"],
 *   ["warn", "warn"],
 *   ["error", "error"]
 * ])
 *
 * const parseLogLevel = Effect.gen(function* () {
 *   const result1 = yield* logLevelPrimitive.parse("info")
 *   console.log(result1) // "info"
 *
 *   const result2 = yield* logLevelPrimitive.parse("debug")
 *   console.log(result2) // "debug"
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const choice = <A>(
  choices: ReadonlyArray<readonly [string, A]>
): Primitive<A> => {
  const choiceMap = new Map(choices)
  const validChoices = choices.map(([key]) => key).join(", ")
  return makePrimitive("Choice", (value) => {
    if (choiceMap.has(value)) {
      return Effect.succeed(choiceMap.get(value)!)
    }
    return Effect.fail(`Expected one of: ${validChoices}. Got: ${value}`)
  })
}

/**
 * Specifies the type of path validation to perform.
 *
 * @example
 * ```ts
 * import { Primitive } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * // Only accept files
 * const filePath = Primitive.path("file", true)
 *
 * // Only accept directories
 * const dirPath = Primitive.path("directory", true)
 *
 * // Accept either files or directories
 * const anyPath = Primitive.path("either", false)
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export type PathType = "file" | "directory" | "either"

/**
 * Creates a primitive that validates and resolves file system paths.
 *
 * @example
 * ```ts
 * import { Primitive } from "effect/unstable/cli"
 * import { Effect } from "effect"
 * import { FileSystem } from "effect/platform"
 * import { Path } from "effect/platform"
 *
 * const program = Effect.gen(function* () {
 *   // Parse a file path that must exist
 *   const filePrimitive = Primitive.path("file", true)
 *   const filePath = yield* filePrimitive.parse("./package.json")
 *   console.log(filePath) // Absolute path to package.json
 *
 *   // Parse a directory path
 *   const dirPrimitive = Primitive.path("directory", false)
 *   const dirPath = yield* dirPrimitive.parse("./src")
 *   console.log(dirPath) // Absolute path to src directory
 *
 *   // Parse any path type
 *   const anyPrimitive = Primitive.path("either", false)
 *   const anyPath = yield* anyPrimitive.parse("./some/path")
 *   console.log(anyPath) // Absolute path
 * }).pipe(
 *   Effect.provide(FileSystem.layer),
 *   Effect.provide(Path.layer)
 * )
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const path = (
  pathType: PathType,
  mustExist?: boolean
): Primitive<string> =>
  makePrimitive(
    "Path",
    Effect.fnUntraced(function*(value) {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      // Resolve the path to absolute
      const absolutePath = path.isAbsolute(value) ? value : path.resolve(value)

      // Check if path exists
      const exists = yield* Effect.mapError(
        fs.exists(absolutePath),
        (error) => `Failed to check path existence: ${error.message}`
      )

      // Validate existence requirements
      if (mustExist === true && !exists) {
        return yield* Effect.fail(`Path does not exist: ${absolutePath}`)
      }

      // Validate path type if it exists
      if (exists && pathType !== "either") {
        const stat = yield* Effect.mapError(
          fs.stat(absolutePath),
          (error) => `Failed to stat path: ${error.message}`
        )

        if (pathType === "file" && stat.type !== "File") {
          return yield* Effect.fail(`Path is not a file: ${absolutePath}`)
        }
        if (pathType === "directory" && stat.type !== "Directory") {
          return yield* Effect.fail(`Path is not a directory: ${absolutePath}`)
        }
      }

      return absolutePath
    })
  )

/**
 * Creates a primitive that wraps string input in a redacted type for secure handling.
 *
 * @example
 * ```ts
 * import { Primitive } from "effect/unstable/cli"
 * import { Effect } from "effect"
 * import { Redacted } from "effect"
 *
 * const parseRedacted = Effect.gen(function* () {
 *   const result = yield* Primitive.redacted.parse("secret-password")
 *   console.log(Redacted.value(result)) // "secret-password"
 *   console.log(String(result)) // "<redacted>"
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const redacted: Primitive<Redacted.Redacted<string>> = makePrimitive(
  "Redacted",
  (value) => Effect.succeed(Redacted.make(value))
)

/**
 * Creates a primitive that reads and returns the contents of a file as a string.
 *
 * @example
 * ```ts
 * import { Primitive } from "effect/unstable/cli"
 * import { Effect } from "effect"
 * import { FileSystem } from "effect/platform"
 * import { Path } from "effect/platform"
 *
 * const readConfigFile = Effect.gen(function* () {
 *   const content = yield* Primitive.fileString.parse("./config.json")
 *   console.log(content) // File contents as string
 *
 *   const parsed = JSON.parse(content)
 *   return parsed
 * }).pipe(
 *   Effect.provide(FileSystem.layer),
 *   Effect.provide(Path.layer)
 * )
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const fileString: Primitive<string> = makePrimitive(
  "FileString",
  Effect.fnUntraced(function*(filePath) {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    // Resolve to absolute path
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(filePath)

    // Check if file exists
    const exists = yield* Effect.mapError(
      fs.exists(absolutePath),
      (error) => `Failed to check file existence: ${error.message}`
    )

    if (!exists) {
      return yield* Effect.fail(`File does not exist: ${absolutePath}`)
    }

    // Check if it's actually a file
    const stat = yield* Effect.mapError(
      fs.stat(absolutePath),
      (error) => `Failed to stat file: ${error.message}`
    )

    if (stat.type !== "File") {
      return yield* Effect.fail(`Path is not a file: ${absolutePath}`)
    }

    // Read file content
    const content = yield* Effect.mapError(
      fs.readFileString(absolutePath),
      (error) => `Failed to read file: ${error.message}`
    )

    return content
  })
)

/**
 * Reads and parses file content using the specified schema.
 *
 * @example
 * ```ts
 * import { Primitive } from "effect/unstable/cli"
 * import { Effect } from "effect"
 * import { Schema } from "effect/schema"
 * import { FileSystem } from "effect/platform"
 * import { Path } from "effect/platform"
 *
 * const ConfigSchema = Schema.Struct({
 *   name: Schema.String,
 *   version: Schema.String,
 *   port: Schema.Number
 * })
 *
 * const jsonConfigPrimitive = Primitive.fileSchema(
 *   Schema.parseJson(ConfigSchema),
 *   "JSON"
 * )
 *
 * const loadConfig = Effect.gen(function* () {
 *   const config = yield* jsonConfigPrimitive.parse("./config.json")
 *   console.log(config) // { name: "my-app", version: "1.0.0", port: 3000 }
 *   return config
 * }).pipe(
 *   Effect.provide(FileSystem.layer),
 *   Effect.provide(Path.layer)
 * )
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const fileSchema = <A>(
  schema: Schema.Codec<A, string>,
  format?: string | undefined
): Primitive<A> => {
  const decode = Schema.decodeUnknownEffect(schema)
  return makePrimitive(
    "FileSchema",
    Effect.fnUntraced(function*(filePath) {
      const content = yield* fileString.parse(filePath)
      return yield* Effect.mapError(decode(content), (error) => {
        const formatHint = format ? ` (expected ${format} format)` : ""
        return `Failed to parse file content${formatHint}: ${error.message}`
      })
    })
  )
}

/**
 * Parses `key=value` pairs into a record object.
 *
 * @example
 * ```ts
 * import { Primitive } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * const parseKeyValue = Effect.gen(function* () {
 *   const result1 = yield* Primitive.keyValueMap.parse("name=john")
 *   console.log(result1) // { name: "john" }
 *
 *   const result2 = yield* Primitive.keyValueMap.parse("port=3000")
 *   console.log(result2) // { port: "3000" }
 *
 *   const result3 = yield* Primitive.keyValueMap.parse("debug=true")
 *   console.log(result3) // { debug: "true" }
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const keyValueMap: Primitive<Record<string, string>> = makePrimitive(
  "KeyValueMap",
  Effect.fnUntraced(function*(value) {
    const parts = value.split("=")
    if (parts.length !== 2) {
      return yield* Effect.fail(
        `Invalid key=value format. Expected format: key=value, got: ${value}`
      )
    }
    const [key, val] = parts
    if (!key || !val) {
      return yield* Effect.fail(
        `Invalid key=value format. Both key and value must be non-empty. Got: ${value}`
      )
    }
    return { [key]: val }
  })
)

/**
 * A sentinel primitive that always fails to parse a value.
 *
 * Used for flags that don't accept values.
 *
 * @example
 * ```ts
 * import { Primitive } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   // This will always fail - useful for boolean flags
 *   const result = yield* Primitive.none.parse("any-value")
 * })
 *
 * // The above effect will fail with "This option does not accept values"
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const none: Primitive<never> = makePrimitive("None", () => Effect.fail("This option does not accept values"))

/**
 * Gets a human-readable type name for a primitive.
 *
 * Used for generating help documentation.
 *
 * @example
 * ```ts
 * import { Primitive } from "effect/unstable/cli"
 *
 * console.log(Primitive.getTypeName(Primitive.string)) // "string"
 * console.log(Primitive.getTypeName(Primitive.integer)) // "integer"
 * console.log(Primitive.getTypeName(Primitive.boolean)) // "boolean"
 * console.log(Primitive.getTypeName(Primitive.date)) // "date"
 * console.log(Primitive.getTypeName(Primitive.keyValueMap)) // "key=value"
 *
 * const logLevelChoice = Primitive.choice([
 *   ["debug", "debug"],
 *   ["info", "info"]
 * ])
 * console.log(Primitive.getTypeName(logLevelChoice)) // "choice"
 * ```
 *
 * @since 4.0.0
 * @category utilities
 */
export const getTypeName = <A>(primitive: Primitive<A>): string => {
  switch (primitive._tag) {
    case "Boolean":
      return "boolean"
    case "String":
      return "string"
    case "Integer":
      return "integer"
    case "Float":
      return "number"
    case "Date":
      return "date"
    case "Path":
      return "path"
    case "Choice":
      return "choice"
    case "Redacted":
      return "string"
    case "FileString":
      return "file"
    case "FileSchema":
      return "file"
    case "KeyValueMap":
      return "key=value"
    case "None":
      return "none"
    default:
      return "value"
  }
}
