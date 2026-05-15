/**
 * @since 4.0.0
 */
import * as Config from "../../Config.ts"
import * as Effect from "../../Effect.ts"
import { format } from "../../Formatter.ts"
import * as Schema from "../../Schema.ts"

/**
 * @category Models
 * @since 4.0.0
 */
export interface Resource {
  /** Resource attributes */
  attributes: Array<KeyValue>
  /** Resource droppedAttributesCount */
  droppedAttributesCount: number
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export const make = (options: {
  readonly serviceName: string
  readonly serviceVersion?: string | undefined
  readonly attributes?: Record<string, unknown> | undefined
}): Resource => {
  const resourceAttributes = options.attributes
    ? entriesToAttributes(Object.entries(options.attributes))
    : []
  resourceAttributes.push({
    key: "service.name",
    value: {
      stringValue: options.serviceName
    }
  })
  if (options.serviceVersion) {
    resourceAttributes.push({
      key: "service.version",
      value: {
        stringValue: options.serviceVersion
      }
    })
  }

  return {
    attributes: resourceAttributes,
    droppedAttributesCount: 0
  }
}

/**
 * @category Constructors
 * @since 4.0.0
 */
export const fromConfig: (
  options?: {
    readonly serviceName?: string | undefined
    readonly serviceVersion?: string | undefined
    readonly attributes?: Record<string, unknown> | undefined
  } | undefined
) => Effect.Effect<Resource> = Effect.fnUntraced(function*(options?: {
  readonly serviceName?: string | undefined
  readonly serviceVersion?: string | undefined
  readonly attributes?: Record<string, unknown> | undefined
}) {
  const attributes = {
    ...(yield* Config.schema(
      Schema.UndefinedOr(Config.Record(Schema.String, Schema.String)),
      "OTEL_RESOURCE_ATTRIBUTES"
    )),
    ...options?.attributes
  }
  const serviceName = options?.serviceName ?? attributes["service.name"] as string ??
    (yield* Config.schema(Schema.String, "OTEL_SERVICE_NAME"))
  delete attributes["service.name"]
  const serviceVersion = options?.serviceVersion ?? attributes["service.version"] as string ??
    (yield* Config.schema(Schema.UndefinedOr(Schema.String), "OTEL_SERVICE_VERSION"))
  delete attributes["service.version"]
  return make({
    serviceName,
    serviceVersion,
    attributes
  })
}, Effect.orDie)

/**
 * @category Attributes
 * @since 4.0.0
 */
export const serviceNameUnsafe = (resource: Resource): string => {
  const serviceNameAttribute = resource.attributes.find(
    (attr) => attr.key === "service.name"
  )
  if (!serviceNameAttribute || !serviceNameAttribute.value.stringValue) {
    throw new Error("Resource does not contain a service name")
  }
  return serviceNameAttribute.value.stringValue
}

/**
 * @category Attributes
 * @since 4.0.0
 */
export const entriesToAttributes = (entries: Iterable<[string, unknown]>): Array<KeyValue> => {
  const attributes: Array<KeyValue> = []
  for (const [key, value] of entries) {
    attributes.push({
      key,
      value: unknownToAttributeValue(value)
    })
  }
  return attributes
}

/**
 * @category Attributes
 * @since 4.0.0
 */
export const unknownToAttributeValue = (value: unknown): AnyValue => {
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map(unknownToAttributeValue)
      }
    }
  }
  switch (typeof value) {
    case "string":
      return {
        stringValue: value
      }
    case "bigint":
      return {
        intValue: Number(value)
      }
    case "number":
      return Number.isInteger(value)
        ? {
          intValue: value
        }
        : {
          doubleValue: value
        }
    case "boolean":
      return {
        boolValue: value
      }
    default:
      return {
        stringValue: format(value)
      }
  }
}

/**
 * @category Models
 * @since 4.0.0
 */
export interface KeyValue {
  /** KeyValue key */
  key: string
  /** KeyValue value */
  value: AnyValue
}

/**
 * @category Models
 * @since 4.0.0
 */
export interface AnyValue {
  /** AnyValue stringValue */
  stringValue?: string | null
  /** AnyValue boolValue */
  boolValue?: boolean | null
  /** AnyValue intValue */
  intValue?: number | null
  /** AnyValue doubleValue */
  doubleValue?: number | null
  /** AnyValue arrayValue */
  arrayValue?: ArrayValue
  /** AnyValue kvlistValue */
  kvlistValue?: KeyValueList
  /** AnyValue bytesValue */
  bytesValue?: Uint8Array
}

/**
 * @category Models
 * @since 4.0.0
 */
export interface ArrayValue {
  /** ArrayValue values */
  values: Array<AnyValue>
}

/**
 * @category Models
 * @since 4.0.0
 */
export interface KeyValueList {
  /** KeyValueList values */
  values: Array<KeyValue>
}

/**
 * @category Models
 * @since 4.0.0
 */
export interface LongBits {
  low: number
  high: number
}

/**
 * @category Models
 * @since 4.0.0
 */
export type Fixed64 = LongBits | string | number
