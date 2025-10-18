/**
 * @since 4.0.0
 */

import * as ast from "../../schema/AST.ts"
import * as Schema from "../../schema/Schema.ts"
import * as Transformation from "../../schema/Transformation.ts"

/**
 * @since 4.0.0
 */
export const Declaration = Schema.instanceOf(
  ast.Declaration,
  {
    identifier: "Declaration",
    "~sentinels": [{ key: "_tag", literal: "Declaration" }]
  }
)

// TODO: do this for all of the other schemas
const NullIso = Schema.Struct({
  _tag: Schema.tag("Null")
})

/**
 * @since 4.0.0
 */
export const Null = Schema.instanceOf<typeof ast.Null, typeof NullIso["Iso"]>(
  ast.Null,
  {
    identifier: "Null",
    "~sentinels": [{ key: "_tag", literal: "Null" }],
    serializer: () =>
      Schema.link<ast.Null>()(
        NullIso,
        Transformation.transform({
          decode: () => ast.null,
          encode: () => ({ _tag: "Null" }) as const
        })
      )
  }
)

/**
 * @since 4.0.0
 */
export const Undefined = Schema.instanceOf(
  ast.Undefined,
  {
    identifier: "Undefined",
    "~sentinels": [{ key: "_tag", literal: "Undefined" }],
    serializer: () =>
      Schema.link<ast.Undefined>()(
        Schema.Struct({
          _tag: Schema.tag("Undefined")
        }),
        Transformation.transform({
          decode: () => ast.undefined,
          encode: () => ({ _tag: "Undefined" }) as const
        })
      )
  }
)

/**
 * @since 4.0.0
 */
export const Void = Schema.instanceOf(
  ast.Void,
  {
    identifier: "Void",
    "~sentinels": [{ key: "_tag", literal: "Void" }],
    serializer: () =>
      Schema.link<ast.Void>()(
        Schema.Struct({
          _tag: Schema.tag("Void")
        }),
        Transformation.transform({
          decode: () => ast.void,
          encode: () => ({ _tag: "Void" }) as const
        })
      )
  }
)

/**
 * @since 4.0.0
 */
export const Never = Schema.instanceOf(
  ast.Never,
  {
    identifier: "Never",
    "~sentinels": [{ key: "_tag", literal: "Never" }],
    serializer: () =>
      Schema.link<ast.Never>()(
        Schema.Struct({
          _tag: Schema.tag("Never")
        }),
        Transformation.transform({
          decode: () => ast.never,
          encode: () => ({ _tag: "Never" }) as const
        })
      )
  }
)

/**
 * @since 4.0.0
 */
export const Unknown = Schema.instanceOf(
  ast.Unknown,
  {
    identifier: "Unknown",
    "~sentinels": [{ key: "_tag", literal: "Unknown" }],
    serializer: () =>
      Schema.link<ast.Unknown>()(
        Schema.Struct({
          _tag: Schema.tag("Unknown")
        }),
        Transformation.transform({
          decode: () => ast.unknown,
          encode: () => ({ _tag: "Unknown" }) as const
        })
      )
  }
)

/**
 * @since 4.0.0
 */
export const Any = Schema.instanceOf(
  ast.Any,
  {
    identifier: "Any",
    "~sentinels": [{ key: "_tag", literal: "Any" }],
    serializer: () =>
      Schema.link<ast.Any>()(
        Schema.Struct({
          _tag: Schema.tag("Any")
        }),
        Transformation.transform({
          decode: () => ast.any,
          encode: () => ({ _tag: "Any" }) as const
        })
      )
  }
)

/**
 * @since 4.0.0
 */
export const String = Schema.instanceOf(
  ast.String,
  {
    identifier: "String",
    "~sentinels": [{ key: "_tag", literal: "String" }],
    serializer: () =>
      Schema.link<ast.String>()(
        Schema.Struct({
          _tag: Schema.tag("String")
        }),
        Transformation.transform({
          decode: () => ast.string,
          encode: () => ({ _tag: "String" }) as const
        })
      )
  }
)

/**
 * @since 4.0.0
 */
export const Number = Schema.instanceOf(
  ast.Number,
  {
    identifier: "Number",
    "~sentinels": [{ key: "_tag", literal: "Number" }],
    serializer: () =>
      Schema.link<ast.Number>()(
        Schema.Struct({
          _tag: Schema.tag("Number")
        }),
        Transformation.transform({
          decode: () => ast.number,
          encode: () => ({ _tag: "Number" }) as const
        })
      )
  }
)

/**
 * @since 4.0.0
 */
export const Boolean = Schema.instanceOf(
  ast.Boolean,
  {
    identifier: "Boolean",
    "~sentinels": [{ key: "_tag", literal: "Boolean" }],
    serializer: () =>
      Schema.link<ast.Boolean>()(
        Schema.Struct({
          _tag: Schema.tag("Boolean")
        }),
        Transformation.transform({
          decode: () => ast.boolean,
          encode: () => ({ _tag: "Boolean" }) as const
        })
      )
  }
)

/**
 * @since 4.0.0
 */
export const BigInt = Schema.instanceOf(
  ast.BigInt,
  {
    identifier: "BigInt",
    "~sentinels": [{ key: "_tag", literal: "BigInt" }],
    serializer: () =>
      Schema.link<ast.BigInt>()(
        Schema.Struct({
          _tag: Schema.tag("BigInt")
        }),
        Transformation.transform({
          decode: () => ast.bigInt,
          encode: () => ({ _tag: "BigInt" }) as const
        })
      )
  }
)

/**
 * @since 4.0.0
 */
export const Symbol = Schema.instanceOf(
  ast.Symbol,
  {
    identifier: "Symbol",
    "~sentinels": [{ key: "_tag", literal: "Symbol" }],
    serializer: () =>
      Schema.link<ast.Symbol>()(
        Schema.Struct({
          _tag: Schema.tag("Symbol")
        }),
        Transformation.transform({
          decode: () => ast.symbol,
          encode: () => ({ _tag: "Symbol" }) as const
        })
      )
  }
)

/**
 * @since 4.0.0
 */
export const Literal = Schema.instanceOf(
  ast.Literal,
  {
    identifier: "Literal",
    "~sentinels": [{ key: "_tag", literal: "Literal" }],
    serializer: () =>
      Schema.link<ast.Literal>()(
        Schema.Struct({
          _tag: Schema.tag("Literal"),
          literal: Schema.Union([Schema.String, Schema.Number, Schema.Boolean, Schema.BigInt])
        }),
        Transformation.transform({
          decode: (i) => new ast.Literal(i.literal),
          encode: (a) => ({ _tag: "Literal", literal: a.literal }) as const
        })
      )
  }
)

/**
 * @since 4.0.0
 */
export const UniqueSymbol = Schema.instanceOf(
  ast.UniqueSymbol,
  {
    identifier: "UniqueSymbol",
    "~sentinels": [{ key: "_tag", literal: "UniqueSymbol" }],
    serializer: () =>
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
)

/**
 * @since 4.0.0
 */
export const ObjectKeyword = Schema.instanceOf(
  ast.ObjectKeyword,
  {
    identifier: "ObjectKeyword",
    "~sentinels": [{ key: "_tag", literal: "ObjectKeyword" }],
    serializer: () =>
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
)

/**
 * @since 4.0.0
 */
export const Enum = Schema.instanceOf(
  ast.Enum,
  {
    identifier: "Enum",
    "~sentinels": [{ key: "_tag", literal: "Enum" }],
    serializer: () =>
      Schema.link<ast.Enum>()(
        Schema.Struct({
          _tag: Schema.tag("Enum"),
          enums: Schema.Array(Schema.Tuple([Schema.String, Schema.Union([Schema.String, Schema.Number])]))
        }),
        Transformation.transform({
          decode: (i) => new ast.Enum(i.enums),
          encode: (a) => ({ _tag: "Enum", enums: a.enums }) as const
        })
      )
  }
)

const SuspendedAST: Schema.Codec<ast.AST> = Schema.suspend(() => AST)

/**
 * @since 4.0.0
 */
export const TemplateLiteral = Schema.instanceOf(
  ast.TemplateLiteral,
  {
    identifier: "TemplateLiteral",
    "~sentinels": [{ key: "_tag", literal: "TemplateLiteral" }],
    serializer: () =>
      Schema.link<ast.TemplateLiteral>()(
        Schema.Struct({
          _tag: Schema.tag("TemplateLiteral"),
          parts: Schema.Array(SuspendedAST)
        }),
        Transformation.transform({
          decode: (i) => new ast.TemplateLiteral(i.parts),
          encode: (a) => ({ _tag: "TemplateLiteral", parts: a.parts }) as const
        })
      )
  }
)

/**
 * @since 4.0.0
 */
export const Arrays = Schema.instanceOf(
  ast.Arrays,
  {
    identifier: "Arrays",
    "~sentinels": [{ key: "_tag", literal: "Arrays" }],
    serializer: () =>
      Schema.link<ast.Arrays>()(
        Schema.Struct({
          _tag: Schema.tag("Arrays"),
          isMutable: Schema.Boolean,
          elements: Schema.Array(SuspendedAST),
          rest: Schema.Array(SuspendedAST)
        }),
        Transformation.transform({
          decode: (i) => new ast.Arrays(i.isMutable, i.elements, i.rest),
          encode: (a) => ({ _tag: "Arrays", isMutable: a.isMutable, elements: a.elements, rest: a.rest }) as const
        })
      )
  }
)

const PropertySignature = Schema.Struct({
  name: Schema.Union([Schema.String, Schema.Number, Schema.Symbol]),
  type: SuspendedAST
})

/**
 * @since 4.0.0
 */
export const Objects = Schema.instanceOf(
  ast.Objects,
  {
    identifier: "Objects",
    "~sentinels": [{ key: "_tag", literal: "Objects" }],
    serializer: () =>
      Schema.link<ast.Objects>()(
        Schema.Struct({
          _tag: Schema.tag("Objects"),
          propertySignatures: Schema.Array(PropertySignature)
        }),
        Transformation.transform({
          decode: (i) =>
            new ast.Objects(
              i.propertySignatures.map(({ name, type }) => new ast.PropertySignature(name, type)),
              []
            ),
          encode: (a) => ({ _tag: "Objects", propertySignatures: a.propertySignatures }) as const
        })
      )
  }
)

/**
 * @since 4.0.0
 */
export const Union = Schema.instanceOf(
  ast.Union,
  {
    identifier: "Union",
    "~sentinels": [{ key: "_tag", literal: "Union" }],
    serializer: () =>
      Schema.link<ast.Union>()(
        Schema.Struct({
          _tag: Schema.tag("Union"),
          mode: Schema.Literals(["anyOf", "oneOf"]),
          types: Schema.Array(SuspendedAST)
        }),
        Transformation.transform({
          decode: (i) => new ast.Union(i.types, i.mode),
          encode: (a) => ({ _tag: "Union", mode: a.mode, types: a.types }) as const
        })
      )
  }
)

/**
 * @since 4.0.0
 */
export const Suspend = Schema.instanceOf(
  ast.Suspend,
  {
    identifier: "Suspend",
    "~sentinels": [{ key: "_tag", literal: "Suspend" }]
  }
)

/**
 * @since 4.0.0
 */
export const AST = Schema.Union([
  Declaration,
  Null,
  Undefined,
  Void,
  Never,
  Unknown,
  Any,
  String,
  Number,
  Boolean,
  BigInt,
  Symbol,
  Literal,
  UniqueSymbol,
  ObjectKeyword,
  Enum,
  TemplateLiteral,
  Arrays,
  Objects,
  Union,
  Suspend
]).annotate({ identifier: "AST" })

/**
 * @since 4.0.0
 */
export const serializer = Schema.makeSerializerJson(AST)
