# Aider、Continue、Goose での Mixture of Models

[English](../../../../../integrations/gateway/README.md) · [简体中文](../../../zh-CN/integrations/gateway/README.md) · **日本語** · [Deutsch](../../../de/integrations/gateway/README.md) · [Français](../../../fr/integrations/gateway/README.md) · [العربية](../../../ar/integrations/gateway/README.md)

*これは翻訳です。正式な版は英語版であり、英語版のほうが新しい場合があります。*

これらのエージェントには `mom` が利用できるフックやプラグインがないため、使えるのは Palgu のルーティングだけです: エージェントを Palgu の OpenAI 互換エンドポイントにモデル `auto` で向けると、Palgu がリクエストごとにモデルを選びます([ADR 0005](../../../../adr/0005-other-coding-agents.md))。Palgu メモリの想起とハートビートはここでは使えません。

どのガイドにも Palgu のキーが必要です。`mom` をインストールしていれば(`npm install -g github:alinaqi/mixture-of-models-claude-mod`)、一度 `mom login` を実行すると、その後は `mom token` がキーを表示します。

## Palgu がリクエストをどう読むか

2026-11-16 に `https://api.palgu.ai/v1/chat/completions` で確認:

| `model` | `x-srooter-pin` ヘッダー | 結果 |
| :- | :- | :- |
| `auto` | なし | Palgu がルーティング(1 語の回答には `deepseek-pro` が使われた) |
| 任意のモデル、例: `glm-5.3` | なし | それでも Palgu がルーティング: model フィールドはピンではない |
| モデル、例: `kimi-k3.1-pro` | あり(同じモデル ID を送る) | そのモデルにピン留め |
| `auto` | あり | 拒否、403 `pin 'auto' not allowed by policy` |

つまり: Palgu に選ばせるにはモデルを `auto` のままにし、ピン留めするにはモデルを設定し、**かつ** `x-srooter-pin` を送ります。ピン留めしたモデルがダウンしている場合は 503 が返るので、`GET /v1/models/health` から別のモデルを選んでください。

## Aider

aider-chat 0.86.2 で実機確認済み: Palgu 経由の `model openai/auto` でファイルへの編集が適用されました。

```bash
export OPENAI_API_KEY="$(mom token)"
aider --openai-api-base https://api.palgu.ai/v1 --model openai/auto
```

または `.aider.conf.yml` で:

```yaml
openai-api-base: https://api.palgu.ai/v1
model: openai/auto
```

`.aider.model.settings.yml` でクライアント名を指定すると、Palgu のダッシュボードがそのトラフィックを Mixture of Models として表示します:

```yaml
- name: aider/extra_params
  extra_params:
    extra_headers:
      x-srooter-client: mixture-of-models-aider/0.27.0
```

Aider は `auto` のコンテキストウィンドウを知らないため警告を出します。`.aider.model.metadata.json` で伝えてください(または `--no-show-model-warnings` を渡します):

```json
{ "openai/auto": { "max_input_tokens": 200000, "max_output_tokens": 32000, "input_cost_per_token": 0, "output_cost_per_token": 0, "litellm_provider": "openai", "mode": "chat" } }
```

モデルをピン留めするには、ヘッダー付きのエントリを追加し、`--model openai/<model>` を使います:

```yaml
- name: openai/kimi-k3.1-pro
  extra_params:
    extra_headers:
      x-srooter-pin: kimi-k3.1-pro
```

Aider のアーキテクトモード(`--architect --editor-model openai/auto`)は計画と編集を別々のリクエストとして送り、Palgu はそれらを別々にルーティングします。

## Continue

ここでは実行していません。Continue の設定リファレンス(`config.yaml`)より:

```yaml
models:
  - name: Palgu (auto)
    provider: openai
    model: auto
    apiBase: https://api.palgu.ai/v1
    apiKey: <your key from mom token>
    requestOptions:
      headers:
        x-srooter-client: mixture-of-models-continue/0.27.0
    roles: [chat, edit, apply]
```

Palgu のルーティングはチャットのターン向けなので、オートコンプリートには専用のモデル(小さく速いもので、`model: <id>` とヘッダー `x-srooter-pin: <id>` でピン留めしたもの)を使ってください。

## Goose

ここでは実行していません。Goose のプロバイダーのドキュメント(カスタムホストを指定した OpenAI プロバイダー)より:

```bash
export GOOSE_PROVIDER=openai
export GOOSE_MODEL=auto
export OPENAI_HOST=https://api.palgu.ai
export OPENAI_BASE_PATH=v1/chat/completions
export OPENAI_API_KEY="$(mom token)"
goose session
```

## ここにないもの

- Palgu メモリの想起とハートビートには、コンテキストを追加したりターンを続行したりするフックが必要ですが、これらのエージェントにはありません。それらが必要なら、`mom` と一緒に Codex、Cursor、OpenCode を使ってください。
- これらの設定でのキーは、平文の値か環境変数です。コミットするファイルには入れないでください。
