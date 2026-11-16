# GitHub Copilot CLI 向け Mixture of Models

[English](../../../../../integrations/copilot/README.md) · [简体中文](../../../zh-CN/integrations/copilot/README.md) · **日本語** · [Deutsch](../../../de/integrations/copilot/README.md) · [Français](../../../fr/integrations/copilot/README.md) · [العربية](../../../ar/integrations/copilot/README.md)

*これは翻訳です。正式な版は英語版であり、英語版のほうが新しい場合があります。*

GitHub Copilot CLI で、タスクの途中で止まったターンをハートビートで続行し、Palgu メモリと、ツールとしての Palgu のモデルを使えるようにします([ADR 0005](../../../../adr/0005-other-coding-agents.md))。

Copilot CLI 1.0.112 で実機確認済みです。

## インストール

```bash
npm install -g github:alinaqi/mixture-of-models-claude-mod   # mom をインストール(プラグインのフックと MCP サーバーがこれを実行する)
mom login                                                     # Palgu にサインイン
copilot plugin install alinaqi/mixture-of-models-claude-mod:integrations/copilot
copilot plugin list                                           # mixture-of-models
```

インストールせずに試すには: `copilot --plugin-dir "$(npm root -g)/mixture-of-models-claude-mod/integrations/copilot"`。

次に、Palgu メモリに入れたいプロジェクトで: `mom memory on`(ソースを Palgu にアップロードします。デフォルトはオフ、フォルダーごとで、`mom` が対応する他のエージェントと共有されます)。

## 機能

| | 仕組み | Copilot の機能 |
| :- | :- | :- |
| **ハートビート** | タスクの途中で終わったターン("Let me check the tests."(テストを確認します。))を、プロンプトごとに最大 3 回続行します。判断するのは Palgu です(`POST /anthropic/heartbeat`)。サインインしていない場合は、同じ分類器がローカルで動きます。`mom heartbeat off` でオフにします。 | `agentStop` → continue のプロンプトを `reason` にした `decision: "block"`。停止時の入力には回答が含まれないため、回答はセッションの `events.jsonl` から読みます |
| **Palgu メモリ** | エージェントは `palgu_memory_search` でプロジェクトの Palgu メモリを検索します(いつ検索するかはスキルが指示します)。メモリがオンのフォルダーでは、セッション開始時にメモリがオンであることが伝えられます。 | MCP サーバー(`.mcp.json`、`mom mcp copilot`)、`sessionStart` → `additionalContext`、スキル `mixture-of-models` |
| **ツールとしての Palgu のモデル** | `palgu_delegate` は自己完結したサブタスクを Palgu のモデル(`auto` またはピン留め)に渡し、`palgu_models` はそれらを一覧表示します。 | MCP サーバー |
| **インデックス作成** | メモリがオンのフォルダーでは、セッション開始時に `palgu memory index .` をバックグラウンドで、最大 10 分に 1 回実行します。 | `sessionStart` |

どのフックも失敗時はオープン(fail open)です: `mom` がエラーになったり Palgu が遅かったりしても、Copilot はフックがないかのように続行します。

## Claude Code の mod との違い

- **Copilot 自身のターンをプロンプトごとにルーティングすることはありません。** Copilot のフックはモデルを変更できず、`userPromptSubmitted` に対するコマンドフックの出力は捨てられるため、各プロンプトにメモリを追加することもできません: メモリは MCP ツールを通じて届きます。Palgu のルーティングは `palgu_delegate` を通じて Copilot に届きます。Copilot は、タイプ `anthropic` の BYOK プロバイダーとして Palgu を使うこともできます(`https://api.palgu.ai/anthropic`、モデル `auto`)。その場合はセッションごとに 1 つのモデルです。GitHub の BYOK のドキュメントを参照してください。
- `/route` や `/palgu` のコマンドはありません。ターミナルの `mom` がその役割を担います。

## 何をどこに送るか

- `https://api.palgu.ai/anthropic/heartbeat` へ(`mom heartbeat local|off` でない限り): 回答の最後の 600 文字とセッション ID。
- `https://api.palgu.ai/v1/cortex/search` へ(メモリがオンのフォルダーで、エージェントが `palgu_memory_search` を呼んだときのみ): クエリ(最大 300 文字)とプロジェクトの Palgu 上の名前。
- `https://api.palgu.ai/v1/chat/completions` へ(エージェントが `palgu_delegate` を呼んだときのみ): サブタスクのプロンプト。
- キーは `~/.config/mixture-of-models/credentials.json`(0600)または `PALGU_API_KEY` にあり、プラグインのファイルには一切含まれません。

## 実機で確認したこと(Copilot CLI 1.0.112)

- リポジトリの `.github/hooks/` にあるフックは、信頼されていないフォルダーでの `copilot -p` では実行されませんでした。同じフックをプラグインに入れた場合(`--plugin-dir` またはインストール済み)は実行されました。
- `agentStop` からの continue のプロンプトは、新しい `userPromptSubmitted` として戻ってきます。`mom` はそれを自分のものと認識するので、本人のプロンプトと 3 回の続行の予算を保持します。
- プラグインの MCP サーバーはプラグインのフォルダーで起動します。セッションのフォルダーは `COPILOT_SESSION_CWD` で、`mom mcp` はこれを使います。
- トランスクリプトは `~/.copilot/session-state/<session>/events.jsonl`(または `$COPILOT_HOME` 配下)で、モデルの回答は `assistant.message` イベントです。`mom` が読むのはそのフォルダー配下の `.jsonl` ファイルだけで、それも最後の 256 KB だけです。
- `copilot` はクラシックの `GITHUB_TOKEN` を拒否します。`/login` でサインインしてください(設定されている場合は `env -u GITHUB_TOKEN -u GH_TOKEN copilot` で実行します)。
