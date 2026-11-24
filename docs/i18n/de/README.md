# mixture-of-models-claude-mod

[English](../../../README.md) · [简体中文](../zh-CN/README.md) · [日本語](../ja/README.md) · **Deutsch** · [Français](../fr/README.md) · [العربية](../ar/README.md)

*Dies ist eine Übersetzung; die englische Version ist maßgeblich und möglicherweise aktueller.*

[![ci][ci-badge]][ci] [![License: MIT][mit-badge]](../../../LICENSE) [![Changelog][log-badge]](../../../CHANGELOG.md)

[ci]: https://github.com/alinaqi/mixture-of-models-claude-mod/actions/workflows/ci.yml
[ci-badge]: https://github.com/alinaqi/mixture-of-models-claude-mod/actions/workflows/ci.yml/badge.svg
[mit-badge]: https://img.shields.io/badge/License-MIT-green.svg
[log-badge]: https://img.shields.io/badge/changelog-keep%20a%20changelog-blue

> **Richten Sie das mit einem Coding-Agent ein?** Verweisen Sie ihn auf [INSTALL.md](INSTALL.md): "Follow INSTALL.md in alinaqi/mixture-of-models-claude-mod to set up Mixture of Models for me." (Folge INSTALL.md in alinaqi/mixture-of-models-claude-mod, um Mixture of Models für mich einzurichten.) Dort stehen alle Befehle, eine Prüfung für jeden Schritt und was er Sie fragen soll. Funktioniert für Claude Code, Codex, Cursor, OpenCode, Antigravity, GitHub Copilot CLI, Aider, Continue und Goose.
>
> **Schon installiert?** [GUIDELINES.md](GUIDELINES.md) enthält die Best Practices für jeden Agent: das System die Modelle wählen lassen, wie man Prompts formuliert, damit Routing und Memory funktionieren, was man delegiert und was zu tun ist, wenn eine Route falsch aussieht.

Behalten Sie Ihr Claude-Abo für die Turns, die es brauchen. Den Rest übernimmt ein günstigeres Modell. Ein Claude Code **Mod** (ein In-Process-Plugin, neu in Claude Code 2.1.287), der jeden Prompt nach seinem Blast Radius (Schadensradius) bewertet und die Turns mit niedriger Bewertung von einem separaten, headless laufenden Claude Code auf einem Anthropic-kompatiblen Gateway beantworten lässt (GLM, Kimi, DeepSeek, was auch immer Ihres anbietet). Ihre Hauptsitzung wird nie umbenannt, umgeleitet oder angefasst. Portiert aus dem Routing von [Maggy](https://github.com/alinaqi/maggy).

Routen können auch eine **Modellfamilie** nennen: `claude/sonnet` führt dieses Claude-Mitglied mit Ihrem eigenen Claude-Login aus, `kimi/auto` lässt die Bewertung ein Kimi-Mitglied wählen, und `codex` übergibt den Turn an die Codex CLI (`codex exec`) auf Palgu oder mit Ihrem ChatGPT-Login. Siehe [Familien](#familien-ein-mitglied-wählen-oder-die-stufe-wählen-lassen) und [Codex](#codex-als-child-prozess).

## Palgus Modelle mit einem Befehl

Kein Dashboard, kein Kopieren von Keys. Nach der [Installation des Mods](#installation), in Claude Code:

```
/palgu login
```

1. Der Mod zeigt einen Anmeldelink und einen kurzen Code, zum Beispiel `WDJB-MJHT`.
2. Öffnen Sie den Link, melden Sie sich bei Palgu an oder **registrieren** Sie sich (neue Konten starten im kostenlosen Plan), prüfen Sie, dass der Code übereinstimmt, und klicken Sie auf **Allow**. Die Seite nennt die App: *Allow Mixture of Models on "Claude Code on your-mac"?*
3. Zurück im Terminal meldet ein Toast *Signed in to Palgu as you@example.com*. Das war's: Einfache und Coding-Turns laufen jetzt auf Palgus Modellen (GLM 5.3, Kimi K3.1, DeepSeek V4 Pro, Gemini 3.8 Flash, MiniMax M3, GPT-6), und kritische Turns bleiben bei Claude. Kein Neustart.

| Befehl | Was er tut |
| :- | :- |
| `/palgu login` | Registrieren oder anmelden und diesen Computer verbinden |
| `/palgu status` | Wer angemeldet ist, die Organisation und ihr Plan, und wie viel sie in diesem Zeitraum von ihrem Palgu-Budget verbraucht hat |
| `/palgu upgrade` | Pläne und Abrechnung (bezahlte Pläne werden im Web gekauft; Ihr Key übernimmt den neuen Plan von selbst) |
| `/palgu continue [--open]` | Diese Sitzung in Palgu mit ihrem vollen Kontext fortsetzen: kopiert `cd <folder> && palgu --continue-claude=<session id>`; `--open` startet es in einem neuen macOS-Terminal-Tab. Palgu liest das Transkript selbst und schwärzt Zugangsdaten |

So funktioniert es: Palgus Geräteanmeldung (dieselbe, die `srooterctl` verwendet) erzeugt einen API-Key nur für diesen Computer. Sie können ihn auf Palgus Seite **Devices** sehen und widerrufen. Der Mod speichert ihn mit `claude plugin configure --values-stdin` im sicheren Speicher von Claude Code, sodass er nie in einer Befehlszeile oder einer Einstellungsdatei auftaucht. Sie haben schon einen Key oder nutzen ein anderes Gateway? Siehe [Einrichtung](#einrichtung).

Genau genommen ist es **Delegation auf Turn-Ebene**, kein Mischen von Modellen pro Request. Ein gerouteter Turn läuft in einem Child-Prozess mit einem kurzen Briefing Ihres jüngsten Kontexts; die Antwort des Child-Prozesses landet, markiert, in Ihrem Transkript. Kritische Turns bleiben genau wie vorher bei Claude.

## Installation

Mods benötigen **Claude Code 2.1.287 oder neuer**. Der stabile Homebrew-Cask ist noch 2.1.286, also zuerst prüfen:

```bash
claude --version
# zu alt? eine der folgenden Möglichkeiten:
brew uninstall --cask claude-code && brew install --cask claude-code@latest   # Homebrew
npm install -g @anthropic-ai/claude-code@<version>                            # npm: eine Version ab 2.1.287
claude update                                                                 # nativer Installer
```

Dann:

```bash
claude plugin marketplace add alinaqi/mixture-of-models-claude-mod
claude plugin install mixture-of-models@mixture-of-models-claude-mod
```

oder, innerhalb einer Sitzung, `/plugin install mixture-of-models --marketplace alinaqi/mixture-of-models-claude-mod`.

> **Ihre Hooks laufen nicht im Gateway-Child.** Das Child führt `claude -p --bare` aus, und `--bare` überspringt jeden Hook aus Ihren Einstellungen und Plugins. Ein Hook, der `.env` blockiert, schützt die Datei dort also nicht, und was das Child liest, geht an das Gateway-Modell. Der Mod verlässt sich dafür nicht auf Hooks: Jedes Claude-Child erhält Deny-Regeln für Claude-Code-Berechtigungen, die `--bare` beibehält, für `.env`- und `.env.*`-Dateien, `*.pem`, `*.key`, `id_rsa*`, `id_ed25519*` und `secrets/`-Ordner (Read-Regeln gelten auch für Grep und Glob). Eigene Regeln fügen Sie mit `router.child.deny` hinzu, zum Beispiel `["Read(**/credentials.json)"]`. Befehle, die das Child nicht ausführen darf, kommen weiterhin als Allow-/Deny-Dialog zu Ihnen. Ein Codex-Child ist schreibgeschützt, fällt aber nicht unter diese Regeln: Halten Sie Secrets aus einem Projekt heraus, das Sie an Codex routen.

**Updates.** Beim Sitzungsstart prüft der Mod auf GitHub, ob es eine neuere Version gibt (höchstens alle 12 Stunden), und meldet sie, falls vorhanden, einmal in einem Toast und auf dem Band: `0.33.0 available: /route update`. Führen Sie `/route update` aus: Es installiert die neue Version, und das Band zeigt danach `0.33.0 installed: /reload-plugins`. Marketplaces von Drittanbietern aktualisieren sich standardmäßig nicht automatisch. Schalten Sie das einmalig ein unter `/plugin` → Marketplaces → `mixture-of-models-claude-mod` → Enable auto-update, oder aktualisieren Sie von Hand mit `claude plugin marketplace update mixture-of-models-claude-mod && claude plugin update mixture-of-models@mixture-of-models-claude-mod`. Eine neue Version wird nach `/reload-plugins` (oder einem Neustart) wirksam.

**Schnellster Start, mit Palgu:** Starten Sie `claude` und führen Sie `/palgu login` aus. Es zeigt einen Link und einen Code; bestätigen Sie ihn im Browser (registrieren Sie sich dort, wenn Sie neu sind), und der Mod speichert seinen eigenen Palgu-Key und routet ab diesem Moment, ohne Kopieren von Keys. `/palgu status` sagt, wer angemeldet ist, mit welchem Plan und wie viel vom Budget verbraucht ist; `/palgu upgrade` öffnet Pläne und Abrechnung.

Oder geben Sie dem Child selbst ein Gateway: [OpenRouter](#openrouter), einen [LiteLLM](#litellm)-Proxy oder einen beliebigen Anthropic-kompatiblen Endpoint, der Ihre Modell-IDs bereitstellt (getestet mit [palgu](https://www.palgu.ai); die Anthropic-Endpoints von z.ai oder Moonshot funktionieren genauso), siehe [Einrichtung](#einrichtung). Starten Sie `claude` und führen Sie `/route` aus. Solange kein Gateway konfiguriert ist, beobachtet der Mod nur und ändert nichts.

**Designregel: Die Hauptsitzung wird nie angefasst.** Sie bleibt auf Ihrem claude.ai-Abo, ohne `ANTHROPIC_BASE_URL`. Wenn ein Prompt an GLM oder Kimi geroutet wird, beantwortet der Mod diesen Turn selbst, indem er einen **separaten, headless laufenden `claude -p`-Child-Prozess** startet, dessen Umgebung allein auf das Gateway (palgu) zeigt. Die Ausgabe des Child wird in Ihrem Transkript zur Antwort des Turns. An Hauptprozess, Modell, Authentifizierung und Requests der Hauptsitzung ändert sich nichts.

Pro Prompt macht der Mod Folgendes:

1. Er **bewertet** ihn mit einem Classifier-Aufruf auf zwei Achsen: einen Blast Radius von 1-10 und eine Aufgabenart (`code | research | review | docs | data | multimodal`). Die Bewertung entscheidet, ob Claude Pflicht ist; die Art wählt, welches günstigere Modell den Rest bekommt. Ein lokales Ollama-Modell erledigt das kostenlos, `claude-haiku-5-5` in Ihrem Plan ist der Fallback, danach das zuletzt gesehene Urteil. Siehe [Wie es entscheidet](#wie-es-entscheidet).
2. Er **wendet zuerst Maggys Vor-Routing-Regeln an**: `use claude` oder `execute the plan` erzwingen `critical`; Folgefragen nach einem vom Child beantworteten Turn gehen zurück in die Hauptsitzung; `go ahead`, `yes` oder ein Prompt mit sechs Wörtern oder weniger bleibt dort, während die Hauptsitzung mitten in einer Aufgabe ist; Arbeit auf Coding-Niveau bleibt bei einer Hauptsitzung, die mitten in einer Aufgabe ist.
3. Er **delegiert** einen gerouteten Turn an das Child: `claude -p --model glm-5.3` auf dem Gateway, über stdin gefüttert mit einem Briefing aus den letzten paar Wechseln Ihrer Sitzung plus der Aufgabe.
4. Er **fällt** für diesen Turn auf das Hauptmodell **zurück**, wenn das Child fehlschlägt, nichts ausgibt oder seine Antwort die Prüfung nicht besteht (siehe [Was ein Child nicht darf](#was-ein-child-nicht-darf)), und sagt das im Transkript.
5. Er **zeigt Ihnen, was wo lief**, bei jedem Turn. Siehe [Was Sie sehen](#was-sie-sehen).

`critical`-Turns starten nie ein Child. Sie laufen in der Hauptsitzung, auf dem Abo, genau so, als gäbe es den Mod nicht.

## Wie es entscheidet

Dem Classifier wird eine Frage gestellt: Wie viel Schaden richtet eine falsche Antwort an? Er antwortet mit einer Zahl, und die Bewertungsskala ist ausdrücklich:

| Bewertung | Bedeutet | Stufe (Standard-Schwellen) |
| :- | :- | :- |
| 1-2 | Nachschlagen, grep, Shell-Einzeiler, Syntaxfragen, Logs lesen, git status oder diff | `simple` |
| 3-4 | Änderungen an einer Datei, Tests, Doku, Konfigurationsänderungen, kleine Bugfixes, Scaffolding | 3 `simple`, 4 `coding` |
| 5-6 | Features über mehrere Dateien, Services oder Tools verbinden, Integrationen, Deployments nach bekanntem Muster | `coding` |
| 7-8 | Debugging über Services hinweg, Datenmigrationen, Performance-Arbeit, Änderungen, die schwer rückgängig zu machen sind | 7 `coding`, 8 `critical` |
| 9-10 | Security- oder Auth-Design, Architekturentscheidungen, Produktionsvorfälle, alles Unumkehrbare | `critical` |

Der Prompt sagt dem Classifier, dass Länge, die Anzahl genannter Services oder eingefügte API-Keys die Bewertung nicht von selbst erhöhen; genau das hatte früher gewöhnliche Integrationsarbeit in die Hauptsitzung gedrängt. Er sagt außerdem, dass tiefes Nachdenken (Algorithmen mit Beweisen, Nebenläufigkeit, Performance-Tuning, Kryptografie) unabhängig vom Blast Radius mindestens 7 bekommt, damit schwierige, aber ungefährliche Arbeit bei Claude bleibt. Verschieben Sie die Grenzen mit `router.thresholds`; zum Beispiel hält `{ "simple": 3, "coding": 8 }` alles außer 9-10 von Claude fern.

**Die Art wählt das Modell.** Unterhalb von `critical` ordnet `routes.kinds` der Aufgabenart ein Modell zu: Standardmäßig gehen `research` und `review` an DeepSeek V4 Pro (`deepseek-v4-pro` auf Palgu, 1M-Token-Kontext), `multimodal` bleibt bei Claude, und alles andere nimmt das Modell der Stufe (GLM). Bis 0.20.0 gingen sie an Kimi, das Palgu derzeit nicht beantwortet (eine leere Antwort nach etwa zwei Minuten). Fügen Sie der Matrix `"docs": "gpt-6-sol"` oder `"data": "..."` hinzu, soweit Ihr Gateway es erlaubt.

**Modelle, die Sie nennen können.** Jede Modell-ID, die Ihr Gateway bereitstellt, funktioniert in `routes`, `routes.kinds` oder einem Pin. Der Mod kennt diese Palgu-Gateway-Modelle, sodass `/route <prefix>` zu ihnen erweitert wird, auch wenn keine Route sie nennt: `glm-5.3`, `kimi-k3.1-pro`, `kimi-k3.1-pro-highspeed`, `deepseek-v4-pro`, `gemini-3.8-flash`, `minimax-m3`, `minimax-m2.5`, `gpt-6-sol`, `gpt-6-luna`, `gpt-6-astra` und `mercury-3`. Die Leiste über dem Prompt hat für jede dieser Familien einen Button. `kimi-k3.1-pro` ersetzt `kimi-k3`; ein alter `/route kimi-k3`-Pin wird dazu erweitert. Gemini, MiniMax und GPT-6 sind Optionen, keine Standards: `/route minimax`, `/route gpt` (GPT-6 Sol) oder `/route gpt/auto` (Luna für einfache Turns, Sol für Coding, Astra für kritische) pinnt sie. Inceptions Mercury 3 ist ebenfalls nur per Pin erreichbar: `/route mercury` (`mercury-3` auf Palgu, `mercury/3` auf OpenRouter).

**Welche Palgu-Modelle funktionieren.** Getestet am 2026-10-29 so, wie der Mod einen Turn ausführt (ein gepinntes `claude -p --bare`-Child, das eine kurze Rechercheaufgabe mit Tool-Aufrufen erledigt): `glm-5.3`, `deepseek-v4-pro`, `gemini-3.8-flash`, `minimax-m3`, `gpt-6-sol`, `gpt-6-luna`, `gpt-6-astra`, `kimi-k3.1-pro`, `kimi-k3.1-pro-highspeed` und `mercury-3` bestehen in 19 bis 46 s; `minimax-m2.5` wiederholte abgelehnte Befehle, bis ihm die Turns ausgingen. Kimis frühere Fehlschläge lagen an überlastetem Moonshot (`429 engine_overloaded`): Claude Code wiederholte jeden Request zehnmal, sodass ein Turn etwa zwei bis drei Minuten bis zum Fehlschlag brauchte. Das Child wiederholt jetzt höchstens zweimal (`router.child.maxRetries`, Standard 2), sodass bei einem ausgelasteten Anbieter in Sekunden zurückgefallen wird. Research und Review bleiben standardmäßig bei DeepSeek; Kimi ist ein Pin. Das Child sendet Palgu immer `x-srooter-pin: <model>`: Ohne diesen Header routet Palgu nach Absicht und antwortet möglicherweise mit einem anderen Modell (ungepinnt bediente es jedes Modell als Gemini).

**Wenn ein Child fehlschlägt.** Das Hauptmodell übernimmt einen gerouteten Turn erst, wenn jedes gleichwertige Modell fehlgeschlagen ist. Auf Palgu sendet das Child `x-palgu-fallback: auto`, sodass das Gateway bei Überlastung zuerst die eigene Fallback-Kette des gepinnten Modells durchläuft (seine Fallback-Liste, dann seine Klasse). Schlägt das Child trotzdem mit einer Überlastung fehl (429, 5xx, Timeout, keine Antwort), führt der Mod den Turn auf dem nächsten gleichwertigen Modell erneut aus: zuerst Modelle derselben Klasse (aus Palgus Live-Liste), dann die anderen funktionsfähigen, bis zu `router.child.fallbacks` (Standard 3). Ein Prompt, der für das Modell zu lang ist, wechselt nur zu einem Modell mit größerem Kontextfenster (`router.child.longContext`); ein fehlerhafter Request (400, 401, 403, 404, 422) wird nicht auf anderen Modellen wiederholt. Die Route-Zeile sagt, was passiert ist: `child: deepseek-v4-pro failed (429) → served by glm-5.3` oder `all equivalents failed: deepseek-v4-pro (429), glm-5.3 (529), …; main model answered`. Hat Palgus eigene Kette ein anderes Modell bedient, lautet die Zeile `child: kimi-k3.1-pro → served by deepseek-v4-pro (gateway fallback)`, und der Turn wird als dieses Modell gezählt und bepreist. Eine Kind-Antwort, die die Mod verwirft (aufgegeben, nur Absichten erzählt, Sie zum Handeln aufgefordert usw.: Was ein Kind nicht darf, unten), geht denselben Weg, außer einem `HANDBACK` oder einer Bitte, dass Sie handeln.

**Subagenten.** Ein Subagent läuft in Claude Code über die eigene Verbindung Ihrer Hauptsitzung, daher kann die Mod nur wählen, welches Claude-Modell er nutzt, nie ein Gateway-Modell. Bevor ein eingebauter `general-purpose`-Subagent startet, bewertet die Mod seine Aufgabe wie einen Prompt: eine einfache läuft auf Haiku, Coding auf Sonnet, eine kritische behält das Modell der Hauptsitzung. Explore läuft auf Haiku. Die Mod wählt nur ein günstigeres Modell als das der Hauptsitzung und lässt einen Subagenten in Ruhe, dessen Modell schon gewählt ist, den Agenten eines Plugins oder Ihren eigenen (seine Definition kann ein Modell setzen), einen Fork, einen Teammate und einen Workflow-Agenten. Das Transkript sagt `subagent general-purpose on haiku · simple 2/10`; `/route off` schaltet es ab, `router.subagents` legt es je Agententyp fest.

### Routing-Strategien: nach Komplexität, Kosten, Geschwindigkeit, Qualität oder eigenen Regeln routen

Was der Classifier bewertet, wo sich die Stufen trennen und welches Modell jede Stufe nimmt, ist eine **Routing-Strategie**: eine Markdown-Datei mit einer Bewertungsskala, wie ein Skill. Vier sind eingebaut:

| Strategie | Bewertet | Stufen (simple / coding) | Geht an |
| :- | :- | :- | :- |
| `complexity` (Standard) | Blast Radius, wie oben | 3 / 7 | Ihre Routen: GLM, DeepSeek für Research und Review, Claude für kritische |
| `cost` | Risiko, dass ein günstigeres Modell falsch liegt; im Zweifel niedriger | 4 / 8 | GLM, DeepSeek V4 Pro für Coding, Research und Review, Gemini für Bilder, Claude für kritische |
| `speed` | Denktiefe | 3 / 7 | Gemini 3.8 Flash, GPT-6 Sol für Coding, Sonnet statt Opus für kritische |
| `quality` | Tragweite; im Zweifel höher | 2 / 5 | GLM nur für Nachschlagen, Sonnet für Coding, Claude für kritische |

`/route strategies` listet sie und Ihre eigenen auf, `/route strategy cost` wechselt (wird über Sitzungen hinweg gemerkt; `router.strategy` in `model-config.json` setzt einen Standard), und die Leiste zeigt dann `auto (cost)`.

**Ihre eigene.** Legen Sie eine Datei in `~/.claude/mixture-of-models/strategies/<name>.md` ab, oder bitten Sie Claude, den **routing-strategy**-Skill des Plugins zu verwenden, der fragt, was Sie optimieren wollen, und die Datei schreibt:

```markdown
---
name: frugal
description: Everything but production work goes to cheap models.
score: risk
thresholds: {"simple": 5, "coding": 8}
routes: {"simple": "glm/5.3", "coding": "deepseek/v4-pro", "critical": "claude", "kinds": {"review": "kimi/pro"}}
---
Risk: how bad a wrong answer from a cheaper model would be. When unsure, score lower.
1-5: lookups, docs, tests, single-file edits, small fixes.
6-8: multi-file features, integrations, refactors that tests cover.
9-10: security, production, data migrations, anything irreversible.
```

`thresholds` und `routes` sind einzeiliges JSON und optional (weggelassen gelten die Werte aus Ihrer Konfiguration); der Rumpf ist die Bewertungsskala, die der Classifier liest. Das Antwortformat bleibt "<score> <kind>", sodass Stufen, Familien, Fehlergedächtnis und Ersparnis genauso funktionieren. Die obigen Sicherheitsregeln greifen unter jeder Strategie zuerst: Security-Arbeit, Benachrichtigungen und Sitzungsbefehle bleiben bei Claude. Eine Datei, die sich nicht parsen lässt, wird übersprungen und im Log genannt; `/route strategy <name>` liest den Ordner neu ein, sodass eine neue Datei ohne Neustart übernommen wird.

### Familien: ein Mitglied wählen oder die Stufe wählen lassen

Jede Route, Art-Route oder jeder Pin kann statt einer Modell-ID `<family>/<member>` oder `<family>/auto` sein. Ein bloßes `claude` bedeutet weiterhin "die Hauptsitzung", genau wie bisher, sodass alte Konfigurationen sich gleich verhalten.

| Familie | Mitglieder (Alias = exakte ID) | `auto` nach Stufe (Standard) | Läuft auf |
| :- | :- | :- | :- |
| `claude` | `fable` = `claude-fable-5-1`, `opus` = `claude-opus-5-5`, `sonnet` = `claude-sonnet-5-5`, `haiku` = `claude-haiku-5-5` | simple → `haiku`, coding → `sonnet`, critical → `opus`; `fable` nur, wenn Sie `"criticalPlus": "fable"` hinzufügen (kritische Turns mit 10/10) | ein headless `claude -p --model <id>`-Child mit **Ihrem Claude-Login** (kein Gateway); ein Mitglied, das das Sitzungsmodell *ist*, bleibt in der Hauptsitzung |
| `kimi` | `pro` = `kimi-k3.1-pro`, `highspeed` = `kimi-k3.1-pro-highspeed` | simple → `highspeed`, coding und critical → `pro` | das Gateway-Child |
| `glm`, `deepseek`, `gemini`, `minimax` | aus dem Gateway-Katalog: `glm/5.3` = `glm-5.3`, `deepseek/v4-pro` = `deepseek-v4-pro`, `gemini/3.8-flash`, `minimax/m3` = `minimax-m3`, `minimax/m2.5` | das erste Mitglied | das Gateway-Child |
| `gpt` | `sol` = `gpt-6-sol`, `luna` = `gpt-6-luna`, `astra` = `gpt-6-astra` | simple → `luna`, coding → `sol`, critical → `astra` | das Gateway-Child |
| `codex` | standardmäßig keine: `codex/<any model id>` reicht die ID an Codex weiter | standardmäßig keine: Codex' eigenes Standardmodell | ein `codex exec`-Child, siehe [Codex](#codex-als-child-prozess) |

`auto` verwendet denselben Classifier, dieselben Schwellen, dieselbe zweite Stichprobe in Grenzfällen und dasselbe Fehlergedächtnis wie die Stufen und schlägt dann die Stufe in der `auto`-Zuordnung der Familie nach. Es verlässt die Familie nie. Eine Stufe der Claude-Familie (`"critical": "claude/opus"`) ist genauso verpflichtend Claude wie `"claude"`: `routes.kinds` überschreibt sie nicht. Mitglieder oder die Stufenzuordnung überschreiben Sie pro Familie in `router.families`; ein gepinntes `/route claude/auto` klassifiziert trotzdem jeden Prompt und wählt das Mitglied anhand der Bewertung.

Warum ein Child für ein Claude-Mitglied und nicht das eigene `/model` der Sitzung: Die Hauptsitzung wird nie umbenannt oder umgeleitet ([ADR 0001](../../adr/0001-child-process-delegation.md)), daher läuft ein anderes Mitglied als das Sitzungsmodell in einem separaten, headless Claude Code, das mit Claude Codes eigenem Flag `--model <id>` gestartet wird. Dieses Child läuft ohne `--bare` (das API-Key-Authentifizierung erzwingen würde), nutzt also Ihren claude.ai-Login und lädt Ihre Hooks und Plugins; der Mod bleibt darin über `MAGGY_ROUTER_CHILD` inaktiv. Seine Umgebung löscht ein geerbtes `ANTHROPIC_BASE_URL`; ein in Ihrer Shell exportiertes `ANTHROPIC_API_KEY` hat weiterhin Vorrang vor dem Login, für das Child wie für die Hauptsitzung. Siehe [ADR 0002](../../adr/0002-model-families-and-codex-child.md).

### Codex als Child-Prozess

`codex`-, `codex/<model>`- und `codex/auto`-Routen sowie `/route codex` beantworten den Turn mit der Codex CLI im nicht-interaktiven Modus:

```
codex exec --json -C <session cwd> [-m <model>] [Palgu provider flags] --sandbox read-only -c approval_policy="never" -
```

mit demselben Briefing auf stdin, demselben `child.timeoutMs`, derselben Prüfung, demselben Fehlergedächtnis, derselben Routing-Zeile und derselben Herkunftsmarkierung wie das Claude-Child. `router.codex.auth` wählt das Konto:

- `"palgu"` (Standard): Codex spricht mit dem Responses-Endpoint Ihres Gateways, `/v1/responses`. Auf OpenRouter und LiteLLM heißt der Provider `openrouter` bzw. `litellm`, die Basis-URL ist `<gateway_url>/v1` (`https://openrouter.ai/api/v1`, `http://localhost:4000/v1`; bei einer LiteLLM-URL mit `/anthropic` wird dieses Suffix zuerst entfernt), und der Key kommt in `OPENROUTER_API_KEY` bzw. `LITELLM_API_KEY`, gemäß den Codex-Anleitungen von [OpenRouter](https://openrouter.ai/docs/cookbook/coding-agents/codex-cli.md) und [LiteLLM](https://docs.litellm.ai/docs/proxy/client_setup/codex_cli.md). Nennen Sie das Modell auf diesen Gateways: OpenRouter braucht einen vollständigen Slug (`/route codex/openai/gpt-5.6-terra`), LiteLLM einen Ihrer `model_name`s; Codex' eigene Standard-Modell-ID gehört nicht dazu. Auf Palgu fügt der Mod einen expliziten `palgu`-Provider hinzu, mit `-c model_provider="palgu"`, `-c model_providers.palgu.base_url="<gateway>/v1"`, `-c model_providers.palgu.wire_api="responses"` und `-c model_providers.palgu.env_key="PALGU_API_KEY"`, wie es [Palgus Codex-Doku](https://www.palgu.ai) beschreibt (Codex ignoriert `OPENAI_BASE_URL` bei einem ChatGPT-Login, daher muss der Provider explizit sein). Die Basis-URL ist Ihre `gateway_url`, bei der `/anthropic` durch `/v1` ersetzt wird, oder `router.codex.baseUrl`. Ihr Gateway-Key gelangt nur als `PALGU_API_KEY` in die Umgebung des Child, nie in die Befehlszeile, nie in eine Ausgabe. Benötigt Gateway-URL und Key, wie das Claude-Gateway-Child.
- `"chatgpt"`: keine Provider-Flags und kein Key: Codex verwendet Ihr eigenes `codex login` und `~/.codex/config.toml`. Der Mod liest oder schreibt `~/.codex` nie.

#### Sandbox und Freigaben

`codex exec` kann niemanden etwas fragen: Im nicht-interaktiven Modus läuft Codex mit der Approval-Policy Never (Codex 0.163 lehnt `approval_policy = "untrusted"` rundweg ab). Ein Befehl, den seine Sandbox erlaubt, läuft also ohne Rückfrage, und einer, den sie nicht erlaubt, wird abgelehnt. Die Sandbox ist damit die einzige Schranke, und der Mod hält sie eng:

- **`router.codex.sandbox`** ist standardmäßig `"read-only"`: Codex kann das Projekt lesen und Befehle ausführen, die nur lesen; es kann keine Dateien bearbeiten und nicht aufs Netzwerk zugreifen. Das ist enger als beim Claude-Child (`acceptEdits`), weil `codex exec` keine Möglichkeit hat, Änderungen durchzulassen und gleichzeitig Befehle zu kontrollieren. `-c approval_policy="never"` wird explizit übergeben, sodass ein Antrag, die Sandbox zu verlassen, abgelehnt und nie ausgeführt wird.
- **Abwählen, auf eigenes Risiko:** `"workspace-write"` lässt Codex Dateien im Projekt bearbeiten **und dort jeden Befehl ausführen, ohne Sie zu fragen** (das Netzwerk bleibt aus: `-c sandbox_workspace_write.network_access=false`). `"danger-full-access"` entfernt die Sandbox komplett; verwenden Sie das nur in einer wegwerfbaren, extern abgeschotteten Umgebung. Jeder andere Wert bedeutet read-only.
- **`router.codex.allowOutsideGit`** (Standard `false`) fügt `--skip-git-repo-check` hinzu. Ohne das weigert sich Codex, außerhalb eines Git-Repositorys zu starten, die Routing-Zeile meldet `child answer discarded (outside a git repo; set router.codex.allowOutsideGit)`, und das Hauptmodell antwortet.
- **`router.codex.args`** fügt Flags hinzu (zum Beispiel `-c model_reasoning_effort="high"`), aber nie Sandbox oder Freigabe: `--sandbox`/`-s`, `--dangerously-bypass-approvals-and-sandbox`, `--approve-for-me`, `--full-auto`, `--add-dir`, `--skip-git-repo-check`, `-a`/`--ask-for-approval` und `-c approval_policy=…`/`sandbox_mode=…`/`sandbox_workspace_write.…`/`sandbox_permissions=…` werden verworfen, und das Sitzungslog nennt, was ignoriert wurde. `--ephemeral` dort deaktiviert außerdem die unten beschriebene Wiederaufnahme.

**Abgelehnte Befehle.** `codex exec --json` meldet weder einen Befehl, den seine Sandbox blockiert hat, noch eine abgelehnte Rechteausweitung: Keins von beiden erscheint als Event (geprüft gegen Codex 0.163.0). Deshalb weist das Briefing Codex an, seine Antwort für jeden von der Sandbox blockierten Befehl mit `NEEDS-APPROVAL: <exact command>` zu beenden, und der Mod zählt außerdem die `reject command`-Zeilen, die Codex für abgelehnte Rechteausweitungen auf stderr schreibt. Dann, wie beim Claude-Child:

- Mit dem Standard read-only fragt der Mod Sie mit demselben Dialog, nennt die Befehle und was eine Freigabe erlaubt: *"Codex child on codex/default was refused by its read-only sandbox: touch made.txt. Allow and continue resumes it for this turn with permission to edit files in the project and run commands there (no network)."* Bei **Allow and continue** wird derselbe Thread wieder aufgenommen (`codex exec -C <cwd> resume --json … -c sandbox_mode="workspace-write" -c approval_policy="never" -c sandbox_workspace_write.network_access=false <thread> -`), mit einer Nachricht, die die freigegebenen Befehle nennt. Das erweitert die Sandbox für den Rest dieses Turns, nicht nur für die genannten Befehle, und deshalb sagt die Frage das auch. Es wird höchstens einmal pro Turn gefragt (`child.relayRounds: 0` schaltet das ab).
- Bei **Deny**, wenn niemand antworten kann oder wenn Ihre Sandbox bereits weiter als read-only ist, wird nichts erweitert, und die Ablehnung bleibt nie stumm: Die Antwort endet mit einer Zeile, die die abgelehnten Befehle nennt (*Codex's sandbox refused, and nothing ran: `touch made.txt`.*), und die Routing-Zeile zeigt `· sandbox read-only · refused: touch made.txt` (oder `refused: 2 unnamed` für Rechteausweitungen, die Codex nicht benannt hat).
- Da der Ablehnungsbericht aus Codex' eigener Antwort stammt, kann ein Modell, das die Anweisung ignoriert, eine Ablehnung trotzdem unbenannt lassen. Die Routing-Zeile zeigt immer die Sandbox, in der der Turn lief (`sandbox read-only` oder `sandbox workspace-write (approved)`), sodass ein Turn, der nicht schreiben konnte, als solcher erkennbar ist.

Wenn `codex` nicht im `PATH` ist, meldet der Mod `codex is not installed: npm install -g @openai/codex (or brew install --cask codex) …`, die Routing-Zeile sagt `child answer discarded (codex not installed)`, und das Hauptmodell antwortet.

**Grenzwertige Bewertungen bekommen eine zweite Meinung.** Eine Bewertung genau auf der Coding-Grenze oder eine darüber wird ein zweites Mal gesampelt, und die höhere gewinnt, sodass eine Debugging-Aufgabe mit 7 oder 8 nicht wegen Rauschen im Classifier die Stufe wechselt.

**Es merkt sich Fehlschläge.** Je zwei Child-Fehlschläge für eine Art senken die Coding-Grenze dieser Art um eins (nie unter `simple + 1`), sodass Arbeit, an der das günstige Modell immer wieder scheitert, zu Claude zurückwandert. `/route reset` löscht dieses Gedächtnis.

**Es schützt den Arbeitsfaden.** Ein Child hat kein Gedächtnis über sein Briefing hinaus, deshalb lässt der Mod nie eine Folgefrage bei einem landen. Nach einem vom Child beantworteten Turn gehen `continue`, `yes` oder jeder Prompt mit sechs Wörtern oder weniger zurück an die Hauptsitzung, die das ganze Transkript hat. Und solange die Hauptsitzung mitten in einer Aufgabe ist (ihre letzte Antwort hat Tools verwendet), bleibt Arbeit auf Coding-Niveau bei ihr (`via mid-task guard` in der Routing-Zeile); nur Nachschlagen und neue, in sich abgeschlossene Aufgaben gehen hinaus. Ohne diese Regeln würde eine Sitzung, die eine Aufgabe geroutet hatte, sie bei jedem "continue" neu beginnen.

**Manche Turns verlassen die Hauptsitzung nie**, unabhängig von Bewertung oder `/route`-Pin, weil ein Child weder die Unterhaltung noch Teammitglieder, Hintergrundaufgaben oder die Tools der Sitzung sehen kann (`via notification`, `via session command`, `via security or verdict` in der Routing-Zeile):

- Benachrichtigungen: `<teammate-message …>`, `idle_notification`-JSON, `<task-notification>`, `[SYSTEM NOTIFICATION …]`;
- kurze Bedienbefehle zu Sitzungszustand oder Tools (12 Wörter oder weniger): `approve git pull --ff-only`, `continue`, `resume`, `merge it`, `check the sub agents`, `what's the status`, alles, was einen PR, Branch, CI, Workflow oder Sub-Agent nennt;
- Security- und Urteils-Turns (`security`, `vulnerability`, `CVE`, `verdict`, …).

### Was ein Child nicht darf

Jedes Briefing beginnt mit einer Präambel: Das Child hat keinen Zugriff auf die Hauptsitzung, darf nie Status, IDs, PR-Nummern, Laufergebnisse oder Dateiänderungen erfinden, darf Sie nie bitten, etwas freizugeben oder auszuführen, und antwortet `HANDBACK`, wenn die Aufgabe den Zustand oder die Tools der Sitzung braucht. Der Mod prüft dann die Antwort und verwirft sie, sodass das Hauptmodell den Turn selbst übernimmt, wenn sie:

| Antwort | Beispiel |
| :- | :- |
| mit `HANDBACK` beginnt | `HANDBACK` / `needs the PR list` |
| entschuldigt sich und gibt auf oder gibt die Arbeit an Sie zurück | "I'm sorry, but I don't have permission…", "could you please review the repository? Once that's done, we can continue" |
| spricht über Sie mit jemand anderem, statt zu antworten | "The user can type \"continue\" or give the next instruction" |
| sagt, sie sei blockiert, oder Sie zum Handeln auffordert | "blocked by the permission system", "you must approve it in the UI", "run `gh pr create` yourself" |
| eine Aktion oder einen Sitzungsfakt ohne Tool-Aufruf behauptet (`num_turns` 1) | "I added X", "PR #812 is open", "14 commits behind", "no build runs exist" |
| hauptsächlich Absichten erzählt | "I'll read the config. Then I will update the router." |
| eine bereits gegebene Antwort wiederholt | dasselbe Urteil, bei jeder Idle-Benachrichtigung erneut gepostet |

Eine verworfene Antwort zählt als Child-Fehlschlag für diese Art und erscheint als `child answer discarded (<reason>), main model answered` in der Routing-Zeile. Das Hauptmodell wird nie gebeten, den Text eines Child weiterzugeben: Der Mod beantwortet den Turn mit einer geprüften Child-Antwort oder überlässt den Turn dem Hauptmodell.

Eine verworfene Antwort wird zuerst auf dem nächsten gleichwertigen Modell versucht, wie bei einer Überlastung (oben), und die Routenzeile sagt `child: glm-5.3 failed (gave up) → served by deepseek-v4-pro`. Zwei Fälle nicht: `HANDBACK`, bei dem das Kind die Hauptsitzung verlangt hat, und eine Bitte, dass Sie handeln, auf die jedes Modell gleich stoßen würde; diese übernimmt sofort das Hauptmodell.

Jede Routing-Zeile und die Leiste zeigen Bewertung und Art, sodass Sie, wenn eine Entscheidung falsch aussieht, die Zahlen dahinter sehen.

## Was Sie sehen

Claude und das Gateway sind beide jederzeit sichtbar:

| Ort | Turn der Hauptsitzung | Gerouteter Turn |
| :- | :- | :- |
| Leiste über dem Prompt | `mixture-of-models · auto · last: claude-opus-5 · critical 9/10`<br>`0: help  1: auto  2: glm  3: deepseek  …  9: claude  off` | `… · running glm-5.3 in a child…`, solange es läuft |
| Spinner | `Thinking…` | `Thinking · via glm-5.3 (child)…` |
| Fragedialog | Claudes eigene Fragen | `Child on glm-5.3 wants to run: Bash(git pull --ff-only)` mit Allow and continue / Deny |
| Antwort im Transkript | unverändert (oder markiert mit `⇢ claude-opus-5 · main session` bei `ui.tags: "all"`) | eine gedimmte Zeile `⇢ glm-5.3 · child on gateway` über der Antwort, die im Scrollback erhalten bleibt (`· child on your Claude subscription` für ein Claude-Mitglied, `· Codex child` für Codex) |
| Zeile unter der Antwort | `route: claude-opus-5 · main session · critical 9/10 via claude-haiku-5-5 · 23.1k in / 0.9k out · cache 91% · today: 8 turns, 5 off Claude (63%)` | `route: glm-5.3 · coding 6/10 via ollama · child 42s · saved ~$0.39 · today: …` |
| `/route` | `mixture-of-models live · mode auto · current route: … · today: … · saved ~$12.40 on 48 routed turns (82% of their Claude price) · 61% of all spend ($20.33) vs all claude-opus-5-5, at API prices` | dasselbe |
| `/palgu login` | `Open https://www.palgu.ai/connect?code=WDJB-MJHT and approve code WDJB-MJHT …`, dann ein Toast `Signed in to Palgu as you@acme.com (Acme, plan starter). Routed turns now run on Palgu.` | dasselbe |
| `/route stats` | Ein Bereich, "Mixture of models", mit vier Tabs auf den Tasten m, k, s und r (zuerst in den Bereich klicken; eine Ziffer allein in einem leeren Prompt drückt die Buttons der Leiste): **models** (Balken pro Modell, Anteil der Turns, die Kopfzeile "N of M turns off Claude" und in Grün, was das Routing gespart hat), **kinds** (jede Art und welche Modelle sie übernommen haben), **scores** (ein Histogramm 1-10, nach Stufe eingefärbt, Grenzen markiert), **recent** (die letzten Entscheidungen mit Bewertung, Art, Modell und Child-Zeit). Esc schließt ihn. | dasselbe |
| `/route usage` (`today`, `week`, `month`, `all`) | `Models used, last 7 days: 42 turns, 30 off Claude (71%)`, dann eine Zeile je Modell mit Anteil und Balken, die Modelle Ihrer Subagenten und die Ersparnis | dasselbe |
| `/route stats reset` | `stats reset: model counts, decision log, savings and subagent counts start again from now` | dasselbe |

### Wie viel es spart

Jeder geroutete Turn wird zweimal bepreist: zum Claude-Modell Ihrer Sitzung (was dieselben Tokens dort gekostet hätten) und zu dem, was er tatsächlich gekostet hat. Auf Palgu stammen die tatsächlichen Kosten aus Palgus eigenem `/v1/pricing/quote`, der Formel, nach der es abrechnet; auf einem anderen Gateway aus `router.prices`; ein `claude/<member>`-Child wird zum Claude-Tarif dieses Mitglieds bepreist. Turns, die in der Hauptsitzung bleiben, zählen ebenfalls zur Summe "alles auf Claude", sodass der Prozentsatz der Anteil Ihrer gesamten Claude-Rechnung ist, den das Routing weggenommen hat, nicht nur der gerouteten Turns.

- Unter jeder gerouteten Antwort: `· saved ~$0.39`.
- `/route status`: `saved ~$12.40 on 48 routed turns (82% of their Claude price) · 61% of all spend ($20.33) vs all claude-opus-5-5, at API prices`, eine laufende Summe über alle Sitzungen.
- `/route stats`: dieselbe Summe, in Grün, im Tab models.

In unserer eigenen Nutzung haben rund um die Uhr laufende Coding-Agents das Wochenlimit eines Claude-Max-20x-Abos allein mit Claude in etwa drei Tagen aufgebraucht; mit Mixture of Models hielt dasselbe Abo die vollen sieben Tage. Siehe [GUIDELINES.md](GUIDELINES.md#grobe-ersparnis-nur-abo-vs-mixture-of-models).

Es ist eine Schätzung, und das wird auch so gesagt. Claude-Preise sind die API-Listenpreise (Opus 5.5 $4 / $20 pro Million Input-/Output-Tokens, Sonnet 5.5 $2 / $10, Haiku 5.5 $0.10 / $0.50, Fable 5.1 $10 / $50; Cache-Lesezugriffe sowie 5-Minuten- und 1-Stunden-Cache-Schreibzugriffe zu ihren eigenen Tarifen). Bei einem claude.ai-Abo ist es also die Ersparnis in API-Äquivalent, kein zurückerstattetes Geld. Es wird angenommen, dass der geroutete Turn auf Claude dieselbe Anzahl Tokens verbraucht hätte. Ein gerouteter Turn, den der Mod nicht bepreisen kann (ein Gateway ohne `router.prices`-Eintrag für dieses Modell oder ein Codex-Child), beansprucht keine Ersparnis; `/route status` zählt ihn als unbepreist.

Die Buttons der Leiste haben Ziffern-Tastenkürzel: Tippen Sie bei leerem Prompt `3` und warten Sie kurz, um Kimi zu pinnen, `1` für zurück zu auto, `0` für die Hilfe: ein Bereich, der sagt, was der Mod tut, wo er steht (Modus, Gateway, Ersparnis), was jeder Button und Befehl tut und wie man Palgu, OpenRouter oder LiteLLM verbindet. `/route help` öffnet ihn ebenfalls. Die Leiste schalten Sie mit `"ui": { "band": false }` ab.

## Andere Coding-Agents

Der Mod läuft innerhalb von Claude Code. Für andere Agents bringen die `mom`-CLI und ein schlanker Adapter pro Tool dieselben Bausteine: Palgu wählt das Modell pro Request, Palgu-Memory wird in jeden Prompt abgerufen, und ein Turn, der mitten in der Aufgabe stoppt, wird fortgesetzt ([ADR 0005](../../adr/0005-other-coding-agents.md)).

```bash
npm install -g github:alinaqi/mixture-of-models-claude-mod   # installiert `mom` und die Plugin-Dateien jedes Agents
mom login                                                     # im Browser bei Palgu anmelden
```

Dann, für Ihren Agent:

```bash
# Codex
mom setup codex --write && codex plugin marketplace add alinaqi/mixture-of-models-claude-mod && codex plugin add mixture-of-models@mixture-of-models
codex -p palgu

# Cursor (im Projektordner; danach Developer: Reload Window)
mom setup cursor --write

# OpenCode
mom setup opencode --write

# Antigravity
agy plugin install "$(npm root -g)/mixture-of-models-claude-mod/integrations/antigravity"

# GitHub Copilot CLI
copilot plugin install alinaqi/mixture-of-models-claude-mod:integrations/copilot
```

Optional, pro Projekt, lädt den Quellcode zu Palgu hoch: `mom memory on`. Alle Befehle mit Prüfungen und Fehlerbehebung: [INSTALL.md](INSTALL.md). Wie Sie das Beste aus jedem Agent herausholen: [GUIDELINES.md](GUIDELINES.md).

| Agent | Status | Anleitung |
| :- | :- | :- |
| Codex (CLI, 0.163+) | Plugin: Memory-Abruf, Heartbeat, Indexierung; `codex -p palgu` routet über Palgu | [integrations/codex](integrations/codex/README.md) |
| Cursor | Plugin (oder `mom setup cursor`): MCP-Server für Palgu-Memory-Suche und Delegation an Palgu-Modelle (`mom mcp`), Heartbeat und Indexierung über Hooks, eine Regel, wann delegiert wird. Kein Routing pro Turn: Cursors Hooks können das Modell nicht ändern | [integrations/cursor](integrations/cursor/README.md) |
| OpenCode (1.19+) | Plugin mit vollem Funktionsumfang: Palgu-Modell pro Request (auto, `/route`-Pin oder Ihre Stufen-Routen), Memory-Abruf, Heartbeat, Indexierung, `/route` und `/palgu`; `mom setup opencode --write` fügt den Provider hinzu | [integrations/opencode](integrations/opencode/README.md) |
| Antigravity (`agy` 1.0.7+) | Plugin: Memory-Abruf in den ersten Modellaufruf jedes Turns, Heartbeat, Indexierung, Palgu-Tools über MCP (`palgu_delegate` für geroutete Teilaufgaben). Seine Hooks können das Modell nicht ändern | [integrations/antigravity](integrations/antigravity/README.md) |
| GitHub Copilot CLI (1.0.112+) | Plugin: Heartbeat, Indexierung, Palgu-Tools über MCP (Memory-Suche, `palgu_delegate`), ein Skill, wann sie zu verwenden sind. Seine Hooks können weder das Modell ändern noch etwas zu einem Prompt hinzufügen | [integrations/copilot](integrations/copilot/README.md) |
| Aider, Continue, Goose | Palgu routet (`model: auto`); keine Hooks, also kein Memory-Abruf und kein Heartbeat. Aider live geprüft | [integrations/gateway](integrations/gateway/README.md) |

Die Einwilligung für Palgu-Memory (`mom memory on`) gilt pro Projektordner und wird von jedem Agent geteilt, der `mom` verwendet. Sie ist unabhängig von `/palgu memory on` des Mods.

## Voraussetzungen

- Claude Code **v2.1.287 oder neuer** (`claude --version`). Mods laden auf älteren Builds nicht; `claude update`.
- Ein Gateway, das das Child nutzen kann: Palgus Anthropic-Endpoint, OpenRouter, ein LiteLLM-Proxy oder ein beliebiger Anthropic-kompatibler Endpoint, der die Modell-IDs in `routes` bereitstellt, mit seinem Key.
- Optional: Ollama mit einem kleinen Modell für kostenlose Klassifizierung (`ollama pull qwen2.5-coder:3b`). Ohne Ollama fällt der Classifier auf Haiku in Ihrem Plan zurück.

## Einrichtung

Siehe [GETTING_STARTED.md](GETTING_STARTED.md) für die vollständige Anleitung, oder `./install.sh`.

1. Geben Sie dem Child sein Gateway. Auf Palgu erledigt `/palgu login` diesen ganzen Schritt: Es verwendet Palgus Geräteanmeldung (dieselbe, die `srooterctl` verwendet), Palgu erzeugt einen Key für diesen Computer, den Sie auf seiner Seite Devices widerrufen können, und der Mod speichert URL und Key mit `claude plugin configure --values-stdin`. Andernfalls fragt das Plugin nach zwei Werten; der Key wird maskiert und im sicheren Speicher von Claude Code abgelegt, nie in einer Einstellungsdatei:

   ```
   /plugin configure mixture-of-models@mixture-of-models-claude-mod
   ```

   oder aus der Shell: Führen Sie `claude plugin configure mixture-of-models@mixture-of-models-claude-mod --values-stdin` aus, tippen Sie `{"gateway_url":"https://api.palgu.ai/anthropic","gateway_key":"<your key>"}` in die Eingabe und drücken Sie Ctrl-D, damit der Key nicht in Ihrer Shell-History und Prozessliste landet.

2. Passen Sie optional Routen, Schwellen und das Child in `~/.claude/model-config.json` an; `config.example.json` im Repo ist ein vollständiger Ausgangspunkt (auch unten gezeigt).

3. Starten Sie `claude` und führen Sie `/route` aus.

Solange Gateway-URL und Key fehlen, ist der Mod **nur beobachtend**: Er klassifiziert, und `/route` zeigt, was er tun würde, aber es startet kein Child.

Die dritte Option, `gateway_provider`, sagt, welche Art von Gateway es ist: `auto` (der Standard, auch wenn leer) erkennt Palgu (`*.palgu.ai`) und OpenRouter (`openrouter.ai`) an der URL und behandelt jeden anderen Host als generisches Anthropic-kompatibles Gateway, genau wie vor 0.16; `palgu`, `openrouter`, `litellm` oder `anthropic-compatible` benennen es direkt. Der Provider bestimmt, wie das Child den Key sendet und welche Modell-IDs die Standard-Routen und die Leiste verwenden:

| Provider | Child-Authentifizierung | Standard-Modell-IDs | `x-srooter-*`-Header |
| :- | :- | :- | :- |
| `palgu` | `ANTHROPIC_API_KEY` (`x-api-key`) | Palgus: `glm-5.3`, `deepseek-v4-pro`, … | ja |
| `openrouter` | `ANTHROPIC_AUTH_TOKEN` (`Authorization: Bearer`) | OpenRouter-Slugs hinter den Familien: `glm/5.3` → `z-ai/glm-5.3`, … | nein |
| `litellm` | `ANTHROPIC_AUTH_TOKEN` (`Authorization: Bearer`) | Palgus Namen; die `model_name`s Ihres Proxys entscheiden | nein |
| `anthropic-compatible` | `ANTHROPIC_API_KEY` (`x-api-key`) | Palgus | ja |

Welche Variable auch immer den Key trägt, die Umgebung des Child setzt die jeweils andere auf leer, weil das Child Ihre Shell erbt und Claude Code beide sendet, wenn beide gesetzt sind: Ein in Ihrer Shell exportiertes `ANTHROPIC_API_KEY` reist nie zu OpenRouter mit, und ein verirrtes `ANTHROPIC_AUTH_TOKEN` erreicht nie Palgu. Der Key steht nie in einer Befehlszeile.

### OpenRouter

1. Erstellen Sie einen Key unter [openrouter.ai/keys](https://openrouter.ai/keys).
2. `/plugin configure mixture-of-models@mixture-of-models-claude-mod` mit

   | Option | Wert |
   | :- | :- |
   | `gateway_url` | `https://openrouter.ai/api` |
   | `gateway_key` | Ihr OpenRouter-Key (`sk-or-…`) |
   | `gateway_provider` | `auto` (oder `openrouter`) |

   oder aus der Shell: Führen Sie `claude plugin configure mixture-of-models@mixture-of-models-claude-mod --values-stdin` aus, tippen Sie `{"gateway_url":"https://openrouter.ai/api","gateway_key":"<your key>","gateway_provider":"openrouter"}` in die Eingabe und drücken Sie Ctrl-D, damit der Key nicht in Ihrer Shell-History landet.
3. Starten Sie `claude`. Einfache und Coding-Turns laufen auf `z-ai/glm-5.3`, Research und Review auf `moonshotai/kimi-k3.1-pro`; die Leiste bietet `glm`, `kimi`, `deepseek` (`deepseek/deepseek-v4-pro`), `gemini` (`google/gemini-3.8-flash`), `minimax` (`minimax/minimax-m3`, `minimax/minimax-m3.1-flash`), `gpt` (`openai/gpt-6-sol`, `-luna`, `-astra`) und `mercury` (`inception/mercury-3`). Bei elf Buttons hat der letzte keine Zifferntaste; klicken Sie darauf oder springen Sie mit Tab hin. Das sind die Slugs, die [OpenRouters Modellliste](https://openrouter.ai/models) am 2026-10-29 angeboten hat. OpenRouter hat keine Kimi-Highspeed-Variante, daher ist `kimi/auto` für jede Stufe `pro`.

Routen auf OpenRouter nennen Familienmitglieder (`glm/5.3`), weil ein OpenRouter-Slug einen `/` enthält; ein Slug, den eine Familie auflistet (`z-ai/glm-5.3`), funktioniert ebenfalls. Für ein anderes OpenRouter-Modell fügen Sie es einer Familie hinzu und routen dorthin:

```json
{ "router": {
    "families": { "glm": { "members": { "4.6": "z-ai/glm-4.6" } } },
    "routes":   { "simple": "glm/4.6" } } }
```

Wie [OpenRouters Claude-Code-Anleitung](https://openrouter.ai/docs/guides/guides/claude-code-integration) sagt, funktioniert Claude Code garantiert nur mit Anthropics eigenen Modellen; ein gerouteter Turn, dessen Modell die Tools von Claude Code nicht beherrscht, schlägt fehl, und das Hauptmodell beantwortet ihn.

### LiteLLM

Ein [LiteLLM-Proxy](https://docs.litellm.ai/docs/tutorials/claude_responses_api) stellt sein Anthropic-kompatibles `/v1/messages` unter seiner eigenen Adresse bereit. Er läuft auf Ihrem Host und wird deshalb nie automatisch erkannt: Benennen Sie ihn.

| Option | Wert |
| :- | :- |
| `gateway_url` | Ihr Proxy, zum Beispiel `http://localhost:4000` (oder sein `/anthropic`-Durchgang, `http://localhost:4000/anthropic`) |
| `gateway_key` | der Master-Key oder ein virtueller Key des Proxys (`sk-…`) |
| `gateway_provider` | `litellm` |

Das Child sendet den Key als `Authorization: Bearer`. Modellnamen sind die `model_name`s, die die `config.yaml` Ihres Proxys definiert. Die Standards sind Palgus Namen (`glm-5.3`, `kimi-k3.1-pro`, …): Benennen Sie die Modelle Ihres Proxys genauso, oder lassen Sie die Routen auf Ihre zeigen:

```json
{ "router": {
    "routes":   { "simple": "my-glm", "coding": "my-glm", "kinds": { "research": "my-kimi", "review": "my-kimi" } },
    "families": { "glm": { "members": { "mine": "my-glm" } } } } }
```

Ein virtueller Key erreicht nur die Modelle, die ihm erlaubt sind; ein 401 oder ein unbekanntes Modell lässt das Child fehlschlagen, und das Hauptmodell antwortet.

## Sicherheit und Datennutzung

### Netzwerk-Hosts, die dieses Plugin kontaktiert

- `https://api.palgu.ai` — Palgu, fest im Code: `/auth/device/code` und `/auth/token` bei `/palgu login`, `/me` und `/me/org-settings` bei `/palgu status`, `/v1/models/health` beim Sitzungsstart, nach `/palgu login` und bei `/route models` (der Gateway-Key als `x-api-key`; sonst wird nichts gesendet), `/v1/pricing/quote` nach einem gerouteten Turn, wenn Ihr Gateway Palgu ist und `router.prices` keinen Eintrag für das Modell hat, `/anthropic/heartbeat`, wenn die Hauptsitzung einen Turn beendet (der Heartbeat, siehe unten), und `/v1/cortex/search` bei jedem Ihrer Prompts in einem Projekt, in dem Sie `/palgu memory on` ausgeführt haben (Palgu-Memory-Abruf, siehe unten).
- `https://raw.githubusercontent.com` — beim Sitzungsstart (höchstens alle 12 Stunden, im Hintergrund) und bei `/route update`: ein GET auf `/alinaqi/mixture-of-models-claude-mod/main/.claude-plugin/plugin.json`, um die veröffentlichte Version zu lesen. Es wird nichts gesendet.
- `http://localhost:11434` — ein lokales Ollama (`/api/chat`), das jeden Prompt bewertet. Es bleibt auf Ihrem Rechner; wird übersprungen, wenn dort nichts antwortet.
- Anthropic, über Claude Codes eigenes `$.model.classify` in Ihrem eigenen Plan — nur wenn Ollama nicht antwortet, um den Prompt zu bewerten.
- Die Gateway-URL, die Sie in den Plugin-Einstellungen festlegen (`gateway_url`, zum Beispiel `https://api.palgu.ai/anthropic`, `https://openrouter.ai/api` oder Ihr LiteLLM-Proxy). Der Benutzer kann in den Plugin-Einstellungen eine eigene Gateway-URL festlegen; nur diese URL wird für geroutete Turns kontaktiert, und es ist der Child-Prozess, nicht der Mod, der sie kontaktiert. Ein Codex-Child verwendet `/v1` dieses Gateways (oder die von Ihnen gesetzte `router.codex.baseUrl`) oder OpenAI mit Ihrem eigenen Codex-Login bei `codex.auth: "chatgpt"`. Ein `claude/<member>`-Child verwendet Anthropic mit Ihrem eigenen Claude-Login.

### Daten, die das Plugin sendet

- Unterhaltungsnachrichten (`session.messages`): der Prompt plus die letzten `router.child.contextMessages` Nachrichten (Standard 12), die Text enthalten, jede auf 1.200 Zeichen gekürzt, mit den Namen der Tools, die sie verwendet haben. Sie werden auf stdin des Child geschrieben, und das Child sendet sie an die obige Gateway-URL (bzw. für diese Routen an Anthropic oder Codex), um die Antwort des Modells zu erhalten. Nur bei einem gerouteten Turn gesendet: einem, den die Bewertung oder Ihr `/route`-Pin aus der Hauptsitzung wegschickt. Kritische, Security-, Benachrichtigungs- und Bedien-Turns werden selbst nie geroutet, aber der Kontext eines späteren gerouteten Turns kann ihren jüngsten Text enthalten, weil der Kontext aus den letzten Nachrichten mit Text besteht, unabhängig von deren Route. Während es arbeitet, sendet die eigene Agent-Schleife des Child außerdem, was seine Tools im Projekt lesen, unter den Deny-Regeln aus [Was ein Child nicht darf](#was-ein-child-nicht-darf).
- Der Prompt-Text und die Bewertungsskala: an das lokale Ollama oder über `$.model.classify` an Anthropic, für jeden Prompt, der die Klassifizierung erreicht.
- Lokale Dateiinhalte (`fs.read`): `~/.claude/model-config.json` (Ihre Einstellungen; nie gesendet) und `~/.claude/mixture-of-models/strategies/*.md` (Ihre Routing-Strategien; die Bewertungsskala der aktiven Strategie ist Teil des Bewertungs-Prompts und geht daher wie oben an Ollama oder Anthropic). Der Mod liest selbst keine Projektdateien.
- An Palgu: bei `/palgu login` die Client-ID `mixture-of-models`, der Gerätename `Claude Code on <HOSTNAME>`, die Version des Mods, eine zufällige Installations-ID und der Gerätecode; bei `/palgu status` der Gateway-Key als Bearer-Header; für ein Preisangebot die Modell-ID, vier Token-Zahlen und der Key. Kein Prompt- oder Antworttext.
- An Palgu, der Heartbeat: wenn die Hauptsitzung eine Antwort beendet und Ihr Gateway Palgu ist (und `router.heartbeat` nicht `local` oder `off` ist), die letzten 600 Zeichen dieser Antwort, eine Sitzungs-ID (die Installations-ID und die Nummer des Prompts) und der Key als `x-api-key`. Palgu sagt, ob der Turn mitten in der Aufgabe gestoppt hat. Sonst nichts aus der Unterhaltung.
- An Palgu, über die `palgu`-CLI und erst nachdem Sie `/palgu memory on` ausgeführt haben: die Quelldateien des Projekts, für Palgu-Memory (siehe Programme). `palgu` verwendet seine eigene Anmeldung.
- An Palgu, Palgu-Memory-Abruf, nur in einem Projektordner, in dem Sie `/palgu memory on` ausgeführt haben, und solange der Mod bei Palgu angemeldet ist: jeder Ihrer Prompts mit vier Wörtern oder mehr (auf einer Zeile, höchstens 300 Zeichen; keine Slash-Befehle), der Palgu-Name des Projekts und der Key als Bearer-Header, an `/v1/cortex/search`. Was zurückkommt (höchstens 8 einzeilige Verweise: festgehaltene Absichten und ADRs, Doku, Code-Symbole mit ihren Dateien; höchstens 2.000 Zeichen), wird für die Hauptsitzung neben Ihren Prompt gestellt und in das Briefing eines gerouteten Child (Claude, ein Palgu-Modell oder Codex) aufgenommen, sodass jedes Modell, das antwortet, dasselbe Memory sieht. Eine Suche, die fehlschlägt oder länger als 3 s dauert, fügt nichts hinzu und hält den Prompt nie auf.
- An ein Palgu- oder generisches Gateway die identifizierenden Header des Child: `x-srooter-client` (Name und Version des Mods), `x-srooter-project` (der Name des Sitzungsordners, als Slug) und auf Palgu `x-srooter-pin` (die geroutete Modell-ID). Siehe [Header, die das Child sendet](#header-die-das-child-sendet). Ein Child mit geroutetem Modell sendet außerdem `x-palgu-fallback: auto`.
- Es werden keine anderen Daten gesendet. Keine Telemetrie. Keine Analytics.

### Programme, die das Plugin ausführt

Bei jedem `$.process.run`-Aufruf stehen Programm und feste Flags als Literaltext am Aufruf. Keines davon läuft über eine Shell.

- `claude -p --model <model> --output-format stream-json --verbose --max-turns <n> --add-dir <cwd> <child.args> --disallowedTools <deny rules>` — Claude Code selbst, headless, um einen gerouteten Turn auf dem Gateway oder mit Ihrem Claude-Login auszuführen (`claude/<member>`-Routen). Dynamische Argumente: die Modell-ID (aus Ihren Routen oder Ihrem Pin; abgelehnt, sofern sie nicht eine schlichte ID aus Buchstaben, Ziffern und `. _ : / @ [ ] -` ist, die nicht mit `-` beginnt und höchstens 200 Zeichen hat), das Turn-Limit und `child.args`/`router.child.deny` aus Ihrer `model-config.json` sowie das Arbeitsverzeichnis der Sitzung; jedes wird abgelehnt, wenn es kein schlichter String ist oder ein NUL enthält. Nachdem Sie Befehle freigegeben haben, die dem Child verweigert wurden, ergänzt derselbe Aufruf `--resume <its session id> --allowedTools <the patterns you approved>`.
- `codex exec --json … -` und, nachdem Sie abgelehnte Befehle freigegeben haben, `codex exec -C <cwd> resume --json … <thread id> -` — die Codex CLI, nur für `codex`-Routen, mit denselben Prüfungen (die Thread-ID als schlichte ID).
- `claude plugin configure mixture-of-models@mixture-of-models-claude-mod --values-stdin` — einmal nach `/palgu login`, um den von Palgu erzeugten Key im sicheren Speicher von Claude Code abzulegen. Jedes Argument ist fester Text; der Key geht nur über stdin, und erst nachdem geprüft wurde, dass er ein schlichtes Token ist (`A-Z a-z 0-9 . _ -`, 8 bis 512 Zeichen).
- `claude plugin marketplace update mixture-of-models-claude-mod`, dann `claude plugin update mixture-of-models@mixture-of-models-claude-mod` — bei `/route update`, nur wenn GitHub eine neuere Version auflistet. Jedes Argument ist fester Text.
- `palgu memory index .` (im Sitzungsordner, im Hintergrund, höchstens alle 10 Minuten pro Projekt) und `palgu memory status . --json` — die Palgu-CLI, nur in einem Projektordner, in dem Sie `/palgu memory on` ausgeführt haben, und solange der Mod bei Palgu angemeldet ist. Jedes Argument ist fester Text. `palgu` meldet sich mit seinem eigenen Key an (`palgu login`); der Mod übergibt ihm keinen Key, keine Umgebung und kein stdin. Die Indexierung lädt die Quelldateien des Projekts zu Palgu hoch, deshalb ist sie aus, bis Sie sie einschalten.
- Das Plugin führt nie Befehle aus, die aus dem Netzwerk empfangen wurden. Netzwerkantworten stehen nie in einem `process.run`-argv: GitHubs Antwort entscheidet nur, ob die festen Update-Befehle laufen, und der einzige abgerufene Wert, der überhaupt einen Prozess erreicht, ist der Palgu-Key, über stdin, nach der obigen Prüfung.

### Hooks

- `prompt.submit` — liest den Prompt, um seine Route zu bestimmen (Vor-Regeln, dann die Classifier-Bewertung, dann die Schwellen). Reicht ihn unverändert durch: verwirft ihn nie, schreibt ihn nie um und ergänzt ihn nie. Fail-open.
- `turn.step` — führt bei einem gerouteten Turn statt des Hauptmodells das obige Child aus und beantwortet den Turn mit dessen Text; jeder andere Turn und jeder Subagent läuft unverändert durch. Eine fehlgeschlagene oder verworfene Child-Antwort gibt den Turn an das Hauptmodell zurück.
- `agent.spawn` — bevor ein eingebauter Subagent startet, bewertet es seine Aufgabe und wählt ein günstigeres Claude-Modell (Subagenten, oben); zählt das Modell jedes Subagenten.
- `turn.complete` — hängt die Routing-Zeile (Route, Bewertung, Kosten, Ersparnis) an den Text des Turns an und aktualisiert die Zähler, das Entscheidungslog und die Ersparnissummen im Plugin-Speicher. Dann der Heartbeat: Wenn die Antwort der Hauptsitzung mitten in der Aufgabe gestoppt hat (sie hat eine Aktion angekündigt und aufgehört oder, wenn Sie Änderungen verlangt haben, Änderungen beschrieben, die sie nicht vorgenommen hat), sendet der Mod selbst einen Fortsetzungs-Prompt (`$.prompt.submit`, dem Modell als von diesem Plugin stammend angezeigt), höchstens `router.heartbeatMax` (3) Mal pro Prompt von Ihnen. Fail-open: Ein Fehler blockiert nie ein Stoppen.
- Außerdem: `session.start` (liest die Einstellungen, registriert `/route` und `/palgu`), `turn.start` (löscht das letzte Child-Ergebnis), `ui.render` für `AbovePrompt` (die Leiste), `AssistantMessage` (eine Herkunftsmarkierung an Child-Antworten), `Pane` (die Hilfe- und Statistik-Bereiche) und `Spinner` (`via <model> (child)…`) sowie `command.run` für `/route` und `/palgu`. Der Mod behandelt nie `tool.call` oder `tool.check`.

### Hinzugefügte Befehle, Tools und Agents

- `/route` — zeigt den Routing-Zustand, pinnt eine Stufe, ein Modell, ein Familienmitglied oder `codex`, wechselt die Strategie, öffnet den Statistik- oder Hilfe-Bereich, setzt das Fehlergedächtnis zurück oder aktualisiert das Plugin (`/route update`).
- `/palgu` — meldet bei Palgu an (`login`), sagt, wessen Key gesetzt ist, was Ihre Organisation in diesem Zeitraum von ihrem Palgu-Budget verbraucht hat und ob das Projekt in Palgu-Memory ist (`status`), verlinkt Pläne und Abrechnung (`upgrade`) oder schaltet Palgu-Memory für das aktuelle Projekt ein oder aus (`memory on`, `memory off`, `memory`; jeder Projektordner braucht sein eigenes `memory on`).
- Der `routing-strategy`-Skill — hilft beim Schreiben oder Erklären einer Routing-Strategie-Datei.
- Keine Tools, keine Agents, keine MCP-Server.

### Zugangsdaten

- API-Keys werden vom Benutzer über die Plugin-Einstellungen eingegeben (`user_config`, als sensibel gespeichert): ein Key, `gateway_key`, für das Gateway, das Sie konfigurieren (Palgu, OpenRouter, LiteLLM oder einen anderen Anthropic-kompatiblen Endpoint). `/palgu login` füllt dieselbe Einstellung für Sie aus.
- Das Plugin liest keine Keys aus Umgebungsvariablen oder Dateien auf dem Rechner des Benutzers. Die Umgebungsvariablen, die es liest, sind `HOME`, `HOSTNAME`, `MAGGY_ROUTER_CHILD` und `ANTHROPIC_CUSTOM_HEADERS` (Ihre eigenen zusätzlichen Header, nur an das Gateway-Child weitergegeben).
- Jeder Key wird nur an den Host seines eigenen Anbieters gesendet: `gateway_key` erreicht das von Ihnen konfigurierte Gateway (oder, bei einer Codex-Route, die `router.codex.baseUrl`, die Sie in `model-config.json` gesetzt haben), durch den Child-Prozess, aus der Umgebung des Child (nie aus seinem argv), und erreicht `https://api.palgu.ai` vom Mod aus nur, wenn dieses Gateway Palgu ist.

## Was dieses Plugin ausführt, liest, sendet und speichert

Der Sicherheitsscan des Verzeichnisses vergleicht diesen Abschnitt mit dem Code. Alles, was der Mod außerhalb seines eigenen Codes tut, ist hier aufgeführt. In einem Atemzug:

- Nur wenn Sie `/palgu` ausführen, **ruft** er `https://api.palgu.ai` **ab** (`/auth/device/code`, `/auth/token`, `/me`) und **führt** einmal `claude plugin configure … --values-stdin` **aus**, um den von Palgu erzeugten Key zu speichern (siehe die Tabellen unten).
- Er **ruft** `http://localhost:11434/api/chat` mit `$.http.fetch` **ab** und sendet dabei Prompt-Text und Bewertungsskala an ein lokales Ollama, um den Prompt zu bewerten. Keine Zugangsdaten, nichts verlässt den Rechner.
- Er **ruft** `$.model.classify` **auf**, das denselben Prompt-Text und dieselbe Skala über Claude Codes eigenen API-Client mit Ihrem eigenen Konto an Anthropic sendet, wenn Ollama nicht antwortet.
- Beim Sitzungsstart, im Hintergrund und höchstens alle 12 Stunden, und bei `/route update` **ruft** er `https://raw.githubusercontent.com/alinaqi/mixture-of-models-claude-mod/main/.claude-plugin/plugin.json` **ab** (ein einfaches GET, es wird nichts gesendet), um zu sehen, ob eine neuere Version erschienen ist, und meldet das in einem Toast und auf dem Band.
- Nur bei `/route update`, wenn GitHub eine neuere Version auflistet, **führt** er `claude plugin marketplace update` und `claude plugin update` für dieses Plugin **aus**, als festen Text.
- Er **führt** für geroutete Turns zwei Programme mit `$.process.run` **aus**: `claude` (Claude Code selbst, headless), entweder mit `ANTHROPIC_BASE_URL` und dem von Ihnen konfigurierten Key (in `ANTHROPIC_API_KEY`, oder `ANTHROPIC_AUTH_TOKEN` für OpenRouter und LiteLLM, die jeweils andere leer gesetzt) und, für Palgu und generische Gateways, mit `ANTHROPIC_CUSTOM_HEADERS` zur Identifizierung (siehe [Header, die das Child sendet](#header-die-das-child-sendet)), oder, für eine `claude/<member>`-Route, mit Ihrem eigenen Claude-Login und geleertem `ANTHROPIC_BASE_URL`; und, nur für eine `codex`-Route, `codex exec` (die Codex CLI), mit Ihrem Gateway-Key in `PALGU_API_KEY` (`OPENROUTER_API_KEY` auf OpenRouter, `LITELLM_API_KEY` auf LiteLLM) oder mit Ihrem eigenen Codex-Login. Jedes Child **sendet** Ihren Prompt und ein kurzes Briefing mit jüngstem Sitzungstext an seinen Endpoint.
- Er **liest** `~/.claude/model-config.json`, Ihre Strategiedateien, `HOME`, `HOSTNAME`, `MAGGY_ROUTER_CHILD` und `ANTHROPIC_CUSTOM_HEADERS` und **speichert** im Plugin-Speicher den Routing-Pin, Zähler pro Tag, das letzte Urteil, Fehlerzähler pro Art, die letzte Update-Prüfung und ein Log der letzten 200 Entscheidungen (Tag, Modell, Art, Stufe, Bewertung, Classifier-Quelle, Child-Zeit und Exit-Code; nie Prompt-Text).

Details folgen; eine Datenschutzerklärung finden Sie in [PRIVACY.md](PRIVACY.md).

### Hooks

Das Hooks-Modul `hooks/register.js` registriert zwölf Hooks. Was jeder mit den Events und Aufrufen tut, die er sieht:

| Hook | Was er tut |
| :- | :- |
| `session.start` | Liest `~/.claude/model-config.json` und Ihre Strategiedateien, übernimmt Gateway-URL und Key aus den Optionen des Plugins, merkt sich das Modell der Sitzung, lädt den `/route`-Pin aus dem Plugin-Speicher und registriert die Befehle `/route` und `/palgu`. Tut nichts, wenn `MAGGY_ROUTER_CHILD` gesetzt ist, sodass der Mod in seinem eigenen Child inaktiv bleibt. |
| `prompt.submit` | Reicht jeden Prompt unverändert durch. Nebenbei bestimmt er die Route: zuerst die Vor-Regeln, dann eine Blast-Bewertung 1-10 vom Classifier (siehe Netzwerk), dann die Schwellen. Verwirft nie einen Prompt, schreibt ihn nie um und ergänzt ihn nie. Fail-open: Wenn die Bewertung eine Exception wirft, geht der Prompt trotzdem durch. |
| `turn.start` | Löscht das Child-Ergebnis des vorigen Turns. |
| `turn.step` | Führt bei einem gerouteten Turn, statt die Hauptsitzung ihr Modell aufrufen zu lassen, den unter Programme beschriebenen Child-Prozess aus (Claude Code auf dem Gateway oder mit Ihrem Claude-Login, oder Codex) und liefert den Text des Child als Antwort des Turns mit `stopReason: end_turn`. Wenn das Berechtigungssystem des Child einen Befehl abgelehnt hat, fragt der Hook Sie mit `$.ui.ask` (dem Dialog, den Claude für Fragen verwendet) und nennt die genauen Befehle; bei "Allow and continue" setzt er dasselbe Child mit diesen erlaubten Befehlen fort, bis zu `relayRounds` Mal; bei "Deny" oder wenn niemand antworten kann, ist die eigene Erklärung des Child die Antwort. Ein Codex-Child wird auf dieselbe Weise zu den Befehlen gefragt, die es als abgelehnt nennt, einmal pro Turn; bei "Allow and continue" wird derselbe Codex-Thread mit erlaubten Änderungen im Projekt fortgesetzt (siehe [Sandbox und Freigaben](#sandbox-und-freigaben)). Für jeden anderen Turn und für Subagents ruft er `next(e)` unverändert auf. Wenn das Child fehlschlägt oder nichts ausgibt, ruft er `next(e)` auf, sodass das Hauptmodell antwortet. |
| `agent.spawn` | Bevor das Agent-Tool einen eingebauten Subagenten startet, den die Regeln nennen (`router.subagents`), bewertet es seine Aufgabe (die ersten 2.000 Zeichen, mit demselben Klassifikator wie Prompts) und setzt sein Modell: Haiku für einfach, Sonnet für Coding, unverändert für kritisch, und nie eines, das teurer ist als das des Elternteils. Ein schon gewähltes Modell, der Agent eines Plugins oder Ihr eigener, ein Fork, ein Teammate und ein Workflow-Agent bleiben unberührt. Zählt das Modell jedes Subagenten für `/route usage`. |
| `turn.complete` | Hängt unter der Antwort eine Zeile mit Route, Bewertung, Kosten und Ausführungsort an sowie mit dem, was ein gerouteter Turn gespart hat; aktualisiert Zähler pro Tag und die Ersparnissummen im Plugin-Speicher. Auf Palgu fragt er `/v1/pricing/quote`, was der geroutete Turn gekostet hat. |
| `ui.render` für `AbovePrompt` | Zeichnet die Leiste: den aktuellen Modus und die letzte Entscheidung sowie Buttons, die den `/route`-Pin ändern. Behält bei, was andere Mods dort zeichnen. |
| `ui.render` für `AssistantMessage` | Setzt eine gedimmte Herkunftszeile über eine Antwort, die das Child erzeugt hat. Andere Antworten werden durchgereicht. |
| `ui.render` für `Spinner` | Ergänzt während eines gerouteten Turns `via <model> (child)…` nach dem Wort des Spinners. |
| `ui.render` für `Pane` | Zeichnet den Statistik-Bereich "Mixture of models" (ID `routing-stats`) aus dem Entscheidungslog, wenn `/route stats` ihn geöffnet hat. Andere Bereiche werden durchgereicht. |
| `command.run` für `/palgu` | `login` startet Palgus Geräteanmeldung und antwortet sofort mit Link und Code; ein `$.clock`-Timer fragt dann alle `interval` Sekunden `/auth/token` ab (5 mehr nach jedem `slow_down`), bis Sie bestätigen, ablehnen oder der Code abläuft, speichert dann den Key und stellt das Child für diese Sitzung auf Palgu um. `status` fragt Palgus `/me`, wem der Key gehört; `upgrade` gibt den Abrechnungslink aus. |
| `command.run` für `/route` | Zeigt den Routing-Zustand und die Familien (`/route`, `/route status`) oder setzt den Pin (`auto`, `off`, eine Stufe, ein Modell, `<family>/<member>`, `<family>/auto` oder `codex`). Eine unbekannte Familie oder ein unbekanntes Mitglied wird mit der Liste der gültigen abgelehnt. |

Der Mod behandelt nie `tool.call` oder `tool.check`; er genehmigt, verweigert oder ändert also nie einen Tool-Aufruf und ändert nie Berechtigungsabfragen.

### Netzwerk: die Hosts, die dieses Plugin kontaktiert

Zuerst die eigenen Aufrufe des Mods, dann die des Child-Prozesses:

| Wer | Aufruf | Adresse | Was gesendet wird | Warum |
| :- | :- | :- | :- | :- |
| Der Mod, beim Sitzungsstart (höchstens alle 12 Stunden) und in `/route update` | `$.http.fetch` | `https://raw.githubusercontent.com/alinaqi/mixture-of-models-claude-mod/main/.claude-plugin/plugin.json`, fest im Code | Nichts außer dem GET | Liest die veröffentlichte Version, um sie mit Ihrer zu vergleichen. |
| Der Mod, in `/palgu login` | `$.http.fetch` | `https://api.palgu.ai/auth/device/code`, dann `/auth/token`, fest im Code | Die Client-ID `mixture-of-models`, der Gerätename (`Claude Code on <HOSTNAME>`), die Version des Mods und eine zufällige Installations-ID, die er in seinem Speicher hält; dann der Gerätecode, den Palgu ihm gegeben hat | Anmeldung. Palgu antwortet mit einem Key für diesen Computer. |
| Der Mod, beim Sitzungsstart, nach `/palgu login` und bei `/route models` | `$.http.fetch` | `https://api.palgu.ai/v1/models/health`, fest im Code | Nichts außer dem GET und dem Gateway-Key als `x-api-key`; nur wenn Ihre `gateway_url` auf `https://api.palgu.ai` liegt | Liest, welche Modelle Palgu jetzt bereitstellt und welche ausgefallen sind, damit die Modellliste Palgu folgt statt einem Release. Für die nächste Sitzung im Speicher des Mods abgelegt. |
| Der Mod, in `turn.complete` nach einem gerouteten Turn auf Palgu | `$.http.fetch` | `https://api.palgu.ai/v1/pricing/quote`, fest im Code | Die geroutete Modell-ID und die vier Token-Zahlen des Child (Input, Output, Cache-Lesen, Cache-Schreiben) sowie der Gateway-Key als Bearer-Header; nur wenn Ihre `gateway_url` auf `https://api.palgu.ai` liegt und `router.prices` keinen Eintrag für dieses Modell hat | Bepreist den Turn für die Ersparnisschätzung. Kein Prompt- oder Antworttext. |
| Der Mod, in `prompt.submit`, nur wo `/palgu memory on` ausgeführt wurde | `$.http.fetch` | `https://api.palgu.ai/v1/cortex/search`, Host und Pfad fest im Code | Ihr Prompt (eine Zeile, höchstens 300 Zeichen), der Palgu-Name des Projekts, `limit=8` und der Gateway-Key als Bearer-Header; nur wenn Ihre `gateway_url` auf `https://api.palgu.ai` liegt | Palgu-Memory-Abruf: Verweise aus dem Memory des Projekts kommen für die Hauptsitzung neben den Prompt und in das Briefing eines gerouteten Child. |
| Der Mod, in `/palgu status` | `$.http.fetch` | `https://api.palgu.ai/me` und `https://api.palgu.ai/me/org-settings`, fest im Code | Der Gateway-Key als Bearer-Header, nur wenn Ihre `gateway_url` auf `https://api.palgu.ai` liegt (der Key eines anderen Gateways wird nie gesendet) | Sagt, wem der Key gehört, welchen Plan die Organisation hat und was sie in diesem Zeitraum von ihrem Palgu-Budget verbraucht hat. |
| Der Mod, in `prompt.submit` | `$.http.fetch` | `http://localhost:11434/api/chat`, fest im Code | Die Bewertungsskala und der Prompt-Text, als Ollama-Chat-Request, ohne Zugangsdaten | Kostenlose lokale Klassifizierung. Übersprungen, wenn dort nichts antwortet. |
| Der Mod, in `prompt.submit` | `$.model.classify` | Anthropics API über Claude Codes eigenen Client und Ihren eigenen Plan | Die Bewertungsskala und der Prompt-Text | Klassifizierung, wenn Ollama nicht verfügbar ist. Modell: der `classifier`-Alias, standardmäßig `claude-haiku-5-5`. |
| Der Child-Prozess (Claude Code selbst), gestartet in `turn.step` | Claude Codes normaler API-Client | Die `gateway_url`, die Sie in den Optionen des Plugins setzen (zum Beispiel `https://api.palgu.ai/anthropic`, `https://openrouter.ai/api` oder Ihr LiteLLM-Proxy), mit `gateway_key` als `x-api-key` (Palgu, generisch) oder `Authorization: Bearer` (OpenRouter, LiteLLM) | Ihr Prompt plus ein Briefing der letzten `contextMessages` Wechsel der Sitzung (nur Text, gekürzt), dann was die eigene Agent-Schleife des Child während der Arbeit sendet | Genau das ist der Zweck des Plugins: Der Turn läuft auf dem Modell des Gateways statt auf dem der Hauptsitzung. |
| Ein Claude-Mitglied-Child (`claude/<member>`-Routen), gestartet in `turn.step` | Claude Codes normaler API-Client | Anthropic, mit Ihrem eigenen claude.ai-Login, wie Ihre Hauptsitzung | Dasselbe Briefing, dann die eigene Agent-Schleife des Child | Führt den Turn auf einem anderen Claude-Modell aus, ohne die Hauptsitzung umzuleiten. |
| Das Codex-Child (`codex`-Routen), gestartet in `turn.step` | Der eigene Client der Codex CLI | Mit `codex.auth: "palgu"`: `/v1` Ihres Gateways (zum Beispiel `https://api.palgu.ai/v1/responses`, `https://openrouter.ai/api/v1/responses` oder `<your LiteLLM proxy>/v1/responses`) mit `gateway_key`; mit `"chatgpt"`: OpenAI, mit Ihrem eigenen Codex-Login | Dasselbe Briefing, dann Codex' eigene Agent-Schleife | Führt den Turn auf Codex aus. |

Der Mod kontaktiert keinen anderen Host. Das Gateway ist das, was Sie konfigurieren; nichts wird an einen festen Dritten gesendet.

### Programme, die dieses Plugin ausführt

**Welche Programme:** drei, `palgu` (die Palgu-CLI, nur nach `/palgu memory on`: `palgu memory index .` und `palgu memory status . --json`, beide fester Text), `claude` (Claude Code selbst im Headless-Modus, und einmal nach `/palgu login` als `claude plugin configure mixture-of-models@mixture-of-models-claude-mod --values-stdin`, mit Gateway-URL und Key auf stdin, um sie zu speichern; und bei `/route update`, wenn eine neuere Version veröffentlicht ist, `claude plugin marketplace update mixture-of-models-claude-mod`, dann `claude plugin update mixture-of-models@mixture-of-models-claude-mod`) und `codex` (die Codex CLI, `codex exec`, nur für `codex`-Routen). Das Plugin führt keine Shell, kein im Plugin-Ordner mitgeliefertes Skript, keinen Paket-Launcher und keine andere ausführbare Datei aus.

**Warum:** Ein Mod kann das Modell eines Requests umbenennen, aber nicht den Endpoint oder die Zugangsdaten der Sitzung ändern, in der er läuft. Die einzige Möglichkeit, einen Turn mit Claude Codes eigenen Tools auf einem anderen Endpoint auszuführen und dabei Endpoint und Zugangsdaten der Hauptsitzung unangetastet zu lassen, ist ein zweiter Claude-Code-Prozess, dessen Umgebung auf das Gateway zeigt. Allein aus diesem Grund existiert das Child, und nur für Turns, die die Bewertung aus der Hauptsitzung wegroutet. Dieselbe Begründung gilt für ein anderes Claude-Modell (die Hauptsitzung wird nie umbenannt, also läuft ein anderes Mitglied in einem eigenen Prozess) und für Codex (eine andere Agent-CLI, die nur als eigener Prozess läuft).

**Wie:** vier `$.process.run`-Aufrufe in `turn.step`, ein erster Lauf und ein fortgesetzter Lauf für jedes Programm, jeder mit Programmname und festen Flags als Literaltext am Aufruf: `claude` und `codex`. Die dynamischen Werte werden zuerst geprüft (siehe [Programme, die das Plugin ausführt](#programme-die-das-plugin-ausführt)). Die `claude`-Argumente für eine Gateway-Route:

```
claude -p --model <routed model id> --output-format stream-json --verbose --max-turns <child.maxTurns> --add-dir <session cwd> --bare --permission-mode acceptEdits
```

Für eine `claude/<member>`-Route läuft dasselbe Programm mit `--model <member id>` und `child.subscriptionArgs` (`--permission-mode acceptEdits`) anstelle von `child.args`, also ohne `--bare`, und seine Umgebung ist `MAGGY_ROUTER_CHILD=1` plus leer gesetztes `ANTHROPIC_BASE_URL`, sodass es mit Ihrem Claude-Login läuft.

Für eine `codex`-Route ist das Programm `codex`, mit den unter [Codex als Child-Prozess](#codex-als-child-prozess) gezeigten Argumenten (und, nur nachdem Sie einen abgelehnten Befehl freigegeben haben, `exec -C <cwd> resume … <thread> -`, wie dort beschrieben), dem Briefing auf stdin, der Umgebung `MAGGY_ROUTER_CHILD=1` plus, nur auf dem Gateway-Weg, dem Key in `PALGU_API_KEY` (`OPENROUTER_API_KEY` auf OpenRouter, `LITELLM_API_KEY` auf LiteLLM), und demselben `child.timeoutMs`.

Für das Gateway- und das Claude-Mitglied-Child, und nur nachdem Sie einen weitergeleiteten Befehl freigegeben haben (siehe unten), läuft dasselbe Programm erneut mit angehängtem `--resume <that child's session id> --allowedTools <the approved patterns>`, sodass dasselbe Child weitermacht. `--bare` hält Ihre Hooks, Plugins und Ihren Schlüsselbund aus dem Child heraus. `child.args` ersetzt die letzten drei Flags, wenn Sie es setzen. Die Umgebung des Gateway-Child ergänzt `ANTHROPIC_BASE_URL`, den Key in `ANTHROPIC_API_KEY` mit leerem `ANTHROPIC_AUTH_TOKEN` (Palgu, generisch) oder in `ANTHROPIC_AUTH_TOKEN` mit leerem `ANTHROPIC_API_KEY` (OpenRouter, LiteLLM), `ANTHROPIC_CUSTOM_HEADERS` (unten), `CLAUDE_CODE_MAX_RETRIES` (`child.maxRetries`) und `MAGGY_ROUTER_CHILD=1`; das Claude-Mitglied- und das Codex-Child bekommen keine identifizierenden Header. Das Briefing wird auf sein stdin geschrieben. Es läuft im Arbeitsverzeichnis der Sitzung mit Claude Codes Tools unter diesem Berechtigungsmodus, kann dort also Dateien lesen und bearbeiten und Befehle ausführen, die der Modus erlaubt; diese Befehle sind eigene Agent-Entscheidungen des Child, gesteuert von Claude Codes Berechtigungssystem, keine Befehle, die dieses Plugin erteilt. Es wird bei `child.timeoutMs` beendet.

### Header, die das Child sendet

Jeder Request, den das Child an ein Palgu- oder generisches Gateway stellt, trägt zwei Header, damit Palgus Dashboard seinen Traffic als Mixture-of-Models anzeigen kann, pro Projekt. Auf OpenRouter und LiteLLM, die sie nicht auswerten, werden sie weggelassen, und nur Ihre eigenen `ANTHROPIC_CUSTOM_HEADERS` werden gesendet:

```
x-srooter-client: mixture-of-models/0.16.0
x-srooter-project: <the session folder's name>
```

Das Projekt ist das letzte Segment des Arbeitsverzeichnisses der Sitzung, als Slug so gebildet wie bei der Projekterkennung des Gateways: Alles außerhalb von `[A-Za-z0-9._-]` wird zu `-`, führende und abschließende `-._` werden entfernt, höchstens 64 Zeichen, Kleinbuchstaben (`/Users/me/My App` → `my-app`). Bleibt nichts Brauchbares übrig, wird der Header weggelassen. Keiner der Header enthält einen Pfad, Prompt-Text oder sonst etwas.

Sie kommen in die `ANTHROPIC_CUSTOM_HEADERS` des Child (Claude Codes durch Zeilenumbrüche getrennte `Name: value`-Liste), gesetzt an derselben Stelle wie `ANTHROPIC_BASE_URL`: kein Gateway konfiguriert, keine Header, und das Child spricht nur mit diesem Gateway. Wenn Sie `ANTHROPIC_CUSTOM_HEADERS` bereits setzen, kommen Ihre Zeilen zuerst und bleiben erhalten; ein eigenes `x-srooter-client` oder `x-srooter-project` hat Vorrang vor dem des Mods. Die Requests der Hauptsitzung bleiben unverändert.

Ein Child mit geroutetem Modell sendet außerdem `x-srooter-pin: <model>`, damit Palgu genau dieses Modell bedient, und `x-palgu-fallback: auto`, damit das Gateway einen gepinnten Request bei Überlastung an ein gleichwertiges Modell weitergeben kann, statt ihn scheitern zu lassen. Ein eigenes `x-palgu-fallback` in `ANTHROPIC_CUSTOM_HEADERS` hat Vorrang.

### Dateien und Umgebung, die es liest

- `~/.claude/model-config.json`, über `$.fs.read`, für Routen, Schwellen, den Classifier-Alias und Child-Einstellungen. Sie enthält keine Zugangsdaten. Fehlt sie oder ist sie ungültig, gelten die Standards.
- `~/.claude/mixture-of-models/strategies/*.md`, über `$.fs.list` und `$.fs.read`, für Ihre Routing-Strategien, beim Sitzungsstart und bei `/route strategy` oder `/route strategies`.
- Die Umgebungsvariablen `HOME`, `HOSTNAME` (für den Palgu-Gerätenamen), `MAGGY_ROUTER_CHILD` und `ANTHROPIC_CUSTOM_HEADERS` (um Ihre eigenen Custom-Header im Child zu erhalten), über `$.env.get`.
- Sonst nichts. Der Gateway-Key wird nie aus einer Datei oder der Umgebung gelesen; er kommt nur aus der Plugin-Option `gateway_key`, die Claude Code im sicheren Speicher hält.

### Was es speichert

Im eigenen Speicher des Plugins (`$.store`, unter `~/.claude/plugins/store/`): eine zufällige Installations-ID für die Palgu-Anmeldung (`palgu-install-id`, damit Palgu über Anmeldungen hinweg ein Gerät sieht), die Projektordner, in denen Palgu-Memory an ist, und wann jeder zuletzt indexiert wurde (sein Ordnerpfad), die letzte Modellliste, die Palgu geliefert hat, den `/route`-Pin, Zähler pro Tag und Modell, das letzte Urteil, Fehlerzähler pro Art, die letzte Update-Prüfung (wann, die Version, die GitHub aufgelistet hat, und die Version, über die Sie informiert wurden) und ein Log der letzten 200 Entscheidungen (Tag, Modell, Art, Stufe, Bewertung, Classifier-Quelle, Child-Dauer und Exit-Code). Kein Prompt-Text, keine Antworten, keine Zugangsdaten.

### Was es nie tut

Es schreibt nie in Einstellungsdateien, in `model-config.json` oder nach `~/.codex`, ändert nie Modell, Endpoint oder Zugangsdaten der Hauptsitzung, behandelt nie Tool-Aufrufe und sendet nie Daten anderswohin als an die oben aufgeführten Hosts: die beiden Classifier-Ziele, Palgu und GitHub für die Befehle, die sie nennen, und das von Ihnen konfigurierte Gateway.

## Konfiguration

Der Mod liest Maggys einzige Quelle der Wahrheit, `~/.claude/model-config.json`, und ergänzt einen optionalen `router`-Block. Er schreibt nie in diese Datei.

```json
{
  "primary": "glm",
  "router": {
    "provider":   "auto",
    "routes":     { "simple": "glm-5.3", "coding": "glm-5.3", "critical": "claude",
                    "kinds": { "research": "deepseek-v4-pro", "review": "deepseek-v4-pro", "multimodal": "claude" } },
    "thresholds": { "simple": 3, "coding": 7 },
    "ollama":     { "model": "qwen2.5-coder:3b" },
    "classifier": "claude-haiku-5-5",
    "child": {
      "baseUrl":  "https://api.palgu.ai/anthropic",
      "args":     ["--bare", "--permission-mode", "acceptEdits"],
      "subscriptionArgs": ["--permission-mode", "acceptEdits"],
      "deny":     [],
      "maxTurns": 25,
      "timeoutMs": 600000,
      "maxRetries": 2,
      "fallbacks": 3,
      "longContext": [],
      "contextMessages": 12,
      "relayRounds": 2
    },
    "families": {
      "claude": { "members": { "fable": "claude-fable-5-1", "opus": "claude-opus-5-5", "sonnet": "claude-sonnet-5-5", "haiku": "claude-haiku-5-5" },
                  "auto":    { "simple": "haiku", "coding": "sonnet", "critical": "opus" } },
      "kimi":   { "members": { "pro": "kimi-k3.1-pro", "highspeed": "kimi-k3.1-pro-highspeed" },
                  "auto":    { "simple": "highspeed", "coding": "pro", "critical": "pro" } }
    },
    "codex":   { "auth": "palgu", "baseUrl": "", "sandbox": "read-only", "allowOutsideGit": false, "args": [] },
    "ui":      { "band": true, "tags": "routed" },
    "summary": true
  }
}
```

Eine Konfiguration, die jede Stufe auf ein Claude-Mitglied legt, mit Fable für die schwierigsten Turns und Codex für Reviews:

```json
{ "router": {
    "routes":   { "simple": "claude/auto", "coding": "claude/auto", "critical": "claude/auto", "kinds": { "review": "codex" } },
    "families": { "claude": { "auto": { "criticalPlus": "fable" } } } } }
```

- `routes`: Stufe → Modell-ID, die das Gateway bereitstellt, plus `routes.kinds`: Art → Modell für die nicht-kritischen Stufen. `"claude"` bedeutet die Hauptsitzung.
- `primary` (Maggys verfolgtes Modell, gesetzt mit `/model-config`): `glm`, `kimi` oder `deepseek` lässt die `coding`-Stufe ihm folgen, sofern `routes.coding` nicht gesetzt ist. `primary: claude` ändert nichts: `critical` ist bereits auf Claude, und `coding` bleibt günstig, außer Sie setzen `routes.coding` auf `"claude"`.
- `thresholds`: die Grenzen der Blast-Bewertung, standardmäßig `{ "simple": 3, "coding": 7 }`.
- `subagents`: für welche eingebauten Subagenten die Mod ein Claude-Modell wählt, je Agententyp: `auto` bewertet die Aufgabe, `simple`, `coding` oder `critical` legt die Stufe fest, `off` (oder ein nicht genannter Typ) überlässt es Claude Code. Standard `{ "general-purpose": "auto", "Explore": "simple" }`.
- `subagentModels`: das Claude-Modell je Stufe für diese Subagenten, standardmäßig `{ "simple": "haiku", "coding": "sonnet" }`; kritisch behält das Modell des Elternteils, und ein Modell, das nicht günstiger ist als das des Elternteils, wird nie gesetzt.
- `classifier`: das Claude-Modell, das verwendet wird, wenn Ollama nicht erreichbar ist. Nur undatierte Aliase (`claude-haiku-5-5`, `claude-sonnet-5`, `claude-opus-5`).
- `provider`: der Gateway-Provider, wenn die Plugin-Option `gateway_provider` nicht gesetzt oder `auto` ist: `palgu`, `openrouter`, `litellm` oder `anthropic-compatible`. Nicht gesetzt, wird er aus der Gateway-URL erkannt (siehe [Einrichtung](#einrichtung)). Er wählt die Standard-`routes`, -`families`, die Buttons der Leiste und die Authentifizierung des Child; was Sie in `routes` oder `families` setzen, hat weiterhin Vorrang.
- `child.baseUrl`: Fallback für die Gateway-URL, wenn die Plugin-Option `gateway_url` nicht gesetzt ist. Der Key hat keinen Fallback; er kommt nur aus der Option `gateway_key`.
- `child.auth`: `x-api-key` (`ANTHROPIC_API_KEY`) oder `bearer` (`ANTHROPIC_AUTH_TOKEN`), gesetzt anhand des Providers; setzen Sie es selbst für ein generisches Gateway, das ein Bearer-Token verlangt. `child.identify`: die `x-srooter-*`-Header senden (an für Palgu und generische Gateways).
- `child.args`: zusätzliche Flags. Der Standard ist `--bare` (keine geerbten Hooks oder Plugins, nur API-Key-Authentifizierung, sodass das Child nie auf Ihr Abo zurückfallen kann) plus `acceptEdits`, damit es Dateien ohne Nachfrage bearbeiten kann. Der Mod fügt immer `--add-dir <cwd>` hinzu, was die `CLAUDE.md` des Projekts unter `--bare` erreichbar hält. Fügen Sie `--dangerously-skip-permissions` nur hinzu, wenn das Child Befehle unbeaufsichtigt ausführen soll; lassen Sie `--bare` weg, wenn Sie Ihre Hooks und Plugins im Child haben wollen.
- `child.maxTurns`, `timeoutMs`: das agentische Budget des Child. `timeoutMs` ist auf zehn Minuten begrenzt, das Limit von `$.process.run`.
- `child.maxRetries`: wie oft das Gateway-Child einen Request wiederholt, der mit 429 oder 5xx fehlgeschlagen ist (Standard 2; Claude Codes eigener Standard ist 10, was bei einem ausgelasteten Anbieter Minuten dauerte). Erhöhen Sie den Wert, wenn Ihr Gateway kurze Aussetzer hat, die Sie lieber aussitzen als zurückzufallen.
- `child.fallbacks`: wie viele gleichwertige Modelle der Mod nach einem fehlgeschlagenen Gateway-Child selbst versucht, bevor das Hauptmodell den Turn übernimmt (Standard 3; 0 schaltet es ab). Auf Palgu zuerst dieselbe Klasse, dann die anderen funktionsfähigen Modelle. Siehe „Wenn ein Child fehlschlägt“ oben.
- `child.longContext`: die Gateway-Modelle, zu denen ein für das geroutete Modell zu langer Prompt wechselt. Standardmäßig leer: dann die funktionsfähigen Modelle, deren Kontextfenster laut Palgus Live-Liste größer ist als das des fehlgeschlagenen Modells, das größte zuerst. Ohne Palgu setzen Sie es selbst, sonst geht ein zu langer Prompt an das Hauptmodell.
- `child.contextMessages`: wie viele jüngste Wechsel ins Briefing kommen.
- `child.relayRounds`: wie oft ein gerouteter Turn anhalten darf, um Sie zu Befehlen zu fragen, die dem Child verweigert wurden (Standard 2).
- `child.deny`: zusätzliche Deny-Regeln für Claude-Code-Berechtigungen für jedes Claude-Child, übergeben mit `--disallowedTools` nach `child.args`. Sie ergänzen die eingebaute Liste (`.env`, `.env.*`, `*.pem`, `*.key`, `id_rsa*`, `id_ed25519*`, `secrets/**`), die nichts entfernt, weil `--bare` die Hooks überspringt, die diese Dateien sonst schützen würden.
- `child.subscriptionArgs`: die Flags für ein `claude/<member>`-Child, anstelle von `child.args`. Standardmäßig kein `--bare`, weil `--bare` nur API-Key-Authentifizierung erlaubt und es gerade um Ihren Claude-Login geht.
- `families`: pro Familie `members` (Alias → exakte Modell-ID) und `auto` (Stufe → Mitglieds-Alias, plus optional `criticalPlus` für kritische Turns mit 10/10). Pro Familie über die Standards gelegt; ein neuer Familienname fügt eine Gateway-Familie hinzu.
- `codex.auth`: `palgu` (Standard; `/v1/responses` Ihres konfigurierten Gateways mit Ihrem Gateway-Key, egal welcher Provider) oder `chatgpt` (Ihr eigener Codex-Login). `codex.baseUrl`: die Responses-Basis-URL, falls es nicht die abgeleitete ist (Palgu: `/anthropic` → `/v1`; OpenRouter und LiteLLM: `<gateway_url>/v1`). `codex.sandbox`: `read-only` (Standard), `workspace-write` oder `danger-full-access`, siehe [Sandbox und Freigaben](#sandbox-und-freigaben). `codex.allowOutsideGit`: fügt `--skip-git-repo-check` hinzu (Standard `false`). `codex.args`: zusätzliche Flags; Sandbox- und Freigabe-Flags darin werden ignoriert.
- `strategy`: die Routing-Strategie für den Start, eine eingebaute (`complexity`, `cost`, `speed`, `quality`) oder der Name einer Ihrer Dateien; eine Auswahl per `/route strategy` hat Vorrang. Siehe [Routing-Strategien](#routing-strategien-nach-komplexität-kosten-geschwindigkeit-qualität-oder-eigenen-regeln-routen).
- `prices`: $ pro Million Tokens für Gateway-Modelle, für die [Ersparnisschätzung](#wie-viel-es-spart), zum Beispiel `{ "glm-5.3": { "input": 0.6, "output": 2.2 } }` (optional `cacheRead`, standardmäßig ein Zehntel des Input-Preises, und `cacheWrite`). Ein Eintrag hier hat Vorrang vor Palgus eigenem Angebot. Ein Modell ohne Preis auf einem Gateway, das nicht Palgu ist, wird als unbepreist gezählt.
- `heartbeat`: die Hauptsitzung fortsetzen, wenn sie mitten in der Aufgabe stoppt. `palgu` (Standard: Palgu entscheidet, wenn es Ihr Gateway ist; sonst oder wenn Palgu nicht antwortet, läuft derselbe Classifier lokal), `local` (fragt nie Palgu) oder `off`. `heartbeatMax`: Fortsetzungen pro Prompt von Ihnen (Standard 3).
- `ui.band`: die Leiste über dem Prompt zeichnen (Standard `true`). `ui.tags`: welche Antworten die Herkunftsmarkierung bekommen, `routed` (Standard), `all` oder `off`.

## Befehle

| Befehl | Wirkung |
| :- | :- |
| `/palgu login` | Vom Terminal aus bei Palgu registrieren oder anmelden: einen Code im Browser bestätigen, und der Mod speichert seinen Palgu-Key und routet sofort |
| `/palgu status` | Wem der Key gehört und der Plan der Organisation |
| `/palgu upgrade` | Die Seite für Palgu-Pläne und Abrechnung |
| `/palgu continue [--open]` | Diese Sitzung in Palgu mit ihrem vollen Kontext fortsetzen: kopiert `cd <folder> && palgu --continue-claude=<session id>`; `--open` startet es in einem neuen macOS-Terminal-Tab. Palgu liest das Transkript selbst und schwärzt Zugangsdaten |
| `/palgu memory on`, `off`, `memory` | Dieses Projekt im Hintergrund mit der `palgu`-CLI in Palgu-Memory indexieren (lädt den Quellcode hoch; standardmäßig aus) und es in jeden Prompt abrufen, für Claude und jedes geroutete Modell; beenden; oder sagen, ob es indexiert ist und wie aktuell |
| `/route update` | Auf GitHub nach einer neueren Version suchen und, falls vorhanden, `claude plugin marketplace update` und `claude plugin update` für Sie ausführen; danach lädt `/reload-plugins` sie |
| `/route models` | Die Modelle, die Palgu gerade bereitstellt, und welche ausgefallen sind; jedes davon lässt sich mit `/route <model>` pinnen. Die Leiste behält einen Button pro Familie, die der Mod kennt. Ohne Palgu (oder wenn es nicht antwortet) wird die eingebaute Liste verwendet |
| `/route strategies`, `/route strategy <name>` | Die Routing-Strategien auflisten (complexity, cost, speed, quality und Ihre eigenen) oder zu einer wechseln |
| `/route help` (oder `0` in der Leiste) | Was der Mod tut, wo er gerade steht, jeder Button und Befehl und wie man einen Provider verbindet |
| `/route`, `/route status` | Live oder nur beobachtend, Modus, aktuelle Entscheidung (mit Familie und Mitglied), heutige Zähler, die Familien und ihre Mitglieder |
| `/route auto` | Jeden Prompt klassifizieren (Standard) |
| `/route off` | Nie ein Child starten |
| `/route simple\|coding\|critical` | Eine Stufe pinnen |
| `/route reset` | Das Fehlergedächtnis pro Art löschen |
| `/route stats` | Den Statistik-Bereich öffnen: models, kinds, scores, recent |
| `/route usage` (`today`, `week`, `month`, `all`) | Welche Modelle im Zeitraum (Standard: die letzten 7 Tage) Ihre Turns beantwortet und Ihre Subagenten ausgeführt haben |
| `/route stats reset` | Modellzählungen, Entscheidungslog, Ersparnis und Subagenten-Zählungen ab jetzt neu beginnen; Route, Pin und Einstellungen bleiben |
| `/route glm`, `/route kimi`, `/route kimi-k3.1-pro`, `/route minimax`, `/route gpt`, `/route claude` | Ein Modell pinnen (ein Präfix wird zum konfigurierten Modell erweitert, dann zu einem bekannten Gateway-Modell; ein Wort, das zu keinem Modell passt, etwa `/route upgrade`, stellt auf auto, statt es zu pinnen) |
| `/route claude/sonnet`, `/route kimi/highspeed`, `/route codex/gpt-5.6-terra` | Ein Familienmitglied pinnen (`claude/sonnet` läuft mit Ihrem Claude-Login) |
| `/route claude/auto`, `/route kimi/auto`, `/route codex/auto` | Eine Familie pinnen; jeder Prompt wird weiterhin bewertet, und die Stufe wählt das Mitglied |
| `/route codex` | Codex mit seinem Standardmodell pinnen |

`/status` ist Claude Codes eigener Befehl, und ein Mod kann nichts dazu hinzufügen; `/route status` ist das Gegenstück des Mods, und die Routing-Zeile unter jeder Antwort nennt Familie und Mitglied (`route: claude-sonnet-5-5 (claude/auto → sonnet) · coding 5/10 code via ollama · child 9s`).

Pins bleiben über Sitzungen hinweg im Speicher des Plugins erhalten.

## Was das Child kann und nicht kann

- Es hat Claude Codes Tools und läuft im Arbeitsverzeichnis der Sitzung, kann also Dinge lesen, bearbeiten und ausführen. Seine Tool-Aufrufe werden nicht im Haupttranskript angezeigt, nur sein abschließender Text.
- Wenn es einen Befehl braucht, den sein Berechtigungsmodus nicht erlaubt (`git pull`, `npm install`, ein Deployment), kann es Sie nicht selbst fragen. Der Mod leitet die Anfrage weiter: Sie bekommen Claude Codes Fragedialog mit dem genauen Befehl, und "Allow and continue" setzt dasselbe Child fort, wobei nur dieser Befehl erlaubt wird. Nur lesende Befehle wie `git status` oder `git log` laufen bereits ohne Nachfrage.
- Es teilt nicht das Gedächtnis der Hauptsitzung. Das Briefing enthält die letzten `contextMessages` Wechsel (standardmäßig 12, jeder auf 1.200 Zeichen gekürzt) und die Aufgabe. Deshalb gehen Folgefragen nie an ein Child: siehe [Wie es entscheidet](#wie-es-entscheidet).
- Es läuft standardmäßig mit `--bare`, sodass Ihre Hooks und Plugins draußen bleiben, auch jeder Hook, der Secrets schützt. Es kann keine `.env`-Dateien, Keys oder `secrets/`-Ordner lesen: Der Mod übergibt Deny-Regeln dafür (`child.deny` fügt weitere hinzu), und diese werden von Claude Code selbst durchgesetzt, nicht von einem Hook. Der Mod erkennt außerdem die Markierung `MAGGY_ROUTER_CHILD` und tut innerhalb eines Child nichts.
- Markierung und Routing-Zeile nennen das Modell, das der Mod **angefordert** hat. Ein Gateway, das nach Absicht routet, wie palgu, antwortet möglicherweise mit einem anderen Modell; die `-p`-Ausgabe von Claude Code verrät nicht, mit welchem, daher kann der Mod es nicht anzeigen.
- Die Ausgabe kommt, wenn das Child fertig ist; diese Version verwendet `$.process.run`, daher wird eine geroutete Antwort nicht Token für Token gestreamt.

## Changelog

Jedes Release hat einen datierten Abschnitt in [CHANGELOG.md](../../../CHANGELOG.md), geschrieben im selben Commit wie die Änderung. CI schlägt fehl, wenn die Version in `plugin.json` keinen Eintrag hat (`npm run changelog`).

## Tests

```bash
npm test                           # Tests reiner Funktionen unter Node, kein Claude Code nötig
claude plugin validate --strict .  # Manifest + statische Analyse des Hooks-Moduls
claude plugin test                 # braucht v2.1.287+; feuert Events durch die Hooks, ohne Sitzung oder Netzwerk
```

`tests/classify`, `config`, `providers`, `routing`, `families`, `codex`, `stats`, `child` und `ui` decken die reine Logik in `hooks/lib/` ab. `tests/mod.test.ts` treibt die Hooks durchgängig: Ein einfacher Prompt wird von einem Child beantwortet, mit dem Gateway in seiner Umgebung und dem Briefing auf stdin, ein kritischer Prompt startet nie eines, ein fehlgeschlagenes Child fällt auf das Hauptmodell zurück, ein fehlender Key bedeutet nur beobachtend, eine Child-Sitzung deaktiviert den Mod, und `/route off` und `/route kimi` verhalten sich korrekt. `tests/compliance.test.ts` prüft, was `$.process.run` erreicht: das literale Programm und die Flags, eine abgelehnte Modell-ID, die beiden festen Update-Befehle und einen Palgu-Key, der kein schlichtes Token ist.

## Aufbau

```
mixture-of-models-claude-mod/
├── .claude-plugin/
│   ├── plugin.json         # das Plugin-Manifest
│   └── marketplace.json    # lässt `claude plugin install` es in diesem Repo finden
├── docs/adr/               # Architekturentscheidungen (0001: Child-Prozess-Delegation, 0002: Familien und Codex, 0003: Gateway-Provider)
├── scripts/test-pure.mjs   # führt die reinen Tests unter Node aus
├── hooks/
│   ├── hooks.json          # verweist auf register.js
│   ├── register.js         # die 12 Hook-Registrierungen; die einzige Datei, die die Mods-API ($) berührt
│   └── lib/                # rein, mit Unit-Tests
│       ├── config.js       # Standards und das Overlay aus model-config.json
│       ├── providers.js    # Palgu, OpenRouter, LiteLLM, generisch: Erkennung, Child-Auth, Kataloge
│       ├── classify.js     # Maggys Vor-Routing-Regeln, Classifier-Prompt, Ollama-Wire-Format
│       ├── routing.js      # Stufe → Modell, /route-Grammatik, Zusammenfassungszeile
│       ├── families.js     # <family>/<member>, <family>/auto, welcher Runner eine Route bedient
│       ├── codex.js        # codex exec argv, env, Bereitschaft, JSONL-Ausgabe
│       ├── child.js        # Child-argv, begrenzte env und identifizierende Header, Bereitschaft, env-Datei-Parsing, das Briefing und seine Präambel
│       ├── version.js      # die Version des Mods, für x-srooter-client
│       ├── vet.js          # verwirft Handbacks, Aufforderungen zum Handeln, unbelegte Behauptungen, Erzählungen, Wiederholungen
│       └── stats.js        # Zähler pro Tag
└── tests/
```

Mods verlangen, dass jeder `$`-Aufruf in `register.js` steht (ein an eine andere Datei übergebenes `$` lässt `claude plugin validate` fehlschlagen); deshalb enthält diese Datei mehr Funktionen als das übliche Limit.

## Warum ein Child-Prozess

Siehe [ADR 0001](../../adr/0001-child-process-delegation.md). Kurz gesagt: Ein Mod kann das Modell eines Requests umbenennen, aber nicht ändern, wohin er geht, und das Abo-Token über einen Proxy zu leiten wurde verworfen. Ein Child-Prozess mit eigener Umgebung ist die saubere Trennung.

## Zuordnung zu Maggy

| Maggy | Hier |
| :- | :- |
| `hooks/route-task-hook` (UserPromptSubmit, qwen3-Classifier, Fortsetzungsschutz, Cache) | `prompt.submit` + `lib/classify.js`, `$.http.fetch` an Ollama, `$.store`-Cache |
| "You MUST delegate — run ~/bin/glm" in den Kontext eingefügt | `turn.step` führt das Child aus und gibt seine Antwort zurück; Claude wird nie gebeten zu delegieren |
| `~/bin/claude-<provider>`-Launcher aus `model_routing.py write-launcher` | der Mod begrenzt `ANTHROPIC_BASE_URL` und den Key selbst auf die Umgebung des Child |
| `hooks/usage-summary-hook` (Stop) | `turn.complete` gibt die Zusammenfassungszeile zurück |
| `/model-config` verfolgtes Modell | `primary` in `model-config.json` steuert die `coding`-Stufe |
| `palgu`-Gateway | der Endpoint des Child; die Hauptsitzung sieht ihn nie |

Getestet mit Claude Code 2.1.274 nur für `claude plugin validate`; die verwendeten Typen stammen aus den Deklarationen von 2.1.277. Prüfen Sie `.claude-plugin/types/` nach dem ersten Laden auf einem neueren Build, insbesondere ob `$.process.spawn` verfügbar ist, um die Ausgabe des Child zu streamen.
