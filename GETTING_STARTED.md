# Getting started

## 1. Check Claude Code

```bash
claude --version     # needs 2.1.287 or later; otherwise: claude update
```

## 2. Install

```bash
git clone https://github.com/alinaqi/mixture-of-models-claude-mod
cd mixture-of-models-claude-mod && ./install.sh
```

Or by hand:

```bash
claude plugin marketplace add alinaqi/mixture-of-models-claude-mod
claude plugin install mixture-of-models@mixture-of-models-claude-mod
```

To hack on it instead, load the checkout for one session: `claude --plugin-dir .`

## 3. Give the child a gateway

The child Claude Code needs an Anthropic-compatible endpoint that serves the model ids in your routes. With [palgu](https://www.palgu.ai), in a session:

```
/plugin configure mixture-of-models@mixture-of-models-claude-mod
```

and enter `https://api.palgu.ai/anthropic` and your key. The key is masked and kept in secure storage.

From the shell instead: `echo '{"gateway_url":"https://api.palgu.ai/anthropic","gateway_key":"srt_…"}' | claude plugin configure mixture-of-models@mixture-of-models-claude-mod --values-stdin`

Your main session needs **no** `ANTHROPIC_BASE_URL`. It stays on your subscription.

## 4. Optional: free classification

```bash
ollama pull qwen2.5-coder:3b
```

Without Ollama the classifier falls back to `claude-haiku-4-5` on your plan.

## 5. Try it

```
claude
/route                      → live · mode auto · current route ...
grep the repo for TODOs     → spinner shows "via glm-5.3 (child)…", answer comes from the child
/route kimi                 → pin the next turns to Kimi
/route auto                 → back to classification
```
