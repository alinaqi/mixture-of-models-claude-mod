# Mixture of Models für GitHub Copilot CLI

[English](../../../../../integrations/copilot/README.md) · [简体中文](../../../zh-CN/integrations/copilot/README.md) · [日本語](../../../ja/integrations/copilot/README.md) · **Deutsch** · [Français](../../../fr/integrations/copilot/README.md) · [العربية](../../../ar/integrations/copilot/README.md)

*Dies ist eine Übersetzung; die englische Version ist maßgeblich und möglicherweise aktueller.*

Der Heartbeat, der einen mitten in der Aufgabe gestoppten Turn fortsetzt, Palgu-Memory und Palgus Modelle als Tools, in GitHub Copilot CLI ([ADR 0005](../../../../adr/0005-other-coding-agents.md)).

Live geprüft mit Copilot CLI 1.0.112.

## Installation

```bash
npm install -g github:alinaqi/mixture-of-models-claude-mod   # installiert mom (die Hooks und der MCP-Server des Plugins führen es aus)
mom login                                                     # bei Palgu anmelden
copilot plugin install alinaqi/mixture-of-models-claude-mod:integrations/copilot
copilot plugin list                                           # mixture-of-models
```

Zum Ausprobieren ohne Installation: `copilot --plugin-dir "$(npm root -g)/mixture-of-models-claude-mod/integrations/copilot"`.

Dann, in einem Projekt, das Sie in Palgu-Memory haben wollen: `mom memory on` (lädt den Quellcode zu Palgu hoch; standardmäßig aus, pro Ordner, geteilt mit den anderen Agents, die `mom` bedient).

## Was es tut

| | Wie | Copilot-Funktion |
| :- | :- | :- |
| **Heartbeat** | Ein Turn, der mitten in der Aufgabe endet ("Let me check the tests."), wird fortgesetzt, höchstens 3 Mal pro Prompt. Palgu entscheidet (`POST /anthropic/heartbeat`); ohne Anmeldung läuft derselbe Classifier lokal. `mom heartbeat off` schaltet ihn ab. | `agentStop` → `decision: "block"` mit dem Fortsetzungs-Prompt als `reason`; die Antwort wird aus der `events.jsonl` der Sitzung gelesen, da die Stop-Eingabe sie nicht enthält |
| **Palgu-Memory** | Der Agent durchsucht das Palgu-Memory des Projekts mit `palgu_memory_search` (der Skill sagt ihm, wann); beim Sitzungsstart in einem Ordner mit eingeschaltetem Memory wird ihm mitgeteilt, dass Memory an ist. | MCP-Server (`.mcp.json`, `mom mcp copilot`), `sessionStart` → `additionalContext`, Skill `mixture-of-models` |
| **Palgus Modelle als Tools** | `palgu_delegate` übergibt eine in sich abgeschlossene Teilaufgabe an ein Palgu-Modell (`auto` oder gepinnt); `palgu_models` listet sie auf. | MCP-Server |
| **Indexierung** | `palgu memory index .` im Hintergrund beim Sitzungsstart in einem Ordner mit eingeschaltetem Memory, höchstens alle 10 Minuten. | `sessionStart` |

Jeder Hook ist fail-open: Wenn `mom` einen Fehler hat oder Palgu langsam ist, macht Copilot weiter, als gäbe es keinen Hook.

## Anders als beim Claude-Code-Mod

- **Kein Routing pro Prompt für Copilots eigene Turns.** Copilots Hooks können das Modell nicht ändern, und die Ausgabe eines Command-Hooks bei `userPromptSubmitted` wird verworfen, sodass Memory auch nicht zu jedem Prompt hinzugefügt werden kann: Es kommt über das MCP-Tool. Palgus Routing erreicht Copilot über `palgu_delegate`. Copilot kann Palgu außerdem als BYOK-Provider vom Typ `anthropic` verwenden (`https://api.palgu.ai/anthropic`, Modell `auto`), ein Modell pro Sitzung; siehe GitHubs BYOK-Doku.
- Keine Befehle `/route` oder `/palgu`; das erledigt `mom` in einem Terminal.

## Was es wohin sendet

- An `https://api.palgu.ai/anthropic/heartbeat` (außer bei `mom heartbeat local|off`): die letzten 600 Zeichen der Antwort und eine Sitzungs-ID.
- An `https://api.palgu.ai/v1/cortex/search` (nur wenn der Agent `palgu_memory_search` in einem Ordner mit eingeschaltetem Memory aufruft): die Suchanfrage (höchstens 300 Zeichen) und den Palgu-Namen des Projekts.
- An `https://api.palgu.ai/v1/chat/completions` (nur wenn der Agent `palgu_delegate` aufruft): den Prompt der Teilaufgabe.
- Der Key bleibt in `~/.config/mixture-of-models/credentials.json` (0600) oder `PALGU_API_KEY`; die Dateien des Plugins enthalten keinen.

## Live beobachtet (Copilot CLI 1.0.112)

- Hooks im `.github/hooks/` eines Repositorys liefen unter `copilot -p` in einem nicht vertrauenswürdigen Ordner nicht; dieselben Hooks in einem Plugin (`--plugin-dir` oder installiert) liefen.
- Der Fortsetzungs-Prompt aus `agentStop` kommt als neues `userPromptSubmitted` zurück; `mom` erkennt ihn als seinen eigenen und behält so den Prompt der Person und das Budget von 3 Fortsetzungen bei.
- Der MCP-Server eines Plugins startet im Ordner des Plugins; der Ordner der Sitzung ist `COPILOT_SESSION_CWD`, den `mom mcp` verwendet.
- Das Transkript ist `~/.copilot/session-state/<session>/events.jsonl` (oder unter `$COPILOT_HOME`); die Antworten des Modells sind `assistant.message`-Events. `mom` liest nur `.jsonl`-Dateien unter diesem Ordner, und nur die letzten 256 KB.
- `copilot` lehnt ein klassisches `GITHUB_TOKEN` ab; melden Sie sich mit `/login` an (starten Sie es mit `env -u GITHUB_TOKEN -u GH_TOKEN copilot`, falls eines gesetzt ist).
