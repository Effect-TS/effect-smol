## Alpha (current)

Releases are snapshot only

- [x] Port Channel apis
- [ ] Port Stream / Sink apis
- [x] Port worker modules
- [ ] Port command execution modules
- [ ] Port platform-browser
- [x] Add CLI modules
- [ ] Add opentelemetry package
- [x] Port SubscriptionRef
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
|  `fromReadableStreamByob`  |   X    |                                      |          |
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
|    `find`    |   X    |          |          |
| `findEffect` |   X    |          |          |

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
|      `catchTag`       |  Done  |                       |          |
|      `catchTags`      |  Done  |                       |          |
|        `orDie`        |  Done  |        `orDie`        |          |
|      `orDieWith`      |   X    |                       |          |
|       `orElse`        |   X    |        `catch`        |          |
|    `orElseEither`     |   X    |                       |          |
|     `orElseFail`      |   X    |                       |          |
|    `orElseIfEmpty`    |  Done  |                       |          |
| `orElseIfEmptyChunk`  |   X    |                       |          |
| `orElseIfEmptyStream` |   X    |    `orElseIfEmpty`    |          |
|    `orElseSucceed`    |  Done  |                       |          |
|     `refineOrDie`     |   X    | `catchFilter` + `die` |          |
|   `refineOrDieWith`   |   X    |                       |          |

### Filtering

|    Effect 3    | Ported | Effect 4 | Comments |
| :------------: | :----: | :------: | :------: |
|    `filter`    |  Done  | `filter` |          |
| `filterEffect` |  Done  |          |          |

### Grouping

|     Effect 3      | Ported |   Effect 4   | Comments |
| :---------------: | :----: | :----------: | :------: |
| `groupAdjacentBy` |  Done  |              |          |
|     `groupBy`     |  Done  |  `groupBy`   |          |
|   `groupByKey`    |  Done  | `groupByKey` |          |
|     `grouped`     |  Done  |              |          |
|  `groupedWithin`  |  Done  |              |          |

### Mapping

|        Effect 3        | Ported |     Effect 4     | Comments |
| :--------------------: | :----: | :--------------: | :------: |
|          `as`          |   X    |                  |          |
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
|  `race`   |  Done  |          |          |
| `raceAll` |  Done  |          |          |

### Sequencing

|      Effect 3       | Ported |        Effect 4         | Comments |
| :-----------------: | :----: | :---------------------: | :------: |
|    `branchAfter`    |   X    | `collect` + `flatMap` ? |          |
|      `flatMap`      |  Done  |        `flatMap`        |          |
|      `flatten`      |  Done  |        `flatten`        |          |
|   `flattenChunks`   |  Done  |     `flattenArray`      |          |
|   `flattenEffect`   |  Done  |                         |          |
| `flattenExitOption` |   X    |                         |          |
| `flattenIterables`  |  Done  |    `flattenIterable`    |          |
|    `flattenTake`    |  Done  |      `flattenTake`      |          |
|       `onEnd`       |  Done  |                         |          |
|      `onStart`      |  Done  |                         |          |
|        `tap`        |  Done  |          `tap`          |          |
|      `tapBoth`      |  Done  |                         |          |
|     `tapError`      |  Done  |                         |          |
|      `tapSink`      |  Done  |                         |          |

### Tracing

|  Effect 3  | Ported |  Effect 4  | Comments |
| :--------: | :----: | :--------: | :------: |
| `withSpan` |  Done  | `withSpan` |          |

### Utils

|          Effect 3          | Ported |           Effect 4            | Comments |
| :------------------------: | :----: | :---------------------------: | :------: |
|        `accumulate`        |  Done  |                               |          |
|     `accumulateChunks`     |   X    | `accumulate` + `flattenArray` |          |
|        `aggregate`         |  Done  |                               |          |
|     `aggregateWithin`      |  Done  |                               |          |
|  `aggregateWithinEither`   |   X    |                               |          |
|        `broadcast`         |  Done  |          `broadcast`          |          |
|     `broadcastDynamic`     |   X    |          `broadcast`          |          |
|    `broadcastedQueues`     |   X    |          `broadcast`          |          |
| `broadcastedQueuesDynamic` |   X    |          `broadcast`          |          |
|          `buffer`          |  Done  |           `buffer`            |          |
|       `bufferChunks`       |  Done  |         `bufferArray`         |          |
|         `changes`          |  Done  |                               |          |
|       `changesWith`        |  Done  |                               |          |
|    `changesWithEffect`     |  Done  |                               |          |
|          `chunks`          |  Done  |           `chunks`            |          |
|        `chunksWith`        |   X    |                               |          |
|         `combine`          |  Done  |                               |          |
|      `combineChunks`       |  Done  |                               |          |
|          `concat`          |  Done  |           `concat`            |          |
|          `cross`           |  Done  |                               |          |
|        `crossLeft`         |   X    |                               |          |
|        `crossRight`        |   X    |                               |          |
|        `crossWith`         |  Done  |                               |          |
|         `debounce`         |  Done  |                               |          |
|     `distributedWith`      |   X    |                               |          |
|  `distributedWithDynamic`  |   X    |                               |          |
|          `drain`           |  Done  |            `drain`            |          |
|        `drainFork`         |  Done  |                               |          |
|           `drop`           |  Done  |            `drop`             |          |
|        `dropRight`         |  Done  |                               |          |
|        `dropUntil`         |  Done  |                               |          |
|     `dropUntilEffect`      |  Done  |                               |          |
|        `dropWhile`         |  Done  |                               |          |
|     `dropWhileEffect`      |  Done  |                               |          |
|          `either`          |  Done  |           `result`            |          |
|         `ensuring`         |  Done  |          `ensuring`           |          |
|       `ensuringWith`       |  Done  |           `onExit`            |          |
|        `filterMap`         |   X    |           `filter`            |          |
|     `filterMapEffect`      |   X    |        `filterEffect`         |          |
|      `filterMapWhile`      |   X    |                               |          |
|   `filterMapWhileEffect`   |   X    |                               |          |
|         `forever`          |  Done  |                               |          |
|    `fromEventListener`     |  Done  |                               |          |
|        `haltAfter`         |   X    |                               |          |
|         `haltWhen`         |  Done  |                               |          |
|     `haltWhenDeferred`     |   X    |                               |          |
|         `identity`         |   X    |                               |          |
|        `interleave`        |  Done  |                               |          |
|      `interleaveWith`      |  Done  |                               |          |
|      `interruptAfter`      |   X    |                               |          |
|      `interruptWhen`       |  Done  |                               |          |
|  `interruptWhenDeferred`   |   X    |                               |          |
|       `intersperse`        |  Done  |                               |          |
|    `intersperseAffixes`    |  Done  |                               |          |
|         `mapBoth`          |  Done  |                               |          |
|          `merge`           |  Done  |                               |          |
|         `mergeAll`         |  Done  |                               |          |
|       `mergeEither`        |  Done  |         `mergeResult`         |          |
|        `mergeLeft`         |  Done  |                               |          |
|        `mergeRight`        |  Done  |                               |          |
|        `mergeWith`         |   X    |                               |          |
|         `mkString`         |  Done  |          `mkString`           |          |
|          `onDone`          |   X    |                               |          |
|         `onError`          |  Done  |                               |          |
|        `partition`         |  Done  |                               |          |
|     `partitionEither`      |  Done  |       `partitionEffect`       |          |
|           `peel`           |  Done  |                               |          |
|       `pipeThrough`        |  Done  |                               |          |
|    `pipeThroughChannel`    |  Done  |     `pipeThroughChannel`      |          |
| `pipeThroughChannelOrFail` |  Done  |  `pipeThroughChannelOrFail`   |          |
|         `prepend`          |  Done  |                               |          |
|         `rechunk`          |  Done  |           `rechunk`           |          |
|          `repeat`          |  Done  |                               |          |
|       `repeatEither`       |   X    |                               |          |
|      `repeatElements`      |  Done  |                               |          |
|    `repeatElementsWith`    |   X    |                               |          |
|        `repeatWith`        |   X    |                               |          |
|          `retry`           |  Done  |                               |          |
|           `scan`           |  Done  |            `scan`             |          |
|        `scanEffect`        |  Done  |         `scanEffect`          |          |
|        `scanReduce`        |   X    |                               |          |
|     `scanReduceEffect`     |   X    |                               |          |
|         `schedule`         |  Done  |                               |          |
|       `scheduleWith`       |   X    |                               |          |
|          `share`           |  Done  |            `share`            |          |
|         `sliding`          |  Done  |                               |          |
|       `slidingSize`        |  Done  |                               |          |
|           `some`           |   X    |                               |          |
|        `someOrElse`        |   X    |                               |          |
|        `someOrFail`        |   X    |                               |          |
|          `split`           |  Done  |                               |          |
|       `splitOnChunk`       |   X    |                               |          |
|           `take`           |  Done  |            `take`             |          |
|        `takeRight`         |  Done  |                               |          |
|        `takeUntil`         |  Done  |          `takeUntil`          |          |
|     `takeUntilEffect`      |  Done  |       `takeUntilEffect`       |          |
|        `takeWhile`         |  Done  |          `takeWhile`          |          |
|      `tapErrorCause`       |  Done  |          `tapCause`           |          |
|         `throttle`         |  Done  |                               |          |
|      `throttleEffect`      |  Done  |                               |          |
|         `timeout`          |   -    |                               |          |
|       `timeoutFail`        |  Done  |        `timeoutOrElse`        |          |
|     `timeoutFailCause`     |   X    |                               |          |
|        `timeoutTo`         |   X    |                               |          |
|        `transduce`         |  Done  |          `transduce`          |          |
|           `when`           |   -    |                               |          |
|      `whenCaseEffect`      |   X    |                               |          |
|        `whenEffect`        |   X    |            `when`             |          |

### Zipping

|         Effect 3         | Ported | Effect 4 | Comments |
| :----------------------: | :----: | :------: | :------: |
|          `zip`           |  Done  |          |          |
|         `zipAll`         |   -    |          |          |
|       `zipAllLeft`       |   -    |          |          |
|      `zipAllRight`       |   -    |          |          |
|   `zipAllSortedByKey`    |   X    |          |          |
| `zipAllSortedByKeyLeft`  |   X    |          |          |
| `zipAllSortedByKeyRight` |   X    |          |          |
| `zipAllSortedByKeyWith`  |   X    |          |          |
|       `zipAllWith`       |   -    |          |          |
|       `zipFlatten`       |  Done  |          |          |
|       `zipLatest`        |  Done  |          |          |
|      `zipLatestAll`      |  Done  |          |          |
|     `zipLatestWith`      |  Done  |          |          |
|        `zipLeft`         |  Done  |          |          |
|        `zipRight`        |  Done  |          |          |
|        `zipWith`         |  Done  |          |          |
|     `zipWithChunks`      |  Done  |          |          |
|      `zipWithIndex`      |  Done  |          |          |
|      `zipWithNext`       |   -    |          |          |
|    `zipWithPrevious`     |   -    |          |          |
| `zipWithPreviousAndNext` |   -    |          |          |

## Sink

### Constructors

|           Effect 3            | Ported |         Effect 4         | Comments |
| :---------------------------: | :----: | :----------------------: | :------: |
|         `collectAll`          |  Done  |       `collectAll`       |          |
|         `collectAllN`         |  Done  |        `collectN`        |          |
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
|        `forEachChunk`         |  Done  |      `forEachArray`      |          |
|      `forEachChunkWhile`      |   -    |                          |          |
|        `forEachWhile`         |   -    |                          |          |
|         `fromChannel`         |  Done  |      `fromChannel`       |          |
|         `fromEffect`          |  Done  |                          |          |
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

|  Effect 3  | Ported | Effect 4 | Comments |
| :--------: | :----: | :------: | :------: |
|   `fold`   |  Done  |  `fold`  |          |
| `foldSink` |   -    |          |          |

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
