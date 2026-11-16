# Cursor 向け Mixture of Models

[English](../../../../../integrations/cursor/README.md) · [简体中文](../../../zh-CN/integrations/cursor/README.md) · **日本語** · [Deutsch](../../../de/integrations/cursor/README.md) · [Français](../../../fr/integrations/cursor/README.md) · [العربية](../../../ar/integrations/cursor/README.md)

*これは翻訳です。正式な版は英語版であり、英語版のほうが新しい場合があります。*

Palgu メモリを検索し、自己完結したサブタスクを Palgu 経由で安いモデルに送り、タスクの途中で止まったターンを続行します。Claude Code の mod と同じように、Cursor が提供するもの、つまりフック、MCP サーバー、ルールを通じて動作します([ADR 0005](../../../../adr/0005-other-coding-agents.md))。

Node 20 以降と、Cursor から見える `PATH` 上の `mom` CLI が必要です。Palgu メモリのインデックス作成には [palgu CLI](https://www.palgu.ai/install) も必要です。palgu CLI は、自身の `palgu login` があればそれを、なければ `mom` のキーを使います。

## インストール

```bash
# 1. mom CLI(フックと MCP サーバーがこれを実行する)
npm install -g github:alinaqi/mixture-of-models-claude-mod
mom login                      # ブラウザーで Palgu にサインイン
```

次に、以下のいずれかを選びます:

- **プラグイン。** Cursor で **Dashboard → Plugins & MCPs → Add Marketplace → Import from Repo** から `https://github.com/alinaqi/mixture-of-models-claude-mod` を指定し、**Customize** から **Mixture of Models** をインストールします。ローカルで試すには、`integrations/cursor` を `~/.cursor/plugins/local/mixture-of-models` にコピーし、**Developer: Reload Window** を実行します。
- **プラグインなしで、プロジェクトごとに。** プロジェクトフォルダーで `mom setup cursor` を実行すると `.cursor/hooks.json` と `.cursor/mcp.json` のエントリが表示され、`mom setup cursor --write` はそれらを既存のファイルにマージします。他のフックやサーバーは保持し、変更するファイルの `.bak` を保存します。その後、ウィンドウをリロードします。この方法ではフックと MCP サーバーは得られますが、ルールは得られません。ルールが必要なら `integrations/cursor/rules/mixture-of-models.mdc` を `.cursor/rules/` にコピーしてください。

Cursor が `mom` を見つけられない場合(Dock から起動したアプリは npm のグローバル bin を見られないことがあります)、フックと `mcp.json` に `which mom` のフルパスを使ってください。

## 機能

| | 仕組み | Cursor の機能 |
| :- | :- | :- |
| **Palgu メモリ** | プロジェクトフォルダーで `mom memory on` を実行するとインデックスが作成されます(ソースが Palgu にアップロードされます)。その後、エージェントはタスクの開始時に `palgu_memory_search` でそれを検索し、最大 8 件のポインターを受け取ります。セッション開始時に、フックがエージェントにメモリがオンであることを伝えます。メモリはデフォルトでオフです。同意はフォルダーごとで、`mom` が対応するすべてのツールと共有されます。 | MCP ツール、`sessionStart` → `additional_context`、ルール |
| **委任** | `palgu_delegate {prompt, model?}` は、自己完結したサブタスクを 1 つ Palgu に送り(`model: "auto"` で Palgu にティアを選ばせるか、ピン留めしたモデル)、回答を返します。ルールはこれを低リスクの作業(下書きするテスト、ボイラープレート、ドキュメント、調べもの)に限定し、セキュリティに敏感な作業とシークレットを除外します。`palgu_models` は Palgu が提供するモデルを一覧表示します。 | MCP ツール、ルール |
| **ハートビート** | ターンがタスクの途中で終わったとき("Now I'll run the tests."(これからテストを実行します。)と言って何もしない)、フックがフォローアップを送ります。プロンプトごとに最大 3 回です。判断するのは Palgu です(`POST /anthropic/heartbeat`)。サインインしていない場合は、同じ分類器がローカルで動きます。あなたが中断したターンは決して続行されません。`mom heartbeat off` でオフにします。 | `afterAgentResponse` が回答を保持、`stop` → `followup_message`(`loop_limit: 3`) |
| **インデックス作成** | メモリがオンのフォルダーでは、セッション開始時に `palgu memory index .` がバックグラウンドで、最大 10 分に 1 回実行されます。 | `sessionStart` |

どのフックも失敗時はオープン(fail open)です。`mom` がエラーになったり Palgu が遅かったりしても、Cursor はフックがないかのように続行します。ハートビートは最大 8 秒、メモリ検索は 8 秒、委任は 120 秒待ちます。

## 何をどこに送るか

- `https://api.palgu.ai/v1/chat/completions` へ(`palgu_delegate`。エージェントが呼んだときのみ): サブタスクのプロンプト。`x-srooter-client: mixture-of-models-cursor/<version>` と、モデルがピン留めされている場合は `x-srooter-pin` を付けます。
- `https://api.palgu.ai/v1/cortex/search` へ(`palgu_memory_search`。メモリがオンのフォルダーでのみ): クエリ(1 行、最大 300 文字)とプロジェクトの Palgu 上の名前。
- `https://api.palgu.ai/v1/models/health` へ(`palgu_models`): キーのみ。
- `https://api.palgu.ai/anthropic/heartbeat` へ(`stop` フック。`mom heartbeat local|off` でない限り): エージェントの回答の最後の 600 文字とセッション ID。
- キーは `~/.config/mixture-of-models/credentials.json`(モード 0600)にあるか、`PALGU_API_KEY` から取得されます。Cursor のファイルに書き込まれることも、ログに記録されることもありません。`mom` の状態(各会話の最後のプロンプトと回答を 1 日分)は、その隣の `state.json` に保存されます。

## Claude Code の mod との違い

- **ターンごとのルーティングはありません。** Cursor のフックはモデルを変更できず、カスタムの API ベース URL は Agent モードでは信頼できません。作業をするのは Cursor 自身のモデルで、エージェントが `palgu_delegate` に渡したものだけが安いモデルに送られます。
- **メモリはプッシュではなくプルです。** `beforeSubmitPrompt` はプロンプトを許可またはブロックすることしかできず、コンテキストを追加できません。そのためメモリは、すべてのプロンプトを通じてではなく、ルールとセッション開始時の通知が呼ぶよう指示する MCP ツールを通じてエージェントに届きます。
- **`/route` や `/palgu` のコマンドはありません。** ルールが、提案すべき `mom` コマンドをエージェントに伝えます。

## 他のツール向けの `mom mcp`

`mom mcp [tool]` は stdio 上の素の MCP サーバー(JSON-RPC 2.0、プロトコル `2025-06-18` またはクライアントのバージョン)なので、MCP サーバーを実行できるエージェントならどれでも使えます: `command: "mom", args: ["mcp", "<tool>"]`。`<tool>` は `x-srooter-client` でクライアント名を示すだけです。プロジェクトフォルダーは、ツールの `folder` 引数、次に `MOM_PROJECT_DIR`、次にクライアントの MCP ルート、次に作業ディレクトリの順に探します。
