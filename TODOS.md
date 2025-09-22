## Alpha (current)

Releases are snapshot only

- [ ] Port Channel / Stream / Sink apis
- [ ] Port worker modules
- [ ] Port command execution modules
- [ ] Port platform-browser
- [ ] Add CLI modules
- [ ] Add opentelemetry package
- [ ] Port SubscriptionRef
- [ ] RateLimiter with persistence
- [ ] Reduce nesting of modules

## Beta

Pre-releases to npm from smol repo
- [ ] Comprehensive JSDoc on every exported function
- [ ] Codemod CLI for v3 migration

## RC's

Pre-releases to npm from smol repo

## Release

- [ ] Copy code over to main repo

# Channel Module Audit

The exports under each section are organized as they are in Effect 3.0. The categorization of these modules may not be correct, and should be fixed for 4.0.

### Legend

| Status | Description                                      |
| :----: | :----------------------------------------------- |
|   ❌   | Not done (default)                               |
|   ✅   | Done - successfully ported to Effect 4           |
|   🚫   | Won't do - not being ported to Effect 4          |
|   ❓   | Question - method has questions or uncertainties |

### Constructors

|      Effect 3       | Ported |      Effect 4       |                                                        Comments                                                        |
| :-----------------: | :----: | :-----------------: | :--------------------------------------------------------------------------------------------------------------------: |
| `acquireReleaseOut` |   ✅   |  `acquireRelease`   |                                                                                                                        |
| `acquireUseRelease` |   ✅   | `acquireUseRelease` |                                                                                                                        |
|      `buffer`       |   ❌   |                     |                                                                                                                        |
|    `bufferChunk`    |   ❌   |                     |                                                                                                                        |
|     `concatAll`     |   ✅   |      `concat`       |                                                Category fixed for 4.0.                                                 |
|   `concatAllWith`   |   ✅   |    `concatWith`     | Category fixed for 4.0. New method does not have exactly the same semantics as 3.0, but provides similar functionality |
|       `fail`        |   ✅   |       `fail`        |                                                                                                                        |
|     `failCause`     |   ✅   |     `failCause`     |                                                                                                                        |
|   `failCauseSync`   |   ✅   |   `failCauseSync`   |                                                                                                                        |
|     `failSync`      |   ✅   |     `failSync`      |                                                                                                                        |
|    `fromEffect`     |   ✅   |    `fromEffect`     |                                                                                                                        |
|    `fromEither`     |   🚫   |                     |                                         Convert to Effect and use `fromEffect`                                         |
|     `fromInput`     |   🚫   |                     |                                                                                                                        |
|    `fromOption`     |   🚫   |                     |                                         Convert to Effect and use `fromEffect`                                         |
|    `fromPubSub`     |   ✅   |    `fromPubSub`     |                                                                                                                        |
| `fromPubSubScoped`  |   🚫   |                     |                                        Do we need the scoped variants for 4.0?                                         |
|     `fromQueue`     |   ✅   |     `fromQueue`     |                                                                                                                        |
|     `identity`      |   ❌   |                     |                                                                                                                        |
|       `never`       |   ✅   |       `never`       |                                                                                                                        |
|       `read`        |   🚫   |                     |                                                      Not required                                                      |
|    `readOrFail`     |   🚫   |                     |                                                      Not required                                                      |
|     `readWith`      |   🚫   |                     |                                                      Not required                                                      |
|   `readWithCause`   |   🚫   |                     |                                                      Not required                                                      |
|      `scoped`       |   🚫   |                     |                                                      Not required                                                      |
|    `scopedWith`     |   🚫   |                     |                                                      Not required                                                      |
|      `succeed`      |   ✅   |      `succeed`      |                                                                                                                        |
|      `suspend`      |   ✅   |      `suspend`      |                                                                                                                        |
|       `sync`        |   ✅   |       `sync`        |                                                                                                                        |
|      `unwrap`       |   ✅   |      `unwrap`       |                                                                                                                        |
|   `unwrapScoped`    |   🚫   |                     |                                        Do we need the scoped variants for 4.0?                                         |
| `unwrapScopedWith`  |   🚫   |                     |                                        Do we need the scoped variants for 4.0?                                         |
|       `void`        |   🚫   |                     |                                                                                                                        |
|       `write`       |   🚫   |                     |                                                                                                                        |
|     `writeAll`      |   🚫   |                     |                                                                                                                        |
|    `writeChunk`     |   🚫   |                     |                                                                                                                        |

### Context

|       Effect 3       | Ported |     Effect 4      | Comments |
| :------------------: | :----: | :---------------: | :------: |
|      `context`       |   ❌   |                   |          |
|    `contextWith`     |   ❌   |                   |          |
| `contextWithChannel` |   🚫   |   `contextWith`   |          |
| `contextWithEffect`  |   🚫   |                   |          |
|  `mapInputContext`   |   ❌   | `updateServices`  |          |
|   `provideContext`   |   ✅   | `provideServices` |          |
|    `provideLayer`    |   ❌   |                   |          |
|   `provideService`   |   ❌   |                   |          |
|  `provideSomeLayer`  |   🚫   |                   |          |
|   `updateService`    |   ❌   |                   |          |

### Destructors

|   Effect 3   | Ported |       Effect 4       | Comments |
| :----------: | :----: | :------------------: | :------: |
|    `run`     |   ✅   |      `runDone`       |          |
| `runCollect` |   ✅   |     `runCollect`     |          |
|  `runDrain`  |   ✅   |      `runDrain`      |          |
| `runScoped`  |   🚫   |                      |          |
|  `toPubSub`  |   ❌   |                      |          |
|   `toPull`   |   ✅   |       `toPull`       |          |
|  `toPullIn`  |   ✅   |    `toPullScoped`    |          |
|  `toQueue`   |   ✅   |      `toQueue`       |          |
|   `toSink`   |   🚫   |  `Sink.fromChannel`  |          |
|  `toStream`  |   🚫   | `Stream.fromChannel` |          |

### Error Handling

|    Effect 3     | Ported |   Effect 4   | Comments |
| :-------------: | :----: | :----------: | :------: |
|   `catchAll`    |   ✅   |   `catch`    |          |
| `catchAllCause` |   ✅   | `catchCause` |          |
|     `orDie`     |   ✅   |   `orDie`    |          |
|   `orDieWith`   |   ❌   |              |          |
|    `orElse`     |   🚫   |   `catch`    |          |

### Mapping

|     Effect 3      | Ported |    Effect 4     |          Comments          |
| :---------------: | :----: | :-------------: | :------------------------: |
|       `as`        |   🚫   |                 |                            |
|     `asVoid`      |   🚫   |                 |                            |
|       `map`       |   ✅   |    `mapDone`    |                            |
|    `mapEffect`    |   ✅   | `mapDoneEffect` |                            |
|    `mapError`     |   ✅   |   `mapError`    |                            |
|  `mapErrorCause`  |   ❌   |   `mapCause`    |                            |
|     `mapOut`      |   ✅   |      `map`      |                            |
|  `mapOutEffect`   |   ✅   |   `mapEffect`   |                            |
| `mapOutEffectPar` |   ✅   |   `mapEffect`   | With concurrency specified |
|    `mergeMap`     |   ❌   |                 |                            |

### Sequencing

| Effect 3  | Ported | Effect 4  | Comments |
| :-------: | :----: | :-------: | :------: |
| `flatMap` |   ✅   | `flatMap` |          |
| `flatten` |   ✅   | `flatten` |          |

### Refinements

|       Effect 3       | Ported |  Effect 4   | Comments |
| :------------------: | :----: | :---------: | :------: |
|     `isChannel`      |   ✅   | `isChannel` |          |
| `isChannelException` |   🚫   |             |          |

### Tracing

|  Effect 3  | Ported |  Effect 4  | Comments |
| :--------: | :----: | :--------: | :------: |
| `withSpan` |   ✅   | `withSpan` |          |

### Utility Functions

|        Effect 3         | Ported |   Effect 4   | Comments |
| :---------------------: | :----: | :----------: | :------: |
|        `collect`        |   ✅   |   `filter`   |          |
|       `concatMap`       |   ❌   |              |          |
|     `concatMapWith`     |   ❌   |              |          |
|  `concatMapWithCustom`  |   ❌   |              |          |
|       `concatOut`       |   ❌   |              |          |
|      `doneCollect`      |   ❌   |              |          |
|         `drain`         |   ❌   |              |          |
|      `embedInput`       |   ✅   | `embedInput` |          |
|      `emitCollect`      |   ❌   |              |          |
|       `ensuring`        |   ✅   |  `ensuring`  |          |
|     `ensuringWith`      |   ❌   |              |          |
|   `foldCauseChannel`    |   ❌   |              |          |
|      `foldChannel`      |   ❌   |              |          |
|     `interruptWhen`     |   ❌   |              |          |
| `interruptWhenDeferred` |   ❌   |              |          |
|       `mapInput`        |   ❌   |              |          |
|    `mapInputEffect`     |   ❌   |              |          |
|     `mapInputError`     |   ❌   |              |          |
