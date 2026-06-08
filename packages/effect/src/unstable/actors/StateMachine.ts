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
import type * as Schema from "../../Schema.ts"
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

type IsAny<A> = 0 extends (1 & A) ? true : false

/**
 * A schema-first state machine definition.
 *
 * @category models
 * @since 4.0.0
 */
export interface Machine<
  States extends ReadonlyArray<Machine.TaggedSchema>,
  Events extends ReadonlyArray<Machine.TaggedSchema>,
  Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.TagOf<States[number]> = never,
  Output = never,
  Emits extends ReadonlyArray<Machine.TaggedSchema> = any
> extends Pipeable {
  readonly [TypeId]: TypeId
  readonly states: States
  readonly events: Events
  readonly emits: Emits
  readonly input: Input | undefined
  readonly id: string | undefined

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
   * Extracts the union of state values represented by a state schema list.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type StateOf<States extends ReadonlyArray<TaggedSchema>> = States[number]["Type"]

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
   * Extracts a state value from a state schema list by tag.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type StateByTag<
    States extends ReadonlyArray<TaggedSchema>,
    Tag extends TagOf<States[number]>
  > = Extract<StateOf<States>, { readonly _tag: Tag }>

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
   * Context passed to a state/event handler.
   *
   * @category models
   * @since 4.0.0
   */
  export interface HandlerContext<
    States extends ReadonlyArray<TaggedSchema>,
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>,
    StateTag extends TagOf<States[number]>,
    EventTag extends TagOf<Events[number]>,
    E,
    R
  > {
    readonly state: StateByTag<States, StateTag>
    readonly event: EventByTag<Events, EventTag>
    readonly runtime: RuntimeEffect<Events, Emits>
  }

  /**
   * Context passed to an entry or exit state handler.
   *
   * @category models
   * @since 4.0.0
   */
  export interface StateActionContext<
    States extends ReadonlyArray<TaggedSchema>,
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>,
    StateTag extends TagOf<States[number]>
  > {
    readonly state: StateByTag<States, StateTag>
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
    States extends ReadonlyArray<TaggedSchema>,
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>,
    StateTag extends TagOf<States[number]>
  > {
    readonly state: StateByTag<States, StateTag>
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
    States extends ReadonlyArray<TaggedSchema>,
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>,
    StateTag extends TagOf<States[number]>
  > {
    readonly state: StateByTag<States, StateTag>
    readonly event: EventOf<Events>
    readonly runtime: RuntimeEffect<Events, Emits>
  }

  /**
   * Context passed to a final state output function.
   *
   * @category models
   * @since 4.0.0
   */
  export interface FinalOutputContext<
    States extends ReadonlyArray<TaggedSchema>,
    Events extends ReadonlyArray<TaggedSchema>,
    StateTag extends TagOf<States[number]>
  > {
    readonly state: StateByTag<States, StateTag>
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
  export type InitialResult<States extends ReadonlyArray<TaggedSchema>, E, R> =
    | StateOf<States>
    | Effect.Effect<StateOf<States>, E, R>

  /**
   * Return value accepted from transition handlers.
   *
   * @category utility types
   * @since 4.0.0
   */
  export type HandlerResult<States extends ReadonlyArray<TaggedSchema>, E, R> =
    | StateOf<States>
    | void
    | Effect.Effect<StateOf<States> | void, E, R>

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
    States extends ReadonlyArray<TaggedSchema>,
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>,
    StateTag extends TagOf<States[number]>,
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
      context: InvokeContext<States, Events, Emits, StateTag>
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
    States extends ReadonlyArray<TaggedSchema>,
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>,
    StateTag extends TagOf<States[number]>,
    E,
    R
  > = {
    readonly type?: "active"
    readonly entry?: (context: StateActionContext<States, Events, Emits, StateTag>) => StateActionResult<any, any>
    readonly exit?: (context: StateActionContext<States, Events, Emits, StateTag>) => StateActionResult<any, any>
    readonly invoke?:
      | InvokeConfig<States, Events, Emits, StateTag, EventOf<Events>, any, any, any, any, any, any>
      | ReadonlyArray<InvokeConfig<States, Events, Emits, StateTag, EventOf<Events>, any, any, any, any, any, any>>
    readonly always?: (context: AlwaysContext<States, Events, Emits, StateTag>) => HandlerResult<States, any, any>
    readonly output?: never
    readonly on?: {
      readonly [EventTag in TagOf<Events[number]>]?:
        | ((
          context: HandlerContext<States, Events, Emits, StateTag, EventTag, E, R>
        ) => HandlerResult<States, any, any>)
        | {
          readonly reenter?: boolean
          readonly transition: (
            context: HandlerContext<States, Events, Emits, StateTag, EventTag, E, R>
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
    States extends ReadonlyArray<TaggedSchema>,
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>,
    StateTag extends TagOf<States[number]>
  > = {
    readonly type: "final"
    readonly entry?: (context: StateActionContext<States, Events, Emits, StateTag>) => StateActionResult<any, any>
    readonly output?: (context: FinalOutputContext<States, Events, StateTag>) => any
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
    States extends ReadonlyArray<TaggedSchema>,
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>,
    StateTag extends TagOf<States[number]>,
    E,
    R
  > =
    | ActiveStateConfig<States, Events, Emits, StateTag, E, R>
    | FinalStateConfig<States, Events, Emits, StateTag>

  /**
   * Adds handlers for an unhandled state tag.
   *
   * @category combinators
   * @since 4.0.0
   */
  export interface Handler<
    States extends ReadonlyArray<TaggedSchema>,
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>,
    Input extends Schema.Top,
    UnhandledStates extends TagOf<States[number]>,
    E,
    R,
    InitialE,
    InitialR,
    FinalStates extends TagOf<States[number]>,
    Output
  > {
    <
      const StateTag extends UnhandledStates,
      const Config extends HandlerConfig<States, Events, Emits, StateTag, E, R>
    >(
      stateTag: StateTag,
      config: Config & EnsureCompatibleRuntime<ConfigServices<Config>, EventOf<Events>, EmitOf<Emits>>
    ): Machine<
      States,
      Events,
      Input,
      Exclude<UnhandledStates, StateTag>,
      | E
      | Effect.Error<EventHandlerReturn<Config>>
      | Effect.Error<AlwaysReturn<Config>>
      | Effect.Error<StateActionReturn<Config, "entry">>
      | Effect.Error<StateActionReturn<Config, "exit">>
      | InvokeError<Config>,
      ExcludeCompatibleRuntime<R | ConfigServices<Config>, EventOf<Events>, EmitOf<Emits>>,
      InitialE,
      InitialR,
      FinalStates | FinalStateFromConfig<Config, StateTag>,
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
    States extends ReadonlyArray<TaggedSchema>,
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>,
    StateTag extends TagOf<States[number]>,
    EventTag extends TagOf<Events[number]>,
    E,
    R
  > = Readonly<
    Record<
      PropertyKey,
      | ((context: HandlerContext<States, Events, Emits, StateTag, EventTag, E, R>) => HandlerResult<States, E, R>)
      | {
        readonly reenter?: boolean
        readonly transition: (
          context: HandlerContext<States, Events, Emits, StateTag, EventTag, E, R>
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
    States extends ReadonlyArray<TaggedSchema>,
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>,
    StateTag extends TagOf<States[number]>,
    EventTag extends TagOf<Events[number]>,
    E,
    R
  > {
    readonly type?: "final" | "active"
    readonly entry?: (context: StateActionContext<States, Events, Emits, StateTag>) => StateActionResult<E, R>
    readonly exit?: (context: StateActionContext<States, Events, Emits, StateTag>) => StateActionResult<E, R>
    readonly invoke?:
      | InvokeConfig<States, Events, Emits, StateTag, EventOf<Events>, any, any, any, any, any, any>
      | ReadonlyArray<InvokeConfig<States, Events, Emits, StateTag, EventOf<Events>, any, any, any, any, any, any>>
    readonly always?: (context: AlwaysContext<States, Events, Emits, StateTag>) => HandlerResult<States, E, R>
    readonly output?: (context: FinalOutputContext<States, Events, StateTag>) => any
    readonly on?: EventHandlerMap<States, Events, Emits, StateTag, EventTag, E, R>
  }

  /**
   * Runtime handler table stored on a machine.
   *
   * @category models
   * @since 4.0.0
   */
  export type StateConfigs<
    States extends ReadonlyArray<TaggedSchema>,
    Events extends ReadonlyArray<TaggedSchema>,
    Emits extends ReadonlyArray<TaggedSchema>,
    StateTag extends TagOf<States[number]>,
    EventTag extends TagOf<Events[number]>,
    E,
    R
  > = Readonly<Record<PropertyKey, StateConfig<States, Events, Emits, StateTag, EventTag, E, R>>>
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

const makeNoopRuntime = <Events, Emits>(): Runtime<Events, Emits> =>
  RuntimeContext.of({
    raise: () => Effect.void,
    sendParent: () => Effect.void
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

type TransitionHandler<States extends ReadonlyArray<Machine.TaggedSchema>, E, R, Context> = (
  context: Context
) => Machine.HandlerResult<States, E, R>

type EventTransition<States extends ReadonlyArray<Machine.TaggedSchema>, E, R, Context> =
  | TransitionHandler<States, E, R, Context>
  | {
    readonly reenter?: boolean
    readonly transition: TransitionHandler<States, E, R, Context>
  }

type MicrostepTransition<States extends ReadonlyArray<Machine.TaggedSchema>, E, R, Context> = {
  readonly reenter: boolean
  readonly transition: TransitionHandler<States, E, R, Context>
}

type AnyInvokeConfig = Machine.InvokeConfig<any, any, any, any, any, any, any, any, any, any, any>

interface InvokeSession {
  readonly token: symbol
  readonly scope: Scope.Closeable
}

const normalizeEventTransition = <States extends ReadonlyArray<Machine.TaggedSchema>, E, R, Context>(
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
  const States extends ReadonlyArray<Machine.TaggedSchema>,
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
  state: { readonly _tag: PropertyKey }
): boolean => machine.handlers[state._tag]?.type === "final"

const getFinalOutput = <
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  StateTag extends Machine.TagOf<States[number]>,
  Output
>(
  machine: Machine.Any,
  state: Machine.StateByTag<States, StateTag>,
  event: Machine.EventOf<Events>
): Output | undefined => machine.handlers[state._tag]?.output?.({ state, event }) as Output | undefined

/**
 * Returns `true` if a state is final for a state machine.
 *
 * @category guards
 * @since 4.0.0
 */
export const isFinal = <
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.TagOf<States[number]> = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates>,
  state: Machine.StateOf<States>
): state is Machine.StateByTag<States, FinalStates> => isFinalState(machine, state)

/**
 * Creates a schema-first state machine definition.
 *
 * @category constructors
 * @since 4.0.0
 */
export const make = <
  const States extends ReadonlyArray<Machine.TaggedSchema>,
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
  Machine.TagOf<States[number]>,
  never,
  never,
  InitialE,
  InitialR,
  never,
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
 * Returns the initial state for a state machine.
 *
 * @category constructors
 * @since 4.0.0
 */
export const initial = <
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR>,
  ...args: [...Machine.InputArgs<Input>]
): Machine.InitialResult<States, InitialE, InitialR> => machine.initial(...args)

/**
 * Plans the initial state for a state machine without running deferred actions.
 *
 * @category constructors
 * @since 4.0.0
 */
export const planInitial: <
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.TagOf<States[number]> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output, Emits>,
  ...args: [...Machine.InputArgs<Input>]
) => Effect.Effect<
  {
    readonly state: Machine.StateOf<States>
    readonly actions: ReadonlyArray<Effect.Effect<void, InitialE | StartupError, InitialR>>
    readonly output: Output | undefined
  },
  InitialE | StartupError,
  never
> = Effect.fnUntraced(function*<
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.TagOf<States[number]> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output, Emits>,
  ...args: [...Machine.InputArgs<Input>]
) {
  const deferredActions = yield* makeDeferredActions
  const result = initial(machine, ...args)
  const state = Effect.isEffect(result)
    ? yield* (result.pipe(Effect.provideService(DeferredActions, deferredActions)) as Effect.Effect<
      Machine.StateOf<States>
    >)
    : result
  const actions = yield* deferredActions.read
  const settled = yield* catchStartup(Effect.gen(function*() {
    const entry = yield* collectStateAction(
      machine.handlers[state._tag]?.entry,
      {
        state: state as Machine.StateByTag<States, UnhandledStates>,
        event: InitialEvent as Machine.EventOf<Events>,
        runtime: runtimeFor<Machine.EventOf<Events>, Machine.EmitOf<Emits>>()
      }
    )
    return yield* (settle(
      machine,
      state,
      InitialEvent as Machine.EventOf<Events>,
      [...entry.actions] as Array<Effect.Effect<void, never, never>>,
      [...entry.raisedEvents] as Array<Machine.EventOf<Events>>,
      []
    ) as Effect.Effect<MacrostepPlan<Machine.StateOf<States>, Machine.EventOf<Events>, never, never, Output>>)
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
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  E = never,
  R = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R>,
  state: Machine.StateOf<States>
): ReadonlyArray<Machine.TagOf<Events[number]>> =>
  isFinalState(machine, state)
    ? []
    : Reflect.ownKeys(machine.handlers[state._tag]?.on ?? {}) as Array<Machine.TagOf<Events[number]>>

const microstep: <
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.TagOf<States[number]> = never,
  Output = never,
  Context = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output, Emits>,
  state: Machine.StateOf<States>,
  event: Machine.EventOf<Events>,
  transition: MicrostepTransition<States, E, R, Context> | undefined,
  context: Context
) => Effect.Effect<
  MicrostepPlan<Machine.StateOf<States>, Machine.EventOf<Events>, E, R>,
  E | UnhandledEventError,
  R
> = Effect.fnUntraced(function*<
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.TagOf<States[number]> = never,
  Output = never,
  Context = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output, Emits>,
  state: Machine.StateOf<States>,
  event: Machine.EventOf<Events>,
  transition: MicrostepTransition<States, E, R, Context> | undefined,
  context: Context
) {
  const stateConfig = machine.handlers[state._tag]

  if (transition === undefined) {
    return yield* new UnhandledEventError({
      machineId: machine.id,
      state: String(state._tag),
      event: String(event._tag)
    })
  }

  const transitionResult = yield* collectTransition<States, Machine.EventOf<Events>, E, R, Context>(
    transition.transition,
    context
  )
  const stateAfterTransition = transitionResult.state === undefined ? state : transitionResult.state
  if (stateAfterTransition._tag === state._tag && !transition.reenter) {
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
      state: state as Machine.StateByTag<States, UnhandledStates>,
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
    machine.handlers[stateAfterTransition._tag]?.entry,
    {
      state: stateAfterTransition as Machine.StateByTag<States, UnhandledStates>,
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
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.TagOf<States[number]> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output, Emits>,
  state: Machine.StateOf<States>,
  event: Machine.EventOf<Events>,
  actions: Array<Effect.Effect<void, E, R>>,
  raisedEvents: Array<Machine.EventOf<Events>>,
  microsteps: Array<MicrostepPlan<Machine.StateOf<States>, Machine.EventOf<Events>, E, R>>
) => Effect.Effect<
  MacrostepPlan<Machine.StateOf<States>, Machine.EventOf<Events>, E, R, Output>,
  E | UnhandledEventError | InfiniteTransitionError,
  R
> = Effect.fnUntraced(function*<
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.TagOf<States[number]> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output, Emits>,
  state: Machine.StateOf<States>,
  event: Machine.EventOf<Events>,
  actions: Array<Effect.Effect<void, E, R>>,
  raisedEvents: Array<Machine.EventOf<Events>>,
  microsteps: Array<MicrostepPlan<Machine.StateOf<States>, Machine.EventOf<Events>, E, R>>
) {
  let currentState = state
  let currentEvent = event
  let shouldRunAlways = true
  let iterations = 0
  let raisedEventIndex = 0
  let finalOutput: Output | undefined = undefined

  while (true) {
    if (isFinalState(machine, currentState)) {
      finalOutput = getFinalOutput<States, Events, Machine.TagOf<States[number]>, Output>(
        machine,
        currentState as Machine.StateByTag<States, Machine.TagOf<States[number]>>,
        currentEvent
      )
      break
    }

    iterations += 1
    if (iterations > MaxMacrostepIterations) {
      return yield* new InfiniteTransitionError({
        machineId: machine.id,
        state: String(currentState._tag),
        maxIterations: MaxMacrostepIterations
      })
    }

    const always = shouldRunAlways
      ? machine.handlers[currentState._tag]?.always
      : undefined
    if (always !== undefined) {
      const alwaysStep: MicrostepPlan<Machine.StateOf<States>, Machine.EventOf<Events>, E, R> = yield* microstep(
        machine,
        currentState,
        currentEvent,
        { reenter: false, transition: always },
        {
          state: currentState as Machine.StateByTag<States, UnhandledStates>,
          event: currentEvent,
          runtime: runtimeFor<Machine.EventOf<Events>, Machine.EmitOf<Emits>>()
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
    const raisedStateConfig = machine.handlers[currentState._tag]
    const raisedStep = yield* microstep(
      machine,
      currentState,
      raisedEvent,
      normalizeEventTransition(raisedStateConfig?.on?.[raisedEvent._tag]),
      {
        state: currentState as Machine.StateByTag<States, UnhandledStates>,
        event: raisedEvent as Machine.EventByTag<Events, Machine.TagOf<Events[number]>>,
        runtime: runtimeFor<Machine.EventOf<Events>, Machine.EmitOf<Emits>>()
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
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.TagOf<States[number]> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output, Emits>,
  state: Machine.StateOf<States>,
  event: Machine.EventOf<Events>
) => Effect.Effect<
  MacrostepPlan<Machine.StateOf<States>, Machine.EventOf<Events>, E, R, Output>,
  E | UnhandledEventError | InfiniteTransitionError,
  R
> = Effect.fnUntraced(function*<
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.TagOf<States[number]> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output, Emits>,
  state: Machine.StateOf<States>,
  event: Machine.EventOf<Events>
) {
  if (isFinalState(machine, state)) {
    return {
      next: state,
      actions: [],
      microsteps: [],
      output: undefined
    }
  }

  const stateConfig = machine.handlers[state._tag]
  const step = yield* microstep(
    machine,
    state,
    event,
    normalizeEventTransition(stateConfig?.on?.[event._tag]),
    {
      state: state as Machine.StateByTag<States, UnhandledStates>,
      event: event as Machine.EventByTag<Events, Machine.TagOf<Events[number]>>,
      runtime: runtimeFor<Machine.EventOf<Events>, Machine.EmitOf<Emits>>()
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

/**
 * Computes the next state for a state machine without mutating a running actor.
 *
 * **Details**
 *
 * Deferred actions are executed after the next state is planned.
 *
 * @category combinators
 * @since 4.0.0
 */
export const next: <
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.TagOf<States[number]> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output, Emits>,
  state: Machine.StateOf<States>,
  event: Machine.EventOf<Events>
) => Effect.Effect<Machine.StateOf<States>, E | UnhandledEventError | InfiniteTransitionError, R> = Effect.fnUntraced(
  function*<
    const States extends ReadonlyArray<Machine.TaggedSchema>,
    const Events extends ReadonlyArray<Machine.TaggedSchema>,
    const Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
    const Input extends Schema.Top = typeof Schema.Void,
    UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
    E = never,
    R = never,
    InitialE = never,
    InitialR = never,
    FinalStates extends Machine.TagOf<States[number]> = never,
    Output = never
  >(
    machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output, Emits>,
    state: Machine.StateOf<States>,
    event: Machine.EventOf<Events>
  ) {
    const planned = yield* plan(machine, state, event)
    yield* runActions(planned.actions, makeNoopRuntime<Machine.EventOf<Events>, Machine.EmitOf<Emits>>())
    return planned.next
  }
)

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
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.TagOf<States[number]> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output, Emits>,
  ...args: [...Machine.InputArgs<Input>]
) => ActorModule.ActorLogic<
  Machine.StateOf<States>,
  Machine.EventOf<Events>,
  E | UnhandledEventError | InfiniteTransitionError,
  ExcludeCompatibleRuntime<Exclude<InitialR | R, ActorRuntime>, Machine.EventOf<Events>, Machine.EmitOf<Emits>>,
  Output | undefined,
  InitialE | StartupError
> = <
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.TagOf<States[number]> = never,
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
            return getFinalOutput<States, Events, Machine.TagOf<States[number]>, Output>(
              machine,
              initialState as Machine.StateByTag<States, Machine.TagOf<States[number]>>,
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
          const startInvoke = <StateTag extends Machine.TagOf<States[number]>>(
            config: AnyInvokeConfig,
            state: Machine.StateByTag<States, StateTag>,
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
            state: Machine.StateOf<States>,
            event: Machine.EventOf<Events>
          ): Effect.Effect<void, E, R> =>
            Effect.all(
              getInvokes(machine.handlers[state._tag]).map((config) =>
                startInvoke(
                  config,
                  state as Machine.StateByTag<States, Machine.TagOf<States[number]>>,
                  event
                ) as Effect.Effect<void, E, R>
              ),
              { discard: true }
            )
          const stopInvokes = (state: Machine.StateOf<States>): Effect.Effect<void> =>
            Effect.all(
              getInvokes(machine.handlers[state._tag]).map((config) => stopInvoke(config.id, Exit.void)),
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
    Machine.StateOf<States>,
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
  const States extends ReadonlyArray<Machine.TaggedSchema>,
  const Events extends ReadonlyArray<Machine.TaggedSchema>,
  const Emits extends ReadonlyArray<Machine.TaggedSchema> = any,
  const Input extends Schema.Top = typeof Schema.Void,
  UnhandledStates extends Machine.TagOf<States[number]> = Machine.TagOf<States[number]>,
  E = never,
  R = never,
  InitialE = never,
  InitialR = never,
  FinalStates extends Machine.TagOf<States[number]> = never,
  Output = never
>(
  machine: Machine<States, Events, Input, UnhandledStates, E, R, InitialE, InitialR, FinalStates, Output, Emits>,
  ...args: [...Machine.InputArgs<Input>]
) => Effect.Effect<
  ActorModule.Actor<
    Machine.StateOf<States>,
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
