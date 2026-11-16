# 适用于 OpenCode 的 Mixture of Models

[English](../../../../../integrations/opencode/README.md) · **简体中文** · [日本語](../../../ja/integrations/opencode/README.md) · [Deutsch](../../../de/integrations/opencode/README.md) · [Français](../../../fr/integrations/opencode/README.md) · [العربية](../../../ar/integrations/opencode/README.md)

*本文为译文；以英文版为准，英文版可能更新。*

该插件为每条提示词挑选 Palgu 模型，把 Palgu 记忆加入每条提示词，继续在任务中途停下的轮次，并添加 `/route` 和 `/palgu`。除 Claude Code 外，OpenCode 是唯一一个插件可以为每个请求选择模型的工具，因此它在功能上与 Claude Code mod 一一对应（[ADR 0005](../../../../adr/0005-other-coding-agents.md)）。

要求：

- OpenCode 1.19 或更高版本。插件使用 V1 服务端插件 API；已在 1.19.5 上测试。
- `mom` 需要 Node 20 或更高版本。
- 对于 Palgu 记忆，由 [palgu CLI](https://www.palgu.ai/install) 负责建立索引。

## 安装

```bash
# 1. mom：登录、记忆同意和 setup 命令（插件随同一个包发布）
npm install -g github:alinaqi/mixture-of-models-claude-mod
mom login                         # 在浏览器中登录 Palgu

# 2. 在 opencode.json 中把 Palgu 设为提供方并加入插件
mom setup opencode                # 打印配置块
mom setup opencode --write        # 合并到 opencode.json（会先把旧文件复制为 opencode.json.bak）
```

如果设置了 `$OPENCODE_CONFIG`，`--write` 会写入该文件，否则写入 `~/.config/opencode/opencode.json`（或 `$XDG_CONFIG_HOME` 下的相同路径）。它会修改两个键：`provider.palgu` 和插件条目，并且只有在你没有默认模型时才把 `model` 设为 `palgu/auto`。其他所有键保持不变。如果文件中有注释（JSONC），`mom` 会打印配置块，由你手动合并。登录后，模型列表来自 Palgu（`GET /v1/models/health`），否则使用内置列表。

它写入的内容（节选）：

```json
{
  "model": "palgu/auto",
  "provider": {
    "palgu": {
      "npm": "@ai-sdk/anthropic",
      "name": "Palgu",
      "options": {
        "baseURL": "https://api.palgu.ai/anthropic/v1",
        "apiKey": "{env:PALGU_API_KEY}",
        "headers": { "x-srooter-client": "mixture-of-models-opencode/0.28.0" }
      },
      "models": { "auto": { "name": "Palgu router (auto)" }, "deepseek-pro": {}, "gemini-3.8-flash": {} }
    }
  },
  "plugin": ["/usr/local/lib/node_modules/mixture-of-models-claude-mod/integrations/opencode/plugin.js"]
}
```

文件中不包含密钥。插件会把 mom 的密钥（来自 `mom login` 或 `PALGU_API_KEY`）添加到发往 `https://api.palgu.ai/` 的请求中。如果设置了 `PALGU_API_KEY`，OpenCode 自己也会发送它。

### 加载插件的其他方式

| 形式 | `plugin` 条目 |
| :- | :- |
| 已安装包中的文件（`mom setup opencode` 写入的就是这个） | `"/…/node_modules/mixture-of-models-claude-mod/integrations/opencode/plugin.js"` |
| 包目录（OpenCode 读取 `exports["./server"]`） | `"/…/node_modules/mixture-of-models-claude-mod"` |
| `.opencode/plugin/`（单个项目）或 `~/.config/opencode/plugin/`（所有项目）中的本地文件 | 文件 `mom.js`，内容为 `export { default } from '/…/integrations/opencode/plugin.js'` |
| 从 JavaScript 中 | `import plugin from 'mixture-of-models-claude-mod/opencode'` |

选项写在一个元组中：`["…/plugin.js", { "critical": "claude-opus" }]`。

| 选项 | 默认值 | |
| :- | :- | :- |
| `critical` | 无 | 用于关键工作的 Palgu 模型：mod 的规则（"use claude …"、"execute the plan"、安全和裁决类提示词）或分类器分数高于 7 |
| `routes` | `{}` | `{ "simple": "…", "coding": "…", "critical": "…" }`：每个层级对应的 Palgu 模型。没有指定模型的层级使用 `auto` |
| `ollama` | `true` | 用本地 Ollama（`localhost:11434`，4 秒）对提示词分类。仅在设置了路由时使用 |
| `ollamaModel` | `qwen2.5-coder:3b` | |
| `provider` | `palgu` | 插件进行路由的、`opencode.json` 中的提供方 id |

## 它做什么

| | 如何实现 | OpenCode 功能 |
| :- | :- | :- |
| **路由** | 每条发往 `palgu/auto` 的提示词都以 `auto` 发出，由 Palgu 选择层级（trivial、small、medium、think）。`/route <model>` 为所有会话固定一个模型，`/route auto` 取消固定。设置了 `critical` 或 `routes` 时，由 mod 的规则和分类器选择层级，并固定该层级的模型。你在 OpenCode 中自己选择的模型（不是 `auto` 的 `palgu/<model>`）保持不变。模型写在用户消息上，`x-srooter-pin` 加在每个请求上。OpenCode 自己的标题和摘要请求从不会被固定。 | `chat.message`（`output.message.model`）、`chat.headers` |
| **Palgu 记忆** | 在项目文件夹中运行 `mom memory on` 或 `/palgu memory on` 会为该文件夹建立索引（把源代码上传到 Palgu）。之后，对每条四个词及以上的提示词，会召回最多 8 条线索并加入该消息的系统文本。记忆默认关闭。同意按文件夹记录，并与 `mom` 服务的所有工具共享。 | `chat.message`（`output.message.system`） |
| **心跳** | 当会话在一个停在任务中途的轮次（"Let me check the tests next."）之后进入空闲状态时，插件会发送继续提示词，每条你的提示词最多 3 次。由 Palgu 判断（`POST /anthropic/heartbeat`）。未登录时，同样的分类器在本地运行。`/palgu heartbeat off` 可关闭它。子 agent 会话、被中止的轮次和失败的轮次从不会被继续。 | `event` `session.idle` → `client.session.promptAsync` |
| **索引** | 在开启记忆的文件夹中，会话开始时在后台运行 `palgu memory index .`，最多每 10 分钟一次。 | `event` `session.created` |
| **命令** | `/route [auto\|<model>\|<prefix>\|status]`、`/palgu memory on\|off\|status`、`/palgu heartbeat palgu\|local\|off`、`/palgu status`。插件自己执行命令，并在 TUI toast 中显示结果。随后模型只是在 `auto` 下复述这一行，因此由 Palgu 最便宜的层级作答。 | `config`（注册 `command.route` 和 `command.palgu`；你自己的同名命令优先）、`command.execute.before`、`client.tui.showToast` |

每个 hook 都是 fail-open 的。如果出现异常或 Palgu 响应慢，OpenCode 会像插件不存在一样继续工作。记忆搜索最多等待 3 秒，心跳最多等待 8 秒。`MOM_DEBUG=1` 会把每个决策和请求以一行 JSON 写入 `~/.config/mixture-of-models/opencode.log`：模型 id、固定设置和大小，从不记录密钥、提示词或召回的文本。

## 它向哪里发送什么

- **发往 `https://api.palgu.ai/anthropic/v1/messages`**（OpenCode 本身，针对提供方 `palgu`）：你的 OpenCode 轮次。每个请求都带有 `x-srooter-client: mixture-of-models-opencode/<version>` 和 `x-srooter-project: <folder name>`，固定了模型时还带有 `x-srooter-pin: <model>`，以及密钥。
- **发往 `https://api.palgu.ai/v1/cortex/search`**（插件，仅在开启记忆的文件夹中）：提示词（一行，最多 300 个字符）和项目的 Palgu 名称。
- **发往 `https://api.palgu.ai/anthropic/heartbeat`**（插件，除非心跳被设为 `local` 或 `off`）：回答的最后 600 个字符和一个会话 id。
- **发往 `http://localhost:11434`**（仅当你设置了 `routes` 或 `critical` 且 Ollama 在运行时）：提示词，供分类器使用。
- **磁盘上**：密钥保存在 `~/.config/mixture-of-models/credentials.json`（权限 0600）或 `PALGU_API_KEY` 中。固定设置和记忆同意保存在同一文件夹的 `state.json` 中。

## 与 Claude Code mod 的不同

- 路由始终在同一个提供方 Palgu 之内进行。被路由的轮次在同一个 OpenCode 会话中运行，拥有完整的历史和工具；没有子进程。Claude 模型只能通过 Palgu 访问。
- 没有 `critical` 或 `routes` 时，由 Palgu 自己的层级选择模型，而不是 mod 的分类器，并且不存在 `/route strategy`。
- `/route` 和 `/palgu` 会消耗一次简短的模型回复，因为 OpenCode 的命令总是以一条提示词结束。
- `opencode run` 会在会话空闲时立即退出，因此心跳在那里没有机会继续。它在 TUI 和 `opencode serve` 下可以工作。
