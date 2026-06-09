/**
 * Schema-first state machine definitions.
 *
 * @since 4.0.0
 */

import type * as Cause from "../../Cause.ts"
import * as Context from "../../Context.ts"
import * as Data from "../../Data.ts"
import * as Effect from "../../Effect.ts"
import * as Exit from "../../Exit.ts"
import * as HashMap from "../../HashMap.ts"
import { PipeInspectableProto } from "../../internal/core.ts"
import * as Option from "../../Option.ts"
import type { Pipeable } from "../../Pipeable.ts"
import { hasProperty } from "../../Predicate.ts"
import * as Ref from "../../Ref.ts"
import * as Schema from "../../Schema.ts"
import * as Scope from "../../Scope.ts"
import * as Stream from "../../Stream.ts"
import * as ActorModule from "./Actor.ts"

/**
 * String literal type used as the runtime type identifier for `StateMachine`
 * values.
 *
 * @category type IDs
 * @since 4.0.0
 */
export type TypeId = "~effect/StateMachine"

/**
 * Runtime type identifier attached to `StateMachine` values.
 *
 * @category type IDs
 * @since 4.0.0
 */
export const TypeId: TypeId = "~effect/StateMachine"

const TargetTypeId = "~effect/StateMachine/Target"

type IsAny<A> = 0 extends (1 & A) ? true : false

/**
 * A schema-first state machine definition.
 *
 * @category models
 * @since 4.0.0
 */
export interface Machine<
  States extends Machine.StateSchemas,
  Events extends ReadonlyArray<Machine.TaggedSchema>,
  Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.StateIdentifier<States> = Machine.StateIdentifier<States>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.StateIdentifier<States> = never,
  Output = never,
  Emits extends ReadonlyArray<Machine.TaggedSchema> = any
> extends Pipeable {
  readonly [TypeId]: TypeId
  readonly states: States
  readonly events: Events
  readonly emits: Emits
  readonly input: Input | undefined
  readonly id: string | undefined

  /** @internal */
  readonly stateNodes: Machine.StateNodes

  readonly handlers: Machine.StateConfigs<States, Events, Emits, UnhandledStates, Machine.TagOf<Events[number]>, E, R>
  readonly handle: Machine.Handler<
    States,
    Events,
    Emits,
    Input,
    UnhandledStates,
    E,
    R,
    InitialE,
    InitialR,
    FinalStates,
    Output
  >

  /** @internal */
  readonly initial: (...args: [...Machine.InputArgs<Input>]) => Machine.InitialResult<States, InitialE, InitialR>
}

/**
 * Error returned when an event has no handler for the current state.
 *
 * @category errors
 * @since 4.0.0
 */
export class UnhandledEventError extends Data.TaggedError("UnhandledEventError")<{
  readonly machineId: string | undefined
  readonly state: string
  readonly event: string
}> {}

/**
 * Error returned when a state machine does not stabilize within the maximum
 * number of macrostep iterations.
 *
 * @category errors
 * @since 4.0.0
 */
export class InfiniteTransitionError extends Data.TaggedError("InfiniteTransitionError")<{
  readonly machineId: string | undefined
  readonly state: string
  readonly maxIterations: number
}> {}

/**
 * Error returned when a state machine fails while running startup lifecycle
 * logic after the initial state has been computed.
 *
 * @category errors
 * @since 4.0.0
 */
export class StartupError extends Data.TaggedError("StartupError")<{
  readonly cause: Cause.Cause<unknown>
}> {}

type DeferredAction<E = any, R = any> = Effect.Effect<void, E, R>

interface DeferredQueue<A> {
  readonly add: (value: A) => Effect.Effect<void>
  readonly read: Effect.Effect<ReadonlyArray<A>>
}

class DeferredActions extends Context.Service<DeferredActions, {
  readonly add: <E, R>(effect: DeferredAction<E, R>) => Effect.Effect<void>
  readonly read: Effect.Effect<ReadonlyArray<DeferredAction>>
}>()("effect/StateMachine/DeferredActions") {}

class DeferredRaisedEvents extends Context.Service<DeferredRaisedEvents, {
  readonly add: <Event>(event: Event) => Effect.Effect<void>
  readonly read: Effect.Effect<ReadonlyArray<any>>
}>()("effect/StateMachine/DeferredRaisedEvents") {}

/**
 * Actor runtime scope available to state machine actions when a machine runs
 * through `toActorLogic`.
 *
 * @category services
 * @since 4.0.0
 */
export class ActorRuntime extends Context.Service<ActorRuntime, ActorModule.ActorScope<any>>()(
  "effect/StateMachine/ActorRuntime"
) {}

const RuntimeRequirementTypeId = "~effect/StateMachine/RuntimeRequirement"

/**
 * Runtime capability available to state machine actions.
 *
 * @category models
 * @since 4.0.0
 */
export interface Runtime<in Events, in Emits> {
  readonly raise: (event: Events) => Effect.Effect<void>
  readonly sendParent: (event: Emits) => Effect.Effect<void>
}

/**
 * Namespace containing type-level members associated with `Runtime`.
 *
 * @since 4.0.0
 */
export declare namespace Runtime {
  /**
   * Protocol annotation accepted by {@link runtime}.
   *
   * @category models
   * @since 4.0.0
   */
  export interface Protocol {
    readonly events?: unknown
    readonly emits?: unknown
  }

  /**
   * Extracts the events required by a runtime protocol annotation.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type Events<Protocol> = Protocol extends { readonly events: infer Events } ? Events : never

  /**
   * Extracts the emitted events required by a runtime protocol annotation.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type Emits<Protocol> = Protocol extends { readonly emits: infer Emits } ? Emits : never

  /**
   * Opaque service requirement for a state machine runtime capability.
   *
   * @category services
   * @since 4.0.0
   */
  export interface Requirement<Events, Emits> {
    readonly [RuntimeRequirementTypeId]: {
      readonly events: Events
      readonly emits: Emits
    }
  }
}

class RuntimeContext extends Context.Service<RuntimeContext, Runtime<any, any>>()(
  "effect/StateMachine/Runtime"
) {}

type ExcludeCompatibleRuntime<Requirements, Events, Emits> = Requirements extends Runtime.Requirement<
  infer RequiredEvents,
  infer RequiredEmits
> ? IsAny<Requirements> extends true ? Requirements
  : [RequiredEvents] extends [Events] ? [RequiredEmits] extends [Emits] ? never : Requirements
  : Requirements
  : Requirements

type IncompatibleRuntime<Requirements, Events, Emits> = Requirements extends Runtime.Requirement<
  infer RequiredEvents,
  infer RequiredEmits
> ? IsAny<Requirements> extends true ? never
  : [RequiredEvents] extends [Events] ? [RequiredEmits] extends [Emits] ? never : Requirements
  : Requirements
  : never

const RuntimeCompatibilityErrorTypeId = "~effect/StateMachine/RuntimeCompatibilityError"

type EnsureCompatibleRuntime<Requirements, Events, Emits> = [IncompatibleRuntime<Requirements, Events, Emits>] extends
  [never] ? unknown : {
  readonly [RuntimeCompatibilityErrorTypeId]: IncompatibleRuntime<Requirements, Events, Emits>
}

type SupervisionRequirements<Options> = Options extends {
  readonly supervision?: infer SupervisionOption
} ? SupervisionOption extends { readonly _tag: "Restart" } & ActorModule.Supervision<infer Requirements> ? Requirements
  : never
  : never

type SpawnRequirements<Requirements, Options = never> = Exclude<
  Requirements | SupervisionRequirements<Options>,
  Scope.Scope
>

type SpawnIdError<Options extends ActorModule.SpawnOptions> = "id" extends keyof Options ? Options extends {
    readonly id?: infer Id
  } ? [Id] extends [undefined] ? never : ActorModule.ActorChildAlreadyExistsError
  : ActorModule.ActorChildAlreadyExistsError
  : never

type SpawnSystemIdError<Options extends ActorModule.SpawnOptions> = "systemId" extends keyof Options ? Options extends {
    readonly systemId?: infer SystemId
  } ? [SystemId] extends [undefined] ? never : ActorModule.ActorSystemIdAlreadyExistsError
  : ActorModule.ActorSystemIdAlreadyExistsError
  : never

type SpawnError<Options extends ActorModule.SpawnOptions> = SpawnIdError<Options> | SpawnSystemIdError<Options>

type SpawnResult<State, Event, Error, Requirements, Output, SpawnError, Options = never, InitialError = never> =
  Effect.Effect<
    ActorModule.Actor<State, Event, Error | InitialError, Output>,
    SpawnError | InitialError,
    ActorRuntime | SpawnRequirements<Requirements, Options>
  >

/**
 * Namespace containing type-level members associated with `Machine`.
 *
 * @since 4.0.0
 */
export declare namespace Machine {
  /**
   * Any schema-first state machine.
   *
   * @category models
   * @since 4.0.0
   */
  export type Any = Machine<any, any, any, any, any, any, any, any, any, any, any>

  /**
   * A schema whose decoded value contains a `_tag` discriminator.
   *
   * **Details**
   *
   * This mirrors the tagged-schema constraint used by `Schema.toTaggedUnion`.
   *
   * @category models
   * @since 4.0.0
   */
  export type TaggedSchema = Schema.Top & { readonly Type: { readonly _tag: PropertyKey } }

  /**
   * Configuration accepted for a flat object state node.
   *
   * @category models
   * @since 4.0.0
   */
  export interface StateNodeConfig {
    readonly schema: TaggedSchema
    readonly type?: "active" | "final"
  }

  /**
   * Flat object state tree keyed by state path.
   *
   * @category models
   * @since 4.0.0
   */
  export type StateTree = Readonly<Record<string, TaggedSchema | StateNodeConfig>>

  /**
   * State schema definitions accepted by `make`.
   *
   * @category models
   * @since 4.0.0
   */
  export type StateSchemas = StateTree

  /**
   * Runtime metadata for a compiled state node.
   *
   * @category models
   * @since 4.0.0
   */
  export interface StateNode {
    readonly path: PropertyKey
    readonly tag: PropertyKey
    readonly schema: TaggedSchema
    readonly type: "active" | "final"
    readonly order: number
  }

  /**
   * Runtime lookup table for state nodes.
   *
   * @category models
   * @since 4.0.0
   */
  export interface StateNodes {
    readonly byPath: ReadonlyMap<PropertyKey, StateNode>
  }

  /**
   * Constructor arguments for a machine initial state function.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type InputArgs<Input extends Schema.Top> = Input extends typeof Schema.Void ? []
    : [input: Input["Type"]]

  /**
   * Extracts the discriminator value represented by a tagged schema.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type TagOf<S extends TaggedSchema> = S["Type"]["_tag"]

  /**
   * Extracts the schema from a state tree node definition.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type NodeSchema<Node> = Node extends TaggedSchema ? Node
    : Node extends { readonly schema: infer Schema extends TaggedSchema } ? Schema
    : never

  /**
   * Extracts the state path values represented by a state definition.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type StateIdentifier<States extends StateSchemas> = Extract<keyof States, string>

  /**
   * Extracts a schema from a state definition by state identifier.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type SchemaByIdentifier<
    States extends StateSchemas,
    StateId extends StateIdentifier<States>
  > = StateId extends keyof States ? NodeSchema<States[StateId]>
    : never

  /**
   * Extracts the union of state values represented by a state definition.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type StateOf<States extends StateSchemas> = StateIdentifier<States> extends infer StateId
    ? StateId extends StateIdentifier<States> ? SchemaByIdentifier<States, StateId>["Type"]
    : never
    : never

  /**
   * Extracts the union of event values represented by an event schema list.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type EventOf<Events extends ReadonlyArray<TaggedSchema>> = Events[number]["Type"]

  /**
   * Extracts the union of emitted event values represented by an emitted event
   * schema list.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type EmitOf<Emits extends ReadonlyArray<TaggedSchema>> = Emits[number]["Type"]

  /**
   * Runtime capability specialized to a machine's event protocols.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type RuntimeEffect<
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>
  > = Effect.Effect<
    Runtime<EventOf<Events>, EmitOf<Emits>>,
    never,
    Runtime.Requirement<EventOf<Events>, EmitOf<Emits>>
  >

  /**
   * Extracts a state value from a state definition by identifier.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type StateByIdentifier<
    States extends StateSchemas,
    StateId extends StateIdentifier<States>
  > = Extract<StateOf<States>, SchemaByIdentifier<States, StateId>["Type"]>

  /**
   * Atomic statechart snapshot carrying path identity separately from the
   * decoded state value.
   *
   * @category models
   * @since 4.0.0
   */
  export interface AtomicSnapshot<Path extends string, Value> {
    readonly path: Path
    readonly value: Value
  }

  /**
   * Extracts the snapshot value represented by a state definition by
   * identifier.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type SnapshotByIdentifier<
    States extends StateSchemas,
    StateId extends StateIdentifier<States>
  > = AtomicSnapshot<StateId, StateByIdentifier<States, StateId>>

  /**
   * Extracts the union of statechart snapshots represented by a state
   * definition.
   *
   * @category models
   * @since 4.0.0
   */
  export type Snapshot<States extends StateSchemas> = StateIdentifier<States> extends infer StateId
    ? StateId extends StateIdentifier<States> ? SnapshotByIdentifier<States, StateId>
    : never
    : never

  /**
   * State input accepted at runtime while raw decoded states remain supported at
   * machine boundaries.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type StateLike<States extends StateSchemas> = StateOf<States> | Snapshot<States>

  /**
   * Extracts state identifiers whose state-tree definition marks them final.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type FinalStateFromDefinition<States extends StateSchemas> =
    & {
      readonly [StateId in keyof States]: States[StateId] extends { readonly type: "final" } ? StateId : never
    }[keyof States]
    & StateIdentifier<States>

  /**
   * Extracts an event value from an event schema list by tag.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type EventByTag<
    Events extends ReadonlyArray<TaggedSchema>,
    Tag extends TagOf<Events[number]>
  > = Extract<EventOf<Events>, { readonly _tag: Tag }>

  /**
   * Machine-bound target instruction accepted from transition handlers.
   *
   * @category models
   * @since 4.0.0
   */
  export interface Target<
    States extends StateSchemas,
    StateId extends StateIdentifier<States>
  > {
    readonly [TargetTypeId]: typeof TargetTypeId
    readonly path: StateId
    readonly value: StateByIdentifier<States, StateId>
  }

  /**
   * Machine-bound target helper available in transition contexts.
   *
   * @category models
   * @since 4.0.0
   */
  export interface TargetFunction<States extends StateSchemas> {
    <const StateId extends StateIdentifier<States>>(
      path: StateId,
      value: StateByIdentifier<States, StateId>
    ): Target<States, StateId>
  }

  /**
   * Context passed to a state/event handler.
   *
   * @category models
   * @since 4.0.0
   */
  export interface HandlerContext<
    States extends StateSchemas,
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>,
    StateId extends StateIdentifier<States>,
    EventTag extends TagOf<Events[number]>,
    E,
    R
  > {
    readonly state: StateByIdentifier<States, StateId>
    readonly event: EventByTag<Events, EventTag>
    readonly runtime: RuntimeEffect<Events, Emits>
    readonly target: TargetFunction<States>
  }

  /**
   * Context passed to an entry or exit state handler.
   *
   * @category models
   * @since 4.0.0
   */
  export interface StateActionContext<
    States extends StateSchemas,
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>,
    StateId extends StateIdentifier<States>
  > {
    readonly state: StateByIdentifier<States, StateId>
    readonly event: EventOf<Events>
    readonly runtime: RuntimeEffect<Events, Emits>
  }

  /**
   * Context passed to an invoked child actor source.
   *
   * @category models
   * @since 4.0.0
   */
  export interface InvokeContext<
    States extends StateSchemas,
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>,
    StateId extends StateIdentifier<States>
  > {
    readonly state: StateByIdentifier<States, StateId>
    readonly event: EventOf<Events>
    readonly runtime: RuntimeEffect<Events, Emits>
  }

  /**
   * Context passed to an invoked child actor outcome mapper.
   *
   * @category models
   * @since 4.0.0
   */
  export interface InvokeEventContext<State, Error, Output> {
    readonly id: string
    readonly outcome: ActorModule.WatchEvent<State, Error, Output>
  }

  /**
   * Context passed to an invoked child actor active snapshot mapper.
   *
   * @category models
   * @since 4.0.0
   */
  export interface InvokeSnapshotContext<State, Error, Output> {
    readonly id: string
    readonly snapshot: Extract<ActorModule.Snapshot<State, Error, Output>, { readonly status: "active" }>
  }

  /**
   * Context passed to an eventless transition handler.
   *
   * @category models
   * @since 4.0.0
   */
  export interface AlwaysContext<
    States extends StateSchemas,
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>,
    StateId extends StateIdentifier<States>
  > {
    readonly state: StateByIdentifier<States, StateId>
    readonly event: EventOf<Events>
    readonly runtime: RuntimeEffect<Events, Emits>
    readonly target: TargetFunction<States>
  }

  /**
   * Context passed to a final state output function.
   *
   * @category models
   * @since 4.0.0
   */
  export interface FinalOutputContext<
    States extends StateSchemas,
    Events extends ReadonlyArray<TaggedSchema>,
    StateId extends StateIdentifier<States>
  > {
    readonly state: StateByIdentifier<States, StateId>
    readonly event: EventOf<Events>
  }

  /**
   * Return value accepted from entry and exit state actions.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type StateActionResult<E, R> = void | Effect.Effect<void, E, R>

  /**
   * Return value accepted from a machine initial state function.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type InitialResult<States extends StateSchemas, E, R> =
    | StateOf<States>
    | Effect.Effect<StateOf<States>, E, R>

  /**
   * Return value accepted from transition handlers.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type HandlerResult<States extends StateSchemas, E, R> =
    | StateOf<States>
    | Target<States, StateIdentifier<States>>
    | void
    | Effect.Effect<StateOf<States> | Target<States, StateIdentifier<States>> | void, E, R>

  /**
   * Extracts the union of handler return values from a handler map.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type HandlerEffect<Handlers> = Handlers[keyof Handlers]
  /**
   * Extracts the error type from a handler return value.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type HandlerError<Handlers> = Effect.Error<HandlerEffect<Handlers>>
  /**
   * Extracts the service requirements from a handler return value.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type HandlerServices<Handlers> = Effect.Services<HandlerEffect<Handlers>>
  /**
   * Extracts the return value from an initial state function.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type InitialReturn<Initial> = Initial extends (...args: any) => infer Ret ? Ret : never
  /**
   * Extracts the return value from an entry or exit action.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type StateActionReturn<Config, Key extends "entry" | "exit"> = Key extends keyof Config
    ? NonNullable<Config[Key]> extends (...args: any) => infer Ret ? Ret : never
    : never
  /**
   * Extracts the return value from an event transition config.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type EventTransitionReturn<Transition> = Transition extends (...args: any) => infer Ret ? Ret
    : Transition extends { readonly transition: (...args: any) => infer Ret } ? Ret
    : never
  /**
   * Extracts the return value from a state's event handlers.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type EventHandlerReturn<Config> = Config extends { readonly on?: infer On }
    ? { readonly [EventTag in keyof On]: EventTransitionReturn<NonNullable<On[EventTag]>> }[
      keyof On
    ]
    : never
  /**
   * Extracts the invoke config or configs from a state config.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type InvokeReturn<Config> = "invoke" extends keyof Config
    ? Config extends { readonly invoke?: infer Invoke }
      ? NonNullable<Invoke> extends ReadonlyArray<infer One> ? One : NonNullable<Invoke>
    : never
    : never
  /**
   * Extracts the actor logic returned by an invoke source.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type InvokeLogic<Invoke> = Invoke extends { readonly src: (...args: any) => infer Logic } ? Logic : never
  /**
   * Extracts the startup error from an invoke source actor logic.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type InvokeInitialError<Invoke> = InvokeLogic<Invoke> extends
    ActorModule.ActorLogic<any, any, any, any, any, infer InitialError> ? InitialError : never
  /**
   * Extracts the service requirements from an invoke source actor logic.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type InvokeServices<Invoke> = InvokeLogic<Invoke> extends
    ActorModule.ActorLogic<any, any, any, infer Requirements, any, any> ? Requirements : never
  /**
   * Extracts the parent transition error contribution from invoked children.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type InvokeError<Config> = [InvokeReturn<Config>] extends [never] ? never
    : ActorModule.ActorChildAlreadyExistsError | InvokeInitialError<InvokeReturn<Config>>
  /**
   * Extracts the parent service requirement contribution from invoked children.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type InvokeRequirements<Config> = [InvokeReturn<Config>] extends [never] ? never
    : ActorRuntime | InvokeServices<InvokeReturn<Config>>
  /**
   * Extracts the return value from an eventless transition.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type AlwaysReturn<Config> = Config extends { readonly always?: infer Always }
    ? NonNullable<Always> extends (...args: any) => infer Ret ? Ret : never
    : never
  /**
   * Extracts the return value from a final state output function.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type FinalOutputReturn<Config> = Config extends { readonly output?: infer Output }
    ? NonNullable<Output> extends (...args: any) => infer Ret ? Ret : never
    : never

  /**
   * Extracts all service requirements contributed by a state handler config.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type ConfigServices<Config> =
    | Effect.Services<EventHandlerReturn<Config>>
    | Effect.Services<AlwaysReturn<Config>>
    | Effect.Services<StateActionReturn<Config, "entry">>
    | Effect.Services<StateActionReturn<Config, "exit">>
    | InvokeRequirements<Config>

  /**
   * Resolves the tag of a state config when it is final.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type FinalStateFromConfig<Config, StateTag extends PropertyKey> = Config extends { readonly type: "final" }
    ? StateTag
    : never

  /**
   * Configuration for invoking a child actor while a state is active.
   *
   * @category models
   * @since 4.0.0
   */
  export interface InvokeConfig<
    States extends StateSchemas,
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>,
    StateId extends StateIdentifier<States>,
    Event,
    ChildState,
    ChildEvent,
    ChildError,
    ChildRequirements,
    ChildOutput,
    ChildInitialError
  > {
    readonly id: string
    src(
      context: InvokeContext<States, Events, Emits, StateId>
    ): ActorModule.ActorLogic<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, ChildInitialError>
    event?(
      context: InvokeEventContext<ChildState, ChildError | ChildInitialError, ChildOutput>
    ): Event | undefined
    snapshot?(
      context: InvokeSnapshotContext<ChildState, ChildError | ChildInitialError, ChildOutput>
    ): Event | undefined
  }

  /**
   * Configuration accepted for a non-final state.
   *
   * @category models
   * @since 4.0.0
   */
  export type ActiveStateConfig<
    States extends StateSchemas,
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>,
    StateId extends StateIdentifier<States>,
    E,
    R
  > = {
    readonly type?: "active"
    readonly entry?: (context: StateActionContext<States, Events, Emits, StateId>) => StateActionResult<any, any>
    readonly exit?: (context: StateActionContext<States, Events, Emits, StateId>) => StateActionResult<any, any>
    readonly invoke?:
      | InvokeConfig<States, Events, Emits, StateId, EventOf<Events>, any, any, any, any, any, any>
      | ReadonlyArray<InvokeConfig<States, Events, Emits, StateId, EventOf<Events>, any, any, any, any, any, any>>
    readonly always?: (context: AlwaysContext<States, Events, Emits, StateId>) => HandlerResult<States, any, any>
    readonly output?: never
    readonly on?: {
      readonly [EventTag in TagOf<Events[number]>]?:
        | ((
          context: HandlerContext<States, Events, Emits, StateId, EventTag, E, R>
        ) => HandlerResult<States, any, any>)
        | {
          readonly reenter?: boolean
          readonly transition: (
            context: HandlerContext<States, Events, Emits, StateId, EventTag, E, R>
          ) => HandlerResult<States, any, any>
        }
    }
  }

  /**
   * Configuration accepted for a final state.
   *
   * @category models
   * @since 4.0.0
   */
  export type FinalStateConfig<
    States extends StateSchemas,
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>,
    StateId extends StateIdentifier<States>
  > = {
    readonly type: "final"
    readonly entry?: (context: StateActionContext<States, Events, Emits, StateId>) => StateActionResult<any, any>
    readonly output?: (context: FinalOutputContext<States, Events, StateId>) => any
    readonly exit?: never
    readonly always?: never
    readonly on?: never
  }

  /**
   * Configuration accepted by `handle` for a state tag.
   *
   * @category models
   * @since 4.0.0
   */
  export type HandlerConfig<
    States extends StateSchemas,
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>,
    StateId extends StateIdentifier<States>,
    E,
    R
  > =
    | ActiveStateConfig<States, Events, Emits, StateId, E, R>
    | FinalStateConfig<States, Events, Emits, StateId>

  /**
   * Adds handlers for an unhandled state tag.
   *
   * @category combinators
   * @since 4.0.0
   */
  export interface Handler<
    States extends StateSchemas,
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>,
    Input extends Schema.Top,
    UnhandledStates extends StateIdentifier<States>,
    E,
    R,
    InitialE,
    InitialR,
    FinalStates extends StateIdentifier<States>,
    Output
  > {
    <
      const StateId extends UnhandledStates,
      const Config extends HandlerConfig<States, Events, Emits, StateId, E, R>
    >(
      stateTag: StateId,
      config: Config & EnsureCompatibleRuntime<ConfigServices<Config>, EventOf<Events>, EmitOf<Emits>>
    ): Machine<
      States,
      Events,
      Input,
      Exclude<UnhandledStates, StateId>,
      | E
      | Effect.Error<EventHandlerReturn<Config>>
      | Effect.Error<AlwaysReturn<Config>>
      | Effect.Error<StateActionReturn<Config, "entry">>
      | Effect.Error<StateActionReturn<Config, "exit">>
      | InvokeError<Config>,
      ExcludeCompatibleRuntime<R | ConfigServices<Config>, EventOf<Events>, EmitOf<Emits>>,
      InitialE,
      InitialR,
      FinalStates | FinalStateFromConfig<Config, StateId>,
      Output | FinalOutputReturn<Config>,
      Emits
    >
  }

  /**
   * Any state config.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type AnyStateConfig = StateConfig<any, any, any, any, any, any, any>

  /**
   * Runtime event-handler map stored for a single state tag.
   *
   * @category models
   * @since 4.0.0
   */
  export type EventHandlerMap<
    States extends StateSchemas,
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>,
    StateId extends StateIdentifier<States>,
    EventTag extends TagOf<Events[number]>,
    E,
    R
  > = Readonly<
    Record<
      PropertyKey,
      | ((context: HandlerContext<States, Events, Emits, StateId, EventTag, E, R>) => HandlerResult<States, E, R>)
      | {
        readonly reenter?: boolean
        readonly transition: (
          context: HandlerContext<States, Events, Emits, StateId, EventTag, E, R>
        ) => HandlerResult<States, E, R>
      }
    >
  >

  /**
   * Runtime state config stored for a single state tag.
   *
   * @category models
   * @since 4.0.0
   */
  export interface StateConfig<
    States extends StateSchemas,
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>,
    StateId extends StateIdentifier<States>,
    EventTag extends TagOf<Events[number]>,
    E,
    R
  > {
    readonly type?: "final" | "active"
    readonly entry?: (context: StateActionContext<States, Events, Emits, StateId>) => StateActionResult<E, R>
    readonly exit?: (context: StateActionContext<States, Events, Emits, StateId>) => StateActionResult<E, R>
    readonly invoke?:
      | InvokeConfig<States, Events, Emits, StateId, EventOf<Events>, any, any, any, any, any, any>
      | ReadonlyArray<InvokeConfig<States, Events, Emits, StateId, EventOf<Events>, any, any, any, any, any, any>>
    readonly always?: (context: AlwaysContext<States, Events, Emits, StateId>) => HandlerResult<States, E, R>
    readonly output?: (context: FinalOutputContext<States, Events, StateId>) => any
    readonly on?: EventHandlerMap<States, Events, Emits, StateId, EventTag, E, R>
  }

  /**
   * Runtime handler table stored on a machine.
   *
   * @category models
   * @since 4.0.0
   */
  export type StateConfigs<
    States extends StateSchemas,
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>,
    StateId extends StateIdentifier<States>,
    EventTag extends TagOf<Events[number]>,
    E,
    R
  > = Readonly<Record<PropertyKey, StateConfig<States, Events, Emits, StateId, EventTag, E, R>>>
}

const Proto = {
  ...PipeInspectableProto,
  [TypeId]: TypeId,
  handle(this: Machine.Any, stateTag: PropertyKey, config: Machine.AnyStateConfig) {
    return handleUnsafe(this, stateTag, config)
  },
  toJSON() {
    return {
      _id: "StateMachine"
    }
  }
}

const getSchemaTag = (schema: Machine.TaggedSchema): PropertyKey | undefined => {
  const tag = (schema as any).fields?._tag?.schema?.literal ?? (schema as any).fields?._tag?.ast?.literal
  return typeof tag === "string" || typeof tag === "number" || typeof tag === "symbol" ? tag : undefined
}

const getStateNodeDefinition = (
  path: string,
  definition: Machine.TaggedSchema | Machine.StateNodeConfig
): {
  readonly schema: Machine.TaggedSchema
  readonly type: "active" | "final"
} => {
  if (Schema.isSchema(definition)) {
    return { schema: definition as Machine.TaggedSchema, type: "active" }
  }
  if (
    hasProperty(definition, "states") || (hasProperty(definition, "type") && (definition as any).type === "parallel")
  ) {
    throw new Error(
      `StateMachine.make currently supports only flat object state trees; nested state "${path}" is not supported yet`
    )
  }
  if (!hasProperty(definition, "schema") || !Schema.isSchema(definition.schema)) {
    throw new Error(`StateMachine.make expected state "${path}" to be a tagged schema or state node config`)
  }
  return {
    schema: definition.schema as Machine.TaggedSchema,
    type: definition.type === "final" ? "final" : "active"
  }
}

const compileStateNodes = (states: Machine.StateSchemas): Machine.StateNodes => {
  const byPath = new Map<PropertyKey, Machine.StateNode>()
  let order = 0

  for (const path of Object.keys(states)) {
    const definition = getStateNodeDefinition(path, states[path])
    const tag = getSchemaTag(definition.schema) ?? path
    const node = {
      path,
      tag,
      schema: definition.schema,
      type: definition.type,
      order
    }
    byPath.set(path, node)
    order += 1
  }

  return {
    byPath
  }
}

const makeTarget: Machine.TargetFunction<any> = (
  path: PropertyKey,
  value: { readonly _tag: PropertyKey }
) =>
  ({
    [TargetTypeId]: TargetTypeId,
    path,
    value
  }) as any

const isTarget = (u: unknown): u is Machine.Target<any, any> => hasProperty(u, TargetTypeId)

const isSnapshot = (u: unknown): u is Machine.AtomicSnapshot<string, unknown> =>
  hasProperty(u, "path") && hasProperty(u, "value")

const isSnapshotFor = (
  machine: Machine.Any,
  u: unknown
): u is Machine.AtomicSnapshot<string, { readonly _tag: PropertyKey }> => {
  if (!isSnapshot(u)) {
    return false
  }
  const node = machine.stateNodes.byPath.get(u.path)
  return node !== undefined && Schema.is(node.schema)(u.value)
}

const findStateNode = (
  machine: Machine.Any,
  value: { readonly _tag: PropertyKey }
): Machine.StateNode | undefined => {
  for (const node of machine.stateNodes.byPath.values()) {
    if (Schema.is(node.schema)(value)) {
      return node
    }
  }
  return machine.stateNodes.byPath.get(value._tag)
}

const makeSnapshot = <const States extends Machine.StateSchemas>(
  machine: Machine.Any,
  value: Machine.StateOf<States>,
  path?: PropertyKey
): Machine.Snapshot<States> => {
  const node = path === undefined ? findStateNode(machine, value) : machine.stateNodes.byPath.get(path)
  return {
    path: (node?.path ?? path ?? value._tag) as Machine.StateIdentifier<States>,
    value
  } as Machine.Snapshot<States>
}

const normalizeState = <const States extends Machine.StateSchemas>(
  machine: Machine.Any,
  state: Machine.StateLike<States>
): Machine.Snapshot<States> =>
  isSnapshotFor(machine, state)
    ? state as Machine.Snapshot<States>
    : makeSnapshot<States>(machine, state)

const normalizeTarget = <const States extends Machine.StateSchemas>(
  machine: Machine.Any,
  target: Machine.StateOf<States> | Machine.Target<States, Machine.StateIdentifier<States>>
): Machine.Snapshot<States> => {
  if (isTarget(target)) {
    return makeSnapshot<States>(machine, target.value as Machine.StateOf<States>, target.path)
  }
  return makeSnapshot<States>(machine, target as Machine.StateOf<States>)
}

const getStateIdentifier = (
  machine: Machine.Any,
  state: Machine.StateLike<any>
): PropertyKey => isSnapshotFor(machine, state) ? state.path : findStateNode(machine, state)?.path ?? state._tag

const getStateConfig = (
  machine: Machine.Any,
  state: Machine.StateLike<any>
): Machine.AnyStateConfig | undefined => machine.handlers[getStateIdentifier(machine, state)]

const handleUnsafe = (
  self: Machine.Any,
  stateTag: PropertyKey,
  config: Machine.AnyStateConfig
): Machine.Any => {
  const machine = Object.create(Proto)
  machine.states = self.states
  machine.events = self.events
  machine.emits = self.emits
  machine.input = self.input
  machine.id = self.id
  machine.initial = self.initial
  machine.stateNodes = self.stateNodes
  machine.handlers = {
    ...self.handlers,
    [stateTag]: config
  }
  return machine
}

const makeDeferredQueue = <A>(): Effect.Effect<DeferredQueue<A>> =>
  Effect.sync(() => {
    const values: Array<A> = []
    return {
      read: Effect.sync(() => values),
      add: (value) =>
        Effect.sync(() => {
          values.push(value)
        })
    }
  })

const makeDeferredActions = Effect.map(
  makeDeferredQueue<DeferredAction>(),
  (queue) =>
    DeferredActions.of({
      read: queue.read,
      add: (effect) => queue.add(effect)
    })
)

const makeDeferredRaisedEvents = Effect.map(
  makeDeferredQueue<any>(),
  (queue) =>
    DeferredRaisedEvents.of({
      read: queue.read,
      add: (event) => queue.add(event)
    })
)

const provideDeferredServices = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  deferredActions: DeferredActions["Service"],
  deferredRaisedEvents: DeferredRaisedEvents["Service"]
): Effect.Effect<A, E, R> =>
  effect.pipe(
    Effect.provideService(DeferredActions, deferredActions),
    Effect.provideService(DeferredRaisedEvents, deferredRaisedEvents),
    Effect.provideService(RuntimeContext, makePlanningRuntime(deferredRaisedEvents))
  )

const provideActorRuntime = <A, E, R, Event>(
  effect: Effect.Effect<A, E, R>,
  scope: ActorModule.ActorScope<Event>
): Effect.Effect<A, E, Exclude<R, ActorRuntime>> =>
  Effect.provideService(effect, ActorRuntime, scope as ActorModule.ActorScope<any>)

const provideRuntimeContext = <A, E, R, Events, Emits>(
  effect: Effect.Effect<A, E, R>,
  runtime: Runtime<Events, Emits>
): Effect.Effect<A, E, R> =>
  Effect.provideService(
    effect as Effect.Effect<A, E, R | RuntimeContext>,
    RuntimeContext,
    runtime as Runtime<any, any>
  ) as Effect.Effect<A, E, R>

const sendParentOptional = <Event>(event: Event): Effect.Effect<void> =>
  Effect.contextWith((context: Context.Context<never>) => {
    const runtime = Context.getOption(context as Context.Context<ActorRuntime>, ActorRuntime)
    return Option.isSome(runtime) && runtime.value.parent !== undefined
      ? runtime.value.parent.send(event)
      : Effect.void
  })

const makePlanningRuntime = <Events, Emits>(
  deferredRaisedEvents: DeferredRaisedEvents["Service"]
): Runtime<Events, Emits> =>
  RuntimeContext.of({
    raise: (event) => deferredRaisedEvents.add(event),
    sendParent: sendParentOptional
  })

const makeActorRuntime = <Events, Emits>(
  scope: ActorModule.ActorScope<Events>
): Runtime<Events, Emits> =>
  RuntimeContext.of({
    raise: (event) => scope.self.send(event),
    sendParent: (event) => scope.parent === undefined ? Effect.void : scope.parent.send(event)
  })

const runActions = <E, R, Events, Emits>(
  actions: Iterable<Effect.Effect<void, E, R>>,
  runtime: Runtime<Events, Emits>
): Effect.Effect<void, E, R> =>
  Effect.all(
    Array.from(actions, (action) => provideRuntimeContext(action, runtime)),
    { discard: true }
  )

const runtimeFor = <Events, Emits>(): Effect.Effect<
  Runtime<Events, Emits>,
  never,
  Runtime.Requirement<Events, Emits>
> => runtime<{ readonly events: Events; readonly emits: Emits }>()

const runStateAction = <Context, E, R>(
  handler: ((context: Context) => Machine.StateActionResult<E, R>) | undefined,
  context: Context,
  deferredActions: DeferredActions["Service"],
  deferredRaisedEvents: DeferredRaisedEvents["Service"]
): Effect.Effect<void, E, R> => {
  if (handler === undefined) {
    return Effect.void
  }

  const result = handler(context)
  return Effect.isEffect(result)
    ? provideDeferredServices(result, deferredActions, deferredRaisedEvents)
    : Effect.void
}

type MicrostepPlan<State, Event, E, R> = {
  readonly next: State
  readonly actions: ReadonlyArray<Effect.Effect<void, E, R>>
  readonly raisedEvents: ReadonlyArray<Event>
  readonly changed: boolean
}

type MacrostepPlan<State, Event, E, R, Output> = {
  readonly next: State
  readonly actions: ReadonlyArray<Effect.Effect<void, E, R>>
  readonly microsteps: ReadonlyArray<MicrostepPlan<State, Event, E, R>>
  readonly output: Output | undefined
}

type TransitionHandler<States extends Machine.StateSchemas, E, R, Context> = (
  context: Context
) => Machine.HandlerResult<States, E, R>

type EventTransition<States extends Machine.StateSchemas, E, R, Context> =
  | TransitionHandler<States, E, R, Context>
  | {
    readonly reenter?: boolean
    readonly transition: TransitionHandler<States, E, R, Context>
  }

type MicrostepTransition<States extends Machine.StateSchemas, E, R, Context> = {
  readonly reenter: boolean
  readonly transition: TransitionHandler<States, E, R, Context>
}

type AnyInvokeConfig = Machine.InvokeConfig<any, any, any, any, any, any, any, any, any, any, any>

interface InvokeSession {
  readonly token: symbol
  readonly scope: Scope.Closeable
}

const normalizeEventTransition = <States extends Machine.StateSchemas, E, R, Context>(
  transition: EventTransition<States, E, R, Context> | undefined
): MicrostepTransition<States, E, R, Context> | undefined => {
  if (transition === undefined) {
    return undefined
  }
  return typeof transition === "function"
    ? { reenter: false, transition }
    : { reenter: transition.reenter === true, transition: transition.transition }
}

const getInvokes = (config: Machine.AnyStateConfig | undefined): ReadonlyArray<AnyInvokeConfig> => {
  const invokes = config?.invoke
  if (invokes === undefined) {
    return []
  }
  return Array.isArray(invokes) ? invokes as ReadonlyArray<AnyInvokeConfig> : [invokes as AnyInvokeConfig]
}

const collectStateAction = Effect.fnUntraced(function*<Context, Event, E, R>(
  handler: ((context: Context) => Machine.StateActionResult<E, R>) | undefined,
  context: Context
) {
  const deferredActions = yield* makeDeferredActions
  const deferredRaisedEvents = yield* makeDeferredRaisedEvents
  yield* runStateAction(handler, context, deferredActions, deferredRaisedEvents)
  const actions = yield* deferredActions.read
  const raisedEvents = yield* deferredRaisedEvents.read
  return {
    actions: actions as ReadonlyArray<DeferredAction<E, R>>,
    raisedEvents: raisedEvents as ReadonlyArray<Event>
  }
})

const collectTransition = Effect.fnUntraced(function*<
  const States extends Machine.StateSchemas,
  Event,
  E,
  R,
  Context
>(
  transition: TransitionHandler<States, E, R, Context>,
  context: Context
) {
  const deferredActions = yield* makeDeferredActions
  const deferredRaisedEvents = yield* makeDeferredRaisedEvents
  const result = transition(context)
  const state = Effect.isEffect(result)
    ? yield* provideDeferredServices(result, deferredActions, deferredRaisedEvents)
    : result
  const actions = yield* deferredActions.read
  const raisedEvents = yield* deferredRaisedEvents.read
  return {
    state,
    actions: actions as ReadonlyArray<DeferredAction<E, R>>,
    raisedEvents: raisedEvents as ReadonlyArray<Event>
  }
})

const MaxMacrostepIterations = 1000
const InitialEventTypeId: unique symbol = Symbol("effect/StateMachine/InitialEvent")
const InitialEvent = { _tag: InitialEventTypeId }

const catchStartup = <A>(
  effect: Effect.Effect<A, unknown, unknown>
): Effect.Effect<A, StartupError> =>
  Effect.catchCause(effect as Effect.Effect<A, unknown, never>, (cause) => Effect.fail(new StartupError({ cause })))

/**
 * Returns `true` if a value is a `StateMachine`.
 *
 * @category guards
 * @since 4.0.0
 */
export const isMachine = (
  u: unknown
): u is Machine.Any => hasProperty(u, TypeId)

const isFinalState = (
  machine: Machine.Any,
  state: Machine.StateLike<any>
): boolean => {
  const stateIdentifier = getStateIdentifier(machine, state)
  return machine.stateNodes.byPath.get(stateIdentifier)?.type === "final" ||
    machine.handlers[stateIdentifier]?.type === "final"
}

const getFinalOutput = <
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  StateId extends Machine.StateIdentifier<States>,
  Output
>(
  machine: Machine.Any,
  state: Machine.SnapshotByIdentifier<States, StateId>,
  event: Machine.EventOf<Events>
): Output | undefined => getStateConfig(machine, state)?.output?.({ state: state.value, event }) as Output | undefined

/**
 * Returns `true` if a state is final for a state machine.
 *
 * @category guards
 * @since 4.0.0
 */
export const isFinal = <
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.StateIdentifier<States> = Machine.StateIdentifier<States>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.StateIdentifier<States> = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates>,
  state: Machine.StateLike<States>
): state is Extract<
  Machine.StateLike<States>,
  Machine.StateByIdentifier<States, FinalStates> | Machine.SnapshotByIdentifier<States, FinalStates>
> => isFinalState(machine, state)

/**
 * Creates a schema-first state machine definition.
 *
 * @category constructors
 * @since 4.0.0
 */
export const make = <
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema> = [],
  const Input extends Schema.Top = typeof Schema.Void,
  InitialE = never,
  InitialR = never
>(
  config: {
    readonly id?: string
    readonly states: States
    readonly events: Events
    readonly emits?: Emits
    readonly input?: Input
    readonly initial: (...args: [...Machine.InputArgs<Input>]) => Machine.InitialResult<States, InitialE, InitialR>
  }
): Machine<
  States,
  Events,
  Input,
  Machine.StateIdentifier<States>,
  never,
  never,
  InitialE,
  InitialR,
  Machine.FinalStateFromDefinition<States>,
  never,
  Emits
> => {
  const self = Object.create(Proto)
  self.states = config.states
  self.events = config.events
  self.emits = config.emits ?? []
  self.input = config.input
  self.id = config.id
  self.initial = config.initial
  self.stateNodes = compileStateNodes(config.states)
  self.handlers = {}
  return self
}

/**
 * Creates an invoked child actor configuration for an active state.
 *
 * **When to use**
 *
 * Use to run a child actor while a state machine remains in a state and map the
 * child's active snapshots or terminal lifecycle outcome back into state
 * machine events.
 *
 * **Gotchas**
 *
 * Invoked child actors run when the state machine runs through the actor
 * runtime with `start` or `toActorLogic`.
 *
 * @category constructors
 * @since 4.0.0
 */
export const invoke = <
  ChildState,
  ChildEvent,
  ChildError = never,
  ChildRequirements = never,
  ChildOutput = never,
  ChildInitialError = never,
  Event = never,
  Id extends string = string
>(
  config: {
    readonly id: Id
    readonly src: (
      context: Machine.InvokeContext<any, any, any, any>
    ) => ActorModule.ActorLogic<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, ChildInitialError>
    readonly event?: (
      context: Machine.InvokeEventContext<ChildState, ChildError | ChildInitialError, ChildOutput>
    ) => Event | undefined
    readonly snapshot?: (
      context: Machine.InvokeSnapshotContext<ChildState, ChildError | ChildInitialError, ChildOutput>
    ) => Event | undefined
  } & ActorModule.ChildAddress.Compatibility<Id, ChildEvent>
): Machine.InvokeConfig<
  any,
  any,
  any,
  any,
  Event,
  ChildState,
  ChildEvent,
  ChildError,
  ChildRequirements,
  ChildOutput,
  ChildInitialError
> => config

/**
 * Plans the initial state for a state machine without running deferred actions.
 *
 * @category constructors
 * @since 4.0.0
 */
export const planInitial: <
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.StateIdentifier<States> = Machine.StateIdentifier<States>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.StateIdentifier<States> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output, Emits>,
  ...args: [...Machine.InputArgs<Input>]
) => Effect.Effect<
  {
    readonly state: Machine.Snapshot<States>
    readonly actions: ReadonlyArray<Effect.Effect<void, InitialE | StartupError, InitialR>>
    readonly output: Output | undefined
  },
  InitialE | StartupError,
  never
> = Effect.fnUntraced(function*<
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.StateIdentifier<States> = Machine.StateIdentifier<States>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.StateIdentifier<States> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output, Emits>,
  ...args: [...Machine.InputArgs<Input>]
) {
  const deferredActions = yield* makeDeferredActions
  const result = machine.initial(...args)
  const state = Effect.isEffect(result)
    ? yield* (result.pipe(Effect.provideService(DeferredActions, deferredActions)) as Effect.Effect<
      Machine.StateOf<States>
    >)
    : result
  const snapshot = normalizeState<States>(machine, state)
  const actions = yield* deferredActions.read
  const settled = yield* catchStartup(Effect.gen(function*() {
    const entry = yield* collectStateAction(
      getStateConfig(machine, snapshot)?.entry,
      {
        state: snapshot.value as Machine.StateByIdentifier<States, UnhandledStates>,
        event: InitialEvent as Machine.EventOf<Events>,
        runtime: runtimeFor<Machine.EventOf<Events>, Machine.EmitOf<Emits>>()
      }
    )
    return yield* (settle(
      machine,
      snapshot,
      InitialEvent as Machine.EventOf<Events>,
      [...entry.actions] as Array<Effect.Effect<void, never, never>>,
      [...entry.raisedEvents] as Array<Machine.EventOf<Events>>,
      []
    ) as Effect.Effect<MacrostepPlan<Machine.Snapshot<States>, Machine.EventOf<Events>, never, never, Output>>)
  }))

  return {
    state: settled.next,
    actions: [
      ...actions,
      ...settled.actions.map((action) => catchStartup(action))
    ] as ReadonlyArray<Effect.Effect<void, InitialE | StartupError, InitialR>>,
    output: settled.output
  }
})

/**
 * Returns the event tags handled by the current state.
 *
 * @category getters
 * @since 4.0.0
 */
export const enabled = <
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.StateIdentifier<States> = Machine.StateIdentifier<States>,
  E = never,
  R = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R>,
  state: Machine.StateLike<States>
): ReadonlyArray<Machine.TagOf<Events[number]>> =>
  isFinalState(machine, state)
    ? []
    : Reflect.ownKeys(getStateConfig(machine, state)?.on ?? {}) as Array<Machine.TagOf<Events[number]>>

const microstep: <
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.StateIdentifier<States> = Machine.StateIdentifier<States>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.StateIdentifier<States> = never,
  Output = never,
  Context = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output, Emits>,
  state: Machine.Snapshot<States>,
  event: Machine.EventOf<Events>,
  transition: MicrostepTransition<States, E, R, Context> | undefined,
  context: Context
) => Effect.Effect<
  MicrostepPlan<Machine.Snapshot<States>, Machine.EventOf<Events>, E, R>,
  E | UnhandledEventError,
  R
> = Effect.fnUntraced(function*<
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.StateIdentifier<States> = Machine.StateIdentifier<States>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.StateIdentifier<States> = never,
  Output = never,
  Context = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output, Emits>,
  state: Machine.Snapshot<States>,
  event: Machine.EventOf<Events>,
  transition: MicrostepTransition<States, E, R, Context> | undefined,
  context: Context
) {
  const stateIdentifier = state.path
  const stateConfig = machine.handlers[stateIdentifier]

  if (transition === undefined) {
    return yield* new UnhandledEventError({
      machineId: machine.id,
      state: String(stateIdentifier),
      event: String(event._tag)
    })
  }

  const transitionResult = yield* collectTransition<States, Machine.EventOf<Events>, E, R, Context>(
    transition.transition,
    context
  )
  const target = transitionResult.state === undefined ? undefined : transitionResult.state
  const stateAfterTransition = target === undefined ? state : normalizeTarget<States>(machine, target)
  const targetIdentifier = stateAfterTransition.path
  if (targetIdentifier === stateIdentifier && !transition.reenter) {
    return {
      next: stateAfterTransition,
      actions: transitionResult.actions,
      raisedEvents: transitionResult.raisedEvents,
      changed: false
    }
  }

  const exit = yield* collectStateAction<
    Machine.StateActionContext<States, Events, Emits, UnhandledStates>,
    Machine.EventOf<
      Events
    >,
    E,
    R
  >(
    stateConfig?.exit,
    {
      state: state.value as Machine.StateByIdentifier<States, UnhandledStates>,
      event,
      runtime: runtimeFor<Machine.EventOf<Events>, Machine.EmitOf<Emits>>()
    }
  )

  const entry = yield* collectStateAction<
    Machine.StateActionContext<States, Events, Emits, UnhandledStates>,
    Machine.EventOf<
      Events
    >,
    E,
    R
  >(
    machine.handlers[targetIdentifier]?.entry,
    {
      state: stateAfterTransition.value as Machine.StateByIdentifier<States, UnhandledStates>,
      event,
      runtime: runtimeFor<Machine.EventOf<Events>, Machine.EmitOf<Emits>>()
    }
  )

  return {
    next: stateAfterTransition,
    actions: [...exit.actions, ...transitionResult.actions, ...entry.actions] as ReadonlyArray<
      Effect.Effect<void, E, R>
    >,
    raisedEvents: [...exit.raisedEvents, ...transitionResult.raisedEvents, ...entry.raisedEvents] as ReadonlyArray<
      Machine.EventOf<Events>
    >,
    changed: true
  }
})

const settle: <
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.StateIdentifier<States> = Machine.StateIdentifier<States>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.StateIdentifier<States> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output, Emits>,
  state: Machine.Snapshot<States>,
  event: Machine.EventOf<Events>,
  actions: Array<Effect.Effect<void, E, R>>,
  raisedEvents: Array<Machine.EventOf<Events>>,
  microsteps: Array<MicrostepPlan<Machine.Snapshot<States>, Machine.EventOf<Events>, E, R>>
) => Effect.Effect<
  MacrostepPlan<Machine.Snapshot<States>, Machine.EventOf<Events>, E, R, Output>,
  E | UnhandledEventError | InfiniteTransitionError,
  R
> = Effect.fnUntraced(function*<
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.StateIdentifier<States> = Machine.StateIdentifier<States>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.StateIdentifier<States> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output, Emits>,
  state: Machine.Snapshot<States>,
  event: Machine.EventOf<Events>,
  actions: Array<Effect.Effect<void, E, R>>,
  raisedEvents: Array<Machine.EventOf<Events>>,
  microsteps: Array<MicrostepPlan<Machine.Snapshot<States>, Machine.EventOf<Events>, E, R>>
) {
  let currentState = state
  let currentEvent = event
  let shouldRunAlways = true
  let iterations = 0
  let raisedEventIndex = 0
  let finalOutput: Output | undefined = undefined

  while (true) {
    if (isFinalState(machine, currentState)) {
      finalOutput = getFinalOutput<States, Events, Machine.StateIdentifier<States>, Output>(
        machine,
        currentState as Machine.SnapshotByIdentifier<States, Machine.StateIdentifier<States>>,
        currentEvent
      )
      break
    }

    iterations += 1
    if (iterations > MaxMacrostepIterations) {
      return yield* new InfiniteTransitionError({
        machineId: machine.id,
        state: String(currentState.path),
        maxIterations: MaxMacrostepIterations
      })
    }

    const always = shouldRunAlways
      ? machine.handlers[currentState.path]?.always
      : undefined
    if (always !== undefined) {
      const alwaysStep: MicrostepPlan<Machine.Snapshot<States>, Machine.EventOf<Events>, E, R> = yield* microstep(
        machine,
        currentState,
        currentEvent,
        { reenter: false, transition: always },
        {
          state: currentState.value as Machine.StateByIdentifier<States, UnhandledStates>,
          event: currentEvent,
          runtime: runtimeFor<Machine.EventOf<Events>, Machine.EmitOf<Emits>>(),
          target: makeTarget
        }
      )
      actions.push(...alwaysStep.actions)
      raisedEvents.push(...alwaysStep.raisedEvents)
      microsteps.push(alwaysStep)
      currentState = alwaysStep.next
      shouldRunAlways = alwaysStep.changed
      continue
    }

    const raisedEvent = raisedEvents[raisedEventIndex]
    if (raisedEvent === undefined) {
      break
    }
    raisedEventIndex += 1

    currentEvent = raisedEvent
    const raisedStateConfig = machine.handlers[currentState.path]
    const raisedStep = yield* microstep(
      machine,
      currentState,
      raisedEvent,
      normalizeEventTransition(raisedStateConfig?.on?.[raisedEvent._tag]),
      {
        state: currentState.value as Machine.StateByIdentifier<States, UnhandledStates>,
        event: raisedEvent as Machine.EventByTag<Events, Machine.TagOf<Events[number]>>,
        runtime: runtimeFor<Machine.EventOf<Events>, Machine.EmitOf<Emits>>(),
        target: makeTarget
      }
    )
    actions.push(...raisedStep.actions)
    raisedEvents.push(...raisedStep.raisedEvents)
    microsteps.push(raisedStep)
    currentState = raisedStep.next
    shouldRunAlways = true
  }

  return {
    next: currentState,
    actions,
    microsteps,
    output: finalOutput
  }
})

const macrostep: <
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.StateIdentifier<States> = Machine.StateIdentifier<States>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.StateIdentifier<States> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output, Emits>,
  state: Machine.StateLike<States>,
  event: Machine.EventOf<Events>
) => Effect.Effect<
  MacrostepPlan<Machine.Snapshot<States>, Machine.EventOf<Events>, E, R, Output>,
  E | UnhandledEventError | InfiniteTransitionError,
  R
> = Effect.fnUntraced(function*<
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.StateIdentifier<States> = Machine.StateIdentifier<States>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.StateIdentifier<States> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output, Emits>,
  state: Machine.StateLike<States>,
  event: Machine.EventOf<Events>
) {
  const snapshot = normalizeState<States>(machine, state)
  if (isFinalState(machine, snapshot)) {
    return {
      next: snapshot,
      actions: [],
      microsteps: [],
      output: undefined
    }
  }

  const stateConfig = getStateConfig(machine, snapshot)
  const step = yield* microstep(
    machine,
    snapshot,
    event,
    normalizeEventTransition(stateConfig?.on?.[event._tag]),
    {
      state: snapshot.value as Machine.StateByIdentifier<States, UnhandledStates>,
      event: event as Machine.EventByTag<Events, Machine.TagOf<Events[number]>>,
      runtime: runtimeFor<Machine.EventOf<Events>, Machine.EmitOf<Emits>>(),
      target: makeTarget
    }
  )
  const actions = [...step.actions]
  const raisedEvents = [...step.raisedEvents]
  const microsteps = [step]
  return yield* settle(machine, step.next, event, actions, raisedEvents, microsteps)
})

/**
 * Plans the next state for a state machine without running deferred actions.
 *
 * @category combinators
 * @since 4.0.0
 */
export const plan = macrostep

const actionUnsafe = Effect.fnUntraced(function*<E, R>(
  effect: Effect.Effect<void, E, R>
) {
  const actions = yield* DeferredActions
  yield* actions.add(effect)
})

/**
 * Defers an effectful action until the current state machine step is planned.
 *
 * @category combinators
 * @since 4.0.0
 */
export const action = <E, R>(
  effect: Effect.Effect<void, E, R>
): Effect.Effect<void, E, R> => actionUnsafe(effect) as unknown as Effect.Effect<void, E, R>

/**
 * Returns the typed runtime capability for the current state machine.
 *
 * @category combinators
 * @since 4.0.0
 */
export const runtime = <const Protocol extends Runtime.Protocol = {}>(): Effect.Effect<
  Runtime<Runtime.Events<Protocol>, Runtime.Emits<Protocol>>,
  never,
  Runtime.Requirement<Runtime.Events<Protocol>, Runtime.Emits<Protocol>>
> =>
  RuntimeContext as unknown as Effect.Effect<
    Runtime<Runtime.Events<Protocol>, Runtime.Emits<Protocol>>,
    never,
    Runtime.Requirement<Runtime.Events<Protocol>, Runtime.Emits<Protocol>>
  >

/**
 * Returns the current actor runtime scope when a state machine is running as
 * actor logic.
 *
 * @category actor runtime
 * @since 4.0.0
 */
export const actorRuntime = <Event = unknown>(): Effect.Effect<
  ActorModule.ActorScope<Event>,
  never,
  ActorRuntime
> => Effect.map(ActorRuntime, (runtime) => runtime as ActorModule.ActorScope<Event>)

/**
 * Creates a typed parent-local address for a child actor.
 *
 * @category actor runtime
 * @since 4.0.0
 */
export const child = <Event>(id: string): ActorModule.ChildAddress<Event> => ActorModule.child<Event>(id)

/**
 * Returns a reference to the actor currently hosting this state machine.
 *
 * @category actor runtime
 * @since 4.0.0
 */
export const self = <Event = unknown>(): Effect.Effect<ActorModule.ActorRef<Event>, never, ActorRuntime> =>
  Effect.map(actorRuntime<Event>(), (runtime) => runtime.self)

/**
 * Returns a reference to the parent actor when the hosting actor has one.
 *
 * @category actor runtime
 * @since 4.0.0
 */
export const parent: Effect.Effect<ActorModule.ActorRef<unknown> | undefined, never, ActorRuntime> = Effect.map(
  ActorRuntime,
  (runtime) => runtime.parent
)

/**
 * Returns the actor system that owns the hosting actor.
 *
 * @category actor runtime
 * @since 4.0.0
 */
export const system: Effect.Effect<ActorModule.ActorSystem, never, ActorRuntime> = Effect.map(
  ActorRuntime,
  (runtime) => runtime.system
)

/**
 * Spawns a child actor owned by the actor currently hosting this state machine.
 *
 * **When to use**
 *
 * Use to create child actors from state machine actions when the child should
 * be addressed or stopped by the hosting actor instead of being tied to a
 * single state's `invoke` lifecycle.
 *
 * **Gotchas**
 *
 * This effect requires `ActorRuntime`, so it only runs when the state machine
 * is running as actor logic. A named child id must be unique for the current
 * parent actor until that child stops.
 *
 * @see {@link invoke} for children that start and stop with a state.
 * @see {@link sendTo} for sending events to named children.
 * @category actor runtime
 * @since 4.0.0
 */
export const spawn: {
  <ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, ChildInitialError = never>(
    logic: ActorModule.ActorLogic<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, ChildInitialError>
  ): SpawnResult<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, never, never, ChildInitialError>
  <
    ChildState,
    ChildEvent,
    ChildError,
    ChildRequirements,
    ChildOutput,
    Options extends ActorModule.SpawnOptions,
    ChildInitialError = never
  >(
    logic: ActorModule.ActorLogic<
      ChildState,
      ChildEvent,
      ChildError,
      ChildRequirements,
      ChildOutput,
      ChildInitialError
    >,
    options: Options & ActorModule.ChildAddress.OptionsCompatibility<Options, ChildEvent>
  ): SpawnResult<
    ChildState,
    ChildEvent,
    ChildError,
    ChildRequirements,
    ChildOutput,
    SpawnError<Options>,
    Options,
    ChildInitialError
  >
} = ((
  logic: ActorModule.ActorLogic<any, any, any, any, any, any>,
  options?: ActorModule.SpawnOptions<any>
) =>
  Effect.flatMap(
    ActorRuntime,
    (runtime) => options === undefined ? runtime.spawn(logic) : (runtime.spawn as any)(logic, options)
  )) as any

/**
 * Sends an event to a named child actor of the hosting actor.
 *
 * @category actor runtime
 * @since 4.0.0
 */
export const sendTo = <Address extends string>(
  id: Address,
  event: ActorModule.ChildAddress.Event<Address>
): Effect.Effect<void, never, ActorRuntime> => Effect.flatMap(ActorRuntime, (runtime) => runtime.sendTo(id, event))

/**
 * Stops a named child actor of the hosting actor.
 *
 * @category actor runtime
 * @since 4.0.0
 */
export const stopChild = (id: string): Effect.Effect<void, never, ActorRuntime> =>
  Effect.flatMap(ActorRuntime, (runtime) => runtime.stopChild(id))

/**
 * Converts a state machine definition into actor logic that can be started by
 * the actor runtime.
 *
 * @category constructors
 * @since 4.0.0
 */
export const toActorLogic: <
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.StateIdentifier<States> = Machine.StateIdentifier<States>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.StateIdentifier<States> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output, Emits>,
  ...args: [...Machine.InputArgs<Input>]
) => ActorModule.ActorLogic<
  Machine.Snapshot<States>,
  Machine.EventOf<Events>,
  E | UnhandledEventError | InfiniteTransitionError,
  ExcludeCompatibleRuntime<Exclude<InitialR | R, ActorRuntime>, Machine.EventOf<Events>, Machine.EmitOf<Emits>>,
  Output | undefined,
  InitialE | StartupError
> = <
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.StateIdentifier<States> = Machine.StateIdentifier<States>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.StateIdentifier<States> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output, Emits>,
  ...args: [...Machine.InputArgs<Input>]
) =>
  ActorModule.make({
    initial: (scope) =>
      provideActorRuntime(
        Effect.gen(function*() {
          const planned = yield* planInitial(machine, ...args)
          yield* runActions(planned.actions, makeActorRuntime<Machine.EventOf<Events>, Machine.EmitOf<Emits>>(scope))
          return planned.state
        }),
        scope
      ),
    run: (context) =>
      provideActorRuntime(
        Effect.gen(function*() {
          const { receive, state, setState } = context
          let done = false
          let output: Output | undefined = undefined

          const initialState = yield* state
          if (isFinalState(machine, initialState)) {
            return getFinalOutput<States, Events, Machine.StateIdentifier<States>, Output>(
              machine,
              initialState as Machine.SnapshotByIdentifier<States, Machine.StateIdentifier<States>>,
              InitialEvent as Machine.EventOf<Events>
            )
          }

          const invokeSessions = yield* Ref.make<HashMap.HashMap<string, InvokeSession>>(HashMap.empty())
          const isCurrentInvoke = (id: string, token: symbol): Effect.Effect<boolean> =>
            Ref.get(invokeSessions).pipe(
              Effect.map((sessions) => {
                const current = HashMap.get(sessions, id)
                return Option.isSome(current) && current.value.token === token
              })
            )
          const stopInvoke = (id: string, exit: Exit.Exit<unknown, unknown>): Effect.Effect<void> =>
            Ref.modify(invokeSessions, (sessions) => {
              const current = HashMap.get(sessions, id)
              return Option.isSome(current)
                ? [current.value, HashMap.remove(sessions, id)] as const
                : [undefined, sessions] as const
            }).pipe(
              Effect.flatMap((session) =>
                session === undefined
                  ? Effect.void
                  : Scope.close(session.scope, exit).pipe(
                    Effect.andThen(context.stopChild(id))
                  )
              )
            )
          const clearInvoke = (id: string, token: symbol, exit: Exit.Exit<unknown, unknown>): Effect.Effect<void> =>
            Ref.modify(invokeSessions, (sessions) => {
              const current = HashMap.get(sessions, id)
              return Option.isSome(current) && current.value.token === token
                ? [current.value, HashMap.remove(sessions, id)] as const
                : [undefined, sessions] as const
            }).pipe(
              Effect.flatMap((session) => session === undefined ? Effect.void : Scope.close(session.scope, exit))
            )
          const stopAllInvokes = (exit: Exit.Exit<unknown, unknown>): Effect.Effect<void> =>
            Ref.modify(invokeSessions, (sessions) => [HashMap.toEntries(sessions), HashMap.empty()] as const).pipe(
              Effect.flatMap((sessions) =>
                Effect.all(
                  sessions.map(([id, session]) =>
                    Scope.close(session.scope, exit).pipe(
                      Effect.andThen(context.stopChild(id))
                    )
                  ),
                  { discard: true }
                )
              )
            )
          const startInvokeWatchers = (
            config: AnyInvokeConfig,
            child: ActorModule.Actor<any, any, any, any>,
            token: symbol,
            scope: Scope.Closeable
          ): Effect.Effect<void> =>
            Effect.gen(function*() {
              if (config.snapshot !== undefined) {
                const mapSnapshot = config.snapshot
                yield* child.changes.pipe(
                  Stream.filter((snapshot) => snapshot.status === "active"),
                  Stream.runForEach((snapshot) =>
                    isCurrentInvoke(config.id, token).pipe(
                      Effect.flatMap((isCurrent) => {
                        if (!isCurrent) {
                          return Effect.void
                        }
                        const mappedEvent = mapSnapshot({ id: config.id, snapshot })
                        return mappedEvent === undefined
                          ? Effect.void
                          : context.self.send(mappedEvent as Machine.EventOf<Events>)
                      })
                    )
                  ),
                  Effect.forkIn(scope),
                  Effect.asVoid
                )
              }
              if (config.event !== undefined) {
                const mapEvent = config.event
                yield* ActorModule.watch(child).pipe(
                  Stream.runForEach((outcome) =>
                    isCurrentInvoke(config.id, token).pipe(
                      Effect.flatMap((isCurrent) => {
                        if (!isCurrent) {
                          return Effect.void
                        }
                        const mappedEvent = mapEvent({ id: config.id, outcome })
                        return mappedEvent === undefined
                          ? Effect.void
                          : context.self.send(mappedEvent as Machine.EventOf<Events>)
                      })
                    )
                  ),
                  Effect.forkIn(scope),
                  Effect.asVoid
                )
              }
            })
          const startInvoke = <StateId extends Machine.StateIdentifier<States>>(
            config: AnyInvokeConfig,
            state: Machine.StateByIdentifier<States, StateId>,
            event: Machine.EventOf<Events>
          ) =>
            Effect.gen(function*() {
              const token = Symbol()
              const child = yield* context.spawn(
                config.src({
                  state,
                  event,
                  runtime: runtimeFor<Machine.EventOf<Events>, Machine.EmitOf<Emits>>()
                }),
                { id: config.id }
              ).pipe(
                Effect.onExit((exit) =>
                  Exit.isFailure(exit) ? clearInvoke(config.id, token, Exit.failCause(exit.cause)) : Effect.void
                )
              )
              const scope = yield* Scope.make("parallel")
              yield* Ref.update(invokeSessions, (sessions) => HashMap.set(sessions, config.id, { token, scope }))
              yield* startInvokeWatchers(config, child, token, scope)
            })
          const startInvokes = (
            state: Machine.Snapshot<States>,
            event: Machine.EventOf<Events>
          ): Effect.Effect<void, E, R> =>
            Effect.all(
              getInvokes(getStateConfig(machine, state)).map((config) =>
                startInvoke(
                  config,
                  state.value as Machine.StateByIdentifier<States, Machine.StateIdentifier<States>>,
                  event
                ) as Effect.Effect<void, E, R>
              ),
              { discard: true }
            )
          const stopInvokes = (state: Machine.Snapshot<States>): Effect.Effect<void> =>
            Effect.all(
              getInvokes(getStateConfig(machine, state)).map((config) => stopInvoke(config.id, Exit.void)),
              { discard: true }
            )

          return yield* Effect.gen(function*() {
            yield* startInvokes(initialState, InitialEvent as Machine.EventOf<Events>)

            yield* Effect.whileLoop({
              while: () => !done,
              body: () =>
                Effect.gen(function*() {
                  const event = yield* receive
                  const current = yield* state
                  const planned = yield* macrostep(machine, current, event)
                  const changed = planned.microsteps.some((step) => step.changed)

                  if (changed) {
                    yield* stopInvokes(current)
                  }
                  yield* setState(planned.next)
                  yield* runActions(
                    planned.actions,
                    makeActorRuntime<Machine.EventOf<Events>, Machine.EmitOf<Emits>>(context)
                  )

                  if (isFinalState(machine, planned.next)) {
                    done = true
                    output = planned.output
                    yield* stopAllInvokes(Exit.succeed(output))
                  } else {
                    if (changed) {
                      yield* startInvokes(planned.next, event)
                    }
                    yield* Effect.yieldNow
                  }
                }),
              step: () => undefined
            })

            return output
          }).pipe(
            Effect.onExit((exit) => stopAllInvokes(exit))
          )
        }),
        context
      )
  }) as ActorModule.ActorLogic<
    Machine.Snapshot<States>,
    Machine.EventOf<Events>,
    E | UnhandledEventError | InfiniteTransitionError,
    ExcludeCompatibleRuntime<Exclude<InitialR | R, ActorRuntime>, Machine.EventOf<Events>, Machine.EmitOf<Emits>>,
    Output | undefined,
    InitialE | StartupError
  >

/**
 * Starts a state machine as an actor.
 *
 * **When to use**
 *
 * Use when you want actor runtime semantics for a state machine, including
 * asynchronous event delivery, lifecycle snapshots, `join`, actor-system
 * registration, and invoked child actors.
 *
 * **Gotchas**
 *
 * The returned actor's `send` operation only enqueues events. Transition
 * failures are reported through the actor snapshot, `changes`, and `join`
 * rather than being returned by `send`.
 *
 * @see {@link toActorLogic} for creating reusable actor logic from a state machine
 *
 * @category constructors
 * @since 4.0.0
 */
export const start: <
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.StateIdentifier<States> = Machine.StateIdentifier<States>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.StateIdentifier<States> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output, Emits>,
  ...args: [...Machine.InputArgs<Input>]
) => Effect.Effect<
  ActorModule.Actor<
    Machine.Snapshot<States>,
    Machine.EventOf<Events>,
    E | InitialE | StartupError | UnhandledEventError | InfiniteTransitionError,
    Output | undefined
  >,
  InitialE | StartupError,
  ExcludeCompatibleRuntime<Exclude<InitialR | R, ActorRuntime>, Machine.EventOf<Events>, Machine.EmitOf<Emits>>
> = (
  machine,
  ...args
) => ActorModule.start(toActorLogic(machine, ...args))
