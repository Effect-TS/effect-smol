/**
 * @since 4.0.0
 */

import * as Result from "../data/Result.ts"
import * as Optic from "../optic/Optic.ts"
import * as Formatter from "./Formatter.ts"
import type * as Schema from "./Schema.ts"
import * as Serializer from "./Serializer.ts"
import * as ToParser from "./ToParser.ts"

const formatter = Formatter.makeDefault()

/**
 * @since 4.0.0
 */
export function makeIso<T, Iso>(codec: Schema.Optic<T, Iso>): Optic.Iso<T, Iso> {
  const serializer = Serializer.iso(codec)
  const encodeResult = ToParser.encodeResult(serializer)
  const decodeResult = ToParser.decodeResult(serializer)
  return new Optic.OpticBuilder(
    true,
    (s) => Result.mapError(encodeResult(s), (issue) => formatter.format(issue)),
    (b) => Result.mapError(decodeResult(b), (issue) => formatter.format(issue))
  )
}

/**
 * @since 4.0.0
 */
export function getSourceIso<S extends Schema.Top>(_: S): Optic.Iso<S["Type"], S["Type"]> {
  return Optic.id()
}

/**
 * @since 4.0.0
 */
export function getFocusIso<S extends Schema.Top>(_: S): Optic.Iso<S["Iso"], S["Iso"]> {
  return Optic.id()
}
