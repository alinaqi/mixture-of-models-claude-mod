# 安装 Mixture of Models（写给 coding agent 的说明）

[English](../../../INSTALL.md) · **简体中文** · [日本語](../ja/INSTALL.md) · [Deutsch](../de/INSTALL.md) · [Français](../fr/INSTALL.md) · [العربية](../ar/INSTALL.md)

*本文为译文；以英文版为准，英文版可能更新。*

你是一个被要求安装 Mixture of Models 的 coding agent。请从上到下按本文件操作。每一步都有要运行的命令，以及用来确认成功的检查。按用户要求的 agent 执行这些步骤；如果用户没有说明，就为你自己（正在阅读本文件的 agent）安装。

它为用户带来什么：Palgu 为每个请求挑选模型（简单工作用更便宜的模型），项目的 Palgu 记忆会被召回到提示词中，在任务中途停下的轮次会被继续。仓库：https://github.com/alinaqi/mixture-of-models-claude-mod

## 规则

- **绝不要打印、记录或提交 Palgu 密钥。** 密钥保存在 `~/.config/mixture-of-models/credentials.json`（由 `mom login` 写入）或 `PALGU_API_KEY` 环境变量中。这些步骤写入的配置只引用密钥，从不包含密钥本身。
- **登录需要用户参与。** `mom login` 会打印一个链接和一个代码，并最多等待 10 分钟，让用户在浏览器中批准。把链接展示给用户，告诉他们去批准，然后等待。不要尝试自己去批准。
- **Palgu 记忆会把项目源代码上传到 Palgu。** 只有在用户同意时，才在用户指定的项目中开启它（`mom memory on`）。
- **当存在 `mom setup <agent> --write` 命令时，不要手动编辑用户已有的配置文件**：该命令会合并配置、保留其他条目，并先备份旧文件。
- 如果某项检查失败，在尝试其他办法之前，先阅读末尾的**故障排除**。

## 第 1 步：前置条件

```bash
node --version        # 必须是 v20 或更高版本
npm --version
```

检查：Node 输出 `v20` 或更高版本。如果不是，请用户安装 Node 20+，然后停止。

## 第 2 步：安装 `mom`（除 Claude Code 外的所有 agent）

`mom` 是一个没有依赖的小型 CLI。各个 agent 的插件文件都随同一个包一起发布。

```bash
npm install -g github:alinaqi/mixture-of-models-claude-mod
mom --help
```

检查：`mom --help` 输出 `mom — Mixture of Models for Codex, Cursor, OpenCode and other coding agents`。如果出现 `mom: command not found`，说明 npm 的全局 bin 不在 `PATH` 中：运行 `npm prefix -g`，然后使用 `<that>/bin/mom`。

如果只用 Claude Code，请直接跳到下面的 **Claude Code**：它不使用 `mom`。

## 第 3 步：登录 Palgu

```bash
mom login
```

它会输出 `Open https://www.palgu.ai/connect?code=XXXX-XXXX and approve code XXXX-XXXX`。把这一行展示给用户，并等待 `Signed in to Palgu as ...`。新用户可以在同一页面注册。

如果用户已经有 Palgu 密钥，也可以在 shell 中 `export PALGU_API_KEY=...`；不要让他们把密钥粘贴到对话中。

检查：

```bash
mom status
```

第一行以 `Palgu: signed in` 开头。

## 第 4 步：设置 agent

### Claude Code

需要 Claude Code 2.1.287 或更高版本（`claude --version`）。

```bash
claude plugin marketplace add alinaqi/mixture-of-models-claude-mod
claude plugin install mixture-of-models@mixture-of-models-claude-mod
```

然后用户重启 Claude Code，并在其中运行 `/palgu login`（与第 3 步相同的“链接 + 批准”流程）。

检查：`claude plugin list` 显示 `mixture-of-models@mixture-of-models-claude-mod`；重启后，`/route` 显示路由状态，`/palgu status` 显示 `Palgu: signed in`。

### Codex（CLI 0.163 或更高版本）

```bash
mom setup codex --write                                        # 写入 ~/.codex/palgu.config.toml；不会改动 config.toml
codex plugin marketplace add alinaqi/mixture-of-models-claude-mod
codex plugin add mixture-of-models@mixture-of-models
```

用户使用 `codex -p palgu` 在 Palgu 上启动 Codex。首次启动时，Codex 会要求审查插件的 hook（`/hooks`）；这些 hook 只运行 `mom hook codex`，不做别的事。要固定使用某一个模型：`MOM_PIN=<model> codex -p palgu -m <model>`（同一个模型写两次）。

检查：`codex plugin list` 显示 `mixture-of-models`，并且 `~/.codex/palgu.config.toml` 存在且包含 `model_provider = "palgu"`。

指南：[integrations/codex](integrations/codex/README.md)

### Cursor

在用户希望使用它的项目文件夹中运行：

```bash
mom setup cursor --write                                       # 合并到 .cursor/hooks.json 和 .cursor/mcp.json（会先备份）
mkdir -p .cursor/rules && cp "$(npm root -g)/mixture-of-models-claude-mod/integrations/cursor/rules/mixture-of-models.mdc" .cursor/rules/
```

用户重新加载 Cursor 窗口（**Developer: Reload Window**）。如果想为所有项目安装，用户可以在 Cursor 中添加 marketplace：**Dashboard → Plugins & MCPs → Add Marketplace → Import from Repo**，填入 `https://github.com/alinaqi/mixture-of-models-claude-mod`，然后安装 **Mixture of Models**。

检查：`.cursor/hooks.json` 中有运行 `mom hook cursor` 的条目，`.cursor/mcp.json` 中有运行 `mom mcp cursor` 的服务器。在 Cursor 中，MCP 设置会列出该服务器及其三个工具（`palgu_memory_search`、`palgu_delegate`、`palgu_models`）。

指南：[integrations/cursor](integrations/cursor/README.md)

### OpenCode（1.19 或更高版本）

```bash
mom setup opencode --write                                     # 把 Palgu 和插件合并到 opencode.json（会先备份）
```

如果设置了 `$OPENCODE_CONFIG`，它会写入该文件，否则写入 `~/.config/opencode/opencode.json`。如果文件中有注释，它会改为输出配置块：请手动合并，并保留其他所有键。

检查：文件中现在有 `provider.palgu`、一个以 `integrations/opencode/plugin.js` 结尾的 `plugin` 条目，以及（如果原来没有默认模型）`"model": "palgu/auto"`。在 OpenCode 中，`/route status` 会有响应。

指南：[integrations/opencode](integrations/opencode/README.md)

### Antigravity（`agy` 1.0.7 或更高版本）

```bash
agy plugin install "$(npm root -g)/mixture-of-models-claude-mod/integrations/antigravity"
```

检查：`agy plugin list` 显示 `mixture-of-models` 已启用。`agy plugin validate "$(npm root -g)/mixture-of-models-claude-mod/integrations/antigravity"` 不报告任何错误。

如果 `agy` 因 `PERMISSION_DENIED on resource project <id>` 而失败，那是 Antigravity 自己的 Google Cloud 设置问题，与本插件无关：参见 [integrations/antigravity](integrations/antigravity/README.md)。

### GitHub Copilot CLI（1.0.112 或更高版本）

```bash
copilot plugin install alinaqi/mixture-of-models-claude-mod:integrations/copilot
```

用户必须已登录 Copilot（在 `copilot` 中运行 `/login`）。如果 `GITHUB_TOKEN` 被设为 classic token，Copilot 会拒绝它：请以 `env -u GITHUB_TOKEN -u GH_TOKEN copilot` 的方式启动。

检查：`copilot plugin list` 显示 `mixture-of-models`。在会话中让 agent 调用 `palgu_models`，会列出 Palgu 的模型。

指南：[integrations/copilot](integrations/copilot/README.md)

### Aider、Continue、Goose

这些工具没有 hook，因此只能使用 Palgu 的路由（没有记忆，没有心跳）。请按照 [integrations/gateway](integrations/gateway/README.md) 操作：把 agent 指向 `https://api.palgu.ai/v1`，模型设为 `auto`，密钥来自 `mom token`。

检查：一条提示词能得到回答；Palgu 的控制台显示该请求。

### 暂不支持

- **Gemini CLI**：需要 Gemini 格式的 Palgu 端点（尚未提供）。
- **Windsurf**：无法把它指向其他模型端点。

## 第 5 步（可选，先询问）：Palgu 记忆

仅当用户同意把项目源代码上传到 Palgu 时执行。在项目文件夹中：

```bash
mom memory on        # Claude Code 用户：请改为在 Claude Code 中运行 /palgu memory on
mom memory status
```

检查：`mom memory status` 显示 `Palgu memory: on`；索引完成后（大型仓库需要几分钟），它显示 `indexed, N symbols`。索引需要 `palgu` CLI（https://www.palgu.ai/install）；如果没有安装，status 会提示。

同意是按文件夹记录的，并由所有使用 `mom` 的 agent 共享。`mom memory off` 可以关闭它。

## 第 6 步：告诉用户有哪些变化

报告：设置了哪个 agent、写入了哪些文件（以及它们的 `.bak` 备份）、记忆是否开启，以及如何启动（`codex -p palgu`、重新加载 Cursor、重启 Claude Code 等）。对用户有用的命令：`mom status`、`mom memory on|off|status`、`mom heartbeat palgu|local|off`。引导他们阅读 [GUIDELINES.md](GUIDELINES.md)，了解如何在自己的 agent 中使用它。

## 故障排除

| 现象 | 原因 | 解决方法 |
| :- | :- | :- |
| `mom: command not found` | npm 的全局 bin 不在 `PATH` 中 | 使用 `$(npm prefix -g)/bin/mom`，或把该文件夹加入 `PATH` |
| hook 或 MCP 服务器找不到 `mom`（从 Dock 启动的应用） | GUI 应用看不到 shell 的 `PATH` | 在 hook 命令和 MCP 配置中写入 `which mom` 给出的完整路径 |
| `mom status` 显示 `not signed in` | `mom login` 未完成，或当前 shell 中没有导出 `PALGU_API_KEY` | 重新运行 `mom login` 并等待批准 |
| Palgu 返回 403 `pin 'auto' not allowed by policy` | 发送了模型固定，但模型为 `auto` | 固定时同时写明模型：`MOM_PIN=<m> codex -p palgu -m <m>` |
| Palgu 对某个被固定的模型返回 503 | 该模型不可用 | 换一个（使用 `palgu_models` 工具，或 `GET https://api.palgu.ai/v1/models/health`） |
| Codex 的 hook 在 `codex exec` 中不运行 | hook 尚未被信任 | 先以交互方式启动一次 `codex -p palgu`，并在 `/hooks` 中批准它们 |
| `mom memory status`：`could not read the index status` | `palgu` CLI 缺失或未登录 | 从 https://www.palgu.ai/install 安装；它自己没有密钥时会使用 `mom` 的密钥 |
