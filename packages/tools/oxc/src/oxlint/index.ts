import noOpaqueInstanceFields from "./rules/no-opaque-instance-fields.ts"

export default {
  meta: {
    name: "effect"
  },
  rules: {
    "no-opaque-instance-fields": noOpaqueInstanceFields
  }
}
