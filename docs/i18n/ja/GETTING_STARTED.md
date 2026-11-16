# はじめに

[English](../../../GETTING_STARTED.md) · [简体中文](../zh-CN/GETTING_STARTED.md) · **日本語** · [Deutsch](../de/GETTING_STARTED.md) · [Français](../fr/GETTING_STARTED.md) · [العربية](../ar/GETTING_STARTED.md)

*これは翻訳です。正式な版は英語版であり、英語版のほうが新しい場合があります。*

## 1. Claude Code を確認する

```bash
claude --version     # 2.1.287 以降が必要
# 古すぎる場合は次のいずれか:
brew install --cask claude-code@latest            # Homebrew(安定版の cask は遅れている)
npm install -g @anthropic-ai/claude-code@<version>   # npm: 2.1.287 以降のバージョン
claude update                                     # ネイティブインストーラー
```

## 2. インストールする

まずダウンロードし、スクリプトを読んでから実行してください(スクリプトは `claude plugin` を呼び出し、`config.example.json` をコピーするだけです):

```bash
git clone https://github.com/alinaqi/mixture-of-models-claude-mod
cd mixture-of-models-claude-mod
less install.sh     # 内容を確認する
./install.sh
```

または手動で:

```bash
claude plugin marketplace add alinaqi/mixture-of-models-claude-mod
claude plugin install mixture-of-models@mixture-of-models-claude-mod
```

またはセッション内から: `/plugin install mixture-of-models --marketplace alinaqi/mixture-of-models-claude-mod`

代わりに改造したい場合は、1 つのセッションでチェックアウトを読み込みます: `claude --plugin-dir .`

## 3. 子プロセスにゲートウェイを与える

子プロセスの Claude Code には、ルートのモデル ID を提供する Anthropic 互換のエンドポイントが必要です。[palgu](https://www.palgu.ai) の場合は、セッション内で:

```
/plugin configure mixture-of-models@mixture-of-models-claude-mod
```

を実行し、`https://api.palgu.ai/anthropic` とあなたのキーを入力します。キーはマスクされ、セキュアストレージに保存されます。

代わりにシェルから: `claude plugin configure mixture-of-models@mixture-of-models-claude-mod --values-stdin` を実行し、入力に `{"gateway_url":"https://api.palgu.ai/anthropic","gateway_key":"<your key>"}` を入力して Ctrl-D を押します。こうするとキーがシェルの履歴に残りません。

メインセッションには `ANTHROPIC_BASE_URL` は **不要** です。メインセッションはサブスクリプション上に残ります。

## 4. 任意: 調整する

ルート、しきい値、子プロセスのフラグを変更するには、`config.example.json` の `router` ブロックを `~/.claude/model-config.json` にコピーしてください。始めるだけなら不要です。

注意点が 1 つ: シェルで export した `ANTHROPIC_API_KEY` は、メインセッションの claude.ai ログインより優先されます。メインセッションをサブスクリプションで動かしたい場合は、未設定のままにしてください。

## 5. 任意: Codex

`codex` のルートを使うには Codex CLI をインストールします: `brew install --cask codex`(または `npm install -g @openai/codex@<version>`)。デフォルトでは、ステップ 3 のキーを使って Palgu ゲートウェイの `/v1/responses` で動きます。代わりにあなた自身の ChatGPT ログインを使うには、`codex login` を実行し、`~/.claude/model-config.json` に `"router": { "codex": { "auth": "chatgpt" } }` を設定してください。

## 6. 任意: 無料の分類

```bash
ollama pull qwen2.5-coder:3b
```

Ollama がない場合、分類器はあなたのプランの `claude-haiku-5-5` にフォールバックします。

## 7. 試してみる

```
claude
/route                      → live · mode auto · current route ...
grep the repo for TODOs     → spinner shows "via glm-5.3 (child)…", answer comes from the child
/route kimi                 → pin the next turns to Kimi
/route auto                 → back to classification
/route claude/sonnet        → the next turns run on claude-sonnet-5-5, on your Claude login
/route kimi/auto            → the score picks kimi-k3.1-pro-highspeed or kimi-k3.1-pro
/route codex                → the next turns run on the Codex CLI (needs `npm install -g @openai/codex`)
/route status               → mode, current family and member, the families
/route stats                → a pane charting which models took your turns, kinds, scores, recent decisions
```

上の各行の意味: `/route` はルートの状態を表示します。`grep the repo for TODOs`(リポジトリの TODO を grep して)では、スピナーに "via glm-5.3 (child)…" と表示され、回答は子プロセスから来ます。`/route kimi` は以降のターンを Kimi にピン留めし、`/route auto` は分類に戻します。`/route claude/sonnet` では以降のターンがあなたの Claude ログイン上の claude-sonnet-5-5 で実行されます。`/route kimi/auto` ではスコアが kimi-k3.1-pro-highspeed か kimi-k3.1-pro を選びます。`/route codex` では以降のターンが Codex CLI で実行されます(`npm install -g @openai/codex` が必要)。`/route status` はモード、現在のファミリーとメンバー、ファミリーの一覧を表示し、`/route stats` は、どのモデルがターンを受け持ったか、種別、スコア、直近の判定をグラフで示すペインを開きます。
