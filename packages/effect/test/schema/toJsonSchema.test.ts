import type { Options as AjvOptions } from "ajv"

import { JsonSchema, Schema, SchemaGetter } from "effect"
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
  throws(() => Schema.toJsonSchema(schema, options), message)
}

function assertDocument<S extends Schema.Top>(
  schema: S,
  expected: { schema: JsonSchema.JsonSchema; definitions?: JsonSchema.Definitions },
  options?: Schema.ToJsonSchemaOptions
) {
  const document = Schema.toJsonSchema(schema, options)
  deepStrictEqual(document, {
    source: "draft-2020-12",
    schema: expected.schema,
    definitions: expected.definitions ?? {}
  })
  const valid = ajvDraft2020_12.validateSchema({
    $schema: JsonSchema.META_SCHEMA_URI_DRAFT_2020_12,
    ...document.schema
  })
  assertTrue(valid)
}

describe("JsonSchema generation", () => {
  describe("Thrown errors", () => {
    it("Suspend without identifier annotation", () => {
      interface A {
        readonly a: string
        readonly as: ReadonlyArray<A>
      }
      const schema = Schema.Struct({
        a: Schema.String,
        as: Schema.Array(Schema.suspend((): Schema.Schema<A> => schema))
      })
      assertUnsupportedSchema(
        schema,
        `Suspended schema without identifier detected`
      )
    })

    describe("Tuple", () => {
      it("Unsupported post-rest elements", () => {
        assertUnsupportedSchema(
          Schema.TupleWithRest(Schema.Tuple([]), [Schema.Number, Schema.String]),
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
          Schema.Record(Schema.Symbol, Schema.Number),
          `Unsupported index signature parameter`
        )
      })
    })
  })

  describe("Declaration", () => {
    it("instanceOf", () => {
      const schema = Schema.URL
      assertDocument(schema, {
        schema: {
          "type": "string"
        }
      })
    })

    it.todo("Option(String)", () => {
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

  describe.todo("options", () => {
    describe("topLevelReferenceStrategy", () => {
      describe(`"skip"`, () => {
        it("String", () => {
          assertDocument(
            Schema.String.annotate({ identifier: "ID" }),
            {
              schema: {
                "type": "string"
              },
              definitions: {}
            },
            {
              referenceStrategy: "skip"
            }
          )
        })

        it("nested identifiers", () => {
          class A extends Schema.Class<A>("A")({ s: Schema.String.annotate({ identifier: "ID4" }) }) {}
          const schema = Schema.Struct({
            a: Schema.String.annotate({ identifier: "ID" }),
            b: Schema.Struct({
              c: Schema.String.annotate({ identifier: "ID3" })
            }).annotate({ identifier: "ID2" }),
            d: A
          })
          assertDocument(schema, {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "type": "string"
                },
                "b": {
                  "type": "object",
                  "properties": {
                    "c": { "type": "string" }
                  },
                  "required": ["c"],
                  "additionalProperties": false
                },
                "d": {
                  "type": "object",
                  "properties": {
                    "s": { "type": "string" }
                  },
                  "required": ["s"],
                  "additionalProperties": false
                }
              },
              "required": ["a", "b", "d"],
              "additionalProperties": false
            }
          }, {
            referenceStrategy: "skip"
          })
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
              referenceStrategy: "skip"
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
                referenceStrategy: "skip"
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

  const jsonAnnotations = {
    "title": "title",
    "description": "description",
    "default": "",
    "examples": ["", "a", "aa"]
  }

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
          ...jsonAnnotations
        }),
        {
          schema: {
            "$ref": "#/$defs/ID"
          },
          definitions: {
            "ID": {
              "type": "string",
              ...jsonAnnotations
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
              {
                "type": "string",
                "description": "description"
              }
            ]
          },
          definitions: {
            "ID": { "type": "string" }
          }
        }
      )
    })
  })

  describe("String", () => {
    const jsonAnnotations = {
      "title": "title",
      "description": "description",
      "default": "",
      "examples": ["", "a", "aa"]
    }

    it("String", () => {
      assertDocument(
        Schema.String,
        {
          schema: {
            "type": "string"
          }
        }
      )
      assertDocument(
        Schema.String.annotate({
          ...jsonAnnotations
        }),
        {
          schema: {
            "type": "string",
            ...jsonAnnotations
          }
        }
      )
      // should support getters
      assertDocument(
        Schema.String.annotate({
          get description() {
            return "description"
          }
        }),
        {
          schema: {
            "type": "string",
            "description": "description"
          }
        }
      )
    })

    it("should ignore the key json annotations if the schema is not contextual", () => {
      assertDocument(
        Schema.String.annotateKey({
          ...jsonAnnotations
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

    it("String & empty check", () => {
      assertDocument(
        Schema.String.check(Schema.makeFilter(() => true)),
        {
          schema: {
            "type": "string"
          }
        }
      )
    })

    it("String & annotations & check", () => {
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

    it("String & annotations & check & identifier", () => {
      assertDocument(
        Schema.String.annotate({ description: "a" }).check(Schema.isMinLength(2, { identifier: "ID" })),
        {
          schema: {
            "$ref": "#/$defs/ID"
          },
          definitions: {
            ID: {
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

    it("String & check & annotations", () => {
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

    it("String & annotations & check & check", () => {
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

    it("String & check & check & annotations", () => {
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

    it("String & annotations & check & check & annotations", () => {
      assertDocument(
        Schema.String.annotate({ description: "description1" }).check(
          Schema.isMinLength(2),
          Schema.isMaxLength(3, { description: "description3" })
        ),
        {
          schema: {
            "type": "string",
            "description": "description1",
            "allOf": [
              {
                "minLength": 2
              },
              {
                "maxLength": 3,
                "description": "description3"
              }
            ]
          }
        }
      )
    })

    it("String & check & annotations & check & annotations", () => {
      assertDocument(
        Schema.String.check(
          Schema.isMinLength(2, { description: "description2" }),
          Schema.isMaxLength(3, { description: "description3" })
        ),
        {
          schema: {
            "type": "string",
            "allOf": [
              {
                "minLength": 2,
                "description": "description2"
              },
              {
                "maxLength": 3,
                "description": "description3"
              }
            ]
          }
        }
      )
    })

    it("String & annotations & check & annotations & check & annotations", () => {
      assertDocument(
        Schema.String.annotate({ description: "description1" }).check(
          Schema.isMinLength(2, { description: "description2" }),
          Schema.isMaxLength(3, { description: "description3" })
        ),
        {
          schema: {
            "type": "string",
            "description": "description1",
            "allOf": [
              {
                "minLength": 2,
                "description": "description2"
              },
              {
                "maxLength": 3,
                "description": "description3"
              }
            ]
          }
        }
      )
    })
  })

  it("Void", () => {
    const schema = Schema.Void
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
        schema: {}
      }
    )
    const jsonAnnotations = {
      "title": "title",
      "description": "description",
      "default": null,
      "examples": [null, "a", 1]
    }
    assertDocument(
      schema.annotate({
        ...jsonAnnotations
      }),
      {
        schema: {
          ...jsonAnnotations
        }
      }
    )
  })

  it("Any", () => {
    const schema = Schema.Any
    assertDocument(
      schema,
      {
        schema: {}
      }
    )
    const jsonAnnotations = {
      "title": "title",
      "description": "description",
      "default": null,
      "examples": [null, "a", 1]
    }
    assertDocument(
      schema.annotate({
        ...jsonAnnotations
      }),
      {
        schema: {
          ...jsonAnnotations
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
    const jsonAnnotations = {
      "title": "title",
      "description": "description"
    }
    assertDocument(
      schema.annotate({
        ...jsonAnnotations
      }),
      {
        schema: {
          "not": {},
          ...jsonAnnotations
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
    const jsonAnnotations = {
      "title": "title",
      "description": "description",
      "default": null,
      "examples": [null]
    }
    assertDocument(
      schema.annotate({
        ...jsonAnnotations
      }),
      {
        schema: {
          "type": "null",
          ...jsonAnnotations
        }
      }
    )
  })

  it("Number", () => {
    const schema = Schema.Number
    assertDocument(
      schema,
      {
        schema: {
          "type": "number"
        }
      }
    )
    const jsonAnnotations = {
      "title": "title",
      "description": "description",
      "default": 0,
      "examples": [0, 1, 2]
    }
    assertDocument(
      schema.annotate({
        ...jsonAnnotations
      }),
      {
        schema: {
          "type": "number",
          ...jsonAnnotations
        }
      }
    )
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
    const jsonAnnotations = {
      "title": "title",
      "description": "description",
      "default": false,
      "examples": [false, true]
    }
    assertDocument(
      schema.annotate({
        ...jsonAnnotations
      }),
      {
        schema: {
          "type": "boolean",
          ...jsonAnnotations
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
          "anyOf": [
            { "type": "object" },
            { "type": "array" }
          ]
        }
      }
    )
    const jsonAnnotations = {
      "title": "title",
      "description": "description",
      "default": {},
      "examples": [{}, []]
    }
    assertDocument(
      schema.annotate({
        ...jsonAnnotations
      }),
      {
        schema: {
          "anyOf": [
            { "type": "object" },
            { "type": "array" }
          ],
          ...jsonAnnotations
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
      const jsonAnnotations = {
        "title": "title",
        "description": "description",
        "default": "a" as const,
        "examples": ["a"] as const
      }
      assertDocument(
        schema.annotate({
          ...jsonAnnotations
        }),
        {
          schema: {
            "type": "string",
            "enum": ["a"],
            ...jsonAnnotations
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
      const jsonAnnotations = {
        "title": "title",
        "description": "description",
        "default": 1 as const,
        "examples": [1] as const
      }
      assertDocument(
        schema.annotate({
          ...jsonAnnotations
        }),
        {
          schema: {
            "type": "number",
            "enum": [1],
            ...jsonAnnotations
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
      const jsonAnnotations = {
        "title": "title",
        "description": "description",
        "default": true as const,
        "examples": [true] as const
      }
      assertDocument(
        schema.annotate({
          ...jsonAnnotations
        }),
        {
          schema: {
            "type": "boolean",
            "enum": [true],
            ...jsonAnnotations
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
            "not": {}
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
      const jsonAnnotations = {
        "title": "title",
        "description": "description",
        "default": "a" as const,
        "examples": ["a", "b"] as const
      }
      assertDocument(
        schema.annotate({
          ...jsonAnnotations
        }),
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
      const jsonAnnotations = {
        "title": "title",
        "description": "description",
        "default": 1 as const,
        "examples": [1, 2] as const
      }
      assertDocument(
        schema.annotate({
          ...jsonAnnotations
        }),
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
      const jsonAnnotations = {
        "title": "title",
        "description": "description",
        "default": true as const,
        "examples": [true, false] as const
      }
      assertDocument(
        schema.annotate({
          ...jsonAnnotations
        }),
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
      const jsonAnnotations = {
        "title": "title",
        "description": "description",
        "default": "a" as const,
        "examples": ["a", 1] as const
      }
      assertDocument(
        schema.annotate({
          ...jsonAnnotations
        }),
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
            "not": {}
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
            "type": "number",
            "enum": [0],
            "title": "Apple"
          }
        }
      )
      assertDocument(
        schema.annotate({ description: "a" }),
        {
          schema: {
            "type": "number",
            "enum": [0],
            "title": "Apple",
            "description": "a"
          }
        }
      )
      assertDocument(
        schema.annotate({
          "description": "description",
          "default": Fruits.Apple,
          "examples": [Fruits.Apple] as const
        }),
        {
          schema: {
            "type": "number",
            "enum": [0],
            "title": "Apple",
            "description": "description",
            "default": Fruits.Apple,
            "examples": [Fruits.Apple] as const
          }
        }
      )
      assertDocument(
        schema.annotate({
          identifier: "ID",
          description: "description"
        }),
        {
          schema: {
            "$ref": "#/$defs/ID"
          },
          definitions: {
            "ID": {
              "type": "number",
              "enum": [0],
              "title": "Apple",
              "description": "description"
            }
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
      const jsonAnnotations = {
        "title": "title",
        "description": "description",
        "default": Fruits.Apple,
        "examples": [Fruits.Banana, Fruits.Orange] as const
      }
      assertDocument(
        schema.annotate({ ...jsonAnnotations }),
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
            ...jsonAnnotations
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
      const jsonAnnotations = {
        "title": "title",
        "description": "description",
        "default": {},
        "examples": [{}, []]
      }
      assertDocument(
        schema.annotate({ ...jsonAnnotations }),
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
            ...jsonAnnotations
          }
        }
      )
    })

    it("required property", () => {
      const Id3 = Schema.String.annotate({ identifier: "id3" })
      assertDocument(
        Schema.Struct({
          a: Schema.String,
          b: Schema.String.annotate({ description: "b" }),
          c: Schema.String.annotateKey({ description: "c-key" }),
          d: Schema.String.annotate({ description: "d" }).annotateKey({ description: "d-key" }),
          id1: Schema.String.annotate({ identifier: "id1" }),
          id2: Schema.String.annotate({ identifier: "id2" }).annotateKey({ description: "id2-key" }),
          id3_1: Id3.annotateKey({ description: "id3_1-key" }),
          id3_2: Id3.annotateKey({ description: "id3_2-key" })
        }),
        {
          schema: {
            "type": "object",
            "properties": {
              "a": {
                "type": "string"
              },
              "b": {
                "type": "string",
                "description": "b"
              },
              "c": {
                "type": "string",
                "allOf": [{
                  "description": "c-key",
                  "x-key": true
                }]
              },
              "d": {
                "type": "string",
                "description": "d",
                "allOf": [{
                  "description": "d-key",
                  "x-key": true
                }]
              },
              "id1": { "$ref": "#/$defs/id1" },
              "id2": {
                "allOf": [
                  { "$ref": "#/$defs/id2" },
                  {
                    "description": "id2-key",
                    "x-key": true
                  }
                ]
              },
              "id3_1": {
                "allOf": [
                  { "$ref": "#/$defs/id3" },
                  {
                    "description": "id3_1-key",
                    "x-key": true
                  }
                ]
              },
              "id3_2": {
                "type": "string",
                "allOf": [{
                  "description": "id3_2-key",
                  "x-key": true
                }]
              }
            },
            "required": ["a", "b", "c", "d", "id1", "id2", "id3_1", "id3_2"],
            "additionalProperties": false
          },
          definitions: {
            "id1": { "type": "string" },
            "id2": { "type": "string" },
            "id3": { "type": "string" }
          }
        }
      )
    })

    it("optionalKey properties", () => {
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

    it("optionalKey to required key", () => {
      assertDocument(
        Schema.Struct({
          a: Schema.optionalKey(Schema.String).pipe(Schema.encodeTo(Schema.String))
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

    it("optional properties", () => {
      assertDocument(
        Schema.Struct({
          a: Schema.optional(Schema.String),
          b: Schema.optional(Schema.String.annotate({ description: "b" })),
          c: Schema.optional(Schema.String).annotate({ description: "c" }),
          d: Schema.optional(Schema.String).annotateKey({ description: "d-key" }),
          e: Schema.optional(Schema.String.annotate({ description: "e" })).annotateKey({ description: "e-key" })
        }),
        {
          schema: {
            "type": "object",
            "properties": {
              "a": {
                "type": "string"
              },
              "b": {
                "type": "string",
                "description": "b"
              },
              "c": {
                "description": "c",
                "anyOf": [{
                  "type": "string"
                }]
              },
              "d": {
                "type": "string",
                "allOf": [{
                  "description": "d-key",
                  "x-key": true
                }]
              },
              "e": {
                "type": "string",
                "description": "e",
                "allOf": [{
                  "description": "e-key",
                  "x-key": true
                }]
              }
            },
            "additionalProperties": false
          }
        }
      )
    })

    it("UndefinedOr fields", () => {
      const schema = Schema.Struct({
        a: Schema.UndefinedOr(Schema.String),
        b: Schema.UndefinedOr(Schema.String.annotate({ description: "b-inner-description" })),
        c: Schema.UndefinedOr(Schema.String.annotate({ description: "c-inner-description" })).annotate({
          description: "c-outer-description"
        }),
        d: Schema.UndefinedOr(Schema.String.annotate({ description: "d-inner-description" })).annotateKey({
          description: "d-key-description"
        })
      })
      assertDocument(schema, {
        schema: {
          "type": "object",
          "properties": {
            "a": {
              "type": "string"
            },
            "b": {
              "type": "string",
              "description": "b-inner-description"
            },
            "c": {
              "description": "c-outer-description",
              "anyOf": [
                {
                  "type": "string",
                  "description": "c-inner-description"
                }
              ]
            },
            "d": {
              "type": "string",
              "description": "d-inner-description",
              "allOf": [{
                "description": "d-key-description",
                "x-key": true
              }]
            }
          },
          "additionalProperties": false
        }
      })
    })
  })

  describe("Record", () => {
    it("Record(String, Unknown)", () => {
      assertDocument(
        Schema.Record(Schema.String, Schema.Unknown),
        {
          schema: { "type": "object" }
        }
      )
    })

    it("Record(String, Number)", () => {
      assertDocument(
        Schema.Record(Schema.String, Schema.Number),
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
        Schema.Record(Schema.String, Schema.Number).annotate({ description: "description" }),
        {
          schema: {
            "type": "object",
            "additionalProperties": {
              "type": "number"
            },
            "description": "description"
          }
        }
      )
    })

    it("Record(`a${string}`, Number) & annotate", () => {
      assertDocument(
        Schema.Record(Schema.TemplateLiteral(["a", Schema.String]), Schema.Number),
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
      const jsonAnnotations = {
        "title": "title",
        "description": "description",
        "default": [] as const,
        "examples": [[] as const]
      }
      assertDocument(
        schema.annotate({ ...jsonAnnotations }),
        {
          schema: {
            "type": "array",
            "items": false,
            ...jsonAnnotations
          }
        }
      )
    })

    it("required element", () => {
      const Id3 = Schema.String.annotate({ identifier: "id3" })
      assertDocument(
        Schema.Tuple([
          Schema.String,
          Schema.String.annotate({ description: "b" }),
          Schema.String.annotateKey({ description: "c-key" }),
          Schema.String.annotate({ description: "d" }).annotateKey({ description: "d-key" }),
          Schema.String.annotate({ identifier: "id1" }),
          Schema.String.annotate({ identifier: "id2" }).annotateKey({ description: "id2-key" }),
          Id3.annotateKey({ description: "id3_1-key" }),
          Id3.annotateKey({ description: "id3_2-key" })
        ]),
        {
          schema: {
            "type": "array",
            "minItems": 8,
            "prefixItems": [
              {
                "type": "string"
              },
              {
                "type": "string",
                "description": "b"
              },
              {
                "type": "string",
                "allOf": [{
                  "description": "c-key",
                  "x-key": true
                }]
              },
              {
                "type": "string",
                "description": "d",
                "allOf": [{
                  "description": "d-key",
                  "x-key": true
                }]
              },
              { "$ref": "#/$defs/id1" },
              {
                "allOf": [
                  { "$ref": "#/$defs/id2" },
                  {
                    "description": "id2-key",
                    "x-key": true
                  }
                ]
              },
              {
                "allOf": [
                  { "$ref": "#/$defs/id3" },
                  {
                    "description": "id3_1-key",
                    "x-key": true
                  }
                ]
              },
              {
                "type": "string",
                "allOf": [{
                  "description": "id3_2-key",
                  "x-key": true
                }]
              }
            ],
            "items": false
          },
          definitions: {
            "id1": { "type": "string" },
            "id2": { "type": "string" },
            "id3": { "type": "string" }
          }
        }
      )
    })

    it("optionalKey properties", () => {
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
            "items": false
          }
        }
      )
    })

    it("optionalKey to required key", () => {
      assertDocument(
        Schema.Tuple([
          Schema.optionalKey(Schema.String).pipe(Schema.encodeTo(Schema.String))
        ]),
        {
          schema: {
            "type": "array",
            "minItems": 1,
            "prefixItems": [
              { "type": "string" }
            ],
            "items": false
          }
        }
      )
    })

    it("optional properties", () => {
      assertDocument(
        Schema.Tuple([
          Schema.optional(Schema.String),
          Schema.optional(Schema.String.annotate({ description: "b" })),
          Schema.optional(Schema.String).annotate({ description: "c" }),
          Schema.optional(Schema.String).annotateKey({ description: "d-key" }),
          Schema.optional(Schema.String.annotate({ description: "e" })).annotateKey({ description: "e-key" })
        ]),
        {
          schema: {
            "type": "array",
            "prefixItems": [
              {
                "type": "string"
              },
              {
                "type": "string",
                "description": "b"
              },
              {
                "anyOf": [
                  {
                    "type": "string"
                  }
                ],
                "description": "c"
              },
              {
                "type": "string",
                "allOf": [{
                  "description": "d-key",
                  "x-key": true
                }]
              },
              {
                "type": "string",
                "description": "e",
                "allOf": [{
                  "description": "e-key",
                  "x-key": true
                }]
              }
            ],
            "items": false
          }
        }
      )
    })

    it("UndefinedOr elements", () => {
      const schema = Schema.Tuple([
        Schema.UndefinedOr(Schema.String),
        Schema.UndefinedOr(Schema.String.annotate({ description: "b-inner-description" })),
        Schema.UndefinedOr(Schema.String.annotate({ description: "c-inner-description" })).annotate({
          description: "c-outer-description"
        }),
        Schema.UndefinedOr(Schema.String.annotate({ description: "d-inner-description" })).annotateKey({
          description: "d-key-description"
        })
      ])
      assertDocument(schema, {
        schema: {
          "type": "array",
          "prefixItems": [
            {
              "type": "string"
            },
            {
              "type": "string",
              "description": "b-inner-description"
            },
            {
              "anyOf": [
                {
                  "type": "string",
                  "description": "c-inner-description"
                }
              ],
              "description": "c-outer-description"
            },
            {
              "type": "string",
              "description": "d-inner-description",
              "allOf": [{
                "description": "d-key-description",
                "x-key": true
              }]
            }
          ],
          "items": false
        }
      })
    })
  })

  describe("Array", () => {
    it("Array(Unknown)", () => {
      assertDocument(
        Schema.Array(Schema.Unknown),
        {
          schema: { "type": "array" }
        }
      )
    })

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
        Schema.Array(Schema.String).annotate({ description: "description" }),
        {
          schema: {
            "type": "array",
            "items": { "type": "string" },
            "description": "description"
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
              { "uniqueItems": true, "x-is-finite": true }
            ]
          }
        }
      )
    })
  })

  describe("Union", () => {
    it("empty union (unsupported)", () => {
      const schema = Schema.Union([])
      assertDocument(schema, {
        schema: {
          "not": {}
        }
      })
      assertDocument(Schema.Union([]).annotate({ description: "a" }), {
        schema: {
          "not": {}
        }
      })
    })

    it("single member", () => {
      const schema = Schema.Union([Schema.String])
      assertDocument(schema, {
        schema: {
          "type": "string"
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
          Schema.Number
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
          Schema.Number
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

    it(`1 | 2 | string`, () => {
      assertDocument(
        Schema.Union([
          Schema.Literal(1),
          Schema.Literal(2).annotate({ description: "2-description" }),
          Schema.String
        ]),
        {
          schema: {
            "anyOf": [
              { "type": "number", "enum": [1] },
              { "type": "number", "enum": [2], "description": "2-description" },
              { "type": "string" }
            ]
          }
        }
      )
    })

    it(`(1 | 2) | string`, () => {
      assertDocument(
        Schema.Union([
          Schema.Literals([1, 2]).annotate({ description: "1-2-description" }),
          Schema.String
        ]),
        {
          schema: {
            "anyOf": [
              {
                "anyOf": [
                  { "type": "number", "enum": [1] },
                  { "type": "number", "enum": [2] }
                ],
                "description": "1-2-description"
              },
              { "type": "string" }
            ]
          }
        }
      )
    })
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
            "$ref": "#/$defs/A"
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
        }
      )
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
                      "type": "number",
                      "allOf": [
                        { "type": "integer" }
                      ]
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
                    {
                      "type": "number",
                      "allOf": [
                        { "type": "integer" }
                      ]
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
  })

  describe("checks", () => {
    it("isInt", () => {
      assertDocument(
        Schema.Number.annotate({ description: "description" }).check(Schema.isInt()),
        {
          schema: {
            "type": "number",
            "description": "description",
            "allOf": [
              { "type": "integer" }
            ]
          }
        }
      )
    })

    it("isInt32", () => {
      assertDocument(
        Schema.Number.annotate({ description: "description" }).check(Schema.isInt32()),
        {
          schema: {
            "type": "number",
            "description": "description",
            "allOf": [
              { "type": "integer" },
              { "maximum": 2147483647, "minimum": -2147483648 }
            ]
          }
        }
      )
    })

    it("isUint32", () => {
      assertDocument(
        Schema.Number.annotate({ description: "description" }).check(Schema.isUint32()),
        {
          schema: {
            "type": "number",
            "description": "description",
            "allOf": [
              { "type": "integer" },
              { "maximum": 4294967295, "minimum": 0 }
            ]
          }
        }
      )
      assertDocument(
        Schema.Number.check(Schema.isUint32({ description: "uint32 description" })),
        {
          schema: {
            "type": "number",
            "allOf": [
              {
                "description": "uint32 description",
                "allOf": [
                  { "type": "integer" },
                  { "maximum": 4294967295, "minimum": 0 }
                ]
              }
            ]
          }
        }
      )
      assertDocument(
        Schema.Number.annotate({ description: "description" }).check(
          Schema.isUint32({ description: "uint32 description" })
        ),
        {
          schema: {
            "type": "number",
            "description": "description",
            "allOf": [
              {
                "description": "uint32 description",
                "allOf": [
                  { "type": "integer" },
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
        Schema.Number.check(Schema.isGreaterThan(1)),
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
        Schema.Number.check(Schema.isGreaterThanOrEqualTo(1)),
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
      assertDocument(Schema.Number.check(Schema.isLessThan(1)), {
        schema: {
          "type": "number",
          "allOf": [
            { "exclusiveMaximum": 1 }
          ]
        }
      })
    })

    it("isLessThanOrEqualTo", () => {
      assertDocument(Schema.Number.check(Schema.isLessThanOrEqualTo(1)), {
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
        Schema.Number.annotate({ description: "description" }).check(Schema.isBetween({ minimum: 1, maximum: 10 })),
        {
          schema: {
            "type": "number",
            "description": "description",
            "allOf": [
              { "minimum": 1, "maximum": 10 }
            ]
          }
        }
      )
      assertDocument(
        Schema.Number.annotate({ description: "description" }).check(
          Schema.isBetween({ minimum: 1, maximum: 10, exclusiveMinimum: true })
        ),
        {
          schema: {
            "type": "number",
            "description": "description",
            "allOf": [
              { "exclusiveMinimum": 1, "maximum": 10 }
            ]
          }
        }
      )
      assertDocument(
        Schema.Number.annotate({ description: "description" }).check(
          Schema.isBetween({ minimum: 1, maximum: 10, exclusiveMaximum: true })
        ),
        {
          schema: {
            "type": "number",
            "description": "description",
            "allOf": [
              { "minimum": 1, "exclusiveMaximum": 10 }
            ]
          }
        }
      )
      assertDocument(
        Schema.Number.annotate({ description: "description" }).check(
          Schema.isBetween({ minimum: 1, maximum: 10, exclusiveMinimum: true, exclusiveMaximum: true })
        ),
        {
          schema: {
            "type": "number",
            "description": "description",
            "allOf": [
              { "exclusiveMinimum": 1, "exclusiveMaximum": 10 }
            ]
          }
        }
      )
    })

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

  describe.todo("Class", () => {
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

  describe.todo("ErrorClass", () => {
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

  it("Uint8ArrayFromHex", () => {
    assertDocument(
      Schema.Uint8ArrayFromHex,
      {
        schema: {
          "type": "string"
        }
      }
    )
  })

  it("Uint8ArrayFromBase64", () => {
    assertDocument(
      Schema.Uint8ArrayFromBase64,
      {
        schema: {
          "type": "string"
        }
      }
    )
  })

  it("Uint8ArrayFromBase64Url", () => {
    assertDocument(
      Schema.Uint8ArrayFromBase64Url,
      {
        schema: {
          "type": "string"
        }
      }
    )
  })
})
