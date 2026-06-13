import { Type } from "@sinclair/typebox"
import { TypeCompiler } from "@sinclair/typebox/compiler"
import { Ajv } from "ajv"
import { Array as Arr, Option, Schema, SchemaCompiler } from "effect"
import { Bench } from "tinybench"
import * as v from "valibot"

const bench = new Bench({ time: 1000 })
const ajv = new Ajv({ allErrors: false, discriminator: true, strict: false })

// Mirrors the core object shape used by moltar/typescript-runtime-type-benchmarks
// assertLoose/assertStrict cases.
const MoltarNestedLoose = Schema.Struct({
  foo: Schema.String,
  num: Schema.Number,
  bool: Schema.Boolean
})
const MoltarObjectLoose = Schema.Struct({
  number: Schema.Number,
  negNumber: Schema.Number,
  maxNumber: Schema.Number,
  string: Schema.String,
  longString: Schema.String,
  boolean: Schema.Boolean,
  deeplyNested: MoltarNestedLoose
})

const ValibotMoltarNestedLoose = v.object({
  foo: v.string(),
  num: v.number(),
  bool: v.boolean()
})
const ValibotMoltarObjectLoose = v.object({
  number: v.number(),
  negNumber: v.number(),
  maxNumber: v.number(),
  string: v.string(),
  longString: v.string(),
  boolean: v.boolean(),
  deeplyNested: ValibotMoltarNestedLoose
})
const ValibotMoltarNestedStrict = v.strictObject({
  foo: v.string(),
  num: v.number(),
  bool: v.boolean()
})
const ValibotMoltarObjectStrict = v.strictObject({
  number: v.number(),
  negNumber: v.number(),
  maxNumber: v.number(),
  string: v.string(),
  longString: v.string(),
  boolean: v.boolean(),
  deeplyNested: ValibotMoltarNestedStrict
})

const AjvMoltarObjectLoose = ajv.compile({
  type: "object",
  properties: {
    number: { type: "number" },
    negNumber: { type: "number" },
    maxNumber: { type: "number" },
    string: { type: "string" },
    longString: { type: "string" },
    boolean: { type: "boolean" },
    deeplyNested: {
      type: "object",
      properties: {
        foo: { type: "string" },
        num: { type: "number" },
        bool: { type: "boolean" }
      },
      required: ["foo", "num", "bool"]
    }
  },
  required: ["number", "negNumber", "maxNumber", "string", "longString", "boolean", "deeplyNested"]
})
const AjvMoltarObjectStrict = ajv.compile({
  type: "object",
  properties: {
    number: { type: "number" },
    negNumber: { type: "number" },
    maxNumber: { type: "number" },
    string: { type: "string" },
    longString: { type: "string" },
    boolean: { type: "boolean" },
    deeplyNested: {
      type: "object",
      properties: {
        foo: { type: "string" },
        num: { type: "number" },
        bool: { type: "boolean" }
      },
      required: ["foo", "num", "bool"],
      additionalProperties: false
    }
  },
  required: ["number", "negNumber", "maxNumber", "string", "longString", "boolean", "deeplyNested"],
  additionalProperties: false
})

const TypeBoxMoltarNestedLoose = Type.Object({
  foo: Type.String(),
  num: Type.Number(),
  bool: Type.Boolean()
})
const TypeBoxMoltarObjectLoose = TypeCompiler.Compile(Type.Object({
  number: Type.Number(),
  negNumber: Type.Number(),
  maxNumber: Type.Number(),
  string: Type.String(),
  longString: Type.String(),
  boolean: Type.Boolean(),
  deeplyNested: TypeBoxMoltarNestedLoose
}))
const TypeBoxMoltarNestedStrict = Type.Object({
  foo: Type.String(),
  num: Type.Number(),
  bool: Type.Boolean()
}, { additionalProperties: false })
const TypeBoxMoltarObjectStrict = TypeCompiler.Compile(Type.Object({
  number: Type.Number(),
  negNumber: Type.Number(),
  maxNumber: Type.Number(),
  string: Type.String(),
  longString: Type.String(),
  boolean: Type.Boolean(),
  deeplyNested: TypeBoxMoltarNestedStrict
}, { additionalProperties: false }))

const moltarObjects = Arr.makeBy(1_000, (i) => ({
  number: i,
  negNumber: -i,
  maxNumber: Number.MAX_SAFE_INTEGER,
  string: `string-${i}`,
  longString: `long-string-${i}-abcdefghijklmnopqrstuvwxyz`,
  boolean: i % 2 === 0,
  deeplyNested: {
    foo: `foo-${i}`,
    num: i,
    bool: i % 2 === 1
  }
}))

const isMoltarObjectLoose = Schema.is(MoltarObjectLoose)
const isCompiledTypeGuardMoltarObjectLoose = SchemaCompiler.compileTypeGuard(MoltarObjectLoose)
const isCompiledTypeGuardMoltarObjectLooseSimple = SchemaCompiler.compileTypeGuard(MoltarObjectLoose, {
  simpleInputs: true
})
const parseMoltarObjectStrict = Schema.decodeUnknownOption(MoltarObjectLoose, { onExcessProperty: "error" })
const isCompiledTypeGuardMoltarObjectStrict = SchemaCompiler.compileTypeGuard(MoltarObjectLoose, {
  strict: true
})
const isCompiledTypeGuardMoltarObjectStrictSimple = SchemaCompiler.compileTypeGuard(MoltarObjectLoose, {
  simpleInputs: true,
  strict: true
})

const Member = Schema.Union([
  Schema.Struct({ _tag: Schema.Literal("Admin"), permissions: Schema.Array(Schema.String) }),
  Schema.Struct({ _tag: Schema.Literal("Editor"), sections: Schema.Array(Schema.String) }),
  Schema.Struct({ _tag: Schema.Literal("Viewer"), expires: Schema.optional(Schema.Number) })
])
const ValibotMember = v.variant("_tag", [
  v.object({ _tag: v.literal("Admin"), permissions: v.array(v.string()) }),
  v.object({ _tag: v.literal("Editor"), sections: v.array(v.string()) }),
  v.object({ _tag: v.literal("Viewer"), expires: v.optional(v.number()) })
])
const AjvMember = ajv.compile({
  oneOf: [
    {
      type: "object",
      properties: {
        _tag: { const: "Admin" },
        permissions: {
          type: "array",
          items: { type: "string" }
        }
      },
      required: ["_tag", "permissions"]
    },
    {
      type: "object",
      properties: {
        _tag: { const: "Editor" },
        sections: {
          type: "array",
          items: { type: "string" }
        }
      },
      required: ["_tag", "sections"]
    },
    {
      type: "object",
      properties: {
        _tag: { const: "Viewer" },
        expires: { type: "number" }
      },
      required: ["_tag"]
    }
  ],
  discriminator: { propertyName: "_tag" }
})
const TypeBoxMember = TypeCompiler.Compile(Type.Union([
  Type.Object({ _tag: Type.Literal("Admin"), permissions: Type.Array(Type.String()) }),
  Type.Object({ _tag: Type.Literal("Editor"), sections: Type.Array(Type.String()) }),
  Type.Object({ _tag: Type.Literal("Viewer"), expires: Type.Optional(Type.Number()) })
]))

const members = Arr.makeBy(1_000, (i) =>
  i % 3 === 0
    ? { _tag: "Admin", permissions: ["read", "write"] }
    : i % 3 === 1
    ? { _tag: "Editor", sections: ["docs"] }
    : { _tag: "Viewer", expires: i })

const isMember = Schema.is(Member)
const isCompiledTypeGuardMember = SchemaCompiler.compileTypeGuard(Member)

isMoltarObjectLoose(moltarObjects[0])
isCompiledTypeGuardMoltarObjectLoose(moltarObjects[0])
isCompiledTypeGuardMoltarObjectLooseSimple(moltarObjects[0])
Option.isSome(parseMoltarObjectStrict(moltarObjects[0]))
isCompiledTypeGuardMoltarObjectStrict(moltarObjects[0])
isCompiledTypeGuardMoltarObjectStrictSimple(moltarObjects[0])
v.is(ValibotMoltarObjectLoose, moltarObjects[0])
v.is(ValibotMoltarObjectStrict, moltarObjects[0])
AjvMoltarObjectLoose(moltarObjects[0])
AjvMoltarObjectStrict(moltarObjects[0])
TypeBoxMoltarObjectLoose.Check(moltarObjects[0])
TypeBoxMoltarObjectStrict.Check(moltarObjects[0])
isMember(members[0])
isCompiledTypeGuardMember(members[0])
v.is(ValibotMember, members[0])
AjvMember(members[0])
TypeBoxMember.Check(members[0])

bench
  .add("SchemaCompiler.compileTypeGuard moltar loose object", function() {
    for (let i = 0; i < moltarObjects.length; i++) {
      isCompiledTypeGuardMoltarObjectLoose(moltarObjects[i])
    }
  })
  .add("SchemaCompiler.compileTypeGuard moltar loose simple object", function() {
    for (let i = 0; i < moltarObjects.length; i++) {
      isCompiledTypeGuardMoltarObjectLooseSimple(moltarObjects[i])
    }
  })
  .add("TypeBox moltar loose object", function() {
    for (let i = 0; i < moltarObjects.length; i++) {
      TypeBoxMoltarObjectLoose.Check(moltarObjects[i])
    }
  })
  .add("Ajv moltar loose object", function() {
    for (let i = 0; i < moltarObjects.length; i++) {
      AjvMoltarObjectLoose(moltarObjects[i])
    }
  })
  .add("Valibot moltar loose object", function() {
    for (let i = 0; i < moltarObjects.length; i++) {
      v.is(ValibotMoltarObjectLoose, moltarObjects[i])
    }
  })
  .add("Schema.is moltar loose object", function() {
    for (let i = 0; i < moltarObjects.length; i++) {
      isMoltarObjectLoose(moltarObjects[i])
    }
  })
  .add("SchemaCompiler.compileTypeGuard moltar strict object", function() {
    for (let i = 0; i < moltarObjects.length; i++) {
      isCompiledTypeGuardMoltarObjectStrict(moltarObjects[i])
    }
  })
  .add("SchemaCompiler.compileTypeGuard moltar strict simple object", function() {
    for (let i = 0; i < moltarObjects.length; i++) {
      isCompiledTypeGuardMoltarObjectStrictSimple(moltarObjects[i])
    }
  })
  .add("TypeBox moltar strict object", function() {
    for (let i = 0; i < moltarObjects.length; i++) {
      TypeBoxMoltarObjectStrict.Check(moltarObjects[i])
    }
  })
  .add("Ajv moltar strict object", function() {
    for (let i = 0; i < moltarObjects.length; i++) {
      AjvMoltarObjectStrict(moltarObjects[i])
    }
  })
  .add("Valibot moltar strict object", function() {
    for (let i = 0; i < moltarObjects.length; i++) {
      v.is(ValibotMoltarObjectStrict, moltarObjects[i])
    }
  })
  .add("Schema.decodeUnknownOption moltar strict object", function() {
    for (let i = 0; i < moltarObjects.length; i++) {
      Option.isSome(parseMoltarObjectStrict(moltarObjects[i]))
    }
  })
  .add("SchemaCompiler.compileTypeGuard discriminated union", function() {
    for (let i = 0; i < members.length; i++) {
      isCompiledTypeGuardMember(members[i])
    }
  })
  .add("TypeBox discriminated union", function() {
    for (let i = 0; i < members.length; i++) {
      TypeBoxMember.Check(members[i])
    }
  })
  .add("Ajv discriminated union", function() {
    for (let i = 0; i < members.length; i++) {
      AjvMember(members[i])
    }
  })
  .add("Valibot discriminated union", function() {
    for (let i = 0; i < members.length; i++) {
      v.is(ValibotMember, members[i])
    }
  })
  .add("Schema.is discriminated union", function() {
    for (let i = 0; i < members.length; i++) {
      isMember(members[i])
    }
  })

await bench.run()

console.table(bench.table())
