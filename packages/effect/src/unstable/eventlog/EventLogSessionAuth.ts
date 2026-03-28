/**
 * @since 4.0.0
 */
import * as Data from "../../Data.ts"
import { Effect } from "../../index.ts"

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder("utf-8", { fatal: true })

const constLengthPrefixBytes = 4

/**
 * @since 4.0.0
 * @category constants
 */
export const AuthPayloadContext = "eventlog-auth-v1"

/**
 * @since 4.0.0
 * @category constants
 */
export const Ed25519PublicKeyLength = 32

/**
 * @since 4.0.0
 * @category constants
 */
export const Ed25519SignatureLength = 64

/**
 * @since 4.0.0
 * @category model
 */
export interface SessionAuthPayload {
  readonly remoteId: string
  readonly challenge: Uint8Array
  readonly publicKey: string
  readonly signingPublicKey: Uint8Array
}

/**
 * @since 4.0.0
 * @category errors
 */
export class EventLogSessionAuthError extends Data.TaggedError("EventLogSessionAuthError")<{
  readonly reason:
    | "InvalidPayload"
    | "InvalidContext"
    | "InvalidSigningPublicKeyLength"
    | "InvalidSignatureLength"
    | "InvalidSigningPrivateKey"
    | "CryptoUnavailable"
    | "CryptoFailure"
  readonly message: string
  readonly cause?: unknown
}> {}

const toArrayBuffer = (data: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(data.byteLength)
  copy.set(data)
  return copy.buffer
}

const decodeUtf8 = (bytes: Uint8Array) =>
  Effect.try({
    try: () => textDecoder.decode(bytes),
    catch: (cause) =>
      new EventLogSessionAuthError({
        reason: "InvalidPayload",
        message: "Session auth payload contains invalid UTF-8 bytes",
        cause
      })
  })

const assertSigningPublicKeyLength = (signingPublicKey: Uint8Array): Effect.Effect<void, EventLogSessionAuthError> => {
  if (signingPublicKey.byteLength === Ed25519PublicKeyLength) return Effect.void
  return Effect.fail(
    new EventLogSessionAuthError({
      reason: "InvalidSigningPublicKeyLength",
      message:
        `Expected signingPublicKey length to be ${Ed25519PublicKeyLength} bytes, received ${signingPublicKey.byteLength}`
    })
  )
}

const assertSignatureLength = (signature: Uint8Array): Effect.Effect<void, EventLogSessionAuthError> => {
  if (signature.byteLength === Ed25519SignatureLength) return Effect.void
  return Effect.fail(
    new EventLogSessionAuthError({
      reason: "InvalidSignatureLength",
      message: `Expected signature length to be ${Ed25519SignatureLength} bytes, received ${signature.byteLength}`
    })
  )
}

const getSubtle = Effect.suspend(() => {
  const subtle = globalThis.crypto?.subtle
  if (subtle === undefined) {
    return Effect.fail(
      new EventLogSessionAuthError({
        reason: "CryptoUnavailable",
        message: "globalThis.crypto.subtle is not available"
      })
    )
  }
  return Effect.succeed(subtle)
})

const writeLength = (
  target: Uint8Array,
  offset: number,
  length: number
): Effect.Effect<number, EventLogSessionAuthError> => {
  if (length < 0 || length > 0xffff_ffff) {
    return Effect.fail(
      new EventLogSessionAuthError({
        reason: "InvalidPayload",
        message: `Invalid canonical field length: ${length}`
      })
    )
  }

  target[offset] = (length >>> 24) & 0xff
  target[offset + 1] = (length >>> 16) & 0xff
  target[offset + 2] = (length >>> 8) & 0xff
  target[offset + 3] = length & 0xff

  return Effect.succeed(offset + constLengthPrefixBytes)
}

const readLength = (source: Uint8Array, offset: number): number =>
  (
    (source[offset]! << 24) |
    (source[offset + 1]! << 16) |
    (source[offset + 2]! << 8) |
    source[offset + 3]!
  ) >>> 0

const readField = (
  payload: Uint8Array,
  state: { offset: number }
): Effect.Effect<Uint8Array, EventLogSessionAuthError> => {
  if (state.offset + constLengthPrefixBytes > payload.byteLength) {
    return Effect.fail(
      new EventLogSessionAuthError({
        reason: "InvalidPayload",
        message: "Session auth payload is truncated before field length"
      })
    )
  }

  const length = readLength(payload, state.offset)
  state.offset += constLengthPrefixBytes

  if (state.offset + length > payload.byteLength) {
    return Effect.fail(
      new EventLogSessionAuthError({
        reason: "InvalidPayload",
        message: "Session auth payload is truncated inside a field"
      })
    )
  }

  const field = payload.slice(state.offset, state.offset + length)
  state.offset += length
  return Effect.succeed(field)
}

/**
 * Canonical payload format uses ordered big-endian length-prefixed fields:
 *
 * 1. context (fixed: eventlog-auth-v1)
 * 2. remoteId
 * 3. challenge bytes
 * 4. publicKey
 * 5. signingPublicKey bytes
 *
 * @since 4.0.0
 * @category encoding
 */
export const encodeSessionAuthPayload = Effect.fnUntraced(function*(payload: SessionAuthPayload) {
  yield* assertSigningPublicKeyLength(payload.signingPublicKey)

  const fields = [
    textEncoder.encode(AuthPayloadContext),
    textEncoder.encode(payload.remoteId),
    payload.challenge,
    textEncoder.encode(payload.publicKey),
    payload.signingPublicKey
  ]

  const totalLength = fields.reduce(
    (total, field) => total + constLengthPrefixBytes + field.byteLength,
    0
  )
  const encoded = new Uint8Array(totalLength)

  let offset = 0
  for (const field of fields) {
    offset = yield* writeLength(encoded, offset, field.byteLength)
    encoded.set(field, offset)
    offset += field.byteLength
  }

  return encoded
})

/**
 * @since 4.0.0
 * @category encoding
 */
export const decodeSessionAuthPayload = Effect.fnUntraced(
  function*(payload: Uint8Array): Effect.fn.Return<SessionAuthPayload, EventLogSessionAuthError> {
    const state = { offset: 0 }
    const context = yield* decodeUtf8(yield* readField(payload, state))

    if (context !== AuthPayloadContext) {
      return yield* new EventLogSessionAuthError({
        reason: "InvalidContext",
        message: `Invalid session auth payload context: ${context}`
      })
    }

    const remoteId = yield* decodeUtf8(yield* readField(payload, state))
    const challenge = yield* readField(payload, state)
    const publicKey = yield* decodeUtf8(yield* readField(payload, state))
    const signingPublicKey = yield* readField(payload, state)
    yield* assertSigningPublicKeyLength(signingPublicKey)

    if (state.offset !== payload.byteLength) {
      return yield* new EventLogSessionAuthError({
        reason: "InvalidPayload",
        message: "Session auth payload contains trailing bytes"
      })
    }

    return {
      remoteId,
      challenge,
      publicKey,
      signingPublicKey
    }
  }
)

/**
 * @since 4.0.0
 * @category signing
 */
export const signSessionAuthPayloadBytes = Effect.fnUntraced(function*(options: {
  readonly payload: Uint8Array
  readonly signingPrivateKey: Uint8Array
}): Effect.fn.Return<Uint8Array, EventLogSessionAuthError> {
  yield* decodeSessionAuthPayload(options.payload)

  const subtle = yield* getSubtle
  let privateKey = yield* Effect.tryPromise({
    try: () =>
      subtle.importKey(
        "pkcs8",
        toArrayBuffer(options.signingPrivateKey),
        "Ed25519",
        false,
        ["sign"]
      ),
    catch: (cause) =>
      new EventLogSessionAuthError({
        reason: "InvalidSigningPrivateKey",
        message: "Failed to import Ed25519 signing private key (expected PKCS#8 bytes)",
        cause
      })
  })

  const signature = yield* Effect.tryPromise({
    try: () => subtle.sign("Ed25519", privateKey, toArrayBuffer(options.payload)),
    catch: (cause) =>
      new EventLogSessionAuthError({
        reason: "CryptoFailure",
        message: "Failed to sign canonical session auth payload",
        cause
      })
  })
  return new Uint8Array(signature)
})

/**
 * @since 4.0.0
 * @category verification
 */
export const verifySessionAuthPayloadBytes = Effect.fnUntraced(function*(options: {
  readonly payload: Uint8Array
  readonly signingPublicKey: Uint8Array
  readonly signature: Uint8Array
}) {
  yield* decodeSessionAuthPayload(options.payload)
  yield* assertSigningPublicKeyLength(options.signingPublicKey)
  yield* assertSignatureLength(options.signature)

  const subtle = yield* getSubtle
  const publicKey = yield* Effect.tryPromise({
    try: () => subtle.importKey("raw", toArrayBuffer(options.signingPublicKey), "Ed25519", false, ["verify"]),
    catch: (cause) =>
      new EventLogSessionAuthError({
        reason: "InvalidSigningPublicKeyLength",
        message: "Failed to import Ed25519 signing public key",
        cause
      })
  })

  return yield* Effect.tryPromise({
    try: () => subtle.verify("Ed25519", publicKey, toArrayBuffer(options.signature), toArrayBuffer(options.payload)),
    catch: (cause) =>
      new EventLogSessionAuthError({
        reason: "CryptoFailure",
        message: "Failed to verify canonical session auth payload signature",
        cause
      })
  })
})

/**
 * @since 4.0.0
 * @category signing
 */
export const signSessionAuthPayload = (
  options: SessionAuthPayload & {
    readonly signingPrivateKey: Uint8Array
  }
) =>
  encodeSessionAuthPayload(options).pipe(
    Effect.flatMap((payload) =>
      signSessionAuthPayloadBytes({
        payload,
        signingPrivateKey: options.signingPrivateKey
      })
    )
  )

/**
 * @since 4.0.0
 * @category verification
 */
export const verifySessionAuthPayload = (
  options: SessionAuthPayload & {
    readonly signature: Uint8Array
  }
) =>
  encodeSessionAuthPayload(options).pipe(
    Effect.flatMap((payload) =>
      verifySessionAuthPayloadBytes({
        payload,
        signingPublicKey: options.signingPublicKey,
        signature: options.signature
      })
    )
  )
