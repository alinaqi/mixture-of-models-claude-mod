# Mixture of Models pour Antigravity

[English](../../../../../integrations/antigravity/README.md) · [简体中文](../../../zh-CN/integrations/antigravity/README.md) · [日本語](../../../ja/integrations/antigravity/README.md) · [Deutsch](../../../de/integrations/antigravity/README.md) · **Français** · [العربية](../../../ar/integrations/antigravity/README.md)

*Ceci est une traduction ; la version anglaise fait foi et peut être plus récente.*

La mémoire Palgu rappelée dans chaque prompt, le heartbeat qui poursuit un tour arrêté en pleine tâche, et les modèles de Palgu sous forme d'outils, dans la CLI Antigravity de Google (`agy`) ([ADR 0005](../../../../adr/0005-other-coding-agents.md)).

Vérifié en conditions réelles avec agy 1.0.7.

## Installation

```bash
npm install -g github:alinaqi/mixture-of-models-claude-mod   # installe mom et les fichiers de ce plugin
mom login                                                     # se connecter à Palgu
agy plugin install "$(npm root -g)/mixture-of-models-claude-mod/integrations/antigravity"
agy plugin list                                               # mixture-of-models, activé
```

Ensuite, dans un projet que vous voulez dans la mémoire Palgu : `mom memory on` (envoie son code source à Palgu ; désactivé par défaut, par dossier, partagé avec les autres agents que sert `mom`).

## Ce qu'il fait

| | Comment | Fonctionnalité d'Antigravity |
| :- | :- | :- |
| **Mémoire Palgu** | Au premier appel au modèle de chaque tour, dans un dossier où la mémoire est activée, jusqu'à 8 pointeurs issus de la mémoire Palgu du projet (intentions consignées et ADR, docs, symboles de code) sont ajoutés pour le modèle. | `PreInvocation` (`invocationNum` 0) → `injectSteps` `ephemeralMessage` |
| **Heartbeat** | Un tour qui se termine en pleine tâche (« Let me check the tests. ») est poursuivi, au plus 3 fois par prompt. Palgu décide (`POST /anthropic/heartbeat`) ; sans connexion, le même classifieur tourne en local. `mom heartbeat off` le désactive. | `Stop` → `decision: "continue"` ; la réponse est lue dans la transcription, puisque l'entrée de Stop ne la contient pas |
| **Indexation** | `palgu memory index .` en arrière-plan au démarrage de la session dans un dossier où la mémoire est activée, au plus toutes les 10 minutes. | `SessionStart` |
| **Les modèles de Palgu comme outils** | `palgu_memory_search`, `palgu_delegate` (confier une sous-tâche autonome à un modèle Palgu, `auto` ou épinglé) et `palgu_models`, avec une règle toujours active indiquant quand les utiliser. | `mcp_config.json` (`mom mcp antigravity`), `rules/AGENTS.md` |

Chaque hook laisse passer en cas d'erreur (fail open) : si `mom` échoue ou si Palgu est lent, `agy` continue comme s'il n'y avait pas de hook.

## Routage

Les hooks d'Antigravity ne peuvent pas changer le modèle, et son propre paramètre de modèle n'accepte que des modèles Gemini (ou une passerelle de modèles d'entreprise configurée par un administrateur). Les propres tours de l'agent restent donc sur le modèle Gemini que vous choisissez dans `agy` ; le routage de Palgu l'atteint via `palgu_delegate`, que la règle demande à l'agent d'utiliser pour les sous-tâches autonomes et à faible risque.

## Ce qu'il envoie, et où

- À `https://api.palgu.ai/v1/cortex/search` (uniquement dans les dossiers où la mémoire est activée) : le prompt (une ligne, 300 caractères au plus) et le nom Palgu du projet.
- À `https://api.palgu.ai/anthropic/heartbeat` (sauf avec `mom heartbeat local|off`) : les 600 derniers caractères de la réponse et un identifiant de session.
- À `https://api.palgu.ai/v1/chat/completions` (uniquement quand l'agent appelle `palgu_delegate`) : le prompt de la sous-tâche.
- La clé reste dans `~/.config/mixture-of-models/credentials.json` (0600) ou `PALGU_API_KEY` ; les fichiers du plugin n'en contiennent aucune.

## Constaté en conditions réelles, contrairement à la documentation (agy 1.0.7)

- L'entrée du hook contient `hookEventName` et `cwd` ; l'indicateur de continuation est `continuationActive`.
- Un tour qui se termine par une réponse s'arrête avec `terminationReason: "NO_TOOL_CALL"` (la documentation dit `model_stop`), un tour en échec avec `ERROR` ; seul le premier est poursuivi.
- La transcription (`transcriptPath`) est en JSONL ; les réponses du modèle sont des étapes `PLANNER_RESPONSE`.
- Si `agy` échoue avec `PERMISSION_DENIED on resource project <id>`, le projet Google Cloud de `~/.gemini/antigravity-cli/settings.json` (`gcp.project`) est un projet que votre compte ne peut pas utiliser : définissez-en un que vous pouvez utiliser, ou utilisez une clé d'API Gemini avec `"modelProvider": "gemini"` et `GEMINI_API_KEY`.
