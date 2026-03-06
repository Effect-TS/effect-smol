direnv allow
corepack install
pnpm i

git clone https://github.com/effect-ts/effect-smol.git .repos/effect
rm .repos/effect/LLMS.md
rm -rf .repos/effect/ai-docs/

cat << EOF >> AGENTS.md

## Learning about the "effect" library

If you need to learn more about effect, you can access the source code repository here:

\`.repos/effect\`

Do not use node_modules for learning about effect.
EOF
