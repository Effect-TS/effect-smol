/**
 * Schema-first machine definitions.
 *
 * @since 4.0.0
 */

import * as Effect from "../../Effect.ts"
import { PipeInspectableProto } from "../../internal/core.ts"
import type { Pipeable } from "../../Pipeable.ts"
import { hasProperty } from "../../Predicate.ts"
import type * as Schema from "../../Schema.ts"
import type * as Scope from "../../Scope.ts"
import type * as Types from "../../Types.ts"
import type {
  ChildAlreadyExistsError,
  InfiniteTransitionError,
  MachineSchemaDecodeError,
  StartupError,
  UnhandledEventError
} from "./internal/machineErrors.ts"
import * as Model from "./internal/machineModel.ts"
import * as internalProcess from "./internal/machineProcess.ts"
import * as internalRuntime from "./internal/machineRuntime.ts"

/**
 * String literal type used as the runtime type identifier for `Machine`
 * values.
 *
 * @category type IDs
 * @since 4.0.0
 */
export type TypeId = "~effect/Machine"

/**
 * Runtime type identifier attached to `Machine` values.
 *
 * @category type IDs
 * @since 4.0.0
 */
export const TypeId: TypeId = "~effect/Machine"

/**
 * Type identifier used for the synthetic event passed to startup lifecycle
 * actions.
 *
 * @category type IDs
 * @since 4.0.0
 */
export const InitialEventTypeId: typeof internalRuntime.InitialEventTypeId = internalRuntime.InitialEventTypeId

/**
 * Synthetic event passed to entry, exit, always, invoke, and output callbacks
 * that run while the machine is settling its initial state.
 *
 * @category models
 * @since 4.0.0
 */
export interface InitialEvent {
  readonly _tag: typeof InitialEventTypeId
}

/**
 * Synthetic event value used while the machine settles its initial state.
 *
 * @category constructors
 * @since 4.0.0
 */
export const InitialEvent: InitialEvent = internalRuntime.InitialEvent

/**
 * Returns `true` if a value is the synthetic machine initial event.
 *
 * @category guards
 * @since 4.0.0
 */
export const isInitialEvent = (u: unknown): u is InitialEvent => hasProperty(u, "_tag") && u._tag === InitialEventTypeId

type IsAny<A> = 0 extends (1 & A) ? true : false

/**
 * A schema-first machine definition.
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
  Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
  OutputStates extends Machine.StateIdentifier<States> = never,
  LifecycleR = never,
  HandlerConfig = {}
> extends Pipeable {
  readonly [TypeId]: TypeId
  readonly states: States
  readonly events: Events
  readonly emits: Emits
  readonly input: Input | undefined
  readonly id: string | undefined

  /** @internal */
  readonly stateNodes: Machine.StateNodes

  /** @internal */
  readonly makeTargetBuilder: <Source extends Machine.StateIdentifier<States>>(
    source: Source
  ) => Machine.TargetBuilder<States, Source>

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
    Output,
    OutputStates,
    LifecycleR,
    HandlerConfig
  >

  /** @internal */
  readonly initial: (...args: [...Machine.InputArgs<Input>]) => Machine.InitialResult<States, InitialE, InitialR>
}

export {
  /**
   * Error returned by `spawn` when a child process with the same id already
   * exists for the current machine.
   *
   * @category errors
   * @since 4.0.0
   */
  ChildAlreadyExistsError,
  /**
   * Error returned when a machine does not stabilize within the maximum
   * number of macrostep iterations.
   *
   * @category errors
   * @since 4.0.0
   */
  InfiniteTransitionError,
  /**
   * Error returned when a machine contract value does not match the schema
   * declared for a machine boundary.
   *
   * @category errors
   * @since 4.0.0
   */
  MachineSchemaDecodeError,
  /**
   * Error returned when a machine fails while running startup lifecycle
   * logic after the initial state has been computed.
   *
   * @category errors
   * @since 4.0.0
   */
  StartupError,
  /**
   * Error returned by `join` when a running machine is stopped before
   * producing an output.
   *
   * @category errors
   * @since 4.0.0
   */
  StoppedError,
  /**
   * Error returned when an event has no handler for the current state.
   *
   * @category errors
   * @since 4.0.0
   */
  UnhandledEventError
} from "./internal/machineErrors.ts"

const RuntimeRequirementTypeId = "~effect/Machine/RuntimeRequirement"

/**
 * Runtime capability available to machine actions.
 *
 * @category models
 * @since 4.0.0
 */
export interface Runtime<in Events, in Emits> {
  readonly raise: (event: Events) => Effect.Effect<void, MachineSchemaDecodeError>
  readonly sendParent: (event: Emits) => Effect.Effect<void, MachineSchemaDecodeError>
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
   * Opaque service requirement for a machine runtime capability.
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

const RuntimeCompatibilityErrorTypeId = "~effect/Machine/RuntimeCompatibilityError"

type EnsureCompatibleRuntime<Requirements, Events, Emits> = [IncompatibleRuntime<Requirements, Events, Emits>] extends
  [never] ? unknown : {
  readonly [RuntimeCompatibilityErrorTypeId]: IncompatibleRuntime<Requirements, Events, Emits>
}

type StateDefinitionError<Message extends string> = {
  readonly "~effect/Machine/DefinitionError": Message
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

type ValidateOutputSchema<Node> = "output" extends keyof Node ? Node extends { readonly output: Schema.Top } ? unknown
  : StateDefinitionError<"State output must be a schema">
  : unknown

type ValidateStateNodeWithChildren<
  Node extends { readonly schema: Machine.TaggedSchema },
  Children
> = Children extends Machine.StateSchemas
  ? Node extends { readonly type: "final" } ? StateDefinitionError<"Final states cannot declare child states">
  : Node extends { readonly type: "parallel" }
    ? "initial" extends keyof Node ? StateDefinitionError<"Parallel states cannot declare an initial child">
    : { readonly states: ValidateStateTree<Children> } & ValidateOutputSchema<Node>
  : "output" extends keyof Node ? StateDefinitionError<"Only final and parallel states can declare output">
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
  : Node extends { readonly type: infer Type } ? Type extends "final" ? ValidateOutputSchema<Node>
    : Type extends "active" | undefined
      ? "output" extends keyof Node ? StateDefinitionError<"Only final and parallel states can declare output">
      : unknown
    : StateDefinitionError<"State node type must be active, final, or parallel">
  : "output" extends keyof Node ? StateDefinitionError<"Only final and parallel states can declare output">
  : unknown

type DefineStateTreeInput<States extends Machine.StateSchemas> = {
  readonly [Key in keyof States]: DefineStateNodeInput<States[Key]>
}

type DefineStateNodeInput<Node> = Node extends Machine.TaggedSchema ? Node
  : Node extends { readonly type: "parallel"; readonly states: infer Children extends Machine.StateSchemas }
    ? Omit<Node, "states"> & { readonly states: DefineStateTreeInput<Children> }
  : Node extends { readonly states: infer Children extends Machine.StateSchemas } ? Omit<Node, "initial" | "states"> & {
      readonly initial: Extract<keyof Children, string>
      readonly states: DefineStateTreeInput<Children>
    }
  : Node

type ValidateDefinedStates<States extends Machine.StateSchemas> = [States] extends
  [Machine.ValidateStateSchemas<States>] ? []
  : [validation: Machine.ValidateStateSchemas<States>]

type FlatStateError = StateDefinitionError<"Flat machines cannot declare compound or parallel states">

type NestedStateCheck<S> = S extends { readonly schema: any; readonly states: any } ? true : never

type ValidateFlat<States extends Machine.StateSchemas> = [true] extends [NestedStateCheck<States[keyof States]>]
  ? [flat: FlatStateError]
  : []

const SnapshotBuilderStateTypeId: unique symbol = Symbol("effect/Machine/SnapshotBuilderState")

type SnapshotBuilderComplete<Regions> = {
  readonly [SnapshotBuilderStateTypeId]: Regions
}

type InitialSnapshotBuilderWithPrefix<
  States extends Machine.StateSchemas,
  Prefix extends string = ""
> = {
  readonly [Key in Extract<keyof States, string>]: InitialSnapshotMethod<States, Key, Prefix>
}

type InitialSnapshotMethod<
  States extends Machine.StateSchemas,
  StateId extends Extract<keyof States, string>,
  Prefix extends string
> = (
  ...args: InitialSnapshotArguments<States, StateId, Prefix>
) => InitialSnapshotResult<States, StateId, Prefix>

type InitialSnapshotArguments<
  States extends Machine.StateSchemas,
  StateId extends Extract<keyof States, string>,
  Prefix extends string,
  Path extends string = Machine.JoinPath<Prefix, StateId>
> = States[StateId] extends infer Node
  ? Node extends { readonly type: "parallel"; readonly states: infer Children extends Machine.StateSchemas } ? [
      value: Machine.NodeSchema<Node>["Type"],
      states: (
        builder: InitialParallelBuilder<Children, Path>
      ) => SnapshotBuilderComplete<InitialSnapshotRegionsWithPrefix<Children, Path>>
    ]
  : Node extends { readonly states: infer Children extends Machine.StateSchemas }
    ? Node extends { readonly initial: infer Initial extends Extract<keyof Children, string> } ? [
        value: Machine.NodeSchema<Node>["Type"],
        state: (
          builder: Pick<InitialSnapshotBuilderWithPrefix<Children, Path>, Initial>
        ) => InitialSnapshotResult<Children, Initial, Path>
      ]
    : never
  : [value: Machine.NodeSchema<Node>["Type"]]
  : never

type InitialSnapshotResult<
  States extends Machine.StateSchemas,
  StateId extends Extract<keyof States, string>,
  Prefix extends string,
  Path extends string = Machine.JoinPath<Prefix, StateId>
> = States[StateId] extends infer Node
  ? Node extends { readonly type: "parallel"; readonly states: infer Children extends Machine.StateSchemas }
    ? Machine.ParallelSnapshot<
      Path,
      Machine.NodeSchema<Node>["Type"],
      InitialSnapshotRegionsWithPrefix<Children, Path>
    >
  : Node extends { readonly states: infer Children extends Machine.StateSchemas }
    ? Node extends { readonly initial: infer Initial extends Extract<keyof Children, string> }
      ? Machine.CompoundSnapshot<
        Path,
        Machine.NodeSchema<Node>["Type"],
        InitialSnapshotResult<Children, Initial, Path>
      >
    : never
  : Machine.AtomicSnapshot<Path, Machine.NodeSchema<Node>["Type"]>
  : never

type InitialSnapshotRegionsWithPrefix<
  States extends Machine.StateSchemas,
  Prefix extends string
> = {
  readonly [Key in Extract<keyof States, string>]: InitialSnapshotResult<States, Key, Prefix>
}

type InitialParallelBuilder<
  States extends Machine.StateSchemas,
  Prefix extends string,
  Remaining extends Extract<keyof States, string> = Extract<keyof States, string>,
  Regions = {}
> =
  & SnapshotBuilderComplete<Regions>
  & {
    readonly [Key in Remaining]: (
      ...args: InitialSnapshotArguments<States, Key, Prefix>
    ) => InitialParallelBuilder<
      States,
      Prefix,
      Exclude<Remaining, Key>,
      Regions & { readonly [Region in Key]: InitialSnapshotResult<States, Key, Prefix> }
    >
  }

type FullSnapshotBuilderWithPrefix<
  States extends Machine.StateSchemas,
  Prefix extends string = ""
> = {
  readonly [Key in Extract<keyof States, string>]: FullSnapshotMethod<States, Key, Prefix>
}

type FullSnapshotMethod<
  States extends Machine.StateSchemas,
  StateId extends Extract<keyof States, string>,
  Prefix extends string
> = (
  ...args: FullSnapshotArguments<States, StateId, Prefix>
) => FullSnapshotResult<States, StateId, Prefix>

type FullSnapshotArguments<
  States extends Machine.StateSchemas,
  StateId extends Extract<keyof States, string>,
  Prefix extends string,
  Path extends string = Machine.JoinPath<Prefix, StateId>
> = States[StateId] extends infer Node
  ? Node extends { readonly type: "parallel"; readonly states: infer Children extends Machine.StateSchemas } ? [
      value: Machine.NodeSchema<Node>["Type"],
      states: (
        builder: FullParallelBuilder<Children, Path>
      ) => SnapshotBuilderComplete<Machine.SnapshotRegionsWithPrefix<Children, Path>>
    ]
  : Node extends { readonly states: infer Children extends Machine.StateSchemas } ? [
      value: Machine.NodeSchema<Node>["Type"],
      state: (
        builder: FullSnapshotBuilderWithPrefix<Children, Path>
      ) => Machine.SnapshotWithPrefix<Children, Path>
    ]
  : [value: Machine.NodeSchema<Node>["Type"]]
  : never

type FullSnapshotResult<
  States extends Machine.StateSchemas,
  StateId extends Extract<keyof States, string>,
  Prefix extends string,
  Path extends string = Machine.JoinPath<Prefix, StateId>
> = Machine.SnapshotByIdentifierWithPath<States, StateId, Path>

type FullParallelBuilder<
  States extends Machine.StateSchemas,
  Prefix extends string,
  Remaining extends Extract<keyof States, string> = Extract<keyof States, string>,
  Regions = {}
> =
  & SnapshotBuilderComplete<Regions>
  & {
    readonly [Key in Remaining]: (
      ...args: FullSnapshotArguments<States, Key, Prefix>
    ) => FullParallelBuilder<
      States,
      Prefix,
      Exclude<Remaining, Key>,
      Regions & { readonly [Region in Key]: FullSnapshotResult<States, Key, Prefix> }
    >
  }

type ParentPath<Path extends string> = Path extends `${infer Parent}.${infer Child}`
  ? Child extends `${string}.${string}` ? `${Parent}.${ParentPath<Child>}` : Parent
  : never

type IsCompoundNode<Node> = Node extends { readonly type: "parallel" } ? false
  : Node extends { readonly states: Machine.StateSchemas } ? true
  : false

type NearestCompoundScope<
  States extends Machine.StateSchemas,
  Source extends Machine.StateIdentifier<States>
> = IsCompoundNode<Machine.NodeByIdentifier<States, Source>> extends true ? Source
  : ParentPath<Source> extends infer Parent extends Machine.StateIdentifier<States>
    ? NearestCompoundScope<States, Parent>
  : never

type ChildrenOf<
  States extends Machine.StateSchemas,
  Path extends Machine.StateIdentifier<States>
> = Machine.NodeByIdentifier<States, Path> extends { readonly states: infer Children extends Machine.StateSchemas }
  ? Children
  : never

type StateIdentifierFromPath<
  States extends Machine.StateSchemas,
  Path extends string
> = Extract<Path, Machine.StateIdentifier<States>>

type LocalTargetResult<
  AllStates extends Machine.StateSchemas,
  States extends Machine.StateSchemas,
  StateId extends Extract<keyof States, string>,
  Prefix extends string,
  Path extends string = Machine.JoinPath<Prefix, StateId>
> = States[StateId] extends { readonly states: infer Children extends Machine.StateSchemas }
  ? LocalTargetResultWithPrefix<AllStates, Children, Path>
  : Machine.Target<AllStates, StateIdentifierFromPath<AllStates, Path>>

type LocalTargetResultWithPrefix<
  AllStates extends Machine.StateSchemas,
  States extends Machine.StateSchemas,
  Prefix extends string
> = {
  readonly [Key in Extract<keyof States, string>]: LocalTargetResult<AllStates, States, Key, Prefix>
}[Extract<keyof States, string>]

type LocalTargetBuilderWithPrefix<
  AllStates extends Machine.StateSchemas,
  States extends Machine.StateSchemas,
  Prefix extends string
> = {
  readonly [Key in Extract<keyof States, string>]: LocalTargetMethod<AllStates, States, Key, Prefix>
}

type LocalTargetMethod<
  AllStates extends Machine.StateSchemas,
  States extends Machine.StateSchemas,
  StateId extends Extract<keyof States, string>,
  Prefix extends string,
  Path extends string = Machine.JoinPath<Prefix, StateId>
> = States[StateId] extends infer Node
  ? Node extends { readonly states: infer Children extends Machine.StateSchemas } ? <
      Result extends LocalTargetResultWithPrefix<
        AllStates,
        Children,
        Path
      >
    >(
      value: Machine.NodeSchema<Node>["Type"],
      state: (
        builder: LocalTargetBuilderWithPrefix<AllStates, Children, Path>
      ) => Result
    ) => Result
  : (value: Machine.NodeSchema<Node>["Type"]) => Machine.Target<AllStates, StateIdentifierFromPath<AllStates, Path>>
  : never

type LocalTargetBuilderForScope<
  States extends Machine.StateSchemas,
  Scope extends Machine.StateIdentifier<States>
> = ChildrenOf<States, Scope> extends infer Children extends Machine.StateSchemas ?
    & LocalTargetBuilderWithPrefix<States, Children, Scope>
    & {
      readonly with: <Result extends LocalTargetResultWithPrefix<States, Children, Scope>>(
        value: Machine.StateByIdentifier<States, Scope>,
        state: (
          builder: LocalTargetBuilderWithPrefix<States, Children, Scope>
        ) => Result
      ) => Result
    }
  : {}

type BranchTargetResult<
  AllStates extends Machine.StateSchemas,
  States extends Machine.StateSchemas,
  StateId extends Extract<keyof States, string>,
  Prefix extends string,
  Path extends string = Machine.JoinPath<Prefix, StateId>
> = States[StateId] extends { readonly states: infer Children extends Machine.StateSchemas }
  ? BranchTargetResultWithPrefix<AllStates, Children, Path>
  : Machine.Target<AllStates, StateIdentifierFromPath<AllStates, Path>>

type BranchTargetResultWithPrefix<
  AllStates extends Machine.StateSchemas,
  States extends Machine.StateSchemas,
  Prefix extends string
> = {
  readonly [Key in Extract<keyof States, string>]: BranchTargetResult<AllStates, States, Key, Prefix>
}[Extract<keyof States, string>]

type BranchTargetBuilderWithPrefix<
  AllStates extends Machine.StateSchemas,
  States extends Machine.StateSchemas,
  Prefix extends string
> = {
  readonly [Key in Extract<keyof States, string>]: BranchTargetMethod<AllStates, States, Key, Prefix>
}

type BranchTargetMethod<
  AllStates extends Machine.StateSchemas,
  States extends Machine.StateSchemas,
  StateId extends Extract<keyof States, string>,
  Prefix extends string,
  Path extends string = Machine.JoinPath<Prefix, StateId>
> = States[StateId] extends infer Node ?
  Node extends { readonly states: infer Children extends Machine.StateSchemas } ?
      & (<Result extends BranchTargetResultWithPrefix<AllStates, Children, Path>>(
        value: Machine.NodeSchema<Node>["Type"],
        state: (
          builder: BranchTargetBuilderWithPrefix<AllStates, Children, Path>
        ) => Result
      ) => Result)
      & BranchTargetBuilderWithPrefix<AllStates, Children, Path>
  : (value: Machine.NodeSchema<Node>["Type"]) => Machine.Target<AllStates, StateIdentifierFromPath<AllStates, Path>>
  : never

type BranchTargetBuilderForRoot<
  States extends Machine.StateSchemas,
  Root extends Extract<keyof States, string>
> = {
  readonly [Key in Root]: BranchTargetMethod<States, States, Key, "">
}

type SpawnRequirements<Requirements> = Exclude<
  Requirements,
  Scope.Scope
>

type SpawnIdError<Options extends SpawnOptions> = "id" extends keyof Options ? Options extends {
    readonly id?: infer Id
  } ? [Id] extends [undefined] ? never : ChildAlreadyExistsError
  : ChildAlreadyExistsError
  : never

type SpawnError<Options extends SpawnOptions> = SpawnIdError<Options>

type SpawnResult<State, Event, Error, Requirements, Output, SpawnError, InitialError = never> = Effect.Effect<
  MachineRef<State, Event, Error | InitialError, Output>,
  SpawnError | InitialError,
  internalRuntime.MachineRuntime | SpawnRequirements<Requirements>
>

/**
 * Lifecycle-aware snapshot of a running machine.
 *
 * @category models
 * @since 4.0.0
 */
export type RuntimeSnapshot<State, Error = never, Output = never> = internalRuntime.RuntimeSnapshot<
  State,
  Error,
  Output
>

/**
 * Terminal lifecycle outcome derived from a runtime snapshot.
 *
 * @category models
 * @since 4.0.0
 */
export type RuntimeOutcome<State, Error = never, Output = never> = internalRuntime.RuntimeOutcome<
  State,
  Error,
  Output
>

/**
 * Running machine handle with current state, lifecycle snapshots, and a
 * stop action.
 *
 * @category models
 * @since 4.0.0
 */
export type MachineRef<State, Event, Error = never, Output = never> = internalRuntime.MachineRef<
  State,
  Event,
  Error,
  Output
>

const ChildAddressTypeId = "~effect/Machine/ChildAddress"
const ChildAddressCompatibilityErrorTypeId = "~effect/Machine/ChildAddressCompatibilityError"

/**
 * Parent-local address for a child process that can receive events.
 *
 * @category models
 * @since 4.0.0
 */
export type ChildAddress<Event> = string & ChildAddress.Variance<Event>

/**
 * Namespace containing type-level members associated with `ChildAddress`.
 *
 * @since 4.0.0
 */
export declare namespace ChildAddress {
  /**
   * Variance marker carried by a typed child process address.
   *
   * @category models
   * @since 4.0.0
   */
  export interface Variance<in Event> {
    readonly [ChildAddressTypeId]: {
      readonly _Event: Types.Contravariant<Event>
    }
  }

  /**
   * Extracts the event protocol accepted by a child address.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type Event<Address> = Address extends ChildAddress<infer Event> ? Event : unknown

  /**
   * Ensures a child address protocol is compatible with a child process event
   * protocol.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type Compatibility<Address, Event> = [Address] extends [ChildAddress<infer AddressEvent>]
    ? [AddressEvent] extends [Event] ? unknown : {
      readonly [ChildAddressCompatibilityErrorTypeId]: {
        readonly address: AddressEvent
        readonly child: Event
      }
    }
    : unknown

  /**
   * Ensures spawn options with a typed child address are compatible with a
   * child process event protocol.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type OptionsCompatibility<Options, Event> = "id" extends keyof Options ? Options extends {
      readonly id?: infer Address
    } ? Compatibility<Exclude<Address, undefined>, Event>
    : unknown
    : unknown
}

/**
 * Options for spawning child processes.
 *
 * @category models
 * @since 4.0.0
 */
export interface SpawnOptions {
  readonly id?: string
}

/**
 * Options for spawning child processes with a parent-local id.
 *
 * @category models
 * @since 4.0.0
 */
export interface SpawnIdOptions extends SpawnOptions {
  readonly id: string
}

/**
 * Namespace containing type-level members associated with `Machine`.
 *
 * @since 4.0.0
 */
export declare namespace Machine {
  /**
   * Any schema-first machine.
   *
   * @category models
   * @since 4.0.0
   */
  export type Any = Machine<any, any, any, any, any, any, any, any, any, any, any, any, any>

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
  export type AtomicStateNodeConfig =
    | {
      readonly schema: TaggedSchema
      readonly type?: "active"
      readonly output?: never
    }
    | {
      readonly schema: TaggedSchema
      readonly type: "final"
      readonly output?: Schema.Top
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
    readonly output?: Schema.Top
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
   * Builder for initial state snapshots generated by `defineStates`.
   *
   * **When to use**
   *
   * Use when you need the type of the `initial` property returned by
   * `defineStates` or want to expose an initial snapshot builder from a helper.
   *
   * **Details**
   *
   * Initial builders enforce the declared initial child for compound states and
   * require every direct region for parallel states.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type InitialBuilder<States extends StateSchemas> = InitialSnapshotBuilderWithPrefix<States>

  /**
   * State definitions and snapshot builders returned by `defineStates`.
   *
   * **Details**
   *
   * The `states` property is the original state tree and can be passed directly
   * to `make`. The `initial` property builds path-safe snapshots for the same
   * state tree.
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
   * Validates that a state tree is flat — no compound or parallel nodes.
   *
   * **Details**
   *
   * Used by {@link make} and {@link plan} to enforce that only atomic state
   * nodes are accepted, ensuring the path-narrowed `PlanServices` is sound.
   * Resolves to `[]` (no extra argument needed) when all states are flat, or
   * to a single-element tuple with a definition error when any state declares
   * child `states`.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type ValidateFlat<States extends StateSchemas> = [true] extends [NestedStateCheck<States[keyof States]>]
    ? [flat: StateDefinitionError<"Flat machines cannot declare compound or parallel states">]
    : []

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
    readonly output: Schema.Top | undefined
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
      ? Children extends StateSchemas
        ? JoinPath<Prefix, Key> | StateIdentifierWithPrefix<Children, JoinPath<Prefix, Key>>
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
   * Event values received by lifecycle callbacks.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type LifecycleEvent<Events extends ReadonlyArray<TaggedSchema>> = EventOf<Events> | InitialEvent

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

  type UndefinedIfNever<A> = [A] extends [never] ? undefined : A

  type NodeOutput<Node> = Node extends { readonly output: infer Output extends Schema.Top } ? Schema.Schema.Type<Output>
    : undefined

  /**
   * Extracts the declared output type for a state node.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type OutputByIdentifier<
    States extends StateSchemas,
    StateId extends StateIdentifier<States>
  > = NodeOutput<NodeByIdentifier<States, StateId>>

  type DirectFinalCompletionOutput<
    States extends StateSchemas,
    StateId extends StateIdentifier<States>
  > = NodeByIdentifier<States, StateId> extends { readonly type: "final" } ? OutputByIdentifier<States, StateId>
    : never

  type CompoundCompletionOutput<
    States extends StateSchemas,
    Children extends StateSchemas,
    Prefix extends StateIdentifier<States>
  > = UndefinedIfNever<
    {
      readonly [Key in Extract<keyof Children, string>]: DirectFinalCompletionOutput<
        States,
        Extract<JoinPath<Prefix, Key>, StateIdentifier<States>>
      >
    }[Extract<keyof Children, string>]
  >

  /**
   * Extracts the output passed when a state node completes.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type CompletionOutputByIdentifier<
    States extends StateSchemas,
    StateId extends StateIdentifier<States>
  > = NodeByIdentifier<States, StateId> extends infer Node
    ? Node extends { readonly type: "parallel" } ? OutputByIdentifier<States, StateId>
    : Node extends { readonly states: infer Children extends StateSchemas } ? CompoundCompletionOutput<
        States,
        Children,
        StateId
      >
    : Node extends { readonly type: "final" } ? OutputByIdentifier<States, StateId>
    : undefined
    : undefined

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
   * Builder for complete transition snapshots.
   *
   * **When to use**
   *
   * Use when a transition enters an inactive root or otherwise needs to provide
   * every active child below the selected root.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type FullTargetBuilder<States extends StateSchemas> = FullSnapshotBuilderWithPrefix<States>

  /**
   * Builder for source-local transition targets.
   *
   * **When to use**
   *
   * Use when a transition stays inside the nearest active compound ancestor of
   * the source state and should preserve active ancestor and sibling values.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type LocalTargetBuilder<
    States extends StateSchemas,
    Source extends StateIdentifier<States>
  > = NearestCompoundScope<States, Source> extends infer Scope ? [Scope] extends [never] ? {}
    : Scope extends StateIdentifier<States> ? LocalTargetBuilderForScope<States, Scope>
    : {}
    : {}

  /**
   * Builder for partial transition targets within the active source root.
   *
   * **When to use**
   *
   * Use when a transition should replace one descendant of the active source
   * root while preserving unmentioned active ancestors or parallel regions.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type BranchTargetBuilder<
    States extends StateSchemas,
    Source extends StateIdentifier<States>
  > = BranchTargetBuilderForRoot<States, Extract<RootStateIdentifier<Source>, Extract<keyof States, string>>>

  /**
   * Machine-bound target builders available in transition contexts.
   *
   * **Details**
   *
   * `local` targets the nearest compound scope for the source state, `branch`
   * targets descendants of the source root, and `full` builds complete
   * snapshots for any root.
   *
   * @category models
   * @since 4.0.0
   */
  export interface TargetBuilder<
    States extends StateSchemas,
    Source extends StateIdentifier<States>
  > {
    readonly local: LocalTargetBuilder<States, Source>
    readonly branch: BranchTargetBuilder<States, Source>
    readonly full: FullTargetBuilder<States>
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
    readonly target: TargetBuilder<States, StateId>
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
    readonly event: LifecycleEvent<Events>
    readonly runtime: RuntimeEffect<Events, Emits>
  }

  /**
   * Context passed to an invoked child process source.
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
    readonly event: LifecycleEvent<Events>
    readonly runtime: RuntimeEffect<Events, Emits>
  }

  /**
   * Context passed to an invoked child process outcome mapper.
   *
   * @category models
   * @since 4.0.0
   */
  export interface InvokeEventContext<State, Error, Output> {
    readonly id: string
    readonly outcome: RuntimeOutcome<State, Error, Output>
  }

  /**
   * Context passed to an invoked child process active snapshot mapper.
   *
   * @category models
   * @since 4.0.0
   */
  export interface InvokeSnapshotContext<State, Error, Output> {
    readonly id: string
    readonly snapshot: Extract<RuntimeSnapshot<State, Error, Output>, { readonly status: "active" }>
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
    readonly event: LifecycleEvent<Events>
    readonly runtime: RuntimeEffect<Events, Emits>
    readonly target: TargetBuilder<States, StateId>
  }

  /**
   * Context passed to a state completion transition handler.
   *
   * @category models
   * @since 4.0.0
   */
  export interface DoneContext<
    States extends StateSchemas,
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>,
    StateId extends StateIdentifier<States>
  > {
    readonly state: StateByIdentifier<States, StateId>
    readonly event: LifecycleEvent<Events>
    readonly output: CompletionOutputByIdentifier<States, StateId>
    readonly runtime: RuntimeEffect<Events, Emits>
    readonly target: TargetBuilder<States, StateId>
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
    readonly event: LifecycleEvent<Events>
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
      readonly [Key in Extract<keyof Children, string>]: CompletionOutputByIdentifier<
        States,
        Extract<JoinPath<StateId, Key>, StateIdentifier<States>>
      >
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
    readonly event: LifecycleEvent<Events>
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
    | Snapshot<States>
    | Effect.Effect<Snapshot<States>, E, R>

  /**
   * Return value accepted from transition handlers.
   *
   * **Details**
   *
   * Handlers return snapshots for complete state replacement or target builder
   * results for path-safe partial transitions. Raw decoded state values are not
   * accepted at transition boundaries.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type HandlerResult<States extends StateSchemas, E, R> =
    | Snapshot<States>
    | Target<States, StateIdentifier<States>>
    | void
    | Effect.Effect<Snapshot<States> | Target<States, StateIdentifier<States>> | void, E, R>

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
   * Extracts the child process logic returned by an invoke source.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type InvokeLogic<Invoke> = Invoke extends { readonly src: (...args: any) => infer Logic } ? Logic : never
  /**
   * Extracts the startup error from an invoke source child process logic.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type InvokeInitialError<Invoke> = InvokeLogic<Invoke> extends
    internalRuntime.ProcessLogic<any, any, any, any, any, infer InitialError> ? InitialError : never
  /**
   * Extracts the service requirements from an invoke source child process logic.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type InvokeServices<Invoke> = InvokeLogic<Invoke> extends
    internalRuntime.ProcessLogic<any, any, any, infer Requirements, any, any> ? Requirements : never
  /**
   * Extracts the parent transition error contribution from invoked children.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type InvokeError<Config> = [InvokeReturn<Config>] extends [never] ? never
    : ChildAlreadyExistsError | InvokeInitialError<InvokeReturn<Config>>
  /**
   * Extracts the parent service requirement contribution from invoked children.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type InvokeRequirements<Config> = [InvokeReturn<Config>] extends [never] ? never
    : internalRuntime.MachineRuntime | InvokeServices<InvokeReturn<Config>>
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
   * Extracts the return value from a state completion transition.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type DoneReturn<Config> = Config extends { readonly onDone?: infer OnDone }
    ? NonNullable<OnDone> extends (...args: any) => infer Ret ? Ret : never
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
    | Effect.Services<DoneReturn<Config>>
    | Effect.Services<StateActionReturn<Config, "entry">>
    | Effect.Services<StateActionReturn<Config, "exit">>
    | InvokeRequirements<Config>

  type SnapshotLeafPath<Snapshot> = Snapshot extends { readonly state: infer Child } ? SnapshotLeafPath<Child>
    : Snapshot extends { readonly states: infer Regions } ? SnapshotLeafPath<Regions[keyof Regions]>
    : Snapshot extends { readonly path: infer Path extends string } ? Path
    : never

  type ChainToRoot<Path extends string> = Path extends `${infer Parent}.${string}` ? Path | ChainToRoot<Parent>
    : Path

  type ConfigAtPath<Config, Path extends string> = Config extends unknown
    ? Path extends `${infer Head}.${infer Rest}`
      ? Head extends keyof Config ? Config[Head] extends { readonly states?: infer Children } ? ConfigAtPath<
            NonNullable<Children>,
            Rest
          >
        : never
      : never
    : Path extends keyof Config ? HandlerConfigPart<Config[Path]>
    : never
    : never

  type EventTagOf<Event> = Event extends { readonly _tag: infer Tag extends PropertyKey } ? Tag : never

  type EventTransitionAtConfig<Config, Event> = Config extends { readonly on?: infer On }
    ? EventTagOf<Event> extends keyof NonNullable<On> ? NonNullable<NonNullable<On>[EventTagOf<Event>]> : never
    : never

  type EventTransitionServicesForPath<Config, Path extends string, Event> = Effect.Services<
    EventTransitionReturn<EventTransitionAtConfig<ConfigAtPath<Config, Path>, Event>>
  >

  type LifecycleServices<Config> = Config extends unknown ? Config extends object ? {
        readonly [Key in keyof Config]:
          | Effect.Services<AlwaysReturn<HandlerConfigPart<Config[Key]>>>
          | Effect.Services<DoneReturn<HandlerConfigPart<Config[Key]>>>
          | Effect.Services<StateActionReturn<HandlerConfigPart<Config[Key]>, "entry">>
          | Effect.Services<StateActionReturn<HandlerConfigPart<Config[Key]>, "exit">>
          | (Config[Key] extends { readonly states?: infer Children } ? LifecycleServices<NonNullable<Children>>
            : never)
      }[keyof Config]
    : never
    : never

  type LifecycleServicesForPath<Config, Path extends string> =
    | Effect.Services<AlwaysReturn<ConfigAtPath<Config, Path>>>
    | Effect.Services<DoneReturn<ConfigAtPath<Config, Path>>>
    | Effect.Services<StateActionReturn<ConfigAtPath<Config, Path>, "entry">>
    | Effect.Services<StateActionReturn<ConfigAtPath<Config, Path>, "exit">>

  type LifecycleServicesForChain<Config, Chain> = Chain extends string ? LifecycleServicesForPath<Config, Chain>
    : never

  type LifecycleErrorsForPath<Config, Path extends string> =
    | Effect.Error<AlwaysReturn<ConfigAtPath<Config, Path>>>
    | Effect.Error<DoneReturn<ConfigAtPath<Config, Path>>>
    | Effect.Error<StateActionReturn<ConfigAtPath<Config, Path>, "entry">>
    | Effect.Error<StateActionReturn<ConfigAtPath<Config, Path>, "exit">>

  type LifecycleErrorsForChain<Config, Chain> = Chain extends string ? LifecycleErrorsForPath<Config, Chain>
    : never

  /**
   * Paths whose lifecycle handlers (entry, exit, always, onDone) can fire during
   * a macrostep starting from `Snapshot` with `Event`.
   *
   * The source chain (leaf-to-root of the active snapshot) covers exit handlers
   * that fire when leaving the source state. The target chain (leaf-to-root of
   * the handler's return target, extracted from {@link PlanResult}) covers entry
   * and always handlers that fire after the transition. Together they bound the
   * lifecycle contribution to the paths the runtime actually walks during the
   * direct transition, rather than the union of every handler in the machine.
   *
   * The iterative settle loop (always→transition→always, raised events) can
   * reach further paths in deeply nested machines; that over-approximation is
   * accepted as a known limitation of static plan typing.
   *
   * @category utility types
   * @since 4.0.0
   */
  type PlanLifecyclePaths<Config, Snapshot, Event> =
    | ChainToRoot<Extract<SnapshotLeafPath<Snapshot>, string>>
    | ChainToRoot<Extract<SnapshotLeafPath<PlanResult<Config, Snapshot, Event>>, string>>

  /**
   * Service requirements needed to plan a concrete state/event pair.
   *
   * Event handler requirements are selected from the planned snapshot's active
   * leaf path up to its root (matching the runtime's leaf-to-root event
   * selection), and the event tag. Lifecycle requirements (entry, exit, always,
   * onDone) are narrowed to the source and target leaf-to-root chains — the
   * paths the runtime actually walks during the direct transition — rather than
   * the union of every handler in the machine.
   *
   * The `LifecycleR` parameter is retained for signature compatibility but is
   * not included in the result: the path-narrowed computation replaces the
   * coarse machine-wide union. For flat machines (leaf == root, single-level
   * state trees) the two are equivalent; for nested machines the narrowing
   * excludes lifecycle handlers on subtrees the transition does not touch.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type PlanServices<Config, LifecycleR, Snapshot, Event> =
    | EventTransitionServicesForPath<Config, ChainToRoot<Extract<SnapshotLeafPath<Snapshot>, string>>, Event>
    | LifecycleServicesForChain<Config, PlanLifecyclePaths<Config, Snapshot, Event>>

  type EventTransitionErrorsForPath<Config, Path extends string, Event> = Effect.Error<
    EventTransitionReturn<EventTransitionAtConfig<ConfigAtPath<Config, Path>, Event>>
  >

  type HandlerSuccess<T> = T extends Effect.Effect<infer A, any, any> ? A : T

  type EventTransitionSuccessForPath<Config, Path extends string, Event> = HandlerSuccess<
    EventTransitionReturn<EventTransitionAtConfig<ConfigAtPath<Config, Path>, Event>>
  >

  export type LifecycleErrors<Config> = Config extends unknown ? Config extends object ? {
        readonly [Key in keyof Config]:
          | Effect.Error<AlwaysReturn<HandlerConfigPart<Config[Key]>>>
          | Effect.Error<DoneReturn<HandlerConfigPart<Config[Key]>>>
          | Effect.Error<StateActionReturn<HandlerConfigPart<Config[Key]>, "entry">>
          | Effect.Error<StateActionReturn<HandlerConfigPart<Config[Key]>, "exit">>
          | (Config[Key] extends { readonly states?: infer Children } ? LifecycleErrors<NonNullable<Children>>
            : never)
      }[keyof Config]
    : never
    : never

  /**
   * Error channel for planning a concrete state/event pair — the mirror of
   * {@link PlanServices}. Only the handler selected along the planned snapshot's
   * active leaf-to-root path and event tag contributes its error, plus lifecycle
   * handlers (entry, exit, always, onDone) on the source and target chains that
   * a macrostep may run, so each transition surfaces only the errors it can
   * actually raise (rather than the union of every handler in the machine).
   *
   * @category utility types
   * @since 4.0.0
   */
  export type PlanErrors<Config, Snapshot, Event> =
    | EventTransitionErrorsForPath<Config, ChainToRoot<Extract<SnapshotLeafPath<Snapshot>, string>>, Event>
    | LifecycleErrorsForChain<Config, PlanLifecyclePaths<Config, Snapshot, Event>>

  /**
   * Success type for planning a concrete state/event pair — the narrowed snapshot
   * the matched handler transitions to. Mirrors {@link PlanErrors}.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type PlanResult<Config, Snapshot, Event> = EventTransitionSuccessForPath<
    Config,
    ChainToRoot<Extract<SnapshotLeafPath<Snapshot>, string>>,
    Event
  >

  /**
   * Service requirements for {@link plan}, automatically selecting sound
   * path-narrowed requirements for flat machines and falling back to the coarse
   * machine-wide `LifecycleR` union for nested machines.
   *
   * **Details**
   *
   * When `States` is flat (no compound/parallel nodes — enforced by
   * {@link make}), the path-narrowed {@link PlanServices} is sound because the
   * iterative settle loop cannot cascade through compound subtrees. When
   * `States` is nested (compound/parallel — via {@link makeNested}), the settle
   * loop can reach lifecycle handlers outside the direct transition's
   * source/target chains, so `LifecycleR` and `LifecycleErrors` are unioned in
   * as a safe over-approximation.
   *
   * **Known limitation: raised events**
   *
   * `Runtime.raise(event)` enqueues an event as a side effect and returns
   * `Effect<void, MachineSchemaDecodeError>` — `R = never`. The raised event's
   * own event-handler requirements are not part of the handler's return type,
   * so they cannot be statically tracked. `PlanServices` only accounts for the
   * *original* event's handler. The lifecycle side of the raised transition
   * (entry/exit/always) is covered by `LifecycleR` in nested mode, but the
   * raised event's handler services are invisible to the type system. Fixing
   * this requires encoding raised events into the handler's return type (an API
   * change), not just additional type-level computation. This limitation is
   * inherited from the upstream `effect/unstable/machine` module (PR #2351).
   *
   * @category utility types
   * @since 4.0.0
   */
  export type PlanServicesFor<States extends StateSchemas, Config, LifecycleR, Snapshot, Event> = [true] extends
    [NestedStateCheck<States[keyof States]>] ? PlanServices<Config, LifecycleR, Snapshot, Event> | LifecycleR
    : PlanServices<Config, LifecycleR, Snapshot, Event>

  /**
   * Error channel for {@link plan}, automatically selecting sound path-narrowed
   * errors for flat machines and falling back to the coarse machine-wide
   * `LifecycleErrors` for nested machines. Mirror of {@link PlanServicesFor}.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type PlanErrorsFor<States extends StateSchemas, Config, Snapshot, Event> = [true] extends
    [NestedStateCheck<States[keyof States]>] ? PlanErrors<Config, Snapshot, Event> | LifecycleErrors<Config>
    : PlanErrors<Config, Snapshot, Event>

  type HandledPathsFor<Config, AllPaths extends string, Event> = AllPaths extends string
    ? EventTransitionAtConfig<ConfigAtPath<Config, AllPaths>, Event> extends never ? never : AllPaths
    : never

  /**
   * The subset of `AllSnapshot` whose active leaf-to-root path has a registered
   * handler for `Event`. Passing a `SnapshotFor`-constrained state to
   * {@link planSafe} eliminates `UnhandledEventError` from the error channel.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type SnapshotFor<Config, AllSnapshot, Event> = AllSnapshot extends {
    readonly path: infer _Path extends string
  } ? [
      HandledPathsFor<
        Config,
        ChainToRoot<Extract<SnapshotLeafPath<AllSnapshot>, string>>,
        Event
      >
    ] extends [never] ? never
    : AllSnapshot
    : never

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
   * Configuration for invoking a child process while a state is active.
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
    ): internalRuntime.ProcessLogic<
      ChildState,
      ChildEvent,
      ChildError,
      ChildRequirements,
      ChildOutput,
      ChildInitialError
    >
    event?(
      context: InvokeEventContext<ChildState, ChildError | ChildInitialError, ChildOutput>
    ): Event | undefined
    snapshot?(
      context: InvokeSnapshotContext<ChildState, ChildError | ChildInitialError, ChildOutput>
    ): Event | undefined
  }

  type OutputHandlerConfig<
    States extends StateSchemas,
    Events extends ReadonlyArray<TaggedSchema>,
    StateId extends StateIdentifier<States>,
    Context
  > = NodeByIdentifier<States, StateId> extends { readonly output: Schema.Top } ? {
      readonly output: (context: Context) => OutputByIdentifier<States, StateId>
    }
    : {
      readonly output?: never
    }

  type ActiveOutputHandlerConfig<
    States extends StateSchemas,
    Events extends ReadonlyArray<TaggedSchema>,
    StateId extends StateIdentifier<States>
  > = NodeByIdentifier<States, StateId> extends { readonly type: "parallel" } ? OutputHandlerConfig<
      States,
      Events,
      StateId,
      ParallelOutputContext<States, Events, StateId>
    >
    : {
      readonly output?: never
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
    readonly onDone?: (context: DoneContext<States, Events, Emits, StateId>) => HandlerResult<States, any, any>
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
  } & ActiveOutputHandlerConfig<States, Events, StateId>

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
    readonly exit?: never
    readonly always?: never
    readonly onDone?: never
    readonly on?: never
  } & OutputHandlerConfig<States, Events, StateId, FinalOutputContext<States, Events, StateId>>

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

  type HandlerChildren<Node> = Node extends { readonly states: infer Children extends StateSchemas } ? Children : never

  type HandlerStateId<
    States extends StateSchemas,
    Path extends string
  > = StateIdentifierFromPath<States, Path>

  type HandlerConfigPart<Config> = {
    readonly [Key in keyof Config as Key extends "states" ? never : Key]: Config[Key]
  }

  type HandlerNode<
    AllStates extends StateSchemas,
    Node,
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>,
    E,
    R,
    StateId extends StateIdentifier<AllStates>
  > =
    & HandlerConfig<AllStates, Events, Emits, StateId, E, R>
    & (HandlerChildren<Node> extends infer Children extends StateSchemas ? [Children] extends [never] ? {
          readonly states?: never
        }
      : {
        readonly states?: HandlerTree<AllStates, Children, Events, Emits, E, R, StateId>
      }
      : {
        readonly states?: never
      })

  type HandlerTree<
    AllStates extends StateSchemas,
    States extends StateSchemas,
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>,
    E,
    R,
    Prefix extends string
  > = {
    readonly [Key in Extract<keyof States, string>]?: HandlerNode<
      AllStates,
      States[Key],
      Events,
      Emits,
      E,
      R,
      HandlerStateId<AllStates, JoinPath<Prefix, Key>>
    >
  }

  type HandlerNodeConfigKey = "always" | "entry" | "exit" | "invoke" | "on" | "onDone" | "output" | "states" | "type"

  type HandlerValidationError<Message extends string> = {
    readonly "~effect/Machine/HandlerError": Message
  }

  type NodeHasDeclaredOutput<
    States extends StateSchemas,
    StateId extends StateIdentifier<States>
  > = NodeByIdentifier<States, StateId> extends { readonly output: Schema.Top } ? StateId : never

  type DirectFinalOutputState<
    States extends StateSchemas,
    StateId extends StateIdentifier<States>
  > = NodeByIdentifier<States, StateId> extends { readonly type: "final" } ? NodeHasDeclaredOutput<States, StateId>
    : never

  type CompoundCompletionOutputStates<
    States extends StateSchemas,
    Children extends StateSchemas,
    Prefix extends StateIdentifier<States>
  > = {
    readonly [Key in Extract<keyof Children, string>]: DirectFinalOutputState<
      States,
      Extract<JoinPath<Prefix, Key>, StateIdentifier<States>>
    >
  }[Extract<keyof Children, string>]

  type RequiredCompletionOutputStates<
    States extends StateSchemas,
    StateId extends StateIdentifier<States>
  > = NodeByIdentifier<States, StateId> extends infer Node
    ? Node extends { readonly type: "parallel" } ? NodeHasDeclaredOutput<States, StateId>
    : Node extends { readonly states: infer Children extends StateSchemas } ? CompoundCompletionOutputStates<
        States,
        Children,
        StateId
      >
    : never
    : never

  type RequiredParallelOutputStates<
    States extends StateSchemas,
    StateId extends StateIdentifier<States>
  > = NodeByIdentifier<States, StateId> extends
    { readonly type: "parallel"; readonly states: infer Children extends StateSchemas } ? {
      readonly [Key in Extract<keyof Children, string>]: RequiredCompletionOutputStates<
        States,
        Extract<JoinPath<StateId, Key>, StateIdentifier<States>>
      >
    }[Extract<keyof Children, string>]
    : never

  type HandlerOutputStates<
    AllStates extends StateSchemas,
    StateId extends StateIdentifier<AllStates>,
    Config
  > = "output" extends keyof Config ? StateId : never

  type UnionToIntersection<Union> = (
    Union extends unknown ? (argument: Union) => void : never
  ) extends (argument: infer Intersection) => void ? Intersection
    : never

  type HandlerUnknownStateKeyValidation<
    States extends StateSchemas,
    Config
  > = [Exclude<Extract<keyof Config, string>, Extract<keyof States, string>>] extends [never] ? unknown
    : HandlerValidationError<"Handler tree contains a state key that does not exist">

  type HandlerUnknownConfigKeyValidation<Config> = [
    Exclude<Extract<keyof Config, string>, HandlerNodeConfigKey>
  ] extends [never] ? unknown
    : HandlerValidationError<"Handler config contains an unknown key">

  type HandlerOnKeyValidation<
    Events extends ReadonlyArray<TaggedSchema>,
    Config
  > = Config extends { readonly on?: infer On } ? [
      Exclude<Extract<keyof NonNullable<On>, string>, TagOf<Events[number]>>
    ] extends [never] ? unknown
    : HandlerValidationError<"Handler config contains an event key that does not exist">
    : unknown

  type HandlerChildrenValidation<
    AllStates extends StateSchemas,
    Node,
    Events extends ReadonlyArray<TaggedSchema>,
    Prefix extends string,
    Config,
    AvailableOutputStates extends StateIdentifier<AllStates>
  > = "states" extends keyof Config
    ? Config extends { readonly states?: infer ChildrenConfig }
      ? HandlerChildren<Node> extends infer Children extends StateSchemas
        ? [Children] extends [never]
          ? HandlerValidationError<"Handler config contains child states for a state that has no children">
        : HandlerTreeValidation<AllStates, Children, Events, Prefix, NonNullable<ChildrenConfig>, AvailableOutputStates>
      : HandlerValidationError<"Handler config contains child states for a state that has no children">
    : unknown
    : unknown

  type HandlerOutputRequirementValidation<
    AllStates extends StateSchemas,
    StateId extends StateIdentifier<AllStates>,
    AvailableOutputStates extends StateIdentifier<AllStates>,
    Config
  > =
    & ("onDone" extends keyof Config ? [
        Exclude<RequiredCompletionOutputStates<AllStates, StateId>, AvailableOutputStates>
      ] extends [never] ? unknown
      : HandlerValidationError<"Handler config is missing an output implementation required by onDone">
      : unknown)
    & ("output" extends keyof Config ? NodeByIdentifier<AllStates, StateId> extends { readonly type: "parallel" } ? [
          Exclude<RequiredParallelOutputStates<AllStates, StateId>, AvailableOutputStates>
        ] extends [never] ? unknown
        : HandlerValidationError<"Handler config is missing a region output implementation required by parallel output">
      : unknown
      : unknown)

  type HandlerNodeValidation<
    AllStates extends StateSchemas,
    Node,
    Events extends ReadonlyArray<TaggedSchema>,
    StateId extends StateIdentifier<AllStates>,
    Config,
    AvailableOutputStates extends StateIdentifier<AllStates>
  > =
    & HandlerUnknownConfigKeyValidation<Config>
    & HandlerOnKeyValidation<Events, Config>
    & HandlerChildrenValidation<AllStates, Node, Events, StateId, Config, AvailableOutputStates>
    & HandlerOutputRequirementValidation<AllStates, StateId, AvailableOutputStates, Config>

  type HandlerTreeNodeValidations<
    AllStates extends StateSchemas,
    States extends StateSchemas,
    Events extends ReadonlyArray<TaggedSchema>,
    Prefix extends string,
    Config,
    AvailableOutputStates extends StateIdentifier<AllStates>
  > = UnionToIntersection<
    {
      readonly [Key in Extract<Extract<keyof Config, string>, Extract<keyof States, string>>]: HandlerNodeValidation<
        AllStates,
        States[Key],
        Events,
        HandlerStateId<AllStates, JoinPath<Prefix, Key>>,
        Config[Key],
        AvailableOutputStates
      >
    }[Extract<Extract<keyof Config, string>, Extract<keyof States, string>>]
  >

  type HandlerTreeValidation<
    AllStates extends StateSchemas,
    States extends StateSchemas,
    Events extends ReadonlyArray<TaggedSchema>,
    Prefix extends string,
    Config,
    AvailableOutputStates extends StateIdentifier<AllStates>
  > =
    & HandlerUnknownStateKeyValidation<States, Config>
    & HandlerTreeNodeValidations<AllStates, States, Events, Prefix, Config, AvailableOutputStates>

  type HandlerNodeChildrenConfig<Config> = "states" extends keyof Config
    ? Config extends { readonly states?: infer Children } ? NonNullable<Children>
    : never
    : never

  type HandlerDepth = readonly [unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown]

  type HandlerNextDepth<Depth extends ReadonlyArray<unknown>> = Depth extends
    readonly [unknown, ...infer Rest extends ReadonlyArray<unknown>] ? Rest
    : readonly []

  type HandlerTreeStateIds<
    AllStates extends StateSchemas,
    States extends StateSchemas,
    Prefix extends string,
    Config,
    Depth extends ReadonlyArray<unknown> = HandlerDepth
  > = {
    readonly [Key in Extract<Extract<keyof Config, string>, Extract<keyof States, string>>]:
      | HandlerStateId<AllStates, JoinPath<Prefix, Key>>
      | HandlerNodeChildStateIds<
        AllStates,
        States[Key],
        HandlerStateId<AllStates, JoinPath<Prefix, Key>>,
        Config[Key],
        Depth
      >
  }[Extract<Extract<keyof Config, string>, Extract<keyof States, string>>]

  type HandlerNodeChildStateIds<
    AllStates extends StateSchemas,
    Node,
    Prefix extends string,
    Config,
    Depth extends ReadonlyArray<unknown>
  > = Depth extends readonly [] ? never
    : HandlerChildren<Node> extends infer Children extends StateSchemas ? [Children] extends [never] ? never
      : HandlerTreeStateIds<AllStates, Children, Prefix, HandlerNodeChildrenConfig<Config>, HandlerNextDepth<Depth>>
    : never

  type HandlerConfigError<Config> =
    | Effect.Error<EventHandlerReturn<Config>>
    | Effect.Error<AlwaysReturn<Config>>
    | Effect.Error<DoneReturn<Config>>
    | Effect.Error<StateActionReturn<Config, "entry">>
    | Effect.Error<StateActionReturn<Config, "exit">>
    | InvokeError<Config>

  type HandlerTreeError<
    AllStates extends StateSchemas,
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>,
    States extends StateSchemas,
    Prefix extends string,
    Config,
    Depth extends ReadonlyArray<unknown> = HandlerDepth
  > = {
    readonly [Key in Extract<Extract<keyof Config, string>, Extract<keyof States, string>>]:
      | HandlerConfigError<HandlerConfigPart<Config[Key]>>
      | HandlerNodeChildError<
        AllStates,
        Events,
        Emits,
        States[Key],
        HandlerStateId<AllStates, JoinPath<Prefix, Key>>,
        Config[Key],
        Depth
      >
  }[Extract<Extract<keyof Config, string>, Extract<keyof States, string>>]

  type HandlerNodeChildError<
    AllStates extends StateSchemas,
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>,
    Node,
    Prefix extends string,
    Config,
    Depth extends ReadonlyArray<unknown>
  > = Depth extends readonly [] ? never
    : HandlerChildren<Node> extends infer Children extends StateSchemas ? [Children] extends [never] ? never
      : HandlerTreeError<
        AllStates,
        Events,
        Emits,
        Children,
        Prefix,
        HandlerNodeChildrenConfig<Config>,
        HandlerNextDepth<Depth>
      >
    : never

  type HandlerTreeServices<
    AllStates extends StateSchemas,
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>,
    States extends StateSchemas,
    Prefix extends string,
    Config,
    Depth extends ReadonlyArray<unknown> = HandlerDepth
  > = {
    readonly [Key in Extract<Extract<keyof Config, string>, Extract<keyof States, string>>]:
      | ConfigServices<HandlerConfigPart<Config[Key]>>
      | HandlerNodeChildServices<
        AllStates,
        Events,
        Emits,
        States[Key],
        HandlerStateId<AllStates, JoinPath<Prefix, Key>>,
        Config[Key],
        Depth
      >
  }[Extract<Extract<keyof Config, string>, Extract<keyof States, string>>]

  type HandlerNodeChildServices<
    AllStates extends StateSchemas,
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>,
    Node,
    Prefix extends string,
    Config,
    Depth extends ReadonlyArray<unknown>
  > = Depth extends readonly [] ? never
    : HandlerChildren<Node> extends infer Children extends StateSchemas ? [Children] extends [never] ? never
      : HandlerTreeServices<
        AllStates,
        Events,
        Emits,
        Children,
        Prefix,
        HandlerNodeChildrenConfig<Config>,
        HandlerNextDepth<Depth>
      >
    : never

  type HandlerTreeFinalStates<
    AllStates extends StateSchemas,
    States extends StateSchemas,
    Prefix extends string,
    Config,
    Depth extends ReadonlyArray<unknown> = HandlerDepth
  > = {
    readonly [Key in Extract<Extract<keyof Config, string>, Extract<keyof States, string>>]:
      | Extract<
        FinalStateFromConfig<HandlerConfigPart<Config[Key]>, HandlerStateId<AllStates, JoinPath<Prefix, Key>>>,
        StateIdentifier<AllStates>
      >
      | HandlerNodeChildFinalStates<
        AllStates,
        States[Key],
        HandlerStateId<AllStates, JoinPath<Prefix, Key>>,
        Config[Key],
        Depth
      >
  }[Extract<Extract<keyof Config, string>, Extract<keyof States, string>>]

  type HandlerNodeChildFinalStates<
    AllStates extends StateSchemas,
    Node,
    Prefix extends string,
    Config,
    Depth extends ReadonlyArray<unknown>
  > = Depth extends readonly [] ? never
    : HandlerChildren<Node> extends infer Children extends StateSchemas ? [Children] extends [never] ? never
      : HandlerTreeFinalStates<AllStates, Children, Prefix, HandlerNodeChildrenConfig<Config>, HandlerNextDepth<Depth>>
    : never

  type HandlerTreeOutput<
    AllStates extends StateSchemas,
    States extends StateSchemas,
    Prefix extends string,
    Config,
    Depth extends ReadonlyArray<unknown> = HandlerDepth
  > = {
    readonly [Key in Extract<Extract<keyof Config, string>, Extract<keyof States, string>>]:
      | ("output" extends keyof HandlerConfigPart<Config[Key]> ? OutputByIdentifier<
          AllStates,
          HandlerStateId<AllStates, JoinPath<Prefix, Key>>
        >
        : never)
      | HandlerNodeChildOutput<
        AllStates,
        States[Key],
        HandlerStateId<AllStates, JoinPath<Prefix, Key>>,
        Config[Key],
        Depth
      >
  }[Extract<Extract<keyof Config, string>, Extract<keyof States, string>>]

  type HandlerNodeChildOutput<
    AllStates extends StateSchemas,
    Node,
    Prefix extends string,
    Config,
    Depth extends ReadonlyArray<unknown>
  > = Depth extends readonly [] ? never
    : HandlerChildren<Node> extends infer Children extends StateSchemas ? [Children] extends [never] ? never
      : HandlerTreeOutput<AllStates, Children, Prefix, HandlerNodeChildrenConfig<Config>, HandlerNextDepth<Depth>>
    : never

  type HandlerTreeOutputStates<
    AllStates extends StateSchemas,
    States extends StateSchemas,
    Prefix extends string,
    Config,
    Depth extends ReadonlyArray<unknown> = HandlerDepth
  > = {
    readonly [Key in Extract<Extract<keyof Config, string>, Extract<keyof States, string>>]:
      | HandlerOutputStates<
        AllStates,
        HandlerStateId<AllStates, JoinPath<Prefix, Key>>,
        HandlerConfigPart<Config[Key]>
      >
      | HandlerNodeChildOutputStates<
        AllStates,
        States[Key],
        HandlerStateId<AllStates, JoinPath<Prefix, Key>>,
        Config[Key],
        Depth
      >
  }[Extract<Extract<keyof Config, string>, Extract<keyof States, string>>]

  type HandlerNodeChildOutputStates<
    AllStates extends StateSchemas,
    Node,
    Prefix extends string,
    Config,
    Depth extends ReadonlyArray<unknown>
  > = Depth extends readonly [] ? never
    : HandlerChildren<Node> extends infer Children extends StateSchemas ? [Children] extends [never] ? never
      : HandlerTreeOutputStates<AllStates, Children, Prefix, HandlerNodeChildrenConfig<Config>, HandlerNextDepth<Depth>>
    : never

  type HandleTreeResult<
    AllStates extends StateSchemas,
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>,
    Input extends Schema.Top,
    UnhandledStates extends StateIdentifier<AllStates>,
    E,
    R,
    InitialE,
    InitialR,
    FinalStates extends StateIdentifier<AllStates>,
    Output,
    OutputStates extends StateIdentifier<AllStates>,
    PreviousLifecycleR,
    PreviousConfig,
    Config
  > = Machine<
    AllStates,
    Events,
    Input,
    Exclude<UnhandledStates, HandlerTreeStateIds<AllStates, AllStates, "", Config>>,
    E | HandlerTreeError<AllStates, Events, Emits, AllStates, "", Config>,
    ExcludeCompatibleRuntime<
      R | HandlerTreeServices<AllStates, Events, Emits, AllStates, "", Config>,
      EventOf<Events>,
      EmitOf<Emits>
    >,
    InitialE,
    InitialR,
    FinalStates | Extract<HandlerTreeFinalStates<AllStates, AllStates, "", Config>, StateIdentifier<AllStates>>,
    Output | HandlerTreeOutput<AllStates, AllStates, "", Config>,
    Emits,
    OutputStates | Extract<HandlerTreeOutputStates<AllStates, AllStates, "", Config>, StateIdentifier<AllStates>>,
    PreviousLifecycleR | LifecycleServices<Config>,
    PreviousConfig | Config
  >

  /**
   * Adds state handlers from a root state object.
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
    Output,
    OutputStates extends StateIdentifier<States>,
    LifecycleR,
    HandlerConfig
  > {
    <const Config extends HandlerTree<States, States, Events, Emits, E, R, "">>(
      config:
        & Config
        & HandlerTreeValidation<
          States,
          States,
          Events,
          "",
          Config,
          OutputStates | Extract<HandlerTreeOutputStates<States, States, "", Config>, StateIdentifier<States>>
        >
        & EnsureCompatibleRuntime<
          HandlerTreeServices<States, Events, Emits, States, "", Config>,
          EventOf<Events>,
          EmitOf<Emits>
        >
    ): HandleTreeResult<
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
      Output,
      OutputStates,
      LifecycleR,
      HandlerConfig,
      Config
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
    readonly onDone?: (context: DoneContext<States, Events, Emits, StateId>) => HandlerResult<States, E, R>
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
  toJSON() {
    return {
      _id: "Machine"
    }
  }
}

const cloneWithHandlers = (
  self: Machine.Any,
  handlers: Machine.StateConfigs<any, any, any, any, any, any, any>
): Machine.Any => {
  const machine = Object.create(Proto)
  machine.states = self.states
  machine.events = self.events
  machine.emits = self.emits
  machine.input = self.input
  machine.id = self.id
  machine.initial = self.initial
  machine.stateNodes = self.stateNodes
  machine.makeTargetBuilder = self.makeTargetBuilder
  machine.handlers = handlers
  machine.handle = makeHandle(machine)
  return machine
}

const flattenHandlers = (
  handlers: Record<PropertyKey, Machine.AnyStateConfig>,
  states: Machine.StateTree,
  prefix: string,
  config: Record<string, unknown>
): void => {
  for (const key of Object.keys(config)) {
    const path = prefix === "" ? key : `${prefix}.${key}`
    if (!hasProperty(states, key)) {
      throw new Error(`Machine received handler for unknown state "${path}"`)
    }
    const nodeConfig = config[key]
    if (typeof nodeConfig !== "object" || nodeConfig === null) {
      throw new Error(`Machine expected state "${path}" handler to be an object`)
    }
    const { states: childConfig, ...stateConfig } = nodeConfig as Record<string, unknown>
    handlers[path] = stateConfig as Machine.AnyStateConfig
    if (childConfig !== undefined) {
      const node = Model.getStateNodeDefinition(path, states[key]!)
      if (node.states === undefined) {
        throw new Error(`Machine expected state "${path}" to declare child states`)
      }
      if (typeof childConfig !== "object" || childConfig === null) {
        throw new Error(`Machine expected state "${path}" child handlers to be an object`)
      }
      flattenHandlers(handlers, node.states, path, childConfig as Record<string, unknown>)
    }
  }
}

const makeHandle = (self: Machine.Any): Machine.Any["handle"] =>
  ((config: Record<string, unknown>) => {
    const handlers: Record<PropertyKey, Machine.AnyStateConfig> = { ...self.handlers }
    flattenHandlers(handlers, self.states, "", config)
    return cloneWithHandlers(self, handlers)
  }) as Machine.Any["handle"]

/**
 * Returns `true` if a value is a `Machine`.
 *
 * @category guards
 * @since 4.0.0
 */
export const isMachine = (
  u: unknown
): u is Machine.Any => hasProperty(u, TypeId)

/**
 * Returns `true` if a state snapshot is final for a machine.
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
  state: Machine.Snapshot<States>
): state is Machine.SnapshotContainingFinal<States, FinalStates> => internalRuntime.isFinal(machine, state)

type SnapshotBuilderOptions = {
  readonly mode: "initial" | "full"
  readonly prefix: string
}

const makeSnapshotBuilder = (
  states: Machine.StateTree,
  options: SnapshotBuilderOptions
): unknown => {
  const builder: Record<string, unknown> = {}
  for (const key of Object.keys(states)) {
    builder[key] = (value: unknown, selector?: (builder: unknown) => unknown) =>
      makeSnapshotForNode(states[key]!, key, value, selector, options)
  }
  return builder
}

const makeParallelSnapshotBuilder = (
  states: Machine.StateTree,
  options: SnapshotBuilderOptions,
  regions: Readonly<Record<string, unknown>>
): unknown => {
  const builder: Record<string, unknown> = {}
  Object.defineProperty(builder, SnapshotBuilderStateTypeId, {
    value: regions,
    enumerable: false
  })
  for (const key of Object.keys(states)) {
    if (hasProperty(regions, key)) {
      continue
    }
    builder[key] = (value: unknown, selector?: (builder: unknown) => unknown) => {
      const nextRegions: Record<string, unknown> = {}
      for (const regionKey of Object.keys(regions)) {
        nextRegions[regionKey] = regions[regionKey]
      }
      nextRegions[key] = makeSnapshotForNode(states[key]!, key, value, selector, options)
      return makeParallelSnapshotBuilder(states, options, nextRegions)
    }
  }
  return builder
}

const getParallelSnapshotBuilderRegions = (
  path: string,
  states: Machine.StateTree,
  builder: unknown
): Readonly<Record<string, unknown>> => {
  if (typeof builder !== "object" || builder === null || !hasProperty(builder, SnapshotBuilderStateTypeId)) {
    throw new Error(`Machine expected parallel state "${path}" builder callback to return a builder`)
  }
  const regions = (builder as { readonly [SnapshotBuilderStateTypeId]: Readonly<Record<string, unknown>> })[
    SnapshotBuilderStateTypeId
  ]
  for (const key of Object.keys(states)) {
    if (!hasProperty(regions, key)) {
      throw new Error(`Machine expected parallel state "${path}" builder callback to provide region "${key}"`)
    }
  }
  return regions
}

const makeSnapshotForNode = (
  definition: Machine.TaggedSchema | Machine.StateNodeConfig,
  key: string,
  value: unknown,
  selector: ((builder: unknown) => unknown) | undefined,
  options: SnapshotBuilderOptions
): Record<string, unknown> => {
  const path = options.prefix === "" ? key : `${options.prefix}.${key}`
  const node = Model.getStateNodeDefinition(path, definition)
  const snapshot: Record<string, unknown> = {
    path,
    value
  }
  if (node.states === undefined) {
    return snapshot
  }
  if (selector === undefined) {
    throw new Error(`Machine expected state "${path}" builder to provide active child states`)
  }
  if (node.type === "parallel") {
    const builder = makeParallelSnapshotBuilder(node.states, { ...options, prefix: path }, {})
    snapshot["states"] = getParallelSnapshotBuilderRegions(path, node.states, selector(builder))
    return snapshot
  }
  const childStates = options.mode === "initial" && node.initial !== undefined
    ? { [node.initial]: node.states[node.initial]! }
    : node.states
  snapshot["state"] = selector(makeSnapshotBuilder(childStates, { ...options, prefix: path }))
  return snapshot
}

const getTargetBuilderNode = (
  stateNodes: Machine.StateNodes,
  path: string
): Machine.StateNode => {
  const node = stateNodes.byPath.get(path)
  if (node === undefined) {
    throw new Error(`Machine expected state path "${path}" to exist`)
  }
  return node
}

const getLocalTargetScope = (
  stateNodes: Machine.StateNodes,
  source: string
): string | undefined => {
  let current: string | undefined = source
  while (current !== undefined) {
    const node = stateNodes.byPath.get(current)
    if (node === undefined) {
      return undefined
    }
    if (node.type === "compound") {
      return node.path
    }
    current = node.parent
  }
  return undefined
}

const hasTargetValues = (
  values: Readonly<Record<string, unknown>> | undefined
): values is Readonly<Record<string, unknown>> => values !== undefined && Object.keys(values).length > 0

const makeTargetWithValues = (
  path: string,
  value: unknown,
  values: Readonly<Record<string, unknown>> | undefined
): Machine.Target<any, any> =>
  hasTargetValues(values)
    ? Model.makeTarget(path as any, value as any, { values: values as any })
    : Model.makeTarget(path as any, value as any)

const extendTargetValues = (
  values: Readonly<Record<string, unknown>> | undefined,
  path: string,
  value: unknown
): Readonly<Record<string, unknown>> => {
  const next: Record<string, unknown> = {}
  if (values !== undefined) {
    for (const key of Object.keys(values)) {
      next[key] = values[key]
    }
  }
  next[path] = value
  return next
}

const makeLocalTargetChildBuilder = (
  stateNodes: Machine.StateNodes,
  parentPath: string,
  values: Readonly<Record<string, unknown>> | undefined
): unknown => {
  const parent = getTargetBuilderNode(stateNodes, parentPath)
  const builder: Record<string, unknown> = {}
  for (const childPath of parent.children) {
    const child = getTargetBuilderNode(stateNodes, childPath)
    builder[child.key] = (value: unknown, selector?: (builder: unknown) => unknown) => {
      if (child.type === "atomic" || child.type === "final") {
        return makeTargetWithValues(child.path, value, values)
      }
      if (selector === undefined) {
        throw new Error(`Machine expected target "${child.path}" builder to provide an active child state`)
      }
      return selector(makeLocalTargetChildBuilder(
        stateNodes,
        child.path,
        extendTargetValues(values, child.path, value)
      ))
    }
  }
  return builder
}

const makeLocalTargetBuilder = (
  stateNodes: Machine.StateNodes,
  source: string
): unknown => {
  const scope = getLocalTargetScope(stateNodes, source)
  if (scope === undefined) {
    return {}
  }
  const builder = makeLocalTargetChildBuilder(stateNodes, scope, undefined) as Record<string, unknown>
  builder["with"] = (value: unknown, selector?: (builder: unknown) => unknown) => {
    if (selector === undefined) {
      throw new Error(`Machine expected target "${scope}" builder to provide an active child state`)
    }
    return selector(makeLocalTargetChildBuilder(stateNodes, scope, { [scope]: value }))
  }
  return builder
}

const addBranchTargetChildren = (
  builder: Record<string, unknown>,
  stateNodes: Machine.StateNodes,
  parentPath: string,
  values: Readonly<Record<string, unknown>> | undefined
): void => {
  const parent = getTargetBuilderNode(stateNodes, parentPath)
  for (const childPath of parent.children) {
    const child = getTargetBuilderNode(stateNodes, childPath)
    builder[child.key] = makeBranchTargetNodeBuilder(stateNodes, child.path, values)
  }
}

const makeBranchTargetNodeBuilder = (
  stateNodes: Machine.StateNodes,
  path: string,
  values: Readonly<Record<string, unknown>> | undefined
): unknown => {
  const node = getTargetBuilderNode(stateNodes, path)
  if (node.type === "atomic" || node.type === "final") {
    return (value: unknown) => makeTargetWithValues(node.path, value, values)
  }
  const builder = ((value: unknown, selector?: (builder: unknown) => unknown) => {
    if (selector === undefined) {
      throw new Error(`Machine expected target "${node.path}" builder to provide an active child state`)
    }
    const nextBuilder: Record<string, unknown> = {}
    addBranchTargetChildren(nextBuilder, stateNodes, node.path, extendTargetValues(values, node.path, value))
    return selector(nextBuilder)
  }) as unknown as Record<string, unknown>
  addBranchTargetChildren(builder, stateNodes, node.path, values)
  return builder
}

const makeBranchTargetBuilder = (
  stateNodes: Machine.StateNodes,
  source: string
): unknown => {
  const rootPath = source.split(".")[0]!
  const root = getTargetBuilderNode(stateNodes, rootPath)
  return {
    [root.key]: makeBranchTargetNodeBuilder(stateNodes, root.path, undefined)
  }
}

const makeTargetBuilder = <const States extends Machine.StateSchemas>(
  states: States,
  stateNodes: Machine.StateNodes
) => {
  const full = makeSnapshotBuilder(states, { mode: "full", prefix: "" }) as Machine.FullTargetBuilder<States>
  return <Source extends Machine.StateIdentifier<States>>(source: Source): Machine.TargetBuilder<States, Source> =>
    ({
      local: makeLocalTargetBuilder(stateNodes, source),
      branch: makeBranchTargetBuilder(stateNodes, source),
      full
    }) as Machine.TargetBuilder<States, Source>
}

/**
 * Defines a state tree while preserving literal state paths.
 *
 * **When to use**
 *
 * Use when you want to pass a state tree to `make` and also get typed
 * snapshot builders for initial states and tests.
 *
 * **Details**
 *
 * The returned `states` property is the same object passed to `defineStates`.
 * The returned `initial` builder creates snapshots without user-authored path
 * strings and enforces compound and parallel initial-state rules.
 *
 * **Example** (Atomic initial snapshot)
 *
 * ```ts
 * import { Schema } from "effect"
 * import { Machine } from "#lib/prelude/unstable/machine"
 *
 * class Idle extends Schema.TaggedClass<Idle>("Idle")("Idle", {}) {}
 *
 * const States = Machine.defineStates({ idle: Idle })
 *
 * Machine.make({
 *   states: States.states,
 *   events: [],
 *   initial: () => States.initial.idle(new Idle({}))
 * })
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
export const defineStates = <
  const States extends Machine.StateSchemas
>(
  states: DefineStateTreeInput<States>,
  ..._validation: ValidateDefinedStates<States>
): Machine.DefinedStates<States> => ({
  states: states as States,
  initial: makeSnapshotBuilder(states as States, { mode: "initial", prefix: "" }) as Machine.InitialBuilder<States>
})

/**
 * Creates a schema-first flat machine definition.
 *
 * **Details**
 *
 * Only atomic state nodes (bare tagged schemas or atomic configs without child
 * `states`) are accepted. Compound and parallel state nodes are rejected at
 * compile time via {@link Machine.ValidateFlat}, because the sound
 * path-narrowed {@link plan} cannot account for lifecycle handlers reachable
 * only through the iterative settle loop (always→transition→always, raised
 * events) in nested state trees.
 *
 * Use {@link makeNested} for compound/parallel state trees; its
 * {@link planNested} falls back to the coarse machine-wide `LifecycleR` union.
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
  },
  ..._flat: ValidateFlat<States>
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
  self.makeTargetBuilder = makeTargetBuilder(config.states, self.stateNodes)
  self.handlers = {}
  self.handle = makeHandle(self)
  return self
}

/**
 * Creates a schema-first machine definition that supports compound and parallel
 * state nodes.
 *
 * **Details**
 *
 * Unlike {@link make}, this constructor accepts the full `StateSchemas` range
 * including nested compound/parallel subtrees. The trade-off is that
 * {@link planNested} (not {@link plan}) must be used for planning: it falls
 * back to the coarse machine-wide `LifecycleR` union, because the sound
 * path-narrowed `PlanServices` cannot statically account for lifecycle handlers
 * reachable through the iterative settle loop in nested state trees.
 *
 * @category constructors
 * @since 4.0.0
 */
export const makeNested = <
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
  self.makeTargetBuilder = makeTargetBuilder(config.states, self.stateNodes)
  self.handlers = {}
  self.handle = makeHandle(self)
  return self
}

/**
 * Creates an invoked child process configuration for an active state.
 *
 * **When to use**
 *
 * Use to run a child process while a machine remains in a state and map the
 * child's active snapshots or terminal lifecycle outcome back into machine
 * events.
 *
 * **Gotchas**
 *
 * Invoked child processes run while their owning state is active and are
 * stopped before the state exits.
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
    ) => internalRuntime.ProcessLogic<
      ChildState,
      ChildEvent,
      ChildError,
      ChildRequirements,
      ChildOutput,
      ChildInitialError
    >
    readonly event?: (
      context: Machine.InvokeEventContext<ChildState, ChildError | ChildInitialError, ChildOutput>
    ) => Event | undefined
    readonly snapshot?: (
      context: Machine.InvokeSnapshotContext<ChildState, ChildError | ChildInitialError, ChildOutput>
    ) => Event | undefined
  } & ChildAddress.Compatibility<Id, ChildEvent>
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
 * Plans the initial state for a machine without running deferred actions.
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
    readonly actions: ReadonlyArray<
      Effect.Effect<void, InitialE | MachineSchemaDecodeError | StartupError, InitialR | R>
    >
    readonly output: Output | undefined
  },
  InitialE | MachineSchemaDecodeError | StartupError,
  ExcludeCompatibleRuntime<InitialR | R, Machine.EventOf<Events>, Machine.EmitOf<Emits>>
> = internalRuntime.planInitial

/**
 * Returns the event tags handled by the current state snapshot.
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
  state: Machine.Snapshot<States>
): ReadonlyArray<Machine.TagOf<Events[number]>> => internalRuntime.enabled(machine, state)

/**
 * Plans the next state snapshot without running deferred actions.
 *
 * Service requirements from event handlers are scoped to the concrete
 * state/event pair being planned. Lifecycle handlers that may run while the
 * macrostep settles (entry, exit, always, onDone) still contribute their
 * requirements to the plan.
 *
 * @category combinators
 * @since 4.0.0
 */
/**
 * Extracts the `HandlerConfig` type parameter from a `Machine` instance.
 * Use this to wire `makeMachineStateAdapter`'s `HC` parameter without
 * repeating the config type manually.
 *
 * @category utility types
 * @since 4.0.0
 */
export type HandlerConfigOf<M> = M extends Machine<
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  infer HC
> ? HC
  : never

/**
 * Plans the next state snapshot without running deferred actions.
 *
 * **Details**
 *
 * Automatically selects sound path-narrowed requirements for flat machines
 * (created with {@link make}) and falls back to the coarse machine-wide
 * `LifecycleR` union for nested machines (created with {@link makeNested}).
 * There is no need to pick a variant — the `States` type parameter drives the
 * selection.
 *
 * @category combinators
 * @since 4.0.0
 */
export const plan: <
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
  OutputStates extends Machine.StateIdentifier<States> = never,
  LifecycleR = never,
  HandlerConfig = {},
  State extends Machine.Snapshot<States> = Machine.Snapshot<States>,
  Event extends Machine.EventOf<Events> = Machine.EventOf<Events>
>(
  machine: Machine<
    States,
    Events,
    Input,
    UnhandledStates,
    E,
    R,
    InitialE,
    InitialR,
    FinalStates,
    Output,
    Emits,
    OutputStates,
    LifecycleR,
    HandlerConfig
  >,
  state: State,
  event: Event
) => Effect.Effect<
  internalRuntime.MacrostepPlan<
    Machine.Snapshot<States>,
    Machine.EventOf<Events>,
    E,
    ExcludeCompatibleRuntime<
      Machine.PlanServicesFor<States, HandlerConfig, LifecycleR, State, Event>,
      Machine.EventOf<Events>,
      Machine.EmitOf<Emits>
    >,
    Output
  >,
  | Machine.PlanErrorsFor<States, HandlerConfig, State, Event>
  | InfiniteTransitionError
  | MachineSchemaDecodeError
  | UnhandledEventError,
  ExcludeCompatibleRuntime<
    Machine.PlanServicesFor<States, HandlerConfig, LifecycleR, State, Event>,
    Machine.EventOf<Events>,
    Machine.EmitOf<Emits>
  >
> = internalRuntime.plan as any

/**
 * Like {@link plan} but constrains `State` to only snapshots whose path has a
 * registered handler for `Event` (via {@link Machine.SnapshotFor}). In exchange,
 * `UnhandledEventError` is removed from the error channel — the type system
 * proves the transition is reachable.
 *
 * @since 4.0.0
 * @category combinators
 */
export const planSafe: <
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
  OutputStates extends Machine.StateIdentifier<States> = never,
  LifecycleR = never,
  HandlerConfig = {},
  Event extends Machine.EventOf<Events> = Machine.EventOf<Events>,
  State extends Machine.SnapshotFor<HandlerConfig, Machine.Snapshot<States>, Event> = Machine.SnapshotFor<
    HandlerConfig,
    Machine.Snapshot<States>,
    Event
  >
>(
  machine: Machine<
    States,
    Events,
    Input,
    UnhandledStates,
    E,
    R,
    InitialE,
    InitialR,
    FinalStates,
    Output,
    Emits,
    OutputStates,
    LifecycleR,
    HandlerConfig
  >,
  state: State,
  event: Event
) => Effect.Effect<
  internalRuntime.MacrostepPlan<
    Machine.Snapshot<States>,
    Machine.EventOf<Events>,
    E,
    ExcludeCompatibleRuntime<
      Machine.PlanServicesFor<States, HandlerConfig, LifecycleR, State, Event>,
      Machine.EventOf<Events>,
      Machine.EmitOf<Emits>
    >,
    Output
  >,
  | Machine.PlanErrorsFor<States, HandlerConfig, State, Event>
  | InfiniteTransitionError
  | MachineSchemaDecodeError,
  ExcludeCompatibleRuntime<
    Machine.PlanServicesFor<States, HandlerConfig, LifecycleR, State, Event>,
    Machine.EventOf<Events>,
    Machine.EmitOf<Emits>
  >
> = internalRuntime.plan as any

/**
 * Defers an effectful action until the current machine step is planned.
 *
 * @category combinators
 * @since 4.0.0
 */
export const action = <E, R>(
  effect: Effect.Effect<void, E, R>
): Effect.Effect<void, E, R> => internalRuntime.action(effect)

/**
 * Returns the typed runtime capability for the current machine.
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
 * Creates child process logic from low-level initialization and execution
 * methods.
 *
 * @category constructors
 * @since 4.0.0
 */
export const effect = <
  State,
  Event = any,
  Output = void,
  Error = never,
  Requirements = never,
  InitialError = never,
  InitialRequirements = never
>(
  options: {
    readonly initial:
      | State
      | ((
        scope: internalRuntime.ProcessScope<Event>
      ) => Effect.Effect<State, InitialError, InitialRequirements>)
    readonly run: (
      context: internalRuntime.ProcessContext<State, Event>
    ) => Effect.Effect<Output, Error, Requirements>
  }
): internalRuntime.ProcessLogic<
  State,
  Event,
  Error,
  Requirements | InitialRequirements,
  Output,
  InitialError
> => ({
  initial: (scope) =>
    typeof options.initial === "function"
      ? (options.initial as (
        scope: internalRuntime.ProcessScope<Event>
      ) => Effect.Effect<State, InitialError, InitialRequirements>)(scope)
      : Effect.succeed(options.initial),
  run: options.run
})

/**
 * Creates child process logic from an initial state and a transition function.
 *
 * @category constructors
 * @since 4.0.0
 */
export const transition = <State, Event, Error = never, Requirements = never>(
  initial: State,
  transition: (state: State, event: Event) => Effect.Effect<State, Error, Requirements>
): internalRuntime.ProcessLogic<State, Event, Error, Requirements, never> =>
  effect<State, Event, never, Error, Requirements>({
    initial,
    run: ({ receive, updateState }) =>
      receive.pipe(
        Effect.flatMap((event) => updateState((state) => transition(state, event))),
        Effect.forever
      )
  })

/**
 * Creates a typed parent-local address for a child process.
 *
 * @category constructors
 * @since 4.0.0
 */
export const child = <Event>(id: string): ChildAddress<Event> => id as ChildAddress<Event>

/**
 * Spawns a child process owned by the currently running machine.
 *
 * **When to use**
 *
 * Use to create child processes from machine actions when the child
 * should be addressed or stopped by the owning machine instead of tied to a
 * single state's `invoke` lifecycle.
 *
 * **Gotchas**
 *
 * This effect requires the machine runtime, so it only runs from machine
 * actions. A named child id must be unique for the current parent machine until
 * that child stops.
 *
 * @see {@link invoke} for children that start and stop with a state.
 * @see {@link sendTo} for sending events to named children.
 * @category runtime
 * @since 4.0.0
 */
export const spawn: {
  <ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, ChildInitialError = never>(
    logic: internalRuntime.ProcessLogic<
      ChildState,
      ChildEvent,
      ChildError,
      ChildRequirements,
      ChildOutput,
      ChildInitialError
    >
  ): SpawnResult<ChildState, ChildEvent, ChildError, ChildRequirements, ChildOutput, never, ChildInitialError>
  <
    ChildState,
    ChildEvent,
    ChildError,
    ChildRequirements,
    ChildOutput,
    Options extends SpawnOptions,
    ChildInitialError = never
  >(
    logic: internalRuntime.ProcessLogic<
      ChildState,
      ChildEvent,
      ChildError,
      ChildRequirements,
      ChildOutput,
      ChildInitialError
    >,
    options: Options & ChildAddress.OptionsCompatibility<Options, ChildEvent>
  ): SpawnResult<
    ChildState,
    ChildEvent,
    ChildError,
    ChildRequirements,
    ChildOutput,
    SpawnError<Options>,
    ChildInitialError
  >
} = ((
  logic: internalRuntime.ProcessLogic<any, any, any, any, any, any>,
  options?: SpawnOptions
) =>
  Effect.flatMap(
    internalRuntime.MachineRuntime,
    (runtime) => options === undefined ? runtime.spawn(logic) : (runtime.spawn as any)(logic, options)
  )) as any

/**
 * Sends an event to a named child process of the running machine.
 *
 * @category runtime
 * @since 4.0.0
 */
export const sendTo = <Address extends string>(
  id: Address,
  event: ChildAddress.Event<Address>
): Effect.Effect<void, never, internalRuntime.MachineRuntime> =>
  Effect.flatMap(internalRuntime.MachineRuntime, (runtime) => runtime.sendTo(id, event))

/**
 * Stops a named child process of the running machine.
 *
 * @category runtime
 * @since 4.0.0
 */
export const stopChild = (id: string): Effect.Effect<void, never, internalRuntime.MachineRuntime> =>
  Effect.flatMap(internalRuntime.MachineRuntime, (runtime) => runtime.stopChild(id))

/**
 * Returns a stream of terminal lifecycle outcomes for a running machine.
 *
 * @category combinators
 * @since 4.0.0
 */
export const watch = internalRuntime.watch

/**
 * Starts a machine.
 *
 * **When to use**
 *
 * Use when you want asynchronous event delivery, lifecycle snapshots, `join`,
 * and machine-owned spawned or invoked children.
 *
 * **Gotchas**
 *
 * The returned handle's `send` operation only enqueues events. Transition
 * failures are reported through the runtime snapshot, `changes`, and `join`
 * rather than being returned by `send`.
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
  MachineRef<
    Machine.Snapshot<States>,
    Machine.EventOf<Events>,
    E | InitialE | InfiniteTransitionError | MachineSchemaDecodeError | StartupError | UnhandledEventError,
    Output | undefined
  >,
  InitialE | MachineSchemaDecodeError | StartupError,
  ExcludeCompatibleRuntime<
    Exclude<InitialR | R, internalRuntime.MachineRuntime>,
    Machine.EventOf<Events>,
    Machine.EmitOf<Emits>
  >
> = internalProcess.start as any
