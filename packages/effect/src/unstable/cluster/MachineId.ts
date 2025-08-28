/**
 * @since 4.0.0
 */
import * as Schema from "../../schema/Schema.ts"

/**
 * @since 4.0.0
 * @category constructors
 */
export const MachineId = Schema.Int.pipe(
  Schema.brand("~effect/cluster/MachineId")
  // TODO: override pretty
  // Schema.annotations({
  //   pretty: () => (machineId) => `MachineId(${machineId})`
  // })
)

/**
 * @since 4.0.0
 * @category models
 */
export type MachineId = typeof MachineId.Type

/**
 * @since 4.0.0
 * @category Constructors
 */
export const make = (id: number): MachineId => id as MachineId
