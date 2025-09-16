import { type } from "arktype"
import { Check, Schema, ToParser } from "effect/schema"
import { Bench } from "tinybench"
import * as v from "valibot"
import { z } from "zod/v4-mini"

/*
┌─────────┬──────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name        │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼──────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema (good)'  │ '127.03 ± 1.46%' │ '125.00 ± 0.00'  │ '8219346 ± 0.01%'      │ '8000000 ± 0'          │ 7871893  │
│ 1       │ 'Schema (bad)'   │ '353.12 ± 3.62%' │ '250.00 ± 41.00' │ '4181500 ± 0.02%'      │ '4000000 ± 563574'     │ 2834666  │
│ 2       │ 'Valibot (good)' │ '48.99 ± 1.41%'  │ '42.00 ± 0.00'   │ '22607918 ± 0.01%'     │ '23809524 ± 1'         │ 20410418 │
│ 3       │ 'Valibot (bad)'  │ '74.45 ± 4.35%'  │ '83.00 ± 1.00'   │ '16561688 ± 0.02%'     │ '12048193 ± 143431'    │ 13431919 │
│ 4       │ 'Arktype (good)' │ '23.31 ± 0.20%'  │ '41.00 ± 1.00'   │ '32470924 ± 0.01%'     │ '24390244 ± 580720'    │ 42898608 │
│ 5       │ 'Arktype (bad)'  │ '1421.7 ± 2.61%' │ '1375.0 ± 41.00' │ '725368 ± 0.01%'       │ '727273 ± 21058'       │ 703404   │
│ 6       │ 'Zod (good)'     │ '38.37 ± 2.05%'  │ '42.00 ± 0.00'   │ '24208046 ± 0.00%'     │ '23809524 ± 0'         │ 26065186 │
│ 7       │ 'Zod (bad)'      │ '4984.4 ± 0.29%' │ '4875.0 ± 83.00' │ '203101 ± 0.02%'       │ '205128 ± 3434'        │ 200627   │
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
