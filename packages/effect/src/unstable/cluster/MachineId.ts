/**
 * @since 4.0.0
 */
import * as Schema from "../../Schema.ts"

/**
 * Schema for branded integer machine identifiers used by the cluster.
 *
 * @category constructors
 * @since 4.0.0
 */
export const MachineId = Schema.Int.pipe(
  Schema.brand("~effect/cluster/MachineId"),
  Schema.annotate({
    toFormatter: () => (machineId: string) => `MachineId(${machineId})`
  })
)

/**
 * Branded integer type representing a cluster machine ID.
 *
 * @category models
 * @since 4.0.0
 */
export type MachineId = typeof MachineId.Type

/**
 * Brands a number as a `MachineId`.
 *
 * @category Constructors
 * @since 4.0.0
 */
export const make = (id: number): MachineId => id as MachineId
