import * as OpenApiGenerator from "@effect/openapi-generator/OpenApiGenerator"
import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import type { OpenAPISpec } from "effect/unstable/httpapi/OpenApi"
import OpenAiFixture from "./fixtures/openai.json" with { type: "json" }

function assertRuntime(spec: OpenAPISpec) {
  return Effect.gen(function*() {
    const generator = yield* OpenApiGenerator.OpenApiGenerator

    const result = yield* generator.generate(spec, {
      name: "TestClient",
      typeOnly: false
    })

    // console.log(result)
    expect(result).toMatchSnapshot()
  }).pipe(
    Effect.provide(OpenApiGenerator.layerTransformerSchema)
  )
}

function assertTypeOnly(spec: OpenAPISpec) {
  return Effect.gen(function*() {
    const generator = yield* OpenApiGenerator.OpenApiGenerator

    const result = yield* generator.generate(spec, {
      name: "TestClient",
      typeOnly: true
    })

    // console.log(result)
    expect(result).toMatchSnapshot()
  }).pipe(
    Effect.provide(OpenApiGenerator.layerTransformerTs)
  )
}

describe("OpenApiGenerator", () => {
  describe("schema", () => {
    it.effect("OpenAiFixture", () => assertRuntime(OpenAiFixture as any))

    it.effect("get operation", () =>
      assertRuntime(
        {
          openapi: "3.1.0",
          info: {
            title: "Test API",
            version: "1.0.0"
          },
          paths: {
            "/users/{id}": {
              get: {
                operationId: "getUser",
                parameters: [
                  {
                    name: "id",
                    in: "path",
                    schema: {
                      type: "string"
                    },
                    required: true
                  }
                ],
                responses: {
                  200: {
                    description: "User retrieved successfully",
                    content: {
                      "application/json": {
                        schema: {
                          type: "object",
                          properties: {
                            id: {
                              type: "string"
                            },
                            name: {
                              type: "string"
                            }
                          },
                          required: ["id", "name"],
                          additionalProperties: false,
                          description: "User object"
                        }
                      }
                    }
                  }
                },
                tags: ["Users"],
                security: []
              }
            }
          },
          components: {
            schemas: {},
            securitySchemes: {}
          },
          security: [],
          tags: []
        }
      ))
  })

  describe("type-only", () => {
    it.effect("get operation", () =>
      assertTypeOnly(
        {
          openapi: "3.1.0",
          info: {
            title: "Test API",
            version: "1.0.0"
          },
          paths: {
            "/users/{id}": {
              get: {
                operationId: "getUser",
                parameters: [
                  {
                    name: "id",
                    in: "path",
                    schema: {
                      type: "string"
                    },
                    required: true
                  }
                ],
                responses: {
                  200: {
                    description: "User retrieved successfully",
                    content: {
                      "application/json": {
                        schema: {
                          type: "object",
                          properties: {
                            id: {
                              type: "string"
                            },
                            name: {
                              type: "string"
                            }
                          },
                          required: ["id", "name"],
                          additionalProperties: false
                        }
                      }
                    }
                  }
                },
                tags: ["Users"],
                security: []
              }
            }
          },
          components: {
            schemas: {},
            securitySchemes: {}
          },
          security: [],
          tags: []
        }
      ))
  })

  describe("identifier sanitization", () => {
    it.effect("sanitizes schema names with hyphens", () =>
      assertRuntime({
        openapi: "3.1.0",
        info: { title: "Test API", version: "1.0.0" },
        paths: {
          "/users/{id}": {
            get: {
              operationId: "getUser",
              parameters: [
                {
                  name: "id",
                  in: "path",
                  schema: {
                    type: "string"
                  },
                  required: true
                }
              ],
              responses: {
                200: {
                  description: "User retrieved successfully",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          id: {
                            type: "string"
                          },
                          name: {
                            type: "string"
                          }
                        },
                        required: ["id", "name"],
                        additionalProperties: false,
                        description: "User object"
                      }
                    }
                  }
                }
              },
              tags: ["Users"],
              security: []
            }
          }
        },
        tags: [],
        security: [],
        components: {
          schemas: {
            "Conversation-2": {
              type: "object",
              properties: {
                id: { type: "string", description: "Conversation ID" }
              },
              description: "A conversation object"
            },
            "Error-2": {
              type: "object",
              properties: {
                code: { type: "string", description: "Error code" },
                message: { type: "string", description: "Error message" }
              },
              description: "An error object"
            }
          },
          securitySchemes: {}
        }
      }))

    it.effect("handles collision when sanitized name already exists", () =>
      assertRuntime({
        openapi: "3.1.0",
        info: { title: "Test API", version: "1.0.0" },
        paths: {
          "/users/{id}": {
            get: {
              operationId: "getUser",
              parameters: [
                {
                  name: "id",
                  in: "path",
                  schema: {
                    type: "string"
                  },
                  required: true
                }
              ],
              responses: {
                200: {
                  description: "User retrieved successfully",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          id: {
                            type: "string"
                          },
                          name: {
                            type: "string"
                          }
                        },
                        required: ["id", "name"],
                        additionalProperties: false,
                        description: "User object"
                      }
                    }
                  }
                }
              },
              tags: ["Users"],
              security: []
            }
          }
        },
        tags: [],
        security: [],
        components: {
          schemas: {
            "Conversation2": {
              type: "object",
              properties: {
                id: { type: "string", description: "ID" }
              },
              description: "First conversation"
            },
            "Conversation-2": {
              type: "object",
              properties: {
                name: { type: "string", description: "Name" }
              },
              description: "Second conversation (will be renamed to avoid collision)"
            }
          },
          securitySchemes: {}
        }
      }))

    it.effect("preserves valid schema names unchanged", () =>
      assertRuntime({
        openapi: "3.1.0",
        info: { title: "Test API", version: "1.0.0" },
        paths: {
          "/users/{id}": {
            get: {
              operationId: "getUser",
              parameters: [
                {
                  name: "id",
                  in: "path",
                  schema: {
                    type: "string"
                  },
                  required: true
                }
              ],
              responses: {
                200: {
                  description: "User retrieved successfully",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          id: {
                            type: "string"
                          },
                          name: {
                            type: "string"
                          }
                        },
                        required: ["id", "name"],
                        additionalProperties: false,
                        description: "User object"
                      }
                    }
                  }
                }
              },
              tags: ["Users"],
              security: []
            }
          }
        },
        tags: [],
        security: [],
        components: {
          schemas: {
            "ValidName": {
              type: "object",
              properties: {
                id: { type: "string" }
              },
              description: "A valid schema name"
            },
            "AnotherValidName123": {
              type: "object",
              properties: {
                value: { type: "number" }
              },
              description: "Another valid schema name"
            }
          },
          securitySchemes: {}
        }
      }))
  })
})
