import { assert, describe, it } from "@effect/vitest"
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiError, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/unstable/httpapi"

describe("OpenAPI spec", () => {
  describe("path option", () => {
    it("GET", () => {
      const Api = HttpApi.make("api")
        .add(
          HttpApiGroup.make("group")
            .add(
              HttpApiEndpoint.get("a", "/a/:id", {
                path: {
                  id: Schema.FiniteFromString
                }
              })
            )
        )
      const spec = OpenApi.fromApi(Api)
      assert.deepStrictEqual(spec.paths["/a/{id}"].get?.parameters, [
        {
          name: "id",
          in: "path",
          schema: {
            "type": "string"
          },
          required: true
        }
      ])
    })
  })

  describe("payload option", () => {
    describe("GET", () => {
      it("query parameters", () => {
        const Api = HttpApi.make("api")
          .add(
            HttpApiGroup.make("group")
              .add(
                HttpApiEndpoint.get("a", "/a", {
                  payload: {
                    required: Schema.FiniteFromString,
                    optionalKey: Schema.optionalKey(Schema.FiniteFromString),
                    optional: Schema.optional(Schema.FiniteFromString)
                  }
                })
              )
          )
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/a"].get?.parameters, [
          {
            name: "required",
            in: "query",
            schema: {
              "$ref": "#/components/schemas/String_"
            },
            required: true
          },
          {
            name: "optionalKey",
            in: "query",
            schema: {
              "type": "string"
            },
            required: false
          },
          {
            name: "optional",
            in: "query",
            schema: {
              "anyOf": [
                { "$ref": "#/components/schemas/String_" },
                { "type": "null" }
              ]
            },
            required: false
          }
        ])
        assert.deepStrictEqual(spec.components.schemas, {
          String_: {
            "type": "string"
          }
        })
      })
    })

    describe("POST", () => {
      it("empty payload", () => {
        const Api = HttpApi.make("api")
          .add(
            HttpApiGroup.make("group")
              .add(HttpApiEndpoint.post("a", "/a", { payload: Schema.Void }))
          )
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/a"].post?.requestBody, undefined)
      })

      it("empty + non-empty payload", () => {
        const Api = HttpApi.make("api")
          .add(
            HttpApiGroup.make("group")
              .add(HttpApiEndpoint.post("a", "/a", { payload: [Schema.Void, Schema.String] }))
          )
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/a"].post?.requestBody?.content, {
          "application/json": {
            schema: {
              "$ref": "#/components/schemas/String_"
            }
          }
        })
        assert.deepStrictEqual(spec.components.schemas, {
          String_: {
            "type": "string"
          }
        })
      })

      it("Json (default)", () => {
        const Api = HttpApi.make("api")
          .add(
            HttpApiGroup.make("group")
              .add(
                HttpApiEndpoint.post("a", "/a", {
                  payload: Schema.String
                })
              )
          )
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/a"].post?.requestBody?.content, {
          "application/json": {
            schema: {
              "$ref": "#/components/schemas/String_"
            }
          }
        })
        assert.deepStrictEqual(spec.components.schemas, {
          String_: {
            "type": "string"
          }
        })
      })

      describe("withEncoding", () => {
        it("Json (with overridden contentType)", () => {
          const Api = HttpApi.make("api")
            .add(
              HttpApiGroup.make("group")
                .add(
                  HttpApiEndpoint.post("a", "/a", {
                    payload: Schema.String.pipe(
                      HttpApiSchema.withEncoding({ kind: "Json", contentType: "application/problem+json" })
                    )
                  })
                )
            )
          const spec = OpenApi.fromApi(Api)
          assert.deepStrictEqual(spec.paths["/a"].post?.requestBody?.content, {
            "application/problem+json": {
              schema: {
                "type": "string"
              }
            }
          })
        })

        it("Text", () => {
          const Api = HttpApi.make("api")
            .add(
              HttpApiGroup.make("group")
                .add(
                  HttpApiEndpoint.post("a", "/a", {
                    payload: HttpApiSchema.Text()
                  })
                )
            )
          const spec = OpenApi.fromApi(Api)
          assert.deepStrictEqual(spec.paths["/a"].post?.requestBody?.content, {
            "text/plain": {
              schema: {
                "$ref": "#/components/schemas/String_"
              }
            }
          })
          assert.deepStrictEqual(spec.components.schemas, {
            String_: {
              "type": "string"
            }
          })
        })

        it("UrlParams", () => {
          const Api = HttpApi.make("api")
            .add(
              HttpApiGroup.make("group")
                .add(
                  HttpApiEndpoint.post("a", "/a", {
                    payload: Schema.Struct({ a: Schema.String }).pipe(HttpApiSchema.withEncoding({ kind: "UrlParams" }))
                  })
                )
            )
          const spec = OpenApi.fromApi(Api)
          assert.deepStrictEqual(spec.paths["/a"].post?.requestBody?.content, {
            "application/x-www-form-urlencoded": {
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
            }
          })
          assert.deepStrictEqual(spec.components.schemas, {
            String_: {
              "type": "string"
            }
          })
        })

        it("Uint8Array", () => {
          const Api = HttpApi.make("api")
            .add(
              HttpApiGroup.make("group")
                .add(
                  HttpApiEndpoint.post("a", "/a", {
                    payload: HttpApiSchema.Uint8Array()
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

        it("array of schemas with different encodings", () => {
          const Api = HttpApi.make("api")
            .add(
              HttpApiGroup.make("group")
                .add(
                  HttpApiEndpoint.post("a", "/a", {
                    payload: [
                      Schema.Struct({ a: Schema.String }), // application/json
                      HttpApiSchema.Text(), // text/plain
                      HttpApiSchema.Uint8Array() // application/octet-stream
                    ]
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
          assert.deepStrictEqual(spec.components.schemas, {
            String_: {
              "type": "string"
            }
          })
        })
      })
    })
  })

  describe("success option", () => {
    it("no content (default)", () => {
      const Api = HttpApi.make("api")
        .add(
          HttpApiGroup.make("group")
            .add(HttpApiEndpoint.get("a", "/a"))
        )
      const spec = OpenApi.fromApi(Api)
      assert.deepStrictEqual(spec.paths["/a"].get?.responses["204"], {
        description: "Success"
      })
    })

    it("schema", () => {
      const Api = HttpApi.make("api")
        .add(
          HttpApiGroup.make("group")
            .add(HttpApiEndpoint.get("a", "/a", {
              success: Schema.String
            }))
        )
      const spec = OpenApi.fromApi(Api)
      assert.deepStrictEqual(spec.paths["/a"].get?.responses["200"].content, {
        "application/json": {
          schema: {
            "$ref": "#/components/schemas/String_"
          }
        }
      })
      assert.deepStrictEqual(spec.components.schemas, {
        String_: {
          "type": "string"
        }
      })
    })

    describe("empty response", () => {
      it("Schema.Void", () => {
        const Api = HttpApi.make("api")
          .add(
            HttpApiGroup.make("group")
              .add(HttpApiEndpoint.get("a", "/a", {
                success: Schema.Void
              }))
          )
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/a"].get?.responses["204"], {
          description: "Success"
        })
      })

      it("Empty(204)", () => {
        const Api = HttpApi.make("api")
          .add(
            HttpApiGroup.make("group")
              .add(HttpApiEndpoint.get("a", "/a", {
                success: HttpApiSchema.Empty(204)
              }))
          )
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/a"].get?.responses["204"], {
          description: "Success"
        })
      })

      it("NoContent", () => {
        const Api = HttpApi.make("api")
          .add(
            HttpApiGroup.make("group")
              .add(HttpApiEndpoint.get("a", "/a", {
                success: HttpApiSchema.NoContent
              }))
          )
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/a"].get?.responses["204"], {
          description: "Success"
        })
      })

      it("Created", () => {
        const Api = HttpApi.make("api")
          .add(
            HttpApiGroup.make("group")
              .add(HttpApiEndpoint.get("a", "/a", {
                success: HttpApiSchema.Created
              }))
          )
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/a"].get?.responses["201"], {
          description: "Success"
        })
      })

      it("Accepted", () => {
        const Api = HttpApi.make("api")
          .add(
            HttpApiGroup.make("group")
              .add(HttpApiEndpoint.get("a", "/a", {
                success: HttpApiSchema.Accepted
              }))
          )
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/a"].get?.responses["202"], {
          description: "Success"
        })
      })
    })

    describe("withEncoding", () => {
      it("Json (with overridden contentType)", () => {
        const Api = HttpApi.make("api")
          .add(
            HttpApiGroup.make("group")
              .add(
                HttpApiEndpoint.get("a", "/a", {
                  success: Schema.String.pipe(
                    HttpApiSchema.withEncoding({ kind: "Json", contentType: "application/problem+json" })
                  )
                })
              )
          )
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/a"].get?.responses["200"].content, {
          "application/problem+json": {
            schema: {
              "type": "string"
            }
          }
        })
      })

      it("Text", () => {
        const Api = HttpApi.make("api")
          .add(
            HttpApiGroup.make("group")
              .add(
                HttpApiEndpoint.get("a", "/a", {
                  success: HttpApiSchema.Text()
                })
              )
          )
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/a"].get?.responses["200"].content, {
          "text/plain": {
            schema: {
              "$ref": "#/components/schemas/String_"
            }
          }
        })
      })

      it("UrlParams", () => {
        const Api = HttpApi.make("api")
          .add(
            HttpApiGroup.make("group")
              .add(
                HttpApiEndpoint.get("a", "/a", {
                  success: Schema.Struct({ a: Schema.String }).pipe(HttpApiSchema.withEncoding({ kind: "UrlParams" }))
                })
              )
          )
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/a"].get?.responses["200"].content, {
          "application/x-www-form-urlencoded": {
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
          }
        })
      })

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

      it("union with top level encoding", () => {
        const Api = HttpApi.make("api")
          .add(
            HttpApiGroup.make("group")
              .add(
                HttpApiEndpoint.get("a", "/a", {
                  success: Schema.Union([
                    Schema.Struct({ a: Schema.String }),
                    Schema.Struct({ b: Schema.String })
                  ]).pipe(HttpApiSchema.withEncoding({ kind: "UrlParams" }))
                })
              )
          )
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/a"].get?.responses["200"].content, {
          "application/x-www-form-urlencoded": {
            schema: {
              "anyOf": [
                {
                  "type": "object",
                  "properties": {
                    "a": {
                      "$ref": "#/components/schemas/String_"
                    }
                  },
                  "required": ["a"],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "b": {
                      "$ref": "#/components/schemas/String_"
                    }
                  },
                  "required": ["b"],
                  "additionalProperties": false
                }
              ]
            }
          }
        })
      })
    })
  })

  describe("error option", () => {
    describe("1 endopoint", () => {
      it("no identifier annotation", () => {
        class Group extends HttpApiGroup.make("users")
          .add(HttpApiEndpoint.post("a", "/a", {
            payload: Schema.String,
            success: Schema.String,
            error: Schema.String
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
                  "$ref": "#/components/schemas/String_"
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
        class Group extends HttpApiGroup.make("users")
          .add(HttpApiEndpoint.post("a", "/a", {
            payload: Schema.String,
            success: Schema.String,
            error: Schema.String.annotate({ identifier: "id" })
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
        class Group extends HttpApiGroup.make("users")
          .add(HttpApiEndpoint.post("a", "/a", {
            payload: Schema.String,
            success: Schema.String,
            error: Schema.String.annotate({ httpApiStatus: 400 })
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
                      "type": "string"
                    },
                    {
                      type: "object",
                      properties: {
                        _tag: { type: "string", enum: ["HttpApiSchemaError"] },
                        message: { "$ref": "#/components/schemas/String_" }
                      },
                      required: ["_tag", "message"],
                      additionalProperties: false
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
                  "$ref": "#/components/schemas/String_"
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
                  "$ref": "#/components/schemas/String_"
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
                  "$ref": "#/components/schemas/id"
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
                  "$ref": "#/components/schemas/id"
                }
              }
            }
          }
        })
        assert.deepStrictEqual(spec.components.schemas, {
          String_: {
            "type": "string"
          },
          id: {
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
                      "$ref": "#/components/schemas/String_1"
                    },
                    {
                      "$ref": "#/components/schemas/effect_HttpApiSchemaError"
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
                      "$ref": "#/components/schemas/String_1"
                    },
                    {
                      "$ref": "#/components/schemas/effect_HttpApiSchemaError"
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
          String_1: {
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

    describe("empty errors", () => {
      it("Void", () => {
        const Api = HttpApi.make("api")
          .add(
            HttpApiGroup.make("group")
              .add(
                HttpApiEndpoint.get("a", "/a", {
                  error: Schema.Void
                })
              )
          )
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/a"].get?.responses["400"], {
          description: "The request or response did not match the expected schema",
          content: {
            "application/json": {
              schema: {
                "type": "object",
                "properties": {
                  "_tag": { "type": "string", "enum": ["HttpApiSchemaError"] },
                  "message": { "type": "string" }
                },
                "required": ["_tag", "message"],
                "additionalProperties": false
              }
            }
          }
        })
      })

      it("Empty(400)", () => {
        const Api = HttpApi.make("api")
          .add(
            HttpApiGroup.make("group")
              .add(
                HttpApiEndpoint.get("a", "/a", {
                  error: HttpApiSchema.Empty(400)
                })
              )
          )
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/a"].get?.responses["400"], {
          description: "The request or response did not match the expected schema",
          content: {
            "application/json": {
              schema: {
                "type": "object",
                "properties": {
                  "_tag": { "type": "string", "enum": ["HttpApiSchemaError"] },
                  "message": { "type": "string" }
                },
                "required": ["_tag", "message"],
                "additionalProperties": false
              }
            }
          }
        })
      })

      it("Empty(401)", () => {
        const Api = HttpApi.make("api")
          .add(
            HttpApiGroup.make("group")
              .add(
                HttpApiEndpoint.get("a", "/a", {
                  error: HttpApiSchema.Empty(401)
                })
              )
          )
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/a"].get?.responses["401"], {
          description: "Error"
        })
      })

      it("Unauthorized", () => {
        const Api = HttpApi.make("api")
          .add(
            HttpApiGroup.make("group")
              .add(
                HttpApiEndpoint.get("a", "/a", {
                  error: HttpApiError.Unauthorized
                })
              )
          )
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/a"].get?.responses["401"], {
          description: "Unauthorized"
        })
      })

      it("BadRequest", () => {
        const Api = HttpApi.make("api")
          .add(
            HttpApiGroup.make("group")
              .add(
                HttpApiEndpoint.get("a", "/a", {
                  error: HttpApiError.BadRequest
                })
              )
          )
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/a"].get?.responses["400"], {
          description: "BadRequest | The request or response did not match the expected schema",
          content: {
            "application/json": {
              schema: {
                "anyOf": [
                  {
                    "type": "null" // TODO: this should not be here
                  },
                  {
                    "type": "object",
                    "properties": {
                      "_tag": { "type": "string", "enum": ["HttpApiSchemaError"] },
                      "message": { "type": "string" }
                    },
                    "required": ["_tag", "message"],
                    "additionalProperties": false
                  }
                ]
              }
            }
          }
        })
      })
    })
  })
})
