# OpenCode 向け Mixture of Models

[English](../../../../../integrations/opencode/README.md) · [简体中文](../../../zh-CN/integrations/opencode/README.md) · **日本語** · [Deutsch](../../../de/integrations/opencode/README.md) · [Français](../../../fr/integrations/opencode/README.md) · [العربية](../../../ar/integrations/opencode/README.md)

*これは翻訳です。正式な版は英語版であり、英語版のほうが新しい場合があります。*

このプラグインは、プロンプトごとに Palgu のモデルを選び、各プロンプトに Palgu メモリを追加し、タスクの途中で止まったターンを続行し、`/route` と `/palgu` を追加します。OpenCode は、Claude Code 以外でプラグインがリクエストごとにモデルを選べる唯一のツールなので、Claude Code の mod と機能面で完全に対応しています([ADR 0005](../../../../adr/0005-other-coding-agents.md))。

要件:

- OpenCode 1.19 以降。プラグインは V1 のサーバープラグイン API を使います。1.19.5 でテスト済みです。
- `mom` 用に Node 20 以降。
- Palgu メモリについては、[palgu CLI](https://www.palgu.ai/install) がインデックス作成を行います。

## インストール

```bash
# 1. mom: サインイン、メモリへの同意、セットアップコマンド(プラグインは同じパッケージに含まれる)
npm install -g github:alinaqi/mixture-of-models-claude-mod
mom login                         # ブラウザーで Palgu にサインイン

# 2. opencode.json にプロバイダーとしての Palgu とプラグインを追加
mom setup opencode                # ブロックを表示する
mom setup opencode --write        # opencode.json にマージする(先に古いファイルを opencode.json.bak にコピー)
```

`--write` は、`$OPENCODE_CONFIG` が設定されていればそこに、そうでなければ `~/.config/opencode/opencode.json`(または `$XDG_CONFIG_HOME` 配下の同じパス)に書き込みます。変更するのは 2 つのキー、`provider.palgu` とプラグインのエントリで、デフォルトのモデルがない場合にのみ `model` を `palgu/auto` に設定します。他のキーはすべてそのままです。ファイルにコメントがある場合(JSONC)、`mom` はブロックを表示するので、手でマージしてください。モデルの一覧は、サインインしていれば Palgu(`GET /v1/models/health`)から、そうでなければ組み込みの一覧から取得されます。

書き込まれる内容(抜粋):

```json
{
  "model": "palgu/auto",
  "provider": {
    "palgu": {
      "npm": "@ai-sdk/anthropic",
      "name": "Palgu",
      "options": {
        "baseURL": "https://api.palgu.ai/anthropic/v1",
        "apiKey": "{env:PALGU_API_KEY}",
        "headers": { "x-srooter-client": "mixture-of-models-opencode/0.28.0" }
      },
      "models": { "auto": { "name": "Palgu router (auto)" }, "deepseek-pro": {}, "gemini-3.8-flash": {} }
    }
  },
  "plugin": ["/usr/local/lib/node_modules/mixture-of-models-claude-mod/integrations/opencode/plugin.js"]
}
```

キーはファイルに含まれません。プラグインは、`https://api.palgu.ai/` へのリクエストに mom のキー(`mom login` から、または `PALGU_API_KEY`)を追加します。`PALGU_API_KEY` が設定されている場合は、OpenCode 自身もそれを送ります。

### プラグインを読み込む他の方法

| 形式 | `plugin` エントリ |
| :- | :- |
| インストールしたパッケージのファイル(`mom setup opencode` が書き込むもの) | `"/…/node_modules/mixture-of-models-claude-mod/integrations/opencode/plugin.js"` |
| パッケージのディレクトリ(OpenCode は `exports["./server"]` を読む) | `"/…/node_modules/mixture-of-models-claude-mod"` |
| `.opencode/plugin/`(1 つのプロジェクト)または `~/.config/opencode/plugin/`(すべてのプロジェクト)内のローカルファイル | `export { default } from '/…/integrations/opencode/plugin.js'` を含むファイル `mom.js` |
| JavaScript から | `import plugin from 'mixture-of-models-claude-mod/opencode'` |

オプションはタプルで渡します: `["…/plugin.js", { "critical": "claude-opus" }]`。

| オプション | デフォルト | |
| :- | :- | :- |
| `critical` | なし | critical な作業用の Palgu のモデル: mod のルール("use claude …"、"execute the plan"、セキュリティと判定のプロンプト)または 7 を超える分類器のスコア |
| `routes` | `{}` | `{ "simple": "…", "coding": "…", "critical": "…" }`: ティアごとの Palgu のモデル。モデルのないティアは `auto` に送られます |
| `ollama` | `true` | ローカルの Ollama(`localhost:11434`、4 秒)でプロンプトを分類します。ルートが設定されている場合にのみ使われます |
| `ollamaModel` | `qwen2.5-coder:3b` | |
| `provider` | `palgu` | プラグインがルーティングする、`opencode.json` 内のプロバイダー ID |

## 機能

| | 仕組み | OpenCode の機能 |
| :- | :- | :- |
| **ルーティング** | `palgu/auto` に送られた各プロンプトは `auto` として送信され、Palgu がティア(trivial、small、medium、think)を選びます。`/route <model>` はすべてのセッションを 1 つのモデルにピン留めし、`/route auto` はピンを外します。`critical` または `routes` が設定されている場合は、mod のルールと分類器がティアを選び、そのティアのモデルがピン留めされます。OpenCode であなた自身が選んだモデル(`auto` ではない `palgu/<model>`)はそのままにされます。モデルはユーザーメッセージに付き、`x-srooter-pin` は各リクエストに付きます。OpenCode 自身のタイトルと要約のリクエストがピン留めされることはありません。 | `chat.message`(`output.message.model`)、`chat.headers` |
| **Palgu メモリ** | プロジェクトフォルダーで `mom memory on` または `/palgu memory on` を実行すると、フォルダーのインデックスが作成されます(ソースが Palgu にアップロードされます)。その後、4 語以上のすべてのプロンプトについて、そこから最大 8 件のポインターが想起され、そのメッセージのシステムテキストに追加されます。メモリはデフォルトでオフです。同意はフォルダーごとで、`mom` が対応するすべてのツールと共有されます。 | `chat.message`(`output.message.system`) |
| **ハートビート** | タスクの途中で終わったターン("Let me check the tests next."(次にテストを確認します。))の後でセッションがアイドルになると、プラグインが continue のプロンプトを送ります。あなたのプロンプト 1 つにつき最大 3 回です。判断するのは Palgu です(`POST /anthropic/heartbeat`)。サインインしていない場合は、同じ分類器がローカルで動きます。`/palgu heartbeat off` でオフにします。サブエージェントのセッション、中断されたターン、失敗したターンが続行されることはありません。 | `event` `session.idle` → `client.session.promptAsync` |
| **インデックス作成** | メモリがオンのフォルダーでは、セッション開始時に `palgu memory index .` がバックグラウンドで、最大 10 分に 1 回実行されます。 | `event` `session.created` |
| **コマンド** | `/route [auto\|<model>\|<prefix>\|status]`、`/palgu memory on\|off\|status`、`/palgu heartbeat palgu\|local\|off`、`/palgu status`。プラグインがコマンドを自ら実行し、結果を TUI のトーストに表示します。その後モデルはその 1 行を繰り返すだけで、`auto` のもとで Palgu の最も安いティアが応答します。 | `config`(`command.route` と `command.palgu` を登録。同じ名前のあなたのコマンドがあればそちらが優先)、`command.execute.before`、`client.tui.showToast` |

どのフックも失敗時はオープン(fail open)です。何かが例外を投げたり Palgu が遅かったりしても、OpenCode はプラグインがないかのように続行します。メモリ検索は最大 3 秒、ハートビートは最大 8 秒待ちます。`MOM_DEBUG=1` を設定すると、判定とリクエストごとに 1 行の JSON が `~/.config/mixture-of-models/opencode.log` に書き込まれます: モデル ID、ピン、サイズ。キー、プロンプト、想起したテキストは書き込みません。

## 何をどこに送るか

- **`https://api.palgu.ai/anthropic/v1/messages` へ**(OpenCode 自身が、プロバイダー `palgu` について): あなたの OpenCode のターン。各リクエストには `x-srooter-client: mixture-of-models-opencode/<version>` と `x-srooter-project: <folder name>`、モデルがピン留めされている場合は `x-srooter-pin: <model>`、そしてキーが付きます。
- **`https://api.palgu.ai/v1/cortex/search` へ**(プラグインが、メモリがオンのフォルダーでのみ): 最大 300 文字の 1 行にしたプロンプトと、プロジェクトの Palgu 上の名前。
- **`https://api.palgu.ai/anthropic/heartbeat` へ**(プラグインが、ハートビートが `local` または `off` に設定されていない限り): 回答の最後の 600 文字とセッション ID。
- **`http://localhost:11434` へ**(`routes` または `critical` を設定し、Ollama が動いている場合のみ): 分類器のためのプロンプト。
- **ディスク上**: キーは `~/.config/mixture-of-models/credentials.json`(モード 0600)または `PALGU_API_KEY` にあります。ピンとメモリへの同意は、同じフォルダーの `state.json` に保存されます。

## Claude Code の mod との違い

- ルーティングは 1 つのプロバイダー、Palgu の中で完結します。ルーティングされたターンは、完全な履歴とツールを持つ同じ OpenCode セッションで実行され、子プロセスはありません。Claude のモデルには Palgu 経由でしか到達できません。
- `critical` や `routes` がない場合、モデルを選ぶのは mod の分類器ではなく Palgu 自身のティアで、`/route strategy` は存在しません。
- OpenCode のコマンドは必ずプロンプトで終わるため、`/route` と `/palgu` には短いモデルの返信 1 回分のコストがかかります。
- `opencode run` はセッションがアイドルになるとすぐに終了するため、そこではハートビートが続行する機会がありません。TUI と `opencode serve` のもとでは動作します。
