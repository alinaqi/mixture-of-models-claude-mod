# Mixture of Models in Aider, Continue und Goose

[English](../../../../../integrations/gateway/README.md) · [简体中文](../../../zh-CN/integrations/gateway/README.md) · [日本語](../../../ja/integrations/gateway/README.md) · **Deutsch** · [Français](../../../fr/integrations/gateway/README.md) · [العربية](../../../ar/integrations/gateway/README.md)

*Dies ist eine Übersetzung; die englische Version ist maßgeblich und möglicherweise aktueller.*

Diese Agents haben keine Hooks oder Plugins, die `mom` nutzen kann, daher bekommen sie nur Palgus Routing: Lassen Sie sie auf Palgus OpenAI-kompatiblen Endpoint mit dem Modell `auto` zeigen, und Palgu wählt das Modell für jeden Request ([ADR 0005](../../../../adr/0005-other-coding-agents.md)). Palgu-Memory-Abruf und der Heartbeat sind hier nicht verfügbar.

Jede Anleitung braucht einen Palgu-Key. Mit installiertem `mom` (`npm install -g github:alinaqi/mixture-of-models-claude-mod`) führen Sie einmal `mom login` aus, danach gibt `mom token` ihn aus.

## Wie Palgu den Request liest

Geprüft gegen `https://api.palgu.ai/v1/chat/completions` am 2026-11-16:

| `model` | Header `x-srooter-pin` | Ergebnis |
| :- | :- | :- |
| `auto` | keiner | Palgu routet (bediente eine Ein-Wort-Antwort mit `deepseek-pro`) |
| ein beliebiges Modell, z. B. `glm-5.3` | keiner | Palgu routet trotzdem: Das Feld model ist kein Pin |
| ein Modell, z. B. `kimi-k3.1-pro` | vorhanden (wir senden dieselbe Modell-ID) | dieses Modell, gepinnt |
| `auto` | vorhanden | abgelehnt, 403 `pin 'auto' not allowed by policy` |

Also: Lassen Sie das Modell auf `auto`, damit Palgu wählt; zum Pinnen setzen Sie das Modell **und** senden `x-srooter-pin`. Ein gepinntes Modell, das ausgefallen ist, antwortet mit 503; wählen Sie ein anderes aus `GET /v1/models/health`.

## Aider

Live geprüft mit aider-chat 0.86.2: `model openai/auto` hat über Palgu eine Änderung an einer Datei vorgenommen.

```bash
export OPENAI_API_KEY="$(mom token)"
aider --openai-api-base https://api.palgu.ai/v1 --model openai/auto
```

Oder in `.aider.conf.yml`:

```yaml
openai-api-base: https://api.palgu.ai/v1
model: openai/auto
```

Benennen Sie den Client in `.aider.model.settings.yml`, damit Palgus Dashboard den Traffic als Mixture of Models anzeigt:

```yaml
- name: aider/extra_params
  extra_params:
    extra_headers:
      x-srooter-client: mixture-of-models-aider/0.27.0
```

Aider kennt das Kontextfenster von `auto` nicht und warnt; teilen Sie es ihm in `.aider.model.metadata.json` mit (oder übergeben Sie `--no-show-model-warnings`):

```json
{ "openai/auto": { "max_input_tokens": 200000, "max_output_tokens": 32000, "input_cost_per_token": 0, "output_cost_per_token": 0, "litellm_provider": "openai", "mode": "chat" } }
```

Um ein Modell zu pinnen, fügen Sie einen Eintrag dafür mit dem Header hinzu und verwenden `--model openai/<model>`:

```yaml
- name: openai/kimi-k3.1-pro
  extra_params:
    extra_headers:
      x-srooter-pin: kimi-k3.1-pro
```

Aiders Architect-Modus (`--architect --editor-model openai/auto`) sendet Planung und Bearbeitung als getrennte Requests, die Palgu getrennt routet.

## Continue

Hier nicht ausgeführt; aus Continues Konfigurationsreferenz (`config.yaml`):

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

Lassen Sie die Autovervollständigung auf einem eigenen Modell (einem kleinen, schnellen, gepinnt mit `model: <id>` und dem Header `x-srooter-pin: <id>`), da Palgus Routing für Chat-Turns gedacht ist.

## Goose

Hier nicht ausgeführt; aus Gooses Provider-Doku (der OpenAI-Provider mit eigenem Host):

```bash
export GOOSE_PROVIDER=openai
export GOOSE_MODEL=auto
export OPENAI_HOST=https://api.palgu.ai
export OPENAI_BASE_PATH=v1/chat/completions
export OPENAI_API_KEY="$(mom token)"
goose session
```

## Was es hier nicht gibt

- Palgu-Memory-Abruf und der Heartbeat brauchen einen Hook, der Kontext hinzufügt oder einen Turn fortsetzt; diese Agents haben keinen. Verwenden Sie dafür Codex, Cursor oder OpenCode mit `mom`.
- Der Key in diesen Konfigurationen ist ein einfacher Wert oder eine Umgebungsvariable; halten Sie ihn aus Dateien heraus, die Sie committen.
