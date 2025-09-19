/**
 * @since 4.0.0
 */
import * as Effect from "../../Effect.ts"
import { identity } from "../../Function.ts"
import * as Layer from "../../Layer.ts"
import { FileSystem } from "../../platform/FileSystem.ts"
import * as Schema from "../../schema/Schema.ts"
import type * as Scope from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as HttpClient from "../http/HttpClient.ts"
import * as HttpClientRequest from "../http/HttpClientRequest.ts"
import * as HttpClientResponse from "../http/HttpClientResponse.ts"
import type { RunnerAddress } from "./RunnerAddress.ts"
import * as Runners from "./Runners.ts"

/**
 * Represents the service used to check if a Runner is healthy.
 *
 * If a Runner is responsive, shards will not be re-assigned because the Runner may
 * still be processing messages. If a Runner is not responsive, then its
 * associated shards can and will be re-assigned to a different Runner.
 *
 * @since 4.0.0
 * @category models
 */
export class RunnerHealth extends ServiceMap.Key<
  RunnerHealth,
  {
    readonly isAlive: (address: RunnerAddress) => Effect.Effect<boolean>
  }
>()("effect/cluster/RunnerHealth") {}

/**
 * A layer which will **always** consider a Runner healthy.
 *
 * This is useful for testing.
 *
 * @since 4.0.0
 * @category layers
 */
export const layerNoop = Layer.succeed(RunnerHealth)({
  isAlive: () => Effect.succeed(true)
})

/**
 * @since 4.0.0
 * @category Constructors
 */
export const makePing: Effect.Effect<
  RunnerHealth["Service"],
  never,
  Runners.Runners | Scope.Scope
> = Effect.gen(function*() {
  const runners = yield* Runners.Runners

  function isAlive(address: RunnerAddress): Effect.Effect<boolean> {
    return runners.ping(address).pipe(
      Effect.timeout(10_000),
      Effect.retry({ times: 3 }),
      Effect.isSuccess
    )
  }

  return RunnerHealth.of({ isAlive })
})

/**
 * A layer which will ping a Runner directly to check if it is healthy.
 *
 * @since 4.0.0
 * @category layers
 */
export const layerPing: Layer.Layer<
  RunnerHealth,
  never,
  Runners.Runners
> = Layer.effect(RunnerHealth)(makePing)

/**
 * @since 4.0.0
 * @category Constructors
 */
export const makeK8s = Effect.fnUntraced(function*(options?: {
  readonly namespace?: string | undefined
  readonly labelSelector?: string | undefined
}) {
  const fs = yield* FileSystem
  const token = yield* fs.readFileString("/var/run/secrets/kubernetes.io/serviceaccount/token").pipe(
    Effect.option
  )
  const client = (yield* HttpClient.HttpClient).pipe(
    HttpClient.filterStatusOk
  )
  const baseRequest = HttpClientRequest.get("https://kubernetes.default.svc/api").pipe(
    token._tag === "Some" ? HttpClientRequest.bearerToken(token.value.trim()) : identity
  )
  const getPods = baseRequest.pipe(
    HttpClientRequest.appendUrl(options?.namespace ? `/v1/namespaces/${options.namespace}/pods` : "/v1/pods"),
    HttpClientRequest.setUrlParam("fieldSelector", "status.phase=Running"),
    options?.labelSelector ? HttpClientRequest.setUrlParam("labelSelector", options.labelSelector) : identity
  )
  const readyPods = yield* client.execute(getPods).pipe(
    Effect.flatMap(HttpClientResponse.schemaBodyJson(PodList)),
    Effect.map((list) => {
      const pods = new Map<string, Pod>()
      for (let i = 0; i < list.items.length; i++) {
        const pod = list.items[i]
        pods.set(pod.status.podIP, pod)
      }
      return pods
    }),
    Effect.cachedWithTTL("10 seconds")
  )

  return RunnerHealth.of({
    isAlive: (address) =>
      readyPods.pipe(
        Effect.map((pods) => pods.get(address.host)?.isReady ?? false),
        Effect.catchCause((cause) =>
          Effect.logWarning("Failed to check pod health", cause).pipe(
            Effect.as(true)
          )
        )
      )
  })
})

class Pod extends Schema.Class<Pod>("effect/cluster/RunnerHealth/Pod")({
  status: Schema.Struct({
    phase: Schema.String,
    conditions: Schema.Array(Schema.Struct({
      type: Schema.String,
      status: Schema.String,
      lastTransitionTime: Schema.String
    })),
    podIP: Schema.String
  })
}) {
  get isReady(): boolean {
    let initializedAt: string | undefined
    let readyAt: string | undefined
    for (let i = 0; i < this.status.conditions.length; i++) {
      const condition = this.status.conditions[i]
      switch (condition.type) {
        case "Initialized": {
          if (condition.status !== "True") {
            return true
          }
          initializedAt = condition.lastTransitionTime
          break
        }
        case "Ready": {
          if (condition.status === "True") {
            return true
          }
          readyAt = condition.lastTransitionTime
          break
        }
      }
    }
    // if the pod is still booting up, consider it ready as it would have
    // already registered itself with RunnerStorage by now
    return initializedAt === readyAt
  }
}

const PodList = Schema.Struct({
  items: Schema.Array(Pod)
})

/**
 * A layer which will check the Kubernetes API to see if a Runner is healthy.
 *
 * The provided HttpClient will need to add the pod's CA certificate to its
 * trusted root certificates in order to communicate with the Kubernetes API.
 *
 * The pod service account will also need to have permissions to list pods in
 * order to use this layer.
 *
 * @since 4.0.0
 * @category layers
 */
export const layerK8s: (
  options?: {
    readonly namespace?: string | undefined
    readonly labelSelector?: string | undefined
  } | undefined
) => Layer.Layer<
  RunnerHealth,
  never,
  HttpClient.HttpClient | FileSystem
> = Layer.effect(RunnerHealth)(makeK8s)
