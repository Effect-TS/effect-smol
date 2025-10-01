/**
 * @since 1.0.0
 */
import * as Effect from "../../Effect.ts"
import { dual } from "../../Function.ts"
import * as Getter from "../../schema/Getter.ts"
import * as Schema from "../../schema/Schema.ts"
import * as ServiceMap from "../../ServiceMap.ts"

/**
 * @since 1.0.0
 * @category models
 */
export class Collector extends ServiceMap.Key<Collector, {
  readonly addAll: (_: Iterable<globalThis.Transferable>) => Effect.Effect<void>
  readonly unsafeAddAll: (_: Iterable<globalThis.Transferable>) => void
  readonly read: Effect.Effect<Array<globalThis.Transferable>>
  readonly unsafeRead: () => Array<globalThis.Transferable>
  readonly unsafeClear: () => Array<globalThis.Transferable>
  readonly clear: Effect.Effect<Array<globalThis.Transferable>>
}>()("effect/workers/Transferable/Collector") {}

/**
 * @since 1.0.0
 * @category constructors
 */
export const unsafeMakeCollector = (): Collector["Service"] => {
  let tranferables: Array<globalThis.Transferable> = []
  const unsafeAddAll = (transfers: Iterable<globalThis.Transferable>): void => {
    // eslint-disable-next-line no-restricted-syntax
    tranferables.push(...transfers)
  }
  const unsafeRead = (): Array<globalThis.Transferable> => tranferables
  const unsafeClear = (): Array<globalThis.Transferable> => {
    const prev = tranferables
    tranferables = []
    return prev
  }
  return Collector.of({
    unsafeAddAll,
    addAll: (transferables) => Effect.sync(() => unsafeAddAll(transferables)),
    unsafeRead,
    read: Effect.sync(unsafeRead),
    unsafeClear,
    clear: Effect.sync(unsafeClear)
  })
}

/**
 * @since 1.0.0
 * @category constructors
 */
export const makeCollector: Effect.Effect<Collector["Service"]> = Effect.sync(unsafeMakeCollector)

/**
 * @since 1.0.0
 * @category accessors
 */
export const addAll = (tranferables: Iterable<globalThis.Transferable>): Effect.Effect<void> =>
  Effect.servicesWith((services) => {
    const collector = ServiceMap.getOrUndefined(services, Collector)
    if (!collector) return Effect.void
    collector.unsafeAddAll(tranferables)
    return Effect.void
  })

/**
 * @since 1.0.0
 * @category Getter
 */
export const getterAddAll = <A>(f: (_: A) => Iterable<globalThis.Transferable>): Getter.Getter<A, A> =>
  Getter.transformOrFail((e: A) =>
    Effect.servicesWith((services) => {
      const collector = ServiceMap.getOrUndefined(services, Collector)
      if (!collector) return Effect.succeed(e)
      collector.unsafeAddAll(f(e))
      return Effect.succeed(e)
    })
  )

/**
 * @since 1.0.0
 * @category schema
 */
export interface Transferable<S extends Schema.Top> extends Schema.decodeTo<Schema.typeCodec<S>, S> {}

/**
 * @since 1.0.0
 * @category schema
 */
export const schema: {
  <S extends Schema.Top>(
    f: (_: S["Encoded"]) => Iterable<globalThis.Transferable>
  ): (self: S) => Transferable<S>
  <S extends Schema.Top>(
    self: S,
    f: (_: S["Encoded"]) => Iterable<globalThis.Transferable>
  ): Transferable<S>
} = dual(2, <S extends Schema.Top>(
  self: S,
  f: (_: S["Encoded"]) => Iterable<globalThis.Transferable>
): Transferable<S> =>
  self.pipe(
    Schema.decode({
      decode: Getter.passthrough(),
      encode: getterAddAll(f)
    })
  ))

/**
 * @since 1.0.0
 * @category schema
 */
export const ImageData: Transferable<Schema.declare<ImageData>> = schema(
  Schema.Any as any as Schema.declare<globalThis.ImageData>,
  (_) => [(_ as ImageData).data.buffer]
)

/**
 * @since 1.0.0
 * @category schema
 */
export const MessagePort: Transferable<Schema.declare<MessagePort>> = schema(
  Schema.Any as any as Schema.declare<MessagePort>,
  (_) => [_ as MessagePort]
)

/**
 * @since 1.0.0
 * @category schema
 */
export const Uint8Array: Transferable<Schema.Uint8Array> = schema(
  Schema.instanceOf(globalThis.Uint8Array),
  (_) => [_.buffer]
)
