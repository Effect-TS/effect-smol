import { Schema, SchemaParser } from "effect"
import { Bench } from "tinybench"
import * as v from "valibot"

/*
┌─────────┬───────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼───────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema'  │ '38.36 ± 2.28%'  │ '42.00 ± 0.00'   │ '24199700 ± 0.00%'     │ '23809524 ± 0'         │ 26067928 │
│ 1       │ 'Valibot' │ '49.12 ± 1.96%'  │ '42.00 ± 0.00'   │ '22851380 ± 0.01%'     │ '23809524 ± 1'         │ 20356861 │
└─────────┴───────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴──────────┘
*/

const bench = new Bench({ time: 1000 })

const schema = Schema.Struct({
  a: Schema.String
})

const ObjectSchema = v.object({
  a: v.string()
})

const good = { a: "a" }

const decodeUnknownSync = SchemaParser.decodeUnknownSync(schema)

// console.log(decodeUnknownSync(good))
// console.log(v.safeParse(ObjectSchema, good))

bench
  .add("Schema", function() {
    decodeUnknownSync(good)
  })
  .add("Valibot", function() {
    v.safeParse(ObjectSchema, good)
  })

await bench.run()

console.table(bench.table())
