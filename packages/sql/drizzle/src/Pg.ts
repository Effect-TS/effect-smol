/**
 * @since 1.0.0
 */
import type * as Client from "effect/unstable/sql/SqlClient";
import type { SqlError } from "effect/unstable/sql/SqlError";
import type { DrizzleConfig } from "drizzle-orm";
import { PgSelectBase } from "drizzle-orm/pg-core";
import type { PgRemoteDatabase } from "drizzle-orm/pg-proxy";
import { drizzle } from "drizzle-orm/pg-proxy";
import { QueryPromise } from "drizzle-orm/query-promise";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { ServiceMap } from "effect";
import { makeRemoteCallback, patch } from "./internal/patch.ts";

/**
 * @since 1.0.0
 * @category constructors
 */
export const make = <TSchema extends Record<string, unknown> = Record<string, never>>(
  config?: Omit<DrizzleConfig<TSchema>, "logger">,
): Effect.Effect<PgRemoteDatabase<TSchema>, never, Client.SqlClient> =>
  Effect.gen(function* () {
    const db = drizzle(yield* makeRemoteCallback, config);
    return db;
  });

/**
 * @since 1.0.0
 * @category constructors
 */
export const makeWithConfig: (
  config: DrizzleConfig,
) => Effect.Effect<PgRemoteDatabase, never, Client.SqlClient> = (config) =>
  Effect.gen(function* () {
    const db = drizzle(yield* makeRemoteCallback, config);
    return db;
  });

/**
 * @since 1.0.0
 * @category tags
 */
export class PgDrizzle extends ServiceMap.Service<PgDrizzle, PgRemoteDatabase>()(
  "@effect/sql-drizzle/Pg",
) {}

/**
 * @since 1.0.0
 * @category layers
 */
export const layer: Layer.Layer<PgDrizzle, never, Client.SqlClient> =
  Layer.effect(PgDrizzle)(make());

/**
 * @since 1.0.0
 * @category layers
 */
export const layerWithConfig: (
  config: DrizzleConfig,
) => Layer.Layer<PgDrizzle, never, Client.SqlClient> = (config) =>
  Layer.effect(PgDrizzle)(makeWithConfig(config));

// patch

declare module "drizzle-orm" {
  export interface QueryPromise<T> extends Effect.Effect<T, SqlError> {}
}
patch(QueryPromise.prototype);
patch(PgSelectBase.prototype);
