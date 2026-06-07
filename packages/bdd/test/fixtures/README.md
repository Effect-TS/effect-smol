These fixtures are executable CLI test fixtures for `@effect/bdd`.

Most `.feature` files in this directory are copied from Cucumber Gherkin's
`testdata/good` corpus:

https://github.com/cucumber/gherkin/tree/main/testdata/good

The matching `.step.ts` files are local `@effect/bdd` feature definitions that
make those parser fixtures runnable through the `effect-bdd` CLI.
