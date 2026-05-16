/**
 * Utilities for defining schema-backed domain models that need different shapes
 * for database access and JSON APIs.
 *
 * A model defined with this module keeps one field declaration as the source of
 * truth and derives the `select`, `insert`, `update`, `json`, `jsonCreate`, and
 * `jsonUpdate` variants from it. This is useful for persistence models whose
 * database representation differs from the public API, for example generated
 * columns, application-generated identifiers, sensitive fields that must not be
 * serialized to JSON, nullable database columns exposed as `Option`, SQLite
 * booleans, JSON stored as text, date-time audit columns, and generated UUIDs.
 *
 * Each variant is a schema in its own right, so choose the variant that matches
 * the boundary you are validating or encoding. Plain schemas are included in all
 * variants, while `Field` helpers opt a property into only the variants they
 * declare. Overrideable defaults such as timestamp helpers can still be provided
 * explicitly with `Override`, and JSON variants may differ from database variants
 * in both optionality and encoded representation.
 *
 * @since 4.0.0
 */
import * as Uuid from "uuid"
import type { Brand } from "../../Brand.ts"
import * as DateTime from "../../DateTime.ts"
import * as Effect from "../../Effect.ts"
import * as Option from "../../Option.ts"
import * as Predicate from "../../Predicate.ts"
import * as Schema from "../../Schema.ts"
import * as Getter from "../../SchemaGetter.ts"
import * as Transformation from "../../SchemaTransformation.ts"
import * as VariantSchema from "./VariantSchema.ts"

const {
  Class,
  Field,
  FieldExcept,
  FieldOnly,
  Struct,
  Union,
  extract,
  fieldEvolve
} = VariantSchema.make({
  variants: ["select", "insert", "update", "json", "jsonCreate", "jsonUpdate"],
  defaultVariant: "select"
})

/**
 * Base shape of a variant model schema, including its fields and the generated
 * database and JSON variant schemas.
 *
 * @category models
 * @since 4.0.0
 */
export type Any = Schema.Top & {
  readonly fields: Schema.Struct.Fields
  readonly insert: Schema.Top
  readonly update: Schema.Top
  readonly json: Schema.Top
  readonly jsonCreate: Schema.Top
  readonly jsonUpdate: Schema.Top
}

/**
 * Database-facing variant names generated for model schemas.
 *
 * @category models
 * @since 4.0.0
 */
export type VariantsDatabase = "select" | "insert" | "update"

/**
 * JSON API-facing variant names generated for model schemas.
 *
 * @category models
 * @since 4.0.0
 */
export type VariantsJson = "json" | "jsonCreate" | "jsonUpdate"

export {
  /**
   * A base class used for creating domain model schemas.
   *
   * It supports common variants for database and JSON apis.
   *
   * @category constructors
   * @since 4.0.0
   * **Example** (Defining a variant model class)
   *
   * ```ts
   * import { Schema } from "effect"
   * import { Model } from "effect/unstable/schema"
   *
   * export const GroupId = Schema.Number.pipe(Schema.brand("GroupId"))
   *
   * export class Group extends Model.Class<Group>("Group")({
   *   id: Model.Generated(GroupId),
   *   name: Schema.String,
   *   createdAt: Model.DateTimeInsertFromDate,
   *   updatedAt: Model.DateTimeUpdateFromDate
   * }) {}
   *
   * // schema used for selects
   * Group
   *
   * // schema used for inserts
   * Group.insert
   *
   * // schema used for updates
   * Group.update
   *
   * // schema used for json api
   * Group.json
   * Group.jsonCreate
   * Group.jsonUpdate
   *
   * // you can also turn them into classes
   * class GroupJson extends Schema.Class<GroupJson>("GroupJson")(Group.json) {
   *   get upperName() {
   *     return this.name.toUpperCase()
   *   }
   * }
   * ```
   */
  Class,
  /**
   * @category extraction
   * @since 4.0.0
   */
  extract,
  /**
   * @category fields
   * @since 4.0.0
   */
  Field,
  /**
   * @category fields
   * @since 4.0.0
   */
  fieldEvolve,
  /**
   * @category fields
   * @since 4.0.0
   */
  FieldExcept,
  /**
   * @category fields
   * @since 4.0.0
   */
  FieldOnly,
  /**
   * @category constructors
   * @since 4.0.0
   */
  Struct,
  /**
   * @category constructors
   * @since 4.0.0
   */
  Union
}

/**
 * Returns the variant field definitions stored on a model or variant struct.
 *
 * @category fields
 * @since 4.0.0
 */
export const fields: <A extends VariantSchema.Struct<any>>(self: A) => A[typeof VariantSchema.TypeId] =
  VariantSchema.fields

/**
 * Marks a value as an explicit override for fields that otherwise use an
 * overrideable default.
 *
 * @category overrideable
 * @since 4.0.0
 */
export const Override: <A>(value: A) => A & Brand<"Override"> = VariantSchema.Override

/**
 * Variant field type for a database-generated column that is present in select,
 * update, and read JSON variants but omitted from insert variants.
 *
 * @category generated
 * @since 4.0.0
 */
export interface Generated<S extends Schema.Top> extends
  VariantSchema.Field<{
    readonly select: S
    readonly update: S
    readonly json: S
  }>
{}

/**
 * A field that represents a column that is generated by the database.
 *
 * It is available for selection and update, but not for insertion.
 *
 * @category generated
 * @since 4.0.0
 */
export const Generated = <S extends Schema.Top>(
  schema: S
): Generated<S> =>
  Field({
    select: schema,
    update: schema,
    json: schema
  })

/**
 * Variant field type for an application-generated value that is present in
 * database variants and read JSON, but omitted from JSON create and update
 * variants.
 *
 * @category generated
 * @since 4.0.0
 */
export interface GeneratedByApp<S extends Schema.Top> extends
  VariantSchema.Field<{
    readonly select: S
    readonly insert: S
    readonly update: S
    readonly json: S
  }>
{}

/**
 * A field that represents a value generated by the application.
 *
 * It is present in the database variants and read JSON variant, but omitted from
 * the JSON create and update variants.
 *
 * @category generated
 * @since 4.0.0
 */
export const GeneratedByApp = <S extends Schema.Top>(schema: S): GeneratedByApp<S> =>
  Field({
    select: schema,
    insert: schema,
    update: schema,
    json: schema
  })

/**
 * Variant field type for a sensitive value that is available to database variants
 * and omitted from all JSON variants.
 *
 * @category sensitive
 * @since 4.0.0
 */
export interface Sensitive<S extends Schema.Top> extends
  VariantSchema.Field<{
    readonly select: S
    readonly insert: S
    readonly update: S
  }>
{}

/**
 * A field that represents a sensitive value that should not be exposed in the
 * JSON variants.
 *
 * @category sensitive
 * @since 4.0.0
 */
export const Sensitive = <S extends Schema.Top>(schema: S): Sensitive<S> =>
  Field({
    select: schema,
    insert: schema,
    update: schema
  })

/**
 * Schema type for an optional object key whose encoded value may be missing or
 * null and whose decoded value is an `Option`.
 *
 * @category optional
 * @since 4.0.0
 */
export interface optionalOption<S extends Schema.Top>
  extends Schema.decodeTo<Schema.Option<Schema.toType<S>>, Schema.optionalKey<Schema.NullOr<S>>>
{}

/**
 * Creates a schema for optional keys that decodes missing or null encoded values
 * through `Option` and encodes `Option` values back to optional nullable keys.
 *
 * @category optional
 * @since 4.0.0
 */
export const optionalOption = <S extends Schema.Top>(schema: S): optionalOption<S> =>
  Schema.optionalKey(Schema.NullOr(schema)).pipe(
    Schema.decodeTo(
      Schema.Option(Schema.toType(schema)),
      Transformation.transformOptional<Option.Option<S["Type"]>, S["Type"] | null>({
        decode: (oe) => oe.pipe(Option.filter(Predicate.isNotNull), Option.some),
        encode: Option.flatten
      }) as any
    )
  )

/**
 * Convert a field to one that is optional for all variants.
 *
 * For the database variants, it will accept `null`able values.
 * For the JSON variants, it will also accept missing keys.
 *
 * @category optional
 * @since 4.0.0
 */
export interface FieldOption<S extends Schema.Top> extends
  VariantSchema.Field<{
    readonly select: Schema.OptionFromNullOr<S>
    readonly insert: Schema.OptionFromNullOr<S>
    readonly update: Schema.OptionFromNullOr<S>
    readonly json: optionalOption<S>
    readonly jsonCreate: optionalOption<S>
    readonly jsonUpdate: optionalOption<S>
  }>
{}

/**
 * Convert a field to one that is optional for all variants.
 *
 * For the database variants, it will accept `null`able values.
 * For the JSON variants, it will also accept missing keys.
 *
 * @category optional
 * @since 4.0.0
 */
export const FieldOption: <Field extends VariantSchema.Field<any> | Schema.Top>(
  self: Field
) => Field extends Schema.Top ? FieldOption<Field>
  : Field extends VariantSchema.Field<infer S> ? VariantSchema.Field<
      {
        readonly [K in keyof S]: S[K] extends Schema.Top ? K extends VariantsDatabase ? Schema.OptionFromNullOr<S[K]> :
          optionalOption<S[K]>
          : never
      }
    > :
  never = fieldEvolve({
    select: Schema.OptionFromNullOr,
    insert: Schema.OptionFromNullOr,
    update: Schema.OptionFromNullOr,
    json: optionalOption,
    jsonCreate: optionalOption,
    jsonUpdate: optionalOption
  }) as any

/**
 * Variant field type for SQLite booleans stored as `0 | 1` in database variants
 * and exposed as `boolean` in JSON variants.
 *
 * @category booleans
 * @since 4.0.0
 */
export interface BooleanSqlite extends
  VariantSchema.Field<{
    readonly select: Schema.BooleanFromBit
    readonly insert: Schema.BooleanFromBit
    readonly update: Schema.BooleanFromBit
    readonly json: Schema.Boolean
    readonly jsonCreate: Schema.Boolean
    readonly jsonUpdate: Schema.Boolean
  }>
{}

/**
 * A schema for sqlite booleans that are represented as `0 | 1` in database
 * variants and `boolean` in JSON variants.
 *
 * @category booleans
 * @since 4.0.0
 */
export const BooleanSqlite: BooleanSqlite = Field({
  select: Schema.BooleanFromBit,
  insert: Schema.BooleanFromBit,
  update: Schema.BooleanFromBit,
  json: Schema.Boolean,
  jsonCreate: Schema.Boolean,
  jsonUpdate: Schema.Boolean
})

/**
 * Schema type for a `DateTime.Utc` date-only value encoded as a `YYYY-MM-DD`
 * string.
 *
 * @category date & time
 * @since 4.0.0
 */
export interface Date extends Schema.decodeTo<Schema.instanceOf<DateTime.Utc>, Schema.String> {}

/**
 * A schema for a `DateTime.Utc` that is serialized as a date string in the
 * format `YYYY-MM-DD`.
 *
 * @category date & time
 * @since 4.0.0
 */
export const Date: Date = Schema.String.pipe(
  Schema.decodeTo(Schema.DateTimeUtc, {
    decode: Getter.dateTimeUtcFromInput().map(DateTime.removeTime),
    encode: Getter.transform(DateTime.formatIsoDate)
  })
)

/**
 * Overrideable date-only UTC schema whose constructor default is the current date
 * with the time component removed.
 *
 * @category date & time
 * @since 4.0.0
 */
export const DateWithNow = VariantSchema.Overrideable(Date, {
  defaultValue: Effect.map(DateTime.now, DateTime.removeTime)
})

/**
 * Overrideable UTC date-time schema encoded as a string, with a constructor
 * default of the current `DateTime.Utc`.
 *
 * @category date & time
 * @since 4.0.0
 */
export const DateTimeWithNow = VariantSchema.Overrideable(Schema.DateTimeUtcFromString, {
  defaultValue: DateTime.now
})

/**
 * Overrideable UTC date-time schema encoded as a JavaScript `Date`, with a
 * constructor default of the current `DateTime.Utc`.
 *
 * @category date & time
 * @since 4.0.0
 */
export const DateTimeFromDateWithNow = VariantSchema.Overrideable(Schema.DateTimeUtcFromDate, {
  defaultValue: DateTime.now
})

/**
 * Overrideable UTC date-time schema encoded as milliseconds, with a constructor
 * default of the current `DateTime.Utc`.
 *
 * @category date & time
 * @since 4.0.0
 */
export const DateTimeFromNumberWithNow = VariantSchema.Overrideable(Schema.DateTimeUtcFromMillis, {
  defaultValue: DateTime.now
})

/**
 * Variant field type for a UTC date-time stored as a string, defaulted to the
 * current time on insert, available for selection, and omitted from updates.
 *
 * @category date & time
 * @since 4.0.0
 */
export interface DateTimeInsert extends
  VariantSchema.Field<{
    readonly select: Schema.DateTimeUtcFromString
    readonly insert: VariantSchema.Overrideable<Schema.DateTimeUtcFromString>
    readonly json: Schema.DateTimeUtcFromString
  }>
{}

/**
 * A field that represents a date-time value that is inserted as the current
 * `DateTime.Utc`. It is serialized as a string for the database.
 *
 * It is omitted from updates and is available for selection.
 *
 * @category date & time
 * @since 4.0.0
 */
export const DateTimeInsert: DateTimeInsert = Field({
  select: Schema.DateTimeUtcFromString,
  insert: DateTimeWithNow,
  json: Schema.DateTimeUtcFromString
})

/**
 * Variant field type for a UTC date-time stored as a JavaScript `Date` in
 * database variants, encoded as a string for JSON, and defaulted on insert.
 *
 * @category date & time
 * @since 4.0.0
 */
export interface DateTimeInsertFromDate extends
  VariantSchema.Field<{
    readonly select: Schema.DateTimeUtcFromDate
    readonly insert: VariantSchema.Overrideable<Schema.DateTimeUtcFromDate>
    readonly json: Schema.DateTimeUtcFromString
  }>
{}

/**
 * A field that represents a date-time value that is inserted as the current
 * `DateTime.Utc`. It is serialized as a `Date` for the database.
 *
 * It is omitted from updates and is available for selection.
 *
 * @category date & time
 * @since 4.0.0
 */
export const DateTimeInsertFromDate: DateTimeInsertFromDate = Field({
  select: Schema.DateTimeUtcFromDate,
  insert: DateTimeFromDateWithNow,
  json: Schema.DateTimeUtcFromString
})

/**
 * Variant field type for a UTC date-time encoded as milliseconds and defaulted to
 * the current time on insert.
 *
 * @category date & time
 * @since 4.0.0
 */
export interface DateTimeInsertFromNumber extends
  VariantSchema.Field<{
    readonly select: Schema.DateTimeUtcFromMillis
    readonly insert: VariantSchema.Overrideable<Schema.DateTimeUtcFromMillis>
    readonly json: Schema.DateTimeUtcFromMillis
  }>
{}

/**
 * A field that represents a date-time value that is inserted as the current
 * `DateTime.Utc`. It is serialized as a `number`.
 *
 * It is omitted from updates and is available for selection.
 *
 * @category date & time
 * @since 4.0.0
 */
export const DateTimeInsertFromNumber: DateTimeInsertFromNumber = Field({
  select: Schema.DateTimeUtcFromMillis,
  insert: DateTimeFromNumberWithNow,
  json: Schema.DateTimeUtcFromMillis
})

/**
 * Variant field type for a UTC date-time stored as a string and defaulted to the
 * current time on both inserts and updates.
 *
 * @category date & time
 * @since 4.0.0
 */
export interface DateTimeUpdate extends
  VariantSchema.Field<{
    readonly select: Schema.DateTimeUtcFromString
    readonly insert: VariantSchema.Overrideable<Schema.DateTimeUtcFromString>
    readonly update: VariantSchema.Overrideable<Schema.DateTimeUtcFromString>
    readonly json: Schema.DateTimeUtcFromString
  }>
{}

/**
 * A field that represents a date-time value that is updated as the current
 * `DateTime.Utc`. It is serialized as a string for the database.
 *
 * It is set to the current `DateTime.Utc` on updates and inserts and is
 * available for selection.
 *
 * @category date & time
 * @since 4.0.0
 */
export const DateTimeUpdate: DateTimeUpdate = Field({
  select: Schema.DateTimeUtcFromString,
  insert: DateTimeWithNow,
  update: DateTimeWithNow,
  json: Schema.DateTimeUtcFromString
})

/**
 * Variant field type for a UTC date-time stored as a JavaScript `Date` in
 * database variants, encoded as a string for JSON, and defaulted on inserts and
 * updates.
 *
 * @category date & time
 * @since 4.0.0
 */
export interface DateTimeUpdateFromDate extends
  VariantSchema.Field<{
    readonly select: Schema.DateTimeUtcFromDate
    readonly insert: VariantSchema.Overrideable<Schema.DateTimeUtcFromDate>
    readonly update: VariantSchema.Overrideable<Schema.DateTimeUtcFromDate>
    readonly json: Schema.DateTimeUtcFromString
  }>
{}

/**
 * A field that represents a date-time value that is updated as the current
 * `DateTime.Utc`. It is serialized as a `Date` for the database.
 *
 * It is set to the current `DateTime.Utc` on updates and inserts and is
 * available for selection.
 *
 * @category date & time
 * @since 4.0.0
 */
export const DateTimeUpdateFromDate: DateTimeUpdateFromDate = Field({
  select: Schema.DateTimeUtcFromDate,
  insert: DateTimeFromDateWithNow,
  update: DateTimeFromDateWithNow,
  json: Schema.DateTimeUtcFromString
})

/**
 * Variant field type for a UTC date-time encoded as milliseconds and defaulted to
 * the current time on both inserts and updates.
 *
 * @category date & time
 * @since 4.0.0
 */
export interface DateTimeUpdateFromNumber extends
  VariantSchema.Field<{
    readonly select: Schema.DateTimeUtcFromMillis
    readonly insert: VariantSchema.Overrideable<Schema.DateTimeUtcFromMillis>
    readonly update: VariantSchema.Overrideable<Schema.DateTimeUtcFromMillis>
    readonly json: Schema.DateTimeUtcFromMillis
  }>
{}

/**
 * A field that represents a date-time value that is updated as the current
 * `DateTime.Utc`. It is serialized as a `number`.
 *
 * It is set to the current `DateTime.Utc` on updates and inserts and is
 * available for selection.
 *
 * @category date & time
 * @since 4.0.0
 */
export const DateTimeUpdateFromNumber: DateTimeUpdateFromNumber = Field({
  select: Schema.DateTimeUtcFromMillis,
  insert: DateTimeFromNumberWithNow,
  update: DateTimeFromNumberWithNow,
  json: Schema.DateTimeUtcFromMillis
})

/**
 * Variant field type for a JSON value stored as text in database variants and
 * exposed through the supplied schema in JSON variants.
 *
 * @category json
 * @since 4.0.0
 */
export interface JsonFromString<S extends Schema.Top> extends
  VariantSchema.Field<{
    readonly select: Schema.fromJsonString<S>
    readonly insert: Schema.fromJsonString<S>
    readonly update: Schema.fromJsonString<S>
    readonly json: S
    readonly jsonCreate: S
    readonly jsonUpdate: S
  }>
{}

/**
 * A field that represents a JSON value stored as text in the database.
 *
 * The "json" variants will use the object schema directly.
 *
 * @category json
 * @since 4.0.0
 */
export const JsonFromString = <S extends Schema.Top>(
  schema: S
): JsonFromString<S> => {
  const parsed = Schema.fromJsonString(Schema.toCodecJson(schema)) as any
  return Field({
    select: parsed,
    insert: parsed,
    update: parsed,
    json: schema,
    jsonCreate: schema,
    jsonUpdate: schema
  })
}

/**
 * Variant field type for a branded binary UUID v4 value whose insert variant
 * generates a UUID by default.
 *
 * @category uuid
 * @since 4.0.0
 */
export interface UuidV4Insert<B extends string> extends
  VariantSchema.Field<{
    readonly select: Schema.brand<Schema.instanceOf<Uint8Array<ArrayBuffer>>, B>
    readonly insert: Schema.withConstructorDefault<Schema.brand<Schema.instanceOf<Uint8Array<ArrayBuffer>>, B>>
    readonly update: Schema.brand<Schema.instanceOf<Uint8Array<ArrayBuffer>>, B>
    readonly json: Schema.brand<Schema.instanceOf<Uint8Array<ArrayBuffer>>, B>
  }>
{}

/**
 * Schema for binary `Uint8Array` values backed by an `ArrayBuffer`.
 *
 * @category Uint8Array
 * @since 4.0.0
 */
export const Uint8Array: Schema.instanceOf<Uint8Array<ArrayBuffer>> = Schema.Uint8Array as Schema.instanceOf<
  globalThis.Uint8Array<ArrayBuffer>
>

/**
 * Adds a constructor default that generates a binary UUID v4 for a branded
 * `Uint8Array` schema.
 *
 * @category uuid
 * @since 4.0.0
 */
export const UuidV4WithGenerate = <B extends string>(
  schema: Schema.brand<Schema.instanceOf<Uint8Array<ArrayBuffer>>, B>
): Schema.withConstructorDefault<Schema.brand<Schema.instanceOf<Uint8Array<ArrayBuffer>>, B>> =>
  schema.pipe(Schema.withConstructorDefault(Effect.sync(() => Uuid.v4({}, new globalThis.Uint8Array(16)))))

/**
 * A field that represents a binary UUID v4 that is generated on inserts.
 *
 * @category uuid
 * @since 4.0.0
 */
export const UuidV4Insert = <const B extends string>(
  schema: Schema.brand<Schema.instanceOf<Uint8Array<ArrayBuffer>>, B>
): UuidV4Insert<B> =>
  Field({
    select: schema,
    insert: UuidV4WithGenerate(schema),
    update: schema,
    json: schema
  })
