# Mixture of Models لـ GitHub Copilot CLI

[English](../../../../../integrations/copilot/README.md) · [简体中文](../../../zh-CN/integrations/copilot/README.md) · [日本語](../../../ja/integrations/copilot/README.md) · [Deutsch](../../../de/integrations/copilot/README.md) · [Français](../../../fr/integrations/copilot/README.md) · **العربية**

*هذه ترجمة؛ النسخة الإنجليزية هي المرجع المعتمد وقد تكون أحدث.*

<div dir="rtl">

النبض (heartbeat) الذي يكمل دورًا توقف في منتصف المهمة، وذاكرة Palgu، ونماذج Palgu بوصفها أدوات، داخل GitHub Copilot CLI ‏([ADR 0005](../../../../adr/0005-other-coding-agents.md)).

جرى التحقق منه فعليًا مع Copilot CLI 1.0.112.

## التثبيت

```bash
npm install -g github:alinaqi/mixture-of-models-claude-mod   # يثبّت mom (تشغّله خطافات الإضافة وخادم MCP الخاص بها)
mom login                                                     # تسجيل الدخول إلى Palgu
copilot plugin install alinaqi/mixture-of-models-claude-mod:integrations/copilot
copilot plugin list                                           # mixture-of-models
```

لتجربته من دون تثبيت: `copilot --plugin-dir "$(npm root -g)/mixture-of-models-claude-mod/integrations/copilot"`.

ثم، في مشروع تريده ضمن ذاكرة Palgu: `mom memory on` (يرفع شيفرته المصدرية إلى Palgu؛ معطّل افتراضيًا، لكل مجلد على حدة، ومشترك مع الوكلاء الآخرين الذين يخدمهم `mom`).

## ما يفعله

| | كيف | ميزة Copilot |
| :- | :- | :- |
| **النبض** | الدور الذي ينتهي في منتصف المهمة ("Let me check the tests." أي «دعني أتحقق من الاختبارات.») يُستكمل، 3 مرات كحد أقصى لكل مطالبة. Palgu هو من يقرر (`POST /anthropic/heartbeat`)؛ ومن دون تسجيل دخول يعمل المصنِّف نفسه محليًا. `mom heartbeat off` يعطّله. | `agentStop` → `decision: "block"` مع مطالبة الاستكمال بصفة `reason`؛ تُقرأ الإجابة من `events.jsonl` الخاص بالجلسة، لأن مدخل التوقف لا يحملها |
| **ذاكرة Palgu** | يبحث الوكيل في ذاكرة Palgu الخاصة بالمشروع عبر `palgu_memory_search` (وتخبره المهارة متى)؛ وعند بدء الجلسة في مجلد مفعَّلة فيه الذاكرة يُبلَّغ بأن الذاكرة مفعّلة. | خادم MCP ‏(`.mcp.json`، `mom mcp copilot`)، `sessionStart` → `additionalContext`، المهارة `mixture-of-models` |
| **نماذج Palgu بوصفها أدوات** | `palgu_delegate` يسلّم مهمة فرعية مكتفية بذاتها إلى نموذج من Palgu (`auto` أو مثبَّت)؛ و `palgu_models` يعرضها. | خادم MCP |
| **الفهرسة** | `palgu memory index .` في الخلفية عند بدء الجلسة في مجلد مفعَّلة فيه الذاكرة، مرة كل 10 دقائق كحد أقصى. | `sessionStart` |

كل خطاف (hook) يفشل مفتوحًا: إذا أخطأ `mom` أو كان Palgu بطيئًا، يتابع Copilot وكأنه لا يوجد خطاف.

## ما يختلف عن مود Claude Code

- **لا توجيه لكل مطالبة لأدوار Copilot نفسه.** لا تستطيع خطافات Copilot تغيير النموذج، ومخرجات خطاف الأوامر عند `userPromptSubmitted` تُهمَل، لذا لا يمكن أيضًا إضافة الذاكرة إلى كل مطالبة: إنها تأتي عبر أداة MCP. يصل توجيه Palgu إلى Copilot عبر `palgu_delegate`. ويمكن لـ Copilot أيضًا استخدام Palgu بوصفه مزوّد BYOK من النوع `anthropic` (‏`https://api.palgu.ai/anthropic`، النموذج `auto`)، بنموذج واحد لكل جلسة؛ راجع مستندات BYOK من GitHub.
- لا توجد أوامر `/route` أو `/palgu`؛ يقوم `mom` في الطرفية بذلك.

## ما يرسله وإلى أين

- إلى `https://api.palgu.ai/anthropic/heartbeat` (ما لم يكن `mom heartbeat local|off`): آخر 600 حرف من الإجابة ومعرّف جلسة.
- إلى `https://api.palgu.ai/v1/cortex/search` (فقط عندما يستدعي الوكيل `palgu_memory_search` في مجلد مفعَّلة فيه الذاكرة): الاستعلام (300 حرف كحد أقصى) واسم المشروع في Palgu.
- إلى `https://api.palgu.ai/v1/chat/completions` (فقط عندما يستدعي الوكيل `palgu_delegate`): مطالبة المهمة الفرعية.
- يبقى المفتاح في `~/.config/mixture-of-models/credentials.json` (0600) أو `PALGU_API_KEY`؛ ولا تحتوي ملفات الإضافة على أي مفتاح.

## ما رُصد فعليًا (Copilot CLI 1.0.112)

- الخطافات الموجودة في `.github/hooks/` في مستودع ما لم تعمل تحت `copilot -p` في مجلد غير موثوق؛ أما الخطافات نفسها داخل إضافة (`--plugin-dir` أو مثبّتة) فعملت.
- مطالبة الاستكمال من `agentStop` تعود بوصفها `userPromptSubmitted` جديدًا؛ ويتعرّف عليها `mom` بوصفها مطالبته هو، فيحتفظ بمطالبة الشخص وبرصيد الاستكمالات الثلاثة.
- يبدأ خادم MCP الخاص بالإضافة في مجلد الإضافة؛ ومجلد الجلسة هو `COPILOT_SESSION_CWD`، الذي يستخدمه `mom mcp`.
- سجل المحادثة هو `~/.copilot/session-state/<session>/events.jsonl` (أو تحت `$COPILOT_HOME`)؛ وإجابات النموذج هي أحداث `assistant.message`. لا يقرأ `mom` إلا ملفات `.jsonl` تحت ذلك المجلد، وآخر 256 KB منها فقط.
- يرفض `copilot` متغير `GITHUB_TOKEN` من النوع الكلاسيكي؛ سجّل الدخول عبر `/login` (شغّله بالأمر `env -u GITHUB_TOKEN -u GH_TOKEN copilot` إن كان أحدها مضبوطًا).

</div>
