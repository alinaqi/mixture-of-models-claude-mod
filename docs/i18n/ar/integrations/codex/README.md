# Mixture of Models لـ Codex

[English](../../../../../integrations/codex/README.md) · [简体中文](../../../zh-CN/integrations/codex/README.md) · [日本語](../../../ja/integrations/codex/README.md) · [Deutsch](../../../de/integrations/codex/README.md) · [Français](../../../fr/integrations/codex/README.md) · **العربية**

*هذه ترجمة؛ النسخة الإنجليزية هي المرجع المعتمد وقد تكون أحدث.*

<div dir="rtl">

يختار Palgu النموذج لكل طلب، وتُستدعى ذاكرة Palgu إلى كل مطالبة، ويُستكمل الدور الذي يتوقف في منتصف المهمة. السلوك نفسه الذي يقدمه مود Claude Code، مبنيًا على الإضافات (plugins) والخطافات (hooks) الخاصة بـ Codex ‏([ADR 0005](../../../../adr/0005-other-coding-agents.md)).

يتطلب Codex 0.163 أو أحدث و Node 20 أو أحدث. تحتاج ذاكرة Palgu أيضًا إلى [palgu CLI](https://www.palgu.ai/install) للفهرسة؛ وهي تستخدم `palgu login` الخاص بها إن كان لديك واحد، وإلا فمفتاح `mom`.

## التثبيت

```bash
# 1. أداة mom CLI (تستدعيها خطافات الإضافة)
npm install -g github:alinaqi/mixture-of-models-claude-mod
mom login                      # سجّل الدخول إلى Palgu في المتصفح

# 2. وجّه Codex عبر Palgu: يكتب ~/.codex/palgu.config.toml (لا يُمس ملف config.toml الخاص بك)
mom setup codex --write

# 3. الإضافة: استدعاء الذاكرة والنبض
codex plugin marketplace add alinaqi/mixture-of-models-claude-mod
codex plugin add mixture-of-models@mixture-of-models
```

ثم شغّل Codex على Palgu:

```bash
codex -p palgu
```

يطلب منك Codex مراجعة خطافات الإضافة في المرة الأولى (`/hooks`)؛ وهي تشغّل `mom hook codex` ولا شيء غيره.

## ما يفعله

| | كيف | ميزة Codex |
| :- | :- | :- |
| **التوجيه** | `model = "auto"`: يصنّف Palgu كل طلب ويخدمه من مستوياته (trivial، small، medium، think). ‏`MOM_PIN=<model> codex -p palgu -m <model>` (النموذج نفسه مرتين) يثبّت نموذجًا واحدًا للجلسة: لا يثبّت Palgu النموذج الذي يسمّيه الطلب إلا عند وجود `x-srooter-pin`، ويرفض `auto` مع تثبيت (403). | ملف التعريف `-p palgu`، و `[model_providers.palgu]` مع `auth = { command = "mom", args = ["token"] }` |
| **ذاكرة Palgu** | `mom memory on` في مجلد مشروع يفهرسه (يرفع شيفرته المصدرية إلى Palgu) ويستدعي منه حتى 8 مؤشرات إلى كل مطالبة من أربع كلمات أو أكثر. معطّلة افتراضيًا؛ والموافقة لكل مجلد على حدة ومشتركة مع الأدوات الأخرى التي يخدمها `mom`. | `UserPromptSubmit` → `additionalContext` |
| **النبض** | الدور الذي ينتهي في منتصف المهمة ("Let me check the tests." أي «دعني أتحقق من الاختبارات.») يُستكمل، 3 مرات كحد أقصى لكل مطالبة. Palgu هو من يقرر (`POST /anthropic/heartbeat`)؛ ومن دون تسجيل دخول يعمل المصنِّف نفسه محليًا. `mom heartbeat off` يعطّله. | `Stop` → `decision: "block"` |
| **المتابعة في Palgu** | `mom palgu codex` يتابع آخر جلسة Codex لك في Palgu بسياقها الكامل (`palgu --continue-codex=<id>`): في الطرفية يشغّل Palgu هناك، وفي غيرها ينسخ الأمر؛ و`--open` يشغّله في علامة تبويب جديدة في Terminal على macOS. يقرأ Palgu سجل المحادثة ويحجب بيانات الاعتماد؛ ولا يحتفظ `mom` إلا بمعرّف الجلسة والمجلد. | أي hook (معرّف الجلسة) |
| **الفهرسة** | في مجلد مفعَّلة فيه الذاكرة، يعمل `palgu memory index .` في الخلفية عند بدء الجلسة، مرة كل 10 دقائق كحد أقصى. | `SessionStart` |

كل خطاف يفشل مفتوحًا: إذا أخطأ `mom` أو كان Palgu بطيئًا، يتابع Codex وكأنه لا يوجد خطاف. ينتظر البحث في الذاكرة 3 ثوانٍ كحد أقصى، والنبض 8 ثوانٍ كحد أقصى.

## ما يرسله وإلى أين

- إلى `https://api.palgu.ai/v1/responses` (‏Codex نفسه، تحت `-p palgu`): أدوارك في Codex، مع المفتاح من `mom token` والترويسات `x-srooter-client: mixture-of-models-codex/<version>`، و `x-srooter-pin` / `x-srooter-project` عندما يكون `MOM_PIN` / `MOM_PROJECT` مضبوطين.
- إلى `https://api.palgu.ai/v1/cortex/search` (‏`mom`، فقط في المجلدات المفعَّلة فيها الذاكرة): المطالبة (سطر واحد، 300 حرف كحد أقصى) واسم المشروع في Palgu.
- إلى `https://api.palgu.ai/anthropic/heartbeat` (‏`mom`، ما لم يكن `mom heartbeat local|off`): آخر 600 حرف من إجابة Codex ومعرّف جلسة.
- المفتاح موجود في `~/.config/mixture-of-models/credentials.json` (الوضع 0600) أو `PALGU_API_KEY`. ولا يُكتب أبدًا في إعدادات Codex.

## ما يختلف عن مود Claude Code

- التوجيه هو مستويات Palgu، لا مصنِّف المود واستراتيجياته: لا تستطيع خطافات Codex تغيير نموذج الدور.
- لا توجد أوامر الشرطة المائلة `/route` أو `/palgu` (أزال Codex الأوامر المخصصة)؛ والمهارة (skill) ‏`mixture-of-models` تخبر Codex بأوامر `mom` التي يقترحها.
- لا يمكن إدراج الإضافات التي تحتوي خطافات في دليل الإضافات العام لـ Codex، لذا تُثبَّت من سوق (marketplace) هذا المستودع.

</div>
