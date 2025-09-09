/**
 * @since 4.0.0
 */

import * as Optic from "../optic/Optic.ts"
import * as Schema from "./Schema.ts"
import * as Serializer from "./Serializer.ts"

/**
 * @since 4.0.0
 */
export function make<S extends Schema.Codec<unknown, unknown>>(schema: S): Optic.Iso<S["Type"], S["~iso"]> {
  const serializer = Serializer.iso(schema)
  return Optic.makeIso(Schema.encodeSync(serializer), Schema.decodeSync(serializer))
}
