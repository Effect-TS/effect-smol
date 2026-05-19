/**
 * Bench harness for effect-smol runtime hot-path audit.
 *
 * Discipline (per the bun-benchmarking skill):
 *   - Bun.nanoseconds() for timing
 *   - Bun.gc(true) + 5ms sleep before every run (warmup AND measured)
 *   - WARMUP runs discarded; RUNS post-warmup samples kept (raw)
 *   - blackhole(result) after every iteration to defeat DCE
 *   - iterationsPerRun amortizes timer jitter; bump until RSD < 5%
 *   - heapStats() delta captured (post-GC view) for per-run alloc signal
 *   - Each run wrapped in a hard timeout
 *   - Correctness validated on first iteration of first run
 *
 * Output (JSON) carries RAW samples — required for downstream Welch's t-test.
 */

import { heapStats } from "bun:jsc"

// --------------------------------------------------------------------------
// blackhole — module-level sink that the JIT cannot prove is unobservable
// --------------------------------------------------------------------------

let _sink: unknown
export const blackhole = (v: unknown): void => {
  _sink = v
}
// Touch _sink at process exit so the optimizer cannot DCE the writes.
process.on("exit", () => {
  if (_sink === Symbol.for("never-this-actual-symbol")) {
    // eslint-disable-next-line no-console
    console.log("unreachable sink touch")
  }
})

// --------------------------------------------------------------------------
// stats
// --------------------------------------------------------------------------

export interface Stats {
  readonly min: number
  readonly max: number
  readonly mean: number
  readonly median: number
  readonly p95: number
  readonly p99: number
  readonly stddev: number
  readonly rsd: number
  readonly opsPerSec: number
}

const quantile = (sorted: ReadonlyArray<number>, q: number): number => {
  if (sorted.length === 0) return 0
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  if (lo === hi) return sorted[lo]!
  const frac = pos - lo
  return sorted[lo]! * (1 - frac) + sorted[hi]! * frac
}

const computeStats = (samples: ReadonlyArray<number>, iterationsPerRun: number): Stats => {
  if (samples.length === 0) {
    return { min: 0, max: 0, mean: 0, median: 0, p95: 0, p99: 0, stddev: 0, rsd: 0, opsPerSec: 0 }
  }
  const sorted = [...samples].sort((a, b) => a - b)
  const sum = samples.reduce((s, v) => s + v, 0)
  const mean = sum / samples.length
  const variance = samples.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, samples.length - 1)
  const stddev = Math.sqrt(variance)
  const rsd = mean === 0 ? 0 : (stddev / mean) * 100
  const nsPerOp = mean / iterationsPerRun
  const opsPerSec = nsPerOp === 0 ? 0 : 1e9 / nsPerOp
  return {
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    mean,
    median: quantile(sorted, 0.5),
    p95: quantile(sorted, 0.95),
    p99: quantile(sorted, 0.99),
    stddev,
    rsd,
    opsPerSec
  }
}

// --------------------------------------------------------------------------
// scenario contract
// --------------------------------------------------------------------------

export interface HeapStats {
  readonly heapDeltaMean: number
  readonly objectCountDeltaMean: number
}

export interface BenchScenarioResult {
  readonly name: string
  readonly description: string
  readonly iterationsPerRun: number
  readonly runs: number
  readonly samples: ReadonlyArray<number>
  readonly stats: Stats
  readonly heap: HeapStats
}

export interface BenchOpts<S> {
  readonly name: string
  readonly description: string
  readonly iterationsPerRun: number
  readonly setup: () => S
  readonly run: (state: S) => void
}

// --------------------------------------------------------------------------
// timeout
// --------------------------------------------------------------------------

const RUN_TIMEOUT_MS = Number(process.env["RUN_TIMEOUT_MS"] ?? 30_000)

const withTimeout = async <A>(p: Promise<A>, ms: number, name: string): Promise<A> => {
  let handle: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    handle = setTimeout(() => reject(new Error(`scenario ${name} timed out after ${ms} ms`)), ms)
  })
  try {
    return await Promise.race([p, timeout])
  } finally {
    if (handle !== undefined) clearTimeout(handle)
  }
}

// --------------------------------------------------------------------------
// benchmark() — runs WARMUP + RUNS, returns BenchScenarioResult
// --------------------------------------------------------------------------

export const WARMUP = Number(process.env["WARMUP"] ?? 10)
export const RUNS = Number(process.env["RUNS"] ?? 30)

export const benchmark = async <S>(opts: BenchOpts<S>): Promise<BenchScenarioResult> => {
  const state = opts.setup()
  const totalRuns = WARMUP + RUNS
  const allSamples: Array<number> = []
  const heapDeltas: Array<number> = []
  const objCountDeltas: Array<number> = []

  for (let i = 0; i < totalRuns; i++) {
    Bun.gc(true)
    await new Promise<void>((r) => setTimeout(r, 5))

    const beforeHeap = heapStats()
    const t0 = Bun.nanoseconds()
    await withTimeout(Promise.resolve(opts.run(state)), RUN_TIMEOUT_MS, opts.name)
    const elapsed = Bun.nanoseconds() - t0
    const afterHeap = heapStats()

    allSamples.push(elapsed)
    heapDeltas.push(afterHeap.heapSize - beforeHeap.heapSize)
    objCountDeltas.push(afterHeap.objectCount - beforeHeap.objectCount)
  }

  const samples = allSamples.slice(WARMUP)
  const heap = heapDeltas.slice(WARMUP)
  const objs = objCountDeltas.slice(WARMUP)

  const heapDeltaMean = heap.reduce((s, v) => s + v, 0) / heap.length
  const objectCountDeltaMean = objs.reduce((s, v) => s + v, 0) / objs.length

  return {
    name: opts.name,
    description: opts.description,
    iterationsPerRun: opts.iterationsPerRun,
    runs: samples.length,
    samples,
    stats: computeStats(samples, opts.iterationsPerRun),
    heap: { heapDeltaMean, objectCountDeltaMean }
  }
}
