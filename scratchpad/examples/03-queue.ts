import { Effect, Either, Exit, Option, Queue } from "effect"

const program = Effect.gen(function*() {
  const queue = yield* Queue.unbounded<number, string>()
  yield* Queue.offer(queue, 1)
  yield* Queue.offer(queue, 2)
  yield* Queue.offer(queue, 3)

  if (Math.random() > 0.5) {
    yield* Queue.done(queue, Exit.fail("error"))
  } else {
    yield* Queue.end(queue)
  }

  while (true) {
    const element = yield* Effect.either(Queue.take(queue))
    if (Either.isLeft(element)) {
      if (Option.isNone(element.left)) {
        yield* Effect.log(`queue is done`)
      } else {
        yield* Effect.log(`queue errored with: ${element.left.value}`)
      }
      return
    } else {
      yield* Effect.log(`queue element: ${element.right}`)
    }
  }
})

Effect.runFork(program)
