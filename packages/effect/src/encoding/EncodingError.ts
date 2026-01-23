/**
 * @since 4.0.0
 */
import * as Data from "../Data.ts"
import { hasProperty } from "../Predicate.ts"

const EncodingErrorTypeId = "~effect/encoding/EncodingError" as const

/**
 * @category symbols
 * @since 2.0.0
 */
export type EncodingErrorTypeId = typeof EncodingErrorTypeId

/**
 * @category constructors
 * @since 4.0.0
 */
export class EncodingError extends Data.TaggedError("EncodingError")<{
  kind: "Decode" | "Encode"
  module: string
  input: unknown
  message: string
}> {
  /**
   * @since 4.0.0
   */
  readonly [EncodingErrorTypeId]: EncodingErrorTypeId = EncodingErrorTypeId
}

/**
 * @category guards
 * @since 2.0.0
 */
export const isEncodingError = (u: unknown): u is EncodingError => hasProperty(u, EncodingErrorTypeId)
