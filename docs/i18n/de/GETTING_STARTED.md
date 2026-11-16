# Erste Schritte

[English](../../../GETTING_STARTED.md) · [简体中文](../zh-CN/GETTING_STARTED.md) · [日本語](../ja/GETTING_STARTED.md) · **Deutsch** · [Français](../fr/GETTING_STARTED.md) · [العربية](../ar/GETTING_STARTED.md)

*Dies ist eine Übersetzung; die englische Version ist maßgeblich und möglicherweise aktueller.*

## 1. Claude Code prüfen

```bash
claude --version     # benötigt 2.1.287 oder neuer
# zu alt? eine der folgenden Möglichkeiten:
brew install --cask claude-code@latest            # Homebrew (der stabile Cask hinkt hinterher)
npm install -g @anthropic-ai/claude-code@<version>   # npm: eine Version ab 2.1.287
claude update                                     # nativer Installer
```

## 2. Installieren

Erst herunterladen, das Skript lesen, dann ausführen (es ruft nur `claude plugin` auf und kopiert `config.example.json`):

```bash
git clone https://github.com/alinaqi/mixture-of-models-claude-mod
cd mixture-of-models-claude-mod
less install.sh     # prüfen
./install.sh
```

Oder von Hand:

```bash
claude plugin marketplace add alinaqi/mixture-of-models-claude-mod
claude plugin install mixture-of-models@mixture-of-models-claude-mod
```

Oder aus einer Sitzung heraus: `/plugin install mixture-of-models --marketplace alinaqi/mixture-of-models-claude-mod`

Um stattdessen daran zu entwickeln, laden Sie den Checkout für eine Sitzung: `claude --plugin-dir .`

## 3. Dem Child ein Gateway geben

Das Child-Claude-Code braucht einen Anthropic-kompatiblen Endpoint, der die Modell-IDs in Ihren Routen bereitstellt. Mit [palgu](https://www.palgu.ai), in einer Sitzung:

```
/plugin configure mixture-of-models@mixture-of-models-claude-mod
```

und geben Sie `https://api.palgu.ai/anthropic` und Ihren Key ein. Der Key wird maskiert und im sicheren Speicher abgelegt.

Stattdessen aus der Shell: Führen Sie `claude plugin configure mixture-of-models@mixture-of-models-claude-mod --values-stdin` aus, tippen Sie `{"gateway_url":"https://api.palgu.ai/anthropic","gateway_key":"<your key>"}` in die Eingabe und drücken Sie dann Ctrl-D, damit der Key nicht in Ihrer Shell-History landet.

Ihre Hauptsitzung braucht **kein** `ANTHROPIC_BASE_URL`. Sie bleibt auf Ihrem Abo.

## 4. Optional: anpassen

Kopieren Sie den `router`-Block aus `config.example.json` nach `~/.claude/model-config.json`, um Routen, Schwellen oder die Flags des Child zu ändern. Für den Start nicht nötig.

Ein Hinweis zur Vorsicht: Ein in Ihrer Shell exportiertes `ANTHROPIC_API_KEY` überschreibt den claude.ai-Login für die Hauptsitzung. Lassen Sie es ungesetzt, wenn die Hauptsitzung auf Ihrem Abo laufen soll.

## 5. Optional: Codex

Für `codex`-Routen installieren Sie die Codex CLI: `brew install --cask codex` (oder `npm install -g @openai/codex@<version>`). Standardmäßig läuft sie auf `/v1/responses` Ihres Palgu-Gateways mit dem Key aus Schritt 3. Um stattdessen Ihren eigenen ChatGPT-Login zu verwenden, führen Sie `codex login` aus und setzen `"router": { "codex": { "auth": "chatgpt" } }` in `~/.claude/model-config.json`.

## 6. Optional: kostenlose Klassifizierung

```bash
ollama pull qwen2.5-coder:3b
```

Ohne Ollama fällt der Classifier auf `claude-haiku-5-5` in Ihrem Plan zurück.

## 7. Ausprobieren

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

Was die Zeilen oben bewirken: `/route` zeigt den Live-Zustand; eine Anfrage wie "grep the repo for TODOs" läuft im Child (der Spinner zeigt "via glm-5.3 (child)…"); `/route kimi` pinnt die nächsten Turns auf Kimi; `/route auto` kehrt zur Klassifizierung zurück; `/route claude/sonnet` führt die nächsten Turns auf `claude-sonnet-5-5` mit Ihrem Claude-Login aus; bei `/route kimi/auto` wählt die Bewertung `kimi-k3.1-pro-highspeed` oder `kimi-k3.1-pro`; `/route codex` führt die nächsten Turns auf der Codex CLI aus; `/route status` zeigt Modus, aktuelle Familie und Mitglied sowie die Familien; `/route stats` öffnet einen Bereich mit Diagrammen dazu, welche Modelle Ihre Turns übernommen haben, Arten, Bewertungen und jüngste Entscheidungen.
