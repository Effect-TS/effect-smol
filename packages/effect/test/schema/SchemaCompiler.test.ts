import { assert, describe, it } from "@effect/vitest"
import { Schema, SchemaCompiler } from "effect"

describe("SchemaCompiler", () => {
  it("compiles primitive, literal, enum, and template literal schemas", () => {
    const isString = SchemaCompiler.compileTypeGuard(Schema.String)
    assert.strictEqual(isString("a"), true)
    assert.strictEqual(isString(1), false)

    const isLiteral = SchemaCompiler.compileTypeGuard(Schema.Literal("ok"))
    assert.strictEqual(isLiteral("ok"), true)
    assert.strictEqual(isLiteral("no"), false)

    const isEnum = SchemaCompiler.compileTypeGuard(Schema.Enum({ A: "A", B: 1 }))
    assert.strictEqual(isEnum("A"), true)
    assert.strictEqual(isEnum(1), true)
    assert.strictEqual(isEnum("B"), false)

    const isPath = SchemaCompiler.compileTypeGuard(Schema.TemplateLiteral(["/users/", Schema.Number]))
    assert.strictEqual(isPath("/users/123"), true)
    assert.strictEqual(isPath("/users/a"), false)
  })

  it("compiles keyword schemas", () => {
    const isAny = SchemaCompiler.compileTypeGuard(Schema.Any)
    assert.strictEqual(isAny(undefined), true)
    assert.strictEqual(isAny(Symbol.for("any")), true)

    const isUnknown = SchemaCompiler.compileTypeGuard(Schema.Unknown)
    assert.strictEqual(isUnknown(null), true)
    assert.strictEqual(isUnknown({}), true)

    const isNever = SchemaCompiler.compileTypeGuard(Schema.Never)
    assert.strictEqual(isNever(undefined), false)
    assert.strictEqual(isNever("a"), false)

    const isNull = SchemaCompiler.compileTypeGuard(Schema.Null)
    assert.strictEqual(isNull(null), true)
    assert.strictEqual(isNull(undefined), false)

    const isUndefined = SchemaCompiler.compileTypeGuard(Schema.Undefined)
    assert.strictEqual(isUndefined(undefined), true)
    assert.strictEqual(isUndefined(null), false)

    const isVoid = SchemaCompiler.compileTypeGuard(Schema.Void)
    assert.strictEqual(isVoid(undefined), true)
    assert.strictEqual(isVoid(null), false)

    const isObjectKeyword = SchemaCompiler.compileTypeGuard(Schema.ObjectKeyword)
    assert.strictEqual(isObjectKeyword({}), true)
    assert.strictEqual(isObjectKeyword(() => undefined), true)
    assert.strictEqual(isObjectKeyword(null), false)

    const isBoolean = SchemaCompiler.compileTypeGuard(Schema.Boolean)
    assert.strictEqual(isBoolean(true), true)
    assert.strictEqual(isBoolean("true"), false)

    const isBigInt = SchemaCompiler.compileTypeGuard(Schema.BigInt)
    assert.strictEqual(isBigInt(1n), true)
    assert.strictEqual(isBigInt(1), false)

    const isSymbol = SchemaCompiler.compileTypeGuard(Schema.Symbol)
    assert.strictEqual(isSymbol(Symbol.for("symbol")), true)
    assert.strictEqual(isSymbol("symbol"), false)

    const unique = Symbol("unique")
    const isUniqueSymbol = SchemaCompiler.compileTypeGuard(Schema.UniqueSymbol(unique))
    assert.strictEqual(isUniqueSymbol(unique), true)
    assert.strictEqual(isUniqueSymbol(Symbol("unique")), false)
  })

  it("caches successful compiles by type-side AST", () => {
    const schema = Schema.Struct({ a: Schema.String })
    const defaultGuard = SchemaCompiler.compileTypeGuard(schema)
    const simpleInputsGuard = SchemaCompiler.compileTypeGuard(schema, { simpleInputs: true })
    const strictGuard = SchemaCompiler.compileTypeGuard(schema, { strict: true })
    const strictSimpleInputsGuard = SchemaCompiler.compileTypeGuard(schema, { simpleInputs: true, strict: true })

    assert.strictEqual(defaultGuard, SchemaCompiler.compileTypeGuard(schema))
    assert.strictEqual(simpleInputsGuard, SchemaCompiler.compileTypeGuard(schema, { simpleInputs: true }))
    assert.strictEqual(strictGuard, SchemaCompiler.compileTypeGuard(schema, { strict: true }))
    assert.strictEqual(
      strictSimpleInputsGuard,
      SchemaCompiler.compileTypeGuard(schema, { simpleInputs: true, strict: true })
    )
    assert.notStrictEqual(defaultGuard, simpleInputsGuard)
    assert.notStrictEqual(defaultGuard, strictGuard)
    assert.notStrictEqual(defaultGuard, strictSimpleInputsGuard)
    assert.notStrictEqual(simpleInputsGuard, strictGuard)
    assert.notStrictEqual(simpleInputsGuard, strictSimpleInputsGuard)
    assert.notStrictEqual(strictGuard, strictSimpleInputsGuard)
  })

  it("validates the type side of transformed schemas", () => {
    const isNumber = SchemaCompiler.compileTypeGuard(Schema.NumberFromString)
    assert.strictEqual(isNumber(1), true)
    assert.strictEqual(isNumber("1"), false)
  })

  it("matches struct own-property and optionality semantics", () => {
    const schema = Schema.Struct({
      required: Schema.String,
      optionalKey: Schema.optionalKey(Schema.String),
      optional: Schema.optional(Schema.String)
    })
    const is = SchemaCompiler.compileTypeGuard(schema)

    assert.strictEqual(is({ required: "a" }), true)
    assert.strictEqual(is({ required: "a", extra: 1 }), true)
    assert.strictEqual(is({ required: "a", optionalKey: undefined }), false)
    assert.strictEqual(is({ required: "a", optional: undefined }), true)

    const inherited = Object.create({ required: "a" })
    assert.strictEqual(is(inherited), false)

    const objectPrototype = Object.prototype as Record<string, unknown>
    const pollutedRequired = "schemaCompilerPollutedRequired"
    const isPollutedRequired = SchemaCompiler.compileTypeGuard(Schema.Struct({ [pollutedRequired]: Schema.String }))
    Object.defineProperty(objectPrototype, pollutedRequired, { configurable: true, value: "a" })
    const pollutedRequiredResult = isPollutedRequired({})
    delete objectPrototype[pollutedRequired]
    assert.strictEqual(pollutedRequiredResult, false)

    const pollutedOptional = "schemaCompilerPollutedOptional"
    const isPollutedOptional = SchemaCompiler.compileTypeGuard(Schema.Struct({
      required: Schema.String,
      [pollutedOptional]: Schema.optional(Schema.String)
    }))
    Object.defineProperty(objectPrototype, pollutedOptional, { configurable: true, value: 1 })
    const pollutedOptionalResult = isPollutedOptional({ required: "a" })
    delete objectPrototype[pollutedOptional]
    assert.strictEqual(pollutedOptionalResult, true)
  })

  it("supports strict mode", () => {
    const schema = Schema.Struct({
      a: Schema.Number,
      nested: Schema.Struct({ b: Schema.String })
    })
    const isLoose = SchemaCompiler.compileTypeGuard(schema)
    const isStrict = SchemaCompiler.compileTypeGuard(schema, { strict: true })
    const isStrictSimple = SchemaCompiler.compileTypeGuard(schema, { simpleInputs: true, strict: true })

    assert.strictEqual(isLoose({ a: 1, nested: { b: "b" }, extra: 1 }), true)
    assert.strictEqual(isStrict({ a: 1, nested: { b: "b" } }), true)
    assert.strictEqual(isStrict({ a: 1, nested: { b: "b" }, extra: 1 }), false)
    assert.strictEqual(isStrict({ a: 1, nested: { b: "b", extra: 1 } }), false)
    assert.strictEqual(isStrictSimple({ a: 1, nested: { b: "b" } }), true)
    assert.strictEqual(isStrictSimple({ a: 1, nested: { b: "b" }, extra: 1 }), false)
    assert.strictEqual(isStrictSimple({ a: 1, nested: { b: "b", extra: 1 } }), false)

    const symbol = Symbol.for("schema-compiler-extra")
    assert.strictEqual(isStrict({ a: 1, nested: { b: "b" }, [symbol]: 1 }), false)
    assert.strictEqual(isStrict({ a: 1, nested: { b: "b", [symbol]: 1 } }), false)
  })

  it("preserves empty struct type-side semantics with strict mode", () => {
    const is = SchemaCompiler.compileTypeGuard(Schema.Struct({}), { strict: true })

    assert.strictEqual(is({ a: 1 }), true)
    assert.strictEqual(is([]), true)
    assert.strictEqual(is(1), true)
    assert.strictEqual(is(null), false)
    assert.strictEqual(is(undefined), false)
  })

  it("validates nested structs without inherited fields", () => {
    const is = SchemaCompiler.compileTypeGuard(Schema.Struct({
      nested: Schema.Struct({ value: Schema.String })
    }))

    assert.strictEqual(is({ nested: { value: "a" } }), true)
    assert.strictEqual(is({ nested: { value: 1 } }), false)
    assert.strictEqual(is({ nested: Object.create({ value: "a" }) }), false)
  })

  it("validates arrays and tuples", () => {
    const isArray = SchemaCompiler.compileTypeGuard(Schema.Array(Schema.String))
    assert.strictEqual(isArray(["a", "b"]), true)
    assert.strictEqual(isArray(["a", 1]), false)

    const isTuple = SchemaCompiler.compileTypeGuard(Schema.Tuple([Schema.String, Schema.optionalKey(Schema.Number)]))
    assert.strictEqual(isTuple(["a"]), true)
    assert.strictEqual(isTuple(["a", 1]), true)
    assert.strictEqual(isTuple(["a", 1, 2]), false)

    const sparse = new Array(1)
    assert.strictEqual(isTuple(sparse), false)
  })

  it("validates TupleWithRest", () => {
    const is = SchemaCompiler.compileTypeGuard(
      Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Boolean, Schema.String])
    )

    assert.strictEqual(is(["a", "tail"]), true)
    assert.strictEqual(is(["a", true, "tail"]), true)
    assert.strictEqual(is(["a", true, true, "tail"]), true)
    assert.strictEqual(is(["a"]), false)
    assert.strictEqual(is(["a", true]), false)
    assert.strictEqual(is(["a", "tail", "extra"]), false)
  })

  it("validates records and symbol keys", () => {
    const isRecord = SchemaCompiler.compileTypeGuard(Schema.Record(Schema.String, Schema.Number))
    assert.strictEqual(isRecord({ a: 1, b: 2 }), true)
    assert.strictEqual(isRecord({ a: 1, b: "b" }), false)

    const symbol = Symbol.for("key")
    const isSymbolRecord = SchemaCompiler.compileTypeGuard(Schema.Record(Schema.Symbol, Schema.String))
    assert.strictEqual(isSymbolRecord({ [symbol]: "value" }), true)
    assert.strictEqual(isSymbolRecord({ [symbol]: 1 }), false)

    const isNumberRecord = SchemaCompiler.compileTypeGuard(Schema.Record(Schema.Number, Schema.String))
    assert.strictEqual(isNumberRecord({ "1": "a", "-2": "b" }), true)
    assert.strictEqual(isNumberRecord({ "1": 1 }), false)

    const isTemplateRecord = SchemaCompiler.compileTypeGuard(
      Schema.Record(Schema.TemplateLiteral(["x-", Schema.String]), Schema.Number)
    )
    assert.strictEqual(isTemplateRecord({ "x-a": 1 }), true)
    assert.strictEqual(isTemplateRecord({ "x-a": "a" }), false)

    const unionKey = Symbol.for("union-key")
    const isStringOrSymbolRecord = SchemaCompiler.compileTypeGuard(
      Schema.Record(Schema.Union([Schema.String, Schema.Symbol]), Schema.Number)
    )
    assert.strictEqual(isStringOrSymbolRecord({ a: 1, [unionKey]: 2 }), true)
    assert.strictEqual(isStringOrSymbolRecord({ a: 1, [unionKey]: "a" }), false)
  })

  it("validates StructWithRest", () => {
    const isStringRest = SchemaCompiler.compileTypeGuard(
      Schema.StructWithRest(Schema.Struct({ a: Schema.Number }), [Schema.Record(Schema.String, Schema.Number)])
    )
    assert.strictEqual(isStringRest({ a: 1 }), true)
    assert.strictEqual(isStringRest({ a: 1, b: 2 }), true)
    assert.strictEqual(isStringRest({ a: 1, b: "b" }), false)
    assert.strictEqual(isStringRest({ b: 2 }), false)

    const symbol = Symbol.for("rest")
    const isSymbolRest = SchemaCompiler.compileTypeGuard(
      Schema.StructWithRest(Schema.Struct({ a: Schema.Number }), [Schema.Record(Schema.Symbol, Schema.String)])
    )
    assert.strictEqual(isSymbolRest({ a: 1, [symbol]: "value" }), true)
    assert.strictEqual(isSymbolRest({ a: 1, [symbol]: 1 }), false)
  })

  it("validates discriminated unions", () => {
    const schema = Schema.Union([
      Schema.Struct({ _tag: Schema.Literal("A"), a: Schema.String }),
      Schema.Struct({ _tag: Schema.Literal("B"), b: Schema.Number })
    ])
    const is = SchemaCompiler.compileTypeGuard(schema)

    assert.strictEqual(is({ _tag: "A", a: "a" }), true)
    assert.strictEqual(is({ _tag: "B", b: 1 }), true)
    assert.strictEqual(is({ _tag: "A", a: 1 }), false)
    assert.strictEqual(is({ _tag: "C" }), false)
  })

  it("validates non-discriminated and oneOf unions", () => {
    const isStringOrNumber = SchemaCompiler.compileTypeGuard(Schema.Union([Schema.String, Schema.Number]))
    assert.strictEqual(isStringOrNumber("a"), true)
    assert.strictEqual(isStringOrNumber(1), true)
    assert.strictEqual(isStringOrNumber(true), false)

    const isExactlyStringOrNonEmptyString = SchemaCompiler.compileTypeGuard(
      Schema.Union([Schema.String, Schema.NonEmptyString], { mode: "oneOf" })
    )
    assert.strictEqual(isExactlyStringOrNonEmptyString(""), true)
    assert.strictEqual(isExactlyStringOrNonEmptyString("a"), false)
    assert.strictEqual(isExactlyStringOrNonEmptyString(1), false)
  })

  it("validates built-in checks", () => {
    const isString = SchemaCompiler.compileTypeGuard(
      Schema.String.check(
        Schema.isStartsWith("a"),
        Schema.isIncludes("m"),
        Schema.isEndsWith("z"),
        Schema.isMinLength(3),
        Schema.isMaxLength(5)
      )
    )
    assert.strictEqual(isString("amz"), true)
    assert.strictEqual(isString("az"), false)
    assert.strictEqual(isString("amzzzz"), false)

    const isNumber = SchemaCompiler.compileTypeGuard(
      Schema.Number.check(
        Schema.isFinite(),
        Schema.isInt(),
        Schema.isGreaterThan(0),
        Schema.isLessThan(10),
        Schema.isMultipleOf(2)
      )
    )
    assert.strictEqual(isNumber(2), true)
    assert.strictEqual(isNumber(3), false)
    assert.strictEqual(isNumber(Infinity), false)

    const isBigInt = SchemaCompiler.compileTypeGuard(
      Schema.BigInt.check(
        Schema.isGreaterThanBigInt(0n),
        Schema.isLessThanOrEqualToBigInt(10n)
      )
    )
    assert.strictEqual(isBigInt(1n), true)
    assert.strictEqual(isBigInt(0n), false)
    assert.strictEqual(isBigInt(11n), false)

    const isArray = SchemaCompiler.compileTypeGuard(
      Schema.Array(Schema.String).check(Schema.isMinLength(1), Schema.isMaxLength(2))
    )
    assert.strictEqual(isArray(["a"]), true)
    assert.strictEqual(isArray([]), false)
    assert.strictEqual(isArray(["a", "b", "c"]), false)

    const isObject = SchemaCompiler.compileTypeGuard(
      Schema.Struct({ a: Schema.Number }).check(Schema.isPropertiesLengthBetween(1, 2))
    )
    assert.strictEqual(isObject({ a: 1 }), true)
    assert.strictEqual(isObject({ a: 1, b: 2 }), true)
    assert.strictEqual(isObject({ a: 1, b: 2, c: 3 }), false)
  })

  it("supports recursive schemas", () => {
    interface Category {
      readonly name: string
      readonly children: ReadonlyArray<Category>
    }

    const Category = Schema.Struct({
      name: Schema.String,
      children: Schema.Array(Schema.suspend((): Schema.Codec<Category> => Category))
    })
    const isCategory = SchemaCompiler.compileTypeGuard(Category)

    assert.strictEqual(isCategory({ name: "root", children: [] }), true)
    assert.strictEqual(isCategory({ name: "root", children: [{ name: "child", children: [] }] }), true)
    assert.strictEqual(isCategory({ name: "root", children: [{ name: 1, children: [] }] }), false)
  })

  it("uses opaque refs for custom filters and declarations", () => {
    const isEven = SchemaCompiler.compileTypeGuard(Schema.Number.check(Schema.makeFilter((n) => n % 2 === 0)))
    assert.strictEqual(isEven(2), true)
    assert.strictEqual(isEven(3), false)

    const isRegExp = SchemaCompiler.compileTypeGuard(Schema.RegExp)
    assert.strictEqual(isRegExp(/a/), true)
    assert.strictEqual(isRegExp("a"), false)
  })

  it("lets custom filter exceptions escape", () => {
    const is = SchemaCompiler.compileTypeGuard(Schema.Number.check(Schema.makeFilter(() => {
      throw new Error("boom")
    })))

    assert.throws(() => is(1), /boom/)
  })
})
