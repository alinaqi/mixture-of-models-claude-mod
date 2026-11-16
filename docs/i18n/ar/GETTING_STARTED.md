# البدء

[English](../../../GETTING_STARTED.md) · [简体中文](../zh-CN/GETTING_STARTED.md) · [日本語](../ja/GETTING_STARTED.md) · [Deutsch](../de/GETTING_STARTED.md) · [Français](../fr/GETTING_STARTED.md) · **العربية**

*هذه ترجمة؛ النسخة الإنجليزية هي المرجع المعتمد وقد تكون أحدث.*

<div dir="rtl">

## 1. تحقق من Claude Code

```bash
claude --version     # يتطلب 2.1.287 أو أحدث
# قديم جدًا؟ أحد هذه الخيارات:
brew install --cask claude-code@latest            # Homebrew (الـ cask المستقر متأخر)
npm install -g @anthropic-ai/claude-code@<version>   # npm: إصدار من 2.1.287 فما فوق
claude update                                     # المثبّت الأصلي
```

## 2. التثبيت

نزّل أولًا، واقرأ السكربت، ثم شغّله (لا يفعل سوى استدعاء `claude plugin` ونسخ `config.example.json`):

```bash
git clone https://github.com/alinaqi/mixture-of-models-claude-mod
cd mixture-of-models-claude-mod
less install.sh     # راجعه
./install.sh
```

أو يدويًا:

```bash
claude plugin marketplace add alinaqi/mixture-of-models-claude-mod
claude plugin install mixture-of-models@mixture-of-models-claude-mod
```

أو من داخل جلسة: `/plugin install mixture-of-models --marketplace alinaqi/mixture-of-models-claude-mod`

وإن أردت بدلًا من ذلك التعديل على الشيفرة، فحمّل النسخة المحلية لجلسة واحدة: `claude --plugin-dir .`

## 3. امنح العملية الفرعية بوابة

تحتاج عملية Claude Code الفرعية (child) إلى نقطة نهاية متوافقة مع Anthropic تخدم معرّفات النماذج الموجودة في مساراتك. مع [palgu](https://www.palgu.ai)، داخل جلسة:

```
/plugin configure mixture-of-models@mixture-of-models-claude-mod
```

وأدخل `https://api.palgu.ai/anthropic` ومفتاحك. يُخفى المفتاح ويُحفظ في التخزين الآمن.

أو من الطرفية بدلًا من ذلك: شغّل `claude plugin configure mixture-of-models@mixture-of-models-claude-mod --values-stdin` واكتب `{"gateway_url":"https://api.palgu.ai/anthropic","gateway_key":"<your key>"}` في مدخله، ثم اضغط Ctrl-D، كي يبقى المفتاح خارج سجل أوامر الطرفية.

جلستك الرئيسية **لا** تحتاج إلى `ANTHROPIC_BASE_URL`. تبقى على اشتراكك.

## 4. اختياري: اضبطه

انسخ كتلة `router` من `config.example.json` إلى `~/.claude/model-config.json` لتغيير المسارات أو العتبات أو أعلام (flags) العملية الفرعية. ليس ضروريًا للبدء.

تنبيه واحد: متغير `ANTHROPIC_API_KEY` مُصدَّر في طرفيتك يتجاوز تسجيل الدخول إلى claude.ai في الجلسة الرئيسية. اتركه غير مضبوط إذا كانت الجلسة الرئيسية يجب أن تعمل على اشتراكك.

## 5. اختياري: Codex

لمسارات `codex` ثبّت Codex CLI: ‏`brew install --cask codex` (أو `npm install -g @openai/codex@<version>`). افتراضيًا يعمل على `/v1/responses` في بوابة Palgu الخاصة بك بالمفتاح من الخطوة 3. لاستخدام تسجيل دخولك أنت إلى ChatGPT بدلًا من ذلك، شغّل `codex login` واضبط `"router": { "codex": { "auth": "chatgpt" } }` في `~/.claude/model-config.json`.

## 6. اختياري: تصنيف مجاني

```bash
ollama pull qwen2.5-coder:3b
```

من دون Ollama يرجع المصنِّف إلى `claude-haiku-5-5` ضمن خطتك.

## 7. جرّبه

```
claude
/route                      → live · mode auto · current route ...
grep the repo for TODOs     → spinner shows "via glm-5.3 (child)…", answer comes from the child
/route kimi                 → pin the next turns to Kimi
/route auto                 → back to classification
/route claude/sonnet        → the next turns run on claude-sonnet-5-5, on your Claude login
/route kimi/auto            → the score picks kimi-k3.1-pro-highspeed or kimi-k3.1-pro
/route codex                → the next turns run on the Codex CLI (needs `npm install -g @openai/codex`)
/route status               → mode, current family and member, the families
/route stats                → a pane charting which models took your turns, kinds, scores, recent decisions
```

ما يعنيه كل سطر أعلاه: `/route` يعرض الحالة الحية والوضع والمسار الحالي؛ مطالبة مثل «grep the repo for TODOs» يُظهر مؤشر الانتظار معها "via glm-5.3 (child)…" وتأتي الإجابة من العملية الفرعية؛ `/route kimi` يثبّت الأدوار التالية على Kimi؛ `/route auto` يعيد التصنيف التلقائي؛ `/route claude/sonnet` يشغّل الأدوار التالية على claude-sonnet-5-5 عبر تسجيل دخولك إلى Claude؛ `/route kimi/auto` يجعل الدرجة تختار بين kimi-k3.1-pro-highspeed و kimi-k3.1-pro؛ `/route codex` يشغّل الأدوار التالية على Codex CLI (يتطلب `npm install -g @openai/codex`)؛ `/route status` يعرض الوضع والعائلة والعضو الحاليين والعائلات؛ `/route stats` يفتح لوحة ترسم أي النماذج تولّت أدوارك، والأنواع، والدرجات، والقرارات الأخيرة.

</div>
