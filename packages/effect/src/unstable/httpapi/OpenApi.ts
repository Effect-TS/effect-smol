/**
 * @since 4.0.0
 */
import type { NonEmptyArray } from "../../Array.ts"
import * as Equal from "../../Equal.ts"
import { constFalse } from "../../Function.ts"
import * as JsonSchema from "../../JsonSchema.ts"
import * as Option from "../../Option.ts"
import * as Schema from "../../Schema.ts"
import type * as AST from "../../SchemaAST.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as HttpMethod from "../http/HttpMethod.ts"
import * as HttpApi from "./HttpApi.ts"
import type * as HttpApiGroup from "./HttpApiGroup.ts"
import * as HttpApiMiddleware from "./HttpApiMiddleware.ts"
import * as HttpApiSchema from "./HttpApiSchema.ts"
import type { HttpApiSecurity } from "./HttpApiSecurity.ts"

/**
 * @since 4.0.0
 * @category annotations
 */
export class Identifier extends ServiceMap.Service<Identifier, string>()("effect/httpapi/OpenApi/Identifier") {}

/**
 * @since 4.0.0
 * @category annotations
 */
export class Title extends ServiceMap.Service<Title, string>()("effect/httpapi/OpenApi/Title") {}

/**
 * @since 4.0.0
 * @category annotations
 */
export class Version extends ServiceMap.Service<Version, string>()("effect/httpapi/OpenApi/Version") {}

/**
 * @since 4.0.0
 * @category annotations
 */
export class Description extends ServiceMap.Service<Description, string>()("effect/httpapi/OpenApi/Description") {}

/**
 * @since 4.0.0
 * @category annotations
 */
export class License extends ServiceMap.Service<License, OpenAPISpecLicense>()("effect/httpapi/OpenApi/License") {}

/**
 * @since 4.0.0
 * @category annotations
 */
export class ExternalDocs
  extends ServiceMap.Service<ExternalDocs, OpenAPISpecExternalDocs>()("effect/httpapi/OpenApi/ExternalDocs")
{}

/**
 * @since 4.0.0
 * @category annotations
 */
export class Servers
  extends ServiceMap.Service<Servers, ReadonlyArray<OpenAPISpecServer>>()("effect/httpapi/OpenApi/Servers")
{}

/**
 * @since 4.0.0
 * @category annotations
 */
export class Format extends ServiceMap.Service<Format, string>()("effect/httpapi/OpenApi/Format") {}

/**
 * @since 4.0.0
 * @category annotations
 */
export class Summary extends ServiceMap.Service<Summary, string>()("effect/httpapi/OpenApi/Summary") {}

/**
 * @since 4.0.0
 * @category annotations
 */
export class Deprecated extends ServiceMap.Service<Deprecated, boolean>()("effect/httpapi/OpenApi/Deprecated") {}

/**
 * @since 4.0.0
 * @category annotations
 */
export class Override
  extends ServiceMap.Service<Override, Record<string, unknown>>()("effect/httpapi/OpenApi/Override")
{}

/**
 * @since 4.0.0
 * @category annotations
 */
export const Exclude = ServiceMap.Reference<boolean>("effect/httpapi/OpenApi/Exclude", {
  defaultValue: constFalse
})

/**
 * Transforms the generated OpenAPI specification
 *
 * @since 4.0.0
 * @category annotations
 */
export class Transform extends ServiceMap.Service<
  Transform,
  (openApiSpec: Record<string, any>) => Record<string, any>
>()("effect/httpapi/OpenApi/Transform") {}

const servicesPartial = <Tags extends Record<string, ServiceMap.Service<any, any> | ServiceMap.Service<never, any>>>(
  tags: Tags
): (
  options: {
    readonly [K in keyof Tags]?: ServiceMap.Service.Shape<Tags[K]> | undefined
  }
) => ServiceMap.ServiceMap<never> => {
  const entries = Object.entries(tags)
  return (options) => {
    let context = ServiceMap.empty()
    for (const [key, tag] of entries) {
      if (options[key] !== undefined) {
        context = ServiceMap.add(context, tag as any, options[key]!)
      }
    }
    return context
  }
}

/**
 * @since 4.0.0
 * @category annotations
 */
export const annotations: (
  options: {
    readonly identifier?: string | undefined
    readonly title?: string | undefined
    readonly version?: string | undefined
    readonly description?: string | undefined
    readonly license?: OpenAPISpecLicense | undefined
    readonly summary?: string | undefined
    readonly deprecated?: boolean | undefined
    readonly externalDocs?: OpenAPISpecExternalDocs | undefined
    readonly servers?: ReadonlyArray<OpenAPISpecServer> | undefined
    readonly format?: string | undefined
    readonly override?: Record<string, unknown> | undefined
    readonly exclude?: boolean | undefined
    readonly transform?: ((openApiSpec: Record<string, any>) => Record<string, any>) | undefined
  }
) => ServiceMap.ServiceMap<never> = servicesPartial({
  identifier: Identifier,
  title: Title,
  version: Version,
  description: Description,
  license: License,
  summary: Summary,
  deprecated: Deprecated,
  externalDocs: ExternalDocs,
  servers: Servers,
  format: Format,
  override: Override,
  exclude: Exclude,
  transform: Transform
})

const apiCache = new WeakMap<HttpApi.Any, OpenAPISpec>()

/**
 * This function checks if a given tag exists within the provided context. If
 * the tag is present, it retrieves the associated value and applies the given
 * callback function to it. If the tag is not found, the function does nothing.
 */
function processAnnotation<Services, S, I>(
  ctx: ServiceMap.ServiceMap<Services>,
  annotation: ServiceMap.Service<I, S>,
  f: (s: S) => void
) {
  const o = ServiceMap.getOption(ctx, annotation)
  if (Option.isSome(o)) {
    f(o.value)
  }
}

/**
 * Converts an `HttpApi` instance into an OpenAPI Specification object.
 *
 * **Details**
 *
 * This function takes an `HttpApi` instance, which defines a structured API,
 * and generates an OpenAPI Specification (`OpenAPISpec`). The resulting spec
 * adheres to the OpenAPI 3.1.0 standard and includes detailed metadata such as
 * paths, operations, security schemes, and components. The function processes
 * the API's annotations, middleware, groups, and endpoints to build a complete
 * and accurate representation of the API in OpenAPI format.
 *
 * The function also deduplicates schemas, applies transformations, and
 * integrates annotations like descriptions, summaries, external documentation,
 * and overrides. Cached results are used for better performance when the same
 * `HttpApi` instance is processed multiple times.
 *
 * **Options**
 *
 * - `additionalPropertiesStrategy`: Controls the handling of additional properties. Possible values are:
 *   - `"strict"`: Disallow additional properties (default behavior).
 *   - `"allow"`: Allow additional properties.
 *
 * @category constructors
 * @since 4.0.0
 */
export const fromApi = <Id extends string, Groups extends HttpApiGroup.Any>(
  api: HttpApi.HttpApi<Id, Groups>,
  options?: {
    readonly additionalProperties?: true | false | JsonSchema.JsonSchema | undefined
  } | undefined
): OpenAPISpec => {
  const cached = apiCache.get(api)
  if (cached !== undefined) {
    return cached
  }
  const jsonSchemaDefs: JsonSchema.Definitions = {}
  let spec: OpenAPISpec = {
    openapi: "3.1.0",
    info: {
      title: ServiceMap.getOrElse(api.annotations, Title, () => "Api"),
      version: ServiceMap.getOrElse(api.annotations, Version, () => "0.0.1")
    },
    paths: {},
    components: {
      schemas: jsonSchemaDefs,
      securitySchemes: {}
    },
    security: [],
    tags: []
  }

  function processAST(ast: AST.AST): JsonSchema.JsonSchema {
    const document = JsonSchema.toDocumentOpenApi3_1(Schema.toJsonSchemaDocument(Schema.make(ast), {
      additionalProperties: options?.additionalProperties,
      referenceStrategy: "skip-top-level"
    }))
    for (const [key, definition] of Object.entries(document.definitions)) {
      const existing = jsonSchemaDefs[key]
      if (existing !== undefined && !Equal.equals(existing, definition)) {
        throw new globalThis.Error(`Duplicate identifier: ${key}`)
      } else {
        jsonSchemaDefs[key] = definition
      }
    }
    return document.schema
  }

  function processHttpApiSecurity(
    name: string,
    security: HttpApiSecurity
  ) {
    if (spec.components.securitySchemes[name] !== undefined) {
      return
    }
    spec.components.securitySchemes[name] = makeSecurityScheme(security)
  }

  processAnnotation(api.annotations, HttpApi.AdditionalSchemas, (componentSchemas) => {
    componentSchemas.forEach((componentSchema) => processAST(componentSchema.ast))
  })
  processAnnotation(api.annotations, Description, (description) => {
    spec.info.description = description
  })
  processAnnotation(api.annotations, License, (license) => {
    spec.info.license = license
  })
  processAnnotation(api.annotations, Summary, (summary) => {
    spec.info.summary = summary
  })
  processAnnotation(api.annotations, Servers, (servers) => {
    spec.servers = [...servers]
  })

  HttpApi.reflect(api, {
    onGroup({ group }) {
      if (ServiceMap.get(group.annotations, Exclude)) {
        return
      }
      let tag: OpenAPISpecTag = {
        name: ServiceMap.getOrElse(group.annotations, Title, () => group.identifier)
      }
      processAnnotation(group.annotations, Description, (description) => {
        tag.description = description
      })
      processAnnotation(group.annotations, ExternalDocs, (externalDocs) => {
        tag.externalDocs = externalDocs
      })
      processAnnotation(group.annotations, Override, (override) => {
        Object.assign(tag, override)
      })
      processAnnotation(group.annotations, Transform, (transformFn) => {
        tag = transformFn(tag) as OpenAPISpecTag
      })

      spec.tags.push(tag)
    },
    onEndpoint({ endpoint, errors, group, mergedAnnotations, middleware, payloads, successes }) {
      if (ServiceMap.get(mergedAnnotations, Exclude)) {
        return
      }
      let op: OpenAPISpecOperation = {
        tags: [ServiceMap.getOrElse(group.annotations, Title, () => group.identifier)],
        operationId: ServiceMap.getOrElse(
          endpoint.annotations,
          Identifier,
          () => group.topLevel ? endpoint.name : `${group.identifier}.${endpoint.name}`
        ),
        parameters: [],
        security: [],
        responses: {}
      }

      function processResponseMap(
        map: ReadonlyMap<number, {
          readonly ast: AST.AST | undefined
          readonly description: string | undefined
        }>,
        defaultDescription: () => string
      ) {
        for (const [status, { ast, description }] of map) {
          if (op.responses[status]) continue
          op.responses[status] = {
            description: description ?? defaultDescription()
          }
          if (ast && !HttpApiSchema.resolveHttpApiIsEmpty(ast)) {
            const encoding = HttpApiSchema.getEncoding(ast)
            op.responses[status].content = {
              [encoding.contentType]: {
                schema: processAST(ast)
              }
            }
          }
        }
      }

      function processParameters(schema: Schema.Schema<any> | undefined, i: OpenAPISpecParameter["in"]) {
        if (schema) {
          const jsonSchema = processAST(schema.ast) as any
          const required = Array.isArray(jsonSchema.required) ? jsonSchema.required : []
          if ("properties" in jsonSchema) {
            Object.entries(jsonSchema.properties as Record<string, any>).forEach(([name, psJsonSchema]) => {
              op.parameters.push({
                name,
                in: i,
                schema: psJsonSchema,
                required: required.includes(name),
                ...(psJsonSchema.description !== undefined ? { description: psJsonSchema.description } : undefined)
              })
            })
          }
        }
      }

      processAnnotation(endpoint.annotations, Description, (description) => {
        op.description = description
      })
      processAnnotation(endpoint.annotations, Summary, (summary) => {
        op.summary = summary
      })
      processAnnotation(endpoint.annotations, Deprecated, (deprecated) => {
        op.deprecated = deprecated
      })
      processAnnotation(endpoint.annotations, ExternalDocs, (externalDocs) => {
        op.externalDocs = externalDocs
      })

      middleware.forEach((middleware) => {
        if (!HttpApiMiddleware.isSecurity(middleware)) {
          return
        }
        for (const [name, security] of Object.entries(middleware.security)) {
          processHttpApiSecurity(name, security)
          op.security.push({ [name]: [] })
        }
      })
      const hasBody = HttpMethod.hasBody(endpoint.method)
      if (hasBody && payloads.size > 0) {
        const content: OpenApiSpecContent = {}
        payloads.forEach(({ ast }, contentType) => {
          content[contentType as OpenApiSpecContentType] = {
            schema: processAST(ast)
          }
        })
        op.requestBody = { content, required: true }
      }

      processParameters(endpoint.pathSchema, "path")
      if (!hasBody) {
        processParameters(endpoint.payloadSchema, "query")
      }
      processParameters(endpoint.headersSchema, "header")
      processParameters(endpoint.urlParamsSchema, "query")

      processResponseMap(successes, () => "Success")
      processResponseMap(errors, () => "Error")

      const path = endpoint.path.replace(/:(\w+)\??/g, "{$1}")
      const method = endpoint.method.toLowerCase() as OpenAPISpecMethodName
      if (!spec.paths[path]) {
        spec.paths[path] = {}
      }

      processAnnotation(endpoint.annotations, Override, (override) => {
        Object.assign(op, override)
      })
      processAnnotation(endpoint.annotations, Transform, (transformFn) => {
        op = transformFn(op) as OpenAPISpecOperation
      })

      spec.paths[path][method] = op
    }
  })

  processAnnotation(api.annotations, Override, (override) => {
    Object.assign(spec, override)
  })
  processAnnotation(api.annotations, Transform, (transformFn) => {
    spec = transformFn(spec) as OpenAPISpec
  })

  apiCache.set(api, spec)

  return spec
}

const makeSecurityScheme = (security: HttpApiSecurity): OpenAPISecurityScheme => {
  const meta: Partial<OpenAPISecurityScheme> = {}
  processAnnotation(security.annotations, Description, (description) => {
    meta.description = description
  })
  switch (security._tag) {
    case "Basic": {
      return {
        ...meta,
        type: "http",
        scheme: "basic"
      }
    }
    case "Bearer": {
      const format = ServiceMap.getOption(security.annotations, Format).pipe(
        Option.map((format) => ({ bearerFormat: format })),
        Option.getOrUndefined
      )
      return {
        ...meta,
        type: "http",
        scheme: "bearer",
        ...format
      }
    }
    case "ApiKey": {
      return {
        ...meta,
        type: "apiKey",
        name: security.key,
        in: security.in
      }
    }
  }
}

/**
 * This model describes the OpenAPI specification (version 3.1.0) returned by
 * {@link fromApi}. It is not intended to describe the entire OpenAPI
 * specification, only the output of `fromApi`.
 *
 * @category models
 * @since 4.0.0
 */
export interface OpenAPISpec {
  openapi: "3.1.0"
  info: OpenAPISpecInfo
  paths: OpenAPISpecPaths
  components: OpenAPIComponents
  security: Array<OpenAPISecurityRequirement>
  tags: Array<OpenAPISpecTag>
  servers?: Array<OpenAPISpecServer>
}

/**
 * @category models
 * @since 4.0.0
 */
export interface OpenAPISpecInfo {
  title: string
  version: string
  description?: string
  license?: OpenAPISpecLicense
  summary?: string
}

/**
 * @category models
 * @since 4.0.0
 */
export interface OpenAPISpecTag {
  name: string
  description?: string
  externalDocs?: OpenAPISpecExternalDocs
}

/**
 * @category models
 * @since 4.0.0
 */
export interface OpenAPISpecExternalDocs {
  url: string
  description?: string
}

/**
 * @category models
 * @since 4.0.0
 */
export interface OpenAPISpecLicense {
  name: string
  url?: string
}

/**
 * @category models
 * @since 4.0.0
 */
export interface OpenAPISpecServer {
  url: string
  description?: string
  variables?: Record<string, OpenAPISpecServerVariable>
}

/**
 * @category models
 * @since 4.0.0
 */
export interface OpenAPISpecServerVariable {
  default: string
  enum?: NonEmptyArray<string>
  description?: string
}

/**
 * @category models
 * @since 4.0.0
 */
export type OpenAPISpecPaths = Record<string, OpenAPISpecPathItem>

/**
 * @category models
 * @since 4.0.0
 */
export type OpenAPISpecMethodName =
  | "get"
  | "put"
  | "post"
  | "delete"
  | "options"
  | "head"
  | "patch"
  | "trace"

/**
 * @category models
 * @since 4.0.0
 */
export type OpenAPISpecPathItem = {
  [K in OpenAPISpecMethodName]?: OpenAPISpecOperation
}

/**
 * @category models
 * @since 4.0.0
 */
export interface OpenAPISpecParameter {
  name: string
  in: "query" | "header" | "path" | "cookie"
  schema: object
  required: boolean
  description?: string
}

/**
 * @category models
 * @since 4.0.0
 */
export type OpenAPISpecResponses = Record<number, OpenApiSpecResponse>

/**
 * @category models
 * @since 4.0.0
 */
export type OpenApiSpecContentType =
  | "application/json"
  | "application/xml"
  | "application/x-www-form-urlencoded"
  | "multipart/form-data"
  | "text/plain"

/**
 * @category models
 * @since 4.0.0
 */
export type OpenApiSpecContent = {
  [K in OpenApiSpecContentType]?: OpenApiSpecMediaType
}

/**
 * @category models
 * @since 4.0.0
 */
export interface OpenApiSpecResponse {
  description: string
  content?: OpenApiSpecContent
}

/**
 * @category models
 * @since 4.0.0
 */
export interface OpenApiSpecMediaType {
  schema: JsonSchema.JsonSchema
}

/**
 * @category models
 * @since 4.0.0
 */
export interface OpenAPISpecRequestBody {
  content: OpenApiSpecContent
  required: true
}

/**
 * @category models
 * @since 4.0.0
 */
export interface OpenAPIComponents {
  schemas: JsonSchema.Definitions
  securitySchemes: Record<string, OpenAPISecurityScheme>
}

/**
 * @category models
 * @since 4.0.0
 */
export interface OpenAPIHTTPSecurityScheme {
  readonly type: "http"
  scheme: "bearer" | "basic" | string
  description?: string
  /* only for scheme: 'bearer' */
  bearerFormat?: string
}

/**
 * @category models
 * @since 4.0.0
 */
export interface OpenAPIApiKeySecurityScheme {
  readonly type: "apiKey"
  name: string
  in: "query" | "header" | "cookie"
  description?: string
}

/**
 * @category models
 * @since 4.0.0
 */
export type OpenAPISecurityScheme =
  | OpenAPIHTTPSecurityScheme
  | OpenAPIApiKeySecurityScheme

/**
 * @category models
 * @since 4.0.0
 */
export type OpenAPISecurityRequirement = Record<string, Array<string>>

/**
 * @category models
 * @since 4.0.0
 */
export interface OpenAPISpecOperation {
  operationId: string
  parameters: Array<OpenAPISpecParameter>
  responses: OpenAPISpecResponses
  /** Always contains at least the title annotation or the group identifier */
  tags: NonEmptyArray<string>
  security: Array<OpenAPISecurityRequirement>
  requestBody?: OpenAPISpecRequestBody
  description?: string
  summary?: string
  deprecated?: boolean
  externalDocs?: OpenAPISpecExternalDocs
}
