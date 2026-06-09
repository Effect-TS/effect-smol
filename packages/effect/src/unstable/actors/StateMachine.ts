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
   * Configuration accepted for an atomic object state node.
   *
   * @category models
   * @since 4.0.0
   */
  export interface AtomicStateNodeConfig {
    readonly schema: TaggedSchema
    readonly type?: "active" | "final"
  }

  /**
   * Configuration accepted for a compound object state node.
   *
   * @category models
   * @since 4.0.0
   */
  export interface CompoundStateNodeConfig {
    readonly schema: TaggedSchema
    readonly type?: "active"
    readonly initial: string
    readonly states: StateTree
  }

  /**
   * Configuration accepted for an object state node.
   *
   * @category models
   * @since 4.0.0
   */
  export type StateNodeConfig = AtomicStateNodeConfig | CompoundStateNodeConfig

  /**
   * Object state tree keyed by state path.
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
    readonly path: string
    readonly key: string
    readonly tag: PropertyKey
    readonly schema: TaggedSchema
    readonly type: "atomic" | "compound" | "final"
    readonly parent: string | undefined
    readonly children: ReadonlyArray<string>
    readonly initial: string | undefined
    readonly order: number
  }

  /**
   * Runtime lookup table for state nodes.
   *
   * @category models
   * @since 4.0.0
   */
  export interface StateNodes {
    readonly byPath: ReadonlyMap<string, StateNode>
    readonly roots: ReadonlyArray<string>
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
   * Prefixes a state path with its parent path.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type JoinPath<Parent extends string, Child extends string> = Parent extends "" ? Child : `${Parent}.${Child}`

  /**
   * Extracts the state path values represented by a state definition.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type StateIdentifier<States extends StateSchemas> = StateIdentifierWithPrefix<States>

  /**
   * Extracts the state path values represented by a state definition under a
   * parent path prefix.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type StateIdentifierWithPrefix<
    States extends StateSchemas,
    Prefix extends string = ""
  > = {
    readonly [Key in Extract<keyof States, string>]: States[Key] extends { readonly states: infer Children }
      ? Children extends StateSchemas ?
        JoinPath<Prefix, Key> | StateIdentifierWithPrefix<Children, JoinPath<Prefix, Key>>
      : JoinPath<Prefix, Key>
      : JoinPath<Prefix, Key>
  }[Extract<keyof States, string>]

  /**
   * Extracts a state-tree node by state path.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type NodeByIdentifier<
    States extends StateSchemas,
    StateId extends StateIdentifier<States>
  > = StateId extends `${infer Head}.${infer Rest}`
    ? Head extends keyof States
      ? States[Head] extends { readonly states: infer Children extends StateSchemas }
        ? Rest extends StateIdentifier<Children> ? NodeByIdentifier<Children, Rest> : never
      : never
    : never
    : StateId extends keyof States ? States[StateId]
    : never

  /**
   * Extracts a schema from a state definition by state identifier.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type SchemaByIdentifier<
    States extends StateSchemas,
    StateId extends StateIdentifier<States>
  > = NodeSchema<NodeByIdentifier<States, StateId>>

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
   * Compound statechart snapshot carrying parent value plus the active child
   * snapshot.
   *
   * @category models
   * @since 4.0.0
   */
  export interface CompoundSnapshot<Path extends string, Value, Child> {
    readonly path: Path
    readonly value: Value
    readonly state: Child
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
  > = NodeByIdentifier<States, StateId> extends { readonly states: infer Children }
    ? Children extends StateSchemas ? CompoundSnapshot<
        StateId,
        StateByIdentifier<States, StateId>,
        SnapshotWithPrefix<Children, StateId>
      >
    : AtomicSnapshot<StateId, StateByIdentifier<States, StateId>>
    : AtomicSnapshot<StateId, StateByIdentifier<States, StateId>>

  /**
   * Extracts child snapshots under a parent path prefix.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type SnapshotWithPrefix<
    States extends StateSchemas,
    Prefix extends string
  > = {
    readonly [Key in Extract<keyof States, string>]: SnapshotByIdentifierWithPath<States, Key, JoinPath<Prefix, Key>>
  }[Extract<keyof States, string>]

  /**
   * Extracts a snapshot for a state node while preserving its full path.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type SnapshotByIdentifierWithPath<
    States extends StateSchemas,
    StateId extends Extract<keyof States, string>,
    Path extends string
  > = States[StateId] extends { readonly states: infer Children } ? Children extends StateSchemas ? CompoundSnapshot<
        Path,
        NodeSchema<States[StateId]>["Type"],
        SnapshotWithPrefix<Children, Path>
      >
    : AtomicSnapshot<Path, NodeSchema<States[StateId]>["Type"]>
    : AtomicSnapshot<Path, NodeSchema<States[StateId]>["Type"]>

  /**
   * Extracts the union of statechart snapshots represented by a state
   * definition.
   *
   * @category models
   * @since 4.0.0
   */
  export type Snapshot<States extends StateSchemas> = {
    readonly [StateId in Extract<keyof States, string>]: SnapshotByIdentifier<States, StateId & StateIdentifier<States>>
  }[Extract<keyof States, string>]

  /**
   * State input accepted at runtime while raw decoded states remain supported at
   * machine boundaries.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type StateLike<States extends StateSchemas> = StateOf<States> | Snapshot<States>

  /**
   * Extracts the root state identifier from a state path.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type RootStateIdentifier<StateId extends string> = StateId extends `${infer Root}.${string}` ? Root : StateId

  /**
   * Extracts the public snapshot shape that contains a final state path.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type SnapshotContainingFinal<
    States extends StateSchemas,
    FinalStates extends StateIdentifier<States>
  > = FinalStates extends StateIdentifier<States>
    ? RootStateIdentifier<FinalStates> extends infer Root extends StateIdentifier<States> ? SnapshotByIdentifier<
        States,
        Root
      >
    : never
    : never

  /**
   * Extracts state identifiers whose state-tree definition marks them final.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type FinalStateFromDefinition<States extends StateSchemas> =
    & {
      readonly [StateId in StateIdentifier<States>]: NodeByIdentifier<States, StateId> extends
        { readonly type: "final" } ? StateId
        : never
    }[StateIdentifier<States>]
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
    readonly values?: Partial<
      {
        readonly [AncestorStateId in StateIdentifier<States>]: StateByIdentifier<States, AncestorStateId>
      }
    >
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
      value: StateByIdentifier<States, StateId>,
      options?: {
        readonly values?: Partial<
          {
            readonly [AncestorStateId in StateIdentifier<States>]: StateByIdentifier<States, AncestorStateId>
          }
        >
      }
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
    | Snapshot<States>
    | Effect.Effect<StateOf<States> | Snapshot<States>, E, R>

  /**
   * Return value accepted from transition handlers.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type HandlerResult<States extends StateSchemas, E, R> =
    | StateOf<States>
    | Snapshot<States>
    | Target<States, StateIdentifier<States>>
    | void
    | Effect.Effect<StateOf<States> | Snapshot<States> | Target<States, StateIdentifier<States>> | void, E, R>

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
  readonly type: "atomic" | "compound" | "final"
  readonly initial: string | undefined
  readonly states: Machine.StateTree | undefined
} => {
  if (Schema.isSchema(definition)) {
    return { schema: definition as Machine.TaggedSchema, type: "atomic", initial: undefined, states: undefined }
  }
  if (hasProperty(definition, "type") && (definition as any).type === "parallel") {
    throw new Error(`StateMachine.make does not support parallel state "${path}" yet`)
  }
  if (!hasProperty(definition, "schema") || !Schema.isSchema(definition.schema)) {
    throw new Error(`StateMachine.make expected state "${path}" to be a tagged schema or state node config`)
  }
  if (hasProperty(definition, "states")) {
    if ((definition as any).type === "final") {
      throw new Error(`StateMachine.make expected compound state "${path}" to be active`)
    }
    if (typeof (definition as any).initial !== "string") {
      throw new Error(`StateMachine.make expected compound state "${path}" to declare an initial child`)
    }
    return {
      schema: definition.schema as Machine.TaggedSchema,
      type: "compound",
      initial: (definition as any).initial,
      states: (definition as any).states as Machine.StateTree
    }
  }
  return {
    schema: definition.schema as Machine.TaggedSchema,
    type: definition.type === "final" ? "final" : "atomic",
    initial: undefined,
    states: undefined
  }
}

const compileStateNodes = (states: Machine.StateSchemas): Machine.StateNodes => {
  const byPath = new Map<string, Machine.StateNode>()
  let order = 0

  const compile = (tree: Machine.StateTree, parent: string | undefined): ReadonlyArray<string> => {
    const paths: Array<string> = []
    for (const key of Object.keys(tree)) {
      const path = parent === undefined ? key : `${parent}.${key}`
      const definition = getStateNodeDefinition(path, tree[key])
      const node = {
        path,
        key,
        tag: getSchemaTag(definition.schema) ?? key,
        schema: definition.schema,
        type: definition.type,
        parent,
        children: [] as ReadonlyArray<string>,
        initial: definition.initial === undefined ? undefined : `${path}.${definition.initial}`,
        order
      }
      byPath.set(path, node)
      paths.push(path)
      order += 1
      if (definition.states !== undefined) {
        const children = compile(definition.states, path)
        if (node.initial === undefined || !children.includes(node.initial)) {
          throw new Error(`StateMachine.make expected compound state "${path}" initial child to exist`)
        }
        ;(node as { children: ReadonlyArray<string> }).children = children
      }
    }
    return paths
  }

  return {
    byPath,
    roots: compile(states, undefined)
  }
}

const makeTarget: Machine.TargetFunction<any> = (
  path: string,
  value: { readonly _tag: PropertyKey },
  options?: {
    readonly values?: Readonly<Record<string, unknown>>
  }
) =>
  ({
    [TargetTypeId]: TargetTypeId,
    path,
    value,
    values: options?.values
  }) as any

const isTarget = (u: unknown): u is Machine.Target<any, any> => hasProperty(u, TargetTypeId)

const isSnapshot = (u: unknown): u is Machine.AtomicSnapshot<string, unknown> =>
  hasProperty(u, "path") && hasProperty(u, "value")

const findStateNode = (
  machine: Machine.Any,
  value: { readonly _tag: PropertyKey }
): Machine.StateNode | undefined => {
  for (const node of machine.stateNodes.byPath.values()) {
    if (Schema.is(node.schema)(value)) {
      return node
    }
  }
  return typeof value._tag === "string" ? machine.stateNodes.byPath.get(value._tag) : undefined
}

interface ActiveConfiguration {
  readonly active: ReadonlySet<string>
  readonly values: ReadonlyMap<string, unknown>
}

const getNode = (machine: Machine.Any, path: string): Machine.StateNode => {
  const node = machine.stateNodes.byPath.get(path)
  if (node === undefined) {
    throw new Error(`StateMachine expected state path "${path}" to exist`)
  }
  return node
}

const hasOwn = (u: object, key: string): boolean => Object.prototype.hasOwnProperty.call(u, key)

const isDescendantOf = (path: string, ancestor: string): boolean => path.startsWith(`${ancestor}.`)

const getPathToRoot = (machine: Machine.Any, path: string): ReadonlyArray<string> => {
  const paths: Array<string> = []
  let current: string | undefined = path
  while (current !== undefined) {
    paths.unshift(current)
    current = getNode(machine, current).parent
  }
  return paths
}

const getLeafPath = (machine: Machine.Any, configuration: ActiveConfiguration): string => {
  let leaf: string | undefined
  for (const path of configuration.active) {
    const hasActiveChild = getNode(machine, path).children.some((child) => configuration.active.has(child))
    if (!hasActiveChild && (leaf === undefined || getNode(machine, path).order > getNode(machine, leaf).order)) {
      leaf = path
    }
  }
  if (leaf === undefined) {
    throw new Error("StateMachine expected an active leaf state")
  }
  return leaf
}

const getRootPath = (machine: Machine.Any, configuration: ActiveConfiguration): string => {
  for (const path of configuration.active) {
    if (getNode(machine, path).parent === undefined) {
      return path
    }
  }
  throw new Error("StateMachine expected an active root state")
}

const getActiveValue = (configuration: ActiveConfiguration, path: string): unknown => {
  if (!configuration.values.has(path)) {
    throw new Error(`StateMachine expected active state "${path}" to have a value`)
  }
  return configuration.values.get(path)
}

const snapshotFromPath = <const States extends Machine.StateSchemas>(
  machine: Machine.Any,
  configuration: ActiveConfiguration,
  path: string
): Machine.SnapshotByIdentifier<States, Machine.StateIdentifier<States>> => {
  const node = getNode(machine, path)
  const snapshot: Record<string, unknown> = {
    path,
    value: getActiveValue(configuration, path)
  }
  if (node.type === "compound") {
    const child = node.children.find((child) => configuration.active.has(child))
    if (child === undefined) {
      throw new Error(`StateMachine expected compound state "${path}" to have an active child`)
    }
    snapshot.state = snapshotFromPath(machine, configuration, child)
  }
  return snapshot as unknown as Machine.SnapshotByIdentifier<States, Machine.StateIdentifier<States>>
}

const snapshotFromConfiguration = <const States extends Machine.StateSchemas>(
  machine: Machine.Any,
  configuration: ActiveConfiguration
): Machine.Snapshot<States> =>
  snapshotFromPath<States>(machine, configuration, getRootPath(machine, configuration)) as Machine.Snapshot<States>

const configurationFromSnapshot = (
  machine: Machine.Any,
  snapshot: Machine.AtomicSnapshot<string, unknown>
): ActiveConfiguration => {
  const active = new Set<string>()
  const values = new Map<string, unknown>()

  const visit = (current: Machine.AtomicSnapshot<string, unknown>): void => {
    const node = getNode(machine, String(current.path))
    if (!Schema.is(node.schema)(current.value)) {
      throw new Error(`StateMachine expected snapshot for "${node.path}" to match its schema`)
    }
    active.add(node.path)
    values.set(node.path, current.value)
    if (node.type === "compound") {
      if (!hasProperty(current, "state") || !isSnapshot(current.state)) {
        throw new Error(`StateMachine expected compound snapshot "${node.path}" to include an active child state`)
      }
      const child = getNode(machine, String(current.state.path))
      if (child.parent !== node.path) {
        throw new Error(`StateMachine expected snapshot "${child.path}" to be a child of "${node.path}"`)
      }
      visit(current.state)
    }
  }

  visit(snapshot)
  return { active, values }
}

const configurationFromValue = (
  machine: Machine.Any,
  value: { readonly _tag: PropertyKey }
): ActiveConfiguration => {
  const node = findStateNode(machine, value)
  if (node === undefined) {
    throw new Error(`StateMachine expected state "${String(value._tag)}" to match a state node`)
  }
  if (node.parent !== undefined || node.type === "compound") {
    throw new Error(`StateMachine expected state "${node.path}" to be provided as a snapshot with ancestor values`)
  }
  return {
    active: new Set([node.path]),
    values: new Map([[node.path, value]])
  }
}

const normalizeConfiguration = <const States extends Machine.StateSchemas>(
  machine: Machine.Any,
  state: Machine.StateLike<States>
): ActiveConfiguration => {
  if (isSnapshot(state)) {
    return configurationFromSnapshot(machine, state)
  }
  return configurationFromValue(machine, state)
}

const validateInitialConfiguration = (machine: Machine.Any, configuration: ActiveConfiguration): void => {
  for (const path of configuration.active) {
    const node = getNode(machine, path)
    if (node.type === "compound") {
      const child = node.children.find((child) => configuration.active.has(child))
      if (child !== node.initial) {
        throw new Error(`StateMachine initial state "${node.path}" must enter initial child "${node.initial}"`)
      }
    }
  }
}

const configurationFromTargetPath = (
  machine: Machine.Any,
  current: ActiveConfiguration,
  path: string,
  value: { readonly _tag: PropertyKey },
  providedValues: Readonly<Record<string, unknown>> | undefined
): ActiveConfiguration => {
  const node = getNode(machine, path)
  const active = new Set<string>()
  const values = new Map<string, unknown>()
  const paths = getPathToRoot(machine, node.path)

  for (const currentPath of paths) {
    active.add(currentPath)
    if (currentPath === node.path) {
      values.set(currentPath, value)
    } else if (providedValues !== undefined && hasOwn(providedValues, currentPath)) {
      values.set(currentPath, providedValues[currentPath])
    } else if (current.values.has(currentPath)) {
      values.set(currentPath, current.values.get(currentPath))
    } else {
      throw new Error(`StateMachine target "${node.path}" requires a value for ancestor state "${currentPath}"`)
    }
  }

  if (node.type === "compound") {
    throw new Error(`StateMachine target "${node.path}" must include an active child state`)
  }

  return { active, values }
}

const normalizeTargetConfiguration = <const States extends Machine.StateSchemas>(
  machine: Machine.Any,
  current: ActiveConfiguration,
  target: Machine.StateOf<States> | Machine.Snapshot<States> | Machine.Target<States, Machine.StateIdentifier<States>>
): ActiveConfiguration => {
  if (isTarget(target)) {
    return configurationFromTargetPath(
      machine,
      current,
      target.path,
      target.value as { readonly _tag: PropertyKey },
      target.values as Readonly<Record<string, unknown>> | undefined
    )
  }
  if (isSnapshot(target)) {
    return configurationFromSnapshot(machine, target)
  }
  const node = findStateNode(machine, target as { readonly _tag: PropertyKey })
  if (node === undefined) {
    throw new Error(`StateMachine expected target state "${String((target as any)._tag)}" to match a state node`)
  }
  return configurationFromTargetPath(machine, current, node.path, target as { readonly _tag: PropertyKey }, undefined)
}

const getStateIdentifier = (
  machine: Machine.Any,
  state: Machine.StateLike<any>
): string => getRootPath(machine, normalizeConfiguration(machine, state))

const getStateConfig = (
  machine: Machine.Any,
  state: Machine.StateLike<any>
): Machine.AnyStateConfig | undefined => machine.handlers[getStateIdentifier(machine, state)]

const getStateConfigByPath = (
  machine: Machine.Any,
  path: string
): Machine.AnyStateConfig | undefined => machine.handlers[path]

const getActiveChildPath = (
  machine: Machine.Any,
  configuration: ActiveConfiguration,
  path: string
): string | undefined => getNode(machine, path).children.find((child) => configuration.active.has(child))

const isDirectFinalPath = (
  machine: Machine.Any,
  path: string
): boolean => getNode(machine, path).type === "final" || getStateConfigByPath(machine, path)?.type === "final"

const getDeepestActiveFinalPathFrom = (
  machine: Machine.Any,
  configuration: ActiveConfiguration,
  path: string
): string | undefined => {
  const node = getNode(machine, path)
  if (node.type === "compound") {
    const child = getActiveChildPath(machine, configuration, path)
    if (child !== undefined) {
      const finalChild = getDeepestActiveFinalPathFrom(machine, configuration, child)
      if (finalChild !== undefined) {
        return finalChild
      }
    }
  }
  return isDirectFinalPath(machine, path) ? path : undefined
}

const getDeepestActiveFinalPath = (
  machine: Machine.Any,
  configuration: ActiveConfiguration
): string | undefined => getDeepestActiveFinalPathFrom(machine, configuration, getRootPath(machine, configuration))

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

type SelectedTransition<States extends Machine.StateSchemas, E, R, Context> = {
  readonly sourcePath: string
  readonly transition: MicrostepTransition<States, E, R, Context>
  readonly context: Context
}

const getCandidatePaths = (machine: Machine.Any, configuration: ActiveConfiguration): ReadonlyArray<string> =>
  getPathToRoot(machine, getLeafPath(machine, configuration)).slice().reverse()

const getLeastCommonAncestor = (
  machine: Machine.Any,
  left: string,
  right: string
): string | undefined => {
  const leftPath = getPathToRoot(machine, left)
  const rightPath = getPathToRoot(machine, right)
  let ancestor: string | undefined = undefined
  const length = Math.min(leftPath.length, rightPath.length)
  for (let index = 0; index < length; index++) {
    if (leftPath[index] !== rightPath[index]) {
      break
    }
    ancestor = leftPath[index]
  }
  return ancestor
}

const getExitPaths = (
  machine: Machine.Any,
  configuration: ActiveConfiguration,
  boundary: string | undefined
): ReadonlyArray<string> =>
  Array.from(configuration.active)
    .filter((path) => boundary === undefined || isDescendantOf(path, boundary))
    .sort((left, right) => {
      const depth = getPathToRoot(machine, right).length - getPathToRoot(machine, left).length
      return depth === 0 ? getNode(machine, right).order - getNode(machine, left).order : depth
    })

const getEntryPaths = (
  machine: Machine.Any,
  targetLeaf: string,
  boundary: string | undefined
): ReadonlyArray<string> =>
  getPathToRoot(machine, targetLeaf).filter((path) => boundary === undefined || isDescendantOf(path, boundary))

const makeStateActionContext = <
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema>,
  StateId extends Machine.StateIdentifier<States>
>(
  configuration: ActiveConfiguration,
  path: string,
  event: Machine.EventOf<Events>
): Machine.StateActionContext<States, Events, Emits, StateId> => ({
  state: getActiveValue(configuration, path) as Machine.StateByIdentifier<States, StateId>,
  event,
  runtime: runtimeFor<Machine.EventOf<Events>, Machine.EmitOf<Emits>>()
})

const makeTransitionContext = <
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema>,
  StateId extends Machine.StateIdentifier<States>,
  EventTag extends Machine.TagOf<Events[number]>
>(
  configuration: ActiveConfiguration,
  path: string,
  event: Machine.EventByTag<Events, EventTag>
): Machine.HandlerContext<States, Events, Emits, StateId, EventTag, any, any> => ({
  state: getActiveValue(configuration, path) as Machine.StateByIdentifier<States, StateId>,
  event,
  runtime: runtimeFor<Machine.EventOf<Events>, Machine.EmitOf<Emits>>(),
  target: makeTarget
})

const collectStateActions = Effect.fnUntraced(function*<
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema>,
  E,
  R
>(
  machine: Machine.Any,
  configuration: ActiveConfiguration,
  paths: ReadonlyArray<string>,
  event: Machine.EventOf<Events>,
  key: "entry" | "exit"
) {
  const actions: Array<DeferredAction<E, R>> = []
  const raisedEvents: Array<Machine.EventOf<Events>> = []
  for (const path of paths) {
    const collected = yield* collectStateAction<
      Machine.StateActionContext<States, Events, Emits, Machine.StateIdentifier<States>>,
      Machine.EventOf<Events>,
      E,
      R
    >(
      machine.handlers[path]?.[key],
      makeStateActionContext<States, Events, Emits, Machine.StateIdentifier<States>>(configuration, path, event)
    )
    actions.push(...collected.actions)
    raisedEvents.push(...collected.raisedEvents)
  }
  return { actions, raisedEvents }
})

const selectAlwaysTransition = <
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema>,
  E,
  R
>(
  machine: Machine.Any,
  configuration: ActiveConfiguration,
  event: Machine.EventOf<Events>
):
  | SelectedTransition<
    States,
    E,
    R,
    Machine.AlwaysContext<States, Events, Emits, Machine.StateIdentifier<States>>
  >
  | undefined =>
{
  for (const path of getCandidatePaths(machine, configuration)) {
    const always = machine.handlers[path]?.always
    if (always !== undefined) {
      return {
        sourcePath: path,
        transition: { reenter: false, transition: always },
        context: {
          state: getActiveValue(configuration, path) as Machine.StateByIdentifier<
            States,
            Machine.StateIdentifier<States>
          >,
          event,
          runtime: runtimeFor<Machine.EventOf<Events>, Machine.EmitOf<Emits>>(),
          target: makeTarget
        }
      }
    }
  }
  return undefined
}

const selectEventTransition = <
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema>,
  E,
  R
>(
  machine: Machine.Any,
  configuration: ActiveConfiguration,
  event: Machine.EventByTag<Events, Machine.TagOf<Events[number]>>
):
  | SelectedTransition<
    States,
    E,
    R,
    Machine.HandlerContext<States, Events, Emits, Machine.StateIdentifier<States>, Machine.TagOf<Events[number]>, E, R>
  >
  | undefined =>
{
  for (const path of getCandidatePaths(machine, configuration)) {
    const transition = normalizeEventTransition(machine.handlers[path]?.on?.[event._tag])
    if (transition !== undefined) {
      return {
        sourcePath: path,
        transition: transition as unknown as MicrostepTransition<
          States,
          E,
          R,
          Machine.HandlerContext<
            States,
            Events,
            Emits,
            Machine.StateIdentifier<States>,
            Machine.TagOf<Events[number]>,
            E,
            R
          >
        >,
        context: makeTransitionContext<
          States,
          Events,
          Emits,
          Machine.StateIdentifier<States>,
          Machine.TagOf<Events[number]>
        >(configuration, path, event)
      }
    }
  }
  return undefined
}

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
): boolean => getDeepestActiveFinalPath(machine, normalizeConfiguration(machine, state)) !== undefined

const getFinalOutputFromConfiguration = <
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  Output
>(
  machine: Machine.Any,
  configuration: ActiveConfiguration,
  event: Machine.EventOf<Events>
): Output | undefined => {
  const finalPath = getDeepestActiveFinalPath(machine, configuration)
  if (finalPath === undefined) {
    return undefined
  }
  return getStateConfigByPath(machine, finalPath)?.output?.({
    state: getActiveValue(configuration, finalPath),
    event
  }) as Output | undefined
}

const getFinalOutput = <
  const States extends Machine.StateSchemas,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  Output
>(
  machine: Machine.Any,
  state: Machine.StateLike<States>,
  event: Machine.EventOf<Events>
): Output | undefined =>
  getFinalOutputFromConfiguration<Events, Output>(
    machine,
    normalizeConfiguration(machine, state),
    event
  )

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
  Machine.StateByIdentifier<States, FinalStates> | Machine.SnapshotContainingFinal<States, FinalStates>
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
      Machine.StateOf<States> | Machine.Snapshot<States>
    >)
    : result
  const configuration = normalizeConfiguration<States>(machine, state)
  validateInitialConfiguration(machine, configuration)
  const actions = yield* deferredActions.read
  const settled = yield* catchStartup(Effect.gen(function*() {
    const entry = yield* collectStateActions<States, Events, Emits, never, never>(
      machine,
      configuration,
      getPathToRoot(machine, getLeafPath(machine, configuration)),
      InitialEvent as Machine.EventOf<Events>,
      "entry"
    )
    return yield* (settle(
      machine,
      configuration,
      InitialEvent as Machine.EventOf<Events>,
      [...entry.actions] as Array<Effect.Effect<void, never, never>>,
      [...entry.raisedEvents] as Array<Machine.EventOf<Events>>,
      []
    ) as Effect.Effect<MacrostepPlan<ActiveConfiguration, Machine.EventOf<Events>, never, never, Output>>)
  }))

  return {
    state: snapshotFromConfiguration<States>(machine, settled.next),
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
): ReadonlyArray<Machine.TagOf<Events[number]>> => {
  if (isFinalState(machine, state)) {
    return []
  }
  const configuration = normalizeConfiguration(machine, state)
  const tags: Array<Machine.TagOf<Events[number]>> = []
  const seen = new Set<PropertyKey>()
  for (const path of getCandidatePaths(machine, configuration)) {
    for (const tag of Reflect.ownKeys(machine.handlers[path]?.on ?? {})) {
      if (!seen.has(tag)) {
        seen.add(tag)
        tags.push(tag as Machine.TagOf<Events[number]>)
      }
    }
  }
  return tags
}

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
  state: ActiveConfiguration,
  event: Machine.EventOf<Events>,
  selection: SelectedTransition<States, E, R, Context> | undefined
) => Effect.Effect<
  MicrostepPlan<ActiveConfiguration, Machine.EventOf<Events>, E, R>,
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
  state: ActiveConfiguration,
  event: Machine.EventOf<Events>,
  selection: SelectedTransition<States, E, R, Context> | undefined
) {
  const stateIdentifier = getLeafPath(machine, state)

  if (selection === undefined) {
    return yield* new UnhandledEventError({
      machineId: machine.id,
      state: String(stateIdentifier),
      event: String(event._tag)
    })
  }

  const transitionResult = yield* collectTransition<States, Machine.EventOf<Events>, E, R, Context>(
    selection.transition.transition,
    selection.context
  )
  const target = transitionResult.state === undefined ? undefined : transitionResult.state
  const stateAfterTransition = target === undefined
    ? state
    : normalizeTargetConfiguration<States>(machine, state, target)
  const targetIdentifier = getLeafPath(machine, stateAfterTransition)
  if (targetIdentifier === stateIdentifier && !selection.transition.reenter) {
    return {
      next: stateAfterTransition,
      actions: transitionResult.actions,
      raisedEvents: transitionResult.raisedEvents,
      changed: false
    }
  }

  const boundary = selection.transition.reenter
    ? getNode(machine, selection.sourcePath).parent
    : getLeastCommonAncestor(machine, stateIdentifier, targetIdentifier)
  const exit = yield* collectStateActions<States, Events, Emits, E, R>(
    machine,
    state,
    getExitPaths(machine, state, boundary),
    event,
    "exit"
  )
  const entry = yield* collectStateActions<States, Events, Emits, E, R>(
    machine,
    stateAfterTransition,
    getEntryPaths(machine, targetIdentifier, boundary),
    event,
    "entry"
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
  state: ActiveConfiguration,
  event: Machine.EventOf<Events>,
  actions: Array<Effect.Effect<void, E, R>>,
  raisedEvents: Array<Machine.EventOf<Events>>,
  microsteps: Array<MicrostepPlan<ActiveConfiguration, Machine.EventOf<Events>, E, R>>
) => Effect.Effect<
  MacrostepPlan<ActiveConfiguration, Machine.EventOf<Events>, E, R, Output>,
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
  state: ActiveConfiguration,
  event: Machine.EventOf<Events>,
  actions: Array<Effect.Effect<void, E, R>>,
  raisedEvents: Array<Machine.EventOf<Events>>,
  microsteps: Array<MicrostepPlan<ActiveConfiguration, Machine.EventOf<Events>, E, R>>
) {
  let currentState = state
  let currentEvent = event
  let shouldRunAlways = true
  let iterations = 0
  let raisedEventIndex = 0
  let finalOutput: Output | undefined = undefined

  while (true) {
    if (getDeepestActiveFinalPath(machine, currentState) !== undefined) {
      finalOutput = getFinalOutputFromConfiguration<Events, Output>(
        machine,
        currentState,
        currentEvent
      )
      break
    }

    iterations += 1
    if (iterations > MaxMacrostepIterations) {
      return yield* new InfiniteTransitionError({
        machineId: machine.id,
        state: String(getLeafPath(machine, currentState)),
        maxIterations: MaxMacrostepIterations
      })
    }

    const always = shouldRunAlways
      ? selectAlwaysTransition<States, Events, Emits, E, R>(machine, currentState, currentEvent)
      : undefined
    if (always !== undefined) {
      const alwaysStep: MicrostepPlan<ActiveConfiguration, Machine.EventOf<Events>, E, R> = yield* microstep(
        machine,
        currentState,
        currentEvent,
        always
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
    const raisedStep = yield* microstep(
      machine,
      currentState,
      raisedEvent,
      selectEventTransition<States, Events, Emits, E, R>(
        machine,
        currentState,
        raisedEvent as Machine.EventByTag<Events, Machine.TagOf<Events[number]>>
      )
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
  const configuration = normalizeConfiguration<States>(machine, state)
  const snapshot = snapshotFromConfiguration<States>(machine, configuration)
  if (isFinalState(machine, snapshot)) {
    return {
      next: snapshot,
      actions: [],
      microsteps: [],
      output: undefined
    }
  }

  const step = yield* microstep(
    machine,
    configuration,
    event,
    selectEventTransition<States, Events, Emits, E, R>(
      machine,
      configuration,
      event as Machine.EventByTag<Events, Machine.TagOf<Events[number]>>
    )
  )
  const actions = [...step.actions]
  const raisedEvents = [...step.raisedEvents]
  const microsteps = [step]
  const settled = yield* settle(machine, step.next, event, actions, raisedEvents, microsteps)
  return {
    next: snapshotFromConfiguration<States>(machine, settled.next),
    actions: settled.actions,
    microsteps: settled.microsteps.map((step) => ({
      next: snapshotFromConfiguration<States>(machine, step.next),
      actions: step.actions,
      raisedEvents: step.raisedEvents,
      changed: step.changed
    })),
    output: settled.output
  }
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
            return getFinalOutput<States, Events, Output>(
              machine,
              initialState,
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
