/**
 * @since 4.0.0
 */
import type { DateTime } from "../../DateTime.ts"
import { hasProperty } from "../../Predicate.ts"

/**
 * Property key used by values that provide a scheduled delivery time.
 *
 * @category symbols
 * @since 4.0.0
 */
export const symbol = "~effect/cluster/DeliverAt"

/**
 * Interface for payloads that specify when a cluster message should be delivered.
 *
 * Implementations return the target delivery `DateTime` through the `DeliverAt`
 * symbol method.
 *
 * @category models
 * @since 4.0.0
 */
export interface DeliverAt {
  [symbol](): DateTime
}

/**
 * Returns `true` if the value implements the `DeliverAt` scheduled-delivery
 * protocol.
 *
 * @category guards
 * @since 4.0.0
 */
export const isDeliverAt = (self: unknown): self is DeliverAt => hasProperty(self, symbol)

/**
 * Returns the scheduled delivery time in epoch milliseconds when the value
 * implements `DeliverAt`, or `null` otherwise.
 *
 * @category accessors
 * @since 4.0.0
 */
export const toMillis = (self: unknown): number | null => {
  if (isDeliverAt(self)) {
    return self[symbol]().epochMilliseconds
  }
  return null
}
