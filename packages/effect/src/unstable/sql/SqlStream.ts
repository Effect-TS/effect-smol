/**
 * @since 4.0.0
 */
import * as Effect from "../../Effect.ts"
import * as Exit from "../../Exit.ts"
import * as Queue from "../../Queue.ts"
import type * as Scope from "../../Scope.ts"
import * as Stream from "../../stream/Stream.ts"

/**
 * @since 4.0.0
 */
export const asyncPauseResume = <A, E = never, R = never>(
  register: (emit: {
    readonly single: (item: A) => void
    readonly array: (arr: ReadonlyArray<A>) => void
    readonly fail: (error: E) => void
    readonly end: () => void
  }) => Effect.Effect<
    {
      onPause(): void
      onResume(): void
    },
    E,
    R | Scope.Scope
  >,
  bufferSize = 128
): Stream.Stream<A, E, R> =>
  Stream.callback<A, E, R>((queue) =>
    Effect.suspend(() => {
      let cbs!: {
        onPause(): void
        onResume(): void
      }

      let paused = false
      const offer = (arr: ReadonlyArray<A>) => {
        if (arr.length === 0) return
        const isFull = Queue.isFullUnsafe(queue)
        if (!isFull || (isFull && paused)) {
          return Effect.runFork(Queue.offerAll(queue, arr))
        }
        paused = true
        cbs.onPause()
        return Queue.offerAll(queue, arr).pipe(
          Effect.tap(() => {
            cbs.onResume()
            paused = false
          }),
          Effect.runFork
        )
      }

      return Effect.map(
        register({
          single: (item) => offer([item]),
          array: (chunk) => offer(chunk),
          fail: (error) => Queue.doneUnsafe(queue, Exit.fail(error)),
          end: () => Queue.doneUnsafe(queue, Exit.void)
        }),
        (_) => {
          cbs = _
        }
      )
    }), { bufferSize })
