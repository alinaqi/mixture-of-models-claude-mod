# Mixture of Models in Aider, Continue and Goose

**English** · [简体中文](../../docs/i18n/zh-CN/integrations/gateway/README.md) · [日本語](../../docs/i18n/ja/integrations/gateway/README.md) · [Deutsch](../../docs/i18n/de/integrations/gateway/README.md) · [Français](../../docs/i18n/fr/integrations/gateway/README.md) · [العربية](../../docs/i18n/ar/integrations/gateway/README.md)

These agents have no hooks or plugins that `mom` can use, so they get Palgu's routing only: point them at Palgu's OpenAI-compatible endpoint with the model `auto`, and Palgu picks the model for each request ([ADR 0005](../../docs/adr/0005-other-coding-agents.md)). Palgu memory recall and the heartbeat are not available here.

Every guide needs a Palgu key. With `mom` installed (`npm install -g github:alinaqi/mixture-of-models-claude-mod`), `mom login` once and then `mom token` prints it.

## How Palgu reads the request

Checked against `https://api.palgu.ai/v1/chat/completions` on 2026-11-16:

| `model` | `x-srooter-pin` header | Result |
| :- | :- | :- |
| `auto` | none | Palgu routes (served `deepseek-v4-pro` for a one-word answer) |
| any model, e.g. `glm-5.3` | none | Palgu still routes: the model field is not a pin |
| a model, e.g. `kimi-k3.1-pro` | present (we send the same model id) | that model, pinned |
| `auto` | present | refused, 403 `pin 'auto' not allowed by policy` |

So: leave the model at `auto` to let Palgu choose; to pin, set the model **and** send `x-srooter-pin`. A pinned model that is down answers 503; pick another from `GET /v1/models/health`.

## Aider

Checked live with aider-chat 0.86.2: `model openai/auto` through Palgu applied an edit to a file.

```bash
export OPENAI_API_KEY="$(mom token)"
aider --openai-api-base https://api.palgu.ai/v1 --model openai/auto
```

Or in `.aider.conf.yml`:

```yaml
openai-api-base: https://api.palgu.ai/v1
model: openai/auto
```

Name the client in `.aider.model.settings.yml`, so Palgu's dashboard shows the traffic as Mixture of Models:

```yaml
- name: aider/extra_params
  extra_params:
    extra_headers:
      x-srooter-client: mixture-of-models-aider/0.27.0
```

Aider does not know `auto`'s context window and warns; tell it in `.aider.model.metadata.json` (or pass `--no-show-model-warnings`):

```json
{ "openai/auto": { "max_input_tokens": 200000, "max_output_tokens": 32000, "input_cost_per_token": 0, "output_cost_per_token": 0, "litellm_provider": "openai", "mode": "chat" } }
```

To pin a model, add an entry for it with the header, and use `--model openai/<model>`:

```yaml
- name: openai/kimi-k3.1-pro
  extra_params:
    extra_headers:
      x-srooter-pin: kimi-k3.1-pro
```

Aider's architect mode (`--architect --editor-model openai/auto`) sends planning and editing as separate requests, which Palgu routes separately.

## Continue

Not run here; from Continue's config reference (`config.yaml`):

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

Keep autocomplete on a model of its own (a small, fast one, pinned with `model: <id>` and the header `x-srooter-pin: <id>`), since Palgu's routing is meant for chat turns.

## Goose

Not run here; from Goose's provider docs (the OpenAI provider with a custom host):

```bash
export GOOSE_PROVIDER=openai
export GOOSE_MODEL=auto
export OPENAI_HOST=https://api.palgu.ai
export OPENAI_BASE_PATH=v1/chat/completions
export OPENAI_API_KEY="$(mom token)"
goose session
```

## What is not here

- Palgu memory recall and the heartbeat need a hook that adds context or continues a turn; these agents have none. Use Codex, Cursor or OpenCode with `mom` for those.
- The key in these configs is a plain value or an environment variable; keep it out of files you commit.
