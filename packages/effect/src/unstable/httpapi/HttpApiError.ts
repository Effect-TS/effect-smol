/**
 * @since 1.0.0
 */
import * as Effect from "../../Effect.ts"
import * as Formatter from "../../schema/Formatter.ts"
import * as Schema from "../../schema/Schema.ts"
import * as HttpApiSchema from "./HttpApiSchema.ts"

/**
 * @since 1.0.0
 * @category type ids
 */
export const TypeId: TypeId = "~effect/httpapi/HttpApiError"

/**
 * @since 1.0.0
 * @category type ids
 */
export type TypeId = "~effect/httpapi/HttpApiError"

// TODO: Add schema for structured issues
// /**
//  * @since 1.0.0
//  * @category schemas
//  */
// export class Issue extends Schema.ArrayFormatterIssue.annotations({
//   identifier: "Issue",
//   description: "Represents an error encountered while parsing a value to match the schema"
// }) {}

/**
 * @since 1.0.0
 * @category errors
 */
export class HttpApiSchemaError extends Schema.ErrorClass<HttpApiSchemaError>(TypeId)({
  _tag: Schema.tag("HttpApiSchemaError"),
  // issues: Schema.Array(Issue),
  message: Schema.String
}, {
  httpApiStatus: 400,
  description: "The request or response did not match the expected schema"
}) {
  /**
   * @since 1.0.0
   */
  static fromSchemaError(error: Schema.SchemaError): HttpApiSchemaError {
    const formatter = Formatter.makeTree()
    return new HttpApiSchemaError({ message: formatter.format(error.issue) })
  }
  /**
   * @since 1.0.0
   */
  static refailSchemaError(error: Schema.SchemaError): Effect.Effect<never, HttpApiSchemaError> {
    return Effect.fail(HttpApiSchemaError.fromSchemaError(error))
  }
}

/**
 * @since 1.0.0
 * @category empty errors
 */
export class BadRequest extends HttpApiSchema.EmptyError<BadRequest>()({
  tag: "BadRequest",
  status: 400
}) {}

/**
 * @since 1.0.0
 * @category empty errors
 */
export class Unauthorized extends HttpApiSchema.EmptyError<Unauthorized>()({
  tag: "Unauthorized",
  status: 401
}) {}

/**
 * @since 1.0.0
 * @category empty errors
 */
export class Forbidden extends HttpApiSchema.EmptyError<Forbidden>()({
  tag: "Forbidden",
  status: 403
}) {}

/**
 * @since 1.0.0
 * @category empty errors
 */
export class NotFound extends HttpApiSchema.EmptyError<NotFound>()({
  tag: "NotFound",
  status: 404
}) {}

/**
 * @since 1.0.0
 * @category empty errors
 */
export class MethodNotAllowed extends HttpApiSchema.EmptyError<MethodNotAllowed>()({
  tag: "MethodNotAllowed",
  status: 405
}) {}

/**
 * @since 1.0.0
 * @category empty errors
 */
export class NotAcceptable extends HttpApiSchema.EmptyError<NotAcceptable>()({
  tag: "NotAcceptable",
  status: 406
}) {}

/**
 * @since 1.0.0
 * @category empty errors
 */
export class RequestTimeout extends HttpApiSchema.EmptyError<RequestTimeout>()({
  tag: "RequestTimeout",
  status: 408
}) {}

/**
 * @since 1.0.0
 * @category empty errors
 */
export class Conflict extends HttpApiSchema.EmptyError<Conflict>()({
  tag: "Conflict",
  status: 409
}) {}

/**
 * @since 1.0.0
 * @category empty errors
 */
export class Gone extends HttpApiSchema.EmptyError<Gone>()({
  tag: "Gone",
  status: 410
}) {}

/**
 * @since 1.0.0
 * @category empty errors
 */
export class InternalServerError extends HttpApiSchema.EmptyError<InternalServerError>()({
  tag: "InternalServerError",
  status: 500
}) {}

/**
 * @since 1.0.0
 * @category empty errors
 */
export class NotImplemented extends HttpApiSchema.EmptyError<NotImplemented>()({
  tag: "NotImplemented",
  status: 501
}) {}

/**
 * @since 1.0.0
 * @category empty errors
 */
export class ServiceUnavailable extends HttpApiSchema.EmptyError<ServiceUnavailable>()({
  tag: "ServiceUnavailable",
  status: 503
}) {}
