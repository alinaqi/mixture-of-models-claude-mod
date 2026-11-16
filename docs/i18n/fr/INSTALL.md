# Installer Mixture of Models (instructions pour un agent de code)

[English](../../../INSTALL.md) · [简体中文](../zh-CN/INSTALL.md) · [日本語](../ja/INSTALL.md) · [Deutsch](../de/INSTALL.md) · **Français** · [العربية](../ar/INSTALL.md)

*Ceci est une traduction ; la version anglaise fait foi et peut être plus récente.*

Vous êtes un agent de code à qui l'on a demandé d'installer Mixture of Models. Suivez ce fichier de haut en bas. Chaque étape comporte une commande à exécuter et une vérification qui vous indique qu'elle a fonctionné. Faites les étapes pour l'agent que l'utilisateur a demandé ; s'il ne l'a pas précisé, installez-le pour vous-même (l'agent qui lit ceci).

Ce que cela apporte à l'utilisateur : Palgu choisit un modèle pour chaque requête (des modèles moins chers pour le travail simple), la mémoire Palgu du projet est rappelée dans les prompts, et un tour qui s'arrête en pleine tâche est poursuivi. Dépôt : https://github.com/alinaqi/mixture-of-models-claude-mod

## Règles

- **N'affichez, ne journalisez et ne commitez jamais une clé Palgu.** Les clés se trouvent dans `~/.config/mixture-of-models/credentials.json` (écrit par `mom login`) ou dans la variable d'environnement `PALGU_API_KEY`. Les configs écrites par ces étapes font référence à la clé ; elles ne la contiennent jamais.
- **La connexion nécessite l'utilisateur.** `mom login` affiche un lien et un code et attend jusqu'à 10 minutes que l'utilisateur l'approuve dans un navigateur. Montrez le lien à l'utilisateur, dites-lui de l'approuver, et attendez. N'essayez pas de l'approuver vous-même.
- **La mémoire Palgu envoie le code source du projet à Palgu.** Ne l'activez (`mom memory on`) que si l'utilisateur dit oui, dans le projet qu'il a nommé.
- **Ne modifiez pas à la main les fichiers de config existants de l'utilisateur** quand une commande `mom setup <agent> --write` existe : elle fusionne, conserve les autres entrées, et sauvegarde d'abord l'ancien fichier.
- Si une vérification échoue, lisez **Dépannage** à la fin avant d'essayer autre chose.

## Étape 1. Prérequis

```bash
node --version        # doit être v20 ou plus récent
npm --version
```

Vérification : Node affiche `v20` ou plus. Sinon, demandez à l'utilisateur d'installer Node 20+ et arrêtez-vous.

## Étape 2. Installer `mom` (tous les agents sauf Claude Code)

`mom` est une petite CLI sans dépendances. Les fichiers de plugin de chaque agent sont livrés dans le même paquet.

```bash
npm install -g github:alinaqi/mixture-of-models-claude-mod
mom --help
```

Vérification : `mom --help` affiche `mom — Mixture of Models for Codex, Cursor, OpenCode and other coding agents`. En cas de `mom: command not found`, le bin global de npm n'est pas dans le `PATH` : lancez `npm prefix -g` et utilisez `<that>/bin/mom`.

Pour Claude Code seul, passez directement à **Claude Code** ci-dessous : il n'utilise pas `mom`.

## Étape 3. Se connecter à Palgu

```bash
mom login
```

Il affiche `Open https://www.palgu.ai/connect?code=XXXX-XXXX and approve code XXXX-XXXX`. Montrez cette ligne à l'utilisateur et attendez `Signed in to Palgu as ...`. Les nouveaux utilisateurs peuvent créer un compte sur la même page.

Si l'utilisateur a déjà une clé Palgu, il peut à la place faire `export PALGU_API_KEY=...` dans son shell ; ne lui demandez pas de la coller dans le chat.

Vérification :

```bash
mom status
```

La première ligne commence par `Palgu: signed in`.

## Étape 4. Configurer l'agent

### Claude Code

Nécessite Claude Code 2.1.287 ou plus récent (`claude --version`).

```bash
claude plugin marketplace add alinaqi/mixture-of-models-claude-mod
claude plugin install mixture-of-models@mixture-of-models-claude-mod
```

Ensuite l'utilisateur redémarre Claude Code et y lance `/palgu login` (même processus lien-et-approbation qu'à l'étape 3).

Vérification : `claude plugin list` affiche `mixture-of-models@mixture-of-models-claude-mod` ; après le redémarrage, `/route` affiche l'état du routage et `/palgu status` indique `Palgu: signed in`.

### Codex (CLI 0.163 ou plus récent)

```bash
mom setup codex --write                                        # écrit ~/.codex/palgu.config.toml ; config.toml n'est pas touché
codex plugin marketplace add alinaqi/mixture-of-models-claude-mod
codex plugin add mixture-of-models@mixture-of-models
```

L'utilisateur démarre Codex sur Palgu avec `codex -p palgu`. Au premier démarrage, Codex demande de vérifier les hooks du plugin (`/hooks`) ; ils exécutent `mom hook codex` et rien d'autre. Pour épingler un modèle : `MOM_PIN=<model> codex -p palgu -m <model>` (le même modèle deux fois).

Vérification : `codex plugin list` affiche `mixture-of-models`, et `~/.codex/palgu.config.toml` existe et contient `model_provider = "palgu"`.

Guide : [integrations/codex](integrations/codex/README.md)

### Cursor

À exécuter dans le dossier de projet voulu par l'utilisateur :

```bash
mom setup cursor --write                                       # fusionne dans .cursor/hooks.json et .cursor/mcp.json (avec sauvegarde)
mkdir -p .cursor/rules && cp "$(npm root -g)/mixture-of-models-claude-mod/integrations/cursor/rules/mixture-of-models.mdc" .cursor/rules/
```

L'utilisateur recharge la fenêtre Cursor (**Developer: Reload Window**). Pour l'installer plutôt pour tous les projets, l'utilisateur ajoute la marketplace dans Cursor : **Dashboard → Plugins & MCPs → Add Marketplace → Import from Repo** avec `https://github.com/alinaqi/mixture-of-models-claude-mod`, puis installe **Mixture of Models**.

Vérification : `.cursor/hooks.json` contient des entrées exécutant `mom hook cursor`, et `.cursor/mcp.json` contient un serveur exécutant `mom mcp cursor`. Dans Cursor, les paramètres MCP listent le serveur avec trois outils (`palgu_memory_search`, `palgu_delegate`, `palgu_models`).

Guide : [integrations/cursor](integrations/cursor/README.md)

### OpenCode (1.19 ou plus récent)

```bash
mom setup opencode --write                                     # fusionne Palgu et le plugin dans opencode.json (avec sauvegarde)
```

Il écrit dans `$OPENCODE_CONFIG` si cette variable est définie, sinon dans `~/.config/opencode/opencode.json`. Si le fichier contient des commentaires, il affiche le bloc à la place : fusionnez-le à la main, en conservant toutes les autres clés.

Vérification : le fichier contient maintenant `provider.palgu`, une entrée `plugin` se terminant par `integrations/opencode/plugin.js`, et (s'il n'y avait pas de modèle par défaut) `"model": "palgu/auto"`. Dans OpenCode, `/route status` répond.

Guide : [integrations/opencode](integrations/opencode/README.md)

### Antigravity (`agy` 1.0.7 ou plus récent)

```bash
agy plugin install "$(npm root -g)/mixture-of-models-claude-mod/integrations/antigravity"
```

Vérification : `agy plugin list` affiche `mixture-of-models` activé. `agy plugin validate "$(npm root -g)/mixture-of-models-claude-mod/integrations/antigravity"` ne signale aucune erreur.

Si `agy` échoue avec `PERMISSION_DENIED on resource project <id>`, cela vient du propre paramètre Google Cloud d'Antigravity, pas de ce plugin : voir [integrations/antigravity](integrations/antigravity/README.md).

### GitHub Copilot CLI (1.0.112 ou plus récent)

```bash
copilot plugin install alinaqi/mixture-of-models-claude-mod:integrations/copilot
```

L'utilisateur doit être connecté à Copilot (`/login` dans `copilot`). Si `GITHUB_TOKEN` contient un token classique, Copilot le refuse : démarrez-le avec `env -u GITHUB_TOKEN -u GH_TOKEN copilot`.

Vérification : `copilot plugin list` affiche `mixture-of-models`. Dans une session, demander à l'agent d'appeler `palgu_models` liste les modèles de Palgu.

Guide : [integrations/copilot](integrations/copilot/README.md)

### Aider, Continue, Goose

Ils n'ont pas de hooks, donc seul le routage de Palgu s'applique (pas de mémoire, pas de heartbeat). Suivez [integrations/gateway](integrations/gateway/README.md) : faites pointer l'agent vers `https://api.palgu.ai/v1` avec le modèle `auto` et la clé obtenue par `mom token`.

Vérification : un prompt obtient une réponse ; le tableau de bord de Palgu affiche la requête.

### Pas encore pris en charge

- **Gemini CLI** : nécessite un point de terminaison Palgu au format Gemini (pas encore disponible).
- **Windsurf** : aucun moyen de le faire pointer vers un autre point de terminaison de modèle.

## Étape 5 (facultative, demandez d'abord). Mémoire Palgu

Uniquement si l'utilisateur accepte d'envoyer le code source du projet à Palgu. Dans le dossier du projet :

```bash
mom memory on        # utilisateurs de Claude Code : /palgu memory on dans Claude Code à la place
mom memory status
```

Vérification : `mom memory status` indique `Palgu memory: on` ; une fois l'indexation terminée (quelques minutes sur un gros dépôt), il indique `indexed, N symbols`. L'indexation nécessite la CLI `palgu` (https://www.palgu.ai/install) ; sans elle, le statut le signale.

Le consentement se donne par dossier et est partagé par tous les agents qui utilisent `mom`. `mom memory off` l'arrête.

## Étape 6. Dire à l'utilisateur ce qui a changé

Indiquez : quel agent a été configuré, les fichiers écrits (et leurs sauvegardes `.bak`), si la mémoire est activée, et comment démarrer (`codex -p palgu`, recharger Cursor, redémarrer Claude Code, etc.). Commandes utiles pour lui : `mom status`, `mom memory on|off|status`, `mom heartbeat palgu|local|off`. Renvoyez-le vers [GUIDELINES.md](GUIDELINES.md) pour savoir comment l'utiliser dans son agent.

## Dépannage

| Symptôme | Cause | Solution |
| :- | :- | :- |
| `mom: command not found` | Le bin global de npm n'est pas dans le `PATH` | Utilisez `$(npm prefix -g)/bin/mom`, ou ajoutez ce dossier au `PATH` |
| Un hook ou un serveur MCP ne trouve pas `mom` (une application lancée depuis le Dock) | Les applications graphiques ne voient pas le `PATH` du shell | Mettez le chemin complet donné par `which mom` dans les commandes des hooks et dans la config MCP |
| `mom status` indique `not signed in` | `mom login` n'est pas terminé, ou `PALGU_API_KEY` n'est pas exporté dans ce shell | Relancez `mom login` et attendez l'approbation |
| Palgu répond 403 `pin 'auto' not allowed by policy` | Une épingle de modèle a été envoyée avec le modèle `auto` | Épinglez en nommant aussi le modèle : `MOM_PIN=<m> codex -p palgu -m <m>` |
| Palgu répond 503 pour un modèle épinglé | Ce modèle est indisponible | Choisissez-en un autre (outil `palgu_models`, ou `GET https://api.palgu.ai/v1/models/health`) |
| Les hooks Codex ne s'exécutent pas dans `codex exec` | Les hooks ne sont pas encore approuvés | Démarrez `codex -p palgu` une fois en mode interactif et approuvez-les dans `/hooks` |
| `mom memory status` : `could not read the index status` | La CLI `palgu` est absente ou non connectée | Installez-la depuis https://www.palgu.ai/install ; elle utilise la clé de `mom` quand elle n'en a pas à elle |
