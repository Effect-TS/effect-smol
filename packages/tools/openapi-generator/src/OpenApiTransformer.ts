import * as Layer from "effect/Layer"
import * as Predicate from "effect/Predicate"
import * as ServiceMap from "effect/ServiceMap"
import type { OpenAPISpecMethodName } from "effect/unstable/httpapi/OpenApi"
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

export const makeTransformerSchema = () => {
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
    if (operation.params) {
      const key = `readonly params${operation.paramsOptional ? "?" : ""}`
      const type = `typeof ${operation.params}.Encoded${operation.paramsOptional ? " | undefined" : ""}`
      options.push(`${key}: ${type}`)
    }
    if (operation.payload) {
      const key = `readonly payload`
      const type = `typeof ${operation.payload}.Encoded`
      options.push(`${key}: ${type}`)
    }
    options.push("readonly config?: Config | undefined")

    // If all options are optional, the argument itself should be optional
    const hasOptions = (operation.params && !operation.paramsOptional) || operation.payload
    if (hasOptions) {
      args.push(`options: { ${options.join("; ")} }`)
    } else {
      args.push(`options: { ${options.join("; ")} } | undefined`)
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

    const jsdoc = Utils.toComment(operation.description)
    const methodKey = `readonly "${operation.id}"`
    const generic = `<Config extends OperationConfig>`
    const parameters = args.join(", ")
    const returnType = `Effect.Effect<WithOptionalResponse<${success}, Config>, ${errors.join(" | ")}>`
    return `${jsdoc}${methodKey}: ${generic}(${parameters}) => ${returnType}`
  }

  const operationsToImpl = (
    importName: string,
    name: string,
    operations: ReadonlyArray<ParsedOperation>
  ) =>
    `export interface OperationConfig {
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
    const args: Array<string> = [...operation.pathIds, "options"]
    const params = `${args.join(", ")}`

    const pipeline: Array<string> = []

    if (operation.params) {
      const paramsAccessor = resolveParamsAccessor(operation, "options", "params")

      if (operation.urlParams.length > 0) {
        const props = operation.urlParams.map(
          (param) => `"${param}": ${paramsAccessor}["${param}"] as any`
        )
        pipeline.push(`HttpClientRequest.setUrlParams({ ${props.join(", ")} })`)
      }
      if (operation.headers.length > 0) {
        const props = operation.headers.map(
          (param) => `"${param}": ${paramsAccessor}["${param}"] ?? undefined`
        )
        pipeline.push(`HttpClientRequest.setHeaders({ ${props.join(", ")} })`)
      }
    }

    const payloadVarName = "options.payload"
    if (operation.payloadFormData) {
      pipeline.push(`HttpClientRequest.bodyFormData(${payloadVarName} as any)`)
    } else if (operation.payload) {
      pipeline.push(`HttpClientRequest.bodyJsonUnsafe(${payloadVarName})`)
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

    const configAccessor = resolveConfigAccessor(operation, "options", "config")
    pipeline.push(`withResponse(${configAccessor})(HttpClientResponse.matchStatus({
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
        `import * as Data from "effect/Data"`,
        `import * as Effect from "effect/Effect"`,
        `import type { SchemaError } from "effect/Schema"`,
        `import * as ${importName} from "effect/Schema"`,
        `import type * as HttpClient from "effect/unstable/http/HttpClient"`,
        `import * as HttpClientError from "effect/unstable/http/HttpClientError"`,
        `import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"`,
        `import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"`
      ].join("\n"),
    toTypes: operationsToInterface,
    toImplementation: operationsToImpl
  })
}

export const layerTransformerSchema = Layer.sync(
  OpenApiTransformer,
  makeTransformerSchema
)

export const makeTransformerTs = () => {
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
      Utils.spreadElementsInto(operation.pathIds.map((id) => `${id}: string`), args)
    }

    const options: Array<string> = []
    if (operation.params) {
      const key = `readonly params${operation.paramsOptional ? "?" : ""}`
      const type = `${operation.params}${operation.paramsOptional ? " | undefined" : ""}`
      options.push(`${key}: ${type}`)
    }
    if (operation.payload) {
      options.push(`readonly payload: ${operation.payload}`)
    }
    options.push("readonly config?: Config | undefined")

    // If all options are optional, the argument itself should be optional
    const hasOptions = (operation.params && !operation.paramsOptional) || operation.payload
    if (hasOptions) {
      args.push(`options: { ${options.join("; ")} }`)
    } else {
      args.push(`options: { ${options.join("; ")} } | undefined`)
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

    const jsdoc = Utils.toComment(operation.description)
    const methodKey = `readonly "${operation.id}"`
    const generic = `<Config extends OperationConfig>`
    const parameters = args.join(", ")
    const returnType = `Effect.Effect<WithOptionalResponse<${success}, Config>, ${errors.join(" | ")}>`
    return `${jsdoc}${methodKey}: ${generic}(${parameters}) => ${returnType}`
  }

  const operationsToImpl = (
    _importName: string,
    name: string,
    operations: ReadonlyArray<ParsedOperation>
  ) =>
    `export interface OperationConfig {
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
    ${operations.map(operationToImpl).join(",\n  ")}
  }
}`

  const operationToImpl = (operation: ParsedOperation) => {
    const args: Array<string> = [...operation.pathIds, "options"]
    const params = `${args.join(", ")}`

    const pipeline: Array<string> = []

    if (operation.params) {
      const paramsAccessor = resolveParamsAccessor(operation, "options", "params")

      if (operation.urlParams.length > 0) {
        const props = operation.urlParams.map(
          (param) => `"${param}": ${paramsAccessor}["${param}"] as any`
        )
        pipeline.push(`HttpClientRequest.setUrlParams({ ${props.join(", ")} })`)
      }
      if (operation.headers.length > 0) {
        const props = operation.headers.map(
          (param) => `"${param}": ${paramsAccessor}["${param}"] ?? undefined`
        )
        pipeline.push(`HttpClientRequest.setHeaders({ ${props.join(", ")} })`)
      }
    }

    const payloadAccessor = "options.payload"
    if (operation.payloadFormData) {
      pipeline.push(`HttpClientRequest.bodyFormDataRecord(${payloadAccessor} as any)`)
    } else if (operation.payload) {
      pipeline.push(`HttpClientRequest.bodyJsonUnsafe(${payloadAccessor})`)
    }

    const successCodesRaw = Array.from(operation.successSchemas.keys())
    const successCodes = successCodesRaw
      .map((_) => JSON.stringify(_))
      .join(", ")
    const singleSuccessCode = successCodesRaw.length === 1 && successCodesRaw[0].startsWith("2")
    const errorCodes = operation.errorSchemas.size > 0 &&
      Object.fromEntries(operation.errorSchemas.entries())
    const configAccessor = resolveConfigAccessor(operation, "options", "config")
    pipeline.push(
      `onRequest(${configAccessor})([${singleSuccessCode ? `"2xx"` : successCodes}]${
        errorCodes ? `, ${JSON.stringify(errorCodes)}` : ""
      })`
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
        `import * as Data from "effect/Data"`,
        `import * as Effect from "effect/Effect"`,
        `import type * as HttpClient from "effect/unstable/http/HttpClient"`,
        `import * as HttpClientError from "effect/unstable/http/HttpClientError"`,
        `import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"`,
        `import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"`
      ].join("\n"),
    toTypes: operationsToInterface,
    toImplementation: operationsToImpl
  })
}

export const layerTransformerTs = Layer.sync(
  OpenApiTransformer,
  makeTransformerTs
)

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
  const withResponse = <Config extends OperationConfig>(config: Config | undefined) => <A, E>(
    f: (response: HttpClientResponse.HttpClientResponse) => Effect.Effect<A, E>,
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
  }`

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

const resolveConfigAccessor = (operation: ParsedOperation, rootKey: string, configKey: string): string => {
  // If an operation payload is defined, then the root object must exist
  if (Predicate.isNotUndefined(operation.payload)) {
    return `${rootKey}.${configKey}`
  }

  // If operation parameters are defined and non-optional, then the root object must exist
  if (Predicate.isNotUndefined(operation.params) && !operation.paramsOptional) {
    return `${rootKey}.${configKey}`
  }

  // User-specified arguments are allowed but are not required, so the root object is optional
  return `${rootKey}?.${configKey}`
}

const resolveParamsAccessor = (operation: ParsedOperation, rootKey: string, paramsKey: string): string => {
  // If an operation payload is not defined and parameters are optional, then the
  // root object may or may not exist and parameters must be marked as optional
  if (Predicate.isUndefined(operation.payload) && operation.paramsOptional) {
    return `${rootKey}?.${paramsKey}?.`
  }

  // If parameters are optional, they must be marked as optional
  if (operation.paramsOptional) {
    return `${rootKey}.${paramsKey}?.`
  }

  return `${rootKey}.${paramsKey}`
}
