/**
 * Schema-first state machine definitions.
 *
 * @since 4.0.0
 */

import * as Effect from "../../Effect.ts"
import { PipeInspectableProto } from "../../internal/core.ts"
import type { InfiniteTransitionError, StartupError, UnhandledEventError } from "../../internal/stateMachineErrors.ts"
import type { Pipeable } from "../../Pipeable.ts"
import { hasProperty } from "../../Predicate.ts"
import type * as Schema from "../../Schema.ts"
import type * as Scope from "../../Scope.ts"
import * as ActorModule from "./Actor.ts"
import * as internalActor from "./internal/stateMachineActor.ts"
import * as Model from "./internal/stateMachineModel.ts"
import { ActorRuntime } from "./internal/stateMachineRuntime.ts"
import * as internalRuntime from "./internal/stateMachineRuntime.ts"

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

export {
  /**
   * Error returned when a state machine does not stabilize within the maximum
   * number of macrostep iterations.
   *
   * @category errors
   * @since 4.0.0
   */
  InfiniteTransitionError,
  /**
   * Error returned when a state machine fails while running startup lifecycle
   * logic after the initial state has been computed.
   *
   * @category errors
   * @since 4.0.0
   */
  StartupError,
  /**
   * Error returned when an event has no handler for the current state.
   *
   * @category errors
   * @since 4.0.0
   */
  UnhandledEventError
} from "../../internal/stateMachineErrors.ts"

export {
  /**
   * Actor runtime scope available to state machine actions when a machine runs
   * through `toActorLogic`.
   *
   * @category services
   * @since 4.0.0
   */
  ActorRuntime
} from "./internal/stateMachineRuntime.ts"

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

type StateDefinitionError<Message extends string> = {
  readonly "~effect/StateMachine/DefinitionError": Message
}

type ValidateStateTree<States extends Machine.StateSchemas> = {
  readonly [Key in keyof States]: ValidateStateNode<States[Key]>
}

type ValidateStateNode<Node> = Node extends Machine.TaggedSchema ? unknown
  : Node extends { readonly schema: Machine.TaggedSchema } ? ValidateStateNodeConfig<Node>
  : StateDefinitionError<"State nodes must be tagged schemas or state node configs">

type ValidateStateNodeConfig<Node extends { readonly schema: Machine.TaggedSchema }> = Node extends
  { readonly states: infer Children } ? ValidateStateNodeWithChildren<Node, Children>
  : ValidateStateNodeWithoutChildren<Node>

type ValidateStateNodeWithChildren<
  Node extends { readonly schema: Machine.TaggedSchema },
  Children
> = Children extends Machine.StateSchemas ?
  Node extends { readonly type: "final" } ? StateDefinitionError<"Final states cannot declare child states">
  : Node extends { readonly type: "parallel" } ?
    "initial" extends keyof Node ? StateDefinitionError<"Parallel states cannot declare an initial child">
    : { readonly states: ValidateStateTree<Children> }
  : ValidateCompoundStateNode<Node, Children>
  : StateDefinitionError<"Child states must be a state tree">

type ValidateCompoundStateNode<
  Node extends { readonly schema: Machine.TaggedSchema },
  Children extends Machine.StateSchemas
> = Node extends { readonly initial: infer Initial } ? Initial extends Extract<keyof Children, string> ? {
      readonly states: ValidateStateTree<Children>
    }
  : StateDefinitionError<"Compound initial must be one of its direct child keys">
  : StateDefinitionError<"Compound states must declare an initial child">

type ValidateStateNodeWithoutChildren<Node extends { readonly schema: Machine.TaggedSchema }> = "initial" extends
  keyof Node ? StateDefinitionError<"Atomic states cannot declare an initial child">
  : Node extends { readonly type: infer Type } ? Type extends "active" | "final" | undefined ? unknown
    : StateDefinitionError<"State node type must be active, final, or parallel">
  : unknown

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
   * Configuration accepted for a parallel object state node.
   *
   * @category models
   * @since 4.0.0
   */
  export interface ParallelStateNodeConfig {
    readonly schema: TaggedSchema
    readonly type: "parallel"
    readonly states: StateTree
  }

  /**
   * Configuration accepted for an object state node.
   *
   * @category models
   * @since 4.0.0
   */
  export type StateNodeConfig = AtomicStateNodeConfig | CompoundStateNodeConfig | ParallelStateNodeConfig

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
   * Initial snapshot builder generated for a defined state tree.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type InitialBuilder<States extends StateSchemas> = any

  /**
   * State definitions returned by {@link defineStates}.
   *
   * @category models
   * @since 4.0.0
   */
  export interface DefinedStates<States extends StateSchemas> {
    readonly states: States
    readonly initial: InitialBuilder<States>
  }

  /**
   * Validates the nested shape of state schema definitions.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type ValidateStateSchemas<States extends StateSchemas> = ValidateStateTree<States>

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
    readonly type: "atomic" | "compound" | "parallel" | "final"
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
   * Parallel statechart snapshot carrying parent value plus one active snapshot
   * per child region.
   *
   * @category models
   * @since 4.0.0
   */
  export interface ParallelSnapshot<Path extends string, Value, Regions> {
    readonly path: Path
    readonly value: Value
    readonly states: Regions
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
  > = NodeByIdentifier<States, StateId> extends infer Node
    ? Node extends { readonly type: "parallel"; readonly states: infer Children }
      ? Children extends StateSchemas ? ParallelSnapshot<
          StateId,
          StateByIdentifier<States, StateId>,
          SnapshotRegionsWithPrefix<Children, StateId>
        >
      : AtomicSnapshot<StateId, StateByIdentifier<States, StateId>>
    : Node extends { readonly states: infer Children } ? Children extends StateSchemas ? CompoundSnapshot<
          StateId,
          StateByIdentifier<States, StateId>,
          SnapshotWithPrefix<Children, StateId>
        >
      : AtomicSnapshot<StateId, StateByIdentifier<States, StateId>>
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
   * Extracts child snapshots under a parallel parent path prefix, keyed by
   * child region.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type SnapshotRegionsWithPrefix<
    States extends StateSchemas,
    Prefix extends string
  > = {
    readonly [Key in Extract<keyof States, string>]: SnapshotByIdentifierWithPath<States, Key, JoinPath<Prefix, Key>>
  }

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
  > = States[StateId] extends { readonly type: "parallel"; readonly states: infer Children }
    ? Children extends StateSchemas ? ParallelSnapshot<
        Path,
        NodeSchema<States[StateId]>["Type"],
        SnapshotRegionsWithPrefix<Children, Path>
      >
    : AtomicSnapshot<Path, NodeSchema<States[StateId]>["Type"]>
    : States[StateId] extends { readonly states: infer Children } ? Children extends StateSchemas ? CompoundSnapshot<
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
    readonly [Model.TargetTypeId]: typeof Model.TargetTypeId
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
   * Extracts region outputs for a completed parallel state.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type ParallelOutputRegions<
    States extends StateSchemas,
    StateId extends StateIdentifier<States>
  > = NodeByIdentifier<States, StateId> extends
    { readonly type: "parallel"; readonly states: infer Children extends StateSchemas } ? {
      readonly [Key in Extract<keyof Children, string>]: unknown
    }
    : never

  /**
   * Context passed to a parallel state output function.
   *
   * @category models
   * @since 4.0.0
   */
  export interface ParallelOutputContext<
    States extends StateSchemas,
    Events extends ReadonlyArray<TaggedSchema>,
    StateId extends StateIdentifier<States>
  > {
    readonly state: StateByIdentifier<States, StateId>
    readonly event: EventOf<Events>
    readonly outputs: ParallelOutputRegions<States, StateId>
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
    readonly output?: NodeByIdentifier<States, StateId> extends { readonly type: "parallel" } ? (
        context: ParallelOutputContext<States, Events, StateId>
      ) => any
      : never
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
    readonly output?:
      | ((context: FinalOutputContext<States, Events, StateId>) => any)
      | ((context: ParallelOutputContext<States, Events, StateId>) => any)
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

/**
 * Returns `true` if a value is a `StateMachine`.
 *
 * @category guards
 * @since 4.0.0
 */
export const isMachine = (
  u: unknown
): u is Machine.Any => hasProperty(u, TypeId)

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
> => internalRuntime.isFinal(machine, state)

/**
 * Defines state schema definitions while preserving literal state keys.
 *
 * @category constructors
 * @since 4.0.0
 */
export const defineStates = <
  const States extends Machine.StateSchemas
>(
  states: States & Machine.ValidateStateSchemas<States>
): Machine.DefinedStates<States> => ({
  states,
  initial: {} as Machine.InitialBuilder<States>
})

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
  self.stateNodes = Model.compileStateNodes(config.states)
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
> = internalRuntime.planInitial

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
): ReadonlyArray<Machine.TagOf<Events[number]>> => internalRuntime.enabled(machine, state)

/**
 * Plans the next state for a state machine without running deferred actions.
 *
 * @category combinators
 * @since 4.0.0
 */
export const plan = internalRuntime.plan

/**
 * Defers an effectful action until the current state machine step is planned.
 *
 * @category combinators
 * @since 4.0.0
 */
export const action = <E, R>(
  effect: Effect.Effect<void, E, R>
): Effect.Effect<void, E, R> => internalRuntime.action(effect)

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
> => internalRuntime.runtime<Protocol>()

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
> => internalRuntime.actorRuntime<Event>()

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
> = internalActor.toActorLogic as any

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
> = internalActor.start as any
