# Prise en main

[English](../../../GETTING_STARTED.md) · [简体中文](../zh-CN/GETTING_STARTED.md) · [日本語](../ja/GETTING_STARTED.md) · [Deutsch](../de/GETTING_STARTED.md) · **Français** · [العربية](../ar/GETTING_STARTED.md)

*Ceci est une traduction ; la version anglaise fait foi et peut être plus récente.*

## 1. Vérifier Claude Code

```bash
claude --version     # nécessite 2.1.287 ou plus récent
# trop ancien ? l'une de ces commandes :
brew install --cask claude-code@latest            # Homebrew (le cask stable est en retard)
npm install -g @anthropic-ai/claude-code@<version>   # npm : une version à partir de 2.1.287
claude update                                     # installateur natif
```

## 2. Installer

Téléchargez d'abord, lisez le script, puis exécutez-le (il se contente d'appeler `claude plugin` et de copier `config.example.json`) :

```bash
git clone https://github.com/alinaqi/mixture-of-models-claude-mod
cd mixture-of-models-claude-mod
less install.sh     # le relire
./install.sh
```

Ou à la main :

```bash
claude plugin marketplace add alinaqi/mixture-of-models-claude-mod
claude plugin install mixture-of-models@mixture-of-models-claude-mod
```

Ou depuis une session : `/plugin install mixture-of-models --marketplace alinaqi/mixture-of-models-claude-mod`

Pour plutôt travailler sur le code, chargez le dépôt cloné pour une session : `claude --plugin-dir .`

## 3. Donner une passerelle à l'enfant

Le Claude Code enfant a besoin d'un point de terminaison compatible Anthropic qui sert les identifiants de modèles de vos routes. Avec [palgu](https://www.palgu.ai), dans une session :

```
/plugin configure mixture-of-models@mixture-of-models-claude-mod
```

puis saisissez `https://api.palgu.ai/anthropic` et votre clé. La clé est masquée et conservée dans le stockage sécurisé.

Depuis le shell à la place : lancez `claude plugin configure mixture-of-models@mixture-of-models-claude-mod --values-stdin` et tapez `{"gateway_url":"https://api.palgu.ai/anthropic","gateway_key":"<your key>"}` sur son entrée, puis appuyez sur Ctrl-D, pour que la clé n'apparaisse pas dans l'historique du shell.

Votre session principale n'a besoin d'**aucun** `ANTHROPIC_BASE_URL`. Elle reste sur votre abonnement.

## 4. Facultatif : l'ajuster

Copiez le bloc `router` de `config.example.json` dans `~/.claude/model-config.json` pour changer les routes, les seuils ou les options de l'enfant. Pas nécessaire pour commencer.

Une mise en garde : un `ANTHROPIC_API_KEY` exporté dans votre shell remplace la connexion claude.ai pour la session principale. Ne le définissez pas si la session principale doit tourner sur votre abonnement.

## 5. Facultatif : Codex

Pour les routes `codex`, installez la CLI Codex : `brew install --cask codex` (ou `npm install -g @openai/codex@<version>`). Par défaut, elle tourne sur le `/v1/responses` de votre passerelle Palgu avec la clé de l'étape 3. Pour utiliser plutôt votre propre connexion ChatGPT, lancez `codex login` et définissez `"router": { "codex": { "auth": "chatgpt" } }` dans `~/.claude/model-config.json`.

## 6. Facultatif : classification gratuite

```bash
ollama pull qwen2.5-coder:3b
```

Sans Ollama, le classifieur se replie sur `claude-haiku-5-5` sur votre offre.

## 7. Essayer

```
claude
/route                      → live · mode auto · current route ...
grep the repo for TODOs     → l'indicateur affiche "via glm-5.3 (child)…", la réponse vient de l'enfant
/route kimi                 → épingle les tours suivants sur Kimi
/route auto                 → retour à la classification
/route claude/sonnet        → les tours suivants s'exécutent sur claude-sonnet-5-5, sur votre connexion Claude
/route kimi/auto            → le score choisit kimi-k3.1-pro-highspeed ou kimi-k3.1-pro
/route codex                → les tours suivants s'exécutent sur la CLI Codex (nécessite `npm install -g @openai/codex`)
/route status               → mode, famille et membre actuels, les familles
/route stats                → un panneau qui montre quels modèles ont pris vos tours, les types, les scores, les décisions récentes
```
