# Codex 向け Mixture of Models

[English](../../../../../integrations/codex/README.md) · [简体中文](../../../zh-CN/integrations/codex/README.md) · **日本語** · [Deutsch](../../../de/integrations/codex/README.md) · [Français](../../../fr/integrations/codex/README.md) · [العربية](../../../ar/integrations/codex/README.md)

*これは翻訳です。正式な版は英語版であり、英語版のほうが新しい場合があります。*

Palgu がリクエストごとにモデルを選び、Palgu メモリが各プロンプトに想起され、タスクの途中で止まったターンは続行されます。Claude Code の mod と同じ動作を、Codex 自身のプラグインとフックの上に構築したものです([ADR 0005](../../../../adr/0005-other-coding-agents.md))。

Codex 0.163 以降と Node 20 以降が必要です。Palgu メモリのインデックス作成には [palgu CLI](https://www.palgu.ai/install) も必要です。palgu CLI は、自身の `palgu login` があればそれを、なければ `mom` のキーを使います。

## インストール

```bash
# 1. mom CLI(プラグインのフックがこれを呼び出す)
npm install -g github:alinaqi/mixture-of-models-claude-mod
mom login                      # ブラウザーで Palgu にサインイン

# 2. Codex を Palgu 経由でルーティング: ~/.codex/palgu.config.toml を書き込む(あなたの config.toml には触れない)
mom setup codex --write

# 3. プラグイン: メモリの想起とハートビート
codex plugin marketplace add alinaqi/mixture-of-models-claude-mod
codex plugin add mixture-of-models@mixture-of-models
```

次に、Palgu 上で Codex を起動します:

```bash
codex -p palgu
```

初回、Codex はプラグインのフックを確認するよう求めます(`/hooks`)。フックは `mom hook codex` を実行するだけで、それ以外は何もしません。

## 機能

| | 仕組み | Codex の機能 |
| :- | :- | :- |
| **ルーティング** | `model = "auto"`: Palgu が各リクエストを分類し、自身のティア(trivial、small、medium、think)から提供します。`MOM_PIN=<model> codex -p palgu -m <model>`(同じモデルを 2 回指定)は、セッションを 1 つのモデルにピン留めします: Palgu は、`x-srooter-pin` がある場合にのみリクエストが指定したモデルにピン留めし、ピン付きの `auto` は拒否します(403)。 | `-p palgu` プロファイル、`auth = { command = "mom", args = ["token"] }` 付きの `[model_providers.palgu]` |
| **Palgu メモリ** | プロジェクトフォルダーで `mom memory on` を実行するとインデックスが作成され(ソースが Palgu にアップロードされます)、4 語以上のすべてのプロンプトに、そこから最大 8 件のポインターが想起されます。デフォルトはオフです。同意はフォルダーごとで、`mom` が対応する他のツールと共有されます。 | `UserPromptSubmit` → `additionalContext` |
| **ハートビート** | タスクの途中で終わったターン("Let me check the tests."(テストを確認します。))を、プロンプトごとに最大 3 回続行します。判断するのは Palgu です(`POST /anthropic/heartbeat`)。サインインしていない場合は、同じ分類器がローカルで動きます。`mom heartbeat off` でオフにします。 | `Stop` → `decision: "block"` |
| **Palgu で続ける** | `mom palgu codex` は直近の Codex セッションを完全なコンテキストのまま Palgu で続けます(`palgu --continue-codex=<id>`): ターミナルではその場で Palgu を起動し、それ以外ではコマンドをコピーします。`--open` は新しい macOS ターミナルのタブで起動します。Palgu がトランスクリプトを読み、認証情報を伏せます。`mom` が保存するのはセッション id とフォルダだけです。 | 任意の hook(セッション id) |
| **インデックス作成** | メモリがオンのフォルダーでは、セッション開始時に `palgu memory index .` がバックグラウンドで、最大 10 分に 1 回実行されます。 | `SessionStart` |

どのフックも失敗時はオープン(fail open)です: `mom` がエラーになったり Palgu が遅かったりしても、Codex はフックがないかのように続行します。メモリ検索は最大 3 秒、ハートビートは最大 8 秒待ちます。

## 何をどこに送るか

- `https://api.palgu.ai/v1/responses` へ(Codex 自身が、`-p palgu` のもとで): あなたの Codex のターン。`mom token` のキーと、ヘッダー `x-srooter-client: mixture-of-models-codex/<version>`、そして `MOM_PIN` / `MOM_PROJECT` が設定されている場合は `x-srooter-pin` / `x-srooter-project` を付けます。
- `https://api.palgu.ai/v1/cortex/search` へ(`mom` が、メモリがオンのフォルダーでのみ): プロンプト(1 行、最大 300 文字)とプロジェクトの Palgu 上の名前。
- `https://api.palgu.ai/anthropic/heartbeat` へ(`mom` が、`mom heartbeat local|off` でない限り): Codex の回答の最後の 600 文字とセッション ID。
- キーは `~/.config/mixture-of-models/credentials.json`(モード 0600)または `PALGU_API_KEY` にあります。Codex の設定に書き込まれることはありません。

## Claude Code の mod との違い

- ルーティングは mod の分類器と戦略ではなく、Palgu のティアによります: Codex のフックはターンのモデルを変更できません。
- `/route` や `/palgu` のスラッシュコマンドはありません(Codex はカスタムコマンドを廃止しました)。スキル `mixture-of-models` が、提案すべき `mom` コマンドを Codex に伝えます。
- フックを持つプラグインは Codex の公開プラグインディレクトリに掲載できないため、このリポジトリのマーケットプレイスからインストールします。
