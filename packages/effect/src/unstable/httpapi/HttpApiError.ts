/**
 * @since 4.0.0
 */
import * as Schema from "../../Schema.ts"
import * as HttpApiSchema from "./HttpApiSchema.ts"

/**
 * @category errors
 * @since 4.0.0
 */
export class HttpApiSchemaError extends Schema.ErrorClass<HttpApiSchemaError>("effect/HttpApiSchemaError")({
  _tag: Schema.tag("HttpApiSchemaError"),
  message: Schema.String
}, {
  httpApiStatus: 400,
  description: "The request or response did not match the expected schema"
}) {
  /**
   * @since 4.0.0
   */
  static fromSchemaError(error: Schema.SchemaError): HttpApiSchemaError {
    return new HttpApiSchemaError({ message: error.message })
  }
}

/**
 * @category Built-in errors
 * @since 4.0.0
 */
export class BadRequest extends Schema.ErrorClass<BadRequest>("effect/HttpApiError/BadRequest")({
  _tag: Schema.tag("BadRequest")
}, {
  description: "BadRequest",
  httpApiStatus: 400
}) {}

/**
 * @category NoContent errors
 * @since 4.0.0
 */
export const BadRequestNoContent = BadRequest.pipe(HttpApiSchema.asNoContent({
  decode: () => new BadRequest({})
}))

/**
 * @category Built-in errors
 * @since 4.0.0
 */
export class Unauthorized extends Schema.ErrorClass<Unauthorized>("effect/HttpApiError/Unauthorized")({
  _tag: Schema.tag("Unauthorized")
}, {
  description: "Unauthorized",
  httpApiStatus: 401
}) {}

/**
 * @category NoContent errors
 * @since 4.0.0
 */
export const UnauthorizedNoContent = Unauthorized.pipe(HttpApiSchema.asNoContent({
  decode: () => new Unauthorized({})
}))

/**
 * @category Built-in errors
 * @since 4.0.0
 */
export class Forbidden extends Schema.ErrorClass<Forbidden>("effect/HttpApiError/Forbidden")({
  _tag: Schema.tag("Forbidden")
}, {
  description: "Forbidden",
  httpApiStatus: 403
}) {}

/**
 * @category NoContent errors
 * @since 4.0.0
 */
export const ForbiddenNoContent = Forbidden.pipe(HttpApiSchema.asNoContent({
  decode: () => new Forbidden({})
}))

/**
 * @category Built-in errors
 * @since 4.0.0
 */
export class NotFound extends Schema.ErrorClass<NotFound>("effect/HttpApiError/NotFound")({
  _tag: Schema.tag("NotFound")
}, {
  description: "NotFound",
  httpApiStatus: 404
}) {}

/**
 * @category NoContent errors
 * @since 4.0.0
 */
export const NotFoundNoContent = NotFound.pipe(HttpApiSchema.asNoContent({
  decode: () => new NotFound({})
}))

/**
 * @category Built-in errors
 * @since 4.0.0
 */
export class MethodNotAllowed extends Schema.ErrorClass<MethodNotAllowed>("effect/HttpApiError/MethodNotAllowed")({
  _tag: Schema.tag("MethodNotAllowed")
}, {
  description: "MethodNotAllowed",
  httpApiStatus: 405
}) {}

/**
 * @category NoContent errors
 * @since 4.0.0
 */
export const MethodNotAllowedNoContent = MethodNotAllowed.pipe(HttpApiSchema.asNoContent({
  decode: () => new MethodNotAllowed({})
}))

/**
 * @category Built-in errors
 * @since 4.0.0
 */
export class NotAcceptable extends Schema.ErrorClass<NotAcceptable>("effect/HttpApiError/NotAcceptable")({
  _tag: Schema.tag("NotAcceptable")
}, {
  description: "NotAcceptable",
  httpApiStatus: 406
}) {}

/**
 * @category NoContent errors
 * @since 4.0.0
 */
export const NotAcceptableNoContent = NotAcceptable.pipe(HttpApiSchema.asNoContent({
  decode: () => new NotAcceptable({})
}))

/**
 * @category Built-in errors
 * @since 4.0.0
 */
export class RequestTimeout extends Schema.ErrorClass<RequestTimeout>("effect/HttpApiError/RequestTimeout")({
  _tag: Schema.tag("RequestTimeout")
}, {
  description: "RequestTimeout",
  httpApiStatus: 408
}) {}

/**
 * @category NoContent errors
 * @since 4.0.0
 */
export const RequestTimeoutNoContent = RequestTimeout.pipe(HttpApiSchema.asNoContent({
  decode: () => new RequestTimeout({})
}))

/**
 * @category Built-in errors
 * @since 4.0.0
 */
export class Conflict extends Schema.ErrorClass<Conflict>("effect/HttpApiError/Conflict")({
  _tag: Schema.tag("Conflict")
}, {
  description: "Conflict",
  httpApiStatus: 409
}) {}

/**
 * @since 4.0.0
 * @category NoContent errors
 */
export const ConflictNoContent = Conflict.pipe(HttpApiSchema.asNoContent({
  decode: () => new Conflict({})
}))

/**
 * @category Built-in errors
 * @since 4.0.0
 */
export class Gone extends Schema.ErrorClass<Gone>("effect/HttpApiError/Gone")({
  _tag: Schema.tag("Gone")
}, {
  description: "Gone",
  httpApiStatus: 410
}) {}

/**
 * @category NoContent errors
 * @since 4.0.0
 */
export const GoneNoContent = Gone.pipe(HttpApiSchema.asNoContent({
  decode: () => new Gone({})
}))

/**
 * @category Built-in errors
 * @since 4.0.0
 */
export class InternalServerError
  extends Schema.ErrorClass<InternalServerError>("effect/HttpApiError/InternalServerError")({
    _tag: Schema.tag("InternalServerError")
  }, {
    description: "InternalServerError",
    httpApiStatus: 500
  })
{}

/**
 * @category NoContent errors
 * @since 4.0.0
 */
export const InternalServerErrorNoContent = InternalServerError.pipe(HttpApiSchema.asNoContent({
  decode: () => new InternalServerError({})
}))

/**
 * @category Built-in errors
 * @since 4.0.0
 */
export class NotImplemented extends Schema.ErrorClass<NotImplemented>("effect/HttpApiError/NotImplemented")({
  _tag: Schema.tag("NotImplemented")
}, {
  description: "NotImplemented",
  httpApiStatus: 501
}) {}

/**
 * @category NoContent errors
 * @since 4.0.0
 */
export const NotImplementedNoContent = NotImplemented.pipe(HttpApiSchema.asNoContent({
  decode: () => new NotImplemented({})
}))

/**
 * @category Built-in errors
 * @since 4.0.0
 */
export class ServiceUnavailable
  extends Schema.ErrorClass<ServiceUnavailable>("effect/HttpApiError/ServiceUnavailable")({
    _tag: Schema.tag("ServiceUnavailable")
  }, {
    description: "ServiceUnavailable",
    httpApiStatus: 503
  })
{}

/**
 * @category NoContent errors
 * @since 4.0.0
 */
export const ServiceUnavailableNoContent = ServiceUnavailable.pipe(HttpApiSchema.asNoContent({
  decode: () => new ServiceUnavailable({})
}))
