import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import type { OpenAPISpec } from "effect/unstable/httpapi/OpenApi"
import OpenApiFixture from "../../../platform-node/test/fixtures/openapi.json" with { type: "json" }
import * as OpenApiGenerator from "../src/OpenApiGenerator.js"

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
    it.effect("OpenApiFixture", () => assertRuntime(OpenApiFixture as any))

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
                          required: ["id", "name"]
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
})
