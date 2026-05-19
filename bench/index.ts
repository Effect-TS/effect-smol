/**
 * effect-smol bench runner. Outputs JSON with raw per-run samples for
 * downstream Welch's t-test (see bench/harness.ts).
 *
 * Usage:
 *   bun run bench/index.ts                       # default WARMUP=10 RUNS=30
 *   WARMUP=10 RUNS=30 bun run bench/index.ts
 *
 * Output:
 *   bench/results/baseline-<sha>.json (or path passed as first arg)
 */

import { execSync } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { RUNS, WARMUP, type BenchScenarioResult } from "./harness.ts"

import { run as run01 } from "./scenarios/01-succeed-flatmap-1000.ts"
import { run as run02 } from "./scenarios/02-mixed-primitive-chain.ts"
import { run as run03 } from "./scenarios/03-fork-join-100.ts"
import { run as run04 } from "./scenarios/04-stream-pipeline.ts"
import { run as run05 } from "./scenarios/05-fail-catch-roundtrip.ts"
import { runDeep as run06Deep, runShallow as run06Shallow } from "./scenarios/06-service-provide-yield.ts"
import { run as run07 } from "./scenarios/07-layer-build-deep.ts"
import { run as run08 } from "./scenarios/08-representative-program.ts"
import { run as run09 } from "./scenarios/09-effect-allocator.ts"

interface BenchOutput {
  readonly env: {
    readonly bun: string
    readonly node: string
    readonly os: string
    readonly arch: string
    readonly cpu: string
    readonly memoryGB: number
    readonly gitSha: string
    readonly gitDirty: boolean
    readonly timestamp: string
    readonly warmup: number
    readonly runs: number
  }
  readonly scenarios: ReadonlyArray<BenchScenarioResult>
}

const tryExec = (cmd: string): string => {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim()
  } catch {
    return ""
  }
}

const env = () => {
  const gitSha = tryExec("git rev-parse --short HEAD") || "unknown"
  const gitDirty = tryExec("git status --porcelain") !== ""
  return {
    bun: typeof Bun !== "undefined" ? Bun.version : "n/a",
    node: process.version,
    os: `${os.type()} ${os.release()}`,
    arch: process.arch,
    cpu: os.cpus()[0]?.model ?? "unknown",
    memoryGB: Number((os.totalmem() / 2 ** 30).toFixed(2)),
    gitSha,
    gitDirty,
    timestamp: new Date().toISOString(),
    warmup: WARMUP,
    runs: RUNS
  }
}

const fmt = (ns: number): string => {
  if (ns < 1_000) return `${ns.toFixed(1)}ns`
  if (ns < 1_000_000) return `${(ns / 1_000).toFixed(2)}µs`
  if (ns < 1_000_000_000) return `${(ns / 1_000_000).toFixed(2)}ms`
  return `${(ns / 1_000_000_000).toFixed(2)}s`
}

const printRow = (s: BenchScenarioResult) => {
  const meanPerOp = s.stats.mean / s.iterationsPerRun
  const stddevPerOp = s.stats.stddev / s.iterationsPerRun
  console.log(
    `  ${s.name.padEnd(42)}  ${String(s.iterationsPerRun).padStart(6)}/run  ` +
      `mean=${fmt(s.stats.mean).padStart(9)}  ` +
      `±${fmt(s.stats.stddev).padStart(8)}  ` +
      `RSD=${s.stats.rsd.toFixed(2).padStart(5)}%  ` +
      `ns/op=${meanPerOp.toFixed(1).padStart(10)} ±${stddevPerOp.toFixed(1)}  ` +
      `ops/s=${s.stats.opsPerSec.toExponential(2)}  ` +
      `heap=${(s.heap.heapDeltaMean / 1024).toFixed(1)}KB  ` +
      `objs=${s.heap.objectCountDeltaMean.toFixed(0)}`
  )
}

const main = async () => {
  const e = env()
  console.log(`effect-smol bench — sha=${e.gitSha}${e.gitDirty ? " (dirty)" : ""} bun=${e.bun} node=${e.node}`)
  console.log(`  ${e.cpu}  ${e.os} ${e.arch}  ${e.memoryGB}GB`)
  console.log(`  WARMUP=${e.warmup}  RUNS=${e.runs}`)
  console.log("")

  const scenarios: Array<BenchScenarioResult> = []

  const runOne = async (
    label: string,
    fn: () => Promise<BenchScenarioResult>
  ): Promise<void> => {
    process.stdout.write(`  running ${label} ... `)
    const t0 = Bun.nanoseconds()
    const r = await fn()
    const wall = (Bun.nanoseconds() - t0) / 1e9
    console.log(`done in ${wall.toFixed(2)}s  (RSD ${r.stats.rsd.toFixed(2)}%)`)
    scenarios.push(r)
  }

  await runOne("01 succeed-flatMap-1000", run01)
  await runOne("02 mixed-primitive-1000", run02)
  await runOne("03 fork-join-100", run03)
  await runOne("04 stream pipeline", run04)
  await runOne("05 fail-catch roundtrip", run05)
  await runOne("06a service provide+yield shallow", run06Shallow)
  await runOne("06b service provide+yield deep", run06Deep)
  await runOne("07 layer build deep", run07)
  await runOne("08 representative program", run08)
  await runOne("09 effect allocator", run09)

  console.log("")
  console.log("Results:")
  scenarios.forEach(printRow)

  console.log("")
  const highRsd = scenarios.filter((s) => s.stats.rsd > 5)
  if (highRsd.length > 0) {
    console.log(`WARNING: RSD > 5% on ${highRsd.length} scenario(s) — consider increasing iterationsPerRun:`)
    highRsd.forEach((s) => console.log(`  - ${s.name}: RSD ${s.stats.rsd.toFixed(2)}%`))
    console.log("")
  }

  const output: BenchOutput = { env: e, scenarios }
  const defaultPath = path.resolve(
    __dirname,
    "results",
    `baseline-${e.gitSha}${e.gitDirty ? "-dirty" : ""}.json`
  )
  const outPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultPath
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2))
  console.log(`wrote ${outPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
