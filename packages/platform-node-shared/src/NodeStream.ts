/**
 * @since 1.0.0
 */
import type { NonEmptyReadonlyArray } from "effect/Array"
import * as Arr from "effect/Array"
import type { Cause } from "effect/Cause"
import * as Channel from "effect/Channel"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import { dual, type LazyArg } from "effect/Function"
import type { PlatformError } from "effect/PlatformError"
import { SystemError } from "effect/PlatformError"
import * as Pull from "effect/Pull"
import * as Queue from "effect/Queue"
import * as Stream from "effect/Stream"
import type { Duplex, Readable } from "node:stream"
import { pullIntoWritable } from "./NodeSink.js"

/**
 * @category constructors
 * @since 1.0.0
 */
export const fromReadable = <E, A = Uint8Array>(options: {
  readonly evaluate: LazyArg<Readable | NodeJS.ReadableStream>
  readonly onError: (error: unknown) => E
  readonly chunkSize?: number | undefined
  readonly bufferSize?: number | undefined
}): Stream.Stream<A, E> => Stream.fromChannel(fromReadableChannel<E, A>(options))

/**
 * @category constructors
 * @since 1.0.0
 */
export const fromReadableChannel = <E, A = Uint8Array>(options: {
  readonly evaluate: LazyArg<Readable | NodeJS.ReadableStream>
  readonly onError: (error: unknown) => E
  readonly chunkSize?: number | undefined
  readonly bufferSize?: number | undefined
}): Channel.Channel<NonEmptyReadonlyArray<A>, E> =>
  Channel.callbackArray<A, E>((queue) =>
    Effect.suspend(() =>
      readableToQueue(queue, {
        readable: options.evaluate(),
        onError: options.onError,
        chunkSize: options.chunkSize ?? 64 * 1024
      })
    ), { bufferSize: options.bufferSize ?? 16 })

/**
 * @category constructors
 * @since 1.0.0
 */
export const fromDuplex = <IE, E, I = Uint8Array, O = Uint8Array>(
  options: {
    readonly evaluate: LazyArg<Duplex>
    readonly onError: (error: unknown) => E
    readonly chunkSize?: number | undefined
    readonly bufferSize?: number | undefined
    readonly endOnDone?: boolean | undefined
    readonly encoding?: BufferEncoding | undefined
  }
): Channel.Channel<NonEmptyReadonlyArray<O>, IE | E, void, NonEmptyReadonlyArray<I>, IE> =>
  Channel.fromTransform(Effect.fnUntraced(function*(upstream, scope) {
    const queue = yield* Queue.make<O, IE | E>({ capacity: options.bufferSize ?? 16 })
    const duplex = options.evaluate()

    yield* pullIntoWritable({
      pull: upstream,
      writable: duplex,
      onError: options.onError,
      endOnDone: options.endOnDone,
      encoding: options.encoding
    }).pipe(
      Effect.catchCause((cause) => {
        if (Pull.isHaltCause(cause)) return Effect.void
        return Queue.failCause(queue, cause as Cause<IE | E>)
      }),
      Effect.interruptible,
      Effect.forkIn(scope)
    )

    yield* readableToQueue(queue, {
      readable: duplex,
      onError: options.onError,
      chunkSize: options.chunkSize ?? 64 * 1024
    }).pipe(
      Effect.interruptible,
      Effect.forkIn(scope)
    )

    return Pull.fromQueueArray(queue)
  }))

/**
 * @category combinators
 * @since 1.0.0
 */
export const pipeThroughDuplex: {
  <E2, B = Uint8Array>(
    options: {
      readonly evaluate: LazyArg<Duplex>
      readonly onError: (error: unknown) => E2
      readonly chunkSize?: number | undefined
      readonly bufferSize?: number | undefined
      readonly endOnDone?: boolean | undefined
      readonly encoding?: BufferEncoding | undefined
    }
  ): <R, E, A>(self: Stream.Stream<A, E, R>) => Stream.Stream<B, E2 | E, R>
  <R, E, A, E2, B = Uint8Array>(
    self: Stream.Stream<A, E, R>,
    options: {
      readonly evaluate: LazyArg<Duplex>
      readonly onError: (error: unknown) => E2
      readonly chunkSize?: number | undefined
      readonly bufferSize?: number | undefined
      readonly endOnDone?: boolean | undefined
      readonly encoding?: BufferEncoding | undefined
    }
  ): Stream.Stream<B, E | E2, R>
} = dual(2, <R, E, A, E2, B = Uint8Array>(
  self: Stream.Stream<A, E, R>,
  options: {
    readonly evaluate: LazyArg<Duplex>
    readonly onError: (error: unknown) => E2
    readonly chunkSize?: number | undefined
    readonly bufferSize?: number | undefined
    readonly endOnDone?: boolean | undefined
    readonly encoding?: BufferEncoding | undefined
  }
): Stream.Stream<B, E | E2, R> =>
  Stream.pipeThroughChannelOrFail(
    self,
    fromDuplex(options)
  ))

/**
 * @category combinators
 * @since 1.0.0
 */
export const pipeThroughSimple: {
  (
    duplex: LazyArg<Duplex>
  ): <R, E>(self: Stream.Stream<string | Uint8Array, E, R>) => Stream.Stream<Uint8Array, E | PlatformError, R>
  <R, E>(
    self: Stream.Stream<string | Uint8Array, E, R>,
    duplex: LazyArg<Duplex>
  ): Stream.Stream<Uint8Array, PlatformError | E, R>
} = dual(2, <R, E>(
  self: Stream.Stream<string | Uint8Array, E, R>,
  duplex: LazyArg<Duplex>
): Stream.Stream<Uint8Array, PlatformError | E, R> =>
  pipeThroughDuplex(self, {
    evaluate: duplex,
    onError: (error) =>
      SystemError({
        module: "Stream",
        method: "pipeThroughSimple",
        pathOrDescriptor: "",
        reason: "Unknown",
        message: String(error)
      })
  }))

// /**
//  * @since 1.0.0
//  * @category conversions
//  */
// export const toReadable: <E, R>(stream: Stream.Stream<string | Uint8Array, E, R>) => Effect.Effect<Readable, never, R> =
//   internal.toReadable
//
// /**
//  * @since 1.0.0
//  * @category conversions
//  */
// export const toReadableNever: <E>(stream: Stream.Stream<string | Uint8Array, E, never>) => Readable =
//   internal.toReadableNever
//
// /**
//  * @since 1.0.0
//  * @category conversions
//  */
// export const toString: <E>(
//   readable: LazyArg<Readable | NodeJS.ReadableStream>,
//   options: {
//     readonly onFailure: (error: unknown) => E
//     readonly encoding?: BufferEncoding | undefined
//     readonly maxBytes?: SizeInput | undefined
//   }
// ) => Effect.Effect<string, E> = internal.toString
//
// /**
//  * @since 1.0.0
//  * @category conversions
//  */
// export const toUint8Array: <E>(
//   readable: LazyArg<Readable | NodeJS.ReadableStream>,
//   options: { readonly onFailure: (error: unknown) => E; readonly maxBytes?: SizeInput | undefined }
// ) => Effect.Effect<Uint8Array, E> = internal.toUint8Array

// ----------------------------------------------------------------------------
// internal
// ----------------------------------------------------------------------------

const readableToQueue = <A, E>(queue: Queue.Queue<A, E>, options: {
  readonly readable: Readable | NodeJS.ReadableStream
  readonly onError: (error: unknown) => E
  readonly chunkSize: number
}) => {
  const readable = options.readable
  const latch = Effect.unsafeMakeLatch(true)
  readable.on("readable", () => latch.unsafeOpen())
  readable.on("error", (error) => {
    Queue.unsafeDone(queue, Exit.fail(options.onError(error)))
  })
  readable.on("end", () => {
    Queue.unsafeEnd(queue)
  })
  return latch.await.pipe(
    Effect.flatMap(() => {
      latch.unsafeClose()
      const chunk = Arr.empty<A>()
      let item = readable.read(options.chunkSize)
      if (item === null) return Effect.void
      while (item !== null) {
        chunk.push(item)
        item = readable.read()
      }
      return Queue.offerAll(queue, chunk)
    }),
    Effect.forever({ autoYield: false })
  )
}
