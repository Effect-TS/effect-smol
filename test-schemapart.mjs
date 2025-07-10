import * as Check from "#dist/effect/schema/Check"
import * as Schema from "#dist/effect/schema/Schema"

// Test SchemaPart examples
// Example 1: Basic SchemaPart Usage
const stringPart = Schema.String
const numberPart = Schema.Number
const bigintPart = Schema.BigInt

// Example 2: Template Literal with Schema Parts
const userIdSchema = Schema.TemplateLiteral([
  "user-",
  Schema.Number, // SchemaPart
  "-",
  Schema.String // SchemaPart
])

// Valid: "user-123-john"
const validUserId = Schema.decodeUnknownSync(userIdSchema)("user-123-john")
console.log(validUserId) // "user-123-john"

// Example 3: Custom Schema Part with Constraints
const positiveNumberPart = Schema.Number.check(Check.positive())
const nonEmptyStringPart = Schema.String.check(Check.nonEmpty())

// Use in template literal
const productCodeSchema = Schema.TemplateLiteral([
  "PRD-",
  positiveNumberPart,
  "-",
  nonEmptyStringPart
])

// Valid: "PRD-123-widget"
const validProductCode = Schema.decodeUnknownSync(productCodeSchema)("PRD-123-widget")
console.log(validProductCode) // "PRD-123-widget"

// Example 4: Type-Level Usage
function createVersionedTemplate(prefix, versionPart) {
  return Schema.TemplateLiteral([prefix, versionPart])
}

// Usage with different schema parts
const versionWithNumber = createVersionedTemplate("v", Schema.Number)
const versionWithString = createVersionedTemplate("v", Schema.String)

// Validate version patterns
const validVersion = Schema.decodeUnknownSync(versionWithNumber)("v123")
console.log(validVersion) // "v123"

console.log("All SchemaPart examples compile successfully!")
