/**
 * @since 4.0.0
 */
import { hasProperty } from "../../data/Predicate.ts"
import type { DateTime } from "../../time/DateTime.ts"

/**
 * @since 4.0.0
 * @category symbols
 */
export const symbol: "~effect/cluster/DeliverAt" = "~effect/cluster/DeliverAt" as const

/**
 * @since 4.0.0
 * @category models
 */
export interface DeliverAt {
  [symbol](): DateTime
}

/**
 * @since 4.0.0
 * @category guards
 */
export const isDeliverAt = (self: unknown): self is DeliverAt => hasProperty(self, symbol)

/**
 * @since 4.0.0
 * @category accessors
 */
export const toMillis = (self: unknown): number | null => {
  if (isDeliverAt(self)) {
    return self[symbol]().epochMillis
  }
  return null
}
