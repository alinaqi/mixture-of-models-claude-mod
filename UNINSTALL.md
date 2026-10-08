# Uninstall

```bash
claude plugin uninstall mixture-of-models@mixture-of-models-claude-mod
claude plugin marketplace remove mixture-of-models-claude-mod   # optional
```

The mod never writes to `~/.claude/model-config.json`; delete its `router` block by hand if you no longer want it. Pins and counts live in the plugin's own store and go away with the plugin.
