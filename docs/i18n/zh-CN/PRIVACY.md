# 隐私政策

[English](../../../PRIVACY.md) · **简体中文** · [日本語](../ja/PRIVACY.md) · [Deutsch](../de/PRIVACY.md) · [Français](../fr/PRIVACY.md) · [العربية](../ar/PRIVACY.md)

*本文为译文；以英文版为准，英文版可能更新。*

mixture-of-models 是一个完全在你本机运行的 Claude Code 插件。作者不运营任何服务器，没有账号，也没有遥测。

## 插件发送什么，发给谁

- **发往 Palgu（`https://api.palgu.ai`）**，仅在你运行 `/palgu` 时：执行 `/palgu login` 时，发送客户端名称 `mixture-of-models`、设备名称（`Claude Code on <your HOSTNAME>`）、插件版本和一个随机安装 id，随后发送 Palgu 下发的登录代码；执行 `/palgu status` 时，发送你的网关密钥，以向 Palgu 查询该密钥属于谁，且仅当你配置的网关是 Palgu 时才发送。Palgu 返回的密钥由 Claude Code 通过 `claude plugin configure --values-stdin` 保存在其安全存储中，绝不会出现在命令行上。
- **发往 Palgu（`https://api.palgu.ai/v1/pricing/quote`）**，在一个被路由的轮次之后，且仅当你配置的网关是 Palgu 时：模型 id 和该轮次的四项 token 计数，连同你的网关密钥，以便 Palgu 为节省估算给该轮次定价。不含任何提示词或回答文本。
- **发往 GitHub（`raw.githubusercontent.com`）**，在会话启动时（最多每 12 小时一次）以及你运行 `/route update` 时：对插件已发布清单的一次普通 GET 请求，用于读取最新版本。不会发送任何关于你或你的工作的信息。
- **发往本地 Ollama（`http://localhost:11434`）**，如果有在运行：你提交的每条提示词的文本，连同评分规则，以便为提示词打出 1-10 分。此过程没有任何数据离开你的机器。 当 mod 为内置子代理选择模型时，其任务的前 2,000 个字符也同样发送（发往 Ollama，若其无响应，则如下文所述发往 Anthropic）。
- **发往 Anthropic，通过 Claude Code 自己的 API 客户端和你自己的账号**，当没有 Ollama 响应时：同样的提示词文本和评分规则，用于同样的评分。这与 Claude Code 为你的会话所使用的通道相同。
- **发往你配置的网关**（`gateway_url`：例如 Palgu 的 `https://api.palgu.ai/anthropic`、OpenRouter 的 `https://openrouter.ai/api`，或你自己运行的 LiteLLM 代理），通过一个使用你提供的 `gateway_key` 认证的 Claude Code 子进程（对 Palgu 和通用网关作为 `x-api-key`，对 OpenRouter 和 LiteLLM 作为 `Authorization: Bearer` token）：仅针对被路由的轮次，发送你的提示词以及会话最近几轮交流的简短摘要（仅文本，已截断），以及该子进程自身的 agent 循环在工作时发送的内容。网关如何处理这些数据由网关运营方的政策决定，而非本插件。子进程的每个请求还带有两个向网关标识自身的请求头：`x-srooter-client: mixture-of-models/<version>`（插件名称和版本）和 `x-srooter-project: <folder name>`（会话工作目录的最后一段，转为小写并只保留 `a-z 0-9 . _ -`）。它们不包含路径、提示词文本或其他任何内容，只发送给已配置的网关，且仅当该网关是 Palgu 或通用的 Anthropic 兼容网关时才发送：OpenRouter 和 LiteLLM 不会收到。如果未配置网关，则不发送任何内容，插件处于仅观察模式。 带有路由模型的子进程还会发送 `x-srooter-pin: <model>`（要使用的模型）和 `x-palgu-fallback: auto`（允许网关在该模型过载时改用同类模型）；它们同样不含任何内容。

- **发往 Anthropic，使用你自己的 Claude 登录**，仅针对指定了 Claude 家族成员的路由（`claude/sonnet`、`claude/auto`、…）：一个 Claude Code 子进程通过你主会话所用的同一账号，发送同样的简报，以及其 agent 循环在工作时发送的内容。
- **发往 Codex 的端点**，仅针对 `codex` 路由：一个 `codex exec` 子进程读取同样的简报（你的提示词加上截断后的最近交流），可以在无网络的只读沙箱中读取会话工作目录（一个 git 仓库，除非你设置了 `codex.allowOutsideGit`）中的文件；只有当你批准了该轮次中它被拒绝的命令，或你自己将 `codex.sandbox` 设为 `workspace-write` 时，它才能编辑那里的文件。它会把其 agent 循环所需的内容发送到你网关的 `/v1/responses` 端点（使用 `codex.auth: "palgu"`，即默认值，使用你的 `gateway_key`，且只通过其环境变量传入；在 OpenRouter 上为 `https://openrouter.ai/api/v1/responses`，在 LiteLLM 上为你代理的 `/v1/responses`），或发送到 OpenAI（使用 `codex.auth: "chatgpt"`，用你自己的 Codex 登录，受 OpenAI 政策约束）。Codex 可能会在 `~/.codex` 下保存自己的会话文件，就像你自己运行它时一样；本插件从不读取或写入该文件夹。

本插件不向任何其他方发送任何内容，也不向作者发送任何内容。

## 插件存储什么

在你本机 Claude Code 的插件存储中：一个用于 Palgu 登录的随机安装 id、你的 `/route` 设置、累计节省总额（按 token 计价的美元金额和轮次数）、每天由哪个模型回答的计数、最近一次判定、按类型统计的失败次数，以及最近 200 次路由决策的日志（日期、模型、类型、层级、分数、由哪个分类器作答、子进程耗时和退出码）。插件不存储任何提示词文本、回答或凭据。你的网关密钥由 Claude Code 作为敏感插件选项保存在其安全存储中。 它还按天统计你的子代理所用的模型。

## 插件读取什么

`~/.claude/model-config.json`（路由设置，不含凭据），以及环境变量 `HOME`、`HOSTNAME`（用于 Palgu 设备名称）、`MAGGY_ROUTER_CHILD` 和 `ANTHROPIC_CUSTOM_HEADERS`（仅用于在子进程发往网关的请求中保留你自己设置的自定义请求头）。 执行 `/palgu continue` 时，它读取会话的 id 和文件夹，用于复制一条 `palgu --continue-claude=<id>` 命令（使用 `--open` 时，通过 `osascript` 在 macOS 终端标签页中启动它）；它本身不发送任何内容。之后 Palgu 按其自身政策读取该会话的对话记录。

## 儿童

本插件不面向 18 岁以下人士使用。

## 联系方式

请在 https://github.com/alinaqi/mixture-of-models-claude-mod/issues 提交 issue。
