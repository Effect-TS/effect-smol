/**
 * @since 4.0.0
 */

import * as Optic from "../Optic.ts"
import * as AST from "./AST.ts"
import type * as Getter from "./Getter.ts"
import * as Schema from "./Schema.ts"
import * as Serializer from "./Serializer.ts"
import * as ToParser from "./ToParser.ts"
import * as Transformation from "./Transformation.ts"

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

/**
 * @since 4.0.0
 */
export interface override<S extends Schema.Top, Iso> extends
  Schema.Bottom<
    S["Type"],
    S["Encoded"],
    S["DecodingServices"],
    S["EncodingServices"],
    S["ast"],
    override<S, Iso>,
    S["~type.make.in"],
    Iso,
    S["~type.parameters"],
    S["~type.make"],
    S["~type.mutability"],
    S["~type.optionality"],
    S["~type.constructor.default"],
    S["~encoded.mutability"],
    S["~encoded.optionality"]
  >
{
  readonly "~rebuild.out": this
  readonly schema: S
}

/**
 * **Technical Note**
 *
 * This annotation cannot be added to `Annotations.Bottom` because it changes
 * the schema type.
 *
 * @since 4.0.0
 */
export function override<S extends Schema.Top, Iso>(
  to: Schema.Codec<Iso>,
  transformation: {
    readonly decode: Getter.Getter<S["Type"], Iso>
    readonly encode: Getter.Getter<Iso, S["Type"]>
  }
) {
  return (schema: S): override<S, Iso> => {
    return Schema.makeProto(
      AST.annotate(schema.ast, {
        defaultIsoSerializer: () => new AST.Link(to.ast, Transformation.make(transformation))
      }),
      { schema }
    )
  }
}
