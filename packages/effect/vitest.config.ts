import { mergeConfig } from "vitest/config"
import shared from "../../vitest.shared.ts"

const isDeno = process.versions.deno !== undefined

export default mergeConfig(shared, {
  test: {
    exclude: (isDeno ? ["test/cluster/**"] : [])
  }
})
