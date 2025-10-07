## Alpha (current)

Releases are snapshot only

- [x] Port Channel apis
- [ ] Port Stream / Sink apis
- [x] Port worker modules
- [ ] Port command execution modules
- [ ] Port platform-browser
- [x] Add CLI modules
- [ ] Add opentelemetry package
- [ ] Port SubscriptionRef
- [ ] RateLimiter with persistence
- [x] Reduce nesting of modules
- [ ] Effect.fn call site trace

## Beta

Pre-releases to npm from smol repo

- [ ] Comprehensive JSDoc on every exported function
- [ ] Codemod CLI for v3 migration

## RC's

Pre-releases to npm from smol repo

## Release

- [ ] Copy code over to main repo

# Module Audit

The exports under each section are organized as they are in Effect 3.0. The categorization of these modules may not be correct, and should be fixed for 4.0.

### Legend

| Status | Description                                      |
| :----: | :----------------------------------------------- |
|   -    | Not done (default)                               |
|  Done  | Done - successfully ported to Effect 4           |
|   X    | Won't do - not being ported to Effect 4          |
|   ?    | Question - method has questions or uncertainties |

## Stream

### Error Handling

|      Effect 3       | Ported | Effect 4 | Comments |
| :-----------------: | :----: | :------: | :------: |
| `withExecutionPlan` |   -    |          |          |

### Combinators

|    Effect 3    | Ported |   Effect 4   | Comments |
| :------------: | :----: | :----------: | :------: |
| `mergeWithTag` |   X    |              |          |
|  `splitLines`  |  Done  | `splitLines` |          |

### Constants

|      Effect 3      | Ported |      Effect 4      | Comments |
| :----------------: | :----: | :----------------: | :------: |
| `DefaultChunkSize` |  Done  | `DefaultChunkSize` |          |

### Constructors

|          Effect 3          | Ported |               Effect 4               | Comments |
| :------------------------: | :----: | :----------------------------------: | :------: |
|      `acquireRelease`      |   X    |               `unwrap`               |          |
|          `async`           |  Done  |              `callback`              |          |
|       `asyncEffect`        |  Done  |              `callback`              |          |
|        `asyncPush`         |  Done  |              `callback`              |          |
|       `asyncScoped`        |  Done  |                                      |          |
|        `concatAll`         |   X    |          `make` + `flatten`          |          |
|           `die`            |  Done  |                `die`                 |          |
|        `dieMessage`        |   X    |                                      |          |
|         `dieSync`          |   X    |                                      |          |
|          `empty`           |  Done  |               `empty`                |          |
|         `execute`          |  Done  |          `fromEffectDrain`           |          |
|           `fail`           |  Done  |                `fail`                |          |
|        `failCause`         |  Done  |             `failCause`              |          |
|      `failCauseSync`       |  Done  |           `failCauseSync`            |          |
|         `failSync`         |  Done  |              `failSync`              |          |
|        `finalizer`         |   X    |                                      |          |
|    `fromAsyncIterable`     |  Done  |         `fromAsyncIterable`          |          |
|       `fromChannel`        |  Done  |            `fromChannel`             |          |
|        `fromChunk`         |  Done  |             `fromArray`              |          |
|     `fromChunkPubSub`      |   X    |                                      |          |
|      `fromChunkQueue`      |   X    |                                      |          |
|        `fromChunks`        |  Done  |             `fromArrays`             |          |
|        `fromEffect`        |  Done  |             `fromEffect`             |          |
|     `fromEffectOption`     |   X    |                                      |          |
|       `fromIterable`       |  Done  |            `fromIterable`            |          |
|    `fromIterableEffect`    |  Done  |         `fromIterableEffect`         |          |
|   `fromIteratorSucceed`    |  Done  |        `fromIteratorSucceed`         |          |
|        `fromPubSub`        |  Done  |                                      |          |
|         `fromPull`         |  Done  |              `fromPull`              |          |
|        `fromQueue`         |  Done  |             `fromQueue`              |          |
|    `fromReadableStream`    |  Done  |         `fromReadableStream`         |          |
|  `fromReadableStreamByob`  |   -    |                                      |          |
|       `fromSchedule`       |  Done  |            `fromSchedule`            |          |
|       `fromTPubSub`        |   -    |                                      |          |
|        `fromTQueue`        |   -    |            `fromTxQueue`             |          |
|         `iterate`          |  Done  |                                      |          |
|           `make`           |  Done  |                `make`                |          |
|          `never`           |  Done  |               `never`                |          |
|         `paginate`         |  Done  |              `paginate`              |          |
|      `paginateChunk`       |  Done  |                                      |          |
|   `paginateChunkEffect`    |  Done  |           `paginateArray`            |          |
|      `paginateEffect`      |  Done  |              `paginate`              |          |
|          `range`           |  Done  |               `range`                |          |
|       `repeatEffect`       |  Done  |          `fromEffectRepeat`          |          |
|    `repeatEffectChunk`     |  Done  |      `fromIterableEffectRepeat`      |          |
| `repeatEffectChunkOption`  |   X    |              `fromPull`              |          |
|    `repeatEffectOption`    |   X    | `fromEffectRepeat` + `Pull.haltVoid` |          |
| `repeatEffectWithSchedule` |  Done  |         `fromEffectSchedule`         |          |
|       `repeatValue`        |   X    |                                      |          |
|          `scoped`          |  Done  |               `scoped`               |          |
|        `scopedWith`        |   X    |                                      |          |
|         `succeed`          |  Done  |              `succeed`               |          |
|         `suspend`          |  Done  |              `suspend`               |          |
|           `sync`           |  Done  |                `sync`                |          |
|           `tick`           |  Done  |                                      |          |
|        `toChannel`         |  Done  |             `toChannel`              |          |
|          `unfold`          |  Done  |                                      |          |
|       `unfoldChunk`        |  Done  |                                      |          |
|    `unfoldChunkEffect`     |  Done  |         `unfoldArrayEffect`          |          |
|       `unfoldEffect`       |  Done  |                                      |          |
|          `unwrap`          |  Done  |               `unwrap`               |          |
|       `unwrapScoped`       |   X    |                                      |          |
|     `unwrapScopedWith`     |   X    |                                      |          |
|           `void`           |   X    |                                      |          |
|         `whenCase`         |   X    |                                      |          |

### Context

|        Effect 3        | Ported |     Effect 4      | Comments |
| :--------------------: | :----: | :---------------: | :------: |
|       `context`        |   X    |     `unwrap`      |          |
|     `contextWith`      |   X    |     `unwrap`      |          |
|  `contextWithEffect`   |   X    |     `unwrap`      |          |
|  `contextWithStream`   |   X    |     `unwrap`      |          |
|   `mapInputContext`    |  Done  | `updateServices`  |          |
|    `provideContext`    |  Done  | `provideServices` |          |
|     `provideLayer`     |  Done  |     `provide`     |          |
|    `provideService`    |  Done  |                   |          |
| `provideServiceEffect` |  Done  |                   |          |
| `provideServiceStream` |   X    |                   |          |
|  `provideSomeContext`  |  Done  | `provideServices` |          |
|   `provideSomeLayer`   |  Done  |     `provide`     |          |
|    `updateService`     |  Done  |                   |          |

### Destructors

|           Effect 3           | Ported |         Effect 4         | Comments |
| :--------------------------: | :----: | :----------------------: | :------: |
|            `run`             |  Done  |          `run`           |          |
|         `runCollect`         |  Done  |       `runCollect`       |          |
|          `runCount`          |  Done  |        `runCount`        |          |
|          `runDrain`          |  Done  |        `runDrain`        |          |
|          `runFold`           |  Done  |        `runFold`         |          |
|       `runFoldEffect`        |  Done  |                          |          |
|       `runFoldScoped`        |   X    |                          |          |
|    `runFoldScopedEffect`     |   X    |                          |          |
|        `runFoldWhile`        |   X    |                          |          |
|     `runFoldWhileEffect`     |   X    |                          |          |
|     `runFoldWhileScoped`     |   X    |                          |          |
|  `runFoldWhileScopedEffect`  |   X    |                          |          |
|         `runForEach`         |  Done  |       `runForEach`       |          |
|      `runForEachChunk`       |  Done  |    `runForEachArray`     |          |
|   `runForEachChunkScoped`    |   X    |                          |          |
|      `runForEachScoped`      |   X    |                          |          |
|      `runForEachWhile`       |  Done  |                          |          |
|   `runForEachWhileScoped`    |   X    |                          |          |
|          `runHead`           |  Done  |        `runHead`         |          |
|       `runIntoPubSub`        |  Done  |                          |          |
|    `runIntoPubSubScoped`     |   X    |                          |          |
|        `runIntoQueue`        |  Done  |                          |          |
| `runIntoQueueElementsScoped` |   X    |                          |          |
|     `runIntoQueueScoped`     |   X    |                          |          |
|          `runLast`           |  Done  |        `runLast`         |          |
|         `runScoped`          |   X    |                          |          |
|           `runSum`           |  Done  |                          |          |
|      `toAsyncIterable`       |  Done  |    `toAsyncIterable`     |          |
|   `toAsyncIterableEffect`    |  Done  |                          |          |
|   `toAsyncIterableRuntime`   |  Done  |  `toAsyncIterableWith`   |          |
|          `toPubSub`          |  Done  |        `toPubSub`        |          |
|           `toPull`           |  Done  |         `toPull`         |          |
|          `toQueue`           |  Done  |                          |          |
|     `toQueueOfElements`      |   X    |                          |          |
|      `toReadableStream`      |  Done  |    `toReadableStream`    |          |
|   `toReadableStreamEffect`   |  Done  | `toReadableStreamEffect` |          |
|  `toReadableStreamRuntime`   |  Done  |  `toReadableStreamWith`  |          |

### Do Notation

|   Effect 3   | Ported |   Effect 4   | Comments |
| :----------: | :----: | :----------: | :------: |
|     `Do`     |  Done  |     `Do`     |          |
|    `bind`    |  Done  |    `bind`    |          |
| `bindEffect` |  Done  | `bindEffect` |          |
|   `bindTo`   |  Done  |   `bindTo`   |          |
|    `let`     |  Done  |    `let`     |          |

### Elements

|   Effect 3   | Ported | Effect 4 | Comments |
| :----------: | :----: | :------: | :------: |
|    `find`    |   -    |          |          |
| `findEffect` |   -    |          |          |

### Encoding

|   Effect 3   | Ported |   Effect 4   | Comments |
| :----------: | :----: | :----------: | :------: |
| `decodeText` |  Done  | `decodeText` |          |
| `encodeText` |  Done  | `encodeText` |          |

### Error Handling

|       Effect 3        | Ported |       Effect 4        | Comments |
| :-------------------: | :----: | :-------------------: | :------: |
|      `catchAll`       |  Done  |        `catch`        |          |
|    `catchAllCause`    |  Done  |     `catchCause`      |          |
|      `catchSome`      |  Done  |     `catchFilter`     |          |
|   `catchSomeCause`    |  Done  |  `catchCauseFilter`   |          |
|      `catchTag`       |   -    |                       |          |
|      `catchTags`      |   -    |                       |          |
|        `orDie`        |  Done  |        `orDie`        |          |
|      `orDieWith`      |   X    |                       |          |
|       `orElse`        |   X    |        `catch`        |          |
|    `orElseEither`     |   X    |                       |          |
|     `orElseFail`      |   X    |                       |          |
|    `orElseIfEmpty`    |   -    |                       |          |
| `orElseIfEmptyChunk`  |   X    |                       |          |
| `orElseIfEmptyStream` |   X    |    `orElseIfEmpty`    |          |
|    `orElseSucceed`    |   -    |                       |          |
|     `refineOrDie`     |   X    | `catchFilter` + `die` |          |
|   `refineOrDieWith`   |   X    |                       |          |

### Filtering

|    Effect 3    | Ported | Effect 4 | Comments |
| :------------: | :----: | :------: | :------: |
|    `filter`    |  Done  | `filter` |          |
| `filterEffect` |   -    |          |          |

### Grouping

|     Effect 3      | Ported |   Effect 4   | Comments |
| :---------------: | :----: | :----------: | :------: |
| `groupAdjacentBy` |   -    |              |          |
|     `groupBy`     |  Done  |  `groupBy`   |          |
|   `groupByKey`    |  Done  | `groupByKey` |          |
|     `grouped`     |   -    |              |          |
|  `groupedWithin`  |   -    |              |          |

### Mapping

|        Effect 3        | Ported |     Effect 4     | Comments |
| :--------------------: | :----: | :--------------: | :------: |
|          `as`          |   -    |                  |          |
|         `map`          |  Done  |      `map`       |          |
|       `mapAccum`       |  Done  |    `mapAccum`    |          |
|    `mapAccumEffect`    |  Done  | `mapAccumEffect` |          |
|      `mapChunks`       |  Done  |    `mapArray`    |          |
|   `mapChunksEffect`    |  Done  | `mapArrayEffect` |          |
|      `mapConcat`       |   X    |                  |          |
|    `mapConcatChunk`    |   X    |                  |          |
| `mapConcatChunkEffect` |   X    |                  |          |
|   `mapConcatEffect`    |   X    |                  |          |
|      `mapEffect`       |  Done  |   `mapEffect`    |          |
|       `mapError`       |  Done  |    `mapError`    |          |
|    `mapErrorCause`     |  Done  |    `mapCause`    |          |

### Racing

| Effect 3  | Ported | Effect 4 | Comments |
| :-------: | :----: | :------: | :------: |
|  `race`   |   -    |          |          |
| `raceAll` |   -    |          |          |

### Sequencing

|      Effect 3       | Ported |        Effect 4         | Comments |
| :-----------------: | :----: | :---------------------: | :------: |
|    `branchAfter`    |   -    | `collect` + `flatMap` ? |          |
|      `flatMap`      |  Done  |        `flatMap`        |          |
|      `flatten`      |  Done  |        `flatten`        |          |
|   `flattenChunks`   |  Done  |     `flattenArray`      |          |
|   `flattenEffect`   |   -    |                         |          |
| `flattenExitOption` |   -    |                         |          |
| `flattenIterables`  |  Done  |    `flattenIterable`    |          |
|    `flattenTake`    |  Done  |      `flattenTake`      |          |
|       `onEnd`       |   -    |                         |          |
|      `onStart`      |   -    |                         |          |
|        `tap`        |  Done  |          `tap`          |          |
|      `tapBoth`      |   -    |                         |          |
|     `tapError`      |   -    |                         |          |
|      `tapSink`      |   -    |                         |          |

### Tracing

|  Effect 3  | Ported |  Effect 4  | Comments |
| :--------: | :----: | :--------: | :------: |
| `withSpan` |  Done  | `withSpan` |          |

### Utils

|          Effect 3          | Ported |          Effect 4          | Comments |
| :------------------------: | :----: | :------------------------: | :------: |
|        `accumulate`        |   -    |                            |          |
|     `accumulateChunks`     |   -    |                            |          |
|        `aggregate`         |   -    |                            |          |
|     `aggregateWithin`      |   -    |                            |          |
|  `aggregateWithinEither`   |   -    |                            |          |
|        `broadcast`         |  Done  |        `broadcast`         |          |
|     `broadcastDynamic`     |   X    |        `broadcast`         |          |
|    `broadcastedQueues`     |   X    |        `broadcast`         |          |
| `broadcastedQueuesDynamic` |   X    |        `broadcast`         |          |
|          `buffer`          |  Done  |          `buffer`          |          |
|       `bufferChunks`       |  Done  |       `bufferArray`        |          |
|         `changes`          |   -    |                            |          |
|       `changesWith`        |   -    |                            |          |
|    `changesWithEffect`     |   -    |                            |          |
|          `chunks`          |  Done  |          `chunks`          |          |
|        `chunksWith`        |   -    |                            |          |
|         `combine`          |   -    |                            |          |
|      `combineChunks`       |   -    |                            |          |
|          `concat`          |  Done  |          `concat`          |          |
|          `cross`           |   -    |                            |          |
|        `crossLeft`         |   -    |                            |          |
|        `crossRight`        |   -    |                            |          |
|        `crossWith`         |   -    |                            |          |
|         `debounce`         |   -    |                            |          |
|     `distributedWith`      |   -    |                            |          |
|  `distributedWithDynamic`  |   -    |                            |          |
|          `drain`           |  Done  |          `drain`           |          |
|        `drainFork`         |   -    |                            |          |
|           `drop`           |  Done  |           `drop`           |          |
|        `dropRight`         |   -    |                            |          |
|        `dropUntil`         |   -    |                            |          |
|     `dropUntilEffect`      |   -    |                            |          |
|        `dropWhile`         |   -    |                            |          |
|     `dropWhileEffect`      |   -    |                            |          |
|          `either`          |   -    |                            |          |
|         `ensuring`         |  Done  |         `ensuring`         |          |
|       `ensuringWith`       |  Done  |          `onExit`          |          |
|        `filterMap`         |   X    |          `filter`          |          |
|     `filterMapEffect`      |   X    |       `filterEffect`       |          |
|      `filterMapWhile`      |   X    |                            |          |
|   `filterMapWhileEffect`   |   X    |                            |          |
|         `forever`          |   -    |                            |          |
|    `fromEventListener`     |  Done  |                            |          |
|        `haltAfter`         |   X    |                            |          |
|         `haltWhen`         |   -    |                            |          |
|     `haltWhenDeferred`     |   X    |                            |          |
|         `identity`         |   X    |                            |          |
|        `interleave`        |   -    |                            |          |
|      `interleaveWith`      |   -    |                            |          |
|      `interruptAfter`      |   X    |                            |          |
|      `interruptWhen`       |   -    |                            |          |
|  `interruptWhenDeferred`   |   X    |                            |          |
|       `intersperse`        |   -    |                            |          |
|    `intersperseAffixes`    |   -    |                            |          |
|         `mapBoth`          |   -    |                            |          |
|          `merge`           |  Done  |                            |          |
|         `mergeAll`         |   -    |                            |          |
|       `mergeEither`        |   -    |                            |          |
|        `mergeLeft`         |   -    |                            |          |
|        `mergeRight`        |   -    |                            |          |
|        `mergeWith`         |   -    |                            |          |
|         `mkString`         |  Done  |         `mkString`         |          |
|          `onDone`          |   -    |                            |          |
|         `onError`          |   -    |                            |          |
|        `partition`         |   -    |                            |          |
|     `partitionEither`      |   -    |                            |          |
|           `peel`           |   -    |                            |          |
|       `pipeThrough`        |   -    |                            |          |
|    `pipeThroughChannel`    |  Done  |    `pipeThroughChannel`    |          |
| `pipeThroughChannelOrFail` |  Done  | `pipeThroughChannelOrFail` |          |
|         `prepend`          |   -    |                            |          |
|         `rechunk`          |  Done  |         `rechunk`          |          |
|          `repeat`          |   -    |                            |          |
|       `repeatEither`       |   -    |                            |          |
|      `repeatElements`      |   -    |                            |          |
|    `repeatElementsWith`    |   -    |                            |          |
|        `repeatWith`        |   -    |                            |          |
|          `retry`           |   -    |                            |          |
|           `scan`           |  Done  |           `scan`           |          |
|        `scanEffect`        |  Done  |        `scanEffect`        |          |
|        `scanReduce`        |   X    |                            |          |
|     `scanReduceEffect`     |   X    |                            |          |
|         `schedule`         |   -    |                            |          |
|       `scheduleWith`       |   -    |                            |          |
|          `share`           |  Done  |          `share`           |          |
|         `sliding`          |   -    |                            |          |
|       `slidingSize`        |   -    |                            |          |
|           `some`           |   X    |                            |          |
|        `someOrElse`        |   X    |                            |          |
|        `someOrFail`        |   X    |                            |          |
|          `split`           |   -    |                            |          |
|       `splitOnChunk`       |   X    |                            |          |
|           `take`           |  Done  |           `take`           |          |
|        `takeRight`         |   -    |                            |          |
|        `takeUntil`         |  Done  |        `takeUntil`         |          |
|     `takeUntilEffect`      |  Done  |     `takeUntilEffect`      |          |
|        `takeWhile`         |  Done  |        `takeWhile`         |          |
|      `tapErrorCause`       |  Done  |         `tapCause`         |          |
|         `throttle`         |   -    |                            |          |
|      `throttleEffect`      |   -    |                            |          |
|         `timeout`          |   -    |                            |          |
|       `timeoutFail`        |  Done  |      `timeoutOrElse`       |          |
|     `timeoutFailCause`     |   X    |                            |          |
|        `timeoutTo`         |   X    |                            |          |
|        `transduce`         |  Done  |        `transduce`         |          |
|           `when`           |   -    |                            |          |
|      `whenCaseEffect`      |   X    |                            |          |
|        `whenEffect`        |   X    |           `when`           |          |

### Zipping

|         Effect 3         | Ported | Effect 4 | Comments |
| :----------------------: | :----: | :------: | :------: |
|          `zip`           |   -    |          |          |
|         `zipAll`         |   -    |          |          |
|       `zipAllLeft`       |   -    |          |          |
|      `zipAllRight`       |   -    |          |          |
|   `zipAllSortedByKey`    |   X    |          |          |
| `zipAllSortedByKeyLeft`  |   X    |          |          |
| `zipAllSortedByKeyRight` |   X    |          |          |
| `zipAllSortedByKeyWith`  |   X    |          |          |
|       `zipAllWith`       |   -    |          |          |
|       `zipFlatten`       |   -    |          |          |
|       `zipLatest`        |   -    |          |          |
|      `zipLatestAll`      |   -    |          |          |
|     `zipLatestWith`      |   -    |          |          |
|        `zipLeft`         |   -    |          |          |
|        `zipRight`        |   -    |          |          |
|        `zipWith`         |   -    |          |          |
|     `zipWithChunks`      |   -    |          |          |
|      `zipWithIndex`      |   -    |          |          |
|      `zipWithNext`       |   -    |          |          |
|    `zipWithPrevious`     |   -    |          |          |
| `zipWithPreviousAndNext` |   -    |          |          |

## Sink

### Constructors

|           Effect 3            | Ported |         Effect 4         | Comments |
| :---------------------------: | :----: | :----------------------: | :------: |
|         `collectAll`          |  Done  |       `collectAll`       |          |
|         `collectAllN`         |   -    |                          |          |
|       `collectAllToMap`       |   -    |                          |          |
|      `collectAllToMapN`       |   -    |                          |          |
|       `collectAllToSet`       |   -    |                          |          |
|      `collectAllToSetN`       |   -    |                          |          |
|       `collectAllUntil`       |   -    |                          |          |
|    `collectAllUntilEffect`    |   -    |                          |          |
|       `collectAllWhile`       |   -    |                          |          |
|    `collectAllWhileEffect`    |   -    |                          |          |
|           `context`           |   -    |                          |          |
|         `contextWith`         |   -    |                          |          |
|      `contextWithEffect`      |   -    |                          |          |
|       `contextWithSink`       |   -    |                          |          |
|            `count`            |   -    |                          |          |
|             `die`             |  Done  |          `die`           |          |
|           `dieSync`           |   -    |                          |          |
|            `drain`            |   -    |                          |          |
|            `drop`             |   -    |                          |          |
|          `dropUntil`          |   -    |                          |          |
|       `dropUntilEffect`       |   -    |                          |          |
|          `dropWhile`          |   -    |                          |          |
|       `dropWhileEffect`       |   -    |                          |          |
|            `every`            |   -    |                          |          |
|            `fail`             |  Done  |          `fail`          |          |
|          `failCause`          |  Done  |       `failCause`        |          |
|        `failCauseSync`        |  Done  |     `failCauseSync`      |          |
|          `failSync`           |  Done  |        `failSync`        |          |
|         `foldChunks`          |   -    |    `reduceWhileArray`    |          |
|      `foldChunksEffect`       |   -    | `reduceWhileArrayEffect` |          |
|         `foldEffect`          |  Done  |   `reduceWhileEffect`    |          |
|          `foldLeft`           |  Done  |      `reduceWhile`       |          |
|       `foldLeftChunks`        |   -    |      `reduceArray`       |          |
|    `foldLeftChunksEffect`     |   -    |   `reduceArrayEffect`    |          |
|       `foldLeftEffect`        |  Done  |      `reduceEffect`      |          |
|          `foldUntil`          |   -    |                          |          |
|       `foldUntilEffect`       |   -    |                          |          |
|        `foldWeighted`         |   -    |                          |          |
|    `foldWeightedDecompose`    |   -    |                          |          |
| `foldWeightedDecomposeEffect` |   -    |                          |          |
|     `foldWeightedEffect`      |   -    |                          |          |
|           `forEach`           |  Done  |        `forEach`         |          |
|        `forEachChunk`         |   -    |                          |          |
|      `forEachChunkWhile`      |   -    |                          |          |
|        `forEachWhile`         |   -    |                          |          |
|         `fromChannel`         |  Done  |      `fromChannel`       |          |
|         `fromEffect`          |   -    |                          |          |
|         `fromPubSub`          |   -    |                          |          |
|          `fromPush`           |   -    |                          |          |
|          `fromQueue`          |   -    |                          |          |
|            `head`             |  Done  |          `head`          |          |
|            `last`             |  Done  |          `last`          |          |
|          `leftover`           |   -    |                          |          |
|          `mkString`           |  Done  |        `mkString`        |          |
|            `never`            |  Done  |         `never`          |          |
|            `some`             |   -    |                          |          |
|           `succeed`           |  Done  |        `succeed`         |          |
|             `sum`             |  Done  |          `sum`           |          |
|           `suspend`           |  Done  |        `suspend`         |          |
|            `sync`             |  Done  |          `sync`          |          |
|            `take`             |  Done  |          `take`          |          |
|            `timed`            |   -    |                          |          |
|          `toChannel`          |  Done  |       `toChannel`        |          |
|           `unwrap`            |  Done  |         `unwrap`         |          |
|        `unwrapScoped`         |   X    |                          |          |
|      `unwrapScopedWith`       |   X    |                          |          |

### Context

|     Effect 3     | Ported | Effect 4 | Comments |
| :--------------: | :----: | :------: | :------: |
| `provideContext` |   -    |          |          |

### Elements

|   Effect 3   | Ported | Effect 4 | Comments |
| :----------: | :----: | :------: | :------: |
| `findEffect` |   -    |          |          |

### Error Handling

|     Effect 3      | Ported | Effect 4 | Comments |
| :---------------: | :----: | :------: | :------: |
|     `orElse`      |   -    |          |          |
|   `refineOrDie`   |   -    |          |          |
| `refineOrDieWith` |   -    |          |          |

### Filtering

|      Effect 3       | Ported | Effect 4 | Comments |
| :-----------------: | :----: | :------: | :------: |
|    `filterInput`    |   -    |          |          |
| `filterInputEffect` |   -    |          |          |

### Finalization

|    Effect 3    | Ported | Effect 4 | Comments |
| :------------: | :----: | :------: | :------: |
|   `ensuring`   |   -    |          |          |
| `ensuringWith` |   -    |          |          |

### Folding

|  Effect 3  | Ported |   Effect 4    | Comments |
| :--------: | :----: | :-----------: | :------: |
|   `fold`   |  Done  | `reduceWhile` |          |
| `foldSink` |   -    |               |          |

### Mapping

|        Effect 3        | Ported |   Effect 4    | Comments |
| :--------------------: | :----: | :-----------: | :------: |
|          `as`          |   -    |               |          |
|        `dimap`         |   -    |               |          |
|     `dimapChunks`      |   -    |               |          |
|  `dimapChunksEffect`   |   -    |               |          |
|     `dimapEffect`      |   -    |               |          |
|         `map`          |  Done  |     `map`     |          |
|      `mapEffect`       |  Done  |  `mapEffect`  |          |
|       `mapError`       |  Done  |  `mapError`   |          |
|       `mapInput`       |   -    |               |          |
|    `mapInputChunks`    |   -    |               |          |
| `mapInputChunksEffect` |   -    |               |          |
|    `mapInputEffect`    |   -    |               |          |
|     `mapLeftover`      |  Done  | `mapLeftover` |          |

### Sequencing

| Effect 3  | Ported | Effect 4 | Comments |
| :-------: | :----: | :------: | :------: |
| `flatMap` |   -    |          |          |

### Utils

|       Effect 3        | Ported |     Effect 4     | Comments |
| :-------------------: | :----: | :--------------: | :------: |
|   `collectAllFrom`    |   -    |                  |          |
| `collectAllWhileWith` |   -    |                  |          |
|   `collectLeftover`   |   -    |                  |          |
|   `ignoreLeftover`    |  Done  | `ignoreLeftover` |          |
|        `race`         |   -    |                  |          |
|      `raceBoth`       |   -    |                  |          |
|      `raceWith`       |   -    |                  |          |
|     `splitWhere`      |   -    |                  |          |
|     `summarized`      |   -    |                  |          |
|    `withDuration`     |   -    |                  |          |

### Zipping

|  Effect 3  | Ported | Effect 4 | Comments |
| :--------: | :----: | :------: | :------: |
|   `zip`    |   -    |          |          |
| `zipLeft`  |   -    |          |          |
| `zipRight` |   -    |          |          |
| `zipWith`  |   -    |          |          |
