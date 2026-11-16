# إلغاء التثبيت

[English](../../../UNINSTALL.md) · [简体中文](../zh-CN/UNINSTALL.md) · [日本語](../ja/UNINSTALL.md) · [Deutsch](../de/UNINSTALL.md) · [Français](../fr/UNINSTALL.md) · **العربية**

*هذه ترجمة؛ النسخة الإنجليزية هي المرجع المعتمد وقد تكون أحدث.*

<div dir="rtl">

```bash
claude plugin uninstall mixture-of-models@mixture-of-models-claude-mod
claude plugin marketplace remove mixture-of-models-claude-mod   # اختياري
```

لا يكتب المود أبدًا إلى `~/.claude/model-config.json`؛ احذف كتلة `router` الخاصة به يدويًا إذا لم تعد تريدها. التثبيتات (pins) والعدادات محفوظة في المخزن الخاص بالإضافة وتزول مع الإضافة.

</div>
