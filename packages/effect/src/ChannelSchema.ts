/**
 * @since 4.0.0
 */
import type * as Arr from "./Array.ts"
import * as Channel from "./Channel.ts"
import * as Effect from "./Effect.ts"
import { dual } from "./Function.ts"
import * as Schema from "./Schema.ts"

/**
 * @category constructors
 * @since 4.0.0
 */
export const encode = <S extends Schema.Top>(
  schema: S
) =>
<IE = never, Done = unknown>(): Channel.Channel<
  Arr.NonEmptyReadonlyArray<S["Encoded"]>,
  IE | Schema.SchemaError,
  Done,
  Arr.NonEmptyReadonlyArray<S["Type"]>,
  IE,
  Done,
  S["EncodingServices"]
> => {
  const encode = Schema.encodeEffect(Schema.NonEmptyArray(schema))
  return Channel.fromTransform((upstream, _scope) => Effect.succeed(Effect.flatMap(upstream, (chunk) => encode(chunk))))
}

/**
 * @category constructors
 * @since 4.0.0
 */
export const encodeUnknown: <S extends Schema.Top>(
  schema: S
) => <IE = never, Done = unknown>() => Channel.Channel<
  Arr.NonEmptyReadonlyArray<unknown>,
  IE | Schema.SchemaError,
  Done,
  Arr.NonEmptyReadonlyArray<S["Type"]>,
  IE,
  Done,
  S["EncodingServices"]
> = encode

/**
 * @category constructors
 * @since 4.0.0
 */
export const decode = <S extends Schema.Top>(
  schema: S
) =>
<IE = never, Done = unknown>(): Channel.Channel<
  Arr.NonEmptyReadonlyArray<S["Type"]>,
  IE | Schema.SchemaError,
  Done,
  Arr.NonEmptyReadonlyArray<S["Encoded"]>,
  IE,
  Done,
  S["DecodingServices"]
> => {
  const decode = Schema.decodeEffect(Schema.NonEmptyArray(schema))
  return Channel.fromTransform((upstream, _scope) => Effect.succeed(Effect.flatMap(upstream, (chunk) => decode(chunk))))
}

/**
 * @category constructors
 * @since 4.0.0
 */
export const decodeUnknown: <S extends Schema.Top>(
  schema: S
) => <IE = never, Done = unknown>() => Channel.Channel<
  Arr.NonEmptyReadonlyArray<S["Type"]>,
  IE | Schema.SchemaError,
  Done,
  Arr.NonEmptyReadonlyArray<S["Encoded"]>,
  IE,
  Done,
  S["DecodingServices"]
> = decode

/**
 * @category combinators
 * @since 4.0.0
 */
export const duplex: {
  <In extends Schema.Top, Out extends Schema.Top>(options: {
    readonly inputSchema: In
    readonly outputSchema: Out
  }): <OutErr, OutDone, InErr, InDone, R>(
    self: Channel.Channel<
      Arr.NonEmptyReadonlyArray<Out["Encoded"]>,
      OutErr,
      OutDone,
      Arr.NonEmptyReadonlyArray<In["Encoded"]>,
      Schema.SchemaError | InErr,
      InDone,
      R
    >
  ) => Channel.Channel<
    Arr.NonEmptyReadonlyArray<Out["Type"]>,
    Schema.SchemaError | OutErr,
    OutDone,
    Arr.NonEmptyReadonlyArray<In["Type"]>,
    InErr,
    InDone,
    R | In["EncodingServices"] | Out["DecodingServices"]
  >
  <Out extends Schema.Top, OutErr, OutDone, In extends Schema.Top, InErr, InDone, R>(
    self: Channel.Channel<
      Arr.NonEmptyReadonlyArray<Out["Encoded"]>,
      OutErr,
      OutDone,
      Arr.NonEmptyReadonlyArray<In["Encoded"]>,
      Schema.SchemaError | InErr,
      InDone,
      R
    >,
    options: {
      readonly inputSchema: In
      readonly outputSchema: Out
    }
  ): Channel.Channel<
    Arr.NonEmptyReadonlyArray<Out["Type"]>,
    Schema.SchemaError | OutErr,
    OutDone,
    Arr.NonEmptyReadonlyArray<In["Type"]>,
    InErr,
    InDone,
    R | In["EncodingServices"] | Out["DecodingServices"]
  >
} = dual(2, <Out extends Schema.Top, OutErr, OutDone, In extends Schema.Top, InErr, InDone, R>(
  self: Channel.Channel<
    Arr.NonEmptyReadonlyArray<Out["Encoded"]>,
    OutErr,
    OutDone,
    Arr.NonEmptyReadonlyArray<In["Encoded"]>,
    Schema.SchemaError | InErr,
    InDone,
    R
  >,
  options: {
    readonly inputSchema: In
    readonly outputSchema: Out
  }
): Channel.Channel<
  Arr.NonEmptyReadonlyArray<Out["Type"]>,
  Schema.SchemaError | OutErr,
  OutDone,
  Arr.NonEmptyReadonlyArray<In["Type"]>,
  InErr,
  InDone,
  R | In["EncodingServices"] | Out["DecodingServices"]
> =>
  encode(options.inputSchema)<InErr, InDone>().pipe(
    Channel.pipeTo(self),
    Channel.pipeTo(decode(options.outputSchema)())
  ))

/**
 * @category combinators
 * @since 4.0.0
 */
export const duplexUnknown: {
  <In extends Schema.Top, Out extends Schema.Top>(options: {
    readonly inputSchema: In
    readonly outputSchema: Out
  }): <OutErr, OutDone, InErr, InDone, R>(
    self: Channel.Channel<
      Arr.NonEmptyReadonlyArray<unknown>,
      OutErr,
      OutDone,
      Arr.NonEmptyReadonlyArray<any>,
      Schema.SchemaError | InErr,
      InDone,
      R
    >
  ) => Channel.Channel<
    Arr.NonEmptyReadonlyArray<Out["Type"]>,
    Schema.SchemaError | OutErr,
    OutDone,
    Arr.NonEmptyReadonlyArray<In["Type"]>,
    InErr,
    InDone,
    R | In["EncodingServices"] | Out["DecodingServices"]
  >
  <Out extends Schema.Top, OutErr, OutDone, In extends Schema.Top, InErr, InDone, R>(
    self: Channel.Channel<
      Arr.NonEmptyReadonlyArray<unknown>,
      OutErr,
      OutDone,
      Arr.NonEmptyReadonlyArray<any>,
      Schema.SchemaError | InErr,
      InDone,
      R
    >,
    options: {
      readonly inputSchema: In
      readonly outputSchema: Out
    }
  ): Channel.Channel<
    Arr.NonEmptyReadonlyArray<Out["Type"]>,
    Schema.SchemaError | OutErr,
    OutDone,
    Arr.NonEmptyReadonlyArray<In["Type"]>,
    InErr,
    InDone,
    R | In["EncodingServices"] | Out["DecodingServices"]
  >
} = duplex
