/**
 * @since 4.0.0
 */

import * as Optic from "../optic/Optic.ts"
import type * as Schema from "./Schema.ts"
import * as Serializer from "./Serializer.ts"
import * as ToParser from "./ToParser.ts"

/**
 * @since 4.0.0
 */
export function makeIso<S extends Schema.Top>(schema: S): Optic.Iso<S["Type"], S["Iso"]> {
  const serializer = Serializer.iso(schema)
  return Optic.makeIso(ToParser.encodeSync(serializer), ToParser.decodeSync(serializer))
}

/**
 * @since 4.0.0
 */
export function makeSourceIso<S extends Schema.Top>(_: S): Optic.Iso<S["Type"], S["Type"]> {
  return Optic.id()
}

/**
 * @since 4.0.0
 */
export function makeFocusIso<S extends Schema.Top>(_: S): Optic.Iso<S["Iso"], S["Iso"]> {
  return Optic.id()
}
