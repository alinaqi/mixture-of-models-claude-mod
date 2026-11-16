# Mixture of Models für Antigravity

[English](../../../../../integrations/antigravity/README.md) · [简体中文](../../../zh-CN/integrations/antigravity/README.md) · [日本語](../../../ja/integrations/antigravity/README.md) · **Deutsch** · [Français](../../../fr/integrations/antigravity/README.md) · [العربية](../../../ar/integrations/antigravity/README.md)

*Dies ist eine Übersetzung; die englische Version ist maßgeblich und möglicherweise aktueller.*

Palgu-Memory, in jeden Prompt abgerufen, der Heartbeat, der einen mitten in der Aufgabe gestoppten Turn fortsetzt, und Palgus Modelle als Tools, in Googles Antigravity CLI (`agy`) ([ADR 0005](../../../../adr/0005-other-coding-agents.md)).

Live geprüft mit agy 1.0.7.

## Installation

```bash
npm install -g github:alinaqi/mixture-of-models-claude-mod   # installiert mom und die Dateien dieses Plugins
mom login                                                     # bei Palgu anmelden
agy plugin install "$(npm root -g)/mixture-of-models-claude-mod/integrations/antigravity"
agy plugin list                                               # mixture-of-models, aktiviert
```

Dann, in einem Projekt, das Sie in Palgu-Memory haben wollen: `mom memory on` (lädt den Quellcode zu Palgu hoch; standardmäßig aus, pro Ordner, geteilt mit den anderen Agents, die `mom` bedient).

## Was es tut

| | Wie | Antigravity-Funktion |
| :- | :- | :- |
| **Palgu-Memory** | Beim ersten Modellaufruf jedes Turns werden in einem Ordner mit eingeschaltetem Memory bis zu 8 Verweise aus dem Palgu-Memory des Projekts (festgehaltene Absichten und ADRs, Doku, Code-Symbole) für das Modell hinzugefügt. | `PreInvocation` (`invocationNum` 0) → `injectSteps` `ephemeralMessage` |
| **Heartbeat** | Ein Turn, der mitten in der Aufgabe endet ("Let me check the tests."), wird fortgesetzt, höchstens 3 Mal pro Prompt. Palgu entscheidet (`POST /anthropic/heartbeat`); ohne Anmeldung läuft derselbe Classifier lokal. `mom heartbeat off` schaltet ihn ab. | `Stop` → `decision: "continue"`; die Antwort wird aus dem Transkript gelesen, da die Stop-Eingabe sie nicht enthält |
| **Indexierung** | `palgu memory index .` im Hintergrund beim Sitzungsstart in einem Ordner mit eingeschaltetem Memory, höchstens alle 10 Minuten. | `SessionStart` |
| **Palgus Modelle als Tools** | `palgu_memory_search`, `palgu_delegate` (übergibt eine in sich abgeschlossene Teilaufgabe an ein Palgu-Modell, `auto` oder gepinnt) und `palgu_models`, mit einer immer aktiven Regel, wann sie zu verwenden sind. | `mcp_config.json` (`mom mcp antigravity`), `rules/AGENTS.md` |

Jeder Hook ist fail-open: Wenn `mom` einen Fehler hat oder Palgu langsam ist, macht `agy` weiter, als gäbe es keinen Hook.

## Routing

Antigravitys Hooks können das Modell nicht ändern, und seine eigene Modelleinstellung akzeptiert nur Gemini-Modelle (oder ein Enterprise-Modell-Gateway, das ein Admin konfiguriert). Die eigenen Turns des Agents bleiben also auf dem Gemini-Modell, das Sie in `agy` wählen; Palgus Routing erreicht ihn über `palgu_delegate`, das er laut der Regel für risikoarme, in sich abgeschlossene Teilaufgaben verwenden soll.

## Was es wohin sendet

- An `https://api.palgu.ai/v1/cortex/search` (nur in Ordnern mit eingeschaltetem Memory): den Prompt (eine Zeile, höchstens 300 Zeichen) und den Palgu-Namen des Projekts.
- An `https://api.palgu.ai/anthropic/heartbeat` (außer bei `mom heartbeat local|off`): die letzten 600 Zeichen der Antwort und eine Sitzungs-ID.
- An `https://api.palgu.ai/v1/chat/completions` (nur wenn der Agent `palgu_delegate` aufruft): den Prompt der Teilaufgabe.
- Der Key bleibt in `~/.config/mixture-of-models/credentials.json` (0600) oder `PALGU_API_KEY`; die Dateien des Plugins enthalten keinen.

## Live beobachtet, abweichend von der Doku (agy 1.0.7)

- Die Hook-Eingabe enthält `hookEventName` und `cwd`; das Fortsetzungs-Flag ist `continuationActive`.
- Ein Turn, der mit einer Antwort endet, stoppt mit `terminationReason: "NO_TOOL_CALL"` (die Doku sagt `model_stop`), ein fehlgeschlagener mit `ERROR`; nur Ersterer wird fortgesetzt.
- Das Transkript (`transcriptPath`) ist JSONL; die Antworten des Modells sind `PLANNER_RESPONSE`-Schritte.
- Wenn `agy` mit `PERMISSION_DENIED on resource project <id>` fehlschlägt, ist das Google-Cloud-Projekt in `~/.gemini/antigravity-cli/settings.json` (`gcp.project`) eines, das Ihr Konto nicht nutzen kann: Setzen Sie eines, das Sie nutzen können, oder verwenden Sie einen Gemini-API-Key mit `"modelProvider": "gemini"` und `GEMINI_API_KEY`.
