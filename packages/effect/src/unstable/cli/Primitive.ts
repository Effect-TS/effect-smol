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
 * @since 4.0.0
 * @category models
 */
export interface Primitive<out A> extends Primitive.Variance<A> {
  readonly _tag: string
  readonly parse: (value: string) => Effect.Effect<A, string, FileSystem.FileSystem | Path.Path>
}

/**
 * @since 4.0.0
 * @category models
 */
export declare namespace Primitive {
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
 * @since 4.0.0
 * @category constructors
 */
export const boolean: Primitive<boolean> = makePrimitive("Boolean", (value) => {
  if (isTrueValue(value)) return Effect.succeed(true)
  if (isFalseValue(value)) return Effect.succeed(false)
  return Effect.fail(`Unable to recognize '${value}' as a valid boolean`)
})

/**
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
 * @since 4.0.0
 * @category constructors
 */
export const date: Primitive<Date> = makeSchemaPrimitive(
  "Date",
  DateFromString,
  "Failed to parse date"
)

/**
 * @since 4.0.0
 * @category constructors
 */
export const string: Primitive<string> = makePrimitive("String", (value) => Effect.succeed(value))

/**
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
 * @since 4.0.0
 * @category models
 */
export type PathType = "file" | "directory" | "either"

/**
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
 * @since 4.0.0
 * @category constructors
 */
export const redacted: Primitive<Redacted.Redacted<string>> = makePrimitive(
  "Redacted",
  (value) => Effect.succeed(Redacted.make(value))
)

/**
 * @since 4.0.0
 * @category constructors
 */
export const fileContent: Primitive<string> = makePrimitive(
  "FileContent",
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
 * @since 4.0.0
 * @category constructors
 */
export const fileSchema = <A>(
  schema: Schema.Codec<A, string>,
  format?: string | undefined
): Primitive<A> => {
  const decode = Schema.decodeUnknownEffect(schema)
  return makePrimitive(
    "FileParse",
    Effect.fnUntraced(function*(filePath) {
      const content = yield* fileContent.parse(filePath)
      return yield* Effect.mapError(decode(content), (error) => {
        const formatHint = format ? ` (expected ${format} format)` : ""
        return `Failed to parse file content${formatHint}: ${error.message}`
      })
    })
  )
}

/**
 * Parses `key=value` pairs.
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
 * @since 4.0.0
 * @category constructors
 */
export const none: Primitive<never> = makePrimitive("None", () => Effect.fail("This option does not accept values"))

/**
 * Gets a human-readable type name for a primitive.
 *
 * Used for generating help documentation.
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
    case "FileContent":
      return "file"
    case "FileParse":
      return "file"
    case "KeyValueMap":
      return "key=value"
    case "None":
      return "none"
    default:
      return "value"
  }
}
