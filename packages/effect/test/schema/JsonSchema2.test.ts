import type { Options as AjvOptions } from "ajv"
// eslint-disable-next-line import-x/no-named-as-default
import Ajv from "ajv"
import { Schema } from "effect/schema"
import { describe, it } from "vitest"
import { assertFalse, assertTrue, deepStrictEqual, strictEqual, throws } from "../utils/assert.ts"

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Ajv2020 = require("ajv/dist/2020")

const ajvOptions: Ajv.Options = {
  strictTuples: false,
  allowMatchingProperties: true
}

function getAjvValidate(jsonSchema: object): Ajv.ValidateFunction {
  return new Ajv.default(ajvOptions).compile(jsonSchema)
}

const baseAjvOptions: AjvOptions = {
  allErrors: true,
  strict: false, // warns/throws on unknown keywords depending on Ajv version
  validateSchema: true,
  code: { esm: true } // optional
}

const ajvDraft7 = new Ajv.default(baseAjvOptions)
const ajv2020 = new Ajv2020.default(baseAjvOptions)

async function assertDraft7<S extends Schema.Top>(
  schema: S,
  expected: object,
  options?: Schema.JsonSchemaOptions
) {
  const { jsonSchema, uri } = Schema.makeJsonSchemaDraft07(schema, options)
  strictEqual(uri, "http://json-schema.org/draft-07/schema")
  deepStrictEqual(jsonSchema, expected)
  const valid = ajvDraft7.validateSchema(jsonSchema)
  if (valid instanceof Promise) {
    await valid
  }
  strictEqual(ajvDraft7.errors, null)
  return jsonSchema
}

export async function assertDraft2020_12<S extends Schema.Top>(
  schema: S,
  expected: object,
  options?: Schema.JsonSchemaOptions
) {
  const { jsonSchema, uri } = Schema.makeJsonSchemaDraft2020_12(schema, options)
  strictEqual(uri, "https://json-schema.org/draft/2020-12/schema")
  deepStrictEqual(jsonSchema, expected)
  const valid = ajv2020.validateSchema(jsonSchema)
  if (valid instanceof Promise) {
    await valid
  }
  strictEqual(ajvDraft7.errors, null)
  return jsonSchema
}

export async function assertOpenApi3_1<S extends Schema.Top>(
  schema: S,
  expected: object,
  options?: Schema.JsonSchemaOptions
) {
  const { jsonSchema, uri } = Schema.makeJsonSchemaOpenApi3_1(schema, options)
  strictEqual(uri, "https://json-schema.org/draft/2020-12/schema")
  deepStrictEqual(jsonSchema, expected)
  const valid = ajv2020.validateSchema(jsonSchema)
  if (valid instanceof Promise) {
    await valid
  }
  strictEqual(ajv2020.errors, null)
  return jsonSchema
}

export function assertAjvDraft7Success<S extends Schema.Top>(
  schema: S,
  input: S["Type"]
) {
  const jsonSchema = Schema.makeJsonSchemaDraft07(schema)
  const validate = getAjvValidate(jsonSchema)
  assertTrue(validate(input))
}

export function assertAjvDraft7Failure<S extends Schema.Top>(
  schema: S,
  input: unknown
) {
  const jsonSchema = Schema.makeJsonSchemaDraft07(schema)
  const validate = getAjvValidate(jsonSchema)
  assertFalse(validate(input))
}

export function expectError(schema: Schema.Top, message: string, options?: Schema.JsonSchemaOptions) {
  throws(() => Schema.makeJsonSchemaDraft07(schema, options), new Error(message))
}

describe("ToJsonSchema", () => {
  describe("draft-07", () => {
    describe("Any", () => {
      it("Any", async () => {
        const schema = Schema.Any
        await assertDraft7(schema, {})
      })

      it("Any & annotate", async () => {
        const schema = Schema.Any.annotate({
          title: "title",
          description: "description",
          default: "default",
          examples: ["a"]
        })
        await assertDraft7(schema, {
          title: "title",
          description: "description",
          default: "default",
          examples: ["a"]
        })
      })
    })
  })
})
