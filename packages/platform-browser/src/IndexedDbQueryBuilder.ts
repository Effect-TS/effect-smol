/**
 * @since 4.0.0
 */
import type { NonEmptyReadonlyArray } from "effect/Array"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import { format } from "effect/Formatter"
import type { Inspectable } from "effect/Inspectable"
import { NodeInspectSymbol } from "effect/Inspectable"
import type { Pipeable } from "effect/Pipeable"
import { pipeArguments } from "effect/Pipeable"
import * as Schema from "effect/Schema"
import * as SchemaIssue from "effect/SchemaIssue"
import * as SchemaParser from "effect/SchemaParser"
import * as Utils from "effect/Utils"
import type * as IndexedDb from "./IndexedDb.ts"
import type * as IndexedDbDatabase from "./IndexedDbDatabase.ts"
import type * as IndexedDbTable from "./IndexedDbTable.ts"
import type * as IndexedDbVersion from "./IndexedDbVersion.ts"

const ErrorTypeId = "~@effect/platform-browser/IndexedDbQueryBuilder/IndexedDbQueryError"

const CommonProto = {
  [Symbol.iterator]() {
    return new Utils.SingleShotGen(this) as any
  },
  pipe() {
    return pipeArguments(this, arguments)
  },
  toJSON(this: any) {
    return {
      _id: "IndexedDbQueryBuilder"
    }
  },
  toString() {
    return format(this, { ignoreToString: true })
  },
  [NodeInspectSymbol]() {
    return this.toJSON()
  }
}

/**
 * @since 4.0.0
 * @category errors
 */
export type ErrorReason =
  | "NotFoundError"
  | "UnknownError"
  | "DecodeError"
  | "EncodeError"
  | "TransactionError"

/**
 * @since 4.0.0
 * @category errors
 */
export class IndexedDbQueryError extends Data.TaggedError(
  "IndexedDbQueryError"
)<{
  reason: ErrorReason
  cause: unknown
}> {
  /**
   * @since 4.0.0
   */
  readonly [ErrorTypeId]: typeof ErrorTypeId = ErrorTypeId

  override readonly message = this.reason
}

/**
 * @since 4.0.0
 * @category models
 */
export interface IndexedDbQueryBuilder<
  Source extends IndexedDbVersion.AnyWithProps
> extends Pipeable, Inspectable {
  readonly tables: ReadonlyMap<string, IndexedDbVersion.Tables<Source>>
  readonly database: globalThis.IDBDatabase
  readonly IDBKeyRange: typeof globalThis.IDBKeyRange
  readonly IDBTransaction: globalThis.IDBTransaction | undefined

  readonly use: <A = unknown>(
    f: (database: globalThis.IDBDatabase) => Promise<A>
  ) => Effect.Effect<A, IndexedDbQueryError>

  readonly from: <
    const Name extends IndexedDbTable.TableName<
      IndexedDbVersion.Tables<Source>
    >
  >(
    table: Name
  ) => IndexedDbQuery.From<IndexedDbVersion.TableWithName<Source, Name>>

  readonly clearAll: Effect.Effect<void, IndexedDbQueryError>

  readonly transaction: <
    Tables extends NonEmptyReadonlyArray<
      IndexedDbTable.TableName<IndexedDbVersion.Tables<Source>>
    >,
    Mode extends "readonly" | "readwrite",
    E,
    R
  >(
    tables: Tables,
    mode: Mode,
    callback: (api: {
      readonly from: <Name extends Tables[number]>(
        table: Name
      ) => Mode extends "readwrite" ? IndexedDbQuery.From<IndexedDbVersion.TableWithName<Source, Name>>
        : Omit<
          IndexedDbQuery.From<IndexedDbVersion.TableWithName<Source, Name>>,
          "insert" | "insertAll" | "upsert" | "upsertAll" | "clear" | "delete"
        >
    }) => Effect.Effect<void, E, R>,
    options?: globalThis.IDBTransactionOptions
  ) => Effect.Effect<void, never, R>
}

/**
 * @since 4.0.0
 * @category models
 */
export type KeyPath<TableSchema extends IndexedDbTable.AnySchemaStruct> =
  | IndexedDbValidKeys<TableSchema>
  | NonEmptyReadonlyArray<IndexedDbValidKeys<TableSchema>>

/**
 * @since 4.0.0
 * @category models
 */
export type KeyPathNumber<TableSchema extends IndexedDbTable.AnySchemaStruct> =
  | IndexedDbValidNumberKeys<TableSchema>
  | NonEmptyReadonlyArray<IndexedDbValidNumberKeys<TableSchema>>

/**
 * @since 4.0.0
 * @category models
 */
export declare namespace IndexedDbQuery {
  /**
   * @since 4.0.0
   * @category models
   */
  export type SourceTableSelectSchemaType<
    Table extends IndexedDbTable.AnyWithProps
  > = [IndexedDbTable.KeyPath<Table>] extends [undefined] ? IndexedDbTable.TableSchema<Table>["Type"] & {
      readonly key: (typeof IndexedDb.IDBValidKey)["Type"]
    } :
    IndexedDbTable.TableSchema<Table>["Type"]

  /**
   * @since 4.0.0
   * @category models
   */
  export type SourceTableModifySchemaType<
    Table extends IndexedDbTable.AnyWithProps
  > =
    & (IndexedDbTable.AutoIncrement<Table> extends true ?
        & {
          [
            key in keyof Schema.Struct.MakeIn<
              Omit<
                IndexedDbTable.TableSchema<Table>["fields"],
                IndexedDbTable.KeyPath<Table>
              >
            >
          ]: key extends keyof Schema.Struct.MakeIn<
            IndexedDbTable.TableSchema<Table>["fields"]
          > ? Schema.Struct.MakeIn<
              IndexedDbTable.TableSchema<Table>["fields"]
            >[key]
            : never
        }
        & {
          [key in IndexedDbTable.KeyPath<Table>]?: number | undefined
        }
      : Schema.Struct.MakeIn<IndexedDbTable.TableSchema<Table>["fields"]>)
    & ([IndexedDbTable.KeyPath<Table>] extends [undefined] ? {
        key: IDBValidKey
      }
      : {})

  /**
   * @since 4.0.0
   * @category models
   */
  export type ExtractIndexType<
    Table extends IndexedDbTable.AnyWithProps,
    Index extends IndexedDbDatabase.IndexFromTable<Table>
  > = [Index] extends [never] ? Schema.Schema.Type<
      IndexedDbTable.TableSchema<Table>
    >[IndexedDbTable.KeyPath<Table>]
    : Schema.Schema.Type<
      IndexedDbTable.TableSchema<Table>
    >[IndexedDbTable.Indexes<Table>[Index]]

  /**
   * @since 4.0.0
   * @category models
   */
  export type ModifyWithKey<Table extends IndexedDbTable.AnyWithProps> = SourceTableModifySchemaType<Table>

  /**
   * @since 4.0.0
   * @category models
   */
  export interface From<Table extends IndexedDbTable.AnyWithProps> {
    readonly table: Table
    readonly database: globalThis.IDBDatabase
    readonly IDBKeyRange: typeof globalThis.IDBKeyRange
    readonly transaction?: globalThis.IDBTransaction

    readonly clear: Effect.Effect<void, IndexedDbQueryError>

    readonly select: {
      <Index extends IndexedDbDatabase.IndexFromTable<Table>>(
        index: Index
      ): Select<Table, Index>
      (): Select<Table, never>
    }

    readonly count: {
      <Index extends IndexedDbDatabase.IndexFromTable<Table>>(
        index: Index
      ): Count<Table, Index>
      (): Count<Table, never>
    }

    readonly delete: {
      <Index extends IndexedDbDatabase.IndexFromTable<Table>>(
        index: Index
      ): DeletePartial<Table, Index>
      (): DeletePartial<Table, never>
    }

    readonly insert: (value: ModifyWithKey<Table>) => Modify<Table>
    readonly insertAll: (
      values: Array<ModifyWithKey<Table>>
    ) => ModifyAll<Table>
    readonly upsert: (value: ModifyWithKey<Table>) => Modify<Table>
    readonly upsertAll: (
      values: Array<ModifyWithKey<Table>>
    ) => ModifyAll<Table>
  }

  /**
   * @since 4.0.0
   * @category models
   */
  export interface Clear<
    Table extends IndexedDbTable.AnyWithProps
  > extends Pipeable, Effect.YieldableClass<void, IndexedDbQueryError> {
    readonly from: From<Table>
  }

  /**
   * @since 4.0.0
   * @category models
   */
  export interface Count<
    Table extends IndexedDbTable.AnyWithProps,
    Index extends IndexedDbDatabase.IndexFromTable<Table>
  > extends Pipeable, Effect.YieldableClass<number, IndexedDbQueryError> {
    readonly from: From<Table>
    readonly index?: Index
    readonly only?: ExtractIndexType<Table, Index>
    readonly lowerBound?: ExtractIndexType<Table, Index>
    readonly upperBound?: ExtractIndexType<Table, Index>
    readonly excludeLowerBound?: boolean
    readonly excludeUpperBound?: boolean
    readonly limitValue?: number | undefined

    readonly equals: (
      value: ExtractIndexType<Table, Index>
    ) => Omit<
      Count<Table, Index>,
      "equals" | "gte" | "lte" | "gt" | "lt" | "between"
    >

    readonly gte: (
      value: ExtractIndexType<Table, Index>
    ) => Omit<
      Count<Table, Index>,
      "equals" | "gte" | "lte" | "gt" | "lt" | "between"
    >

    readonly lte: (
      value: ExtractIndexType<Table, Index>
    ) => Omit<
      Count<Table, Index>,
      "equals" | "gte" | "lte" | "gt" | "lt" | "between"
    >

    readonly gt: (
      value: ExtractIndexType<Table, Index>
    ) => Omit<
      Count<Table, Index>,
      "equals" | "gte" | "lte" | "gt" | "lt" | "between"
    >

    readonly lt: (
      value: ExtractIndexType<Table, Index>
    ) => Omit<
      Count<Table, Index>,
      "equals" | "gte" | "lte" | "gt" | "lt" | "between"
    >

    readonly between: (
      lowerBound: ExtractIndexType<Table, Index>,
      upperBound: ExtractIndexType<Table, Index>,
      options?: { excludeLowerBound?: boolean; excludeUpperBound?: boolean }
    ) => Omit<
      Count<Table, Index>,
      "equals" | "gte" | "lte" | "gt" | "lt" | "between"
    >
  }

  /**
   * @since 4.0.0
   * @category models
   */
  export interface DeletePartial<
    Table extends IndexedDbTable.AnyWithProps,
    Index extends IndexedDbDatabase.IndexFromTable<Table>
  > {
    readonly from: From<Table>
    readonly index?: Index

    readonly equals: (
      value: ExtractIndexType<Table, Index>
    ) => Omit<
      Delete<Table, Index>,
      "equals" | "gte" | "lte" | "gt" | "lt" | "between"
    >

    readonly gte: (
      value: ExtractIndexType<Table, Index>
    ) => Omit<
      Delete<Table, Index>,
      "equals" | "gte" | "lte" | "gt" | "lt" | "between"
    >

    readonly lte: (
      value: ExtractIndexType<Table, Index>
    ) => Omit<
      Delete<Table, Index>,
      "equals" | "gte" | "lte" | "gt" | "lt" | "between"
    >

    readonly gt: (
      value: ExtractIndexType<Table, Index>
    ) => Omit<
      Delete<Table, Index>,
      "equals" | "gte" | "lte" | "gt" | "lt" | "between"
    >

    readonly lt: (
      value: ExtractIndexType<Table, Index>
    ) => Omit<
      Delete<Table, Index>,
      "equals" | "gte" | "lte" | "gt" | "lt" | "between"
    >

    readonly between: (
      lowerBound: ExtractIndexType<Table, Index>,
      upperBound: ExtractIndexType<Table, Index>,
      options?: { excludeLowerBound?: boolean; excludeUpperBound?: boolean }
    ) => Omit<
      Delete<Table, Index>,
      "equals" | "gte" | "lte" | "gt" | "lt" | "between"
    >

    readonly limit: (
      limit: number
    ) => Omit<
      Delete<Table, Index>,
      "limit" | "equals" | "gte" | "lte" | "gt" | "lt" | "between"
    >
  }

  /**
   * @since 4.0.0
   * @category models
   */
  export interface Delete<
    Table extends IndexedDbTable.AnyWithProps,
    Index extends IndexedDbDatabase.IndexFromTable<Table>
  > extends Pipeable, Effect.YieldableClass<void, IndexedDbQueryError> {
    readonly delete: DeletePartial<Table, Index>
    readonly index?: Index
    readonly limitValue?: number
    readonly only?: ExtractIndexType<Table, Index>
    readonly lowerBound?: ExtractIndexType<Table, Index>
    readonly upperBound?: ExtractIndexType<Table, Index>
    readonly excludeLowerBound?: boolean
    readonly excludeUpperBound?: boolean
    readonly predicate?: (item: IndexedDbTable.Encoded<Table>) => boolean

    readonly equals: (
      value: ExtractIndexType<Table, Index>
    ) => Omit<
      Delete<Table, Index>,
      "equals" | "gte" | "lte" | "gt" | "lt" | "between"
    >

    readonly gte: (
      value: ExtractIndexType<Table, Index>
    ) => Omit<
      Delete<Table, Index>,
      "equals" | "gte" | "lte" | "gt" | "lt" | "between"
    >

    readonly lte: (
      value: ExtractIndexType<Table, Index>
    ) => Omit<
      Delete<Table, Index>,
      "equals" | "gte" | "lte" | "gt" | "lt" | "between"
    >

    readonly gt: (
      value: ExtractIndexType<Table, Index>
    ) => Omit<
      Delete<Table, Index>,
      "equals" | "gte" | "lte" | "gt" | "lt" | "between"
    >

    readonly lt: (
      value: ExtractIndexType<Table, Index>
    ) => Omit<
      Delete<Table, Index>,
      "equals" | "gte" | "lte" | "gt" | "lt" | "between"
    >

    readonly between: (
      lowerBound: ExtractIndexType<Table, Index>,
      upperBound: ExtractIndexType<Table, Index>,
      options?: { excludeLowerBound?: boolean; excludeUpperBound?: boolean }
    ) => Omit<
      Delete<Table, Index>,
      "equals" | "gte" | "lte" | "gt" | "lt" | "between"
    >

    readonly limit: (
      limit: number
    ) => Omit<
      Delete<Table, Index>,
      "limit" | "equals" | "gte" | "lte" | "gt" | "lt" | "between"
    >

    readonly filter: (
      f: (value: IndexedDbTable.Encoded<Table>) => boolean
    ) => Delete<Table, Index>
  }

  /**
   * @since 4.0.0
   * @category models
   */
  export interface Select<
    Table extends IndexedDbTable.AnyWithProps,
    Index extends IndexedDbDatabase.IndexFromTable<Table>
  > extends
    Pipeable,
    Effect.YieldableClass<
      Array<SourceTableSelectSchemaType<Table>>,
      IndexedDbQueryError,
      IndexedDbTable.Context<Table>
    >
  {
    readonly from: From<Table>
    readonly index?: Index
    readonly limitValue?: number
    readonly only?: ExtractIndexType<Table, Index>
    readonly lowerBound?: ExtractIndexType<Table, Index>
    readonly upperBound?: ExtractIndexType<Table, Index>
    readonly excludeLowerBound?: boolean
    readonly excludeUpperBound?: boolean
    readonly predicate?: (item: IndexedDbTable.Encoded<Table>) => boolean

    readonly equals: (
      value: ExtractIndexType<Table, Index>
    ) => Omit<
      Select<Table, Index>,
      "equals" | "gte" | "lte" | "gt" | "lt" | "between"
    >

    readonly gte: (
      value: ExtractIndexType<Table, Index>
    ) => Omit<
      Select<Table, Index>,
      "equals" | "gte" | "lte" | "gt" | "lt" | "between"
    >

    readonly lte: (
      value: ExtractIndexType<Table, Index>
    ) => Omit<
      Select<Table, Index>,
      "equals" | "gte" | "lte" | "gt" | "lt" | "between"
    >

    readonly gt: (
      value: ExtractIndexType<Table, Index>
    ) => Omit<
      Select<Table, Index>,
      "equals" | "gte" | "lte" | "gt" | "lt" | "between"
    >

    readonly lt: (
      value: ExtractIndexType<Table, Index>
    ) => Omit<
      Select<Table, Index>,
      "equals" | "gte" | "lte" | "gt" | "lt" | "between"
    >

    readonly between: (
      lowerBound: ExtractIndexType<Table, Index>,
      upperBound: ExtractIndexType<Table, Index>,
      options?: { excludeLowerBound?: boolean; excludeUpperBound?: boolean }
    ) => Omit<
      Select<Table, Index>,
      "equals" | "gte" | "lte" | "gt" | "lt" | "between"
    >

    readonly limit: (
      limit: number
    ) => Omit<
      Select<Table, Index>,
      "limit" | "equals" | "gte" | "lte" | "gt" | "lt" | "between" | "first"
    >

    readonly filter: (
      f: (value: IndexedDbTable.Encoded<Table>) => boolean
    ) => Select<Table, Index>

    readonly first: () => First<Table, Index>
  }

  /**
   * @since 4.0.0
   * @category models
   */
  export interface First<
    Table extends IndexedDbTable.AnyWithProps,
    Index extends IndexedDbDatabase.IndexFromTable<Table>
  > extends
    Pipeable,
    Effect.YieldableClass<
      SourceTableSelectSchemaType<Table>,
      IndexedDbQueryError,
      IndexedDbTable.Context<Table>
    >
  {
    readonly select: Select<Table, Index>
  }

  /**
   * @since 4.0.0
   * @category models
   */
  export interface Filter<
    Table extends IndexedDbTable.AnyWithProps,
    Index extends IndexedDbDatabase.IndexFromTable<Table>
  > extends
    Pipeable,
    Effect.YieldableClass<
      Array<SourceTableSelectSchemaType<Table>>,
      IndexedDbQueryError,
      IndexedDbTable.Context<Table>
    >
  {
    readonly select: Select<Table, Index>
    readonly predicate: (item: IndexedDbTable.Encoded<Table>) => boolean
    readonly filter: (
      f: (value: IndexedDbTable.Encoded<Table>) => boolean
    ) => Filter<Table, Index>
  }

  /**
   * @since 4.0.0
   * @category models
   */
  export interface Modify<
    Table extends IndexedDbTable.AnyWithProps
  > extends
    Pipeable,
    Effect.YieldableClass<
      globalThis.IDBValidKey,
      IndexedDbQueryError,
      IndexedDbTable.Context<Table>
    >
  {
    readonly operation: "add" | "put"
    readonly from: From<Table>
    readonly value: ModifyWithKey<Table>
  }

  /**
   * @since 4.0.0
   * @category models
   */
  export interface ModifyAll<
    Table extends IndexedDbTable.AnyWithProps
  > extends
    Pipeable,
    Effect.YieldableClass<
      Array<globalThis.IDBValidKey>,
      IndexedDbQueryError,
      IndexedDbTable.Context<Table>
    >
  {
    readonly operation: "add" | "put"
    readonly from: From<Table>
    readonly values: Array<ModifyWithKey<Table>>
  }
}

// -----------------------------------------------------------------------------
// internal
// -----------------------------------------------------------------------------

type IndexedDbValidKeys<TableSchema extends IndexedDbTable.AnySchemaStruct> = keyof TableSchema["Encoded"] extends
  infer K ? K extends keyof TableSchema["Encoded"] ? TableSchema["Encoded"][K] extends Readonly<IDBValidKey> ? K
    : never
  : never
  : never

type IndexedDbValidNumberKeys<
  TableSchema extends IndexedDbTable.AnySchemaStruct
> = keyof TableSchema["Encoded"] extends infer K
  ? K extends keyof TableSchema["Encoded"] ? [TableSchema["Encoded"][K]] extends [number | undefined] ? K
    : never
  : never
  : never

const applyDelete = (query: IndexedDbQuery.Delete<any, never>) =>
  Effect.callback<any, IndexedDbQueryError>((resume) => {
    const database = query.delete.from.database
    const IDBKeyRange = query.delete.from.IDBKeyRange
    let transaction = query.delete.from.transaction
    transaction ??= database.transaction([query.delete.from.table.tableName], "readwrite")
    const objectStore = transaction.objectStore(query.delete.from.table.tableName)
    const predicate = query.predicate

    let keyRange: globalThis.IDBKeyRange | undefined = undefined

    if (query.only !== undefined) {
      keyRange = IDBKeyRange.only(query.only)
    } else if (
      query.lowerBound !== undefined &&
      query.upperBound !== undefined
    ) {
      keyRange = IDBKeyRange.bound(
        query.lowerBound,
        query.upperBound,
        query.excludeLowerBound,
        query.excludeUpperBound
      )
    } else if (query.lowerBound !== undefined) {
      keyRange = IDBKeyRange.lowerBound(
        query.lowerBound,
        query.excludeLowerBound
      )
    } else if (query.upperBound !== undefined) {
      keyRange = IDBKeyRange.upperBound(
        query.upperBound,
        query.excludeUpperBound
      )
    }

    let request: globalThis.IDBRequest

    if (query.limitValue !== undefined || predicate) {
      const cursorRequest = objectStore.openCursor()
      let count = 0

      cursorRequest.onerror = () => {
        resume(
          Effect.fail(
            new IndexedDbQueryError({
              reason: "TransactionError",
              cause: cursorRequest.error
            })
          )
        )
      }

      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result
        if (cursor === null) {
          return resume(Effect.void)
        }

        if (predicate === undefined || predicate(cursor.value)) {
          const deleteRequest = cursor.delete()
          deleteRequest.onerror = () => {
            resume(
              Effect.fail(
                new IndexedDbQueryError({
                  reason: "TransactionError",
                  cause: deleteRequest.error
                })
              )
            )
          }
          count += 1
        }

        if (query.limitValue === undefined || count < query.limitValue) {
          return cursor.continue()
        }

        resume(Effect.void)
      }
    } else if (keyRange !== undefined) {
      request = objectStore.delete(keyRange)

      request.onerror = (event) => {
        resume(
          Effect.fail(
            new IndexedDbQueryError({
              reason: "TransactionError",
              cause: event
            })
          )
        )
      }

      request.onsuccess = () => {
        resume(Effect.succeed(request.result))
      }
    } else {
      resume(
        Effect.die(new Error("No key range provided for delete operation"))
      )
    }
  })

const getReadonlyObjectStore = (
  query: IndexedDbQuery.Select<any, never> | IndexedDbQuery.Count<any, never>
) => {
  const database = query.from.database
  const IDBKeyRange = query.from.IDBKeyRange
  const transaction = query.from.transaction
  const objectStore = (
    transaction ??
      database.transaction([query.from.table.tableName], "readonly")
  ).objectStore(query.from.table.tableName)

  let keyRange: globalThis.IDBKeyRange | undefined = undefined
  let store: globalThis.IDBObjectStore | globalThis.IDBIndex

  if (query.only !== undefined) {
    keyRange = IDBKeyRange.only(query.only)
  } else if (query.lowerBound !== undefined && query.upperBound !== undefined) {
    keyRange = IDBKeyRange.bound(
      query.lowerBound,
      query.upperBound,
      query.excludeLowerBound,
      query.excludeUpperBound
    )
  } else if (query.lowerBound !== undefined) {
    keyRange = IDBKeyRange.lowerBound(
      query.lowerBound,
      query.excludeLowerBound
    )
  } else if (query.upperBound !== undefined) {
    keyRange = IDBKeyRange.upperBound(
      query.upperBound,
      query.excludeUpperBound
    )
  }

  if (query.index !== undefined) {
    store = objectStore.index(query.index)
  } else {
    store = objectStore
  }

  return { store, keyRange }
}

const getSelect = Effect.fnUntraced(function*(
  query: IndexedDbQuery.Select<any, never>
) {
  const keyPath = query.from.table.keyPath
  const predicate = query.predicate

  const data = predicate || keyPath === undefined ?
    yield* Effect.callback<any, IndexedDbQueryError>((resume) => {
      const { keyRange, store } = getReadonlyObjectStore(query)

      const cursorRequest = store.openCursor(keyRange)
      const results: Array<any> = []
      let count = 0

      cursorRequest.onerror = () => {
        resume(
          Effect.fail(
            new IndexedDbQueryError({
              reason: "TransactionError",
              cause: cursorRequest.error
            })
          )
        )
      }

      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result
        if (cursor === null) {
          return resume(Effect.succeed(results))
        }

        if (predicate === undefined || predicate(cursor.value)) {
          results.push(
            keyPath === undefined
              ? { ...cursor.value, key: cursor.key }
              : cursor.value
          )
          count += 1
        }

        if (query.limitValue === undefined || count < query.limitValue) {
          return cursor.continue()
        }

        resume(Effect.succeed(results))
      }
    }) :
    yield* Effect.callback<any, IndexedDbQueryError>((resume) => {
      const { keyRange, store } = getReadonlyObjectStore(query)
      const request = store.getAll(keyRange, query.limitValue)
      request.onerror = (event) => {
        resume(
          Effect.fail(
            new IndexedDbQueryError({
              reason: "TransactionError",
              cause: event
            })
          )
        )
      }
      request.onsuccess = () => {
        resume(Effect.succeed(request.result))
      }
    })

  const tableSchema = (query.from.table as IndexedDbTable.AnyWithProps).arraySchema

  return yield* Schema.decodeUnknownEffect(tableSchema)(data).pipe(
    Effect.mapError(
      (error) =>
        new IndexedDbQueryError({
          reason: "DecodeError",
          cause: error
        })
    )
  )
})

const getFirst = Effect.fnUntraced(function*(
  query: IndexedDbQuery.First<any, never>
) {
  const keyPath = query.select.from.table.keyPath

  const data = yield* Effect.callback<any, IndexedDbQueryError>((resume) => {
    const { keyRange, store } = getReadonlyObjectStore(query.select)

    if (keyRange !== undefined) {
      const request = store.get(keyRange)

      request.onerror = (event) => {
        resume(
          Effect.fail(
            new IndexedDbQueryError({
              reason: "TransactionError",
              cause: event
            })
          )
        )
      }

      request.onsuccess = () => {
        resume(Effect.succeed(request.result))
      }
    } else {
      const request = store.openCursor()

      request.onerror = (event) => {
        resume(
          Effect.fail(
            new IndexedDbQueryError({
              reason: "TransactionError",
              cause: event
            })
          )
        )
      }

      request.onsuccess = () => {
        const value = request.result?.value
        const key = request.result?.key

        if (value === undefined) {
          resume(
            Effect.fail(
              new IndexedDbQueryError({
                reason: "NotFoundError",
                cause: request.error
              })
            )
          )
        } else {
          resume(
            Effect.succeed(keyPath === undefined ? { ...value, key } : value)
          )
        }
      }
    }
  })

  return yield* Schema.decodeUnknownEffect(query.select.from.table.readSchema)(
    data
  ).pipe(
    Effect.mapError(
      (error) =>
        new IndexedDbQueryError({
          reason: "DecodeError",
          cause: error
        })
    )
  )
})

const applyModify = Effect.fnUntraced(function*({
  query,
  value
}: {
  query: IndexedDbQuery.Modify<any>
  value: any
}) {
  const autoIncrement = query.from.table.autoIncrement as boolean
  const keyPath = query.from.table.keyPath
  const table = query.from.table
  const schema = autoIncrement && value[keyPath] === undefined
    ? table.autoincrementSchema
    : table.tableSchema

  const encodedValue = yield* SchemaParser.makeEffect(
    autoIncrement && value[keyPath] === undefined
      ? table.autoincrementSchema
      : table.tableSchema
  )(value).pipe(
    Effect.flatMap(Schema.encodeUnknownEffect(schema)),
    Effect.mapError(
      (error) =>
        new IndexedDbQueryError({
          reason: "EncodeError",
          cause: error
        })
    )
  )

  return yield* Effect.callback<any, IndexedDbQueryError>((resume) => {
    const database = query.from.database
    const transaction = query.from.transaction
    const objectStore = (
      transaction ??
        database.transaction([query.from.table.tableName], "readwrite")
    ).objectStore(query.from.table.tableName)

    let request: globalThis.IDBRequest<IDBValidKey>

    if (query.operation === "add") {
      request = objectStore.add(
        encodedValue,
        keyPath === undefined ? value["key"] : undefined
      )
    } else if (query.operation === "put") {
      request = objectStore.put(
        encodedValue,
        keyPath === undefined ? value["key"] : undefined
      )
    } else {
      return resume(Effect.die(new Error("Invalid modify operation")))
    }

    request.onerror = (event) => {
      resume(
        Effect.fail(
          new IndexedDbQueryError({
            reason: "TransactionError",
            cause: event
          })
        )
      )
    }

    request.onsuccess = () => {
      resume(Effect.succeed(request.result))
    }
  })
})

const applyModifyAll = Effect.fnUntraced(
  function*({
    query,
    values
  }: {
    query: IndexedDbQuery.ModifyAll<any>
    values: Array<any>
  }) {
    const autoIncrement = query.from.table.autoIncrement as boolean
    const keyPath = query.from.table.keyPath
    const schema = query.from.table.tableSchema
    const encodedValues = new Array(values.length)
    const makeValue = SchemaParser.makeEffect(schema)
    const encodeValue = SchemaParser.encodeUnknownEffect(schema)
    const makeValueAutoincrement = SchemaParser.makeEffect(query.from.table.autoincrementSchema)
    const encodeValueAutoincrement = SchemaParser.encodeUnknownEffect(query.from.table.autoincrementSchema)

    for (let i = 0; i < values.length; i++) {
      const value = values[i]
      if (autoIncrement && value[keyPath] === undefined) {
        encodedValues[i] = yield* encodeValueAutoincrement(yield* makeValueAutoincrement(value))
      } else {
        encodedValues[i] = yield* encodeValue(yield* makeValue(value))
      }
    }

    return yield* Effect.callback<
      Array<globalThis.IDBValidKey>,
      IndexedDbQueryError
    >((resume) => {
      const database = query.from.database
      const transaction = query.from.transaction
      const objectStore = (
        transaction ??
          database.transaction([query.from.table.tableName], "readwrite")
      ).objectStore(query.from.table.tableName)

      const results: Array<globalThis.IDBValidKey> = []

      if (query.operation === "add") {
        for (let i = 0; i < encodedValues.length; i++) {
          const request = objectStore.add(
            encodedValues[i],
            keyPath === undefined ? values[i]["key"] : undefined
          )

          request.onerror = () => {
            resume(
              Effect.fail(
                new IndexedDbQueryError({
                  reason: "TransactionError",
                  cause: request.error
                })
              )
            )
          }

          request.onsuccess = () => {
            results.push(request.result)
          }
        }
      } else if (query.operation === "put") {
        for (let i = 0; i < encodedValues.length; i++) {
          const request = objectStore.put(
            encodedValues[i],
            keyPath === undefined ? values[i]["key"] : undefined
          )

          request.onerror = () => {
            resume(
              Effect.fail(
                new IndexedDbQueryError({
                  reason: "TransactionError",
                  cause: request.error
                })
              )
            )
          }

          request.onsuccess = () => {
            results.push(request.result)
          }
        }
      } else {
        return resume(Effect.die(new Error("Invalid modify all operation")))
      }

      objectStore.transaction.onerror = () => {
        resume(
          Effect.fail(
            new IndexedDbQueryError({
              reason: "TransactionError",
              cause: objectStore.transaction.error
            })
          )
        )
      }

      objectStore.transaction.oncomplete = () => {
        resume(Effect.succeed(results))
      }
    })
  },
  Effect.catchIf(
    SchemaIssue.isIssue,
    (issue) => Effect.fail(new IndexedDbQueryError({ reason: "EncodeError", cause: new Schema.SchemaError(issue) }))
  )
)

const applyClear = (options: {
  readonly database: globalThis.IDBDatabase
  readonly transaction: globalThis.IDBTransaction | undefined
  readonly table: string
}) =>
  Effect.callback<void, IndexedDbQueryError>((resume) => {
    const database = options.database
    const transaction = options.transaction
    const objectStore = (
      transaction ?? database.transaction([options.table], "readwrite")
    ).objectStore(options.table)

    const request = objectStore.clear()

    request.onerror = (event) => {
      resume(
        Effect.fail(
          new IndexedDbQueryError({
            reason: "TransactionError",
            cause: event
          })
        )
      )
    }

    request.onsuccess = () => {
      resume(Effect.void)
    }
  })

const applyClearAll = (options: {
  readonly database: globalThis.IDBDatabase
  readonly transaction: globalThis.IDBTransaction | undefined
}) =>
  Effect.callback<void, IndexedDbQueryError>((resume) => {
    const database = options.database
    const tables = database.objectStoreNames

    const transaction = options.transaction ?? database.transaction([...tables], "readwrite")

    for (let t = 0; t < tables.length; t++) {
      const objectStore = transaction.objectStore(tables[t])
      const request = objectStore.clear()

      request.onerror = () => {
        resume(
          Effect.fail(
            new IndexedDbQueryError({
              reason: "TransactionError",
              cause: request.error
            })
          )
        )
      }
    }

    transaction.onerror = () => {
      resume(
        Effect.fail(
          new IndexedDbQueryError({
            reason: "TransactionError",
            cause: transaction.error
          })
        )
      )
    }

    transaction.oncomplete = () => {
      resume(Effect.void)
    }
  })

const getCount = (query: IndexedDbQuery.Count<any, never>) =>
  Effect.callback<number, IndexedDbQueryError>((resume) => {
    const { keyRange, store } = getReadonlyObjectStore(query)

    const request = store.count(keyRange)

    request.onerror = (event) => {
      resume(
        Effect.fail(
          new IndexedDbQueryError({
            reason: "TransactionError",
            cause: event
          })
        )
      )
    }

    request.onsuccess = () => {
      resume(Effect.succeed(request.result))
    }
  })

const FromProto: Omit<
  IndexedDbQuery.From<any>,
  | "table"
  | "database"
  | "IDBKeyRange"
  | "transaction"
> = {
  ...CommonProto,
  select<Index extends IndexedDbDatabase.IndexFromTable<any>>(
    this: IndexedDbQuery.From<any>,
    index?: Index
  ) {
    return makeSelect({
      from: this,
      index
    }) as any
  },
  count<Index extends IndexedDbDatabase.IndexFromTable<any>>(
    this: IndexedDbQuery.From<any>,
    index?: Index
  ) {
    return makeCount({
      from: this,
      index
    }) as any
  },
  delete<Index extends IndexedDbDatabase.IndexFromTable<any>>(
    this: IndexedDbQuery.From<any>,
    index?: Index
  ) {
    return makeDeletePartial({
      from: this,
      index
    }) as any
  },
  insert(this: IndexedDbQuery.From<any>, value: any) {
    return makeModify({ from: this, value, operation: "add" })
  },
  upsert(this: IndexedDbQuery.From<any>, value: any) {
    return makeModify({ from: this, value, operation: "put" })
  },
  insertAll(this: IndexedDbQuery.From<any>, values: Array<any>) {
    return makeModifyAll({ from: this, values, operation: "add" })
  },
  upsertAll(this: IndexedDbQuery.From<any>, values: Array<any>) {
    return makeModifyAll({ from: this, values, operation: "put" })
  },
  get clear() {
    const self = this as IndexedDbQuery.From<any>
    return applyClear({
      database: self.database,
      transaction: self.transaction,
      table: self.table.tableName
    })
  }
}

const makeFrom = <
  const Table extends IndexedDbTable.AnyWithProps
>(options: {
  readonly table: Table
  readonly database: globalThis.IDBDatabase
  readonly IDBKeyRange: typeof globalThis.IDBKeyRange
  readonly transaction: globalThis.IDBTransaction | undefined
}): IndexedDbQuery.From<Table> => {
  const self = Object.create(FromProto)
  self.table = options.table
  self.database = options.database
  self.IDBKeyRange = options.IDBKeyRange
  self.transaction = options.transaction
  return self
}

const DeletePartialProto: Omit<
  IndexedDbQuery.DeletePartial<any, never>,
  | "from"
  | "index"
> = {
  ...CommonProto,
  limit(this: IndexedDbQuery.DeletePartial<any, never>, limit: number) {
    return makeDelete({
      delete: this as any,
      limitValue: limit
    })
  },
  equals(this: IndexedDbQuery.DeletePartial<any, never>, value: IndexedDbQuery.ExtractIndexType<any, never>) {
    return makeDelete({
      delete: this as any,
      only: value
    })
  },
  gte(this: IndexedDbQuery.DeletePartial<any, never>, value: IndexedDbQuery.ExtractIndexType<any, never>) {
    return makeDelete({
      delete: this as any,
      lowerBound: value,
      excludeLowerBound: false
    })
  },
  lte(this: IndexedDbQuery.DeletePartial<any, never>, value: IndexedDbQuery.ExtractIndexType<any, never>) {
    return makeDelete({
      delete: this as any,
      upperBound: value,
      excludeUpperBound: false
    })
  },
  gt(this: IndexedDbQuery.DeletePartial<any, never>, value: IndexedDbQuery.ExtractIndexType<any, never>) {
    return makeDelete({
      delete: this as any,
      lowerBound: value,
      excludeLowerBound: true
    })
  },
  lt(this: IndexedDbQuery.DeletePartial<any, never>, value: IndexedDbQuery.ExtractIndexType<any, never>) {
    return makeDelete({
      delete: this as any,
      upperBound: value,
      excludeUpperBound: true
    })
  },
  between(
    this: IndexedDbQuery.DeletePartial<any, never>,
    lowerBound: IndexedDbQuery.ExtractIndexType<any, never>,
    upperBound: IndexedDbQuery.ExtractIndexType<any, never>,
    queryOptions?: { excludeLowerBound?: boolean; excludeUpperBound?: boolean }
  ) {
    return makeDelete({
      delete: this as any,
      lowerBound,
      upperBound,
      excludeLowerBound: queryOptions?.excludeLowerBound ?? false,
      excludeUpperBound: queryOptions?.excludeUpperBound ?? false
    })
  }
}

const makeDeletePartial = <
  Table extends IndexedDbTable.AnyWithProps,
  Index extends IndexedDbDatabase.IndexFromTable<Table>
>(options: {
  readonly from: IndexedDbQuery.From<Table>
  readonly index: Index | undefined
}): IndexedDbQuery.DeletePartial<Table, Index> => {
  const self = Object.create(DeletePartialProto)
  self.from = options.from
  self.index = options.index
  return self as any
}

const DeleteProto: Omit<
  IndexedDbQuery.Delete<any, never>,
  | "delete"
  | "limitValue"
  | "only"
  | "lowerBound"
  | "upperBound"
  | "excludeLowerBound"
  | "excludeUpperBound"
  | "predicate"
> = {
  ...CommonProto,
  asEffect(this: IndexedDbQuery.Delete<any, never>) {
    return applyDelete(this) as any
  },
  limit(this: IndexedDbQuery.Delete<any, never>, limit: number) {
    return makeDelete({
      delete: this.delete,
      only: this.only,
      lowerBound: this.lowerBound,
      upperBound: this.upperBound,
      excludeLowerBound: this.excludeLowerBound ?? false,
      excludeUpperBound: this.excludeUpperBound ?? false,
      limitValue: limit
    })
  },
  equals(this: IndexedDbQuery.Delete<any, never>, value: IndexedDbQuery.ExtractIndexType<any, never>) {
    return makeDelete({
      delete: this.delete,
      only: value,
      limitValue: this.limitValue
    })
  },
  gte(this: IndexedDbQuery.Delete<any, never>, value: IndexedDbQuery.ExtractIndexType<any, never>) {
    return makeDelete({
      delete: this.delete,
      lowerBound: value,
      excludeLowerBound: false,
      limitValue: this.limitValue
    })
  },
  lte(this: IndexedDbQuery.Delete<any, never>, value: IndexedDbQuery.ExtractIndexType<any, never>) {
    return makeDelete({
      delete: this.delete,
      upperBound: value,
      excludeUpperBound: false,
      limitValue: this.limitValue
    })
  },
  gt(this: IndexedDbQuery.Delete<any, never>, value: IndexedDbQuery.ExtractIndexType<any, never>) {
    return makeDelete({
      delete: this.delete,
      lowerBound: value,
      excludeLowerBound: true,
      limitValue: this.limitValue
    })
  },
  lt(this: IndexedDbQuery.Delete<any, never>, value: IndexedDbQuery.ExtractIndexType<any, never>) {
    return makeDelete({
      delete: this.delete,
      upperBound: value,
      excludeUpperBound: true,
      limitValue: this.limitValue
    })
  },
  between(
    this: IndexedDbQuery.Delete<any, never>,
    lowerBound: IndexedDbQuery.ExtractIndexType<any, never>,
    upperBound: IndexedDbQuery.ExtractIndexType<any, never>,
    queryOptions?: { excludeLowerBound?: boolean; excludeUpperBound?: boolean }
  ) {
    return makeDelete({
      delete: this.delete,
      lowerBound,
      upperBound,
      excludeLowerBound: queryOptions?.excludeLowerBound ?? false,
      excludeUpperBound: queryOptions?.excludeUpperBound ?? false,
      limitValue: this.limitValue
    })
  },
  filter(this: IndexedDbQuery.Delete<any, never>, filter: (value: IndexedDbTable.Encoded<any>) => boolean) {
    const prev = this.predicate
    return makeDelete({
      delete: this.delete,
      predicate: prev ? (item) => prev(item) && filter(item) : filter
    })
  }
}

const makeDelete = <
  Table extends IndexedDbTable.AnyWithProps,
  Index extends IndexedDbDatabase.IndexFromTable<Table>
>(options: {
  readonly delete: IndexedDbQuery.DeletePartial<Table, Index>
  readonly limitValue?: number | undefined
  readonly only?: IndexedDbQuery.ExtractIndexType<Table, Index> | undefined
  readonly lowerBound?:
    | IndexedDbQuery.ExtractIndexType<Table, Index>
    | undefined
  readonly upperBound?:
    | IndexedDbQuery.ExtractIndexType<Table, Index>
    | undefined
  readonly excludeLowerBound?: boolean | undefined
  readonly excludeUpperBound?: boolean | undefined
  readonly predicate?: ((item: IndexedDbTable.Encoded<Table>) => boolean) | undefined
}): IndexedDbQuery.Delete<Table, Index> => {
  const self = Object.create(DeleteProto)
  self.delete = options.delete
  self.limitValue = options.limitValue
  self.only = options.only
  self.lowerBound = options.lowerBound
  self.upperBound = options.upperBound
  self.excludeLowerBound = options.excludeLowerBound
  self.excludeUpperBound = options.excludeUpperBound
  self.predicate = options.predicate
  return self
}

const CountProto: Omit<
  IndexedDbQuery.Count<any, never>,
  | "from"
  | "index"
  | "only"
  | "lowerBound"
  | "upperBound"
  | "excludeLowerBound"
  | "excludeUpperBound"
> = {
  ...CommonProto,
  asEffect(this: IndexedDbQuery.Count<any, never>) {
    return getCount(this) as any
  },
  equals(this: IndexedDbQuery.Count<any, never>, value: IndexedDbQuery.ExtractIndexType<any, never>) {
    return makeCount({
      from: this.from,
      index: this.index,
      only: value,
      limitValue: this.limitValue
    })
  },
  gte(this: IndexedDbQuery.Count<any, never>, value: IndexedDbQuery.ExtractIndexType<any, never>) {
    return makeCount({
      from: this.from,
      index: this.index,
      lowerBound: value,
      excludeLowerBound: false,
      limitValue: this.limitValue
    })
  },
  lte(this: IndexedDbQuery.Count<any, never>, value: IndexedDbQuery.ExtractIndexType<any, never>) {
    return makeCount({
      from: this.from,
      index: this.index,
      upperBound: value,
      excludeUpperBound: false,
      limitValue: this.limitValue
    })
  },
  gt(this: IndexedDbQuery.Count<any, never>, value: IndexedDbQuery.ExtractIndexType<any, never>) {
    return makeCount({
      from: this.from,
      index: this.index,
      lowerBound: value,
      excludeLowerBound: true,
      limitValue: this.limitValue
    })
  },
  lt(this: IndexedDbQuery.Count<any, never>, value: IndexedDbQuery.ExtractIndexType<any, never>) {
    return makeCount({
      from: this.from,
      index: this.index,
      upperBound: value,
      excludeUpperBound: true,
      limitValue: this.limitValue
    })
  },
  between(
    this: IndexedDbQuery.Count<any, never>,
    lowerBound: IndexedDbQuery.ExtractIndexType<any, never>,
    upperBound: IndexedDbQuery.ExtractIndexType<any, never>,
    queryOptions?: { excludeLowerBound?: boolean; excludeUpperBound?: boolean }
  ) {
    return makeCount({
      from: this.from,
      index: this.index,
      lowerBound,
      upperBound,
      excludeLowerBound: queryOptions?.excludeLowerBound ?? false,
      excludeUpperBound: queryOptions?.excludeUpperBound ?? false,
      limitValue: this.limitValue
    })
  }
}

const makeCount = <
  Table extends IndexedDbTable.AnyWithProps,
  Index extends IndexedDbDatabase.IndexFromTable<Table>
>(options: {
  readonly from: IndexedDbQuery.From<Table>
  readonly index: Index | undefined
  readonly limitValue?: number | undefined
  readonly only?: IndexedDbQuery.ExtractIndexType<Table, Index> | undefined
  readonly lowerBound?:
    | IndexedDbQuery.ExtractIndexType<Table, Index>
    | undefined
  readonly upperBound?:
    | IndexedDbQuery.ExtractIndexType<Table, Index>
    | undefined
  readonly excludeLowerBound?: boolean | undefined
  readonly excludeUpperBound?: boolean | undefined
}): IndexedDbQuery.Count<Table, Index> => {
  const self = Object.create(CountProto)
  self.from = options.from
  self.index = options.index
  self.only = options.only
  self.limitValue = options.limitValue
  self.lowerBound = options.lowerBound
  self.upperBound = options.upperBound
  self.excludeLowerBound = options.excludeLowerBound
  self.excludeUpperBound = options.excludeUpperBound
  return self
}

const SelectProto: Omit<
  IndexedDbQuery.Select<any, never>,
  | "from"
  | "index"
  | "limitValue"
  | "only"
  | "lowerBound"
  | "upperBound"
  | "excludeLowerBound"
  | "excludeUpperBound"
> = {
  ...CommonProto,
  limit(this: IndexedDbQuery.Select<any, never>, limit: number) {
    return makeSelect({
      ...this,
      limitValue: limit
    })
  },
  equals(this: IndexedDbQuery.Select<any, never>, value: IndexedDbQuery.ExtractIndexType<any, never>) {
    return makeSelect({
      ...this,
      only: value
    })
  },
  gte(this: IndexedDbQuery.Select<any, never>, value: IndexedDbQuery.ExtractIndexType<any, never>) {
    return makeSelect({
      ...this,
      lowerBound: value,
      excludeLowerBound: false
    })
  },
  lte(this: IndexedDbQuery.Select<any, never>, value: IndexedDbQuery.ExtractIndexType<any, never>) {
    return makeSelect({
      ...this,
      upperBound: value,
      excludeUpperBound: false
    })
  },
  gt(this: IndexedDbQuery.Select<any, never>, value: IndexedDbQuery.ExtractIndexType<any, never>) {
    return makeSelect({
      ...this,
      lowerBound: value,
      excludeLowerBound: true
    })
  },
  lt(this: IndexedDbQuery.Select<any, never>, value: IndexedDbQuery.ExtractIndexType<any, never>) {
    return makeSelect({
      from: this.from,
      index: this.index,
      upperBound: value,
      excludeUpperBound: true,
      limitValue: this.limitValue
    })
  },
  between(
    this: IndexedDbQuery.Select<any, never>,
    lowerBound: IndexedDbQuery.ExtractIndexType<any, never>,
    upperBound: IndexedDbQuery.ExtractIndexType<any, never>,
    queryOptions?: { excludeLowerBound?: boolean; excludeUpperBound?: boolean }
  ) {
    return makeSelect({
      ...this,
      lowerBound,
      upperBound,
      excludeLowerBound: queryOptions?.excludeLowerBound ?? false,
      excludeUpperBound: queryOptions?.excludeUpperBound ?? false
    })
  },
  first(this: IndexedDbQuery.Select<any, never>) {
    return makeFirst({ select: this })
  },
  filter(this: IndexedDbQuery.Select<any, never>, filter: (value: IndexedDbTable.Encoded<any>) => boolean) {
    const prev = this.predicate
    return makeSelect({
      ...this,
      predicate: prev ? (item) => prev(item) && filter(item) : filter
    })
  },
  asEffect(this: IndexedDbQuery.Select<any, never>) {
    return getSelect(this) as any
  }
}

const makeSelect = <
  Table extends IndexedDbTable.AnyWithProps,
  Index extends IndexedDbDatabase.IndexFromTable<Table>
>(options: {
  readonly from: IndexedDbQuery.From<Table>
  readonly index?: Index | undefined
  readonly limitValue?: number | undefined
  readonly only?: IndexedDbQuery.ExtractIndexType<Table, Index> | undefined
  readonly lowerBound?:
    | IndexedDbQuery.ExtractIndexType<Table, Index>
    | undefined
  readonly upperBound?:
    | IndexedDbQuery.ExtractIndexType<Table, Index>
    | undefined
  readonly excludeLowerBound?: boolean | undefined
  readonly excludeUpperBound?: boolean | undefined
  readonly predicate?: ((item: IndexedDbTable.Encoded<Table>) => boolean) | undefined
}): IndexedDbQuery.Select<Table, Index> => {
  const self = Object.create(SelectProto)
  self.from = options.from
  self.index = options.index
  self.only = options.only
  self.limitValue = options.limitValue
  self.lowerBound = options.lowerBound
  self.upperBound = options.upperBound
  self.excludeLowerBound = options.excludeLowerBound
  self.excludeUpperBound = options.excludeUpperBound
  self.predicate = options.predicate
  return self as any
}

const FirstProto: Omit<
  IndexedDbQuery.First<any, never>,
  "select"
> = {
  ...CommonProto,
  asEffect(this: IndexedDbQuery.First<any, never>) {
    return getFirst(this) as any
  }
}

const makeFirst = <
  Table extends IndexedDbTable.AnyWithProps,
  Index extends IndexedDbDatabase.IndexFromTable<Table>
>(options: {
  readonly select: IndexedDbQuery.Select<Table, Index>
}): IndexedDbQuery.First<Table, Index> => {
  const self = Object.create(FirstProto)
  self.select = options.select
  return self as any
}

const ModifyProto: Omit<
  IndexedDbQuery.Modify<any>,
  | "from"
  | "value"
  | "operation"
> = {
  ...CommonProto,
  asEffect(this: IndexedDbQuery.Modify<any>) {
    return applyModify({ query: this, value: this.value }) as any
  }
}

const makeModify = <Table extends IndexedDbTable.AnyWithProps>(options: {
  readonly from: IndexedDbQuery.From<Table>
  readonly value: IndexedDbTable.TableSchema<Table>["Type"]
  readonly operation: "add" | "put"
}): IndexedDbQuery.Modify<Table> => {
  const self = Object.create(ModifyProto)
  self.from = options.from
  self.value = options.value
  self.operation = options.operation
  return self as any
}

const ModifyAllProto: Omit<
  IndexedDbQuery.ModifyAll<any>,
  | "from"
  | "values"
  | "operation"
> = {
  ...CommonProto,
  asEffect(this: IndexedDbQuery.ModifyAll<any>) {
    return applyModifyAll({ query: this, values: this.values }) as any
  }
}

const makeModifyAll = <
  Table extends IndexedDbTable.AnyWithProps
>(options: {
  readonly from: IndexedDbQuery.From<Table>
  readonly values: Array<IndexedDbTable.TableSchema<Table>["Type"]>
  readonly operation: "add" | "put"
}): IndexedDbQuery.ModifyAll<Table> => {
  const self = Object.create(ModifyAllProto)
  self.from = options.from
  self.values = options.values
  self.operation = options.operation
  return self as any
}

const QueryBuilderProto: Omit<
  IndexedDbQueryBuilder<any>,
  | "tables"
  | "database"
  | "IDBKeyRange"
  | "IDBTransaction"
> = {
  ...CommonProto,
  use(this: IndexedDbQueryBuilder<any>, f: (database: globalThis.IDBDatabase) => Promise<any>) {
    return Effect.tryPromise({
      try: () => f(this.database),
      catch: (error) =>
        new IndexedDbQueryError({
          reason: "UnknownError",
          cause: error
        })
    })
  },
  from(this: IndexedDbQueryBuilder<any>, table: any) {
    return makeFrom({
      database: this.database,
      IDBKeyRange: this.IDBKeyRange,
      table: this.tables.get(table)!,
      transaction: this.IDBTransaction
    }) as any
  },
  get clearAll() {
    const self = this as IndexedDbQueryBuilder<any>
    return applyClearAll({ database: self.database, transaction: self.IDBTransaction })
  },
  transaction: Effect.fnUntraced(function*<E, R>(
    this: IndexedDbQueryBuilder<any>,
    transactionTables: Array<
      IndexedDbTable.TableName<IndexedDbVersion.Tables<any>>
    >,
    mode: globalThis.IDBTransactionMode,
    callback: (api: {
      readonly from: <
        Name extends IndexedDbTable.TableName<IndexedDbVersion.Tables<any>>
      >(
        table: Name
      ) => IndexedDbQuery.From<IndexedDbVersion.TableWithName<any, Name>>
    }) => Effect.Effect<void, E, R>,
    options?: globalThis.IDBTransactionOptions
  ) {
    const transaction = this.database.transaction(transactionTables, mode, options)
    return yield* callback({
      from: (table) =>
        makeFrom({
          database: this.database,
          IDBKeyRange: this.IDBKeyRange,
          table: this.tables.get(table) as any,
          transaction
        })
    })
  }) as any
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const make = <Source extends IndexedDbVersion.AnyWithProps>({
  IDBKeyRange,
  database,
  tables,
  transaction
}: {
  readonly database: globalThis.IDBDatabase
  readonly IDBKeyRange: typeof globalThis.IDBKeyRange
  readonly tables: ReadonlyMap<string, IndexedDbVersion.Tables<Source>>
  readonly transaction: globalThis.IDBTransaction | undefined
}): IndexedDbQueryBuilder<Source> => {
  const self = Object.create(QueryBuilderProto)
  self.tables = tables
  self.database = database
  self.IDBKeyRange = IDBKeyRange
  self.IDBTransaction = transaction
  return self
}
