# 适用于 Antigravity 的 Mixture of Models

[English](../../../../../integrations/antigravity/README.md) · **简体中文** · [日本語](../../../ja/integrations/antigravity/README.md) · [Deutsch](../../../de/integrations/antigravity/README.md) · [Français](../../../fr/integrations/antigravity/README.md) · [العربية](../../../ar/integrations/antigravity/README.md)

*本文为译文；以英文版为准，英文版可能更新。*

在 Google 的 Antigravity CLI（`agy`）中提供：召回到每条提示词中的 Palgu 记忆、继续在任务中途停下的轮次的心跳，以及作为工具的 Palgu 模型（[ADR 0005](../../../../adr/0005-other-coding-agents.md)）。

已在 agy 1.0.7 上实测。

## 安装

```bash
npm install -g github:alinaqi/mixture-of-models-claude-mod   # 安装 mom 和本插件的文件
mom login                                                     # 登录 Palgu
agy plugin install "$(npm root -g)/mixture-of-models-claude-mod/integrations/antigravity"
agy plugin list                                               # mixture-of-models，已启用
```

然后，在你希望纳入 Palgu 记忆的项目中运行：`mom memory on`（会把源代码上传到 Palgu；默认关闭，按文件夹设置，并与 `mom` 服务的其他 agent 共享）。

## 它做什么

| | 如何实现 | Antigravity 功能 |
| :- | :- | :- |
| **Palgu 记忆** | 在开启记忆的文件夹中，每个轮次的第一次模型调用时，会为模型加入最多 8 条来自项目 Palgu 记忆的线索（记录的意图和 ADR、文档、代码符号）。 | `PreInvocation`（`invocationNum` 0）→ `injectSteps` `ephemeralMessage` |
| **心跳** | 在任务中途结束的轮次（"Let me check the tests."）会被继续，每条提示词最多 3 次。由 Palgu 判断（`POST /anthropic/heartbeat`）；未登录时，同样的分类器在本地运行。`mom heartbeat off` 可关闭它。 | `Stop` → `decision: "continue"`；回答从对话记录中读取，因为 Stop 的输入不包含回答 |
| **索引** | 在开启记忆的文件夹中，会话开始时在后台运行 `palgu memory index .`，最多每 10 分钟一次。 | `SessionStart` |
| **作为工具的 Palgu 模型** | `palgu_memory_search`、`palgu_delegate`（把自成一体的子任务交给 Palgu 模型，`auto` 或固定模型）和 `palgu_models`，并有一条始终启用的规则说明何时使用它们。 | `mcp_config.json`（`mom mcp antigravity`）、`rules/AGENTS.md` |

每个 hook 都是 fail-open 的：如果 `mom` 出错或 Palgu 响应慢，`agy` 会像没有 hook 一样继续工作。

## 路由

Antigravity 的 hook 无法更改模型，而它自己的模型设置只接受 Gemini 模型（或管理员配置的企业模型网关）。因此 agent 自己的轮次始终使用你在 `agy` 中选择的 Gemini 模型；Palgu 的路由通过 `palgu_delegate` 起作用，规则会告诉 agent 把低风险、自成一体的子任务交给它。

## 它向哪里发送什么

- 发往 `https://api.palgu.ai/v1/cortex/search`（仅在开启记忆的文件夹中）：提示词（一行，最多 300 个字符）和项目的 Palgu 名称。
- 发往 `https://api.palgu.ai/anthropic/heartbeat`（除非设置了 `mom heartbeat local|off`）：回答的最后 600 个字符和一个会话 id。
- 发往 `https://api.palgu.ai/v1/chat/completions`（仅当 agent 调用 `palgu_delegate` 时）：子任务的提示词。
- 密钥保存在 `~/.config/mixture-of-models/credentials.json`（0600）或 `PALGU_API_KEY` 中；插件的文件中不包含任何密钥。

## 实测与文档不符之处（agy 1.0.7）

- hook 的输入包含 `hookEventName` 和 `cwd`；继续标志是 `continuationActive`。
- 以回答结束的轮次以 `terminationReason: "NO_TOOL_CALL"` 停止（文档写的是 `model_stop`），失败的轮次则为 `ERROR`；只有前者会被继续。
- 对话记录（`transcriptPath`）是 JSONL；模型的回答是 `PLANNER_RESPONSE` 步骤。
- 如果 `agy` 因 `PERMISSION_DENIED on resource project <id>` 而失败，说明 `~/.gemini/antigravity-cli/settings.json` 中的 Google Cloud 项目（`gcp.project`）是你的账号无法使用的：改设一个你能用的项目，或者使用 Gemini API 密钥，配合 `"modelProvider": "gemini"` 和 `GEMINI_API_KEY`。
