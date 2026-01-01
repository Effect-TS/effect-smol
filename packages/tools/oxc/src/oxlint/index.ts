import noImportFromBarrelPackage from "./rules/no-import-from-barrel-package.ts"
import noOpaqueInstanceFields from "./rules/no-opaque-instance-fields.ts"

export default {
  meta: {
    name: "effect"
  },
  rules: {
    "no-import-from-barrel-package": noImportFromBarrelPackage,
    "no-opaque-instance-fields": noOpaqueInstanceFields
  }
}
