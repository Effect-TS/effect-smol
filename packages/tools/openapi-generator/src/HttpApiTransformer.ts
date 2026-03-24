import type {
  ParsedOpenApi,
  ParsedOpenApiSecurityScheme,
  ParsedOpenApiTag,
  ParsedOperation,
  ParsedOperationMediaTypeSchema,
  ParsedOperationResponse
} from "./ParsedOperation.ts"
import * as Utils from "./Utils.ts"

interface GroupRenderModel {
  readonly identifier: string
  readonly topLevel: boolean
  readonly metadata: ParsedOpenApiTag | undefined
  readonly operations: ReadonlyArray<ParsedOperation>
  readonly constName: string
}

interface SecurityRenderModel {
  readonly securityDeclarations: ReadonlyArray<string>
  readonly middlewareDeclarations: ReadonlyArray<string>
  readonly endpointMiddlewares: ReadonlyMap<string, ReadonlyArray<string>>
}

const fallbackGroupIdentifier = "default"

export const imports = (importName: string): string =>
  [
    `import * as ${importName} from "effect/Schema"`,
    `import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiMiddleware, HttpApiSchema, HttpApiSecurity, OpenApi } from "effect/unstable/httpapi"`
  ].join("\n")

export const toImplementation = (
  _importName: string,
  name: string,
  parsed: ParsedOpenApi
): string => {
  const security = buildSecurityRenderModel(parsed)
  const groups = groupOperations(parsed)
  const groupSources = groups.map((group) => renderGroup(group, security.endpointMiddlewares))
  const metadataAnnotations = renderApiAnnotations(parsed)

  let apiValue = `export class ${name} extends HttpApi.make(${JSON.stringify(name)})`
  for (const annotation of metadataAnnotations) {
    apiValue += `\n  .${annotation}`
  }
  if (groups.length > 0) {
    apiValue += `\n  .add(${groups.map((group) => group.constName).join(", ")})`
  }
  apiValue += ` {}`

  return [
    ...security.securityDeclarations,
    ...security.middlewareDeclarations,
    ...groupSources,
    apiValue
  ].join("\n\n")
}

const groupOperations = (parsed: ParsedOpenApi): ReadonlyArray<GroupRenderModel> => {
  const tagMetadata = new Map(parsed.tags.map((tag) => [tag.name, tag]))
  const byIdentifier = new Map<string, {
    readonly identifier: string
    topLevel: boolean
    readonly metadata: ParsedOpenApiTag | undefined
    readonly operations: Array<ParsedOperation>
  }>()

  for (const operation of parsed.operations) {
    const identifier = operation.tags[0] ?? fallbackGroupIdentifier
    const topLevel = operation.tags.length === 0
    const existing = byIdentifier.get(identifier)
    if (existing) {
      if (topLevel) {
        existing.topLevel = true
      }
      existing.operations.push(operation)
      continue
    }
    byIdentifier.set(identifier, {
      identifier,
      topLevel,
      metadata: tagMetadata.get(identifier),
      operations: [operation]
    })
  }

  const allocateName = makeNameAllocator()
  const groups: Array<GroupRenderModel> = []
  for (const group of byIdentifier.values()) {
    const baseName = ensureIdentifier(group.identifier, "Group")
    groups.push({
      ...group,
      constName: allocateName(`${baseName}Group`)
    })
  }
  return groups
}

const renderGroup = (
  group: GroupRenderModel,
  endpointMiddlewares: ReadonlyMap<string, ReadonlyArray<string>>
): string => {
  let source = `class ${group.constName} extends HttpApiGroup.make(${JSON.stringify(group.identifier)}${
    group.topLevel ? ", { topLevel: true }" : ""
  })`

  const allocateEndpointName = makeNameAllocator()
  const endpointSources = group.operations.map((operation) =>
    renderEndpoint(
      operation,
      allocateEndpointName(operation.id),
      endpointMiddlewares.get(toOperationKey(operation)) ?? []
    )
  )
  if (endpointSources.length > 0) {
    source += `\n  .add(${endpointSources.join(", \n    ")})`
  }

  if (group.metadata?.description !== undefined) {
    source += `\n  .annotate(OpenApi.Description, ${JSON.stringify(group.metadata.description)})`
  }
  if (group.metadata?.externalDocs !== undefined) {
    source += `\n  .annotate(OpenApi.ExternalDocs, ${JSON.stringify(group.metadata.externalDocs)})`
  }

  source += ` {}`

  return source
}

const renderEndpoint = (
  operation: ParsedOperation,
  endpointName: string,
  endpointMiddlewares: ReadonlyArray<string>
): string => {
  const options: Array<string> = []
  if (operation.pathSchema !== undefined) {
    options.push(`params: ${operation.pathSchema}`)
  }
  if (operation.querySchema !== undefined) {
    options.push(`query: ${operation.querySchema}`)
  }
  if (operation.headersSchema !== undefined) {
    options.push(`headers: ${operation.headersSchema}`)
  }

  const payload = renderPayload(operation)
  if (payload !== undefined) {
    options.push(`payload: ${payload}`)
  }

  const success = renderResponseSet(operation.responses, "success")
  if (success !== undefined) {
    options.push(`success: ${success}`)
  }

  const error = renderResponseSet(operation.responses, "error")
  if (error !== undefined) {
    options.push(`error: ${error}`)
  }

  const endpoint = options.length === 0
    ? `HttpApiEndpoint.${operation.method}(${JSON.stringify(endpointName)}, ${
      JSON.stringify(toHttpApiPath(operation.path))
    })`
    : `HttpApiEndpoint.${operation.method}(${JSON.stringify(endpointName)}, ${
      JSON.stringify(toHttpApiPath(operation.path))
    }, { ${options.join(", ")} })`

  const annotations: Array<string> = []
  if (operation.operationId !== undefined) {
    annotations.push(`annotate(OpenApi.Identifier, ${JSON.stringify(operation.operationId)})`)
  }
  if (operation.metadata.summary !== undefined) {
    annotations.push(`annotate(OpenApi.Summary, ${JSON.stringify(operation.metadata.summary)})`)
  }
  if (operation.metadata.description !== undefined) {
    annotations.push(`annotate(OpenApi.Description, ${JSON.stringify(operation.metadata.description)})`)
  }
  if (operation.metadata.deprecated) {
    annotations.push(`annotate(OpenApi.Deprecated, true)`)
  }
  if (operation.metadata.externalDocs !== undefined) {
    annotations.push(`annotate(OpenApi.ExternalDocs, ${JSON.stringify(operation.metadata.externalDocs)})`)
  }

  if (annotations.length === 0 && endpointMiddlewares.length === 0) {
    return endpoint
  }

  let out = endpoint
  for (const middleware of endpointMiddlewares) {
    out += `\n      .middleware(${middleware})`
  }
  for (const annotation of annotations) {
    out += `\n      .${annotation}`
  }
  return out
}

const renderPayload = (operation: ParsedOperation): string | undefined => {
  if (!methodSupportsBody(operation.method)) {
    return
  }
  const payloads = operation.requestBodyRepresentable.map((schema) => renderMediaSchema(schema))
  if (payloads.length === 0) {
    return
  }

  if (operation.requestBody?.required === false) {
    payloads.unshift("HttpApiSchema.NoContent")
  }

  return joinSchemas(payloads)
}

const renderResponseSet = (
  responses: ReadonlyArray<ParsedOperationResponse>,
  target: "success" | "error"
): string | undefined => {
  const rendered: Array<string> = []

  for (const response of responses) {
    const status = toStatus(response.status)
    if (status === undefined) {
      continue
    }

    const isSuccess = status < 400
    if ((target === "success") !== isSuccess) {
      continue
    }

    if (response.isEmpty) {
      rendered.push(`HttpApiSchema.Empty(${status})`)
      continue
    }

    for (const media of response.representable) {
      rendered.push(applyStatus(renderMediaSchema(media), status, target))
    }
  }

  if (rendered.length === 0) {
    return
  }

  return joinSchemas(rendered)
}

const joinSchemas = (schemas: ReadonlyArray<string>): string =>
  schemas.length === 1 ? schemas[0] : `[${schemas.join(", ")}]`

const renderMediaSchema = (media: ParsedOperationMediaTypeSchema): string => {
  switch (media.encoding) {
    case "json": {
      if (media.contentType === "application/json") {
        return media.schema
      }
      return `(${media.schema} as any).pipe(HttpApiSchema.asJson({ contentType: ${
        JSON.stringify(media.contentType)
      } }))`
    }
    case "multipart": {
      return `(${media.schema} as any).pipe(HttpApiSchema.asMultipart())`
    }
    case "form-url-encoded": {
      if (media.contentType === "application/x-www-form-urlencoded") {
        return `(${media.schema} as any).pipe(HttpApiSchema.asFormUrlEncoded())`
      }
      return `(${media.schema} as any).pipe(HttpApiSchema.asFormUrlEncoded({ contentType: ${
        JSON.stringify(media.contentType)
      } }))`
    }
    case "text": {
      if (media.contentType === "text/plain") {
        return `(${media.schema} as any).pipe(HttpApiSchema.asText())`
      }
      return `(${media.schema} as any).pipe(HttpApiSchema.asText({ contentType: ${
        JSON.stringify(media.contentType)
      } }))`
    }
    case "binary": {
      if (media.contentType === "application/octet-stream") {
        return `(${media.schema} as any).pipe(HttpApiSchema.asUint8Array())`
      }
      return `(${media.schema} as any).pipe(HttpApiSchema.asUint8Array({ contentType: ${
        JSON.stringify(media.contentType)
      } }))`
    }
  }
}

const renderApiAnnotations = (parsed: ParsedOpenApi): ReadonlyArray<string> => {
  const annotations: Array<string> = [
    `annotate(OpenApi.Title, ${JSON.stringify(parsed.metadata.title)})`,
    `annotate(OpenApi.Version, ${JSON.stringify(parsed.metadata.version)})`
  ]

  if (parsed.metadata.summary !== undefined) {
    annotations.push(`annotate(OpenApi.Summary, ${JSON.stringify(parsed.metadata.summary)})`)
  }
  if (parsed.metadata.description !== undefined) {
    annotations.push(`annotate(OpenApi.Description, ${JSON.stringify(parsed.metadata.description)})`)
  }
  if (parsed.metadata.license !== undefined) {
    annotations.push(`annotate(OpenApi.License, ${JSON.stringify(parsed.metadata.license)})`)
  }
  if (parsed.metadata.servers !== undefined) {
    annotations.push(`annotate(OpenApi.Servers, ${JSON.stringify(parsed.metadata.servers)})`)
  }

  return annotations
}

const buildSecurityRenderModel = (parsed: ParsedOpenApi): SecurityRenderModel => {
  const allocateName = makeNameAllocator()
  const securityDeclarations: Array<string> = []
  const middlewareDeclarations: Array<string> = []
  const endpointMiddlewares = new Map<string, ReadonlyArray<string>>()
  const schemeDeclarations = new Map<string, string>()

  for (const securityScheme of parsed.securitySchemes) {
    const baseName = ensureIdentifier(securityScheme.name, "Security")
    const declarationName = allocateName(`${baseName}Security`)
    schemeDeclarations.set(securityScheme.name, declarationName)
    securityDeclarations.push(`const ${declarationName} = ${renderSecurityScheme(securityScheme)}`)
  }

  for (const operation of parsed.operations) {
    if (operation.effectiveSecurity.length === 0) {
      continue
    }
    if (operation.effectiveSecurity.some((requirement) => Object.keys(requirement).length === 0)) {
      continue
    }

    const operationMiddlewareNames: Array<string> = []
    const orSchemes: Array<readonly [string, string]> = []
    const seenOrSchemes = new Set<string>()
    const andRequirements: Array<ReadonlyArray<string>> = []

    for (const requirement of operation.effectiveSecurity) {
      const schemes = Object.keys(requirement)
      if (schemes.length === 1) {
        const schemeName = schemes[0]
        const declarationName = schemeDeclarations.get(schemeName)
        if (declarationName !== undefined && !seenOrSchemes.has(schemeName)) {
          seenOrSchemes.add(schemeName)
          orSchemes.push([schemeName, declarationName])
        }
      } else if (schemes.length > 1) {
        andRequirements.push(schemes)
      }
    }

    if (orSchemes.length > 0) {
      const className = allocateName(`${ensureIdentifier(operation.id, "Operation")}SecurityMiddleware`)
      const securityEntries = orSchemes.map(([name, declaration]) => `${JSON.stringify(name)}: ${declaration}`).join(
        ", "
      )
      middlewareDeclarations.push(
        `class ${className} extends HttpApiMiddleware.Service<${className}>()(${
          JSON.stringify(`${operation.method.toUpperCase()} ${operation.path} security`)
        }, { security: { ${securityEntries} } }) {}`
      )
      operationMiddlewareNames.push(className)
    }

    for (let i = 0; i < andRequirements.length; i++) {
      const className = allocateName(`${ensureIdentifier(operation.id, "Operation")}SecurityAndMiddleware`)
      middlewareDeclarations.push(
        `class ${className} extends HttpApiMiddleware.Service<${className}>()(${
          JSON.stringify(`${operation.method.toUpperCase()} ${operation.path} security-and-${i + 1}`)
        }) {}`
      )
      operationMiddlewareNames.push(className)
    }

    if (operationMiddlewareNames.length > 0) {
      endpointMiddlewares.set(toOperationKey(operation), operationMiddlewareNames)
    }
  }

  return {
    securityDeclarations,
    middlewareDeclarations,
    endpointMiddlewares
  }
}

const renderSecurityScheme = (securityScheme: ParsedOpenApiSecurityScheme): string => {
  let source: string
  switch (securityScheme.type) {
    case "basic": {
      source = "HttpApiSecurity.basic"
      break
    }
    case "bearer": {
      source = "HttpApiSecurity.bearer"
      break
    }
    case "apiKey": {
      source = `HttpApiSecurity.apiKey({ key: ${JSON.stringify(securityScheme.key!)}, in: ${
        JSON.stringify(securityScheme.in!)
      } })`
      break
    }
  }

  if (securityScheme.description !== undefined) {
    source += `.pipe(HttpApiSecurity.annotate(OpenApi.Description, ${JSON.stringify(securityScheme.description)}))`
  }
  if (securityScheme.type === "bearer" && securityScheme.bearerFormat !== undefined) {
    source += `.pipe(HttpApiSecurity.annotate(OpenApi.Format, ${JSON.stringify(securityScheme.bearerFormat)}))`
  }

  return source
}

const toOperationKey = (operation: ParsedOperation): string => `${operation.method}:${operation.path}`

const toHttpApiPath = (path: string): string => path.replace(/{([^}]+)}/g, ":$1")

const toStatus = (status: string): number | undefined => {
  if (!/^\d{3}$/.test(status)) {
    return
  }
  return Number(status)
}

const applyStatus = (schema: string, status: number, target: "success" | "error"): string => {
  if ((target === "success" && status === 200) || (target === "error" && status === 500)) {
    return schema
  }
  return `${schema}.pipe(HttpApiSchema.status(${status}))`
}

const methodSupportsBody = (method: ParsedOperation["method"]): boolean =>
  method !== "get" && method !== "head" && method !== "options" && method !== "trace"

const ensureIdentifier = (value: string, fallback: string): string => {
  const sanitized = Utils.identifier(value)
  return sanitized.length > 0 ? sanitized : fallback
}

const makeNameAllocator = () => {
  const used = new Set<string>()
  return (base: string) => {
    let candidate = base
    let index = 2
    while (used.has(candidate)) {
      candidate = `${base}${index}`
      index += 1
    }
    used.add(candidate)
    return candidate
  }
}
