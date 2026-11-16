# 适用于 GitHub Copilot CLI 的 Mixture of Models

[English](../../../../../integrations/copilot/README.md) · **简体中文** · [日本語](../../../ja/integrations/copilot/README.md) · [Deutsch](../../../de/integrations/copilot/README.md) · [Français](../../../fr/integrations/copilot/README.md) · [العربية](../../../ar/integrations/copilot/README.md)

*本文为译文；以英文版为准，英文版可能更新。*

在 GitHub Copilot CLI 中提供：继续在任务中途停下的轮次的心跳、Palgu 记忆，以及作为工具的 Palgu 模型（[ADR 0005](../../../../adr/0005-other-coding-agents.md)）。

已在 Copilot CLI 1.0.112 上实测。

## 安装

```bash
npm install -g github:alinaqi/mixture-of-models-claude-mod   # 安装 mom（插件的 hook 和 MCP 服务器会运行它）
mom login                                                     # 登录 Palgu
copilot plugin install alinaqi/mixture-of-models-claude-mod:integrations/copilot
copilot plugin list                                           # mixture-of-models
```

不安装直接试用：`copilot --plugin-dir "$(npm root -g)/mixture-of-models-claude-mod/integrations/copilot"`。

然后，在你希望纳入 Palgu 记忆的项目中运行：`mom memory on`（会把源代码上传到 Palgu；默认关闭，按文件夹设置，并与 `mom` 服务的其他 agent 共享）。

## 它做什么

| | 如何实现 | Copilot 功能 |
| :- | :- | :- |
| **心跳** | 在任务中途结束的轮次（"Let me check the tests."）会被继续，每条提示词最多 3 次。由 Palgu 判断（`POST /anthropic/heartbeat`）；未登录时，同样的分类器在本地运行。`mom heartbeat off` 可关闭它。 | `agentStop` → `decision: "block"`，以继续提示词作为 `reason`；回答从会话的 `events.jsonl` 中读取，因为 stop 的输入不包含回答 |
| **Palgu 记忆** | agent 用 `palgu_memory_search` 搜索项目的 Palgu 记忆（skill 会告诉它何时搜索）；在开启记忆的文件夹中，会话开始时它会被告知记忆已开启。 | MCP 服务器（`.mcp.json`、`mom mcp copilot`）、`sessionStart` → `additionalContext`、skill `mixture-of-models` |
| **作为工具的 Palgu 模型** | `palgu_delegate` 把自成一体的子任务交给 Palgu 模型（`auto` 或固定模型）；`palgu_models` 列出这些模型。 | MCP 服务器 |
| **索引** | 在开启记忆的文件夹中，会话开始时在后台运行 `palgu memory index .`，最多每 10 分钟一次。 | `sessionStart` |

每个 hook 都是 fail-open 的：如果 `mom` 出错或 Palgu 响应慢，Copilot 会像没有 hook 一样继续工作。

## 与 Claude Code mod 的不同

- **不对 Copilot 自己的轮次做逐条提示词路由。** Copilot 的 hook 无法更改模型，而且命令 hook 在 `userPromptSubmitted` 上的输出会被丢弃，所以也无法把记忆加入每条提示词：记忆通过 MCP 工具提供。Palgu 的路由通过 `palgu_delegate` 作用于 Copilot。Copilot 也可以把 Palgu 用作类型为 `anthropic` 的 BYOK 提供方（`https://api.palgu.ai/anthropic`，模型 `auto`），每个会话一个模型；参见 GitHub 的 BYOK 文档。
- 没有 `/route` 或 `/palgu` 命令；这些功能由终端中的 `mom` 完成。

## 它向哪里发送什么

- 发往 `https://api.palgu.ai/anthropic/heartbeat`（除非设置了 `mom heartbeat local|off`）：回答的最后 600 个字符和一个会话 id。
- 发往 `https://api.palgu.ai/v1/cortex/search`（仅当 agent 在开启记忆的文件夹中调用 `palgu_memory_search` 时）：查询内容（最多 300 个字符）和项目的 Palgu 名称。
- 发往 `https://api.palgu.ai/v1/chat/completions`（仅当 agent 调用 `palgu_delegate` 时）：子任务的提示词。
- 密钥保存在 `~/.config/mixture-of-models/credentials.json`（0600）或 `PALGU_API_KEY` 中；插件的文件中不包含任何密钥。

## 实测情况（Copilot CLI 1.0.112）

- 在不受信任的文件夹中，仓库 `.github/hooks/` 里的 hook 在 `copilot -p` 下没有运行；同样的 hook 放在插件中（`--plugin-dir` 或已安装）则会运行。
- 来自 `agentStop` 的继续提示词会作为一个新的 `userPromptSubmitted` 返回；`mom` 能识别出这是它自己发的，因此会保留用户原本的提示词和 3 次继续的额度。
- 插件的 MCP 服务器在插件文件夹中启动；会话的文件夹是 `COPILOT_SESSION_CWD`，`mom mcp` 会使用它。
- 对话记录是 `~/.copilot/session-state/<session>/events.jsonl`（或位于 `$COPILOT_HOME` 下）；模型的回答是 `assistant.message` 事件。`mom` 只读取该文件夹下的 `.jsonl` 文件，并且只读最后 256 KB。
- `copilot` 会拒绝 classic `GITHUB_TOKEN`；请用 `/login` 登录（如果设置了该变量，用 `env -u GITHUB_TOKEN -u GH_TOKEN copilot` 启动）。
