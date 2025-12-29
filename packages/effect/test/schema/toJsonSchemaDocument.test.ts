import type { Options as AjvOptions } from "ajv"
import { JsonSchema, Schema, SchemaGetter } from "effect"
// import { FastCheck } from "effect/testing"
import { describe, it } from "vitest"
import { assertTrue, deepStrictEqual, throws } from "../utils/assert.ts"

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Ajv2020 = require("ajv/dist/2020")

const baseAjvOptions: AjvOptions = {
  allErrors: true,
  strict: false, // warns/throws on unknown keywords depending on Ajv version
  validateSchema: true,
  code: { esm: true } // optional
}

const ajvDraft2020_12 = new Ajv2020.default(baseAjvOptions)

function assertUnsupportedSchema(
  schema: Schema.Top,
  message: string,
  options?: Schema.ToJsonSchemaOptions
) {
  throws(() => Schema.toJsonSchemaDocument(schema, options), message)
}

function assertDocument<T, E, RD>(
  schema: Schema.Codec<T, E, RD, never>,
  expected: { schema: JsonSchema.JsonSchema; definitions?: JsonSchema.Definitions },
  options?: Schema.ToJsonSchemaOptions
) {
  const document = Schema.toJsonSchemaDocument(schema, options)
  deepStrictEqual(document, {
    source: "draft-2020-12",
    schema: expected.schema,
    definitions: expected.definitions ?? {}
  })
  const jsonSchema = {
    $schema: JsonSchema.META_SCHEMA_URI_DRAFT_2020_12,
    ...document.schema,
    $defs: document.definitions
  }
  const valid = ajvDraft2020_12.validateSchema(jsonSchema)
  assertTrue(valid)
  // const validate = ajvDraft2020_12.compile(jsonSchema)
  // const arb = Schema.toArbitrary(schema)
  // const codec = Schema.toCodecJson(schema)
  // const encode = Schema.encodeSync(codec)
  // FastCheck.assert(FastCheck.property(arb, (t) => {
  //   const e = encode(t)
  //   return validate(e)
  // }))
}

describe("toJsonSchemaDocument", () => {
  describe("identifier handling", () => {
    it("should use the identifier annotation if present", () => {
      assertDocument(
        Schema.String.annotate({
          identifier: "id" // only the identifier annotation
        }),
        {
          schema: {
            "$ref": "#/$defs/id"
          },
          definitions: {
            "id": {
              "type": "string"
            }
          }
        }
      )
      assertDocument(
        Schema.String.annotate({
          identifier: "id",
          description: "annotate" // with another annotation
        }),
        {
          schema: {
            "$ref": "#/$defs/id"
          },
          definitions: {
            "id": {
              "type": "string",
              "description": "annotate"
            }
          }
        }
      )
    })

    it("should use the identifier annotation even if post-annotated with `annotate`", () => {
      // simulate an imported schema
      const ImportedSchema = Schema.String.annotate({ identifier: "id" })
      assertDocument(
        ImportedSchema.annotate({ description: "annotate" }), // post annotation with `annotate`
        {
          schema: {
            "$ref": "#/$defs/id"
          },
          definitions: {
            "id": {
              "type": "string",
              "description": "annotate"
            }
          }
        }
      )
    })

    it("should use the identifier annotation even if post-annotated with `annotateKey`", () => {
      // simulate an imported schema
      const ImportedSchema = Schema.String.annotate({ identifier: "id" })
      assertDocument(
        Schema.Tuple([
          ImportedSchema.annotateKey({ description: "annotateKey" }) // post annotation with `annotateKey`
        ]),
        {
          schema: {
            "type": "array",
            "prefixItems": [
              {
                "allOf": [
                  { "$ref": "#/$defs/id" },
                  { "description": "annotateKey" }
                ]
              }
            ],
            "minItems": 1,
            "maxItems": 1
          },
          definitions: {
            "id": { "type": "string" }
          }
        }
      )
    })

    it("should use the identifier annotation even if post-annotated with both `annotate` and `annotateKey`", () => {
      // simulate an imported schema
      const ImportedSchema = Schema.String.annotate({ identifier: "id" })
      assertDocument(
        Schema.Tuple([
          ImportedSchema
            .annotate({ description: "annotate" }) // post annotation with `annotate`
            .annotateKey({ description: "annotateKey" }) // post annotation with `annotateKey`
        ]),
        {
          schema: {
            "type": "array",
            "prefixItems": [
              {
                "allOf": [
                  { "$ref": "#/$defs/id" },
                  { "description": "annotateKey" } // annotation with `annotateKey` goes here
                ]
              }
            ],
            "minItems": 1,
            "maxItems": 1
          },
          definitions: {
            "id": {
              "type": "string",
              "description": "annotate" // annotation with `annotate` goes here
            }
          }
        }
      )
    })

    it("should create only one definition for two schemas that share the same reference", () => {
      // simulate an imported schema
      const ImportedSchema = Schema.String.annotate({ identifier: "id", description: "base" })
      assertDocument(
        Schema.Tuple([
          ImportedSchema, // same reference
          ImportedSchema // same reference
        ]),
        {
          schema: {
            "type": "array",
            "prefixItems": [
              { "$ref": "#/$defs/id" },
              { "$ref": "#/$defs/id" }
            ],
            "minItems": 2,
            "maxItems": 2
          },
          definitions: {
            "id": {
              "type": "string",
              "description": "base"
            }
          }
        }
      )
    })

    it("should generate an identifier for two schemas that don't share the same reference because of a post-annotate", () => {
      // simulate an imported schema
      const ImportedSchema = Schema.String.annotate({ identifier: "id", description: "base" })
      assertDocument(
        Schema.Tuple([
          ImportedSchema,
          ImportedSchema.annotate({ description: "annotate" }) // different reference
        ]),
        {
          schema: {
            "type": "array",
            "prefixItems": [
              { "$ref": "#/$defs/id" },
              { "$ref": "#/$defs/id-1" }
            ],
            "minItems": 2,
            "maxItems": 2
          },
          definitions: {
            "id": { "type": "string", "description": "base" }, // inherited description from the imported schema
            "id-1": { "type": "string", "description": "annotate" } // new description from the post-annotate
          }
        }
      )
    })

    it("should generate an identifier for two schemas that don't share the same reference because of a post-annotateKey", () => {
      // simulate an imported schema
      const ImportedSchema = Schema.String.annotate({ identifier: "id", description: "base" })
      assertDocument(
        Schema.Tuple([
          ImportedSchema,
          ImportedSchema.annotateKey({ description: "annotateKey" }) // different reference
        ]),
        {
          schema: {
            "type": "array",
            "prefixItems": [
              { "$ref": "#/$defs/id" },
              {
                "allOf": [
                  { "$ref": "#/$defs/id-1" },
                  { "description": "annotateKey" } // contextual description goes here
                ]
              }
            ],
            "minItems": 2,
            "maxItems": 2
          },
          definitions: {
            "id": { "type": "string", "description": "base" }, // inherited description from the imported schema
            "id-1": { "type": "string", "description": "base" } // inherited description from the imported schema
          }
        }
      )
    })

    it("should generate an identifier which doesn't collide with the present ones", () => {
      assertDocument(
        Schema.Tuple([
          Schema.String.annotate({ identifier: "id", description: "element-1" }),
          // the identifier here uses the same convention as the generated ones
          Schema.String.annotate({ identifier: "id-1", description: "element-2" }),
          // so this should generate "id-2" instead of "id-1"
          Schema.String.annotate({ identifier: "id", description: "element-3" })
        ]),
        {
          schema: {
            "type": "array",
            "prefixItems": [
              { "$ref": "#/$defs/id" },
              { "$ref": "#/$defs/id-1" },
              { "$ref": "#/$defs/id-2" }
            ],
            "minItems": 3,
            "maxItems": 3
          },
          definitions: {
            "id": { "type": "string", "description": "element-1" },
            "id-1": { "type": "string", "description": "element-2" },
            "id-2": { "type": "string", "description": "element-3" }
          }
        }
      )
    })

    describe("Class schemas", () => {
      it("by default should re-use the identifier of the class schema for the encoded side", () => {
        class A extends Schema.Class<A>("A")({
          a: Schema.String
        }) {}
        assertDocument(
          A,
          {
            schema: {
              "$ref": "#/$defs/A"
            },
            definitions: {
              "A": {
                "type": "object",
                "properties": {
                  "a": { "type": "string" }
                },
                "required": ["a"],
                "additionalProperties": false
              }
            }
          }
        )
      })

      it("users can override the identifier of the class schema for the encoded side by using an annotation on the passed struct", () => {
        class A extends Schema.Class<A>("A")(
          Schema.Struct({
            a: Schema.String
          }).annotate({ identifier: "B" }) // override the identifier on the encoded side
        ) {}
        assertDocument(
          A,
          {
            schema: {
              "$ref": "#/$defs/B"
            },
            definitions: {
              "B": {
                "type": "object",
                "properties": {
                  "a": { "type": "string" }
                },
                "required": ["a"],
                "additionalProperties": false
              }
            }
          }
        )
      })

      it("by default should re-use the identifier of the class schema for the type side", () => {
        class A extends Schema.Class<A>("A")({
          a: Schema.String
        }) {}
        assertDocument(
          Schema.toType(A), // type side
          {
            schema: {
              "$ref": "#/$defs/A"
            },
            definitions: {
              "A": {
                "$ref": "#/$defs/A-1"
              },
              "A-1": {
                "type": "object",
                "properties": {
                  "a": { "type": "string" }
                },
                "required": ["a"],
                "additionalProperties": false
              }
            }
          }
        )
      })

      it("users can override the identifier of the class schema for the type side by using an annotation", () => {
        class A extends Schema.Class<A>("A")({
          a: Schema.String
        }, { identifier: "B" }) {} // override the identifier on the type side
        assertDocument(
          Schema.toType(A), // type side
          {
            schema: {
              "$ref": "#/$defs/B"
            },
            definitions: {
              "A": {
                "type": "object",
                "properties": {
                  "a": { "type": "string" }
                },
                "required": ["a"],
                "additionalProperties": false
              },
              "B": {
                "$ref": "#/$defs/A"
              }
            }
          }
        )
      })

      it("using the class schema twice should point to the same definition", () => {
        class A extends Schema.Class<A>("A")({
          a: Schema.String
        }) {}
        assertDocument(
          Schema.Tuple([A, A]),
          {
            schema: {
              "type": "array",
              "prefixItems": [
                { "$ref": "#/$defs/A" },
                { "$ref": "#/$defs/A" }
              ],
              "minItems": 2,
              "maxItems": 2
            },
            definitions: {
              "A": {
                "type": "object",
                "properties": {
                  "a": { "type": "string" }
                },
                "required": ["a"],
                "additionalProperties": false
              }
            }
          }
        )
      })

      it("the type side and the encoded side can be used together", () => {
        class A extends Schema.Class<A>("A")({
          a: Schema.String
        }) {}
        assertDocument(
          Schema.Tuple([Schema.toType(A), A]),
          {
            schema: {
              "type": "array",
              "prefixItems": [
                { "$ref": "#/$defs/A" },
                { "$ref": "#/$defs/A-1" }
              ],
              "minItems": 2,
              "maxItems": 2
            },
            definitions: {
              "A": {
                "$ref": "#/$defs/A-1"
              },
              "A-1": {
                "type": "object",
                "properties": {
                  "a": { "type": "string" }
                },
                "required": ["a"],
                "additionalProperties": false
              }
            }
          }
        )
      })

      it("annotating a class schema should return a struct with the identifier annotation set", () => {
        class A extends Schema.Class<A>("A")({
          a: Schema.String
        }) {}
        assertDocument(
          A.annotate({ description: "description" }),
          {
            schema: {
              "$ref": "#/$defs/A"
            },
            definitions: {
              "A": {
                "type": "object",
                "properties": {
                  "a": { "type": "string" }
                },
                "required": ["a"],
                "additionalProperties": false
              }
            }
          }
        )
      })
    })

    describe("suspended schemas", () => {
      it("should use the identifier annotation if present (outer identifier annotation)", () => {
        type A = readonly [A | null]
        const schema = Schema.Tuple([Schema.NullOr(Schema.suspend((): Schema.Codec<A> => schema))])
          .annotate({ identifier: "A" }) // outer identifier annotation
        assertDocument(
          schema,
          {
            schema: {
              "$ref": "#/$defs/A"
            },
            definitions: {
              "A": {
                "type": "array",
                "prefixItems": [{
                  "anyOf": [
                    { "$ref": "#/$defs/A" },
                    { "type": "null" }
                  ]
                }],
                "minItems": 1,
                "maxItems": 1
              }
            }
          }
        )
      })

      it("should use the identifier annotation if present (inner identifier annotation)", () => {
        type A = readonly [A | null]
        const schema = Schema.Tuple([
          Schema.NullOr(
            Schema.suspend((): Schema.Codec<A> => schema.annotate({ identifier: "A" })) // inner identifier annotation
          )
        ])
        assertDocument(
          schema,
          {
            schema: {
              "type": "array",
              "prefixItems": [{
                "anyOf": [
                  { "$ref": "#/$defs/A" },
                  { "type": "null" }
                ]
              }],
              "minItems": 1,
              "maxItems": 1
            },
            definitions: {
              "A": {
                "type": "array",
                "prefixItems": [{
                  "anyOf": [
                    { "$ref": "#/$defs/A" },
                    { "type": "null" }
                  ]
                }],
                "minItems": 1,
                "maxItems": 1
              }
            }
          }
        )
      })

      it("should generate an identifier for a suspended schema that has a duplicate identifier (robustness)", () => {
        type A = readonly [A | null]
        const A = Schema.Tuple([Schema.NullOr(Schema.suspend((): Schema.Codec<A> => A))])
          .annotate({ identifier: "A" })

        type B = readonly [B | null]
        const B = Schema.Tuple([Schema.NullOr(Schema.suspend((): Schema.Codec<B> => B))])
          .annotate({ identifier: "A" }) // different schema but same identifier

        assertDocument(
          Schema.Tuple([A, B]),
          {
            schema: {
              "type": "array",
              "prefixItems": [
                { "$ref": "#/$defs/A" },
                { "$ref": "#/$defs/A-1" }
              ],
              "minItems": 2,
              "maxItems": 2
            },
            definitions: {
              "A": {
                "type": "array",
                "prefixItems": [{
                  "anyOf": [
                    { "$ref": "#/$defs/A" },
                    { "type": "null" }
                  ]
                }],
                "minItems": 1,
                "maxItems": 1
              },
              "A-1": {
                "type": "array",
                "prefixItems": [{
                  "anyOf": [
                    { "$ref": "#/$defs/A-1" }, // correctly pointing to the generated identifier
                    { "type": "null" }
                  ]
                }],
                "minItems": 1,
                "maxItems": 1
              }
            }
          }
        )
      })
    })
  })

  describe("Thrown errors", () => {
    it("should throw if there is a suspended schema without an identifier", () => {
      type A = readonly [A | null]
      const schema = Schema.Tuple([Schema.NullOr(Schema.suspend((): Schema.Codec<A> => schema))])
      assertUnsupportedSchema(schema, `Suspended schema without identifier`)
    })

    describe("Tuple", () => {
      it("Unsupported post-rest elements", () => {
        assertUnsupportedSchema(
          Schema.TupleWithRest(Schema.Tuple([]), [Schema.Finite, Schema.String]),
          "Generating a JSON Schema for post-rest elements is not supported"
        )
      })
    })

    describe("Struct", () => {
      it("Unsupported property signature name", () => {
        const a = Symbol.for("effect/Schema/test/a")
        assertUnsupportedSchema(
          Schema.Struct({ [a]: Schema.String }),
          `Unsupported property signature name: Symbol(effect/Schema/test/a)`
        )
      })

      it("Unsupported index signature parameter", () => {
        assertUnsupportedSchema(
          Schema.Record(Schema.Symbol, Schema.Finite),
          `Unsupported index signature parameter`
        )
      })
    })
  })

  describe("options", () => {
    it("generateDescriptions: true", () => {
      assertDocument(
        Schema.String.annotate({ expected: "b" }),
        {
          schema: { "type": "string", "description": "b" }
        },
        { generateDescriptions: true }
      )
      assertDocument(
        Schema.String.annotate({ description: "a", expected: "b" }),
        {
          schema: { "type": "string", "description": "a" }
        },
        { generateDescriptions: true }
      )
    })

    describe("topLevelReferenceStrategy", () => {
      describe(`"skip-top-level"`, () => {
        it("String", () => {
          assertDocument(
            Schema.String.annotate({ identifier: "a/b" }),
            {
              schema: {
                "type": "string"
              },
              definitions: {
                "a/b": {
                  "type": "string"
                }
              }
            },
            {
              referenceStrategy: "skip-top-level"
            }
          )
        })

        describe("Suspend", () => {
          it("inner annotation", () => {
            interface A {
              readonly a: string
              readonly as: ReadonlyArray<A>
            }
            const schema = Schema.Struct({
              a: Schema.String,
              as: Schema.Array(Schema.suspend((): Schema.Codec<A> => schema.annotate({ identifier: "A" })))
            })
            assertDocument(schema, {
              schema: {
                "type": "object",
                "properties": {
                  "a": {
                    "type": "string"
                  },
                  "as": {
                    "type": "array",
                    "items": { "$ref": "#/$defs/A" }
                  }
                },
                "required": ["a", "as"],
                "additionalProperties": false
              },
              definitions: {
                "A": {
                  "type": "object",
                  "properties": {
                    "a": {
                      "type": "string"
                    },
                    "as": {
                      "type": "array",
                      "items": { "$ref": "#/$defs/A" }
                    }
                  },
                  "required": ["a", "as"],
                  "additionalProperties": false
                }
              }
            }, {
              referenceStrategy: "skip-top-level"
            })
          })

          it("outer annotation", () => {
            interface A {
              readonly a: string
              readonly as: ReadonlyArray<A>
            }
            const schema = Schema.Struct({
              a: Schema.String,
              as: Schema.Array(Schema.suspend((): Schema.Codec<A> => schema))
            }).annotate({ identifier: "A" })
            assertDocument(
              schema,
              {
                schema: {
                  "type": "object",
                  "properties": {
                    "a": {
                      "type": "string"
                    },
                    "as": {
                      "type": "array",
                      "items": { "$ref": "#/$defs/A" }
                    }
                  },
                  "required": ["a", "as"],
                  "additionalProperties": false
                },
                definitions: {
                  "A": {
                    "type": "object",
                    "properties": {
                      "a": {
                        "type": "string"
                      },
                      "as": {
                        "type": "array",
                        "items": { "$ref": "#/$defs/A" }
                      }
                    },
                    "required": ["a", "as"],
                    "additionalProperties": false
                  }
                }
              },
              {
                referenceStrategy: "skip-top-level"
              }
            )
          })
        })
      })
    })

    describe("additionalProperties", () => {
      it(`false (default)`, () => {
        const schema = Schema.Struct({ a: Schema.String })

        assertDocument(schema, {
          schema: {
            "type": "object",
            "properties": {
              "a": {
                "type": "string"
              }
            },
            "required": ["a"],
            "additionalProperties": false
          }
        }, {
          additionalProperties: false
        })
      })

      it(`true`, () => {
        const schema = Schema.Struct({ a: Schema.String })

        assertDocument(schema, {
          schema: {
            "type": "object",
            "properties": {
              "a": {
                "type": "string"
              }
            },
            "required": ["a"],
            "additionalProperties": true
          }
        }, {
          additionalProperties: true
        })
      })

      it(`schema`, () => {
        const schema = Schema.Struct({ a: Schema.String })

        assertDocument(schema, {
          schema: {
            "type": "object",
            "properties": {
              "a": {
                "type": "string"
              }
            },
            "required": ["a"],
            "additionalProperties": { "type": "string" }
          }
        }, {
          additionalProperties: { "type": "string" }
        })
      })
    })
  })

  describe("refs", () => {
    it(`refs should be created using the pattern: "#/$defs/IDENTIFIER"`, () => {
      assertDocument(
        Schema.String.annotate({ identifier: "ID" }),
        {
          schema: {
            "$ref": "#/$defs/ID"
          },
          definitions: {
            "ID": {
              "type": "string"
            }
          }
        }
      )
    })

    it(`refs should escape "~" and "/"`, () => {
      assertDocument(
        Schema.String.annotate({ identifier: "ID~a/b" }),
        {
          schema: {
            "$ref": "#/$defs/ID~0a~1b"
          },
          definitions: {
            "ID~a/b": {
              "type": "string"
            }
          }
        }
      )
    })

    it("String & identifier", () => {
      assertDocument(
        Schema.String.annotate({ identifier: "ID" }),
        {
          schema: {
            "$ref": "#/$defs/ID"
          },
          definitions: {
            "ID": {
              "type": "string"
            }
          }
        }
      )
      assertDocument(
        Schema.String.annotate({
          identifier: "ID",
          description: "a"
        }),
        {
          schema: {
            "$ref": "#/$defs/ID"
          },
          definitions: {
            "ID": {
              "type": "string",
              "description": "a"
            }
          }
        }
      )
    })

    it("String & check & identifier", () => {
      assertDocument(
        Schema.String.check(Schema.isMinLength(2, { identifier: "ID" })),
        {
          schema: {
            "$ref": "#/$defs/ID"
          },
          definitions: {
            "ID": {
              "type": "string",
              "allOf": [
                { "minLength": 2 }
              ]
            }
          }
        }
      )
    })

    it("String & check & annotations + identifier", () => {
      assertDocument(
        Schema.String.check(Schema.isMinLength(2)).annotate({
          identifier: "ID",
          description: "a"
        }),
        {
          schema: {
            "$ref": "#/$defs/ID"
          },
          definitions: {
            ID: {
              "type": "string",
              "allOf": [
                { "minLength": 2, "description": "a" }
              ]
            }
          }
        }
      )
    })

    it("using a schema with two different encodings", () => {
      const To = Schema.String.annotate({ identifier: "ID" })
      const schema1 = To.pipe(Schema.encodeTo(Schema.Literal(1), {
        decode: SchemaGetter.succeed("a"),
        encode: SchemaGetter.succeed(1)
      }))
      const schema2 = To.pipe(Schema.encodeTo(Schema.Literal(2), {
        decode: SchemaGetter.succeed("b"),
        encode: SchemaGetter.succeed(2)
      }))
      const schema = Schema.Union([schema1, schema2])
      assertDocument(schema, {
        schema: {
          "anyOf": [
            {
              "type": "number",
              "enum": [1]
            },
            {
              "type": "number",
              "enum": [2]
            }
          ]
        }
      })
    })

    it("using the same identifier annotated schema twice", () => {
      const schema1 = Schema.String.annotate({ identifier: "ID" })
      assertDocument(
        Schema.Union([schema1, schema1]),
        {
          schema: {
            "anyOf": [
              { "$ref": "#/$defs/ID" },
              { "$ref": "#/$defs/ID" }
            ]
          },
          definitions: {
            "ID": { "type": "string" }
          }
        }
      )
      assertDocument(
        Schema.Union([schema1, schema1.annotate({ description: "description" })]),
        {
          schema: {
            "anyOf": [
              { "$ref": "#/$defs/ID" },
              { "$ref": "#/$defs/ID-1" }
            ]
          },
          definitions: {
            "ID": { "type": "string" },
            "ID-1": { "type": "string", "description": "description" }
          }
        }
      )
    })
  })

  describe("Declaration", () => {
    it("Date", () => {
      const schema = Schema.Date
      assertDocument(schema, {
        schema: {
          "type": "string"
        }
      })
    })

    it("ValidDate", () => {
      const schema = Schema.ValidDate
      assertDocument(schema, {
        schema: {
          "type": "string",
          "allOf": [
            { "format": "date-time" }
          ]
        }
      })
    })

    it("URL", () => {
      const schema = Schema.URL
      assertDocument(schema, {
        schema: {
          "type": "string"
        }
      })
    })

    it("Error", () => {
      const schema = Schema.Error
      assertDocument(schema, {
        schema: {
          "type": "object",
          "properties": {
            "name": {
              "type": "string"
            },
            "message": {
              "type": "string"
            },
            "stack": {
              "type": "string"
            }
          },
          "required": ["message"],
          "additionalProperties": false
        }
      })
    })

    it("RegExp", () => {
      const schema = Schema.RegExp
      assertDocument(schema, {
        schema: {
          "type": "object",
          "properties": {
            "source": {
              "type": "string"
            },
            "flags": {
              "type": "string"
            }
          },
          "required": ["source", "flags"],
          "additionalProperties": false
        }
      })
    })

    it("Uint8Array", () => {
      const schema = Schema.Uint8Array
      assertDocument(schema, {
        schema: {
          "type": "string"
        }
      })
    })

    it("Duration", () => {
      const schema = Schema.Duration
      assertDocument(schema, {
        schema: {
          "anyOf": [
            {
              "type": "string",
              "allOf": [
                {
                  "pattern": "^-?\\d+$"
                }
              ]
            },
            {
              "type": "integer",
              "allOf": [
                {
                  "minimum": 0
                }
              ]
            },
            {
              "type": "string",
              "enum": [
                "Infinity"
              ]
            }
          ]
        }
      })
    })

    it("Option(String)", () => {
      const schema = Schema.Option(Schema.String)
      assertDocument(schema, {
        schema: {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "_tag": {
                  "type": "string",
                  "enum": ["Some"]
                },
                "value": {
                  "type": "string"
                }
              },
              "required": ["_tag", "value"],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "_tag": {
                  "type": "string",
                  "enum": ["None"]
                }
              },
              "required": ["_tag"],
              "additionalProperties": false
            }
          ]
        }
      })
    })
  })

  it("Any", () => {
    const schema = Schema.Any
    assertDocument(
      schema,
      {
        schema: {}
      }
    )
    assertDocument(
      schema.annotate({ description: "a" }),
      {
        schema: {
          "description": "a"
        }
      }
    )
  })

  it("Unknown", () => {
    const schema = Schema.Unknown
    assertDocument(
      schema,
      {
        schema: {
          "type": "null"
        }
      }
    )
    assertDocument(
      schema.annotate({ description: "a" }),
      {
        schema: {
          "type": "null",
          "description": "a"
        }
      }
    )
  })

  it("Void", () => {
    const schema = Schema.Void
    assertDocument(
      schema,
      {
        schema: {
          "type": "null"
        }
      }
    )
    assertDocument(
      schema.annotate({ description: "a" }),
      {
        schema: {
          "type": "null",
          "description": "a"
        }
      }
    )
  })

  it("Undefined", () => {
    const schema = Schema.Undefined
    assertDocument(
      schema,
      {
        schema: {
          "type": "null"
        }
      }
    )
    assertDocument(
      schema.annotate({ description: "a" }),
      {
        schema: {
          "type": "null",
          "description": "a"
        }
      }
    )
  })

  it("BigInt", () => {
    const schema = Schema.BigInt
    assertDocument(
      schema,
      {
        schema: {
          "type": "string",
          "allOf": [
            { "pattern": "^-?\\d+$" }
          ]
        }
      }
    )
  })

  it("Symbol", () => {
    const schema = Schema.Symbol
    assertDocument(
      schema,
      {
        schema: {
          "type": "string",
          "allOf": [
            { "pattern": "^Symbol\\((.*)\\)$" }
          ]
        }
      }
    )
  })

  it("UniqueSymbol", () => {
    const schema = Schema.UniqueSymbol(Symbol.for("a"))
    assertDocument(
      schema,
      {
        schema: {
          "type": "string",
          "allOf": [
            { "pattern": "^Symbol\\((.*)\\)$" }
          ]
        }
      }
    )
  })

  it("Never", () => {
    const schema = Schema.Never
    assertDocument(
      schema,
      {
        schema: {
          "not": {}
        }
      }
    )
    assertDocument(
      schema.annotate({ description: "a" }),
      {
        schema: {
          "description": "a",
          "not": {}
        }
      }
    )
  })

  it("Null", () => {
    const schema = Schema.Null
    assertDocument(
      schema,
      {
        schema: {
          "type": "null"
        }
      }
    )
    assertDocument(
      schema.annotate({ description: "a" }),
      {
        schema: {
          "type": "null",
          "description": "a"
        }
      }
    )
  })

  describe("String", () => {
    it("String", () => {
      assertDocument(
        Schema.String,
        {
          schema: {
            "type": "string"
          }
        }
      )
    })

    it("String & annotate", () => {
      assertDocument(
        Schema.String.annotate({ description: "a" }),
        {
          schema: {
            "type": "string",
            "description": "a"
          }
        }
      )
    })

    it("should ignore annotateKey annotations if the schema is not contextual", () => {
      assertDocument(
        Schema.String.annotateKey({
          description: "a"
        }),
        {
          schema: {
            "type": "string"
          }
        }
      )
    })

    it("String & check", () => {
      assertDocument(
        Schema.String.check(Schema.isMinLength(2)),
        {
          schema: {
            "type": "string",
            "allOf": [
              { "minLength": 2 }
            ]
          }
        }
      )
    })

    it("String & custom check without annotation", () => {
      assertDocument(
        Schema.String.check(Schema.makeFilter(() => true)),
        {
          schema: {
            "type": "string"
          }
        }
      )
    })

    it("String & annotate & check", () => {
      assertDocument(
        Schema.String.annotate({ description: "a" }).check(Schema.isMinLength(2)),
        {
          schema: {
            "type": "string",
            "description": "a",
            "allOf": [
              { "minLength": 2 }
            ]
          }
        }
      )
    })

    it("String & annotate & check & identifier", () => {
      assertDocument(
        Schema.String.annotate({ description: "a" }).check(Schema.isMinLength(2, { identifier: "id" })),
        {
          schema: {
            "$ref": "#/$defs/id"
          },
          definitions: {
            id: {
              "type": "string",
              "description": "a",
              "allOf": [
                { "minLength": 2 }
              ]
            }
          }
        }
      )
    })

    it("String & check & annotate", () => {
      assertDocument(
        Schema.String.check(Schema.isMinLength(2)).annotate({
          description: "a"
        }),
        {
          schema: {
            "type": "string",
            "allOf": [
              { "minLength": 2, "description": "a" }
            ]
          }
        }
      )
    })

    it("String & check & check", () => {
      assertDocument(
        Schema.String.check(Schema.isMinLength(2), Schema.isMaxLength(3)),
        {
          schema: {
            "type": "string",
            "allOf": [
              { "minLength": 2 },
              { "maxLength": 3 }
            ]
          }
        }
      )
    })

    it("String & annotate & check & check", () => {
      assertDocument(
        Schema.String.annotate({ description: "a" }).check(Schema.isMinLength(2), Schema.isMaxLength(3)),
        {
          schema: {
            "type": "string",
            "description": "a",
            "allOf": [
              { "minLength": 2 },
              { "maxLength": 3 }
            ]
          }
        }
      )
    })

    it("String & check & check & annotate", () => {
      assertDocument(
        Schema.String.check(Schema.isMinLength(2), Schema.isMaxLength(3)).annotate({
          description: "a"
        }),
        {
          schema: {
            "type": "string",
            "allOf": [
              {
                "minLength": 2
              },
              {
                "maxLength": 3,
                "description": "a"
              }
            ]
          }
        }
      )
    })

    it("String & annotate & check & check & annotate", () => {
      assertDocument(
        Schema.String.annotate({ description: "a" }).check(
          Schema.isMinLength(2),
          Schema.isMaxLength(3, { description: "c" })
        ),
        {
          schema: {
            "type": "string",
            "description": "a",
            "allOf": [
              {
                "minLength": 2
              },
              {
                "maxLength": 3,
                "description": "c"
              }
            ]
          }
        }
      )
    })

    it("String & check & annotations & check & annotations", () => {
      assertDocument(
        Schema.String.check(
          Schema.isMinLength(2, { description: "b" }),
          Schema.isMaxLength(3, { description: "c" })
        ),
        {
          schema: {
            "type": "string",
            "allOf": [
              {
                "minLength": 2,
                "description": "b"
              },
              {
                "maxLength": 3,
                "description": "c"
              }
            ]
          }
        }
      )
    })

    it("String & annotations & check & annotations & check & annotations", () => {
      assertDocument(
        Schema.String.annotate({ description: "a" }).check(
          Schema.isMinLength(2, { description: "b" }),
          Schema.isMaxLength(3, { description: "c" })
        ),
        {
          schema: {
            "type": "string",
            "description": "a",
            "allOf": [
              {
                "minLength": 2,
                "description": "b"
              },
              {
                "maxLength": 3,
                "description": "c"
              }
            ]
          }
        }
      )
    })

    describe("checks", () => {
      it("isPattern", () => {
        assertDocument(Schema.String.check(Schema.isPattern(/^abb+$/)), {
          schema: {
            "type": "string",
            "allOf": [
              { "pattern": "^abb+$" }
            ]
          }
        })
      })

      it("isTrimmed", () => {
        const schema = Schema.Trimmed
        assertDocument(schema, {
          schema: {
            "type": "string",
            "allOf": [
              { "pattern": "^\\S[\\s\\S]*\\S$|^\\S$|^$" }
            ]
          }
        })
      })

      it("isLowercased", () => {
        const schema = Schema.String.check(Schema.isLowercased())
        assertDocument(schema, {
          schema: {
            "type": "string",
            "allOf": [
              { "pattern": "^[^A-Z]*$" }
            ]
          }
        })
      })

      it("isUppercased", () => {
        const schema = Schema.String.check(Schema.isUppercased())
        assertDocument(schema, {
          schema: {
            "type": "string",
            "allOf": [
              { "pattern": "^[^a-z]*$" }
            ]
          }
        })
      })

      it("isCapitalized", () => {
        const schema = Schema.String.check(Schema.isCapitalized())
        assertDocument(schema, {
          schema: {
            "type": "string",
            "allOf": [
              { "pattern": "^[^a-z]?.*$" }
            ]
          }
        })
      })

      it("isUncapitalized", () => {
        const schema = Schema.String.check(Schema.isUncapitalized())
        assertDocument(schema, {
          schema: {
            "type": "string",
            "allOf": [
              { "pattern": "^[^A-Z]?.*$" }
            ]
          }
        })
      })

      describe("isLength", () => {
        it("String", () => {
          assertDocument(
            Schema.String.check(Schema.isLength(2)),
            {
              schema: {
                "type": "string",
                "allOf": [
                  { "minLength": 2 },
                  { "maxLength": 2 }
                ]
              }
            }
          )
        })

        it("Array", () => {
          assertDocument(
            Schema.Array(Schema.String).check(Schema.isLength(2)),
            {
              schema: {
                "type": "array",
                "items": {
                  "type": "string"
                },
                "allOf": [
                  { "minItems": 2 },
                  { "maxItems": 2 }
                ]
              }
            }
          )
        })

        it("NonEmptyArray", () => {
          assertDocument(
            Schema.NonEmptyArray(Schema.String).check(Schema.isLength(2)),
            {
              schema: {
                "type": "array",
                "prefixItems": [{
                  "type": "string"
                }],
                "items": {
                  "type": "string"
                },
                "minItems": 1,
                "allOf": [
                  { "minItems": 2 },
                  { "maxItems": 2 }
                ]
              }
            }
          )
        })
      })

      describe("isMinLength", () => {
        it("String", () => {
          assertDocument(
            Schema.String.check(Schema.isMinLength(2)),
            {
              schema: {
                "type": "string",
                "allOf": [
                  { "minLength": 2 }
                ]
              }
            }
          )
        })

        it("Array", () => {
          assertDocument(
            Schema.Array(Schema.String).check(Schema.isMinLength(2)),
            {
              schema: {
                "type": "array",
                "items": {
                  "type": "string"
                },
                "allOf": [
                  { "minItems": 2 }
                ]
              }
            }
          )
        })

        it("NonEmptyArray", () => {
          assertDocument(
            Schema.NonEmptyArray(Schema.String).check(Schema.isMinLength(2)),
            {
              schema: {
                "type": "array",
                "prefixItems": [{
                  "type": "string"
                }],
                "items": {
                  "type": "string"
                },
                "minItems": 1,
                "allOf": [
                  { "minItems": 2 }
                ]
              }
            }
          )
        })
      })

      describe("isMaxLength", () => {
        it("String", () => {
          assertDocument(
            Schema.String.check(Schema.isMaxLength(2)),
            {
              schema: {
                "type": "string",
                "allOf": [
                  { "maxLength": 2 }
                ]
              }
            }
          )
        })

        it("Array", () => {
          assertDocument(
            Schema.Array(Schema.String).check(Schema.isMaxLength(2)),
            {
              schema: {
                "type": "array",
                "items": {
                  "type": "string"
                },
                "allOf": [
                  { "maxItems": 2 }
                ]
              }
            }
          )
        })

        it("NonEmptyArray", () => {
          assertDocument(
            Schema.NonEmptyArray(Schema.String).check(Schema.isMaxLength(2)),
            {
              schema: {
                "type": "array",
                "minItems": 1,
                "prefixItems": [{
                  "type": "string"
                }],
                "items": {
                  "type": "string"
                },
                "allOf": [
                  { "maxItems": 2 }
                ]
              }
            }
          )
        })
      })

      it("isUUID", () => {
        assertDocument(
          Schema.String.annotate({ description: "description" }).check(Schema.isUUID(undefined)),
          {
            schema: {
              "type": "string",
              "description": "description",
              "allOf": [
                {
                  "format": "uuid",
                  "pattern":
                    "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000)$"
                }
              ]
            }
          }
        )
      })

      it("isBase64", () => {
        assertDocument(
          Schema.String.annotate({ description: "description" }).check(Schema.isBase64()),
          {
            schema: {
              "type": "string",
              "description": "description",
              "allOf": [
                { "pattern": "^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$" }
              ]
            }
          }
        )
      })

      it("isBase64Url", () => {
        assertDocument(
          Schema.String.annotate({ description: "description" }).check(Schema.isBase64Url()),
          {
            schema: {
              "type": "string",
              "description": "description",
              "allOf": [
                { "pattern": "^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$" }
              ]
            }
          }
        )
      })
    })
  })

  describe("Number", () => {
    it("Number", () => {
      const schema = Schema.Number
      assertDocument(
        schema,
        {
          schema: {
            "anyOf": [
              { "type": "number" },
              { "type": "string", "enum": ["NaN"] },
              { "type": "string", "enum": ["Infinity"] },
              { "type": "string", "enum": ["-Infinity"] }
            ]
          }
        }
      )
      assertDocument(
        schema.annotate({ description: "a" }),
        {
          schema: {
            "anyOf": [
              { "type": "number" },
              { "type": "string", "enum": ["NaN"] },
              { "type": "string", "enum": ["Infinity"] },
              { "type": "string", "enum": ["-Infinity"] }
            ],
            "description": "a"
          }
        }
      )
    })
  })

  describe("Finite", () => {
    it("Finite", () => {
      assertDocument(
        Schema.Finite,
        {
          schema: {
            "type": "number"
          }
        }
      )
      assertDocument(
        Schema.Finite.annotate({ description: "a" }),
        {
          schema: {
            "type": "number",
            "allOf": [{
              "description": "a"
            }]
          }
        }
      )
    })

    describe("checks", () => {
      it("isInt", () => {
        assertDocument(
          Schema.Finite.check(Schema.isInt()),
          {
            schema: {
              "type": "integer"
            }
          }
        )
      })

      it("isInt32", () => {
        assertDocument(
          Schema.Finite.check(Schema.isInt32()),
          {
            schema: {
              "type": "integer",
              "allOf": [
                { "maximum": 2147483647, "minimum": -2147483648 }
              ]
            }
          }
        )
      })

      it("isUint32", () => {
        assertDocument(
          Schema.Finite.check(Schema.isUint32()),
          {
            schema: {
              "type": "integer",
              "allOf": [
                { "maximum": 4294967295, "minimum": 0 }
              ]
            }
          }
        )
        assertDocument(
          Schema.Finite.check(Schema.isUint32({ description: "a" })),
          {
            schema: {
              "type": "integer",
              "allOf": [
                {
                  "description": "a",
                  "allOf": [
                    { "maximum": 4294967295, "minimum": 0 }
                  ]
                }
              ]
            }
          }
        )
        assertDocument(
          Schema.Finite.check(
            Schema.isUint32({ description: "a" })
          ),
          {
            schema: {
              "type": "integer",
              "allOf": [
                {
                  "description": "a",
                  "allOf": [
                    { "maximum": 4294967295, "minimum": 0 }
                  ]
                }
              ]
            }
          }
        )
      })

      it("isGreaterThan", () => {
        assertDocument(
          Schema.Finite.check(Schema.isGreaterThan(1)),
          {
            schema: {
              "type": "number",
              "allOf": [
                { "exclusiveMinimum": 1 }
              ]
            }
          }
        )
      })

      it("isGreaterThanOrEqualTo", () => {
        assertDocument(
          Schema.Finite.check(Schema.isGreaterThanOrEqualTo(1)),
          {
            schema: {
              "type": "number",
              "allOf": [
                { "minimum": 1 }
              ]
            }
          }
        )
      })

      it("isLessThan", () => {
        assertDocument(Schema.Finite.check(Schema.isLessThan(1)), {
          schema: {
            "type": "number",
            "allOf": [
              { "exclusiveMaximum": 1 }
            ]
          }
        })
      })

      it("isLessThanOrEqualTo", () => {
        assertDocument(Schema.Finite.check(Schema.isLessThanOrEqualTo(1)), {
          schema: {
            "type": "number",
            "allOf": [
              { "maximum": 1 }
            ]
          }
        })
      })

      it("isBetween", () => {
        assertDocument(
          Schema.Finite.check(Schema.isBetween({ minimum: 1, maximum: 10 })),
          {
            schema: {
              "type": "number",
              "allOf": [
                { "minimum": 1, "maximum": 10 }
              ]
            }
          }
        )
        assertDocument(
          Schema.Finite.check(
            Schema.isBetween({ minimum: 1, maximum: 10, exclusiveMinimum: true })
          ),
          {
            schema: {
              "type": "number",
              "allOf": [
                { "exclusiveMinimum": 1, "maximum": 10 }
              ]
            }
          }
        )
        assertDocument(
          Schema.Finite.check(
            Schema.isBetween({ minimum: 1, maximum: 10, exclusiveMaximum: true })
          ),
          {
            schema: {
              "type": "number",
              "allOf": [
                { "minimum": 1, "exclusiveMaximum": 10 }
              ]
            }
          }
        )
        assertDocument(
          Schema.Finite.check(
            Schema.isBetween({ minimum: 1, maximum: 10, exclusiveMinimum: true, exclusiveMaximum: true })
          ),
          {
            schema: {
              "type": "number",
              "allOf": [
                { "exclusiveMinimum": 1, "exclusiveMaximum": 10 }
              ]
            }
          }
        )
      })

      it("isMultipleOf", () => {
        assertDocument(
          Schema.Int.check(Schema.isMultipleOf(2)),
          {
            schema: {
              "type": "integer",
              "allOf": [
                { "multipleOf": 2 }
              ]
            }
          }
        )
      })
    })
  })

  it("Boolean", () => {
    const schema = Schema.Boolean
    assertDocument(
      schema,
      {
        schema: {
          "type": "boolean"
        }
      }
    )
    assertDocument(
      schema.annotate({ description: "a" }),
      {
        schema: {
          "type": "boolean",
          "description": "a"
        }
      }
    )
  })

  it("ObjectKeyword", () => {
    const schema = Schema.ObjectKeyword
    assertDocument(
      schema,
      {
        schema: {
          "type": "null"
        }
      }
    )
    assertDocument(
      schema.annotate({ description: "a" }),
      {
        schema: {
          "type": "null",
          "description": "a"
        }
      }
    )
  })

  describe("Literal", () => {
    it("string", () => {
      const schema = Schema.Literal("a")
      assertDocument(
        schema,
        {
          schema: {
            "type": "string",
            "enum": ["a"]
          }
        }
      )
      assertDocument(
        schema.annotate({ description: "a" }),
        {
          schema: {
            "type": "string",
            "enum": ["a"],
            "description": "a"
          }
        }
      )
    })

    it("number", () => {
      const schema = Schema.Literal(1)
      assertDocument(
        schema,
        {
          schema: {
            "type": "number",
            "enum": [1]
          }
        }
      )
      assertDocument(
        schema.annotate({ description: "a" }),
        {
          schema: {
            "type": "number",
            "enum": [1],
            "description": "a"
          }
        }
      )
    })

    it("boolean", () => {
      const schema = Schema.Literal(true)
      assertDocument(
        schema,
        {
          schema: {
            "type": "boolean",
            "enum": [true]
          }
        }
      )
      assertDocument(
        schema.annotate({ description: "a" }),
        {
          schema: {
            "type": "boolean",
            "enum": [true],
            "description": "a"
          }
        }
      )
    })

    it("bigint", () => {
      const schema = Schema.Literal(1n)
      assertDocument(
        schema,
        {
          schema: {
            "type": "string",
            "enum": ["1"]
          }
        }
      )
      assertDocument(
        schema.annotate({ description: "a" }),
        {
          schema: {
            "type": "string",
            "enum": ["1"],
            "description": "a"
          }
        }
      )
    })
  })

  describe("Literals", () => {
    it("empty literals", () => {
      const schema = Schema.Literals([])
      assertDocument(
        schema,
        {
          schema: {
            "not": {}
          }
        }
      )
      assertDocument(
        schema.annotate({ description: "a" }),
        {
          schema: {
            "not": {},
            "description": "a"
          }
        }
      )
    })

    it("strings", () => {
      const schema = Schema.Literals(["a", "b"])
      assertDocument(
        schema,
        {
          schema: {
            "anyOf": [
              {
                "type": "string",
                "enum": ["a"]
              },
              {
                "type": "string",
                "enum": ["b"]
              }
            ]
          }
        }
      )
      assertDocument(
        schema.annotate({ description: "a" }),
        {
          schema: {
            "anyOf": [
              {
                "type": "string",
                "enum": ["a"]
              },
              {
                "type": "string",
                "enum": ["b"]
              }
            ],
            "description": "a"
          }
        }
      )
    })

    it("numbers", () => {
      const schema = Schema.Literals([1, 2])
      assertDocument(
        schema,
        {
          schema: {
            "anyOf": [
              {
                "type": "number",
                "enum": [1]
              },
              {
                "type": "number",
                "enum": [2]
              }
            ]
          }
        }
      )
      assertDocument(
        schema.annotate({ description: "a" }),
        {
          schema: {
            "anyOf": [
              {
                "type": "number",
                "enum": [1]
              },
              {
                "type": "number",
                "enum": [2]
              }
            ],
            "description": "a"
          }
        }
      )
    })

    it("booleans", () => {
      const schema = Schema.Literals([true, false])
      assertDocument(
        schema,
        {
          schema: {
            "anyOf": [
              {
                "type": "boolean",
                "enum": [true]
              },
              {
                "type": "boolean",
                "enum": [false]
              }
            ]
          }
        }
      )
      assertDocument(
        schema.annotate({ description: "a" }),
        {
          schema: {
            "anyOf": [
              {
                "type": "boolean",
                "enum": [true]
              },
              {
                "type": "boolean",
                "enum": [false]
              }
            ],
            "description": "a"
          }
        }
      )
    })

    it("strings & numbers", () => {
      const schema = Schema.Literals(["a", 1])
      assertDocument(
        schema,
        {
          schema: {
            "anyOf": [
              {
                "type": "string",
                "enum": ["a"]
              },
              {
                "type": "number",
                "enum": [1]
              }
            ]
          }
        }
      )
      assertDocument(
        schema.annotate({ description: "a" }),
        {
          schema: {
            "anyOf": [
              {
                "type": "string",
                "enum": ["a"]
              },
              {
                "type": "number",
                "enum": [1]
              }
            ],
            "description": "a"
          }
        }
      )
    })
  })

  describe("Union of literals", () => {
    it("strings", () => {
      const schema = Schema.Union([
        Schema.Literal("a"),
        Schema.Literal("b")
      ])
      assertDocument(
        schema,
        {
          schema: {
            "anyOf": [
              {
                "type": "string",
                "enum": ["a"]
              },
              {
                "type": "string",
                "enum": ["b"]
              }
            ]
          }
        }
      )
      const jsonAnnotations = {
        "title": "title",
        "description": "description",
        "default": "a" as const,
        "examples": ["a", "b"] as const
      }
      assertDocument(
        schema.annotate({ ...jsonAnnotations }),
        {
          schema: {
            "anyOf": [
              {
                "type": "string",
                "enum": ["a"]
              },
              {
                "type": "string",
                "enum": ["b"]
              }
            ],
            ...jsonAnnotations
          }
        }
      )
    })

    it("strings & inner annotate", () => {
      const schema = Schema.Union([
        Schema.Literal("a"),
        Schema.Literal("b").annotate({ description: "b-description" })
      ])
      assertDocument(
        schema,
        {
          schema: {
            "anyOf": [
              {
                "type": "string",
                "enum": ["a"]
              },
              {
                "type": "string",
                "enum": ["b"],
                "description": "b-description"
              }
            ]
          }
        }
      )
      const jsonAnnotations = {
        "title": "title",
        "description": "description",
        "default": "a" as const,
        "examples": ["a", "b"] as const
      }
      assertDocument(
        schema.annotate({ ...jsonAnnotations }),
        {
          schema: {
            "anyOf": [
              {
                "type": "string",
                "enum": ["a"]
              },
              {
                "type": "string",
                "enum": ["b"],
                "description": "b-description"
              }
            ],
            ...jsonAnnotations
          }
        }
      )
    })

    it("numbers", () => {
      const schema = Schema.Union([
        Schema.Literal(1),
        Schema.Literal(2)
      ])
      assertDocument(
        schema,
        {
          schema: {
            "anyOf": [
              {
                "type": "number",
                "enum": [1]
              },
              {
                "type": "number",
                "enum": [2]
              }
            ]
          }
        }
      )
      const jsonAnnotations = {
        "title": "title",
        "description": "description",
        "default": 1 as const,
        "examples": [1, 2] as const
      }
      assertDocument(
        schema.annotate({ ...jsonAnnotations }),
        {
          schema: {
            "anyOf": [
              {
                "type": "number",
                "enum": [1]
              },
              {
                "type": "number",
                "enum": [2]
              }
            ],
            ...jsonAnnotations
          }
        }
      )
    })

    it("booleans", () => {
      const schema = Schema.Union([
        Schema.Literal(true),
        Schema.Literal(false)
      ])
      assertDocument(
        schema,
        {
          schema: {
            "anyOf": [
              {
                "type": "boolean",
                "enum": [true]
              },
              {
                "type": "boolean",
                "enum": [false]
              }
            ]
          }
        }
      )
      const jsonAnnotations = {
        "title": "title",
        "description": "description",
        "default": true as const,
        "examples": [true, false] as const
      }
      assertDocument(
        schema.annotate({ ...jsonAnnotations }),
        {
          schema: {
            "anyOf": [
              {
                "type": "boolean",
                "enum": [true]
              },
              {
                "type": "boolean",
                "enum": [false]
              }
            ],
            ...jsonAnnotations
          }
        }
      )
    })

    it("strings & numbers", () => {
      const schema = Schema.Union([
        Schema.Literal("a"),
        Schema.Literal(1)
      ])
      assertDocument(
        schema,
        {
          schema: {
            "anyOf": [
              {
                "type": "string",
                "enum": ["a"]
              },
              {
                "type": "number",
                "enum": [1]
              }
            ]
          }
        }
      )
      const jsonAnnotations = {
        "title": "title",
        "description": "description",
        "default": "a" as const,
        "examples": ["a", 1] as const
      }
      assertDocument(
        schema.annotate({ ...jsonAnnotations }),
        {
          schema: {
            "anyOf": [
              {
                "type": "string",
                "enum": ["a"]
              },
              {
                "type": "number",
                "enum": [1]
              }
            ],
            ...jsonAnnotations
          }
        }
      )
    })
  })

  describe("Enum", () => {
    it("empty enum", () => {
      enum Empty {}
      const schema = Schema.Enum(Empty)
      assertDocument(
        schema,
        {
          schema: {
            "not": {}
          }
        }
      )
      assertDocument(
        schema.annotate({ description: "a" }),
        {
          schema: {
            "not": {},
            "description": "a"
          }
        }
      )
    })

    it("single enum", () => {
      enum Fruits {
        Apple
      }
      const schema = Schema.Enum(Fruits)
      assertDocument(
        schema,
        {
          schema: {
            "anyOf": [
              {
                "type": "number",
                "enum": [0],
                "title": "Apple"
              }
            ]
          }
        }
      )
      assertDocument(
        schema.annotate({ description: "a" }),
        {
          schema: {
            "description": "a",
            "anyOf": [
              {
                "type": "number",
                "enum": [0],
                "title": "Apple"
              }
            ]
          }
        }
      )
    })

    it("mixed enums (number & string)", () => {
      enum Fruits {
        Apple,
        Banana,
        Orange = "orange"
      }
      const schema = Schema.Enum(Fruits)
      assertDocument(
        schema,
        {
          schema: {
            "anyOf": [
              {
                "type": "number",
                "enum": [0],
                "title": "Apple"
              },
              {
                "type": "number",
                "enum": [1],
                "title": "Banana"
              },
              {
                "type": "string",
                "enum": ["orange"],
                "title": "Orange"
              }
            ]
          }
        }
      )
      assertDocument(
        schema.annotate({ description: "a" }),
        {
          schema: {
            "anyOf": [
              {
                "type": "number",
                "enum": [0],
                "title": "Apple"
              },
              {
                "type": "number",
                "enum": [1],
                "title": "Banana"
              },
              {
                "type": "string",
                "enum": ["orange"],
                "title": "Orange"
              }
            ],
            "description": "a"
          }
        }
      )
    })

    it("const enum", () => {
      const Fruits = {
        Apple: "apple",
        Banana: "banana",
        Cantaloupe: 3
      } as const
      const schema = Schema.Enum(Fruits)
      assertDocument(
        schema,
        {
          schema: {
            "anyOf": [
              {
                "type": "string",
                "title": "Apple",
                "enum": ["apple"]
              },
              {
                "type": "string",
                "title": "Banana",
                "enum": ["banana"]
              },
              {
                "type": "number",
                "title": "Cantaloupe",
                "enum": [3]
              }
            ]
          }
        }
      )
    })
  })

  it("TemplateLiteral", () => {
    const schema = Schema.TemplateLiteral(["a", Schema.String])
    assertDocument(schema, {
      schema: {
        "type": "string",
        "pattern": "^a[\\s\\S]*?$"
      }
    })
    assertDocument(schema.annotate({ description: "a" }), {
      schema: {
        "type": "string",
        "pattern": "^a[\\s\\S]*?$",
        "description": "a"
      }
    })
  })

  describe("Struct", () => {
    it("empty struct", () => {
      const schema = Schema.Struct({})
      assertDocument(
        schema,
        {
          schema: {
            "anyOf": [
              { "type": "object" },
              { "type": "array" }
            ]
          }
        }
      )
      assertDocument(
        schema.annotate({ description: "a" }),
        {
          schema: {
            "anyOf": [
              {
                "type": "object"
              },
              {
                "type": "array"
              }
            ],
            "description": "a"
          }
        }
      )
    })

    describe("required property", () => {
      it("String", () => {
        assertDocument(
          Schema.Struct({
            a: Schema.String
          }),
          {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "type": "string"
                }
              },
              "required": ["a"],
              "additionalProperties": false
            }
          }
        )
      })

      it("String & annotate", () => {
        assertDocument(
          Schema.Struct({
            a: Schema.String.annotate({ description: "a" })
          }),
          {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "type": "string",
                  "description": "a"
                }
              },
              "required": ["a"],
              "additionalProperties": false
            }
          }
        )
      })

      it("String & annotateKey", () => {
        assertDocument(
          Schema.Struct({
            a: Schema.String.annotateKey({ description: "a-key" })
          }),
          {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "type": "string",
                  "allOf": [{
                    "description": "a-key"
                  }]
                }
              },
              "required": ["a"],
              "additionalProperties": false
            }
          }
        )
      })

      it("String & annotate & annotateKey", () => {
        assertDocument(
          Schema.Struct({
            a: Schema.String.annotate({ description: "a" }).annotateKey({ description: "a-key" })
          }),
          {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "type": "string",
                  "description": "a",
                  "allOf": [{
                    "description": "a-key"
                  }]
                }
              },
              "required": ["a"],
              "additionalProperties": false
            }
          }
        )
      })
    })

    describe("optionalKey", () => {
      it("String", () => {
        assertDocument(
          Schema.Struct({
            a: Schema.optionalKey(Schema.String)
          }),
          {
            schema: {
              "type": "object",
              "properties": {
                "a": { "type": "string" }
              },
              "additionalProperties": false
            }
          }
        )
      })

      it("String & annotate", () => {
        assertDocument(
          Schema.Struct({
            a: Schema.optionalKey(Schema.String.annotate({ description: "a" })),
            b: Schema.optionalKey(Schema.String).annotate({ description: "b" })
          }),
          {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "type": "string",
                  "description": "a"
                },
                "b": {
                  "type": "string",
                  "description": "b"
                }
              },
              "additionalProperties": false
            }
          }
        )
      })

      it("String & annotateKey", () => {
        assertDocument(
          Schema.Struct({
            a: Schema.optionalKey(Schema.String.annotateKey({ description: "a-key" })),
            b: Schema.optionalKey(Schema.String).annotateKey({ description: "b-key" })
          }),
          {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "type": "string",
                  "allOf": [{
                    "description": "a-key"
                  }]
                },
                "b": {
                  "type": "string",
                  "allOf": [{
                    "description": "b-key"
                  }]
                }
              },
              "additionalProperties": false
            }
          }
        )
      })

      it("String & annotate & annotateKey", () => {
        assertDocument(
          Schema.Struct({
            a: Schema.optionalKey(Schema.String.annotate({ description: "a" }).annotateKey({ description: "a-key" })),
            b: Schema.optionalKey(Schema.String).annotate({ description: "b" }).annotateKey({ description: "b-key" }),
            c: Schema.optionalKey(Schema.String.annotate({ description: "a" }).annotateKey({ description: "a-key" }))
              .annotate({ description: "c-outer" }).annotateKey({ description: "c-outer-key" })
          }),
          {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "type": "string",
                  "description": "a",
                  "allOf": [{
                    "description": "a-key"
                  }]
                },
                "b": {
                  "type": "string",
                  "description": "b",
                  "allOf": [{
                    "description": "b-key"
                  }]
                },
                "c": {
                  "type": "string",
                  "description": "c-outer",
                  "allOf": [{
                    "description": "c-outer-key"
                  }]
                }
              },
              "additionalProperties": false
            }
          }
        )
      })

      it("optionalKey(String) to String", () => {
        assertDocument(
          Schema.Struct({
            a: Schema.optionalKey(Schema.String).pipe(Schema.encodeTo(Schema.String, {
              decode: SchemaGetter.passthrough(),
              encode: SchemaGetter.withDefault(() => "")
            }))
          }),
          {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "type": "string"
                }
              },
              "required": ["a"],
              "additionalProperties": false
            }
          }
        )
      })
    })

    describe("optional", () => {
      it("String", () => {
        assertDocument(
          Schema.Struct({
            a: Schema.optional(Schema.String)
          }),
          {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "anyOf": [
                    { "type": "string" },
                    { "type": "null" }
                  ]
                }
              },
              "additionalProperties": false
            }
          }
        )
      })

      it("String & annotate", () => {
        assertDocument(
          Schema.Struct({
            a: Schema.optional(Schema.String.annotate({ description: "a" })),
            b: Schema.optional(Schema.String).annotate({ description: "b" })
          }),
          {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "anyOf": [
                    { "type": "string", "description": "a" },
                    { "type": "null" }
                  ]
                },
                "b": {
                  "anyOf": [
                    { "type": "string" },
                    { "type": "null" }
                  ],
                  "description": "b"
                }
              },
              "additionalProperties": false
            }
          }
        )
      })

      it("String & annotateKey", () => {
        assertDocument(
          Schema.Struct({
            a: Schema.optional(Schema.String).annotateKey({ description: "a-key" }),
            b: Schema.optional(Schema.String.annotate({ description: "b" })).annotateKey({ description: "b-key" })
          }),
          {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "anyOf": [
                    { "type": "string" },
                    { "type": "null" }
                  ],
                  "allOf": [{
                    "description": "a-key"
                  }]
                },
                "b": {
                  "anyOf": [
                    { "type": "string", "description": "b" },
                    { "type": "null" }
                  ],
                  "allOf": [{
                    "description": "b-key"
                  }]
                }
              },
              "additionalProperties": false
            }
          }
        )
      })

      it("optional(String) to String", () => {
        assertDocument(
          Schema.Struct({
            a: Schema.optional(Schema.String).pipe(Schema.encodeTo(Schema.String, {
              decode: SchemaGetter.passthrough(),
              encode: SchemaGetter.withDefault(() => "")
            }))
          }),
          {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "type": "string"
                }
              },
              "required": ["a"],
              "additionalProperties": false
            }
          }
        )
      })
    })

    describe("UndefinedOr", () => {
      it("String", () => {
        assertDocument(
          Schema.Struct({
            a: Schema.UndefinedOr(Schema.String)
          }),
          {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "anyOf": [
                    { "type": "string" },
                    { "type": "null" }
                  ]
                }
              },
              "required": ["a"],
              "additionalProperties": false
            }
          }
        )
      })

      it("String & annotate", () => {
        assertDocument(
          Schema.Struct({
            a: Schema.UndefinedOr(Schema.String.annotate({ description: "a" })),
            b: Schema.UndefinedOr(Schema.String).annotate({ description: "b" })
          }),
          {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "anyOf": [
                    { "type": "string", "description": "a" },
                    { "type": "null" }
                  ]
                },
                "b": {
                  "anyOf": [
                    { "type": "string" },
                    { "type": "null" }
                  ],
                  "description": "b"
                }
              },
              "required": ["a", "b"],
              "additionalProperties": false
            }
          }
        )
      })

      it("String & annotateKey", () => {
        assertDocument(
          Schema.Struct({
            a: Schema.UndefinedOr(Schema.String).annotateKey({ description: "a-key" }),
            b: Schema.UndefinedOr(Schema.String.annotate({ description: "b" })).annotateKey({ description: "b-key" })
          }),
          {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "anyOf": [
                    { "type": "string" },
                    { "type": "null" }
                  ],
                  "allOf": [{
                    "description": "a-key"
                  }]
                },
                "b": {
                  "anyOf": [
                    { "type": "string", "description": "b" },
                    { "type": "null" }
                  ],
                  "allOf": [{
                    "description": "b-key"
                  }]
                }
              },
              "required": ["a", "b"],
              "additionalProperties": false
            }
          }
        )
      })

      it("UndefinedOr(String) to String", () => {
        assertDocument(
          Schema.Struct({
            a: Schema.UndefinedOr(Schema.String).pipe(Schema.encodeTo(Schema.String, {
              decode: SchemaGetter.passthrough(),
              encode: SchemaGetter.transform((s) => s ?? "")
            }))
          }),
          {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "type": "string"
                }
              },
              "required": ["a"],
              "additionalProperties": false
            }
          }
        )
      })
    })
  })

  describe("Record", () => {
    it("Record(String, Finite)", () => {
      assertDocument(
        Schema.Record(Schema.String, Schema.Finite),
        {
          schema: {
            "type": "object",
            "additionalProperties": {
              "type": "number"
            }
          }
        }
      )
      assertDocument(
        Schema.Record(
          Schema.String.annotate({ description: "k" }), // TODO: where to attach the description?
          Schema.Finite.annotate({ description: "v" })
        ).annotate({ description: "r" }),
        {
          schema: {
            "type": "object",
            "additionalProperties": {
              "type": "number",
              "allOf": [{
                "description": "v"
              }]
            },
            "description": "r"
          }
        }
      )
    })

    it("Record(`a${string}`, Number) & annotate", () => {
      assertDocument(
        Schema.Record(Schema.TemplateLiteral(["a", Schema.String]), Schema.Finite),
        {
          schema: {
            "type": "object",
            "patternProperties": {
              "^a[\\s\\S]*?$": {
                "type": "number"
              }
            }
          }
        }
      )
    })

    it("Record(Literals(['a', 'b']), Number)", () => {
      assertDocument(
        Schema.Record(Schema.Literals(["a", "b"]), Schema.Finite),
        {
          schema: {
            "type": "object",
            "properties": {
              "a": { "type": "number" },
              "b": { "type": "number" }
            },
            "required": ["a", "b"],
            "additionalProperties": false
          }
        }
      )
    })

    it("Record(isUppercased, Number)", () => {
      assertDocument(
        Schema.Record(Schema.String.check(Schema.isUppercased()), Schema.Finite),
        {
          schema: {
            "type": "object",
            "patternProperties": {
              "^[^a-z]*$": {
                "type": "number"
              }
            }
          }
        }
      )
    })

    describe("checks", () => {
      it("isMinProperties", () => {
        assertDocument(
          Schema.Record(Schema.String, Schema.Finite).check(Schema.isMinProperties(2)),
          {
            schema: {
              "type": "object",
              "additionalProperties": {
                "type": "number"
              },
              "allOf": [
                { "minProperties": 2 }
              ]
            }
          }
        )
      })

      it("isMaxProperties", () => {
        assertDocument(
          Schema.Record(Schema.String, Schema.Finite).check(Schema.isMaxProperties(2)),
          {
            schema: {
              "type": "object",
              "additionalProperties": { "type": "number" },
              "allOf": [{ "maxProperties": 2 }]
            }
          }
        )
      })

      it("isPropertiesLength", () => {
        assertDocument(
          Schema.Record(Schema.String, Schema.Finite).check(Schema.isPropertiesLength(2)),
          {
            schema: {
              "type": "object",
              "additionalProperties": { "type": "number" },
              "allOf": [{ "minProperties": 2, "maxProperties": 2 }]
            }
          }
        )
      })
    })
  })

  it("StructWithRest", () => {
    assertDocument(
      Schema.StructWithRest(Schema.Struct({ a: Schema.String }), [
        Schema.Record(Schema.String, Schema.Union([Schema.Finite, Schema.String]))
      ]),
      {
        schema: {
          "type": "object",
          "properties": {
            "a": { "type": "string" }
          },
          "additionalProperties": {
            "anyOf": [
              { "type": "number" },
              { "type": "string" }
            ]
          },
          "required": ["a"]
        }
      }
    )
  })

  describe("Tuple", () => {
    it("empty tuple", () => {
      const schema = Schema.Tuple([])
      assertDocument(
        schema,
        {
          schema: {
            "type": "array",
            "items": false
          }
        }
      )
      assertDocument(
        schema.annotate({ description: "a" }),
        {
          schema: {
            "type": "array",
            "items": false,
            "description": "a"
          }
        }
      )
    })

    describe("required element", () => {
      it("String", () => {
        assertDocument(
          Schema.Tuple([
            Schema.String
          ]),
          {
            schema: {
              "type": "array",
              "prefixItems": [{ "type": "string" }],
              "minItems": 1,
              "maxItems": 1
            }
          }
        )
      })

      it("String & annotate", () => {
        assertDocument(
          Schema.Tuple([
            Schema.String.annotate({ description: "a" })
          ]),
          {
            schema: {
              "type": "array",
              "prefixItems": [{ "type": "string", "description": "a" }],
              "minItems": 1,
              "maxItems": 1
            }
          }
        )
      })

      it("String & annotateKey", () => {
        assertDocument(
          Schema.Tuple([
            Schema.String.annotateKey({ description: "a-key" })
          ]),
          {
            schema: {
              "type": "array",
              "prefixItems": [{ "type": "string", "allOf": [{ "description": "a-key" }] }],
              "minItems": 1,
              "maxItems": 1
            }
          }
        )
      })

      it("String & annotate & annotateKey", () => {
        assertDocument(
          Schema.Tuple([
            Schema.String.annotate({ description: "a" }).annotateKey({ description: "a-key" })
          ]),
          {
            schema: {
              "type": "array",
              "prefixItems": [{ "type": "string", "description": "a", "allOf": [{ "description": "a-key" }] }],
              "minItems": 1,
              "maxItems": 1
            }
          }
        )
      })
    })

    describe("optionalKey", () => {
      it("String", () => {
        assertDocument(
          Schema.Tuple([
            Schema.optionalKey(Schema.String)
          ]),
          {
            schema: {
              "type": "array",
              "prefixItems": [
                { "type": "string" }
              ],
              "maxItems": 1
            }
          }
        )
      })

      it("String & annotate", () => {
        assertDocument(
          Schema.Tuple([
            Schema.optionalKey(Schema.String.annotate({ description: "a" })),
            Schema.optionalKey(Schema.String).annotate({ description: "b" })
          ]),
          {
            schema: {
              "type": "array",
              "prefixItems": [
                { "type": "string", "description": "a" },
                { "type": "string", "description": "b" }
              ],
              "maxItems": 2
            }
          }
        )
      })

      it("String & annotateKey", () => {
        assertDocument(
          Schema.Tuple([
            Schema.optionalKey(Schema.String.annotateKey({ description: "a-key" })),
            Schema.optionalKey(Schema.String).annotateKey({ description: "b-key" })
          ]),
          {
            schema: {
              "type": "array",
              "prefixItems": [
                { "type": "string", "allOf": [{ "description": "a-key" }] },
                {
                  "type": "string",
                  "allOf": [{ "description": "b-key" }]
                }
              ],
              "maxItems": 2
            }
          }
        )
      })

      it("String & annotate & annotateKey", () => {
        assertDocument(
          Schema.Tuple([
            Schema.optionalKey(Schema.String.annotate({ description: "a" }).annotateKey({ description: "a-key" })),
            Schema.optionalKey(Schema.String).annotate({ description: "b" }).annotateKey({ description: "b-key" }),
            Schema.optionalKey(Schema.String.annotate({ description: "a" }).annotateKey({ description: "a-key" }))
              .annotate({ description: "c-outer" }).annotateKey({ description: "c-outer-key" })
          ]),
          {
            schema: {
              "type": "array",
              "prefixItems": [
                { "type": "string", "description": "a", "allOf": [{ "description": "a-key" }] },
                {
                  "type": "string",
                  "description": "b",
                  "allOf": [{ "description": "b-key" }]
                },
                { "type": "string", "description": "c-outer", "allOf": [{ "description": "c-outer-key" }] }
              ],
              "maxItems": 3
            }
          }
        )
      })

      it("optionalKey(String) to String", () => {
        assertDocument(
          Schema.Tuple([
            Schema.optionalKey(Schema.String).pipe(Schema.encodeTo(Schema.String, {
              decode: SchemaGetter.passthrough(),
              encode: SchemaGetter.withDefault(() => "")
            }))
          ]),
          {
            schema: {
              "type": "array",
              "prefixItems": [{ "type": "string" }],
              "minItems": 1,
              "maxItems": 1
            }
          }
        )
      })
    })

    it("optionalKey to required key", () => {
      assertDocument(
        Schema.Tuple([
          Schema.optionalKey(Schema.String).pipe(Schema.encodeTo(Schema.String, {
            decode: SchemaGetter.passthrough(),
            encode: SchemaGetter.withDefault(() => "")
          }))
        ]),
        {
          schema: {
            "type": "array",
            "prefixItems": [
              { "type": "string" }
            ],
            "minItems": 1,
            "maxItems": 1
          }
        }
      )
    })
  })

  describe("Array", () => {
    it("Array(String)", () => {
      assertDocument(
        Schema.Array(Schema.String),
        {
          schema: {
            "type": "array",
            "items": { "type": "string" }
          }
        }
      )
      assertDocument(
        Schema.Array(Schema.String).annotate({ description: "a" }),
        {
          schema: {
            "type": "array",
            "items": { "type": "string" },
            "description": "a"
          }
        }
      )
    })

    describe("checks", () => {
      it("isMinLength", () => {
        assertDocument(
          Schema.Array(Schema.String).check(Schema.isMinLength(2)),
          {
            schema: {
              "type": "array",
              "items": { "type": "string" },
              "allOf": [
                { "minItems": 2 }
              ]
            }
          }
        )
      })

      it("isMaxLength", () => {
        assertDocument(
          Schema.Array(Schema.String).check(Schema.isMaxLength(2)),
          {
            schema: {
              "type": "array",
              "items": { "type": "string" },
              "allOf": [
                { "maxItems": 2 }
              ]
            }
          }
        )
      })

      it("isLength", () => {
        assertDocument(
          Schema.Array(Schema.String).check(Schema.isLength(2)),
          {
            schema: {
              "type": "array",
              "items": { "type": "string" },
              "allOf": [
                { "minItems": 2 },
                { "maxItems": 2 }
              ]
            }
          }
        )
      })

      it("UniqueArray", () => {
        assertDocument(
          Schema.UniqueArray(Schema.String),
          {
            schema: {
              "type": "array",
              "items": { "type": "string" },
              "allOf": [
                { "uniqueItems": true }
              ]
            }
          }
        )
      })
    })
  })

  it("TupleWithRest", () => {
    assertDocument(
      Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Finite]),
      {
        schema: {
          "type": "array",
          "prefixItems": [
            { "type": "string" }
          ],
          "items": { "type": "number" },
          "minItems": 1
        }
      }
    )
  })

  describe("Union", () => {
    it("empty union", () => {
      const schema = Schema.Union([])
      assertDocument(schema, {
        schema: {
          "not": {}
        }
      })
      assertDocument(Schema.Union([]).annotate({ description: "a" }), {
        schema: {
          "not": {},
          "description": "a"
        }
      })
    })

    it("single member", () => {
      const schema = Schema.Union([Schema.String])
      assertDocument(schema, {
        schema: {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        }
      })
      assertDocument(Schema.Union([Schema.String]).annotate({ description: "a" }), {
        schema: {
          "anyOf": [
            {
              "type": "string"
            }
          ],
          "description": "a"
        }
      })
      assertDocument(
        Schema.Union([Schema.String.annotate({ description: "inner" })]).annotate({ description: "outer" }),
        {
          schema: {
            "anyOf": [
              {
                "type": "string",
                "description": "inner"
              }
            ],
            "description": "outer"
          }
        }
      )
    })

    it("String | Number", () => {
      assertDocument(
        Schema.Union([
          Schema.String,
          Schema.Finite
        ]),
        {
          schema: {
            "anyOf": [
              { "type": "string" },
              { "type": "number" }
            ]
          }
        }
      )
      assertDocument(
        Schema.Union([
          Schema.String,
          Schema.Finite
        ]).annotate({ description: "description" }),
        {
          schema: {
            "anyOf": [
              { "type": "string" },
              { "type": "number" }
            ],
            "description": "description"
          }
        }
      )
    })

    it("String | BigInt", () => {
      assertDocument(
        Schema.Union([
          Schema.String,
          Schema.BigInt
        ]),
        {
          schema: {
            "anyOf": [
              {
                "type": "string",
                "allOf": [
                  { "pattern": "^-?\\d+$" }
                ]
              },
              { "type": "string" }
            ]
          }
        }
      )
      assertDocument(
        Schema.Union([
          Schema.String,
          Schema.Finite
        ]).annotate({ description: "description" }),
        {
          schema: {
            "anyOf": [
              { "type": "string" },
              { "type": "number" }
            ],
            "description": "description"
          }
        }
      )
    })
  })

  it("mutually recursive schemas", () => {
    interface Expression {
      readonly type: "expression"
      readonly value: number | Operation
    }

    interface Operation {
      readonly type: "operation"
      readonly operator: "+" | "-"
      readonly left: Expression
      readonly right: Expression
    }

    const Expression = Schema.Struct({
      type: Schema.Literal("expression"),
      value: Schema.Union([Schema.Finite, Schema.suspend((): Schema.Codec<Operation> => Operation)])
    }).annotate({ identifier: "Expression" })

    const Operation = Schema.Struct({
      type: Schema.Literal("operation"),
      operator: Schema.Literals(["+", "-"]),
      left: Expression,
      right: Expression
    }).annotate({ identifier: "Operation" })

    assertDocument(
      Operation,
      {
        schema: {
          "$ref": "#/$defs/Operation"
        },
        definitions: {
          "Operation": {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "enum": [
                  "operation"
                ]
              },
              "operator": {
                "anyOf": [
                  {
                    "type": "string",
                    "enum": [
                      "+"
                    ]
                  },
                  {
                    "type": "string",
                    "enum": [
                      "-"
                    ]
                  }
                ]
              },
              "left": {
                "$ref": "#/$defs/Expression"
              },
              "right": {
                "$ref": "#/$defs/Expression"
              }
            },
            "required": [
              "type",
              "operator",
              "left",
              "right"
            ],
            "additionalProperties": false
          },
          "Expression": {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "enum": [
                  "expression"
                ]
              },
              "value": {
                "anyOf": [
                  {
                    "type": "number"
                  },
                  {
                    "$ref": "#/$defs/Operation"
                  }
                ]
              }
            },
            "required": [
              "type",
              "value"
            ],
            "additionalProperties": false
          }
        }
      }
    )
    assertDocument(
      Expression,
      {
        schema: {
          "$ref": "#/$defs/Expression"
        },
        definitions: {
          "Expression": {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "enum": [
                  "expression"
                ]
              },
              "value": {
                "anyOf": [
                  { "type": "number" },
                  { "$ref": "#/$defs/Operation" }
                ]
              }
            },
            "required": [
              "type",
              "value"
            ],
            "additionalProperties": false
          },
          "Operation": {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "enum": [
                  "operation"
                ]
              },
              "operator": {
                "anyOf": [
                  {
                    "type": "string",
                    "enum": [
                      "+"
                    ]
                  },
                  {
                    "type": "string",
                    "enum": [
                      "-"
                    ]
                  }
                ]
              },
              "left": {
                "$ref": "#/$defs/Expression"
              },
              "right": {
                "$ref": "#/$defs/Expression"
              }
            },
            "required": [
              "type",
              "operator",
              "left",
              "right"
            ],
            "additionalProperties": false
          }
        }
      }
    )
  })

  describe("fromJsonString", () => {
    it("top level fromJsonString", () => {
      assertDocument(
        Schema.fromJsonString(Schema.FiniteFromString),
        {
          schema: {
            "type": "string",
            "contentMediaType": "application/json",
            "contentSchema": {
              "type": "string"
            }
          }
        }
      )
    })

    it("nested fromJsonString", () => {
      assertDocument(
        Schema.fromJsonString(Schema.Struct({
          a: Schema.fromJsonString(Schema.FiniteFromString)
        })),
        {
          schema: {
            "type": "string",
            "contentMediaType": "application/json",
            "contentSchema": {
              "additionalProperties": false,
              "properties": {
                "a": {
                  "contentMediaType": "application/json",
                  "contentSchema": {
                    "type": "string"
                  },
                  "type": "string"
                }
              },
              "required": [
                "a"
              ],
              "type": "object"
            }
          }
        }
      )
    })
  })

  describe("Class", () => {
    it("fields", () => {
      class A extends Schema.Class<A>("A")({
        a: Schema.String
      }) {}
      assertDocument(
        A,
        {
          schema: {
            "$ref": "#/$defs/A"
          },
          definitions: {
            "A": {
              "type": "object",
              "properties": {
                "a": { "type": "string" }
              },
              "required": ["a"],
              "additionalProperties": false
            }
          }
        }
      )
    })

    it("fields & annotations", () => {
      class A extends Schema.Class<A>("A")({
        a: Schema.String
      }, { description: "description" }) {}
      assertDocument(
        A,
        {
          schema: {
            "$ref": "#/$defs/A"
          },
          definitions: {
            "A": {
              "type": "object",
              "properties": {
                "a": { "type": "string" }
              },
              "required": ["a"],
              "additionalProperties": false
            }
          }
        }
      )
    })
  })

  describe("ErrorClass", () => {
    it("fields", () => {
      class E extends Schema.ErrorClass<E>("E")({
        a: Schema.String
      }) {}
      assertDocument(E, {
        schema: {
          "$ref": "#/$defs/E"
        },
        definitions: {
          "E": {
            "type": "object",
            "properties": {
              "a": { "type": "string" }
            },
            "required": ["a"],
            "additionalProperties": false
          }
        }
      })
    })
  })
})
