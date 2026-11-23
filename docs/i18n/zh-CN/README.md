# mixture-of-models-claude-mod

[English](../../../README.md) · **简体中文** · [日本語](../ja/README.md) · [Deutsch](../de/README.md) · [Français](../fr/README.md) · [العربية](../ar/README.md)

*本文为译文；以英文版为准，英文版可能更新。*

[![ci][ci-badge]][ci] [![License: MIT][mit-badge]](../../../LICENSE) [![Changelog][log-badge]](../../../CHANGELOG.md)

[ci]: https://github.com/alinaqi/mixture-of-models-claude-mod/actions/workflows/ci.yml
[ci-badge]: https://github.com/alinaqi/mixture-of-models-claude-mod/actions/workflows/ci.yml/badge.svg
[mit-badge]: https://img.shields.io/badge/License-MIT-green.svg
[log-badge]: https://img.shields.io/badge/changelog-keep%20a%20changelog-blue

> **想让 coding agent 帮你安装？** 让它阅读 [INSTALL.md](INSTALL.md)："Follow INSTALL.md in alinaqi/mixture-of-models-claude-mod to set up Mixture of Models for me."（按照 alinaqi/mixture-of-models-claude-mod 中的 INSTALL.md 为我安装 Mixture of Models。）该文件包含所有命令、每一步的检查方法，以及需要向你询问的内容。适用于 Claude Code、Codex、Cursor、OpenCode、Antigravity、GitHub Copilot CLI、Aider、Continue 和 Goose。
>
> **已经安装好了？** [GUIDELINES.md](GUIDELINES.md) 介绍了每个 agent 的最佳实践：让系统挑选模型、如何措辞提示词才能让路由和记忆生效、该委派什么，以及路由看起来不对时该怎么做。

把 Claude 订阅留给真正需要它的轮次，其余的交给更便宜的模型。这是一个 Claude Code **mod**（一种进程内插件，Claude Code 2.1.287 新增），它为每条提示词评估影响范围（blast radius），并用一个独立的、无头（headless）的 Claude Code 在 Anthropic 兼容网关（GLM、Kimi、DeepSeek，取决于你的网关提供什么）上回答低分轮次。你的主会话从不会被重命名、重新指向或改动。路由逻辑移植自 [Maggy](https://github.com/alinaqi/maggy)。

路由还可以指定一个**模型家族**：`claude/sonnet` 在你自己的 Claude 登录上运行该 Claude 成员，`kimi/auto` 让分数挑选一个 Kimi 成员，`codex` 则把该轮次交给 Codex CLI（`codex exec`），运行在 Palgu 或你的 ChatGPT 登录上。参见[模型家族](#模型家族选择成员或让层级来选)和 [Codex](#作为子进程的-codex)。

## 一条命令获取 Palgu 的模型

无需控制台，无需复制密钥。[安装 mod](#安装) 之后，在 Claude Code 中运行：

```
/palgu login
```

1. mod 会显示一个登录链接和一个短代码，例如 `WDJB-MJHT`。
2. 打开链接，登录 Palgu 或**注册**（新账号从免费套餐开始），确认代码一致后点击 **Allow**。页面会写明应用名称：*Allow Mixture of Models on "Claude Code on your-mac"?*
3. 回到终端，会出现一条 toast：*Signed in to Palgu as you@example.com*。就这样：简单和编码轮次现在运行在 Palgu 的模型上（GLM 5.3、Kimi K3.1、DeepSeek V4 Pro、Gemini 3.8 Flash、MiniMax M3、GPT-6），关键轮次留在 Claude 上。无需重启。

| 命令 | 作用 |
| :- | :- |
| `/palgu login` | 注册或登录，并连接这台电脑 |
| `/palgu status` | 当前登录的是谁、所属组织及其套餐，以及本周期已花费的 Palgu 预算 |
| `/palgu upgrade` | 套餐和计费（付费套餐在网页上购买；你的密钥会自动获取新套餐） |

工作原理：Palgu 的设备登录（与 `srooterctl` 使用的相同）只为这台电脑生成一个 API 密钥。你可以在 Palgu 的 **Devices** 页面查看和撤销它。mod 通过 `claude plugin configure --values-stdin` 把它保存在 Claude Code 的安全存储中，因此它从不会出现在命令行或设置文件中。已经有密钥，或者使用其他网关？参见[设置](#设置)。

准确地说，它做的是**轮次级委派**，而不是逐请求的模型混合。被路由的轮次在一个子进程中运行，并附带你最近上下文的简短摘要；子进程的回答会带着标记出现在你的对话记录中。关键轮次一如既往地留在 Claude 上。

## 安装

Mod 需要 **Claude Code 2.1.287 或更高版本**。Homebrew 的 stable cask 仍是 2.1.286，所以请先检查：

```bash
claude --version
# 版本太旧？任选其一：
brew uninstall --cask claude-code && brew install --cask claude-code@latest   # Homebrew
npm install -g @anthropic-ai/claude-code@<version>                            # npm：2.1.287 及之后的版本
claude update                                                                 # 原生安装器
```

然后：

```bash
claude plugin marketplace add alinaqi/mixture-of-models-claude-mod
claude plugin install mixture-of-models@mixture-of-models-claude-mod
```

或者在会话内：`/plugin install mixture-of-models --marketplace alinaqi/mixture-of-models-claude-mod`。

> **你的 hook 不会在网关子进程中运行。** 子进程运行 `claude -p --bare`，而 `--bare` 会跳过你设置和插件中的所有 hook，所以一个拦截 `.env` 的 hook 在那里起不到保护作用，子进程读取的内容会发送给网关模型。mod 在这方面不依赖 hook：每个 Claude 子进程都会获得 Claude Code 的权限拒绝规则（`--bare` 会保留这些规则），覆盖 `.env` 和 `.env.*` 文件、`*.pem`、`*.key`、`id_rsa*`、`id_ed25519*` 以及 `secrets/` 文件夹（Read 规则同时覆盖 Grep 和 Glob）。可以用 `router.child.deny` 添加你自己的规则，例如 `["Read(**/credentials.json)"]`。子进程无权运行的命令仍会以 Allow / Deny 对话框的形式交给你。Codex 子进程是只读的，但不受这些规则保护：不要在路由给 Codex 的项目中放置密钥。

**更新。** 会话启动时，mod 会在 GitHub 上检查是否有新版本（最多每 12 小时一次），如果有，会通过一条 toast 和状态栏提示一次：`0.33.0 available: /route update`。运行 `/route update`：它会安装新版本，之后状态栏会显示 `0.33.0 installed: /reload-plugins`。第三方 marketplace 默认不会自动更新。可以在 `/plugin` → Marketplaces → `mixture-of-models-claude-mod` → Enable auto-update 中开启一次，或者手动更新：`claude plugin marketplace update mixture-of-models-claude-mod && claude plugin update mixture-of-models@mixture-of-models-claude-mod`。新版本在运行 `/reload-plugins`（或重启）后生效。

**最快的开始方式，使用 Palgu：** 启动 `claude` 并运行 `/palgu login`。它会显示一个链接和一个代码；在浏览器中批准（如果你是新用户，就在那里注册），mod 会保存自己的 Palgu 密钥并从那一刻起开始路由，无需复制密钥。`/palgu status` 显示登录的是谁、使用什么套餐以及预算已花费多少，`/palgu upgrade` 打开套餐和计费页面。

或者自己给子进程配置一个网关：[OpenRouter](#openrouter)、一个 [LiteLLM](#litellm) 代理，或任何能提供你模型 id 的 Anthropic 兼容端点（已在 [palgu](https://www.palgu.ai) 上测试；z.ai 或 Moonshot 的 Anthropic 端点用法相同），参见[设置](#设置)。启动 `claude`，运行 `/route`。在配置网关之前，mod 处于仅观察模式，不改变任何东西。

**设计原则：主会话从不被改动。** 它始终使用你的 claude.ai 订阅，不设置 `ANTHROPIC_BASE_URL`。当一条提示词被路由到 GLM 或 Kimi 时，mod 会自己回答该轮次：运行一个**独立的、无头的 `claude -p` 子进程**，只有这个子进程的环境指向网关（palgu）。子进程的输出成为该轮次在你对话记录中的回答。主进程、它的模型、认证和请求都不会有任何变化。

对每条提示词，mod 会：

1. **打分**：用一次分类器调用从两个维度评估：1-10 的影响范围，以及任务类型（`code | research | review | docs | data | multimodal`）。分数决定是否必须使用 Claude；类型决定其余工作交给哪个更便宜的模型。本地 Ollama 模型可以免费完成打分，回退选项是你套餐中的 `claude-haiku-5-5`，再之后是最近一次的判定。参见[它如何决策](#它如何决策)。
2. **先应用 Maggy 的预路由规则**：`use claude` 或 `execute the plan` 强制为 `critical`；子进程回答过的轮次之后的追问回到主会话；当主会话正处于任务中途时，`go ahead`、`yes` 或不超过六个词的提示词会留在主会话；编码级别的工作也会留在处于任务中途的主会话中。
3. **委派**被路由的轮次给子进程：在网关上运行 `claude -p --model glm-5.3`，通过 stdin 传入一份简报，包含你会话中最近几轮交流以及任务本身。
4. **回退**：如果子进程失败、没有输出，或其回答未通过审查（参见[子进程不可以做什么](#子进程不可以做什么)），该轮次回退到主模型，并在对话记录中注明。
5. **在每个轮次向你展示什么在哪里运行。** 参见[你会看到什么](#你会看到什么)。

`critical` 轮次从不启动子进程。它们在主会话中、使用订阅运行，就像 mod 不存在一样。

## 它如何决策

分类器只被问一个问题：错误的回答会造成多大损害？它用一个数字回答，评分规则是明确的：

| 分数 | 含义 | 层级（默认阈值） |
| :- | :- | :- |
| 1-2 | 查找、grep、shell 单行命令、语法问题、阅读日志、git status 或 diff | `simple` |
| 3-4 | 单文件编辑、测试、文档、配置修改、小 bug 修复、脚手架 | 3 为 `simple`，4 为 `coding` |
| 5-6 | 多文件功能、把服务或工具连接起来、集成、遵循已知模式的部署 | `coding` |
| 7-8 | 跨服务调试、数据迁移、性能工作、难以撤销的修改 | 7 为 `coding`，8 为 `critical` |
| 9-10 | 安全或认证设计、架构决策、生产事故、任何不可逆的事 | `critical` |

提示词会告诉分类器：长度、提到的服务数量或粘贴的 API 密钥本身都不会提高分数，而这正是以前把普通集成工作推到主会话上的原因。它还说明，深度推理（带证明的算法、并发、性能调优、密码学）无论影响范围如何都至少得 7 分，这样困难但安全的工作会留在 Claude 上。用 `router.thresholds` 移动分界线；例如 `{ "simple": 3, "coding": 8 }` 会让除 9-10 分以外的所有工作都不使用 Claude。

**类型决定模型。** 在 `critical` 以下，`routes.kinds` 把任务类型映射到模型：默认情况下，`research` 和 `review` 交给 DeepSeek V4 Pro（Palgu 上为 `deepseek-pro`，1M token 上下文），`multimodal` 留在 Claude，其余都使用层级对应的模型（GLM）。在 0.20.0 之前它们交给 Kimi，而 Palgu 目前不响应 Kimi（约两分钟后返回空响应）。在网关允许的情况下，可以在矩阵中加入 `"docs": "gpt-6-sol"` 或 `"data": "..."`。

**你可以指定的模型。** 你的网关提供的任何模型 id 都可以用于 `routes`、`routes.kinds` 或固定。mod 知道这些 Palgu 网关模型，因此即使没有路由提到它们，`/route <prefix>` 也会展开为它们：`glm-5.3`、`kimi-k3.1-pro`、`kimi-k3.1-pro-highspeed`、`deepseek-v4-pro`、`gemini-3.8-flash`、`minimax-m3`、`minimax-m2.5`、`gpt-6-sol`、`gpt-6-luna`、`gpt-6-astra` 和 `mercury-3`。提示词上方的状态栏为每个家族提供一个按钮。`kimi-k3.1-pro` 取代了 `kimi-k3`；旧的 `/route kimi-k3` 固定会展开为它。Gemini、MiniMax 和 GPT-6 是可选项，不是默认值：`/route minimax`、`/route gpt`（GPT-6 Sol）或 `/route gpt/auto`（简单轮次用 Luna，编码用 Sol，关键工作用 Astra）可以固定它们。Inception 的 Mercury 3 也只能通过固定使用：`/route mercury`（Palgu 上为 `mercury-3`，OpenRouter 上为 `mercury/3`）。

**哪些 Palgu 模型可用。** 2026-10-29 按 mod 运行轮次的方式测试（一个固定模型的 `claude -p --bare` 子进程执行一个带工具调用的简短研究任务）：`glm-5.3`、`deepseek-pro`、`gemini-3.8-flash`、`minimax-m3`、`gpt-6-sol`、`gpt-6-luna`、`gpt-6-astra`、`kimi-k3.1-pro`、`kimi-k3.1-pro-highspeed` 和 `mercury-3` 在 19 到 46 秒内通过；`minimax-m2.5` 不断重试被拒绝的命令，直到用完轮次。Kimi 之前的失败是因为 Moonshot 过载（`429 engine_overloaded`）：Claude Code 对每个请求重试十次，所以一个轮次要花两到三分钟才失败。现在子进程最多重试两次（`router.child.maxRetries`，默认 2），因此繁忙的提供方会在几秒内回退。research 和 review 默认留在 DeepSeek；Kimi 需要固定。子进程总是向 Palgu 发送 `x-srooter-pin: <model>`：没有它，Palgu 会按意图路由，可能用另一个模型作答（未固定时，它把每个模型都当作 Gemini 来服务）。

**子进程失败时。** 只有在每个同类模型都失败之后，主模型才会接手被路由的轮次。在 Palgu 上，子进程发送 `x-palgu-fallback: auto`，因此遇到过载时，网关会先沿着固定模型自己的回退链（先是它的回退列表，再是同一类别）尝试。如果子进程仍因过载失败（429、5xx、超时或没有回答），mod 会在下一个同类模型上重跑这一轮：先是同一类别的模型（来自 Palgu 的实时列表），再是其他健康的模型，最多 `router.child.fallbacks` 个（默认 3）。对模型来说过长的提示只会转到上下文窗口更大的模型（`router.child.longContext`）；错误请求（400、401、403、404、422）不会在其他模型上重试。路由行会说明发生了什么：`child: deepseek-pro failed (429) → served by glm-5.3`，或 `all equivalents failed: deepseek-pro (429), glm-5.3 (529), …; main model answered`。 如果是 Palgu 自己的回退链改用了另一个模型，该行会显示 `child: kimi-k3.1-pro → served by deepseek-pro (gateway fallback)`，这一轮也按该模型计数和计价。

### 路由策略：按复杂度、成本、速度、质量或你自己的规则路由

分类器打什么分、层级在哪里划分、每个层级使用哪个模型，这些合起来就是一个**路由策略**：一个带评分规则的 markdown 文件，类似 skill。内置四种：

| 策略 | 评分依据 | 层级（simple / coding） | 交给 |
| :- | :- | :- | :- |
| `complexity`（默认） | 影响范围，如上所述 | 3 / 7 | 你的路由：GLM，research 和 review 用 DeepSeek，关键工作用 Claude |
| `cost` | 更便宜模型出错的风险；不确定时取低分 | 4 / 8 | GLM，编码、research 和 review 用 DeepSeek V4 Pro，图像用 Gemini，关键工作用 Claude |
| `speed` | 推理深度 | 3 / 7 | Gemini 3.8 Flash，编码用 GPT-6 Sol，关键工作用 Sonnet 而不是 Opus |
| `quality` | 风险高低；不确定时取高分 | 2 / 5 | 只有查找用 GLM，编码用 Sonnet，关键工作用 Claude |

`/route strategies` 列出内置策略和你的策略，`/route strategy cost` 切换策略（跨会话记住；`model-config.json` 中的 `router.strategy` 设置默认值），之后状态栏会显示 `auto (cost)`。

**你自己的策略。** 把文件放在 `~/.claude/mixture-of-models/strategies/<name>.md`，或者让 Claude 使用插件的 **routing-strategy** skill，它会询问你想优化什么并替你写好：

```markdown
---
name: frugal
description: Everything but production work goes to cheap models.
score: risk
thresholds: {"simple": 5, "coding": 8}
routes: {"simple": "glm/5.3", "coding": "deepseek/v4-pro", "critical": "claude", "kinds": {"review": "kimi/pro"}}
---
Risk: how bad a wrong answer from a cheaper model would be. When unsure, score lower.
1-5: lookups, docs, tests, single-file edits, small fixes.
6-8: multi-file features, integrations, refactors that tests cover.
9-10: security, production, data migrations, anything irreversible.
```

`thresholds` 和 `routes` 是单行 JSON，可选（省略时使用你配置中的值）；正文是分类器读取的评分规则。回复格式仍为 "<score> <kind>"，因此层级、家族、失败记忆和节省统计都照常工作。上面的安全规则在每种策略下都会先执行：安全工作、通知和会话命令留在 Claude 上。无法解析的文件会被跳过，并在日志中注明；`/route strategy <name>` 会重新读取文件夹，所以新文件无需重启即可生效。

### 模型家族：选择成员，或让层级来选

任何路由、类型路由或固定都可以写成 `<family>/<member>` 或 `<family>/auto`，而不是模型 id。单独的 `claude` 仍然表示“主会话”，和以前完全一样，所以旧配置的行为不变。

| 家族 | 成员（别名 = 确切 id） | 按层级的 `auto`（默认） | 运行于 |
| :- | :- | :- | :- |
| `claude` | `fable` = `claude-fable-5-1`、`opus` = `claude-opus-5-5`、`sonnet` = `claude-sonnet-5-5`、`haiku` = `claude-haiku-5-5` | simple → `haiku`，coding → `sonnet`，critical → `opus`；只有当你添加 `"criticalPlus": "fable"` 时才使用 `fable`（10/10 的关键轮次） | **你的 Claude 登录**上的无头 `claude -p --model <id>` 子进程（无网关）；如果成员*就是*会话模型，则留在主会话中 |
| `kimi` | `pro` = `kimi-k3.1-pro`、`highspeed` = `kimi-k3.1-pro-highspeed` | simple → `highspeed`，coding 和 critical → `pro` | 网关子进程 |
| `glm`、`deepseek`、`gemini`、`minimax` | 来自网关目录：`glm/5.3` = `glm-5.3`、`deepseek/v4-pro` = `deepseek-v4-pro`、`gemini/3.8-flash`、`minimax/m3` = `minimax-m3`、`minimax/m2.5` | 第一个成员 | 网关子进程 |
| `gpt` | `sol` = `gpt-6-sol`、`luna` = `gpt-6-luna`、`astra` = `gpt-6-astra` | simple → `luna`，coding → `sol`，critical → `astra` | 网关子进程 |
| `codex` | 默认没有：`codex/<any model id>` 把 id 传给 Codex | 默认没有：使用 Codex 自己的默认模型 | 一个 `codex exec` 子进程，参见 [Codex](#作为子进程的-codex) |

`auto` 使用与层级相同的分类器、阈值、临界分数二次采样和失败记忆，然后在家族的 `auto` 映射中查找层级。它从不离开该家族。Claude 家族的层级（`"critical": "claude/opus"`）与 `"claude"` 一样是必须使用 Claude 的：`routes.kinds` 不会覆盖它。可以在 `router.families` 中按家族覆盖成员或层级映射；固定的 `/route claude/auto` 仍会对每条提示词分类，并根据分数挑选成员。

为什么 Claude 成员要用子进程，而不是会话自己的 `/model`：主会话从不被重命名或重新指向（[ADR 0001](../../adr/0001-child-process-delegation.md)），所以会话模型以外的成员会在一个独立的无头 Claude Code 中运行，并使用 Claude Code 自己的 `--model <id>` 参数启动。该子进程不带 `--bare` 运行（`--bare` 会强制使用 API 密钥认证），因此它使用你的 claude.ai 登录，并加载你的 hook 和插件；mod 在其中通过 `MAGGY_ROUTER_CHILD` 保持不活动。它的环境会清除任何继承的 `ANTHROPIC_BASE_URL`；在你的 shell 中导出的 `ANTHROPIC_API_KEY` 仍然优先于登录，这对子进程和主会话都一样。参见 [ADR 0002](../../adr/0002-model-families-and-codex-child.md)。

### 作为子进程的 Codex

`codex`、`codex/<model>` 和 `codex/auto` 路由，以及 `/route codex`，会用非交互模式的 Codex CLI 回答该轮次：

```
codex exec --json -C <session cwd> [-m <model>] [Palgu provider flags] --sandbox read-only -c approval_policy="never" -
```

通过 stdin 传入同样的简报，使用与 Claude 子进程相同的 `child.timeoutMs`、相同的审查、失败记忆、路由行和来源标记。`router.codex.auth` 选择账号：

- `"palgu"`（默认）：Codex 与你网关的 Responses 端点 `/v1/responses` 通信。在 OpenRouter 和 LiteLLM 上，提供方名为 `openrouter` 或 `litellm`，base URL 为 `<gateway_url>/v1`（`https://openrouter.ai/api/v1`、`http://localhost:4000/v1`；LiteLLM 的 `/anthropic` URL 会先去掉该后缀），密钥放在 `OPENROUTER_API_KEY` 或 `LITELLM_API_KEY` 中，遵循 [OpenRouter](https://openrouter.ai/docs/cookbook/coding-agents/codex-cli.md) 和 [LiteLLM](https://docs.litellm.ai/docs/proxy/client_setup/codex_cli.md) 的 Codex 指南。在这些网关上需要指定模型：OpenRouter 需要完整的 slug（`/route codex/openai/gpt-5.6-terra`），LiteLLM 需要你的某个 `model_name`；Codex 自己的默认模型 id 不在其中。在 Palgu 上，mod 会添加一个显式的 `palgu` 提供方，使用 `-c model_provider="palgu"`、`-c model_providers.palgu.base_url="<gateway>/v1"`、`-c model_providers.palgu.wire_api="responses"` 和 `-c model_providers.palgu.env_key="PALGU_API_KEY"`，如 [Palgu 的 Codex 文档](https://www.palgu.ai)所述（在 ChatGPT 登录下 Codex 会忽略 `OPENAI_BASE_URL`，所以提供方必须显式指定）。base URL 是把你的 `gateway_url` 中的 `/anthropic` 替换为 `/v1`，或使用 `router.codex.baseUrl`。你的网关密钥只以 `PALGU_API_KEY` 的形式进入子进程的环境，从不出现在命令行上，也从不被打印。与 Claude 网关子进程一样，需要网关 URL 和密钥。
- `"chatgpt"`：不带提供方参数，也不带密钥：Codex 使用你自己的 `codex login` 和 `~/.codex/config.toml`。mod 从不读取或写入 `~/.codex`。

#### 沙箱与审批

`codex exec` 无法向任何人提问：在非交互模式下，Codex 以审批策略 Never 运行（Codex 0.163 直接拒绝 `approval_policy = "untrusted"`），因此沙箱允许的命令会直接运行而不询问，不允许的则被拒绝。所以沙箱是唯一的关卡，mod 会把它限制得很窄：

- **`router.codex.sandbox`** 默认为 `"read-only"`：Codex 可以读取项目并运行只读命令；它不能编辑文件，也不能使用网络。这比 Claude 子进程（`acceptEdits`）更窄，因为 `codex exec` 无法在放行编辑的同时仍对命令进行把关。会显式传入 `-c approval_policy="never"`，因此任何提升出沙箱的请求都会被拒绝，绝不会执行。
- **选择放宽，风险自负：** `"workspace-write"` 允许 Codex 编辑项目中的文件，**并且在那里运行任何命令而不询问你**（网络保持关闭：`-c sandbox_workspace_write.network_access=false`）。`"danger-full-access"` 会完全移除沙箱；只应在一次性的、有外部沙箱隔离的环境中使用。其他任何值都表示只读。
- **`router.codex.allowOutsideGit`**（默认 `false`）会添加 `--skip-git-repo-check`。没有它时，Codex 在 git 仓库之外会拒绝启动，路由行显示 `child answer discarded (outside a git repo; set router.codex.allowOutsideGit)`，由主模型作答。
- **`router.codex.args`** 可以添加参数（例如 `-c model_reasoning_effort="high"`），但不能涉及沙箱或审批：`--sandbox`/`-s`、`--dangerously-bypass-approvals-and-sandbox`、`--approve-for-me`、`--full-auto`、`--add-dir`、`--skip-git-repo-check`、`-a`/`--ask-for-approval` 以及 `-c approval_policy=…`/`sandbox_mode=…`/`sandbox_workspace_write.…`/`sandbox_permissions=…` 都会被丢弃，会话日志会写明哪些被忽略了。在这里加入 `--ephemeral` 也会禁用下面的恢复功能。

**被拒绝的命令。** `codex exec --json` 不会报告被沙箱拦截的命令，也不会报告它拒绝的提升请求：两者都不会以事件形式出现（已在 Codex 0.163.0 上验证）。因此简报会要求 Codex 在回答末尾为每条被沙箱拦截的命令写上 `NEEDS-APPROVAL: <exact command>`，mod 也会统计 Codex 为被拒绝的提升请求写到 stderr 的 `reject command` 行。然后，与 Claude 子进程一样：

- 在默认只读模式下，mod 会用同样的对话框询问你，写明命令以及批准后允许做什么：*"Codex child on codex/default was refused by its read-only sandbox: touch made.txt. Allow and continue resumes it for this turn with permission to edit files in the project and run commands there (no network)."*（Codex 子进程被只读沙箱拒绝；Allow and continue 会在本轮次内恢复它，并允许其编辑项目中的文件和运行命令（无网络）。）选择 **Allow and continue** 后，同一个线程会恢复（`codex exec -C <cwd> resume --json … -c sandbox_mode="workspace-write" -c approval_policy="never" -c sandbox_workspace_write.network_access=false <thread> -`），并附带一条写明已批准命令的消息。这会在该轮次剩余时间内放宽沙箱，而不仅针对所写明的命令，这也是问题中会说明这一点的原因。每个轮次最多询问一次（`child.relayRounds: 0` 可关闭）。
- 选择 **Deny**、无人能回答，或你的沙箱本来就比只读更宽时，不会放宽任何东西，而且拒绝绝不会悄无声息：回答末尾会有一行写明被拒绝的命令（*Codex's sandbox refused, and nothing ran: `touch made.txt`.*），路由行会显示 `· sandbox read-only · refused: touch made.txt`（对于 Codex 未写明的提升请求，显示 `refused: 2 unnamed`）。
- 由于拒绝报告来自 Codex 自己的回答，忽略该指令的模型仍可能留下未写明的拒绝。路由行总会显示该轮次运行时的沙箱（`sandbox read-only` 或 `sandbox workspace-write (approved)`），因此无法写入的轮次是一目了然的。

如果 `PATH` 中没有 `codex`，mod 会提示 `codex is not installed: npm install -g @openai/codex (or brew install --cask codex) …`，路由行显示 `child answer discarded (codex not installed)`，由主模型作答。

**临界分数会获得第二意见。** 落在编码分界线上或高一分的分数会被再采样一次，取较高者，这样一个 7 或 8 分的调试任务不会因为分类器的噪声而在层级之间摇摆。

**它会记住失败。** 某个类型每出现两次子进程失败，该类型的编码分界线就降低一分（最低不低于 `simple + 1`），这样便宜模型总是做不好的工作会逐渐回到 Claude。`/route reset` 清除这份记忆。

**它会保护工作的连续性。** 子进程除了简报之外没有任何记忆，所以 mod 从不让追问落到子进程上。在子进程回答过的轮次之后，`continue`、`yes` 或任何不超过六个词的提示词都会回到主会话，因为主会话持有完整的对话记录。当主会话处于任务中途（它的上一个回答使用了工具）时，编码级别的工作会留在主会话中（路由行显示 `via mid-task guard`）；只有查找和新的、自成一体的任务才会被发出去。没有这些规则，一个已经路由过任务的会话会在每次 "continue" 时重新开始该任务。

**有些轮次从不离开主会话**，无论分数或 `/route` 固定如何，因为子进程看不到对话、队友、后台任务或会话的工具（路由行显示 `via notification`、`via session command`、`via security or verdict`）：

- 通知：`<teammate-message …>`、`idle_notification` JSON、`<task-notification>`、`[SYSTEM NOTIFICATION …]`；
- 关于会话状态或工具的简短操作命令（不超过 12 个词）：`approve git pull --ff-only`、`continue`、`resume`、`merge it`、`check the sub agents`、`what's the status`，以及任何提到 PR、分支、CI、workflow 或子 agent 的内容；
- 安全和裁决类轮次（`security`、`vulnerability`、`CVE`、`verdict`、…）。

### 子进程不可以做什么

每份简报都以一段前言开头：子进程无法访问主会话，绝不能编造状态、ID、PR 编号、运行结果或文件修改，绝不能要求你批准或运行任何东西，当任务需要会话的状态或工具时要回复 `HANDBACK`。随后 mod 会审查回答，在以下情况下丢弃它，让主模型自己完成该轮次：

| 回答 | 示例 |
| :- | :- |
| 以 `HANDBACK` 开头 | `HANDBACK` / `needs the PR list` |
| 声称被阻止，或要求你去操作 | "blocked by the permission system"、"you must approve it in the UI"、"run `gh pr create` yourself" |
| 没有任何工具调用（`num_turns` 1）却声称执行了操作或给出会话事实 | "I added X"、"PR #812 is open"、"14 commits behind"、"no build runs exist" |
| 大部分是在叙述意图 | "I'll read the config. Then I will update the router." |
| 重复已经给出的回答 | 每次空闲通知都重新发布同样的裁决 |

被丢弃的回答会计为该类型的一次子进程失败，并在路由行上显示为 `child answer discarded (<reason>), main model answered`。主模型从不被要求转述子进程的文本：mod 要么用经过审查的子进程回答完成该轮次，要么把该轮次交给主模型。

每条路由行和状态栏都会显示分数和类型，所以当某个决策看起来不对时，你可以看到背后的数字。

## 你会看到什么

Claude 和网关始终都是可见的：

| 位置 | 主会话轮次 | 被路由的轮次 |
| :- | :- | :- |
| 提示词上方的状态栏 | `mixture-of-models · auto · last: claude-opus-5 · critical 9/10`<br>`0: help  1: auto  2: glm  3: deepseek  …  9: claude  off` | 运行期间显示 `… · running glm-5.3 in a child…` |
| Spinner | `Thinking…` | `Thinking · via glm-5.3 (child)…` |
| 提问对话框 | Claude 自己的问题 | `Child on glm-5.3 wants to run: Bash(git pull --ff-only)`，带 Allow and continue / Deny |
| 对话记录中的回复 | 不变（在 `ui.tags: "all"` 下标记为 `⇢ claude-opus-5 · main session`） | 回复上方一行暗色的 `⇢ glm-5.3 · child on gateway`，保留在滚动记录中（Claude 成员为 `· child on your Claude subscription`，Codex 为 `· Codex child`） |
| 回答下方的一行 | `route: claude-opus-5 · main session · critical 9/10 via claude-haiku-5-5 · 23.1k in / 0.9k out · cache 91% · today: 8 turns, 5 off Claude (63%)` | `route: glm-5.3 · coding 6/10 via ollama · child 42s · saved ~$0.39 · today: …` |
| `/route` | `mixture-of-models live · mode auto · current route: … · today: … · saved ~$12.40 (61%) vs all claude-opus-5-5, at API prices` | 相同 |
| `/palgu login` | `Open https://www.palgu.ai/connect?code=WDJB-MJHT and approve code WDJB-MJHT …`，然后一条 toast：`Signed in to Palgu as you@acme.com (Acme, plan starter). Routed turns now run on Palgu.` | 相同 |
| `/route stats` | 一个名为 "Mixture of models" 的面板，有四个标签页，用热键 1-4 切换：**models**（每个模型的条形图、轮次占比、标题 "N of M turns off Claude"，以及以绿色显示的路由节省额）、**kinds**（每种类型以及处理它的模型）、**scores**（按层级着色的 1-10 直方图，标出分界线）、**recent**（最近的决策，含分数、类型、模型和子进程耗时）。按 Esc 关闭。 | 相同 |

### 能节省多少

每个被路由的轮次都会被计价两次：按你会话的 Claude 模型计价（同样的 token 在那里要花多少钱），以及按实际花费计价。在 Palgu 上，实际花费来自 Palgu 自己的 `/v1/pricing/quote`，也就是它的计费公式；在其他网关上，来自 `router.prices`；`claude/<member>` 子进程按该成员的 Claude 费率计价。留在主会话中的轮次也计入全 Claude 总额，所以百分比是路由从你整个 Claude 账单中省下的比例，而不仅仅是被路由轮次的比例。

- 每个被路由的回答下方：`· saved ~$0.39`。
- `/route status`：`saved ~$12.40 (61%) vs all claude-opus-5-5, at API prices`，跨会话累计。
- `/route stats`：同样的总额，以绿色显示在 models 标签页上。

在我们自己的使用中，全天候运行的 coding agent 仅用 Claude 时，大约三天就用完了 Claude Max 20x 订阅的每周限额；使用 Mixture of Models 后，同一订阅可以撑满整整七天。参见 [GUIDELINES.md](GUIDELINES.md#粗略节省仅订阅-vs-mixture-of-models)。

这是一个估算，而且它会明确说明这一点。Claude 价格是 API 标价（Opus 5.5 每百万输入 / 输出 token $4 / $20，Sonnet 5.5 $2 / $10，Haiku 5.5 $0.10 / $0.50，Fable 5.1 $10 / $50；缓存读取以及 5 分钟和 1 小时缓存写入按各自的费率），所以在 claude.ai 订阅上，它是等价于 API 的节省，而不是退还给你的钱。它假设被路由的轮次在 Claude 上会使用相同数量的 token。mod 无法计价的被路由轮次（网关的 `router.prices` 中没有该模型的条目，或 Codex 子进程）不计入节省；`/route status` 会把它计为未计价。

状态栏的按钮有数字热键：在提示词为空时，输入 `3` 并稍作停顿即可固定 Kimi，`1` 回到自动，`0` 打开帮助：一个面板，说明 mod 做什么、当前状态（模式、网关、节省）、每个按钮和命令的作用，以及如何连接 Palgu、OpenRouter 或 LiteLLM。`/route help` 也会打开它。用 `"ui": { "band": false }` 关闭状态栏。

## 其他 coding agent

mod 运行在 Claude Code 内部。对于其他 agent，`mom` CLI 和每个工具对应的轻量适配器提供同样的能力：Palgu 为每个请求挑选模型，Palgu 记忆被召回到每条提示词中，在任务中途停下的轮次会被继续（[ADR 0005](../../adr/0005-other-coding-agents.md)）。

```bash
npm install -g github:alinaqi/mixture-of-models-claude-mod   # 安装 `mom` 以及所有 agent 的插件文件
mom login                                                     # 在浏览器中登录 Palgu
```

然后，针对你的 agent：

```bash
# Codex
mom setup codex --write && codex plugin marketplace add alinaqi/mixture-of-models-claude-mod && codex plugin add mixture-of-models@mixture-of-models
codex -p palgu

# Cursor（在项目文件夹中；然后执行 Developer: Reload Window）
mom setup cursor --write

# OpenCode
mom setup opencode --write

# Antigravity
agy plugin install "$(npm root -g)/mixture-of-models-claude-mod/integrations/antigravity"

# GitHub Copilot CLI
copilot plugin install alinaqi/mixture-of-models-claude-mod:integrations/copilot
```

可选，按项目开启，会把源代码上传到 Palgu：`mom memory on`。所有命令以及检查和故障排除：[INSTALL.md](INSTALL.md)。如何充分发挥每个 agent 的作用：[GUIDELINES.md](GUIDELINES.md)。

| Agent | 状态 | 指南 |
| :- | :- | :- |
| Codex（CLI，0.163+） | 插件：记忆召回、心跳、索引；`codex -p palgu` 经由 Palgu 路由 | [integrations/codex](integrations/codex/README.md) |
| Cursor | 插件（或 `mom setup cursor`）：用于 Palgu 记忆搜索和委派给 Palgu 模型的 MCP 服务器（`mom mcp`），通过 hook 实现心跳和索引，以及一条说明何时委派的规则。没有逐轮路由：Cursor 的 hook 无法更改模型 | [integrations/cursor](integrations/cursor/README.md) |
| OpenCode（1.19+） | 功能完全对等的插件：逐请求选择 Palgu 模型（auto、`/route` 固定或你的层级路由）、记忆召回、心跳、索引、`/route` 和 `/palgu`；`mom setup opencode --write` 添加提供方 | [integrations/opencode](integrations/opencode/README.md) |
| Antigravity（`agy` 1.0.7+） | 插件：把记忆召回到每个轮次的第一次模型调用中、心跳、索引、通过 MCP 提供 Palgu 工具（`palgu_delegate` 用于被路由的子任务）。它的 hook 无法更改模型 | [integrations/antigravity](integrations/antigravity/README.md) |
| GitHub Copilot CLI（1.0.112+） | 插件：心跳、索引、通过 MCP 提供 Palgu 工具（记忆搜索、`palgu_delegate`），以及一个说明何时使用它们的 skill。它的 hook 无法更改模型，也无法向提示词添加内容 | [integrations/copilot](integrations/copilot/README.md) |
| Aider、Continue、Goose | Palgu 路由（`model: auto`）；没有 hook，因此没有记忆召回或心跳。Aider 已实测 | [integrations/gateway](integrations/gateway/README.md) |

Palgu 记忆的同意（`mom memory on`）按项目文件夹记录，并由所有使用 `mom` 的 agent 共享。它与 mod 的 `/palgu memory on` 相互独立。

## 要求

- Claude Code **v2.1.287 或更高版本**（`claude --version`）。Mod 无法在旧版本中加载；运行 `claude update`。
- 一个子进程可以使用的网关：Palgu 的 Anthropic 端点、OpenRouter、LiteLLM 代理，或任何能提供 `routes` 中模型 id 的 Anthropic 兼容端点，以及其密钥。
- 可选：带一个小模型的 Ollama，用于免费分类（`ollama pull qwen2.5-coder:3b`）。没有它时，分类器会回退到你套餐中的 Haiku。

## 设置

完整的步骤见 [GETTING_STARTED.md](GETTING_STARTED.md)，或使用 `./install.sh`。

1. 为子进程配置网关。在 Palgu 上，`/palgu login` 会完成这整一步：它使用 Palgu 的设备登录（与 `srooterctl` 使用的相同），Palgu 为这台电脑生成一个可以在其 Devices 页面撤销的密钥，mod 通过 `claude plugin configure --values-stdin` 保存 URL 和密钥。否则，插件会询问两个值，密钥会被遮盖显示并保存在 Claude Code 的安全存储中，从不写入设置文件：

   ```
   /plugin configure mixture-of-models@mixture-of-models-claude-mod
   ```

   或者在 shell 中：运行 `claude plugin configure mixture-of-models@mixture-of-models-claude-mod --values-stdin`，在其输入中键入 `{"gateway_url":"https://api.palgu.ai/anthropic","gateway_key":"<your key>"}` 并按 Ctrl-D，这样密钥不会出现在你的 shell 历史记录和进程列表中。

2. 可选：在 `~/.claude/model-config.json` 中调整路由、阈值和子进程。仓库中的 `config.example.json` 是一个完整的起点（下文也有展示）。

3. 启动 `claude` 并运行 `/route`。

在网关 URL 和密钥就绪之前，mod 处于**仅观察模式**：它会分类，`/route` 会显示它将如何处理，但不会启动任何子进程。

第三个选项 `gateway_provider` 说明网关的类型：`auto`（默认值，为空时也是如此）会从 URL 中识别 Palgu（`*.palgu.ai`）和 OpenRouter（`openrouter.ai`），并把其他任何主机视为通用的 Anthropic 兼容网关，与 0.16 之前完全一样；`palgu`、`openrouter`、`litellm` 或 `anthropic-compatible` 则直接指定类型。提供方决定子进程如何发送密钥，以及默认路由和状态栏使用哪些模型 id：

| 提供方 | 子进程认证 | 默认模型 id | `x-srooter-*` 请求头 |
| :- | :- | :- | :- |
| `palgu` | `ANTHROPIC_API_KEY`（`x-api-key`） | Palgu 的：`glm-5.3`、`deepseek-pro`、… | 是 |
| `openrouter` | `ANTHROPIC_AUTH_TOKEN`（`Authorization: Bearer`） | 家族背后的 OpenRouter slug：`glm/5.3` → `z-ai/glm-5.3`、… | 否 |
| `litellm` | `ANTHROPIC_AUTH_TOKEN`（`Authorization: Bearer`） | Palgu 的名称；以你代理的 `model_name` 为准 | 否 |
| `anthropic-compatible` | `ANTHROPIC_API_KEY`（`x-api-key`） | Palgu 的 | 是 |

无论哪个变量携带密钥，子进程的环境都会把另一个变量设为空，因为子进程会继承你的 shell，而当两者都设置时 Claude Code 会同时发送它们：在你 shell 中导出的 `ANTHROPIC_API_KEY` 永远不会被顺带发给 OpenRouter，残留的 `ANTHROPIC_AUTH_TOKEN` 也永远不会到达 Palgu。密钥从不出现在命令行上。

### OpenRouter

1. 在 [openrouter.ai/keys](https://openrouter.ai/keys) 创建一个密钥。
2. 运行 `/plugin configure mixture-of-models@mixture-of-models-claude-mod`，填写

   | 选项 | 值 |
   | :- | :- |
   | `gateway_url` | `https://openrouter.ai/api` |
   | `gateway_key` | 你的 OpenRouter 密钥（`sk-or-…`） |
   | `gateway_provider` | `auto`（或 `openrouter`） |

   或者在 shell 中：运行 `claude plugin configure mixture-of-models@mixture-of-models-claude-mod --values-stdin`，在其输入中键入 `{"gateway_url":"https://openrouter.ai/api","gateway_key":"<your key>","gateway_provider":"openrouter"}` 并按 Ctrl-D，这样密钥不会出现在你的 shell 历史记录中。
3. 启动 `claude`。简单和编码轮次运行在 `z-ai/glm-5.3` 上，research 和 review 运行在 `moonshotai/kimi-k3.1-pro` 上；状态栏提供 `glm`、`kimi`、`deepseek`（`deepseek/deepseek-v4-pro`）、`gemini`（`google/gemini-3.8-flash`）、`minimax`（`minimax/minimax-m3`、`minimax/minimax-m3.1-flash`）、`gpt`（`openai/gpt-6-sol`、`-luna`、`-astra`）和 `mercury`（`inception/mercury-3`）。共有十一个按钮，最后一个没有数字热键；请点击它或用 Tab 切换过去。这些是 [OpenRouter 的模型列表](https://openrouter.ai/models)在 2026-10-29 提供的 slug。OpenRouter 没有 Kimi highspeed 版本，因此 `kimi/auto` 在每个层级都是 `pro`。

OpenRouter 上的路由使用家族成员（`glm/5.3`）来指定，因为 OpenRouter 的 slug 中含有 `/`；家族中列出的 slug（`z-ai/glm-5.3`）也可以使用。要使用其他 OpenRouter 模型，把它加入一个家族并路由到它：

```json
{ "router": {
    "families": { "glm": { "members": { "4.6": "z-ai/glm-4.6" } } },
    "routes":   { "simple": "glm/4.6" } } }
```

正如 [OpenRouter 的 Claude Code 指南](https://openrouter.ai/docs/guides/guides/claude-code-integration)所说，Claude Code 只保证能与 Anthropic 自己的模型配合使用；如果被路由轮次的模型无法处理 Claude Code 的工具，该轮次会失败，由主模型作答。

### LiteLLM

[LiteLLM 代理](https://docs.litellm.ai/docs/tutorials/claude_responses_api)在它自己的地址上提供 Anthropic 兼容的 `/v1/messages`。它运行在你的主机上，所以永远不会被自动识别：请明确指定。

| 选项 | 值 |
| :- | :- |
| `gateway_url` | 你的代理，例如 `http://localhost:4000`（或其 `/anthropic` 直通地址 `http://localhost:4000/anthropic`） |
| `gateway_key` | 代理的 master key 或一个 virtual key（`sk-…`） |
| `gateway_provider` | `litellm` |

子进程以 `Authorization: Bearer` 发送密钥。模型名称就是你代理的 `config.yaml` 中定义的 `model_name`。默认值是 Palgu 的名称（`glm-5.3`、`kimi-k3.1-pro`、…）：要么把你代理的模型取同样的名字，要么把路由指向你自己的模型：

```json
{ "router": {
    "routes":   { "simple": "my-glm", "coding": "my-glm", "kinds": { "research": "my-kimi", "review": "my-kimi" } },
    "families": { "glm": { "members": { "mine": "my-glm" } } } } }
```

virtual key 只能访问它被允许的模型；401 或未知模型会导致子进程失败，由主模型作答。

## 安全与数据使用

### 本插件联系的网络主机

- `https://api.palgu.ai` — Palgu，固定写在代码中：`/palgu login` 时访问 `/auth/device/code` 和 `/auth/token`，`/palgu status` 时访问 `/me` 和 `/me/org-settings`，在会话开始时、`/palgu login` 之后以及 `/route models` 时访问 `/v1/models/health`（以 `x-api-key` 发送网关密钥；不发送其他任何内容），当你的网关是 Palgu 且 `router.prices` 中没有该模型的条目时，在被路由的轮次之后访问 `/v1/pricing/quote`，当主会话结束一个轮次时访问 `/anthropic/heartbeat`（心跳，见下文），在你运行过 `/palgu memory on` 的项目中，对你的每条提示词访问 `/v1/cortex/search`（Palgu 记忆召回，见下文）。
- `https://raw.githubusercontent.com` — 在会话启动时（最多每 12 小时一次，在后台）以及 `/route update` 时：对 `/alinaqi/mixture-of-models-claude-mod/main/.claude-plugin/plugin.json` 发起 GET，以读取已发布的版本。不发送任何内容。
- `http://localhost:11434` — 本地 Ollama（`/api/chat`），为每条提示词打分。数据留在你的机器上；如果那里没有响应则跳过。
- Anthropic，通过 Claude Code 自己的 `$.model.classify`，使用你自己的套餐 — 仅当 Ollama 没有响应时，用于为提示词打分。
- 你在插件设置中设置的网关 URL（`gateway_url`，例如 `https://api.palgu.ai/anthropic`、`https://openrouter.ai/api` 或你的 LiteLLM 代理）。用户可以在插件设置中设置自定义网关 URL；被路由的轮次只会联系该 URL，而且联系它的是子进程，不是 mod。Codex 子进程使用该网关的 `/v1`（或你设置的 `router.codex.baseUrl`），或在 `codex.auth: "chatgpt"` 下使用你自己 Codex 登录的 OpenAI。`claude/<member>` 子进程使用你自己 Claude 登录的 Anthropic。

### 插件发送的数据

- 对话消息（`session.messages`）：提示词以及最近 `router.child.contextMessages` 条（默认 12 条）含文本的消息，每条截断为 1,200 个字符，并附上它们使用过的工具名称。这些内容被写入子进程的 stdin，子进程把它们发送到上述网关 URL（或对于相应路由，发送到 Anthropic 或 Codex）以获取模型的回答。仅在被路由的轮次上发送：即分数或你的 `/route` 固定把它从主会话发出去的轮次。关键、安全、通知和操作类轮次本身从不被路由，但之后某个被路由轮次的上下文可能包含它们最近的文本，因为上下文就是最近的含文本消息，不论其路由如何。子进程工作时，它自己的 agent 循环还会发送其工具在项目中读取的内容，但受[子进程不可以做什么](#子进程不可以做什么)中拒绝规则的约束。
- 提示词文本和评分规则：对每条进入分类的提示词，发送给本地 Ollama，或通过 `$.model.classify` 发送给 Anthropic。
- 本地文件内容（`fs.read`）：`~/.claude/model-config.json`（你的设置；从不发送）和 `~/.claude/mixture-of-models/strategies/*.md`（你的路由策略；当前策略的评分规则是打分提示词的一部分，因此会如上所述发送给 Ollama 或 Anthropic）。mod 自己不读取任何项目文件。
- 发给 Palgu：`/palgu login` 时发送客户端 id `mixture-of-models`、设备名称 `Claude Code on <HOSTNAME>`、mod 的版本、一个随机安装 id 和设备代码；`/palgu status` 时以 Bearer 请求头发送网关密钥；询价时发送模型 id、四项 token 计数和密钥。不含任何提示词或回答文本。
- 发给 Palgu 的心跳：当主会话完成一个回答且你的网关是 Palgu（并且 `router.heartbeat` 不是 `local` 或 `off`）时，发送该回答的最后 600 个字符、一个会话 id（安装 id 和提示词的序号）以及作为 `x-api-key` 的密钥。Palgu 会告知该轮次是否停在了任务中途。不发送对话中的其他任何内容。
- 通过 `palgu` CLI 发给 Palgu，且仅在你运行 `/palgu memory on` 之后：项目的源文件，用于 Palgu 记忆（参见“程序”部分）。`palgu` 使用它自己的登录。
- 发给 Palgu 的 Palgu 记忆召回，仅在你运行过 `/palgu memory on` 的项目文件夹中，并且 mod 已登录 Palgu 时：你的每条四个词及以上的提示词（合并为一行，最多 300 个字符；不包括斜杠命令）、项目的 Palgu 名称，以及作为 Bearer 请求头的密钥，发送到 `/v1/cortex/search`。返回的内容（最多 8 条单行线索：记录的意图和 ADR、文档、代码符号及其文件；最多 2,000 个字符）会附加在你的提示词旁供主会话使用，并加入被路由子进程（Claude、Palgu 模型或 Codex）的简报中，因此每个作答的模型看到的是同样的记忆。失败或耗时超过 3 秒的搜索不会添加任何内容，也从不拖延提示词。
- 发给 Palgu 或通用网关的子进程标识请求头：`x-srooter-client`（mod 名称和版本）、`x-srooter-project`（会话文件夹的名称，转为 slug），以及在 Palgu 上的 `x-srooter-pin`（被路由的模型 id）。参见[子进程发送的请求头](#子进程发送的请求头)。 带有路由模型的子进程还会发送 `x-palgu-fallback: auto`。
- 不发送其他任何数据。没有遥测。没有分析统计。

### 插件运行的程序

每个 `$.process.run` 调用都在调用处以字面文本写明其程序和固定参数。它们都不通过 shell 运行。

- `claude -p --model <model> --output-format stream-json --verbose --max-turns <n> --add-dir <cwd> <child.args> --disallowedTools <deny rules>` — Claude Code 本身，以无头模式运行，用于在网关或你的 Claude 登录上（`claude/<member>` 路由）运行被路由的轮次。动态参数：模型 id（来自你的路由或固定；除非它是一个仅由字母、数字和 `. _ : / @ [ ] -` 组成、不以 `-` 开头、最多 200 个字符的普通 id，否则会被拒绝）、轮次上限，以及来自你 `model-config.json` 的 `child.args`/`router.child.deny`，还有会话的工作目录；如果其中任何一个不是普通字符串或包含 NUL，都会被拒绝。在你批准了子进程被拒绝的命令之后，同一调用会追加 `--resume <its session id> --allowedTools <the patterns you approved>`。
- `codex exec --json … -`，以及在你批准被拒绝的命令后的 `codex exec -C <cwd> resume --json … <thread id> -` — Codex CLI，仅用于 `codex` 路由，执行同样的检查（线程 id 作为普通 id）。
- `claude plugin configure mixture-of-models@mixture-of-models-claude-mod --values-stdin` — 在 `/palgu login` 之后运行一次，把 Palgu 生成的密钥保存到 Claude Code 的安全存储中。所有参数都是固定文本；密钥只通过 stdin 传入，并且只有在确认它是一个普通 token（`A-Z a-z 0-9 . _ -`，8 到 512 个字符）之后才传入。
- `claude plugin marketplace update mixture-of-models-claude-mod`，然后 `claude plugin update mixture-of-models@mixture-of-models-claude-mod` — 在 `/route update` 时，仅当 GitHub 列出了更新的版本时运行。所有参数都是固定文本。
- `palgu memory index .`（在会话文件夹中，在后台，每个项目最多每 10 分钟一次）和 `palgu memory status . --json` — Palgu CLI，仅在你运行过 `/palgu memory on` 的项目文件夹中，并且 mod 已登录 Palgu 时运行。所有参数都是固定文本。`palgu` 使用它自己的密钥登录（`palgu login`）；mod 不向它传递任何密钥、环境变量或 stdin。索引会把项目的源文件上传到 Palgu，所以在你开启之前它是关闭的。
- 插件从不运行从网络接收到的命令。网络响应从不会出现在 `process.run` 的 argv 中：GitHub 的回答只决定固定的更新命令是否运行，而唯一会传到某个进程的获取值是 Palgu 密钥，通过 stdin 传入，并经过上述检查。

### Hook

- `prompt.submit` — 读取提示词以决定其路由（预路由规则，然后是分类器分数，然后是阈值）。原样放行提示词：从不丢弃、改写或添加内容。fail-open。
- `turn.step` — 对于被路由的轮次，运行上述子进程代替主模型，并用子进程的文本回答该轮次；其他所有轮次和所有子 agent 都原样通过。子进程失败或回答被丢弃时，把该轮次交还给主模型。
- `turn.complete` — 在轮次文本后追加路由行（路由、分数、成本、节省），并更新插件存储中的计数、决策日志和节省总额。然后是心跳：当主会话的回答停在任务中途时（它宣布了一个操作就结束了，或者在你要求修改时，描述了它实际没有做的编辑），mod 会提交一条它自己的继续提示词（`$.prompt.submit`，对模型显示为来自本插件），每条你的提示词最多 `router.heartbeatMax`（3）次。fail-open：出错从不会阻止停止。
- 还有：`session.start`（读取设置，注册 `/route` 和 `/palgu`）、`turn.start`（清除上一次的子进程结果）、`ui.render` 用于 `AbovePrompt`（状态栏）、`AssistantMessage`（子进程回复上的来源标记）、`Pane`（帮助和统计面板）和 `Spinner`（`via <model> (child)…`），以及 `command.run` 用于 `/route` 和 `/palgu`。mod 从不处理 `tool.call` 或 `tool.check`。

### 新增的命令、工具和 agent

- `/route` — 显示路由状态，固定一个层级、模型、家族成员或 `codex`，切换策略，打开统计或帮助面板，重置失败记忆，或更新插件（`/route update`）。
- `/palgu` — 登录 Palgu（`login`），显示设置的是谁的密钥、你的组织本周期花费了多少 Palgu 预算以及项目是否在 Palgu 记忆中（`status`），链接到套餐和计费（`upgrade`），或为你所在的项目开启或关闭 Palgu 记忆（`memory on`、`memory off`、`memory`；每个项目文件夹都需要单独运行 `memory on`）。
- `routing-strategy` skill — 帮助编写或解释路由策略文件。
- 没有工具，没有 agent，没有 MCP 服务器。

### 凭据

- API 密钥由用户通过插件设置输入（`user_config`，以敏感信息存储）：一个密钥 `gateway_key`，用于你配置的网关（Palgu、OpenRouter、LiteLLM 或其他 Anthropic 兼容端点）。`/palgu login` 会替你填写同一个设置。
- 插件不从用户机器上的环境变量或文件中读取密钥。它读取的环境变量是 `HOME`、`HOSTNAME`、`MAGGY_ROUTER_CHILD` 和 `ANTHROPIC_CUSTOM_HEADERS`（你自己的额外请求头，只传给网关子进程）。
- 每个密钥只发送到它自己提供方的主机：`gateway_key` 由子进程从子进程的环境中（从不通过其 argv）发送到你配置的网关（或在 Codex 路由上，发送到你在 `model-config.json` 中设置的 `router.codex.baseUrl`），并且只有当该网关是 Palgu 时，才由 mod 发送到 `https://api.palgu.ai`。

## 本插件运行、读取、发送和存储什么

插件目录的安全扫描会把本节与代码进行对比。mod 在其自身代码之外所做的一切都列在这里。概括来说：

- 仅当你运行 `/palgu` 时，它会**请求** `https://api.palgu.ai`（`/auth/device/code`、`/auth/token`、`/me`），并**运行**一次 `claude plugin configure … --values-stdin` 来保存 Palgu 生成的密钥（见下方表格）。
- 它用 `$.http.fetch` **请求** `http://localhost:11434/api/chat`，把提示词文本和评分规则发送给本地 Ollama，为提示词打分。不含凭据，没有数据离开本机。
- 当 Ollama 没有响应时，它会**调用** `$.model.classify`，通过 Claude Code 自己的 API 客户端、使用你自己的账号，把同样的提示词文本和评分规则发送给 Anthropic。
- 在会话启动时（在后台，最多每 12 小时一次）以及 `/route update` 时，它会**获取** `https://raw.githubusercontent.com/alinaqi/mixture-of-models-claude-mod/main/.claude-plugin/plugin.json`（一次普通 GET，不发送任何内容），以查看是否有更新的版本，如果有，会通过 toast 和状态栏告知。
- 仅在 `/route update` 时，且 GitHub 列出了更新的版本时，它会以固定文本**运行**针对本插件的 `claude plugin marketplace update` 和 `claude plugin update`。
- 对于被路由的轮次，它用 `$.process.run` **运行**两个程序：`claude`（Claude Code 本身，无头模式），要么带着 `ANTHROPIC_BASE_URL` 和你配置的密钥（放在 `ANTHROPIC_API_KEY` 中，或者对 OpenRouter 和 LiteLLM 放在 `ANTHROPIC_AUTH_TOKEN` 中，另一个设为空），并且对 Palgu 和通用网关设置 `ANTHROPIC_CUSTOM_HEADERS` 来标识自身（参见[子进程发送的请求头](#子进程发送的请求头)），要么对于 `claude/<member>` 路由，在你自己的 Claude 登录上运行并清除 `ANTHROPIC_BASE_URL`；以及仅对于 `codex` 路由运行的 `codex exec`（Codex CLI），把你的网关密钥放在 `PALGU_API_KEY` 中（OpenRouter 上为 `OPENROUTER_API_KEY`，LiteLLM 上为 `LITELLM_API_KEY`），或使用你自己的 Codex 登录。每个子进程都会把你的提示词和最近会话文本的简短摘要**发送**到它的端点。
- 它**读取** `~/.claude/model-config.json`、你的策略文件、`HOME`、`HOSTNAME`、`MAGGY_ROUTER_CHILD` 和 `ANTHROPIC_CUSTOM_HEADERS`，并在插件存储中**存储**路由固定、每日计数、最近一次判定、按类型的失败计数、最近一次更新检查以及最近 200 次决策的日志（日期、模型、类型、层级、分数、分类器来源、子进程耗时和退出码；从不包含提示词文本）。

详细内容如下；隐私政策见 [PRIVACY.md](PRIVACY.md)。

### Hook

hook 模块 `hooks/register.js` 注册了十一个 hook。每个 hook 对其看到的事件和调用做了什么：

| Hook | 作用 |
| :- | :- |
| `session.start` | 读取 `~/.claude/model-config.json` 和你的策略文件，从插件选项中获取网关 URL 和密钥，记住会话的模型，从插件存储加载 `/route` 固定，并注册 `/route` 和 `/palgu` 命令。当设置了 `MAGGY_ROUTER_CHILD` 时什么也不做，因此 mod 在它自己的子进程中保持不活动。 |
| `prompt.submit` | 原样放行每条提示词。同时它会决定路由：先是预路由规则，然后是分类器给出的 1-10 影响范围分数（参见“网络”部分），然后是阈值。从不丢弃、改写或向提示词添加内容。fail-open：即使打分抛出异常，提示词仍会通过。 |
| `turn.start` | 清除上一个轮次的子进程结果。 |
| `turn.step` | 对于被路由的轮次，不让主会话调用其模型，而是运行“程序”部分所述的子进程（网关上或你 Claude 登录上的 Claude Code，或 Codex），并以 `stopReason: end_turn` 把子进程的文本作为该轮次的回答输出。如果子进程的权限系统拒绝了某条命令，该 hook 会用 `$.ui.ask`（Claude 用于提问的对话框）询问你，写明确切的命令；选择 "Allow and continue" 时，它会恢复同一个子进程并允许这些命令，最多 `relayRounds` 次；选择 "Deny" 或无人能回答时，子进程自己的说明就是回答。Codex 子进程会就它写明被拒绝的命令以同样的方式询问，每个轮次一次；选择 "Allow and continue" 时，同一个 Codex 线程会恢复，并允许在项目中编辑（参见[沙箱与审批](#沙箱与审批)）。对于其他所有轮次以及子 agent，它会原样调用 `next(e)`。如果子进程失败或没有输出，它会调用 `next(e)`，由主模型作答。 |
| `turn.complete` | 在回答下方追加一行，写明路由、分数、成本和运行位置，以及被路由轮次节省了多少；更新插件存储中的每日计数和节省总额。在 Palgu 上，它会向 `/v1/pricing/quote` 询问被路由轮次的花费。 |
| `ui.render` 用于 `AbovePrompt` | 绘制状态栏：当前模式和最近一次决策，以及更改 `/route` 固定的按钮。保留其他 mod 在那里绘制的内容。 |
| `ui.render` 用于 `AssistantMessage` | 在子进程生成的回复上方放置一行暗色的来源标记。其他回复原样通过。 |
| `ui.render` 用于 `Spinner` | 在被路由的轮次中，在 spinner 的文字后添加 `via <model> (child)…`。 |
| `ui.render` 用于 `Pane` | 当 `/route stats` 打开时，根据决策日志绘制 "Mixture of models" 统计面板（id `routing-stats`）。其他面板原样通过。 |
| `command.run` 用于 `/palgu` | `login` 启动 Palgu 的设备登录，并立即回复链接和代码；然后一个 `$.clock` 计时器每 `interval` 秒轮询一次 `/auth/token`（每次收到 `slow_down` 后增加 5 秒），直到你批准、拒绝或代码过期，然后保存密钥，并在本会话中把子进程切换到 Palgu。`status` 向 Palgu 的 `/me` 查询密钥属于谁；`upgrade` 打印计费链接。 |
| `command.run` 用于 `/route` | 显示路由状态和家族（`/route`、`/route status`），或设置固定（`auto`、`off`、某个层级、某个模型、`<family>/<member>`、`<family>/auto` 或 `codex`）。未知的家族或成员会被拒绝，并列出有效的选项。 |

mod 从不处理 `tool.call` 或 `tool.check`，因此它从不批准、拒绝或修改工具调用，也从不改变权限提示。

### 网络：本插件联系的主机

先是 mod 自己的调用，然后是子进程的调用：

| 谁 | 调用 | 地址 | 发送什么 | 为什么 |
| :- | :- | :- | :- | :- |
| mod，在会话启动时（最多每 12 小时一次）以及在 `/route update` 中 | `$.http.fetch` | `https://raw.githubusercontent.com/alinaqi/mixture-of-models-claude-mod/main/.claude-plugin/plugin.json`，固定写在代码中 | 只有 GET 请求本身 | 读取已发布的版本，与你的版本比较。 |
| mod，在 `/palgu login` 中 | `$.http.fetch` | `https://api.palgu.ai/auth/device/code`，然后是 `/auth/token`，固定写在代码中 | 客户端 id `mixture-of-models`、设备名称（`Claude Code on <HOSTNAME>`）、mod 的版本，以及它保存在存储中的一个随机安装 id；然后是 Palgu 给出的设备代码 | 登录。Palgu 返回一个用于这台电脑的密钥。 |
| mod，在会话开始时、`/palgu login` 之后以及 `/route models` 时 | `$.http.fetch` | `https://api.palgu.ai/v1/models/health`，固定写在代码中 | 只有 GET 请求和作为 `x-api-key` 的网关密钥；仅当你的 `gateway_url` 位于 `https://api.palgu.ai` 上时 | 读取 Palgu 当前提供哪些模型、哪些不可用，使模型列表跟随 Palgu 而不是跟随版本发布。保存在 mod 的存储中供下一个会话使用。 |
| mod，在 Palgu 上的被路由轮次之后的 `turn.complete` 中 | `$.http.fetch` | `https://api.palgu.ai/v1/pricing/quote`，固定写在代码中 | 被路由的模型 id 和子进程的四项 token 计数（输入、输出、缓存读取、缓存写入），以及作为 Bearer 请求头的网关密钥；仅当你的 `gateway_url` 位于 `https://api.palgu.ai` 上，且 `router.prices` 中没有该模型的条目时 | 为节省估算给该轮次定价。不含提示词或回答文本。 |
| mod，在 `prompt.submit` 中，仅在运行过 `/palgu memory on` 的地方 | `$.http.fetch` | `https://api.palgu.ai/v1/cortex/search`，主机和路径固定写在代码中 | 你的提示词（一行，最多 300 个字符）、项目的 Palgu 名称、`limit=8`，以及作为 Bearer 请求头的网关密钥；仅当你的 `gateway_url` 位于 `https://api.palgu.ai` 上时 | Palgu 记忆召回：来自项目记忆的线索会附在提示词旁供主会话使用，并加入被路由子进程的简报中。 |
| mod，在 `/palgu status` 中 | `$.http.fetch` | `https://api.palgu.ai/me` 和 `https://api.palgu.ai/me/org-settings`，固定写在代码中 | 网关密钥，作为 Bearer 请求头，仅当你的 `gateway_url` 位于 `https://api.palgu.ai` 上时（其他网关的密钥从不发送） | 显示密钥属于谁、组织的套餐，以及组织本周期花费了多少 Palgu 预算。 |
| mod，在 `prompt.submit` 中 | `$.http.fetch` | `http://localhost:11434/api/chat`，固定写在代码中 | 评分规则和提示词文本，作为一个 Ollama 聊天请求，不含凭据 | 免费的本地分类。如果那里没有响应则跳过。 |
| mod，在 `prompt.submit` 中 | `$.model.classify` | 通过 Claude Code 自己的客户端和你自己的套餐访问 Anthropic 的 API | 评分规则和提示词文本 | Ollama 不可用时的分类。模型：`classifier` 别名，默认为 `claude-haiku-5-5`。 |
| 子进程（Claude Code 本身），在 `turn.step` 中启动 | Claude Code 的常规 API 客户端 | 你在插件选项中设置的 `gateway_url`（例如 `https://api.palgu.ai/anthropic`、`https://openrouter.ai/api` 或你的 LiteLLM 代理），以 `gateway_key` 作为其 `x-api-key`（Palgu、通用网关）或 `Authorization: Bearer`（OpenRouter、LiteLLM） | 你的提示词加上会话最近 `contextMessages` 轮交流的简报（仅文本，已截断），然后是子进程自己的 agent 循环在工作时发送的内容 | 这正是本插件的意义所在：该轮次运行在网关的模型上，而不是主会话的模型上。 |
| Claude 成员子进程（`claude/<member>` 路由），在 `turn.step` 中启动 | Claude Code 的常规 API 客户端 | Anthropic，使用你自己的 claude.ai 登录，与你的主会话相同 | 同样的简报，然后是子进程自己的 agent 循环 | 在另一个 Claude 模型上运行该轮次，而无需重新指向主会话。 |
| Codex 子进程（`codex` 路由），在 `turn.step` 中启动 | Codex CLI 自己的客户端 | 使用 `codex.auth: "palgu"` 时：你网关的 `/v1`（例如 `https://api.palgu.ai/v1/responses`、`https://openrouter.ai/api/v1/responses` 或 `<your LiteLLM proxy>/v1/responses`），配合 `gateway_key`；使用 `"chatgpt"` 时：OpenAI，使用你自己的 Codex 登录 | 同样的简报，然后是 Codex 自己的 agent 循环 | 在 Codex 上运行该轮次。 |

mod 不联系其他任何主机。网关由你配置；不会向任何固定的第三方发送数据。

### 本插件运行的程序

**哪些程序：** 三个，`palgu`（Palgu CLI，仅在 `/palgu memory on` 之后：`palgu memory index .` 和 `palgu memory status . --json`，都是固定文本）、`claude`（无头模式的 Claude Code 本身；在 `/palgu login` 之后还会以 `claude plugin configure mixture-of-models@mixture-of-models-claude-mod --values-stdin` 运行一次，通过 stdin 传入网关 URL 和密钥以保存它们；在 `/route update` 时，如果发布了更新的版本，会依次运行 `claude plugin marketplace update mixture-of-models-claude-mod` 和 `claude plugin update mixture-of-models@mixture-of-models-claude-mod`），以及 `codex`（Codex CLI，`codex exec`，仅用于 `codex` 路由）。插件不运行 shell，不运行插件文件夹中捆绑的脚本，不运行包启动器，也不运行其他任何可执行文件。

**为什么：** mod 可以重命名请求中的模型，但无法更改其所在会话的端点或凭据。要在另一个端点上用 Claude Code 自己的工具运行一个轮次，同时保持主会话的端点和凭据不变，唯一的办法就是启动第二个 Claude Code 进程，并让它的环境指向网关。子进程只为这个原因而存在，而且只用于分数把它从主会话路由出去的轮次。同样的道理也适用于另一个 Claude 模型（主会话从不被重命名，所以其他成员在自己的进程中运行）和 Codex（另一个 agent CLI，只能作为独立进程运行）。

**如何：** 在 `turn.step` 中有四个 `$.process.run` 调用，每个程序各有一次首次运行和一次恢复运行，每个调用都在调用处以字面文本写明程序名和固定参数：`claude` 和 `codex`。动态值会先经过检查（参见[插件运行的程序](#插件运行的程序)）。网关路由的 `claude` 参数为：

```
claude -p --model <routed model id> --output-format stream-json --verbose --max-turns <child.maxTurns> --add-dir <session cwd> --bare --permission-mode acceptEdits
```

对于 `claude/<member>` 路由，运行同一个程序，使用 `--model <member id>`，并以 `child.subscriptionArgs`（`--permission-mode acceptEdits`）代替 `child.args`，因此不带 `--bare`，其环境为 `MAGGY_ROUTER_CHILD=1` 加上设为空的 `ANTHROPIC_BASE_URL`，这样它在你的 Claude 登录上运行。

对于 `codex` 路由，程序是 `codex`，参数见[作为子进程的 Codex](#作为子进程的-codex)（以及仅在你批准了被拒绝的命令之后，按那里所述的 `exec -C <cwd> resume … <thread> -`），简报通过 stdin 传入，环境为 `MAGGY_ROUTER_CHILD=1`，仅在网关路径上再加上放在 `PALGU_API_KEY` 中的密钥（OpenRouter 上为 `OPENROUTER_API_KEY`，LiteLLM 上为 `LITELLM_API_KEY`），并使用相同的 `child.timeoutMs`。

对于网关子进程和 Claude 成员子进程，仅在你批准了一条转达的命令之后（见下文），同一个程序会再次运行，并追加 `--resume <that child's session id> --allowedTools <the approved patterns>`，从而让同一个子进程继续。`--bare` 让你的 hook、插件和钥匙串都不进入子进程。如果你设置了 `child.args`，它会替换最后三个参数。网关子进程的环境会添加 `ANTHROPIC_BASE_URL`、放在 `ANTHROPIC_API_KEY` 中且 `ANTHROPIC_AUTH_TOKEN` 为空的密钥（Palgu、通用网关），或放在 `ANTHROPIC_AUTH_TOKEN` 中且 `ANTHROPIC_API_KEY` 为空的密钥（OpenRouter、LiteLLM）、`ANTHROPIC_CUSTOM_HEADERS`（见下文）、`CLAUDE_CODE_MAX_RETRIES`（`child.maxRetries`）以及 `MAGGY_ROUTER_CHILD=1`；Claude 成员子进程和 Codex 子进程不带标识请求头。简报被写入它的 stdin。它在会话的工作目录中运行，在该权限模式下使用 Claude Code 的工具，因此它可以读取和编辑那里的文件，并运行该模式允许的命令；这些命令是子进程自己的 agent 决策，受 Claude Code 权限系统的约束，而不是本插件发出的命令。到达 `child.timeoutMs` 时它会被终止。

### 子进程发送的请求头

子进程向 Palgu 或通用网关发出的每个请求都带有两个请求头，这样 Palgu 的控制台可以按项目把其流量显示为 Mixture-of-Models。在 OpenRouter 和 LiteLLM 上，由于它们不读取这些请求头，所以会省略，只发送你自己的 `ANTHROPIC_CUSTOM_HEADERS`：

```
x-srooter-client: mixture-of-models/0.16.0
x-srooter-project: <the session folder's name>
```

项目名是会话工作目录的最后一段，按照网关项目识别的方式转为 slug：`[A-Za-z0-9._-]` 以外的字符变为 `-`，去掉开头和结尾的 `-._`，最多 64 个字符，转为小写（`/Users/me/My App` → `my-app`）。如果没有剩下可用的内容，则省略该请求头。两个请求头都不包含路径、提示词文本或其他任何内容。

它们放在子进程的 `ANTHROPIC_CUSTOM_HEADERS` 中（Claude Code 以换行分隔的 `Name: value` 列表），与 `ANTHROPIC_BASE_URL` 在同一处设置：没有配置网关就没有请求头，并且子进程只与该网关通信。如果你已经设置了 `ANTHROPIC_CUSTOM_HEADERS`，你的行排在前面并被保留；你自己的 `x-srooter-client` 或 `x-srooter-project` 优先于 mod 的。主会话的请求保持不变。

带有路由模型的子进程还会发送 `x-srooter-pin: <model>`，让 Palgu 正好使用该模型，以及 `x-palgu-fallback: auto`，让网关在过载时可以把固定的请求转给同类模型，而不是直接失败。你自己在 `ANTHROPIC_CUSTOM_HEADERS` 中设置的 `x-palgu-fallback` 优先。

### 读取的文件和环境变量

- `~/.claude/model-config.json`，通过 `$.fs.read` 读取，用于路由、阈值、分类器别名和子进程设置。它不包含凭据。缺失或无效时使用默认值。
- `~/.claude/mixture-of-models/strategies/*.md`，通过 `$.fs.list` 和 `$.fs.read` 读取，用于你的路由策略，在会话开始时以及 `/route strategy` 或 `/route strategies` 时读取。
- 环境变量 `HOME`、`HOSTNAME`（用于 Palgu 设备名称）、`MAGGY_ROUTER_CHILD` 和 `ANTHROPIC_CUSTOM_HEADERS`（用于在子进程中保留你自己的自定义请求头），通过 `$.env.get` 读取。
- 没有其他内容。网关密钥从不从文件或环境变量中读取；它只来自插件的 `gateway_key` 选项，由 Claude Code 保存在安全存储中。

### 存储的内容

在插件自己的存储中（`$.store`，位于 `~/.claude/plugins/store/` 下）：一个用于 Palgu 登录的随机安装 id（`palgu-install-id`，让 Palgu 在多次登录中看到同一台设备）、开启了 Palgu 记忆的项目文件夹及每个文件夹上次索引的时间（其文件夹路径）、Palgu 最近提供的模型列表、`/route` 固定、每个模型的每日计数、最近一次判定、按类型的失败计数、最近一次更新检查（时间、GitHub 列出的版本，以及已提示过你的版本），以及最近 200 次决策的日志（日期、模型、类型、层级、分数、分类器来源、子进程耗时和退出码）。不存储提示词文本、回答或凭据。

### 它绝不会做的事

它从不写入设置文件、`model-config.json` 或 `~/.codex`，从不更改主会话的模型、端点或凭据，从不处理工具调用，也从不向上面列出的主机以外的任何地方发送数据：两个分类器目的地、在相应命令中用到的 Palgu 和 GitHub，以及你配置的网关。

## 配置

mod 读取 Maggy 的唯一配置来源 `~/.claude/model-config.json`，并添加一个可选的 `router` 块。它从不写入该文件。

```json
{
  "primary": "glm",
  "router": {
    "provider":   "auto",
    "routes":     { "simple": "glm-5.3", "coding": "glm-5.3", "critical": "claude",
                    "kinds": { "research": "deepseek-pro", "review": "deepseek-pro", "multimodal": "claude" } },
    "thresholds": { "simple": 3, "coding": 7 },
    "ollama":     { "model": "qwen2.5-coder:3b" },
    "classifier": "claude-haiku-5-5",
    "child": {
      "baseUrl":  "https://api.palgu.ai/anthropic",
      "args":     ["--bare", "--permission-mode", "acceptEdits"],
      "subscriptionArgs": ["--permission-mode", "acceptEdits"],
      "deny":     [],
      "maxTurns": 25,
      "timeoutMs": 600000,
      "maxRetries": 2,
      "fallbacks": 3,
      "longContext": [],
      "contextMessages": 12,
      "relayRounds": 2
    },
    "families": {
      "claude": { "members": { "fable": "claude-fable-5-1", "opus": "claude-opus-5-5", "sonnet": "claude-sonnet-5-5", "haiku": "claude-haiku-5-5" },
                  "auto":    { "simple": "haiku", "coding": "sonnet", "critical": "opus" } },
      "kimi":   { "members": { "pro": "kimi-k3.1-pro", "highspeed": "kimi-k3.1-pro-highspeed" },
                  "auto":    { "simple": "highspeed", "coding": "pro", "critical": "pro" } }
    },
    "codex":   { "auth": "palgu", "baseUrl": "", "sandbox": "read-only", "allowOutsideGit": false, "args": [] },
    "ui":      { "band": true, "tags": "routed" },
    "summary": true
  }
}
```

一个把每个层级都交给 Claude 成员的配置，最难的轮次用 Fable，评审用 Codex：

```json
{ "router": {
    "routes":   { "simple": "claude/auto", "coding": "claude/auto", "critical": "claude/auto", "kinds": { "review": "codex" } },
    "families": { "claude": { "auto": { "criticalPlus": "fable" } } } } }
```

- `routes`：层级 → 网关提供的模型 id，以及 `routes.kinds`：非关键层级的类型 → 模型。`"claude"` 表示主会话。
- `primary`（Maggy 所跟随的模型，用 `/model-config` 设置）：`glm`、`kimi` 或 `deepseek` 会让 `coding` 层级跟随它，除非设置了 `routes.coding`。`primary: claude` 不改变任何东西：`critical` 本来就在 Claude 上，而 `coding` 保持便宜，除非你把 `routes.coding` 设为 `"claude"`。
- `thresholds`：影响范围分数的分界线，默认为 `{ "simple": 3, "coding": 7 }`。
- `classifier`：Ollama 无法访问时使用的 Claude 模型。只使用不带日期的别名（`claude-haiku-5-5`、`claude-sonnet-5`、`claude-opus-5`）。
- `provider`：当插件的 `gateway_provider` 选项未设置或为 `auto` 时的网关提供方：`palgu`、`openrouter`、`litellm` 或 `anthropic-compatible`。未设置时，从网关 URL 识别（参见[设置](#设置)）。它决定默认的 `routes`、`families`、状态栏的按钮和子进程的认证方式；你在 `routes` 或 `families` 中设置的任何内容仍然优先。
- `child.baseUrl`：插件的 `gateway_url` 选项未设置时网关 URL 的后备值。密钥没有后备值；它只来自 `gateway_key` 选项。
- `child.auth`：`x-api-key`（`ANTHROPIC_API_KEY`）或 `bearer`（`ANTHROPIC_AUTH_TOKEN`），根据提供方设置；对于需要 bearer token 的通用网关，请自行设置。`child.identify`：发送 `x-srooter-*` 请求头（对 Palgu 和通用网关开启）。
- `child.args`：额外参数。默认是 `--bare`（不继承 hook 或插件，只使用 API 密钥认证，因此子进程永远不会回退到你的订阅）加上 `acceptEdits`，使其无需提示即可编辑文件。mod 总是添加 `--add-dir <cwd>`，这样在 `--bare` 下项目的 `CLAUDE.md` 仍然可以访问。只有当你希望子进程无人值守地运行命令时，才添加 `--dangerously-skip-permissions`；如果希望子进程中有你的 hook 和插件，请去掉 `--bare`。
- `child.maxTurns`、`timeoutMs`：子进程的 agent 预算。`timeoutMs` 上限为十分钟，这是 `$.process.run` 的限制。
- `child.maxRetries`：网关子进程对因 429 或 5xx 失败的请求重试多少次（默认 2；Claude Code 自己的默认值是 10，面对繁忙的提供方要花好几分钟）。如果你的网关有短暂的抖动，而你宁愿等过去也不想回退，可以调高它。
- `child.fallbacks`：网关子进程失败后、主模型接手之前，mod 自己尝试多少个同类模型（默认 3；0 表示关闭）。在 Palgu 上先试同一类别，再试其他健康的模型。见上文“子进程失败时”。
- `child.longContext`：提示对路由模型过长时转去的网关模型。默认为空：使用 Palgu 实时列表中上下文窗口比失败模型更大的健康模型，从最大的开始。不使用 Palgu 时请自行设置，否则过长的提示会交给主模型。
- `child.contextMessages`：简报中包含多少轮最近的交流。
- `child.relayRounds`：一个被路由的轮次最多可以暂停多少次，就子进程被拒绝的命令询问你（默认 2）。
- `child.deny`：适用于每个 Claude 子进程的额外 Claude Code 权限拒绝规则，在 `child.args` 之后通过 `--disallowedTools` 传入。它们叠加在内置列表（`.env`、`.env.*`、`*.pem`、`*.key`、`id_rsa*`、`id_ed25519*`、`secrets/**`）之上，内置列表无法被移除，因为 `--bare` 会跳过原本保护这些文件的 hook。
- `child.subscriptionArgs`：`claude/<member>` 子进程的参数，代替 `child.args`。默认不带 `--bare`，因为 `--bare` 只允许 API 密钥认证，而这里的目的正是使用你的 Claude 登录。
- `families`：每个家族的 `members`（别名 → 确切的模型 id）和 `auto`（层级 → 成员别名，外加可选的 `criticalPlus`，用于 10/10 的关键轮次）。按家族合并到默认值之上；新的家族名称会添加一个网关家族。
- `codex.auth`：`palgu`（默认；使用你配置的网关的 `/v1/responses` 和你的网关密钥，无论是哪个提供方）或 `chatgpt`（你自己的 Codex 登录）。`codex.baseUrl`：如果 Responses 的 base URL 不是推导出的那个，在此设置（Palgu：`/anthropic` → `/v1`；OpenRouter 和 LiteLLM：`<gateway_url>/v1`）。`codex.sandbox`：`read-only`（默认）、`workspace-write` 或 `danger-full-access`，参见[沙箱与审批](#沙箱与审批)。`codex.allowOutsideGit`：添加 `--skip-git-repo-check`（默认 `false`）。`codex.args`：额外参数；其中的沙箱和审批参数会被忽略。
- `strategy`：初始使用的路由策略，可以是内置策略（`complexity`、`cost`、`speed`、`quality`），也可以是你某个文件的名称；用 `/route strategy` 选择的策略优先。参见[路由策略](#路由策略按复杂度成本速度质量或你自己的规则路由)。
- `prices`：网关模型每百万 token 的美元价格，用于[节省估算](#能节省多少)，例如 `{ "glm-5.3": { "input": 0.6, "output": 2.2 } }`（可选 `cacheRead`，默认为输入价格的十分之一，以及 `cacheWrite`）。这里的条目优先于 Palgu 自己的报价。在非 Palgu 网关上没有价格的模型会被计为未计价。
- `heartbeat`：当主会话停在任务中途时继续它。`palgu`（默认：当 Palgu 是你的网关时由 Palgu 判断；否则或 Palgu 没有响应时，同样的分类器在本地运行）、`local`（从不询问 Palgu）或 `off`。`heartbeatMax`：每条你的提示词最多继续几次（默认 3）。
- `ui.band`：在提示词上方绘制状态栏（默认 `true`）。`ui.tags`：哪些回复带有来源标记，`routed`（默认）、`all` 或 `off`。

## 命令

| 命令 | 效果 |
| :- | :- |
| `/palgu login` | 在终端中注册或登录 Palgu：在浏览器中批准一个代码，mod 就会保存它的 Palgu 密钥并立即开始路由 |
| `/palgu status` | 密钥属于谁以及组织的套餐 |
| `/palgu upgrade` | Palgu 套餐和计费页面 |
| `/palgu memory on`、`off`、`memory` | 用 `palgu` CLI 在后台把此项目索引到 Palgu 记忆中（会上传源代码；默认关闭），并把它召回到每条提示词中，供 Claude 和每个被路由的模型使用；停止；或显示它是否已被索引以及索引有多新 |
| `/route update` | 在 GitHub 上检查是否有更新的版本，如果有，替你运行 `claude plugin marketplace update` 和 `claude plugin update`；然后 `/reload-plugins` 会加载新版本 |
| `/route models` | Palgu 当前提供的模型以及哪些不可用；其中任何一个都可以用 `/route <model>` 固定。状态栏为 mod 知道的每个家族保留一个按钮。没有 Palgu（或它没有响应）时使用内置列表 |
| `/route strategies`、`/route strategy <name>` | 列出路由策略（complexity、cost、speed、quality 以及你的策略），或切换到其中一个 |
| `/route help`（或状态栏上的 `0`） | mod 做什么、当前状态、每个按钮和命令，以及如何连接提供方 |
| `/route`、`/route status` | 已启用或仅观察、模式、当前决策（含家族和成员）、今天的计数、各家族及其成员 |
| `/route auto` | 对每条提示词分类（默认） |
| `/route off` | 从不启动子进程 |
| `/route simple\|coding\|critical` | 固定一个层级 |
| `/route reset` | 清除按类型的失败记忆 |
| `/route stats` | 打开统计面板：models、kinds、scores、recent |
| `/route glm`、`/route kimi`、`/route kimi-k3.1-pro`、`/route minimax`、`/route gpt`、`/route claude` | 固定一个模型（前缀会先展开为已配置的模型，再展开为已知的网关模型；不匹配任何模型的词（如 `/route upgrade`）不会被固定，而是设为 auto） |
| `/route claude/sonnet`、`/route kimi/highspeed`、`/route codex/gpt-5.6-terra` | 固定一个家族成员（`claude/sonnet` 在你的 Claude 登录上运行） |
| `/route claude/auto`、`/route kimi/auto`、`/route codex/auto` | 固定一个家族；每条提示词仍会被打分，由层级挑选成员 |
| `/route codex` | 固定使用默认模型的 Codex |

`/status` 是 Claude Code 自己的命令，mod 无法向其中添加内容；`/route status` 是 mod 的对应命令，而每个回答下方的路由行会写明家族和成员（`route: claude-sonnet-5-5 (claude/auto → sonnet) · coding 5/10 code via ollama · child 9s`）。

固定设置保存在插件的存储中，跨会话保留。

## 子进程能做和不能做什么

- 它拥有 Claude Code 的工具，并在会话的工作目录中运行，因此它可以读取、编辑和运行东西。它的工具调用不会显示在主对话记录中，只显示它的最终文本。
- 当它需要一条其权限模式不允许的命令（`git pull`、`npm install`、部署）时，它无法自己询问你。mod 会转达这个请求：你会看到 Claude Code 的提问对话框，写明确切的命令，"Allow and continue" 会恢复同一个子进程，并且只允许那条命令。`git status` 或 `git log` 这样的只读命令本来就无需询问即可运行。
- 它不共享主会话的记忆。简报包含最近 `contextMessages` 轮交流（默认 12 轮，每轮截断为 1,200 个字符）和任务本身。这就是追问从不会交给子进程的原因：参见[它如何决策](#它如何决策)。
- 它默认以 `--bare` 运行，所以你的 hook 和插件都不在其中，包括任何保护密钥的 hook。它无法读取 `.env` 文件、密钥或 `secrets/` 文件夹：mod 会为它们传入权限拒绝规则（`child.deny` 可以添加更多），这些规则由 Claude Code 本身强制执行，而不是由 hook 执行。mod 还会检测 `MAGGY_ROUTER_CHILD` 标记，在子进程内部什么也不做。
- 标记和路由行写的是 mod **请求的**模型。按意图路由的网关（如 palgu）可能会用另一个模型作答；Claude Code 的 `-p` 输出不会透露是哪个，所以 mod 无法显示。
- 输出在子进程结束时才到达；此版本使用 `$.process.run`，因此被路由的回答不会逐 token 流式输出。

## 更新日志

每个版本在 [CHANGELOG.md](../../../CHANGELOG.md) 中都有一个带日期的章节，与改动在同一个提交中写入。如果 `plugin.json` 中的版本没有对应条目，CI 会失败（`npm run changelog`）。

## 测试

```bash
npm test                           # 在 Node 下运行纯函数测试，不需要 Claude Code
claude plugin validate --strict .  # 清单 + hook 模块的静态分析
claude plugin test                 # 需要 v2.1.287+；在没有会话和网络的情况下把事件发送给 hook
```

`tests/classify`、`config`、`providers`、`routing`、`families`、`codex`、`stats`、`child` 和 `ui` 覆盖 `hooks/lib/` 中的纯逻辑。`tests/mod.test.ts` 端到端地驱动 hook：简单的提示词由一个环境中带有网关、stdin 中带有简报的子进程回答，关键的提示词从不启动子进程，失败的子进程回退到主模型，缺少密钥意味着仅观察模式，子进程会话会禁用 mod，`/route off` 和 `/route kimi` 行为正确。`tests/compliance.test.ts` 检查传到 `$.process.run` 的内容：字面的程序和参数、被拒绝的模型 id、两个固定的更新命令，以及不是普通 token 的 Palgu 密钥。

## 目录结构

```
mixture-of-models-claude-mod/
├── .claude-plugin/
│   ├── plugin.json         # 插件清单
│   └── marketplace.json    # 让 `claude plugin install` 在本仓库中找到它
├── docs/adr/               # 架构决策（0001：子进程委派，0002：模型家族和 Codex，0003：网关提供方）
├── scripts/test-pure.mjs   # 在 Node 下运行纯测试
├── hooks/
│   ├── hooks.json          # 指向 register.js
│   ├── register.js         # 11 个 hook 注册；唯一接触 mods API（$）的文件
│   └── lib/                # 纯函数，有单元测试
│       ├── config.js       # 默认值和 model-config.json 覆盖层
│       ├── providers.js    # Palgu、OpenRouter、LiteLLM、通用网关：识别、子进程认证、模型目录
│       ├── classify.js     # Maggy 的预路由规则、分类器提示词、Ollama 通信格式
│       ├── routing.js      # 层级 → 模型、/route 语法、摘要行
│       ├── families.js     # <family>/<member>、<family>/auto、由哪个运行器处理某个路由
│       ├── codex.js        # codex exec 的 argv、环境、就绪检查、JSONL 输出
│       ├── child.js        # 子进程 argv、限定范围的环境和标识请求头、就绪检查、env 文件解析、简报及其前言
│       ├── version.js      # mod 的版本，用于 x-srooter-client
│       ├── vet.js          # 丢弃交还、要求你操作的请求、未经验证的声明、叙述和重复
│       └── stats.js        # 每日计数
└── tests/
```

Mod 要求每个 `$` 调用都位于 `register.js` 中（把 `$` 传给其他文件会导致 `claude plugin validate` 失败），这就是该文件包含的函数数量超过通常限制的原因。

## 为什么使用子进程

参见 [ADR 0001](../../adr/0001-child-process-delegation.md)。简而言之：mod 可以重命名请求的模型，但无法改变请求的去向，而通过代理转发订阅 token 的方案已被否决。拥有独立环境的子进程是干净的拆分方式。

## 与 Maggy 的对应关系

| Maggy | 本项目 |
| :- | :- |
| `hooks/route-task-hook`（UserPromptSubmit、qwen3 分类器、延续保护、缓存） | `prompt.submit` + `lib/classify.js`，通过 `$.http.fetch` 访问 Ollama，`$.store` 缓存 |
| 注入到上下文中的 "You MUST delegate — run ~/bin/glm" | `turn.step` 运行子进程并返回其回答；从不要求 Claude 去委派 |
| 由 `model_routing.py write-launcher` 生成的 `~/bin/claude-<provider>` 启动器 | mod 自己把 `ANTHROPIC_BASE_URL` 和密钥限定在子进程的环境中 |
| `hooks/usage-summary-hook`（Stop） | `turn.complete` 返回摘要行 |
| `/model-config` 所跟随的模型 | `model-config.json` 中的 `primary` 驱动 `coding` 层级 |
| `palgu` 网关 | 子进程的端点；主会话从不接触它 |

仅针对 `claude plugin validate` 在 Claude Code 2.1.274 上测试过；所用类型来自 2.1.277 的声明。在较新的版本上首次加载后，请检查 `.claude-plugin/types/`，尤其是 `$.process.spawn` 是否可用于流式输出子进程的结果。
