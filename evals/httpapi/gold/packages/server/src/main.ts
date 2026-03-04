import { Layer } from "effect";
import { HttpLayer } from "./Http.ts";
import { NodeRuntime } from "@effect/platform-node";

Layer.launch(HttpLayer).pipe(
  NodeRuntime.runMain
)
