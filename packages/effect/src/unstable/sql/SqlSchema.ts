/**
 * @since 4.0.0
 */
import * as Cause from "../../Cause.ts"
import * as Arr from "../../collections/Array.ts"
import * as Effect from "../../Effect.ts"
import * as Schema from "../../schema/Schema.ts"

/**
 * Run a sql query with a request schema and a result schema.
 *
 * @since 4.0.0
 * @category constructor
 */
export const findMany = <Req extends Schema.Top, Res extends Schema.Top, E, R>(
  options: {
    readonly Request: Req
    readonly Result: Res
    readonly execute: (request: Req["Encoded"]) => Effect.Effect<ReadonlyArray<unknown>, E, R>
  }
) => {
  const encodeRequest = Schema.encodeEffect(options.Request)
  const decode = Schema.decodeUnknownEffect(Schema.Array(options.Result))
  return (
    request: Req["Encoded"]
  ): Effect.Effect<
    Arr.NonEmptyArray<Res["Type"]>,
    E | Schema.SchemaError | Cause.NoSuchElementError,
    Req["EncodingServices"] | Res["DecodingServices"] | R
  > =>
    Effect.flatMap(
      Effect.flatMap(encodeRequest(request), options.execute),
      (results): Effect.Effect<
        Arr.NonEmptyArray<Res["Type"]>,
        Schema.SchemaError | Cause.NoSuchElementError,
        Req["EncodingServices"] | Res["DecodingServices"]
      > =>
        Arr.isReadonlyArrayNonEmpty(results)
          ? decode(results) as Effect.Effect<Arr.NonEmptyArray<Res["Type"]>, Schema.SchemaError>
          : Effect.fail(new Cause.NoSuchElementError())
    )
}

const void_ = <Req extends Schema.Top, E, R>(
  options: {
    readonly Request: Req
    readonly execute: (request: Req["Encoded"]) => Effect.Effect<unknown, E, R>
  }
) => {
  const encode = Schema.encodeEffect(options.Request)
  return (request: Req["Type"]): Effect.Effect<void, E | Schema.SchemaError, R | Req["EncodingServices"]> =>
    Effect.asVoid(
      Effect.flatMap(encode(request), options.execute)
    )
}
export {
  /**
   * Run a sql query with a request schema and discard the result.
   *
   * @since 4.0.0
   * @category constructor
   */
  void_ as void
}

/**
 * Run a sql query with a request schema and a result schema and return the first result.
 *
 * @since 4.0.0
 * @category constructor
 */
export const findOne = <Req extends Schema.Top, Res extends Schema.Top, E, R>(
  options: {
    readonly Request: Req
    readonly Result: Res
    readonly execute: (request: Req["Encoded"]) => Effect.Effect<ReadonlyArray<unknown>, E, R>
  }
) => {
  const encodeRequest = Schema.encodeEffect(options.Request)
  const decode = Schema.decodeUnknownEffect(options.Result)
  return (
    request: Req["Type"]
  ): Effect.Effect<
    Res["Type"],
    E | Schema.SchemaError | Cause.NoSuchElementError,
    R | Req["EncodingServices"] | Res["DecodingServices"]
  > =>
    Effect.flatMap(
      Effect.flatMap(encodeRequest(request), options.execute),
      (arr): Effect.Effect<
        Res["Type"],
        Schema.SchemaError | Cause.NoSuchElementError,
        Req["EncodingServices"] | Res["DecodingServices"]
      > => Arr.isReadonlyArrayNonEmpty(arr) ? decode(arr[0]) : Effect.fail(new Cause.NoSuchElementError())
    )
}
