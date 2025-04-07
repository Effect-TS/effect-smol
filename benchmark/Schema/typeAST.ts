/* eslint-disable no-console */
import { Schema, SchemaAST } from "effect"
import { Bench } from "tinybench"

/*
┌─────────┬───────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼───────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'typeAST' │ '29.70 ± 0.03%'  │ '41.00 ± 1.00'   │ '26807748 ± 0.01%'     │ '24390244 ± 580720'    │ 33667597 │
└─────────┴───────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴──────────┘
*/

const bench = new Bench()

const schema = Schema.Struct({
  a: Schema.NumberFromString
})

// console.log(SchemaAST.typeAST(schema.ast))

bench
  .add("typeAST", function() {
    SchemaAST.typeAST(SchemaAST.typeAST(schema.ast))
  })

await bench.run()

console.table(bench.table())
