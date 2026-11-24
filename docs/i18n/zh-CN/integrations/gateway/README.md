# 在 Aider、Continue 和 Goose 中使用 Mixture of Models

[English](../../../../../integrations/gateway/README.md) · **简体中文** · [日本語](../../../ja/integrations/gateway/README.md) · [Deutsch](../../../de/integrations/gateway/README.md) · [Français](../../../fr/integrations/gateway/README.md) · [العربية](../../../ar/integrations/gateway/README.md)

*本文为译文；以英文版为准，英文版可能更新。*

这些 agent 没有 `mom` 可以利用的 hook 或插件，因此只能获得 Palgu 的路由：把它们指向 Palgu 的 OpenAI 兼容端点，模型设为 `auto`，由 Palgu 为每个请求挑选模型（[ADR 0005](../../../../adr/0005-other-coding-agents.md)）。这里无法使用 Palgu 记忆召回和心跳。

每份指南都需要一个 Palgu 密钥。安装 `mom`（`npm install -g github:alinaqi/mixture-of-models-claude-mod`）后，运行一次 `mom login`，然后 `mom token` 会打印出密钥。

## Palgu 如何解读请求

于 2026-11-16 针对 `https://api.palgu.ai/v1/chat/completions` 验证：

| `model` | `x-srooter-pin` 请求头 | 结果 |
| :- | :- | :- |
| `auto` | 无 | Palgu 进行路由（对一个单词的回答使用了 `deepseek-v4-pro`） |
| 任意模型，例如 `glm-5.3` | 无 | Palgu 仍会路由：model 字段不是固定 |
| 某个模型，例如 `kimi-k3.1-pro` | 有（我们发送相同的模型 id） | 使用该模型，已固定 |
| `auto` | 有 | 被拒绝，403 `pin 'auto' not allowed by policy` |

所以：让 Palgu 选择时，把模型保持为 `auto`；要固定时，设置模型**并且**发送 `x-srooter-pin`。被固定的模型不可用时会返回 503；请从 `GET /v1/models/health` 中另选一个。

## Aider

已在 aider-chat 0.86.2 上实测：通过 Palgu 使用 `model openai/auto` 成功对文件应用了一次编辑。

```bash
export OPENAI_API_KEY="$(mom token)"
aider --openai-api-base https://api.palgu.ai/v1 --model openai/auto
```

或者在 `.aider.conf.yml` 中：

```yaml
openai-api-base: https://api.palgu.ai/v1
model: openai/auto
```

在 `.aider.model.settings.yml` 中标明客户端，这样 Palgu 的控制台会把流量显示为 Mixture of Models：

```yaml
- name: aider/extra_params
  extra_params:
    extra_headers:
      x-srooter-client: mixture-of-models-aider/0.27.0
```

Aider 不知道 `auto` 的上下文窗口，会发出警告；可以在 `.aider.model.metadata.json` 中告诉它（或者传入 `--no-show-model-warnings`）：

```json
{ "openai/auto": { "max_input_tokens": 200000, "max_output_tokens": 32000, "input_cost_per_token": 0, "output_cost_per_token": 0, "litellm_provider": "openai", "mode": "chat" } }
```

要固定一个模型，为它添加一个带请求头的条目，并使用 `--model openai/<model>`：

```yaml
- name: openai/kimi-k3.1-pro
  extra_params:
    extra_headers:
      x-srooter-pin: kimi-k3.1-pro
```

Aider 的 architect 模式（`--architect --editor-model openai/auto`）把规划和编辑作为两个独立请求发送，Palgu 会分别路由。

## Continue

未在此实测；以下来自 Continue 的配置参考（`config.yaml`）：

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

为自动补全单独配置一个模型（一个小而快的模型，用 `model: <id>` 和请求头 `x-srooter-pin: <id>` 固定），因为 Palgu 的路由是为对话轮次设计的。

## Goose

未在此实测；以下来自 Goose 的提供方文档（使用自定义主机的 OpenAI 提供方）：

```bash
export GOOSE_PROVIDER=openai
export GOOSE_MODEL=auto
export OPENAI_HOST=https://api.palgu.ai
export OPENAI_BASE_PATH=v1/chat/completions
export OPENAI_API_KEY="$(mom token)"
goose session
```

## 这里没有的功能

- Palgu 记忆召回和心跳需要一个能添加上下文或继续轮次的 hook；这些 agent 都没有。如需这些功能，请配合 `mom` 使用 Codex、Cursor 或 OpenCode。
- 这些配置中的密钥是明文值或环境变量；不要把它放进你会提交的文件中。
