const schema = Schema.Struct({
  a: Schema.String
}).pipe(Schema.annotations({ description: "A struct with a string" }))
