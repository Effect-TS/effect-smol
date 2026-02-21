const schema = Schema.Struct({
  a: Schema.String
}).pipe(Schema.annotate({ description: "A struct with a string" }))
