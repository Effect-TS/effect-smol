import * as OpenApiGenerator from "@effect/openapi-generator/OpenApiGenerator"
import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import type { OpenAPISpec } from "effect/unstable/httpapi/OpenApi"

function assertRuntime(spec: OpenAPISpec, expected: string) {
  return Effect.gen(function*() {
    const generator = yield* OpenApiGenerator.OpenApiGenerator

    const result = yield* generator.generate(spec, {
      name: "TestClient",
      format: "httpclient"
    })

    // console.log(result)
    assert.strictEqual(result, expected)
  }).pipe(
    Effect.provide(OpenApiGenerator.layerTransformerSchema)
  )
}

function assertTypeOnly(spec: OpenAPISpec, expected: string) {
  return Effect.gen(function*() {
    const generator = yield* OpenApiGenerator.OpenApiGenerator

    const result = yield* generator.generate(spec, {
      name: "TestClient",
      format: "httpclient-type-only"
    })

    // console.log(result)
    assert.strictEqual(result, expected)
  }).pipe(
    Effect.provide(OpenApiGenerator.layerTransformerTs)
  )
}

function assertRuntimeIncludes(spec: OpenAPISpec, includes: ReadonlyArray<string>) {
  return Effect.gen(function*() {
    const generator = yield* OpenApiGenerator.OpenApiGenerator

    const result = yield* generator.generate(spec, {
      name: "TestClient",
      format: "httpclient"
    })

    for (const expected of includes) {
      assert.include(result, expected)
    }
  }).pipe(
    Effect.provide(OpenApiGenerator.layerTransformerSchema)
  )
}

function assertHttpApiIncludes(spec: OpenAPISpec, includes: ReadonlyArray<string>) {
  return Effect.gen(function*() {
    const generator = yield* OpenApiGenerator.OpenApiGenerator

    const result = yield* generator.generate(spec, {
      name: "TestClient",
      format: "httpapi"
    })

    for (const expected of includes) {
      assert.include(result, expected)
    }
  }).pipe(
    Effect.provide(OpenApiGenerator.layerTransformerSchema)
  )
}

function assertRuntimeStableWithWarnings(
  spec: OpenAPISpec,
  expectedWarnings: ReadonlyArray<
    Pick<OpenApiGenerator.OpenApiGeneratorWarning, "code" | "path" | "method" | "operationId">
  >
) {
  return Effect.gen(function*() {
    const generator = yield* OpenApiGenerator.OpenApiGenerator
    const warnings: Array<OpenApiGenerator.OpenApiGeneratorWarning> = []

    const baseline = yield* generator.generate(spec, {
      name: "TestClient",
      format: "httpclient"
    })
    const withWarnings = yield* generator.generate(spec, {
      name: "TestClient",
      format: "httpclient",
      onWarning: (warning) => {
        warnings.push(warning)
      }
    })

    assert.strictEqual(withWarnings, baseline)
    assert.deepStrictEqual(
      warnings.map((warning) => ({
        code: warning.code,
        path: warning.path,
        method: warning.method,
        operationId: warning.operationId
      })),
      expectedWarnings
    )
  }).pipe(
    Effect.provide(OpenApiGenerator.layerTransformerSchema)
  )
}

function assertTypeOnlyStableWithWarnings(
  spec: OpenAPISpec,
  expectedWarnings: ReadonlyArray<
    Pick<OpenApiGenerator.OpenApiGeneratorWarning, "code" | "path" | "method" | "operationId">
  >
) {
  return Effect.gen(function*() {
    const generator = yield* OpenApiGenerator.OpenApiGenerator
    const warnings: Array<OpenApiGenerator.OpenApiGeneratorWarning> = []

    const baseline = yield* generator.generate(spec, {
      name: "TestClient",
      format: "httpclient-type-only"
    })
    const withWarnings = yield* generator.generate(spec, {
      name: "TestClient",
      format: "httpclient-type-only",
      onWarning: (warning) => {
        warnings.push(warning)
      }
    })

    assert.strictEqual(withWarnings, baseline)
    assert.deepStrictEqual(
      warnings.map((warning) => ({
        code: warning.code,
        path: warning.path,
        method: warning.method,
        operationId: warning.operationId
      })),
      expectedWarnings
    )
  }).pipe(
    Effect.provide(OpenApiGenerator.layerTransformerTs)
  )
}

const regressionSpec: OpenAPISpec = {
  openapi: "3.1.0",
  info: {
    title: "Regression API",
    version: "1.0.0"
  },
  paths: {
    "/users/{id}": {
      get: {
        operationId: "getUser",
        summary: "Get user",
        description: "Read a user",
        parameters: [
          {
            name: "id",
            in: "path",
            schema: {
              type: "string"
            },
            required: true
          },
          {
            name: "filter",
            in: "query",
            schema: {
              type: "string"
            },
            required: false
          },
          {
            name: "trace-id",
            in: "header",
            schema: {
              type: "string"
            },
            required: false
          },
          {
            name: "session",
            in: "cookie",
            schema: {
              type: "string"
            },
            required: false
          }
        ],
        responses: {
          default: {
            description: "Default user response",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: {
                      type: "string"
                    }
                  },
                  required: ["id"],
                  additionalProperties: false
                }
              }
            }
          }
        } as any,
        tags: ["Users"],
        security: [{ apiKey: [] }]
      }
    }
  },
  components: {
    schemas: {},
    securitySchemes: {
      apiKey: {
        type: "apiKey",
        name: "x-api-key",
        in: "header"
      }
    }
  },
  security: [],
  tags: [{ name: "Users" }]
}

describe("OpenApiGenerator", () => {
  describe("schema", () => {
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
        },
        `import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import type { SchemaError } from "effect/Schema"
import * as Schema from "effect/Schema"
import type * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientError from "effect/unstable/http/HttpClientError"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"
// schemas
export type GetUser200 = { readonly "id": string, readonly "name": string }
export const GetUser200 = Schema.Struct({ "id": Schema.String, "name": Schema.String }).annotate({ "description": "User object" })

export interface OperationConfig {
  /**
   * Whether or not the response should be included in the value returned from
   * an operation.
   *
   * If set to \`true\`, a tuple of \`[A, HttpClientResponse]\` will be returned,
   * where \`A\` is the success type of the operation.
   *
   * If set to \`false\`, only the success type of the operation will be returned.
   */
  readonly includeResponse?: boolean | undefined
}

/**
 * A utility type which optionally includes the response in the return result
 * of an operation based upon the value of the \`includeResponse\` configuration
 * option.
 */
export type WithOptionalResponse<A, Config extends OperationConfig> = Config extends {
  readonly includeResponse: true
} ? [A, HttpClientResponse.HttpClientResponse] : A

export const make = (
  httpClient: HttpClient.HttpClient,
  options: {
    readonly transformClient?: ((client: HttpClient.HttpClient) => Effect.Effect<HttpClient.HttpClient>) | undefined
  } = {}
): TestClient => {
  const unexpectedStatus = (response: HttpClientResponse.HttpClientResponse) =>
    Effect.flatMap(
      Effect.orElseSucceed(response.json, () => "Unexpected status code"),
      (description) =>
        Effect.fail(
          new HttpClientError.HttpClientError({
            reason: new HttpClientError.StatusCodeError({
              request: response.request,
              response,
              description: typeof description === "string" ? description : JSON.stringify(description),
            }),
          }),
        ),
    )
  const withResponse = <Config extends OperationConfig>(config: Config | undefined) => (
    f: (response: HttpClientResponse.HttpClientResponse) => Effect.Effect<any, any>,
  ): (request: HttpClientRequest.HttpClientRequest) => Effect.Effect<any, any> => {
    const withOptionalResponse = (
      config?.includeResponse
        ? (response: HttpClientResponse.HttpClientResponse) => Effect.map(f(response), (a) => [a, response])
        : (response: HttpClientResponse.HttpClientResponse) => f(response)
    ) as any
    return options?.transformClient
      ? (request) =>
          Effect.flatMap(
            Effect.flatMap(options.transformClient!(httpClient), (client) => client.execute(request)),
            withOptionalResponse
          )
      : (request) => Effect.flatMap(httpClient.execute(request), withOptionalResponse)
  }
  const decodeSuccess =
    <Schema extends Schema.Top>(schema: Schema) =>
    (response: HttpClientResponse.HttpClientResponse) =>
      HttpClientResponse.schemaBodyJson(schema)(response)
  const decodeError =
    <const Tag extends string, Schema extends Schema.Top>(tag: Tag, schema: Schema) =>
    (response: HttpClientResponse.HttpClientResponse) =>
      Effect.flatMap(
        HttpClientResponse.schemaBodyJson(schema)(response),
        (cause) => Effect.fail(TestClientError(tag, cause, response)),
      )
  return {
    httpClient,
    "getUser": (id, options) => HttpClientRequest.get(\`/users/\${id}\`).pipe(
    withResponse(options?.config)(HttpClientResponse.matchStatus({
      "2xx": decodeSuccess(GetUser200),
      orElse: unexpectedStatus
    }))
  )
  }
}

export interface TestClient {
  readonly httpClient: HttpClient.HttpClient
  readonly "getUser": <Config extends OperationConfig>(id: string, options: { readonly config?: Config | undefined } | undefined) => Effect.Effect<WithOptionalResponse<typeof GetUser200.Type, Config>, HttpClientError.HttpClientError | SchemaError>
}

export interface TestClientError<Tag extends string, E> {
  readonly _tag: Tag
  readonly request: HttpClientRequest.HttpClientRequest
  readonly response: HttpClientResponse.HttpClientResponse
  readonly cause: E
}

class TestClientErrorImpl extends Data.Error<{
  _tag: string
  cause: any
  request: HttpClientRequest.HttpClientRequest
  response: HttpClientResponse.HttpClientResponse
}> {}

export const TestClientError = <Tag extends string, E>(
  tag: Tag,
  cause: E,
  response: HttpClientResponse.HttpClientResponse,
): TestClientError<Tag, E> =>
  new TestClientErrorImpl({
    _tag: tag,
    cause,
    response,
    request: response.request,
  }) as any`
      ))

    it.effect("sse operation decodes event payload from json string", () =>
      assertRuntimeIncludes(
        {
          openapi: "3.1.0",
          info: {
            title: "Test API",
            version: "1.0.0"
          },
          paths: {
            "/events": {
              get: {
                operationId: "streamEvents",
                parameters: [],
                responses: {
                  200: {
                    description: "Events streamed successfully",
                    content: {
                      "text/event-stream": {
                        schema: {
                          type: "object",
                          properties: {
                            type: {
                              type: "string"
                            },
                            value: {
                              type: "string"
                            }
                          },
                          required: ["type", "value"],
                          additionalProperties: false
                        }
                      }
                    }
                  }
                },
                tags: ["Events"],
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
        },
        [
          `import * as Sse from "effect/unstable/encoding/Sse"`,
          `readonly "streamEventsSse": () => Stream.Stream<{ readonly event: string; readonly id: string | undefined; readonly data: typeof StreamEvents200Sse.Type }, HttpClientError.HttpClientError | SchemaError | Sse.Retry, typeof StreamEvents200Sse.DecodingServices>`,
          `"streamEventsSse": () => HttpClientRequest.get(\`/events\`).pipe(`,
          `sseRequest(StreamEvents200Sse)`
        ]
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
        },
        `import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import type * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientError from "effect/unstable/http/HttpClientError"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"
// schemas
export type GetUser200 = { readonly "id": string, readonly "name": string }

export interface OperationConfig {
  /**
   * Whether or not the response should be included in the value returned from
   * an operation.
   *
   * If set to \`true\`, a tuple of \`[A, HttpClientResponse]\` will be returned,
   * where \`A\` is the success type of the operation.
   *
   * If set to \`false\`, only the success type of the operation will be returned.
   */
  readonly includeResponse?: boolean | undefined
}

/**
 * A utility type which optionally includes the response in the return result
 * of an operation based upon the value of the \`includeResponse\` configuration
 * option.
 */
export type WithOptionalResponse<A, Config extends OperationConfig> = Config extends {
  readonly includeResponse: true
} ? [A, HttpClientResponse.HttpClientResponse] : A

export const make = (
  httpClient: HttpClient.HttpClient,
  options: {
    readonly transformClient?: ((client: HttpClient.HttpClient) => Effect.Effect<HttpClient.HttpClient>) | undefined
  } = {}
): TestClient => {
  const unexpectedStatus = (response: HttpClientResponse.HttpClientResponse) =>
    Effect.flatMap(
      Effect.orElseSucceed(response.json, () => "Unexpected status code"),
      (description) =>
        Effect.fail(
          new HttpClientError.HttpClientError({
            reason: new HttpClientError.StatusCodeError({
              request: response.request,
              response,
              description: typeof description === "string" ? description : JSON.stringify(description),
            }),
          }),
        ),
    )
  const withResponse = <Config extends OperationConfig>(config: Config | undefined) => (
    f: (response: HttpClientResponse.HttpClientResponse) => Effect.Effect<any, any>,
  ): (request: HttpClientRequest.HttpClientRequest) => Effect.Effect<any, any> => {
    const withOptionalResponse = (
      config?.includeResponse
        ? (response: HttpClientResponse.HttpClientResponse) => Effect.map(f(response), (a) => [a, response])
        : (response: HttpClientResponse.HttpClientResponse) => f(response)
    ) as any
    return options?.transformClient
      ? (request) =>
          Effect.flatMap(
            Effect.flatMap(options.transformClient!(httpClient), (client) => client.execute(request)),
            withOptionalResponse
          )
      : (request) => Effect.flatMap(httpClient.execute(request), withOptionalResponse)
  }
  const decodeSuccess = <A>(response: HttpClientResponse.HttpClientResponse) =>
    response.json as Effect.Effect<A, HttpClientError.HttpClientError>
  const decodeVoid = (_response: HttpClientResponse.HttpClientResponse) =>
    Effect.void
  const decodeError =
    <Tag extends string, E>(tag: Tag) =>
    (
      response: HttpClientResponse.HttpClientResponse,
    ): Effect.Effect<
      never,
      TestClientError<Tag, E> | HttpClientError.HttpClientError
    > =>
      Effect.flatMap(
        response.json as Effect.Effect<E, HttpClientError.HttpClientError>,
        (cause) => Effect.fail(TestClientError(tag, cause, response)),
      )
  const onRequest = <Config extends OperationConfig>(config: Config | undefined) => (
    successCodes: ReadonlyArray<string>,
    errorCodes?: Record<string, string>,
  ) => {
    const cases: any = { orElse: unexpectedStatus }
    for (const code of successCodes) {
      cases[code] = decodeSuccess
    }
    if (errorCodes) {
      for (const [code, tag] of Object.entries(errorCodes)) {
        cases[code] = decodeError(tag)
      }
    }
    if (successCodes.length === 0) {
      cases["2xx"] = decodeVoid
    }
    return withResponse(config)(HttpClientResponse.matchStatus(cases) as any)
  }
  return {
    httpClient,
    "getUser": (id, options) => HttpClientRequest.get(\`/users/\${id}\`).pipe(
    onRequest(options?.config)(["2xx"])
  )
  }
}

export interface TestClient {
  readonly httpClient: HttpClient.HttpClient
  readonly "getUser": <Config extends OperationConfig>(id: string, options: { readonly config?: Config | undefined } | undefined) => Effect.Effect<WithOptionalResponse<GetUser200, Config>, HttpClientError.HttpClientError>
}

export interface TestClientError<Tag extends string, E> {
  readonly _tag: Tag
  readonly request: HttpClientRequest.HttpClientRequest
  readonly response: HttpClientResponse.HttpClientResponse
  readonly cause: E
}

class TestClientErrorImpl extends Data.Error<{
  _tag: string
  cause: any
  request: HttpClientRequest.HttpClientRequest
  response: HttpClientResponse.HttpClientResponse
}> {}

export const TestClientError = <Tag extends string, E>(
  tag: Tag,
  cause: E,
  response: HttpClientResponse.HttpClientResponse,
): TestClientError<Tag, E> =>
  new TestClientErrorImpl({
    _tag: tag,
    cause,
    response,
    request: response.request,
  }) as any`
      ))
  })

  describe("httpapi", () => {
    it.effect("generates tagged groups with endpoint annotations and representable parameters", () =>
      assertHttpApiIncludes(
        {
          openapi: "3.1.0",
          info: {
            title: "Test API",
            version: "1.0.0",
            summary: "Summary",
            description: "Description"
          },
          paths: {
            "/users/{id}": {
              get: {
                operationId: "getUser",
                summary: "Get user",
                description: "Read a user",
                deprecated: true,
                externalDocs: {
                  url: "https://example.com/get-user"
                },
                parameters: [
                  {
                    name: "id",
                    in: "path",
                    schema: { type: "string" },
                    required: true
                  },
                  {
                    name: "filter",
                    in: "query",
                    schema: { type: "string" },
                    required: false
                  },
                  {
                    name: "trace-id",
                    in: "header",
                    schema: { type: "string" },
                    required: false
                  }
                ],
                responses: {
                  200: {
                    description: "User",
                    content: {
                      "application/json": {
                        schema: {
                          type: "object",
                          properties: {
                            id: { type: "string" }
                          },
                          required: ["id"],
                          additionalProperties: false
                        }
                      }
                    }
                  },
                  404: {
                    description: "Not found"
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
          tags: [
            {
              name: "Users",
              description: "User operations",
              externalDocs: {
                url: "https://example.com/users"
              }
            }
          ]
        },
        [
          `import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/unstable/httpapi"`,
          `export class GetUserPathParams extends Schema.Class<GetUserPathParams>("GetUserPathParams")({ "id": Schema.String }) {}`,
          `const UsersGroup = HttpApiGroup.make("Users")`,
          `.annotate(OpenApi.Description, "User operations")`,
          `.annotate(OpenApi.ExternalDocs, {"url":"https://example.com/users"})`,
          `HttpApiEndpoint.get("getUser", "/users/:id", { params: GetUserPathParams, query: GetUserQuery, headers: GetUserHeaders, success: GetUser200, error: HttpApiSchema.Empty(404) })`,
          `.annotate(OpenApi.Identifier, "getUser")`,
          `.annotate(OpenApi.Summary, "Get user")`,
          `.annotate(OpenApi.Description, "Read a user")`,
          `.annotate(OpenApi.Deprecated, true)`,
          `.annotate(OpenApi.ExternalDocs, {"url":"https://example.com/get-user"})`,
          `export class TestClient extends HttpApi.make("TestClient") {}`,
          `export const TestClientApi = TestClient`,
          `.annotate(OpenApi.Title, "Test API")`,
          `.annotate(OpenApi.Version, "1.0.0")`,
          `.annotate(OpenApi.Summary, "Summary")`,
          `.annotate(OpenApi.Description, "Description")`,
          `.add(UsersGroup)`
        ]
      ))

    it.effect("creates top-level fallback group for untagged operations", () =>
      assertHttpApiIncludes(
        {
          openapi: "3.1.0",
          info: {
            title: "Test API",
            version: "1.0.0"
          },
          paths: {
            "/health": {
              get: {
                operationId: "getHealth",
                parameters: [],
                responses: {
                  204: {
                    description: "No content"
                  }
                },
                tags: [] as any,
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
        },
        [
          `const DefaultGroup = HttpApiGroup.make("default", { topLevel: true })`,
          `HttpApiEndpoint.get("getHealth", "/health", { success: HttpApiSchema.Empty(204) })`,
          `.add(DefaultGroup)`
        ]
      ))

    it.effect("maps request and response encodings including optional request body approximation", () =>
      assertHttpApiIncludes(
        {
          openapi: "3.1.0",
          info: {
            title: "Test API",
            version: "1.0.0"
          },
          paths: {
            "/payload": {
              post: {
                operationId: "createPayload",
                parameters: [],
                requestBody: {
                  required: false,
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          a: { type: "string" }
                        },
                        required: ["a"],
                        additionalProperties: false
                      }
                    },
                    "multipart/form-data": {
                      schema: {
                        type: "object",
                        properties: {
                          file: { type: "string", format: "binary" }
                        },
                        required: ["file"],
                        additionalProperties: false
                      }
                    },
                    "application/x-www-form-urlencoded": {
                      schema: {
                        type: "object",
                        properties: {
                          form: { type: "string" }
                        },
                        required: ["form"],
                        additionalProperties: false
                      }
                    },
                    "text/plain": {
                      schema: {
                        type: "string"
                      }
                    },
                    "application/octet-stream": {
                      schema: {
                        type: "string",
                        format: "binary"
                      }
                    }
                  }
                } as any,
                responses: {
                  200: {
                    description: "Payload",
                    content: {
                      "application/json": {
                        schema: {
                          type: "object",
                          properties: {
                            ok: { type: "boolean" }
                          },
                          required: ["ok"],
                          additionalProperties: false
                        }
                      },
                      "text/plain": {
                        schema: {
                          type: "string"
                        }
                      },
                      "application/octet-stream": {
                        schema: {
                          type: "string",
                          format: "binary"
                        }
                      }
                    }
                  },
                  201: {
                    description: "Created"
                  }
                },
                tags: ["Payload"],
                security: []
              }
            }
          },
          components: {
            schemas: {},
            securitySchemes: {}
          },
          security: [],
          tags: [{ name: "Payload" }]
        },
        [
          `extends Schema.Class<CreatePayloadRequestJson>("CreatePayloadRequestJson")`,
          `extends Schema.Opaque<CreatePayloadRequestText>()(Schema.String)`,
          `payload: [HttpApiSchema.NoContent, CreatePayloadRequestJson, (CreatePayloadRequestFormData as any).pipe(HttpApiSchema.asMultipart()), (CreatePayloadRequestFormUrlEncoded as any).pipe(HttpApiSchema.asFormUrlEncoded()), (CreatePayloadRequestText as any).pipe(HttpApiSchema.asText()), (CreatePayloadRequestBinary as any).pipe(HttpApiSchema.asUint8Array())]`,
          `success: [CreatePayload200, (CreatePayload200Text as any).pipe(HttpApiSchema.asText()), (CreatePayload200Binary as any).pipe(HttpApiSchema.asUint8Array()), HttpApiSchema.Empty(201)]`
        ]
      ))
  })

  describe("regression", () => {
    it.effect("runtime output remains stable when using onWarning", () =>
      assertRuntimeStableWithWarnings(regressionSpec, [
        {
          code: "cookie-parameter-dropped",
          path: "/users/{id}",
          method: "get",
          operationId: "getUser"
        },
        {
          code: "default-response-remapped",
          path: "/users/{id}",
          method: "get",
          operationId: "getUser"
        }
      ]))

    it.effect("type-only output remains stable when using onWarning", () =>
      assertTypeOnlyStableWithWarnings(regressionSpec, [
        {
          code: "cookie-parameter-dropped",
          path: "/users/{id}",
          method: "get",
          operationId: "getUser"
        },
        {
          code: "default-response-remapped",
          path: "/users/{id}",
          method: "get",
          operationId: "getUser"
        }
      ]))
  })
})
