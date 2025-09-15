/**
 * @since 4.0.0
 */

import { identity } from "../Function.ts"
import * as Op from "../optic/AST.ts"
import * as Optic from "../optic/Optic.ts"
import * as Schema from "./Schema.ts"
import * as Serializer from "./Serializer.ts"
import * as ToParser from "./ToParser.ts"

/**
 * @since 4.0.0
 */
export function makeIso<T, Iso>(codec: Schema.Optic<T, Iso>): Optic.Iso<T, Iso> {
  const serializer = Serializer.iso(codec)
  const encoding = serializer.ast.encoding
  const get: (input: T) => Iso = encoding && encoding.length === 1 && encoding[0].to === Schema.anyIsoFocus
    ? identity as any
    : ToParser.encodeSync(serializer)
  const set = ToParser.decodeSync(serializer)
  return Optic.make(new Op.Iso(get, set))
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
