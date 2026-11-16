# 适用于 Cursor 的 Mixture of Models

[English](../../../../../integrations/cursor/README.md) · **简体中文** · [日本語](../../../ja/integrations/cursor/README.md) · [Deutsch](../../../de/integrations/cursor/README.md) · [Français](../../../fr/integrations/cursor/README.md) · [العربية](../../../ar/integrations/cursor/README.md)

*本文为译文；以英文版为准，英文版可能更新。*

搜索 Palgu 记忆，通过 Palgu 把自成一体的子任务交给更便宜的模型，并继续在任务中途停下的轮次。它的工作方式与 Claude Code mod 相同，借助 Cursor 提供的能力实现：hook、一个 MCP 服务器和一条规则（[ADR 0005](../../../../adr/0005-other-coding-agents.md)）。

需要 Node 20 或更高版本，并且 `mom` CLI 位于 Cursor 能看到的 `PATH` 中。Palgu 记忆还需要 [palgu CLI](https://www.palgu.ai/install) 来建立索引。如果你已有 `palgu login`，它会使用自己的登录，否则使用 `mom` 的密钥。

## 安装

```bash
# 1. mom CLI（hook 和 MCP 服务器会运行它）
npm install -g github:alinaqi/mixture-of-models-claude-mod
mom login                      # 在浏览器中登录 Palgu
```

然后任选其一：

- **插件。** 在 Cursor 中，通过 **Dashboard → Plugins & MCPs → Add Marketplace → Import from Repo** 填入 `https://github.com/alinaqi/mixture-of-models-claude-mod`，然后在 **Customize** 中安装 **Mixture of Models**。要在本地试用，把 `integrations/cursor` 复制到 `~/.cursor/plugins/local/mixture-of-models`，然后运行 **Developer: Reload Window**。
- **按项目安装，不使用插件。** 在项目文件夹中，`mom setup cursor` 会打印 `.cursor/hooks.json` 和 `.cursor/mcp.json` 的条目；`mom setup cursor --write` 会把它们合并到已有的文件中。它会保留你的其他 hook 和服务器，并为它修改的文件保存一份 `.bak`。然后重新加载窗口。这种方式可以获得 hook 和 MCP 服务器，但没有规则。如果需要规则，请把 `integrations/cursor/rules/mixture-of-models.mdc` 复制到 `.cursor/rules/`。

如果 Cursor 找不到 `mom`（从 Dock 启动的应用可能看不到 npm 的全局 bin），请在 hook 和 `mcp.json` 中使用 `which mom` 给出的完整路径。

## 它做什么

| | 如何实现 | Cursor 功能 |
| :- | :- | :- |
| **Palgu 记忆** | 在项目文件夹中运行 `mom memory on` 会为其建立索引（这会把源代码上传到 Palgu）。之后 agent 会在任务开始时用 `palgu_memory_search` 搜索它，并得到最多 8 条线索。会话开始时，hook 会告诉 agent 记忆已开启。记忆默认关闭。同意按文件夹记录，并与 `mom` 服务的所有工具共享。 | MCP 工具；`sessionStart` → `additional_context`；规则 |
| **委派** | `palgu_delegate {prompt, model?}` 把一个自成一体的子任务发送给 Palgu（`model: "auto"`，由 Palgu 选择层级，或使用你固定的模型），并返回回答。规则把它限制在低风险工作上（起草测试、样板代码、文档、查找），并排除安全敏感的工作和密钥。`palgu_models` 列出 Palgu 提供的模型。 | MCP 工具；规则 |
| **心跳** | 当某个轮次在任务中途结束时（"Now I'll run the tests." 然后就没有下文了），hook 会发送一条后续消息，每条提示词最多 3 次。由 Palgu 判断（`POST /anthropic/heartbeat`）。未登录时，同样的分类器在本地运行。你主动中止的轮次永远不会被继续。`mom heartbeat off` 可关闭它。 | `afterAgentResponse` 保存回答；`stop` → `followup_message`（`loop_limit: 3`） |
| **索引** | 在开启记忆的文件夹中，会话开始时在后台运行 `palgu memory index .`，最多每 10 分钟一次。 | `sessionStart` |

每个 hook 都是 fail-open 的。如果 `mom` 出错或 Palgu 响应慢，Cursor 会像 hook 不存在一样继续工作。心跳最多等待 8 秒，记忆搜索 8 秒，委派 120 秒。

## 它向哪里发送什么

- 发往 `https://api.palgu.ai/v1/chat/completions`（`palgu_delegate`，仅当 agent 调用它时）：子任务的提示词，带上 `x-srooter-client: mixture-of-models-cursor/<version>`，固定了模型时还会带上 `x-srooter-pin`。
- 发往 `https://api.palgu.ai/v1/cortex/search`（`palgu_memory_search`，仅在开启记忆的文件夹中）：查询内容（一行，最多 300 个字符）和项目的 Palgu 名称。
- 发往 `https://api.palgu.ai/v1/models/health`（`palgu_models`）：只有密钥。
- 发往 `https://api.palgu.ai/anthropic/heartbeat`（`stop` hook，除非设置了 `mom heartbeat local|off`）：agent 回答的最后 600 个字符和一个会话 id。
- 密钥保存在 `~/.config/mixture-of-models/credentials.json`（权限 0600）中，或来自 `PALGU_API_KEY`。它从不会被写入 Cursor 的文件或日志。`mom` 的状态（每个对话最后的提示词和回答，保留一天）保存在同目录的 `state.json` 中。

## 与 Claude Code mod 的区别

- **没有逐轮路由。** Cursor 的 hook 无法更改模型，而自定义 API base URL 在 Agent 模式下并不可靠。工作由 Cursor 自己的模型完成，只有 agent 交给 `palgu_delegate` 的内容才会发往更便宜的模型。
- **记忆是被拉取的，而不是被推送的。** `beforeSubmitPrompt` 只能允许或阻止一条提示词，无法添加上下文。因此记忆通过 MCP 工具到达 agent（规则和会话开始时的提示会告诉它调用该工具），而不是附加在每条提示词上。
- **没有 `/route` 或 `/palgu` 命令。** 规则会告诉 agent 该建议哪些 `mom` 命令。

## 供其他工具使用的 `mom mcp`

`mom mcp [tool]` 是一个基于 stdio 的普通 MCP 服务器（JSON-RPC 2.0，协议 `2025-06-18` 或客户端的版本），因此任何能运行 MCP 服务器的 agent 都可以使用它：`command: "mom", args: ["mcp", "<tool>"]`。`<tool>` 只用于在 `x-srooter-client` 中标明客户端。它依次通过工具的 `folder` 参数、`MOM_PROJECT_DIR`、客户端的 MCP roots、最后是它的工作目录来确定项目文件夹。
