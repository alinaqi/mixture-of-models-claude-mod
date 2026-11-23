# Mixture of Models pour Codex

[English](../../../../../integrations/codex/README.md) · [简体中文](../../../zh-CN/integrations/codex/README.md) · [日本語](../../../ja/integrations/codex/README.md) · [Deutsch](../../../de/integrations/codex/README.md) · **Français** · [العربية](../../../ar/integrations/codex/README.md)

*Ceci est une traduction ; la version anglaise fait foi et peut être plus récente.*

Palgu choisit le modèle pour chaque requête, la mémoire Palgu est rappelée dans chaque prompt, et un tour qui s'arrête en pleine tâche est poursuivi. Le même comportement que le mod Claude Code, construit sur les propres plugins et hooks de Codex ([ADR 0005](../../../../adr/0005-other-coding-agents.md)).

Nécessite Codex 0.163 ou plus récent et Node 20 ou plus récent. La mémoire Palgu nécessite aussi la [CLI palgu](https://www.palgu.ai/install) pour l'indexation ; elle utilise son propre `palgu login` si vous en avez un, sinon la clé de `mom`.

## Installation

```bash
# 1. La CLI mom (les hooks du plugin l'appellent)
npm install -g github:alinaqi/mixture-of-models-claude-mod
mom login                      # se connecter à Palgu dans le navigateur

# 2. Router Codex via Palgu : écrit ~/.codex/palgu.config.toml (votre config.toml n'est pas touché)
mom setup codex --write

# 3. Le plugin : rappel de la mémoire et heartbeat
codex plugin marketplace add alinaqi/mixture-of-models-claude-mod
codex plugin add mixture-of-models@mixture-of-models
```

Puis démarrez Codex sur Palgu :

```bash
codex -p palgu
```

La première fois, Codex vous demande de vérifier les hooks du plugin (`/hooks`) ; ils exécutent `mom hook codex` et rien d'autre.

## Ce qu'il fait

| | Comment | Fonctionnalité de Codex |
| :- | :- | :- |
| **Routage** | `model = "auto"` : Palgu classe chaque requête et la sert depuis ses paliers (trivial, small, medium, think). `MOM_PIN=<model> codex -p palgu -m <model>` (le même modèle deux fois) épingle un modèle pour la session : Palgu n'épingle le modèle nommé par une requête que si `x-srooter-pin` est présent, et refuse `auto` avec une épingle (403). | profil `-p palgu`, `[model_providers.palgu]` avec `auth = { command = "mom", args = ["token"] }` |
| **Mémoire Palgu** | `mom memory on` dans un dossier de projet l'indexe (envoie son code source à Palgu) et rappelle jusqu'à 8 pointeurs dans chaque prompt de quatre mots ou plus. Désactivé par défaut ; le consentement se donne par dossier et est partagé avec les autres outils que sert `mom`. | `UserPromptSubmit` → `additionalContext` |
| **Heartbeat** | Un tour qui se termine en pleine tâche (« Let me check the tests. ») est poursuivi, au plus 3 fois par prompt. Palgu décide (`POST /anthropic/heartbeat`) ; sans connexion, le même classifieur tourne en local. `mom heartbeat off` le désactive. | `Stop` → `decision: "block"` |
| **Poursuivre dans Palgu** | `mom palgu codex` poursuit votre dernière session Codex dans Palgu avec tout son contexte (`palgu --continue-codex=<id>`) : dans un terminal il y lance Palgu, ailleurs il copie la commande ; `--open` la lance dans un nouvel onglet du Terminal macOS. Palgu lit la transcription et masque les identifiants ; `mom` ne garde que l'id de session et le dossier. | n'importe quel hook (l'id de session) |
| **Indexation** | Dans un dossier où la mémoire est activée, `palgu memory index .` s'exécute en arrière-plan au démarrage de la session, au plus toutes les 10 minutes. | `SessionStart` |

Chaque hook laisse passer en cas d'erreur (fail open) : si `mom` échoue ou si Palgu est lent, Codex continue comme s'il n'y avait pas de hook. La recherche dans la mémoire attend au plus 3 s, le heartbeat au plus 8 s.

## Ce qu'il envoie, et où

- À `https://api.palgu.ai/v1/responses` (Codex lui-même, sous `-p palgu`) : vos tours Codex, avec la clé de `mom token` et les en-têtes `x-srooter-client: mixture-of-models-codex/<version>`, ainsi que `x-srooter-pin` / `x-srooter-project` quand `MOM_PIN` / `MOM_PROJECT` sont définis.
- À `https://api.palgu.ai/v1/cortex/search` (`mom`, uniquement dans les dossiers où la mémoire est activée) : le prompt (une ligne, 300 caractères au plus) et le nom Palgu du projet.
- À `https://api.palgu.ai/anthropic/heartbeat` (`mom`, sauf avec `mom heartbeat local|off`) : les 600 derniers caractères de la réponse de Codex et un identifiant de session.
- La clé se trouve dans `~/.config/mixture-of-models/credentials.json` (mode 0600) ou `PALGU_API_KEY`. Elle n'est jamais écrite dans la config de Codex.

## Différences avec le mod Claude Code

- Le routage repose sur les paliers de Palgu, pas sur le classifieur et les stratégies du mod : les hooks de Codex ne peuvent pas changer le modèle d'un tour.
- Pas de commandes slash `/route` ni `/palgu` (Codex a supprimé les commandes personnalisées) ; le skill `mixture-of-models` indique à Codex les commandes `mom` à suggérer.
- Les plugins dotés de hooks ne peuvent pas figurer dans l'annuaire public des plugins de Codex, il s'installe donc depuis la marketplace de ce dépôt.
