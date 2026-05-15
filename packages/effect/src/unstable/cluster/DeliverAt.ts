/**
 * @since 4.0.0
 */
import type { DateTime } from "../../DateTime.ts"
import { hasProperty } from "../../Predicate.ts"

/**
 * @category symbols
 * @since 4.0.0
 */
export const symbol = "~effect/cluster/DeliverAt"

/**
 * @category models
 * @since 4.0.0
 */
export interface DeliverAt {
  [symbol](): DateTime
}

/**
 * @category guards
 * @since 4.0.0
 */
export const isDeliverAt = (self: unknown): self is DeliverAt => hasProperty(self, symbol)

/**
 * @category accessors
 * @since 4.0.0
 */
export const toMillis = (self: unknown): number | null => {
  if (isDeliverAt(self)) {
    return self[symbol]().epochMilliseconds
  }
  return null
}
