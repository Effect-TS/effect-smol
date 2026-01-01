import newlineAfterImport from "./rules/newline-after-import.ts"
import noOpaqueInstanceFields from "./rules/no-opaque-instance-fields.ts"
import noSpreadInPush from "./rules/no-spread-in-push.ts"
import objectShorthand from "./rules/object-shorthand.ts"
import sortDestructureKeys from "./rules/sort-destructure-keys.ts"

export default {
  meta: {
    name: "effect"
  },
  rules: {
    "newline-after-import": newlineAfterImport,
    "no-opaque-instance-fields": noOpaqueInstanceFields,
    "no-spread-in-push": noSpreadInPush,
    "object-shorthand": objectShorthand,
    "sort-destructure-keys": sortDestructureKeys
  }
}
