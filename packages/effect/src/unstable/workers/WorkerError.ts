/**
 * @since 4.0.0
 */
import { hasProperty } from "../../data/Predicate.ts"
import * as Schema from "../../schema/Schema.ts"

const TypeId = "~effect/workers/WorkerError" as const

/**
 * @since 4.0.0
 * @category Symbols
 */
export type TypeId = typeof TypeId

/**
 * @since 4.0.0
 * @category Guards
 */
export const isWorkerError = (u: unknown): u is WorkerError => hasProperty(u, TypeId)

/**
 * @since 4.0.0
 * @category Models
 */
export class WorkerError extends Schema.ErrorClass<WorkerError>(TypeId)({
  _tag: Schema.tag("WorkerError"),
  reason: Schema.Literals(["Receive", "Spawn", "Send", "Unknown"]),
  message: Schema.String,
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * @since 4.0.0
   */
  readonly [TypeId]: TypeId = TypeId
}
