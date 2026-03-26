/**
 * @since 4.0.0
 */
import * as Uuid from "uuid"
import type * as Cause from "../../Cause.ts"
import * as Effect from "../../Effect.ts"
import * as FiberMap from "../../FiberMap.ts"
import * as Layer from "../../Layer.ts"
import * as PubSub from "../../PubSub.ts"
import * as Queue from "../../Queue.ts"
import * as RcMap from "../../RcMap.ts"
import * as Schema from "../../Schema.ts"
import type * as Scope from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type * as HttpServerError from "../http/HttpServerError.ts"
import * as HttpServerRequest from "../http/HttpServerRequest.ts"
import * as HttpServerResponse from "../http/HttpServerResponse.ts"
import type * as Socket from "../socket/Socket.ts"
import { EntryId, makeRemoteIdUnsafe, type RemoteId } from "./EventJournal.ts"
import type { EncryptedRemoteEntry } from "./EventLogEncryption.ts"
import { ProtocolRequestUnencrypted } from "./EventLogRemote.ts"

const constChunkSize = 512_000

// TODO:
