import { type } from "arktype"
import { Schema, ToParser } from "effect/schema"
import { Bench } from "tinybench"
import * as v from "valibot"
import { z } from "zod/v4-mini"

/*
┌─────────┬──────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name        │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼──────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema (good)'  │ '1921.1 ± 3.30%' │ '1666.0 ± 41.00' │ '595955 ± 0.02%'       │ '600240 ± 15145'       │ 520711   │
│ 1       │ 'Schema (bad)'   │ '2191.7 ± 2.47%' │ '1709.0 ± 42.00' │ '571028 ± 0.03%'       │ '585138 ± 14743'       │ 456265   │
│ 2       │ 'Valibot (good)' │ '54.40 ± 1.10%'  │ '42.00 ± 1.00'   │ '20905815 ± 0.01%'     │ '23809524 ± 580719'    │ 18382467 │
│ 3       │ 'Valibot (bad)'  │ '103.04 ± 0.29%' │ '84.00 ± 1.00'   │ '10545054 ± 0.01%'     │ '11904762 ± 143431'    │ 9704991  │
│ 4       │ 'Arktype (good)' │ '22.91 ± 0.19%'  │ '41.00 ± 1.00'   │ '32904727 ± 0.01%'     │ '24390244 ± 580720'    │ 43647471 │
│ 5       │ 'Arktype (bad)'  │ '1609.0 ± 2.50%' │ '1542.0 ± 41.00' │ '638885 ± 0.01%'       │ '648508 ± 16796'       │ 621498   │
│ 6       │ 'Zod (good)'     │ '42.59 ± 4.99%'  │ '42.00 ± 0.00'   │ '23843671 ± 0.00%'     │ '23809524 ± 0'         │ 23481072 │
│ 7       │ 'Zod (bad)'      │ '4843.8 ± 2.47%' │ '4583.0 ± 83.00' │ '217315 ± 0.02%'       │ '218198 ± 3927'        │ 206451   │
└─────────┴──────────────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴──────────┘
*/

const bench = new Bench()

const schema = Schema.Struct({
  a: Schema.String
})

const valibot = v.object({
  a: v.string()
})

const arktype = type({
  a: "string"
})

const zod = z.object({
  a: z.string()
})

const good = { a: "a" }
const bad = { a: 1 }

const decodeUnknownExit = ToParser.decodeUnknownExit(schema)

// console.log(decodeUnknownExit(good))
// console.log(decodeUnknownExit(bad))
// console.log(v.safeParse(valibot, good))
// console.log(v.safeParse(valibot, bad))
// console.log(arktype(good))
// console.log(arktype(bad))
// console.log(zod.safeParse(good))
// console.log(zod.safeParse(bad))

bench
  .add("Schema (good)", function() {
    decodeUnknownExit(good)
  })
  .add("Schema (bad)", function() {
    decodeUnknownExit(bad)
  })
  .add("Valibot (good)", function() {
    v.safeParse(valibot, good)
  })
  .add("Valibot (bad)", function() {
    v.safeParse(valibot, bad)
  })
  .add("Arktype (good)", function() {
    arktype(good)
  })
  .add("Arktype (bad)", function() {
    arktype(bad)
  })
  .add("Zod (good)", function() {
    zod.safeParse(good)
  })
  .add("Zod (bad)", function() {
    zod.safeParse(bad)
  })

await bench.run()

console.table(bench.table())
