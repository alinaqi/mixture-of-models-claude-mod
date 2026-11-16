# Mixture of Models pour OpenCode

[English](../../../../../integrations/opencode/README.md) · [简体中文](../../../zh-CN/integrations/opencode/README.md) · [日本語](../../../ja/integrations/opencode/README.md) · [Deutsch](../../../de/integrations/opencode/README.md) · **Français** · [العربية](../../../ar/integrations/opencode/README.md)

*Ceci est une traduction ; la version anglaise fait foi et peut être plus récente.*

Le plugin choisit le modèle Palgu pour chaque prompt, ajoute la mémoire Palgu à chaque prompt, poursuit un tour qui s'arrête en pleine tâche, et ajoute `/route` et `/palgu`. OpenCode est le seul outil, en dehors de Claude Code, où le plugin peut choisir le modèle pour chaque requête ; il égale donc le mod Claude Code fonctionnalité pour fonctionnalité ([ADR 0005](../../../../adr/0005-other-coding-agents.md)).

Prérequis :

- OpenCode 1.19 ou plus récent. Le plugin utilise l'API de plugins serveur V1 ; testé sur 1.19.5.
- Node 20 ou plus récent pour `mom`.
- Pour la mémoire Palgu, la [CLI palgu](https://www.palgu.ai/install) se charge de l'indexation.

## Installation

```bash
# 1. mom : connexion, consentement à la mémoire et commande d'installation (le plugin est livré dans le même paquet)
npm install -g github:alinaqi/mixture-of-models-claude-mod
mom login                         # se connecter à Palgu dans le navigateur

# 2. Palgu comme fournisseur et le plugin dans opencode.json
mom setup opencode                # afficher le bloc
mom setup opencode --write        # le fusionner dans opencode.json (copie d'abord l'ancien fichier vers opencode.json.bak)
```

`--write` écrit dans `$OPENCODE_CONFIG` si cette variable est définie, sinon dans `~/.config/opencode/opencode.json` (ou le même chemin sous `$XDG_CONFIG_HOME`). Il modifie deux clés, `provider.palgu` et l'entrée du plugin, et ne met `model` à `palgu/auto` que si vous n'avez pas de modèle par défaut. Il ne touche à aucune autre clé. Si le fichier contient des commentaires (JSONC), `mom` affiche le bloc et vous le fusionnez à la main. La liste des modèles vient de Palgu (`GET /v1/models/health`) quand vous êtes connecté, sinon de la liste intégrée.

Ce qu'il écrit (abrégé) :

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
      "models": { "auto": { "name": "Palgu router (auto)" }, "deepseek-pro": {}, "gemini-3.8-flash": {} }
    }
  },
  "plugin": ["/usr/local/lib/node_modules/mixture-of-models-claude-mod/integrations/opencode/plugin.js"]
}
```

La clé n'est pas dans le fichier. Le plugin ajoute la clé de mom (issue de `mom login`, ou `PALGU_API_KEY`) aux requêtes à destination de `https://api.palgu.ai/`. Si `PALGU_API_KEY` est défini, OpenCode l'envoie aussi lui-même.

### Autres façons de charger le plugin

| Forme | Entrée `plugin` |
| :- | :- |
| Le fichier du paquet installé (ce qu'écrit `mom setup opencode`) | `"/…/node_modules/mixture-of-models-claude-mod/integrations/opencode/plugin.js"` |
| Le répertoire du paquet (OpenCode lit `exports["./server"]`) | `"/…/node_modules/mixture-of-models-claude-mod"` |
| Un fichier local dans `.opencode/plugin/` (un projet) ou `~/.config/opencode/plugin/` (tous les projets) | le fichier `mom.js` contenant `export { default } from '/…/integrations/opencode/plugin.js'` |
| Depuis JavaScript | `import plugin from 'mixture-of-models-claude-mod/opencode'` |

Les options se passent dans un tuple : `["…/plugin.js", { "critical": "claude-opus" }]`.

| Option | Par défaut | |
| :- | :- | :- |
| `critical` | aucun | Modèle Palgu pour le travail critique : les règles du mod (« use claude … », « execute the plan », prompts de sécurité et de verdict) ou un score du classifieur supérieur à 7 |
| `routes` | `{}` | `{ "simple": "…", "coding": "…", "critical": "…" }` : un modèle Palgu pour chaque palier. Un palier sans modèle va à `auto` |
| `ollama` | `true` | Classer les prompts avec un Ollama local (`localhost:11434`, 4 s). Utilisé uniquement quand une route est définie |
| `ollamaModel` | `qwen2.5-coder:3b` | |
| `provider` | `palgu` | L'identifiant du fournisseur dans `opencode.json` que le plugin route |

## Ce qu'il fait

| | Comment | Fonctionnalité d'OpenCode |
| :- | :- | :- |
| **Routage** | Chaque prompt envoyé à `palgu/auto` part en tant que `auto`, et Palgu choisit le palier (trivial, small, medium, think). `/route <model>` épingle un modèle pour toutes les sessions, et `/route auto` retire l'épingle. Avec `critical` ou `routes` définis, les règles et le classifieur du mod choisissent le palier, et le modèle du palier est épinglé. Un modèle que vous choisissez vous-même dans OpenCode (un `palgu/<model>` autre que `auto`) est laissé tel quel. Le modèle est placé sur le message de l'utilisateur, et `x-srooter-pin` sur chaque requête. Les propres requêtes de titre et de résumé d'OpenCode ne sont jamais épinglées. | `chat.message` (`output.message.model`), `chat.headers` |
| **Mémoire Palgu** | `mom memory on` ou `/palgu memory on` dans un dossier de projet indexe le dossier (envoie son code source à Palgu). Ensuite, jusqu'à 8 pointeurs en sont rappelés pour chaque prompt de quatre mots ou plus et ajoutés au texte système de ce message. La mémoire est désactivée par défaut. Le consentement se donne par dossier et est partagé avec chaque outil que sert `mom`. | `chat.message` (`output.message.system`) |
| **Heartbeat** | Quand une session devient inactive après un tour terminé en pleine tâche (« Let me check the tests next. »), le plugin envoie le prompt de continuation, au plus 3 fois par prompt de votre part. Palgu décide (`POST /anthropic/heartbeat`). Sans connexion, le même classifieur tourne en local. `/palgu heartbeat off` le désactive. Les sessions de sous-agents, les tours interrompus et les tours en échec ne sont jamais poursuivis. | `event` `session.idle` → `client.session.promptAsync` |
| **Indexation** | Dans un dossier où la mémoire est activée, `palgu memory index .` s'exécute en arrière-plan au démarrage d'une session, au plus toutes les 10 minutes. | `event` `session.created` |
| **Commandes** | `/route [auto\|<model>\|<prefix>\|status]`, `/palgu memory on\|off\|status`, `/palgu heartbeat palgu\|local\|off`, `/palgu status`. Le plugin exécute la commande lui-même et affiche le résultat dans une notification de la TUI. Le modèle se contente ensuite de répéter cette ligne, sous `auto`, de sorte que c'est le palier le moins cher de Palgu qui répond. | `config` (enregistre `command.route` et `command.palgu` ; une commande à vous portant le même nom l'emporte), `command.execute.before`, `client.tui.showToast` |

Chaque hook laisse passer en cas d'erreur (fail open). Si quelque chose lève une exception ou si Palgu est lent, OpenCode continue comme si le plugin n'était pas là. La recherche dans la mémoire attend au plus 3 s, et le heartbeat au plus 8 s. `MOM_DEBUG=1` écrit une ligne JSON par décision et par requête dans `~/.config/mixture-of-models/opencode.log` : identifiants de modèles, épingles et tailles, jamais la clé, un prompt ou du texte rappelé.

## Ce qu'il envoie, et où

- **À `https://api.palgu.ai/anthropic/v1/messages`** (OpenCode lui-même, pour le fournisseur `palgu`) : vos tours OpenCode. Chaque requête porte `x-srooter-client: mixture-of-models-opencode/<version>` et `x-srooter-project: <folder name>`, `x-srooter-pin: <model>` quand un modèle est épinglé, et la clé.
- **À `https://api.palgu.ai/v1/cortex/search`** (le plugin, uniquement dans les dossiers où la mémoire est activée) : le prompt, sur une ligne de 300 caractères au plus, et le nom Palgu du projet.
- **À `https://api.palgu.ai/anthropic/heartbeat`** (le plugin, sauf si le heartbeat est réglé sur `local` ou `off`) : les 600 derniers caractères de la réponse et un identifiant de session.
- **À `http://localhost:11434`** (uniquement quand vous définissez `routes` ou `critical` et qu'Ollama tourne) : le prompt, pour le classifieur.
- **Sur le disque** : la clé reste dans `~/.config/mixture-of-models/credentials.json` (mode 0600) ou `PALGU_API_KEY`. L'épingle et le consentement à la mémoire sont conservés dans `state.json` dans le même dossier.

## Différences avec le mod Claude Code

- Le routage reste à l'intérieur d'un seul fournisseur, Palgu. Un tour routé s'exécute dans la même session OpenCode avec tout l'historique et tous les outils ; il n'y a pas de processus enfant. Les modèles Claude ne sont accessibles que via Palgu.
- Sans `critical` ni `routes`, ce sont les propres paliers de Palgu qui choisissent le modèle, pas le classifieur du mod, et `/route strategy` n'existe pas.
- `/route` et `/palgu` coûtent une courte réponse du modèle, car une commande OpenCode se termine toujours par un prompt.
- `opencode run` se termine dès que la session devient inactive, le heartbeat n'a donc aucune chance d'y poursuivre un tour. Il fonctionne dans la TUI et sous `opencode serve`.
