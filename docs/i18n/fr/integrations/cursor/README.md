# Mixture of Models pour Cursor

[English](../../../../../integrations/cursor/README.md) · [简体中文](../../../zh-CN/integrations/cursor/README.md) · [日本語](../../../ja/integrations/cursor/README.md) · [Deutsch](../../../de/integrations/cursor/README.md) · **Français** · [العربية](../../../ar/integrations/cursor/README.md)

*Ceci est une traduction ; la version anglaise fait foi et peut être plus récente.*

Chercher dans la mémoire Palgu, envoyer des sous-tâches autonomes à des modèles moins chers via Palgu, et poursuivre un tour qui s'arrête en pleine tâche. Cela fonctionne comme le mod Claude Code, avec ce que Cursor propose : des hooks, un serveur MCP et une règle ([ADR 0005](../../../../adr/0005-other-coding-agents.md)).

Nécessite Node 20 ou plus récent et la CLI `mom` dans le `PATH` que voit Cursor. La mémoire Palgu nécessite aussi la [CLI palgu](https://www.palgu.ai/install) pour l'indexation. Elle utilise son propre `palgu login` si vous en avez un, sinon la clé de `mom`.

## Installation

```bash
# 1. La CLI mom (les hooks et le serveur MCP l'exécutent)
npm install -g github:alinaqi/mixture-of-models-claude-mod
mom login                      # se connecter à Palgu dans le navigateur
```

Puis choisissez l'une de ces options :

- **Le plugin.** Dans Cursor, **Dashboard → Plugins & MCPs → Add Marketplace → Import from Repo** avec `https://github.com/alinaqi/mixture-of-models-claude-mod`, puis installez **Mixture of Models** depuis **Customize**. Pour l'essayer en local, copiez `integrations/cursor` dans `~/.cursor/plugins/local/mixture-of-models` et lancez **Developer: Reload Window**.
- **Par projet, sans le plugin.** Dans le dossier du projet, `mom setup cursor` affiche les entrées de `.cursor/hooks.json` et `.cursor/mcp.json` ; `mom setup cursor --write` les fusionne dans les fichiers existants. Il conserve vos autres hooks et serveurs et enregistre une copie `.bak` de chaque fichier qu'il modifie. Rechargez ensuite la fenêtre. De cette façon vous obtenez les hooks et le serveur MCP mais pas la règle. Copiez `integrations/cursor/rules/mixture-of-models.mdc` dans `.cursor/rules/` si vous la voulez.

Si Cursor ne trouve pas `mom` (une application lancée depuis le Dock peut ne pas voir le bin global de npm), utilisez le chemin complet donné par `which mom` dans les hooks et dans `mcp.json`.

## Ce qu'il fait

| | Comment | Fonctionnalité de Cursor |
| :- | :- | :- |
| **Mémoire Palgu** | `mom memory on` dans un dossier de projet l'indexe (cela envoie son code source à Palgu). L'agent y cherche ensuite avec `palgu_memory_search` au début d'une tâche et récupère jusqu'à 8 pointeurs. Au démarrage de la session, le hook informe l'agent que la mémoire est activée. La mémoire est désactivée par défaut. Le consentement se donne par dossier et est partagé avec chaque outil que sert `mom`. | Outil MCP ; `sessionStart` → `additional_context` ; la règle |
| **Délégation** | `palgu_delegate {prompt, model?}` envoie une sous-tâche autonome à Palgu (`model: "auto"`, pour que Palgu choisisse le palier, ou un modèle que vous épinglez) et renvoie la réponse. La règle la limite au travail à faible risque (tests à rédiger, code standard, docs, recherches) et exclut le travail sensible du point de vue de la sécurité ainsi que les secrets. `palgu_models` liste les modèles que sert Palgu. | Outils MCP ; la règle |
| **Heartbeat** | Quand un tour se termine en pleine tâche (« Now I'll run the tests. » puis plus rien), le hook envoie une relance, au plus 3 fois par prompt. Palgu décide (`POST /anthropic/heartbeat`). Sans connexion, le même classifieur tourne en local. Un tour que vous interrompez n'est jamais poursuivi. `mom heartbeat off` le désactive. | `afterAgentResponse` conserve la réponse ; `stop` → `followup_message` (`loop_limit: 3`) |
| **Indexation** | Dans un dossier où la mémoire est activée, `palgu memory index .` s'exécute en arrière-plan au démarrage de la session, au plus toutes les 10 minutes. | `sessionStart` |

Chaque hook laisse passer en cas d'erreur (fail open). Si `mom` échoue ou si Palgu est lent, Cursor continue comme si le hook n'était pas là. Le heartbeat attend au plus 8 s, la recherche dans la mémoire 8 s et la délégation 120 s.

## Ce qu'il envoie, et où

- À `https://api.palgu.ai/v1/chat/completions` (`palgu_delegate`, uniquement quand l'agent l'appelle) : le prompt de la sous-tâche, avec `x-srooter-client: mixture-of-models-cursor/<version>` et, quand un modèle est épinglé, `x-srooter-pin`.
- À `https://api.palgu.ai/v1/cortex/search` (`palgu_memory_search`, uniquement dans les dossiers où la mémoire est activée) : la requête (une ligne, 300 caractères au plus) et le nom Palgu du projet.
- À `https://api.palgu.ai/v1/models/health` (`palgu_models`) : uniquement la clé.
- À `https://api.palgu.ai/anthropic/heartbeat` (le hook `stop`, sauf avec `mom heartbeat local|off`) : les 600 derniers caractères de la réponse de l'agent et un identifiant de session.
- La clé se trouve dans `~/.config/mixture-of-models/credentials.json` (mode 0600) ou provient de `PALGU_API_KEY`. Elle n'est jamais écrite dans les fichiers de Cursor ni journalisée. L'état de `mom` (le dernier prompt et la dernière réponse de chaque conversation, pendant un jour) est conservé dans `state.json` à côté.

## En quoi il diffère du mod Claude Code

- **Pas de routage par tour.** Les hooks de Cursor ne peuvent pas changer le modèle, et une URL de base d'API personnalisée n'est pas fiable en mode Agent. Le propre modèle de Cursor fait le travail, et seul ce que l'agent confie à `palgu_delegate` va à un modèle moins cher.
- **La mémoire est tirée, pas poussée.** `beforeSubmitPrompt` peut seulement autoriser ou bloquer un prompt ; il ne peut pas ajouter de contexte. La mémoire atteint donc l'agent via l'outil MCP, que la règle et la note de début de session lui demandent d'appeler, et non via chaque prompt.
- **Pas de commandes `/route` ni `/palgu`.** La règle indique à l'agent quelles commandes `mom` suggérer.

## `mom mcp` pour d'autres outils

`mom mcp [tool]` est un simple serveur MCP sur stdio (JSON-RPC 2.0, protocole `2025-06-18` ou la version du client), donc tout agent qui exécute des serveurs MCP peut l'utiliser : `command: "mom", args: ["mcp", "<tool>"]`. `<tool>` sert seulement à nommer le client dans `x-srooter-client`. Il trouve le dossier du projet à partir de l'argument `folder` de l'outil, puis de `MOM_PROJECT_DIR`, puis des racines MCP du client, puis de son répertoire de travail.
