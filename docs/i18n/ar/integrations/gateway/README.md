# Mixture of Models في Aider و Continue و Goose

[English](../../../../../integrations/gateway/README.md) · [简体中文](../../../zh-CN/integrations/gateway/README.md) · [日本語](../../../ja/integrations/gateway/README.md) · [Deutsch](../../../de/integrations/gateway/README.md) · [Français](../../../fr/integrations/gateway/README.md) · **العربية**

*هذه ترجمة؛ النسخة الإنجليزية هي المرجع المعتمد وقد تكون أحدث.*

<div dir="rtl">

لا تملك هذه الوكلاء خطافات (hooks) أو إضافات (plugins) يستطيع `mom` استخدامها، لذا لا تحصل إلا على توجيه Palgu: وجّهها إلى نقطة النهاية المتوافقة مع OpenAI في Palgu مع النموذج `auto`، ويختار Palgu النموذج لكل طلب ([ADR 0005](../../../../adr/0005-other-coding-agents.md)). استدعاء ذاكرة Palgu والنبض (heartbeat) غير متاحين هنا.

يحتاج كل دليل إلى مفتاح Palgu. مع تثبيت `mom` ‏(`npm install -g github:alinaqi/mixture-of-models-claude-mod`)، نفّذ `mom login` مرة واحدة ثم يطبعه `mom token`.

## كيف يقرأ Palgu الطلب

جرى التحقق مقابل `https://api.palgu.ai/v1/chat/completions` في 2026-11-16:

| `model` | الترويسة `x-srooter-pin` | النتيجة |
| :- | :- | :- |
| `auto` | لا شيء | يوجّه Palgu (خدم `deepseek-pro` لإجابة من كلمة واحدة) |
| أي نموذج، مثل `glm-5.3` | لا شيء | يظل Palgu يوجّه: حقل النموذج ليس تثبيتًا |
| نموذج، مثل `kimi-k3.1-pro` | موجودة (نرسل معرّف النموذج نفسه) | ذلك النموذج، مثبَّتًا |
| `auto` | موجودة | مرفوض، 403 `pin 'auto' not allowed by policy` (التثبيت على 'auto' غير مسموح به وفق السياسة) |

إذن: اترك النموذج على `auto` ليختار Palgu؛ وللتثبيت، اضبط النموذج **و** أرسل `x-srooter-pin`. النموذج المثبَّت المتوقف يجيب بـ 503؛ اختر غيره من `GET /v1/models/health`.

## Aider

جرى التحقق فعليًا مع aider-chat 0.86.2: ‏`model openai/auto` عبر Palgu طبّق تعديلًا على ملف.

```bash
export OPENAI_API_KEY="$(mom token)"
aider --openai-api-base https://api.palgu.ai/v1 --model openai/auto
```

أو في `.aider.conf.yml`:

```yaml
openai-api-base: https://api.palgu.ai/v1
model: openai/auto
```

سمِّ العميل في `.aider.model.settings.yml`، كي تعرض لوحة تحكم Palgu حركة المرور بوصفها Mixture of Models:

```yaml
- name: aider/extra_params
  extra_params:
    extra_headers:
      x-srooter-client: mixture-of-models-aider/0.27.0
```

لا يعرف Aider نافذة السياق الخاصة بـ `auto` فيُصدر تحذيرًا؛ أخبره بها في `.aider.model.metadata.json` (أو مرّر `--no-show-model-warnings`):

```json
{ "openai/auto": { "max_input_tokens": 200000, "max_output_tokens": 32000, "input_cost_per_token": 0, "output_cost_per_token": 0, "litellm_provider": "openai", "mode": "chat" } }
```

لتثبيت نموذج، أضف له مدخلًا مع الترويسة، واستخدم `--model openai/<model>`:

```yaml
- name: openai/kimi-k3.1-pro
  extra_params:
    extra_headers:
      x-srooter-pin: kimi-k3.1-pro
```

يرسل وضع المعماري (architect) في Aider ‏(`--architect --editor-model openai/auto`) التخطيط والتعديل بوصفهما طلبين منفصلين، يوجّههما Palgu كلًّا على حدة.

## Continue

لم يُشغَّل هنا؛ مأخوذ من مرجع إعدادات Continue ‏(`config.yaml`):

```yaml
models:
  - name: Palgu (auto)
    provider: openai
    model: auto
    apiBase: https://api.palgu.ai/v1
    apiKey: <your key from mom token>
    requestOptions:
      headers:
        x-srooter-client: mixture-of-models-continue/0.27.0
    roles: [chat, edit, apply]
```

أبقِ الإكمال التلقائي على نموذج خاص به (نموذج صغير وسريع، مثبَّت عبر `model: <id>` والترويسة `x-srooter-pin: <id>`)، لأن توجيه Palgu مصمَّم لأدوار المحادثة.

## Goose

لم يُشغَّل هنا؛ مأخوذ من مستندات المزوّدين في Goose (مزوّد OpenAI مع مضيف مخصص):

```bash
export GOOSE_PROVIDER=openai
export GOOSE_MODEL=auto
export OPENAI_HOST=https://api.palgu.ai
export OPENAI_BASE_PATH=v1/chat/completions
export OPENAI_API_KEY="$(mom token)"
goose session
```

## ما ليس متاحًا هنا

- يحتاج استدعاء ذاكرة Palgu والنبض إلى خطاف يضيف سياقًا أو يستكمل دورًا؛ وهذه الوكلاء لا تملك أيًّا منها. استخدم Codex أو Cursor أو OpenCode مع `mom` لذلك.
- المفتاح في هذه الإعدادات قيمة صريحة أو متغير بيئة؛ أبقِه خارج الملفات التي تودعها (commit).

</div>
