import { type } from "arktype"
import { Schema, ToParser, Transformation } from "effect/schema"
import { Bench } from "tinybench"
import * as v from "valibot"
import { z } from "zod/v4-mini"

/*
┌─────────┬──────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name    │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼──────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema'     │ '116.51 ± 0.51%' │ '125.00 ± 0.00'  │ '9183955 ± 0.02%'      │ '8000000 ± 0'          │ 8582728  │
│ 1       │ 'Valibot'    │ '54.98 ± 0.19%'  │ '42.00 ± 1.00'   │ '20602170 ± 0.01%'     │ '23809524 ± 580719'    │ 18187279 │
│ 2       │ 'Arktype'    │ '26.67 ± 0.25%'  │ '41.00 ± 1.00'   │ '28986083 ± 0.01%'     │ '24390244 ± 580720'    │ 37492035 │
│ 3       │ 'Zod'        │ '41.62 ± 1.29%'  │ '42.00 ± 0.00'   │ '23691537 ± 0.00%'     │ '23809524 ± 0'         │ 24029715 │
└─────────┴──────────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴──────────┘
*/

const bench = new Bench()

const schema = Schema.String.pipe(Schema.decodeTo(Schema.String, Transformation.trim()))

const valibot = v.pipe(v.string(), v.trim())

const arktype = type("string").pipe((str) => str.trim())

const zod = z.string().check(z.trim())

const good = " a "

const decodeUnknownExit = ToParser.decodeUnknownExit(schema)

// console.log(decodeUnknownExit(good))
// console.log(v.safeParse(valibot, good))
// console.log(arktype(good))
// console.log(zod.safeParse(good))

bench
  .add("Schema", function() {
    decodeUnknownExit(good)
  })
  .add("Valibot", function() {
    v.safeParse(valibot, good)
  })
  .add("Arktype", function() {
    arktype(good)
  })
  .add("Zod", function() {
    zod.safeParse(good)
  })

await bench.run()

console.table(bench.table())
