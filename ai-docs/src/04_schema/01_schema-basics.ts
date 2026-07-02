/**
 * @title Schema basics
 *
 * Define schema-backed classes, decode unknown input into typed values, and
 * encode typed values back into their external representation.
 */
import { Effect, Schema } from "effect"

// Schema.Class defines both a runtime validator and a TypeScript class.
// This is useful for domain models that should only be constructed from valid
// data. The static `Type` and `Encoded` members are available when you need
// the decoded or encoded TypeScript representation.
export class User extends Schema.Class<User>("User")({
  id: Schema.Number,
  name: Schema.NonEmptyString,
  email: Schema.String,
  role: Schema.Literals(["admin", "member"])
}) {}

export type UserType = (typeof User)["Type"]
export type UserEncoded = (typeof User)["Encoded"]

// Reuse parsers at the edges of your application instead of rebuilding them for
// every request. Use the Effect-returning APIs when you are already inside
// Effect code so validation errors remain typed in the error channel.
export const decodeUser = Schema.decodeUnknownEffect(User)
export const encodeUser = Schema.encodeEffect(User)

export class InvalidUserPayload extends Schema.TaggedErrorClass<InvalidUserPayload>()("InvalidUserPayload", {
  message: Schema.String
}) {}

export const parseUserPayload = Effect.fn("parseUserPayload")((input: unknown) =>
  decodeUser(input).pipe(
    Effect.mapError((error) => new InvalidUserPayload({ message: error.message }))
  )
)

// Class schemas also support transformations. NumberFromString decodes a string
// from the outside world into a number for application code, and encodes the
// number back to a string when sending it out again.
export class ListUsersQuery extends Schema.Class<ListUsersQuery>("ListUsersQuery")({
  page: Schema.NumberFromString,
  pageSize: Schema.NumberFromString
}) {}

const decodeListUsersQuery = Schema.decodeUnknownSync(ListUsersQuery)
const encodeListUsersQuery = Schema.encodeSync(ListUsersQuery)

// Decoding turns unknown external input into a validated class instance.
export const query = decodeListUsersQuery({ page: "1", pageSize: "50" })

// Encoding turns the class instance back into the external representation.
export const encodedQuery = encodeListUsersQuery(query)

// Schema.TaggedClass adds a literal _tag field, which is convenient for
// discriminated unions and event/message payloads.
export class UserCreated extends Schema.TaggedClass<UserCreated>()("UserCreated", {
  user: User
}) {}
