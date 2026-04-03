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
import * as SchemaAST from "../../SchemaAST.ts"
import type * as Scope from "../../Scope.ts"
import * as Stream from "../../Stream.ts"

const TypeId = "~effect/unstable/machine/Machine" as const

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

type HandlerUnion<HandlersDef extends Record<string, any>> = Exclude<HandlersDef[keyof HandlersDef], undefined>

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
  readonly scopedHandlers: Partial<Record<ScopesOfStates<StateSchemas>, Handlers<EventSchema, StateSchemas, any, E, R>>>
  readonly handlers: <Scope extends ScopesOfStates<StateSchemas>>(
    scope: Scope
  ) => <HandlersDef extends Handlers<EventSchema, StateSchemas, Scope, any, any>>(
    handlers: HandlersDef
  ) => Machine<
    EventSchema,
    StateSchemas,
    InputSchema,
    InferHandlerError<HandlersDef> | E,
    InferHandlerServices<HandlersDef> | R
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
  const makeMachine = <E, R>(
    scopedHandlers: Partial<
      Record<
        ScopesOfStates<StateSchemasOfStates<States>>,
        Handlers<typeof event, StateSchemasOfStates<States>, any, any, any>
      >
    >
  ): Machine<typeof event, StateSchemasOfStates<States>, InputSchema, E, R> => ({
    [TypeId]: TypeId,
    id: definition.id,
    input: definition.input as InputSchema,
    event,
    snapshot,
    initial,
    states,
    scopedHandlers: scopedHandlers as any,
    handlers: (scope) => (handlers) =>
      makeMachine<InferHandlerError<typeof handlers> | E, InferHandlerServices<typeof handlers> | R>({
        ...scopedHandlers,
        [scope]: handlers
      })
  })
  return makeMachine<never, never>({})
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
    const eventTag = (currentEvent as { readonly _tag: string })._tag
    let handler:
      | Handler<StateSchemasOf<M>, any, M["event"], EventTag<M["event"]>, ErrorOf<M>, ServicesOf<M>>
      | undefined = undefined
    for (const scope of scopesOf(current._tag)) {
      const handlers = self.scopedHandlers[scope as keyof typeof self.scopedHandlers]
      const candidate = handlers?.[eventTag as keyof typeof handlers] as
        | Handler<StateSchemasOf<M>, any, M["event"], EventTag<M["event"]>, ErrorOf<M>, ServicesOf<M>>
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
    const decision = yield* toEffect(handler({
      state: current as any,
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
