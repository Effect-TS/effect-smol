#!/bin/bash

# Mount the current directory, expose git config

datadir=$(git rev-parse --show-toplevel)/.lalph/sandbox

mkdir -p "$datadir"

git_author_name=$(git config user.name)
git_author_email=$(git config user.email)

# opencode data
opencodedata="$datadir/opencode"
opencode_state="$opencodedata/state"
opencode_share="$opencodedata/share"
mkdir -p "$opencode_state" "$opencode_share"

exec docker run --rm -it \
     -v "$PWD":/app \
     -v "$opencode_state":/root/.local/state/opencode \
     -v "$opencode_share":/root/.local/share/opencode \
     -p 1455:1455 \
     -e GIT_AUTHOR_NAME="$git_author_name" \
     -e GIT_AUTHOR_EMAIL="$git_author_email" \
     "$(docker build -q . -f scripts/docker/sandbox.Dockerfile)"
