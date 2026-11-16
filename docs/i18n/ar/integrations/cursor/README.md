# Mixture of Models لـ Cursor

[English](../../../../../integrations/cursor/README.md) · [简体中文](../../../zh-CN/integrations/cursor/README.md) · [日本語](../../../ja/integrations/cursor/README.md) · [Deutsch](../../../de/integrations/cursor/README.md) · [Français](../../../fr/integrations/cursor/README.md) · **العربية**

*هذه ترجمة؛ النسخة الإنجليزية هي المرجع المعتمد وقد تكون أحدث.*

<div dir="rtl">

ابحث في ذاكرة Palgu، وأرسل المهام الفرعية المكتفية بذاتها إلى نماذج أرخص عبر Palgu، واستكمل الدور الذي يتوقف في منتصف المهمة. يعمل بالطريقة التي يعمل بها مود Claude Code، من خلال ما يوفّره Cursor: خطافات (hooks)، وخادم MCP، وقاعدة (rule) ‏([ADR 0005](../../../../adr/0005-other-coding-agents.md)).

يتطلب Node 20 أو أحدث وأداة `mom` CLI على `PATH` الذي يراه Cursor. تحتاج ذاكرة Palgu أيضًا إلى [palgu CLI](https://www.palgu.ai/install) للفهرسة. وهي تستخدم `palgu login` الخاص بها إن كان لديك واحد، وإلا فمفتاح `mom`.

## التثبيت

```bash
# 1. أداة mom CLI (تشغّلها الخطافات وخادم MCP)
npm install -g github:alinaqi/mixture-of-models-claude-mod
mom login                      # سجّل الدخول إلى Palgu في المتصفح
```

ثم اختر أحد الخيارين:

- **الإضافة.** في Cursor، **Dashboard → Plugins & MCPs → Add Marketplace → Import from Repo** مع `https://github.com/alinaqi/mixture-of-models-claude-mod`، ثم ثبّت **Mixture of Models** من **Customize**. لتجربتها محليًا، انسخ `integrations/cursor` إلى `~/.cursor/plugins/local/mixture-of-models` وشغّل **Developer: Reload Window**.
- **لكل مشروع، من دون الإضافة.** في مجلد المشروع، يطبع `mom setup cursor` مدخلات `.cursor/hooks.json` و `.cursor/mcp.json`؛ ويدمجها `mom setup cursor --write` في الملفات الموجودة. يحتفظ بخطافاتك وخوادمك الأخرى ويحفظ نسخة `.bak` من أي ملف يغيّره. ثم أعد تحميل النافذة. بهذه الطريقة تحصل على الخطافات وخادم MCP لكن ليس على القاعدة. انسخ `integrations/cursor/rules/mixture-of-models.mdc` إلى `.cursor/rules/` إن أردتها.

إذا لم يجد Cursor الأداة `mom` (قد لا يرى التطبيق الذي يُشغَّل من الـ Dock مجلد bin العام لـ npm)، فاستخدم المسار الكامل من `which mom` في الخطافات وفي `mcp.json`.

## ما يفعله

| | كيف | ميزة Cursor |
| :- | :- | :- |
| **ذاكرة Palgu** | `mom memory on` في مجلد مشروع يفهرسه (وهذا يرفع شيفرته المصدرية إلى Palgu). بعدها يبحث الوكيل فيه عبر `palgu_memory_search` في بداية المهمة ويحصل على حتى 8 مؤشرات. عند بدء الجلسة، يخبر الخطاف الوكيل بأن الذاكرة مفعّلة. الذاكرة معطّلة افتراضيًا. والموافقة لكل مجلد على حدة ومشتركة مع كل أداة يخدمها `mom`. | أداة MCP؛ `sessionStart` → `additional_context`؛ القاعدة |
| **التفويض** | `palgu_delegate {prompt, model?}` يرسل مهمة فرعية واحدة مكتفية بذاتها إلى Palgu (‏`model: "auto"`، فيختار Palgu المستوى، أو نموذجًا تثبّته أنت) ويعيد الإجابة. تقصره القاعدة على العمل منخفض المخاطر (اختبارات للصياغة الأولية، شيفرة قالبية boilerplate، مستندات، عمليات بحث) وتستبعد العمل الحساس أمنيًا والأسرار. `palgu_models` يعرض النماذج التي يخدمها Palgu. | أدوات MCP؛ القاعدة |
| **النبض** | عندما ينتهي دور في منتصف المهمة ("Now I'll run the tests." أي «الآن سأشغّل الاختبارات.» ثم لا شيء)، يرسل الخطاف متابعة، 3 مرات كحد أقصى لكل مطالبة. Palgu هو من يقرر (`POST /anthropic/heartbeat`). ومن دون تسجيل دخول يعمل المصنِّف نفسه محليًا. الدور الذي تُلغيه أنت لا يُستكمل أبدًا. `mom heartbeat off` يعطّله. | `afterAgentResponse` يحتفظ بالإجابة؛ `stop` → `followup_message` (`loop_limit: 3`) |
| **الفهرسة** | في مجلد مفعَّلة فيه الذاكرة، يعمل `palgu memory index .` في الخلفية عند بدء الجلسة، مرة كل 10 دقائق كحد أقصى. | `sessionStart` |

كل خطاف يفشل مفتوحًا (fail open). إذا أخطأ `mom` أو كان Palgu بطيئًا، يتابع Cursor وكأن الخطاف غير موجود. ينتظر النبض 8 ثوانٍ كحد أقصى، والبحث في الذاكرة 8 ثوانٍ والتفويض 120 ثانية.

## ما يرسله وإلى أين

- إلى `https://api.palgu.ai/v1/chat/completions` (‏`palgu_delegate`، فقط عندما يستدعيه الوكيل): مطالبة المهمة الفرعية، مع `x-srooter-client: mixture-of-models-cursor/<version>`، و `x-srooter-pin` عندما يكون هناك نموذج مثبَّت.
- إلى `https://api.palgu.ai/v1/cortex/search` (‏`palgu_memory_search`، فقط في المجلدات المفعَّلة فيها الذاكرة): الاستعلام (سطر واحد، 300 حرف كحد أقصى) واسم المشروع في Palgu.
- إلى `https://api.palgu.ai/v1/models/health` (‏`palgu_models`): المفتاح فقط.
- إلى `https://api.palgu.ai/anthropic/heartbeat` (خطاف `stop`، ما لم يكن `mom heartbeat local|off`): آخر 600 حرف من إجابة الوكيل ومعرّف جلسة.
- يقيم المفتاح في `~/.config/mixture-of-models/credentials.json` (الوضع 0600) أو يأتي من `PALGU_API_KEY`. لا يُكتب أبدًا في ملفات Cursor ولا يُسجَّل. وتُحفظ حالة `mom` (آخر مطالبة وإجابة لكل محادثة، ليوم واحد) في `state.json` بجانبه.

## كيف يختلف عن مود Claude Code

- **لا توجيه لكل دور.** لا تستطيع خطافات Cursor تغيير النموذج، وعنوان API الأساسي المخصص غير موثوق في وضع Agent. يقوم نموذج Cursor نفسه بالعمل، ولا يذهب إلى نموذج أرخص إلا ما يسلّمه الوكيل إلى `palgu_delegate`.
- **الذاكرة تُسحب، ولا تُدفع.** لا يستطيع `beforeSubmitPrompt` إلا السماح بمطالبة أو حجبها؛ ولا يستطيع إضافة سياق. لذلك تصل الذاكرة إلى الوكيل عبر أداة MCP، التي تطلب منه القاعدة وملاحظة بدء الجلسة استدعاءها، لا عبر كل مطالبة.
- **لا توجد أوامر `/route` أو `/palgu`.** تخبر القاعدة الوكيل بأوامر `mom` التي يقترحها.

## `mom mcp` لأدوات أخرى

`mom mcp [tool]` خادم MCP عادي على stdio (‏JSON-RPC 2.0، البروتوكول `2025-06-18` أو إصدار العميل)، لذا يستطيع أي وكيل يشغّل خوادم MCP استخدامه: `command: "mom", args: ["mcp", "<tool>"]`. ‏`<tool>` لا يفعل سوى تسمية العميل في `x-srooter-client`. يحدد مجلد المشروع من وسيط `folder` الخاص بالأداة، ثم `MOM_PROJECT_DIR`، ثم جذور MCP الخاصة بالعميل، ثم مجلد عمله.

</div>
