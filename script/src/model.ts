import { Schema } from "effect"

export class PackageJson extends Schema.Class<PackageJson>("PackageJson")({
  name: Schema.String,
  version: Schema.String,
  description: Schema.String,
  type: Schema.Literal("module"),
  license: Schema.optionalWith(Schema.String, { default: () => "UNLICENSED" }),
  keywords: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  tags: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  homepage: Schema.optional(Schema.String),
  author: Schema.optional(
    Schema.Union(
      Schema.String,
      Schema.Struct({
        name: Schema.String,
        email: Schema.String,
        url: Schema.optional(Schema.String)
      })
    )
  ),
  repository: Schema.Union(
    Schema.String,
    Schema.Struct({
      type: Schema.String,
      url: Schema.String,
      directory: Schema.optional(Schema.String)
    })
  ),
  publishConfig: Schema.optional(Schema.Struct({
    provenance: Schema.optionalWith(Schema.Boolean, { default: () => false })
  })),
  sideEffects: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  bin: Schema.optional(Schema.Record({
    key: Schema.String,
    value: Schema.String
  })),
  main: Schema.optional(Schema.String),
  types: Schema.optional(Schema.String),
  exports: Schema.optional(Schema.Record({
    key: Schema.String,
    value: Schema.NullOr(Schema.Union(
      Schema.String,
      Schema.Struct({
        types: Schema.optional(Schema.String),
        browser: Schema.optional(Schema.String),
        default: Schema.optional(Schema.String)
      })
    ))
  })),
  dependencies: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.String
    })
  ),
  peerDependencies: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.String
    })
  ),
  peerDependenciesMeta: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Struct({ optional: Schema.Boolean })
    })
  ),
  optionalDependencies: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.String
    })
  )
}) {}
