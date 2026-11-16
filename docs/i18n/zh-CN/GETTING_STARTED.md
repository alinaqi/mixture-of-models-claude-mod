# 快速上手

[English](../../../GETTING_STARTED.md) · **简体中文** · [日本語](../ja/GETTING_STARTED.md) · [Deutsch](../de/GETTING_STARTED.md) · [Français](../fr/GETTING_STARTED.md) · [العربية](../ar/GETTING_STARTED.md)

*本文为译文；以英文版为准，英文版可能更新。*

## 1. 检查 Claude Code

```bash
claude --version     # 需要 2.1.287 或更高版本
# 版本太旧？任选其一：
brew install --cask claude-code@latest            # Homebrew（stable cask 版本落后）
npm install -g @anthropic-ai/claude-code@<version>   # npm：2.1.287 及之后的版本
claude update                                     # 原生安装器
```

## 2. 安装

先下载，阅读脚本，然后再运行（它只调用 `claude plugin` 并复制 `config.example.json`）：

```bash
git clone https://github.com/alinaqi/mixture-of-models-claude-mod
cd mixture-of-models-claude-mod
less install.sh     # 审阅脚本
./install.sh
```

或者手动安装：

```bash
claude plugin marketplace add alinaqi/mixture-of-models-claude-mod
claude plugin install mixture-of-models@mixture-of-models-claude-mod
```

或者在会话内：`/plugin install mixture-of-models --marketplace alinaqi/mixture-of-models-claude-mod`

如果想参与开发，可以只为一个会话加载本地检出的代码：`claude --plugin-dir .`

## 3. 为子进程配置网关

Claude Code 子进程需要一个 Anthropic 兼容端点，并且该端点要能提供你路由中使用的模型 id。使用 [palgu](https://www.palgu.ai) 时，在会话中运行：

```
/plugin configure mixture-of-models@mixture-of-models-claude-mod
```

然后输入 `https://api.palgu.ai/anthropic` 和你的密钥。密钥会被遮盖显示，并保存在安全存储中。

也可以在 shell 中操作：运行 `claude plugin configure mixture-of-models@mixture-of-models-claude-mod --values-stdin`，在其输入中键入 `{"gateway_url":"https://api.palgu.ai/anthropic","gateway_key":"<your key>"}`，然后按 Ctrl-D，这样密钥不会进入你的 shell 历史记录。

你的主会话**不需要** `ANTHROPIC_BASE_URL`。它始终使用你的订阅。

## 4. 可选：调整配置

把 `config.example.json` 中的 `router` 块复制到 `~/.claude/model-config.json`，即可修改路由、阈值或子进程的参数。开始使用时不需要这一步。

注意一点：在 shell 中导出的 `ANTHROPIC_API_KEY` 会覆盖主会话的 claude.ai 登录。如果主会话应当使用你的订阅，请不要设置它。

## 5. 可选：Codex

要使用 `codex` 路由，请安装 Codex CLI：`brew install --cask codex`（或 `npm install -g @openai/codex@<version>`）。默认情况下，它使用你 Palgu 网关的 `/v1/responses` 和第 3 步中的密钥运行。如果想改用你自己的 ChatGPT 登录，请运行 `codex login`，并在 `~/.claude/model-config.json` 中设置 `"router": { "codex": { "auth": "chatgpt" } }`。

## 6. 可选：免费分类

```bash
ollama pull qwen2.5-coder:3b
```

没有 Ollama 时，分类器会回退到你套餐中的 `claude-haiku-5-5`。

## 7. 试一试

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

上面各行的含义：`/route` 显示 live（已启用）、mode auto（自动模式）和当前路由；输入 "grep the repo for TODOs" 时，spinner 显示 "via glm-5.3 (child)…"，回答来自子进程；`/route kimi` 把接下来的轮次固定到 Kimi；`/route auto` 恢复自动分类；`/route claude/sonnet` 让接下来的轮次在你的 Claude 登录上以 claude-sonnet-5-5 运行；`/route kimi/auto` 由分数在 kimi-k3.1-pro-highspeed 和 kimi-k3.1-pro 之间选择；`/route codex` 让接下来的轮次在 Codex CLI 上运行（需要 `npm install -g @openai/codex`）；`/route status` 显示模式、当前家族和成员以及所有家族；`/route stats` 打开一个面板，以图表展示哪些模型处理了你的轮次、类型、分数和最近的决策。
