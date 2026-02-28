/**
 * @since 1.0.0
 */
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as ServiceMap from "effect/ServiceMap";

/**
 * @since 1.0.0
 * @category type ids
 */
export const TypeId: unique symbol = Symbol.for(
  "@effect/platform-browser/IndexedDb",
);

/**
 * @since 1.0.0
 * @category type ids
 */
export type TypeId = typeof TypeId;

/**
 * @since 1.0.0
 * @category models
 */
export interface IndexedDb {
  readonly [TypeId]: TypeId;
  readonly indexedDB: globalThis.IDBFactory;
  readonly IDBKeyRange: typeof globalThis.IDBKeyRange;
}

/**
 * @since 1.0.0
 * @category tag
 */
export const IndexedDb: ServiceMap.Service<IndexedDb, IndexedDb> =
  ServiceMap.Service<IndexedDb, IndexedDb>(
    "@effect/platform-browser/IndexedDb",
  );

/**
 * @since 1.0.0
 * @category constructor
 */
export const make = (impl: Omit<IndexedDb, TypeId>): IndexedDb =>
  IndexedDb.of({ ...impl, [TypeId]: TypeId });

/**
 * Instance of IndexedDb from the `window` object.
 *
 * @since 1.0.0
 * @category constructors
 */
export const layerWindow: Layer.Layer<IndexedDb, Config.ConfigError> =
  Layer.effect(
    IndexedDb,
    Effect.suspend(() => {
      if (window.indexedDB && window.IDBKeyRange) {
        return Effect.succeed(
          make({
            indexedDB: window.indexedDB,
            IDBKeyRange: window.IDBKeyRange,
          }),
        );
      } else {
        return Effect.fail(
          new Config.ConfigError(
            new Schema.SchemaError(
              new SchemaIssue.MissingKey({
                message: "window.indexedDB is not available",
              }),
            ),
          ),
        );
      }
    }),
  );

/**
 * Schema for `autoIncrement` key path (`number`).
 *
 * @since 1.0.0
 * @category schemas
 */
export const AutoIncrement = Schema.Number.annotate({
  identifier: "AutoIncrement",
  title: "autoIncrement",
  description: "Defines a valid autoIncrement key path for the IndexedDb table",
});

/** @internal */
const IDBFlatKey = Schema.Union([
  Schema.String,
  Schema.Number,
  Schema.Date,
  Schema.declare(
    (input): input is BufferSource =>
      input instanceof ArrayBuffer || ArrayBuffer.isView(input),
  ),
]);

/**
 * Schema for `IDBValidKey` (`number | string | Date | BufferSource | IDBValidKey[]`).
 *
 * @since 1.0.0
 * @category schemas
 */
export const IDBValidKey = Schema.Union([IDBFlatKey, Schema.Array(IDBFlatKey)]);
