import { z } from "zod"

const schema = z.object({
  a: z.string(),
  b: z.number().optional(),
  c: z.array(z.string())
})

console.log(schema.safeParse({ a: "a", b: 1, c: ["c"] }))
