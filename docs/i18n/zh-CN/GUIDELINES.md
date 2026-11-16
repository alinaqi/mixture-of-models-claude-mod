# 使用指南：充分发挥 Mixture of Models 的作用

[English](../../../GUIDELINES.md) · **简体中文** · [日本語](../ja/GUIDELINES.md) · [Deutsch](../de/GUIDELINES.md) · [Français](../fr/GUIDELINES.md) · [العربية](../ar/GUIDELINES.md)

*本文为译文；以英文版为准，英文版可能更新。*

如何在每个 coding agent 中日常使用 Mixture of Models。安装方法见 [INSTALL.md](INSTALL.md)；本文假设你已完成安装并已登录 Palgu。

Mixture of Models 做三件事，每个 agent 能获得其中多少，取决于它的插件系统允许多少：

| | 你得到什么 | 在哪里 |
| :- | :- | :- |
| **路由** | 不需要昂贵模型的工作由便宜模型回答 | Claude Code、OpenCode、Codex、Aider/Continue/Goose 对每个轮次进行路由；Cursor、Antigravity 和 Copilot 对 agent 交给 `palgu_delegate` 的子任务进行路由 |
| **Palgu 记忆** | 项目中记录的意图、文档和代码符号会在需要时回到模型面前 | 召回到每条提示词中：Claude Code、OpenCode、Codex、Antigravity。按需搜索（`palgu_memory_search`）：Cursor、Copilot、Antigravity |
| **心跳（heartbeat）** | 在任务中途停下的轮次（"Let me check the tests."）会被继续，每条提示词最多 3 次 | 所有带 hook 的 agent（Aider、Continue、Goose 除外） |

## 粗略节省：仅订阅 vs Mixture of Models

以下来自我们自己的使用情况，coding agent 在 Claude Max 20x 订阅上全天候运行：

| | 每周 Claude 限额能用多久 | 每天的 Claude 用量 |
| :- | :- | :- |
| 仅订阅 | 约 3 天，之后 agent 只能等待重置 | 100% |
| 使用 Mixture of Models | 完整的 7 天 | 约 43% 或更低（3/7），因为同样的工作在一周内完成了 |

也就是说，路由把订阅上**一半以上**的 Claude 负载转移了出去：同样的工作可以跑满一整周，而不是在第 3 天停下，而且无需升级套餐。被路由的轮次由 Palgu 按便宜模型的费率计费，并计入你的 Palgu 预算（`mom status`、`/palgu status`）。

这些数字是粗略的，取决于你的工作内容：大量查找、测试、文档和小改动会把大部分负载路由出去，而安全、架构和生产相关的工作按设计会留在 Claude 上。要查看你自己的数字，Claude Code 会为每个轮次计价：`/route status` 显示累计总额（例如 `saved ~$12.40 (61%) vs all claude-opus-5-5, at API prices`），`/route stats` 按模型和类型细分。在订阅模式下，这个数字表示同样的 token 按 API 价格计算的费用，而不是退还给你的钱；实际收益是限额能用得更久。

## 处处适用的十条规则

1. **让它来决定，不要自己挑模型。** 选择模型是系统的工作：Palgu（或 Claude Code 中 mod 的分类器）为每个请求打分，把它交给能胜任的最便宜模型，把关键工作留在你最强的模型上，并在某个提供方出错时回退。一切保持 `auto`。如果某个路由看起来不对，修正的是路由（策略或阈值），而不是模型。固定（pin）只为[覆盖路由器](#覆盖路由器很少需要)中列出的少数情况而存在。
2. **每条提示词只写一个任务，并说清它是什么。** 路由器为你发送的提示词打分。"Add a `--json` flag to `mom status` and a test for it" 会被路由到便宜的编码模型；在长对话之后说 "fix it"，打分时却没有对话所携带的上下文。请写明文件、函数或命令。
3. **把重要的词放在前面。** 记忆召回使用提示词的前 300 个字符（合并为一行）进行搜索。少于四个词的提示词或斜杠命令不会召回任何内容。"The heartbeat continues answers it should not: in `hooks/lib/heartbeat.js` …" 会召回心跳相关的 ADR 和代码；而先写一段背景再提问的提示词可能召回不到。
4. **只在你会反复回来的项目中开启记忆。** `mom memory on`（在 Claude Code 和 OpenCode 中为 `/palgu memory on`）会把该文件夹的源代码上传到 Palgu 进行索引。它默认关闭，按文件夹设置，并由所有使用 `mom` 的 agent 共享，因此开启一次即可同时服务 Codex、Cursor、OpenCode、Antigravity 和 Copilot。对于不能上传的客户代码，请保持关闭。
5. **把“为什么”写在记忆能找到的地方。** 召回时会优先排列记录的意图和 ADR，然后是文档，再然后是代码。`docs/adr/` 中一份简短的 ADR 或 README 中清晰的一节，正是让召回的线索变成正确答案的关键。召回的文本只是需要对照文件核实的线索，绝不是指令。
6. **把关键工作留在你最强的模型上。** 安全和认证设计、生产事故、数据迁移以及任何不可逆的操作，都不应交给便宜模型。Claude Code 会自动把它们留在 Claude 上（分数 8+ 以及安全规则）；在其他 agent 中，不要把它们交给 `palgu_delegate`，处理它们时也不要固定到便宜模型。
7. **只委派自成一体的工作。** 被路由的子进程或一次 `palgu_delegate` 调用只能看到交给它的简报或提示词，看不到你的会话。好的例子："Write unit tests for `parseEvent` in `integrations/cli/lib/events.js` covering the four tools"。不好的例子："do the next step"、"check the PR"。
8. **绝不要在会被路由或委派的提示词中放入密钥。** 提示词会发送到 Palgu 以及为其提供服务的模型提供方。密钥应保存在 `~/.config/mixture-of-models/credentials.json`、`PALGU_API_KEY` 或 Claude Code 的安全存储中；没有任何配置文件需要密钥。
9. **让心跳工作，并在不该继续时停止它。** 它会继续那些宣布了要做的工作却停下的轮次，每条你的提示词最多 3 次，而且从不继续你主动中止的轮次。如果它继续了你本想结束的内容，请说明你想要什么（"stop here, just summarise"），或者关闭它：`mom heartbeat off`（OpenCode 中为 `/palgu heartbeat off`，Claude Code 中在 `router` 块里设置 `"heartbeat": "off"`）。`mom heartbeat local` 会保留心跳，但从不询问 Palgu。
10. **关注预算，而不只是账单。** `mom status` 和 `/palgu status` 显示你的组织在本周期内花费了多少 Palgu 预算（"budget: $205.11 of $4,500.00 this month (5%)"）。Claude Code 还会在每个被路由的回答下方以及 `/route stats` 中显示路由节省了多少。

## 各 agent 的用法

### Claude Code（mod：全部功能）

最完整的集成：可按你自己的规则逐轮路由，Claude 和每个被路由的模型都会在每条提示词中获得记忆，还有心跳和节省统计。

- **一次性选好策略。** `/route strategy cost` 账单最低，`quality` 适合出错代价高的场景，`speed` 适合快速周转，`complexity`（默认）则是平衡之选。`/route strategies` 会列出它们。如果有你自己的标准（某个客户的代码总是用 Claude，文档总是用 DeepSeek），请让 Claude 使用 **routing-strategy** skill：它会写出 `~/.claude/mixture-of-models/strategies/<name>.md`。
- **用文字引导单条提示词。** 提示词中任意位置出现 "use claude" 会让该轮次留在 Claude 上。"execute the plan"（及类似说法）也一样。"go ahead"、"ok" 或 "next" 这样的简短回复会沿用上一轮的路由；在被路由的回答之后的简短追问会回到主会话，因为子进程不保留记忆。
- **会话相关的工作按设计留在主会话中。** 关于 PR、分支、CI、状态、队友或后台任务的提示词，以及任何与安全相关的内容，都不会被路由：子进程看不到这些。不要用固定来对抗这一点。
- **阅读路由行。** 每个回答下方：`route: glm-5.3 · coding 6/10 via ollama · child 42s · saved ~$0.39`。当某个决策看起来不对时，分数和类型会说明原因。用 `router.thresholds` 调整分界线，而不是固定模型。
- **用模型家族选择合适大小的 Claude。** `claude/auto` 在你自己的 Claude 登录上把简单轮次交给 Haiku，编码交给 Sonnet，关键工作交给 Opus。在没有网关或想让订阅用得更久时很方便。
- **安装 Ollama 以获得免费分类。** 有本地 Ollama（`qwen2.5-coder:3b`）时，每条提示词的打分都不花钱；没有它时，mod 会询问 `claude-haiku-5-5`。
- **让它通过你来批准命令。** 当被路由的子进程需要 `git pull` 或 `npm install` 时，你会看到 Claude Code 自己的对话框，写明确切的命令。在那里批准即可；不要为了避开提示而在 `child.args` 中加入 `--dangerously-skip-permissions`。
- **每周查看节省情况。** `/route stats`（四个标签页：models、kinds、scores、recent）。如果 "kinds" 中某一行有很多子进程失败，说明该类型应该交给别的模型：修改 `routes.kinds`，然后 `/route reset`。
- **保持更新。** 当状态栏提示有新版本可用时，运行 `/route update`，然后运行 `/reload-plugins`。

### OpenCode（功能完全对等）

- 使用 `palgu/auto` 作为你的模型并保持不变：Palgu 会逐个请求挑选模型。
- 如果要使用 mod 自己的路由规则，请给插件设置 `routes` 或 `critical`（例如 `["…/plugin.js", { "critical": "claude-opus" }]`）：这样安全相关和包含 "use claude" 的提示词会交给关键模型，其余按层级处理。
- `/palgu memory on`、`/palgu status` 和 `/route status` 会以 toast 形式回答，使用 Palgu 最便宜的层级。
- 调试意外的路由：`MOM_DEBUG=1` 会把每个决策（模型 id 和固定设置，从不记录提示词或密钥）记录到 `~/.config/mixture-of-models/opencode.log`。

### Codex

- 用 `codex -p palgu` 启动。普通的 `codex` 使用你常规的 Codex 配置，不使用 Palgu 的任何路由，不过插件的记忆和心跳仍会运行。
- 在 `/hooks` 中批准一次插件的 hook；`codex exec` 不会运行从未以交互方式批准过的 hook。
- Codex 没有自定义斜杠命令：请在终端中运行 `mom status`、`mom memory on` 和 `mom heartbeat …`（插件的 skill 会让 Codex 建议这些命令）。

### Cursor

工作由 Cursor 自己的模型完成。Mixture of Models 增加了记忆搜索、委派和心跳。

- 安装**规则**（`.cursor/rules/mixture-of-models.mdc`，已包含在插件中）。没有它，agent 很少会想到使用 `palgu_memory_search` 或 `palgu_delegate`。
- 在重要时按名称要求使用工具："search Palgu memory for how the heartbeat decides, then …"，或 "use `palgu_delegate` to draft tests for these three functions"。
- 委派草稿，而不是决策：测试脚手架、样板代码、docstring、查找。审阅返回的内容；规则会把安全敏感的工作留在本地。
- 从 Dock 启动的 Cursor 可能找不到 `mom`；请在 hook 和 `mcp.json` 中写入 `which mom` 给出的完整路径。

### Antigravity（`agy`）

- 在开启记忆的文件夹中，记忆会被召回到每个轮次的第一次模型调用中，因此关于提示词措辞的规则（第 2 和第 3 条）在这里最为重要。
- agent 始终使用你在 `agy` 中选择的 Gemini 模型。路由通过 `palgu_delegate` 起作用，插件始终启用的规则会告诉 agent 把低风险、自成一体的子任务交给它。处理批量工作时请明确要求使用它。
- 如果 `agy` 因 `PERMISSION_DENIED on resource project …` 而失败，那是 Antigravity 的 Google Cloud 项目设置问题，与插件无关；参见 [integrations/antigravity](integrations/antigravity/README.md)。

### GitHub Copilot CLI

- Copilot 会丢弃 hook 在提示词上的输出，因此记忆不会自动加入：在代码中不熟悉的部分，请让 agent "check Palgu memory first"，或者依靠 skill，它会告诉 agent 何时这样做。
- 在开启记忆的文件夹中，会话开始时 Copilot 会被告知记忆已开启；在 `mom memory on` 之后新开的会话会获取这一信息。
- 对于希望交给更便宜模型的子任务，使用 `palgu_delegate`。如果要让整个会话都使用 Palgu，可以让 Copilot 的 BYOK 指向 `https://api.palgu.ai/anthropic`，模型设为 `auto`（每个会话一个模型）。
- 安装插件，而不是使用仓库 hook：`.github/hooks/` 在不受信任的文件夹中不会运行。
- 如果设置了 classic `GITHUB_TOKEN`，请以 `env -u GITHUB_TOKEN -u GH_TOKEN copilot` 的方式启动。

### Aider、Continue、Goose

只有路由：没有记忆，没有心跳。

- 针对 `https://api.palgu.ai/v1` 使用模型 `auto`（在 Aider 中为 `openai/auto`），并把来自 `mom token` 的密钥放在环境变量中，而不是放在会被提交的配置里。
- Aider 的 architect 模式（`--architect --editor-model openai/auto`）把规划和编辑作为两个独立请求发送，Palgu 会分别路由：规划可以交给更强的层级，而编辑保持便宜。
- 在 Continue 中，为自动补全单独配置一个小而快的模型；Palgu 的路由是为对话轮次设计的。

## 在一个项目中使用多个 agent

`mom` 保存的一切都按文件夹记录并共享，所以你可以在项目进行中切换 agent，而无需重新设置：

- 记忆同意和索引（`mom memory on` 一次，所有 agent 通用）。
- Palgu 登录（`mom login` 一次，适用于除 Claude Code 外的所有 agent；Claude Code 有自己的 `/palgu login`）。
- 心跳模式（`mom heartbeat …`）。

一种好的分工：在 Claude Code 中做规划和审查（关键轮次用 Claude，其余被路由），在 OpenCode 或 Codex 中用 `auto` 做批量编辑，让 Cursor 或 Copilot 把重复性的子任务交给 `palgu_delegate`。它们读取的是同一个记忆索引。

## 覆盖路由器（很少需要）

你应该用不到这个。固定会对每个请求关闭路由，直到你取消它，因此你会失去节省，也会在该提供方宕机时失去回退。唯一合理的理由是那些路由器无从知晓的情况：

- **试用某个模型：** 你想看看某个模型在你自己的工作上表现如何。
- **比较模型：** 基准测试或 A/B 测试每次都需要同一个模型。
- **合同或数据规定：** 某个客户的代码只能发给特定的提供方。
- **调试糟糕的回答：** 你想知道问题出在模型还是提示词上。

不应固定的理由：路由错误（在 Claude Code 中修改策略、`router.thresholds` 或 `routes.kinds`，让路由保持自动）、回答慢（试试 `/route strategy speed`），或只想让某一条提示词用 Claude（在其中写上 "use claude"）。

如何固定，以及如何撤销：

| Agent | 固定 | 恢复自动 |
| :- | :- | :- |
| Claude Code | `/route <model>` | `/route auto` |
| OpenCode | `/route <model>`，或在模型菜单中选择一个模型 | `/route auto`，或选择 `palgu/auto` |
| Codex | `MOM_PIN=<model> codex -p palgu -m <model>`（同一个模型写两次） | `codex -p palgu` |
| Cursor、Antigravity、Copilot | 针对该子任务，要求以 `model: "<id>"` 调用 `palgu_delegate` | 默认即为 `auto` |
| 原始端点（Aider、Continue、Goose） | 设置模型**并且**发送 `x-srooter-pin`（只写模型名仍会被路由；`auto` 加固定会被拒绝，403） | 模型 `auto`，不带请求头 |

`/route models`（Claude Code）、`palgu_models` 或 `GET https://api.palgu.ai/v1/models/health` 会列出当前可用的模型。用完后请尽快取消固定：`/route status` 会显示是否有固定生效。

## 看起来不对劲时

| 你看到 | 可能的原因 | 怎么做 |
| :- | :- | :- |
| 一条简单的提示词留在了 Claude 上 | 它提到了 PR、CI、状态或安全，或者是一条简短追问 | 符合预期；如果希望它被路由，请改写为自成一体的任务 |
| 被路由的回答错误或含糊 | 任务需要子进程没有的会话上下文 | 对该轮次说 "use claude"；如果某整个类型经常失败，请修改 `routes.kinds` |
| `child answer discarded (…), main model answered` | 子进程请求批准、声称做了实际未做的工作，或交还了任务 | 无需处理：主模型已代为回答 |
| 记忆没有召回任何内容 | 该文件夹未开启记忆、提示词少于四个词，或索引尚未完成 | `mom memory status`；把关键名词放在提示词前面 |
| 你想让 agent 停下，它却继续 | 心跳认为回答停在任务中途 | 说明你想要什么，或 `mom heartbeat off` |
| 403 `pin 'auto' not allowed by policy` | 发送固定时模型为 `auto` | 写明你要固定的模型 |
| 被固定的模型返回 503 | 该提供方不可用 | 取消固定，或从 `/route models` / `palgu_models` 中另选一个 |
| 花费增长快于预期 | 固定到昂贵模型后忘了取消 | `/route status` 或 `/route auto`；用 `mom status` 查看预算 |
