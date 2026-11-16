# Mixture of Models pour GitHub Copilot CLI

[English](../../../../../integrations/copilot/README.md) · [简体中文](../../../zh-CN/integrations/copilot/README.md) · [日本語](../../../ja/integrations/copilot/README.md) · [Deutsch](../../../de/integrations/copilot/README.md) · **Français** · [العربية](../../../ar/integrations/copilot/README.md)

*Ceci est une traduction ; la version anglaise fait foi et peut être plus récente.*

Le heartbeat qui poursuit un tour arrêté en pleine tâche, la mémoire Palgu et les modèles de Palgu sous forme d'outils, dans GitHub Copilot CLI ([ADR 0005](../../../../adr/0005-other-coding-agents.md)).

Vérifié en conditions réelles avec Copilot CLI 1.0.112.

## Installation

```bash
npm install -g github:alinaqi/mixture-of-models-claude-mod   # installe mom (les hooks et le serveur MCP du plugin l'exécutent)
mom login                                                     # se connecter à Palgu
copilot plugin install alinaqi/mixture-of-models-claude-mod:integrations/copilot
copilot plugin list                                           # mixture-of-models
```

Pour l'essayer sans l'installer : `copilot --plugin-dir "$(npm root -g)/mixture-of-models-claude-mod/integrations/copilot"`.

Ensuite, dans un projet que vous voulez dans la mémoire Palgu : `mom memory on` (envoie son code source à Palgu ; désactivé par défaut, par dossier, partagé avec les autres agents que sert `mom`).

## Ce qu'il fait

| | Comment | Fonctionnalité de Copilot |
| :- | :- | :- |
| **Heartbeat** | Un tour qui se termine en pleine tâche (« Let me check the tests. ») est poursuivi, au plus 3 fois par prompt. Palgu décide (`POST /anthropic/heartbeat`) ; sans connexion, le même classifieur tourne en local. `mom heartbeat off` le désactive. | `agentStop` → `decision: "block"` avec le prompt de continuation comme `reason` ; la réponse est lue dans le `events.jsonl` de la session, puisque l'entrée de stop ne la contient pas |
| **Mémoire Palgu** | L'agent cherche dans la mémoire Palgu du projet avec `palgu_memory_search` (le skill lui dit quand) ; au démarrage de la session dans un dossier où la mémoire est activée, il est informé que la mémoire est activée. | Serveur MCP (`.mcp.json`, `mom mcp copilot`), `sessionStart` → `additionalContext`, skill `mixture-of-models` |
| **Les modèles de Palgu comme outils** | `palgu_delegate` confie une sous-tâche autonome à un modèle Palgu (`auto` ou épinglé) ; `palgu_models` les liste. | Serveur MCP |
| **Indexation** | `palgu memory index .` en arrière-plan au démarrage de la session dans un dossier où la mémoire est activée, au plus toutes les 10 minutes. | `sessionStart` |

Chaque hook laisse passer en cas d'erreur (fail open) : si `mom` échoue ou si Palgu est lent, Copilot continue comme s'il n'y avait pas de hook.

## Différences avec le mod Claude Code

- **Pas de routage par prompt des propres tours de Copilot.** Les hooks de Copilot ne peuvent pas changer le modèle, et la sortie d'un hook de commande sur `userPromptSubmitted` est ignorée, la mémoire ne peut donc pas non plus être ajoutée à chaque prompt : elle passe par l'outil MCP. Le routage de Palgu atteint Copilot via `palgu_delegate`. Copilot peut aussi utiliser Palgu comme fournisseur BYOK de type `anthropic` (`https://api.palgu.ai/anthropic`, modèle `auto`), un modèle par session ; voir la documentation BYOK de GitHub.
- Pas de commandes `/route` ni `/palgu` ; `mom` dans un terminal s'en charge.

## Ce qu'il envoie, et où

- À `https://api.palgu.ai/anthropic/heartbeat` (sauf avec `mom heartbeat local|off`) : les 600 derniers caractères de la réponse et un identifiant de session.
- À `https://api.palgu.ai/v1/cortex/search` (uniquement quand l'agent appelle `palgu_memory_search` dans un dossier où la mémoire est activée) : la requête (300 caractères au plus) et le nom Palgu du projet.
- À `https://api.palgu.ai/v1/chat/completions` (uniquement quand l'agent appelle `palgu_delegate`) : le prompt de la sous-tâche.
- La clé reste dans `~/.config/mixture-of-models/credentials.json` (0600) ou `PALGU_API_KEY` ; les fichiers du plugin n'en contiennent aucune.

## Constaté en conditions réelles (Copilot CLI 1.0.112)

- Les hooks placés dans le `.github/hooks/` d'un dépôt ne se sont pas exécutés sous `copilot -p` dans un dossier non approuvé ; les mêmes hooks dans un plugin (`--plugin-dir` ou installé) se sont exécutés.
- Le prompt de continuation issu de `agentStop` revient sous la forme d'un nouveau `userPromptSubmitted` ; `mom` le reconnaît comme le sien, il conserve donc le prompt de la personne et le budget de 3 continuations.
- Le serveur MCP d'un plugin démarre dans le dossier du plugin ; le dossier de la session est `COPILOT_SESSION_CWD`, que `mom mcp` utilise.
- La transcription est `~/.copilot/session-state/<session>/events.jsonl` (ou sous `$COPILOT_HOME`) ; les réponses du modèle sont des événements `assistant.message`. `mom` ne lit que les fichiers `.jsonl` sous ce dossier, et seulement les 256 derniers Ko.
- `copilot` refuse un `GITHUB_TOKEN` classique ; connectez-vous avec `/login` (lancez-le avec `env -u GITHUB_TOKEN -u GH_TOKEN copilot` si un tel token est défini).
