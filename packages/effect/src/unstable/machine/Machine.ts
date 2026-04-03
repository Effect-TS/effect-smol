/**
 * @since 4.0.0
 */
import * as Deferred from "../../Deferred.ts"
import * as Effect from "../../Effect.ts"
import * as Exit from "../../Exit.ts"
import * as Predicate from "../../Predicate.ts"
import * as PubSub from "../../PubSub.ts"
import * as Queue from "../../Queue.ts"
import * as Ref from "../../Ref.ts"
import * as Schema from "../../Schema.ts"
import type * as Scope from "../../Scope.ts"
import * as Stream from "../../Stream.ts"

const TypeId = "~effect/unstable/machine/Machine" as const
const BuilderTypeId = "~effect/unstable/machine/Machine/Builder" as const

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
type DataSchema<StateSchemas extends AnyStateSchemas, Name extends keyof StateSchemas & string> = StateSchemas[Name]
type StatePayload<StateSchemas extends AnyStateSchemas, Name extends keyof StateSchemas & string> = Omit<
  DataSchema<StateSchemas, Name>["~type.make.in"],
  "_tag"
>
type InputValue<InputSchema> = InputSchema extends Schema.Top ? Schema.Schema.Type<InputSchema> : never
type Initializer<InputSchema, State> = [InputSchema] extends [undefined] ? () => State
  : (args: { readonly input: InputValue<InputSchema> }) => State

/**
 * @since 4.0.0
 * @category models
 */
export type Snapshot<StateSchemas extends AnyStateSchemas> = {
  readonly [Name in keyof StateSchemas & string]:
    & { readonly _tag: Name }
    & Schema.Schema.Type<DataSchema<StateSchemas, Name>>
}[keyof StateSchemas & string]

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
  Source extends keyof StateSchemas & string,
  Tag extends EventTag<EventSchema>
> {
  readonly snapshot: Extract<Snapshot<StateSchemas>, { readonly _tag: Source }>
  readonly data: StatePayload<StateSchemas, Source>
  readonly event: EventByTag<EventSchema, Tag>
}

/**
 * @since 4.0.0
 * @category models
 */
export type Handler<
  StateSchemas extends AnyStateSchemas,
  Source extends keyof StateSchemas & string,
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
  E = never,
  R = never
> = {
  readonly [Name in keyof StateSchemas & string]?: {
    readonly [Tag in EventTag<EventSchema>]?: Handler<StateSchemas, Name, EventSchema, Tag, E, R>
  }
}

type HandlerUnion<HandlersDef extends Record<string, any>> = {
  readonly [Name in keyof HandlersDef & string]: Exclude<
    HandlersDef[Name],
    undefined
  >[keyof Exclude<HandlersDef[Name], undefined>]
}[keyof HandlersDef & string]

type InferHandlerError<HandlersDef extends Record<string, any>> = HandlerUnion<HandlersDef> extends
  (...args: Array<any>) => infer Return ? Return extends Effect.Effect<any, infer E, any> ? E : never
  : never

type InferHandlerServices<HandlersDef extends Record<string, any>> = HandlerUnion<HandlersDef> extends
  (...args: Array<any>) => infer Return ? Return extends Effect.Effect<any, any, infer R> ? R : never
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
  R = never
> {
  readonly [TypeId]: typeof TypeId
  readonly id: string | undefined
  readonly input: InputSchema
  readonly event: EventSchema
  readonly snapshot: AnyTaggedUnion
  readonly initial: Initializer<InputSchema, Snapshot<StateSchemas>>
  readonly states: { readonly [Name in keyof StateSchemas & string]: DataSchema<StateSchemas, Name> }
  readonly handlers: Handlers<EventSchema, StateSchemas, E, R>
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
export interface Builder<
  EventSchema extends AnyEventSchema,
  States extends AnyStateTuple,
  InputSchema = undefined
> {
  readonly [BuilderTypeId]: typeof BuilderTypeId
  readonly id: string | undefined
  readonly input: InputSchema
  readonly event: EventSchema
  readonly snapshot: AnyTaggedUnion
  readonly initial: Initializer<InputSchema, Snapshot<StateSchemasOfStates<States>>>
  readonly states: States
  readonly handlers: <HandlersDef extends Handlers<EventSchema, StateSchemasOfStates<States>, any, any>>(
    handlers: HandlersDef
  ) => Machine<
    EventSchema,
    StateSchemasOfStates<States>,
    InputSchema,
    InferHandlerError<HandlersDef>,
    InferHandlerServices<HandlersDef>
  >
}

/**
 * @since 4.0.0
 * @category models
 */
export type Any = Machine<any, any, any, any, any>

/**
 * @since 4.0.0
 * @category models
 */
export type StateSchemasOf<M extends Any> = M extends Machine<any, infer StateSchemas, any, any, any> ? StateSchemas
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type InputSchemaOf<M extends Any> = M extends Machine<any, any, infer InputSchema, any, any> ? InputSchema
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
export type ErrorOf<M extends Any> = M extends Machine<any, any, any, infer E, any> ? E : never

/**
 * @since 4.0.0
 * @category models
 */
export type ServicesOf<M extends Any> = M extends Machine<any, any, any, any, infer R> ? R : never

/**
 * @since 4.0.0
 * @category models
 */
export type MachineErrorOf<M extends Any> = ErrorOf<M> | UnhandledEventError

/**
 * @since 4.0.0
 * @category guards
 */
export const isMachine = (u: unknown): u is Any => Predicate.hasProperty(u, TypeId)

const toEffect = <A, E, R>(value: A | Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Effect.isEffect(value) ? value : Effect.succeed(value)

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
}): Builder<Schema.toTaggedUnion<"_tag", Events>, States, InputSchema> => {
  const event = normalizeEventSchema(definition)
  const initial = definition.initial
  return {
    [BuilderTypeId]: BuilderTypeId,
    id: definition.id,
    input: definition.input as InputSchema,
    event,
    snapshot: snapshotSchemaFromStates(definition.states),
    initial,
    states: definition.states,
    handlers: (handlers) => ({
      [TypeId]: TypeId,
      id: definition.id,
      input: definition.input as InputSchema,
      event,
      snapshot: snapshotSchemaFromStates(definition.states),
      initial,
      states: definition.states as any,
      handlers: handlers as any
    })
  }
}

const snapshotSchemaFromStates = <const States extends AnyStateTuple>(states: States): AnyTaggedUnion =>
  Schema.Union(states as any).pipe(Schema.toTaggedUnion("_tag")) as AnyTaggedUnion

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
): Effect.Effect<Snapshot<StateSchemasOf<M>>> =>
  Effect.sync(() => resolveInitial(self, args as ReadonlyArray<InputOf<M>>))

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
    const current = snapshot as Source
    const currentEvent = event as Event<M["event"]>
    const handlers = self.handlers[current._tag as keyof typeof self.handlers]
    const handler = handlers?.[(currentEvent as { readonly _tag: string })._tag as keyof typeof handlers] as
      | Handler<StateSchemasOf<M>, Source["_tag"], M["event"], EventTag<M["event"]>, ErrorOf<M>, ServicesOf<M>>
      | undefined
    if (handler === undefined) {
      return yield* Effect.fail(
        new UnhandledEventError({
          machineId: self.id,
          state: current._tag,
          event: (currentEvent as { readonly _tag: string })._tag
        })
      )
    }
    const { _tag: _, ...data } = current as any
    const decision = yield* toEffect(handler({
      snapshot: current as any,
      data,
      event: currentEvent as any
    }))
    const next = decision
    return {
      snapshot: current,
      event: currentEvent,
      next,
      changed: next !== current
    }
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
  const handlers = self.handlers[snapshot._tag as keyof typeof self.handlers] ?? {}
  return Object.keys(handlers) as ReadonlyArray<EventTag<M["event"]>>
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
        const result = yield* Effect.exit(next(machine, current as any, envelope.event as any))
        if (Exit.isSuccess(result)) {
          yield* Ref.set(snapshots, result.value as any)
          yield* PubSub.publish(changesHub, result.value as any)
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
