# Mixture of Models für Cursor

[English](../../../../../integrations/cursor/README.md) · [简体中文](../../../zh-CN/integrations/cursor/README.md) · [日本語](../../../ja/integrations/cursor/README.md) · **Deutsch** · [Français](../../../fr/integrations/cursor/README.md) · [العربية](../../../ar/integrations/cursor/README.md)

*Dies ist eine Übersetzung; die englische Version ist maßgeblich und möglicherweise aktueller.*

Palgu-Memory durchsuchen, in sich abgeschlossene Teilaufgaben über Palgu an günstigere Modelle schicken und einen Turn fortsetzen, der mitten in der Aufgabe stoppt. Es funktioniert wie der Claude-Code-Mod, über das, was Cursor bietet: Hooks, einen MCP-Server und eine Regel ([ADR 0005](../../../../adr/0005-other-coding-agents.md)).

Benötigt Node 20 oder neuer und die `mom`-CLI in dem `PATH`, den Cursor sieht. Palgu-Memory braucht für die Indexierung außerdem die [palgu-CLI](https://www.palgu.ai/install). Sie verwendet ihr eigenes `palgu login`, falls Sie eines haben, sonst den Key von `mom`.

## Installation

```bash
# 1. Die mom-CLI (die Hooks und der MCP-Server führen sie aus)
npm install -g github:alinaqi/mixture-of-models-claude-mod
mom login                      # im Browser bei Palgu anmelden
```

Dann wählen Sie eine dieser Möglichkeiten:

- **Das Plugin.** In Cursor **Dashboard → Plugins & MCPs → Add Marketplace → Import from Repo** mit `https://github.com/alinaqi/mixture-of-models-claude-mod`, dann **Mixture of Models** unter **Customize** installieren. Um es lokal auszuprobieren, kopieren Sie `integrations/cursor` nach `~/.cursor/plugins/local/mixture-of-models` und führen **Developer: Reload Window** aus.
- **Pro Projekt, ohne das Plugin.** Im Projektordner gibt `mom setup cursor` die Einträge für `.cursor/hooks.json` und `.cursor/mcp.json` aus; `mom setup cursor --write` führt sie in die vorhandenen Dateien zusammen. Es behält Ihre anderen Hooks und Server und speichert eine `.bak` jeder Datei, die es ändert. Danach das Fenster neu laden. Auf diesem Weg bekommen Sie die Hooks und den MCP-Server, aber nicht die Regel. Kopieren Sie `integrations/cursor/rules/mixture-of-models.mdc` nach `.cursor/rules/`, wenn Sie sie haben wollen.

Wenn Cursor `mom` nicht findet (eine aus dem Dock gestartete App sieht npms globales bin-Verzeichnis möglicherweise nicht), verwenden Sie den vollständigen Pfad aus `which mom` in den Hooks und in `mcp.json`.

## Was es tut

| | Wie | Cursor-Funktion |
| :- | :- | :- |
| **Palgu-Memory** | `mom memory on` in einem Projektordner indexiert ihn (das lädt den Quellcode zu Palgu hoch). Der Agent durchsucht es dann zu Beginn einer Aufgabe mit `palgu_memory_search` und bekommt bis zu 8 Verweise zurück. Beim Sitzungsstart teilt der Hook dem Agent mit, dass Memory an ist. Memory ist standardmäßig aus. Die Einwilligung gilt pro Ordner und wird mit jedem Tool geteilt, das `mom` bedient. | MCP-Tool; `sessionStart` → `additional_context`; die Regel |
| **Delegation** | `palgu_delegate {prompt, model?}` schickt eine in sich abgeschlossene Teilaufgabe an Palgu (`model: "auto"`, sodass Palgu die Stufe wählt, oder ein Modell, das Sie pinnen) und gibt die Antwort zurück. Die Regel beschränkt es auf risikoarme Arbeit (Tests entwerfen, Boilerplate, Doku, Nachschlagen) und schließt sicherheitskritische Arbeit und Secrets aus. `palgu_models` listet die Modelle auf, die Palgu bereitstellt. | MCP-Tools; die Regel |
| **Heartbeat** | Wenn ein Turn mitten in der Aufgabe endet ("Now I'll run the tests." und dann nichts), sendet der Hook eine Folgenachricht, höchstens 3 Mal pro Prompt. Palgu entscheidet (`POST /anthropic/heartbeat`). Ohne Anmeldung läuft derselbe Classifier lokal. Ein Turn, den Sie abbrechen, wird nie fortgesetzt. `mom heartbeat off` schaltet ihn ab. | `afterAgentResponse` behält die Antwort; `stop` → `followup_message` (`loop_limit: 3`) |
| **Indexierung** | In einem Ordner mit eingeschaltetem Memory läuft `palgu memory index .` beim Sitzungsstart im Hintergrund, höchstens alle 10 Minuten. | `sessionStart` |

Jeder Hook ist fail-open. Wenn `mom` einen Fehler hat oder Palgu langsam ist, macht Cursor weiter, als wäre der Hook nicht da. Der Heartbeat wartet höchstens 8 s, die Memory-Suche 8 s und die Delegation 120 s.

## Was es wohin sendet

- An `https://api.palgu.ai/v1/chat/completions` (`palgu_delegate`, nur wenn der Agent es aufruft): den Prompt der Teilaufgabe, mit `x-srooter-client: mixture-of-models-cursor/<version>` und, wenn ein Modell gepinnt ist, `x-srooter-pin`.
- An `https://api.palgu.ai/v1/cortex/search` (`palgu_memory_search`, nur in Ordnern mit eingeschaltetem Memory): die Suchanfrage (eine Zeile, höchstens 300 Zeichen) und den Palgu-Namen des Projekts.
- An `https://api.palgu.ai/v1/models/health` (`palgu_models`): nur den Key.
- An `https://api.palgu.ai/anthropic/heartbeat` (der `stop`-Hook, außer bei `mom heartbeat local|off`): die letzten 600 Zeichen der Antwort des Agents und eine Sitzungs-ID.
- Der Key liegt in `~/.config/mixture-of-models/credentials.json` (Modus 0600) oder kommt aus `PALGU_API_KEY`. Er wird nie in Cursors Dateien geschrieben oder protokolliert. Der Zustand von `mom` (der letzte Prompt und die letzte Antwort jeder Unterhaltung, für einen Tag) liegt in `state.json` daneben.

## Wie es sich vom Claude-Code-Mod unterscheidet

- **Kein Routing pro Turn.** Cursors Hooks können das Modell nicht ändern, und eine eigene API-Basis-URL ist im Agent-Modus nicht zuverlässig. Cursors eigenes Modell erledigt die Arbeit, und nur was der Agent an `palgu_delegate` übergibt, geht an ein günstigeres Modell.
- **Memory wird abgeholt, nicht zugestellt.** `beforeSubmitPrompt` kann einen Prompt nur erlauben oder blockieren; es kann keinen Kontext hinzufügen. Memory erreicht den Agent daher über das MCP-Tool, das er laut Regel und Hinweis beim Sitzungsstart aufrufen soll, und nicht über jeden Prompt.
- **Keine Befehle `/route` oder `/palgu`.** Die Regel sagt dem Agent, welche `mom`-Befehle er vorschlagen soll.

## `mom mcp` für andere Tools

`mom mcp [tool]` ist ein schlichter MCP-Server über stdio (JSON-RPC 2.0, Protokoll `2025-06-18` oder die Version des Clients), sodass jeder Agent, der MCP-Server ausführt, ihn nutzen kann: `command: "mom", args: ["mcp", "<tool>"]`. `<tool>` benennt nur den Client in `x-srooter-client`. Den Projektordner findet er über das Argument `folder` des Tools, dann `MOM_PROJECT_DIR`, dann die MCP-Roots des Clients, dann sein Arbeitsverzeichnis.
