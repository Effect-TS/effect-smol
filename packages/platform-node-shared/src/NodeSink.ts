/**
 * @since 1.0.0
 */
import type { NonEmptyReadonlyArray } from "effect/Array"
import * as Channel from "effect/Channel"
import * as Effect from "effect/Effect"
import { identity, type LazyArg } from "effect/Function"
import * as Pull from "effect/Pull"
import * as Sink from "effect/Sink"
import type { Writable } from "node:stream"

/**
 * @category constructors
 * @since 1.0.0
 */
export const fromWritable = <E, A = Uint8Array | string>(
  options: {
    readonly evaluate: LazyArg<Writable | NodeJS.WritableStream>
    readonly onError: (error: unknown) => E
    readonly endOnDone?: boolean | undefined
    readonly encoding?: BufferEncoding | undefined
  }
): Sink.Sink<void, A, never, E> => Sink.fromChannel(fromWritableChannel<never, E, A>(options))

/**
 * @category constructors
 * @since 1.0.0
 */
export const fromWritableChannel = <IE, E, A = Uint8Array | string>(
  options: {
    readonly evaluate: LazyArg<Writable | NodeJS.WritableStream>
    readonly onError: (error: unknown) => E
    readonly endOnDone?: boolean | undefined
    readonly encoding?: BufferEncoding | undefined
  }
): Channel.Channel<NonEmptyReadonlyArray<never>, IE | E, void, NonEmptyReadonlyArray<A>, IE> =>
  Channel.fromTransform((pull: Pull.Pull<NonEmptyReadonlyArray<A>, IE, unknown>) => {
    const writable = options.evaluate() as Writable
    return Effect.succeed(pullIntoWritable({ ...options, writable, pull }))
  })

/**
 * @since 1.0.0
 */
export const pullIntoWritable = <A, IE, E>(options: {
  readonly pull: Pull.Pull<NonEmptyReadonlyArray<A>, IE, unknown>
  readonly writable: Writable
  readonly onError: (error: unknown) => E
  readonly endOnDone?: boolean | undefined
  readonly encoding?: BufferEncoding | undefined
}) =>
  options.pull.pipe(
    Effect.flatMap((chunk) =>
      Effect.callback<void, E>((resume) => {
        let i = 0
        function loop() {
          const item = chunk[i++]
          const success = options.writable.write(item, options.encoding as any)
          if (i === chunk.length) {
            resume(Effect.void)
          } else if (success) {
            loop()
          } else {
            options.writable.once("drain", loop)
          }
        }
        loop()
      })
    ),
    Effect.forever({ autoYield: false }),
    options.endOnDone !== false ?
      Pull.catchHalt((_) =>
        Effect.callback<never, E | Pull.Halt<unknown>>((resume) => {
          if ("closed" in options.writable && options.writable.closed) {
            resume(Pull.halt(_))
          } else {
            options.writable.once("finish", () => resume(Pull.halt(_)))
            options.writable.end()
          }
        })
      ) :
      identity
  )
