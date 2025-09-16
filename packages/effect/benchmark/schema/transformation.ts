import { type } from "arktype"
import { Schema, ToParser, Transformation } from "effect/schema"
import { Bench } from "tinybench"
import * as v from "valibot"
import { z } from "zod/v4-mini"

/*
┌─────────┬───────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼───────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema'  │ '161.25 ± 0.04%' │ '167.00 ± 0.00'  │ '6321089 ± 0.01%'      │ '5988024 ± 0'          │ 6201677  │
│ 1       │ 'Valibot' │ '51.40 ± 0.17%'  │ '42.00 ± 0.00'   │ '21453065 ± 0.01%'     │ '23809524 ± 1'         │ 19454217 │
│ 2       │ 'Arktype' │ '26.14 ± 0.13%'  │ '41.00 ± 1.00'   │ '29384597 ± 0.01%'     │ '24390244 ± 580720'    │ 38251549 │
│ 3       │ 'Zod'     │ '41.08 ± 1.24%'  │ '42.00 ± 0.00'   │ '23790825 ± 0.00%'     │ '23809524 ± 0'         │ 24345199 │
└─────────┴───────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴──────────┘
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
