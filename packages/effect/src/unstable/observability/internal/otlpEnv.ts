import * as Config from "../../../Config.ts"
import * as Effect from "../../../Effect.ts"
import * as Option from "../../../Option.ts"
import * as Schema from "../../../Schema.ts"
import * as SchemaGetter from "../../../SchemaGetter.ts"
import * as SchemaTransformation from "../../../SchemaTransformation.ts"
import * as HttpClientRequest from "../../http/HttpClientRequest.ts"

export type Signal = "LOGS" | "METRICS" | "TRACES"

const ExporterList = Config.Array(
  Schema.String.pipe(
    Schema.decode(SchemaTransformation.trim()),
    Schema.decode(SchemaTransformation.toLowerCase())
  )
).pipe(
  Schema.decode({
    decode: SchemaGetter.transform((_: ReadonlyArray<string>) => _.filter((_) => _ !== "")),
    encode: SchemaGetter.passthrough()
  })
)

const HeadersRecord = Config.Record(Schema.String, Schema.String)

export const headers = (signal: Signal) =>
  Config.make((provider) =>
    Effect.gen(function*() {
      const headers = yield* Config.option(Config.schema(HeadersRecord, `OTEL_EXPORTER_OTLP_${signal}_HEADERS`)).parse(
        provider
      )
      if (Option.isSome(headers)) {
        return headers.value
      }

      const fallback = yield* Config.option(Config.schema(HeadersRecord, "OTEL_EXPORTER_OTLP_HEADERS")).parse(provider)
      return Option.getOrUndefined(fallback)
    })
  )

export const endpoint = (signal: Signal) =>
  Config.make((provider) =>
    Effect.gen(function*() {
      const endpoint = yield* Config.option(Config.string(`OTEL_EXPORTER_OTLP_${signal}_ENDPOINT`)).parse(provider)
      if (Option.isSome(endpoint)) {
        return endpoint.value
      }

      const fallback = yield* Config.option(Config.string("OTEL_EXPORTER_OTLP_ENDPOINT")).parse(provider)
      return Option.isSome(fallback) && fallback.value !== ""
        ? HttpClientRequest.appendUrl(HttpClientRequest.get(fallback.value), `/v1/${signal.toLowerCase()}`).url
        : undefined
    })
  )

export const exporters = (signal: Signal) =>
  Config.option(Config.schema(ExporterList, `OTEL_${signal}_EXPORTER`)).pipe(
    Config.map(Option.getOrElse<ReadonlyArray<string>>(() => []))
  )
