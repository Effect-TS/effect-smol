import { afterAll, assert, beforeAll, describe, expect, layer } from "@effect/vitest"
import { Context, Effect, Layer } from "effect"

describe("nested sibling layers", () => {
  let nextChildId = 0
  let firstChildId = -1
  let secondChildId = -1
  const releasedChildIds: Array<number> = []

  class Parent extends Context.Service<Parent, "parent">()("Parent") {
    static readonly Live = Layer.succeed(Parent)("parent")
  }

  class Child extends Context.Service<Child, { readonly id: number }>()("Child") {
    static readonly Live = Layer.effect(Child)(
      Effect.flatMap(Parent, () => {
        const id = ++nextChildId
        return Effect.acquireRelease(
          Effect.succeed({ id }),
          () =>
            Effect.sync(() => {
              releasedChildIds.push(id)
            })
        )
      })
    )
  }

  layer(Parent.Live)("parent", (it) => {
    it.layer(Child.Live)("first sibling", (it) => {
      it.effect("allocates child", () =>
        Effect.gen(function*() {
          const child = yield* Child
          firstChildId = child.id

          assert.strictEqual(child.id, 1)
          assert.deepStrictEqual(releasedChildIds, [])
        }))
    })

    it.layer(Child.Live)("second sibling", (it) => {
      beforeAll(() => {
        expect(releasedChildIds).toEqual([firstChildId])
      })

      it.effect("allocates a fresh child", () =>
        Effect.gen(function*() {
          const child = yield* Child
          secondChildId = child.id

          assert.strictEqual(child.id, 2)
          assert.isTrue(child.id !== firstChildId)
          assert.deepStrictEqual(releasedChildIds, [firstChildId])
        }))
    })

    afterAll(() => {
      expect(firstChildId).toEqual(1)
      expect(secondChildId).toEqual(2)
      expect(releasedChildIds).toEqual([1, 2])
    })
  })
})

describe.concurrent("nested sibling layers in concurrent suites", () => {
  let nextSharedId = 0
  let firstSharedId: number | undefined
  let secondSharedId: number | undefined
  const releasedSharedIds: Array<number> = []

  class Parent extends Context.Service<Parent, "parent">()("ConcurrentParent") {
    static readonly Live = Layer.succeed(Parent)("parent")
  }

  class SharedChild extends Context.Service<SharedChild, { readonly id: number }>()("SharedChild") {
    static readonly Live = Layer.effect(SharedChild)(
      Effect.flatMap(Parent, () =>
        Effect.gen(function*() {
          // Keep the first build pending long enough for the sibling suite to
          // attach to the same memoized layer when run under describe.concurrent.
          yield* Effect.promise(() => new Promise<void>((resolve) => setTimeout(resolve, 50)))

          const id = ++nextSharedId
          return yield* Effect.acquireRelease(
            Effect.succeed({ id }),
            () =>
              Effect.sync(() => {
                releasedSharedIds.push(id)
              })
          )
        }))
    )
  }

  layer(Parent.Live)("parent", (it) => {
    describe.concurrent("concurrent siblings", () => {
      it.layer(SharedChild.Live)("first sibling", (it) => {
        it.effect("captures shared child", () =>
          Effect.gen(function*() {
            const child = yield* SharedChild
            firstSharedId = child.id
            assert.isTrue(child.id === 1 || child.id === 2)
          }))
      })

      it.layer(SharedChild.Live)("second sibling", (it) => {
        it.effect("allocates an isolated child", () =>
          Effect.gen(function*() {
            const child = yield* SharedChild
            secondSharedId = child.id
            assert.isTrue(child.id === 1 || child.id === 2)
          }))
      })
    })

    afterAll(() => {
      expect(firstSharedId).not.toEqual(secondSharedId)
      expect(nextSharedId).toEqual(2)
      expect([...releasedSharedIds].sort((a, b) => a - b)).toEqual([1, 2])
    })
  })
})
