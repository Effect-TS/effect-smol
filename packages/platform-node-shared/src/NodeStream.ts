/**
 * @since 1.0.0
 */
import type { NonEmptyReadonlyArray } from "effect/Array"
import * as Arr from "effect/Array"
import * as Cause from "effect/Cause"
import * as Channel from "effect/Channel"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import type { SizeInput } from "effect/FileSystem"
import { constVoid, dual, type LazyArg } from "effect/Function"
import type { PlatformError } from "effect/PlatformError"
import { SystemError } from "effect/PlatformError"
import * as Pull from "effect/Pull"
import * as Queue from "effect/Queue"
import * as Stream from "effect/Stream"
import type { Duplex } from "node:stream"
import { Readable } from "node:stream"
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
        chunkSize: options.chunkSize
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
        return Queue.failCause(queue, cause as Cause.Cause<IE | E>)
      }),
      Effect.interruptible,
      Effect.forkIn(scope)
    )

    yield* readableToQueue(queue, {
      readable: duplex,
      onError: options.onError,
      chunkSize: options.chunkSize
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

/**
 * @since 1.0.0
 * @category conversions
 */
export const toReadable = <E, R>(stream: Stream.Stream<string | Uint8Array, E, R>): Effect.Effect<Readable, never, R> =>
  Effect.map(
    Effect.context<R>(),
    (context) => new StreamAdapter(context, stream)
  )

/**
 * @since 1.0.0
 * @category conversions
 */
export const toReadableNever = <E>(stream: Stream.Stream<string | Uint8Array, E, never>): Readable =>
  new StreamAdapter(
    Context.empty(),
    stream
  )

/**
 * @since 1.0.0
 * @category conversions
 */
export const toString = <E>(
  readable: LazyArg<Readable | NodeJS.ReadableStream>,
  options: {
    readonly onFailure: (error: unknown) => E
    readonly encoding?: BufferEncoding | undefined
    readonly maxBytes?: SizeInput | undefined
  }
): Effect.Effect<string, E> => {
  const maxBytesNumber = options.maxBytes ? Number(options.maxBytes) : undefined
  return Effect.callback((resume) => {
    const stream = readable()
    stream.setEncoding(options.encoding ?? "utf8")

    stream.once("error", (err) => {
      if ("closed" in stream && !stream.closed) {
        stream.destroy()
      }
      resume(Effect.fail(options.onFailure(err)))
    })
    stream.once("error", (err) => {
      resume(Effect.fail(options.onFailure(err)))
    })

    let string = ""
    let bytes = 0
    stream.once("end", () => {
      resume(Effect.succeed(string))
    })
    stream.on("data", (chunk) => {
      string += chunk
      bytes += Buffer.byteLength(chunk)
      if (maxBytesNumber && bytes > maxBytesNumber) {
        resume(Effect.fail(options.onFailure(new Error("maxBytes exceeded"))))
      }
    })
    return Effect.sync(() => {
      if ("closed" in stream && !stream.closed) {
        stream.destroy()
      }
    })
  })
}

/**
 * @since 1.0.0
 * @category conversions
 */
export const toUint8Array = <E>(
  readable: LazyArg<Readable | NodeJS.ReadableStream>,
  options: { readonly onFailure: (error: unknown) => E; readonly maxBytes?: SizeInput | undefined }
): Effect.Effect<Uint8Array, E> => {
  const maxBytesNumber = options.maxBytes ? Number(options.maxBytes) : undefined
  return Effect.callback((resume) => {
    const stream = readable()
    let buffer = Buffer.alloc(0)
    let bytes = 0
    stream.once("error", (err) => {
      if ("closed" in stream && !stream.closed) {
        stream.destroy()
      }
      resume(Effect.fail(options.onFailure(err)))
    })
    stream.once("end", () => {
      resume(Effect.succeed(buffer))
    })
    stream.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk])
      bytes += chunk.length
      if (maxBytesNumber && bytes > maxBytesNumber) {
        resume(Effect.fail(options.onFailure(new Error("maxBytes exceeded"))))
      }
    })
    return Effect.sync(() => {
      if ("closed" in stream && !stream.closed) {
        stream.destroy()
      }
    })
  })
}

// ----------------------------------------------------------------------------
// internal
// ----------------------------------------------------------------------------

const readableToQueue = <A, E>(queue: Queue.Queue<A, E>, options: {
  readonly readable: Readable | NodeJS.ReadableStream
  readonly onError: (error: unknown) => E
  readonly chunkSize: number | undefined
}) => {
  const readable = options.readable
  const latch = Effect.unsafeMakeLatch(true)
  let ended = false
  readable.on("readable", () => {
    latch.unsafeOpen()
  })
  readable.on("error", (error) => {
    Queue.unsafeDone(queue, Exit.fail(options.onError(error)))
  })
  readable.on("end", () => {
    ended = true
    latch.unsafeOpen()
  })
  return latch.await.pipe(
    Effect.flatMap(() => {
      latch.unsafeClose()
      if (ended) {
        return Queue.end(queue)
      }
      const chunk = Arr.empty<A>()
      let item = readable.read(options.chunkSize)
      if (item === null) return Effect.void
      while (item !== null) {
        chunk.push(item)
        item = readable.read(options.chunkSize)
      }
      return Queue.offerAll(queue, chunk)
    }),
    Effect.forever({ autoYield: false })
  )
}

class StreamAdapter<E, R> extends Readable {
  private readonly readLatch: Effect.Latch
  private fiber: Fiber.Fiber<void, E> | undefined = undefined

  constructor(
    context: Context.Context<R>,
    stream: Stream.Stream<Uint8Array | string, E, R>
  ) {
    super({})
    this.readLatch = Effect.unsafeMakeLatch(false)
    this.fiber = Stream.runForEachChunk(stream, (chunk) =>
      this.readLatch.whenOpen(Effect.sync(() => {
        if (chunk.length === 0) return
        this.readLatch.unsafeClose()
        for (let i = 0; i < chunk.length; i++) {
          const item = chunk[i]
          if (typeof item === "string") {
            this.push(item, "utf8")
          } else {
            this.push(item)
          }
        }
      }))).pipe(
        Effect.provideContext(context),
        Effect.runFork
      )
    this.fiber.addObserver((exit) => {
      this.fiber = undefined
      if (Exit.isSuccess(exit)) {
        this.push(null)
      } else {
        this._destroy(Cause.squash(exit.cause) as any, constVoid)
      }
    })
  }

  _read(_size: number): void {
    this.readLatch.unsafeOpen()
  }

  _destroy(_error: Error | null, callback: (error?: Error | null | undefined) => void): void {
    if (!this.fiber) {
      return callback(null)
    }
    Effect.runFork(Fiber.interrupt(this.fiber)).addObserver((exit) => {
      callback(exit._tag === "Failure" ? Cause.squash(exit.cause) as any : null)
    })
  }
}
