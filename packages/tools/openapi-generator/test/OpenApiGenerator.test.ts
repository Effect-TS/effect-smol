import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import type { OpenAPISpec } from "effect/unstable/httpapi/OpenApi"
import * as OpenApiGenerator from "../src/OpenApiGenerator.js"

function assertClient(spec: OpenAPISpec) {
  return Effect.gen(function*() {
    const generator = yield* OpenApiGenerator.OpenApiGenerator

    const result = yield* generator.generate(spec, {
      name: "TestClient",
      typeOnly: false
    })

    expect(result).toMatchSnapshot()
  }).pipe(
    Effect.provide(OpenApiGenerator.layerTransformerSchema)
  )
}

describe("OpenApiGenerator", () => {
  it.effect("get operation", () =>
    assertClient(
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
