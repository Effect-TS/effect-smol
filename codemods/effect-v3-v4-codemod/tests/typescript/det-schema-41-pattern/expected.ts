const schema = Schema.String.pipe(Schema.check(Schema.isPattern(/^[a-z]+$/)))
