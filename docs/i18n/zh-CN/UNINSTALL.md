# 卸载

[English](../../../UNINSTALL.md) · **简体中文** · [日本語](../ja/UNINSTALL.md) · [Deutsch](../de/UNINSTALL.md) · [Français](../fr/UNINSTALL.md) · [العربية](../ar/UNINSTALL.md)

*本文为译文；以英文版为准，英文版可能更新。*

```bash
claude plugin uninstall mixture-of-models@mixture-of-models-claude-mod
claude plugin marketplace remove mixture-of-models-claude-mod   # 可选
```

本 mod 从不写入 `~/.claude/model-config.json`；如果不再需要，请手动删除其中的 `router` 块。固定（pin）设置和计数保存在插件自己的存储中，会随插件一起删除。
