import * as Layer from "effect/Layer"
import * as ServiceMap from "effect/ServiceMap"
import type { OpenAPISpecMethodName } from "effect/unstable/httpapi/OpenApi"
import * as JsonSchemaTransformer from "./JsonSchemaTransformer.ts"
import type { ParsedOperation } from "./ParsedOperation.ts"
import * as Utils from "./Utils.ts"

export class OpenApiTransformer extends ServiceMap.Service<
  OpenApiTransformer,
  {
    readonly imports: (importName: string) => string
    readonly toTypes: (importName: string, name: string, operations: ReadonlyArray<ParsedOperation>) => string
    readonly toImplementation: (importName: string, name: string, operations: ReadonlyArray<ParsedOperation>) => string
  }
>()("OpenApiTransformer") {}

const httpClientMethodNames: Record<OpenAPISpecMethodName, string> = {
  get: "get",
  put: "put",
  post: "post",
  delete: "del",
  options: "options",
  head: "head",
  patch: "patch",
  trace: `make("TRACE")`
}

export const layerTransformerSchema = Layer.sync(OpenApiTransformer, () => {
  const operationsToInterface = (
    _importName: string,
    name: string,
    operations: ReadonlyArray<ParsedOperation>
  ) =>
    `export interface ${name} {
  readonly httpClient: HttpClient.HttpClient
  ${operations.map((op) => operationToMethod(name, op)).join("\n  ")}
}

${clientErrorSource(name)}`

  const operationToMethod = (name: string, operation: ParsedOperation) => {
    const args: Array<string> = []
    if (operation.pathIds.length > 0) {
      Utils.spreadElementsInto(operation.pathIds.map((id) => `${id}: string`), args)
    }
    const options: Array<string> = []
    if (operation.params && !operation.payload) {
      args.push(
        `options${operation.paramsOptional ? "?" : ""}: typeof ${operation.params}.Encoded${
          operation.paramsOptional ? " | undefined" : ""
        }`
      )
    } else if (operation.params) {
      options.push(
        `readonly params${operation.paramsOptional ? "?" : ""}: typeof ${operation.params}.Encoded${
          operation.paramsOptional ? " | undefined" : ""
        }`
      )
    }
    if (operation.payload) {
      const type = `typeof ${operation.payload}.Encoded`
      if (!operation.params) {
        args.push(`options: ${type}`)
      } else {
        options.push(`readonly payload: ${type}`)
      }
    }
    if (options.length > 0) {
      args.push(`options: { ${options.join("; ")} }`)
    }
    let success = "void"
    if (operation.successSchemas.size > 0) {
      success = Array.from(operation.successSchemas.values())
        .map((schema) => `typeof ${schema}.Type`)
        .join(" | ")
    }
    const errors = ["HttpClientError.HttpClientError", "SchemaError"]
    if (operation.errorSchemas.size > 0) {
      Utils.spreadElementsInto(
        Array.from(operation.errorSchemas.values()).map(
          (schema) => `${name}Error<"${schema}", typeof ${schema}.Type>`
        ),
        errors
      )
    }
    return `${Utils.toComment(operation.description)}readonly "${operation.id}": (${
      args.join(", ")
    }) => Effect.Effect<${success}, ${errors.join(" | ")}>`
  }

  const operationsToImpl = (
    importName: string,
    name: string,
    operations: ReadonlyArray<ParsedOperation>
  ) =>
    `export const make = (
  httpClient: HttpClient.HttpClient, 
  options: {
    readonly transformClient?: ((client: HttpClient.HttpClient) => Effect.Effect<HttpClient.HttpClient>) | undefined
  } = {}
): ${name} => {
  ${commonSource}
  const decodeSuccess =
    <Schema extends ${importName}.Top>(schema: Schema) =>
    (response: HttpClientResponse.HttpClientResponse) =>
      HttpClientResponse.schemaBodyJson(schema)(response)
  const decodeError =
    <const Tag extends string, Schema extends ${importName}.Top>(tag: Tag, schema: Schema) =>
    (response: HttpClientResponse.HttpClientResponse) =>
      Effect.flatMap(
        HttpClientResponse.schemaBodyJson(schema)(response),
        (cause) => Effect.fail(${name}Error(tag, cause, response)),
      )
  return {
    httpClient,
    ${operations.map(operationToImpl).join(",\n  ")}
  }
}`

  const operationToImpl = (operation: ParsedOperation) => {
    const args: Array<string> = [...operation.pathIds]
    const hasOptions = operation.params || operation.payload
    if (hasOptions) {
      args.push("options")
    }
    const params = `${args.join(", ")}`

    const pipeline: Array<string> = []

    if (operation.params) {
      const varName = operation.payload ? "options.params?." : "options?."
      if (operation.urlParams.length > 0) {
        const props = operation.urlParams.map(
          (param) => `"${param}": ${varName}["${param}"] as any`
        )
        pipeline.push(`HttpClientRequest.setUrlParams({ ${props.join(", ")} })`)
      }
      if (operation.headers.length > 0) {
        const props = operation.headers.map(
          (param) => `"${param}": ${varName}["${param}"] ?? undefined`
        )
        pipeline.push(`HttpClientRequest.setHeaders({ ${props.join(", ")} })`)
      }
    }

    const payloadVarName = operation.params ? "options.payload" : "options"
    if (operation.payloadFormData) {
      pipeline.push(
        `HttpClientRequest.bodyFormDataRecord(${payloadVarName} as any)`
      )
    } else if (operation.payload) {
      pipeline.push(`HttpClientRequest.bodyUnsafeJson(${payloadVarName})`)
    }

    const decodes: Array<string> = []
    const singleSuccessCode = operation.successSchemas.size === 1
    operation.successSchemas.forEach((schema, status) => {
      const statusCode = singleSuccessCode && status.startsWith("2") ? "2xx" : status
      decodes.push(`"${statusCode}": decodeSuccess(${schema})`)
    })
    operation.errorSchemas.forEach((schema, status) => {
      decodes.push(`"${status}": decodeError("${schema}", ${schema})`)
    })
    operation.voidSchemas.forEach((status) => {
      decodes.push(`"${status}": () => Effect.void`)
    })
    decodes.push(`orElse: unexpectedStatus`)

    pipeline.push(`withResponse(HttpClientResponse.matchStatus({
      ${decodes.join(",\n      ")}
    }))`)

    return (
      `"${operation.id}": (${params}) => ` +
      `HttpClientRequest.${httpClientMethodNames[operation.method]}(${operation.pathTemplate})` +
      `.pipe(\n    ${pipeline.join(",\n    ")}\n  )`
    )
  }

  return OpenApiTransformer.of({
    imports: (importName) =>
      [
        `import * as Data from "effect/data/Data"`,
        `import * as Effect from "effect/Effect"`,
        `import type { SchemaError } from "effect/schema/Schema"`,
        `import * as ${importName} from "effect/schema/Schema"`,
        `import type * as HttpClient from "effect/unstable/http/HttpClient"`,
        `import * as HttpClientError from "effect/unstable/http/HttpClientError"`,
        `import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"`,
        `import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"`
      ].join("\n"),
    toTypes: operationsToInterface,
    toImplementation: operationsToImpl
  })
}).pipe(Layer.merge(JsonSchemaTransformer.layerTransformerSchema))

export const layerTransformerTs = Layer.sync(OpenApiTransformer, () => {
  const operationsToInterface = (
    _importName: string,
    name: string,
    operations: ReadonlyArray<ParsedOperation>
  ) =>
    `export interface ${name} {
  readonly httpClient: HttpClient.HttpClient
  ${operations.map((s) => operationToMethod(name, s)).join("\n  ")}
}

${clientErrorSource(name)}`

  const operationToMethod = (name: string, operation: ParsedOperation) => {
    const args: Array<string> = []
    if (operation.pathIds.length > 0) {
      // eslint-disable-next-line no-restricted-syntax
      args.push(...operation.pathIds.map((id) => `${id}: string`))
    }
    const options: Array<string> = []
    if (operation.params && !operation.payload) {
      args.push(
        `options${operation.paramsOptional ? "?" : ""}: ${operation.params}${
          operation.paramsOptional ? " | undefined" : ""
        }`
      )
    } else if (operation.params) {
      options.push(
        `readonly params${operation.paramsOptional ? "?" : ""}: ${operation.params}${
          operation.paramsOptional ? " | undefined" : ""
        }`
      )
    }
    if (operation.payload) {
      const type = operation.payload
      if (!operation.params) {
        args.push(`options: ${type}`)
      } else {
        options.push(`readonly payload: ${type}`)
      }
    }
    if (options.length > 0) {
      args.push(`options: { ${options.join("; ")} }`)
    }
    let success = "void"
    if (operation.successSchemas.size > 0) {
      success = Array.from(operation.successSchemas.values()).join(" | ")
    }
    const errors = ["HttpClientError.HttpClientError"]
    if (operation.errorSchemas.size > 0) {
      for (const schema of operation.errorSchemas.values()) {
        errors.push(`${name}Error<"${schema}", ${schema}>`)
      }
    }
    return `${Utils.toComment(operation.description)}readonly "${operation.id}": (${
      args.join(", ")
    }) => Effect.Effect<${success}, ${errors.join(" | ")}>`
  }

  const operationsToImpl = (
    _importName: string,
    name: string,
    operations: ReadonlyArray<ParsedOperation>
  ) =>
    `export const make = (
  httpClient: HttpClient.HttpClient, 
  options: {
    readonly transformClient?: ((client: HttpClient.HttpClient) => Effect.Effect<HttpClient.HttpClient>) | undefined
  } = {}
): ${name} => {
  ${commonSource}
  const decodeSuccess = <A>(response: HttpClientResponse.HttpClientResponse) =>
    response.json as Effect.Effect<A, HttpClientError.ResponseError>
  const decodeVoid = (_response: HttpClientResponse.HttpClientResponse) =>
    Effect.void
  const decodeError =
    <Tag extends string, E>(tag: Tag) =>
    (
      response: HttpClientResponse.HttpClientResponse,
    ): Effect.Effect<
      never,
      ${name}Error<Tag, E> | HttpClientError.ResponseError
    > =>
      Effect.flatMap(
        response.json as Effect.Effect<E, HttpClientError.ResponseError>,
        (cause) => Effect.fail(${name}Error(tag, cause, response)),
      )
  const onRequest = (
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
    return withResponse(HttpClientResponse.matchStatus(cases) as any)
  }
  return {
    httpClient,
    ${operations.map(operationToImpl).join(",\n  ")}
  }
}`

  const operationToImpl = (operation: ParsedOperation) => {
    const args: Array<string> = [...operation.pathIds]
    const hasOptions = operation.params || operation.payload
    if (hasOptions) {
      args.push("options")
    }
    const params = `${args.join(", ")}`

    const pipeline: Array<string> = []

    if (operation.params) {
      const varName = operation.payload ? "options.params?." : "options?."
      if (operation.urlParams.length > 0) {
        const props = operation.urlParams.map(
          (param) => `"${param}": ${varName}["${param}"] as any`
        )
        pipeline.push(`HttpClientRequest.setUrlParams({ ${props.join(", ")} })`)
      }
      if (operation.headers.length > 0) {
        const props = operation.headers.map(
          (param) => `"${param}": ${varName}["${param}"] ?? undefined`
        )
        pipeline.push(`HttpClientRequest.setHeaders({ ${props.join(", ")} })`)
      }
    }

    const payloadVarName = operation.params ? "options.payload" : "options"
    if (operation.payloadFormData) {
      pipeline.push(
        `HttpClientRequest.bodyFormDataRecord(${payloadVarName} as any)`
      )
    } else if (operation.payload) {
      pipeline.push(`HttpClientRequest.bodyUnsafeJson(${payloadVarName})`)
    }

    const successCodesRaw = Array.from(operation.successSchemas.keys())
    const successCodes = successCodesRaw
      .map((_) => JSON.stringify(_))
      .join(", ")
    const singleSuccessCode = successCodesRaw.length === 1 && successCodesRaw[0].startsWith("2")
    const errorCodes = operation.errorSchemas.size > 0 &&
      Object.fromEntries(operation.errorSchemas.entries())
    pipeline.push(
      `onRequest([${singleSuccessCode ? `"2xx"` : successCodes}]${errorCodes ? `, ${JSON.stringify(errorCodes)}` : ""})`
    )

    return (
      `"${operation.id}": (${params}) => ` +
      `HttpClientRequest.${httpClientMethodNames[operation.method]}(${operation.pathTemplate})` +
      `.pipe(\n    ${pipeline.join(",\n    ")}\n  )`
    )
  }

  return OpenApiTransformer.of({
    imports: (_importName) =>
      [
        `import * as Data from "effect/data/Data"`,
        `import * as Effect from "effect/Effect"`,
        `import type * as HttpClient from "effect/unstable/http/HttpClient"`,
        `import * as HttpClientError from "effect/unstable/http/HttpClientError"`,
        `import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"`,
        `import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"`
      ].join("\n"),
    toTypes: operationsToInterface,
    toImplementation: operationsToImpl
  })
}).pipe(Layer.merge(JsonSchemaTransformer.layerTransformerTs))

const commonSource = `const unexpectedStatus = (response: HttpClientResponse.HttpClientResponse) =>
    Effect.flatMap(
      Effect.orElseSucceed(response.json, () => "Unexpected status code"),
      (description) =>
        Effect.fail(
          new HttpClientError.ResponseError({
            request: response.request,
            response,
            reason: "StatusCode",
            description: typeof description === "string" ? description : JSON.stringify(description),
          }),
        ),
    )
  const withResponse: <A, E>(
    f: (response: HttpClientResponse.HttpClientResponse) => Effect.Effect<A, E>,
  ) => (
    request: HttpClientRequest.HttpClientRequest,
  ) => Effect.Effect<any, any> = options.transformClient
    ? (f) => (request) =>
        Effect.flatMap(
          Effect.flatMap(options.transformClient!(httpClient), (client) =>
            client.execute(request),
          ),
          f,
        )
    : (f) => (request) => Effect.flatMap(httpClient.execute(request), f)`

const clientErrorSource = (
  name: string
) =>
  `export interface ${name}Error<Tag extends string, E> {
  readonly _tag: Tag
  readonly request: HttpClientRequest.HttpClientRequest
  readonly response: HttpClientResponse.HttpClientResponse
  readonly cause: E
}

class ${name}ErrorImpl extends Data.Error<{
  _tag: string
  cause: any
  request: HttpClientRequest.HttpClientRequest
  response: HttpClientResponse.HttpClientResponse
}> {}

export const ${name}Error = <Tag extends string, E>(
  tag: Tag,
  cause: E,
  response: HttpClientResponse.HttpClientResponse,
): ${name}Error<Tag, E> =>
  new ${name}ErrorImpl({
    _tag: tag,
    cause,
    response,
    request: response.request,
  }) as any`
