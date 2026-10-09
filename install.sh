#!/usr/bin/env bash
# Installs the mod from this repository's marketplace and seeds the config.
set -euo pipefail
MARKET="alinaqi/mixture-of-models-claude-mod"
CONFIG="$HOME/.claude/model-config.json"

need=2.1.287; have=$(claude --version 2>/dev/null | awk '{print $1}')
if [ "$(printf '%s\n%s\n' "$need" "$have" | sort -V | head -1)" != "$need" ]; then
  echo "Claude Code $have found; mods need $need or later. Run: claude update" >&2; exit 1
fi

claude plugin marketplace add "$MARKET" 2>/dev/null || true
claude plugin install "mixture-of-models@mixture-of-models-claude-mod"

if [ ! -f "$CONFIG" ]; then
  mkdir -p "$(dirname "$CONFIG")"
  cp "$(dirname "$0")/config.example.json" "$CONFIG"
  echo "Wrote $CONFIG from config.example.json. Set router.child.baseUrl for your gateway."
else
  echo "$CONFIG exists. Add a \"router\" block from config.example.json if it has none."
fi
echo "Now set the gateway: in a session run /plugin configure mixture-of-models@mixture-of-models-claude-mod, then /route."
