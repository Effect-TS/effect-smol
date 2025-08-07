import { Schema, Transformation } from "effect/schema"

// Test 1: Without transformation - should this type check?
const IntegerFromStringBad = Schema.String.pipe(Schema.decodeTo(Schema.Int))

// Test 2: With transformation - this should work
const IntegerFromStringGood = Schema.String.pipe(
  Schema.decodeTo(Schema.Int, Transformation.numberFromString)
)

console.log("Type checking complete")