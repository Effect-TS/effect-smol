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
 * @category models
 * @since 4.0.0
 */
export interface IndexedDb {
  readonly [TypeId]: typeof TypeId
  readonly indexedDB: globalThis.IDBFactory
  readonly IDBKeyRange: typeof globalThis.IDBKeyRange
}

/**
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
 * Schema for `IDBValidKey` (`number | string | Date | BufferSource | IDBValidKey[]`).
 *
 * @category schemas
 * @since 4.0.0
 */
export const IDBValidKey = Schema.Union([IDBFlatKey, Schema.Array(IDBFlatKey)])

/**
 * Schema for `autoIncrement` key path (`number`).
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
 * @category constructor
 * @since 4.0.0
 */
export const make = (impl: Omit<IndexedDb, typeof TypeId>): IndexedDb => IndexedDb.of({ [TypeId]: TypeId, ...impl })

/**
 * Instance of IndexedDb from the `window` object.
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
