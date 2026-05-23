/**
 * The `MachineId` module provides the branded integer identifier used to
 * distinguish cluster runners when generating distributed ids and coordinating
 * runner state.
 *
 * **When to use**
 *
 * Use to persist or exchanging the machine id assigned to a cluster runner
 * - Passing a runner-specific identity to the cluster snowflake generator
 * - Decoding machine ids from storage while keeping them distinct from plain numbers
 *
 * **Gotchas**
 *
 * - Machine ids must be unique for concurrently active runners that generate snowflakes
 * - Snowflake ids store the machine component in 10 bits, so only the value modulo 1024 is encoded
 *
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
 * **When to use**
 *
 * Use to turn a trusted numeric machine id into the branded type when
 * implementing runner storage adapters or configuring snowflake generation.
 *
 * **Details**
 *
 * The branded value is the original number at runtime.
 *
 * **Gotchas**
 *
 * `make` does not validate integer input or enforce the snowflake machine-id
 * range. Snowflake ids encode the machine component modulo 1024.
 *
 * @see {@link MachineId} for the schema that validates branded integer machine identifiers
 *
 * @category constructors
 * @since 4.0.0
 */
export const make = (id: number): MachineId => id as MachineId
