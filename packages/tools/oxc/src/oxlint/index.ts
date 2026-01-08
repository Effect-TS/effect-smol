import noImportFromBarrelPackage from "./rules/no-import-from-barrel-package.ts"
import noJsExtensionImports from "./rules/no-js-extension-imports.ts"
import noOpaqueInstanceFields from "./rules/no-opaque-instance-fields.ts"
import preferTopLevelTypeImport from "./rules/prefer-top-level-type-import.ts"

export default {
  meta: {
    name: "effect"
  },
  rules: {
    "no-import-from-barrel-package": noImportFromBarrelPackage,
    "no-js-extension-imports": noJsExtensionImports,
    "no-opaque-instance-fields": noOpaqueInstanceFields,
    "prefer-top-level-type-import": preferTopLevelTypeImport
  }
}
