#!/bin/bash

direnv allow
pnpm install
git submodule update --init --recursive
