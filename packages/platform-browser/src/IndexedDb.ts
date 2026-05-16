/**
 * @since 4.0.0
 */
import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import * as SchemaIssue from "effect/SchemaIssue"

const TypeId = "~@effect/platform-browser/IndexedDb"

/**
 * Service interface that provides the browser `indexedDB` factory and `IDBKeyRange` constructor.
 *
 * @category models
 * @since 4.0.0
 */
export interface IndexedDb {
  readonly [TypeId]: typeof TypeId
  readonly indexedDB: globalThis.IDBFactory
  readonly IDBKeyRange: typeof globalThis.IDBKeyRange
}

/**
 * Service tag for browser IndexedDB primitives.
 *
 * @category tag
 * @since 4.0.0
 */
export const IndexedDb: Context.Service<IndexedDb, IndexedDb> = Context.Service<IndexedDb, IndexedDb>(TypeId)

/** @internal */
const IDBFlatKey = Schema.Union([
  Schema.String,
  Schema.Number.check(Schema.makeFilter((input) => !Number.isNaN(input))),
  Schema.DateValid,
  Schema.declare(
    (input): input is BufferSource =>
      input instanceof ArrayBuffer ||
      (ArrayBuffer.isView(input) && input.buffer instanceof ArrayBuffer)
  )
])

/**
 * Schema for IndexedDB keys: strings, non-NaN numbers, valid dates, buffer sources, or arrays of those flat key values.
 *
 * @category schemas
 * @since 4.0.0
 */
export const IDBValidKey = Schema.Union([IDBFlatKey, Schema.Array(IDBFlatKey)])

/**
 * Schema for auto-incremented IndexedDB keys, accepting integers from 1 through `2 ** 53`.
 *
 * @category schemas
 * @since 4.0.0
 */
export const AutoIncrement = Schema.Int.check(
  Schema.isBetween({ minimum: 1, maximum: 2 ** 53 })
).annotate({
  identifier: "AutoIncrement",
  title: "autoIncrement",
  description: "Defines a valid autoIncrement key path for the IndexedDb table"
})

/**
 * Creates an `IndexedDb` service from an `IDBFactory` and `IDBKeyRange` constructor.
 *
 * @category constructor
 * @since 4.0.0
 */
export const make = (impl: Omit<IndexedDb, typeof TypeId>): IndexedDb => IndexedDb.of({ [TypeId]: TypeId, ...impl })

/**
 * Layer that provides `IndexedDb` from `window.indexedDB` and `window.IDBKeyRange`, failing with a config error when they are unavailable.
 *
 * @category constructors
 * @since 4.0.0
 */
export const layerWindow: Layer.Layer<IndexedDb, Config.ConfigError> = Layer.effect(
  IndexedDb,
  Effect.suspend(() => {
    if (window.indexedDB && window.IDBKeyRange) {
      return Effect.succeed(
        make({
          indexedDB: window.indexedDB,
          IDBKeyRange: window.IDBKeyRange
        })
      )
    } else {
      return Effect.fail(
        new Config.ConfigError(
          new Schema.SchemaError(
            new SchemaIssue.MissingKey({
              messageMissingKey: "window.indexedDB is not available"
            })
          )
        )
      )
    }
  })
)
