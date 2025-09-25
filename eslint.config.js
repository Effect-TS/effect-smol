import * as effectEslint from "@effect/eslint-plugin"
import eslint from "@eslint/js"
import * as tsResolver from "eslint-import-resolver-typescript"
import importPlugin from "eslint-plugin-import-x"
import localRules from "eslint-plugin-local-rules"
import simpleImportSort from "eslint-plugin-simple-import-sort"
import sortDestructureKeys from "eslint-plugin-sort-destructure-keys"
import unusedImports from "eslint-plugin-unused-imports"
import tseslint from "typescript-eslint"

export default tseslint.config(
  {
    ignores: ["**/dist", "**/docs", "**/.tsbuildinfo", "**/*.md"]
  },
  eslint.configs.recommended,
  tseslint.configs.strict,
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
  effectEslint.configs.dprint,
  {
    plugins: {
      "simple-import-sort": simpleImportSort,
      "sort-destructure-keys": sortDestructureKeys,
      "local-rules": localRules
    },

    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2018,
      sourceType: "module"
    },

    settings: {
      "import-x/resolver": {
        name: "tsResolver",
        resolver: tsResolver,
        options: {
          alwaysTryTypes: true
        }
      },
      "local-rules": {
        rulesPaths: ["./eslint-local-rules.cjs"]
      }
    },

    rules: {
      "local-rules/no-opaque-instance-fields": "error",
      "no-fallthrough": "off",
      "no-irregular-whitespace": "off",
      "object-shorthand": "error",
      "prefer-destructuring": "off",
      "sort-imports": "off",

      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='push'] > SpreadElement.arguments",
          message: "Do not use spread arguments in Array.push"
        }
      ],

      "no-unused-vars": "off",
      "require-yield": "off",
      "prefer-rest-params": "off",
      "prefer-spread": "off",
      "import-x/export": "off",
      "import-x/first": "error",
      "import-x/newline-after-import": "error",
      "import-x/no-duplicates": "error",
      "import-x/no-named-as-default-member": "off",
      "import-x/no-unresolved": "off",
      "import-x/order": "off",
      "simple-import-sort/imports": "off",
      "sort-destructure-keys/sort-destructure-keys": "error",
      "deprecation/deprecation": "off",

      "@typescript-eslint/array-type": [
        "warn",
        {
          default: "generic",
          readonly: "generic"
        }
      ],
      "@typescript-eslint/no-dynamic-delete": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/ban-types": "off",
      "@typescript-eslint/camelcase": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/consistent-type-imports": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/interface-name-prefix": "off",
      "@typescript-eslint/member-delimiter-style": 0,
      "@typescript-eslint/no-array-constructor": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-interface": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-invalid-void-type": "off",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ],
      "@typescript-eslint/no-use-before-define": "off",
      "@typescript-eslint/prefer-for-of": "off",
      "@typescript-eslint/unified-signatures": "off",

      "@effect/dprint": [
        "error",
        {
          config: {
            indentWidth: 2,
            lineWidth: 120,
            semiColons: "asi",
            quoteStyle: "alwaysDouble",
            trailingCommas: "never",
            operatorPosition: "maintain",
            "arrowFunction.useParentheses": "force"
          }
        }
      ]
    }
  },
  {
    files: ["packages/*/src/**/*.ts", "packages/*/test/**/*.ts"],
    rules: {
      "no-console": "error"
    }
  },
  {
    files: ["scratchpad/eslint/**/*"],
    plugins: {
      "unused-imports": unusedImports
    },
    rules: {
      "unused-imports/no-unused-imports": "error",
      "@effect/dprint": [
        "error",
        {
          config: {
            indentWidth: 2,
            lineWidth: 80,
            semiColons: "asi",
            quoteStyle: "alwaysDouble",
            trailingCommas: "never",
            operatorPosition: "maintain",
            "arrowFunction.useParentheses": "force"
          }
        }
      ]
    }
  }
)
