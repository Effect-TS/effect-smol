/**
 * @since 4.0.0
 */
import * as Deferred from "../../Deferred.ts"
import * as Context from "../../Context.ts"
import * as Effect from "../../Effect.ts"
import * as Exit from "../../Exit.ts"
import * as Predicate from "../../Predicate.ts"
import * as PubSub from "../../PubSub.ts"
import * as Queue from "../../Queue.ts"
import * as Ref from "../../Ref.ts"
import * as Schema from "../../Schema.ts"
import * as SchemaAST from "../../SchemaAST.ts"
import type * as Scope from "../../Scope.ts"
import * as Stream from "../../Stream.ts"

const TypeId = "~effect/unstable/machine/Machine" as const
declare const HandlerContextTypeId: unique symbol

type AnyTaggedEvent = Schema.Top & { readonly Type: { readonly _tag: PropertyKey } }
type AnyTaggedUnion = Schema.Top & { readonly Type: { readonly _tag: PropertyKey }; readonly cases: any }
type AnyEventSchema = Schema.Top & {
  readonly Type: { readonly _tag: PropertyKey }
  readonly cases: any
}
type AnyEventTuple = readonly [AnyTaggedEvent, ...Array<AnyTaggedEvent>]
type AnyTaggedState = Schema.Top & { readonly Type: { readonly _tag: PropertyKey } }
type AnyStateTuple = readonly [AnyTaggedState, ...Array<AnyTaggedState>]
type AnyStateSchemas = Record<string, AnyTaggedState>

type StateSchemasOfStates<States extends AnyStateTuple> = {
  readonly [State in States[number] as State["Type"]["_tag"] & string]: State
}
type ScopePrefixes<Tag extends string> = Tag extends `${infer Head}.${infer Tail}`
  ? Head | `${Head}.${ScopePrefixes<Tail>}`
  : Tag
type ScopesOfStates<States extends AnyStateSchemas> = {
  readonly [Name in keyof States & string]: ScopePrefixes<Name>
}[keyof States & string]
type StatesInScope<States extends AnyStateSchemas, Scope extends string> = {
  readonly [Name in keyof States & string as Name extends Scope | `${Scope}.${string}` ? Name : never]: States[Name]
}
type DataSchema<StateSchemas extends AnyStateSchemas, Name extends keyof StateSchemas & string> = StateSchemas[Name]
type InputValue<InputSchema> = InputSchema extends Schema.Top ? Schema.Schema.Type<InputSchema> : never
type Initializer<InputSchema, State> = [InputSchema] extends [undefined] ? () => State
  : (args: { readonly input: InputValue<InputSchema> }) => State

/**
 * @since 4.0.0
 * @category models
 */
export type Snapshot<StateSchemas extends AnyStateSchemas> = {
  readonly [Name in keyof StateSchemas & string]: Schema.Schema.Type<DataSchema<StateSchemas, Name>>
}[keyof StateSchemas & string]

/**
 * @since 4.0.0
 * @category models
 */
export type ReducedSnapshot<StateSchemas extends AnyStateSchemas> = {
  readonly [Name in keyof StateSchemas & string]: Schema.Schema.Type<DataSchema<StateSchemas, Name>>
}[keyof StateSchemas & string] extends infer Q ? Q : never

/**
 * @since 4.0.0
 * @category models
 */
export type Event<EventSchema extends AnyEventSchema> = EventSchema["Type"]

type EventTag<EventSchema extends AnyEventSchema> = keyof EventSchema["cases"] & string
type EventByTag<EventSchema extends AnyEventSchema, Tag extends EventTag<EventSchema>> =
  EventSchema["cases"][Tag]["Type"]

/**
 * @since 4.0.0
 * @category models
 */
export type Transition<StateSchemas extends AnyStateSchemas> = Snapshot<StateSchemas>

/**
 * @since 4.0.0
 * @category models
 */
export interface HandlerArgs<
  EventSchema extends AnyEventSchema,
  StateSchemas extends AnyStateSchemas,
  Source extends ScopesOfStates<StateSchemas>,
  Tag extends EventTag<EventSchema>
> {
  readonly state: ReducedSnapshot<StatesInScope<StateSchemas, Source>>
  readonly event: EventByTag<EventSchema, Tag>
}

/**
 * @since 4.0.0
 * @category models
 */
export type Handler<
  StateSchemas extends AnyStateSchemas,
  Source extends ScopesOfStates<StateSchemas>,
  EventSchema extends AnyEventSchema,
  Tag extends EventTag<EventSchema>,
  E = never,
  R = never
> = (
  args: HandlerArgs<EventSchema, StateSchemas, Source, Tag>
) => Transition<StateSchemas> | Effect.Effect<Transition<StateSchemas>, E, R>

/**
 * @since 4.0.0
 * @category models
 */
export type Handlers<
  EventSchema extends AnyEventSchema,
  StateSchemas extends AnyStateSchemas,
  Scope extends ScopesOfStates<StateSchemas>,
  E = never,
  R = never
> = {
  readonly [Tag in EventTag<EventSchema>]?: Handler<StateSchemas, Scope, EventSchema, Tag, E, R>
}

type HandlerDefinitions<
  EventSchema extends AnyEventSchema,
  StateSchemas extends AnyStateSchemas,
  Scope extends ScopesOfStates<StateSchemas>
> = {
  readonly [Tag in EventTag<EventSchema>]?: (
    args: HandlerArgs<EventSchema, StateSchemas, Scope, Tag>
  ) => Snapshot<StateSchemas> | Effect.Effect<Snapshot<StateSchemas>, any, any>
}

type HandlerUnion<HandlersDef extends Record<string, any>> = Exclude<HandlersDef[keyof HandlersDef], undefined>

/**
 * @since 4.0.0
 * @category context
 */
export class HandlerContext extends Context.Service<HandlerContext, {
  readonly defer: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<void, never, HandlerContext.Marker<E, R>>
  readonly read: Effect.Effect<ReadonlyArray<Effect.Effect<void, any, any>>>
}>()("effect/unstable/machine/Machine/HandlerContext") {}

export declare namespace HandlerContext {
  export interface Marker<E = never, R = never> {
    readonly [HandlerContextTypeId]: {
      readonly _E: (_: never) => E
      readonly _R: (_: never) => R
    }
  }
}

type DeferredMarker = HandlerContext.Marker<any, any>
type DeferredMarkerFromServices<R> = Extract<R, DeferredMarker>
type InferDeferredErrorFromServices<R> = [DeferredMarkerFromServices<R>] extends [never] ? never
  : DeferredMarkerFromServices<R> extends HandlerContext.Marker<infer E, any> ? E
  : never
type InferDeferredServicesFromServices<R> = [DeferredMarkerFromServices<R>] extends [never] ? never
  : DeferredMarkerFromServices<R> extends HandlerContext.Marker<any, infer R> ? R
  : never
type StripHandlerContext<R> = Exclude<R, HandlerContext | DeferredMarker>

type InferHandlerError<HandlersDef extends Record<string, any>> = HandlerUnion<HandlersDef> extends
  (...args: Array<any>) => infer Return ? Return extends Effect.Effect<any, any, any> ? Effect.Error<Return> : never
  : never

type InferHandlerServices<HandlersDef extends Record<string, any>> = HandlerUnion<HandlersDef> extends
  (...args: Array<any>) => infer Return ? Return extends Effect.Effect<any, any, any> ? StripHandlerContext<Effect.Services<Return>>
  : never
  : never

type InferDeferredError<HandlersDef extends Record<string, any>> = HandlerUnion<HandlersDef> extends
  (...args: Array<any>) => infer Return ? Return extends Effect.Effect<any, any, any>
    ? InferDeferredErrorFromServices<Effect.Services<Return>>
  : never
  : never

type InferDeferredServices<HandlersDef extends Record<string, any>> = HandlerUnion<HandlersDef> extends
  (...args: Array<any>) => infer Return ? Return extends Effect.Effect<any, any, any>
    ? InferDeferredServicesFromServices<Effect.Services<Return>>
  : never
  : never

/**
 * @since 4.0.0
 * @category models
 */
export interface Plan<
  StateSchemas extends AnyStateSchemas,
  EventSchema extends AnyEventSchema,
  Source extends Snapshot<StateSchemas> = Snapshot<StateSchemas>
> {
  readonly snapshot: Source
  readonly event: Event<EventSchema>
  readonly next: Snapshot<StateSchemas>
  readonly changed: boolean
}

/**
 * @since 4.0.0
 * @category models
 */
export interface Machine<
  EventSchema extends AnyEventSchema,
  StateSchemas extends AnyStateSchemas,
  InputSchema = undefined,
  E = never,
  R = never,
  DeferredE = never,
  DeferredR = never
> {
  readonly [TypeId]: typeof TypeId
  readonly id: string | undefined
  readonly input: InputSchema
  readonly event: EventSchema
  readonly snapshot: AnyTaggedUnion
  readonly initial: Initializer<InputSchema, Snapshot<StateSchemas>>
  readonly states: { readonly [Name in keyof StateSchemas & string]: DataSchema<StateSchemas, Name> }
  readonly scopedHandlers: Partial<Record<ScopesOfStates<StateSchemas>, Handlers<EventSchema, StateSchemas, any, any, any>>>
  readonly handlers: <Scope extends ScopesOfStates<StateSchemas>>(
    scope: Scope
  ) => <HandlersDef extends HandlerDefinitions<EventSchema, StateSchemas, Scope>>(
    handlers: HandlersDef
  ) => Machine<
    EventSchema,
    StateSchemas,
    InputSchema,
    InferHandlerError<HandlersDef> | E,
    InferHandlerServices<HandlersDef> | R,
    InferDeferredError<HandlersDef> | DeferredE,
    InferDeferredServices<HandlersDef> | DeferredR
  >
}

/**
 * @since 4.0.0
 * @category errors
 */
export class UnhandledEventError extends Schema.TaggedErrorClass<UnhandledEventError, { readonly _: unique symbol }>()(
  "UnhandledEventError",
  {
    machineId: Schema.optional(Schema.String),
    state: Schema.String,
    event: Schema.String
  }
) {}

/**
 * @since 4.0.0
 * @category models
 */
export interface Actor<M extends Any> {
  readonly send: (event: Event<M["event"]>) => Effect.Effect<void, MachineErrorOf<M>>
  readonly snapshot: Effect.Effect<Snapshot<StateSchemasOf<M>>>
  readonly changes: Stream.Stream<Snapshot<StateSchemasOf<M>>>
}

interface Envelope<E, A> {
  readonly event: E
  readonly ack: Deferred.Deferred<Exit.Exit<void, A>>
}

/**
 * @since 4.0.0
 * @category models
 */
export type Any = Machine<any, any, any, any, any, any, any>

/**
 * @since 4.0.0
 * @category models
 */
export type StateSchemasOf<M extends Any> = M extends Machine<any, infer StateSchemas, any, any, any, any, any> ? StateSchemas
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type InputSchemaOf<M extends Any> = M extends Machine<any, any, infer InputSchema, any, any, any, any> ? InputSchema
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type InputOf<M extends Any> = InputValue<InputSchemaOf<M>>

/**
 * @since 4.0.0
 * @category models
 */
export type ImmediateErrorOf<M extends Any> = M extends Machine<any, any, any, infer E, any, any, any> ? E : never

/**
 * @since 4.0.0
 * @category models
 */
export type ImmediateServicesOf<M extends Any> = M extends Machine<any, any, any, any, infer R, any, any> ? R : never

/**
 * @since 4.0.0
 * @category models
 */
export type DeferredErrorOf<M extends Any> = M extends Machine<any, any, any, any, any, infer E, any> ? E : never

/**
 * @since 4.0.0
 * @category models
 */
export type DeferredServicesOf<M extends Any> = M extends Machine<any, any, any, any, any, any, infer R> ? R : never

/**
 * @since 4.0.0
 * @category models
 */
export type ErrorOf<M extends Any> = ImmediateErrorOf<M> | DeferredErrorOf<M>

/**
 * @since 4.0.0
 * @category models
 */
export type ServicesOf<M extends Any> = ImmediateServicesOf<M> | DeferredServicesOf<M>

/**
 * @since 4.0.0
 * @category models
 */
export type PlanErrorOf<M extends Any> = ImmediateErrorOf<M>

/**
 * @since 4.0.0
 * @category models
 */
export type PlanServicesOf<M extends Any> = ImmediateServicesOf<M>

/**
 * @since 4.0.0
 * @category models
 */
export type MachineErrorOf<M extends Any> = ErrorOf<M> | UnhandledEventError

type EvaluateServicesOf<M extends Any> =
  | ImmediateServicesOf<M>
  | HandlerContext
  | HandlerContext.Marker<DeferredErrorOf<M>, DeferredServicesOf<M>>

/**
 * @since 4.0.0
 * @category guards
 */
export const isMachine = (u: unknown): u is Any => Predicate.hasProperty(u, TypeId)

const toEffect = <A, E, R>(value: A | Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Effect.isEffect(value) ? value : Effect.succeed(value)

const scopesOf = (tag: string): ReadonlyArray<string> => {
  const segments = tag.split(".")
  const scopes = new Array<string>(segments.length)
  for (let i = segments.length; i >= 1; i--) {
    scopes[segments.length - i] = segments.slice(0, i).join(".")
  }
  return scopes
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const make = <
  const Events extends AnyEventTuple,
  const States extends AnyStateTuple,
  InputSchema = undefined
>(definition: {
  readonly id?: string | undefined
  readonly input?: InputSchema
  readonly events: Events
  readonly initial: Initializer<InputSchema, Snapshot<StateSchemasOfStates<States>>>
  readonly states: States
}): Machine<Schema.toTaggedUnion<"_tag", Events>, StateSchemasOfStates<States>, InputSchema> => {
  const event = normalizeEventSchema(definition)
  const initial = definition.initial
  const snapshot = snapshotSchemaFromStates(definition.states)
  const states = Object.fromEntries(definition.states.map((state) => [stateTag(state), state])) as {
    readonly [Name in keyof StateSchemasOfStates<States> & string]: DataSchema<StateSchemasOfStates<States>, Name>
  }
  const makeMachine = <E, R, DeferredE, DeferredR>(
    scopedHandlers: Partial<
      Record<
        ScopesOfStates<StateSchemasOfStates<States>>,
        Handlers<typeof event, StateSchemasOfStates<States>, any, any, any>
      >
    >
  ): Machine<typeof event, StateSchemasOfStates<States>, InputSchema, E, R, DeferredE, DeferredR> => ({
    [TypeId]: TypeId,
    id: definition.id,
    input: definition.input as InputSchema,
    event,
    snapshot,
    initial,
    states,
    scopedHandlers: scopedHandlers as any,
    handlers: (scope) => (handlers) =>
      makeMachine<
        InferHandlerError<typeof handlers> | E,
        InferHandlerServices<typeof handlers> | R,
        InferDeferredError<typeof handlers> | DeferredE,
        InferDeferredServices<typeof handlers> | DeferredR
      >({
        ...scopedHandlers,
        [scope]: handlers as Handlers<typeof event, StateSchemasOfStates<States>, typeof scope, any, any>
      })
  })
  return makeMachine<never, never, never, never>({})
}

const snapshotSchemaFromStates = <const States extends AnyStateTuple>(states: States): AnyTaggedUnion =>
  Schema.Union(states as any).pipe(Schema.toTaggedUnion("_tag")) as AnyTaggedUnion

const stateTag = (state: AnyTaggedState): string => {
  const ast = SchemaAST.toEncoded((state as Schema.Top).ast)
  if (!SchemaAST.isObjects(ast)) {
    throw new Error("Machine states must be object-like tagged schemas")
  }
  const tagField = ast.propertySignatures.find((property) => property.name === "_tag")
  if (tagField === undefined || !SchemaAST.isLiteral(tagField.type) || typeof tagField.type.literal !== "string") {
    throw new Error("Machine states must have a string literal _tag")
  }
  return tagField.type.literal
}

const normalizeEventSchema = <const Events extends AnyEventTuple>(
  definition: { readonly events: Events }
): Schema.toTaggedUnion<"_tag", Events> =>
  Schema.Union(definition.events as any).pipe(Schema.toTaggedUnion("_tag")) as Schema.toTaggedUnion<"_tag", Events>

/**
 * @since 4.0.0
 * @category constructors
 */
type InitialArguments<M extends Any> = [InputSchemaOf<M>] extends [undefined] ? [] : [input: InputOf<M>]

const resolveInitial = <M extends Any>(self: M, args: ReadonlyArray<InputOf<M>>): Snapshot<StateSchemasOf<M>> => {
  if (self.input === undefined) {
    return (self.initial as () => Snapshot<StateSchemasOf<M>>)()
  }
  return (self.initial as (args: { readonly input: InputOf<M> }) => Snapshot<StateSchemasOf<M>>)({
    input: args[0] as InputOf<M>
  })
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const initial = <M extends Any>(
  self: M,
  ...args: InitialArguments<M>
): Snapshot<StateSchemasOf<M>> => resolveInitial(self, args as ReadonlyArray<InputOf<M>>)

/**
 * @since 4.0.0
 * @category accessors
 */
export const defer = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<void, never, HandlerContext | HandlerContext.Marker<E, R>> =>
  Effect.gen(function*() {
    const context = yield* HandlerContext
    return yield* context.defer(effect)
  })

interface EvaluatedPlan<
  StateSchemas extends AnyStateSchemas,
  EventSchema extends AnyEventSchema,
  Source extends Snapshot<StateSchemas>,
  DeferredE = never,
  DeferredR = never
> {
  readonly plan: Plan<StateSchemas, EventSchema, Source>
  readonly deferred: ReadonlyArray<Effect.Effect<void, DeferredE, DeferredR>>
}

const makeHandlerContext = (): HandlerContext["Service"] => {
  const deferred: Array<Effect.Effect<void, any, any>> = []
  return HandlerContext.of({
    defer: <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<void, never, HandlerContext.Marker<E, R>> =>
      Effect.sync(() => {
        deferred.push(Effect.asVoid(effect))
      }),
    read: Effect.sync(() => deferred)
  })
}

const runDeferred = <E, R>(
  deferred: ReadonlyArray<Effect.Effect<void, E, R>>
): Effect.Effect<void, E, R> =>
  Effect.forEach(deferred, (effect) => effect, { discard: true })

const evaluate = <
  M extends Any,
  Source extends Snapshot<StateSchemasOf<M>>
>(
  self: M,
  snapshot: Source,
  event: Event<M["event"]>
): Effect.Effect<
  EvaluatedPlan<StateSchemasOf<M>, M["event"], Source, DeferredErrorOf<M>, DeferredServicesOf<M>>,
  UnhandledEventError | PlanErrorOf<M>,
  PlanServicesOf<M>
> =>
  Effect.gen(function*() {
    const current = snapshot as Source
    const currentEvent = event as Event<M["event"]>
    const eventTag = (currentEvent as { readonly _tag: string })._tag
    let handler:
      | Handler<StateSchemasOf<M>, any, M["event"], EventTag<M["event"]>, PlanErrorOf<M>, EvaluateServicesOf<M>>
      | undefined = undefined
    for (const scope of scopesOf(current._tag)) {
      const handlers = self.scopedHandlers[scope as keyof typeof self.scopedHandlers]
      const candidate = handlers?.[eventTag as keyof typeof handlers] as
        | Handler<StateSchemasOf<M>, any, M["event"], EventTag<M["event"]>, PlanErrorOf<M>, EvaluateServicesOf<M>>
        | undefined
      if (candidate !== undefined) {
        handler = candidate
        break
      }
    }
    if (handler === undefined) {
      return yield* Effect.fail(
        new UnhandledEventError({
          machineId: self.id,
          state: current._tag,
          event: eventTag
        })
      )
    }
    const handlerContext = makeHandlerContext()
    const next = yield* (Effect.provideService(toEffect(handler({
      state: current as any,
      event: currentEvent as any
    })), HandlerContext, handlerContext) as Effect.Effect<
      Snapshot<StateSchemasOf<M>>,
      PlanErrorOf<M>,
      PlanServicesOf<M>
    >)
    const deferred = (yield* handlerContext.read) as ReadonlyArray<
      Effect.Effect<void, DeferredErrorOf<M>, DeferredServicesOf<M>>
    >
    return {
      plan: {
        snapshot: current,
        event: currentEvent,
        next,
        changed: next !== current
      },
      deferred
    }
  })

/**
 * @since 4.0.0
 * @category constructors
 */
export const plan = <
  M extends Any,
  Source extends Snapshot<StateSchemasOf<M>>
>(
  self: M,
  snapshot: Source,
  event: Event<M["event"]>
): Effect.Effect<
  Plan<StateSchemasOf<M>, M["event"], Source>,
  UnhandledEventError | PlanErrorOf<M>,
  PlanServicesOf<M>
> => Effect.map(evaluate(self, snapshot, event), (_) => _.plan)

/**
 * @since 4.0.0
 * @category constructors
 */
export const transition = <
  M extends Any,
  Source extends Snapshot<StateSchemasOf<M>>
>(
  self: M,
  snapshot: Source,
  event: Event<M["event"]>
): Effect.Effect<
  Plan<StateSchemasOf<M>, M["event"], Source>,
  MachineErrorOf<M>,
  ServicesOf<M>
> =>
  Effect.gen(function*() {
    const evaluated = yield* evaluate(self, snapshot, event)
    yield* runDeferred(evaluated.deferred)
    return evaluated.plan
  })

/**
 * @since 4.0.0
 * @category constructors
 */
export const next = <
  M extends Any,
  Source extends Snapshot<StateSchemasOf<M>>
>(
  self: M,
  snapshot: Source,
  event: Event<M["event"]>
): Effect.Effect<
  Snapshot<StateSchemasOf<M>>,
  MachineErrorOf<M>,
  ServicesOf<M>
> => Effect.map(transition(self, snapshot, event), (plan) => plan.next)

/**
 * @since 4.0.0
 * @category constructors
 */
export const enabled = <
  M extends Any,
  Source extends Snapshot<StateSchemasOf<M>>
>(
  self: M,
  snapshot: Source
): ReadonlyArray<EventTag<M["event"]>> => {
  const enabled = new Set<EventTag<M["event"]>>()
  for (const scope of scopesOf(snapshot._tag)) {
    const handlers = self.scopedHandlers[scope as keyof typeof self.scopedHandlers] ?? {}
    for (const key of Object.keys(handlers)) {
      enabled.add(key as EventTag<M["event"]>)
    }
  }
  return Array.from(enabled)
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const graph = <M extends Any>(self: M) => ({
  id: self.id,
  states: Object.keys(self.states)
})

/**
 * @since 4.0.0
 * @category constructors
 */
export const start = <M extends Any>(
  machine: M,
  ...args: InitialArguments<M>
): Effect.Effect<Actor<M>, never, Scope.Scope | ServicesOf<M>> =>
  Effect.gen(function*() {
    const initialSnapshot = resolveInitial(machine, args as ReadonlyArray<InputOf<M>>)
    const snapshots = yield* Ref.make(initialSnapshot)
    const mailbox = yield* Queue.unbounded<Envelope<Event<M["event"]>, MachineErrorOf<M>>>()
    const changesHub = yield* PubSub.unbounded<Snapshot<StateSchemasOf<M>>>()

    const loop = Effect.gen(function*() {
      while (true) {
        const envelope = yield* Queue.take(mailbox)
        const current = yield* Ref.get(snapshots)
        const result = yield* Effect.exit(evaluate(machine, current as any, envelope.event as any))
        if (Exit.isSuccess(result)) {
          yield* Ref.set(snapshots, result.value.plan.next as any)
          yield* PubSub.publish(changesHub, result.value.plan.next as any)
          const deferredResult = yield* Effect.exit(runDeferred(result.value.deferred))
          yield* Deferred.succeed(
            envelope.ack,
            Exit.isSuccess(deferredResult) ? Exit.succeed<void>(void 0) : deferredResult
          )
          continue
        }
        yield* Deferred.succeed(envelope.ack, Exit.map(result, () => void 0))
      }
    })

    yield* Effect.forkScoped(loop)
    yield* Effect.addFinalizer(() => Queue.shutdown(mailbox))
    yield* Effect.addFinalizer(() => PubSub.shutdown(changesHub))

    const send = (event: Event<M["event"]>): Effect.Effect<void, MachineErrorOf<M>> =>
      Effect.gen(function*() {
        const ack = yield* Deferred.make<Exit.Exit<void, MachineErrorOf<M>>>()
        yield* Queue.offer(mailbox, { event, ack })
        const exit = yield* Deferred.await(ack)
        return yield* Exit.match(exit, {
          onSuccess: () => Effect.void,
          onFailure: Effect.failCause
        })
      })

    return {
      send,
      snapshot: Ref.get(snapshots),
      changes: Stream.concat(Stream.make(initialSnapshot), Stream.fromPubSub(changesHub))
    }
  })
