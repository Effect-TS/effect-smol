/**
 * @since 4.0.0
 */
import * as Equal from "../../Equal.ts"
import * as Hash from "../../Hash.ts"
import { NodeInspectSymbol } from "../../Inspectable.ts"
import * as PrimaryKey from "../../PrimaryKey.ts"
import * as Schema from "../../Schema.ts"

const TypeId = "~effect/cluster/RunnerAddress"

/**
 * Network address of a cluster runner, identified by host and port.
 *
 * @category models
 * @since 4.0.0
 */
export class RunnerAddress extends Schema.Class<RunnerAddress>(TypeId)({
  host: Schema.String,
  port: Schema.Number
}) {
  /**
   * Marks this value as a cluster runner address for runtime guards.
   *
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId;

  /**
   * Compares runner addresses by host and port.
   *
   * @since 4.0.0
   */
  [Equal.symbol](that: RunnerAddress): boolean {
    return this.host === that.host && this.port === that.port
  }

  /**
   * Computes a structural hash from the host and port.
   *
   * @since 4.0.0
   */
  [Hash.symbol]() {
    return Hash.string(`${this.host}:${this.port}`)
  }

  /**
   * Stable primary key used to identify the runner address.
   *
   * @since 4.0.0
   */
  [PrimaryKey.symbol](): string {
    return `${this.host}:${this.port}`
  }

  /**
   * Formats the runner address with its host and port.
   *
   * @since 4.0.0
   */
  override toString(): string {
    return `RunnerAddress(${this.host}:${this.port})`
  }

  /**
   * Formats the runner address for Node.js inspection.
   *
   * @since 4.0.0
   */
  [NodeInspectSymbol](): string {
    return this.toString()
  }
}

/**
 * Constructs a `RunnerAddress` from a host and port.
 *
 * @category constructors
 * @since 4.0.0
 */
export const make = (host: string, port: number): RunnerAddress =>
  new RunnerAddress({ host, port }, { disableChecks: true })
