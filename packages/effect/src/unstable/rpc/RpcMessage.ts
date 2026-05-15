/**
 * @since 4.0.0
 */
import type { NonEmptyReadonlyArray } from "../../Array.ts"
import type { Branded } from "../../Brand.ts"
import * as Schema from "../../Schema.ts"
import type { Headers } from "../http/Headers.ts"
import type * as Rpc from "./Rpc.ts"
import type { RpcClientError } from "./RpcClientError.ts"

/**
 * @category request
 * @since 4.0.0
 */
export type FromClient<A extends Rpc.Any> = Request<A> | Ack | Interrupt | Eof

/**
 * @category request
 * @since 4.0.0
 */
export type FromClientEncoded = RequestEncoded | AckEncoded | InterruptEncoded | Ping | Eof

/**
 * @category request
 * @since 4.0.0
 */
export type RequestId = Branded<bigint, "~effect/rpc/RpcMessage/RequestId">

/**
 * @category request
 * @since 4.0.0
 */
export const RequestId = (id: bigint | string): RequestId =>
  typeof id === "bigint" ? id as RequestId : BigInt(id) as RequestId

/**
 * @category request
 * @since 4.0.0
 */
export interface RequestEncoded {
  readonly _tag: "Request"
  readonly id: string
  readonly tag: string
  readonly payload: unknown
  readonly headers: ReadonlyArray<[string, string]>
  readonly traceId?: string
  readonly spanId?: string
  readonly sampled?: boolean
}

/**
 * @category request
 * @since 4.0.0
 */
export interface Request<A extends Rpc.Any> {
  readonly _tag: "Request"
  readonly id: RequestId
  readonly tag: Rpc.Tag<A>
  readonly payload: Rpc.Payload<A>
  readonly headers: Headers
  readonly traceId?: string
  readonly spanId?: string
  readonly sampled?: boolean
}

/**
 * @category request
 * @since 4.0.0
 */
export interface Ack {
  readonly _tag: "Ack"
  readonly requestId: RequestId
}

/**
 * @category request
 * @since 4.0.0
 */
export interface Interrupt {
  readonly _tag: "Interrupt"
  readonly requestId: RequestId
  readonly interruptors: ReadonlyArray<number>
}

/**
 * @category request
 * @since 4.0.0
 */
export interface AckEncoded {
  readonly _tag: "Ack"
  readonly requestId: string
}

/**
 * @category request
 * @since 4.0.0
 */
export interface InterruptEncoded {
  readonly _tag: "Interrupt"
  readonly requestId: string
}

/**
 * @category request
 * @since 4.0.0
 */
export interface Eof {
  readonly _tag: "Eof"
}

/**
 * @category request
 * @since 4.0.0
 */
export interface Ping {
  readonly _tag: "Ping"
}

/**
 * @category request
 * @since 4.0.0
 */
export const constEof: Eof = { _tag: "Eof" }

/**
 * @category request
 * @since 4.0.0
 */
export const constPing: Ping = { _tag: "Ping" }

/**
 * @category response
 * @since 4.0.0
 */
export type FromServer<A extends Rpc.Any> =
  | ResponseChunk<A>
  | ResponseExit<A>
  | ResponseDefect
  | ClientEnd

/**
 * @category response
 * @since 4.0.0
 */
export type FromServerEncoded =
  | ResponseChunkEncoded
  | ResponseExitEncoded
  | ResponseDefectEncoded
  | Pong
  | ClientProtocolError

/**
 * @category response
 * @since 4.0.0
 */
export const ResponseIdTypeId = "~effect//rpc/RpcServer/ResponseId"

/**
 * @category response
 * @since 4.0.0
 */
export type ResponseIdTypeId = typeof ResponseIdTypeId

/**
 * @category response
 * @since 4.0.0
 */
export type ResponseId = Branded<number, ResponseIdTypeId>

/**
 * @category response
 * @since 4.0.0
 */
export interface ResponseChunkEncoded {
  readonly _tag: "Chunk"
  readonly requestId: string
  readonly values: NonEmptyReadonlyArray<unknown>
}

/**
 * @category response
 * @since 4.0.0
 */
export interface ResponseChunk<A extends Rpc.Any> {
  readonly _tag: "Chunk"
  readonly clientId: number
  readonly requestId: RequestId
  readonly values: NonEmptyReadonlyArray<Rpc.SuccessChunk<A>>
}

/**
 * @category response
 * @since 4.0.0
 */
export type ExitEncoded<A, E> = {
  readonly _tag: "Success"
  readonly value: A
} | {
  readonly _tag: "Failure"
  readonly cause: ReadonlyArray<
    {
      readonly _tag: "Fail"
      readonly error: E
    } | {
      readonly _tag: "Die"
      readonly defect: unknown
    } | {
      readonly _tag: "Interrupt"
      readonly fiberId: number | undefined
    }
  >
}

/**
 * @category response
 * @since 4.0.0
 */
export interface ResponseExitEncoded {
  readonly _tag: "Exit"
  readonly requestId: string
  readonly exit: ExitEncoded<unknown, unknown>
}

/**
 * @category response
 * @since 4.0.0
 */
export interface ClientProtocolError {
  readonly _tag: "ClientProtocolError"
  readonly error: RpcClientError
}

/**
 * @category response
 * @since 4.0.0
 */
export interface ResponseExit<A extends Rpc.Any> {
  readonly _tag: "Exit"
  readonly clientId: number
  readonly requestId: RequestId
  readonly exit: Rpc.Exit<A>
}

/**
 * @category response
 * @since 4.0.0
 */
export interface ResponseDefectEncoded {
  readonly _tag: "Defect"
  readonly defect: unknown
}

const encodeDefect = Schema.encodeSync(Schema.Defect)

/**
 * @category response
 * @since 4.0.0
 */
export const ResponseExitDieEncoded = (options: {
  readonly requestId: RequestId
  readonly defect: unknown
}): ResponseExitEncoded => ({
  _tag: "Exit",
  requestId: options.requestId.toString(),
  exit: {
    _tag: "Failure",
    cause: [{
      _tag: "Die",
      defect: encodeDefect(options.defect)
    }]
  }
})

/**
 * @category response
 * @since 4.0.0
 */
export const ResponseDefectEncoded = (input: unknown): ResponseDefectEncoded => ({
  _tag: "Defect",
  defect: encodeDefect(input)
})

/**
 * @category response
 * @since 4.0.0
 */
export interface ResponseDefect {
  readonly _tag: "Defect"
  readonly clientId: number
  readonly defect: unknown
}

/**
 * @category response
 * @since 4.0.0
 */
export interface ClientEnd {
  readonly _tag: "ClientEnd"
  readonly clientId: number
}

/**
 * @category response
 * @since 4.0.0
 */
export interface Pong {
  readonly _tag: "Pong"
}

/**
 * @category response
 * @since 4.0.0
 */
export const constPong: Pong = { _tag: "Pong" }
