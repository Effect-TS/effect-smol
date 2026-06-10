/**
 * Internal machine process integration.
 *
 * @since 4.0.0
 */

import * as Effect from "../../../Effect.ts"
import * as Exit from "../../../Exit.ts"
import * as HashMap from "../../../HashMap.ts"
import type { InfiniteTransitionError, StartupError, UnhandledEventError } from "../../../internal/machineErrors.ts"
import * as Option from "../../../Option.ts"
import * as Ref from "../../../Ref.ts"
import type * as Schema from "../../../Schema.ts"
import * as Scope from "../../../Scope.ts"
import * as Stream from "../../../Stream.ts"
import type { Machine, Runtime } from "../Machine.ts"
import * as Model from "./machineModel.ts"
import * as internalRuntime from "./machineRuntime.ts"

type IsAny<A> = 0 extends (1 & A) ? true : false

type ExcludeCompatibleRuntime<Requirements, Events, Emits> = Requirements extends Runtime.Requirement<
  infer RequiredEvents,
  infer RequiredEmits
> ? IsAny<Requirements> extends true ? Requirements
  : [RequiredEvents] extends [Events] ? [RequiredEmits] extends [Emits] ? never : Requirements
  : Requirements
  : Requirements

export const toProcessLogic: <
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
) => internalRuntime.ProcessLogic<
  Machine.Snapshot<States>,
  Machine.EventOf<Events>,
  E | UnhandledEventError | InfiniteTransitionError,
  ExcludeCompatibleRuntime<
    Exclude<InitialR | R, internalRuntime.MachineRuntime>,
    Machine.EventOf<Events>,
    Machine.EmitOf<Emits>
  >,
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
  ({
    initial: (scope) =>
      internalRuntime.provideMachineRuntime(
        Effect.gen(function*() {
          const planned = yield* internalRuntime.planInitial(machine, ...args)
          yield* internalRuntime.runActions(
            planned.actions,
            internalRuntime.makeLiveRuntime<Machine.EventOf<Events>, Machine.EmitOf<Emits>>(scope)
          )
          return planned.state
        }),
        scope
      ),
    run: (context) =>
      internalRuntime.provideMachineRuntime(
        Effect.gen(function*() {
          const { receive, state, setState } = context
          let done = false
          let output: Output | undefined = undefined

          const initialState = yield* state
          if (internalRuntime.isFinalState(machine, initialState)) {
            return internalRuntime.getFinalOutput<States, Events, Output>(
              machine,
              initialState,
              internalRuntime.InitialEvent as Machine.EventOf<Events>
            )
          }

          const invokeSessions = yield* Ref.make<HashMap.HashMap<string, internalRuntime.InvokeSession>>(
            HashMap.empty()
          )
          const makeInvokeSessionKey = (path: string, id: string): string => `${path.length}:${path}${id}`
          const makeInvokeChildId = (path: string, id: string): string =>
            `Machine.invoke:${makeInvokeSessionKey(path, id)}`
          const isCurrentInvoke = (key: string, token: symbol): Effect.Effect<boolean> =>
            Ref.get(invokeSessions).pipe(
              Effect.map((sessions) => {
                const current = HashMap.get(sessions, key)
                return Option.isSome(current) && current.value.token === token
              })
            )
          const stopInvoke = (key: string, exit: Exit.Exit<unknown, unknown>): Effect.Effect<void> =>
            Ref.modify(invokeSessions, (sessions) => {
              const current = HashMap.get(sessions, key)
              return Option.isSome(current)
                ? [current.value, HashMap.remove(sessions, key)] as const
                : [undefined, sessions] as const
            }).pipe(
              Effect.flatMap((session) =>
                session === undefined
                  ? Effect.void
                  : Scope.close(session.scope, exit).pipe(
                    Effect.andThen(context.stopChild(session.childId))
                  )
              )
            )
          const clearInvoke = (key: string, token: symbol, exit: Exit.Exit<unknown, unknown>): Effect.Effect<void> =>
            Ref.modify(invokeSessions, (sessions) => {
              const current = HashMap.get(sessions, key)
              return Option.isSome(current) && current.value.token === token
                ? [current.value, HashMap.remove(sessions, key)] as const
                : [undefined, sessions] as const
            }).pipe(
              Effect.flatMap((session) => session === undefined ? Effect.void : Scope.close(session.scope, exit))
            )
          const stopAllInvokes = (exit: Exit.Exit<unknown, unknown>): Effect.Effect<void> =>
            Ref.modify(invokeSessions, (sessions) => [HashMap.toEntries(sessions), HashMap.empty()] as const).pipe(
              Effect.flatMap((sessions) =>
                Effect.all(
                  sessions.map(([, session]) =>
                    Scope.close(session.scope, exit).pipe(
                      Effect.andThen(context.stopChild(session.childId))
                    )
                  ),
                  { discard: true, concurrency: "unbounded" }
                )
              )
            )
          const startInvokeWatchers = (
            config: internalRuntime.AnyInvokeConfig,
            child: internalRuntime.MachineRef<any, any, any, any>,
            key: string,
            token: symbol,
            scope: Scope.Closeable
          ): Effect.Effect<void> =>
            Effect.gen(function*() {
              if (config.snapshot !== undefined) {
                const mapSnapshot = config.snapshot
                yield* child.changes.pipe(
                  Stream.filter((snapshot) => snapshot.status === "active"),
                  Stream.runForEach((snapshot) =>
                    isCurrentInvoke(key, token).pipe(
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
                yield* internalRuntime.watch(child).pipe(
                  Stream.runForEach((outcome) =>
                    isCurrentInvoke(key, token).pipe(
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
            path: StateId,
            config: internalRuntime.AnyInvokeConfig,
            state: Machine.StateByIdentifier<States, StateId>,
            event: Machine.EventOf<Events>
          ) =>
            Effect.gen(function*() {
              const token = Symbol()
              const invokeId = String(config.id)
              const key = makeInvokeSessionKey(path, invokeId)
              const childId = makeInvokeChildId(path, invokeId)
              const child = yield* context.spawn(
                config.src({
                  state,
                  event,
                  runtime: internalRuntime.runtimeFor<Machine.EventOf<Events>, Machine.EmitOf<Emits>>()
                }),
                { id: childId }
              ).pipe(
                Effect.onExit((exit) =>
                  Exit.isFailure(exit) ? clearInvoke(key, token, Exit.failCause(exit.cause)) : Effect.void
                )
              )
              const scope = yield* Scope.make("parallel")
              yield* Ref.update(invokeSessions, (sessions) => HashMap.set(sessions, key, { token, scope, childId }))
              yield* startInvokeWatchers(config, child, key, token, scope)
            })
          const startInvokes = (
            state: Machine.Snapshot<States>,
            paths: ReadonlyArray<string>,
            event: Machine.EventOf<Events>
          ): Effect.Effect<void, E, R> => {
            const configuration = Model.normalizeConfiguration(machine, state)
            return Effect.all(
              internalRuntime.sortEntryPaths(machine, paths)
                .filter((path) => configuration.active.has(path))
                .flatMap((path) =>
                  internalRuntime.getInvokes(Model.getStateConfigByPath(machine, path)).map((config) =>
                    startInvoke(
                      path as Machine.StateIdentifier<States>,
                      config,
                      Model.getActiveValue(configuration, path) as Machine.StateByIdentifier<
                        States,
                        Machine.StateIdentifier<States>
                      >,
                      event
                    ) as Effect.Effect<void, E, R>
                  )
                ),
              { discard: true }
            )
          }
          const stopInvokes = (paths: ReadonlyArray<string>): Effect.Effect<void> =>
            Effect.all(
              internalRuntime.sortExitPaths(machine, paths).flatMap((path) =>
                internalRuntime.getInvokes(Model.getStateConfigByPath(machine, path)).map((config) =>
                  stopInvoke(makeInvokeSessionKey(path, String(config.id)), Exit.void)
                )
              ),
              { discard: true, concurrency: "unbounded" }
            )

          return yield* Effect.gen(function*() {
            yield* startInvokes(
              initialState,
              Model.getInitialEntryPaths(machine, Model.normalizeConfiguration(machine, initialState)),
              internalRuntime.InitialEvent as Machine.EventOf<Events>
            )

            yield* Effect.whileLoop({
              while: () => !done,
              body: () =>
                Effect.gen(function*() {
                  const event = yield* receive
                  const current = yield* state
                  const planned = yield* internalRuntime.plan(machine, current, event)
                  const changed = planned.microsteps.some((step) => step.changed)
                  const exitPaths = planned.microsteps.flatMap((step) => step.exitPaths)
                  const entryPaths = planned.microsteps.flatMap((step) => step.entryPaths)

                  if (changed) {
                    yield* stopInvokes(exitPaths)
                  }
                  yield* setState(planned.next)
                  yield* internalRuntime.runActions(
                    planned.actions,
                    internalRuntime.makeLiveRuntime<Machine.EventOf<Events>, Machine.EmitOf<Emits>>(context)
                  )

                  if (internalRuntime.isFinalState(machine, planned.next)) {
                    done = true
                    output = planned.output
                    yield* stopAllInvokes(Exit.succeed(output))
                  } else {
                    if (changed) {
                      yield* startInvokes(planned.next, entryPaths, event)
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
  }) as internalRuntime.ProcessLogic<
    Machine.Snapshot<States>,
    Machine.EventOf<Events>,
    E | UnhandledEventError | InfiniteTransitionError,
    ExcludeCompatibleRuntime<
      Exclude<InitialR | R, internalRuntime.MachineRuntime>,
      Machine.EventOf<Events>,
      Machine.EmitOf<Emits>
    >,
    Output | undefined,
    InitialE | StartupError
  >

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
  internalRuntime.MachineRef<
    Machine.Snapshot<States>,
    Machine.EventOf<Events>,
    E | InitialE | StartupError | UnhandledEventError | InfiniteTransitionError,
    Output | undefined
  >,
  InitialE | StartupError,
  ExcludeCompatibleRuntime<
    Exclude<InitialR | R, internalRuntime.MachineRuntime>,
    Machine.EventOf<Events>,
    Machine.EmitOf<Emits>
  >
> = (machine, ...args) =>
  internalRuntime.startProcess(
    toProcessLogic(machine, ...args),
    machine.id === undefined ? undefined : { id: machine.id }
  ) as any
