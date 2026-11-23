# mixture-of-models-claude-mod

[English](../../../README.md) · [简体中文](../zh-CN/README.md) · **日本語** · [Deutsch](../de/README.md) · [Français](../fr/README.md) · [العربية](../ar/README.md)

*これは翻訳です。正式な版は英語版であり、英語版のほうが新しい場合があります。*

[![ci][ci-badge]][ci] [![License: MIT][mit-badge]](../../../LICENSE) [![Changelog][log-badge]](../../../CHANGELOG.md)

[ci]: https://github.com/alinaqi/mixture-of-models-claude-mod/actions/workflows/ci.yml
[ci-badge]: https://github.com/alinaqi/mixture-of-models-claude-mod/actions/workflows/ci.yml/badge.svg
[mit-badge]: https://img.shields.io/badge/License-MIT-green.svg
[log-badge]: https://img.shields.io/badge/changelog-keep%20a%20changelog-blue

> **コーディングエージェントにセットアップさせますか?** エージェントに [INSTALL.md](INSTALL.md) を渡してください:「alinaqi/mixture-of-models-claude-mod の INSTALL.md に従って、Mixture of Models をセットアップして」。そこにはすべてのコマンド、各ステップの確認方法、ユーザーに尋ねるべきことが書かれています。Claude Code、Codex、Cursor、OpenCode、Antigravity、GitHub Copilot CLI、Aider、Continue、Goose で使えます。
>
> **インストール済みですか?** [GUIDELINES.md](GUIDELINES.md) に、エージェントごとのベストプラクティスがあります: モデルの選択はシステムに任せること、ルーティングとメモリがうまく働くプロンプトの書き方、何を委任するか、ルートがおかしく見えるときにどうするか。

Claude のサブスクリプションは、それが必要なターンのために取っておきましょう。残りはもっと安いモデルに任せます。これは Claude Code の **mod**(インプロセスのプラグインで、Claude Code 2.1.287 で新しく導入されたもの)です。すべてのプロンプトを影響範囲(blast radius)でスコア付けし、スコアの低いターンには、Anthropic 互換ゲートウェイ(GLM、Kimi、DeepSeek など、お使いのゲートウェイが提供するもの)上で動く別のヘッドレス Claude Code に回答させます。メインセッションの名前が変わったり、向き先が変わったり、手を加えられたりすることは一切ありません。[Maggy](https://github.com/alinaqi/maggy) のルーティングを移植したものです。

ルートには **モデルファミリー** を指定することもできます: `claude/sonnet` はその Claude メンバーをあなた自身の Claude ログインで実行し、`kimi/auto` はスコアに応じて Kimi のメンバーを選び、`codex` はターンを Palgu 上またはあなたの ChatGPT ログイン上の Codex CLI(`codex exec`)に渡します。[ファミリー](#ファミリー-メンバーを選ぶかティアに選ばせる) と [Codex](#子プロセスとしての-codex) を参照してください。

## Palgu のモデルをコマンド 1 つで使う

ダッシュボードもキーのコピーも不要です。[mod をインストール](#インストール)したら、Claude Code で次を実行します:

```
/palgu login
```

1. mod がサインイン用のリンクと短いコード(例: `WDJB-MJHT`)を表示します。
2. リンクを開き、Palgu にサインインするか **サインアップ** し(新規アカウントは無料プランから始まります)、コードが一致することを確認して **Allow** を押します。ページにはアプリ名が表示されます: *Allow Mixture of Models on "Claude Code on your-mac"?*(「Claude Code on your-mac」での Mixture of Models を許可しますか?)
3. ターミナルに戻ると、トーストに *Signed in to Palgu as you@example.com* と表示されます。これで完了です: simple と coding のターンは Palgu のモデル(GLM 5.3、Kimi K3.1、DeepSeek V4 Pro、Gemini 3.8 Flash、MiniMax M3、GPT-6)で動き、critical のターンは Claude に残ります。再起動は不要です。

| コマンド | 動作 |
| :- | :- |
| `/palgu login` | サインアップまたはサインインし、このコンピューターを接続する |
| `/palgu status` | 誰がサインインしているか、組織とそのプラン、今期の Palgu 予算のうちどれだけ使ったか |
| `/palgu upgrade` | プランと請求(有料プランは Web で購入します。キーは新しいプランを自動的に反映します) |
| `/palgu continue [--open]` | このセッションを完全なコンテキストのまま Palgu で続けます: `cd <folder> && palgu --continue-claude=<session id>` をコピーします。`--open` は新しい macOS ターミナルのタブで起動します。Palgu はトランスクリプトを自分で読み、認証情報を伏せます |

仕組み: Palgu のデバイスサインイン(`srooterctl` が使うのと同じもの)が、このコンピューター専用の API キーを発行します。キーは Palgu の **Devices** ページで確認・失効できます。mod はそれを `claude plugin configure --values-stdin` で Claude Code のセキュアストレージに保存するため、コマンドラインや設定ファイルに現れることはありません。すでにキーをお持ちの場合や、別のゲートウェイを使う場合は [セットアップ](#セットアップ) を参照してください。

正確に言うと、これは **ターン単位の委任** であり、リクエスト単位でモデルを混ぜるものではありません。ルーティングされたターンは、直近のコンテキストを短くまとめたブリーフを持つ子プロセスで実行され、子プロセスの回答はタグ付きでトランスクリプトに入ります。critical のターンはこれまでとまったく同じく Claude に残ります。

## インストール

mod には **Claude Code 2.1.287 以降** が必要です。Homebrew の安定版 cask はまだ 2.1.286 なので、まず確認してください:

```bash
claude --version
# 古すぎる場合は次のいずれか:
brew uninstall --cask claude-code && brew install --cask claude-code@latest   # Homebrew
npm install -g @anthropic-ai/claude-code@<version>                            # npm: 2.1.287 以降のバージョン
claude update                                                                 # ネイティブインストーラー
```

次に:

```bash
claude plugin marketplace add alinaqi/mixture-of-models-claude-mod
claude plugin install mixture-of-models@mixture-of-models-claude-mod
```

または、セッション内で `/plugin install mixture-of-models --marketplace alinaqi/mixture-of-models-claude-mod` を実行します。

> **あなたのフックはゲートウェイの子プロセスでは実行されません。** 子プロセスは `claude -p --bare` で動き、`--bare` は設定やプラグインのフックをすべてスキップします。そのため `.env` をブロックするフックがあっても子プロセスではそれを守らず、子プロセスが読んだものはゲートウェイのモデルに送られます。mod はこの点をフックに頼りません: すべての Claude の子プロセスには、`--bare` でも維持される Claude Code のパーミッション deny ルールが渡されます。対象は `.env` と `.env.*` ファイル、`*.pem`、`*.key`、`id_rsa*`、`id_ed25519*`、`secrets/` フォルダーです(Read ルールは Grep と Glob にも適用されます)。独自のルールは `router.child.deny` で追加できます(例: `["Read(**/credentials.json)"]`)。子プロセスに実行が許可されていないコマンドは、引き続き Allow / Deny ダイアログとしてあなたに届きます。Codex の子プロセスは読み取り専用ですが、これらのルールの対象外です: Codex にルーティングするプロジェクトにはシークレットを置かないでください。

**アップデート。** セッション開始時に mod は GitHub で新しいバージョンを確認し(最大 12 時間ごと)、あればトーストとバンドで一度だけ知らせます: `0.33.0 available: /route update`。`/route update` を実行すると新しいバージョンをインストールし、その後バンドに `0.33.0 installed: /reload-plugins` と表示されます。サードパーティのマーケットプレイスはデフォルトでは自動アップデートされません。`/plugin` → Marketplaces → `mixture-of-models-claude-mod` → Enable auto-update で一度有効にするか、`claude plugin marketplace update mixture-of-models-claude-mod && claude plugin update mixture-of-models@mixture-of-models-claude-mod` で手動で更新してください。新しいバージョンは `/reload-plugins`(または再起動)の後に有効になります。

**最速の始め方(Palgu):** `claude` を起動して `/palgu login` を実行します。リンクとコードが表示されるので、ブラウザーで承認します(初めての場合はそこでサインアップします)。すると mod が自分用の Palgu キーを保存し、その瞬間からルーティングを開始します。キーのコピーは不要です。`/palgu status` は誰がどのプランでサインインしているか、予算をどれだけ使ったかを示し、`/palgu upgrade` はプランと請求のページを開きます。

あるいは、子プロセス用のゲートウェイを自分で用意することもできます: [OpenRouter](#openrouter)、[LiteLLM](#litellm) プロキシ、またはお使いのモデル ID を提供する任意の Anthropic 互換エンドポイント([palgu](https://www.palgu.ai) でテスト済み。z.ai や Moonshot の Anthropic エンドポイントも同じように動きます)。[セットアップ](#セットアップ) を参照してください。`claude` を起動し、`/route` を実行します。ゲートウェイが設定されるまで、mod は観察のみ(observe-only)で、何も変更しません。

**設計ルール: メインセッションには一切手を加えない。** メインセッションは `ANTHROPIC_BASE_URL` なしで claude.ai のサブスクリプション上に残ります。プロンプトが GLM や Kimi にルーティングされると、mod は **別のヘッドレスな `claude -p` 子プロセス** を実行してそのターンに自ら回答します。ゲートウェイ(palgu)を向いているのはこの子プロセスの環境だけです。子プロセスの出力が、トランスクリプト上でそのターンの回答になります。メインプロセス、そのモデル、認証、リクエストは何も変わりません。

mod はプロンプトごとに次のことを行います:

1. 1 回の分類器呼び出しで 2 つの軸に沿って **スコア付け** します: 1-10 の影響範囲と、タスクの種別(`code | research | review | docs | data | multimodal`)です。スコアは Claude が必須かどうかを決め、種別は残りをどの安いモデルが受け持つかを決めます。ローカルの Ollama モデルが無料でこれを行い、フォールバックはあなたのプランの `claude-haiku-5-5`、その次は最後に見た判定です。[判定の仕組み](#判定の仕組み) を参照してください。
2. **まず Maggy の事前ルーティングルールを適用します**: `use claude` や `execute the plan` は `critical` を強制します。子プロセスが回答したターンの後のフォローアップはメインセッションに戻ります。メインセッションがタスクの途中のときの `go ahead`、`yes`、または 6 語以下のプロンプトは、メインセッションに残ります。coding レベルの作業は、タスク途中のメインセッションに残ります。
3. ルーティングされたターンを子プロセスに **委任** します: ゲートウェイ上の `claude -p --model glm-5.3` に、セッションの直近数回のやり取りとタスクを含むブリーフを stdin 経由で渡します。
4. 子プロセスが失敗した場合、何も出力しない場合、または回答が検査に通らない場合([子プロセスがしてはいけないこと](#子プロセスがしてはいけないこと) を参照)、そのターンはメインモデルに **フォールバック** し、その旨をトランスクリプトに表示します。
5. 毎ターン、**何がどこで実行されたかを表示** します。[表示される内容](#表示される内容) を参照してください。

`critical` のターンは子プロセスを起動しません。mod が存在しないかのように、メインセッションでサブスクリプション上で実行されます。

## 判定の仕組み

分類器に問うのは 1 つだけです: 誤った回答はどれだけの損害をもたらすか? 分類器は数値で答え、評価基準(ルーブリック)は明示されています:

| スコア | 意味 | ティア(デフォルトのしきい値) |
| :- | :- | :- |
| 1-2 | 調べもの、grep、シェルのワンライナー、構文の質問、ログの読み取り、git status や diff | `simple` |
| 3-4 | 単一ファイルの編集、テスト、ドキュメント、設定変更、小さなバグ修正、スキャフォールディング | 3 は `simple`、4 は `coding` |
| 5-6 | 複数ファイルにまたがる機能、サービスやツールの連携、インテグレーション、既知のパターンに沿ったデプロイ | `coding` |
| 7-8 | 複数サービスにまたがるデバッグ、データ移行、パフォーマンス改善、元に戻しにくい変更 | 7 は `coding`、8 は `critical` |
| 9-10 | セキュリティや認証の設計、アーキテクチャの決定、本番障害、取り返しのつかないもの全般 | `critical` |

プロンプトは分類器に、長さ、名前の挙がったサービスの数、貼り付けられた API キーはそれ自体ではスコアを上げないと伝えます。以前はこれらが原因で、普通のインテグレーション作業がメインセッションに押し上げられていました。また、深い推論(証明を伴うアルゴリズム、並行処理、パフォーマンスチューニング、暗号)は影響範囲にかかわらず 7 以上になるとも伝えるため、難しいが安全な作業は Claude に残ります。区切りは `router.thresholds` で動かせます。たとえば `{ "simple": 3, "coding": 8 }` にすると、9-10 以外はすべて Claude から外れます。

**種別がモデルを選びます。** `critical` 未満では、`routes.kinds` がタスクの種別をモデルに対応付けます: デフォルトでは `research` と `review` は DeepSeek V4 Pro(Palgu 上の `deepseek-pro`、1M トークンのコンテキスト)に送られ、`multimodal` は Claude に残り、それ以外はすべてティアのモデル(GLM)が受け持ちます。0.20.0 までは Kimi に送られていましたが、現在 Palgu は Kimi に応答しません(約 2 分後に空の応答が返ります)。ゲートウェイが許す範囲で、`"docs": "gpt-6-sol"` や `"data": "..."` をマトリクスに追加してください。

**指定できるモデル。** ゲートウェイが提供するモデル ID なら何でも、`routes`、`routes.kinds`、ピンで使えます。mod は次の Palgu ゲートウェイのモデルを知っているので、どのルートにも名前がなくても `/route <prefix>` がこれらに展開されます: `glm-5.3`、`kimi-k3.1-pro`、`kimi-k3.1-pro-highspeed`、`deepseek-v4-pro`、`gemini-3.8-flash`、`minimax-m3`、`minimax-m2.5`、`gpt-6-sol`、`gpt-6-luna`、`gpt-6-astra`、`mercury-3`。プロンプトの上のバンドには、これらのファミリーごとにボタンがあります。`kimi-k3.1-pro` は `kimi-k3` を置き換えるもので、古い `/route kimi-k3` のピンはこれに展開されます。Gemini、MiniMax、GPT-6 は選択肢であってデフォルトではありません: `/route minimax`、`/route gpt`(GPT-6 Sol)、`/route gpt/auto`(simple のターンには Luna、coding には Sol、critical には Astra)でピン留めします。Inception の Mercury 3 もピン専用です: `/route mercury`(Palgu では `mercury-3`、OpenRouter では `mercury/3`)。

**どの Palgu モデルが動くか。** 2026-10-29 に、mod がターンを実行するのと同じ方法(ピン留めした `claude -p --bare` の子プロセスで、ツール呼び出しを伴う短い調査タスクを実行)でテストしました: `glm-5.3`、`deepseek-pro`、`gemini-3.8-flash`、`minimax-m3`、`gpt-6-sol`、`gpt-6-luna`、`gpt-6-astra`、`kimi-k3.1-pro`、`kimi-k3.1-pro-highspeed`、`mercury-3` は 19 〜 46 秒で成功しました。`minimax-m2.5` は拒否されたコマンドを再試行し続け、ターン数を使い切りました。Kimi の以前の失敗は Moonshot の過負荷(`429 engine_overloaded`)によるものでした: Claude Code が各リクエストを 10 回再試行していたため、ターンが失敗するまでに約 2 〜 3 分かかっていました。現在、子プロセスの再試行は最大 2 回(`router.child.maxRetries`、デフォルト 2)なので、混雑しているプロバイダーからは数秒でフォールバックします。research と review はデフォルトで DeepSeek に残り、Kimi はピンで使います。子プロセスは Palgu に常に `x-srooter-pin: <model>` を送ります: これがないと Palgu は意図(intent)に基づいてルーティングし、別のモデルで回答することがあります(ピンなしでは、すべてのモデルが Gemini として提供されました)。

**子プロセスが失敗したとき。** ルーティングされたターンをメインモデルが引き受けるのは、同等のモデルがすべて失敗した後だけです。Palgu では子プロセスが `x-palgu-fallback: auto` を送るので、過負荷のときゲートウェイはまずピン留めしたモデル自身のフォールバックチェーン(そのフォールバックリスト、次に同じクラス)をたどります。それでも子プロセスが過負荷(429、5xx、タイムアウト、回答なし)で失敗した場合、mod は次の同等モデルでターンを再実行します: まず同じクラスのモデル(Palgu のライブリストから)、次にその他の正常なモデルを、最大 `router.child.fallbacks` 個(デフォルト 3)まで。モデルにとって長すぎるプロンプトは、より大きなコンテキストウィンドウのモデル(`router.child.longContext`)にだけ移ります。不正なリクエスト(400、401、403、404、422)は他のモデルで再試行しません。ルート行が何が起きたかを示します: `child: deepseek-pro failed (429) → served by glm-5.3`、または `all equivalents failed: deepseek-pro (429), glm-5.3 (529), …; main model answered`。 Palgu 自身のフォールバックチェーンが別のモデルで応答した場合、その行は `child: kimi-k3.1-pro → served by deepseek-pro (gateway fallback)` となり、ターンはそのモデルとして集計・価格計算されます。 mod が破棄した子の回答(諦めた、意図を述べただけ、あなたに操作を求めた など: 下記「子がしてはいけないこと」)も同じように順に試されます。`HANDBACK` とあなたに操作を求める回答は除きます。

### ルーティング戦略: 複雑さ、コスト、速度、品質、または独自のルールでルーティングする

分類器が何をスコア付けするか、ティアをどこで分けるか、各ティアがどのモデルを使うかが **ルーティング戦略** です。スキルと同じように、ルーブリックを書いた 1 つの markdown ファイルです。4 つが組み込まれています:

| 戦略 | スコアの対象 | ティア(simple / coding) | 送り先 |
| :- | :- | :- | :- |
| `complexity`(デフォルト) | 影響範囲(上記のとおり) | 3 / 7 | あなたのルート: GLM、research と review には DeepSeek、critical には Claude |
| `cost` | 安いモデルが誤るリスク。迷ったら低めに | 4 / 8 | GLM、coding・research・review には DeepSeek V4 Pro、画像には Gemini、critical には Claude |
| `speed` | 推論の深さ | 3 / 7 | Gemini 3.8 Flash、coding には GPT-6 Sol、critical には Opus ではなく Sonnet |
| `quality` | 重大さ。迷ったら高めに | 2 / 5 | 調べものだけ GLM、coding には Sonnet、critical には Claude |

`/route strategies` は組み込みの戦略とあなたの戦略を一覧表示し、`/route strategy cost` で切り替えます(セッションをまたいで記憶されます。`model-config.json` の `router.strategy` でデフォルトを設定できます)。するとバンドには `auto (cost)` と表示されます。

**独自の戦略。** `~/.claude/mixture-of-models/strategies/<name>.md` にファイルを置くか、Claude にプラグインの **routing-strategy** スキルを使うよう頼んでください。このスキルは何を最適化したいかを尋ね、ファイルを書いてくれます:

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

`thresholds` と `routes` は 1 行の JSON で、省略可能です(省略すると設定ファイルの値が適用されます)。本文は分類器が読むルーブリックです。回答の形式は "<score> <kind>" のままなので、ティア、ファミリー、失敗の記憶、節約額は同じように機能します。上記の安全ルールはどの戦略でも最初に適用されます: セキュリティ関連の作業、通知、セッションコマンドは Claude に残ります。パースできないファイルはスキップされ、ログにその名前が記録されます。`/route strategy <name>` はフォルダーを読み直すので、新しいファイルは再起動なしで反映されます。

### ファミリー: メンバーを選ぶか、ティアに選ばせる

どのルート、種別ルート、ピンも、モデル ID の代わりに `<family>/<member>` または `<family>/auto` にできます。単なる `claude` は従来どおり「メインセッション」を意味するので、古い設定も同じように動作します。

| ファミリー | メンバー(エイリアス = 正確な ID) | ティアごとの `auto`(デフォルト) | 実行場所 |
| :- | :- | :- | :- |
| `claude` | `fable` = `claude-fable-5-1`、`opus` = `claude-opus-5-5`、`sonnet` = `claude-sonnet-5-5`、`haiku` = `claude-haiku-5-5` | simple → `haiku`、coding → `sonnet`、critical → `opus`。`fable` は `"criticalPlus": "fable"` を追加した場合のみ(10/10 の critical ターン) | **あなたの Claude ログイン** 上のヘッドレスな `claude -p --model <id>` 子プロセス(ゲートウェイなし)。セッションのモデルそのものであるメンバーはメインセッションに残ります |
| `kimi` | `pro` = `kimi-k3.1-pro`、`highspeed` = `kimi-k3.1-pro-highspeed` | simple → `highspeed`、coding と critical → `pro` | ゲートウェイの子プロセス |
| `glm`、`deepseek`、`gemini`、`minimax` | ゲートウェイのカタログから: `glm/5.3` = `glm-5.3`、`deepseek/v4-pro` = `deepseek-v4-pro`、`gemini/3.8-flash`、`minimax/m3` = `minimax-m3`、`minimax/m2.5` | 最初のメンバー | ゲートウェイの子プロセス |
| `gpt` | `sol` = `gpt-6-sol`、`luna` = `gpt-6-luna`、`astra` = `gpt-6-astra` | simple → `luna`、coding → `sol`、critical → `astra` | ゲートウェイの子プロセス |
| `codex` | デフォルトではなし: `codex/<any model id>` はその ID を Codex に渡します | デフォルトではなし: Codex 自身のデフォルトモデル | `codex exec` の子プロセス。[Codex](#子プロセスとしての-codex) を参照 |

`auto` はティアと同じ分類器、しきい値、境界スコアの 2 回目のサンプリング、失敗の記憶を使い、そのうえでファミリーの `auto` マップからティアを引きます。ファミリーの外に出ることはありません。Claude ファミリーのティア(`"critical": "claude/opus"`)は `"claude"` とまったく同じく Claude 必須です: `routes.kinds` はこれを上書きしません。メンバーやティアのマップは `router.families` でファミリーごとに上書きできます。`/route claude/auto` をピン留めしても、各プロンプトは引き続き分類され、スコアからメンバーが選ばれます。

Claude のメンバーに、セッション自身の `/model` ではなく子プロセスを使う理由: メインセッションは名前を変えたり向き先を変えたりしない([ADR 0001](../../adr/0001-child-process-delegation.md))ので、セッションのモデル以外のメンバーは、Claude Code 自身の `--model <id>` フラグで起動した別のヘッドレス Claude Code で実行されます。その子プロセスは `--bare`(API キー認証を強制してしまう)なしで実行されるため、あなたの claude.ai ログインを使い、あなたのフックとプラグインを読み込みます。mod は `MAGGY_ROUTER_CHILD` によって子プロセス内では無効のままです。子プロセスの環境は、継承した `ANTHROPIC_BASE_URL` をクリアします。シェルで export した `ANTHROPIC_API_KEY` は、メインセッションと同様に子プロセスでもログインより優先されます。[ADR 0002](../../adr/0002-model-families-and-codex-child.md) を参照してください。

### 子プロセスとしての Codex

`codex`、`codex/<model>`、`codex/auto` のルート、および `/route codex` は、非対話モードの Codex CLI でターンに回答します:

```
codex exec --json -C <session cwd> [-m <model>] [Palgu provider flags] --sandbox read-only -c approval_policy="never" -
```

stdin には同じブリーフが渡され、`child.timeoutMs`、検査、失敗の記憶、ルート行、出所タグも Claude の子プロセスと同じです。`router.codex.auth` で使うアカウントを選びます:

- `"palgu"`(デフォルト): Codex はゲートウェイの Responses エンドポイント `/v1/responses` と通信します。OpenRouter と LiteLLM では、プロバイダー名は `openrouter` または `litellm`、ベース URL は `<gateway_url>/v1`(`https://openrouter.ai/api/v1`、`http://localhost:4000/v1`。LiteLLM の `/anthropic` URL は先にそのサフィックスを取り除きます)で、キーは `OPENROUTER_API_KEY` または `LITELLM_API_KEY` に入ります。これは [OpenRouter](https://openrouter.ai/docs/cookbook/coding-agents/codex-cli.md) と [LiteLLM](https://docs.litellm.ai/docs/proxy/client_setup/codex_cli.md) の Codex ガイドに従ったものです。これらのゲートウェイではモデルを指定してください: OpenRouter では完全なスラッグ(`/route codex/openai/gpt-5.6-terra`)、LiteLLM ではあなたの `model_name` のいずれかが必要です。Codex 自身のデフォルトのモデル ID はそのどちらでもありません。Palgu では、[Palgu の Codex ドキュメント](https://www.palgu.ai) の説明どおり、mod が `-c model_provider="palgu"`、`-c model_providers.palgu.base_url="<gateway>/v1"`、`-c model_providers.palgu.wire_api="responses"`、`-c model_providers.palgu.env_key="PALGU_API_KEY"` で明示的な `palgu` プロバイダーを追加します(ChatGPT ログインでは Codex は `OPENAI_BASE_URL` を無視するため、プロバイダーを明示する必要があります)。ベース URL は、`gateway_url` の `/anthropic` を `/v1` に置き換えたもの、または `router.codex.baseUrl` です。ゲートウェイのキーは `PALGU_API_KEY` として子プロセスの環境にだけ渡され、コマンドラインに載ることも出力されることもありません。Claude のゲートウェイ子プロセスと同様に、ゲートウェイの URL とキーが必要です。
- `"chatgpt"`: プロバイダーフラグもキーもなし。Codex はあなた自身の `codex login` と `~/.codex/config.toml` を使います。mod が `~/.codex` を読み書きすることはありません。

#### サンドボックスと承認

`codex exec` は誰にも何も尋ねられません: 非対話モードの Codex は承認ポリシー Never で動作する(Codex 0.163 は `approval_policy = "untrusted"` をそもそも拒否します)ため、サンドボックスが許可するコマンドは確認なしで実行され、許可しないコマンドは拒否されます。したがってサンドボックスが唯一の関門であり、mod はそれを狭く保ちます:

- **`router.codex.sandbox`** はデフォルトで `"read-only"` です: Codex はプロジェクトを読み、読み取りだけのコマンドを実行できますが、ファイルの編集やネットワークの利用はできません。これは Claude の子プロセス(`acceptEdits`)より狭い設定です。`codex exec` には、コマンドを制限しつつ編集だけを通す方法がないためです。`-c approval_policy="never"` を明示的に渡すので、サンドボックスの外への昇格要求は実行されず、拒否されます。
- **自己責任でのオプトアウト:** `"workspace-write"` は、Codex がプロジェクト内のファイルを編集し、**そこで任意のコマンドをあなたに尋ねずに実行する** ことを許可します(ネットワークはオフのまま: `-c sandbox_workspace_write.network_access=false`)。`"danger-full-access"` はサンドボックスを完全に取り除きます。使い捨てで、外部からサンドボックス化された環境でのみ使ってください。それ以外の値は read-only を意味します。
- **`router.codex.allowOutsideGit`**(デフォルト `false`)は `--skip-git-repo-check` を追加します。これがないと Codex は git リポジトリの外では起動を拒否し、ルート行に `child answer discarded (outside a git repo; set router.codex.allowOutsideGit)` と表示され、メインモデルが回答します。
- **`router.codex.args`** はフラグを追加します(例: `-c model_reasoning_effort="high"`)が、サンドボックスや承認に関するものは追加しません: `--sandbox`/`-s`、`--dangerously-bypass-approvals-and-sandbox`、`--approve-for-me`、`--full-auto`、`--add-dir`、`--skip-git-repo-check`、`-a`/`--ask-for-approval`、および `-c approval_policy=…`/`sandbox_mode=…`/`sandbox_workspace_write.…`/`sandbox_permissions=…` は取り除かれ、無視されたものはセッションログに記録されます。そこに `--ephemeral` を入れると、下記の再開も無効になります。

**拒否されたコマンド。** `codex exec --json` は、サンドボックスがブロックしたコマンドも、拒否した昇格も報告しません: どちらもイベントとして現れません(Codex 0.163.0 で確認)。そこでブリーフは Codex に、サンドボックスがブロックしたコマンドごとに `NEEDS-APPROVAL: <exact command>` で回答を終えるよう指示し、mod は拒否された昇格について Codex が stderr に書く `reject command` の行も数えます。そのうえで、Claude の子プロセスと同様に:

- read-only のデフォルトでは、mod は同じダイアログで、コマンドと承認によって何が許可されるかを示してあなたに尋ねます: *"Codex child on codex/default was refused by its read-only sandbox: touch made.txt. Allow and continue resumes it for this turn with permission to edit files in the project and run commands there (no network)."*(codex/default の Codex 子プロセスが read-only サンドボックスに拒否されました: touch made.txt。Allow and continue を選ぶと、このターンについて、プロジェクト内のファイル編集とコマンド実行(ネットワークなし)の許可付きで再開します。)**Allow and continue** を選ぶと、承認されたコマンドを示すメッセージとともに同じスレッドが再開されます(`codex exec -C <cwd> resume --json … -c sandbox_mode="workspace-write" -c approval_policy="never" -c sandbox_workspace_write.network_access=false <thread> -`)。これは指定したコマンドだけでなく、そのターンの残り全体でサンドボックスを広げます。質問文がそう明記しているのはそのためです。質問は 1 ターンにつき最大 1 回です(`child.relayRounds: 0` で無効にできます)。
- **Deny** を選んだ場合、誰も答えられない場合、またはサンドボックスがすでに read-only より広い場合は、何も広げられず、拒否が黙って起きることはありません: 回答は拒否されたコマンドを示す行で終わり(*Codex's sandbox refused, and nothing ran: `touch made.txt`.*(Codex のサンドボックスが拒否したため、何も実行されませんでした))、ルート行には `· sandbox read-only · refused: touch made.txt`(Codex が名前を挙げなかった昇格については `refused: 2 unnamed`)と表示されます。
- 拒否の報告は Codex 自身の回答から来るため、指示を無視するモデルでは、拒否が名前のないまま残ることがあります。ルート行には常にそのターンが実行されたサンドボックス(`sandbox read-only` または `sandbox workspace-write (approved)`)が表示されるので、書き込めなかったターンはそうとわかります。

`codex` が `PATH` にない場合、mod は `codex is not installed: npm install -g @openai/codex (or brew install --cask codex) …` と表示し、ルート行には `child answer discarded (codex not installed)` と表示され、メインモデルが回答します。

**境界のスコアにはセカンドオピニオン。** coding の区切りちょうど、またはその 1 つ上のスコアは 2 回目のサンプリングを行い、高いほうを採用します。そのため 7 か 8 のデバッグタスクが、分類器のぶれでティアを行き来することはありません。

**失敗を記憶します。** ある種別で子プロセスが 2 回失敗するごとに、その種別の coding の区切りを 1 下げます(`simple + 1` を下回ることはありません)。そのため、安いモデルが失敗し続ける作業は Claude に戻っていきます。`/route reset` でこの記憶をクリアします。

**作業の流れを守ります。** 子プロセスはブリーフ以外の記憶を持たないので、mod はフォローアップを子プロセスに送りません。子プロセスが回答したターンの後の `continue`、`yes`、または 6 語以下のプロンプトは、トランスクリプト全体を持つメインセッションに戻ります。また、メインセッションがタスクの途中(直前の回答でツールを使った)である間は、coding レベルの作業はメインセッションに留まります(ルート行の `via mid-task guard`)。外に出るのは調べものと、新しい自己完結したタスクだけです。これらのルールがないと、タスクをルーティングしたセッションは「continue」のたびにそのタスクをやり直してしまいます。

**一部のターンはメインセッションから決して出ません。** スコアや `/route` のピンにかかわらずです。子プロセスは会話、チームメイト、バックグラウンドタスク、セッションのツールを見られないからです(ルート行の `via notification`、`via session command`、`via security or verdict`):

- 通知: `<teammate-message …>`、`idle_notification` JSON、`<task-notification>`、`[SYSTEM NOTIFICATION …]`
- セッションの状態やツールに関する短いオペレーターコマンド(12 語以下): `approve git pull --ff-only`、`continue`、`resume`、`merge it`、`check the sub agents`、`what's the status`、PR、ブランチ、CI、ワークフロー、サブエージェントに言及するもの全般
- セキュリティと判定(verdict)のターン(`security`、`vulnerability`、`CVE`、`verdict` など)

### 子プロセスがしてはいけないこと

すべてのブリーフは前置きから始まります: 子プロセスはメインセッションにアクセスできないこと、ステータス、ID、PR 番号、実行結果、ファイルの変更を決してでっち上げないこと、あなたに承認や実行を決して求めないこと、タスクにセッションの状態やツールが必要なときは `HANDBACK` と返すこと。mod は回答を検査し、次の場合は回答を破棄して、メインモデル自身にそのターンを実行させます:

| 回答 | 例 |
| :- | :- |
| `HANDBACK` で始まる | `HANDBACK` / `needs the PR list` |
| 謝って諦める、または作業をあなたに戻す | "I'm sorry, but I don't have permission…"、"could you please review the repository? Once that's done, we can continue" |
| 答える代わりに、あなたのことを他の誰かに話している | "The user can type \"continue\" or give the next instruction" |
| ブロックされていると言う、またはあなたに行動を求める | "blocked by the permission system"(パーミッションシステムにブロックされた)、"you must approve it in the UI"(UI で承認する必要がある)、"run `gh pr create` yourself"(`gh pr create` を自分で実行して) |
| ツール呼び出しなし(`num_turns` 1)で、行動やセッションの事実を主張する | "I added X"(X を追加した)、"PR #812 is open"(PR #812 はオープン)、"14 commits behind"(14 コミット遅れている)、"no build runs exist"(ビルドの実行は存在しない) |
| ほとんどが意図の説明である | "I'll read the config. Then I will update the router."(設定を読みます。次にルーターを更新します。) |
| すでに出した回答を繰り返す | アイドル通知のたびに再投稿される同じ判定 |

破棄された回答はその種別の子プロセスの失敗として数えられ、ルート行に `child answer discarded (<reason>), main model answered` と表示されます。メインモデルに子プロセスのテキストを中継させることはありません: mod は検査済みの子プロセスの回答でターンに答えるか、ターンをメインモデルに任せるかのどちらかです。

破棄された回答は、過負荷のときと同じく(上記)まず次の同等モデルで試され、ルート行には `child: glm-5.3 failed (gave up) → served by deepseek-pro` と表示されます。例外は 2 つです: `HANDBACK`(子がメインセッションを求めた)と、あなたに操作を求める回答(どのモデルも同じ制限に当たる)です。これらはメインモデルがすぐに引き受けます。

すべてのルート行とバンドにはスコアと種別が表示されるので、判定がおかしく見えるときは、その背後の数値を確認できます。

## 表示される内容

Claude とゲートウェイの両方が、常に見える状態です:

| 表示箇所 | メインセッションのターン | ルーティングされたターン |
| :- | :- | :- |
| プロンプトの上のバンド | `mixture-of-models · auto · last: claude-opus-5 · critical 9/10`<br>`0: help  1: auto  2: glm  3: deepseek  …  9: claude  off` | 実行中は `… · running glm-5.3 in a child…` |
| スピナー | `Thinking…` | `Thinking · via glm-5.3 (child)…` |
| 質問ダイアログ | Claude 自身の質問 | `Child on glm-5.3 wants to run: Bash(git pull --ff-only)` と、Allow and continue / Deny |
| トランスクリプト内の返信 | 変化なし(`ui.tags: "all"` では `⇢ claude-opus-5 · main session` のタグ付き) | 返信の上に薄い `⇢ glm-5.3 · child on gateway` の行が付き、スクロールバックに残ります(Claude のメンバーなら `· child on your Claude subscription`、Codex なら `· Codex child`) |
| 回答の下の行 | `route: claude-opus-5 · main session · critical 9/10 via claude-haiku-5-5 · 23.1k in / 0.9k out · cache 91% · today: 8 turns, 5 off Claude (63%)` | `route: glm-5.3 · coding 6/10 via ollama · child 42s · saved ~$0.39 · today: …` |
| `/route` | `mixture-of-models live · mode auto · current route: … · today: … · saved ~$12.40 (61%) vs all claude-opus-5-5, at API prices` | 同じ |
| `/palgu login` | `Open https://www.palgu.ai/connect?code=WDJB-MJHT and approve code WDJB-MJHT …`、続いてトースト `Signed in to Palgu as you@acme.com (Acme, plan starter). Routed turns now run on Palgu.` | 同じ |
| `/route stats` | 「Mixture of models」というペインで、ホットキー 1-4 の 4 つのタブがあります: **models**(モデルごとのバー、ターンの割合、見出しの "N of M turns off Claude"(M ターン中 N ターンが Claude 以外)、そして緑色でルーティングによる節約額)、**kinds**(各種別と、それをどのモデルが受け持ったか)、**scores**(ティアで色分けされた 1-10 のヒストグラムと区切りの表示)、**recent**(スコア、種別、モデル、子プロセスの時間を含む直近の判定)。Esc で閉じます。 | 同じ |

### どれだけ節約できるか

ルーティングされたターンはすべて 2 通りに値付けされます: セッションの Claude モデルでの価格(同じトークンがそこでいくらかかったか)と、実際にかかった価格です。Palgu では、実際のコストは Palgu 自身の `/v1/pricing/quote`、つまり Palgu が請求に使う計算式から得られます。他のゲートウェイでは `router.prices` から、`claude/<member>` の子プロセスはそのメンバーの Claude の料金で値付けします。メインセッションに残ったターンも Claude のみの合計に数えるため、パーセンテージはルーティングされたターンだけでなく、Claude の請求全体のうちルーティングで削減できた割合です。

- ルーティングされた各回答の下: `· saved ~$0.39`
- `/route status`: `saved ~$12.40 (61%) vs all claude-opus-5-5, at API prices`。セッションをまたいだ累計です。
- `/route stats`: 同じ累計が models タブに緑色で表示されます。

私たち自身の利用では、24 時間稼働するコーディングエージェントが、Claude だけでは Claude Max 20x サブスクリプションの週間上限を約 3 日で使い切っていました。Mixture of Models を使うと、同じサブスクリプションが 7 日間丸ごと持ちました。[GUIDELINES.md](GUIDELINES.md#おおよその節約効果-サブスクリプションのみ-vs-mixture-of-models) を参照してください。

これは推定値であり、そう明示しています。Claude の価格は API の定価です(Opus 5.5 は入力 / 出力 100 万トークンあたり $4 / $20、Sonnet 5.5 は $2 / $10、Haiku 5.5 は $0.10 / $0.50、Fable 5.1 は $10 / $50。キャッシュ読み取り、5 分および 1 時間のキャッシュ書き込みはそれぞれの料金)。そのため claude.ai のサブスクリプションでは、これは API 換算の節約額であり、お金が戻ってくるわけではありません。ルーティングされたターンが Claude でも同じトークン数を使ったと仮定しています。mod が値付けできないルーティングされたターン(そのモデルの `router.prices` エントリがないゲートウェイ、または Codex の子プロセス)は節約額を計上せず、`/route status` は値付けなしとして数えます。

バンドのボタンには数字のホットキーがあります: プロンプトが空の状態で `3` を入力して少し待つと Kimi をピン留めし、`1` で auto に戻り、`0` でヘルプを開きます。ヘルプは、mod が何をするか、現在の状態(モード、ゲートウェイ、節約額)、各ボタンとコマンドの働き、Palgu、OpenRouter、LiteLLM への接続方法を説明するペインです。`/route help` でも開けます。バンドは `"ui": { "band": false }` で非表示にできます。

## 他のコーディングエージェント

mod は Claude Code の中で動きます。他のエージェント向けには、`mom` CLI とツールごとの薄いアダプターが同じ要素を提供します: Palgu がリクエストごとにモデルを選び、Palgu メモリが各プロンプトに想起され、タスクの途中で止まったターンは続行されます([ADR 0005](../../adr/0005-other-coding-agents.md))。

```bash
npm install -g github:alinaqi/mixture-of-models-claude-mod   # `mom` と各エージェントのプラグインファイルをインストール
mom login                                                     # ブラウザーで Palgu にサインイン
```

次に、お使いのエージェントに合わせて:

```bash
# Codex
mom setup codex --write && codex plugin marketplace add alinaqi/mixture-of-models-claude-mod && codex plugin add mixture-of-models@mixture-of-models
codex -p palgu

# Cursor(プロジェクトフォルダーで実行し、その後 Developer: Reload Window)
mom setup cursor --write

# OpenCode
mom setup opencode --write

# Antigravity
agy plugin install "$(npm root -g)/mixture-of-models-claude-mod/integrations/antigravity"

# GitHub Copilot CLI
copilot plugin install alinaqi/mixture-of-models-claude-mod:integrations/copilot
```

任意で、プロジェクトごとにソースを Palgu にアップロードします: `mom memory on`。確認方法とトラブルシューティングを含むすべてのコマンド: [INSTALL.md](INSTALL.md)。各エージェントを最大限に活用する方法: [GUIDELINES.md](GUIDELINES.md)。

| エージェント | 状態 | ガイド |
| :- | :- | :- |
| Codex(CLI、0.163+) | プラグイン: メモリの想起、ハートビート、インデックス作成。`codex -p palgu` で Palgu 経由でルーティング | [integrations/codex](integrations/codex/README.md) |
| Cursor | プラグイン(または `mom setup cursor`): Palgu メモリ検索と Palgu モデルへの委任のための MCP サーバー(`mom mcp`)、フックによるハートビートとインデックス作成、いつ委任するかのルール。ターンごとのルーティングはなし: Cursor のフックはモデルを変更できません | [integrations/cursor](integrations/cursor/README.md) |
| OpenCode(1.19+) | 完全な機能互換のプラグイン: リクエストごとの Palgu モデル(auto、`/route` のピン、またはティアのルート)、メモリの想起、ハートビート、インデックス作成、`/route` と `/palgu`。`mom setup opencode --write` がプロバイダーを追加 | [integrations/opencode](integrations/opencode/README.md) |
| Antigravity(`agy` 1.0.7+) | プラグイン: 各ターンの最初のモデル呼び出しへのメモリの想起、ハートビート、インデックス作成、MCP 経由の Palgu ツール(ルーティングするサブタスク用の `palgu_delegate`)。フックはモデルを変更できません | [integrations/antigravity](integrations/antigravity/README.md) |
| GitHub Copilot CLI(1.0.112+) | プラグイン: ハートビート、インデックス作成、MCP 経由の Palgu ツール(メモリ検索、`palgu_delegate`)、それらをいつ使うかのスキル。フックはモデルの変更もプロンプトへの追加もできません | [integrations/copilot](integrations/copilot/README.md) |
| Aider、Continue、Goose | Palgu がルーティング(`model: auto`)。フックがないため、メモリの想起やハートビートはなし。Aider は実機で確認済み | [integrations/gateway](integrations/gateway/README.md) |

Palgu メモリへの同意(`mom memory on`)はプロジェクトフォルダーごとで、`mom` を使うすべてのエージェントで共有されます。これは mod の `/palgu memory on` とは別のものです。

## 要件

- Claude Code **v2.1.287 以降**(`claude --version`)。それより古いビルドでは mod は読み込まれません。`claude update` を実行してください。
- 子プロセスが使えるゲートウェイとそのキー: Palgu の Anthropic エンドポイント、OpenRouter、LiteLLM プロキシ、または `routes` のモデル ID を提供する任意の Anthropic 互換エンドポイント。
- 任意: 無料で分類するための、小さなモデルを入れた Ollama(`ollama pull qwen2.5-coder:3b`)。ない場合、分類器はあなたのプランの Haiku にフォールバックします。

## セットアップ

完全な手順は [GETTING_STARTED.md](GETTING_STARTED.md) を参照するか、`./install.sh` を使ってください。

1. 子プロセスにゲートウェイを与えます。Palgu では `/palgu login` がこのステップ全体を行います: Palgu のデバイスサインイン(`srooterctl` が使うのと同じもの)を使い、Palgu がこのコンピューター用のキー(Devices ページで失効できます)を発行し、mod が URL とキーを `claude plugin configure --values-stdin` で保存します。それ以外の場合、プラグインは 2 つの値を尋ね、キーはマスクされて Claude Code のセキュアストレージに保存され、設定ファイルには決して書かれません:

   ```
   /plugin configure mixture-of-models@mixture-of-models-claude-mod
   ```

   またはシェルから: `claude plugin configure mixture-of-models@mixture-of-models-claude-mod --values-stdin` を実行し、入力に `{"gateway_url":"https://api.palgu.ai/anthropic","gateway_key":"<your key>"}` を入力して Ctrl-D を押します。こうするとキーがシェルの履歴やプロセス一覧に残りません。

2. 必要に応じて、`~/.claude/model-config.json` でルート、しきい値、子プロセスを調整します。リポジトリの `config.example.json` が完全な出発点です(下にも示します)。

3. `claude` を起動し、`/route` を実行します。

ゲートウェイの URL とキーがそろうまで、mod は **観察のみ(observe-only)** です: 分類は行い、`/route` は何をするかを表示しますが、子プロセスは起動しません。

3 つ目のオプション `gateway_provider` は、ゲートウェイの種類を示します: `auto`(デフォルト。空の場合も同じ)は URL から Palgu(`*.palgu.ai`)と OpenRouter(`openrouter.ai`)を検出し、それ以外のホストは 0.16 以前とまったく同じく汎用の Anthropic 互換ゲートウェイとして扱います。`palgu`、`openrouter`、`litellm`、`anthropic-compatible` は種類を直接指定します。プロバイダーは、子プロセスがキーをどう送るか、デフォルトのルートとバンドがどのモデル ID を使うかを決めます:

| プロバイダー | 子プロセスの認証 | デフォルトのモデル ID | `x-srooter-*` ヘッダー |
| :- | :- | :- | :- |
| `palgu` | `ANTHROPIC_API_KEY`(`x-api-key`) | Palgu のもの: `glm-5.3`、`deepseek-pro`、… | あり |
| `openrouter` | `ANTHROPIC_AUTH_TOKEN`(`Authorization: Bearer`) | ファミリーの背後にある OpenRouter のスラッグ: `glm/5.3` → `z-ai/glm-5.3`、… | なし |
| `litellm` | `ANTHROPIC_AUTH_TOKEN`(`Authorization: Bearer`) | Palgu の名前。実際にはプロキシの `model_name` が決めます | なし |
| `anthropic-compatible` | `ANTHROPIC_API_KEY`(`x-api-key`) | Palgu のもの | あり |

キーをどちらの変数で渡す場合でも、子プロセスの環境ではもう一方を空に設定します。子プロセスはあなたのシェルを継承し、両方が設定されていると Claude Code は両方を送るからです: シェルで export した `ANTHROPIC_API_KEY` が OpenRouter に一緒に送られることも、紛れ込んだ `ANTHROPIC_AUTH_TOKEN` が Palgu に届くこともありません。キーがコマンドラインに載ることはありません。

### OpenRouter

1. [openrouter.ai/keys](https://openrouter.ai/keys) でキーを作成します。
2. `/plugin configure mixture-of-models@mixture-of-models-claude-mod` で次を設定します

   | オプション | 値 |
   | :- | :- |
   | `gateway_url` | `https://openrouter.ai/api` |
   | `gateway_key` | あなたの OpenRouter キー(`sk-or-…`) |
   | `gateway_provider` | `auto`(または `openrouter`) |

   またはシェルから: `claude plugin configure mixture-of-models@mixture-of-models-claude-mod --values-stdin` を実行し、入力に `{"gateway_url":"https://openrouter.ai/api","gateway_key":"<your key>","gateway_provider":"openrouter"}` を入力して Ctrl-D を押します。こうするとキーがシェルの履歴に残りません。
3. `claude` を起動します。simple と coding のターンは `z-ai/glm-5.3` で、research と review は `moonshotai/kimi-k3.1-pro` で実行されます。バンドには `glm`、`kimi`、`deepseek`(`deepseek/deepseek-v4-pro`)、`gemini`(`google/gemini-3.8-flash`)、`minimax`(`minimax/minimax-m3`、`minimax/minimax-m3.1-flash`)、`gpt`(`openai/gpt-6-sol`、`-luna`、`-astra`)、`mercury`(`inception/mercury-3`)が表示されます。ボタンが 11 個あるため、最後のボタンには数字キーがありません。クリックするか、Tab で移動してください。これらは 2026-10-29 に [OpenRouter のモデル一覧](https://openrouter.ai/models) で提供されていたスラッグです。OpenRouter には Kimi の highspeed 版がないため、`kimi/auto` はどのティアでも `pro` になります。

OpenRouter のスラッグには `/` が含まれるため、OpenRouter でのルートはファミリーのメンバー(`glm/5.3`)を指定します。ファミリーが列挙しているスラッグ(`z-ai/glm-5.3`)も使えます。他の OpenRouter モデルを使うには、ファミリーに追加してそこにルーティングします:

```json
{ "router": {
    "families": { "glm": { "members": { "4.6": "z-ai/glm-4.6" } } },
    "routes":   { "simple": "glm/4.6" } } }
```

[OpenRouter の Claude Code ガイド](https://openrouter.ai/docs/guides/guides/claude-code-integration) にあるとおり、Claude Code の動作が保証されているのは Anthropic 自身のモデルだけです。ルーティングされたターンのモデルが Claude Code のツールを扱えない場合、そのターンは失敗し、メインモデルが回答します。

### LiteLLM

[LiteLLM プロキシ](https://docs.litellm.ai/docs/tutorials/claude_responses_api) は、Anthropic 互換の `/v1/messages` を自身のアドレスで提供します。あなたのホスト上で動くため検出されることはありません: 明示的に指定してください。

| オプション | 値 |
| :- | :- |
| `gateway_url` | あなたのプロキシ。例: `http://localhost:4000`(またはその `/anthropic` パススルー、`http://localhost:4000/anthropic`) |
| `gateway_key` | プロキシのマスターキーまたは仮想キー(`sk-…`) |
| `gateway_provider` | `litellm` |

子プロセスはキーを `Authorization: Bearer` として送ります。モデル名は、プロキシの `config.yaml` が定義する `model_name` そのものです。デフォルトは Palgu の名前(`glm-5.3`、`kimi-k3.1-pro`、…)です: プロキシのモデルに同じ名前を付けるか、ルートをあなたのモデルに向けてください:

```json
{ "router": {
    "routes":   { "simple": "my-glm", "coding": "my-glm", "kinds": { "research": "my-kimi", "review": "my-kimi" } },
    "families": { "glm": { "members": { "mine": "my-glm" } } } } }
```

仮想キーは許可されたモデルにしか届きません。401 や未知のモデルの場合は子プロセスが失敗し、メインモデルが回答します。

## セキュリティとデータの利用

### このプラグインが接続するネットワークホスト

- `https://api.palgu.ai` — Palgu。コードに固定されています: `/palgu login` で `/auth/device/code` と `/auth/token`、`/palgu status` で `/me` と `/me/org-settings`、セッション開始時・`/palgu login` の後・`/route models` で `/v1/models/health`(ゲートウェイのキーを `x-api-key` として送り、それ以外は何も送りません)、ゲートウェイが Palgu で `router.prices` にそのモデルのエントリがない場合はルーティングされたターンの後に `/v1/pricing/quote`、メインセッションがターンを終えたときに `/anthropic/heartbeat`(ハートビート、後述)、`/palgu memory on` を実行したプロジェクトではあなたの各プロンプトで `/v1/cortex/search`(Palgu メモリの想起、後述)。
- `https://raw.githubusercontent.com` — セッション開始時(最大 12 時間ごと、バックグラウンドで)と `/route update` のとき: 公開バージョンを読むために `/alinaqi/mixture-of-models-claude-mod/main/.claude-plugin/plugin.json` を GET します。何も送信しません。
- `http://localhost:11434` — 各プロンプトをスコア付けするローカルの Ollama(`/api/chat`)。あなたのマシンから出ません。そこで何も応答しない場合はスキップされます。
- Anthropic。あなた自身のプランで、Claude Code 自身の `$.model.classify` を通じて — Ollama が応答しない場合にのみ、プロンプトのスコア付けのため。
- プラグイン設定で指定したゲートウェイ URL(`gateway_url`。例: `https://api.palgu.ai/anthropic`、`https://openrouter.ai/api`、あなたの LiteLLM プロキシ)。ユーザーはプラグイン設定でカスタムのゲートウェイ URL を設定できます。ルーティングされたターンで接続するのはその URL だけで、接続するのは mod ではなく子プロセスです。Codex の子プロセスは、そのゲートウェイの `/v1`(または設定した `router.codex.baseUrl`)を使うか、`codex.auth: "chatgpt"` の場合はあなた自身の Codex ログインで OpenAI を使います。`claude/<member>` の子プロセスは、あなた自身の Claude ログインで Anthropic を使います。

### プラグインが送信するデータ

- 会話のメッセージ(`session.messages`): プロンプトと、テキストを含む直近 `router.child.contextMessages` 件(デフォルト 12)のメッセージ。それぞれ 1,200 文字に切り詰められ、使ったツールの名前が付きます。これらは子プロセスの stdin に書き込まれ、子プロセスはモデルの回答を得るためにそれを上記のゲートウェイ URL(該当するルートでは Anthropic または Codex)に送ります。送信されるのはルーティングされたターン、つまりスコアまたは `/route` のピンによってメインセッションの外に送られるターンのみです。critical、セキュリティ、通知、オペレーターのターン自体はルーティングされませんが、後のルーティングされたターンのコンテキストに、それらの直近のテキストが含まれることがあります。コンテキストは、ルートにかかわらずテキストを含む直近のメッセージだからです。作業中、子プロセス自身のエージェントループも、[子プロセスがしてはいけないこと](#子プロセスがしてはいけないこと) の deny ルールのもとで、ツールがプロジェクト内で読んだ内容を送信します。
- プロンプトのテキストとスコア付けのルーブリック: 分類に到達するすべてのプロンプトについて、ローカルの Ollama、または `$.model.classify` を通じて Anthropic に。
- ローカルファイルの内容(`fs.read`): `~/.claude/model-config.json`(あなたの設定。送信されません)と `~/.claude/mixture-of-models/strategies/*.md`(あなたのルーティング戦略。有効な戦略のルーブリックはスコア付けのプロンプトの一部なので、上記のとおり Ollama または Anthropic に送られます)。mod 自身はプロジェクトのファイルを読みません。
- Palgu へ: `/palgu login` でクライアント ID `mixture-of-models`、デバイス名 `Claude Code on <HOSTNAME>`、mod のバージョン、ランダムなインストール ID、デバイスコード。`/palgu status` で Bearer ヘッダーとしてのゲートウェイのキー。価格見積もりではモデル ID、4 つのトークン数、キー。プロンプトや回答のテキストは送りません。
- Palgu へ、ハートビート: メインセッションが回答を終え、ゲートウェイが Palgu である場合(かつ `router.heartbeat` が `local` でも `off` でもない場合)、その回答の最後の 600 文字、セッション ID(インストール ID とプロンプトの番号)、`x-api-key` としてのキー。Palgu はそのターンがタスクの途中で止まったかどうかを返します。会話からそれ以外は何も送りません。
- Palgu へ、`palgu` CLI 経由で、`/palgu memory on` を実行した後のみ: Palgu メモリのための、プロジェクトのソースファイル(「プログラム」を参照)。`palgu` は自身のサインインを使います。
- Palgu へ、Palgu メモリの想起。`/palgu memory on` を実行したプロジェクトフォルダーで、かつ mod が Palgu にサインインしている間のみ: 4 語以上のあなたの各プロンプト(1 行、最大 300 文字。スラッシュコマンドは除く)、プロジェクトの Palgu 上の名前、Bearer ヘッダーとしてのキーを `/v1/cortex/search` に送ります。返ってきたもの(最大 8 件の 1 行のポインター: 記録された意図と ADR、ドキュメント、ファイル付きのコードシンボル。最大 2,000 文字)は、メインセッション向けにはプロンプトの横に、ルーティングされた子プロセス(Claude、Palgu のモデル、Codex)向けにはブリーフに追加されるので、回答するすべてのモデルが同じメモリを見ます。失敗した検索や 3 秒を超えた検索は何も追加せず、プロンプトを待たせることもありません。
- Palgu または汎用ゲートウェイへ、子プロセスの識別ヘッダー: `x-srooter-client`(mod の名前とバージョン)、`x-srooter-project`(セッションフォルダーの名前をスラッグ化したもの)、そして Palgu では `x-srooter-pin`(ルーティング先のモデル ID)。[子プロセスが送信するヘッダー](#子プロセスが送信するヘッダー) を参照してください。 ルーティング先のモデルがある子プロセスは `x-palgu-fallback: auto` も送ります。
- それ以外のデータは送信しません。テレメトリーなし。アナリティクスなし。

### プラグインが実行するプログラム

各 `$.process.run` 呼び出しでは、プログラムと固定のフラグが呼び出し箇所にリテラルのテキストとして書かれています。どれもシェルを介して実行されません。

- `claude -p --model <model> --output-format stream-json --verbose --max-turns <n> --add-dir <cwd> <child.args> --disallowedTools <deny rules>` — Claude Code 自身をヘッドレスで実行し、ルーティングされたターンをゲートウェイ上またはあなたの Claude ログイン上(`claude/<member>` のルート)で実行します。動的な引数: モデル ID(ルートまたはピンから。文字、数字、`. _ : / @ [ ] -` だけからなる 1 つの単純な ID で、`-` で始まらず、200 文字以内でなければ拒否されます)、ターン数の上限、`model-config.json` の `child.args`/`router.child.deny`、セッションの作業ディレクトリ。それぞれ、単純な文字列でない場合や NUL を含む場合は拒否されます。子プロセスが拒否されたコマンドをあなたが承認した後は、同じ呼び出しに `--resume <its session id> --allowedTools <the patterns you approved>` が追加されます。
- `codex exec --json … -`、および拒否されたコマンドを承認した後の `codex exec -C <cwd> resume --json … <thread id> -` — Codex CLI。`codex` のルートでのみ、同じチェック付きで実行します(スレッド ID は単純な ID として)。
- `claude plugin configure mixture-of-models@mixture-of-models-claude-mod --values-stdin` — `/palgu login` の後に一度だけ、Palgu が発行したキーを Claude Code のセキュアストレージに保存するため。引数はすべて固定のテキストです。キーは stdin でのみ渡され、それも 1 つの単純なトークン(`A-Z a-z 0-9 . _ -`、8 〜 512 文字)であることを確認した後に限られます。
- `claude plugin marketplace update mixture-of-models-claude-mod`、続いて `claude plugin update mixture-of-models@mixture-of-models-claude-mod` — `/route update` で、GitHub に新しいバージョンがある場合のみ。引数はすべて固定のテキストです。
- `palgu memory index .`(セッションフォルダーで、バックグラウンドで、プロジェクトごとに最大 10 分に 1 回)と `palgu memory status . --json` — Palgu CLI。`/palgu memory on` を実行したプロジェクトフォルダーで、かつ mod が Palgu にサインインしている間のみ。引数はすべて固定のテキストです。`palgu` は自身のキー(`palgu login`)でサインインし、mod はキー、環境変数、stdin を一切渡しません。インデックス作成はプロジェクトのソースファイルを Palgu にアップロードするため、あなたが有効にするまでオフになっています。
- プラグインがネットワークから受け取ったコマンドを実行することはありません。ネットワークの応答が `process.run` の argv に入ることはありません: GitHub の応答は固定の更新コマンドを実行するかどうかを決めるだけで、取得した値のうちプロセスに届くのは Palgu のキーだけです。それも上記のチェックの後に stdin で渡されます。

### フック

- `prompt.submit` — ルートを決めるためにプロンプトを読みます(事前ルール、次に分類器のスコア、次にしきい値)。プロンプトはそのまま通します: 破棄、書き換え、追加は一切しません。失敗時はオープン(fail open)です。
- `turn.step` — ルーティングされたターンでは、メインモデルの代わりに上記の子プロセスを実行し、子プロセスのテキストでターンに回答します。それ以外のすべてのターンとすべてのサブエージェントは、そのまま通ります。子プロセスの回答が失敗または破棄された場合、ターンはメインモデルに戻されます。
- `turn.complete` — ターンのテキストにルート行(ルート、スコア、コスト、節約額)を追加し、プラグインストア内のカウント、判定ログ、節約額の合計を更新します。続いてハートビート: メインセッションの回答がタスクの途中で止まった場合(行動を予告して終わった、または変更を頼んだのに行っていない編集を説明した場合)、mod は自ら continue のプロンプトを 1 つ送信します(`$.prompt.submit`。モデルにはこのプラグインからのものとして表示されます)。あなたのプロンプト 1 つにつき最大 `router.heartbeatMax`(3)回です。失敗時はオープン: エラーが停止を妨げることはありません。
- その他: `session.start`(設定を読み、`/route` と `/palgu` を登録)、`turn.start`(前回の子プロセスの結果をクリア)、`AbovePrompt`(バンド)、`AssistantMessage`(子プロセスの返信の出所タグ)、`Pane`(ヘルプと統計のペイン)、`Spinner`(`via <model> (child)…`)に対する `ui.render`、`/route` と `/palgu` に対する `command.run`。mod が `tool.call` や `tool.check` を扱うことはありません。

### 追加されるコマンド、ツール、エージェント

- `/route` — ルートの状態を表示し、ティア、モデル、ファミリーのメンバー、`codex` をピン留めし、戦略を切り替え、統計またはヘルプのペインを開き、失敗の記憶をリセットし、プラグインを更新します(`/route update`)。
- `/palgu` — Palgu にサインインし(`login`)、誰のキーが設定されているか、組織が今期の Palgu 予算をどれだけ使ったか、プロジェクトが Palgu メモリに入っているかを示し(`status`)、プランと請求へのリンクを示し(`upgrade`)、今いるプロジェクトの Palgu メモリをオン・オフします(`memory on`、`memory off`、`memory`。プロジェクトフォルダーごとに `memory on` が必要です)。
- `routing-strategy` スキル — ルーティング戦略ファイルの作成や説明を手伝います。
- ツール、エージェント、MCP サーバーはありません。

### 認証情報

- API キーは、ユーザーがプラグイン設定(`user_config`。機密情報として保存)から入力します: 設定したゲートウェイ(Palgu、OpenRouter、LiteLLM、またはその他の Anthropic 互換エンドポイント)用のキー `gateway_key` が 1 つです。`/palgu login` は同じ設定を自動で埋めます。
- プラグインは、ユーザーのマシン上の環境変数やファイルからキーを読みません。読む環境変数は `HOME`、`HOSTNAME`、`MAGGY_ROUTER_CHILD`、`ANTHROPIC_CUSTOM_HEADERS`(あなた自身の追加ヘッダーで、ゲートウェイの子プロセスにのみ渡されます)です。
- 各キーは、それぞれのプロバイダーのホストにのみ送られます: `gateway_key` は、設定したゲートウェイ(または Codex のルートでは、`model-config.json` で設定した `router.codex.baseUrl`)に、子プロセスによって、子プロセスの環境(argv ではなく)から届けられます。また、そのゲートウェイが Palgu の場合に限り、mod から `https://api.palgu.ai` に届きます。

## このプラグインが実行、読み取り、送信、保存するもの

ディレクトリのセキュリティスキャンは、このセクションとコードを比較します。mod が自身のコードの外で行うことは、すべてここに記載しています。要約すると:

- `/palgu` を実行したときのみ、`https://api.palgu.ai`(`/auth/device/code`、`/auth/token`、`/me`)に **フェッチ** し、Palgu が発行したキーを保存するために `claude plugin configure … --values-stdin` を一度 **実行** します(下の表を参照)。
- プロンプトをスコア付けするため、`$.http.fetch` で `http://localhost:11434/api/chat` に **フェッチ** し、プロンプトのテキストとスコア付けのルーブリックをローカルの Ollama に送ります。認証情報はなく、何もマシンの外に出ません。
- Ollama が応答しない場合、`$.model.classify` を **呼び出し**、同じプロンプトのテキストとルーブリックを、Claude Code 自身の API クライアントを通じてあなた自身のアカウントで Anthropic に送ります。
- セッション開始時(バックグラウンドで、最大 12 時間ごと)と `/route update` のときに、新しいバージョンが出ているかを確認するため `https://raw.githubusercontent.com/alinaqi/mixture-of-models-claude-mod/main/.claude-plugin/plugin.json` を **フェッチ** し(単純な GET、何も送信しません)、あればトーストとバンドで知らせます。
- `/route update` のときのみ、GitHub に新しいバージョンがある場合に、このプラグインに対して `claude plugin marketplace update` と `claude plugin update` を固定のテキストとして **実行** します。
- ルーティングされたターンのために、`$.process.run` で 2 つのプログラムを **実行** します: `claude`(Claude Code 自身をヘッドレスで)。これは、`ANTHROPIC_BASE_URL` と設定したキー(`ANTHROPIC_API_KEY`、OpenRouter と LiteLLM では `ANTHROPIC_AUTH_TOKEN` に入れ、もう一方は空に設定)に加え、Palgu と汎用ゲートウェイでは識別用に設定した `ANTHROPIC_CUSTOM_HEADERS`([子プロセスが送信するヘッダー](#子プロセスが送信するヘッダー) を参照)を使うか、`claude/<member>` のルートでは `ANTHROPIC_BASE_URL` をクリアしてあなた自身の Claude ログインで動きます。そして `codex` のルートでのみ `codex exec`(Codex CLI)。これはゲートウェイのキーを `PALGU_API_KEY`(OpenRouter では `OPENROUTER_API_KEY`、LiteLLM では `LITELLM_API_KEY`)に入れるか、あなた自身の Codex ログインで動きます。各子プロセスは、あなたのプロンプトと直近のセッションテキストの短いブリーフをそれぞれのエンドポイントに **送信** します。
- `~/.claude/model-config.json`、あなたの戦略ファイル、`HOME`、`HOSTNAME`、`MAGGY_ROUTER_CHILD`、`ANTHROPIC_CUSTOM_HEADERS` を **読み取り**、ルートのピン、日ごとのカウント、最後の判定、種別ごとの失敗回数、最後のアップデート確認、直近 200 件の判定のログ(日付、モデル、種別、ティア、スコア、分類器のソース、子プロセスの時間と終了コード。プロンプトのテキストは含まない)をプラグインストアに **保存** します。

詳細は以下のとおりです。プライバシーポリシーは [PRIVACY.md](PRIVACY.md) にあります。

### フック

フックモジュール `hooks/register.js` は 11 個のフックを登録します。それぞれが受け取るイベントと呼び出しで何をするか:

| フック | 動作 |
| :- | :- |
| `session.start` | `~/.claude/model-config.json` とあなたの戦略ファイルを読み、プラグインのオプションからゲートウェイの URL とキーを取得し、セッションのモデルを記憶し、プラグインストアから `/route` のピンを読み込み、`/route` と `/palgu` コマンドを登録します。`MAGGY_ROUTER_CHILD` が設定されている場合は何もしないので、mod は自身の子プロセス内では無効のままです。 |
| `prompt.submit` | すべてのプロンプトをそのまま通します。並行してルートを決めます: まず事前ルール、次に分類器による 1-10 の影響範囲スコア(「ネットワーク」を参照)、次にしきい値。プロンプトの破棄、書き換え、追加は一切しません。失敗時はオープン: スコア付けが例外を投げても、プロンプトは通ります。 |
| `turn.start` | 前のターンの子プロセスの結果をクリアします。 |
| `turn.step` | ルーティングされたターンでは、メインセッションにモデルを呼ばせる代わりに、「プログラム」で説明した子プロセス(ゲートウェイ上またはあなたの Claude ログイン上の Claude Code、または Codex)を実行し、子プロセスのテキストを `stopReason: end_turn` でターンの回答として返します。子プロセスのパーミッションシステムがコマンドを拒否した場合、フックは `$.ui.ask`(Claude が質問に使うダイアログ)で、正確なコマンドを示してあなたに尋ねます。"Allow and continue" を選ぶと、そのコマンドを許可して同じ子プロセスを再開します(最大 `relayRounds` 回)。"Deny" を選んだ場合や誰も答えられない場合は、子プロセス自身の説明が回答になります。Codex の子プロセスについても、拒否されたとして挙げたコマンドについて同じように、1 ターンに 1 回尋ねます。"Allow and continue" を選ぶと、プロジェクト内の編集を許可して同じ Codex スレッドが再開されます([サンドボックスと承認](#サンドボックスと承認) を参照)。それ以外のすべてのターンとサブエージェントでは、`next(e)` をそのまま呼びます。子プロセスが失敗したか何も出力しなかった場合は `next(e)` を呼び、メインモデルが回答します。 |
| `turn.complete` | 回答の下に、ルート、スコア、コスト、実行場所、ルーティングされたターンの節約額を示す行を追加し、プラグインストア内の日ごとのカウントと節約額の合計を更新します。Palgu では、ルーティングされたターンのコストを `/v1/pricing/quote` に問い合わせます。 |
| `AbovePrompt` に対する `ui.render` | バンドを描画します: 現在のモードと最後の判定、`/route` のピンを変更するボタン。他の mod がそこに描画するものはそのまま残します。 |
| `AssistantMessage` に対する `ui.render` | 子プロセスが生成した返信の上に、薄い出所表示の行を付けます。それ以外の返信はそのまま通します。 |
| `Spinner` に対する `ui.render` | ルーティングされたターンの間、スピナーの語の後に `via <model> (child)…` を追加します。 |
| `Pane` に対する `ui.render` | `/route stats` で開いたときに、判定ログから「Mixture of models」統計ペイン(ID `routing-stats`)を描画します。それ以外のペインはそのまま通します。 |
| `/palgu` に対する `command.run` | `login` は Palgu のデバイスサインインを開始し、すぐにリンクとコードを返します。その後 `$.clock` タイマーが、あなたが承認するか拒否するかコードが期限切れになるまで、`interval` 秒ごと(`slow_down` のたびに 5 秒延長)に `/auth/token` をポーリングし、キーを保存して、このセッションの子プロセスを Palgu に切り替えます。`status` は Palgu の `/me` に誰のキーかを問い合わせ、`upgrade` は請求ページのリンクを表示します。 |
| `/route` に対する `command.run` | ルートの状態とファミリーを表示する(`/route`、`/route status`)か、ピンを設定します(`auto`、`off`、ティア、モデル、`<family>/<member>`、`<family>/auto`、`codex`)。未知のファミリーやメンバーは、有効なものの一覧とともに拒否されます。 |

mod は `tool.call` も `tool.check` も扱わないため、ツール呼び出しを承認、拒否、変更することはなく、パーミッションのプロンプトを変更することもありません。

### ネットワーク: このプラグインが接続するホスト

mod 自身の呼び出し、続いて子プロセスの呼び出し:

| 誰が | 呼び出し | アドレス | 送信内容 | 理由 |
| :- | :- | :- | :- | :- |
| mod、セッション開始時(最大 12 時間ごと)と `/route update` で | `$.http.fetch` | `https://raw.githubusercontent.com/alinaqi/mixture-of-models-claude-mod/main/.claude-plugin/plugin.json`。コードに固定 | GET のみ | 公開バージョンを読み、あなたのバージョンと比較します。 |
| mod、`/palgu login` で | `$.http.fetch` | `https://api.palgu.ai/auth/device/code`、次に `/auth/token`。コードに固定 | クライアント ID `mixture-of-models`、デバイス名(`Claude Code on <HOSTNAME>`)、mod のバージョン、ストアに保持するランダムなインストール ID。続いて Palgu から受け取ったデバイスコード | サインイン。Palgu はこのコンピューター用のキーを返します。 |
| mod、セッション開始時・`/palgu login` の後・`/route models` で | `$.http.fetch` | `https://api.palgu.ai/v1/models/health`。コードに固定 | GET と、`x-api-key` としてのゲートウェイのキーのみ。`gateway_url` が `https://api.palgu.ai` 上にある場合のみ | Palgu が現在提供しているモデルとダウンしているモデルを読み、モデル一覧がリリースではなく Palgu に追従するようにします。次のセッションのために mod のストアに保持します。 |
| mod、Palgu 上のルーティングされたターンの後の `turn.complete` で | `$.http.fetch` | `https://api.palgu.ai/v1/pricing/quote`。コードに固定 | ルーティング先のモデル ID と子プロセスの 4 つのトークン数(入力、出力、キャッシュ読み取り、キャッシュ書き込み)、Bearer ヘッダーとしてのゲートウェイのキー。`gateway_url` が `https://api.palgu.ai` 上にあり、`router.prices` にそのモデルのエントリがない場合のみ | 節約額の推定のためにターンを値付けします。プロンプトや回答のテキストは送りません。 |
| mod、`prompt.submit` で、`/palgu memory on` を実行した場所のみ | `$.http.fetch` | `https://api.palgu.ai/v1/cortex/search`。ホストとパスはコードに固定 | あなたのプロンプト(1 行、最大 300 文字)、プロジェクトの Palgu 上の名前、`limit=8`、Bearer ヘッダーとしてのゲートウェイのキー。`gateway_url` が `https://api.palgu.ai` 上にある場合のみ | Palgu メモリの想起: プロジェクトのメモリからのポインターが、メインセッション向けにはプロンプトの横に、ルーティングされた子プロセスにはブリーフに入ります。 |
| mod、`/palgu status` で | `$.http.fetch` | `https://api.palgu.ai/me` と `https://api.palgu.ai/me/org-settings`。コードに固定 | Bearer ヘッダーとしてのゲートウェイのキー。`gateway_url` が `https://api.palgu.ai` 上にある場合のみ(他のゲートウェイのキーが送られることはありません) | 誰のキーか、組織のプラン、組織が今期の Palgu 予算をどれだけ使ったかを示します。 |
| mod、`prompt.submit` で | `$.http.fetch` | `http://localhost:11434/api/chat`。コードに固定 | Ollama のチャットリクエストとしてのスコア付けのルーブリックとプロンプトのテキスト。認証情報なし | 無料のローカル分類。そこで何も応答しない場合はスキップされます。 |
| mod、`prompt.submit` で | `$.model.classify` | Claude Code 自身のクライアントとあなた自身のプランを通じた Anthropic の API | スコア付けのルーブリックとプロンプトのテキスト | Ollama が使えないときの分類。モデル: `classifier` エイリアス。デフォルトは `claude-haiku-5-5`。 |
| `turn.step` で起動される子プロセス(Claude Code 自身) | Claude Code の通常の API クライアント | プラグインのオプションで設定した `gateway_url`(例: `https://api.palgu.ai/anthropic`、`https://openrouter.ai/api`、あなたの LiteLLM プロキシ)。`gateway_key` を `x-api-key`(Palgu、汎用)または `Authorization: Bearer`(OpenRouter、LiteLLM)として使用 | あなたのプロンプトと、セッションの直近 `contextMessages` 回のやり取りのブリーフ(テキストのみ、切り詰め済み)。その後、作業中に子プロセス自身のエージェントループが送るもの | それがこのプラグインの目的です: ターンをメインセッションのモデルではなくゲートウェイのモデルで実行します。 |
| `turn.step` で起動される Claude メンバーの子プロセス(`claude/<member>` のルート) | Claude Code の通常の API クライアント | Anthropic。メインセッションと同じ、あなた自身の claude.ai ログインで | 同じブリーフ。その後、子プロセス自身のエージェントループ | メインセッションの向き先を変えずに、別の Claude モデルでターンを実行します。 |
| `turn.step` で起動される Codex の子プロセス(`codex` のルート) | Codex CLI 自身のクライアント | `codex.auth: "palgu"` の場合: ゲートウェイの `/v1`(例: `https://api.palgu.ai/v1/responses`、`https://openrouter.ai/api/v1/responses`、`<your LiteLLM proxy>/v1/responses`)を `gateway_key` で。`"chatgpt"` の場合: OpenAI を、あなた自身の Codex ログインで | 同じブリーフ。その後、Codex 自身のエージェントループ | ターンを Codex で実行します。 |

mod はこれ以外のホストには接続しません。ゲートウェイはあなたが設定したものであり、固定の第三者には何も送りません。

### このプラグインが実行するプログラム

**どのプログラムか:** 3 つです。`palgu`(Palgu CLI。`/palgu memory on` の後のみ: `palgu memory index .` と `palgu memory status . --json`。どちらも固定のテキスト)、`claude`(ヘッドレスモードの Claude Code 自身。また `/palgu login` の後に一度、ゲートウェイの URL とキーを stdin で渡して保存するため `claude plugin configure mixture-of-models@mixture-of-models-claude-mod --values-stdin` として。さらに `/route update` で新しいバージョンが公開されている場合、`claude plugin marketplace update mixture-of-models-claude-mod`、続いて `claude plugin update mixture-of-models@mixture-of-models-claude-mod`)、`codex`(Codex CLI の `codex exec`。`codex` のルートでのみ)。プラグインはシェル、プラグインフォルダーに同梱されたスクリプト、パッケージランチャー、その他の実行ファイルを一切実行しません。

**理由:** mod はリクエストのモデル名を変えることはできますが、自身が動いているセッションのエンドポイントや認証情報を変えることはできません。メインセッションのエンドポイントと認証情報に手を付けずに、Claude Code 自身のツールを使って別のエンドポイントでターンを実行する唯一の方法は、環境がゲートウェイを向いた 2 つ目の Claude Code プロセスです。子プロセスはその理由のためだけに、そしてスコアがメインセッションの外にルーティングしたターンのためだけに存在します。同じ理屈が、別の Claude モデル(メインセッションは名前を変えないので、他のメンバーは独自のプロセスで実行される)と Codex(別のエージェント CLI であり、独自のプロセスとしてしか実行できない)にも当てはまります。

**方法:** `turn.step` 内の 4 つの `$.process.run` 呼び出しです。プログラムごとに最初の実行と再開の実行があり、それぞれ呼び出し箇所にプログラム名と固定のフラグがリテラルのテキストとして書かれています: `claude` と `codex`。動的な値は先にチェックされます([プラグインが実行するプログラム](#プラグインが実行するプログラム) を参照)。ゲートウェイのルートでの `claude` の引数:

```
claude -p --model <routed model id> --output-format stream-json --verbose --max-turns <child.maxTurns> --add-dir <session cwd> --bare --permission-mode acceptEdits
```

`claude/<member>` のルートでは、同じプログラムが `--model <member id>` で、`child.args` の代わりに `child.subscriptionArgs`(`--permission-mode acceptEdits`)を使って、つまり `--bare` なしで実行されます。環境は `MAGGY_ROUTER_CHILD=1` と空に設定した `ANTHROPIC_BASE_URL` なので、あなたの Claude ログインで動きます。

`codex` のルートでは、プログラムは `codex` で、引数は [子プロセスとしての Codex](#子プロセスとしての-codex) に示したもの(拒否されたコマンドを承認した後のみ、そこで説明した `exec -C <cwd> resume … <thread> -`)、stdin にはブリーフ、環境は `MAGGY_ROUTER_CHILD=1` に加えて、ゲートウェイ経由の場合のみ `PALGU_API_KEY`(OpenRouter では `OPENROUTER_API_KEY`、LiteLLM では `LITELLM_API_KEY`)に入れたキー、そして同じ `child.timeoutMs` です。

ゲートウェイと Claude メンバーの子プロセスでは、中継されたコマンドを承認した後のみ(下記参照)、同じプログラムが `--resume <that child's session id> --allowedTools <the approved patterns>` を付けて再実行され、同じ子プロセスが続行します。`--bare` はあなたのフック、プラグイン、キーチェーンを子プロセスから締め出します。`child.args` を設定すると、最後の 3 つのフラグが置き換えられます。ゲートウェイの子プロセスの環境には、`ANTHROPIC_BASE_URL`、キー(`ANTHROPIC_API_KEY` に入れて `ANTHROPIC_AUTH_TOKEN` を空に(Palgu、汎用)、または `ANTHROPIC_AUTH_TOKEN` に入れて `ANTHROPIC_API_KEY` を空に(OpenRouter、LiteLLM))、`ANTHROPIC_CUSTOM_HEADERS`(下記)、`CLAUDE_CODE_MAX_RETRIES`(`child.maxRetries`)、`MAGGY_ROUTER_CHILD=1` が追加されます。Claude メンバーと Codex の子プロセスには識別ヘッダーは付きません。ブリーフは stdin に書き込まれます。子プロセスはセッションの作業ディレクトリで、そのパーミッションモードのもとで Claude Code のツールを使って動くので、そこでファイルを読み書きし、モードが許可するコマンドを実行できます。それらのコマンドは子プロセス自身のエージェントとしての判断であり、Claude Code のパーミッションシステムによって管理されるもので、このプラグインが発行するコマンドではありません。子プロセスは `child.timeoutMs` で強制終了されます。

### 子プロセスが送信するヘッダー

子プロセスが Palgu または汎用ゲートウェイに送るすべてのリクエストには 2 つのヘッダーが付くので、Palgu のダッシュボードはそのトラフィックを Mixture-of-Models としてプロジェクトごとに表示できます。これらを読まない OpenRouter と LiteLLM では省略され、あなた自身の `ANTHROPIC_CUSTOM_HEADERS` だけが送られます:

```
x-srooter-client: mixture-of-models/0.16.0
x-srooter-project: <the session folder's name>
```

プロジェクトは、セッションの作業ディレクトリの最後のセグメントを、ゲートウェイのプロジェクト検出と同じ方法でスラッグ化したものです: `[A-Za-z0-9._-]` 以外の文字は `-` になり、先頭と末尾の `-._` は取り除かれ、最大 64 文字、小文字になります(`/Users/me/My App` → `my-app`)。使えるものが何も残らない場合、ヘッダーは省略されます。どちらのヘッダーにも、パス、プロンプトのテキスト、その他の内容は含まれません。

これらは子プロセスの `ANTHROPIC_CUSTOM_HEADERS`(Claude Code の改行区切りの `Name: value` リスト)に入り、`ANTHROPIC_BASE_URL` と同じ場所で設定されます: ゲートウェイが設定されていなければヘッダーもなく、子プロセスはそのゲートウェイとだけ通信します。すでに `ANTHROPIC_CUSTOM_HEADERS` を設定している場合、あなたの行が先に来て保持されます。あなた自身の `x-srooter-client` や `x-srooter-project` は mod のものより優先されます。メインセッションのリクエストは変わりません。

ルーティング先のモデルがある子プロセスは、Palgu がちょうどそのモデルで応答するように `x-srooter-pin: <model>` も送り、過負荷のときにゲートウェイがピン留めされたリクエストを失敗させずに同等のモデルへ移せるように `x-palgu-fallback: auto` も送ります。`ANTHROPIC_CUSTOM_HEADERS` にあなた自身が設定した `x-palgu-fallback` が優先されます。

### 読み取るファイルと環境変数

- `~/.claude/model-config.json`。`$.fs.read` を通じて、ルート、しきい値、分類器のエイリアス、子プロセスの設定のために読みます。認証情報は含みません。存在しないか無効な場合は、デフォルトが適用されます。
- `~/.claude/mixture-of-models/strategies/*.md`。`$.fs.list` と `$.fs.read` を通じて、ルーティング戦略のために、セッション開始時と `/route strategy` または `/route strategies` のときに読みます。
- 環境変数 `HOME`、`HOSTNAME`(Palgu のデバイス名のため)、`MAGGY_ROUTER_CHILD`、`ANTHROPIC_CUSTOM_HEADERS`(あなた自身のカスタムヘッダーを子プロセスで保持するため)。`$.env.get` を通じて読みます。
- それ以外は何も読みません。ゲートウェイのキーをファイルや環境変数から読むことはありません。キーはプラグインの `gateway_key` オプションからのみ取得され、Claude Code がそれをセキュアストレージに保持します。

### 保存するもの

プラグイン自身のストア(`$.store`、`~/.claude/plugins/store/` 配下)に: Palgu サインイン用のランダムなインストール ID(`palgu-install-id`。サインインをまたいで Palgu が同じ 1 台のデバイスとして認識するため)、Palgu メモリがオンになっているプロジェクトフォルダーとそれぞれの最終インデックス作成日時(フォルダーのパス)、Palgu が最後に提供したモデル一覧、`/route` のピン、モデルごとの日ごとのカウント、最後の判定、種別ごとの失敗回数、最後のアップデート確認(日時、GitHub に掲載されていたバージョン、あなたに通知したバージョン)、直近 200 件の判定のログ(日付、モデル、種別、ティア、スコア、分類器のソース、子プロセスの所要時間と終了コード)。プロンプトのテキスト、回答、認証情報は保存しません。

### 決してしないこと

設定ファイル、`model-config.json`、`~/.codex` には書き込まず、メインセッションのモデル、エンドポイント、認証情報を変更せず、ツール呼び出しを扱わず、上に挙げたホスト以外にデータを送りません: 2 つの分類器の送り先、それらを名指しするコマンドのための Palgu と GitHub、そしてあなたが設定したゲートウェイです。

## 設定

mod は Maggy の唯一の信頼できる情報源である `~/.claude/model-config.json` を読み、任意の `router` ブロックを追加します。そのファイルに書き込むことはありません。

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

すべてのティアを Claude のメンバーに割り当て、最も難しいターンには Fable、レビューには Codex を使う設定:

```json
{ "router": {
    "routes":   { "simple": "claude/auto", "coding": "claude/auto", "critical": "claude/auto", "kinds": { "review": "codex" } },
    "families": { "claude": { "auto": { "criticalPlus": "fable" } } } } }
```

- `routes`: ティア → ゲートウェイが提供するモデル ID。加えて `routes.kinds`: critical 以外のティアでの種別 → モデル。`"claude"` はメインセッションを意味します。
- `primary`(Maggy が追従するモデル。`/model-config` で設定): `glm`、`kimi`、`deepseek` にすると、`routes.coding` が設定されていない限り `coding` ティアがそれに追従します。`primary: claude` は何も変えません: `critical` はすでに Claude にあり、`routes.coding` を `"claude"` に設定しない限り `coding` は安いままです。
- `thresholds`: 影響範囲スコアの区切り。デフォルトは `{ "simple": 3, "coding": 7 }`。
- `classifier`: Ollama に到達できないときに使う Claude のモデル。日付なしのエイリアスのみ(`claude-haiku-5-5`、`claude-sonnet-5`、`claude-opus-5`)。
- `provider`: プラグインの `gateway_provider` オプションが未設定または `auto` のときのゲートウェイのプロバイダー: `palgu`、`openrouter`、`litellm`、`anthropic-compatible`。未設定の場合はゲートウェイの URL から検出されます([セットアップ](#セットアップ) を参照)。デフォルトの `routes`、`families`、バンドのボタン、子プロセスの認証を決めます。`routes` や `families` で設定したものが常に優先されます。
- `child.baseUrl`: プラグインの `gateway_url` オプションが未設定のときの、ゲートウェイ URL のフォールバック。キーにはフォールバックがなく、`gateway_key` オプションからのみ取得されます。
- `child.auth`: `x-api-key`(`ANTHROPIC_API_KEY`)または `bearer`(`ANTHROPIC_AUTH_TOKEN`)。プロバイダーから設定されます。Bearer トークンを求める汎用ゲートウェイでは自分で設定してください。`child.identify`: `x-srooter-*` ヘッダーを送るかどうか(Palgu と汎用ゲートウェイではオン)。
- `child.args`: 追加のフラグ。デフォルトは `--bare`(フックやプラグインを継承せず、API キー認証のみなので、子プロセスがあなたのサブスクリプションにフォールバックすることはない)と、確認なしでファイルを編集できるようにする `acceptEdits` です。mod は常に `--add-dir <cwd>` を追加するので、`--bare` でもプロジェクトの `CLAUDE.md` に手が届きます。子プロセスに無人でコマンドを実行させたい場合にのみ `--dangerously-skip-permissions` を追加してください。子プロセス内でもフックとプラグインを使いたい場合は `--bare` を外してください。
- `child.maxTurns`、`timeoutMs`: 子プロセスのエージェントとしての予算。`timeoutMs` の上限は `$.process.run` の制限である 10 分です。
- `child.maxRetries`: ゲートウェイの子プロセスが、429 や 5xx で失敗したリクエストを再試行する回数(デフォルト 2。Claude Code 自身のデフォルトは 10 で、混雑したプロバイダー相手では数分かかっていました)。ゲートウェイに短い瞬断があり、フォールバックするよりやり過ごしたい場合は増やしてください。
- `child.fallbacks`: ゲートウェイの子プロセスが失敗した後、メインモデルがターンを引き受ける前に mod 自身が試す同等モデルの数(デフォルト 3、0 でオフ)。Palgu では同じクラスを先に、次にその他の正常なモデルを試します。上記「子プロセスが失敗したとき」を参照してください。
- `child.longContext`: ルーティング先のモデルにとって長すぎるプロンプトの移り先となるゲートウェイのモデル。デフォルトは空で、その場合は Palgu のライブリストが報告するコンテキストウィンドウが失敗したモデルより大きい正常なモデルを、大きい順に使います。Palgu を使わない場合は自分で設定してください。設定しないと、長すぎるプロンプトはメインモデルに渡ります。
- `child.contextMessages`: ブリーフに入れる直近のやり取りの数。
- `child.relayRounds`: ルーティングされた 1 ターンが、子プロセスが拒否されたコマンドについてあなたに尋ねるために一時停止できる回数(デフォルト 2)。
- `child.deny`: すべての Claude の子プロセスに対する追加の Claude Code パーミッション deny ルール。`child.args` の後に `--disallowedTools` で渡されます。組み込みのリスト(`.env`、`.env.*`、`*.pem`、`*.key`、`id_rsa*`、`id_ed25519*`、`secrets/**`)に追加されるもので、組み込みのリストは何によっても削除されません。`--bare` は、本来それらのファイルを守るはずのフックをスキップするからです。
- `child.subscriptionArgs`: `claude/<member>` の子プロセス用のフラグで、`child.args` の代わりに使われます。デフォルトでは `--bare` なしです。`--bare` は API キー認証しか許さず、目的はあなたの Claude ログインを使うことだからです。
- `families`: ファミリーごとの `members`(エイリアス → 正確なモデル ID)と `auto`(ティア → メンバーのエイリアス。10/10 の critical ターン用に任意で `criticalPlus`)。ファミリーごとにデフォルトにマージされます。新しいファミリー名を付けると、ゲートウェイのファミリーが追加されます。
- `codex.auth`: `palgu`(デフォルト。プロバイダーが何であれ、設定したゲートウェイの `/v1/responses` をゲートウェイのキーで使う)または `chatgpt`(あなた自身の Codex ログイン)。`codex.baseUrl`: 導出される URL(Palgu: `/anthropic` → `/v1`。OpenRouter と LiteLLM: `<gateway_url>/v1`)でない場合の Responses のベース URL。`codex.sandbox`: `read-only`(デフォルト)、`workspace-write`、`danger-full-access`。[サンドボックスと承認](#サンドボックスと承認) を参照してください。`codex.allowOutsideGit`: `--skip-git-repo-check` を追加する(デフォルト `false`)。`codex.args`: 追加のフラグ。その中のサンドボックスと承認のフラグは無視されます。
- `strategy`: 最初に使うルーティング戦略。組み込み(`complexity`、`cost`、`speed`、`quality`)またはあなたのファイルの名前。`/route strategy` での選択が優先されます。[ルーティング戦略](#ルーティング戦略-複雑さコスト速度品質または独自のルールでルーティングする) を参照してください。
- `prices`: [節約額の推定](#どれだけ節約できるか) のための、ゲートウェイのモデルの 100 万トークンあたりの $。例: `{ "glm-5.3": { "input": 0.6, "output": 2.2 } }`(任意で `cacheRead`(デフォルトは入力の 10 分の 1)と `cacheWrite`)。ここのエントリは Palgu 自身の見積もりより優先されます。Palgu 以外のゲートウェイで価格のないモデルは、値付けなしとして数えられます。
- `heartbeat`: メインセッションがタスクの途中で止まったときに続行させます。`palgu`(デフォルト: Palgu がゲートウェイの場合は Palgu が判断し、それ以外の場合や Palgu が応答しない場合は同じ分類器がローカルで動く)、`local`(Palgu には決して問い合わせない)、`off`。`heartbeatMax`: あなたのプロンプト 1 つあたりの続行回数(デフォルト 3)。
- `ui.band`: プロンプトの上にバンドを描画する(デフォルト `true`)。`ui.tags`: どの返信に出所タグを付けるか。`routed`(デフォルト)、`all`、`off`。

## コマンド

| コマンド | 効果 |
| :- | :- |
| `/palgu login` | ターミナルから Palgu にサインアップまたはサインイン: ブラウザーでコードを承認すると、mod が Palgu のキーを保存し、すぐにルーティングを開始します |
| `/palgu status` | キーの持ち主と組織のプラン |
| `/palgu upgrade` | Palgu のプランと請求のページ |
| `/palgu continue [--open]` | このセッションを完全なコンテキストのまま Palgu で続けます: `cd <folder> && palgu --continue-claude=<session id>` をコピーします。`--open` は新しい macOS ターミナルのタブで起動します。Palgu はトランスクリプトを自分で読み、認証情報を伏せます |
| `/palgu memory on`、`off`、`memory` | `palgu` CLI でこのプロジェクトをバックグラウンドで Palgu メモリにインデックスし(ソースをアップロードします。デフォルトはオフ)、Claude とルーティングされるすべてのモデルについて、すべてのプロンプトに想起させます。停止します。またはインデックス済みかどうかと鮮度を示します |
| `/route update` | GitHub で新しいバージョンを確認し、あれば `claude plugin marketplace update` と `claude plugin update` を代わりに実行します。その後 `/reload-plugins` で読み込まれます |
| `/route models` | Palgu が現在提供しているモデルと、ダウンしているモデル。どれも `/route <model>` でピン留めできます。バンドは mod が知っているファミリーごとに 1 つのボタンを保持します。Palgu がない場合(または応答しない場合)は組み込みの一覧が使われます |
| `/route strategies`、`/route strategy <name>` | ルーティング戦略(complexity、cost、speed、quality、あなたの戦略)を一覧表示するか、切り替えます |
| `/route help`(またはバンドで `0`) | mod が何をするか、現在の状態、すべてのボタンとコマンド、プロバイダーへの接続方法 |
| `/route`、`/route status` | ライブか観察のみか、モード、現在の判定(ファミリーとメンバー付き)、今日のカウント、ファミリーとそのメンバー |
| `/route auto` | すべてのプロンプトを分類する(デフォルト) |
| `/route off` | 子プロセスを決して起動しない |
| `/route simple\|coding\|critical` | ティアをピン留めする |
| `/route reset` | 種別ごとの失敗の記憶をクリアする |
| `/route stats` | 統計ペインを開く: models、kinds、scores、recent |
| `/route glm`、`/route kimi`、`/route kimi-k3.1-pro`、`/route minimax`、`/route gpt`、`/route claude` | モデルをピン留めする(プレフィックスは、設定されたモデル、次に既知のゲートウェイのモデルに展開されます。`/route upgrade` のようにどのモデルにも一致しない語はピン留めされず、auto になります) |
| `/route claude/sonnet`、`/route kimi/highspeed`、`/route codex/gpt-5.6-terra` | ファミリーのメンバーをピン留めする(`claude/sonnet` はあなたの Claude ログインで動きます) |
| `/route claude/auto`、`/route kimi/auto`、`/route codex/auto` | ファミリーをピン留めする。各プロンプトは引き続きスコア付けされ、ティアがメンバーを選びます |
| `/route codex` | Codex をデフォルトのモデルでピン留めする |

`/status` は Claude Code 自身のコマンドで、mod がそこに追加することはできません。`/route status` が mod の同等のコマンドです。また、すべての回答の下のルート行にはファミリーとメンバーが表示されます(`route: claude-sonnet-5-5 (claude/auto → sonnet) · coding 5/10 code via ollama · child 9s`)。

ピンはプラグインのストアに保存され、セッションをまたいで保持されます。

## 子プロセスにできることとできないこと

- Claude Code のツールを持ち、セッションの作業ディレクトリで動くので、読み取り、編集、実行ができます。ツール呼び出しはメインのトランスクリプトには表示されず、最終的なテキストだけが表示されます。
- パーミッションモードが許可しないコマンド(`git pull`、`npm install`、デプロイ)が必要なとき、子プロセスは自分ではあなたに尋ねられません。mod がその要求を中継します: 正確なコマンドを示した Claude Code の質問ダイアログが表示され、"Allow and continue" を選ぶと、そのコマンドだけを許可して同じ子プロセスが再開されます。`git status` や `git log` のような読み取り専用のコマンドは、すでに確認なしで実行されます。
- メインセッションの記憶は共有しません。ブリーフには直近 `contextMessages` 回のやり取り(デフォルト 12、それぞれ 1,200 文字に切り詰め)とタスクが入ります。フォローアップが子プロセスに決して行かないのはこのためです: [判定の仕組み](#判定の仕組み) を参照してください。
- デフォルトで `--bare` で動くので、シークレットを守るフックも含め、あなたのフックとプラグインは子プロセスに入りません。子プロセスは `.env` ファイル、キー、`secrets/` フォルダーを読めません: mod がそれらに対するパーミッション deny ルールを渡し(`child.deny` でさらに追加できます)、それはフックではなく Claude Code 自身によって強制されます。また mod は `MAGGY_ROUTER_CHILD` マーカーを検出し、子プロセス内では何もしません。
- タグとルート行に表示されるのは、mod が **要求した** モデルです。palgu のように意図に基づいてルーティングするゲートウェイは別のモデルで回答することがありますが、Claude Code の `-p` の出力はそれを明かさないため、mod は表示できません。
- 出力は子プロセスが終わったときに届きます。このバージョンは `$.process.run` を使うため、ルーティングされた回答はトークンごとにストリーミングされません。

## 変更履歴

各リリースには [CHANGELOG.md](../../../CHANGELOG.md) に日付付きのセクションがあり、変更と同じコミットで書かれます。`plugin.json` のバージョンにエントリがないと CI が失敗します(`npm run changelog`)。

## テスト

```bash
npm test                           # Node 上の純粋関数のテスト。Claude Code は不要
claude plugin validate --strict .  # マニフェスト + フックモジュールの静的解析
claude plugin test                 # v2.1.287+ が必要。セッションやネットワークなしでフックにイベントを送る
```

`tests/classify`、`config`、`providers`、`routing`、`families`、`codex`、`stats`、`child`、`ui` は `hooks/lib/` の純粋なロジックをカバーします。`tests/mod.test.ts` はフックをエンドツーエンドで動かします: simple のプロンプトは、環境にゲートウェイがあり stdin にブリーフがある子プロセスによって回答されること、critical のプロンプトは子プロセスを起動しないこと、失敗した子プロセスはメインモデルにフォールバックすること、キーがない場合は観察のみになること、子プロセスのセッションでは mod が無効になること、`/route off` と `/route kimi` が正しく動くこと。`tests/compliance.test.ts` は `$.process.run` に何が届くかをチェックします: リテラルのプログラムとフラグ、拒否されるモデル ID、2 つの固定の更新コマンド、1 つの単純なトークンでない Palgu のキー。

## ディレクトリ構成

```
mixture-of-models-claude-mod/
├── .claude-plugin/
│   ├── plugin.json         # プラグインのマニフェスト
│   └── marketplace.json    # `claude plugin install` がこのリポジトリ内で見つけられるようにする
├── docs/adr/               # アーキテクチャの決定(0001: 子プロセスへの委任、0002: ファミリーと Codex、0003: ゲートウェイのプロバイダー)
├── scripts/test-pure.mjs   # 純粋なテストを Node で実行する
├── hooks/
│   ├── hooks.json          # register.js を指す
│   ├── register.js         # 11 個のフック登録。mods API ($) に触れる唯一のファイル
│   └── lib/                # 純粋で、ユニットテスト済み
│       ├── config.js       # デフォルトと model-config.json の上書き
│       ├── providers.js    # Palgu、OpenRouter、LiteLLM、汎用: 検出、子プロセスの認証、カタログ
│       ├── classify.js     # Maggy の事前ルーティングルール、分類器のプロンプト、Ollama のワイヤーフォーマット
│       ├── routing.js      # ティア → モデル、/route の文法、要約行
│       ├── families.js     # <family>/<member>、<family>/auto、どのランナーがルートを処理するか
│       ├── codex.js        # codex exec の argv、環境、準備状況、JSONL 出力
│       ├── child.js        # 子プロセスの argv、スコープを限定した環境と識別ヘッダー、準備状況、env ファイルのパース、ブリーフとその前置き
│       ├── version.js      # x-srooter-client 用の mod のバージョン
│       ├── vet.js          # ハンドバック、行動の要求、検証されていない主張、意図の説明、繰り返しを破棄する
│       └── stats.js        # 日ごとのカウント
└── tests/
```

mod では、すべての `$` 呼び出しが `register.js` 内にある必要があります(別のファイルに `$` を渡すと `claude plugin validate` が失敗します)。このファイルが通常の上限より多くの関数を持っているのはそのためです。

## なぜ子プロセスなのか

[ADR 0001](../../adr/0001-child-process-delegation.md) を参照してください。要するに: mod はリクエストのモデル名を変えられても、送り先は変えられません。そしてサブスクリプションのトークンをプロキシ経由でルーティングする案は却下されました。独自の環境を持つ子プロセスが、きれいな分離方法です。

## Maggy との対応

| Maggy | ここでは |
| :- | :- |
| `hooks/route-task-hook`(UserPromptSubmit、qwen3 の分類器、継続ガード、キャッシュ) | `prompt.submit` + `lib/classify.js`、Ollama への `$.http.fetch`、`$.store` のキャッシュ |
| コンテキストに注入される "You MUST delegate — run ~/bin/glm"(必ず委任せよ — ~/bin/glm を実行せよ) | `turn.step` が子プロセスを実行してその回答を返す。Claude に委任を求めることはない |
| `model_routing.py write-launcher` による `~/bin/claude-<provider>` ランチャー | mod 自身が `ANTHROPIC_BASE_URL` とキーを子プロセスの環境にスコープする |
| `hooks/usage-summary-hook`(Stop) | `turn.complete` が要約行を返す |
| `/model-config` で追従するモデル | `model-config.json` の `primary` が `coding` ティアを決める |
| `palgu` ゲートウェイ | 子プロセスのエンドポイント。メインセッションがそれを見ることはない |

`claude plugin validate` についてのみ Claude Code 2.1.274 でテストしています。使っている型は 2.1.277 の宣言からのものです。新しいビルドで最初に読み込んだ後は `.claude-plugin/types/` を確認してください。特に、子プロセスの出力をストリーミングするための `$.process.spawn` が使えるかどうかを確認してください。
