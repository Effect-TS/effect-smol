import noAtPrefixInTagString from "./rules/no-at-prefix-in-tag-string.ts"
import noBigIntLiterals from "./rules/no-bigint-literals.ts"
import noImportFromBarrelPackage from "./rules/no-import-from-barrel-package.ts"
import noJsExtensionImports from "./rules/no-js-extension-imports.ts"
import noOpaqueInstanceFields from "./rules/no-opaque-instance-fields.ts"
import standardJsdoc from "./rules/standard-jsdoc.ts"

export default {
  meta: {
    name: "effect"
  },
  rules: {
    "no-at-prefix-in-tag-string": noAtPrefixInTagString,
    "no-bigint-literals": noBigIntLiterals,
    "no-import-from-barrel-package": noImportFromBarrelPackage,
    "no-js-extension-imports": noJsExtensionImports,
    "no-opaque-instance-fields": noOpaqueInstanceFields,
    "standard-jsdoc": standardJsdoc
  }
}
