import type { Debugger, InspectorNotification, Runtime } from "node:inspector"
import { Session } from "node:inspector/promises"
import { Bench } from "tinybench"

// ---------------------------------------------------------------------------
// Food for thought (node-only): recovering each span method's source file:line.
//
// `Tracer.instrumenting` wraps services away from their definition site, so the
// span's own stack points at the wrapper, not your method. The real location can
// still be recovered — node-only — by reading the *original* function's
// `[[FunctionLocation]]` via the V8 inspector. This file demonstrates it and
// times two strategies (per @mikearnaldi's suggestion).
//
// NB: a span-location resolve is a multi-ms inspector round-trip, so this bench
// is run with a small *fixed* iteration count rather than the default
// "run for N ms" loop — opening hundreds of debugger sessions would just thrash.
//
// Run: node --experimental-strip-types benchmark/tracer/locations.ts
// ---------------------------------------------------------------------------

type FunctionLocation = {
  readonly scriptId: string
  readonly lineNumber: number
  readonly columnNumber: number
}

const PROBE = "__autotraceProbe"

const functionLocationOf = (
  internalProperties: ReadonlyArray<Runtime.InternalPropertyDescriptor> | undefined
): FunctionLocation | undefined => {
  const value = internalProperties?.find((p) => p.name === "[[FunctionLocation]]")?.value?.value
  return (
      typeof value === "object" && value !== null &&
      "scriptId" in value && "lineNumber" in value && "columnNumber" in value
    )
    ? value as FunctionLocation
    : undefined
}

const readLocation = async (
  session: Session,
  urls: ReadonlyMap<string, string>,
  fn: Function
): Promise<string | undefined> => {
  ;(globalThis as Record<string, unknown>)[PROBE] = fn
  const evaluated = await session.post("Runtime.evaluate", { expression: `globalThis.${PROBE}` })
  const objectId = evaluated.result.objectId
  if (objectId === undefined) return undefined
  const props = await session.post("Runtime.getProperties", { objectId })
  const loc = functionLocationOf(props.internalProperties)
  if (loc === undefined) return undefined
  const url = urls.get(loc.scriptId) ?? "<unknown>"
  return `${url}:${loc.lineNumber + 1}:${loc.columnNumber + 1}`
}

const openSession = async (): Promise<{ session: Session; urls: Map<string, string> }> => {
  const session = new Session()
  session.connect()
  const urls = new Map<string, string>()
  session.on("Debugger.scriptParsed", (m: InspectorNotification<Debugger.ScriptParsedEventDataType>) => {
    urls.set(m.params.scriptId, m.params.url)
  })
  await session.post("Debugger.enable") // replays scriptParsed for loaded scripts
  return { session, urls }
}

// LAZY — fresh transient session per failure, resolve only the failing chain,
// then disconnect (dropping the Debugger.enable script-retention).
const resolveLazy = async (
  chain: ReadonlyArray<string>,
  bodyFor: (name: string) => Function | undefined
): Promise<ReadonlyMap<string, string>> => {
  const { session, urls } = await openSession()
  try {
    const out = new Map<string, string>()
    for (const name of chain) {
      const fn = bodyFor(name)
      if (fn === undefined) continue
      const loc = await readLocation(session, urls, fn)
      if (loc !== undefined) out.set(name, loc)
    }
    return out
  } finally {
    delete (globalThis as Record<string, unknown>)[PROBE]
    session.disconnect()
  }
}

// PRE-WARM — resolve every registered method once up front into a Map, so the
// error path is a sync lookup. (e.g. driven from a Context.Service at startup.)
const preWarm = async (bodies: ReadonlyMap<string, Function>): Promise<ReadonlyMap<string, string>> => {
  const { session, urls } = await openSession()
  try {
    const out = new Map<string, string>()
    for (const [name, fn] of bodies) {
      const loc = await readLocation(session, urls, fn)
      if (loc !== undefined) out.set(name, loc)
    }
    return out
  } finally {
    delete (globalThis as Record<string, unknown>)[PROBE]
    session.disconnect()
  }
}

// ---------------------------------------------------------------------------
// Fixture: pretend a tracer registered N service methods (distinct fns, each
// with its own source location).
// ---------------------------------------------------------------------------

const bodies = new Map<string, Function>()
for (let i = 0; i < 50; i++) {
  bodies.set(`@svc/Service${i}.method`, (x: number) => x + i)
}
const bodyFor = (name: string) => bodies.get(name)
const chain = ["@svc/Service3.method", "@svc/Service7.method", "@svc/Service11.method"]

// correctness: both strategies must yield identical locations
const lazySample = await resolveLazy(chain, bodyFor)
const warm = await preWarm(bodies)
console.log("sample location:", lazySample.get(chain[0]))
console.log("lazy == pre-warm for the chain:", chain.every((n) => lazySample.get(n) === warm.get(n)), "\n")

// Fixed iteration count + no warmup: each iteration opens a real inspector
// session, so we keep the total small (the default time-based loop would open
// hundreds and thrash the heap).
const bench = new Bench({ iterations: 25, time: 0, warmup: false })

bench
  // error path: resolve the failing chain lazily, fresh session each time
  .add("lazy: resolve chain per failure", async () => {
    await resolveLazy(chain, bodyFor)
  })
  // one-time startup cost: resolve every registered method once
  .add(`pre-warm: resolve all ${bodies.size} (one-time boot)`, async () => {
    await preWarm(bodies)
  })
  // after pre-warm the error path is a sync Map lookup
  .add("pre-warmed: lookup per failure", () => {
    for (const n of chain) warm.get(n)
  })

await bench.run()
console.table(bench.table())
