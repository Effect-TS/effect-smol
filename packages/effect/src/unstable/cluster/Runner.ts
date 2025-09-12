/**
 * @since 4.0.0
 */
import * as Equal from "../../interfaces/Equal.ts"
import * as Hash from "../../interfaces/Hash.ts"
import { NodeInspectSymbol } from "../../interfaces/Inspectable.ts"
import * as Schema from "../../schema/Schema.ts"
import * as ToFormat from "../../schema/ToFormat.ts"
import { RunnerAddress } from "./RunnerAddress.ts"

const TypeId = "~effect/cluster/Runner"

/**
 * A `Runner` represents a physical application server that is capable of running
 * entities.
 *
 * Because a Runner represents a physical application server, a Runner must have a
 * unique `address` which can be used to communicate with the server.
 *
 * The version of a Runner is used during rebalancing to give priority to newer
 * application servers and slowly decommission older ones.
 *
 * @since 4.0.0
 * @category models
 */
export class Runner extends Schema.Class<Runner>(TypeId)({
  address: RunnerAddress,
  groups: Schema.Array(Schema.String),
  version: Schema.Int
}) {
  /**
   * @since 4.0.0
   */
  static format = ToFormat.make(this)

  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * @since 4.0.0
   */
  static readonly decodeSync = Schema.decodeSync(Schema.fromJsonString(Runner))

  /**
   * @since 4.0.0
   */
  static readonly encodeSync = Schema.encodeSync(Schema.fromJsonString(Runner));

  /**
   * @since 4.0.0
   */
  [NodeInspectSymbol](): string {
    return this.toString()
  }

  /**
   * @since 4.0.0
   */
  [Equal.symbol](that: Runner): boolean {
    return this.address[Equal.symbol](that.address) && this.version === that.version
  }

  /**
   * @since 4.0.0
   */
  [Hash.symbol](): number {
    return Hash.string(`${this.address.toString()}:${this.version}`)
  }
}

/**
 * A `Runner` represents a physical application server that is capable of running
 * entities.
 *
 * Because a Runner represents a physical application server, a Runner must have a
 * unique `address` which can be used to communicate with the server.
 *
 * The version of a Runner is used during rebalancing to give priority to newer
 * application servers and slowly decommission older ones.
 *
 * @since 4.0.0
 * @category Constructors
 */
export const make = (props: {
  readonly address: RunnerAddress
  readonly groups: ReadonlyArray<string>
  readonly version: number
}): Runner => new Runner(props, { disableValidation: true })
