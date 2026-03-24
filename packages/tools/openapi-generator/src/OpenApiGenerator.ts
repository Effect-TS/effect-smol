import * as Effect from "effect/Effect"
import type * as JsonSchema from "effect/JsonSchema"
import * as Layer from "effect/Layer"
import * as Predicate from "effect/Predicate"
import * as ServiceMap from "effect/ServiceMap"
import * as String from "effect/String"
import type { OpenAPISpec, OpenAPISpecMethodName } from "effect/unstable/httpapi/OpenApi"
import SwaggerToOpenApi from "swagger2openapi"
import * as HttpApiTransformer from "./HttpApiTransformer.ts"
import * as JsonSchemaGenerator from "./JsonSchemaGenerator.ts"
import * as OpenApiTransformer from "./OpenApiTransformer.ts"
import * as ParsedOperation from "./ParsedOperation.ts"
import * as Utils from "./Utils.ts"

export class OpenApiGenerator extends ServiceMap.Service<
  OpenApiGenerator,
  { readonly generate: (spec: OpenAPISpec, options: OpenApiGenerateOptions) => Effect.Effect<string> }
>()("OpenApiGenerator") {}

export type OpenApiGeneratorFormat = "httpclient" | "httpclient-type-only" | "httpapi"

export type OpenApiGeneratorWarningCode =
  | "cookie-parameter-dropped"
  | "additional-tags-dropped"
  | "sse-operation-skipped"
  | "response-headers-ignored"
  | "optional-request-body-approximated"
  | "default-response-remapped"
  | "security-and-downgraded"
  | "no-body-method-request-body-skipped"
  | "naming-collision"

export interface OpenApiGeneratorWarning {
  readonly code: OpenApiGeneratorWarningCode
  readonly message: string
  readonly path?: string | undefined
  readonly method?: OpenAPISpecMethodName | undefined
  readonly operationId?: string | undefined
}

export interface OpenApiGenerateOptions {
  /**
   * The name to give to the generated output.
   */
  readonly name: string
  /**
   * The output format to generate.
   */
  readonly format: OpenApiGeneratorFormat
  /**
   * Hook to transform each JSON Schema node before processing.
   */
  readonly onEnter?: ((js: JsonSchema.JsonSchema) => JsonSchema.JsonSchema) | undefined
  /**
   * Callback to receive non-fatal generation warnings.
   */
  readonly onWarning?: ((warning: OpenApiGeneratorWarning) => void) | undefined
}

const methodNames: ReadonlyArray<OpenAPISpecMethodName> = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace"
]

export const make = Effect.gen(function*() {
  const generate = Effect.fn(
    function*(spec: OpenAPISpec, options: OpenApiGenerateOptions) {
      const generator = JsonSchemaGenerator.make()
      const openApiTransformer = yield* OpenApiTransformer.OpenApiTransformer
      const emitWarning = makeWarningEmitter(options)

      // If we receive a Swagger 2.0 spec, convert it to an OpenApi 3.0 spec
      if (isSwaggerSpec(spec)) {
        spec = yield* convertSwaggerSpec(spec)
      }

      function resolveRef(ref: string) {
        const parts = ref.split("/").slice(1)
        let current: any = spec
        for (const part of parts) {
          current = current[part]
        }
        return current
      }

      const parsed = parseOpenApi(spec, generator, resolveRef, options.format, emitWarning)

      // TODO: make a CLI option ?
      const importName = "Schema"
      const source = getDialect(spec)
      const generation = options.format === "httpapi"
        ? generator.generateHttpApi(source, spec.components?.schemas ?? {}, { onEnter: options.onEnter })
        : generator.generate(
          source,
          spec.components?.schemas ?? {},
          options.format === "httpclient-type-only",
          {
            onEnter: options.onEnter
          }
        )

      if (options.format === "httpapi") {
        return String.stripMargin(
          `|${HttpApiTransformer.imports(importName)}
           |${generation}
           |${HttpApiTransformer.toImplementation(importName, options.name, parsed)}`
        )
      }

      return String.stripMargin(
        `|${openApiTransformer.imports(importName, parsed)}
         |${generation}
         |${openApiTransformer.toImplementation(importName, options.name, parsed)}
         |
         |${openApiTransformer.toTypes(importName, options.name, parsed)}`
      )
    },
    (effect, _, options) =>
      Effect.provideServiceEffect(
        effect,
        OpenApiTransformer.OpenApiTransformer,
        options.format === "httpclient-type-only"
          ? Effect.sync(OpenApiTransformer.makeTransformerTs)
          : Effect.sync(OpenApiTransformer.makeTransformerSchema)
      )
  )

  return { generate } as const
})

type WarningEmitter = (warning: OpenApiGeneratorWarning) => void

const makeWarningEmitter = (options: OpenApiGenerateOptions): WarningEmitter => (warning) => {
  options.onWarning?.(warning)
}

const parseOpenApi = (
  spec: OpenAPISpec,
  generator: ReturnType<typeof JsonSchemaGenerator.make>,
  resolveRef: (ref: string) => unknown,
  format: OpenApiGeneratorFormat,
  emitWarning: WarningEmitter
): ParsedOperation.ParsedOpenApi => {
  const operations: Array<ParsedOperation.ParsedOperation> = []
  const reservedSchemaNames = new Set<string>(Object.keys(spec.components?.schemas ?? {}))
  const isHttpApi = format === "httpapi"

  const addSchema = (
    baseName: string,
    schema: JsonSchema.JsonSchema,
    operation: ParsedOperation.ParsedOperation
  ): string => {
    let candidate = baseName
    let index = 2
    while (reservedSchemaNames.has(candidate)) {
      candidate = `${baseName}${index}`
      index += 1
    }
    if (candidate !== baseName) {
      warnForOperation(emitWarning, operation, {
        code: "naming-collision",
        message: `Schema name "${baseName}" collided with an existing name and was renamed to "${candidate}".`
      })
    }
    reservedSchemaNames.add(candidate)
    return generator.addSchema(candidate, schema)
  }

  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const method of methodNames) {
      const operation = methods[method]

      if (Predicate.isUndefined(operation)) {
        continue
      }

      const id = operation.operationId
        ? Utils.camelize(operation.operationId)
        : `${method.toUpperCase()}${path}`

      const description = Utils.nonEmptyString(operation.description) ?? Utils.nonEmptyString(operation.summary)

      const { pathIds, pathTemplate } = processPath(path)

      const op = ParsedOperation.makeDeepMutable({
        id,
        method,
        description,
        pathIds,
        pathTemplate
      })
      op.path = path
      op.operationId = Utils.nonEmptyString(operation.operationId)
      op.tags = [...(operation.tags ?? [])]
      op.metadata = {
        summary: Utils.nonEmptyString(operation.summary),
        description: Utils.nonEmptyString(operation.description),
        deprecated: operation.deprecated === true,
        externalDocs: operation.externalDocs
      }
      op.effectiveSecurity = cloneSecurityRequirements(operation.security ?? spec.security ?? [])

      const schemaId = Utils.identifier(operation.operationId ?? path)

      const parameters = (operation.parameters ?? []).map((parameter) => resolveReference(parameter, resolveRef))
      for (const parameter of parameters) {
        if (!isOpenApiParameter(parameter)) {
          continue
        }
        const parsedParameter: ParsedOperation.ParsedOperationParameter = {
          name: parameter.name,
          in: parameter.in,
          required: parameter.required === true,
          description: Utils.nonEmptyString(parameter.description),
          schema: parameter.schema
        }
        switch (parameter.in) {
          case "path": {
            op.parameters.path.push(parsedParameter)
            break
          }
          case "query": {
            op.parameters.query.push(parsedParameter)
            break
          }
          case "header": {
            op.parameters.header.push(parsedParameter)
            break
          }
          case "cookie": {
            op.parameters.cookie.push(parsedParameter)
            warnForOperation(emitWarning, op, {
              code: "cookie-parameter-dropped",
              message: `Cookie parameter "${parameter.name}" is ignored by the current HttpClient outputs.`
            })
            break
          }
        }
      }

      const validParameters = parameters.filter(
        (parameter): parameter is OpenApiParameter =>
          isOpenApiParameter(parameter) && parameter.in !== "path" && parameter.in !== "cookie"
      )

      const combinedParameterSchema = buildParameterSchema(validParameters, (parameter, added) => {
        if (parameter.in === "query") {
          Utils.spreadElementsInto(added, op.urlParams)
        } else if (parameter.in === "header") {
          Utils.spreadElementsInto(added, op.headers)
        } else if (parameter.in === "cookie") {
          Utils.spreadElementsInto(added, op.cookies)
        }
      })

      if (combinedParameterSchema !== undefined) {
        op.params = addSchema(`${schemaId}Params`, combinedParameterSchema.schema, op)
        op.paramsOptional = combinedParameterSchema.optional
      }

      if (isHttpApi) {
        const pathParameterSchema = buildParameterSchema(op.parameters.path)
        if (pathParameterSchema !== undefined) {
          op.pathSchema = addSchema(`${schemaId}PathParams`, pathParameterSchema.schema, op)
        }

        const queryParameterSchema = buildParameterSchema(op.parameters.query)
        if (queryParameterSchema !== undefined) {
          op.querySchema = addSchema(`${schemaId}Query`, queryParameterSchema.schema, op)
          op.querySchemaOptional = queryParameterSchema.optional
        }

        const headerParameterSchema = buildParameterSchema(op.parameters.header)
        if (headerParameterSchema !== undefined) {
          op.headersSchema = addSchema(`${schemaId}Headers`, headerParameterSchema.schema, op)
          op.headersSchemaOptional = headerParameterSchema.optional
        }
      }

      const requestBody = resolveReference(operation.requestBody, resolveRef)
      if (Predicate.isNotUndefined(requestBody) && Predicate.isObject(requestBody)) {
        const content = Predicate.isObject(requestBody.content)
          ? requestBody.content as Record<string, any>
          : {}
        const requestSchemaNames = new Map<string, string>()
        op.requestBody = {
          required: requestBody.required === true,
          contentTypes: Object.keys(content)
        }

        if (Predicate.isNotUndefined(content["application/json"]?.schema)) {
          op.payload = addSchema(`${schemaId}RequestJson`, content["application/json"].schema, op)
          requestSchemaNames.set("application/json", op.payload)
        }

        if (Predicate.isNotUndefined(content["multipart/form-data"]?.schema)) {
          op.payload = addSchema(`${schemaId}RequestFormData`, content["multipart/form-data"].schema, op)
          op.payloadFormData = true
          requestSchemaNames.set("multipart/form-data", op.payload)
        }

        if (isHttpApi) {
          const representableRequestBody: Array<ParsedOperation.ParsedOperationMediaTypeSchema> = []
          for (const [contentType, mediaType] of Object.entries(content)) {
            if (!Predicate.isObject(mediaType) || Predicate.isUndefined(mediaType.schema)) {
              continue
            }
            const encoding = getRequestMediaTypeEncoding(contentType)
            if (encoding === undefined) {
              continue
            }
            let schemaName = requestSchemaNames.get(contentType)
            if (schemaName === undefined) {
              schemaName = addSchema(
                `${schemaId}Request${mediaTypeToSuffix(contentType)}`,
                mediaType.schema as JsonSchema.JsonSchema,
                op
              )
              requestSchemaNames.set(contentType, schemaName)
            }
            representableRequestBody.push({
              contentType,
              encoding,
              schema: schemaName
            })
          }
          op.requestBodyRepresentable = representableRequestBody
        }
      }

      let defaultSchema: string | undefined
      for (const [status, responseValue] of Object.entries(operation.responses ?? {})) {
        const response = resolveReference(responseValue, resolveRef)
        if (!Predicate.isObject(response)) {
          continue
        }

        const content = Predicate.isObject(response.content)
          ? response.content as Record<string, any>
          : undefined
        const representable: Array<ParsedOperation.ParsedOperationMediaTypeSchema> = []

        let jsonSchemaName: string | undefined
        const jsonResponseSchema = content?.["application/json"]?.schema
        if (Predicate.isNotUndefined(jsonResponseSchema)) {
          jsonSchemaName = addSchema(`${schemaId}${status}`, jsonResponseSchema, op)
          if (isHttpApi) {
            representable.push({
              contentType: "application/json",
              encoding: "json",
              schema: jsonSchemaName
            })
          }
        }

        if (isHttpApi) {
          for (const [contentType, mediaType] of Object.entries(content ?? {})) {
            if (contentType === "application/json") {
              continue
            }
            if (!Predicate.isObject(mediaType) || Predicate.isUndefined(mediaType.schema)) {
              continue
            }
            const encoding = getResponseMediaTypeEncoding(contentType)
            if (encoding === undefined) {
              continue
            }
            const schemaName = addSchema(
              `${schemaId}${status}${mediaTypeToSuffix(contentType)}`,
              mediaType.schema as JsonSchema.JsonSchema,
              op
            )
            representable.push({
              contentType,
              encoding,
              schema: schemaName
            })
          }
        }

        const isEmptyResponse = Predicate.isUndefined(content) || Object.keys(content).length === 0
        const parsedResponse = {
          status,
          description: Utils.nonEmptyString(response.description),
          contentTypes: Predicate.isNotUndefined(content) ? Object.keys(content) : [],
          hasHeaders: Predicate.isNotUndefined(response.headers),
          isEmpty: isEmptyResponse,
          representable
        }
        op.responses.push(parsedResponse)
        if (status === "default") {
          op.defaultResponse = parsedResponse
        }

        if (Predicate.isNotUndefined(jsonSchemaName)) {
          const schemaName = jsonSchemaName

          if (status === "default") {
            defaultSchema = schemaName
            continue
          }

          const statusLower = status.toLowerCase()
          const statusMajorNumber = Number(status[0])
          if (Number.isNaN(statusMajorNumber)) {
            continue
          }
          if (statusMajorNumber < 4) {
            op.successSchemas.set(statusLower, schemaName)
          } else {
            op.errorSchemas.set(statusLower, schemaName)
          }
        }

        const sseResponseSchema = content?.["text/event-stream"]?.schema
        if (Predicate.isUndefined(op.sseSchema) && Predicate.isNotUndefined(sseResponseSchema)) {
          const statusMajorNumber = Number(status[0])
          if (!Number.isNaN(statusMajorNumber) && statusMajorNumber < 4) {
            op.sseSchema = addSchema(`${schemaId}${status}Sse`, sseResponseSchema, op)
          }
        }

        if (Predicate.isNotUndefined(content?.["application/octet-stream"])) {
          const statusMajorNumber = Number(status[0])
          if (!Number.isNaN(statusMajorNumber) && statusMajorNumber < 4) {
            op.binaryResponse = true
          }
        }

        if (isEmptyResponse) {
          if (status !== "default") {
            op.voidSchemas.add(status.toLowerCase())
          }
        }
      }

      if (!isHttpApi && op.successSchemas.size === 0 && Predicate.isNotUndefined(defaultSchema)) {
        op.successSchemas.set("2xx", defaultSchema)
        warnForOperation(emitWarning, op, {
          code: "default-response-remapped",
          message: "Default response was remapped to 2xx for the current HttpClient outputs."
        })
      }

      operations.push(op)
    }
  }

  return {
    metadata: {
      title: spec.info.title,
      version: spec.info.version,
      summary: Utils.nonEmptyString(spec.info.summary),
      description: Utils.nonEmptyString(spec.info.description),
      license: spec.info.license,
      servers: spec.servers
    },
    tags: (spec.tags ?? []).map((tag) => ({
      name: tag.name,
      description: Utils.nonEmptyString(tag.description),
      externalDocs: tag.externalDocs
    })),
    operations
  }
}

interface OpenApiParameter {
  readonly name: string
  readonly in: "path" | "query" | "header" | "cookie"
  readonly required: boolean
  readonly schema: {}
  readonly description?: string | undefined
}

const isOpenApiParameter = (parameter: unknown): parameter is OpenApiParameter => {
  if (!Predicate.isObject(parameter)) {
    return false
  }
  return (
    typeof parameter.name === "string" &&
    (parameter.in === "path" || parameter.in === "query" || parameter.in === "header" || parameter.in === "cookie")
  )
}

const buildParameterSchema = <
  Parameter extends {
    readonly name: string
    readonly required: boolean
    readonly schema: {}
    readonly in?: "path" | "query" | "header" | "cookie" | undefined
  }
>(
  parameters: ReadonlyArray<Parameter>,
  onAdded?: ((parameter: Parameter, added: Array<string>) => void) | undefined
): {
  readonly schema: JsonSchema.JsonSchema
  readonly optional: boolean
} | undefined => {
  if (parameters.length === 0) {
    return
  }

  const schema = {
    type: "object" as JsonSchema.Type,
    properties: {} as Record<string, JsonSchema.JsonSchema>,
    required: [] as Array<string>,
    additionalProperties: false
  }

  for (const parameter of parameters) {
    const paramSchema = parameter.schema as any
    const added: Array<string> = []
    if (
      Predicate.isObject(paramSchema) &&
      "properties" in paramSchema &&
      Predicate.isObject(paramSchema.properties)
    ) {
      const required = "required" in paramSchema
        ? paramSchema.required as Array<string>
        : []

      for (const [name, propertySchema] of Object.entries(paramSchema.properties)) {
        const adjustedName = `${parameter.name}[${name}]`
        schema.properties[adjustedName] = propertySchema as JsonSchema.JsonSchema
        if (required.includes(name)) {
          schema.required.push(adjustedName)
        }
        added.push(adjustedName)
      }
    } else {
      schema.properties[parameter.name] = parameter.schema as JsonSchema.JsonSchema
      if (parameter.required) {
        schema.required.push(parameter.name)
      }
      added.push(parameter.name)
    }

    onAdded?.(parameter, added)
  }

  return {
    schema,
    optional: schema.required.length === 0
  }
}

const mediaTypeToSuffix = (contentType: string): string => {
  const normalized = contentType.toLowerCase()
  switch (normalized) {
    case "application/json":
      return "Json"
    case "multipart/form-data":
      return "FormData"
    case "application/x-www-form-urlencoded":
      return "FormUrlEncoded"
    case "text/plain":
      return "Text"
    case "application/octet-stream":
      return "Binary"
  }
  const suffix = Utils.identifier(contentType)
  return suffix.length > 0 ? suffix : "Body"
}

const isJsonMediaType = (contentType: string): boolean =>
  contentType === "application/json" ||
  (contentType.startsWith("application/") && contentType.endsWith("+json"))

const isTextMediaType = (contentType: string): boolean => contentType.startsWith("text/")

const isBinaryMediaType = (contentType: string): boolean =>
  contentType === "application/octet-stream" ||
  (contentType.startsWith("application/") && (contentType.includes("binary") || contentType.endsWith("+octet-stream")))

const getRequestMediaTypeEncoding = (
  contentType: string
): ParsedOperation.ParsedOperationMediaTypeEncoding | undefined => {
  const normalized = contentType.toLowerCase()
  if (isJsonMediaType(normalized)) {
    return "json"
  }
  if (normalized === "multipart/form-data") {
    return "multipart"
  }
  if (normalized === "application/x-www-form-urlencoded") {
    return "form-url-encoded"
  }
  if (isTextMediaType(normalized)) {
    return "text"
  }
  if (isBinaryMediaType(normalized)) {
    return "binary"
  }
  return
}

const getResponseMediaTypeEncoding = (
  contentType: string
): ParsedOperation.ParsedOperationMediaTypeEncoding | undefined => {
  const normalized = contentType.toLowerCase()
  if (isJsonMediaType(normalized)) {
    return "json"
  }
  if (normalized === "application/x-www-form-urlencoded") {
    return "form-url-encoded"
  }
  if (isTextMediaType(normalized)) {
    return "text"
  }
  if (isBinaryMediaType(normalized)) {
    return "binary"
  }
  return
}

const resolveReference = (input: unknown, resolveRef: (ref: string) => unknown): any => {
  let current = input
  while (Predicate.isObject(current) && typeof current.$ref === "string") {
    current = resolveRef(current.$ref)
  }
  return current
}

const cloneSecurityRequirements = (
  security: ReadonlyArray<Record<string, ReadonlyArray<string>>>
): Array<ParsedOperation.ParsedOperationSecurityRequirement> =>
  security.map((requirement) =>
    Object.fromEntries(
      Object.entries(requirement).map(([name, scopes]) => [name, [...scopes]])
    )
  )

const warnForOperation = (
  emitWarning: WarningEmitter,
  operation: ParsedOperation.ParsedOperation,
  warning: {
    readonly code: OpenApiGeneratorWarningCode
    readonly message: string
  }
): void => {
  emitWarning({
    ...warning,
    path: operation.path,
    method: operation.method,
    operationId: operation.operationId
  })
}

function getDialect(spec: OpenAPISpec): "openapi-3.0" | "openapi-3.1" {
  return spec.openapi.trim().startsWith("3.0") ? "openapi-3.0" : "openapi-3.1"
}

export const layerTransformerSchema: Layer.Layer<OpenApiGenerator> = Layer.effect(OpenApiGenerator, make)

export const layerTransformerTs: Layer.Layer<OpenApiGenerator> = Layer.effect(OpenApiGenerator, make)

const isSwaggerSpec = (spec: OpenAPISpec) => "swagger" in spec

const convertSwaggerSpec = Effect.fn((spec: OpenAPISpec) =>
  Effect.callback<OpenAPISpec>((resume) => {
    SwaggerToOpenApi.convertObj(
      spec as any,
      { laxDefaults: true, laxurls: true, patch: true, warnOnly: true },
      (err, result) => {
        if (err) {
          resume(Effect.die(err))
        } else {
          resume(Effect.succeed(result.openapi as any))
        }
      }
    )
  }).pipe(Effect.withSpan("OpenApi.convertSwaggerSpec"))
)

const processPath = (path: string): {
  readonly pathIds: Array<string>
  readonly pathTemplate: string
} => {
  const pathIds: Array<string> = []
  path = path.replace(/{([^}]+)}/g, (_, name) => {
    const id = Utils.camelize(name)
    pathIds.push(id)
    return "${" + id + "}"
  })
  const pathTemplate = "`" + path + "`"
  return { pathIds, pathTemplate } as const
}
