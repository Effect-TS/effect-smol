import { Effect } from "effect"
import { Redacted } from "effect/data"
import * as FileSystem from "effect/platform/FileSystem"
import * as Path from "effect/platform/Path"
import { Schema, Transformation } from "effect/schema"
import type { Environment } from "./Command.ts"

type PrimitiveTypeId = "~effect/Primitive"
const PrimitiveTypeId = Symbol.for("~effect/Primitive")

export interface Primitive<out A> {
  readonly [PrimitiveTypeId]: {
    readonly _A: (_: never) => A
  }
  readonly _tag: string

  parse(value: string): Effect.Effect<A, string, Environment>
}

const CommonProto = {
  [PrimitiveTypeId]: {
    _A: (_: never) => _
  }
}

export const trueValues = Schema.Literals(["true", "1", "y", "yes", "on"])

/** @internal */
export const isTrueValue = Schema.is(trueValues)

/** @internal */
export const falseValues = Schema.Literals(["false", "0", "n", "no", "off"])

/** @internal */
export const isFalseValue = Schema.is(falseValues)

const makePrimitive = <A>(
  tag: string,
  parse: (value: string) => Effect.Effect<A, string, Environment>
): Primitive<A> => {
  return {
    ...CommonProto,
    _tag: tag,
    parse
  }
}

// Helper for primitives that don't need FileSystem
const makeSimplePrimitive = <A>(
  tag: string,
  parse: (value: string) => Effect.Effect<A, string>
): Primitive<A> => {
  return {
    ...CommonProto,
    _tag: tag,
    parse: (value) => parse(value) as Effect.Effect<A, string, Environment>
  }
}

// DRY helper to build primitives that rely solely on Schema decoding
const makeSchemaPrimitive = <A>(
  tag: string,
  schema: Schema.Codec<A, string>,
  errorPrefix: string
): Primitive<A> =>
  makeSimplePrimitive(tag, (value) =>
    Schema.decodeUnknownEffect(schema)(value).pipe(
      Effect.mapError((error) => `${errorPrefix}: ${error.message}`)
    ) as Effect.Effect<A, string, never>)

// Boolean primitive retains custom parsing logic
export const booleanPrimitive: Primitive<boolean> = makeSimplePrimitive("Boolean", (value) => {
  if (isTrueValue(value)) return Effect.succeed(true)
  if (isFalseValue(value)) return Effect.succeed(false)
  return Effect.fail(`Unable to recognize '${value}' as a valid boolean`)
})

// Float
const NumberFromString = Schema.String.pipe(
  Schema.decodeTo(Schema.Finite, Transformation.numberFromString)
)
export const floatPrimitive: Primitive<number> = makeSchemaPrimitive(
  "Float",
  NumberFromString,
  "Failed to parse number"
)

// Integer
const IntegerFromString = Schema.String.pipe(
  Schema.decodeTo(Schema.Int, Transformation.numberFromString)
)
export const integerPrimitive: Primitive<number> = makeSchemaPrimitive(
  "Integer",
  IntegerFromString,
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

export const datePrimitive: Primitive<Date> = makeSchemaPrimitive(
  "Date",
  DateFromString,
  "Failed to parse date"
)

// String
export const stringPrimitive: Primitive<string> = makeSimplePrimitive("String", (value) => Effect.succeed(value))

// Choice
export const choicePrimitive = <A>(
  choices: ReadonlyArray<readonly [string, A]>
): Primitive<A> => {
  const choiceMap = new Map(choices)
  const validChoices = choices.map(([key]) => key).join(", ")

  return makeSimplePrimitive("Choice", (value) => {
    if (choiceMap.has(value)) {
      return Effect.succeed(choiceMap.get(value)!)
    }
    return Effect.fail(`Expected one of: ${validChoices}. Got: ${value}`)
  })
}

// Path
export type PathType = "file" | "directory" | "either"

export const pathPrimitive = (
  pathType: PathType,
  mustExist?: boolean
): Primitive<string> =>
  makePrimitive("Path", (value) =>
    Effect.gen(function*() {
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
    }))

// Redacted
export const redactedPrimitive: Primitive<Redacted.Redacted<string>> = makeSimplePrimitive(
  "Redacted",
  (value) => Effect.succeed(Redacted.make(value))
)

// File Content - reads file content as string
export const fileContentPrimitive: Primitive<string> = makePrimitive(
  "FileContent",
  (filePath) =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      // Resolve to absolute path
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath)

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

// File Text - alias for fileContent for consistency with reference API
export const fileTextPrimitive: Primitive<string> = fileContentPrimitive

// File Parse - reads and parses file content using a schema
export const fileParsePrimitive = <A>(
  schema: Schema.Codec<A, string>,
  format?: string
): Primitive<A> =>
  makePrimitive("FileParse", (filePath) =>
    Effect.gen(function*() {
      // First read the file content
      const content = yield* fileContentPrimitive.parse(filePath)

      // Then parse it with the provided schema
      const parsed = yield* Schema.decodeUnknownEffect(schema)(content).pipe(
        Effect.mapError((error) => {
          const formatHint = format ? ` (expected ${format} format)` : ""
          return `Failed to parse file content${formatHint}: ${error.message}`
        })
      )

      return parsed
    }))

// File Schema - reads and validates file content using a schema
export const fileSchemaPrimitive = <A>(
  schema: Schema.Codec<A, string>,
  format?: string
): Primitive<A> => fileParsePrimitive(schema, format)

// KeyValueMap - parses key=value pairs
export const keyValueMapPrimitive: Primitive<Record<string, string>> = makeSimplePrimitive(
  "KeyValueMap",
  (value) =>
    Effect.gen(function*() {
      const parts = value.split("=")
      if (parts.length !== 2) {
        return yield* Effect.fail(`Invalid key=value format. Expected format: key=value, got: ${value}`)
      }
      const [key, val] = parts
      if (!key || !val) {
        return yield* Effect.fail(`Invalid key=value format. Both key and value must be non-empty. Got: ${value}`)
      }
      return { [key]: val }
    })
)

// None - empty sentinel that always fails
export const nonePrimitive: Primitive<never> = makeSimplePrimitive(
  "None",
  (_value) => Effect.fail("This option does not accept values")
)

/**
 * Gets a human-readable type name for a primitive type.
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
