import * as Option from "effect/data/Option"
import * as Layer from "effect/Layer"
import * as ServiceMap from "effect/ServiceMap"
import * as String from "effect/String"
import type { JSONSchema } from "json-schema-typed"
import * as Utils from "./Utils.ts"

/**
 * Represents a JSONSchema which is not a primitive boolean.
 */
type JsonSchema = Exclude<JSONSchema, boolean>

export class JsonSchemaTransformer extends ServiceMap.Service<
  JsonSchemaTransformer,
  {
    supportsTopLevel(options: {
      readonly importName: string
      readonly schema: JsonSchema
      readonly name: string
      readonly isClass: boolean
      readonly isEnum: boolean
    }): boolean

    onTopLevel(options: {
      readonly importName: string
      readonly schema: JsonSchema
      readonly description: Option.Option<string>
      readonly name: string
      readonly source: string
      readonly isClass: boolean
      readonly isEnum: boolean
    }): string

    onProperty(options: {
      readonly importName: string
      readonly description: Option.Option<string>
      readonly key: string
      readonly source: string
      readonly isOptional: boolean
      readonly isNullable: boolean
      readonly default?: unknown
    }): string

    readonly propertySeparator: string

    onRef(options: {
      readonly importName: string
      readonly name: string
    }): string

    onObject(options: {
      readonly importName: string
      readonly properties: string
      readonly topLevel: boolean
    }): string

    onNull(options: { readonly importName: string }): string

    onBoolean(options: { readonly importName: string }): string

    onRecord(options: { readonly importName: string }): string

    onEnum(options: {
      readonly importName: string
      readonly items: ReadonlyArray<string>
    }): string

    onString(options: {
      readonly importName: string
      readonly schema: JSONSchema.String
    }): string

    onNumber(options: {
      readonly importName: string
      readonly schema: JSONSchema.Number | JSONSchema.Integer
      readonly minimum: number | undefined
      readonly exclusiveMinimum: boolean
      readonly maximum: number | undefined
      readonly exclusiveMaximum: boolean
    }): string

    onArray(options: {
      readonly importName: string
      readonly schema: JSONSchema.Array
      readonly item: string
      readonly nonEmpty: boolean
    }): string

    onUnion(options: {
      readonly importName: string
      readonly topLevel: boolean
      readonly items: ReadonlyArray<{
        readonly description: Option.Option<string>
        readonly title: Option.Option<string>
        readonly source: string
      }>
    }): string
  }
>()("JsonSchemaTransformer") {}

function applyAnnotations(S: string, options: {
  readonly isOptional: boolean
  readonly isNullable: boolean
  readonly default?: unknown
}) {
  return (source: string): string => {
    // Handle the special case where the `default` value of the property
    // was set to `null`, but the property was not properly marked as `nullable`
    if (options.isNullable && options.default === null) {
      return `${S}.optionalKey(${S}.NullOr(${source})).pipe(${S}.withDecodingDefault(() => null))`
    }
    const defaultSource = options.default !== undefined && options.default !== null
      ? `() => ${JSON.stringify(options.default)} as const`
      : undefined
    if (options.isOptional) {
      return defaultSource
        ? String.stripMargin(
          `|S.optional(S.NullOr(${source})).pipe(
             |  S.decodeTo(S.optional(${source}), {
             |    decode: Getter.transformOptional(flow(
             |      Option.filter(Predicate.isNotNull), 
             |      Option.orElseSome(${defaultSource})
             |    )),
             |    encode: Getter.passthrough()
             |  })
             |)`
        )
        : String.stripMargin(
          `|S.optional(S.NullOr(${source})).pipe(
             |  S.decodeTo(S.optional(${source}), {
             |    decode: Getter.transformOptional(Option.filter(Predicate.isNotNull)),
             |    encode: Getter.passthrough()
             |  })
             |)`
        )
    }
    const newSource = options.isNullable ? `${S}.NullOr(${source})` : source
    if (defaultSource) {
      return `${newSource}.pipe(${S}.propertySignature, ${S}.withConstructorDefault(${defaultSource}))`
    }
    return newSource
  }
}

const addChecks = (checks: Array<string>) => checks.length === 0 ? "" : `.check(${checks.join(", ")})`

export const makeTransformerSchema = JsonSchemaTransformer.of({
  supportsTopLevel({ isClass, isEnum }) {
    return isClass || isEnum
  },
  onTopLevel({ description, importName, isClass, name, schema, source }) {
    const isObject = "properties" in schema
    if (isObject || isClass) {
      const exported = isObject && !isClass
        ? `export class ${name} extends ${importName}.Opaque<${name}>()(${source}) {}`
        : `export class ${name} extends ${importName}.Class<${name}>("${name}")(${source}) {}`
      return `${Utils.toComment(description)}${exported}`
    }
    const comment = Utils.toComment(description)
    const variable = `export const ${name} = ${source}`
    const type = `export type ${name} = typeof ${name}.Type`
    return `${comment}${variable}\n\n${type}`
  },
  propertySeparator: ",\n  ",
  onProperty: (options) => {
    const source = applyAnnotations(
      options.importName,
      options
    )(options.source)
    return `${Utils.toComment(options.description)}"${options.key}": ${source}`
  },
  onRef({ name }) {
    return name
  },
  onObject({ importName, properties, topLevel }) {
    return `${topLevel ? "" : `${importName}.Struct(`}{\n  ${properties}\n}${topLevel ? "" : ")"}`
  },
  onNull({ importName }) {
    return `${importName}.Null`
  },
  onBoolean({ importName }) {
    return `${importName}.Boolean`
  },
  onRecord({ importName }) {
    return `${importName}.Record({ key: ${importName}.String, value: ${importName}.Unknown })`
  },
  onEnum({ importName, items }) {
    return items.length === 1 ? `${importName}.Literal(${items[0]})` : `${importName}.Literals([${items.join(", ")}])`
  },
  onString({ importName, schema }) {
    if (
      schema.format === "binary" ||
      (schema as any).contentEncoding === "binary"
    ) {
      return `${importName}.instanceOf(globalThis.Blob)`
    }
    const modifiers: Array<string> = []
    if ("minLength" in schema) {
      modifiers.push(`${importName}.isMinLength(${schema.minLength})`)
    }
    if ("maxLength" in schema) {
      modifiers.push(`${importName}.isMaxLength(${schema.maxLength})`)
    }
    if ("pattern" in schema) {
      modifiers.push(
        `${importName}.isRegex(new RegExp(${JSON.stringify(schema.pattern)}))`
      )
    }
    return `${importName}.String${addChecks(modifiers)}`
  },
  onNumber({
    exclusiveMaximum,
    exclusiveMinimum,
    importName,
    maximum,
    minimum,
    schema
  }) {
    const modifiers: Array<string> = []
    if (minimum !== undefined) {
      modifiers.push(
        `${importName}.isGreaterThan${exclusiveMinimum ? "" : "OrEqualTo"}(${minimum})`
      )
    }
    if (maximum !== undefined) {
      modifiers.push(
        `${importName}.isLessThan${exclusiveMaximum ? "" : "OrEqualTo"}(${maximum})`
      )
    }
    return `${importName}.${schema.type === "integer" ? "Int" : "Number"}${addChecks(modifiers)}`
  },
  onArray({ importName, item, nonEmpty, schema }) {
    const modifiers: Array<string> = []
    if ("minItems" in schema && nonEmpty) {
      modifiers.push(`${importName}.isMinLength(${schema.minItems})`)
    }
    if ("maxItems" in schema) {
      modifiers.push(`${importName}.isMaxLength(${schema.maxItems})`)
    }

    return `${importName}.${nonEmpty ? "NonEmpty" : ""}Array(${item})${addChecks(modifiers)}`
  },
  onUnion({ importName, items }) {
    return `${importName}.Union(${items.map((_) => `${Utils.toComment(_.description)}${_.source}`).join(",\n")})`
  }
})

export const layerTransformerSchema = Layer.succeed(
  JsonSchemaTransformer,
  makeTransformerSchema
)

export const makeTransformerTs = JsonSchemaTransformer.of({
  supportsTopLevel() {
    return true
  },
  onTopLevel({ description, name, schema, source }) {
    return source[0] === "{"
      ? "oneOf" in schema
        ? `${Utils.toComment(description)}export const ${name} = ${source};
export type ${name} = (typeof ${name})[keyof typeof ${name}];`
        : `${Utils.toComment(description)}export interface ${name} ${source}`
      : `${Utils.toComment(description)}export type ${name} = ${source}`
  },
  propertySeparator: ";\n  ",
  onProperty(options) {
    return `${Utils.toComment(options.description)}readonly "${options.key}"${
      options.isOptional ? "?" : ""
    }: ${options.source}${options.isNullable ? " | null" : ""}${options.isOptional ? " | undefined" : ""}`
  },
  onRef({ name }) {
    return name
  },
  onObject({ properties }) {
    return `{\n  ${properties}\n}`
  },
  onNull() {
    return "null"
  },
  onBoolean() {
    return "boolean"
  },
  onRecord() {
    return "Record<string, unknown>"
  },
  onEnum({ items }) {
    return items.join(" | ")
  },
  onString({ schema }) {
    if (
      schema.format === "binary" ||
      (schema as any).contentEncoding === "binary"
    ) {
      return `Blob`
    }
    return "string"
  },
  onNumber() {
    return "number"
  },
  onArray({ item }) {
    return `ReadonlyArray<${item}>`
  },
  onUnion({ items, topLevel }) {
    const useEnum = topLevel && !items.some((_) => Option.isNone(_.title))
    if (!useEnum) {
      return items.map((_) => _.source).join(" | ")
    }
    return `{\n  ${
      items.map(({ description, source, title }) =>
        `${Utils.toComment(description)}${JSON.stringify(Option.getOrNull(title))}: ${source}`
      ).join(",\n  ")
    }} as const\n`
  }
})

export const layerTransformerTs = Layer.succeed(
  JsonSchemaTransformer,
  makeTransformerTs
)
