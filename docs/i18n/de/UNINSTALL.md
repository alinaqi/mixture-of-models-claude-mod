# Deinstallation

[English](../../../UNINSTALL.md) · [简体中文](../zh-CN/UNINSTALL.md) · [日本語](../ja/UNINSTALL.md) · **Deutsch** · [Français](../fr/UNINSTALL.md) · [العربية](../ar/UNINSTALL.md)

*Dies ist eine Übersetzung; die englische Version ist maßgeblich und möglicherweise aktueller.*

```bash
claude plugin uninstall mixture-of-models@mixture-of-models-claude-mod
claude plugin marketplace remove mixture-of-models-claude-mod   # optional
```

Der Mod schreibt nie in `~/.claude/model-config.json`; löschen Sie dessen `router`-Block von Hand, wenn Sie ihn nicht mehr wollen. Pins und Zähler liegen im eigenen Speicher des Plugins und verschwinden mit dem Plugin.
