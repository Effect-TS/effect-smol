/**
 * @since 4.0.0
 */
import * as Duration from "../../Duration.ts"
import * as Effect from "../../Effect.ts"
import * as Layer from "../../Layer.ts"
import type { ReadonlyRecord } from "../../Record.ts"
import type { Scope } from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as Stream from "../../Stream.ts"
import type { Mutable, NoInfer } from "../../Types.ts"
import * as Headers from "../http/Headers.ts"
import type * as Rpc from "../rpc/Rpc.ts"
import * as RpcClient from "../rpc/RpcClient.ts"
import type { RpcClientError } from "../rpc/RpcClientError.ts"
import type * as RpcGroup from "../rpc/RpcGroup.ts"
import type { RequestId } from "../rpc/RpcMessage.ts"
import * as RpcSchema from "../rpc/RpcSchema.ts"
import type * as AsyncResult from "./AsyncResult.ts"
import * as Atom from "./Atom.ts"
import * as Reactivity from "./Reactivity.ts"

/**
 * @since 4.0.0
 * @category Models
 */
export interface AtomRpcClient<Self, Id extends string, Rpcs extends Rpc.Any, E> extends
  ServiceMap.Service<
    Self,
    RpcClient.RpcClient.Flat<Rpcs, RpcClientError>
  >
{
  new(_: never): ServiceMap.ServiceClass.Shape<
    Id,
    RpcClient.RpcClient.Flat<Rpcs, RpcClientError>
  >

  readonly layer: Layer.Layer<Self, E>
  readonly runtime: Atom.AtomRuntime<Self, E>

  readonly mutation: <Tag extends Rpc.Tag<Rpcs>>(
    arg: Tag
  ) => Rpc.ExtractTag<Rpcs, Tag> extends Rpc.Rpc<
    infer _Tag,
    infer _Payload,
    infer _Success,
    infer _Error,
    infer _Middleware,
    infer _Requires
  > ? [_Success] extends [RpcSchema.Stream<infer _A, infer _E>] ? never
    : Atom.AtomResultFn<
      {
        readonly payload: Rpc.PayloadConstructor<Rpc.ExtractTag<Rpcs, Tag>>
        readonly reactivityKeys?:
          | ReadonlyArray<unknown>
          | ReadonlyRecord<string, ReadonlyArray<unknown>>
          | undefined
        readonly headers?: Headers.Input | undefined
      },
      _Success["Type"],
      _Error["Type"] | E | _Middleware["error"]["Type"]
    >
    : never

  readonly query: <Tag extends Rpc.Tag<Rpcs>>(
    tag: Tag,
    payload: Rpc.PayloadConstructor<Rpc.ExtractTag<Rpcs, Tag>>,
    options?: {
      readonly headers?: Headers.Input | undefined
      readonly reactivityKeys?:
        | ReadonlyArray<unknown>
        | ReadonlyRecord<string, ReadonlyArray<unknown>>
        | undefined
      readonly timeToLive?: Duration.DurationInput | undefined
    }
  ) => Rpc.ExtractTag<Rpcs, Tag> extends Rpc.Rpc<
    infer _Tag,
    infer _Payload,
    infer _Success,
    infer _Error,
    infer _Middleware
  > ? [_Success] extends [RpcSchema.Stream<infer _A, infer _E>] ? Atom.Writable<
        Atom.PullResult<
          _A["Type"],
          _E["Type"] | _Error["Type"] | E | _Middleware["error"]["Type"]
        >,
        void
      >
    : Atom.Atom<
      AsyncResult.AsyncResult<
        _Success["Type"],
        _Error["Type"] | E | _Middleware["error"]["Type"]
      >
    >
    : never
}

declare global {
  interface ErrorConstructor {
    stackTraceLimit: number
  }
}

/**
 * @since 4.0.0
 * @category Constructors
 */
export const Service = <Self>() =>
<
  const Id extends string,
  Rpcs extends Rpc.Any,
  ER,
  RM =
    | RpcClient.Protocol
    | Rpc.MiddlewareClient<NoInfer<Rpcs>>
    | Rpc.ServicesClient<NoInfer<Rpcs>>
>(
  id: Id,
  options: {
    readonly group: RpcGroup.RpcGroup<Rpcs>
    readonly protocol: Layer.Layer<Exclude<NoInfer<RM>, Scope>, ER>
    readonly spanPrefix?: string | undefined
    readonly spanAttributes?: Record<string, unknown> | undefined
    readonly generateRequestId?: (() => RequestId) | undefined
    readonly disableTracing?: boolean | undefined
    readonly makeEffect?:
      | Effect.Effect<
        RpcClient.RpcClient.Flat<Rpcs, RpcClientError>,
        never,
        RM
      >
      | undefined
  }
): AtomRpcClient<Self, Id, Rpcs, ER> => {
  const self: Mutable<AtomRpcClient<Self, Id, Rpcs, ER>> = ServiceMap.Service<
    Self,
    RpcClient.RpcClient.Flat<Rpcs, RpcClientError>
  >()(id) as any

  self.layer = Layer.effect(
    self,
    options.makeEffect ??
      (RpcClient.make(options.group, {
        ...options,
        flatten: true
      }) as Effect.Effect<
        RpcClient.RpcClient.Flat<Rpcs, RpcClientError>,
        never,
        RM
      >)
  ).pipe(Layer.provide(options.protocol))
  self.runtime = Atom.runtime(self.layer)

  self.mutation = Atom.family(<Tag extends Rpc.Tag<Rpcs>>(tag: Tag) =>
    self.runtime.fn<{
      readonly payload: Rpc.PayloadConstructor<Rpc.ExtractTag<Rpcs, Tag>>
      readonly reactivityKeys?:
        | ReadonlyArray<unknown>
        | ReadonlyRecord<string, ReadonlyArray<unknown>>
        | undefined
      readonly headers?: Headers.Input | undefined
    }>()(
      Effect.fnUntraced(function*({ headers, payload, reactivityKeys }) {
        const client = yield* self
        const effect = client(tag, payload, { headers } as any)
        return yield* reactivityKeys
          ? Reactivity.mutation(effect, reactivityKeys)
          : effect
      }) as any
    )
  ) as any

  const queryFamily = Atom.family(
    ({ headers, payload, reactivityKeys, tag, timeToLive }: QueryKey) => {
      const rpc = options.group.requests.get(tag)! as any as Rpc.AnyWithProps
      let atom = RpcSchema.isStreamSchema(rpc.successSchema)
        ? self.runtime.pull(
          Stream.unwrap(
            self.use((client) =>
              Effect.succeed(
                client(tag, payload, { headers } as any) as any
              )
            )
          )
        )
        : self.runtime.atom(
          self.use((client) => client(tag, payload, { headers } as any)) as any
        )
      if (timeToLive) {
        atom = Duration.isFinite(timeToLive)
          ? Atom.setIdleTTL(atom, timeToLive)
          : Atom.keepAlive(atom)
      }
      return reactivityKeys
        ? self.runtime.factory.withReactivity(reactivityKeys)(atom)
        : atom
    }
  )

  self.query = <Tag extends Rpc.Tag<Rpcs>>(
    tag: Tag,
    payload: Rpc.PayloadConstructor<Rpc.ExtractTag<Rpcs, Tag>>,
    options?: {
      readonly headers?: Headers.Input | undefined
      readonly reactivityKeys?:
        | ReadonlyArray<unknown>
        | ReadonlyRecord<string, ReadonlyArray<unknown>>
        | undefined
      readonly timeToLive?: Duration.DurationInput | undefined
    }
  ) =>
    queryFamily({
      tag,
      payload,
      headers: options?.headers
        ? Headers.fromInput(options.headers)
        : undefined,
      reactivityKeys: options?.reactivityKeys,
      timeToLive: options?.timeToLive
        ? Duration.fromDurationInputUnsafe(options.timeToLive)
        : undefined
    }) as any

  return self as AtomRpcClient<Self, Id, Rpcs, ER>
}

interface QueryKey {
  tag: string
  payload: any
  headers?: Headers.Headers | undefined
  reactivityKeys?:
    | ReadonlyArray<unknown>
    | ReadonlyRecord<string, ReadonlyArray<unknown>>
    | undefined
  timeToLive?: Duration.Duration | undefined
}
