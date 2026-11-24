# Mixture of Models für OpenCode

[English](../../../../../integrations/opencode/README.md) · [简体中文](../../../zh-CN/integrations/opencode/README.md) · [日本語](../../../ja/integrations/opencode/README.md) · **Deutsch** · [Français](../../../fr/integrations/opencode/README.md) · [العربية](../../../ar/integrations/opencode/README.md)

*Dies ist eine Übersetzung; die englische Version ist maßgeblich und möglicherweise aktueller.*

Das Plugin wählt das Palgu-Modell für jeden Prompt, fügt jedem Prompt Palgu-Memory hinzu, setzt einen Turn fort, der mitten in der Aufgabe stoppt, und ergänzt `/route` und `/palgu`. OpenCode ist neben Claude Code das einzige Tool, in dem das Plugin das Modell für jeden Request wählen kann, daher entspricht es dem Claude-Code-Mod Funktion für Funktion ([ADR 0005](../../../../adr/0005-other-coding-agents.md)).

Voraussetzungen:

- OpenCode 1.19 oder neuer. Das Plugin verwendet die V1-Server-Plugin-API; getestet mit 1.19.5.
- Node 20 oder neuer für `mom`.
- Für Palgu-Memory erledigt die [palgu-CLI](https://www.palgu.ai/install) die Indexierung.

## Installation

```bash
# 1. mom: Anmeldung, Memory-Einwilligung und der Setup-Befehl (das Plugin wird im selben Paket ausgeliefert)
npm install -g github:alinaqi/mixture-of-models-claude-mod
mom login                         # im Browser bei Palgu anmelden

# 2. Palgu als Provider und das Plugin in opencode.json
mom setup opencode                # den Block ausgeben
mom setup opencode --write        # in opencode.json zusammenführen (kopiert die alte Datei vorher nach opencode.json.bak)
```

`--write` schreibt nach `$OPENCODE_CONFIG`, falls das gesetzt ist, sonst nach `~/.config/opencode/opencode.json` (oder denselben Pfad unter `$XDG_CONFIG_HOME`). Es ändert zwei Schlüssel, `provider.palgu` und den Plugin-Eintrag, und setzt `model` nur dann auf `palgu/auto`, wenn Sie kein Standardmodell haben. Jeden anderen Schlüssel lässt es in Ruhe. Enthält die Datei Kommentare (JSONC), gibt `mom` den Block aus, und Sie führen ihn von Hand zusammen. Die Modellliste kommt von Palgu (`GET /v1/models/health`), wenn Sie angemeldet sind, sonst aus der eingebauten Liste.

Was es schreibt (gekürzt):

```json
{
  "model": "palgu/auto",
  "provider": {
    "palgu": {
      "npm": "@ai-sdk/anthropic",
      "name": "Palgu",
      "options": {
        "baseURL": "https://api.palgu.ai/anthropic/v1",
        "apiKey": "{env:PALGU_API_KEY}",
        "headers": { "x-srooter-client": "mixture-of-models-opencode/0.28.0" }
      },
      "models": { "auto": { "name": "Palgu router (auto)" }, "deepseek-v4-pro": {}, "gemini-3.8-flash": {} }
    }
  },
  "plugin": ["/usr/local/lib/node_modules/mixture-of-models-claude-mod/integrations/opencode/plugin.js"]
}
```

Der Key steht nicht in der Datei. Das Plugin fügt den Key von mom (aus `mom login` oder `PALGU_API_KEY`) zu Requests an `https://api.palgu.ai/` hinzu. Ist `PALGU_API_KEY` gesetzt, sendet OpenCode ihn außerdem selbst.

### Andere Wege, das Plugin zu laden

| Form | `plugin`-Eintrag |
| :- | :- |
| Die Datei des installierten Pakets (was `mom setup opencode` schreibt) | `"/…/node_modules/mixture-of-models-claude-mod/integrations/opencode/plugin.js"` |
| Das Paketverzeichnis (OpenCode liest `exports["./server"]`) | `"/…/node_modules/mixture-of-models-claude-mod"` |
| Eine lokale Datei in `.opencode/plugin/` (ein Projekt) oder `~/.config/opencode/plugin/` (jedes Projekt) | die Datei `mom.js` mit dem Inhalt `export { default } from '/…/integrations/opencode/plugin.js'` |
| Aus JavaScript | `import plugin from 'mixture-of-models-claude-mod/opencode'` |

Optionen kommen in ein Tupel: `["…/plugin.js", { "critical": "claude-opus" }]`.

| Option | Standard | |
| :- | :- | :- |
| `critical` | keiner | Palgu-Modell für kritische Arbeit: die Regeln des Mods ("use claude …", "execute the plan", Security- und Urteils-Prompts) oder eine Classifier-Bewertung über 7 |
| `routes` | `{}` | `{ "simple": "…", "coding": "…", "critical": "…" }`: ein Palgu-Modell für jede Stufe. Eine Stufe ohne Modell geht an `auto` |
| `ollama` | `true` | Prompts mit einem lokalen Ollama klassifizieren (`localhost:11434`, 4 s). Nur verwendet, wenn eine Route gesetzt ist |
| `ollamaModel` | `qwen2.5-coder:3b` | |
| `provider` | `palgu` | Die Provider-ID in `opencode.json`, die das Plugin routet |

## Was es tut

| | Wie | OpenCode-Funktion |
| :- | :- | :- |
| **Routing** | Jeder an `palgu/auto` gesendete Prompt geht als `auto` hinaus, und Palgu wählt die Stufe (trivial, small, medium, think). `/route <model>` pinnt ein Modell für jede Sitzung, und `/route auto` entfernt den Pin. Mit gesetztem `critical` oder `routes` wählen die Regeln und der Classifier des Mods die Stufe, und das Modell der Stufe wird gepinnt. Ein Modell, das Sie in OpenCode selbst wählen (ein `palgu/<model>`, das nicht `auto` ist), bleibt, wie es ist. Das Modell kommt an die Benutzernachricht, und `x-srooter-pin` an jeden Request. OpenCodes eigene Titel- und Zusammenfassungs-Requests werden nie gepinnt. | `chat.message` (`output.message.model`), `chat.headers` |
| **Palgu-Memory** | `mom memory on` oder `/palgu memory on` in einem Projektordner indexiert den Ordner (lädt den Quellcode zu Palgu hoch). Danach werden für jeden Prompt mit vier Wörtern oder mehr bis zu 8 Verweise daraus abgerufen und dem Systemtext dieser Nachricht hinzugefügt. Memory ist standardmäßig aus. Die Einwilligung gilt pro Ordner und wird mit jedem Tool geteilt, das `mom` bedient. | `chat.message` (`output.message.system`) |
| **Heartbeat** | Wenn eine Sitzung nach einem Turn, der mitten in der Aufgabe endete ("Let me check the tests next."), in den Leerlauf geht, sendet das Plugin den Fortsetzungs-Prompt, höchstens 3 Mal pro Prompt von Ihnen. Palgu entscheidet (`POST /anthropic/heartbeat`). Ohne Anmeldung läuft derselbe Classifier lokal. `/palgu heartbeat off` schaltet ihn ab. Subagent-Sitzungen, abgebrochene Turns und fehlgeschlagene Turns werden nie fortgesetzt. | `event` `session.idle` → `client.session.promptAsync` |
| **Indexierung** | In einem Ordner mit eingeschaltetem Memory läuft `palgu memory index .` im Hintergrund, wenn eine Sitzung startet, höchstens alle 10 Minuten. | `event` `session.created` |
| **Befehle** | `/route [auto\|<model>\|<prefix>\|status]`, `/palgu memory on\|off\|status`, `/palgu heartbeat palgu\|local\|off`, `/palgu status`. Das Plugin führt den Befehl selbst aus und zeigt das Ergebnis in einem TUI-Toast. Das Modell wiederholt dann nur diese eine Zeile, unter `auto`, sodass Palgus günstigste Stufe antwortet. | `config` (registriert `command.route` und `command.palgu`; ein eigener Befehl von Ihnen mit demselben Namen hat Vorrang), `command.execute.before`, `client.tui.showToast` |

Jeder Hook ist fail-open. Wenn etwas eine Exception wirft oder Palgu langsam ist, macht OpenCode weiter, als wäre das Plugin nicht da. Die Memory-Suche wartet höchstens 3 s, der Heartbeat höchstens 8 s. `MOM_DEBUG=1` schreibt pro Entscheidung und Request eine JSON-Zeile nach `~/.config/mixture-of-models/opencode.log`: Modell-IDs, Pins und Größen, nie den Key, einen Prompt oder abgerufenen Text.

## Was es wohin sendet

- **An `https://api.palgu.ai/anthropic/v1/messages`** (OpenCode selbst, für Provider `palgu`): Ihre OpenCode-Turns. Jeder Request trägt `x-srooter-client: mixture-of-models-opencode/<version>` und `x-srooter-project: <folder name>`, `x-srooter-pin: <model>`, wenn ein Modell gepinnt ist, und den Key.
- **An `https://api.palgu.ai/v1/cortex/search`** (das Plugin, nur in Ordnern mit eingeschaltetem Memory): den Prompt, als eine Zeile mit höchstens 300 Zeichen, und den Palgu-Namen des Projekts.
- **An `https://api.palgu.ai/anthropic/heartbeat`** (das Plugin, außer der Heartbeat ist auf `local` oder `off` gesetzt): die letzten 600 Zeichen der Antwort und eine Sitzungs-ID.
- **An `http://localhost:11434`** (nur wenn Sie `routes` oder `critical` setzen und Ollama läuft): den Prompt, für den Classifier.
- **Auf der Festplatte**: Der Key bleibt in `~/.config/mixture-of-models/credentials.json` (Modus 0600) oder `PALGU_API_KEY`. Pin und Memory-Einwilligung liegen in `state.json` im selben Ordner.

## Unterschiede zum Claude-Code-Mod

- Das Routing bleibt innerhalb eines Providers, Palgu. Ein gerouteter Turn läuft in derselben OpenCode-Sitzung mit vollständigem Verlauf und allen Tools; es gibt keinen Child-Prozess. Claude-Modelle sind nur über Palgu erreichbar.
- Ohne `critical` oder `routes` wählen Palgus eigene Stufen das Modell, nicht der Classifier des Mods, und `/route strategy` gibt es nicht.
- `/route` und `/palgu` kosten eine kurze Modellantwort, weil ein OpenCode-Befehl immer in einem Prompt endet.
- `opencode run` beendet sich, sobald die Sitzung in den Leerlauf geht, daher hat der Heartbeat dort keine Chance fortzusetzen. Er funktioniert in der TUI und unter `opencode serve`.
