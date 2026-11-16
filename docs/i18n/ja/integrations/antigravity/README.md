# Antigravity 向け Mixture of Models

[English](../../../../../integrations/antigravity/README.md) · [简体中文](../../../zh-CN/integrations/antigravity/README.md) · **日本語** · [Deutsch](../../../de/integrations/antigravity/README.md) · [Français](../../../fr/integrations/antigravity/README.md) · [العربية](../../../ar/integrations/antigravity/README.md)

*これは翻訳です。正式な版は英語版であり、英語版のほうが新しい場合があります。*

Google の Antigravity CLI(`agy`)で、Palgu メモリを各プロンプトに想起し、タスクの途中で止まったターンをハートビートで続行し、Palgu のモデルをツールとして使えるようにします([ADR 0005](../../../../adr/0005-other-coding-agents.md))。

agy 1.0.7 で実機確認済みです。

## インストール

```bash
npm install -g github:alinaqi/mixture-of-models-claude-mod   # mom とこのプラグインのファイルをインストール
mom login                                                     # Palgu にサインイン
agy plugin install "$(npm root -g)/mixture-of-models-claude-mod/integrations/antigravity"
agy plugin list                                               # mixture-of-models が有効になっていること
```

次に、Palgu メモリに入れたいプロジェクトで: `mom memory on`(ソースを Palgu にアップロードします。デフォルトはオフ、フォルダーごとで、`mom` が対応する他のエージェントと共有されます)。

## 機能

| | 仕組み | Antigravity の機能 |
| :- | :- | :- |
| **Palgu メモリ** | メモリがオンのフォルダーでは、各ターンの最初のモデル呼び出しで、プロジェクトの Palgu メモリから最大 8 件のポインター(記録された意図と ADR、ドキュメント、コードシンボル)がモデル向けに追加されます。 | `PreInvocation`(`invocationNum` 0)→ `injectSteps` `ephemeralMessage` |
| **ハートビート** | タスクの途中で終わったターン("Let me check the tests."(テストを確認します。))を、プロンプトごとに最大 3 回続行します。判断するのは Palgu です(`POST /anthropic/heartbeat`)。サインインしていない場合は、同じ分類器がローカルで動きます。`mom heartbeat off` でオフにします。 | `Stop` → `decision: "continue"`。Stop の入力には回答が含まれないため、回答はトランスクリプトから読みます |
| **インデックス作成** | メモリがオンのフォルダーでは、セッション開始時に `palgu memory index .` をバックグラウンドで、最大 10 分に 1 回実行します。 | `SessionStart` |
| **ツールとしての Palgu のモデル** | `palgu_memory_search`、`palgu_delegate`(自己完結したサブタスクを Palgu のモデルに渡す。`auto` またはピン留め)、`palgu_models`。いつ使うかを示す常時有効なルール付き。 | `mcp_config.json`(`mom mcp antigravity`)、`rules/AGENTS.md` |

どのフックも失敗時はオープン(fail open)です: `mom` がエラーになったり Palgu が遅かったりしても、`agy` はフックがないかのように続行します。

## ルーティング

Antigravity のフックはモデルを変更できず、Antigravity 自身のモデル設定は Gemini のモデル(または管理者が設定するエンタープライズのモデルゲートウェイ)しか受け付けません。そのため、エージェント自身のターンは `agy` で選んだ Gemini モデルのままです。Palgu のルーティングは `palgu_delegate` を通じて届き、ルールが、低リスクで自己完結したサブタスクにそれを使うようエージェントに指示します。

## 何をどこに送るか

- `https://api.palgu.ai/v1/cortex/search` へ(メモリがオンのフォルダーでのみ): プロンプト(1 行、最大 300 文字)とプロジェクトの Palgu 上の名前。
- `https://api.palgu.ai/anthropic/heartbeat` へ(`mom heartbeat local|off` でない限り): 回答の最後の 600 文字とセッション ID。
- `https://api.palgu.ai/v1/chat/completions` へ(エージェントが `palgu_delegate` を呼んだときのみ): サブタスクのプロンプト。
- キーは `~/.config/mixture-of-models/credentials.json`(0600)または `PALGU_API_KEY` にあり、プラグインのファイルには一切含まれません。

## 実機で確認した、ドキュメントと異なる点(agy 1.0.7)

- フックの入力には `hookEventName` と `cwd` が含まれ、続行フラグは `continuationActive` です。
- 回答で終わるターンは `terminationReason: "NO_TOOL_CALL"`(ドキュメントでは `model_stop`)で停止し、失敗したターンは `ERROR` で停止します。続行されるのは前者だけです。
- トランスクリプト(`transcriptPath`)は JSONL で、モデルの回答は `PLANNER_RESPONSE` ステップです。
- `agy` が `PERMISSION_DENIED on resource project <id>` で失敗する場合、`~/.gemini/antigravity-cli/settings.json` の Google Cloud プロジェクト(`gcp.project`)が、あなたのアカウントでは使えないものです: 使えるプロジェクトを設定するか、`"modelProvider": "gemini"` と `GEMINI_API_KEY` で Gemini API キーを使ってください。
