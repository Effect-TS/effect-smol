#!/bin/bash

# install dependencies
direnv allow
corepack install
pnpm install

# setup repositories
git clone --depth 1 https://github.com/effect-ts/effect.git .repos/effect-old
git clone --depth 1 https://github.com/tim-smart/effect-atom.git .repos/effect-atom-old

cat << EOF >> AGENTS.md

## Learning about "effect" v3

If you need to learn more about the old version of effect (version 3.x), you can
access the archived repository here:

\`.repos/effect-old\`

## Learning more about "effect-atom"

If you need to learn more about the old version of effect atom, you can
access the archived repository here:

\`.repos/effect-atom-old\`
EOF
