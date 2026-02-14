# Runtime: `Runtime<R>` Removed

In v3, `Runtime<R>` bundled a `Context<R>`, `RuntimeFlags`, and `FiberRefs`
into a single value used to execute effects:

```ts
// v3
interface Runtime<in R> {
  readonly context: Context.Context<R>
  readonly runtimeFlags: RuntimeFlags
  readonly fiberRefs: FiberRefs
}
```

In v4, this type no longer exists and you can use `ServiceMap<R>` instead.
Run functions live directly on `Effect`, and the `Runtime` module is reduced to
process lifecycle utilities.

## `Runtime` Module Contents

The `Runtime` module now only contains:

- `Teardown` — interface for handling process exit
- `defaultTeardown` — default teardown implementation
- `makeRunMain` — creates platform-specific main runners
