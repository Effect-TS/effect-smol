/**
 * Provides reloadable service implementations.
 *
 * A `Reloadable<A>` stores the current implementation of a service and can
 * replace it by rebuilding the layer that produced it. Reloads acquire the new
 * implementation in a fresh scope and release resources owned by the previous
 * implementation.
 *
 * @since 4.0.0
 */
import * as Context from "./Context.ts"
import * as Effect from "./Effect.ts"
import { PipeInspectableProto } from "./internal/core.ts"
import * as Layer from "./Layer.ts"
import type { Pipeable } from "./Pipeable.ts"
import * as Pull from "./Pull.ts"
import * as Schedule from "./Schedule.ts"
import type * as Scope from "./Scope.ts"
import * as ScopedRef from "./ScopedRef.ts"

const TypeId = "~effect/Reloadable"

/**
 * Service implementation that can be replaced by rebuilding its source layer.
 *
 * **When to use**
 *
 * Use when you need a long-lived service whose implementation can be refreshed
 * manually or on a schedule without rebuilding the whole application runtime.
 *
 * @see {@link manual} for creating a caller-controlled reloadable service
 * @see {@link auto} for creating a schedule-driven reloadable service
 * @category models
 * @since 4.0.0
 */
export interface Reloadable<in out A> extends Pipeable {
  readonly [TypeId]: typeof TypeId
  readonly scopedRef: ScopedRef.ScopedRef<A>
  readonly reload: Effect.Effect<void, unknown>
}

const Proto = {
  ...PipeInspectableProto,
  [TypeId]: TypeId,
  toJSON() {
    return {
      _id: "Reloadable"
    }
  }
}

const makeUnsafe = <A>(
  scopedRef: ScopedRef.ScopedRef<A>,
  reload: Effect.Effect<void, unknown>
): Reloadable<A> => {
  const self = Object.create(Proto)
  self.scopedRef = scopedRef
  self.reload = reload
  return self
}

const make: <I, S, E, R>(
  service: Context.Key<I, S>,
  layer: Layer.Layer<I, E, R>
) => Effect.Effect<Reloadable<S>, E, R | Scope.Scope> = Effect.fnUntraced(function*<I, S, E, R>(
  service: Context.Key<I, S>,
  layer: Layer.Layer<I, E, R>
) {
  const context = yield* Effect.context<R | Scope.Scope>()
  const acquire = Effect.updateContext<S, E, R | Scope.Scope, never>(
    Effect.map(Layer.build(layer), Context.get(service)),
    (input: Context.Context<never>) => Context.merge(context, input)
  )
  const scopedRef = yield* ScopedRef.fromAcquire(acquire)
  return makeUnsafe(scopedRef, ScopedRef.set(scopedRef, acquire))
})

const autoReload = Effect.fnUntraced(function*<A, Out, E, R>(
  reloadable: Reloadable<A>,
  schedule: Schedule.Schedule<Out, unknown, E, R>
) {
  const step = yield* Schedule.toStepWithSleep(schedule)
  const loop: Effect.Effect<void, never, R> = Effect.suspend(() =>
    Pull.matchEffect(step(void 0), {
      onSuccess: () => Effect.andThen(Effect.ignore(reloadable.reload, { log: true }), loop),
      onFailure: (cause) => Effect.ignoreCause(Effect.failCause(cause), { log: true }),
      onDone: () => Effect.void
    })
  )
  yield* Effect.forkScoped(loop)
})

/**
 * Creates a layer that provides a reloadable service refreshed on a schedule.
 *
 * **When to use**
 *
 * Use when the service should be rebuilt periodically for the lifetime of the
 * layer, such as refreshing clients, credentials, or configuration-dependent
 * resources.
 *
 * **Details**
 *
 * The initial service acquisition must succeed for the layer to build. Later
 * reload failures are logged and ignored by the background refresh fiber.
 *
 * @see {@link manual} for caller-controlled reloads
 * @see {@link reload} for forcing an immediate reload
 * @category constructors
 * @since 4.0.0
 */
export const auto = <I, S, E, R, Out, E2, R2>(
  service: Context.Key<I, S>,
  options: {
    readonly layer: Layer.Layer<I, E, R>
    readonly schedule: Schedule.Schedule<Out, unknown, E2, R2>
  }
): Layer.Layer<Reloadable<I>, E, R | R2> =>
  Layer.effect(
    tag(service),
    Effect.tap(make(service, options.layer), (reloadable) => autoReload(reloadable, options.schedule))
  )

/**
 * Creates a layer that provides a reloadable service with a schedule derived
 * from the layer input context.
 *
 * **When to use**
 *
 * Use when the refresh schedule depends on services required to build the
 * reloadable layer, such as configuration loaded from the environment.
 *
 * @see {@link auto} for using a schedule that does not depend on the input context
 * @category constructors
 * @since 4.0.0
 */
export const autoFromConfig = <I, S, E, R, Out, E2, R2>(
  service: Context.Key<I, S>,
  options: {
    readonly layer: Layer.Layer<I, E, R>
    readonly scheduleFromConfig: (context: Context.Context<R>) => Schedule.Schedule<Out, unknown, E2, R2>
  }
): Layer.Layer<Reloadable<I>, E, R | R2> =>
  Layer.effect(
    tag(service),
    Effect.flatMap(Effect.context<R>(), (context) =>
      Effect.tap(
        make(service, options.layer),
        (reloadable) => autoReload(reloadable, options.scheduleFromConfig(context))
      ))
  )

/**
 * Retrieves the current implementation stored in a reloadable service.
 *
 * **When to use**
 *
 * Use when a program depends on a reloadable service and needs the latest
 * successfully acquired implementation.
 *
 * @see {@link reload} for replacing the current implementation
 * @category getters
 * @since 4.0.0
 */
export const get = <I, S>(
  service: Context.Key<I, S>
): Effect.Effect<S, never, Reloadable<I>> =>
  Effect.flatMap(tag(service), (reloadable) => ScopedRef.get(reloadable.scopedRef))

/**
 * Creates a layer that provides a reloadable service refreshed by explicit
 * calls to `reload`.
 *
 * **When to use**
 *
 * Use when callers should decide when the service is rebuilt instead of using a
 * background schedule.
 *
 * @see {@link auto} for schedule-driven reloads
 * @see {@link reload} for forcing a reload
 * @category constructors
 * @since 4.0.0
 */
export const manual = <I, S, E, R>(
  service: Context.Key<I, S>,
  options: { readonly layer: Layer.Layer<I, E, R> }
): Layer.Layer<Reloadable<I>, E, R> => Layer.effect(tag(service), make(service, options.layer))

/**
 * Rebuilds the layer behind a reloadable service and replaces the current
 * implementation.
 *
 * **When to use**
 *
 * Use when an explicit event should refresh the service implementation, such as
 * a configuration change or administrative command.
 *
 * @category resource management
 * @since 4.0.0
 */
export const reload = <I, S>(
  service: Context.Key<I, S>
): Effect.Effect<void, unknown, Reloadable<I>> => Effect.flatMap(tag(service), (reloadable) => reloadable.reload)

/**
 * Returns the context key used to provide the reloadable wrapper for a service.
 *
 * **When to use**
 *
 * Use when you need to access or provide the `Reloadable` wrapper itself rather
 * than the current service implementation.
 *
 * @category context
 * @since 4.0.0
 */
export const tag = <I, S>(
  service: Context.Key<I, S>
): Context.Service<Reloadable<I>, Reloadable<S>> =>
  Context.Service<Reloadable<I>, Reloadable<S>>(`effect/Reloadable<${service.key}>`)
