# 适用于 Codex 的 Mixture of Models

[English](../../../../../integrations/codex/README.md) · **简体中文** · [日本語](../../../ja/integrations/codex/README.md) · [Deutsch](../../../de/integrations/codex/README.md) · [Français](../../../fr/integrations/codex/README.md) · [العربية](../../../ar/integrations/codex/README.md)

*本文为译文；以英文版为准，英文版可能更新。*

Palgu 为每个请求挑选模型，Palgu 记忆会被召回到每条提示词中，在任务中途停下的轮次会被继续。行为与 Claude Code mod 相同，基于 Codex 自己的插件和 hook 构建（[ADR 0005](../../../../adr/0005-other-coding-agents.md)）。

需要 Codex 0.163 或更高版本，以及 Node 20 或更高版本。Palgu 记忆还需要 [palgu CLI](https://www.palgu.ai/install) 来建立索引；如果你已有 `palgu login`，它会使用自己的登录，否则使用 `mom` 的密钥。

## 安装

```bash
# 1. mom CLI（插件的 hook 会调用它）
npm install -g github:alinaqi/mixture-of-models-claude-mod
mom login                      # 在浏览器中登录 Palgu

# 2. 让 Codex 经由 Palgu 路由：写入 ~/.codex/palgu.config.toml（不会改动你的 config.toml）
mom setup codex --write

# 3. 插件：记忆召回和心跳
codex plugin marketplace add alinaqi/mixture-of-models-claude-mod
codex plugin add mixture-of-models@mixture-of-models
```

然后在 Palgu 上启动 Codex：

```bash
codex -p palgu
```

首次运行时，Codex 会要求你审查插件的 hook（`/hooks`）；这些 hook 只运行 `mom hook codex`，不做别的事。

## 它做什么

| | 如何实现 | Codex 功能 |
| :- | :- | :- |
| **路由** | `model = "auto"`：Palgu 对每个请求分类，并由它的层级（trivial、small、medium、think）提供服务。`MOM_PIN=<model> codex -p palgu -m <model>`（同一个模型写两次）会为整个会话固定一个模型：只有存在 `x-srooter-pin` 时，Palgu 才会固定请求中指定的模型，并且会拒绝带固定的 `auto`（403）。 | `-p palgu` profile，`[model_providers.palgu]` 配合 `auth = { command = "mom", args = ["token"] }` |
| **Palgu 记忆** | 在项目文件夹中运行 `mom memory on` 会为其建立索引（把源代码上传到 Palgu），并为每条四个词及以上的提示词召回最多 8 条线索。默认关闭；同意按文件夹记录，并与 `mom` 服务的其他工具共享。 | `UserPromptSubmit` → `additionalContext` |
| **心跳** | 在任务中途结束的轮次（"Let me check the tests."）会被继续，每条提示词最多 3 次。由 Palgu 判断（`POST /anthropic/heartbeat`）；未登录时，同样的分类器在本地运行。`mom heartbeat off` 可关闭它。 | `Stop` → `decision: "block"` |
| **索引** | 在开启记忆的文件夹中，会话开始时在后台运行 `palgu memory index .`，最多每 10 分钟一次。 | `SessionStart` |

每个 hook 都是 fail-open 的：如果 `mom` 出错或 Palgu 响应慢，Codex 会像没有 hook 一样继续工作。记忆搜索最多等待 3 秒，心跳最多等待 8 秒。

## 它向哪里发送什么

- 发往 `https://api.palgu.ai/v1/responses`（Codex 本身，在 `-p palgu` 下）：你的 Codex 轮次，带上来自 `mom token` 的密钥和请求头 `x-srooter-client: mixture-of-models-codex/<version>`，在设置了 `MOM_PIN` / `MOM_PROJECT` 时还会带上 `x-srooter-pin` / `x-srooter-project`。
- 发往 `https://api.palgu.ai/v1/cortex/search`（`mom`，仅在开启记忆的文件夹中）：提示词（一行，最多 300 个字符）和项目的 Palgu 名称。
- 发往 `https://api.palgu.ai/anthropic/heartbeat`（`mom`，除非设置了 `mom heartbeat local|off`）：Codex 回答的最后 600 个字符和一个会话 id。
- 密钥保存在 `~/.config/mixture-of-models/credentials.json`（权限 0600）或 `PALGU_API_KEY` 中。它从不会被写入 Codex 的配置。

## 与 Claude Code mod 的不同

- 路由使用的是 Palgu 的层级，而不是 mod 的分类器和策略：Codex 的 hook 无法更改某个轮次的模型。
- 没有 `/route` 或 `/palgu` 斜杠命令（Codex 移除了自定义命令）；skill `mixture-of-models` 会告诉 Codex 该建议哪些 `mom` 命令。
- 带 hook 的插件无法列入 Codex 的公共插件目录，因此需要从本仓库的 marketplace 安装。
