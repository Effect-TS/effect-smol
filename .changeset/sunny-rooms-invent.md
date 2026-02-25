---
"effect": patch
---

## 📝 Summary

### 🔍 Overview of Changes
This PR introduces a significant refinement to the `ExtractServices` utility type within the AI `LanguageModel` infrastructure. The core objective is to align the type system with the runtime behavior of the model when automated tool resolution is opted out. By adding a conditional check for the `disableToolCallResolution` flag, we ensure that the TypeScript compiler accurately reflects the requirements of the configuration, preventing the leak of unnecessary service dependencies into the user's implementation.

### 🧠 The Logic Refinement
The `ExtractServices` utility previously attempted to infer service requirements from the `toolkit` regardless of whether the model was actually configured to resolve those tools. This created a friction point for developers who preferred to handle tool calls manually or skip resolution entirely to save on tokens or latency. 

The updated logic now follows a strict priority queue:
1. **Manual Resolution Check:** If `Options` contains `{ disableToolCallResolution: true }`, the type immediately evaluates to `never`.
2. **Toolkit Inference:** If resolution is enabled, it proceeds to infer `ResultEncodingServices` and `ResultDecodingServices` from the provided `WithHandler` or `Yieldable` toolkit types.

### 🚀 Key Improvements & Impact
* **Elimination of "Ghost" Requirements:** Developers using manual tool resolution are no longer forced to provide service handlers for tools that the internal resolution loop will never invoke.
* **Enhanced Type Safety:** By evaluating to `never` in manual mode, the type system provides a much more accurate representation of the required environment (`R`), leading to cleaner and more predictable `Effect` compositions.
* **Reduced Boilerplate:** This change simplifies the setup for advanced AI integration patterns, allowing for leaner `Options` objects and reducing the cognitive load required to satisfy complex type constraints.
* **Optimized Developer Experience:** Aligning the type-level extraction with the `disableToolCallResolution` flag ensures that the IDE and compiler provide relevant feedback based on the chosen operational mode.

### ⚙️ Technical Context
This change specifically modifies `dist/unstable/ai/LanguageModel.d.ts` to insert the conditional branch at the start of the `ExtractServices` definition. This ensures that the opt-out flag takes precedence over the structural inference of the toolkit, providing a clean short-circuit for the type-level computation.
