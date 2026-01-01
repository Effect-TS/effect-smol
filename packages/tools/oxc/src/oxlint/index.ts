import newlineAfterImport from "./rules/newline-after-import.js"
import noOpaqueInstanceFields from "./rules/no-opaque-instance-fields.js"
import noSpreadInPush from "./rules/no-spread-in-push.js"
import objectShorthand from "./rules/object-shorthand.js"
import sortDestructureKeys from "./rules/sort-destructure-keys.js"

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
