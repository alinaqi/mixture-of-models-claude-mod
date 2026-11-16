# Mixture of Models لـ Antigravity

[English](../../../../../integrations/antigravity/README.md) · [简体中文](../../../zh-CN/integrations/antigravity/README.md) · [日本語](../../../ja/integrations/antigravity/README.md) · [Deutsch](../../../de/integrations/antigravity/README.md) · [Français](../../../fr/integrations/antigravity/README.md) · **العربية**

*هذه ترجمة؛ النسخة الإنجليزية هي المرجع المعتمد وقد تكون أحدث.*

<div dir="rtl">

ذاكرة Palgu مستدعاة إلى كل مطالبة، والنبض (heartbeat) الذي يكمل دورًا توقف في منتصف المهمة، ونماذج Palgu بوصفها أدوات، داخل Antigravity CLI من Google ‏(`agy`) ‏([ADR 0005](../../../../adr/0005-other-coding-agents.md)).

جرى التحقق منه فعليًا مع agy 1.0.7.

## التثبيت

```bash
npm install -g github:alinaqi/mixture-of-models-claude-mod   # يثبّت mom وملفات هذه الإضافة
mom login                                                     # تسجيل الدخول إلى Palgu
agy plugin install "$(npm root -g)/mixture-of-models-claude-mod/integrations/antigravity"
agy plugin list                                               # mixture-of-models، مفعّلة
```

ثم، في مشروع تريده ضمن ذاكرة Palgu: `mom memory on` (يرفع شيفرته المصدرية إلى Palgu؛ معطّل افتراضيًا، لكل مجلد على حدة، ومشترك مع الوكلاء الآخرين الذين يخدمهم `mom`).

## ما يفعله

| | كيف | ميزة Antigravity |
| :- | :- | :- |
| **ذاكرة Palgu** | عند أول استدعاء للنموذج في كل دور، في مجلد مفعَّلة فيه الذاكرة، تُضاف للنموذج حتى 8 مؤشرات من ذاكرة Palgu الخاصة بالمشروع (النوايا المسجّلة وسجلات القرارات المعمارية ADR، والمستندات، ورموز الشيفرة). | `PreInvocation` (`invocationNum` 0) → `injectSteps` `ephemeralMessage` |
| **النبض** | الدور الذي ينتهي في منتصف المهمة ("Let me check the tests." أي «دعني أتحقق من الاختبارات.») يُستكمل، 3 مرات كحد أقصى لكل مطالبة. Palgu هو من يقرر (`POST /anthropic/heartbeat`)؛ ومن دون تسجيل دخول يعمل المصنِّف نفسه محليًا. `mom heartbeat off` يعطّله. | `Stop` → `decision: "continue"`؛ تُقرأ الإجابة من سجل المحادثة (transcript)، لأن مدخل Stop لا يحملها |
| **الفهرسة** | `palgu memory index .` في الخلفية عند بدء الجلسة في مجلد مفعَّلة فيه الذاكرة، مرة كل 10 دقائق كحد أقصى. | `SessionStart` |
| **نماذج Palgu بوصفها أدوات** | `palgu_memory_search`، و `palgu_delegate` (تسليم مهمة فرعية مكتفية بذاتها إلى نموذج من Palgu، `auto` أو مثبَّت) و `palgu_models`، مع قاعدة دائمة التفعيل تحدد متى تُستخدم. | `mcp_config.json` (`mom mcp antigravity`)، `rules/AGENTS.md` |

كل خطاف (hook) يفشل مفتوحًا (fail open): إذا أخطأ `mom` أو كان Palgu بطيئًا، يتابع `agy` وكأنه لا يوجد خطاف.

## التوجيه

لا تستطيع خطافات Antigravity تغيير النموذج، وإعداد النموذج الخاص به لا يقبل إلا نماذج Gemini (أو بوابة نماذج مؤسسية يضبطها مسؤول). لذلك تبقى أدوار الوكيل نفسه على نموذج Gemini الذي تختاره في `agy`؛ ويصل إليه توجيه Palgu عبر `palgu_delegate`، الذي تطلب القاعدة من الوكيل استخدامه للمهام الفرعية منخفضة المخاطر والمكتفية بذاتها.

## ما يرسله وإلى أين

- إلى `https://api.palgu.ai/v1/cortex/search` (فقط في المجلدات المفعَّلة فيها الذاكرة): المطالبة (سطر واحد، 300 حرف كحد أقصى) واسم المشروع في Palgu.
- إلى `https://api.palgu.ai/anthropic/heartbeat` (ما لم يكن `mom heartbeat local|off`): آخر 600 حرف من الإجابة ومعرّف جلسة.
- إلى `https://api.palgu.ai/v1/chat/completions` (فقط عندما يستدعي الوكيل `palgu_delegate`): مطالبة المهمة الفرعية.
- يبقى المفتاح في `~/.config/mixture-of-models/credentials.json` (0600) أو `PALGU_API_KEY`؛ ولا تحتوي ملفات الإضافة على أي مفتاح.

## ما رُصد فعليًا بخلاف المستندات (agy 1.0.7)

- يحمل مدخل الخطاف `hookEventName` و `cwd`؛ وعلَم الاستكمال هو `continuationActive`.
- الدور الذي ينتهي بإجابة يتوقف مع `terminationReason: "NO_TOOL_CALL"` (تقول المستندات `model_stop`)، والدور الفاشل مع `ERROR`؛ ولا يُستكمل إلا الأول.
- سجل المحادثة (`transcriptPath`) بصيغة JSONL؛ وإجابات النموذج هي خطوات `PLANNER_RESPONSE`.
- إذا فشل `agy` مع `PERMISSION_DENIED on resource project <id>`، فإن مشروع Google Cloud الموجود في `~/.gemini/antigravity-cli/settings.json` ‏(`gcp.project`) مشروع لا يستطيع حسابك استخدامه: اضبط مشروعًا تستطيع استخدامه، أو استخدم مفتاح Gemini API مع `"modelProvider": "gemini"` و `GEMINI_API_KEY`.

</div>
