/**
 * @since 4.0.0
 */

import * as ast from "./AST.js"
import * as Schema from "./Schema.js"
import * as Serializer from "./Serializer.js"
import * as Transformation from "./Transformation.js"

/**
 * @since 4.0.0
 */
export const Declaration = Schema.instanceOf({
  constructor: ast.Declaration,
  annotations: {
    identifier: "Declaration",
    "~sentinels": [{ key: "_tag", literal: "Declaration" }]
  }
})

/**
 * @since 4.0.0
 */
export const NullKeyword = Schema.instanceOf({
  constructor: ast.NullKeyword,
  annotations: {
    identifier: "NullKeyword",
    "~sentinels": [{ key: "_tag", literal: "NullKeyword" }],
    defaultJsonSerializer: () =>
      Schema.link<ast.NullKeyword>()(
        Schema.Struct({
          _tag: Schema.tag("NullKeyword")
        }),
        Transformation.transform({
          decode: () => ast.nullKeyword,
          encode: () => ({ _tag: "NullKeyword" }) as const
        })
      )
  }
})

/**
 * @since 4.0.0
 */
export const UndefinedKeyword = Schema.instanceOf({
  constructor: ast.UndefinedKeyword,
  annotations: {
    identifier: "UndefinedKeyword",
    "~sentinels": [{ key: "_tag", literal: "UndefinedKeyword" }],
    defaultJsonSerializer: () =>
      Schema.link<ast.UndefinedKeyword>()(
        Schema.Struct({
          _tag: Schema.tag("UndefinedKeyword")
        }),
        Transformation.transform({
          decode: () => ast.undefinedKeyword,
          encode: () => ({ _tag: "UndefinedKeyword" }) as const
        })
      )
  }
})

/**
 * @since 4.0.0
 */
export const VoidKeyword = Schema.instanceOf({
  constructor: ast.VoidKeyword,
  annotations: {
    identifier: "VoidKeyword",
    "~sentinels": [{ key: "_tag", literal: "VoidKeyword" }],
    defaultJsonSerializer: () =>
      Schema.link<ast.VoidKeyword>()(
        Schema.Struct({
          _tag: Schema.tag("VoidKeyword")
        }),
        Transformation.transform({
          decode: () => ast.voidKeyword,
          encode: () => ({ _tag: "VoidKeyword" }) as const
        })
      )
  }
})

/**
 * @since 4.0.0
 */
export const NeverKeyword = Schema.instanceOf({
  constructor: ast.NeverKeyword,
  annotations: {
    identifier: "NeverKeyword",
    "~sentinels": [{ key: "_tag", literal: "NeverKeyword" }],
    defaultJsonSerializer: () =>
      Schema.link<ast.NeverKeyword>()(
        Schema.Struct({
          _tag: Schema.tag("NeverKeyword")
        }),
        Transformation.transform({
          decode: () => ast.neverKeyword,
          encode: () => ({ _tag: "NeverKeyword" }) as const
        })
      )
  }
})

/**
 * @since 4.0.0
 */
export const UnknownKeyword = Schema.instanceOf({
  constructor: ast.UnknownKeyword,
  annotations: {
    identifier: "UnknownKeyword",
    "~sentinels": [{ key: "_tag", literal: "UnknownKeyword" }],
    defaultJsonSerializer: () =>
      Schema.link<ast.UnknownKeyword>()(
        Schema.Struct({
          _tag: Schema.tag("UnknownKeyword")
        }),
        Transformation.transform({
          decode: () => ast.unknownKeyword,
          encode: () => ({ _tag: "UnknownKeyword" }) as const
        })
      )
  }
})

/**
 * @since 4.0.0
 */
export const AnyKeyword = Schema.instanceOf({
  constructor: ast.AnyKeyword,
  annotations: {
    identifier: "AnyKeyword",
    "~sentinels": [{ key: "_tag", literal: "AnyKeyword" }],
    defaultJsonSerializer: () =>
      Schema.link<ast.AnyKeyword>()(
        Schema.Struct({
          _tag: Schema.tag("AnyKeyword")
        }),
        Transformation.transform({
          decode: () => ast.anyKeyword,
          encode: () => ({ _tag: "AnyKeyword" }) as const
        })
      )
  }
})

/**
 * @since 4.0.0
 */
export const StringKeyword = Schema.instanceOf({
  constructor: ast.StringKeyword,
  annotations: {
    identifier: "StringKeyword",
    "~sentinels": [{ key: "_tag", literal: "StringKeyword" }],
    defaultJsonSerializer: () =>
      Schema.link<ast.StringKeyword>()(
        Schema.Struct({
          _tag: Schema.tag("StringKeyword")
        }),
        Transformation.transform({
          decode: () => ast.stringKeyword,
          encode: () => ({ _tag: "StringKeyword" }) as const
        })
      )
  }
})

/**
 * @since 4.0.0
 */
export const NumberKeyword = Schema.instanceOf({
  constructor: ast.NumberKeyword,
  annotations: {
    identifier: "NumberKeyword",
    "~sentinels": [{ key: "_tag", literal: "NumberKeyword" }],
    defaultJsonSerializer: () =>
      Schema.link<ast.NumberKeyword>()(
        Schema.Struct({
          _tag: Schema.tag("NumberKeyword")
        }),
        Transformation.transform({
          decode: () => ast.numberKeyword,
          encode: () => ({ _tag: "NumberKeyword" }) as const
        })
      )
  }
})

/**
 * @since 4.0.0
 */
export const BooleanKeyword = Schema.instanceOf({
  constructor: ast.BooleanKeyword,
  annotations: {
    identifier: "BooleanKeyword",
    "~sentinels": [{ key: "_tag", literal: "BooleanKeyword" }],
    defaultJsonSerializer: () =>
      Schema.link<ast.BooleanKeyword>()(
        Schema.Struct({
          _tag: Schema.tag("BooleanKeyword")
        }),
        Transformation.transform({
          decode: () => ast.booleanKeyword,
          encode: () => ({ _tag: "BooleanKeyword" }) as const
        })
      )
  }
})

/**
 * @since 4.0.0
 */
export const BigIntKeyword = Schema.instanceOf({
  constructor: ast.BigIntKeyword,
  annotations: {
    identifier: "BigIntKeyword",
    "~sentinels": [{ key: "_tag", literal: "BigIntKeyword" }],
    defaultJsonSerializer: () =>
      Schema.link<ast.BigIntKeyword>()(
        Schema.Struct({
          _tag: Schema.tag("BigIntKeyword")
        }),
        Transformation.transform({
          decode: () => ast.bigIntKeyword,
          encode: () => ({ _tag: "BigIntKeyword" }) as const
        })
      )
  }
})

/**
 * @since 4.0.0
 */
export const SymbolKeyword = Schema.instanceOf({
  constructor: ast.SymbolKeyword,
  annotations: {
    identifier: "SymbolKeyword",
    "~sentinels": [{ key: "_tag", literal: "SymbolKeyword" }],
    defaultJsonSerializer: () =>
      Schema.link<ast.SymbolKeyword>()(
        Schema.Struct({
          _tag: Schema.tag("SymbolKeyword")
        }),
        Transformation.transform({
          decode: () => ast.symbolKeyword,
          encode: () => ({ _tag: "SymbolKeyword" }) as const
        })
      )
  }
})

/**
 * @since 4.0.0
 */
export const LiteralType = Schema.instanceOf({
  constructor: ast.LiteralType,
  annotations: {
    identifier: "LiteralType",
    "~sentinels": [{ key: "_tag", literal: "LiteralType" }],
    defaultJsonSerializer: () =>
      Schema.link<ast.LiteralType>()(
        Schema.Struct({
          _tag: Schema.tag("LiteralType"),
          literal: Schema.Union([Schema.String, Schema.Number, Schema.Boolean, Schema.BigInt])
        }),
        Transformation.transform({
          decode: (i) => new ast.LiteralType(i.literal),
          encode: (a) => ({ _tag: "LiteralType", literal: a.literal }) as const
        })
      )
  }
})

/**
 * @since 4.0.0
 */
export const UniqueSymbol = Schema.instanceOf({
  constructor: ast.UniqueSymbol,
  annotations: {
    identifier: "UniqueSymbol",
    "~sentinels": [{ key: "_tag", literal: "UniqueSymbol" }],
    defaultJsonSerializer: () =>
      Schema.link<ast.UniqueSymbol>()(
        Schema.Struct({
          _tag: Schema.tag("UniqueSymbol"),
          symbol: Schema.Symbol
        }),
        Transformation.transform({
          decode: (i) => new ast.UniqueSymbol(i.symbol),
          encode: (a) => ({ _tag: "UniqueSymbol", symbol: a.symbol }) as const
        })
      )
  }
})

/**
 * @since 4.0.0
 */
export const ObjectKeyword = Schema.instanceOf({
  constructor: ast.ObjectKeyword,
  annotations: {
    identifier: "ObjectKeyword",
    "~sentinels": [{ key: "_tag", literal: "ObjectKeyword" }],
    defaultJsonSerializer: () =>
      Schema.link<ast.ObjectKeyword>()(
        Schema.Struct({
          _tag: Schema.tag("ObjectKeyword")
        }),
        Transformation.transform({
          decode: () => ast.objectKeyword,
          encode: () => ({ _tag: "ObjectKeyword" }) as const
        })
      )
  }
})

/**
 * @since 4.0.0
 */
export const Enums = Schema.instanceOf({
  constructor: ast.Enums,
  annotations: {
    identifier: "Enums",
    "~sentinels": [{ key: "_tag", literal: "Enums" }],
    defaultJsonSerializer: () =>
      Schema.link<ast.Enums>()(
        Schema.Struct({
          _tag: Schema.tag("Enums"),
          enums: Schema.Array(Schema.Tuple([Schema.String, Schema.Union([Schema.String, Schema.Number])]))
        }),
        Transformation.transform({
          decode: (i) => new ast.Enums(i.enums),
          encode: (a) => ({ _tag: "Enums", enums: a.enums }) as const
        })
      )
  }
})

const SuspendedAST: Schema.Codec<ast.AST> = Schema.suspend(() => AST)

/**
 * @since 4.0.0
 */
export const TemplateLiteral = Schema.instanceOf({
  constructor: ast.TemplateLiteral,
  annotations: {
    identifier: "TemplateLiteral",
    "~sentinels": [{ key: "_tag", literal: "TemplateLiteral" }],
    defaultJsonSerializer: () =>
      Schema.link<ast.TemplateLiteral>()(
        Schema.Struct({
          _tag: Schema.tag("TemplateLiteral"),
          parts: Schema.Array(
            Schema.Union([SuspendedAST, Schema.String, Schema.Number, Schema.BigInt])
          )
        }),
        Transformation.transform({
          decode: (i) => new ast.TemplateLiteral(i.parts),
          encode: (a) => ({ _tag: "TemplateLiteral", parts: a.parts }) as const
        })
      )
  }
})

/**
 * @since 4.0.0
 */
export const TupleType = Schema.instanceOf({
  constructor: ast.TupleType,
  annotations: {
    identifier: "TupleType",
    "~sentinels": [{ key: "_tag", literal: "TupleType" }],
    defaultJsonSerializer: () =>
      Schema.link<ast.TupleType>()(
        Schema.Struct({
          _tag: Schema.tag("TupleType"),
          isMutable: Schema.Boolean,
          elements: Schema.Array(SuspendedAST),
          rest: Schema.Array(SuspendedAST)
        }),
        Transformation.transform({
          decode: (i) => new ast.TupleType(i.isMutable, i.elements, i.rest),
          encode: (a) => ({ _tag: "TupleType", isMutable: a.isMutable, elements: a.elements, rest: a.rest }) as const
        })
      )
  }
})

const PropertySignature = Schema.Struct({
  name: Schema.Union([Schema.String, Schema.Number, Schema.Symbol]),
  type: SuspendedAST
})

/**
 * @since 4.0.0
 */
export const TypeLiteral = Schema.instanceOf({
  constructor: ast.TypeLiteral,
  annotations: {
    identifier: "TypeLiteral",
    "~sentinels": [{ key: "_tag", literal: "TypeLiteral" }],
    defaultJsonSerializer: () =>
      Schema.link<ast.TypeLiteral>()(
        Schema.Struct({
          _tag: Schema.tag("TypeLiteral"),
          propertySignatures: Schema.Array(PropertySignature)
        }),
        Transformation.transform({
          decode: (i) =>
            new ast.TypeLiteral(
              i.propertySignatures.map(({ name, type }) => new ast.PropertySignature(name, type)),
              []
            ),
          encode: (a) => ({ _tag: "TypeLiteral", propertySignatures: a.propertySignatures }) as const
        })
      )
  }
})

/**
 * @since 4.0.0
 */
export const UnionType = Schema.instanceOf({
  constructor: ast.UnionType,
  annotations: {
    identifier: "UnionType",
    "~sentinels": [{ key: "_tag", literal: "UnionType" }],
    defaultJsonSerializer: () =>
      Schema.link<ast.UnionType>()(
        Schema.Struct({
          _tag: Schema.tag("UnionType"),
          mode: Schema.Literals(["anyOf", "oneOf"]),
          types: Schema.Array(SuspendedAST)
        }),
        Transformation.transform({
          decode: (i) => new ast.UnionType(i.types, i.mode),
          encode: (a) => ({ _tag: "UnionType", mode: a.mode, types: a.types }) as const
        })
      )
  }
})

/**
 * @since 4.0.0
 */
export const Suspend = Schema.instanceOf({
  constructor: ast.Suspend,
  annotations: {
    identifier: "Suspend",
    "~sentinels": [{ key: "_tag", literal: "Suspend" }]
  }
})

/**
 * @since 4.0.0
 */
export const AST = Schema.Union([
  Declaration,
  NullKeyword,
  UndefinedKeyword,
  VoidKeyword,
  NeverKeyword,
  UnknownKeyword,
  AnyKeyword,
  StringKeyword,
  NumberKeyword,
  BooleanKeyword,
  BigIntKeyword,
  SymbolKeyword,
  LiteralType,
  UniqueSymbol,
  ObjectKeyword,
  Enums,
  TemplateLiteral,
  TupleType,
  TypeLiteral,
  UnionType,
  Suspend
]).annotate({ identifier: "AST" })

/**
 * @since 4.0.0
 */
export const serializer = Serializer.json(AST)
