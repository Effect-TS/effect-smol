/**
 * @since 4.0.0
 */
import { type Pipeable, pipeArguments } from "effect/Pipeable";
import type * as Schema from "effect/Schema";
import type { NoInfer } from "effect/Types";
import type * as IndexedDbQueryBuilder from "./IndexedDbQueryBuilder.js";

const TypeId = "~effect/platform-browser/IndexedDbTable";

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
  out AutoIncrement extends boolean,
> extends Pipeable {
  new (_: never): {};
  readonly [TypeId]: typeof TypeId;
  readonly tableName: Name;
  readonly tableSchema: TableSchema;
  readonly keyPath: KeyPath;
  readonly indexes: Indexes;
  readonly autoIncrement: AutoIncrement;
}

/**
 * @since 4.0.0
 * @category models
 */
export type AnySchemaStruct = Schema.Top & {
  readonly fields: Schema.Struct.Fields;
  mapFields<To extends Schema.Struct.Fields>(
    f: (fields: Schema.Struct.Fields) => To,
    options?:
      | {
          readonly unsafePreserveChecks?: boolean | undefined;
        }
      | undefined,
  ): Schema.Struct<To>;
};

/**
 * @since 4.0.0
 * @category models
 */
export interface Any {
  readonly [TypeId]: typeof TypeId;
  readonly tableName: string;
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
>;

/**
 * @since 4.0.0
 * @category models
 */
export type TableName<Table extends Any> =
  Table extends IndexedDbTable<
    infer _Name,
    infer _Schema,
    infer _Indexes,
    infer _KeyPath,
    infer _AutoIncrement
  >
    ? _Name
    : never;

/**
 * @since 4.0.0
 * @category models
 */
export type KeyPath<Table extends Any> =
  Table extends IndexedDbTable<
    infer _Name,
    infer _Schema,
    infer _Indexes,
    infer _KeyPath,
    infer _AutoIncrement
  >
    ? _KeyPath
    : never;

/**
 * @since 4.0.0
 * @category models
 */
export type AutoIncrement<Table extends Any> =
  Table extends IndexedDbTable<
    infer _Name,
    infer _Schema,
    infer _Indexes,
    infer _KeyPath,
    infer _AutoIncrement
  >
    ? _AutoIncrement
    : never;

/**
 * @since 4.0.0
 * @category models
 */
export type TableSchema<Table extends Any> =
  Table extends IndexedDbTable<
    infer _Name,
    infer _Schema,
    infer _Indexes,
    infer _KeyPath,
    infer _AutoIncrement
  >
    ? _Schema
    : never;

/**
 * @since 4.0.0
 * @category models
 */
export type Context<Table extends Any> =
  Table extends IndexedDbTable<
    infer _Name,
    infer _Schema,
    infer _Indexes,
    infer _KeyPath,
    infer _AutoIncrement
  >
    ? _Schema["DecodingServices"]
    : never;

/**
 * @since 4.0.0
 * @category models
 */
export type Indexes<Table extends Any> =
  Table extends IndexedDbTable<
    infer _Name,
    infer _Schema,
    infer _Indexes,
    infer _KeyPath,
    infer _AutoIncrement
  >
    ? _Indexes
    : never;

/**
 * @since 4.0.0
 * @category models
 */
export type WithName<Table extends Any, TableName extends string> = Extract<
  Table,
  { readonly tableName: TableName }
>;

const Proto = {
  [TypeId]: TypeId,
  pipe() {
    return pipeArguments(this, arguments);
  },
};

const makeProto = <
  const Name extends string,
  TableSchema extends AnySchemaStruct,
  const Indexes extends Record<
    string,
    IndexedDbQueryBuilder.KeyPath<TableSchema>
  >,
  const KeyPath extends Readonly<IDBValidKey | undefined>,
  const AutoIncrement extends boolean,
>(options: {
  readonly tableName: Name;
  readonly tableSchema: TableSchema;
  readonly keyPath: KeyPath;
  readonly indexes: Indexes;
  readonly autoIncrement: AutoIncrement;
}): IndexedDbTable<Name, TableSchema, Indexes, KeyPath, AutoIncrement> =>
  (function () {
    // oxlint-disable-next-line typescript/no-extraneous-class
    class Table {}
    Object.assign(Table, Proto);
    (Table as any).tableName = options.tableName;
    (Table as any).tableSchema = options.tableSchema;
    (Table as any).keyPath = options.keyPath;
    (Table as any).indexes = options.indexes;
    (Table as any).autoIncrement = options.autoIncrement;
    return Table as any;
  })();

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
    | (AutoIncrement extends true
        ? IndexedDbQueryBuilder.KeyPathNumber<NoInfer<TableSchema>>
        : IndexedDbQueryBuilder.KeyPath<NoInfer<TableSchema>>)
    | undefined = undefined,
  const AutoIncrement extends boolean = false,
>(options: {
  readonly name: Name;
  readonly schema: [KeyPath] extends [undefined]
    ? "key" extends keyof TableSchema["fields"]
      ? "Cannot have a 'key' field when keyPath is undefined"
      : TableSchema
    : TableSchema;
  readonly keyPath?: KeyPath;
  readonly indexes?: Indexes | undefined;
  readonly autoIncrement?: IsValidAutoIncrementKeyPath<
    TableSchema,
    KeyPath
  > extends true
    ? AutoIncrement | undefined
    : never;
}): IndexedDbTable<
  Name,
  TableSchema,
  Indexes,
  Extract<KeyPath, Readonly<IDBValidKey | undefined>>,
  AutoIncrement
> =>
  makeProto({
    tableName: options.name,
    tableSchema: options.schema as TableSchema,
    keyPath: options.keyPath as any,
    indexes: options.indexes ?? ({} as Indexes),
    autoIncrement: options.autoIncrement ?? (false as AutoIncrement),
  });

// -----------------------------------------------------------------------------
// internal
// -----------------------------------------------------------------------------

type IsValidAutoIncrementKeyPath<
  TableSchema extends AnySchemaStruct,
  KeyPath,
> = KeyPath extends keyof TableSchema["Encoded"]
  ? TableSchema["Encoded"][KeyPath] extends number
    ? true
    : false
  : false;
