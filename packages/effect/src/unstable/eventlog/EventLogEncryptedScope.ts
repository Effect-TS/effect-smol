/**
 * @since 4.0.0
 */
import type * as EventLog from "./EventLog.ts"

/**
 * @since 4.0.0
 * @category models
 */
export type EncryptedScope = {
  readonly publicKey: string
  readonly storeId: EventLog.StoreId
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const makeEncryptedScopeKey = (scope: EncryptedScope): string => JSON.stringify([scope.publicKey, scope.storeId])
