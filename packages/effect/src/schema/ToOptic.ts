/**
 * @since 4.0.0
 */

import * as Optic from "../optic/Optic.ts"
import * as Schema from "./Schema.ts"
import * as Serializer from "./Serializer.ts"

/**
 * @since 4.0.0
 */
export function makeIso<S extends Schema.Top>(schema: S): Optic.Iso<S["Type"], S["~iso"]> {
  const serializer = Serializer.json(Schema.typeCodec(schema))
  const get = Schema.encodeSync(serializer)
  const set = Schema.decodeSync(serializer)
  return Optic.makeIso(get, set)
}
