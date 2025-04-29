import * as v from "valibot"

const schema = v.object({
  name: v.string(),
  username: v.pipe(v.array(v.number()), v.readonly()),
  age: v.number()
})

type Type = v.InferOutput<typeof schema>
