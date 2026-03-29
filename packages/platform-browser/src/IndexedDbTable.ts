/**
 * @since 4.0.0
 */
import { type Pipeable, pipeArguments } from "effect/Pipeable"
import * as Schema from "effect/Schema"
import * as Struct from "effect/Struct"
import type { NoInfer } from "effect/Types"
import * as IndexedDb from "./IndexedDb.ts"
import type * as IndexedDbQueryBuilder from "./IndexedDbQueryBuilder.ts"

const TypeId = "~@effect/platform-browser/IndexedDbTable"

/**
 * @since 4.0.0
 * @category interface
 */
export interface IndexedDbTable<
  out Name extends string,
  out TableSchema extends AnySchemaStruct,
  out Indexes extends Record<
    string,
    IndexedDbQueryBuilder.KeyPath<TableSchema>
  >,
  out KeyPath extends Readonly<IDBValidKey | undefined>,
  out AutoIncrement extends boolean
> extends Pipeable {
  new(_: never): {}
  readonly [TypeId]: typeof TypeId
  readonly tableName: Name
  readonly tableSchema: TableSchema
  readonly readSchema: Schema.Top
  readonly autoincrementSchema: Schema.Top
  readonly arraySchema: Schema.Top
  readonly keyPath: KeyPath
  readonly indexes: Indexes
  readonly autoIncrement: AutoIncrement
}

/**
 * @since 4.0.0
 * @category models
 */
export type AnySchemaStruct = Schema.Top & {
  readonly fields: Schema.Struct.Fields
  mapFields<To extends Schema.Struct.Fields>(
    f: (fields: Schema.Struct.Fields) => To,
    options?:
      | {
        readonly unsafePreserveChecks?: boolean | undefined
      }
      | undefined
  ): Schema.Struct<To>
}

/**
 * @since 4.0.0
 * @category models
 */
export interface Any {
  readonly [TypeId]: typeof TypeId
  readonly tableName: string
}

/**
 * @since 4.0.0
 * @category models
 */
export type AnyWithProps = IndexedDbTable<
  string,
  AnySchemaStruct,
  any,
  any,
  boolean
>

/**
 * @since 4.0.0
 * @category models
 */
export type TableName<Table extends Any> = Table extends IndexedDbTable<
  infer _Name,
  infer _Schema,
  infer _Indexes,
  infer _KeyPath,
  infer _AutoIncrement
> ? _Name
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type KeyPath<Table extends Any> = Table extends IndexedDbTable<
  infer _Name,
  infer _Schema,
  infer _Indexes,
  infer _KeyPath,
  infer _AutoIncrement
> ? _KeyPath
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type AutoIncrement<Table extends Any> = Table extends IndexedDbTable<
  infer _Name,
  infer _Schema,
  infer _Indexes,
  infer _KeyPath,
  infer _AutoIncrement
> ? _AutoIncrement
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type TableSchema<Table extends Any> = Table extends IndexedDbTable<
  infer _Name,
  infer _Schema,
  infer _Indexes,
  infer _KeyPath,
  infer _AutoIncrement
> ? _Schema
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type Context<Table extends Any> = Table extends IndexedDbTable<
  infer _Name,
  infer _Schema,
  infer _Indexes,
  infer _KeyPath,
  infer _AutoIncrement
> ? _Schema["DecodingServices"]
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type Encoded<Table extends Any> = Table extends IndexedDbTable<
  infer _Name,
  infer _Schema,
  infer _Indexes,
  infer _KeyPath,
  infer _AutoIncrement
> ? _Schema["Encoded"]
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type Indexes<Table extends Any> = Table extends IndexedDbTable<
  infer _Name,
  infer _Schema,
  infer _Indexes,
  infer _KeyPath,
  infer _AutoIncrement
> ? _Indexes
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type WithName<Table extends Any, TableName extends string> = Extract<
  Table,
  { readonly tableName: TableName }
>

const Proto = {
  [TypeId]: TypeId,
  pipe() {
    return pipeArguments(this, arguments)
  }
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const make = <
  const Name extends string,
  TableSchema extends AnySchemaStruct,
  const Indexes extends Record<
    string,
    IndexedDbQueryBuilder.KeyPath<TableSchema>
  >,
  const KeyPath extends
    | (AutoIncrement extends true ? IndexedDbQueryBuilder.KeyPathNumber<NoInfer<TableSchema>>
      : IndexedDbQueryBuilder.KeyPath<NoInfer<TableSchema>>)
    | undefined = undefined,
  const AutoIncrement extends boolean = false
>(options: {
  readonly name: Name
  readonly schema: [KeyPath] extends [undefined]
    ? "key" extends keyof TableSchema["fields"] ? "Cannot have a 'key' field when keyPath is undefined"
    : TableSchema
    : TableSchema
  readonly keyPath?: KeyPath
  readonly indexes?: Indexes | undefined
  readonly autoIncrement?: IsValidAutoIncrementKeyPath<
    TableSchema,
    KeyPath
  > extends true ? AutoIncrement | undefined
    : never
}): IndexedDbTable<
  Name,
  TableSchema,
  Indexes,
  Extract<KeyPath, Readonly<IDBValidKey | undefined>>,
  AutoIncrement
> => {
  // oxlint-disable-next-line typescript/no-extraneous-class
  class Table {}
  Object.assign(Table, Proto)
  const readSchema = options.keyPath === undefined
    ? (options.schema as Schema.Struct<{}>).mapFields(Struct.assign({ key: IndexedDb.IDBValidKey }))
    : options.schema
  ;(Table as any).tableName = options.name
  ;(Table as any).tableSchema = options.schema
  ;(Table as any).readSchema = readSchema
  ;(Table as any).arraySchema = Schema.Array(readSchema as any)
  ;(Table as any).autoincrementSchema = options.autoIncrement
    ? (options.schema as Schema.Struct<{}>).mapFields(Struct.omit([options.keyPath!] as any))
    : options.schema
  ;(Table as any).keyPath = options.keyPath
  ;(Table as any).indexes = options.indexes
  ;(Table as any).autoIncrement = options.autoIncrement === true
  return Table as any
}

// -----------------------------------------------------------------------------
// internal
// -----------------------------------------------------------------------------

type IsValidAutoIncrementKeyPath<
  TableSchema extends AnySchemaStruct,
  KeyPath
> = KeyPath extends keyof TableSchema["Encoded"] ? TableSchema["Encoded"][KeyPath] extends number ? true
  : false
  : false
