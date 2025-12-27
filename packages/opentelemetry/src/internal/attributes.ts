import type * as Otel from "@opentelemetry/api"
import * as Inspectable from "effect/Inspectable"

/** @internal */
export const recordToAttributes = (record: Record<string, unknown>): Otel.Attributes => {
  const attributes: Otel.Attributes = {}
  for (const [key, value] of Object.entries(record)) {
    attributes[key] = unknownToAttributeValue(value)
  }
  return attributes
}

/** @internal */
export const unknownToAttributeValue = (value: unknown): Otel.AttributeValue => {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value
  } else if (typeof value === "bigint") {
    return value.toString()
  }
  return Inspectable.toStringUnknown(value)
}
