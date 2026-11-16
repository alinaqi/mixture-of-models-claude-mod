# Désinstallation

[English](../../../UNINSTALL.md) · [简体中文](../zh-CN/UNINSTALL.md) · [日本語](../ja/UNINSTALL.md) · [Deutsch](../de/UNINSTALL.md) · **Français** · [العربية](../ar/UNINSTALL.md)

*Ceci est une traduction ; la version anglaise fait foi et peut être plus récente.*

```bash
claude plugin uninstall mixture-of-models@mixture-of-models-claude-mod
claude plugin marketplace remove mixture-of-models-claude-mod   # facultatif
```

Le mod n'écrit jamais dans `~/.claude/model-config.json` ; supprimez son bloc `router` à la main si vous n'en voulez plus. Les épingles et les compteurs se trouvent dans le propre stockage du plugin et disparaissent avec lui.
