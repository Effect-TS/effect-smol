import { z } from "zod"

const schema = z.string()

console.log(schema.safeParse("Hello, World!"))
