# تثبيت Mixture of Models (تعليمات لوكيل برمجة)

[English](../../../INSTALL.md) · [简体中文](../zh-CN/INSTALL.md) · [日本語](../ja/INSTALL.md) · [Deutsch](../de/INSTALL.md) · [Français](../fr/INSTALL.md) · **العربية**

*هذه ترجمة؛ النسخة الإنجليزية هي المرجع المعتمد وقد تكون أحدث.*

<div dir="rtl">

أنت وكيل برمجة طُلب منه إعداد Mixture of Models. اتبع هذا الملف من أعلاه إلى أسفله. لكل خطوة أمر تشغّله وفحص يخبرك بأنها نجحت. نفّذ الخطوات للوكيل الذي طلبه المستخدم؛ وإن لم يحدده، فأعدّه لنفسك (الوكيل الذي يقرأ هذا).

ما يقدمه للمستخدم: يختار Palgu نموذجًا لكل طلب (نماذج أرخص للعمل البسيط)، وتُستدعى ذاكرة Palgu الخاصة بالمشروع إلى المطالبات، ويُستكمل الدور الذي يتوقف في منتصف المهمة. المستودع: https://github.com/alinaqi/mixture-of-models-claude-mod

## القواعد

- **لا تطبع مفتاح Palgu أبدًا، ولا تسجّله، ولا تودعه (commit).** تقيم المفاتيح في `~/.config/mixture-of-models/credentials.json` (يكتبه `mom login`) أو في متغير البيئة `PALGU_API_KEY`. الإعدادات التي تكتبها هذه الخطوات تشير إلى المفتاح؛ ولا تحتويه أبدًا.
- **تسجيل الدخول يحتاج إلى المستخدم.** يطبع `mom login` رابطًا ورمزًا وينتظر حتى 10 دقائق حتى يوافق المستخدم عليه في متصفح. اعرض الرابط على المستخدم، واطلب منه الموافقة، وانتظر. لا تحاول الموافقة عليه بنفسك.
- **ذاكرة Palgu ترفع الشيفرة المصدرية للمشروع إلى Palgu.** فعّلها (`mom memory on`) فقط عندما يوافق المستخدم، وفي المشروع الذي سمّاه.
- **لا تعدّل ملفات الإعداد الموجودة لدى المستخدم يدويًا** عندما يوجد أمر `mom setup <agent> --write`: فهو يدمج، ويحتفظ بالمدخلات الأخرى، ويأخذ نسخة احتياطية من الملف القديم أولًا.
- إذا فشل فحص ما، فاقرأ **استكشاف الأخطاء وإصلاحها** في النهاية قبل تجربة شيء آخر.

## الخطوة 1. المتطلبات المسبقة

```bash
node --version        # يجب أن يكون v20 أو أحدث
npm --version
```

الفحص: يطبع Node ‏`v20` أو أعلى. وإن لم يكن كذلك، فاطلب من المستخدم تثبيت Node 20+ وتوقف.

## الخطوة 2. ثبّت `mom` (لكل وكيل ما عدا Claude Code)

`mom` أداة CLI صغيرة بلا تبعيات. ملفات الإضافات لكل وكيل تُشحن في الحزمة نفسها.

```bash
npm install -g github:alinaqi/mixture-of-models-claude-mod
mom --help
```

الفحص: يطبع `mom --help` السطر `mom — Mixture of Models for Codex, Cursor, OpenCode and other coding agents`. إذا ظهر `mom: command not found`، فمجلد bin العام لـ npm ليس على `PATH`: شغّل `npm prefix -g` واستخدم `<that>/bin/mom`.

لـ Claude Code وحده، انتقل مباشرة إلى **Claude Code** أدناه: فهو لا يستخدم `mom`.

## الخطوة 3. سجّل الدخول إلى Palgu

```bash
mom login
```

يطبع `Open https://www.palgu.ai/connect?code=XXXX-XXXX and approve code XXXX-XXXX` (افتح الرابط ووافق على الرمز). اعرض ذلك السطر على المستخدم وانتظر `Signed in to Palgu as ...`. يستطيع المستخدمون الجدد إنشاء حساب من الصفحة نفسها.

إذا كان لدى المستخدم مفتاح Palgu مسبقًا، فيمكنه تنفيذ `export PALGU_API_KEY=...` في طرفيته بدلًا من ذلك؛ لا تطلب منه لصقه في المحادثة.

الفحص:

```bash
mom status
```

يبدأ السطر الأول بـ `Palgu: signed in`.

## الخطوة 4. أعدّ الوكيل

### Claude Code

يتطلب Claude Code 2.1.287 أو أحدث (`claude --version`).

```bash
claude plugin marketplace add alinaqi/mixture-of-models-claude-mod
claude plugin install mixture-of-models@mixture-of-models-claude-mod
```

ثم يعيد المستخدم تشغيل Claude Code ويشغّل `/palgu login` داخله (تدفق الرابط والموافقة نفسه كما في الخطوة 3).

الفحص: يعرض `claude plugin list` القيمة `mixture-of-models@mixture-of-models-claude-mod`؛ وبعد إعادة التشغيل، يعرض `/route` حالة التوجيه ويقول `/palgu status` ‏`Palgu: signed in`.

### Codex (CLI 0.163 أو أحدث)

```bash
mom setup codex --write                                        # يكتب ~/.codex/palgu.config.toml؛ لا يُمس config.toml
codex plugin marketplace add alinaqi/mixture-of-models-claude-mod
codex plugin add mixture-of-models@mixture-of-models
```

يبدأ المستخدم Codex على Palgu بالأمر `codex -p palgu`. عند أول تشغيل يطلب Codex مراجعة خطافات الإضافة (`/hooks`)؛ وهي تشغّل `mom hook codex` ولا شيء غيره. لتثبيت نموذج واحد: `MOM_PIN=<model> codex -p palgu -m <model>` (النموذج نفسه مرتين).

الفحص: يعرض `codex plugin list` القيمة `mixture-of-models`، والملف `~/.codex/palgu.config.toml` موجود ويحتوي `model_provider = "palgu"`.

الدليل: [integrations/codex](integrations/codex/README.md)

### Cursor

شغّل في مجلد المشروع الذي يريده المستخدم:

```bash
mom setup cursor --write                                       # يدمج في .cursor/hooks.json و .cursor/mcp.json (ويأخذ نسخة احتياطية منهما)
mkdir -p .cursor/rules && cp "$(npm root -g)/mixture-of-models-claude-mod/integrations/cursor/rules/mixture-of-models.mdc" .cursor/rules/
```

يعيد المستخدم تحميل نافذة Cursor ‏(**Developer: Reload Window**). ولتثبيته لكل المشاريع بدلًا من ذلك، يضيف المستخدم السوق (marketplace) في Cursor: ‏**Dashboard → Plugins & MCPs → Add Marketplace → Import from Repo** مع `https://github.com/alinaqi/mixture-of-models-claude-mod`، ثم يثبّت **Mixture of Models**.

الفحص: يحتوي `.cursor/hooks.json` على مدخلات تشغّل `mom hook cursor`، ويحتوي `.cursor/mcp.json` على خادم يشغّل `mom mcp cursor`. في Cursor، تعرض إعدادات MCP الخادم مع ثلاث أدوات (`palgu_memory_search`، `palgu_delegate`، `palgu_models`).

الدليل: [integrations/cursor](integrations/cursor/README.md)

### OpenCode (1.19 أو أحدث)

```bash
mom setup opencode --write                                     # يدمج Palgu والإضافة في opencode.json (ويأخذ نسخة احتياطية منه)
```

يكتب إلى `$OPENCODE_CONFIG` إن كان مضبوطًا، وإلا إلى `~/.config/opencode/opencode.json`. إذا احتوى الملف على تعليقات، يطبع الكتلة بدلًا من ذلك: ادمجها يدويًا، مع الإبقاء على كل مفتاح آخر.

الفحص: يحتوي الملف الآن على `provider.palgu`، ومدخل `plugin` ينتهي بـ `integrations/opencode/plugin.js`، و (إن لم يكن هناك نموذج افتراضي) `"model": "palgu/auto"`. في OpenCode، يجيب `/route status`.

الدليل: [integrations/opencode](integrations/opencode/README.md)

### Antigravity (‏`agy` 1.0.7 أو أحدث)

```bash
agy plugin install "$(npm root -g)/mixture-of-models-claude-mod/integrations/antigravity"
```

الفحص: يعرض `agy plugin list` الإضافة `mixture-of-models` مفعّلة. ولا يبلّغ `agy plugin validate "$(npm root -g)/mixture-of-models-claude-mod/integrations/antigravity"` عن أي أخطاء.

إذا فشل `agy` مع `PERMISSION_DENIED on resource project <id>`، فذلك إعداد Google Cloud الخاص بـ Antigravity نفسه، لا هذه الإضافة: راجع [integrations/antigravity](integrations/antigravity/README.md).

### GitHub Copilot CLI (1.0.112 أو أحدث)

```bash
copilot plugin install alinaqi/mixture-of-models-claude-mod:integrations/copilot
```

يجب أن يكون المستخدم مسجّل الدخول إلى Copilot (`/login` داخل `copilot`). إذا كان `GITHUB_TOKEN` مضبوطًا على توكن كلاسيكي، يرفضه Copilot: شغّله بالأمر `env -u GITHUB_TOKEN -u GH_TOKEN copilot`.

الفحص: يعرض `copilot plugin list` القيمة `mixture-of-models`. وفي جلسة، يؤدي طلب استدعاء `palgu_models` من الوكيل إلى عرض نماذج Palgu.

الدليل: [integrations/copilot](integrations/copilot/README.md)

### Aider و Continue و Goose

لا تملك هذه خطافات (hooks)، لذا لا ينطبق إلا توجيه Palgu (لا ذاكرة، ولا نبض). اتبع [integrations/gateway](integrations/gateway/README.md): وجّه الوكيل إلى `https://api.palgu.ai/v1` مع النموذج `auto` والمفتاح من `mom token`.

الفحص: تحصل مطالبة واحدة على إجابة؛ وتعرض لوحة تحكم Palgu الطلب.

### غير مدعوم بعد

- **Gemini CLI**: يحتاج إلى نقطة نهاية Palgu بصيغة Gemini (غير متاحة بعد).
- **Windsurf**: لا توجد طريقة لتوجيهه إلى نقطة نهاية نماذج أخرى.

## الخطوة 5 (اختيارية، اسأل أولًا). ذاكرة Palgu

فقط إذا وافق المستخدم على رفع الشيفرة المصدرية للمشروع إلى Palgu. في مجلد المشروع:

```bash
mom memory on        # مستخدمو Claude Code: نفّذوا /palgu memory on داخل Claude Code بدلًا من ذلك
mom memory status
```

الفحص: يقول `mom memory status` ‏`Palgu memory: on`؛ وبعد انتهاء الفهرسة (بضع دقائق في مستودع كبير) يقول `indexed, N symbols`. تحتاج الفهرسة إلى أداة `palgu` CLI ‏(https://www.palgu.ai/install)؛ ومن دونها، تقول الحالة ذلك.

الموافقة لكل مجلد على حدة ومشتركة بين كل وكيل يستخدم `mom`. ويوقفها `mom memory off`.

## الخطوة 6. أخبر المستخدم بما تغيّر

أبلغ: أي وكيل أُعدّ، والملفات المكتوبة (ونسخها الاحتياطية `.bak`)، وما إذا كانت الذاكرة مفعّلة، وكيف يبدأ (`codex -p palgu`، إعادة تحميل Cursor، إعادة تشغيل Claude Code، وهكذا). أوامر مفيدة لهم: `mom status`، `mom memory on|off|status`، `mom heartbeat palgu|local|off`. ووجّههم إلى [GUIDELINES.md](GUIDELINES.md) لمعرفة كيفية العمل معه في وكيلهم.

## استكشاف الأخطاء وإصلاحها

| العَرَض | السبب | الحل |
| :- | :- | :- |
| `mom: command not found` | مجلد bin العام لـ npm ليس على `PATH` | استخدم `$(npm prefix -g)/bin/mom`، أو أضف ذلك المجلد إلى `PATH` |
| خطاف أو خادم MCP لا يجد `mom` (تطبيق شُغّل من الـ Dock) | تطبيقات الواجهة الرسومية لا ترى `PATH` الخاص بالطرفية | ضع المسار الكامل من `which mom` في أوامر الخطافات وإعداد MCP |
| يقول `mom status` ‏`not signed in` | لم يكتمل `mom login`، أو `PALGU_API_KEY` غير مُصدَّر في هذه الطرفية | شغّل `mom login` مجددًا وانتظر الموافقة |
| يجيب Palgu بـ 403 `pin 'auto' not allowed by policy` | أُرسل تثبيت نموذج مع النموذج `auto` | ثبّت مع تسمية النموذج أيضًا: `MOM_PIN=<m> codex -p palgu -m <m>` |
| يجيب Palgu بـ 503 لنموذج مثبَّت | ذلك النموذج متوقف | اختر غيره (أداة `palgu_models`، أو `GET https://api.palgu.ai/v1/models/health`) |
| خطافات Codex لا تعمل في `codex exec` | الخطافات غير موثوقة بعد | شغّل `codex -p palgu` مرة واحدة تفاعليًا ووافق عليها في `/hooks` |
| `mom memory status`: ‏`could not read the index status` | أداة `palgu` CLI مفقودة أو غير مسجّلة الدخول | ثبّتها من https://www.palgu.ai/install؛ وهي تستخدم مفتاح `mom` حين لا يكون لديها مفتاح خاص بها |

</div>
