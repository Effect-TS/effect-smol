#!/bin/bash

direnv allow &

if [ ! -f ~/.local/share/opencode/auth.json ]; then
  opencode auth login
fi

exec /bin/bash
