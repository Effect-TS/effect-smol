import * as MutableHashMap from "../../../collections/MutableHashMap.ts"
import * as Option from "../../../data/Option.ts"
import * as Deferred from "../../../Deferred.ts"
import * as Effect from "../../../Effect.ts"
import * as Exit from "../../../Exit.ts"
import * as MutableRef from "../../../MutableRef.ts"
import * as Scope from "../../../Scope.ts"
import * as ServiceMap from "../../../ServiceMap.ts"

/** @internal */
export class ResourceMap<K, A, E> {
  readonly lookup: (key: K, scope: Scope.Scope) => Effect.Effect<A, E>
  readonly entries: MutableHashMap.MutableHashMap<K, {
    readonly scope: Scope.Scope.Closeable
    readonly deferred: Deferred.Deferred<A, E>
  }>
  readonly isClosed: MutableRef.MutableRef<boolean>
  constructor(
    lookup: (key: K, scope: Scope.Scope) => Effect.Effect<A, E>,
    entries: MutableHashMap.MutableHashMap<K, {
      readonly scope: Scope.Scope.Closeable
      readonly deferred: Deferred.Deferred<A, E>
    }>,
    isClosed: MutableRef.MutableRef<boolean>
  ) {
    this.lookup = lookup
    this.entries = entries
    this.isClosed = isClosed
  }

  static make = Effect.fnUntraced(function*<K, A, E, R>(lookup: (key: K) => Effect.Effect<A, E, R>) {
    const scope = yield* Effect.scope
    const services = yield* Effect.services<R>()
    const isClosed = MutableRef.make(false)

    const entries = MutableHashMap.empty<K, {
      scope: Scope.Scope.Closeable
      deferred: Deferred.Deferred<A, E>
    }>()

    yield* Scope.addFinalizerExit(
      scope,
      (exit) => {
        MutableRef.set(isClosed, true)
        return Effect.forEach(entries, ([key, { scope }]) => {
          MutableHashMap.remove(entries, key)
          return Effect.exit(Scope.close(scope, exit))
        }, { concurrency: "unbounded", discard: true })
      }
    )

    return new ResourceMap(
      (key, scope) => Effect.provide(lookup(key), ServiceMap.add(services, Scope.Scope, scope)),
      entries,
      isClosed
    )
  })

  get(key: K): Effect.Effect<A, E> {
    return Effect.suspend(() => {
      if (MutableRef.get(this.isClosed)) {
        return Effect.interrupt
      }
      const existing = MutableHashMap.get(this.entries, key)
      if (Option.isSome(existing)) {
        return Deferred.await(existing.value.deferred)
      }
      const scope = Effect.runSync(Scope.make())
      const deferred = Deferred.unsafeMake<A, E>()
      MutableHashMap.set(this.entries, key, { scope, deferred })
      return Effect.onExit(this.lookup(key, scope), (exit) => {
        if (exit._tag === "Success") {
          return Deferred.done(deferred, exit)
        }
        MutableHashMap.remove(this.entries, key)
        return Deferred.done(deferred, exit)
      })
    })
  }

  remove(key: K): Effect.Effect<void> {
    return Effect.suspend(() => {
      const entry = MutableHashMap.get(this.entries, key)
      if (Option.isNone(entry)) {
        return Effect.void
      }
      MutableHashMap.remove(this.entries, key)
      return Scope.close(entry.value.scope, Exit.void)
    })
  }

  removeIgnore(key: K): Effect.Effect<void> {
    return Effect.catchCause(this.remove(key), (cause) =>
      Effect.annotateLogs(Effect.logDebug(cause), {
        module: "ResourceMap",
        method: "removeIgnore",
        key
      }))
  }
}
