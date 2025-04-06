/* eslint-disable no-console */
import { Schema, SchemaAST } from "effect"
import { Bench } from "tinybench"

/*
┌─────────┬───────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼───────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'flip'    │ '29.25 ± 0.03%'  │ '41.00 ± 1.00'   │ '27052098 ± 0.01%'     │ '24390244 ± 580720'    │ 34189228 │
└─────────┴───────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴──────────┘
*/

const bench = new Bench()

const schema = Schema.Struct({
  a: Schema.NumberToString
})

// console.log(SchemaAST.flip(schema.ast))

bench
  .add("flip", function() {
    SchemaAST.flip(SchemaAST.flip(schema.ast))
  })

await bench.run()

console.table(bench.table())
