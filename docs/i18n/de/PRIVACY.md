# Datenschutzerklärung

[English](../../../PRIVACY.md) · [简体中文](../zh-CN/PRIVACY.md) · [日本語](../ja/PRIVACY.md) · **Deutsch** · [Français](../fr/PRIVACY.md) · [العربية](../ar/PRIVACY.md)

*Dies ist eine Übersetzung; die englische Version ist maßgeblich und möglicherweise aktueller.*

mixture-of-models ist ein Claude-Code-Plugin, das vollständig auf Ihrem Rechner läuft. Es gibt keinen vom Autor betriebenen Server, kein Konto und keine Telemetrie.

## Was das Plugin sendet, und an wen

- **An Palgu unter `https://api.palgu.ai`**, nur wenn Sie `/palgu` ausführen: für `/palgu login` den Client-Namen `mixture-of-models`, einen Gerätenamen (`Claude Code on <your HOSTNAME>`), die Version des Plugins und eine zufällige Installations-ID, dann den von Palgu ausgegebenen Anmeldecode; für `/palgu status` Ihren Gateway-Key, um Palgu zu fragen, wem er gehört, und nur wenn Ihr konfiguriertes Gateway Palgu ist. Den von Palgu zurückgegebenen Key speichert Claude Code in seinem sicheren Speicher, über `claude plugin configure --values-stdin`, nie in einer Befehlszeile.
- **An Palgu unter `https://api.palgu.ai/v1/pricing/quote`**, nach einem gerouteten Turn und nur wenn Ihr konfiguriertes Gateway Palgu ist: die Modell-ID und die vier Token-Zahlen des Turns, mit Ihrem Gateway-Key, damit Palgu den Turn für die Ersparnisschätzung bepreisen kann. Kein Prompt- oder Antworttext.
- **An GitHub (`raw.githubusercontent.com`)**, beim Sitzungsstart höchstens alle 12 Stunden und wenn Sie `/route update` ausführen: ein einfaches GET auf das veröffentlichte Manifest des Plugins, um die neueste Version zu lesen. Es wird nichts über Sie oder Ihre Arbeit gesendet.
- **An ein lokales Ollama unter `http://localhost:11434`**, falls eines läuft: der Text jedes Prompts, den Sie absenden, zusammen mit einer Bewertungsskala, damit der Prompt mit 1-10 bewertet werden kann. Dafür verlässt nichts Ihren Rechner.
- **An Anthropic, über Claude Codes eigenen API-Client und Ihr eigenes Konto**, wenn kein Ollama antwortet: derselbe Prompt-Text und dieselbe Skala, für dieselbe Bewertung. Das ist derselbe Kanal, den Claude Code bereits für Ihre Sitzung nutzt.
- **An das Gateway, das Sie konfigurieren** (`gateway_url`: zum Beispiel Palgu unter `https://api.palgu.ai/anthropic`, OpenRouter unter `https://openrouter.ai/api` oder ein von Ihnen betriebener LiteLLM-Proxy), über einen Child-Claude-Code-Prozess, der mit dem von Ihnen angegebenen `gateway_key` authentifiziert ist (als `x-api-key` für Palgu und generische Gateways, als `Authorization: Bearer`-Token für OpenRouter und LiteLLM): nur für geroutete Turns Ihr Prompt plus ein kurzes Briefing der letzten Wechsel Ihrer Sitzung (nur Text, gekürzt) und was die eigene Agent-Schleife dieses Child während der Arbeit sendet. Wie das Gateway mit diesen Daten umgeht, regelt die Richtlinie des Gateway-Betreibers, nicht dieses Plugin. Jeder Request des Child trägt außerdem zwei Header, die es gegenüber dem Gateway identifizieren: `x-srooter-client: mixture-of-models/<version>` (Name und Version des Plugins) und `x-srooter-project: <folder name>` (das letzte Segment des Arbeitsverzeichnisses der Sitzung, in Kleinbuchstaben und reduziert auf `a-z 0-9 . _ -`). Sie enthalten keinen Pfad, keinen Prompt-Text und keinen anderen Inhalt und werden nur an das konfigurierte Gateway gesendet, und nur wenn es Palgu oder ein generisches Anthropic-kompatibles Gateway ist: OpenRouter und LiteLLM bekommen sie nicht. Ist kein Gateway konfiguriert, wird nichts gesendet, und das Plugin beobachtet nur. Ein Child mit geroutetem Modell sendet außerdem `x-srooter-pin: <model>` (das zu bedienende Modell) und `x-palgu-fallback: auto` (erlaubt dem Gateway, ein gleichwertiges Modell zu nutzen, wenn dieses überlastet ist); auch sie enthalten keine Inhalte.

- **An Anthropic, mit Ihrem eigenen Claude-Login**, nur für Routen, die ein Mitglied der Claude-Familie nennen (`claude/sonnet`, `claude/auto`, …): Ein Child-Claude-Code-Prozess sendet dasselbe Briefing und was seine Agent-Schleife während der Arbeit sendet, über dasselbe Konto, das Ihre Hauptsitzung verwendet.
- **An den Endpoint von Codex**, nur für `codex`-Routen: Ein Child-Prozess `codex exec` liest dasselbe Briefing (Ihr Prompt plus die gekürzten jüngsten Wechsel), kann Dateien im Arbeitsverzeichnis der Sitzung lesen (einem Git-Repository, sofern Sie nicht `codex.allowOutsideGit` setzen), innerhalb einer schreibgeschützten Sandbox ohne Netzwerk, und kann dort nur dann Dateien bearbeiten, wenn Sie einen Befehl freigeben, der ihm für diesen Turn verweigert wurde, oder `codex.sandbox` selbst auf `workspace-write` setzen. Was seine Agent-Schleife braucht, sendet es entweder an den `/v1/responses`-Endpoint Ihres Gateways (mit `codex.auth: "palgu"`, dem Standard, unter Verwendung Ihres `gateway_key`, der ihm nur über seine Umgebung übergeben wird; auf OpenRouter ist das `https://openrouter.ai/api/v1/responses`, auf LiteLLM `/v1/responses` Ihres Proxys) oder an OpenAI (mit `codex.auth: "chatgpt"`, mit Ihrem eigenen Codex-Login, unter OpenAIs Richtlinie). Codex kann eigene Sitzungsdateien unter `~/.codex` ablegen, wie es das auch tut, wenn Sie es selbst ausführen; das Plugin liest oder schreibt diesen Ordner nie.

Das Plugin sendet nichts an andere Parteien und nichts an den Autor.

## Was das Plugin speichert

Im Plugin-Speicher von Claude Code auf Ihrem Rechner: eine zufällige Installations-ID für die Palgu-Anmeldung, Ihre `/route`-Einstellung, laufende Ersparnissummen (nach Tokens bepreiste Dollarbeträge und Turn-Zähler), Zähler pro Tag, welches Modell geantwortet hat, das letzte Urteil, Fehlerzähler pro Art und ein Log der letzten 200 Routing-Entscheidungen (Tag, Modell, Art, Stufe, Bewertung, welcher Classifier geantwortet hat, Child-Dauer und Exit-Code). Das Plugin speichert keinen Prompt-Text, keine Antworten und keine Zugangsdaten. Ihren Gateway-Key speichert Claude Code in seinem sicheren Speicher als sensible Plugin-Option.

## Was das Plugin liest

`~/.claude/model-config.json` (Routing-Einstellungen, keine Zugangsdaten) und die Umgebungsvariablen `HOME`, `HOSTNAME` (für den Palgu-Gerätenamen), `MAGGY_ROUTER_CHILD` und `ANTHROPIC_CUSTOM_HEADERS` (nur damit Custom-Header, die Sie selbst setzen, in den Requests des Child an das Gateway erhalten bleiben).

## Kinder

Das Plugin ist nicht für die Nutzung durch Personen unter 18 Jahren bestimmt.

## Kontakt

Eröffnen Sie ein Issue unter https://github.com/alinaqi/mixture-of-models-claude-mod/issues.
