import * as Effect from "effect/Effect"
import * as KeyValueStore from "effect/unstable/persistence/KeyValueStore"

export const makeKvStore = (): Effect.Effect<KeyValueStore.KeyValueStore> =>
  Effect.promise(async () => {
    const store = await Deno.openKv()
    const encoder = new TextEncoder()

    const get = (key: string): Effect.Effect<string | undefined, never, never> =>
      Effect.promise(async () => {
        const val = await store.get([key])
        const value = val.value

        if (value == null) return undefined
        if (typeof value === "string") return value

        return undefined
      })

    const getUint8Array = (
      key: string
    ): Effect.Effect<Uint8Array | undefined> =>
      Effect.gen(function*() {
        const val = yield* Effect.promise(async () => await store.get([key]))

        const value = val.key[0]

        return value !== undefined ?
          (() => {
            if (typeof value === "string") {
              return (encoder.encode(value))
            }
            if (value instanceof Uint8Array) {
              return value
            }

            return undefined
          })()
          : undefined
      })

    const modifyUint8Array = (
      key: string,
      f: (value: Uint8Array) => Uint8Array
    ): Effect.Effect<Uint8Array | undefined, KeyValueStore.KeyValueStoreError> =>
      Effect.flatMap(getUint8Array(key), (o) => {
        if (o === undefined) {
          return Effect.succeed(undefined)
        }
        const newValue = f(o)
        return Effect.as(set(key, newValue), newValue)
      })

    const set = (
      key: string,
      value: string | Uint8Array
    ): Effect.Effect<void> =>
      Effect.promise(async () => {
        await store.set([key], value)
      })

    const remove = (key: string): Effect.Effect<void> =>
      Effect.promise(async () => {
        await store.delete([key])
      })

    const getAll = <T>(): Deno.KvListIterator<T> => store.list<T>({ prefix: [] })

    const clear = Effect.promise(async () => {
      const entries = getAll()

      const promises: Array<Promise<void>> = []

      for await (const entry of entries) {
        promises.push(store.delete(entry.key))
      }

      await Promise.all(promises)
    })

    const size = Effect.promise(async () => {
      const entries = getAll()

      let size = 0
      for await (const _ of entries) {
        size++
      }
      return size
    })

    return KeyValueStore.make({
      get,
      getUint8Array,
      modifyUint8Array,
      set,
      remove,
      clear,
      size
    })
  })
