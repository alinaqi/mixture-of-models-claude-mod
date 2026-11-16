# Mixture of Models installieren (Anleitung für einen Coding-Agent)

[English](../../../INSTALL.md) · [简体中文](../zh-CN/INSTALL.md) · [日本語](../ja/INSTALL.md) · **Deutsch** · [Français](../fr/INSTALL.md) · [العربية](../ar/INSTALL.md)

*Dies ist eine Übersetzung; die englische Version ist maßgeblich und möglicherweise aktueller.*

Sie sind ein Coding-Agent, der Mixture of Models einrichten soll. Folgen Sie dieser Datei von oben nach unten. Jeder Schritt hat einen auszuführenden Befehl und eine Prüfung, die Ihnen sagt, dass er funktioniert hat. Führen Sie die Schritte für den Agent aus, den der Benutzer genannt hat; hat er keinen genannt, richten Sie es für sich selbst ein (den Agent, der dies liest).

Was es dem Benutzer bringt: Palgu wählt für jeden Request ein Modell (günstigere Modelle für einfache Arbeit), Palgu-Memory des Projekts wird in Prompts abgerufen, und ein Turn, der mitten in der Aufgabe stoppt, wird fortgesetzt. Repository: https://github.com/alinaqi/mixture-of-models-claude-mod

## Regeln

- **Geben Sie einen Palgu-Key nie aus, protokollieren Sie ihn nie und committen Sie ihn nie.** Keys liegen in `~/.config/mixture-of-models/credentials.json` (geschrieben von `mom login`) oder in der Umgebungsvariable `PALGU_API_KEY`. Die von diesen Schritten geschriebenen Konfigurationen verweisen auf den Key; sie enthalten ihn nie.
- **Die Anmeldung braucht den Benutzer.** `mom login` gibt einen Link und einen Code aus und wartet bis zu 10 Minuten, bis der Benutzer ihn im Browser bestätigt. Zeigen Sie dem Benutzer den Link, sagen Sie ihm, er soll bestätigen, und warten Sie. Versuchen Sie nicht, selbst zu bestätigen.
- **Palgu-Memory lädt den Quellcode des Projekts zu Palgu hoch.** Schalten Sie es (`mom memory on`) nur ein, wenn der Benutzer zustimmt, und zwar in dem Projekt, das er genannt hat.
- **Bearbeiten Sie bestehende Konfigurationsdateien des Benutzers nicht von Hand**, wenn es einen Befehl `mom setup <agent> --write` gibt: Er führt zusammen, behält andere Einträge und sichert die alte Datei vorher.
- Wenn eine Prüfung fehlschlägt, lesen Sie **Fehlerbehebung** am Ende, bevor Sie etwas anderes versuchen.

## Schritt 1. Voraussetzungen

```bash
node --version        # muss v20 oder neuer sein
npm --version
```

Prüfung: Node gibt `v20` oder höher aus. Falls nicht, bitten Sie den Benutzer, Node 20+ zu installieren, und hören Sie auf.

## Schritt 2. `mom` installieren (jeder Agent außer Claude Code)

`mom` ist eine kleine CLI ohne Abhängigkeiten. Die Plugin-Dateien für jeden Agent werden im selben Paket ausgeliefert.

```bash
npm install -g github:alinaqi/mixture-of-models-claude-mod
mom --help
```

Prüfung: `mom --help` gibt `mom — Mixture of Models for Codex, Cursor, OpenCode and other coding agents` aus. Bei `mom: command not found` ist npms globales bin-Verzeichnis nicht im `PATH`: Führen Sie `npm prefix -g` aus und verwenden Sie `<that>/bin/mom`.

Nur für Claude Code springen Sie zu **Claude Code** unten: Es verwendet `mom` nicht.

## Schritt 3. Bei Palgu anmelden

```bash
mom login
```

Es gibt `Open https://www.palgu.ai/connect?code=XXXX-XXXX and approve code XXXX-XXXX` aus. Zeigen Sie diese Zeile dem Benutzer und warten Sie auf `Signed in to Palgu as ...`. Neue Benutzer können sich auf derselben Seite registrieren.

Hat der Benutzer bereits einen Palgu-Key, kann er stattdessen in seiner Shell `export PALGU_API_KEY=...` ausführen; bitten Sie ihn nicht, den Key in den Chat einzufügen.

Prüfung:

```bash
mom status
```

Die erste Zeile beginnt mit `Palgu: signed in`.

## Schritt 4. Den Agent einrichten

### Claude Code

Benötigt Claude Code 2.1.287 oder neuer (`claude --version`).

```bash
claude plugin marketplace add alinaqi/mixture-of-models-claude-mod
claude plugin install mixture-of-models@mixture-of-models-claude-mod
```

Dann startet der Benutzer Claude Code neu und führt darin `/palgu login` aus (derselbe Ablauf mit Link und Bestätigung wie in Schritt 3).

Prüfung: `claude plugin list` zeigt `mixture-of-models@mixture-of-models-claude-mod`; nach dem Neustart zeigt `/route` den Routing-Zustand, und `/palgu status` meldet `Palgu: signed in`.

### Codex (CLI 0.163 oder neuer)

```bash
mom setup codex --write                                        # schreibt ~/.codex/palgu.config.toml; config.toml wird nicht angefasst
codex plugin marketplace add alinaqi/mixture-of-models-claude-mod
codex plugin add mixture-of-models@mixture-of-models
```

Der Benutzer startet Codex auf Palgu mit `codex -p palgu`. Beim ersten Start bittet Codex darum, die Hooks des Plugins zu prüfen (`/hooks`); sie führen `mom hook codex` aus und sonst nichts. Ein einzelnes Modell pinnen: `MOM_PIN=<model> codex -p palgu -m <model>` (zweimal dasselbe Modell).

Prüfung: `codex plugin list` zeigt `mixture-of-models`, und `~/.codex/palgu.config.toml` existiert und enthält `model_provider = "palgu"`.

Anleitung: [integrations/codex](integrations/codex/README.md)

### Cursor

Im Projektordner ausführen, in dem der Benutzer es haben will:

```bash
mom setup cursor --write                                       # führt in .cursor/hooks.json und .cursor/mcp.json zusammen (mit Sicherung)
mkdir -p .cursor/rules && cp "$(npm root -g)/mixture-of-models-claude-mod/integrations/cursor/rules/mixture-of-models.mdc" .cursor/rules/
```

Der Benutzer lädt das Cursor-Fenster neu (**Developer: Reload Window**). Um es stattdessen für jedes Projekt zu installieren, fügt der Benutzer den Marketplace in Cursor hinzu: **Dashboard → Plugins & MCPs → Add Marketplace → Import from Repo** mit `https://github.com/alinaqi/mixture-of-models-claude-mod`, und installiert dann **Mixture of Models**.

Prüfung: `.cursor/hooks.json` hat Einträge, die `mom hook cursor` ausführen, und `.cursor/mcp.json` hat einen Server, der `mom mcp cursor` ausführt. In Cursor listen die MCP-Einstellungen den Server mit drei Tools (`palgu_memory_search`, `palgu_delegate`, `palgu_models`).

Anleitung: [integrations/cursor](integrations/cursor/README.md)

### OpenCode (1.19 oder neuer)

```bash
mom setup opencode --write                                     # führt Palgu und das Plugin in opencode.json zusammen (mit Sicherung)
```

Es schreibt nach `$OPENCODE_CONFIG`, falls gesetzt, sonst nach `~/.config/opencode/opencode.json`. Enthält die Datei Kommentare, gibt es stattdessen den Block aus: Führen Sie ihn von Hand zusammen und behalten Sie jeden anderen Schlüssel.

Prüfung: Die Datei hat jetzt `provider.palgu`, einen `plugin`-Eintrag, der auf `integrations/opencode/plugin.js` endet, und (falls es kein Standardmodell gab) `"model": "palgu/auto"`. In OpenCode antwortet `/route status`.

Anleitung: [integrations/opencode](integrations/opencode/README.md)

### Antigravity (`agy` 1.0.7 oder neuer)

```bash
agy plugin install "$(npm root -g)/mixture-of-models-claude-mod/integrations/antigravity"
```

Prüfung: `agy plugin list` zeigt `mixture-of-models` als aktiviert. `agy plugin validate "$(npm root -g)/mixture-of-models-claude-mod/integrations/antigravity"` meldet keine Fehler.

Wenn `agy` mit `PERMISSION_DENIED on resource project <id>` fehlschlägt, liegt das an Antigravitys eigener Google-Cloud-Einstellung, nicht an diesem Plugin: siehe [integrations/antigravity](integrations/antigravity/README.md).

### GitHub Copilot CLI (1.0.112 oder neuer)

```bash
copilot plugin install alinaqi/mixture-of-models-claude-mod:integrations/copilot
```

Der Benutzer muss bei Copilot angemeldet sein (`/login` innerhalb von `copilot`). Ist `GITHUB_TOKEN` auf ein klassisches Token gesetzt, lehnt Copilot es ab: Starten Sie es als `env -u GITHUB_TOKEN -u GH_TOKEN copilot`.

Prüfung: `copilot plugin list` zeigt `mixture-of-models`. Bittet man in einer Sitzung den Agent, `palgu_models` aufzurufen, listet er Palgus Modelle auf.

Anleitung: [integrations/copilot](integrations/copilot/README.md)

### Aider, Continue, Goose

Diese haben keine Hooks, daher greift nur Palgus Routing (kein Memory, kein Heartbeat). Folgen Sie [integrations/gateway](integrations/gateway/README.md): Lassen Sie den Agent auf `https://api.palgu.ai/v1` zeigen, mit dem Modell `auto` und dem Key aus `mom token`.

Prüfung: Ein Prompt bekommt eine Antwort; Palgus Dashboard zeigt den Request.

### Noch nicht unterstützt

- **Gemini CLI**: braucht einen Palgu-Endpoint im Gemini-Format (noch nicht verfügbar).
- **Windsurf**: keine Möglichkeit, es auf einen anderen Modell-Endpoint zeigen zu lassen.

## Schritt 5 (optional, vorher fragen). Palgu-Memory

Nur wenn der Benutzer zustimmt, den Quellcode des Projekts zu Palgu hochzuladen. Im Projektordner:

```bash
mom memory on        # Claude-Code-Benutzer: stattdessen /palgu memory on innerhalb von Claude Code
mom memory status
```

Prüfung: `mom memory status` meldet `Palgu memory: on`; nach Abschluss der Indexierung (einige Minuten bei einem großen Repo) meldet es `indexed, N symbols`. Die Indexierung braucht die `palgu`-CLI (https://www.palgu.ai/install); ohne sie sagt der Status das.

Die Einwilligung gilt pro Ordner und wird von jedem Agent geteilt, der `mom` verwendet. `mom memory off` beendet es.

## Schritt 6. Dem Benutzer sagen, was sich geändert hat

Berichten Sie: welcher Agent eingerichtet wurde, die geschriebenen Dateien (und ihre `.bak`-Sicherungen), ob Memory an ist und wie man startet (`codex -p palgu`, Cursor neu laden, Claude Code neu starten usw.). Nützliche Befehle für den Benutzer: `mom status`, `mom memory on|off|status`, `mom heartbeat palgu|local|off`. Verweisen Sie ihn auf [GUIDELINES.md](GUIDELINES.md) dazu, wie man in seinem Agent damit arbeitet.

## Fehlerbehebung

| Symptom | Ursache | Lösung |
| :- | :- | :- |
| `mom: command not found` | npms globales bin-Verzeichnis ist nicht im `PATH` | `$(npm prefix -g)/bin/mom` verwenden oder diesen Ordner zum `PATH` hinzufügen |
| Ein Hook oder MCP-Server findet `mom` nicht (eine aus dem Dock gestartete App) | GUI-Apps sehen den `PATH` der Shell nicht | Den vollständigen Pfad aus `which mom` in die Hook-Befehle und die MCP-Konfiguration eintragen |
| `mom status` meldet `not signed in` | `mom login` nicht abgeschlossen oder `PALGU_API_KEY` in dieser Shell nicht exportiert | `mom login` erneut ausführen und auf die Bestätigung warten |
| Palgu antwortet 403 `pin 'auto' not allowed by policy` | Ein Modell-Pin wurde mit dem Modell `auto` gesendet | Beim Pinnen auch das Modell nennen: `MOM_PIN=<m> codex -p palgu -m <m>` |
| Palgu antwortet 503 für ein gepinntes Modell | Dieses Modell ist ausgefallen | Ein anderes wählen (Tool `palgu_models` oder `GET https://api.palgu.ai/v1/models/health`) |
| Codex-Hooks laufen nicht in `codex exec` | Die Hooks sind noch nicht als vertrauenswürdig bestätigt | `codex -p palgu` einmal interaktiv starten und sie in `/hooks` bestätigen |
| `mom memory status`: `could not read the index status` | Die `palgu`-CLI fehlt oder ist nicht angemeldet | Von https://www.palgu.ai/install installieren; sie verwendet den Key von `mom`, wenn sie keinen eigenen hat |
