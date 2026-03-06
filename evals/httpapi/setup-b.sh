direnv allow
corepack install
pnpm i

git clone https://github.com/effect-ts/effect-smol.git .repos/effect

cat << EOF >> AGENTS.md

## Learning about the "effect" library

\`.repos/effect/LLMS.md\` is an authoritative source of information about the
"effect" and "@effect/*" packages. Read this before looking elsewhere for
information about these packages. It contains the best practices for using
effect.
EOF
