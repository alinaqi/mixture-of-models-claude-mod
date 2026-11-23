# プライバシーポリシー

[English](../../../PRIVACY.md) · [简体中文](../zh-CN/PRIVACY.md) · **日本語** · [Deutsch](../de/PRIVACY.md) · [Français](../fr/PRIVACY.md) · [العربية](../ar/PRIVACY.md)

*これは翻訳です。正式な版は英語版であり、英語版のほうが新しい場合があります。*

mixture-of-models は、完全にあなたのマシン上で動く Claude Code のプラグインです。作者が運営するサーバーはなく、アカウントもなく、テレメトリーもありません。

## プラグインが何を、誰に送信するか

- **Palgu(`https://api.palgu.ai`)へ**、`/palgu` を実行したときのみ: `/palgu login` では、クライアント名 `mixture-of-models`、デバイス名(`Claude Code on <your HOSTNAME>`)、プラグインのバージョン、ランダムなインストール ID、続いて Palgu が発行したサインインコード。`/palgu status` では、それが誰のキーかを Palgu に問い合わせるためのゲートウェイのキー。これは設定したゲートウェイが Palgu の場合のみです。Palgu が返したキーは、`claude plugin configure --values-stdin` を通じて Claude Code がセキュアストレージに保存し、コマンドラインに載ることはありません。
- **Palgu(`https://api.palgu.ai/v1/pricing/quote`)へ**、ルーティングされたターンの後で、設定したゲートウェイが Palgu の場合のみ: モデル ID とターンの 4 つのトークン数、そしてゲートウェイのキー。Palgu が節約額の推定のためにターンを値付けできるようにするためです。プロンプトや回答のテキストは送りません。
- **GitHub(`raw.githubusercontent.com`)へ**、セッション開始時(最大 12 時間ごと)と `/route update` を実行したとき: 最新バージョンを読むための、プラグインの公開マニフェストへの単純な GET。あなたやあなたの作業に関するものは何も送りません。
- **ローカルの Ollama(`http://localhost:11434`)へ**、動いている場合: プロンプトを 1-10 でスコア付けするための、送信した各プロンプトのテキストとスコア付けのルーブリック。このために何かがあなたのマシンの外に出ることはありません。
- **Anthropic へ、Claude Code 自身の API クライアントとあなた自身のアカウントを通じて**、Ollama が応答しない場合: 同じスコアのための、同じプロンプトのテキストとルーブリック。これは Claude Code がすでにあなたのセッションに使っているのと同じ経路です。
- **あなたが設定したゲートウェイへ**(`gateway_url`: 例として `https://api.palgu.ai/anthropic` の Palgu、`https://openrouter.ai/api` の OpenRouter、あなたが運用する LiteLLM プロキシ)、あなたが提供した `gateway_key` で認証された子プロセスの Claude Code を通じて(Palgu と汎用ゲートウェイでは `x-api-key` として、OpenRouter と LiteLLM では `Authorization: Bearer` トークンとして): ルーティングされたターンのみ、あなたのプロンプトと、セッションの直近数回のやり取りの短いブリーフ(テキストのみ、切り詰め済み)、そしてその子プロセス自身のエージェントループが作業中に送るもの。そのデータのゲートウェイでの扱いは、このプラグインではなくゲートウェイ運営者のポリシーに従います。子プロセスの各リクエストには、ゲートウェイに対して子プロセスを識別する 2 つのヘッダーも付きます: `x-srooter-client: mixture-of-models/<version>`(プラグインの名前とバージョン)と `x-srooter-project: <folder name>`(セッションの作業ディレクトリの最後のセグメントを小文字にし、`a-z 0-9 . _ -` に絞ったもの)。これらにはパス、プロンプトのテキスト、その他の内容は含まれず、設定したゲートウェイにのみ、それも Palgu または汎用の Anthropic 互換ゲートウェイの場合にのみ送られます: OpenRouter と LiteLLM には送られません。ゲートウェイが設定されていない場合は何も送られず、プラグインは観察のみです。 ルーティング先のモデルがある子プロセスは、`x-srooter-pin: <model>`(応答に使うモデル)と `x-palgu-fallback: auto`(そのモデルが過負荷のとき、ゲートウェイが同等のモデルを使えるようにする)も送ります。これらも内容は含みません。

- **Anthropic へ、あなた自身の Claude ログインで**、Claude ファミリーのメンバーを指定するルート(`claude/sonnet`、`claude/auto`、…)の場合のみ: 子プロセスの Claude Code が、メインセッションと同じアカウントを通じて、同じブリーフと、そのエージェントループが作業中に送るものを送信します。
- **Codex のエンドポイントへ**、`codex` のルートの場合のみ: 子プロセスの `codex exec` が同じブリーフ(あなたのプロンプトと切り詰めた直近のやり取り)を読み、ネットワークなしの読み取り専用サンドボックス内でセッションの作業ディレクトリ(`codex.allowOutsideGit` を設定しない限り git リポジトリ)のファイルを読むことができ、そのターンで拒否されたコマンドをあなたが承認した場合、または自分で `codex.sandbox` を `workspace-write` に設定した場合にのみ、そこでファイルを編集できます。そして、エージェントループに必要なものを、あなたのゲートウェイの `/v1/responses` エンドポイント(`codex.auth: "palgu"`、デフォルト。環境変数でのみ渡される `gateway_key` を使用。OpenRouter では `https://openrouter.ai/api/v1/responses`、LiteLLM ではプロキシの `/v1/responses`)か、OpenAI(`codex.auth: "chatgpt"`。あなた自身の Codex ログインで、OpenAI のポリシーのもと)に送ります。Codex は、あなたが自分で実行するときと同じように、`~/.codex` に独自のセッションファイルを保存することがあります。プラグインがそのフォルダーを読み書きすることはありません。

プラグインはこれ以外の当事者には何も送らず、作者にも何も送りません。

## プラグインが保存するもの

あなたのマシン上の Claude Code のプラグインストアに: Palgu サインイン用のランダムなインストール ID、`/route` の設定、節約額の累計(トークンから計算したドル金額とターン数)、どのモデルが回答したかの日ごとのカウント、最後の判定、種別ごとの失敗回数、直近 200 件のルーティング判定のログ(日付、モデル、種別、ティア、スコア、どの分類器が回答したか、子プロセスの所要時間と終了コード)。プロンプトのテキスト、回答、認証情報をプラグインが保存することはありません。ゲートウェイのキーは、機密のプラグインオプションとして Claude Code がセキュアストレージに保存します。

## プラグインが読み取るもの

`~/.claude/model-config.json`(ルーティングの設定。認証情報は含まない)と、環境変数 `HOME`、`HOSTNAME`(Palgu のデバイス名のため)、`MAGGY_ROUTER_CHILD`、`ANTHROPIC_CUSTOM_HEADERS`(あなた自身が設定したカスタムヘッダーを、子プロセスからゲートウェイへのリクエストで保持するためだけに)。 `/palgu continue` では、`palgu --continue-claude=<id>` コマンドをコピーするために(`--open` では `osascript` で macOS ターミナルのタブで起動するために)セッションの id とフォルダを読みます。それ自体は何も送信しません。その後 Palgu が自身のポリシーのもとでそのセッションのトランスクリプトを読みます。

## 子ども

このプラグインは 18 歳未満の方による利用を想定していません。

## 連絡先

https://github.com/alinaqi/mixture-of-models-claude-mod/issues で issue を作成してください。
