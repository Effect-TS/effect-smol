import { assert, describe, it } from "@effect/vitest"
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/unstable/httpapi"

describe("OpenAPI spec", () => {
  describe("payload option", () => {
    describe("encoding", () => {
      it("Uint8Array", () => {
        const Api = HttpApi.make("api")
          .add(
            HttpApiGroup.make("group")
              .add(
                HttpApiEndpoint.post("a", "/a", {
                  payload: HttpApiSchema.Uint8Array(),
                  success: Schema.String
                })
              )
          )
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/a"].post?.requestBody?.content, {
          "application/octet-stream": {
            schema: {
              "type": "string",
              "format": "binary"
            }
          }
        })
      })

      it("nested unions with different encodings", () => {
        const Api = HttpApi.make("api")
          .add(
            HttpApiGroup.make("group")
              .add(
                HttpApiEndpoint.post("a", "/a", {
                  payload: Schema.Union([
                    Schema.Struct({ a: Schema.String }), // application/json
                    Schema.Union([
                      HttpApiSchema.Text(), // text/plain
                      HttpApiSchema.Uint8Array() // application/octet-stream
                    ])
                  ]),
                  success: Schema.String
                })
              )
          )
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/a"].post?.requestBody?.content, {
          "application/json": {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "$ref": "#/components/schemas/String_"
                }
              },
              "required": ["a"],
              "additionalProperties": false
            }
          },
          "text/plain": {
            schema: {
              "$ref": "#/components/schemas/String_"
            }
          },
          "application/octet-stream": {
            schema: {
              "type": "string",
              "format": "binary"
            }
          }
        })
      })
    })
  })

  describe("success option", () => {
    describe("encoding", () => {
      it("Uint8Array", () => {
        const Api = HttpApi.make("api")
          .add(
            HttpApiGroup.make("group")
              .add(
                HttpApiEndpoint.get("a", "/a", {
                  success: HttpApiSchema.Uint8Array()
                })
              )
          )
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/a"].get?.responses["200"].content, {
          "application/octet-stream": {
            schema: {
              "type": "string",
              "format": "binary"
            }
          }
        })
      })

      it.todo("nested unions with different encodings", () => {
        const Api = HttpApi.make("api")
          .add(
            HttpApiGroup.make("group")
              .add(
                HttpApiEndpoint.get("a", "/a", {
                  success: Schema.Union([
                    Schema.Struct({ a: Schema.String }), // application/json
                    Schema.Union([
                      HttpApiSchema.Text(), // text/plain
                      HttpApiSchema.Uint8Array() // application/octet-stream
                    ])
                  ])
                })
              )
          )
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/a"].get?.responses["200"].content, {
          "application/json": {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "$ref": "#/components/schemas/String_"
                }
              },
              "required": ["a"],
              "additionalProperties": false
            }
          },
          "text/plain": {
            schema: {
              "$ref": "#/components/schemas/String_"
            }
          },
          "application/octet-stream": {
            schema: {
              "type": "string",
              "format": "binary"
            }
          }
        })
      })
    })
  })

  describe("error option", () => {
    describe("1 endopoint", () => {
      it("no identifier annotation", () => {
        const E = Schema.String
        class Group extends HttpApiGroup.make("users")
          .add(HttpApiEndpoint.post("a", "/a", {
            payload: Schema.String,
            success: Schema.String,
            error: E
          }))
        {}

        class Api extends HttpApi.make("api").add(Group) {}
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/a"].post?.responses, {
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  "$ref": "#/components/schemas/String_"
                }
              }
            }
          },
          "400": {
            description: "The request or response did not match the expected schema",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    _tag: { type: "string", enum: ["HttpApiSchemaError"] },
                    message: { "$ref": "#/components/schemas/String_" }
                  },
                  required: ["_tag", "message"],
                  additionalProperties: false
                }
              }
            }
          },
          "500": {
            description: "Error",
            content: {
              "application/json": {
                schema: {
                  "type": "string"
                }
              }
            }
          }
        })
        assert.deepStrictEqual(spec.components.schemas, {
          String_: {
            "type": "string"
          }
        })
      })

      it("identifier annotation", () => {
        const E = Schema.String.annotate({ identifier: "id" })
        class Group extends HttpApiGroup.make("users")
          .add(HttpApiEndpoint.post("a", "/a", {
            payload: Schema.String,
            success: Schema.String,
            error: E
          }))
        {}

        class Api extends HttpApi.make("api").add(Group) {}
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/a"].post?.responses, {
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  "$ref": "#/components/schemas/String_"
                }
              }
            }
          },
          "400": {
            description: "The request or response did not match the expected schema",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    _tag: { type: "string", enum: ["HttpApiSchemaError"] },
                    message: { "$ref": "#/components/schemas/String_" }
                  },
                  required: ["_tag", "message"],
                  additionalProperties: false
                }
              }
            }
          },
          "500": {
            description: "id",
            content: {
              "application/json": {
                schema: {
                  "type": "string"
                }
              }
            }
          }
        })
        assert.deepStrictEqual(spec.components.schemas, {
          String_: {
            "type": "string"
          }
        })
      })

      it("httpApiStatus annotation", () => {
        const E = Schema.String.annotate({ httpApiStatus: 400 })
        class Group extends HttpApiGroup.make("users")
          .add(HttpApiEndpoint.post("a", "/a", {
            payload: Schema.String,
            success: Schema.String,
            error: E
          }))
        {}

        class Api extends HttpApi.make("api").add(Group) {}
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/a"].post?.responses, {
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  "$ref": "#/components/schemas/String_"
                }
              }
            }
          },
          "400": {
            description: "The request or response did not match the expected schema",
            content: {
              "application/json": {
                schema: {
                  "anyOf": [
                    {
                      type: "object",
                      properties: {
                        _tag: { type: "string", enum: ["HttpApiSchemaError"] },
                        message: { "$ref": "#/components/schemas/String_" }
                      },
                      required: ["_tag", "message"],
                      additionalProperties: false
                    },
                    {
                      "type": "string"
                    }
                  ]
                }
              }
            }
          }
        })
        assert.deepStrictEqual(spec.components.schemas, {
          String_: {
            "type": "string"
          }
        })
      })
    })

    describe("2 endopoints", () => {
      it("no identifier annotation", () => {
        const E = Schema.String
        class Group extends HttpApiGroup.make("users")
          .add(HttpApiEndpoint.post("a", "/a", {
            payload: Schema.String,
            success: Schema.String,
            error: E
          }))
          .add(HttpApiEndpoint.post("b", "/b", {
            payload: Schema.String,
            success: Schema.String,
            error: E
          }))
        {}

        class Api extends HttpApi.make("api").add(Group) {}
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/a"].post?.responses, {
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  "$ref": "#/components/schemas/String_"
                }
              }
            }
          },
          "400": {
            description: "The request or response did not match the expected schema",
            content: {
              "application/json": {
                schema: {
                  "$ref": "#/components/schemas/effect_HttpApiSchemaError"
                }
              }
            }
          },
          "500": {
            description: "Error",
            content: {
              "application/json": {
                schema: {
                  "type": "string"
                }
              }
            }
          }
        })
        assert.deepStrictEqual(spec.paths["/b"].post?.responses, {
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  "$ref": "#/components/schemas/String_"
                }
              }
            }
          },
          "400": {
            description: "The request or response did not match the expected schema",
            content: {
              "application/json": {
                schema: {
                  "$ref": "#/components/schemas/effect_HttpApiSchemaError"
                }
              }
            }
          },
          "500": {
            description: "Error",
            content: {
              "application/json": {
                schema: {
                  "type": "string"
                }
              }
            }
          }
        })
        assert.deepStrictEqual(spec.components.schemas, {
          String_: {
            "type": "string"
          },
          "effect_HttpApiSchemaError": {
            "type": "object",
            "properties": {
              "_tag": { "type": "string", "enum": ["HttpApiSchemaError"] },
              "message": { "$ref": "#/components/schemas/String_" }
            },
            "required": ["_tag", "message"],
            "additionalProperties": false
          }
        })
      })

      it("identifier annotation", () => {
        const E = Schema.String.annotate({ identifier: "id" })
        class Group extends HttpApiGroup.make("users")
          .add(HttpApiEndpoint.post("a", "/a", {
            payload: Schema.String,
            success: Schema.String,
            error: E
          }))
          .add(HttpApiEndpoint.post("b", "/b", {
            payload: Schema.String,
            success: Schema.String,
            error: E
          }))
        {}

        class Api extends HttpApi.make("api").add(Group) {}
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/a"].post?.responses, {
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  "$ref": "#/components/schemas/String_"
                }
              }
            }
          },
          "400": {
            description: "The request or response did not match the expected schema",
            content: {
              "application/json": {
                schema: {
                  "$ref": "#/components/schemas/effect_HttpApiSchemaError"
                }
              }
            }
          },
          "500": {
            description: "id",
            content: {
              "application/json": {
                schema: {
                  "type": "string"
                }
              }
            }
          }
        })
        assert.deepStrictEqual(spec.paths["/b"].post?.responses, {
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  "$ref": "#/components/schemas/String_"
                }
              }
            }
          },
          "400": {
            description: "The request or response did not match the expected schema",
            content: {
              "application/json": {
                schema: {
                  "$ref": "#/components/schemas/effect_HttpApiSchemaError"
                }
              }
            }
          },
          "500": {
            description: "id",
            content: {
              "application/json": {
                schema: {
                  "type": "string"
                }
              }
            }
          }
        })
        assert.deepStrictEqual(spec.components.schemas, {
          String_: {
            "type": "string"
          },
          "effect_HttpApiSchemaError": {
            "type": "object",
            "properties": {
              "_tag": { "type": "string", "enum": ["HttpApiSchemaError"] },
              "message": { "$ref": "#/components/schemas/String_" }
            },
            "required": ["_tag", "message"],
            "additionalProperties": false
          }
        })
      })

      it("httpApiStatus annotation", () => {
        const E = Schema.String.annotate({ httpApiStatus: 400 })
        class Group extends HttpApiGroup.make("users")
          .add(HttpApiEndpoint.post("a", "/a", {
            payload: Schema.String,
            success: Schema.String,
            error: E
          }))
          .add(HttpApiEndpoint.post("b", "/b", {
            payload: Schema.String,
            success: Schema.String,
            error: E
          }))
        {}

        class Api extends HttpApi.make("api").add(Group) {}
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/a"].post?.responses, {
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  "$ref": "#/components/schemas/String_"
                }
              }
            }
          },
          "400": {
            description: "The request or response did not match the expected schema",
            content: {
              "application/json": {
                schema: {
                  "anyOf": [
                    {
                      "$ref": "#/components/schemas/effect_HttpApiSchemaError"
                    },
                    {
                      "type": "string"
                    }
                  ]
                }
              }
            }
          }
        })
        assert.deepStrictEqual(spec.paths["/b"].post?.responses, {
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  "$ref": "#/components/schemas/String_"
                }
              }
            }
          },
          "400": {
            description: "The request or response did not match the expected schema",
            content: {
              "application/json": {
                schema: {
                  "anyOf": [
                    {
                      "$ref": "#/components/schemas/effect_HttpApiSchemaError"
                    },
                    {
                      "type": "string"
                    }
                  ]
                }
              }
            }
          }
        })
        assert.deepStrictEqual(spec.components.schemas, {
          String_: {
            "type": "string"
          },
          "effect_HttpApiSchemaError": {
            "type": "object",
            "properties": {
              "_tag": { "type": "string", "enum": ["HttpApiSchemaError"] },
              "message": { "$ref": "#/components/schemas/String_" }
            },
            "required": ["_tag", "message"],
            "additionalProperties": false
          }
        })
      })
    })
  })
})
