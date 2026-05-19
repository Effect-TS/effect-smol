/**
 * Pooled Welch's two-tailed t-test comparison.
 *
 * Each side aggregates N JSON bench files (each containing RUNS=30 post-warmup
 * samples). The N files are concatenated per scenario into a single pooled
 * sample vector, then Welch's t-test is run on the pooled vectors.
 *
 * Also emits a self-consistency check: pairwise compare every (baseline_i,
 * baseline_j) and flag any pair with p<0.05 AND |Δ|>=3%. That tells the user
 * whether the machine was quiet across runs.
 *
 * Usage:
 *   bun run bench/compare-pooled.ts \
 *     --label-base baseline --base FILE [FILE ...] \
 *     --label-cand candidate --cand FILE [FILE ...] \
 *     [--out comparison.json]
 */

import * as fs from "node:fs"

interface Stats {
  min: number
  max: number
  mean: number
  median: number
  p95: number
  p99: number
  stddev: number
  rsd: number
  opsPerSec: number
}

interface Scenario {
  name: string
  iterationsPerRun: number
  samples: Array<number>
  stats: Stats
  heap: { heapDeltaMean: number; objectCountDeltaMean: number }
}

interface BenchFile {
  scenarios: Array<Scenario>
}

// --- statistics ------------------------------------------------------------

const betacf = (a: number, b: number, x: number): number => {
  const MAXIT = 200
  const EPS = 3e-7
  const FPMIN = 1e-30
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - qab * x / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    h *= d * c
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}

const lgamma = (x: number): number => {
  const cof = [
    76.18009172947146,
    -86.50532032941677,
    24.01409824083091,
    -1.231739572450155,
    0.1208650973866179e-2,
    -0.5395239384953e-5
  ]
  let y = x
  let tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (let j = 0; j < 6; j++) {
    y += 1
    ser += cof[j]! / y
  }
  return -tmp + Math.log(2.5066282746310005 * ser / x)
}

const betai = (a: number, b: number, x: number): number => {
  if (x < 0 || x > 1) return Number.NaN
  if (x === 0 || x === 1) return x === 0 ? 0 : 1
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  if (x < (a + 1) / (a + b + 2)) return bt * betacf(a, b, x) / a
  return 1 - bt * betacf(b, a, 1 - x) / b
}

const twoTailedPValue = (t: number, df: number): number => {
  const x = df / (df + t * t)
  return betai(df / 2, 0.5, x)
}

interface WelchResult {
  t: number
  df: number
  p: number
  meanA: number
  meanB: number
  stdA: number
  stdB: number
}

const welch = (a: Array<number>, b: Array<number>): WelchResult => {
  const meanA = a.reduce((s, v) => s + v, 0) / a.length
  const meanB = b.reduce((s, v) => s + v, 0) / b.length
  const varA = a.reduce((s, v) => s + (v - meanA) ** 2, 0) / (a.length - 1)
  const varB = b.reduce((s, v) => s + (v - meanB) ** 2, 0) / (b.length - 1)
  const stdA = Math.sqrt(varA)
  const stdB = Math.sqrt(varB)
  const se2A = varA / a.length
  const se2B = varB / b.length
  const se = Math.sqrt(se2A + se2B)
  const t = (meanA - meanB) / se
  const df = (se2A + se2B) ** 2 / (se2A ** 2 / (a.length - 1) + se2B ** 2 / (b.length - 1))
  return { t, df, p: twoTailedPValue(t, df), meanA, meanB, stdA, stdB }
}

const fmtNs = (ns: number): string => {
  if (ns < 1_000) return `${ns.toFixed(1)}ns`
  if (ns < 1_000_000) return `${(ns / 1_000).toFixed(2)}µs`
  if (ns < 1_000_000_000) return `${(ns / 1_000_000).toFixed(2)}ms`
  return `${(ns / 1_000_000_000).toFixed(2)}s`
}

// --- args parsing ----------------------------------------------------------

interface CliArgs {
  base: Array<string>
  cand: Array<string>
  labelBase: string
  labelCand: string
  out?: string
}

const parseArgs = (argv: Array<string>): CliArgs => {
  const out: CliArgs = { base: [], cand: [], labelBase: "baseline", labelCand: "candidate" }
  let mode: "base" | "cand" | null = null
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (a === "--base") { mode = "base"; continue }
    if (a === "--cand") { mode = "cand"; continue }
    if (a === "--label-base") { out.labelBase = argv[++i]!; mode = null; continue }
    if (a === "--label-cand") { out.labelCand = argv[++i]!; mode = null; continue }
    if (a === "--out") { out.out = argv[++i]!; mode = null; continue }
    if (mode === "base") out.base.push(a)
    else if (mode === "cand") out.cand.push(a)
  }
  return out
}

const args = parseArgs(process.argv.slice(2))
if (args.base.length === 0 || args.cand.length === 0) {
  console.error("usage: --base F1 [F2 ...] --cand F1 [F2 ...] [--label-base X] [--label-cand Y] [--out file.json]")
  process.exit(1)
}

const loadFiles = (paths: ReadonlyArray<string>): Array<BenchFile> =>
  paths.map((p) => JSON.parse(fs.readFileSync(p, "utf8")) as BenchFile)

const poolByScenario = (files: ReadonlyArray<BenchFile>): Map<string, {
  iterationsPerRun: number
  samples: Array<number>
  heapDeltaMean: number
  objectCountDeltaMean: number
}> => {
  const out = new Map<string, {
    iterationsPerRun: number
    samples: Array<number>
    heapDeltaMean: number
    objectCountDeltaMean: number
  }>()
  for (const f of files) {
    for (const s of f.scenarios) {
      const cur = out.get(s.name)
      if (cur) {
        cur.samples.push(...s.samples)
        cur.heapDeltaMean = (cur.heapDeltaMean + s.heap.heapDeltaMean) / 2
        cur.objectCountDeltaMean = (cur.objectCountDeltaMean + s.heap.objectCountDeltaMean) / 2
      } else {
        out.set(s.name, {
          iterationsPerRun: s.iterationsPerRun,
          samples: [...s.samples],
          heapDeltaMean: s.heap.heapDeltaMean,
          objectCountDeltaMean: s.heap.objectCountDeltaMean
        })
      }
    }
  }
  return out
}

const baselineFiles = loadFiles(args.base)
const candidateFiles = loadFiles(args.cand)

// --- self-consistency check ------------------------------------------------

console.log(`# Pooled comparison: ${args.labelCand} vs ${args.labelBase}\n`)
console.log(`Base files (n=${args.base.length}): ${args.base.join(", ")}`)
console.log(`Candidate files (n=${args.cand.length}): ${args.cand.join(", ")}\n`)

if (baselineFiles.length >= 2) {
  console.log(`## Baseline self-consistency (pairwise Welch on ${args.labelBase} runs)\n`)
  console.log("Flagged if any pair has p<0.05 AND |Δ|≥3% — that means the machine was NOT quiesced for that scenario.\n")
  const names = baselineFiles[0]!.scenarios.map((s) => s.name)
  console.log("| scenario | pairs flagged (Δ%, p) |")
  console.log("|---|---|")
  let anyFlag = false
  for (const name of names) {
    const flagged: Array<string> = []
    for (let i = 0; i < baselineFiles.length; i++) {
      for (let j = i + 1; j < baselineFiles.length; j++) {
        const a = baselineFiles[i]!.scenarios.find((s) => s.name === name)!
        const b = baselineFiles[j]!.scenarios.find((s) => s.name === name)!
        const w = welch(a.samples, b.samples)
        const delta = (w.meanB - w.meanA) / w.meanA * 100
        if (w.p < 0.05 && Math.abs(delta) >= 3) {
          flagged.push(`#${i + 1}↔#${j + 1}: ${delta >= 0 ? "+" : ""}${delta.toFixed(2)}%, p=${w.p.toExponential(2)}`)
        }
      }
    }
    if (flagged.length > 0) {
      anyFlag = true
      console.log(`| ${name} | ${flagged.join(" / ")} |`)
    } else {
      console.log(`| ${name} | OK |`)
    }
  }
  console.log("")
  if (anyFlag) {
    console.log("WARN: machine was NOT fully quiesced for some scenarios; treat candidate verdicts on those scenarios with skepticism.\n")
  } else {
    console.log("OK: baseline self-consistency held within α=0.05/Δ=3% across all scenarios.\n")
  }
}

// --- pooled comparison -----------------------------------------------------

const basePool = poolByScenario(baselineFiles)
const candPool = poolByScenario(candidateFiles)

console.log(`## Pooled ${args.labelCand} vs ${args.labelBase} (Welch's two-tailed t-test, α=0.05)\n`)
console.log(
  `| scenario | base mean ± σ (ns/op) | cand mean ± σ (ns/op) | Δ% | t | p | heap base→cand | objs base→cand | verdict |`
)
console.log("|---|---|---|---|---|---|---|---|---|")

let anyImprovement = false
let anyRegression = false

interface RowOut {
  scenario: string
  iterationsPerRun: number
  baseN: number
  candN: number
  baseMeanNsPerOp: number
  candMeanNsPerOp: number
  baseStdNsPerOp: number
  candStdNsPerOp: number
  deltaPercent: number
  t: number
  df: number
  p: number
  baseHeapDeltaMean: number
  candHeapDeltaMean: number
  baseObjCountDeltaMean: number
  candObjCountDeltaMean: number
  verdict: "WIN" | "LOSS" | "NEUTRAL"
}

const rows: Array<RowOut> = []

for (const [name, c] of candPool) {
  const b = basePool.get(name)
  if (!b) continue
  const ipr = c.iterationsPerRun
  const w = welch(b.samples, c.samples)
  const baseMeanPerOp = w.meanA / ipr
  const candMeanPerOp = w.meanB / ipr
  const baseStdPerOp = w.stdA / ipr
  const candStdPerOp = w.stdB / ipr
  const delta = (candMeanPerOp - baseMeanPerOp) / baseMeanPerOp * 100
  const significant = w.p < 0.05
  const improved = significant && delta <= -3
  const regressed = significant && delta >= 5
  if (improved) anyImprovement = true
  if (regressed) anyRegression = true
  const verdict: "WIN" | "LOSS" | "NEUTRAL" = improved ? "WIN" : regressed ? "LOSS" : "NEUTRAL"
  rows.push({
    scenario: name,
    iterationsPerRun: ipr,
    baseN: b.samples.length,
    candN: c.samples.length,
    baseMeanNsPerOp: baseMeanPerOp,
    candMeanNsPerOp: candMeanPerOp,
    baseStdNsPerOp: baseStdPerOp,
    candStdNsPerOp: candStdPerOp,
    deltaPercent: delta,
    t: w.t,
    df: w.df,
    p: w.p,
    baseHeapDeltaMean: b.heapDeltaMean,
    candHeapDeltaMean: c.heapDeltaMean,
    baseObjCountDeltaMean: b.objectCountDeltaMean,
    candObjCountDeltaMean: c.objectCountDeltaMean,
    verdict
  })
  const heapStr = `${(b.heapDeltaMean / 1024).toFixed(1)}KB → ${(c.heapDeltaMean / 1024).toFixed(1)}KB`
  const objStr = `${b.objectCountDeltaMean.toFixed(0)} → ${c.objectCountDeltaMean.toFixed(0)}`
  console.log(
    `| ${name} | ${fmtNs(baseMeanPerOp)} ± ${fmtNs(baseStdPerOp)} | ${fmtNs(candMeanPerOp)} ± ${fmtNs(candStdPerOp)} | ${delta >= 0 ? "+" : ""}${delta.toFixed(2)}% | ${w.t.toFixed(3)} | ${w.p.toExponential(2)} | ${heapStr} | ${objStr} | ${verdict} |`
  )
}

console.log("")
console.log(`Pooled samples per condition: base n=${rows[0]?.baseN ?? 0}, cand n=${rows[0]?.candN ?? 0}`)
console.log("")

let verdict: "KEEP" | "REJECT-noimp" | "REJECT-regression"
if (anyImprovement && !anyRegression) {
  verdict = "KEEP"
  console.log(`VERDICT: KEEP — ≥1 significant improvement (Δ≤-3%, p<0.05), no significant regression (Δ≥5%, p<0.05)`)
} else if (anyRegression) {
  verdict = "REJECT-regression"
  console.log(`VERDICT: REJECT — ≥1 significant regression`)
} else {
  verdict = "REJECT-noimp"
  console.log(`VERDICT: REJECT — no significant improvement`)
}

if (args.out) {
  const outFile = {
    labelBase: args.labelBase,
    labelCand: args.labelCand,
    baseFiles: args.base,
    candFiles: args.cand,
    pooledBaseSamples: rows[0]?.baseN ?? 0,
    pooledCandSamples: rows[0]?.candN ?? 0,
    rows,
    verdict
  }
  fs.writeFileSync(args.out, JSON.stringify(outFile, null, 2))
  console.log(`wrote ${args.out}`)
}
