/**
 * @since 4.0.0
 */
import type { NonEmptyReadonlyArray } from "../../collections/Array.ts"
import * as Schema from "../../schema/Schema.ts"
import * as HttpApiEndpoint from "../httpapi/HttpApiEndpoint.ts"
import * as HttpApiGroup from "../httpapi/HttpApiGroup.ts"
import * as Rpc from "../rpc/Rpc.ts"
import * as RpcGroup from "../rpc/RpcGroup.ts"
import type * as Workflow from "./Workflow.ts"

/**
 * Derives an `RpcGroup` from a list of workflows.
 *
 * ```ts
 * import { RpcServer } from "effect/unstable/rpc"
 * import { Workflow, WorkflowProxy, WorkflowProxyServer } from "effect/unstable/workflow"
 * import { Schema } from "effect/schema"
 * import { Layer } from "effect"
 *
 * const EmailWorkflow = Workflow.make({
 *   name: "EmailWorkflow",
 *   payload: {
 *     id: Schema.String,
 *     to: Schema.String
 *   },
 *   idempotencyKey: ({ id }) => id
 * })
 *
 * const myWorkflows = [EmailWorkflow] as const
 *
 * // Use WorkflowProxy.toRpcGroup to create a `RpcGroup` from the
 * // workflows
 * class MyRpcs extends WorkflowProxy.toRpcGroup(myWorkflows) {}
 *
 * // Use WorkflowProxyServer.layerRpcHandlers to create a layer that implements
 * // the rpc handlers
 * const ApiLayer = RpcServer.layer(MyRpcs).pipe(
 *   Layer.provide(WorkflowProxyServer.layerRpcHandlers(myWorkflows))
 * )
 * ```
 *
 * @since 4.0.0
 * @category Constructors
 */
export const toRpcGroup = <
  const Workflows extends NonEmptyReadonlyArray<Workflow.Any>,
  const Prefix extends string = ""
>(
  workflows: Workflows,
  options?: {
    readonly prefix?: Prefix | undefined
  }
): RpcGroup.RpcGroup<ConvertRpcs<Workflows[number], Prefix>> => {
  const prefix = options?.prefix ?? ""
  const rpcs: Array<Rpc.Any> = []
  for (const workflow_ of workflows) {
    const workflow = workflow_ as Workflow.AnyWithProps
    rpcs.push(
      Rpc.make(`${prefix}${workflow.name}`, {
        payload: workflow.payloadSchema,
        error: workflow.errorSchema,
        success: workflow.successSchema
      }).annotateMerge(workflow.annotations),
      Rpc.make(`${prefix}${workflow.name}Discard`, {
        payload: workflow.payloadSchema
      }).annotateMerge(workflow.annotations),
      Rpc.make(`${prefix}${workflow.name}Resume`, { payload: ResumePayload })
        .annotateMerge(workflow.annotations)
    )
  }
  return RpcGroup.make(...rpcs) as any
}

/**
 * @since 4.0.0
 */
export type ConvertRpcs<Workflows extends Workflow.Any, Prefix extends string> = Workflows extends Workflow.Workflow<
  infer _Name,
  infer _Payload,
  infer _Success,
  infer _Error
> ?
    | Rpc.Rpc<`${Prefix}${_Name}`, _Payload, _Success, _Error>
    | Rpc.Rpc<`${Prefix}${_Name}Discard`, _Payload>
    | Rpc.Rpc<`${Prefix}${_Name}Resume`, typeof ResumePayload>
  : never

/**
 * Derives an `HttpApiGroup` from a list of workflows.
 *
 * ```ts
 * import { HttpApi, HttpApiBuilder } from "@effect/platform"
 * import { Workflow, WorkflowProxy, WorkflowProxyServer } from "@effect/workflow"
 * import { Layer, Schema } from "effect"
 *
 * const EmailWorkflow = Workflow.make({
 *   name: "EmailWorkflow",
 *   payload: {
 *     id: Schema.String,
 *     to: Schema.String
 *   },
 *   idempotencyKey: ({ id }) => id
 * })
 *
 * const myWorkflows = [EmailWorkflow] as const
 *
 * // Use WorkflowProxy.toHttpApiGroup to create a `HttpApiGroup` from the
 * // workflows
 * class MyApi extends HttpApi.make("api")
 *   .add(WorkflowProxy.toHttpApiGroup("workflows", myWorkflows))
 * {}
 *
 * // Use WorkflowProxyServer.layerHttpApi to create a layer that implements the
 * // workflows HttpApiGroup
 * const ApiLayer = HttpApiBuilder.api(MyApi).pipe(
 *   Layer.provide(WorkflowProxyServer.layerHttpApi(MyApi, "workflows", myWorkflows))
 * )
 * ```
 *
 * @since 4.0.0
 * @category Constructors
 */
export const toHttpApiGroup = <const Name extends string, const Workflows extends NonEmptyReadonlyArray<Workflow.Any>>(
  name: Name,
  workflows: Workflows
): HttpApiGroup.HttpApiGroup<Name, ConvertHttpApi<Workflows[number]>> => {
  let group = HttpApiGroup.make(name)
  for (const workflow_ of workflows) {
    const workflow = workflow_ as Workflow.AnyWithProps
    const path = `/${tagToPath(workflow.name)}` as const
    group = group.add(
      HttpApiEndpoint.post(workflow.name, path)
        .setPayload(workflow.payloadSchema)
        .addSuccess(workflow.successSchema)
        .addError(workflow.errorSchema as any)
        .annotateMerge(workflow.annotations)
    ).add(
      HttpApiEndpoint.post(workflow.name + "Discard", `${path}/discard`)
        .setPayload(workflow.payloadSchema)
        .annotateMerge(workflow.annotations)
    ).add(
      HttpApiEndpoint.post(workflow.name + "Resume", `${path}/resume`)
        .setPayload(ResumePayload)
        .annotateMerge(workflow.annotations)
    ) as any
  }
  return group as any
}

const tagToPath = (tag: string): string =>
  tag
    // .replace(/[^a-zA-Z0-9]+/g, "-") // Replace non-alphanumeric characters with hyphen
    // .replace(/([a-z])([A-Z])/g, "$1-$2") // Insert hyphen before uppercase letters
    .toLowerCase()

/**
 * @since 4.0.0
 */
export type ConvertHttpApi<Workflows extends Workflow.Any> = Workflows extends Workflow.Workflow<
  infer _Name,
  infer _Payload,
  infer _Success,
  infer _Error
> ?
    | HttpApiEndpoint.HttpApiEndpoint<
      _Name,
      "POST",
      `/${Lowercase<_Name>}`,
      never,
      never,
      _Payload,
      never,
      _Success,
      _Error
    >
    | HttpApiEndpoint.HttpApiEndpoint<
      `${_Name}Discard`,
      "POST",
      `/${Lowercase<_Name>}/discard`,
      never,
      never,
      _Payload
    >
    | HttpApiEndpoint.HttpApiEndpoint<
      `${_Name}Resume`,
      "POST",
      `/${Lowercase<_Name>}/resume`,
      never,
      never,
      typeof ResumePayload
    > :
  never

const ResumePayload = Schema.Struct({ executionId: Schema.String })
