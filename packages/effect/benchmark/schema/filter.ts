import { type } from "arktype"
import { Check, Schema, ToParser } from "effect/schema"
import { Bench } from "tinybench"
import * as v from "valibot"
import { z } from "zod/v4-mini"

/*
┌─────────┬──────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name        │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼──────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema (good)'  │ '126.69 ± 0.21%' │ '125.00 ± 0.00'  │ '8233694 ± 0.01%'      │ '8000000 ± 0'          │ 7893590  │
│ 1       │ 'Schema (bad)'   │ '365.67 ± 3.43%' │ '250.00 ± 0.00'  │ '3848680 ± 0.02%'      │ '4000000 ± 0'          │ 2736153  │
│ 2       │ 'Valibot (good)' │ '46.90 ± 1.23%'  │ '42.00 ± 0.00'   │ '23094122 ± 0.01%'     │ '23809524 ± 0'         │ 21320236 │
│ 3       │ 'Valibot (bad)'  │ '72.57 ± 1.62%'  │ '83.00 ± 1.00'   │ '16446209 ± 0.02%'     │ '12048193 ± 143431'    │ 13779779 │
│ 4       │ 'Arktype (good)' │ '23.30 ± 0.09%'  │ '41.00 ± 1.00'   │ '32464267 ± 0.01%'     │ '24390244 ± 580720'    │ 42925626 │
│ 5       │ 'Arktype (bad)'  │ '1475.5 ± 7.93%' │ '1333.0 ± 41.00' │ '739226 ± 0.02%'       │ '750188 ± 22915'       │ 677739   │
│ 6       │ 'Zod (good)'     │ '38.13 ± 2.96%'  │ '42.00 ± 0.00'   │ '24136684 ± 0.00%'     │ '23809524 ± 0'         │ 26228462 │
│ 7       │ 'Zod (bad)'      │ '4955.9 ± 0.34%' │ '4834.0 ± 84.00' │ '204545 ± 0.02%'       │ '206868 ± 3658'        │ 201780   │
└─────────┴──────────────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴──────────┘
*/

const bench = new Bench()

const schema = Schema.String.pipe(Schema.check(Check.nonEmpty()))

const valibot = v.pipe(v.string(), v.nonEmpty())

const arktype = type("string > 0")

const zod = z.string().check(z.minLength(1))

const good = "a"
const bad = ""

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
