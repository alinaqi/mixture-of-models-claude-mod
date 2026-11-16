# Mixture of Models のインストール(コーディングエージェント向けの手順)

[English](../../../INSTALL.md) · [简体中文](../zh-CN/INSTALL.md) · **日本語** · [Deutsch](../de/INSTALL.md) · [Français](../fr/INSTALL.md) · [العربية](../ar/INSTALL.md)

*これは翻訳です。正式な版は英語版であり、英語版のほうが新しい場合があります。*

あなたは Mixture of Models のセットアップを頼まれたコーディングエージェントです。このファイルを上から順に実行してください。どのステップにも、実行するコマンドと、うまくいったかを確かめる確認方法があります。ユーザーが指定したエージェント向けの手順を実行してください。指定がなければ、あなた自身(これを読んでいるエージェント)向けにセットアップしてください。

ユーザーが得られるもの: Palgu がリクエストごとにモデルを選び(単純な作業には安いモデル)、プロジェクトの Palgu メモリがプロンプトに想起され、タスクの途中で止まったターンは続行されます。リポジトリ: https://github.com/alinaqi/mixture-of-models-claude-mod

## ルール

- **Palgu のキーを決して出力、ログ記録、コミットしないでください。** キーは `~/.config/mixture-of-models/credentials.json`(`mom login` が書き込みます)または環境変数 `PALGU_API_KEY` にあります。これらの手順で書き込まれる設定はキーを参照するだけで、キー自体は含みません。
- **サインインにはユーザーが必要です。** `mom login` はリンクとコードを表示し、ユーザーがブラウザーで承認するまで最大 10 分待ちます。ユーザーにリンクを示し、承認するよう伝えて待ってください。自分で承認しようとしないでください。
- **Palgu メモリはプロジェクトのソースを Palgu にアップロードします。** ユーザーが同意した場合にのみ、ユーザーが指定したプロジェクトで有効にしてください(`mom memory on`)。
- `mom setup <agent> --write` コマンドがある場合は、**ユーザーの既存の設定ファイルを手で編集しないでください**: このコマンドはマージし、他のエントリを保持し、先に古いファイルをバックアップします。
- 確認が失敗した場合は、別のことを試す前に末尾の **トラブルシューティング** を読んでください。

## ステップ 1. 前提条件

```bash
node --version        # v20 以降が必要
npm --version
```

確認: Node が `v20` 以上を表示すること。そうでなければ、ユーザーに Node 20+ のインストールを頼んで中止してください。

## ステップ 2. `mom` のインストール(Claude Code 以外のすべてのエージェント)

`mom` は依存関係のない小さな CLI です。各エージェント用のプラグインファイルは同じパッケージに含まれています。

```bash
npm install -g github:alinaqi/mixture-of-models-claude-mod
mom --help
```

確認: `mom --help` が `mom — Mixture of Models for Codex, Cursor, OpenCode and other coding agents` を表示すること。`mom: command not found` の場合は、npm のグローバル bin が `PATH` にありません: `npm prefix -g` を実行し、`<that>/bin/mom` を使ってください。

Claude Code だけの場合は、下の **Claude Code** に進んでください: Claude Code は `mom` を使いません。

## ステップ 3. Palgu へのサインイン

```bash
mom login
```

`Open https://www.palgu.ai/connect?code=XXXX-XXXX and approve code XXXX-XXXX` と表示されます。この行をユーザーに示し、`Signed in to Palgu as ...` が表示されるまで待ってください。新しいユーザーは同じページでサインアップできます。

ユーザーがすでに Palgu のキーを持っている場合は、代わりにシェルで `export PALGU_API_KEY=...` を実行してもらえます。チャットにキーを貼り付けるよう頼まないでください。

確認:

```bash
mom status
```

最初の行が `Palgu: signed in` で始まること。

## ステップ 4. エージェントのセットアップ

### Claude Code

Claude Code 2.1.287 以降が必要です(`claude --version`)。

```bash
claude plugin marketplace add alinaqi/mixture-of-models-claude-mod
claude plugin install mixture-of-models@mixture-of-models-claude-mod
```

その後、ユーザーが Claude Code を再起動し、その中で `/palgu login` を実行します(ステップ 3 と同じ、リンクを開いて承認する流れです)。

確認: `claude plugin list` に `mixture-of-models@mixture-of-models-claude-mod` が表示されること。再起動後、`/route` がルートの状態を表示し、`/palgu status` が `Palgu: signed in` と表示すること。

### Codex(CLI 0.163 以降)

```bash
mom setup codex --write                                        # ~/.codex/palgu.config.toml を書き込む。config.toml には触れない
codex plugin marketplace add alinaqi/mixture-of-models-claude-mod
codex plugin add mixture-of-models@mixture-of-models
```

ユーザーは `codex -p palgu` で Palgu 上の Codex を起動します。初回起動時、Codex はプラグインのフックを確認するよう求めます(`/hooks`)。フックは `mom hook codex` を実行するだけで、それ以外は何もしません。1 つのモデルにピン留めするには: `MOM_PIN=<model> codex -p palgu -m <model>`(同じモデルを 2 回指定)。

確認: `codex plugin list` に `mixture-of-models` が表示され、`~/.codex/palgu.config.toml` が存在して `model_provider = "palgu"` を含むこと。

ガイド: [integrations/codex](integrations/codex/README.md)

### Cursor

ユーザーが使いたいプロジェクトフォルダーで実行します:

```bash
mom setup cursor --write                                       # .cursor/hooks.json と .cursor/mcp.json にマージする(バックアップあり)
mkdir -p .cursor/rules && cp "$(npm root -g)/mixture-of-models-claude-mod/integrations/cursor/rules/mixture-of-models.mdc" .cursor/rules/
```

ユーザーは Cursor のウィンドウをリロードします(**Developer: Reload Window**)。すべてのプロジェクトにインストールしたい場合は、ユーザーが Cursor でマーケットプレイスを追加します: **Dashboard → Plugins & MCPs → Add Marketplace → Import from Repo** で `https://github.com/alinaqi/mixture-of-models-claude-mod` を指定し、**Mixture of Models** をインストールします。

確認: `.cursor/hooks.json` に `mom hook cursor` を実行するエントリがあり、`.cursor/mcp.json` に `mom mcp cursor` を実行するサーバーがあること。Cursor の MCP 設定に、3 つのツール(`palgu_memory_search`、`palgu_delegate`、`palgu_models`)を持つサーバーが表示されること。

ガイド: [integrations/cursor](integrations/cursor/README.md)

### OpenCode(1.19 以降)

```bash
mom setup opencode --write                                     # Palgu とプラグインを opencode.json にマージする(バックアップあり)
```

`$OPENCODE_CONFIG` が設定されていればそこに、なければ `~/.config/opencode/opencode.json` に書き込みます。ファイルにコメントがある場合は、代わりにブロックを表示します: 他のキーをすべて保持したまま、手でマージしてください。

確認: ファイルに `provider.palgu`、`integrations/opencode/plugin.js` で終わる `plugin` エントリ、そして(デフォルトのモデルがなかった場合は)`"model": "palgu/auto"` があること。OpenCode で `/route status` が応答すること。

ガイド: [integrations/opencode](integrations/opencode/README.md)

### Antigravity(`agy` 1.0.7 以降)

```bash
agy plugin install "$(npm root -g)/mixture-of-models-claude-mod/integrations/antigravity"
```

確認: `agy plugin list` に `mixture-of-models` が有効として表示されること。`agy plugin validate "$(npm root -g)/mixture-of-models-claude-mod/integrations/antigravity"` がエラーを報告しないこと。

`agy` が `PERMISSION_DENIED on resource project <id>` で失敗する場合、それはこのプラグインではなく Antigravity 自身の Google Cloud の設定です: [integrations/antigravity](integrations/antigravity/README.md) を参照してください。

### GitHub Copilot CLI(1.0.112 以降)

```bash
copilot plugin install alinaqi/mixture-of-models-claude-mod:integrations/copilot
```

ユーザーは Copilot にサインインしている必要があります(`copilot` 内で `/login`)。`GITHUB_TOKEN` にクラシックトークンが設定されていると Copilot はそれを拒否します: `env -u GITHUB_TOKEN -u GH_TOKEN copilot` として起動してください。

確認: `copilot plugin list` に `mixture-of-models` が表示されること。セッション内でエージェントに `palgu_models` を呼ぶよう頼むと、Palgu のモデルが一覧表示されること。

ガイド: [integrations/copilot](integrations/copilot/README.md)

### Aider、Continue、Goose

これらにはフックがないため、Palgu のルーティングだけが適用されます(メモリなし、ハートビートなし)。[integrations/gateway](integrations/gateway/README.md) に従い、エージェントを `https://api.palgu.ai/v1` に向け、モデルを `auto`、キーを `mom token` の出力にしてください。

確認: 1 つのプロンプトに回答が返り、Palgu のダッシュボードにそのリクエストが表示されること。

### まだサポートされていないもの

- **Gemini CLI**: Gemini 形式の Palgu エンドポイントが必要です(まだ提供されていません)。
- **Windsurf**: 別のモデルのエンドポイントに向ける方法がありません。

## ステップ 5(任意、先に確認). Palgu メモリ

ユーザーがプロジェクトのソースを Palgu にアップロードすることに同意した場合のみ。プロジェクトフォルダーで:

```bash
mom memory on        # Claude Code のユーザーは、代わりに Claude Code 内で /palgu memory on
mom memory status
```

確認: `mom memory status` が `Palgu memory: on` と表示すること。インデックス作成が終わると(大きなリポジトリでは数分)、`indexed, N symbols` と表示されます。インデックス作成には `palgu` CLI(https://www.palgu.ai/install)が必要です。ない場合は status がそう表示します。

同意はフォルダーごとで、`mom` を使うすべてのエージェントで共有されます。`mom memory off` で停止します。

## ステップ 6. 何が変わったかをユーザーに伝える

報告すること: どのエージェントをセットアップしたか、書き込んだファイル(とその `.bak` バックアップ)、メモリがオンかどうか、起動方法(`codex -p palgu`、Cursor のリロード、Claude Code の再起動など)。ユーザーに便利なコマンド: `mom status`、`mom memory on|off|status`、`mom heartbeat palgu|local|off`。エージェントでの使い方については [GUIDELINES.md](GUIDELINES.md) を案内してください。

## トラブルシューティング

| 症状 | 原因 | 対処 |
| :- | :- | :- |
| `mom: command not found` | npm のグローバル bin が `PATH` にない | `$(npm prefix -g)/bin/mom` を使うか、そのフォルダーを `PATH` に追加する |
| フックや MCP サーバーが `mom` を見つけられない(Dock から起動したアプリ) | GUI アプリはシェルの `PATH` を見ない | フックのコマンドと MCP の設定に `which mom` のフルパスを書く |
| `mom status` が `not signed in` と表示する | `mom login` が完了していない、またはこのシェルで `PALGU_API_KEY` が export されていない | `mom login` をもう一度実行し、承認を待つ |
| Palgu が 403 `pin 'auto' not allowed by policy` を返す | モデル `auto` でモデルのピンが送られた | モデル名も指定してピン留めする: `MOM_PIN=<m> codex -p palgu -m <m>` |
| ピン留めしたモデルに対して Palgu が 503 を返す | そのモデルがダウンしている | 別のモデルを選ぶ(`palgu_models` ツール、または `GET https://api.palgu.ai/v1/models/health`) |
| `codex exec` で Codex のフックが動かない | フックがまだ信頼されていない | 一度 `codex -p palgu` を対話的に起動し、`/hooks` で承認する |
| `mom memory status`: `could not read the index status` | `palgu` CLI がない、またはサインインしていない | https://www.palgu.ai/install からインストールする。自身のキーがない場合は `mom` のキーを使う |
