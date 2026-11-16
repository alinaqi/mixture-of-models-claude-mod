# Mixture of Models für Codex

[English](../../../../../integrations/codex/README.md) · [简体中文](../../../zh-CN/integrations/codex/README.md) · [日本語](../../../ja/integrations/codex/README.md) · **Deutsch** · [Français](../../../fr/integrations/codex/README.md) · [العربية](../../../ar/integrations/codex/README.md)

*Dies ist eine Übersetzung; die englische Version ist maßgeblich und möglicherweise aktueller.*

Palgu wählt das Modell für jeden Request, Palgu-Memory wird in jeden Prompt abgerufen, und ein Turn, der mitten in der Aufgabe stoppt, wird fortgesetzt. Dasselbe Verhalten wie beim Claude-Code-Mod, aufgebaut auf Codex' eigenen Plugins und Hooks ([ADR 0005](../../../../adr/0005-other-coding-agents.md)).

Benötigt Codex 0.163 oder neuer und Node 20 oder neuer. Palgu-Memory braucht für die Indexierung außerdem die [palgu-CLI](https://www.palgu.ai/install); sie verwendet ihr eigenes `palgu login`, falls Sie eines haben, sonst den Key von `mom`.

## Installation

```bash
# 1. Die mom-CLI (die Hooks des Plugins rufen sie auf)
npm install -g github:alinaqi/mixture-of-models-claude-mod
mom login                      # im Browser bei Palgu anmelden

# 2. Codex über Palgu routen: schreibt ~/.codex/palgu.config.toml (Ihre config.toml wird nicht angefasst)
mom setup codex --write

# 3. Das Plugin: Memory-Abruf und der Heartbeat
codex plugin marketplace add alinaqi/mixture-of-models-claude-mod
codex plugin add mixture-of-models@mixture-of-models
```

Dann Codex auf Palgu starten:

```bash
codex -p palgu
```

Beim ersten Mal bittet Codex Sie, die Hooks des Plugins zu prüfen (`/hooks`); sie führen `mom hook codex` aus und sonst nichts.

## Was es tut

| | Wie | Codex-Funktion |
| :- | :- | :- |
| **Routing** | `model = "auto"`: Palgu klassifiziert jeden Request und bedient ihn aus seinen Stufen (trivial, small, medium, think). `MOM_PIN=<model> codex -p palgu -m <model>` (zweimal dasselbe Modell) pinnt ein Modell für die Sitzung: Palgu pinnt das Modell, das ein Request nennt, nur wenn `x-srooter-pin` vorhanden ist, und lehnt `auto` mit einem Pin ab (403). | Profil `-p palgu`, `[model_providers.palgu]` mit `auth = { command = "mom", args = ["token"] }` |
| **Palgu-Memory** | `mom memory on` in einem Projektordner indexiert ihn (lädt den Quellcode zu Palgu hoch) und ruft bis zu 8 Verweise daraus in jeden Prompt mit vier Wörtern oder mehr ab. Standardmäßig aus; die Einwilligung gilt pro Ordner und wird mit den anderen Tools geteilt, die `mom` bedient. | `UserPromptSubmit` → `additionalContext` |
| **Heartbeat** | Ein Turn, der mitten in der Aufgabe endet ("Let me check the tests."), wird fortgesetzt, höchstens 3 Mal pro Prompt. Palgu entscheidet (`POST /anthropic/heartbeat`); ohne Anmeldung läuft derselbe Classifier lokal. `mom heartbeat off` schaltet ihn ab. | `Stop` → `decision: "block"` |
| **Indexierung** | In einem Ordner mit eingeschaltetem Memory läuft `palgu memory index .` beim Sitzungsstart im Hintergrund, höchstens alle 10 Minuten. | `SessionStart` |

Jeder Hook ist fail-open: Wenn `mom` einen Fehler hat oder Palgu langsam ist, macht Codex weiter, als gäbe es keinen Hook. Die Memory-Suche wartet höchstens 3 s, der Heartbeat höchstens 8 s.

## Was es wohin sendet

- An `https://api.palgu.ai/v1/responses` (Codex selbst, unter `-p palgu`): Ihre Codex-Turns, mit dem Key aus `mom token` und den Headern `x-srooter-client: mixture-of-models-codex/<version>` sowie `x-srooter-pin` / `x-srooter-project`, wenn `MOM_PIN` / `MOM_PROJECT` gesetzt sind.
- An `https://api.palgu.ai/v1/cortex/search` (`mom`, nur in Ordnern mit eingeschaltetem Memory): den Prompt (eine Zeile, höchstens 300 Zeichen) und den Palgu-Namen des Projekts.
- An `https://api.palgu.ai/anthropic/heartbeat` (`mom`, außer bei `mom heartbeat local|off`): die letzten 600 Zeichen der Antwort von Codex und eine Sitzungs-ID.
- Der Key liegt in `~/.config/mixture-of-models/credentials.json` (Modus 0600) oder `PALGU_API_KEY`. Er wird nie in die Konfiguration von Codex geschrieben.

## Anders als beim Claude-Code-Mod

- Das Routing besteht aus Palgus Stufen, nicht aus dem Classifier und den Strategien des Mods: Codex-Hooks können das Modell eines Turns nicht ändern.
- Keine Slash-Befehle `/route` oder `/palgu` (Codex hat eigene Befehle entfernt); der Skill `mixture-of-models` sagt Codex, welche `mom`-Befehle es vorschlagen soll.
- Plugins mit Hooks können nicht in Codex' öffentlichem Plugin-Verzeichnis gelistet werden, daher wird es aus dem Marketplace dieses Repositorys installiert.
