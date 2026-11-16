# Mixture of Models لـ OpenCode

[English](../../../../../integrations/opencode/README.md) · [简体中文](../../../zh-CN/integrations/opencode/README.md) · [日本語](../../../ja/integrations/opencode/README.md) · [Deutsch](../../../de/integrations/opencode/README.md) · [Français](../../../fr/integrations/opencode/README.md) · **العربية**

*هذه ترجمة؛ النسخة الإنجليزية هي المرجع المعتمد وقد تكون أحدث.*

<div dir="rtl">

تختار الإضافة نموذج Palgu لكل مطالبة، وتضيف ذاكرة Palgu إلى كل مطالبة، وتستكمل الدور الذي يتوقف في منتصف المهمة، وتضيف `/route` و `/palgu`. ‏OpenCode هو الأداة الوحيدة إلى جانب Claude Code التي تستطيع فيها الإضافة اختيار النموذج لكل طلب، لذا فهي تطابق مود Claude Code ميزةً بميزة ([ADR 0005](../../../../adr/0005-other-coding-agents.md)).

المتطلبات:

- OpenCode 1.19 أو أحدث. تستخدم الإضافة واجهة إضافات الخادم V1؛ جرى اختبارها على 1.19.5.
- Node 20 أو أحدث من أجل `mom`.
- لذاكرة Palgu، تتولى [palgu CLI](https://www.palgu.ai/install) الفهرسة.

## التثبيت

```bash
# 1. mom: تسجيل الدخول، والموافقة على الذاكرة، وأمر الإعداد (الإضافة تُشحن في الحزمة نفسها)
npm install -g github:alinaqi/mixture-of-models-claude-mod
mom login                         # سجّل الدخول إلى Palgu في المتصفح

# 2. Palgu بوصفه مزوّدًا والإضافة في opencode.json
mom setup opencode                # اطبع الكتلة
mom setup opencode --write        # ادمجها في opencode.json (ينسخ الملف القديم إلى opencode.json.bak أولًا)
```

يكتب `--write` إلى `$OPENCODE_CONFIG` إن كان مضبوطًا، وإلا إلى `~/.config/opencode/opencode.json` (أو المسار نفسه تحت `$XDG_CONFIG_HOME`). يغيّر مفتاحين، `provider.palgu` ومدخل الإضافة، ويضبط `model` على `palgu/auto` فقط عندما لا يكون لديك نموذج افتراضي. ويترك كل مفتاح آخر كما هو. إذا احتوى الملف على تعليقات (JSONC)، يطبع `mom` الكتلة وتدمجها أنت يدويًا. تأتي قائمة النماذج من Palgu (‏`GET /v1/models/health`) عندما تكون مسجّل الدخول، وإلا من القائمة المدمجة.

ما يكتبه (مختصرًا):

```json
{
  "model": "palgu/auto",
  "provider": {
    "palgu": {
      "npm": "@ai-sdk/anthropic",
      "name": "Palgu",
      "options": {
        "baseURL": "https://api.palgu.ai/anthropic/v1",
        "apiKey": "{env:PALGU_API_KEY}",
        "headers": { "x-srooter-client": "mixture-of-models-opencode/0.28.0" }
      },
      "models": { "auto": { "name": "Palgu router (auto)" }, "deepseek-pro": {}, "gemini-3.8-flash": {} }
    }
  },
  "plugin": ["/usr/local/lib/node_modules/mixture-of-models-claude-mod/integrations/opencode/plugin.js"]
}
```

المفتاح ليس في الملف. تضيف الإضافة مفتاح mom (من `mom login`، أو `PALGU_API_KEY`) إلى الطلبات المتجهة إلى `https://api.palgu.ai/`. وإذا كان `PALGU_API_KEY` مضبوطًا، يرسله OpenCode أيضًا بنفسه.

### طرق أخرى لتحميل الإضافة

| الشكل | مدخل `plugin` |
| :- | :- |
| ملف الحزمة المثبّتة (ما يكتبه `mom setup opencode`) | `"/…/node_modules/mixture-of-models-claude-mod/integrations/opencode/plugin.js"` |
| مجلد الحزمة (يقرأ OpenCode ‏`exports["./server"]`) | `"/…/node_modules/mixture-of-models-claude-mod"` |
| ملف محلي في `.opencode/plugin/` (مشروع واحد) أو `~/.config/opencode/plugin/` (كل المشاريع) | الملف `mom.js` الذي يحتوي `export { default } from '/…/integrations/opencode/plugin.js'` |
| من JavaScript | `import plugin from 'mixture-of-models-claude-mod/opencode'` |

توضع الخيارات في صف (tuple): ‏`["…/plugin.js", { "critical": "claude-opus" }]`.

| الخيار | الافتراضي | |
| :- | :- | :- |
| `critical` | لا شيء | نموذج Palgu للعمل الحرج: قواعد المود ("use claude …"، "execute the plan"، مطالبات الأمان والأحكام) أو درجة مصنِّف أعلى من 7 |
| `routes` | `{}` | `{ "simple": "…", "coding": "…", "critical": "…" }`: نموذج Palgu لكل مستوى. المستوى الذي لا نموذج له يذهب إلى `auto` |
| `ollama` | `true` | صنّف المطالبات عبر Ollama محلي (`localhost:11434`، 4 ثوانٍ). لا يُستخدم إلا عند ضبط مسار |
| `ollamaModel` | `qwen2.5-coder:3b` | |
| `provider` | `palgu` | معرّف المزوّد في `opencode.json` الذي توجّهه الإضافة |

## ما يفعله

| | كيف | ميزة OpenCode |
| :- | :- | :- |
| **التوجيه** | كل مطالبة مرسلة إلى `palgu/auto` تخرج بوصفها `auto`، ويختار Palgu المستوى (trivial، small، medium، think). ‏`/route <model>` يثبّت نموذجًا واحدًا لكل جلسة، و `/route auto` يزيل التثبيت. مع ضبط `critical` أو `routes`، تختار قواعد المود ومصنِّفه المستوى، ويُثبَّت نموذج ذلك المستوى. النموذج الذي تختاره بنفسك في OpenCode (‏`palgu/<model>` ليس `auto`) يُترك كما هو. يوضع النموذج على رسالة المستخدم، و `x-srooter-pin` على كل طلب. طلبات العنوان والملخص الخاصة بـ OpenCode نفسه لا تُثبَّت أبدًا. | `chat.message` (`output.message.model`)، `chat.headers` |
| **ذاكرة Palgu** | `mom memory on` أو `/palgu memory on` في مجلد مشروع يفهرس المجلد (يرفع شيفرته المصدرية إلى Palgu). بعد ذلك، تُستدعى منه حتى 8 مؤشرات لكل مطالبة من أربع كلمات أو أكثر وتُضاف إلى نص النظام لتلك الرسالة. الذاكرة معطّلة افتراضيًا. والموافقة لكل مجلد على حدة ومشتركة مع كل أداة يخدمها `mom`. | `chat.message` (`output.message.system`) |
| **النبض** | عندما تصبح جلسة خاملة بعد دور انتهى في منتصف المهمة ("Let me check the tests next." أي «دعني أتحقق من الاختبارات بعد ذلك.»)، ترسل الإضافة مطالبة الاستكمال، 3 مرات كحد أقصى لكل مطالبة منك. Palgu هو من يقرر (`POST /anthropic/heartbeat`). ومن دون تسجيل دخول يعمل المصنِّف نفسه محليًا. `/palgu heartbeat off` يعطّله. جلسات الوكلاء الفرعيين والأدوار الملغاة والأدوار الفاشلة لا تُستكمل أبدًا. | `event` `session.idle` → `client.session.promptAsync` |
| **الفهرسة** | في مجلد مفعَّلة فيه الذاكرة، يعمل `palgu memory index .` في الخلفية عند بدء جلسة، مرة كل 10 دقائق كحد أقصى. | `event` `session.created` |
| **الأوامر** | `/route [auto\|<model>\|<prefix>\|status]`، `/palgu memory on\|off\|status`، `/palgu heartbeat palgu\|local\|off`، `/palgu status`. تشغّل الإضافة الأمر بنفسها وتعرض النتيجة في إشعار منبثق (toast) في واجهة TUI. ثم يكرر النموذج ذلك السطر الواحد فقط، تحت `auto`، فيجيب أرخص مستوى في Palgu. | `config` (يسجّل `command.route` و `command.palgu`؛ والأمر الخاص بك الذي يحمل الاسم نفسه هو الغالب)، `command.execute.before`، `client.tui.showToast` |

كل خطاف (hook) يفشل مفتوحًا. إذا رمى شيء ما استثناءً أو كان Palgu بطيئًا، يتابع OpenCode وكأن الإضافة غير موجودة. ينتظر البحث في الذاكرة 3 ثوانٍ كحد أقصى، والنبض 8 ثوانٍ كحد أقصى. ‏`MOM_DEBUG=1` يكتب سطر JSON واحدًا لكل قرار وطلب إلى `~/.config/mixture-of-models/opencode.log`: معرّفات النماذج والتثبيتات والأحجام، ولا يكتب أبدًا المفتاح أو مطالبة أو نصًا مستدعى.

## ما يرسله وإلى أين

- **إلى `https://api.palgu.ai/anthropic/v1/messages`** (‏OpenCode نفسه، للمزوّد `palgu`): أدوارك في OpenCode. يحمل كل طلب `x-srooter-client: mixture-of-models-opencode/<version>` و `x-srooter-project: <folder name>`، و `x-srooter-pin: <model>` عندما يكون هناك نموذج مثبَّت، والمفتاح.
- **إلى `https://api.palgu.ai/v1/cortex/search`** (الإضافة، فقط في المجلدات المفعَّلة فيها الذاكرة): المطالبة، بوصفها سطرًا واحدًا من 300 حرف كحد أقصى، واسم المشروع في Palgu.
- **إلى `https://api.palgu.ai/anthropic/heartbeat`** (الإضافة، ما لم يُضبط النبض على `local` أو `off`): آخر 600 حرف من الإجابة ومعرّف جلسة.
- **إلى `http://localhost:11434`** (فقط عندما تضبط `routes` أو `critical` ويكون Ollama قيد التشغيل): المطالبة، للمصنِّف.
- **على القرص**: يبقى المفتاح في `~/.config/mixture-of-models/credentials.json` (الوضع 0600) أو `PALGU_API_KEY`. ويُحفظ التثبيت والموافقة على الذاكرة في `state.json` في المجلد نفسه.

## ما يختلف عن مود Claude Code

- يبقى التوجيه داخل مزوّد واحد، هو Palgu. يعمل الدور الموجَّه في جلسة OpenCode نفسها بسجلها الكامل وأدواتها؛ لا توجد عملية فرعية. نماذج Claude لا يمكن الوصول إليها إلا عبر Palgu.
- من دون `critical` أو `routes`، تختار مستويات Palgu نفسها النموذج، لا مصنِّف المود، ولا وجود للأمر `/route strategy`.
- يكلّف `/route` و `/palgu` ردًّا قصيرًا واحدًا من النموذج، لأن أمر OpenCode ينتهي دائمًا بمطالبة.
- يخرج `opencode run` بمجرد أن تصبح الجلسة خاملة، لذا لا تتاح للنبض فرصة الاستكمال هناك. يعمل في واجهة TUI وتحت `opencode serve`.

</div>
