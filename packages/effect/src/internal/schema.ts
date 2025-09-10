import { Class } from "../interfaces/Pipeable.ts"
import type * as Annotations from "../schema/Annotations.ts"
import * as AST from "../schema/AST.ts"
import type * as Check from "../schema/Check.ts"
import type * as Schema from "../schema/Schema.ts"
import * as ToParser from "../schema/ToParser.ts"

const TypeId = "~effect/schema/Schema"

/** @internal */
export abstract class BottomBuilder<
  T,
  E,
  RD,
  RE,
  Ast extends AST.AST,
  RebuildOut extends Schema.Top,
  AnnotateIn extends Annotations.Annotations,
  TypeMakeIn = T,
  TypeIso = T,
  TypeMake = TypeMakeIn,
  TypeMutability extends Schema.Mutability = "readonly",
  TypeOptionality extends Schema.Optionality = "required",
  TypeConstructorDefault extends Schema.ConstructorDefault = "no-default",
  EncodedMutability extends Schema.Mutability = "readonly",
  EncodedOptionality extends Schema.Optionality = "required"
> extends Class implements
  Schema.Bottom<
    T,
    E,
    RD,
    RE,
    Ast,
    RebuildOut,
    AnnotateIn,
    TypeMakeIn,
    TypeIso,
    TypeMake,
    TypeMutability,
    TypeOptionality,
    TypeConstructorDefault,
    EncodedMutability,
    EncodedOptionality
  >
{
  readonly [TypeId] = TypeId

  declare readonly "Type": T
  declare readonly "Encoded": E
  declare readonly "DecodingServices": RD
  declare readonly "EncodingServices": RE

  declare readonly "~rebuild.out": RebuildOut
  declare readonly "~annotate.in": AnnotateIn

  declare readonly "~type.make.in": TypeMakeIn
  declare readonly "~type.make": TypeMake
  declare readonly "~type.constructor.default": TypeConstructorDefault
  declare readonly "Iso": TypeIso

  declare readonly "~type.mutability": TypeMutability
  declare readonly "~type.optionality": TypeOptionality
  declare readonly "~encoded.mutability": EncodedMutability
  declare readonly "~encoded.optionality": EncodedOptionality

  readonly ast: Ast
  readonly makeSync: (input: this["~type.make.in"], options?: Schema.MakeOptions) => this["Type"]

  constructor(ast: Ast) {
    super()
    this.ast = ast
    this.makeSync = ToParser.makeSync(this)
  }
  abstract rebuild(ast: this["ast"]): this["~rebuild.out"]
  annotate(annotations: this["~annotate.in"]): this["~rebuild.out"] {
    return this.rebuild(AST.annotate(this.ast, annotations))
  }
  annotateKey(annotations: Annotations.Key<this["Type"]>): this["~rebuild.out"] {
    return this.rebuild(AST.annotateKey(this.ast, annotations))
  }
  check(
    ...checks: readonly [
      Check.Check<this["Type"]>,
      ...Array<Check.Check<this["Type"]>>
    ]
  ): this["~rebuild.out"] {
    return this.rebuild(AST.appendChecks(this.ast, checks))
  }
}

/** @internal */
export class make$<S extends Schema.Top> extends BottomBuilder<
  S["Type"],
  S["Encoded"],
  S["DecodingServices"],
  S["EncodingServices"],
  S["ast"],
  S["~rebuild.out"],
  S["~annotate.in"],
  S["~type.make.in"],
  S["Iso"],
  S["~type.make"],
  S["~type.mutability"],
  S["~type.optionality"],
  S["~type.constructor.default"],
  S["~encoded.mutability"],
  S["~encoded.optionality"]
> {
  readonly rebuild: (ast: S["ast"]) => S["~rebuild.out"]

  constructor(
    ast: S["ast"],
    rebuild: (ast: S["ast"]) => S["~rebuild.out"]
  ) {
    super(ast)
    this.rebuild = rebuild
  }
}

export function make<S extends Schema.Top>(ast: S["ast"]): Schema.Bottom<
  S["Type"],
  S["Encoded"],
  S["DecodingServices"],
  S["EncodingServices"],
  S["ast"],
  S["~rebuild.out"],
  S["~annotate.in"],
  S["~type.make.in"],
  S["Iso"],
  S["~type.make"],
  S["~type.mutability"],
  S["~type.optionality"],
  S["~type.constructor.default"],
  S["~encoded.mutability"],
  S["~encoded.optionality"]
> {
  const rebuild = (ast: AST.AST) => new make$<S>(ast, rebuild)
  return rebuild(ast)
}
