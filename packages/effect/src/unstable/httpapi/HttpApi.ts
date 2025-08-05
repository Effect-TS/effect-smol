/**
 * @since 4.0.0
 */
import type { NonEmptyReadonlyArray } from "../../collections/Array.ts"
import * as Option from "../../data/Option.ts"
import * as Predicate from "../../data/Predicate.ts"
import * as Record from "../../data/Record.ts"
import { type Pipeable, pipeArguments } from "../../interfaces/Pipeable.ts"
import * as AST from "../../schema/AST.ts"
import type * as Schema from "../../schema/Schema.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type { Mutable } from "../../types/Types.ts"
import type { PathInput } from "../http/HttpRouter.ts"
import type * as HttpApiEndpoint from "./HttpApiEndpoint.ts"
import type * as HttpApiGroup from "./HttpApiGroup.ts"
import type * as HttpApiMiddleware from "./HttpApiMiddleware.ts"
import * as HttpApiSchema from "./HttpApiSchema.ts"

/**
 * @since 4.0.0
 * @category type ids
 */
export const TypeId: TypeId = "~effect/httpapi/HttpApi"

/**
 * @since 4.0.0
 * @category type ids
 */
export type TypeId = "~effect/httpapi/HttpApi"

/**
 * @since 4.0.0
 * @category guards
 */
export const isHttpApi = (u: unknown): u is Any => Predicate.hasProperty(u, TypeId)

/**
 * An `HttpApi` is a collection of `HttpApiEndpoint`s. You can use an `HttpApi` to
 * represent a portion of your domain.
 *
 * The endpoints can be implemented later using the `HttpApiBuilder.make` api.
 *
 * @since 4.0.0
 * @category models
 */
export interface HttpApi<
  out Id extends string,
  out Groups extends HttpApiGroup.Any = never
> extends Pipeable {
  new(_: never): {}
  readonly [TypeId]: TypeId
  readonly identifier: Id
  readonly groups: Record.ReadonlyRecord<string, Groups>
  readonly annotations: ServiceMap.ServiceMap<never>

  /**
   * Add a `HttpApiGroup` to the `HttpApi`.
   */
  add<A extends NonEmptyReadonlyArray<HttpApiGroup.Any>>(...groups: A): HttpApi<Id, Groups | A[number]>

  /**
   * Add another `HttpApi` to the `HttpApi`.
   */
  addHttpApi<Id2 extends string, Groups2 extends HttpApiGroup.Any>(
    api: HttpApi<Id2, Groups2>
  ): HttpApi<Id, Groups | Groups2>

  /**
   * Prefix all endpoints in the `HttpApi`.
   */
  prefix<const Prefix extends PathInput>(prefix: Prefix): HttpApi<Id, Groups>

  /**
   * Add a middleware to a `HttpApi`. It will be applied to all endpoints in the
   * `HttpApi`.
   *
   * Note that this will only add the middleware to the endpoints **before** this
   * api is called.
   */
  middleware<I extends HttpApiMiddleware.AnyId, S>(
    middleware: ServiceMap.Key<I, S>
  ): HttpApi<Id, HttpApiGroup.AddMiddleware<Groups, I>>

  /**
   * Annotate the `HttpApi`.
   */
  annotate<I, S>(tag: ServiceMap.Key<I, S>, value: S): HttpApi<Id, Groups>

  /**
   * Annotate the `HttpApi` with a ServiceMap.
   */
  annotateMerge<I>(context: ServiceMap.ServiceMap<I>): HttpApi<Id, Groups>
}

/**
 * @since 4.0.0
 * @category models
 */
export interface Any {
  readonly [TypeId]: TypeId
}

/**
 * @since 4.0.0
 * @category models
 */
export type AnyWithProps = HttpApi<string, HttpApiGroup.AnyWithProps>

const Proto = {
  [TypeId]: TypeId,
  pipe() {
    return pipeArguments(this, arguments)
  },
  add(
    this: AnyWithProps,
    ...toAdd: NonEmptyReadonlyArray<HttpApiGroup.AnyWithProps>
  ) {
    const groups = { ...this.groups }
    for (const group of toAdd) {
      groups[group.identifier] = group
    }
    return makeProto({
      identifier: this.identifier,
      groups,
      annotations: this.annotations
    })
  },
  addHttpApi(
    this: AnyWithProps,
    api: AnyWithProps
  ) {
    const newGroups = { ...this.groups }
    for (const key in api.groups) {
      const newGroup: Mutable<HttpApiGroup.AnyWithProps> = api.groups[key]
      newGroup.annotations = ServiceMap.merge(api.annotations, newGroup.annotations)
      newGroups[key] = newGroup as any
    }
    return makeProto({
      identifier: this.identifier,
      groups: newGroups,
      annotations: this.annotations
    })
  },
  prefix(this: AnyWithProps, prefix: PathInput) {
    return makeProto({
      identifier: this.identifier,
      groups: Record.map(this.groups, (group) => group.prefix(prefix)),
      annotations: this.annotations
    })
  },
  middleware(this: AnyWithProps, tag: HttpApiMiddleware.AnyKey) {
    return makeProto({
      identifier: this.identifier,
      groups: Record.map(this.groups, (group) => group.middleware(tag as any)),
      annotations: this.annotations
    })
  },
  annotate(this: AnyWithProps, key: ServiceMap.Key<any, any>, value: any) {
    return makeProto({
      identifier: this.identifier,
      groups: this.groups,
      annotations: ServiceMap.add(this.annotations, key, value)
    })
  },
  annotateMerge(this: AnyWithProps, annotations: ServiceMap.ServiceMap<never>) {
    return makeProto({
      identifier: this.identifier,
      groups: this.groups,
      annotations: ServiceMap.merge(this.annotations, annotations)
    })
  }
}

const makeProto = <Id extends string, Groups extends HttpApiGroup.Any>(
  options: {
    readonly identifier: Id
    readonly groups: Record.ReadonlyRecord<string, Groups>
    readonly annotations: ServiceMap.ServiceMap<never>
  }
): HttpApi<Id, Groups> => {
  function HttpApi() {}
  Object.setPrototypeOf(HttpApi, Proto)
  HttpApi.groups = options.groups
  HttpApi.annotations = options.annotations
  return HttpApi as any
}

/**
 * An `HttpApi` is a collection of `HttpApiEndpoint`s. You can use an `HttpApi` to
 * represent a portion of your domain.
 *
 * You can then use `HttpApiBuilder.layer(api)` to implement the endpoints of the
 * `HttpApi`.
 *
 * @since 4.0.0
 * @category constructors
 */
export const make = <const Id extends string>(identifier: Id): HttpApi<Id, never> =>
  makeProto({
    identifier,
    groups: new Map() as any,
    annotations: ServiceMap.empty()
  })

/**
 * Extract metadata from an `HttpApi`, which can be used to generate documentation
 * or other tooling.
 *
 * See the `OpenApi` & `HttpApiClient` modules for examples of how to use this function.
 *
 * @since 4.0.0
 * @category reflection
 */
export const reflect = <Id extends string, Groups extends HttpApiGroup.Any>(
  self: HttpApi<Id, Groups>,
  options: {
    readonly predicate?:
      | Predicate.Predicate<{
        readonly endpoint: HttpApiEndpoint.AnyWithProps
        readonly group: HttpApiGroup.AnyWithProps
      }>
      | undefined
    readonly onGroup: (options: {
      readonly group: HttpApiGroup.AnyWithProps
      readonly mergedAnnotations: ServiceMap.ServiceMap<never>
    }) => void
    readonly onEndpoint: (options: {
      readonly group: HttpApiGroup.AnyWithProps
      readonly endpoint: HttpApiEndpoint.AnyWithProps
      readonly mergedAnnotations: ServiceMap.ServiceMap<never>
      readonly middleware: ReadonlySet<HttpApiMiddleware.AnyKey>
      readonly payloads: ReadonlyMap<string, {
        readonly encoding: HttpApiSchema.Encoding
        readonly ast: AST.AST
      }>
      readonly successes: ReadonlyMap<number, {
        readonly ast: Option.Option<AST.AST>
        readonly description: Option.Option<string>
      }>
      readonly errors: ReadonlyMap<number, {
        readonly ast: Option.Option<AST.AST>
        readonly description: Option.Option<string>
      }>
    }) => void
  }
) => {
  const groups = Object.values(self.groups) as any as Array<HttpApiGroup.AnyWithProps>
  for (const group of groups) {
    const groupAnnotations = ServiceMap.merge(self.annotations, group.annotations)
    options.onGroup({
      group,
      mergedAnnotations: groupAnnotations
    })
    const endpoints = Object.values(group.endpoints) as Iterable<HttpApiEndpoint.AnyWithProps>
    for (const endpoint of endpoints) {
      if (
        options.predicate && !options.predicate({
          endpoint,
          group
        } as any)
      ) continue

      const errors = extractMembers(endpoint.errorSchema.ast, HttpApiSchema.getStatusError)
      options.onEndpoint({
        group,
        endpoint,
        middleware: endpoint.middlewares as any,
        mergedAnnotations: ServiceMap.merge(groupAnnotations, endpoint.annotations),
        payloads: endpoint.payloadSchema._tag === "Some" ? extractPayloads(endpoint.payloadSchema.value.ast) : emptyMap,
        successes: extractMembers(endpoint.successSchema.ast, HttpApiSchema.getStatusSuccess),
        errors
      })
    }
  }
}

// -------------------------------------------------------------------------------------

const emptyMap = new Map<never, never>()

const extractMembers = (
  ast: AST.AST,
  getStatus: (ast: AST.AST) => number
): ReadonlyMap<number, {
  readonly ast: Option.Option<AST.AST>
  readonly description: Option.Option<string>
}> => {
  const members = new Map<number, {
    readonly ast: Option.Option<AST.AST>
    readonly description: Option.Option<string>
  }>()
  function process(type: AST.AST) {
    if (AST.isNeverKeyword(type)) {
      return
    }
    const annotations = HttpApiSchema.getHttpApiAnnotations(ast.annotations)
    // Avoid changing the reference unless necessary
    // Otherwise, deduplication of the ASTs below will not be possible
    if (!Record.isEmptyRecord(annotations)) {
      type = AST.annotate(type, {
        ...annotations,
        ...type.annotations
      })
    }
    const status = getStatus(type)
    const isEmpty = type.annotations?.httpApiIsEmpty
    const current = members.get(status)
    members.set(
      status,
      {
        description: (current ? current.description : Option.none()).pipe(
          Option.orElse(() => getDescriptionOrIdentifier(type))
        ),
        ast: (current ? current.ast : Option.none()).pipe(
          // Deduplicate the ASTs
          Option.map((current) => HttpApiSchema.UnionUnifyAST(current, type)),
          Option.orElse(() => !isEmpty && HttpApiSchema.isVoid(type) ? Option.none() : Option.some(type))
        )
      }
    )
  }

  HttpApiSchema.extractUnionTypes(ast).forEach(process)
  return members
}

const extractPayloads = (topAst: AST.AST): ReadonlyMap<string, {
  readonly encoding: HttpApiSchema.Encoding
  readonly ast: AST.AST
}> => {
  const members = new Map<string, {
    encoding: HttpApiSchema.Encoding
    ast: AST.AST
  }>()
  function process(ast: AST.AST) {
    if (ast._tag === "NeverKeyword") {
      return
    }
    ast = AST.annotate(ast, {
      ...HttpApiSchema.getHttpApiAnnotations(topAst.annotations),
      ...ast.annotations
    })
    const encoding = HttpApiSchema.getEncoding(ast)
    const contentType = ast.annotations?.httpApiMultipart || ast.annotations?.httpApiMultipartStream
      ? "multipart/form-data"
      : encoding.contentType
    const current = members.get(contentType)
    if (current === undefined) {
      members.set(contentType, {
        encoding,
        ast
      })
    } else {
      current.ast = new AST.UnionType([current.ast, ast], "anyOf")
    }
  }
  if (topAst._tag === "UnionType") {
    for (const type of topAst.types) {
      process(type)
    }
  } else {
    process(topAst)
  }
  return members
}

const getDescriptionOrIdentifier = (ast: AST.AST): Option.Option<string> => {
  const annotations: Record<string, string> = ast.annotations ?? {} as any
  return Option.fromNullable(annotations.description ?? annotations.identfier)
}

/**
 * Adds additional schemas to components/schemas.
 * The provided schemas must have a `identifier` annotation.
 *
 * @since 4.0.0
 * @category tags
 */
export class AdditionalSchemas extends ServiceMap.Key<
  AdditionalSchemas,
  ReadonlyArray<Schema.Top>
>()("effect/httpapi/HttpApi/AdditionalSchemas") {}
