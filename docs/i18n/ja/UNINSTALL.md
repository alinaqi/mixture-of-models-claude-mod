# アンインストール

[English](../../../UNINSTALL.md) · [简体中文](../zh-CN/UNINSTALL.md) · **日本語** · [Deutsch](../de/UNINSTALL.md) · [Français](../fr/UNINSTALL.md) · [العربية](../ar/UNINSTALL.md)

*これは翻訳です。正式な版は英語版であり、英語版のほうが新しい場合があります。*

```bash
claude plugin uninstall mixture-of-models@mixture-of-models-claude-mod
claude plugin marketplace remove mixture-of-models-claude-mod   # 任意
```

mod が `~/.claude/model-config.json` に書き込むことはありません。不要になったら、その `router` ブロックを手で削除してください。ピンとカウントはプラグイン自身のストアにあり、プラグインと一緒に消えます。
