import { assert, describe, it } from "@effect/vitest"
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiError, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/unstable/httpapi"

describe("OpenAPI spec", () => {
  describe("api", () => {
    it("annotate", () => {
      const Api = HttpApi.make("api")
        .annotate(OpenApi.Title, "title")
        .annotate(OpenApi.Version, "version")
        .annotate(OpenApi.Description, "description")
        .annotate(OpenApi.License, { name: "license" })
        .annotate(OpenApi.Summary, "summary")
        .annotate(OpenApi.Servers, [{ url: "https://example.com" }])
      const spec = OpenApi.fromApi(Api)
      assert.deepStrictEqual(spec.info.title, "title")
      assert.deepStrictEqual(spec.info.version, "version")
      assert.deepStrictEqual(spec.info.description, "description")
      assert.deepStrictEqual(spec.info.license, { name: "license" })
      assert.deepStrictEqual(spec.info.summary, "summary")
      assert.deepStrictEqual(spec.servers, [{ url: "https://example.com" }])
    })

    it("annotateMerge", () => {
      const Api = HttpApi.make("api").annotateMerge(OpenApi.annotations({
        title: "title",
        version: "version",
        description: "description",
        license: { name: "license" },
        summary: "summary",
        servers: [{ url: "https://example.com" }]
      }))
      const spec = OpenApi.fromApi(Api)
      assert.deepStrictEqual(spec.info.title, "title")
      assert.deepStrictEqual(spec.info.version, "version")
      assert.deepStrictEqual(spec.info.description, "description")
      assert.deepStrictEqual(spec.info.license, { name: "license" })
      assert.deepStrictEqual(spec.info.summary, "summary")
      assert.deepStrictEqual(spec.servers, [{ url: "https://example.com" }])
    })
  })

  it("catch all path", () => {
    const Api = HttpApi.make("api")
      .add(
        HttpApiGroup.make("group")
          .add(
            HttpApiEndpoint.get("a", "*", {
              success: Schema.String
            })
          )
      )
    const spec = OpenApi.fromApi(Api)
    assert.deepStrictEqual(spec.paths["*"].get?.responses, {
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
      }
    })
  })

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
      it("NoContent", () => {
        const Api = HttpApi.make("api")
          .add(
            HttpApiGroup.make("group")
              .add(HttpApiEndpoint.post("a", "/a", { payload: HttpApiSchema.NoContent }))
          )
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/a"].post?.requestBody, undefined)
      })

      it("NoContent + payload", () => {
        const Api = HttpApi.make("api")
          .add(
            HttpApiGroup.make("group")
              .add(HttpApiEndpoint.post("a", "/a", { payload: [HttpApiSchema.NoContent, Schema.String] }))
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

      describe("encodings", () => {
        it("asMultipart", () => {
          const Api = HttpApi.make("api")
            .add(
              HttpApiGroup.make("group")
                .add(
                  HttpApiEndpoint.post("a", "/a", {
                    payload: Schema.String.pipe(HttpApiSchema.asMultipart())
                  })
                )
            )
          const spec = OpenApi.fromApi(Api)
          assert.deepStrictEqual(spec.paths["/a"].post?.requestBody?.content, {
            "multipart/form-data": {
              schema: {
                "type": "string"
              }
            }
          })
        })

        it("asMultipartStream", () => {
          const Api = HttpApi.make("api")
            .add(
              HttpApiGroup.make("group")
                .add(
                  HttpApiEndpoint.post("a", "/a", {
                    payload: Schema.String.pipe(HttpApiSchema.asMultipartStream())
                  })
                )
            )
          const spec = OpenApi.fromApi(Api)
          assert.deepStrictEqual(spec.paths["/a"].post?.requestBody?.content, {
            "multipart/form-data": {
              schema: {
                "type": "string"
              }
            }
          })
        })

        it("asJson + contentType", () => {
          const Api = HttpApi.make("api")
            .add(
              HttpApiGroup.make("group")
                .add(
                  HttpApiEndpoint.post("a", "/a", {
                    payload: Schema.String.pipe(
                      HttpApiSchema.asJson({ contentType: "application/problem+json" })
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

        it("asText", () => {
          const Api = HttpApi.make("api")
            .add(
              HttpApiGroup.make("group")
                .add(
                  HttpApiEndpoint.post("a", "/a", {
                    payload: Schema.String.pipe(HttpApiSchema.asText())
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

        it("asUrlParams", () => {
          const Api = HttpApi.make("api")
            .add(
              HttpApiGroup.make("group")
                .add(
                  HttpApiEndpoint.post("a", "/a", {
                    payload: Schema.Struct({ a: Schema.String }).pipe(
                      HttpApiSchema.asUrlParams()
                    )
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

        it("asUint8Array", () => {
          const Api = HttpApi.make("api")
            .add(
              HttpApiGroup.make("group")
                .add(
                  HttpApiEndpoint.post("a", "/a", {
                    payload: Schema.Uint8Array.pipe(HttpApiSchema.asUint8Array())
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
                      Schema.String.pipe(HttpApiSchema.asText()), // text/plain
                      Schema.Uint8Array.pipe(HttpApiSchema.asUint8Array()) // application/octet-stream
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
        description: "<No Content>"
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

    describe("NoContent", () => {
      it("makeNoContent(204)", () => {
        const Api = HttpApi.make("api")
          .add(
            HttpApiGroup.make("group")
              .add(HttpApiEndpoint.get("a", "/a", {
                success: HttpApiSchema.Empty(204)
              }))
          )
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/a"].get?.responses["204"], {
          description: "<No Content>"
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
          description: "<No Content>"
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
          description: "<No Content>"
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
          description: "<No Content>"
        })
      })
    })

    describe("encodings", () => {
      it("asJson + contentType", () => {
        const Api = HttpApi.make("api")
          .add(
            HttpApiGroup.make("group")
              .add(
                HttpApiEndpoint.get("a", "/a", {
                  success: Schema.String.pipe(
                    HttpApiSchema.asJson({ contentType: "application/problem+json" })
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

      it("asText", () => {
        const Api = HttpApi.make("api")
          .add(
            HttpApiGroup.make("group")
              .add(
                HttpApiEndpoint.get("a", "/a", {
                  success: Schema.String.pipe(HttpApiSchema.asText())
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

      it("asUrlParams", () => {
        const Api = HttpApi.make("api")
          .add(
            HttpApiGroup.make("group")
              .add(
                HttpApiEndpoint.get("a", "/a", {
                  success: Schema.Struct({ a: Schema.String }).pipe(
                    HttpApiSchema.asUrlParams()
                  )
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

      it("asUint8Array", () => {
        const Api = HttpApi.make("api")
          .add(
            HttpApiGroup.make("group")
              .add(
                HttpApiEndpoint.get("a", "/a", {
                  success: Schema.Uint8Array.pipe(HttpApiSchema.asUint8Array())
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
                  ]).pipe(HttpApiSchema.asUrlParams())
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

    describe("No Content", () => {
      it("makeNoContent(400)", () => {
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
          description: "<No Content>"
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
          description: "<No Content>"
        })
      })

      it("UnauthorizedNoContent", () => {
        const Api = HttpApi.make("api")
          .add(
            HttpApiGroup.make("group")
              .add(
                HttpApiEndpoint.get("a", "/a", {
                  error: HttpApiError.UnauthorizedNoContent
                })
              )
          )
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/a"].get?.responses["401"], {
          description: "Unauthorized"
        })
      })

      it("BadRequestNoContent", () => {
        const Api = HttpApi.make("api")
          .add(
            HttpApiGroup.make("group")
              .add(
                HttpApiEndpoint.get("a", "/a", {
                  error: HttpApiError.BadRequestNoContent
                })
              )
          )
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/a"].get?.responses["400"], {
          description: "BadRequest"
        })
      })
    })
  })
})
