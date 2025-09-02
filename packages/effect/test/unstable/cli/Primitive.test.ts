import { NodeFileSystem, NodePath } from "@effect/platform-node"
import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { Redacted } from "effect/data"
import { Primitive } from "effect/unstable/cli"

// Create a test layer
const TestLayer = Layer.merge(NodeFileSystem.layer, NodePath.layer)

// Helper functions to reduce repetition
const expectValidValues = <A>(
  primitive: Primitive.Primitive<A>,
  cases: Array<[string, A]>
) =>
  Effect.gen(function*() {
    for (const [input, expected] of cases) {
      const result = yield* primitive.parse(input)
      assert.strictEqual(result, expected)
    }
  })

const expectInvalidValues = <A>(
  primitive: Primitive.Primitive<A>,
  inputs: Array<string>,
  errorMatcher?: (error: string) => boolean
) =>
  Effect.gen(function*() {
    for (const input of inputs) {
      const error = yield* Effect.flip(primitive.parse(input))
      if (errorMatcher) {
        assert.isTrue(errorMatcher(error))
      } else {
        assert.isString(error)
      }
    }
  })

const expectValidDates = (
  primitive: Primitive.Primitive<Date>,
  cases: Array<[string, (date: Date) => void]>
) =>
  Effect.gen(function*() {
    for (const [input, validator] of cases) {
      const result = yield* primitive.parse(input)
      assert.isTrue(result instanceof Date)
      validator(result)
    }
  }) as Effect.Effect<void, string, never>

describe("Primitive", () => {
  describe("booleanPrimitive", () => {
    it.effect("should parse true values correctly", () =>
      expectValidValues(Primitive.booleanPrimitive, [
        ["true", true],
        ["1", true],
        ["y", true],
        ["yes", true],
        ["on", true]
      ]).pipe(Effect.provide(TestLayer)))

    it.effect("should parse false values correctly", () =>
      expectValidValues(Primitive.booleanPrimitive, [
        ["false", false],
        ["0", false],
        ["n", false],
        ["no", false],
        ["off", false]
      ]).pipe(Effect.provide(TestLayer)))

    it.effect("should fail for invalid values", () =>
      expectInvalidValues(
        Primitive.booleanPrimitive,
        ["invalid"],
        (error) => error === "Unable to recognize 'invalid' as a valid boolean"
      ).pipe(Effect.provide(TestLayer)))

    it("should have correct _tag", () => {
      assert.strictEqual(Primitive.booleanPrimitive._tag, "Boolean")
    })
  })

  describe("floatPrimitive", () => {
    it.effect("should parse valid float values", () =>
      expectValidValues(Primitive.floatPrimitive, [
        ["42", 42],
        ["3.14", 3.14],
        ["-42.5", -42.5],
        ["0", 0],
        ["1e3", 1000]
      ]).pipe(Effect.provide(TestLayer)))

    it.effect("should fail for invalid values", () =>
      expectInvalidValues(
        Primitive.floatPrimitive,
        ["not-a-number"],
        (error) => error.startsWith("Failed to parse number:")
      ).pipe(Effect.provide(TestLayer)))

    it("should have correct _tag", () => {
      assert.strictEqual(Primitive.floatPrimitive._tag, "Float")
    })
  })

  describe("datePrimitive", () => {
    it.effect("should parse valid date values", () =>
      expectValidDates(Primitive.datePrimitive, [
        // ISO date
        ["2024-01-15", (date) => {
          assert.strictEqual(date.toISOString().slice(0, 10), "2024-01-15")
        }],
        // Full ISO datetime
        ["2024-01-15T12:30:45.123Z", (date) => {
          assert.strictEqual(date.toISOString(), "2024-01-15T12:30:45.123Z")
        }],
        // With timezone offset
        ["2024-01-15T12:30:45+02:00", (date) => {
          assert.strictEqual(date.getUTCHours(), 10)
          assert.strictEqual(date.getUTCMinutes(), 30)
        }]
      ]).pipe(Effect.provide(TestLayer)))

    it("should fail for invalid values", () =>
      expectInvalidValues(
        Primitive.datePrimitive,
        ["not-a-date"],
        (error) => error.startsWith("Failed to parse date:")
      ).pipe(Effect.provide(TestLayer)))

    it("should have correct _tag", () => {
      assert.strictEqual(Primitive.datePrimitive._tag, "Date")
    })
  })

  describe("integerPrimitive", () => {
    it.effect("should parse valid integer values", () =>
      expectValidValues(Primitive.integerPrimitive, [
        ["42", 42],
        ["-123", -123],
        ["0", 0],
        ["9007199254740991", 9007199254740991],
        ["", 0],
        [" 42 ", 42],
        ["1e3", 1000]
      ]).pipe(Effect.provide(TestLayer)))

    it.effect("should fail for invalid values", () =>
      expectInvalidValues(
        Primitive.integerPrimitive,
        ["3.14", "not-a-number"],
        (error) => error.startsWith("Failed to parse integer:")
      ).pipe(Effect.provide(TestLayer)))

    it("should have correct _tag", () => {
      assert.strictEqual(Primitive.integerPrimitive._tag, "Integer")
    })
  })

  describe("stringPrimitive", () => {
    it.effect("should parse string values", () =>
      expectValidValues(Primitive.stringPrimitive, [
        ["hello", "hello"],
        ["", ""],
        [" spaces ", " spaces "],
        ["123", "123"],
        ["special!@#$%", "special!@#$%"]
      ]).pipe(Effect.provide(TestLayer)))

    it("should have correct _tag", () => {
      assert.strictEqual(Primitive.stringPrimitive._tag, "String")
    })
  })

  describe("choicePrimitive", () => {
    const colorChoice = Primitive.choicePrimitive([
      ["red", "RED"],
      ["green", "GREEN"],
      ["blue", "BLUE"]
    ])

    it.effect("should parse valid choices", () =>
      expectValidValues(colorChoice, [
        ["red", "RED"],
        ["green", "GREEN"],
        ["blue", "BLUE"]
      ]).pipe(Effect.provide(TestLayer)))

    it.effect("should fail for invalid choices", () =>
      expectInvalidValues(
        colorChoice,
        ["yellow", "purple", ""],
        (error) => error.includes("Expected one of: red, green, blue")
      ).pipe(Effect.provide(TestLayer)))

    it("should have correct _tag", () => {
      assert.strictEqual(colorChoice._tag, "Choice")
    })

    const numberChoice = Primitive.choicePrimitive([
      ["one", 1],
      ["two", 2],
      ["three", 3]
    ])

    it.effect("should work with different value types", () =>
      expectValidValues(numberChoice, [
        ["one", 1],
        ["two", 2],
        ["three", 3]
      ]).pipe(Effect.provide(TestLayer)))
  })

  describe("pathPrimitive", () => {
    it.effect("should parse paths without validation", () =>
      Effect.gen(function*() {
        const pathPrimitive = Primitive.pathPrimitive("either")
        const result1 = yield* pathPrimitive.parse("./test.txt")
        const result2 = yield* pathPrimitive.parse("/absolute/path")
        const result3 = yield* pathPrimitive.parse("relative/path")

        // Results should be absolute paths
        assert.isTrue(result1.includes("test.txt"))
        assert.isTrue(result2 === "/absolute/path")
        assert.isTrue(result3.includes("relative/path"))
      }).pipe(Effect.provide(TestLayer)))

    it("should have correct _tag", () => {
      assert.strictEqual(Primitive.pathPrimitive("either")._tag, "Path")
    })

    it.effect("should validate file existence when required", () =>
      Effect.gen(function*() {
        const filePath = Primitive.pathPrimitive("file", true)

        // Test non-existent file - should fail validation
        const error = yield* Effect.flip(filePath.parse("/non/existent/file.txt"))
        assert.isTrue(error.includes("does not exist") || error.includes("not found"))
      }).pipe(Effect.provide(TestLayer)))

    it.effect("should validate directory type when required", () =>
      Effect.gen(function*() {
        const dirPath = Primitive.pathPrimitive("directory", true)

        // Test non-existent directory - should fail validation
        const error = yield* Effect.flip(dirPath.parse("/non/existent/directory"))
        assert.isTrue(
          error.includes("does not exist") || error.includes("not found") || error.includes("not a directory")
        )
      }).pipe(Effect.provide(TestLayer)))
  })

  describe("redactedPrimitive", () => {
    it.effect("should parse and redact values", () =>
      Effect.gen(function*() {
        const result = yield* Primitive.redactedPrimitive.parse("secret123")
        // Check if it's a Redacted value
        assert.isTrue(Redacted.isRedacted(result))
        // The toString method should return a redacted representation
        assert.strictEqual(String(result), "<redacted>")
      }).pipe(Effect.provide(TestLayer)))

    it("should have correct _tag", () => {
      assert.strictEqual(Primitive.redactedPrimitive._tag, "Redacted")
    })

    it.effect("should handle empty strings", () =>
      Effect.gen(function*() {
        const result = yield* Primitive.redactedPrimitive.parse("")
        assert.isTrue(Redacted.isRedacted(result))
      }).pipe(Effect.provide(TestLayer)))
  })
})
