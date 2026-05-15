/**
 * @since 4.0.0
 */
import * as Schema from "../../Schema.ts"

/**
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
 * @category models
 * @since 4.0.0
 */
export type MachineId = typeof MachineId.Type

/**
 * @category Constructors
 * @since 4.0.0
 */
export const make = (id: number): MachineId => id as MachineId
