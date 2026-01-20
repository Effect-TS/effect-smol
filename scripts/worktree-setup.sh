#!/bin/bash

# reset to latest main
git fetch origin
git checkout origin/main

# install dependencies
direnv allow
corepack install
pnpm install

# setup repositories
git clone --depth 1 https://github.com/effect-ts/effect.git .repos/effect-old

cat << EOF >> AGENTS.md

## References

If you need to learn more about the old version of effect (version 3.x), you can
access the archived repository here:

\`.repos/effect-old\`
EOF
