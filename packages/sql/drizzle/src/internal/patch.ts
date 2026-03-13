import * as Client from "effect/unstable/sql/SqlClient";
import { SqlError } from "effect/unstable/sql/SqlError";
import type { QueryPromise } from "drizzle-orm/query-promise";
import * as Effect from "effect/Effect";
import type * as ServiceMap from "effect/ServiceMap";
import { SingleShotGen } from "effect/Utils";

let currentServices: ServiceMap.ServiceMap<never> | undefined = undefined;

const PatchProto = {
  asEffect(
    this: QueryPromise<unknown> & {
      readonly prepare: () => unknown;
      readonly dialect: unknown;
      readonly toSQL: () => { sql: string; params: Array<unknown> };
    },
  ) {
    return Effect.services<never>().pipe(
      Effect.flatMap((services) =>
        Effect.tryPromise({
          try: () => {
            const pre = currentServices;
            currentServices = services;
            const out = this.execute();
            currentServices = pre;
            return out;
          },
          catch: (cause) => new SqlError({ cause, message: "Failed to execute QueryPromise" }),
        }),
      ),
    );
  },
  [Symbol.iterator](this: unknown) {
    return new SingleShotGen(this);
  },
};

/** @internal */
export const patch = (prototype: object) => {
  if ("asEffect" in prototype) {
    return;
  }
  Object.assign(prototype, PatchProto);
};

/** @internal */
export const makeRemoteCallback = Effect.gen(function* () {
  const client = yield* Client.SqlClient;
  const constructionServices = yield* Effect.services<never>();
  return (
    sql: string,
    params: Array<unknown>,
    method: "all" | "execute" | "get" | "values" | "run",
  ) => {
    const services = currentServices ?? constructionServices;
    const runPromise = Effect.runPromiseWith(services);
    const statement = client.unsafe(sql, params);

    if (method === "execute") {
      return runPromise(
        Effect.result(
          Effect.map(statement.raw, (header) => ({ rows: [header] as Array<unknown> })),
        ),
      ).then((res) => {
        if (res._tag === "Failure") {
          throw res.failure.cause;
        }
        return res.success;
      });
    }

    let effect: Effect.Effect<unknown, SqlError> =
      method === "all" || method === "values" ? statement.values : statement.withoutTransform;
    if (method === "get") {
      effect = Effect.map(effect, (rows) => {
        if (Array.isArray(rows)) return rows[0] ?? [];
        return [];
      });
    }

    return runPromise(
      Effect.result(Effect.map(effect, (rows) => ({ rows: rows as Array<unknown> }))),
    ).then((res) => {
      if (res._tag === "Failure") {
        throw (res.failure as SqlError).cause;
      }
      return res.success;
    });
  };
});
