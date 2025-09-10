/**
 * @since 4.0.0
 */

import * as Optic from "../optic/Optic.ts"
import * as Schema from "./Schema.ts"
import * as Serializer from "./Serializer.ts"

/**
 * @since 4.0.0
 */
export function makeIso<S extends Schema.Codec<unknown, unknown>>(codec: S): Optic.Iso<S["Type"], S["Iso"]> {
  const serializer = Serializer.iso(codec)
  return Optic.makeIso(Schema.encodeSync(serializer), Schema.decodeSync(serializer))
}

/**
 * @since 4.0.0
 */
export function getSource<S extends Schema.Top>(_: S): Optic.Iso<S["Type"], S["Type"]> {
  return Optic.id()
}

/**
 * @since 4.0.0
 */
export function getFocus<S extends Schema.Top>(_: S): Optic.Iso<S["Iso"], S["Iso"]> {
  return Optic.id()
}
