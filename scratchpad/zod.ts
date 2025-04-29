import * as z from "@zod/mini"

const schema = z.int()

type Type = z.infer<typeof schema>
type Encoded = z.input<typeof schema>
