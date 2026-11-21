# Leitfaden: das Beste aus Mixture of Models herausholen

[English](../../../GUIDELINES.md) · [简体中文](../zh-CN/GUIDELINES.md) · [日本語](../ja/GUIDELINES.md) · **Deutsch** · [Français](../fr/GUIDELINES.md) · [العربية](../ar/GUIDELINES.md)

*Dies ist eine Übersetzung; die englische Version ist maßgeblich und möglicherweise aktueller.*

Wie Sie im Alltag mit Mixture of Models arbeiten, in jedem Coding-Agent. Die Einrichtung steht in [INSTALL.md](INSTALL.md); diese Datei setzt voraus, dass es installiert ist und Sie bei Palgu angemeldet sind.

Mixture of Models macht drei Dinge, und jeder Agent bekommt so viele davon, wie sein Plugin-System zulässt:

| | Was Sie bekommen | Wo |
| :- | :- | :- |
| **Routing** | Günstige Modelle beantworten die Arbeit, die kein teures braucht | Claude Code, OpenCode, Codex, Aider/Continue/Goose routen jeden Turn; Cursor, Antigravity und Copilot routen die Teilaufgaben, die der Agent an `palgu_delegate` übergibt |
| **Palgu-Memory** | Die festgehaltenen Absichten, Doku und Code-Symbole des Projekts kommen zum Modell zurück, wenn sie relevant sind | In jeden Prompt abgerufen: Claude Code, OpenCode, Codex, Antigravity. Bei Bedarf durchsucht (`palgu_memory_search`): Cursor, Copilot, Antigravity |
| **Heartbeat** | Ein Turn, der mitten in der Aufgabe stoppt ("Let me check the tests."), wird fortgesetzt, höchstens 3 Mal pro Prompt | Jeder Agent mit Hooks (nicht Aider, Continue, Goose) |

## Grobe Ersparnis: nur Abo vs. Mixture of Models

Aus unserer eigenen Nutzung, mit rund um die Uhr laufenden Coding-Agents auf einem Claude-Max-20x-Abo:

| | Das wöchentliche Claude-Limit reicht | Claude-Nutzung pro Tag |
| :- | :- | :- |
| Nur Abo | etwa 3 Tage, dann warten die Agents auf den Reset | 100% |
| Mit Mixture of Models | die vollen 7 Tage | etwa 43% oder weniger (3/7), da dieselbe Arbeit in die Woche gepasst hat |

Das Routing hat also **mehr als die Hälfte** der Claude-Last vom Abo genommen: Dieselbe Arbeit läuft die ganze Woche, statt an Tag 3 zu stoppen, ohne größeren Plan. Die gerouteten Turns rechnet Palgu zu den Tarifen günstiger Modelle ab, und sie zählen gegen Ihr Palgu-Budget (`mom status`, `/palgu status`).

Diese Zahlen sind grob. Sie hängen von Ihrer Arbeit ab: Viel Nachschlagen, Tests, Doku und kleine Änderungen routen den Großteil der Last weg, während Security-, Architektur- und Produktionsarbeit absichtlich bei Claude bleibt. Für Ihre eigenen Zahlen bepreist Claude Code jeden Turn: `/route status` zeigt die laufende Summe (zum Beispiel `saved ~$12.40 (61%) vs all claude-opus-5-5, at API prices`), und `/route stats` schlüsselt sie nach Modell und Art auf. Bei einem Abo ist dieser Wert das, was dieselben Tokens zu API-Preisen kosten würden, kein zurückerstattetes Geld; der praktische Gewinn ist, dass das Limit länger reicht.

## Die zehn Regeln, die überall gelten

1. **Lassen Sie es entscheiden. Wählen Sie keine Modelle.** Das Modell zu wählen ist die Aufgabe des Systems: Palgu (oder in Claude Code der Classifier des Mods) bewertet jeden Request und schickt ihn an das günstigste Modell, das ihn erledigen kann, hält kritische Arbeit auf Ihrem stärksten Modell und fällt zurück, wenn ein Anbieter ausfällt. Lassen Sie alles auf `auto`. Wenn eine Route falsch aussieht, korrigieren Sie das Routing (eine Strategie oder eine Schwelle), nicht das Modell. Pinnen gibt es nur für die seltenen Fälle unter [Den Router übersteuern](#den-router-übersteuern-selten-nötig).
2. **Schreiben Sie eine Aufgabe pro Prompt, und sagen Sie, was es ist.** Der Router bewertet den Prompt, den Sie senden. "Add a `--json` flag to `mom status` and a test for it" wird an ein günstiges Coding-Modell geroutet; "fix it" nach einem langen Verlauf wird ohne den Kontext bewertet, den der Verlauf trägt. Nennen Sie Datei, Funktion oder Befehl.
3. **Stellen Sie die wichtigen Wörter an den Anfang.** Der Memory-Abruf sucht mit den ersten 300 Zeichen des Prompts, auf einer Zeile. Ein Prompt mit weniger als vier Wörtern oder ein Slash-Befehl ruft nichts ab. "The heartbeat continues answers it should not: in `hooks/lib/heartbeat.js` …" ruft das Heartbeat-ADR und den Code ab; ein Absatz Hintergrund, gefolgt von der Frage, womöglich nicht.
4. **Schalten Sie Memory in den Projekten ein, zu denen Sie zurückkehren, und nur dort.** `mom memory on` (oder `/palgu memory on` in Claude Code und OpenCode) lädt den Quellcode des Ordners zur Indexierung zu Palgu hoch. Es ist standardmäßig aus, gilt pro Ordner und wird von jedem Agent geteilt, der `mom` verwendet; einmal eingeschaltet, dient es also Codex, Cursor, OpenCode, Antigravity und Copilot gleichermaßen. Lassen Sie es aus bei Kundencode, den Sie nicht hochladen dürfen.
5. **Schreiben Sie das *Warum* dort auf, wo Memory es finden kann.** Der Abruf rangiert festgehaltene Absichten und ADRs zuerst, dann Doku, dann Code. Ein kurzes ADR in `docs/adr/` oder ein klarer README-Abschnitt macht aus einem abgerufenen Verweis eine korrekte Antwort. Abgerufener Text ist ein Verweis, der gegen die Dateien zu prüfen ist, nie eine Anweisung.
6. **Halten Sie kritische Arbeit auf Ihrem stärksten Modell.** Security- und Auth-Design, Produktionsvorfälle, Datenmigrationen und alles Unumkehrbare sollten nicht an ein günstiges Modell gehen. Claude Code hält sie von selbst bei Claude (Bewertung 8+ und die Security-Regel); in den anderen Agents übergeben Sie sie nicht an `palgu_delegate` und pinnen dabei kein günstiges Modell.
7. **Delegieren Sie nur in sich abgeschlossene Arbeit.** Ein gerouteter Child-Prozess oder ein `palgu_delegate`-Aufruf sieht das Briefing oder den Prompt, den er bekommt, nicht Ihre Sitzung. Gut: "Write unit tests for `parseEvent` in `integrations/cli/lib/events.js` covering the four tools". Schlecht: "do the next step", "check the PR".
8. **Schreiben Sie nie Secrets in einen Prompt, den Sie routen oder delegieren.** Prompts gehen an Palgu und den Anbieter, der sie bedient. Keys bleiben in `~/.config/mixture-of-models/credentials.json`, `PALGU_API_KEY` oder im sicheren Speicher von Claude Code; keine Konfigurationsdatei braucht einen.
9. **Lassen Sie den Heartbeat arbeiten, und stoppen Sie ihn, wenn er es nicht sollte.** Er setzt einen Turn fort, der Arbeit angekündigt und dann aufgehört hat, höchstens 3 Mal pro Prompt von Ihnen, und nie einen Turn, den Sie abgebrochen haben. Wenn er etwas fortsetzt, das Sie beenden wollten, sagen Sie, was Sie wollen ("stop here, just summarise"), oder schalten Sie ihn ab: `mom heartbeat off` (`/palgu heartbeat off` in OpenCode, `"heartbeat": "off"` im `router`-Block in Claude Code). `mom heartbeat local` behält ihn bei, fragt aber nie Palgu.
10. **Behalten Sie das Budget im Blick, nicht nur die Rechnung.** `mom status` und `/palgu status` zeigen, was Ihre Organisation in diesem Zeitraum von ihrem Palgu-Budget verbraucht hat ("budget: $205.11 of $4,500.00 this month (5%)"). Claude Code zeigt außerdem unter jeder gerouteten Antwort und in `/route stats`, was das Routing gespart hat.

## Pro Agent

### Claude Code (der Mod: alles)

Die vollständigste Integration: Routing pro Turn mit Ihren eigenen Regeln, Memory in jedem Prompt für Claude und jedes geroutete Modell, der Heartbeat, Erfassung der Ersparnis.

- **Wählen Sie einmal eine Strategie.** `/route strategy cost` für die niedrigste Rechnung, `quality`, wenn Fehler teuer sind, `speed` für schnelle Durchläufe, `complexity` (Standard) für eine Balance. `/route strategies` listet sie auf. Für eigene Kriterien (der Code eines Kunden immer auf Claude, Doku immer auf DeepSeek) bitten Sie Claude, den **routing-strategy**-Skill zu verwenden: Er schreibt `~/.claude/mixture-of-models/strategies/<name>.md`.
- **Steuern Sie einen einzelnen Prompt mit Worten.** "use claude" irgendwo in einem Prompt hält diesen Turn bei Claude. "execute the plan" (und Ähnliches) ebenfalls. Kurze Antworten wie "go ahead", "ok" oder "next" behalten die Route des vorigen Turns, und eine kurze Folgefrage nach einer gerouteten Antwort kommt zur Hauptsitzung zurück, da der Child-Prozess kein Gedächtnis behält.
- **Sitzungsarbeit bleibt absichtlich in der Hauptsitzung.** Prompts zu PRs, Branches, CI, Status, Teammitgliedern oder Hintergrundaufgaben sowie alles zu Security werden nie geroutet: Ein Child kann sie nicht sehen. Kämpfen Sie nicht mit einem Pin dagegen an.
- **Lesen Sie die Routing-Zeile.** Unter jeder Antwort: `route: glm-5.3 · coding 6/10 via ollama · child 42s · saved ~$0.39`. Wenn eine Entscheidung falsch aussieht, zeigen Bewertung und Art, warum. Verschieben Sie die Grenzen mit `router.thresholds`, statt zu pinnen.
- **Nutzen Sie Familien für die richtige Größe von Claude.** `claude/auto` schickt einfache Turns an Haiku, Coding an Sonnet und kritische an Opus, mit Ihrem eigenen Claude-Login. Praktisch, wenn Sie kein Gateway haben oder ein Abo strecken wollen.
- **Installieren Sie Ollama für kostenlose Klassifizierung.** Mit einem lokalen Ollama (`qwen2.5-coder:3b`) wird jeder Prompt kostenlos bewertet; ohne fragt der Mod `claude-haiku-5-5`.
- **Lassen Sie es Befehle über Sie freigeben.** Wenn ein gerouteter Child-Prozess `git pull` oder `npm install` braucht, bekommen Sie Claude Codes eigenen Dialog mit dem genauen Befehl. Erlauben Sie ihn dort; fügen Sie nicht `--dangerously-skip-permissions` zu `child.args` hinzu, um die Abfrage zu umgehen.
- **Prüfen Sie Ihre Ersparnis wöchentlich.** `/route stats` (vier Tabs: models, kinds, scores, recent). Eine Zeile unter "kinds" mit vielen Child-Fehlschlägen bedeutet, dass diese Art woanders hin sollte: Ändern Sie `routes.kinds`, dann `/route reset`.
- **Halten Sie es aktuell.** Wenn das Band meldet, dass eine neue Version verfügbar ist, führen Sie `/route update` aus, dann `/reload-plugins`.

### OpenCode (voller Funktionsumfang)

- Verwenden Sie `palgu/auto` als Modell und lassen Sie es dabei: Palgu wählt pro Request.
- Für die eigenen Routing-Regeln des Mods geben Sie dem Plugin `routes` oder `critical` (zum Beispiel `["…/plugin.js", { "critical": "claude-opus" }]`): Dann gehen Security- und "use claude"-Prompts an das kritische Modell und der Rest nach Stufe.
- `/palgu memory on`, `/palgu status` und `/route status` antworten in einem Toast, auf Palgus günstigster Stufe.
- Eine überraschende Route debuggen: `MOM_DEBUG=1` protokolliert jede Entscheidung (Modell-IDs und Pins, nie Prompts oder den Key) nach `~/.config/mixture-of-models/opencode.log`.

### Codex

- Starten Sie es mit `codex -p palgu`. Ein einfaches `codex` verwendet Ihre normale Codex-Konfiguration und nichts von Palgus Routing, wobei Memory und Heartbeat des Plugins trotzdem laufen.
- Bestätigen Sie die Hooks des Plugins einmal in `/hooks`; `codex exec` führt keine Hooks aus, die nie interaktiv bestätigt wurden.
- Codex hat keine eigenen Slash-Befehle: Führen Sie `mom status`, `mom memory on` und `mom heartbeat …` in einem Terminal aus (der Skill des Plugins sagt Codex, sie vorzuschlagen).

### Cursor

Cursors eigenes Modell erledigt die Arbeit. Mixture of Models ergänzt Memory-Suche, Delegation und den Heartbeat.

- Installieren Sie die **Regel** (`.cursor/rules/mixture-of-models.mdc`, im Plugin enthalten). Ohne sie denkt der Agent selten an `palgu_memory_search` oder `palgu_delegate`.
- Fordern Sie die Tools namentlich an, wenn es darauf ankommt: "search Palgu memory for how the heartbeat decides, then …" oder "use `palgu_delegate` to draft tests for these three functions".
- Delegieren Sie Entwürfe, keine Entscheidungen: Test-Gerüste, Boilerplate, Docstrings, Nachschlagen. Prüfen Sie, was zurückkommt; die Regel hält sicherheitskritische Arbeit lokal.
- Ein aus dem Dock gestartetes Cursor findet `mom` möglicherweise nicht; tragen Sie den vollständigen Pfad aus `which mom` in die Hooks und in `mcp.json` ein.

### Antigravity (`agy`)

- In Ordnern mit eingeschaltetem Memory wird es in den ersten Modellaufruf jedes Turns abgerufen, daher zählen die Regeln zur Prompt-Formulierung (Regeln 2 und 3) hier am meisten.
- Der Agent bleibt auf dem Gemini-Modell, das Sie in `agy` wählen. Routing erreicht ihn über `palgu_delegate`, das er laut der immer aktiven Regel des Plugins für risikoarme, in sich abgeschlossene Teilaufgaben verwenden soll. Fordern Sie es bei Massenarbeit ausdrücklich an.
- Wenn `agy` mit `PERMISSION_DENIED on resource project …` fehlschlägt, liegt das an Antigravitys Google-Cloud-Projekteinstellung, nicht am Plugin; siehe [integrations/antigravity](integrations/antigravity/README.md).

### GitHub Copilot CLI

- Copilot verwirft Hook-Ausgaben bei Prompts, daher wird Memory nicht von selbst hinzugefügt: Bitten Sie den Agent bei unbekannten Teilen des Codes, "check Palgu memory first", oder verlassen Sie sich auf den Skill, der ihm sagt, wann.
- Beim Sitzungsstart in einem Ordner mit eingeschaltetem Memory wird Copilot mitgeteilt, dass Memory an ist; eine neue Sitzung nach `mom memory on` übernimmt das.
- Verwenden Sie `palgu_delegate` für Teilaufgaben, die Sie auf einem günstigeren Modell haben wollen. Für die ganze Sitzung auf Palgu kann Copilots BYOK auf `https://api.palgu.ai/anthropic` mit dem Modell `auto` zeigen (ein Modell pro Sitzung).
- Installieren Sie das Plugin statt Repository-Hooks: `.github/hooks/` läuft nicht in einem nicht vertrauenswürdigen Ordner.
- Ist ein klassisches `GITHUB_TOKEN` gesetzt, starten Sie es als `env -u GITHUB_TOKEN -u GH_TOKEN copilot`.

### Aider, Continue, Goose

Nur Routing: kein Memory, kein Heartbeat.

- Verwenden Sie das Modell `auto` (`openai/auto` in Aider) gegen `https://api.palgu.ai/v1`, mit dem Key aus `mom token` in einer Umgebungsvariable, nicht in einer committeten Konfiguration.
- Aiders Architect-Modus (`--architect --editor-model openai/auto`) sendet Planung und Bearbeitung als getrennte Requests, und Palgu routet jeden einzeln: Die Planung kann auf eine stärkere Stufe gehen, während Änderungen günstig bleiben.
- Geben Sie in Continue der Autovervollständigung ein eigenes kleines, schnelles Modell; Palgus Routing ist für Chat-Turns gedacht.

## Mehrere Agents in einem Projekt verwenden

Alles, was `mom` speichert, gilt pro Ordner und wird geteilt, sodass Sie mitten im Projekt den Agent wechseln können, ohne etwas neu einzurichten:

- Memory-Einwilligung und der Index (`mom memory on` einmal, für jeden Agent).
- Die Palgu-Anmeldung (`mom login` einmal, für jeden Agent außer Claude Code, das sein eigenes `/palgu login` hat).
- Der Heartbeat-Modus (`mom heartbeat …`).

Eine gute Aufteilung: Planen und reviewen in Claude Code (kritische Turns auf Claude, der Rest geroutet), Massenänderungen in OpenCode oder Codex auf `auto`, und Cursor oder Copilot repetitive Teilaufgaben an `palgu_delegate` übergeben lassen. Der Memory-Index, den sie alle lesen, ist derselbe.

## Den Router übersteuern (selten nötig)

Sie sollten das nicht brauchen. Ein Pin schaltet das Routing für jeden Request ab, bis Sie ihn entfernen; Sie verlieren also die Ersparnis und den Fallback, wenn dieser Anbieter ausfällt. Die einzigen guten Gründe sind solche, die der Router nicht kennen kann:

- **Ein Modell ausprobieren:** Sie wollen sehen, wie sich ein Modell bei Ihrer eigenen Arbeit schlägt.
- **Modelle vergleichen:** Ein Benchmark oder ein A/B-Lauf braucht jedes Mal dasselbe Modell.
- **Vertrags- oder Datenregeln:** Der Code eines Kunden darf nur an bestimmte Anbieter gehen.
- **Eine schlechte Antwort debuggen:** Sie wollen wissen, ob das Modell oder der Prompt das Problem war.

Keine Gründe zum Pinnen: eine falsche Route (ändern Sie in Claude Code die Strategie, `router.thresholds` oder `routes.kinds`, damit das Routing automatisch bleibt), eine langsame Antwort (versuchen Sie `/route strategy speed`) oder ein einzelner Prompt, den Sie auf Claude haben wollen (schreiben Sie "use claude" hinein).

Wie, und wie man es rückgängig macht:

| Agent | Pinnen | Zurück zu automatisch |
| :- | :- | :- |
| Claude Code | `/route <model>` | `/route auto` |
| OpenCode | `/route <model>` oder ein Modell im Modellmenü wählen | `/route auto` oder `palgu/auto` wählen |
| Codex | `MOM_PIN=<model> codex -p palgu -m <model>` (zweimal dasselbe Modell) | `codex -p palgu` |
| Cursor, Antigravity, Copilot | für diese Teilaufgabe `palgu_delegate` mit `model: "<id>"` anfordern | der Standard ist `auto` |
| Direkter Endpoint (Aider, Continue, Goose) | das Modell setzen **und** `x-srooter-pin` senden (ein Modellname allein wird trotzdem geroutet; `auto` mit einem Pin wird abgelehnt, 403) | Modell `auto`, kein Header |

`/route models` (Claude Code), `palgu_models` oder `GET https://api.palgu.ai/v1/models/health` listet die verfügbaren Modelle auf. Entfernen Sie den Pin, sobald Sie fertig sind: `/route status` zeigt, ob einer aktiv ist.

## Wenn etwas falsch aussieht

| Sie sehen | Wahrscheinliche Ursache | Tun Sie |
| :- | :- | :- |
| Ein trivialer Prompt blieb bei Claude | Er erwähnte PRs, CI, Status oder Security oder war eine kurze Folgefrage | Erwartet; formulieren Sie ihn als in sich abgeschlossene Aufgabe, wenn er geroutet werden soll |
| Eine geroutete Antwort ist falsch oder vage | Die Aufgabe brauchte Sitzungskontext, den das Child nicht hatte | Sagen Sie "use claude" für diesen Turn; wenn eine ganze Art oft scheitert, ändern Sie `routes.kinds` |
| `child answer discarded (…), main model answered` | Das Child bat um Freigabe, behauptete Arbeit, die es nicht getan hat, oder gab zurück | Nichts zu tun: Das Hauptmodell hat stattdessen geantwortet |
| `child: deepseek-pro failed (429) → served by glm-5.3` | Das geroutete Modell war überlastet, also hat der Mod den Turn auf einem gleichwertigen Modell ausgeführt | Nichts zu tun |
| `all equivalents failed: …; main model answered` | Jedes gleichwertige Modell ist fehlgeschlagen, oder das Gateway ist ausgefallen | `/route models` prüfen; wenn es wiederholt auftritt, das Gateway prüfen |
| Memory ruft nichts ab | Memory ist in diesem Ordner aus, der Prompt hat weniger als vier Wörter, oder die Indexierung ist nicht fertig | `mom memory status`; die Schlüsselbegriffe an den Anfang des Prompts stellen |
| Der Agent macht weiter, obwohl Sie wollten, dass er aufhört | Der Heartbeat hat ein Ende mitten in der Aufgabe gesehen | Sagen Sie, was Sie wollen, oder `mom heartbeat off` |
| 403 `pin 'auto' not allowed by policy` | Ein Pin wurde mit dem Modell `auto` gesendet | Das Modell nennen, das Sie pinnen |
| 503 bei einem gepinnten Modell | Dieser Anbieter ist ausgefallen | Pin entfernen oder eines aus `/route models` / `palgu_models` wählen |
| Ausgaben steigen schneller als erwartet | Ein Pin auf ein teures Modell wurde aktiv gelassen | `/route status` oder `/route auto`; das Budget mit `mom status` prüfen |
