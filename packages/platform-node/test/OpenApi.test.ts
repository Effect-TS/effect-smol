import { assert, describe, it } from "@effect/vitest"
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/unstable/httpapi"

describe("OpenAPI spec", () => {
  describe("success option", () => {
    describe("withEncoding", () => {
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
              "format": "byte",
              "contentEncoding": "base64"
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
                  "$ref": "#/components/schemas/String_1"
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
                    message: { "$ref": "#/components/schemas/String_1" }
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
          String_1: {
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
                  "$ref": "#/components/schemas/String_1"
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
                    message: { "$ref": "#/components/schemas/String_1" }
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
          String_1: {
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
                  "$ref": "#/components/schemas/String_1"
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
                        message: { "$ref": "#/components/schemas/String_1" }
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
          String_1: {
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
                  "$ref": "#/components/schemas/String_1"
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
                  "$ref": "#/components/schemas/String_1"
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
          String_1: {
            "type": "string"
          },
          "effect_HttpApiSchemaError": {
            "type": "object",
            "properties": {
              "_tag": { "type": "string", "enum": ["HttpApiSchemaError"] },
              "message": { "$ref": "#/components/schemas/String_1" }
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
                  "$ref": "#/components/schemas/String_1"
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
                  "$ref": "#/components/schemas/String_1"
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
          String_1: {
            "type": "string"
          },
          "effect_HttpApiSchemaError": {
            "type": "object",
            "properties": {
              "_tag": { "type": "string", "enum": ["HttpApiSchemaError"] },
              "message": { "$ref": "#/components/schemas/String_1" }
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
                  "$ref": "#/components/schemas/String_1"
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
                  "$ref": "#/components/schemas/String_1"
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
          String_1: {
            "type": "string"
          },
          "effect_HttpApiSchemaError": {
            "type": "object",
            "properties": {
              "_tag": { "type": "string", "enum": ["HttpApiSchemaError"] },
              "message": { "$ref": "#/components/schemas/String_1" }
            },
            "required": ["_tag", "message"],
            "additionalProperties": false
          }
        })
      })
    })
  })
})
