import type * as Types from "effect/types/Types"
import type { OpenAPISpecMethodName } from "effect/unstable/httpapi/OpenApi"

export interface ParsedOperation {
  readonly id: string
  readonly method: OpenAPISpecMethodName
  readonly description: string | undefined
  readonly params?: string
  readonly paramsOptional: boolean
  readonly urlParams: ReadonlyArray<string>
  readonly headers: ReadonlyArray<string>
  readonly cookies: ReadonlyArray<string>
  readonly payload?: string
  readonly payloadFormData: boolean
  readonly pathIds: ReadonlyArray<string>
  readonly pathTemplate: string
  readonly successSchemas: ReadonlyMap<string, string>
  readonly errorSchemas: ReadonlyMap<string, string>
  readonly voidSchemas: ReadonlySet<string>
}

export const makeDeepMutable = (options: {
  readonly id: string
  readonly method: OpenAPISpecMethodName
  readonly pathIds: Array<string>
  readonly pathTemplate: string
  readonly description: string | undefined
}): Types.DeepMutable<ParsedOperation> => ({
  ...options,
  urlParams: [],
  headers: [],
  cookies: [],
  payloadFormData: false,
  successSchemas: new Map(),
  errorSchemas: new Map(),
  voidSchemas: new Set(),
  paramsOptional: true
})
