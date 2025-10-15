import * as Option from "effect/data/Option"
import * as Predicate from "effect/data/Predicate"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as SchemaAnnotations from "effect/schema/Annotations"
import * as ServiceMap from "effect/ServiceMap"
import * as String from "effect/String"
import type { OpenAPISpec, OpenAPISpecMethodName, OpenAPISpecPathItem } from "effect/unstable/httpapi/OpenApi"
import SwaggerToOpenApi from "swagger2openapi"
import * as JsonSchemaGenerator from "./JsonSchemaGenerator.ts"
import type * as JsonSchemaTransformer from "./JsonSchemaTransformer.ts"
import * as OpenApiTransformer from "./OpenApiTransformer.ts"
import * as ParsedOperation from "./ParsedOperation.ts"
import * as Utils from "./Utils.ts"

export class OpenApiGenerator extends ServiceMap.Service<
  OpenApiGenerator,
  { readonly generate: (spec: OpenAPISpec, options: OpenApiGenerateOptions) => Effect.Effect<string> }
>()("OpenApiGenerator") {}

export interface OpenApiGenerateOptions {
  /**
   * The name to give to the generated client.
   */
  readonly name: string
  /**
   * When `true`, will **only** generate types based on the provided OpenApi
   * specification (without corresponding schemas).
   */
  readonly typeOnly: boolean
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
  const services = yield* Effect.services<
    | JsonSchemaTransformer.JsonSchemaTransformer
    | OpenApiTransformer.OpenApiTransformer
  >()

  const generate = Effect.fn(
    function*(spec: OpenAPISpec, options: OpenApiGenerateOptions) {
      const generator = yield* JsonSchemaGenerator.JsonSchemaGenerator
      const transformer = yield* OpenApiTransformer.OpenApiTransformer

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

      const operations: Array<ParsedOperation.ParsedOperation> = []
      const components = spec.components ? { ...spec.components } : { schemas: {} }
      const context: JsonSchemaGenerator.OpenApiContext = { components } as any

      function handlePath(path: string, methods: OpenAPISpecPathItem): void {
        for (const method of methodNames) {
          const operation = methods[method]

          if (Predicate.isUndefined(operation)) {
            return
          }

          const id = operation.operationId
            ? Utils.camelize(operation.operationId)
            : `${method.toUpperCase()}${path}`

          const description = Utils.nonEmptyString(operation.description).pipe(
            Option.orElse(() => Utils.nonEmptyString(operation.summary))
          )

          const { pathIds, pathTemplate } = processPath(path)

          const op = ParsedOperation.makeDeepMutable({
            id,
            method,
            description,
            pathIds,
            pathTemplate
          })

          const schemaId = Utils.identifier(operation.operationId ?? path)

          const validParameters = operation.parameters?.filter((param) => {
            return param.in !== "path" && param.in !== "cookie"
          }) ?? []

          if (validParameters.length > 0) {
            const schema = {
              type: "object" as SchemaAnnotations.JsonSchema.Type,
              properties: {} as Record<string, any>,
              required: [] as Array<string>
            }

            for (let parameter of validParameters) {
              if ("$ref" in parameter) {
                parameter = resolveRef(parameter.$ref as string)
              }

              if (parameter.in === "path") {
                return
              }

              const paramSchema = parameter.schema
              const added: Array<string> = []
              if ("properties" in paramSchema && Predicate.isRecord(paramSchema.properties)) {
                const required = "required" in paramSchema
                  ? paramSchema.required as Array<string>
                  : []

                for (const [name, propSchema] of Object.entries(paramSchema.properties)) {
                  const adjustedName = `${parameter.name}[${name}]`
                  schema.properties[adjustedName] = propSchema
                  if (required.includes(name)) {
                    schema.required.push(adjustedName)
                  }
                  added.push(adjustedName)
                }
              } else {
                schema.properties[parameter.name] = parameter.schema
                if (parameter.required) {
                  schema.required.push(parameter.name)
                }
                added.push(parameter.name)
              }

              if (parameter.in === "query") {
                Utils.spreadElementsInto(added, op.urlParams)
              } else if (parameter.in === "header") {
                Utils.spreadElementsInto(added, op.headers)
              } else if (parameter.in === "cookie") {
                Utils.spreadElementsInto(added, op.cookies)
              }
            }

            op.params = generator.addSchema(
              `${schemaId}Params`,
              schema,
              context,
              true
            )

            op.paramsOptional = !schema.required || schema.required.length === 0
          }

          if (Predicate.isNotUndefined(operation.requestBody?.content?.["application/json"]?.schema)) {
            op.payload = generator.addSchema(
              `${schemaId}Request`,
              operation.requestBody.content["application/json"].schema,
              context
            )
          }

          if (Predicate.isNotUndefined(operation.requestBody?.content?.["multipart/form-data"]?.schema)) {
            op.payload = generator.addSchema(
              `${schemaId}Request`,
              operation.requestBody.content["multipart/form-data"].schema,
              context
            )
            op.payloadFormData = true
          }

          let defaultSchema: string | undefined
          for (const entry of Object.entries(operation.responses ?? {})) {
            const status = entry[0]
            let response = entry[1]

            while ("$ref" in response) {
              response = resolveRef(response.$ref as string)
            }

            if (Predicate.isNotUndefined(response.content?.["application/json"]?.schema)) {
              const schemaName = generator.addSchema(
                `${schemaId}${status}`,
                response.content["application/json"].schema,
                context,
                true
              )

              if (status === "default") {
                defaultSchema = schemaName
              }

              const statusLower = status.toLowerCase()
              const statusMajorNumber = Number(status[0])
              if (Number.isNaN(statusMajorNumber)) {
                return
              }
              if (statusMajorNumber < 4) {
                op.successSchemas.set(statusLower, schemaName)
              } else {
                op.errorSchemas.set(statusLower, schemaName)
              }
            }

            if (Predicate.isUndefined(response.content)) {
              op.voidSchemas.add(status.toLowerCase())
            }
          }

          if (op.successSchemas.size === 0 && Predicate.isNotUndefined(defaultSchema)) {
            op.successSchemas.set("2xx", defaultSchema)
          }

          operations.push(op)
        }
      }

      for (const [path, methods] of Object.entries(spec.paths)) {
        handlePath(path, methods)
      }

      // TODO: make a CLI option ?
      const importName = "S"
      const schemas = yield* generator.generate(importName)

      return String.stripMargin(
        `|${transformer.imports(importName)}
         |
         |${schemas}
         |
         |${transformer.toImplementation(importName, options.name, operations)}
         |
         |${transformer.toTypes(importName, options.name, operations)}`
      )
    },
    Effect.provideServiceEffect(
      JsonSchemaGenerator.JsonSchemaGenerator,
      JsonSchemaGenerator.make
    ),
    Effect.provideServices(services)
  )

  return { generate } as const
})

export const layerTransformerSchema: Layer.Layer<OpenApiGenerator> = Layer.effect(OpenApiGenerator, make).pipe(
  Layer.provide(OpenApiTransformer.layerTransformerSchema)
)

export const layerTransformerTs: Layer.Layer<OpenApiGenerator> = Layer.effect(OpenApiGenerator, make).pipe(
  Layer.provide(OpenApiTransformer.layerTransformerTs)
)

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
