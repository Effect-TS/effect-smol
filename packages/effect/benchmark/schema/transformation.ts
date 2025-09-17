import { Check, Schema, ToParser, Transformation } from "effect/schema"
import { Bench } from "tinybench"
import { z } from "zod"

/*
┌─────────┬─────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬─────────┐
│ (index) │ Task name       │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples │
├─────────┼─────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼─────────┤
│ 0       │ 'Schema (good)' │ '1074.9 ± 0.32%' │ '1041.0 ± 41.00' │ '962199 ± 0.01%'       │ '960615 ± 38106'       │ 930331  │
│ 1       │ 'Zod (good)'    │ '240.24 ± 3.69%' │ '209.00 ± 1.00'  │ '4542625 ± 0.01%'      │ '4784689 ± 23003'      │ 4162505 │
│ 2       │ 'Schema (bad)'  │ '595.78 ± 2.44%' │ '542.00 ± 1.00'  │ '1784711 ± 0.01%'      │ '1845018 ± 3410'       │ 1678484 │
│ 3       │ 'Zod (bad)'     │ '7330.7 ± 2.95%' │ '6375.0 ± 84.00' │ '155283 ± 0.04%'       │ '156863 ± 2094'        │ 136413  │
└─────────┴─────────────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴─────────┘
*/

const bench = new Bench()

const schema = Schema.Struct({
  a: Schema.String,
  id: Schema.String,
  c: Schema.Number.check(Check.nonNegative()),
  d: Schema.String
}).pipe(Schema.decodeTo(
  Schema.Struct({
    a: Schema.String,
    b: Schema.Struct({ id: Schema.String }),
    c: Schema.Number.check(Check.nonNegative()),
    d: Schema.String
  }),
  Transformation.transform({
    decode: ({ id, ...v }) => ({ ...v, b: { id } }),
    encode: ({ b: { id }, ...v }) => ({ ...v, id })
  })
))

const zod = z.codec(
  z.object({
    a: z.string(),
    id: z.string(),
    c: z.number().check(z.nonnegative()),
    d: z.string()
  }),
  z.object({
    a: z.string(),
    b: z.object({ id: z.string() }),
    c: z.number().check(z.nonnegative()),
    d: z.string()
  }),
  {
    decode: ({ id, ...v }) => ({ ...v, b: { id } }),
    encode: ({ b: { id }, ...v }) => ({ ...v, id })
  }
)

const good = {
  a: "a",
  id: "id",
  c: 1,
  d: "d"
}
const bad = {
  a: "a",
  id: "id",
  c: -1,
  d: "d"
}

const decodeUnknownExit = ToParser.decodeUnknownExit(schema)

// console.log(decodeUnknownExit(good))
// console.log(String(decodeUnknownExit(bad)))
// console.log(zod.safeDecode(good))
// console.log(zod.safeDecode(bad))

bench
  .add("Schema (good)", function() {
    decodeUnknownExit(good)
  })
  .add("Zod (good)", function() {
    zod.safeDecode(good)
  })
  .add("Schema (bad)", function() {
    decodeUnknownExit(bad)
  })
  .add("Zod (bad)", function() {
    zod.safeDecode(bad)
  })

await bench.run()

console.table(bench.table())
