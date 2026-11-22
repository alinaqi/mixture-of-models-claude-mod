# mixture-of-models-claude-mod

[English](../../../README.md) · [简体中文](../zh-CN/README.md) · [日本語](../ja/README.md) · [Deutsch](../de/README.md) · [Français](../fr/README.md) · **العربية**

*هذه ترجمة؛ النسخة الإنجليزية هي المرجع المعتمد وقد تكون أحدث.*

<div dir="rtl">

[![ci][ci-badge]][ci] [![License: MIT][mit-badge]](../../../LICENSE) [![Changelog][log-badge]](../../../CHANGELOG.md)

[ci]: https://github.com/alinaqi/mixture-of-models-claude-mod/actions/workflows/ci.yml
[ci-badge]: https://github.com/alinaqi/mixture-of-models-claude-mod/actions/workflows/ci.yml/badge.svg
[mit-badge]: https://img.shields.io/badge/License-MIT-green.svg
[log-badge]: https://img.shields.io/badge/changelog-keep%20a%20changelog-blue

> **تعدّه بمساعدة وكيل برمجة؟** وجّهه إلى [INSTALL.md](INSTALL.md): ‏"Follow INSTALL.md in alinaqi/mixture-of-models-claude-mod to set up Mixture of Models for me." (اتبع INSTALL.md في alinaqi/mixture-of-models-claude-mod لإعداد Mixture of Models لي.) يحتوي على كل أمر، وفحص لكل خطوة، وما يجب أن يسألك عنه. يعمل مع Claude Code و Codex و Cursor و OpenCode و Antigravity و GitHub Copilot CLI و Aider و Continue و Goose.
>
> **ثبّته بالفعل؟** يحتوي [GUIDELINES.md](GUIDELINES.md) على أفضل الممارسات لكل وكيل: دع النظام يختار النماذج، وكيف تصوغ المطالبات كي يعمل التوجيه والذاكرة، وما الذي تفوّضه، وماذا تفعل حين يبدو مسار ما خاطئًا.

احتفظ باشتراك Claude للأدوار التي تحتاجه. وسلّم الباقي إلى نموذج أرخص. هذا **مود** (mod) لـ Claude Code (إضافة تعمل داخل العملية نفسها، جديدة في Claude Code 2.1.287) يمنح كل مطالبة درجة وفق نطاق الضرر (blast radius) ويجيب عن الأدوار منخفضة الدرجة عبر نسخة منفصلة من Claude Code بلا واجهة (headless) على بوابة متوافقة مع Anthropic ‏(GLM أو Kimi أو DeepSeek، أو أيًّا كان ما تخدمه بوابتك). جلستك الرئيسية لا يُعاد تسميتها أو توجيهها أو المساس بها أبدًا. منقول من منطق التوجيه في [Maggy](https://github.com/alinaqi/maggy).

يمكن للمسارات أيضًا أن تسمّي **عائلة نماذج**: ‏`claude/sonnet` يشغّل ذلك العضو من Claude عبر تسجيل دخولك أنت إلى Claude، و `kimi/auto` يدع الدرجة تختار عضوًا من Kimi، و `codex` يسلّم الدور إلى Codex CLI ‏(`codex exec`) على Palgu أو عبر تسجيل دخولك إلى ChatGPT. راجع [العائلات](#العائلات-اختر-عضوا-أو-دع-المستوى-يختار) و [Codex](#codex-كعملية-فرعية).

## احصل على نماذج Palgu بأمر واحد

لا لوحة تحكم، ولا نسخ مفاتيح. بعد [تثبيت المود](#التثبيت)، في Claude Code:

```
/palgu login
```

1. يعرض المود رابط تسجيل دخول ورمزًا قصيرًا، مثل `WDJB-MJHT`.
2. افتح الرابط، وسجّل الدخول إلى Palgu أو **أنشئ حسابًا** (تبدأ الحسابات الجديدة على الخطة المجانية)، وتحقق من تطابق الرمز واضغط **Allow**. تسمّي الصفحة التطبيق: *Allow Mixture of Models on "Claude Code on your-mac"?* (هل تسمح لـ Mixture of Models على "Claude Code on your-mac"؟)
3. بالعودة إلى الطرفية يقول إشعار منبثق *Signed in to Palgu as you@example.com* (تم تسجيل الدخول إلى Palgu باسم you@example.com). هذا كل شيء: الأدوار البسيطة وأدوار البرمجة تعمل الآن على نماذج Palgu ‏(GLM 5.3، Kimi K3.1، DeepSeek V4 Pro، Gemini 3.8 Flash، MiniMax M3، GPT-6)، والأدوار الحرجة تبقى على Claude. بلا إعادة تشغيل.

| الأمر | ما يفعله |
| :- | :- |
| `/palgu login` | أنشئ حسابًا أو سجّل الدخول، واربط هذا الحاسوب |
| `/palgu status` | من المسجّل دخوله، والمؤسسة وخطتها، وما أنفقته من ميزانيتها في Palgu خلال هذه الفترة |
| `/palgu upgrade` | الخطط والفوترة (تُشترى الخطط المدفوعة عبر الويب؛ ويلتقط مفتاحك الخطة الجديدة تلقائيًا) |

كيف يعمل: تسجيل الدخول بالجهاز في Palgu (نفسه الذي يستخدمه `srooterctl`) يصدر مفتاح API لهذا الحاسوب وحده. يمكنك رؤيته وإبطاله في صفحة **Devices** في Palgu. يحفظه المود في التخزين الآمن لـ Claude Code عبر `claude plugin configure --values-stdin`، فلا يظهر أبدًا في سطر أوامر ولا في ملف إعدادات. لديك مفتاح مسبقًا، أو تستخدم بوابة أخرى؟ راجع [الإعداد](#الإعداد).

ولكي نكون دقيقين بشأن ماهيته: إنه **تفويض على مستوى الدور**، لا مزج للنماذج لكل طلب. يعمل الدور الموجَّه في عملية فرعية (child) مع موجز قصير لسياقك الأخير؛ وتصل إجابة العملية الفرعية إلى سجل محادثتك، موسومة. والأدوار الحرجة تبقى على Claude تمامًا كما كانت.

## التثبيت

تحتاج المودات إلى **Claude Code 2.1.287 أو أحدث**. الـ cask المستقر في Homebrew ما زال 2.1.286، لذا تحقق أولًا:

```bash
claude --version
# قديم جدًا؟ أحد هذه الخيارات:
brew uninstall --cask claude-code && brew install --cask claude-code@latest   # Homebrew
npm install -g @anthropic-ai/claude-code@<version>                            # npm: إصدار من 2.1.287 فما فوق
claude update                                                                 # المثبّت الأصلي
```

ثم:

```bash
claude plugin marketplace add alinaqi/mixture-of-models-claude-mod
claude plugin install mixture-of-models@mixture-of-models-claude-mod
```

أو، داخل جلسة، `/plugin install mixture-of-models --marketplace alinaqi/mixture-of-models-claude-mod`.

> **خطافاتك لا تعمل داخل العملية الفرعية للبوابة.** تشغّل العملية الفرعية `claude -p --bare`، و `--bare` يتخطى كل خطاف (hook) من إعداداتك وإضافاتك، لذا فإن الخطاف الذي يحجب `.env` لا يحميه هناك، وما تقرؤه العملية الفرعية يذهب إلى نموذج البوابة. لا يعتمد المود على الخطافات لهذا: كل عملية Claude فرعية تحصل على قواعد منع الأذونات (deny rules) في Claude Code، التي يحتفظ بها `--bare`، لملفات `.env` و `.env.*` و `*.pem` و `*.key` و `id_rsa*` و `id_ed25519*` ومجلدات `secrets/` (قواعد Read تغطي أيضًا Grep و Glob). أضف قواعدك الخاصة عبر `router.child.deny`، مثلًا `["Read(**/credentials.json)"]`. الأوامر غير المسموح للعملية الفرعية بتشغيلها تصلك مع ذلك كحوار Allow / Deny. العملية الفرعية لـ Codex للقراءة فقط لكنها غير مشمولة بهذه القواعد: أبقِ الأسرار خارج أي مشروع توجّهه إلى Codex.

**التحديثات.** عند بدء الجلسة يتحقق المود من GitHub من وجود إصدار أحدث (مرة كل 12 ساعة على الأكثر)، وإن وُجد، ينبّهك إليه مرة واحدة في إشعار toast وعلى الشريط: `0.33.0 available: /route update`. شغّل `/route update`: يثبّت الإصدار الجديد، ثم يعرض الشريط `0.33.0 installed: /reload-plugins`. أسواق الطرف الثالث لا تتحدث تلقائيًا افتراضيًا. فعّل ذلك مرة واحدة في `/plugin` → Marketplaces → `mixture-of-models-claude-mod` → Enable auto-update، أو حدّث يدويًا عبر `claude plugin marketplace update mixture-of-models-claude-mod && claude plugin update mixture-of-models@mixture-of-models-claude-mod`. يسري الإصدار الجديد بعد `/reload-plugins` (أو إعادة التشغيل).

**أسرع بداية، على Palgu:** شغّل `claude` ونفّذ `/palgu login`. يعرض رابطًا ورمزًا؛ وافق عليه في المتصفح (أنشئ حسابًا هناك إن كنت جديدًا) فيحفظ المود مفتاح Palgu الخاص به ويبدأ التوجيه من تلك اللحظة، بلا نسخ مفاتيح. يقول `/palgu status` من المسجّل دخوله، وعلى أي خطة وكم أُنفق من الميزانية، ويفتح `/palgu upgrade` الخطط والفوترة.

أو امنح العملية الفرعية بوابة بنفسك: [OpenRouter](#openrouter)، أو وكيل [LiteLLM](#litellm)، أو أي نقطة نهاية متوافقة مع Anthropic تخدم معرّفات نماذجك (جرى الاختبار مع [palgu](https://www.palgu.ai)؛ ونقاط نهاية Anthropic من z.ai أو Moonshot تعمل بالطريقة نفسها)، راجع [الإعداد](#الإعداد). شغّل `claude`، ونفّذ `/route`. إلى أن تُضبط بوابة يكون المود في وضع المراقبة فقط ولا يغيّر شيئًا.

**قاعدة التصميم: لا يُمس الجلسة الرئيسية أبدًا.** تبقى على اشتراكك في claude.ai بلا `ANTHROPIC_BASE_URL`. حين تُوجَّه مطالبة إلى GLM أو Kimi، يجيب المود عن ذلك الدور بنفسه بتشغيل **عملية `claude -p` فرعية منفصلة بلا واجهة** تشير بيئتها وحدها إلى البوابة (palgu). تصبح مخرجات العملية الفرعية إجابة الدور في سجل محادثتك. لا يتغير شيء في العملية الرئيسية ولا في نموذجها ولا مصادقتها ولا طلباتها.

لكل مطالبة، يقوم المود بما يلي:

1. **يمنحها درجة** على محورين باستدعاء مصنِّف واحد: نطاق ضرر من 1 إلى 10 ونوع مهمة (`code | research | review | docs | data | multimodal`). تقرر الدرجة ما إذا كان Claude إلزاميًا؛ ويختار النوع أي نموذج أرخص يتولى الباقي. يقوم بذلك نموذج Ollama محلي مجانًا، و `claude-haiku-5-5` ضمن خطتك هو البديل، ثم آخر حكم رُصد. راجع [كيف يقرر](#كيف-يقرر).
2. **يطبّق قواعد Maggy السابقة للتوجيه أولًا**: ‏`use claude` أو `execute the plan` تفرضان `critical`؛ والمتابعات بعد دور أجابت عنه عملية فرعية تعود إلى الجلسة الرئيسية؛ و `go ahead` أو `yes` أو مطالبة من ست كلمات أو أقل بينما الجلسة الرئيسية في منتصف مهمة تبقيها هناك؛ والعمل بمستوى البرمجة يبقى في جلسة رئيسية في منتصف مهمة.
3. **يفوّض** الدور الموجَّه إلى العملية الفرعية: ‏`claude -p --model glm-5.3` على البوابة، مع تغذيتها عبر stdin بموجز يحتوي آخر بضعة تبادلات من جلستك إضافة إلى المهمة.
4. **يرجع** إلى النموذج الرئيسي لذلك الدور إذا فشلت العملية الفرعية، أو لم تطبع شيئًا، أو فشلت إجابتها في الفحص (راجع [ما لا يجوز للعملية الفرعية فعله](#ما-لا-يجوز-للعملية-الفرعية-فعله))، ويذكر ذلك في سجل المحادثة.
5. **يريك ما عمل وأين**، في كل دور. راجع [ما تراه](#ما-تراه).

أدوار `critical` لا تبدأ أبدًا عملية فرعية. تعمل في الجلسة الرئيسية، على الاشتراك، تمامًا كما لو لم يكن المود موجودًا.

## كيف يقرر

يُسأل المصنِّف سؤالًا واحدًا: ما مقدار الضرر الذي تُحدثه إجابة خاطئة؟ يجيب برقم، ومعيار التقييم صريح:

| الدرجة | المعنى | المستوى (العتبات الافتراضية) |
| :- | :- | :- |
| 1-2 | عمليات بحث، grep، أوامر طرفية من سطر واحد، أسئلة صياغة، قراءة السجلات، git status أو diff | `simple` |
| 3-4 | تعديلات ملف واحد، اختبارات، مستندات، تغييرات إعدادات، إصلاحات أخطاء صغيرة، إنشاء هياكل أولية | 3 `simple`، 4 `coding` |
| 5-6 | ميزات متعددة الملفات، ربط الخدمات أو الأدوات معًا، تكاملات، عمليات نشر تتبع نمطًا معروفًا | `coding` |
| 7-8 | تصحيح أخطاء عبر خدمات متعددة، ترحيل بيانات، عمل على الأداء، تغييرات يصعب التراجع عنها | 7 `coding`، 8 `critical` |
| 9-10 | تصميم الأمان أو المصادقة، قرارات معمارية، حوادث بيئة الإنتاج، أي شيء لا رجعة فيه | `critical` |

تخبر المطالبة المصنِّف بأن الطول، أو عدد الخدمات المذكورة، أو مفاتيح API الملصوقة لا ترفع الدرجة بحد ذاتها، وهو ما كان يدفع عمل التكامل العادي إلى الجلسة الرئيسية. وتقول أيضًا إن التفكير العميق (خوارزميات مع براهين، التزامن، ضبط الأداء، التشفير) يحصل على 7 على الأقل أيًّا كان نطاق الضرر، كي يبقى العمل الصعب الآمن على Claude. حرّك نقاط القطع عبر `router.thresholds`؛ فمثلًا `{ "simple": 3, "coding": 8 }` يبقي كل شيء عدا 9-10 بعيدًا عن Claude.

**النوع يختار النموذج.** دون `critical`، يربط `routes.kinds` نوع المهمة بنموذج: افتراضيًا يذهب `research` و `review` إلى DeepSeek V4 Pro ‏(`deepseek-pro` على Palgu، سياق بمليون توكن)، ويبقى `multimodal` على Claude، وكل ما عدا ذلك يأخذ نموذج المستوى (GLM). حتى 0.20.0 كانت تذهب إلى Kimi، الذي لا يجيب عنه Palgu اليوم (استجابة فارغة بعد نحو دقيقتين). أضف `"docs": "gpt-6-sol"` أو `"data": "..."` إلى المصفوفة بحسب ما تسمح به بوابتك.

**النماذج التي يمكنك تسميتها.** أي معرّف نموذج تخدمه بوابتك يعمل في `routes` أو `routes.kinds` أو في تثبيت. يعرف المود نماذج بوابة Palgu التالية، لذا يتوسع `/route <prefix>` إليها حتى حين لا يسمّيها أي مسار: `glm-5.3` و `kimi-k3.1-pro` و `kimi-k3.1-pro-highspeed` و `deepseek-v4-pro` و `gemini-3.8-flash` و `minimax-m3` و `minimax-m2.5` و `gpt-6-sol` و `gpt-6-luna` و `gpt-6-astra` و `mercury-3`. يحتوي الشريط فوق المطالبة على زر لكل من هذه العائلات. ‏`kimi-k3.1-pro` يحل محل `kimi-k3`؛ وتثبيت `/route kimi-k3` القديم يتوسع إليه. ‏Gemini و MiniMax و GPT-6 خيارات، لا افتراضيات: ‏`/route minimax` أو `/route gpt` (‏GPT-6 Sol) أو `/route gpt/auto` (‏Luna للأدوار البسيطة، و Sol للبرمجة، و Astra للحرجة) يثبّتها. و Mercury 3 من Inception للتثبيت فقط أيضًا: `/route mercury` (‏`mercury-3` على Palgu، و `mercury/3` على OpenRouter).

**أي نماذج Palgu تعمل.** جرى الاختبار في 2026-10-29 بالطريقة التي يشغّل بها المود الدور (عملية `claude -p --bare` فرعية مثبَّتة تنفذ مهمة بحث قصيرة مع استدعاءات أدوات): ‏`glm-5.3` و `deepseek-pro` و `gemini-3.8-flash` و `minimax-m3` و `gpt-6-sol` و `gpt-6-luna` و `gpt-6-astra` و `kimi-k3.1-pro` و `kimi-k3.1-pro-highspeed` و `mercury-3` تنجح في 19 إلى 46 ثانية؛ أما `minimax-m2.5` فظل يعيد محاولة الأوامر المرفوضة حتى نفدت أدواره. إخفاقات Kimi السابقة كانت بسبب ضغط زائد على Moonshot ‏(`429 engine_overloaded`): أعاد Claude Code محاولة كل طلب عشر مرات، فكان الدور يستغرق نحو دقيقتين إلى ثلاث دقائق ليفشل. صارت العملية الفرعية الآن تعيد المحاولة مرتين كحد أقصى (`router.child.maxRetries`، الافتراضي 2)، لذا يرجع المزوّد المشغول إلى البديل في ثوانٍ. يبقى البحث والمراجعة على DeepSeek افتراضيًا؛ و Kimi للتثبيت. ترسل العملية الفرعية دائمًا `x-srooter-pin: <model>` إلى Palgu: من دونها يوجّه Palgu وفق النية وقد يجيب بنموذج آخر (فقد خدم كل نموذج غير مثبَّت بوصفه Gemini).

**عندما تفشل العملية الفرعية.** لا يتولى النموذج الرئيسي الدور الموجَّه إلا بعد فشل كل نموذج مكافئ. على Palgu ترسل العملية الفرعية `x-palgu-fallback: auto`، فتمرّ البوابة أولًا عند الضغط الزائد على سلسلة البدائل الخاصة بالنموذج المثبَّت (قائمة بدائله، ثم فئته). وإن ظلت العملية الفرعية تفشل بسبب ضغط زائد (429، 5xx، انتهاء المهلة، لا إجابة)، يعيد المود تشغيل الدور على النموذج المكافئ التالي: نماذج الفئة نفسها أولًا (من قائمة Palgu الحية)، ثم النماذج السليمة الأخرى، حتى `router.child.fallbacks` (الافتراضي 3). الموجّه الأطول من نافذة النموذج ينتقل فقط إلى نموذج بنافذة سياق أكبر (`router.child.longContext`)؛ أما الطلب الخاطئ (400، 401، 403، 404، 422) فلا يُعاد على نماذج أخرى. يقول سطر التوجيه ما حدث: `child: deepseek-pro failed (429) → served by glm-5.3`، أو `all equivalents failed: deepseek-pro (429), glm-5.3 (529), …; main model answered`. وإذا خدمت سلسلة Palgu نفسها نموذجًا آخر، يقول السطر `child: kimi-k3.1-pro → served by deepseek-pro (gateway fallback)`، ويُحتسب الدور ويُسعَّر بوصفه ذلك النموذج.

### استراتيجيات التوجيه: وجه حسب التعقيد أو التكلفة أو السرعة أو الجودة أو قواعدك الخاصة

ما يقيّمه المصنِّف، وأين تنقسم المستويات، وأي نموذج يأخذه كل مستوى، هو **استراتيجية توجيه**: ملف markdown واحد مع معيار تقييم، مثل المهارة (skill). أربع منها مدمجة:

| الاستراتيجية | ما تقيّمه | المستويات (simple / coding) | تذهب إلى |
| :- | :- | :- | :- |
| `complexity` (الافتراضية) | نطاق الضرر، كما سبق | 3 / 7 | مساراتك: GLM، و DeepSeek للبحث والمراجعة، و Claude للحرج |
| `cost` | خطر أن يخطئ نموذج أرخص؛ وعند الشك، أدنى | 4 / 8 | GLM، و DeepSeek V4 Pro للبرمجة والبحث والمراجعة، و Gemini للصور، و Claude للحرج |
| `speed` | عمق التفكير | 3 / 7 | Gemini 3.8 Flash، و GPT-6 Sol للبرمجة، و Sonnet بدلًا من Opus للحرج |
| `quality` | حجم المخاطرة؛ وعند الشك، أعلى | 2 / 5 | GLM لعمليات البحث فقط، و Sonnet للبرمجة، و Claude للحرج |

يعرض `/route strategies` الاستراتيجيات المدمجة واستراتيجياتك، ويبدّل `/route strategy cost` إليها (يُحفظ عبر الجلسات؛ و `router.strategy` في `model-config.json` يضبط الافتراضي)، ثم يقرأ الشريط `auto (cost)`.

**استراتيجيتك الخاصة.** ضع ملفًا في `~/.claude/mixture-of-models/strategies/<name>.md`، أو اطلب من Claude استخدام مهارة الإضافة **routing-strategy**، التي تسألك عما تريد تحسينه وتكتبه:

```markdown
---
name: frugal
description: Everything but production work goes to cheap models.
score: risk
thresholds: {"simple": 5, "coding": 8}
routes: {"simple": "glm/5.3", "coding": "deepseek/v4-pro", "critical": "claude", "kinds": {"review": "kimi/pro"}}
---
Risk: how bad a wrong answer from a cheaper model would be. When unsure, score lower.
1-5: lookups, docs, tests, single-file edits, small fixes.
6-8: multi-file features, integrations, refactors that tests cover.
9-10: security, production, data migrations, anything irreversible.
```

(المثال أعلاه استراتيجية باسم `frugal`: كل شيء عدا عمل بيئة الإنتاج يذهب إلى نماذج رخيصة؛ والمعيار يقيّم الخطر، أي مدى سوء إجابة خاطئة من نموذج أرخص.)

`thresholds` و `routes` بصيغة JSON في سطر واحد واختياريان (إذا أُهملا تُطبَّق إعداداتك)؛ وجسم الملف هو معيار التقييم الذي يقرؤه المصنِّف. يبقى تنسيق الرد "<score> <kind>"، لذا تعمل المستويات والعائلات وذاكرة الإخفاقات والتوفير بالطريقة نفسها. قواعد الأمان المذكورة أعلاه تعمل أولًا تحت كل استراتيجية: العمل الأمني والإشعارات وأوامر الجلسة تبقى على Claude. الملف الذي لا يمكن تحليله يُتخطى ويُذكر اسمه في السجل؛ و `/route strategy <name>` يعيد قراءة المجلد، فيُلتقط الملف الجديد دون إعادة تشغيل.

### العائلات: اختر عضوا أو دع المستوى يختار

أي مسار، أو مسار نوع، أو تثبيت يمكن أن يكون `<family>/<member>` أو `<family>/auto` بدلًا من معرّف نموذج. تظل `claude` المجردة تعني "الجلسة الرئيسية"، تمامًا كما كانت، لذا تتصرف الإعدادات القديمة بالطريقة نفسها.

| العائلة | الأعضاء (الاسم المستعار = المعرّف الدقيق) | `auto` حسب المستوى (الافتراضي) | تعمل على |
| :- | :- | :- | :- |
| `claude` | `fable` = `claude-fable-5-1`، `opus` = `claude-opus-5-5`، `sonnet` = `claude-sonnet-5-5`، `haiku` = `claude-haiku-5-5` | simple → `haiku`، coding → `sonnet`، critical → `opus`؛ و `fable` فقط إذا أضفت `"criticalPlus": "fable"` (أدوار حرجة بدرجة 10/10) | عملية `claude -p --model <id>` فرعية بلا واجهة عبر **تسجيل دخولك أنت إلى Claude** (بلا بوابة)؛ والعضو الذي *هو* نموذج الجلسة يبقى في الجلسة الرئيسية |
| `kimi` | `pro` = `kimi-k3.1-pro`، `highspeed` = `kimi-k3.1-pro-highspeed` | simple → `highspeed`، coding و critical → `pro` | العملية الفرعية للبوابة |
| `glm`، `deepseek`، `gemini`، `minimax` | من فهرس البوابة: `glm/5.3` = `glm-5.3`، `deepseek/v4-pro` = `deepseek-v4-pro`، `gemini/3.8-flash`، `minimax/m3` = `minimax-m3`، `minimax/m2.5` | العضو الأول | العملية الفرعية للبوابة |
| `gpt` | `sol` = `gpt-6-sol`، `luna` = `gpt-6-luna`، `astra` = `gpt-6-astra` | simple → `luna`، coding → `sol`، critical → `astra` | العملية الفرعية للبوابة |
| `codex` | لا أعضاء افتراضيًا: `codex/<any model id>` يمرّر المعرّف إلى Codex | لا شيء افتراضيًا: النموذج الافتراضي الخاص بـ Codex | عملية `codex exec` فرعية، راجع [Codex](#codex-كعملية-فرعية) |

يستخدم `auto` المصنِّف نفسه والعتبات والعينة الثانية للحالات الحدّية وذاكرة الإخفاقات كما في المستويات، ثم يبحث عن المستوى في خريطة `auto` الخاصة بالعائلة. ولا يغادر العائلة أبدًا. مستوى من عائلة Claude ‏(`"critical": "claude/opus"`) هو Claude إلزامي تمامًا مثل `"claude"`: لا يتجاوزه `routes.kinds`. تجاوز الأعضاء أو خريطة المستويات لكل عائلة في `router.families`؛ وتثبيت `/route claude/auto` يظل يصنّف كل مطالبة ويختار العضو من الدرجة.

لماذا عملية فرعية لعضو من Claude، لا `/model` الخاص بالجلسة: الجلسة الرئيسية لا يُعاد تسميتها أو توجيهها أبدًا ([ADR 0001](../../adr/0001-child-process-delegation.md))، لذا فالعضو الذي ليس نموذج الجلسة يعمل في نسخة Claude Code منفصلة بلا واجهة تُشغَّل بالعلَم `--model <id>` الخاص بـ Claude Code نفسه. تعمل تلك العملية الفرعية بلا `--bare` (الذي سيفرض المصادقة بمفتاح API)، لذا تستخدم تسجيل دخولك إلى claude.ai وتحمّل خطافاتك وإضافاتك؛ ويبقى المود غير نشط داخلها عبر `MAGGY_ROUTER_CHILD`. تمسح بيئتها أي `ANTHROPIC_BASE_URL` موروث؛ أما `ANTHROPIC_API_KEY` المُصدَّر في طرفيتك فيظل يتغلب على تسجيل الدخول، للعملية الفرعية كما للجلسة الرئيسية. راجع [ADR 0002](../../adr/0002-model-families-and-codex-child.md).

### Codex كعملية فرعية

مسارات `codex` و `codex/<model>` و `codex/auto`، و `/route codex`، تجيب عن الدور عبر Codex CLI في الوضع غير التفاعلي:

```
codex exec --json -C <session cwd> [-m <model>] [Palgu provider flags] --sandbox read-only -c approval_policy="never" -
```

مع الموجز نفسه على stdin، و `child.timeoutMs` نفسه، والفحص نفسه، وذاكرة الإخفاقات وسطر التوجيه ووسم المصدر نفسها كما في عملية Claude الفرعية. يختار `router.codex.auth` الحساب:

- ‏`"palgu"` (الافتراضي): يتحدث Codex إلى نقطة نهاية Responses في بوابتك، `/v1/responses`. على OpenRouter و LiteLLM يُسمّى المزوّد `openrouter` أو `litellm`، ويكون عنوان URL الأساسي `<gateway_url>/v1` (‏`https://openrouter.ai/api/v1`، `http://localhost:4000/v1`؛ وعنوان LiteLLM المنتهي بـ `/anthropic` تُحذف منه تلك اللاحقة أولًا) ويذهب المفتاح في `OPENROUTER_API_KEY` أو `LITELLM_API_KEY`، وفقًا لدليلي Codex من [OpenRouter](https://openrouter.ai/docs/cookbook/coding-agents/codex-cli.md) و [LiteLLM](https://docs.litellm.ai/docs/proxy/client_setup/codex_cli.md). سمِّ النموذج على تلك البوابات: يحتاج OpenRouter إلى معرّف كامل (slug) ‏(`/route codex/openai/gpt-5.6-terra`)، و LiteLLM إلى أحد `model_name` لديك؛ ومعرّف النموذج الافتراضي الخاص بـ Codex ليس منها. على Palgu يضيف المود مزوّدًا صريحًا باسم `palgu` عبر `-c model_provider="palgu"` و `-c model_providers.palgu.base_url="<gateway>/v1"` و `-c model_providers.palgu.wire_api="responses"` و `-c model_providers.palgu.env_key="PALGU_API_KEY"`، كما تصف [مستندات Codex في Palgu](https://www.palgu.ai) (يتجاهل Codex ‏`OPENAI_BASE_URL` تحت تسجيل دخول ChatGPT، لذا يجب أن يكون المزوّد صريحًا). عنوان URL الأساسي هو `gateway_url` الخاص بك مع استبدال `/anthropic` بـ `/v1`، أو `router.codex.baseUrl`. يذهب مفتاح بوابتك فقط إلى بيئة العملية الفرعية بوصفه `PALGU_API_KEY`، ولا يكون أبدًا في سطر الأوامر، ولا يُطبع أبدًا. يحتاج إلى عنوان البوابة ومفتاحها، مثل العملية الفرعية لبوابة Claude.
- ‏`"chatgpt"`: بلا أعلام مزوّد وبلا مفتاح: يستخدم Codex ‏`codex login` الخاص بك و `~/.codex/config.toml`. لا يقرأ المود `~/.codex` ولا يكتب فيه أبدًا.

#### صندوق الحماية والموافقات

لا يستطيع `codex exec` سؤال أحد عن أي شيء: في الوضع غير التفاعلي يعمل Codex بسياسة الموافقة Never (يرفض Codex 0.163 ‏`approval_policy = "untrusted"` رفضًا قاطعًا)، لذا فالأمر الذي يسمح به صندوق الحماية (sandbox) يعمل بلا سؤال، والذي لا يسمح به يُرفض. صندوق الحماية إذن هو البوابة الوحيدة، ويبقيه المود ضيقًا:

- **`router.codex.sandbox`** قيمته `"read-only"` افتراضيًا: يستطيع Codex قراءة المشروع وتشغيل الأوامر التي تقرأ فقط؛ ولا يستطيع تعديل الملفات أو استخدام الشبكة. هذا أضيق من عملية Claude الفرعية (`acceptEdits`)، لأن `codex exec` لا يملك طريقة للسماح بالتعديلات مع الاستمرار في ضبط الأوامر. يُمرَّر `-c approval_policy="never"` صراحةً، لذا فإن طلب الخروج من صندوق الحماية يُرفض، ولا يُنفَّذ أبدًا.
- **إلغاء الاشتراك، على مسؤوليتك:** ‏`"workspace-write"` يدع Codex يعدّل الملفات في المشروع **ويشغّل أي أمر هناك دون أن يسألك** (تبقى الشبكة معطّلة: `-c sandbox_workspace_write.network_access=false`). ‏`"danger-full-access"` يزيل صندوق الحماية تمامًا؛ لا تستخدمه إلا في بيئة مؤقتة معزولة من الخارج. وأي قيمة أخرى تعني القراءة فقط.
- **`router.codex.allowOutsideGit`** (الافتراضي `false`) يضيف `--skip-git-repo-check`. من دونه يرفض Codex البدء خارج مستودع git، ويقول سطر التوجيه `child answer discarded (outside a git repo; set router.codex.allowOutsideGit)`، ويجيب النموذج الرئيسي.
- **`router.codex.args`** يضيف أعلامًا (مثلًا `-c model_reasoning_effort="high"`)، لكن أبدًا لا يضيف صندوق الحماية أو الموافقة: ‏`--sandbox`/`-s` و `--dangerously-bypass-approvals-and-sandbox` و `--approve-for-me` و `--full-auto` و `--add-dir` و `--skip-git-repo-check` و `-a`/`--ask-for-approval` و `-c approval_policy=…`/`sandbox_mode=…`/`sandbox_workspace_write.…`/`sandbox_permissions=…` تُحذف، ويسمّي سجل الجلسة ما تم تجاهله. و `--ephemeral` هناك يعطّل أيضًا الاستئناف الموضّح أدناه.

**الأوامر المرفوضة.** لا يبلّغ `codex exec --json` عن أمر حجبه صندوق الحماية، ولا عن طلب تصعيد رفضه: لا يظهر أيٌّ منهما كحدث (جرى التحقق مقابل Codex 0.163.0). لذا يطلب الموجز من Codex أن ينهي إجابته بـ `NEEDS-APPROVAL: <exact command>` لكل أمر حجبه صندوق الحماية، ويعدّ المود أيضًا أسطر `reject command` التي يكتبها Codex إلى stderr لطلبات التصعيد المرفوضة. ثم، كما في عملية Claude الفرعية:

- مع الإعداد الافتراضي للقراءة فقط، يسألك المود بالحوار نفسه، مسمّيًا الأوامر وما تسمح به الموافقة: *"Codex child on codex/default was refused by its read-only sandbox: touch made.txt. Allow and continue resumes it for this turn with permission to edit files in the project and run commands there (no network)."* (رُفضت العملية الفرعية لـ Codex من صندوق الحماية للقراءة فقط: touch made.txt. «Allow and continue» يستأنفها لهذا الدور مع إذن بتعديل الملفات في المشروع وتشغيل الأوامر هناك، بلا شبكة.) عند **Allow and continue** يُستأنف الخيط نفسه (`codex exec -C <cwd> resume --json … -c sandbox_mode="workspace-write" -c approval_policy="never" -c sandbox_workspace_write.network_access=false <thread> -`) برسالة تسمّي الأوامر الموافق عليها. هذا يوسّع صندوق الحماية لبقية ذلك الدور، لا للأوامر المسمّاة فقط، ولهذا يذكر السؤال ذلك. يُطرح مرة واحدة كحد أقصى لكل دور (`child.relayRounds: 0` يعطّله).
- عند **Deny**، أو حين لا يستطيع أحد الإجابة، أو حين يكون صندوق الحماية لديك أوسع من القراءة فقط مسبقًا، لا يُوسَّع شيء والرفض لا يكون صامتًا أبدًا: تنتهي الإجابة بسطر يسمّي الأوامر المرفوضة (*Codex's sandbox refused, and nothing ran: `touch made.txt`.* أي: رفض صندوق حماية Codex، ولم يُنفَّذ شيء) ويعرض سطر التوجيه `· sandbox read-only · refused: touch made.txt` (أو `refused: 2 unnamed` لطلبات التصعيد التي لم يسمّها Codex).
- لأن تقرير الرفض يأتي من إجابة Codex نفسها، فإن النموذج الذي يتجاهل التعليمات قد يترك رفضًا بلا تسمية. يعرض سطر التوجيه دائمًا صندوق الحماية الذي عمل فيه الدور (`sandbox read-only`، أو `sandbox workspace-write (approved)`)، لذا فالدور الذي لم يستطع الكتابة يظهر على حقيقته.

إذا لم يكن `codex` على `PATH` يقول المود `codex is not installed: npm install -g @openai/codex (or brew install --cask codex) …`، ويقول سطر التوجيه `child answer discarded (codex not installed)`، ويجيب النموذج الرئيسي.

**الدرجات الحدّية تحصل على رأي ثانٍ.** الدرجة الواقعة عند نقطة قطع البرمجة أو فوقها بواحدة تُعاد عينتها مرة ثانية وتفوز الأعلى، كي لا تتأرجح مهمة تصحيح بدرجة 7 أو 8 بين المستويات بسبب ضجيج المصنِّف.

**يتذكر الإخفاقات.** كل إخفاقين للعملية الفرعية في نوع ما يخفضان نقطة قطع البرمجة لذلك النوع بواحد (ولا تنزل أبدًا تحت `simple + 1`)، فينجرف العمل الذي يظل النموذج الرخيص يفشل فيه عائدًا إلى Claude. ‏`/route reset` يمسح الذاكرة.

**يحمي خيط العمل.** لا تملك العملية الفرعية ذاكرة تتجاوز موجزها، لذا لا يدع المود أي متابعة تقع عليها أبدًا. بعد دور أجابت عنه عملية فرعية، فإن `continue` أو `yes` أو أي مطالبة من ست كلمات أو أقل تعود إلى الجلسة الرئيسية، التي تحمل سجل المحادثة كله. وبينما الجلسة الرئيسية في منتصف مهمة (إذ استخدمت إجابتها الأخيرة أدوات)، يبقى العمل بمستوى البرمجة معها (`via mid-task guard` على سطر التوجيه)؛ ولا يخرج إلا البحث والمهام الجديدة المكتفية بذاتها. من دون هذه القواعد كانت الجلسة التي وجّهت مهمة ستعيد بدءها مع كل "continue".

**بعض الأدوار لا تغادر الجلسة الرئيسية أبدًا**، أيًّا كانت الدرجة أو تثبيت `/route`، لأن العملية الفرعية لا تستطيع رؤية المحادثة أو زملاء الفريق أو المهام الخلفية أو أدوات الجلسة (`via notification` و `via session command` و `via security or verdict` على سطر التوجيه):

- الإشعارات: `<teammate-message …>`، و JSON ‏`idle_notification`، و `<task-notification>`، و `[SYSTEM NOTIFICATION …]`؛
- أوامر المشغّل القصيرة المتعلقة بحالة الجلسة أو أدواتها (12 كلمة أو أقل): ‏`approve git pull --ff-only`، `continue`، `resume`، `merge it`، `check the sub agents`، `what's the status`، وأي شيء يسمّي PR أو فرعًا أو CI أو workflow أو وكيلًا فرعيًا؛
- أدوار الأمان والأحكام (`security`، `vulnerability`، `CVE`، `verdict`، …).

### ما لا يجوز للعملية الفرعية فعله

يبدأ كل موجز بديباجة: لا تملك العملية الفرعية وصولًا إلى الجلسة الرئيسية، ويجب ألا تخترع أبدًا حالات أو معرّفات أو أرقام PR أو نتائج تشغيل أو تغييرات ملفات، ويجب ألا تطلب منك أبدًا الموافقة على أي شيء أو تشغيله، وترد بـ `HANDBACK` حين تحتاج المهمة إلى حالة الجلسة أو أدواتها. ثم يفحص المود الإجابة ويتجاهلها، تاركًا النموذج الرئيسي ينفذ الدور بنفسه، حين:

| الإجابة | مثال |
| :- | :- |
| تبدأ بـ `HANDBACK` | `HANDBACK` / `needs the PR list` |
| تقول إنها محجوبة أو تطلب منك التصرف | "blocked by the permission system"، "you must approve it in the UI"، "run `gh pr create` yourself" |
| تدّعي إجراءً أو حقيقة عن الجلسة بلا استدعاء أداة (`num_turns` 1) | "I added X"، "PR #812 is open"، "14 commits behind"، "no build runs exist" |
| في معظمها سرد للنوايا | "I'll read the config. Then I will update the router." |
| تكرر إجابة أُعطيت مسبقًا | الحكم نفسه يُعاد نشره مع كل إشعار خمول |

(الأمثلة نصوص إنجليزية كما يكتبها النموذج: «محجوب بنظام الأذونات»، «يجب أن توافق عليه في الواجهة»، «أضفت X»، «سأقرأ الإعدادات ثم سأحدّث الموجِّه»، وهكذا.)

تُحتسب الإجابة المتجاهَلة إخفاقًا للعملية الفرعية في ذلك النوع وتظهر بوصفها `child answer discarded (<reason>), main model answered` على سطر التوجيه. لا يُطلب من النموذج الرئيسي أبدًا أن ينقل نص عملية فرعية: يجيب المود عن الدور بإجابة عملية فرعية مفحوصة، أو يترك الدور للنموذج الرئيسي.

كل سطر توجيه والشريط يعرضان الدرجة والنوع، لذا حين يبدو قرار ما خاطئًا يمكنك رؤية الأرقام التي تقف خلفه.

## ما تراه

‏Claude والبوابة كلاهما ظاهران، طوال الوقت:

| السطح | دور في الجلسة الرئيسية | دور موجَّه |
| :- | :- | :- |
| الشريط فوق المطالبة | `mixture-of-models · auto · last: claude-opus-5 · critical 9/10`<br>`0: help  1: auto  2: glm  3: deepseek  …  9: claude  off` | `… · running glm-5.3 in a child…` أثناء عمله |
| مؤشر الانتظار (spinner) | `Thinking…` | `Thinking · via glm-5.3 (child)…` |
| حوار السؤال | أسئلة Claude نفسه | `Child on glm-5.3 wants to run: Bash(git pull --ff-only)` مع Allow and continue / Deny |
| الرد في سجل المحادثة | دون تغيير (أو موسوم `⇢ claude-opus-5 · main session` مع `ui.tags: "all"`) | سطر باهت `⇢ glm-5.3 · child on gateway` فوق الرد، يبقى في سجل التمرير (`· child on your Claude subscription` لعضو من Claude، و `· Codex child` لـ Codex) |
| السطر تحت الإجابة | `route: claude-opus-5 · main session · critical 9/10 via claude-haiku-5-5 · 23.1k in / 0.9k out · cache 91% · today: 8 turns, 5 off Claude (63%)` | `route: glm-5.3 · coding 6/10 via ollama · child 42s · saved ~$0.39 · today: …` |
| `/route` | `mixture-of-models live · mode auto · current route: … · today: … · saved ~$12.40 (61%) vs all claude-opus-5-5, at API prices` | نفسه |
| `/palgu login` | `Open https://www.palgu.ai/connect?code=WDJB-MJHT and approve code WDJB-MJHT …`، ثم إشعار منبثق `Signed in to Palgu as you@acme.com (Acme, plan starter). Routed turns now run on Palgu.` | نفسه |
| `/route stats` | لوحة، "Mixture of models"، بأربعة تبويبات على مفاتيح الاختصار 1-4: **models** (أشرطة لكل نموذج، وحصته من الأدوار، والعنوان "N of M turns off Claude" و، باللون الأخضر، ما وفّره التوجيه)، و **kinds** (كل نوع وأي النماذج تولّته)، و **scores** (مدرّج تكراري من 1 إلى 10 ملوّن حسب المستوى، مع تعليم نقاط القطع)، و **recent** (آخر القرارات مع الدرجة والنوع والنموذج ووقت العملية الفرعية). ‏Esc يغلقها. | نفسه |

### كم يوفر

كل دور موجَّه يُسعَّر مرتين: بسعر نموذج Claude في جلستك (ما كانت التوكنات نفسها ستكلفه هناك) وبما كلّفه فعلًا. على Palgu، تأتي التكلفة الفعلية من `/v1/pricing/quote` الخاص بـ Palgu، وهي الصيغة التي يفوتر بها؛ وعلى بوابة أخرى، من `router.prices`؛ والعملية الفرعية `claude/<member>` تُسعَّر بسعر Claude لذلك العضو. الأدوار التي تبقى في الجلسة الرئيسية تُحتسب أيضًا ضمن إجمالي Claude الكامل، لذا فالنسبة المئوية هي الحصة من فاتورة Claude كاملة التي أزالها التوجيه، لا من الأدوار الموجَّهة فقط.

- تحت كل إجابة موجَّهة: `· saved ~$0.39`.
- ‏`/route status`: ‏`saved ~$12.40 (61%) vs all claude-opus-5-5, at API prices`، مجموع جارٍ عبر الجلسات.
- ‏`/route stats`: المجموع نفسه، باللون الأخضر، في تبويب models.

في استخدامنا الخاص، استنفد وكلاء برمجة يعملون على مدار الساعة الحد الأسبوعي لاشتراك Claude Max 20x في نحو ثلاثة أيام على Claude وحده؛ ومع Mixture of Models صمد الاشتراك نفسه الأيام السبعة كاملة. راجع [GUIDELINES.md](GUIDELINES.md#التوفير-التقريبي-الاشتراك-وحده-مقابل-mixture-of-models).

إنه تقدير، ويقول ذلك عن نفسه. أسعار Claude هي أسعار القائمة في API ‏(Opus 5.5 ‏$4 / $20 لكل مليون توكن إدخال / إخراج، و Sonnet 5.5 ‏$2 / $10، و Haiku 5.5 ‏$0.10 / $0.50، و Fable 5.1 ‏$10 / $50؛ وقراءات التخزين المؤقت وكتابات التخزين المؤقت لمدة 5 دقائق وساعة واحدة بأسعارها الخاصة)، لذا ففي اشتراك claude.ai هو التوفير المكافئ لأسعار API، لا مال مسترد. ويفترض أن الدور الموجَّه كان سيستخدم العدد نفسه من التوكنات على Claude. الدور الموجَّه الذي لا يستطيع المود تسعيره (بوابة بلا مدخل في `router.prices` لذلك النموذج، أو عملية Codex فرعية) لا يدّعي أي توفير؛ ويعدّه `/route status` غير مسعَّر.

لأزرار الشريط مفاتيح اختصار رقمية: مع مطالبة فارغة، اكتب `3` وتوقف لحظة لتثبيت Kimi، و `1` للعودة إلى auto، و `0` للمساعدة: لوحة تقول ما يفعله المود، وأين يقف (الوضع، البوابة، التوفير)، وما يفعله كل زر وأمر، وكيف تربط Palgu أو OpenRouter أو LiteLLM. ‏`/route help` يفتحها أيضًا. عطّل الشريط عبر `"ui": { "band": false }`.

## وكلاء البرمجة الآخرون

يعمل المود داخل Claude Code. وللوكلاء الآخرين، تجلب أداة `mom` CLI ومحوّل رفيع لكل أداة القطع نفسها: يختار Palgu النموذج لكل طلب، وتُستدعى ذاكرة Palgu إلى كل مطالبة، ويُستكمل الدور الذي يتوقف في منتصف المهمة ([ADR 0005](../../adr/0005-other-coding-agents.md)).

```bash
npm install -g github:alinaqi/mixture-of-models-claude-mod   # يثبّت `mom` وملفات الإضافات لكل وكيل
mom login                                                     # سجّل الدخول إلى Palgu في المتصفح
```

ثم، لوكيلك:

```bash
# Codex
mom setup codex --write && codex plugin marketplace add alinaqi/mixture-of-models-claude-mod && codex plugin add mixture-of-models@mixture-of-models
codex -p palgu

# Cursor (في مجلد المشروع؛ ثم Developer: Reload Window)
mom setup cursor --write

# OpenCode
mom setup opencode --write

# Antigravity
agy plugin install "$(npm root -g)/mixture-of-models-claude-mod/integrations/antigravity"

# GitHub Copilot CLI
copilot plugin install alinaqi/mixture-of-models-claude-mod:integrations/copilot
```

اختياري، لكل مشروع، ويرفع شيفرته المصدرية إلى Palgu: `mom memory on`. كل أمر، مع الفحوص واستكشاف الأخطاء: [INSTALL.md](INSTALL.md). كيف تستفيد أقصى استفادة من كل وكيل: [GUIDELINES.md](GUIDELINES.md).

| الوكيل | الحالة | الدليل |
| :- | :- | :- |
| Codex (CLI، ‏0.163+) | إضافة: استدعاء الذاكرة، النبض (heartbeat)، الفهرسة؛ و `codex -p palgu` يوجّه عبر Palgu | [integrations/codex](integrations/codex/README.md) |
| Cursor | إضافة (أو `mom setup cursor`): خادم MCP للبحث في ذاكرة Palgu والتفويض إلى نماذج Palgu (`mom mcp`)، والنبض والفهرسة عبر الخطافات، وقاعدة تحدد متى يُفوَّض. لا توجيه لكل دور: لا تستطيع خطافات Cursor تغيير النموذج | [integrations/cursor](integrations/cursor/README.md) |
| OpenCode (1.19+) | إضافة بتكافؤ كامل: نموذج Palgu لكل طلب (auto، أو تثبيت `/route`، أو مسارات المستويات الخاصة بك)، استدعاء الذاكرة، النبض، الفهرسة، `/route` و `/palgu`؛ و `mom setup opencode --write` يضيف المزوّد | [integrations/opencode](integrations/opencode/README.md) |
| Antigravity (‏`agy` 1.0.7+) | إضافة: استدعاء الذاكرة إلى أول استدعاء للنموذج في كل دور، النبض، الفهرسة، أدوات Palgu عبر MCP (‏`palgu_delegate` للمهام الفرعية الموجَّهة). لا تستطيع خطافاته تغيير النموذج | [integrations/antigravity](integrations/antigravity/README.md) |
| GitHub Copilot CLI (1.0.112+) | إضافة: النبض، الفهرسة، أدوات Palgu عبر MCP (البحث في الذاكرة، `palgu_delegate`)، ومهارة تحدد متى تُستخدم. لا تستطيع خطافاته تغيير النموذج أو الإضافة إلى المطالبة | [integrations/copilot](integrations/copilot/README.md) |
| Aider و Continue و Goose | Palgu يوجّه (`model: auto`)؛ لا خطافات، لذا لا استدعاء للذاكرة ولا نبض. جرى التحقق من Aider فعليًا | [integrations/gateway](integrations/gateway/README.md) |

الموافقة على ذاكرة Palgu (`mom memory on`) لكل مجلد مشروع على حدة ومشتركة بين كل وكيل يستخدم `mom`. وهي منفصلة عن `/palgu memory on` الخاص بالمود.

## المتطلبات

- Claude Code **v2.1.287 أو أحدث** (`claude --version`). لا تُحمَّل المودات على الإصدارات الأقدم؛ نفّذ `claude update`.
- بوابة تستطيع العملية الفرعية استخدامها: نقطة نهاية Anthropic في Palgu، أو OpenRouter، أو وكيل LiteLLM، أو أي نقطة نهاية متوافقة مع Anthropic تخدم معرّفات النماذج الموجودة في `routes`، مع مفتاحها.
- اختياري: Ollama مع نموذج صغير لتصنيف مجاني (`ollama pull qwen2.5-coder:3b`). من دونه يرجع المصنِّف إلى Haiku ضمن خطتك.

## الإعداد

راجع [GETTING_STARTED.md](GETTING_STARTED.md) للشرح الكامل خطوة بخطوة، أو `./install.sh`.

1. امنح العملية الفرعية بوابتها. على Palgu، يقوم `/palgu login` بهذه الخطوة كلها: يستخدم تسجيل الدخول بالجهاز في Palgu (نفسه الذي يستخدمه `srooterctl`)، ويصدر Palgu مفتاحًا لهذا الحاسوب يمكنك إبطاله في صفحة Devices لديه، ويحفظ المود العنوان والمفتاح عبر `claude plugin configure --values-stdin`. وإلا تطلب الإضافة قيمتين، ويُخفى المفتاح ويُحفظ في التخزين الآمن لـ Claude Code، ولا يكون أبدًا في ملف إعدادات:

   ```
   /plugin configure mixture-of-models@mixture-of-models-claude-mod
   ```

   أو من الطرفية: شغّل `claude plugin configure mixture-of-models@mixture-of-models-claude-mod --values-stdin`، واكتب `{"gateway_url":"https://api.palgu.ai/anthropic","gateway_key":"<your key>"}` في مدخله واضغط Ctrl-D، كي يبقى المفتاح خارج سجل أوامر الطرفية وقائمة العمليات.

2. اضبط اختياريًا المسارات والعتبات والعملية الفرعية في `~/.claude/model-config.json`؛ والملف `config.example.json` في المستودع نقطة بداية كاملة (معروض أيضًا أدناه).

3. شغّل `claude` ونفّذ `/route`.

إلى أن يتوفر عنوان البوابة ومفتاحها يكون المود في **وضع المراقبة فقط**: يصنّف ويعرض `/route` ما كان سيفعله، لكن لا تبدأ أي عملية فرعية.

الخيار الثالث، `gateway_provider`، يحدد نوع البوابة: ‏`auto` (الافتراضي، وكذلك حين يكون فارغًا) يكتشف Palgu ‏(`*.palgu.ai`) و OpenRouter ‏(`openrouter.ai`) من العنوان ويعامل أي مضيف آخر بوصفه بوابة عامة متوافقة مع Anthropic، تمامًا كما قبل 0.16؛ و `palgu` أو `openrouter` أو `litellm` أو `anthropic-compatible` تسمّيها صراحةً. يحدد المزوّد كيف ترسل العملية الفرعية المفتاح وأي معرّفات نماذج تستخدمها المسارات الافتراضية والشريط:

| المزوّد | مصادقة العملية الفرعية | معرّفات النماذج الافتراضية | ترويسات `x-srooter-*` |
| :- | :- | :- | :- |
| `palgu` | `ANTHROPIC_API_KEY` (`x-api-key`) | معرّفات Palgu: `glm-5.3`، `deepseek-pro`، … | نعم |
| `openrouter` | `ANTHROPIC_AUTH_TOKEN` (`Authorization: Bearer`) | معرّفات OpenRouter (slugs) خلف العائلات: `glm/5.3` → `z-ai/glm-5.3`، … | لا |
| `litellm` | `ANTHROPIC_AUTH_TOKEN` (`Authorization: Bearer`) | أسماء Palgu؛ وأسماء `model_name` في وكيلك هي التي تحسم | لا |
| `anthropic-compatible` | `ANTHROPIC_API_KEY` (`x-api-key`) | معرّفات Palgu | نعم |

أيًّا كان المتغير الذي يحمل المفتاح، تضبط بيئة العملية الفرعية المتغير الآخر على قيمة فارغة، لأن العملية الفرعية ترث طرفيتك ويرسل Claude Code كليهما حين يكونان مضبوطين: فلا يرافق `ANTHROPIC_API_KEY` المُصدَّر في طرفيتك الطلبات إلى OpenRouter أبدًا، ولا يصل `ANTHROPIC_AUTH_TOKEN` شارد إلى Palgu أبدًا. لا يكون المفتاح في سطر أوامر أبدًا.

### OpenRouter

1. أنشئ مفتاحًا على [openrouter.ai/keys](https://openrouter.ai/keys).
2. ‏`/plugin configure mixture-of-models@mixture-of-models-claude-mod` مع

   | الخيار | القيمة |
   | :- | :- |
   | `gateway_url` | `https://openrouter.ai/api` |
   | `gateway_key` | مفتاح OpenRouter الخاص بك (`sk-or-…`) |
   | `gateway_provider` | `auto` (أو `openrouter`) |

   أو من الطرفية: شغّل `claude plugin configure mixture-of-models@mixture-of-models-claude-mod --values-stdin`، واكتب `{"gateway_url":"https://openrouter.ai/api","gateway_key":"<your key>","gateway_provider":"openrouter"}` في مدخله واضغط Ctrl-D، كي يبقى المفتاح خارج سجل أوامر الطرفية.
3. شغّل `claude`. تعمل الأدوار البسيطة وأدوار البرمجة على `z-ai/glm-5.3`، والبحث والمراجعة على `moonshotai/kimi-k3.1-pro`؛ ويعرض الشريط `glm` و `kimi` و `deepseek` (‏`deepseek/deepseek-v4-pro`) و `gemini` (‏`google/gemini-3.8-flash`) و `minimax` (‏`minimax/minimax-m3`، `minimax/minimax-m3.1-flash`) و `gpt` (‏`openai/gpt-6-sol`، `-luna`، `-astra`) و `mercury` (‏`inception/mercury-3`). مع أحد عشر زرًا لا يكون للأخير مفتاح رقمي؛ انقر عليه أو انتقل إليه بـ Tab. هذه هي المعرّفات التي خدمتها [قائمة نماذج OpenRouter](https://openrouter.ai/models) في 2026-10-29. لا يملك OpenRouter نسخة highspeed من Kimi، لذا فإن `kimi/auto` هو `pro` لكل المستويات.

المسارات على OpenRouter تسمّي أعضاء العائلات (`glm/5.3`)، لأن معرّف OpenRouter يحتوي على `/`؛ والمعرّف الذي تدرجه عائلة ما (`z-ai/glm-5.3`) يعمل أيضًا. لنموذج آخر من OpenRouter، أضفه إلى عائلة ووجّه إليه:

```json
{ "router": {
    "families": { "glm": { "members": { "4.6": "z-ai/glm-4.6" } } },
    "routes":   { "simple": "glm/4.6" } } }
```

كما يقول [دليل Claude Code من OpenRouter](https://openrouter.ai/docs/guides/guides/claude-code-integration)، لا يُضمن عمل Claude Code إلا مع نماذج Anthropic نفسها؛ والدور الموجَّه الذي لا يستطيع نموذجه التعامل مع أدوات Claude Code يفشل، ويجيب عنه النموذج الرئيسي.

### LiteLLM

يخدم [وكيل LiteLLM](https://docs.litellm.ai/docs/tutorials/claude_responses_api) نقطة النهاية `/v1/messages` المتوافقة مع Anthropic على عنوانه الخاص. وهو يعمل على مضيفك، لذا لا يُكتشف أبدًا: سمِّه.

| الخيار | القيمة |
| :- | :- |
| `gateway_url` | وكيلك، مثلًا `http://localhost:4000` (أو التمرير `/anthropic` الخاص به، `http://localhost:4000/anthropic`) |
| `gateway_key` | المفتاح الرئيسي للوكيل أو مفتاح افتراضي (`sk-…`) |
| `gateway_provider` | `litellm` |

ترسل العملية الفرعية المفتاح بوصفه `Authorization: Bearer`. أسماء النماذج هي أيًّا كانت أسماء `model_name` التي يعرّفها `config.yaml` في وكيلك. الافتراضيات هي أسماء Palgu ‏(`glm-5.3`، `kimi-k3.1-pro`، …): سمِّ نماذج وكيلك بالأسماء نفسها، أو وجّه المسارات إلى أسمائك:

```json
{ "router": {
    "routes":   { "simple": "my-glm", "coding": "my-glm", "kinds": { "research": "my-kimi", "review": "my-kimi" } },
    "families": { "glm": { "members": { "mine": "my-glm" } } } } }
```

المفتاح الافتراضي لا يصل إلا إلى النماذج المسموح له بها؛ والخطأ 401 أو النموذج غير المعروف يجعلان العملية الفرعية تفشل، ويجيب النموذج الرئيسي.

## الأمان واستخدام البيانات

### خوادم الشبكة التي تتصل بها هذه الإضافة

- ‏`https://api.palgu.ai` — ‏Palgu، ثابت في الشيفرة: `/auth/device/code` و `/auth/token` عند `/palgu login`، و `/me` و `/me/org-settings` عند `/palgu status`، و `/v1/models/health` عند بدء الجلسة، وبعد `/palgu login` وعند `/route models` (مفتاح البوابة بصفة `x-api-key`؛ ولا يُرسل شيء آخر)، و `/v1/pricing/quote` بعد دور موجَّه حين تكون بوابتك Palgu ولا يوجد في `router.prices` مدخل للنموذج، و `/anthropic/heartbeat` حين تنهي الجلسة الرئيسية دورًا (النبض، أدناه)، و `/v1/cortex/search` عند كل مطالبة منك في مشروع شغّلت فيه `/palgu memory on` (استدعاء ذاكرة Palgu، أدناه).
- ‏`https://raw.githubusercontent.com` — عند بدء الجلسة (مرة كل 12 ساعة على الأكثر، في الخلفية) وعند `/route update`: طلب GET لـ `/alinaqi/mixture-of-models-claude-mod/main/.claude-plugin/plugin.json` لقراءة الإصدار المنشور. لا يُرسل شيء.
- ‏`http://localhost:11434` — ‏Ollama محلي (`/api/chat`) يمنح كل مطالبة درجة. يبقى على جهازك؛ ويُتخطى حين لا يجيب شيء هناك.
- ‏Anthropic، عبر `$.model.classify` الخاص بـ Claude Code ضمن خطتك أنت — فقط حين لا يجيب Ollama، لتقييم المطالبة.
- عنوان البوابة الذي تضبطه في إعدادات الإضافة (`gateway_url`، مثلًا `https://api.palgu.ai/anthropic` أو `https://openrouter.ai/api` أو وكيل LiteLLM الخاص بك). يستطيع المستخدم ضبط عنوان بوابة مخصص في إعدادات الإضافة؛ ولا يُتصل إلا بذلك العنوان للأدوار الموجَّهة، والعملية الفرعية، لا المود، هي التي تتصل به. تستخدم عملية Codex الفرعية `/v1` في تلك البوابة (أو `router.codex.baseUrl` الذي تضبطه)، أو OpenAI عبر تسجيل دخولك أنت إلى Codex مع `codex.auth: "chatgpt"`. وتستخدم عملية `claude/<member>` الفرعية Anthropic عبر تسجيل دخولك أنت إلى Claude.

### البيانات التي ترسلها الإضافة

- رسائل المحادثة (`session.messages`): المطالبة إضافة إلى آخر `router.child.contextMessages` رسالة (الافتراضي 12) تحتوي نصًا، كلٌّ منها مقتطعة إلى 1,200 حرف، مع أسماء الأدوات التي استخدمتها. تُكتب إلى stdin الخاص بالعملية الفرعية، وترسلها العملية الفرعية إلى عنوان البوابة أعلاه (أو إلى Anthropic أو Codex لتلك المسارات) للحصول على إجابة النموذج. لا تُرسل إلا في دور موجَّه: دور ترسله الدرجة، أو تثبيت `/route` الخاص بك، بعيدًا عن الجلسة الرئيسية. أدوار الحرج والأمان والإشعارات والمشغّل لا تُوجَّه هي نفسها أبدًا، لكن سياق دور موجَّه لاحق قد يتضمن نصها الأخير، لأن السياق هو آخر الرسائل التي تحتوي نصًا أيًّا كان مسارها. وأثناء عملها، ترسل حلقة الوكيل الخاصة بالعملية الفرعية أيضًا ما تقرؤه أدواتها في المشروع، وفق قواعد المنع في [ما لا يجوز للعملية الفرعية فعله](#ما-لا-يجوز-للعملية-الفرعية-فعله).
- نص المطالبة ومعيار التقييم: إلى Ollama المحلي، أو إلى Anthropic عبر `$.model.classify`، لكل مطالبة تصل إلى التصنيف.
- محتويات الملفات المحلية (`fs.read`): ‏`~/.claude/model-config.json` (إعداداتك؛ لا تُرسل أبدًا) و `~/.claude/mixture-of-models/strategies/*.md` (استراتيجيات التوجيه الخاصة بك؛ معيار التقييم للاستراتيجية النشطة جزء من مطالبة التقييم، لذا يذهب إلى Ollama أو Anthropic كما سبق). لا يقرأ المود أي ملفات من المشروع بنفسه.
- إلى Palgu: عند `/palgu login` معرّف العميل `mixture-of-models`، واسم الجهاز `Claude Code on <HOSTNAME>`، وإصدار المود، ومعرّف تثبيت عشوائي ورمز الجهاز؛ وعند `/palgu status` مفتاح البوابة بوصفه ترويسة Bearer؛ ولعرض السعر معرّف النموذج وأعداد التوكنات الأربعة والمفتاح. بلا أي نص من المطالبة أو الإجابة.
- إلى Palgu، النبض: حين تنهي الجلسة الرئيسية إجابة وتكون بوابتك Palgu (ولا يكون `router.heartbeat` ‏`local` أو `off`)، آخر 600 حرف من تلك الإجابة، ومعرّف جلسة (معرّف التثبيت ورقم المطالبة) والمفتاح بصفة `x-api-key`. يقول Palgu ما إذا كان الدور قد توقف في منتصف المهمة. لا شيء آخر من المحادثة.
- إلى Palgu، عبر `palgu` CLI وفقط بعد أن تشغّل `/palgu memory on`: ملفات الشيفرة المصدرية للمشروع، لذاكرة Palgu (راجع البرامج). تستخدم `palgu` تسجيل الدخول الخاص بها.
- إلى Palgu، استدعاء ذاكرة Palgu، فقط في مجلد مشروع شغّلت فيه `/palgu memory on` وبينما المود مسجّل الدخول إلى Palgu: كل مطالبة منك من أربع كلمات أو أكثر (في سطر واحد، 300 حرف كحد أقصى؛ لا أوامر الشرطة المائلة)، واسم المشروع في Palgu والمفتاح بوصفه ترويسة Bearer، إلى `/v1/cortex/search`. ما يعود (8 مؤشرات من سطر واحد كحد أقصى: النوايا المسجّلة و ADR، والمستندات، ورموز الشيفرة مع ملفاتها؛ 2,000 حرف كحد أقصى) يُضاف بجانب مطالبتك للجلسة الرئيسية وإلى موجز العملية الفرعية الموجَّهة (Claude أو نموذج Palgu أو Codex)، فيرى كل نموذج يجيب الذاكرة نفسها. البحث الذي يفشل أو يستغرق أكثر من 3 ثوانٍ لا يضيف شيئًا ولا يؤخر المطالبة أبدًا.
- إلى بوابة Palgu أو بوابة عامة، الترويسات التعريفية للعملية الفرعية: `x-srooter-client` (اسم المود وإصداره)، و `x-srooter-project` (اسم مجلد الجلسة، بصيغة slug)، وعلى Palgu، ‏`x-srooter-pin` (معرّف النموذج الموجَّه إليه). راجع [الترويسات التي ترسلها العملية الفرعية](#الترويسات-التي-ترسلها-العملية-الفرعية). العملية الفرعية ذات النموذج الموجَّه ترسل أيضًا `x-palgu-fallback: auto`.
- لا تُرسل أي بيانات أخرى. لا قياس عن بُعد. لا تحليلات.

### البرامج التي تشغلها الإضافة

كل استدعاء لـ `$.process.run` يُكتب برنامجه وأعلامه الثابتة نصًا حرفيًا عند الاستدعاء. لا تُشغَّل أي منها عبر shell.

- ‏`claude -p --model <model> --output-format stream-json --verbose --max-turns <n> --add-dir <cwd> <child.args> --disallowedTools <deny rules>` — ‏Claude Code نفسه، بلا واجهة، لتشغيل دور موجَّه على البوابة أو عبر تسجيل دخولك إلى Claude (مسارات `claude/<member>`). الوسائط الديناميكية: معرّف النموذج (من مساراتك أو تثبيتك؛ يُرفض ما لم يكن معرّفًا واحدًا بسيطًا من أحرف وأرقام و `. _ : / @ [ ] -`، لا يبدأ بـ `-`، وبحد أقصى 200 حرف)، وحد الأدوار و `child.args`/`router.child.deny` من `model-config.json` الخاص بك، ومجلد عمل الجلسة؛ ويُرفض كلٌّ منها إن لم يكن سلسلة نصية بسيطة أو احتوى على NUL. بعد أن توافق على أوامر رُفضت للعملية الفرعية، يضيف الاستدعاء نفسه `--resume <its session id> --allowedTools <the patterns you approved>`.
- ‏`codex exec --json … -`، و `codex exec -C <cwd> resume --json … <thread id> -` بعد أن توافق على الأوامر المرفوضة — ‏Codex CLI، لمسارات `codex` فقط، مع الفحوص نفسها (معرّف الخيط بوصفه معرّفًا بسيطًا).
- ‏`claude plugin configure mixture-of-models@mixture-of-models-claude-mod --values-stdin` — مرة واحدة بعد `/palgu login`، لحفظ المفتاح الذي أصدره Palgu في التخزين الآمن لـ Claude Code. كل وسيط نص ثابت؛ والمفتاح يذهب عبر stdin فقط، وفقط بعد التحقق من أنه توكن واحد بسيط (`A-Z a-z 0-9 . _ -`، من 8 إلى 512 حرفًا).
- ‏`claude plugin marketplace update mixture-of-models-claude-mod`، ثم `claude plugin update mixture-of-models@mixture-of-models-claude-mod` — عند `/route update`، فقط حين يدرج GitHub إصدارًا أحدث. كل وسيط نص ثابت.
- ‏`palgu memory index .` (في مجلد الجلسة، في الخلفية، مرة كل 10 دقائق كحد أقصى لكل مشروع) و `palgu memory status . --json` — ‏Palgu CLI، فقط في مجلد مشروع شغّلت فيه `/palgu memory on` وبينما المود مسجّل الدخول إلى Palgu. كل وسيط نص ثابت. تسجّل `palgu` الدخول بمفتاحها الخاص (`palgu login`)؛ ولا يمرّر لها المود أي مفتاح أو بيئة أو stdin. الفهرسة ترفع ملفات الشيفرة المصدرية للمشروع إلى Palgu، ولهذا تبقى معطّلة حتى تفعّلها.
- لا تشغّل الإضافة أبدًا أوامر واردة من الشبكة. استجابات الشبكة لا تكون أبدًا ضمن argv لـ `process.run`: إجابة GitHub تقرر فقط ما إذا كانت أوامر التحديث الثابتة ستعمل، والقيمة الوحيدة المجلوبة التي تصل إلى عملية أصلًا هي مفتاح Palgu، عبر stdin، بعد الفحص المذكور أعلاه.

### الخطافات

- ‏`prompt.submit` — يقرأ المطالبة ليقرر مسارها (القواعد السابقة، ثم درجة المصنِّف، ثم العتبات). يمرّرها دون تغيير: لا يحذفها أو يعيد كتابتها أو يضيف إليها أبدًا. يفشل مفتوحًا.
- ‏`turn.step` — لدور موجَّه، يشغّل العملية الفرعية المذكورة أعلاه بدلًا من النموذج الرئيسي ويجيب عن الدور بنص العملية الفرعية؛ وكل دور آخر، وكل وكيل فرعي، يمر دون تغيير. الإجابة الفاشلة أو المتجاهَلة من العملية الفرعية تعيد الدور إلى النموذج الرئيسي.
- ‏`turn.complete` — يُلحق سطر التوجيه (المسار، الدرجة، التكلفة، التوفير) بنص الدور ويحدّث الأعداد وسجل القرارات ومجاميع التوفير في مخزن الإضافة. ثم النبض: حين تتوقف إجابة الجلسة الرئيسية في منتصف المهمة (أعلنت عن إجراء وانتهت، أو، حين طلبت تغييرات، وصفت تعديلات لم تُجرها)، يرسل المود مطالبة استكمال واحدة من عنده (`$.prompt.submit`، تظهر للنموذج على أنها من هذه الإضافة)، بحد أقصى `router.heartbeatMax` (3) مرات لكل مطالبة منك. يفشل مفتوحًا: الخطأ لا يحجب التوقف أبدًا.
- أيضًا: `session.start` (يقرأ الإعدادات، ويسجّل `/route` و `/palgu`)، و `turn.start` (يمسح نتيجة العملية الفرعية الأخيرة)، و `ui.render` لـ `AbovePrompt` (الشريط)، و `AssistantMessage` (وسم المصدر على ردود العملية الفرعية)، و `Pane` (لوحتا المساعدة والإحصاءات) و `Spinner` (‏`via <model> (child)…`)، و `command.run` لـ `/route` و `/palgu`. لا يتعامل المود أبدًا مع `tool.call` أو `tool.check`.

### الأوامر والأدوات والوكلاء المضافة

- ‏`/route` — يعرض حالة التوجيه، أو يثبّت مستوى أو نموذجًا أو عضو عائلة أو `codex`، أو يبدّل الاستراتيجية، أو يفتح لوحة الإحصاءات أو المساعدة، أو يعيد تعيين ذاكرة الإخفاقات، أو يحدّث الإضافة (`/route update`).
- ‏`/palgu` — تسجيل الدخول إلى Palgu (`login`)، أو قول لمن المفتاح المضبوط، وما أنفقته مؤسستك من ميزانيتها في Palgu خلال هذه الفترة، وما إذا كان المشروع ضمن ذاكرة Palgu (`status`)، أو رابط الخطط والفوترة (`upgrade`)، أو تفعيل ذاكرة Palgu أو تعطيلها للمشروع الذي أنت فيه (`memory on`، `memory off`، `memory`؛ وكل مجلد مشروع يحتاج إلى `memory on` خاص به).
- المهارة `routing-strategy` — تساعد في كتابة ملف استراتيجية توجيه أو شرحه.
- لا أدوات، ولا وكلاء، ولا خوادم MCP.

### بيانات الاعتماد

- يُدخل المستخدم مفاتيح API عبر إعدادات الإضافة (`user_config`، المخزنة بوصفها حساسة): مفتاح واحد، `gateway_key`، للبوابة التي تضبطها (Palgu أو OpenRouter أو LiteLLM أو نقطة نهاية أخرى متوافقة مع Anthropic). ويملأ `/palgu login` الإعداد نفسه نيابةً عنك.
- لا تقرأ الإضافة المفاتيح من متغيرات البيئة أو من الملفات على جهاز المستخدم. متغيرات البيئة التي تقرؤها هي `HOME` و `HOSTNAME` و `MAGGY_ROUTER_CHILD` و `ANTHROPIC_CUSTOM_HEADERS` (ترويساتك الإضافية الخاصة، تُمرَّر إلى العملية الفرعية للبوابة فقط).
- يُرسل كل مفتاح فقط إلى مضيف مزوّده: يصل `gateway_key` إلى البوابة التي ضبطتها (أو، في مسار Codex، إلى `router.codex.baseUrl` الذي ضبطته في `model-config.json`)، عبر العملية الفرعية، من بيئتها (لا من argv الخاص بها أبدًا)، ويصل إلى `https://api.palgu.ai` من المود فقط حين تكون تلك البوابة Palgu.

## ما تشغله هذه الإضافة وتقرؤه وترسله وتخزنه

يقارن الفحص الأمني للدليل هذا القسم بالشيفرة. كل ما يفعله المود خارج شيفرته الخاصة مدرج هنا. باختصار:

- فقط حين تشغّل `/palgu`، فإنه **يجلب** `https://api.palgu.ai` (`/auth/device/code`، `/auth/token`، `/me`) و **يشغّل** `claude plugin configure … --values-stdin` مرة واحدة لحفظ المفتاح الذي أصدره Palgu (راجع الجداول أدناه).
- **يجلب** `http://localhost:11434/api/chat` عبر `$.http.fetch`، مرسلًا نص المطالبة ومعيار التقييم إلى Ollama محلي، لتقييم المطالبة. بلا بيانات اعتماد، ولا يغادر شيء الجهاز.
- **يستدعي** `$.model.classify`، الذي يرسل نص المطالبة نفسه ومعيار التقييم إلى Anthropic عبر عميل API الخاص بـ Claude Code على حسابك أنت، حين لا يجيب Ollama.
- عند بدء الجلسة، في الخلفية ومرة كل 12 ساعة على الأكثر، وعند `/route update`، **يجلب** `https://raw.githubusercontent.com/alinaqi/mixture-of-models-claude-mod/main/.claude-plugin/plugin.json` (طلب GET بسيط، لا يُرسل شيء) ليرى إن كان قد صدر إصدار أحدث، وينبّه إلى ذلك في إشعار toast وعلى الشريط.
- فقط عند `/route update`، حين يدرج GitHub إصدارًا أحدث، **يشغّل** `claude plugin marketplace update` و `claude plugin update` لهذه الإضافة، بوصفهما نصًا ثابتًا.
- **يشغّل** برنامجين عبر `$.process.run` للأدوار الموجَّهة: `claude` (‏Claude Code نفسه، بلا واجهة)، إما مع `ANTHROPIC_BASE_URL` والمفتاح الذي ضبطته (في `ANTHROPIC_API_KEY`، أو `ANTHROPIC_AUTH_TOKEN` لـ OpenRouter و LiteLLM، مع ضبط الآخر فارغًا) و، لـ Palgu والبوابات العامة، `ANTHROPIC_CUSTOM_HEADERS` مضبوطًا للتعريف بها (راجع [الترويسات التي ترسلها العملية الفرعية](#الترويسات-التي-ترسلها-العملية-الفرعية))، أو، لمسار `claude/<member>`، عبر تسجيل دخولك أنت إلى Claude مع مسح `ANTHROPIC_BASE_URL`؛ و، فقط لمسار `codex`، ‏`codex exec` (‏Codex CLI)، مع مفتاح بوابتك في `PALGU_API_KEY` (‏`OPENROUTER_API_KEY` على OpenRouter، و `LITELLM_API_KEY` على LiteLLM) أو عبر تسجيل دخولك أنت إلى Codex. كل عملية فرعية **ترسل** مطالبتك وموجزًا قصيرًا لنص الجلسة الأخير إلى نقطة النهاية الخاصة بها.
- **يقرأ** `~/.claude/model-config.json`، وملفات استراتيجياتك، و `HOME` و `HOSTNAME` و `MAGGY_ROUTER_CHILD` و `ANTHROPIC_CUSTOM_HEADERS`، و **يخزن** تثبيت المسار، والأعداد اليومية، وآخر حكم، وأعداد الإخفاقات لكل نوع، وآخر تحقق من التحديثات، وسجلًا لآخر 200 قرار (اليوم، النموذج، النوع، المستوى، الدرجة، مصدر المصنِّف، وقت العملية الفرعية ورمز خروجها؛ ولا نص مطالبات أبدًا) في مخزن الإضافة.

التفاصيل الكاملة تتبع؛ وسياسة الخصوصية موجودة في [PRIVACY.md](PRIVACY.md).

### الخطافات

يسجّل ملف الخطافات `hooks/register.js` أحد عشر خطافًا. ما يفعله كلٌّ منها بالأحداث والاستدعاءات التي يراها:

| الخطاف | ما يفعله |
| :- | :- |
| `session.start` | يقرأ `~/.claude/model-config.json` وملفات استراتيجياتك، ويأخذ عنوان البوابة ومفتاحها من خيارات الإضافة، ويتذكر نموذج الجلسة، ويحمّل تثبيت `/route` من مخزن الإضافة، ويسجّل الأمرين `/route` و `/palgu`. لا يفعل شيئًا حين يكون `MAGGY_ROUTER_CHILD` مضبوطًا، فيبقى المود غير نشط داخل عمليته الفرعية. |
| `prompt.submit` | يمرّر كل مطالبة دون تغيير. وعلى الهامش يقرر المسار: القواعد السابقة أولًا، ثم درجة ضرر من 1 إلى 10 من المصنِّف (راجع الشبكة)، ثم العتبات. لا يحذف مطالبة أو يعيد كتابتها أو يضيف إليها أبدًا. يفشل مفتوحًا: إذا رمى التقييم استثناءً، تمر المطالبة مع ذلك. |
| `turn.start` | يمسح نتيجة العملية الفرعية للدور السابق. |
| `turn.step` | لدور موجَّه، بدلًا من ترك الجلسة الرئيسية تستدعي نموذجها، يشغّل العملية الفرعية (Claude Code على البوابة أو عبر تسجيل دخولك إلى Claude، أو Codex) الموصوفة تحت البرامج ويعيد نص العملية الفرعية بوصفه إجابة الدور مع `stopReason: end_turn`. إذا رفض نظام أذونات العملية الفرعية أمرًا، يسألك الخطاف عبر `$.ui.ask` (الحوار الذي يستخدمه Claude للأسئلة)، مسمّيًا الأوامر بالضبط؛ وعند "Allow and continue" يستأنف العملية الفرعية نفسها مع السماح بتلك الأوامر، حتى `relayRounds` مرة؛ وعند "Deny"، أو حين لا يستطيع أحد الإجابة، يكون شرح العملية الفرعية نفسها هو الإجابة. تُسأل عملية Codex الفرعية بالطريقة نفسها عن الأوامر التي تسمّيها مرفوضة، مرة واحدة لكل دور؛ وعند "Allow and continue" يُستأنف خيط Codex نفسه مع السماح بالتعديلات في المشروع (راجع [صندوق الحماية والموافقات](#صندوق-الحماية-والموافقات)). ولكل دور آخر، وللوكلاء الفرعيين، يستدعي `next(e)` دون تغيير. إذا فشلت العملية الفرعية أو لم تطبع شيئًا يستدعي `next(e)`، فيجيب النموذج الرئيسي. |
| `turn.complete` | يُلحق سطرًا تحت الإجابة بالمسار والدرجة والتكلفة ومكان العمل، وما وفّره الدور الموجَّه؛ ويحدّث الأعداد اليومية ومجاميع التوفير في مخزن الإضافة. على Palgu يسأل `/v1/pricing/quote` عن تكلفة الدور الموجَّه. |
| `ui.render` لـ `AbovePrompt` | يرسم الشريط: الوضع الحالي وآخر قرار، إضافة إلى أزرار تغيّر تثبيت `/route`. ويحتفظ بكل ما ترسمه المودات الأخرى هناك. |
| `ui.render` لـ `AssistantMessage` | يضع سطر مصدر باهتًا فوق الرد الذي أنتجته العملية الفرعية. وتمر الردود الأخرى كما هي. |
| `ui.render` لـ `Spinner` | يضيف `via <model> (child)…` بعد كلمة مؤشر الانتظار أثناء دور موجَّه. |
| `ui.render` لـ `Pane` | يرسم لوحة الإحصاءات "Mixture of models" (المعرّف `routing-stats`) من سجل القرارات حين يفتحها `/route stats`. وتمر اللوحات الأخرى كما هي. |
| `command.run` لـ `/palgu` | ‏`login` يبدأ تسجيل الدخول بالجهاز في Palgu ويجيب بالرابط والرمز فورًا؛ ثم يستطلع مؤقّت `$.clock` ‏`/auth/token` كل `interval` ثانية (و5 إضافية بعد كل `slow_down`) حتى توافق أو ترفض أو تنتهي صلاحية الرمز، ثم يحفظ المفتاح ويحوّل العملية الفرعية إلى Palgu لهذه الجلسة. ‏`status` يسأل `/me` في Palgu لمن المفتاح؛ و `upgrade` يطبع رابط الفوترة. |
| `command.run` لـ `/route` | يعرض حالة التوجيه والعائلات (`/route`، `/route status`) أو يضبط التثبيت (`auto`، `off`، مستوى، نموذج، `<family>/<member>`، `<family>/auto` أو `codex`). العائلة أو العضو غير المعروف يُرفض مع قائمة الخيارات الصالحة. |

لا يتعامل المود أبدًا مع `tool.call` أو `tool.check`، لذا لا يوافق على استدعاء أداة أو يرفضه أو يغيّره أبدًا، ولا يغيّر مطالبات الأذونات أبدًا.

### الشبكة: الخوادم التي تتصل بها هذه الإضافة

استدعاءات المود نفسه، ثم استدعاءات العملية الفرعية:

| من | الاستدعاء | العنوان | ما يُرسل | لماذا |
| :- | :- | :- | :- | :- |
| المود، عند بدء الجلسة (مرة كل 12 ساعة على الأكثر) وفي `/route update` | `$.http.fetch` | `https://raw.githubusercontent.com/alinaqi/mixture-of-models-claude-mod/main/.claude-plugin/plugin.json`، ثابت في الشيفرة | لا شيء سوى طلب GET | يقرأ الإصدار المنشور لمقارنته بإصدارك. |
| المود، في `/palgu login` | `$.http.fetch` | `https://api.palgu.ai/auth/device/code`، ثم `/auth/token`، ثابت في الشيفرة | معرّف العميل `mixture-of-models`، واسم الجهاز (`Claude Code on <HOSTNAME>`)، وإصدار المود ومعرّف تثبيت عشوائي يحتفظ به في مخزنه؛ ثم رمز الجهاز الذي أعطاه Palgu | تسجيل الدخول. يجيب Palgu بمفتاح لهذا الحاسوب. |
| المود، عند بدء الجلسة، وبعد `/palgu login` وعند `/route models` | `$.http.fetch` | `https://api.palgu.ai/v1/models/health`، ثابت في الشيفرة | لا شيء سوى طلب GET ومفتاح البوابة بصفة `x-api-key`؛ فقط حين يكون `gateway_url` الخاص بك على `https://api.palgu.ai` | يقرأ أي النماذج يخدمها Palgu الآن وأيها متوقف، فتتبع قائمة النماذج Palgu بدلًا من إصدار. تُحفظ في مخزن المود للجلسة التالية. |
| المود، في `turn.complete` بعد دور موجَّه على Palgu | `$.http.fetch` | `https://api.palgu.ai/v1/pricing/quote`، ثابت في الشيفرة | معرّف النموذج الموجَّه إليه وأعداد التوكنات الأربعة للعملية الفرعية (إدخال، إخراج، قراءة من التخزين المؤقت، كتابة إلى التخزين المؤقت)، ومفتاح البوابة بوصفه ترويسة Bearer؛ فقط حين يكون `gateway_url` الخاص بك على `https://api.palgu.ai` ولا يوجد في `router.prices` مدخل لذلك النموذج | يسعّر الدور لتقدير التوفير. بلا أي نص من المطالبة أو الإجابة. |
| المود، في `prompt.submit`، فقط حيث شُغّل `/palgu memory on` | `$.http.fetch` | `https://api.palgu.ai/v1/cortex/search`، المضيف والمسار ثابتان في الشيفرة | مطالبتك (سطر واحد، 300 حرف كحد أقصى)، واسم المشروع في Palgu، و `limit=8`، ومفتاح البوابة بوصفه ترويسة Bearer؛ فقط حين يكون `gateway_url` الخاص بك على `https://api.palgu.ai` | استدعاء ذاكرة Palgu: المؤشرات من ذاكرة المشروع توضع بجانب المطالبة للجلسة الرئيسية وفي موجز العملية الفرعية الموجَّهة. |
| المود، في `/palgu status` | `$.http.fetch` | `https://api.palgu.ai/me` و `https://api.palgu.ai/me/org-settings`، ثابتان في الشيفرة | مفتاح البوابة، بوصفه ترويسة Bearer، فقط حين يكون `gateway_url` الخاص بك على `https://api.palgu.ai` (مفتاح بوابة أخرى لا يُرسل أبدًا) | يقول لمن المفتاح، وخطة المؤسسة، وما أنفقته المؤسسة من ميزانيتها في Palgu خلال هذه الفترة. |
| المود، في `prompt.submit` | `$.http.fetch` | `http://localhost:11434/api/chat`، ثابت في الشيفرة | معيار التقييم ونص المطالبة، بوصفهما طلب محادثة Ollama، بلا بيانات اعتماد | تصنيف محلي مجاني. يُتخطى حين لا يجيب شيء هناك. |
| المود، في `prompt.submit` | `$.model.classify` | ‏API الخاص بـ Anthropic عبر عميل Claude Code نفسه وخطتك أنت | معيار التقييم ونص المطالبة | التصنيف حين لا يتوفر Ollama. النموذج: الاسم المستعار `classifier`، و `claude-haiku-5-5` افتراضيًا. |
| العملية الفرعية (Claude Code نفسه)، تبدأ في `turn.step` | عميل API العادي لـ Claude Code | `gateway_url` الذي تضبطه في خيارات الإضافة (مثلًا `https://api.palgu.ai/anthropic` أو `https://openrouter.ai/api` أو وكيل LiteLLM الخاص بك)، مع `gateway_key` بصفة `x-api-key` الخاص به (Palgu، عامة) أو `Authorization: Bearer` (‏OpenRouter، LiteLLM) | مطالبتك إضافة إلى موجز لآخر `contextMessages` تبادل من الجلسة (نص فقط، مقتطع)، ثم كل ما ترسله حلقة الوكيل الخاصة بالعملية الفرعية أثناء عملها | هذا هو الهدف من الإضافة: يعمل الدور على نموذج البوابة بدلًا من نموذج الجلسة الرئيسية. |
| عملية فرعية لعضو من Claude (مسارات `claude/<member>`)، تبدأ في `turn.step` | عميل API العادي لـ Claude Code | ‏Anthropic، عبر تسجيل دخولك أنت إلى claude.ai، كما في جلستك الرئيسية | الموجز نفسه، ثم حلقة الوكيل الخاصة بالعملية الفرعية | يشغّل الدور على نموذج Claude آخر دون إعادة توجيه الجلسة الرئيسية. |
| عملية Codex الفرعية (مسارات `codex`)، تبدأ في `turn.step` | عميل Codex CLI نفسه | مع `codex.auth: "palgu"`: ‏`/v1` في بوابتك (مثلًا `https://api.palgu.ai/v1/responses` أو `https://openrouter.ai/api/v1/responses` أو `<your LiteLLM proxy>/v1/responses`) مع `gateway_key`؛ ومع `"chatgpt"`: ‏OpenAI، عبر تسجيل دخولك أنت إلى Codex | الموجز نفسه، ثم حلقة الوكيل الخاصة بـ Codex | يشغّل الدور على Codex. |

لا يتصل المود بأي مضيف آخر. البوابة هي أيًّا كان ما تضبطه؛ ولا يُرسل شيء إلى طرف ثالث ثابت.

### البرامج التي تشغلها هذه الإضافة

**أي البرامج:** ثلاثة، `palgu` (‏Palgu CLI، فقط بعد `/palgu memory on`: ‏`palgu memory index .` و `palgu memory status . --json`، كلاهما نص ثابت)، و `claude` (‏Claude Code نفسه في الوضع بلا واجهة، ومرة واحدة بعد `/palgu login` بصيغة `claude plugin configure mixture-of-models@mixture-of-models-claude-mod --values-stdin`، مع عنوان البوابة ومفتاحها على stdin، لحفظهما؛ وعند `/route update`، حين يُنشر إصدار أحدث، ‏`claude plugin marketplace update mixture-of-models-claude-mod` ثم `claude plugin update mixture-of-models@mixture-of-models-claude-mod`) و `codex` (‏Codex CLI، ‏`codex exec`، فقط لمسارات `codex`). لا تشغّل الإضافة أي shell، ولا أي سكربت مضمَّن في مجلد الإضافة، ولا أي مشغّل حزم، ولا أي ملف تنفيذي آخر.

**لماذا:** يستطيع المود إعادة تسمية النموذج في طلب لكنه لا يستطيع تغيير نقطة النهاية أو بيانات الاعتماد للجلسة التي يعمل فيها. الطريقة الوحيدة لتشغيل دور على نقطة نهاية مختلفة بأدوات Claude Code نفسها، مع ترك نقطة نهاية الجلسة الرئيسية وبيانات اعتمادها دون مساس، هي عملية Claude Code ثانية تشير بيئتها إلى البوابة. توجد العملية الفرعية لهذا السبب وحده، وفقط للأدوار التي توجّهها الدرجة بعيدًا عن الجلسة الرئيسية. والمنطق نفسه يغطي نموذج Claude مختلفًا (لا يُعاد تسمية الجلسة الرئيسية أبدًا، لذا يعمل عضو آخر في عمليته الخاصة) و Codex (أداة CLI لوكيل مختلف، لا تعمل إلا بوصفها عملية مستقلة).

**كيف:** أربعة استدعاءات `$.process.run` في `turn.step`، تشغيل أول وتشغيل مستأنف لكل برنامج، كلٌّ منها باسم برنامجه وأعلامه الثابتة نصًا حرفيًا عند الاستدعاء: `claude` و `codex`. تُفحص القيم الديناميكية أولًا (راجع [البرامج التي تشغلها الإضافة](#البرامج-التي-تشغلها-الإضافة)). وسائط `claude` لمسار بوابة:

```
claude -p --model <routed model id> --output-format stream-json --verbose --max-turns <child.maxTurns> --add-dir <session cwd> --bare --permission-mode acceptEdits
```

لمسار `claude/<member>` يعمل البرنامج نفسه مع `--model <member id>` و `child.subscriptionArgs` (‏`--permission-mode acceptEdits`) بدلًا من `child.args`، أي بلا `--bare`، وتكون بيئته `MAGGY_ROUTER_CHILD=1` إضافة إلى `ANTHROPIC_BASE_URL` مضبوطًا فارغًا، فيعمل عبر تسجيل دخولك إلى Claude.

لمسار `codex` يكون البرنامج `codex`، مع الوسائط المعروضة تحت [Codex كعملية فرعية](#codex-كعملية-فرعية) (و، فقط بعد أن توافق على أمر مرفوض، `exec -C <cwd> resume … <thread> -` كما هو موصوف هناك)، والموجز على stdin، والبيئة `MAGGY_ROUTER_CHILD=1` إضافة، على مسار البوابة فقط، إلى المفتاح في `PALGU_API_KEY` (‏`OPENROUTER_API_KEY` على OpenRouter، و `LITELLM_API_KEY` على LiteLLM)، و `child.timeoutMs` نفسه.

للعمليات الفرعية للبوابة ولأعضاء Claude، وفقط بعد أن توافق على أمر منقول إليك (انظر أدناه)، يعمل البرنامج نفسه مرة أخرى مع إلحاق `--resume <that child's session id> --allowedTools <the approved patterns>`، فتتابع العملية الفرعية نفسها. يُبقي `--bare` خطافاتك وإضافاتك وسلسلة المفاتيح (keychain) خارج العملية الفرعية. ويحل `child.args` محل الأعلام الثلاثة الأخيرة إذا ضبطته. تضيف بيئة العملية الفرعية للبوابة `ANTHROPIC_BASE_URL`، والمفتاح في `ANTHROPIC_API_KEY` مع `ANTHROPIC_AUTH_TOKEN` فارغًا (Palgu، عامة) أو في `ANTHROPIC_AUTH_TOKEN` مع `ANTHROPIC_API_KEY` فارغًا (OpenRouter، LiteLLM)، و `ANTHROPIC_CUSTOM_HEADERS` (أدناه)، و `CLAUDE_CODE_MAX_RETRIES` (‏`child.maxRetries`) و `MAGGY_ROUTER_CHILD=1`؛ أما العمليات الفرعية لأعضاء Claude و Codex فلا تحصل على ترويسات تعريفية. يُكتب الموجز إلى stdin الخاص بها. وتعمل في مجلد عمل الجلسة بأدوات Claude Code تحت وضع الأذونات ذاك، لذا تستطيع قراءة الملفات وتعديلها هناك وتشغيل الأوامر التي يسمح بها الوضع؛ وتلك الأوامر قرارات وكيل العملية الفرعية نفسها، يحكمها نظام أذونات Claude Code، لا أوامر تصدرها هذه الإضافة. وتُقتل عند `child.timeoutMs`.

### الترويسات التي ترسلها العملية الفرعية

كل طلب ترسله العملية الفرعية إلى بوابة Palgu أو بوابة عامة يحمل ترويستين، كي تعرض لوحة تحكم Palgu حركة مرورها بوصفها Mixture-of-Models، لكل مشروع. على OpenRouter و LiteLLM، اللتين لا تقرآنهما، تُحذفان ولا تُرسل إلا ترويسات `ANTHROPIC_CUSTOM_HEADERS` الخاصة بك:

```
x-srooter-client: mixture-of-models/0.16.0
x-srooter-project: <the session folder's name>
```

المشروع هو آخر جزء من مجلد عمل الجلسة، محوَّلًا إلى slug بالطريقة التي يكتشف بها البوابة المشاريع: أي شيء خارج `[A-Za-z0-9._-]` يصبح `-`، وتُحذف `-._` البادئة واللاحقة، و64 حرفًا كحد أقصى، بأحرف صغيرة (`/Users/me/My App` → `my-app`). حين لا يتبقى شيء صالح، تُحذف الترويسة. لا تحمل أي من الترويستين مسارًا أو نص مطالبة أو أي شيء آخر.

توضعان في `ANTHROPIC_CUSTOM_HEADERS` الخاص بالعملية الفرعية (قائمة `Name: value` في Claude Code مفصولة بأسطر جديدة)، وتُضبطان في المكان نفسه الذي يُضبط فيه `ANTHROPIC_BASE_URL`: لا بوابة مضبوطة، لا ترويسات، والعملية الفرعية لا تتحدث إلا إلى تلك البوابة. إذا كنت قد ضبطت `ANTHROPIC_CUSTOM_HEADERS` مسبقًا، فأسطرك تأتي أولًا ويُحتفظ بها؛ و `x-srooter-client` أو `x-srooter-project` الخاصة بك تتغلب على ما يضعه المود. طلبات الجلسة الرئيسية لا تتغير.

العملية الفرعية ذات النموذج الموجَّه ترسل أيضًا `x-srooter-pin: <model>` ليخدمها Palgu بذلك النموذج تحديدًا، و `x-palgu-fallback: auto` لتتمكن البوابة عند الضغط الزائد من نقل الطلب المثبَّت إلى نموذج مكافئ بدل إفشاله. وتكون الأولوية لـ `x-palgu-fallback` الذي تضبطه بنفسك في `ANTHROPIC_CUSTOM_HEADERS`.

### الملفات ومتغيرات البيئة التي تقرؤها

- ‏`~/.claude/model-config.json`، عبر `$.fs.read`، للمسارات والعتبات والاسم المستعار للمصنِّف وإعدادات العملية الفرعية. لا يحتوي على بيانات اعتماد. إذا كان مفقودًا أو غير صالح، تُطبَّق الافتراضيات.
- ‏`~/.claude/mixture-of-models/strategies/*.md`، عبر `$.fs.list` و `$.fs.read`، لاستراتيجيات التوجيه الخاصة بك، عند بدء الجلسة وعند `/route strategy` أو `/route strategies`.
- متغيرات البيئة `HOME` و `HOSTNAME` (لاسم جهاز Palgu) و `MAGGY_ROUTER_CHILD` و `ANTHROPIC_CUSTOM_HEADERS` (للإبقاء على ترويساتك المخصصة في العملية الفرعية)، عبر `$.env.get`.
- لا شيء آخر. لا يُقرأ مفتاح البوابة أبدًا من ملف أو من البيئة؛ بل يأتي فقط من خيار `gateway_key` في الإضافة، الذي يحفظه Claude Code في التخزين الآمن.

### ما تخزنه

في المخزن الخاص بالإضافة (`$.store`، تحت `~/.claude/plugins/store/`): معرّف تثبيت عشوائي لتسجيل الدخول إلى Palgu (`palgu-install-id`، كي يرى Palgu جهازًا واحدًا عبر عمليات تسجيل الدخول)، ومجلدات المشاريع المفعَّلة فيها ذاكرة Palgu ومتى فُهرس كلٌّ منها آخر مرة (مسار مجلده)، وآخر قائمة نماذج خدمها Palgu، وتثبيت `/route`، والأعداد اليومية لكل نموذج، وآخر حكم، وأعداد الإخفاقات لكل نوع، وآخر تحقق من التحديثات (متى، والإصدار الذي أدرجه GitHub، والإصدار الذي أُبلغت به)، وسجلًا لآخر 200 قرار (اليوم، النموذج، النوع، المستوى، الدرجة، مصدر المصنِّف، مدة العملية الفرعية ورمز خروجها). لا نص مطالبات، ولا إجابات، ولا بيانات اعتماد.

### ما لا تفعله أبدا

لا تكتب أبدًا إلى ملفات الإعدادات، ولا إلى `model-config.json` ولا إلى `~/.codex`، ولا تغيّر أبدًا نموذج الجلسة الرئيسية أو نقطة نهايتها أو بيانات اعتمادها، ولا تتعامل أبدًا مع استدعاءات الأدوات، ولا ترسل بيانات أبدًا إلى أي مكان غير المضيفين المدرجين أعلاه: وجهتا المصنِّف، و Palgu و GitHub للأوامر التي تسمّيهما، والبوابة التي ضبطتها.

## الضبط

يقرأ المود مصدر الحقيقة الوحيد لدى Maggy، ‏`~/.claude/model-config.json`، ويضيف كتلة `router` اختيارية. ولا يكتب في ذلك الملف أبدًا.

```json
{
  "primary": "glm",
  "router": {
    "provider":   "auto",
    "routes":     { "simple": "glm-5.3", "coding": "glm-5.3", "critical": "claude",
                    "kinds": { "research": "deepseek-pro", "review": "deepseek-pro", "multimodal": "claude" } },
    "thresholds": { "simple": 3, "coding": 7 },
    "ollama":     { "model": "qwen2.5-coder:3b" },
    "classifier": "claude-haiku-5-5",
    "child": {
      "baseUrl":  "https://api.palgu.ai/anthropic",
      "args":     ["--bare", "--permission-mode", "acceptEdits"],
      "subscriptionArgs": ["--permission-mode", "acceptEdits"],
      "deny":     [],
      "maxTurns": 25,
      "timeoutMs": 600000,
      "maxRetries": 2,
      "fallbacks": 3,
      "longContext": [],
      "contextMessages": 12,
      "relayRounds": 2
    },
    "families": {
      "claude": { "members": { "fable": "claude-fable-5-1", "opus": "claude-opus-5-5", "sonnet": "claude-sonnet-5-5", "haiku": "claude-haiku-5-5" },
                  "auto":    { "simple": "haiku", "coding": "sonnet", "critical": "opus" } },
      "kimi":   { "members": { "pro": "kimi-k3.1-pro", "highspeed": "kimi-k3.1-pro-highspeed" },
                  "auto":    { "simple": "highspeed", "coding": "pro", "critical": "pro" } }
    },
    "codex":   { "auth": "palgu", "baseUrl": "", "sandbox": "read-only", "allowOutsideGit": false, "args": [] },
    "ui":      { "band": true, "tags": "routed" },
    "summary": true
  }
}
```

إعداد يضع كل مستوى على عضو من Claude، مع Fable للأدوار الأصعب و Codex للمراجعات:

```json
{ "router": {
    "routes":   { "simple": "claude/auto", "coding": "claude/auto", "critical": "claude/auto", "kinds": { "review": "codex" } },
    "families": { "claude": { "auto": { "criticalPlus": "fable" } } } } }
```

- ‏`routes`: المستوى ← معرّف نموذج تخدمه البوابة، إضافة إلى `routes.kinds`: النوع ← نموذج للمستويات غير الحرجة. ‏`"claude"` تعني الجلسة الرئيسية.
- ‏`primary` (النموذج المتَّبَع في Maggy، يُضبط عبر `/model-config`): ‏`glm` أو `kimi` أو `deepseek` يجعل مستوى `coding` يتبعه ما لم يُضبط `routes.coding`. أما `primary: claude` فلا يغيّر شيئًا: `critical` على Claude أصلًا، و `coding` يبقى رخيصًا ما لم تضبط `routes.coding` على `"claude"`.
- ‏`thresholds`: نقاط قطع درجة الضرر، `{ "simple": 3, "coding": 7 }` افتراضيًا.
- ‏`classifier`: نموذج Claude المستخدم حين يتعذر الوصول إلى Ollama. أسماء مستعارة بلا تاريخ فقط (`claude-haiku-5-5`، `claude-sonnet-5`، `claude-opus-5`).
- ‏`provider`: مزوّد البوابة حين يكون خيار `gateway_provider` في الإضافة غير مضبوط أو `auto`: ‏`palgu` أو `openrouter` أو `litellm` أو `anthropic-compatible`. إذا لم يُضبط، يُكتشف من عنوان البوابة (راجع [الإعداد](#الإعداد)). يختار `routes` و `families` الافتراضية، وأزرار الشريط ومصادقة العملية الفرعية؛ وأي شيء تضبطه في `routes` أو `families` يظل هو الغالب.
- ‏`child.baseUrl`: بديل لعنوان البوابة حين يكون خيار `gateway_url` في الإضافة غير مضبوط. لا بديل للمفتاح؛ فهو يأتي فقط من خيار `gateway_key`.
- ‏`child.auth`: ‏`x-api-key` (‏`ANTHROPIC_API_KEY`) أو `bearer` (‏`ANTHROPIC_AUTH_TOKEN`)، يُضبط من المزوّد؛ اضبطه بنفسك لبوابة عامة تريد توكن bearer. ‏`child.identify`: أرسل ترويسات `x-srooter-*` (مفعّل لـ Palgu والبوابات العامة).
- ‏`child.args`: أعلام إضافية. الافتراضي هو `--bare` (بلا خطافات أو إضافات موروثة، ومصادقة بمفتاح API فقط، فلا يمكن للعملية الفرعية أبدًا أن ترجع إلى اشتراكك) إضافة إلى `acceptEdits` كي تستطيع تعديل الملفات بلا سؤال. يضيف المود دائمًا `--add-dir <cwd>`، الذي يبقي `CLAUDE.md` الخاص بالمشروع في المتناول تحت `--bare`. أضف `--dangerously-skip-permissions` فقط إن أردت أن تشغّل العملية الفرعية الأوامر دون رقابة؛ واحذف `--bare` إن أردت خطافاتك وإضافاتك داخل العملية الفرعية.
- ‏`child.maxTurns`، `timeoutMs`: ميزانية العملية الفرعية الوكيلية. يتوقف `timeoutMs` عند عشر دقائق، وهو حد `$.process.run`.
- ‏`child.maxRetries`: كم مرة تعيد العملية الفرعية للبوابة محاولة طلب فشل بخطأ 429 أو 5xx (الافتراضي 2؛ الافتراضي في Claude Code نفسه 10، وهو ما استغرق دقائق مقابل مزوّد مشغول). ارفعه إن كانت بوابتك تشهد انقطاعات قصيرة تفضّل تجاوزها على الرجوع إلى البديل.
- ‏`child.fallbacks`: كم نموذجًا مكافئًا يجرّبه المود بنفسه بعد فشل العملية الفرعية للبوابة وقبل أن يتولى النموذج الرئيسي الدور (الافتراضي 3؛ و 0 يوقفه). على Palgu الفئة نفسها أولًا، ثم النماذج السليمة الأخرى. انظر «عندما تفشل العملية الفرعية» أعلاه.
- ‏`child.longContext`: نماذج البوابة التي ينتقل إليها الموجّه الأطول من نافذة النموذج الموجَّه. فارغة افتراضيًا: عندها تُستخدم النماذج السليمة التي تكون نافذة سياقها، كما تذكرها قائمة Palgu الحية، أكبر من نافذة النموذج الذي فشل، الأكبر أولًا. من دون Palgu اضبطها بنفسك، وإلا ذهب الموجّه الأطول إلى النموذج الرئيسي.
- ‏`child.contextMessages`: كم تبادلًا حديثًا يدخل في الموجز.
- ‏`child.relayRounds`: كم مرة يجوز لدور موجَّه واحد أن يتوقف ليسألك عن أوامر رُفضت للعملية الفرعية (الافتراضي 2).
- ‏`child.deny`: قواعد منع أذونات إضافية في Claude Code لكل عملية Claude فرعية، تُمرَّر عبر `--disallowedTools` بعد `child.args`. تُضاف إلى القائمة المدمجة (`.env`، `.env.*`، `*.pem`، `*.key`، `id_rsa*`، `id_ed25519*`، `secrets/**`)، التي لا يزيلها شيء، لأن `--bare` يتخطى الخطافات التي كانت ستحمي تلك الملفات لولا ذلك.
- ‏`child.subscriptionArgs`: الأعلام لعملية `claude/<member>` فرعية، بدلًا من `child.args`. بلا `--bare` افتراضيًا، لأن `--bare` لا يسمح إلا بالمصادقة بمفتاح API والمقصود هو تسجيل دخولك إلى Claude.
- ‏`families`: لكل عائلة، `members` (الاسم المستعار ← معرّف النموذج الدقيق) و `auto` (المستوى ← الاسم المستعار للعضو، إضافة إلى `criticalPlus` الاختياري للأدوار الحرجة بدرجة 10/10). تُدمج فوق الافتراضيات لكل عائلة؛ واسم عائلة جديد يضيف عائلة بوابة.
- ‏`codex.auth`: ‏`palgu` (الافتراضي؛ `/v1/responses` في بوابتك المضبوطة مع مفتاح بوابتك، أيًّا كان مزوّدها) أو `chatgpt` (تسجيل دخولك أنت إلى Codex). ‏`codex.baseUrl`: عنوان Responses الأساسي إن لم يكن هو المشتق (Palgu: ‏`/anthropic` → `/v1`؛ OpenRouter و LiteLLM: ‏`<gateway_url>/v1`). ‏`codex.sandbox`: ‏`read-only` (الافتراضي) أو `workspace-write` أو `danger-full-access`، راجع [صندوق الحماية والموافقات](#صندوق-الحماية-والموافقات). ‏`codex.allowOutsideGit`: أضف `--skip-git-repo-check` (الافتراضي `false`). ‏`codex.args`: أعلام إضافية؛ وأعلام صندوق الحماية والموافقة فيه تُتجاهل.
- ‏`strategy`: استراتيجية التوجيه التي يُبدأ بها، مدمجة (`complexity`، `cost`، `speed`، `quality`) أو اسم أحد ملفاتك؛ واختيار `/route strategy` هو الغالب. راجع [استراتيجيات التوجيه](#استراتيجيات-التوجيه-وجه-حسب-التعقيد-أو-التكلفة-أو-السرعة-أو-الجودة-أو-قواعدك-الخاصة).
- ‏`prices`: الدولارات لكل مليون توكن لنماذج البوابة، من أجل [تقدير التوفير](#كم-يوفر)، مثلًا `{ "glm-5.3": { "input": 0.6, "output": 2.2 } }` (مع `cacheRead` الاختياري، والافتراضي عُشر سعر الإدخال، و `cacheWrite`). المدخل هنا يتغلب على عرض السعر الخاص بـ Palgu. والنموذج الذي لا سعر له على بوابة ليست Palgu يُحتسب غير مسعَّر.
- ‏`heartbeat`: استكمال الجلسة الرئيسية حين تتوقف في منتصف المهمة. ‏`palgu` (الافتراضي: يقرر Palgu حين يكون هو بوابتك، ويعمل المصنِّف نفسه محليًا في غير ذلك أو حين لا يجيب Palgu)، أو `local` (لا يسأل Palgu أبدًا) أو `off`. ‏`heartbeatMax`: عدد الاستكمالات لكل مطالبة منك (الافتراضي 3).
- ‏`ui.band`: ارسم الشريط فوق المطالبة (الافتراضي `true`). ‏`ui.tags`: أي الردود تحصل على وسم المصدر، `routed` (الافتراضي) أو `all` أو `off`.

## الأوامر

| الأمر | الأثر |
| :- | :- |
| `/palgu login` | أنشئ حسابًا أو سجّل الدخول إلى Palgu من الطرفية: وافق على رمز في المتصفح، فيحفظ المود مفتاح Palgu الخاص به ويبدأ التوجيه فورًا |
| `/palgu status` | لمن ينتمي المفتاح وخطة المؤسسة |
| `/palgu upgrade` | صفحة خطط Palgu والفوترة |
| `/palgu memory on`، `off`، `memory` | فهرس هذا المشروع في ذاكرة Palgu في الخلفية عبر `palgu` CLI (يرفع شيفرته المصدرية؛ معطّل افتراضيًا) واستدعه إلى كل مطالبة، لـ Claude ولكل نموذج موجَّه إليه؛ أو أوقف ذلك؛ أو قل ما إذا كان مفهرسًا ومدى حداثته |
| `/route update` | تحقق من GitHub من وجود إصدار أحدث، وإن وُجد، شغّل `claude plugin marketplace update` و `claude plugin update` نيابةً عنك؛ ثم يحمّله `/reload-plugins` |
| `/route models` | النماذج التي يخدمها Palgu الآن وأيها متوقف؛ ويمكن تثبيت أي منها عبر `/route <model>`. يحتفظ الشريط بزر واحد لكل عائلة يعرفها المود. من دون Palgu (أو حين لا يجيب) تُستخدم القائمة المدمجة |
| `/route strategies`، `/route strategy <name>` | اعرض استراتيجيات التوجيه (complexity و cost و speed و quality واستراتيجياتك) أو بدّل إلى إحداها |
| `/route help` (أو `0` على الشريط) | ما يفعله المود، وأين يقف الآن، وكل زر وأمر، وكيف تربط مزوّدًا |
| `/route`، `/route status` | حي أو مراقبة فقط، والوضع، والقرار الحالي (مع العائلة والعضو)، وأعداد اليوم، والعائلات وأعضاؤها |
| `/route auto` | صنّف كل مطالبة (الافتراضي) |
| `/route off` | لا تبدأ عملية فرعية أبدًا |
| `/route simple\|coding\|critical` | ثبّت مستوى |
| `/route reset` | امسح ذاكرة الإخفاقات لكل نوع |
| `/route stats` | افتح لوحة الإحصاءات: models و kinds و scores و recent |
| `/route glm`، `/route kimi`، `/route kimi-k3.1-pro`، `/route minimax`، `/route gpt`، `/route claude` | ثبّت نموذجًا (البادئة تتوسع إلى النموذج المضبوط، ثم إلى نموذج بوابة معروف) |
| `/route claude/sonnet`، `/route kimi/highspeed`، `/route codex/gpt-5.6-terra` | ثبّت عضو عائلة (‏`claude/sonnet` يعمل عبر تسجيل دخولك إلى Claude) |
| `/route claude/auto`، `/route kimi/auto`، `/route codex/auto` | ثبّت عائلة؛ تظل كل مطالبة تُقيَّم ويختار المستوى العضو |
| `/route codex` | ثبّت Codex على نموذجه الافتراضي |

‏`/status` أمر Claude Code نفسه ولا يستطيع مود الإضافة إليه؛ و `/route status` هو المكافئ لدى المود، وسطر التوجيه تحت كل إجابة يسمّي العائلة والعضو (`route: claude-sonnet-5-5 (claude/auto → sonnet) · coding 5/10 code via ollama · child 9s`).

تستمر التثبيتات عبر الجلسات في مخزن الإضافة.

## ما تستطيع العملية الفرعية فعله وما لا تستطيع

- تملك أدوات Claude Code وتعمل في مجلد عمل الجلسة، لذا تستطيع القراءة والتعديل وتشغيل الأشياء. لا تظهر استدعاءات أدواتها في سجل المحادثة الرئيسي، بل نصها النهائي فقط.
- حين تحتاج إلى أمر لا يسمح به وضع أذوناتها (`git pull`، `npm install`، عملية نشر)، لا تستطيع سؤالك بنفسها. ينقل المود الطلب: يظهر لك حوار الأسئلة في Claude Code مسمّيًا الأمر بالضبط، و "Allow and continue" يستأنف العملية الفرعية نفسها مع السماح بذلك الأمر وحده. الأوامر التي تقرأ فقط مثل `git status` أو `git log` تعمل أصلًا دون سؤال.
- لا تشارك ذاكرة الجلسة الرئيسية. يحمل الموجز آخر `contextMessages` تبادل (12 افتراضيًا، كلٌّ منها مقتطع إلى 1,200 حرف) والمهمة. ولهذا لا تذهب المتابعات أبدًا إلى عملية فرعية: راجع [كيف يقرر](#كيف-يقرر).
- تعمل بـ `--bare` افتراضيًا، لذا تبقى خطافاتك وإضافاتك خارجها، بما في ذلك أي خطاف يحمي الأسرار. لا تستطيع قراءة ملفات `.env` أو المفاتيح أو مجلدات `secrets/`: يمرّر المود قواعد منع أذونات لها (ويضيف `child.deny` المزيد)، ويفرضها Claude Code نفسه، لا خطاف. ويكتشف المود أيضًا العلامة `MAGGY_ROUTER_CHILD` ولا يفعل شيئًا داخل عملية فرعية.
- الوسم وسطر التوجيه يسمّيان النموذج الذي **طلبه** المود. البوابة التي توجّه وفق النية، كما يفعل palgu، قد تجيب بنموذج آخر؛ ومخرجات `-p` في Claude Code لا تكشف أيّها، لذا لا يستطيع المود عرضه.
- تصل المخرجات حين تنتهي العملية الفرعية؛ يستخدم هذا الإصدار `$.process.run`، لذا لا تُبث الإجابة الموجَّهة توكنًا بتوكن.

## سجل التغييرات

لكل إصدار قسم مؤرَّخ في [CHANGELOG.md](../../../CHANGELOG.md)، يُكتب في الإيداع (commit) نفسه الذي فيه التغيير. يفشل CI إذا لم يكن للإصدار الموجود في `plugin.json` مدخل (`npm run changelog`).

## الاختبارات

```bash
npm test                           # اختبارات الدوال النقية تحت Node، بلا حاجة إلى Claude Code
claude plugin validate --strict .  # البيان (manifest) + تحليل ثابت لملف الخطافات
claude plugin test                 # يتطلب v2.1.287+؛ يطلق الأحداث عبر الخطافات بلا جلسة ولا شبكة
```

‏`tests/classify` و `config` و `providers` و `routing` و `families` و `codex` و `stats` و `child` و `ui` تغطي المنطق النقي في `hooks/lib/`. ‏`tests/mod.test.ts` يقود الخطافات من البداية إلى النهاية: مطالبة بسيطة تجيب عنها عملية فرعية مع البوابة في بيئتها والموجز على stdin، ومطالبة حرجة لا تبدأ عملية فرعية أبدًا، وعملية فرعية فاشلة ترجع إلى النموذج الرئيسي، والمفتاح المفقود يعني المراقبة فقط، وجلسة العملية الفرعية تعطّل المود، و `/route off` و `/route kimi` يتصرفان كما يجب. ‏`tests/compliance.test.ts` يتحقق مما يصل إلى `$.process.run`: البرنامج والأعلام الحرفية، ومعرّف نموذج مرفوض، وأمرا التحديث الثابتان، ومفتاح Palgu ليس توكنًا واحدًا بسيطًا.

## بنية المستودع

```
mixture-of-models-claude-mod/
├── .claude-plugin/
│   ├── plugin.json         # بيان الإضافة (manifest)
│   └── marketplace.json    # يتيح لـ `claude plugin install` إيجادها في هذا المستودع
├── docs/adr/               # القرارات المعمارية (0001: التفويض عبر عملية فرعية، 0002: العائلات و Codex، 0003: مزوّدو البوابات)
├── scripts/test-pure.mjs   # يشغّل الاختبارات النقية تحت Node
├── hooks/
│   ├── hooks.json          # يشير إلى register.js
│   ├── register.js         # تسجيلات الخطافات الـ 11؛ الملف الوحيد الذي يلمس واجهة المودات ($)
│   └── lib/                # نقية، مختبرة باختبارات الوحدة
│       ├── config.js       # الافتراضيات وطبقة model-config.json
│       ├── providers.js    # Palgu و OpenRouter و LiteLLM والعامة: الاكتشاف، مصادقة العملية الفرعية، الفهارس
│       ├── classify.js     # قواعد Maggy السابقة للتوجيه، مطالبة المصنِّف، صيغة Ollama
│       ├── routing.js      # المستوى ← النموذج، قواعد صياغة /route، سطر الملخص
│       ├── families.js     # <family>/<member>، <family>/auto، أي مشغّل يخدم مسارًا ما
│       ├── codex.js        # argv و env لـ codex exec، الجاهزية، مخرجات JSONL
│       ├── child.js        # argv العملية الفرعية، البيئة المحصورة والترويسات التعريفية، الجاهزية، تحليل ملفات env، الموجز وديباجته
│       ├── version.js      # إصدار المود، من أجل x-srooter-client
│       ├── vet.js          # يتجاهل الإعادات، وطلبات أن تتصرف أنت، والادعاءات غير المتحقق منها، والسرد، والتكرار
│       └── stats.js        # الأعداد اليومية
└── tests/
```

تتطلب المودات أن يكون كل استدعاء لـ `$` في `register.js` (تمرير `$` إلى ملف آخر يُفشل `claude plugin validate`)، ولهذا يحتوي ذلك الملف على دوال أكثر من الحد المعتاد.

## لماذا عملية فرعية

راجع [ADR 0001](../../adr/0001-child-process-delegation.md). باختصار: يستطيع المود إعادة تسمية نموذج الطلب لكنه لا يستطيع تغيير وجهته، وقد رُفض توجيه توكن الاشتراك عبر وكيل (proxy). العملية الفرعية ببيئتها الخاصة هي الفصل النظيف.

## المقابلة مع Maggy

| Maggy | هنا |
| :- | :- |
| `hooks/route-task-hook` (UserPromptSubmit، مصنِّف qwen3، حارس الاستمرار، تخزين مؤقت) | `prompt.submit` + `lib/classify.js`، و `$.http.fetch` إلى Ollama، وتخزين مؤقت عبر `$.store` |
| "You MUST delegate — run ~/bin/glm" (يجب أن تفوّض — شغّل ~/bin/glm) مُحقَن في السياق | `turn.step` يشغّل العملية الفرعية ويعيد إجابتها؛ ولا يُطلب من Claude أبدًا أن يفوّض |
| مشغّلات `~/bin/claude-<provider>` من `model_routing.py write-launcher` | يحصر المود `ANTHROPIC_BASE_URL` والمفتاح في بيئة العملية الفرعية بنفسه |
| `hooks/usage-summary-hook` (Stop) | `turn.complete` يعيد سطر الملخص |
| النموذج المتَّبَع في `/model-config` | `primary` في `model-config.json` يقود مستوى `coding` |
| بوابة `palgu` | نقطة نهاية العملية الفرعية؛ والجلسة الرئيسية لا تراها أبدًا |

جرى الاختبار مع Claude Code 2.1.274 لـ `claude plugin validate` فقط؛ والأنواع المستخدمة من تصريحات 2.1.277. تحقق من `.claude-plugin/types/` بعد أول تحميل على إصدار أحدث، ولا سيما ما إذا كان `$.process.spawn` متاحًا لبث مخرجات العملية الفرعية.

</div>
