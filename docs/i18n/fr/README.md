# mixture-of-models-claude-mod

[English](../../../README.md) · [简体中文](../zh-CN/README.md) · [日本語](../ja/README.md) · [Deutsch](../de/README.md) · **Français** · [العربية](../ar/README.md)

*Ceci est une traduction ; la version anglaise fait foi et peut être plus récente.*

[![ci][ci-badge]][ci] [![License: MIT][mit-badge]](../../../LICENSE) [![Changelog][log-badge]](../../../CHANGELOG.md)

[ci]: https://github.com/alinaqi/mixture-of-models-claude-mod/actions/workflows/ci.yml
[ci-badge]: https://github.com/alinaqi/mixture-of-models-claude-mod/actions/workflows/ci.yml/badge.svg
[mit-badge]: https://img.shields.io/badge/License-MIT-green.svg
[log-badge]: https://img.shields.io/badge/changelog-keep%20a%20changelog-blue

> **Vous l'installez avec un agent de code ?** Indiquez-lui [INSTALL.md](INSTALL.md) : « Follow INSTALL.md in alinaqi/mixture-of-models-claude-mod to set up Mixture of Models for me. » (Suis INSTALL.md dans alinaqi/mixture-of-models-claude-mod pour installer Mixture of Models.) Il contient chaque commande, une vérification pour chaque étape, et ce qu'il faut vous demander. Fonctionne pour Claude Code, Codex, Cursor, OpenCode, Antigravity, GitHub Copilot CLI, Aider, Continue et Goose.
>
> **Déjà installé ?** [GUIDELINES.md](GUIDELINES.md) rassemble les bonnes pratiques pour chaque agent : laisser le système choisir les modèles, comment formuler les prompts pour que le routage et la mémoire fonctionnent, quoi déléguer, et que faire quand une route semble fausse.

Gardez votre abonnement Claude pour les tours qui en ont besoin. Confiez le reste à un modèle moins cher. Un **mod** Claude Code (un plugin exécuté dans le processus, nouveauté de Claude Code 2.1.287) qui évalue chaque prompt selon son rayon d'impact et fait répondre aux tours à faible score un Claude Code séparé, sans interface (headless), sur une passerelle compatible Anthropic (GLM, Kimi, DeepSeek, ce que la vôtre propose). Votre session principale n'est jamais renommée, redirigée ni modifiée. Porté depuis le routage de [Maggy](https://github.com/alinaqi/maggy).

Une route peut aussi désigner une **famille de modèles** : `claude/sonnet` exécute ce membre de Claude sur votre propre connexion Claude, `kimi/auto` laisse le score choisir un membre Kimi, et `codex` confie le tour à la CLI Codex (`codex exec`) sur Palgu ou sur votre connexion ChatGPT. Voir [Familles](#familles--choisir-un-membre-ou-laisser-le-palier-choisir) et [Codex](#codex-en-processus-enfant).

## Obtenir les modèles de Palgu en une commande

Pas de tableau de bord, pas de clés à copier. Après [l'installation du mod](#installation), dans Claude Code :

```
/palgu login
```

1. Le mod affiche un lien de connexion et un code court, par exemple `WDJB-MJHT`.
2. Ouvrez le lien, connectez-vous à Palgu ou **créez un compte** (les nouveaux comptes démarrent sur l'offre gratuite), vérifiez que le code correspond et appuyez sur **Allow**. La page nomme l'application : *Allow Mixture of Models on "Claude Code on your-mac"?* (Autoriser Mixture of Models sur « Claude Code on your-mac » ?)
3. De retour dans le terminal, une notification indique *Signed in to Palgu as you@example.com*. C'est tout : les tours simples et de code tournent désormais sur les modèles de Palgu (GLM 5.3, Kimi K3.1, DeepSeek V4 Pro, Gemini 3.8 Flash, MiniMax M3, GPT-6), et les tours critiques restent sur Claude. Pas de redémarrage.

| Commande | Ce qu'elle fait |
| :- | :- |
| `/palgu login` | Créer un compte ou se connecter, et relier cet ordinateur |
| `/palgu status` | Qui est connecté, l'organisation et son offre, et ce qu'elle a dépensé de son budget Palgu sur la période |
| `/palgu upgrade` | Offres et facturation (les offres payantes s'achètent sur le web ; votre clé prend en compte la nouvelle offre d'elle-même) |
| `/palgu continue [--open]` | Poursuivre cette session dans Palgu avec tout son contexte : copie `cd <folder> && palgu --continue-claude=<session id>` ; `--open` la lance dans un nouvel onglet du Terminal macOS. Palgu lit lui-même la transcription et masque les identifiants |

Fonctionnement : la connexion par appareil de Palgu (la même que celle de `srooterctl`) génère une clé d'API pour cet ordinateur uniquement. Vous pouvez la voir et la révoquer sur la page **Devices** de Palgu. Le mod l'enregistre dans le stockage sécurisé de Claude Code avec `claude plugin configure --values-stdin`, de sorte qu'elle n'apparaît jamais sur une ligne de commande ni dans un fichier de paramètres. Vous avez déjà une clé, ou utilisez une autre passerelle ? Voir [Mise en place](#mise-en-place).

Pour être précis sur ce que c'est : de la **délégation au niveau du tour**, pas un mélange de modèles par requête. Un tour routé s'exécute dans un processus enfant avec un bref résumé de votre contexte récent ; la réponse de l'enfant arrive dans votre transcription, étiquetée. Les tours critiques restent sur Claude exactement comme avant.

## Installation

Les mods exigent **Claude Code 2.1.287 ou plus récent**. Le cask Homebrew stable est encore en 2.1.286, vérifiez donc d'abord :

```bash
claude --version
# trop ancien ? l'une de ces commandes :
brew uninstall --cask claude-code && brew install --cask claude-code@latest   # Homebrew
npm install -g @anthropic-ai/claude-code@<version>                            # npm : une version à partir de 2.1.287
claude update                                                                 # installateur natif
```

Puis :

```bash
claude plugin marketplace add alinaqi/mixture-of-models-claude-mod
claude plugin install mixture-of-models@mixture-of-models-claude-mod
```

ou, dans une session, `/plugin install mixture-of-models --marketplace alinaqi/mixture-of-models-claude-mod`.

> **Vos hooks ne s'exécutent pas dans l'enfant de la passerelle.** L'enfant lance `claude -p --bare`, et `--bare` ignore tous les hooks de vos paramètres et plugins ; un hook qui bloque `.env` ne le protège donc pas là-bas, et ce que l'enfant lit part vers le modèle de la passerelle. Le mod ne compte pas sur les hooks pour cela : chaque enfant Claude reçoit des règles de refus de permissions Claude Code, que `--bare` conserve, pour les fichiers `.env` et `.env.*`, `*.pem`, `*.key`, `id_rsa*`, `id_ed25519*` et les dossiers `secrets/` (les règles Read couvrent aussi Grep et Glob). Ajoutez les vôtres avec `router.child.deny`, par exemple `["Read(**/credentials.json)"]`. Les commandes que l'enfant n'a pas le droit d'exécuter vous parviennent toujours sous forme de boîte de dialogue Allow / Deny. Un enfant Codex est en lecture seule mais n'est pas couvert par ces règles : gardez les secrets hors d'un projet que vous routez vers Codex.

**Mises à jour.** Au démarrage de session, le mod vérifie sur GitHub s'il existe une version plus récente (au plus toutes les 12 heures) et, s'il y en a une, le signale une fois dans un toast et sur le bandeau : `0.33.0 available: /route update`. Lancez `/route update` : il installe la nouvelle version, et le bandeau affiche ensuite `0.33.0 installed: /reload-plugins`. Les marketplaces tierces ne se mettent pas à jour automatiquement par défaut. Activez-le une fois dans `/plugin` → Marketplaces → `mixture-of-models-claude-mod` → Enable auto-update, ou mettez à jour à la main avec `claude plugin marketplace update mixture-of-models-claude-mod && claude plugin update mixture-of-models@mixture-of-models-claude-mod`. Une nouvelle version prend effet après `/reload-plugins` (ou un redémarrage).

**Démarrage le plus rapide, sur Palgu :** lancez `claude` et exécutez `/palgu login`. Il affiche un lien et un code ; approuvez-les dans le navigateur (créez-y un compte si vous êtes nouveau) et le mod enregistre sa propre clé Palgu et route dès cet instant, sans copier de clé. `/palgu status` indique qui est connecté, sur quelle offre et quelle part du budget est dépensée ; `/palgu upgrade` ouvre les offres et la facturation.

Ou fournissez vous-même une passerelle à l'enfant : [OpenRouter](#openrouter), un proxy [LiteLLM](#litellm), ou tout point de terminaison compatible Anthropic qui sert vos identifiants de modèles (testé avec [palgu](https://www.palgu.ai) ; les points de terminaison Anthropic de z.ai ou de Moonshot fonctionnent de la même manière), voir [Mise en place](#mise-en-place). Lancez `claude`, exécutez `/route`. Tant qu'aucune passerelle n'est configurée, le mod se contente d'observer et ne change rien.

**Règle de conception : la session principale n'est jamais modifiée.** Elle reste sur votre abonnement claude.ai sans `ANTHROPIC_BASE_URL`. Quand un prompt est routé vers GLM ou Kimi, le mod répond lui-même à ce tour en lançant un **processus enfant `claude -p` séparé et sans interface**, dont seul l'environnement pointe vers la passerelle (palgu). La sortie de l'enfant devient la réponse du tour dans votre transcription. Rien ne change dans le processus principal, son modèle, son authentification ou ses requêtes.

Pour chaque prompt, le mod :

1. **L'évalue** sur deux axes en un seul appel au classifieur : un rayon d'impact de 1 à 10 et un type de tâche (`code | research | review | docs | data | multimodal`). Le score décide si Claude est obligatoire ; le type choisit quel modèle moins cher prend le reste. Un modèle Ollama local le fait gratuitement, `claude-haiku-5-5` sur votre offre sert de repli, puis le dernier verdict obtenu. Voir [Comment il décide](#comment-il-décide).
2. **Applique d'abord les règles de pré-routage de Maggy** : `use claude` ou `execute the plan` forcent `critical` ; les relances après un tour répondu par un enfant reviennent à la session principale ; `go ahead`, `yes`, ou un prompt de six mots ou moins alors que la session principale est en pleine tâche l'y maintiennent ; le travail de niveau code reste sur une session principale en pleine tâche.
3. **Délègue** un tour routé à l'enfant : `claude -p --model glm-5.3` sur la passerelle, qui reçoit sur stdin un brief contenant les derniers échanges de votre session plus la tâche.
4. **Se replie** sur le modèle principal pour ce tour si l'enfant échoue, n'affiche rien, ou si sa réponse ne passe pas le contrôle (voir [Ce qu'un enfant n'a pas le droit de faire](#ce-quun-enfant-na-pas-le-droit-de-faire)), et le signale dans la transcription.
5. **Vous montre ce qui a tourné où**, à chaque tour. Voir [Ce que vous voyez](#ce-que-vous-voyez).

Les tours `critical` ne démarrent jamais d'enfant. Ils s'exécutent dans la session principale, sur l'abonnement, exactement comme si le mod n'était pas là.

## Comment il décide

On pose une seule question au classifieur : quels dégâts fait une mauvaise réponse ? Il répond par un nombre, et la grille est explicite :

| Score | Signification | Palier (seuils par défaut) |
| :- | :- | :- |
| 1-2 | recherches, grep, commandes shell d'une ligne, questions de syntaxe, lecture de logs, git status ou diff | `simple` |
| 3-4 | modifications d'un seul fichier, tests, docs, changements de config, petites corrections de bugs, échafaudage | 3 `simple`, 4 `coding` |
| 5-6 | fonctionnalités sur plusieurs fichiers, connexion de services ou d'outils entre eux, intégrations, déploiements qui suivent un schéma connu | `coding` |
| 7-8 | débogage entre services, migrations de données, travail de performance, changements difficiles à annuler | 7 `coding`, 8 `critical` |
| 9-10 | conception de sécurité ou d'authentification, décisions d'architecture, incidents de production, tout ce qui est irréversible | `critical` |

Le prompt indique au classifieur que la longueur, le nombre de services nommés ou des clés d'API collées n'augmentent pas le score à eux seuls ; c'est ce qui poussait auparavant un travail d'intégration ordinaire vers la session principale. Il précise aussi qu'un raisonnement profond (algorithmes avec preuves, concurrence, optimisation des performances, cryptographie) vaut au moins 7 quel que soit le rayon d'impact, de sorte qu'un travail difficile mais sans risque reste sur Claude. Déplacez les seuils avec `router.thresholds` ; par exemple `{ "simple": 3, "coding": 8 }` éloigne de Claude tout sauf les scores 9-10.

**Le type choisit le modèle.** En dessous de `critical`, `routes.kinds` associe le type de tâche à un modèle : par défaut, `research` et `review` vont à DeepSeek V4 Pro (`deepseek-v4-pro` sur Palgu, contexte de 1M tokens), `multimodal` reste sur Claude, et tout le reste prend le modèle du palier (GLM). Jusqu'à 0.20.0 ils allaient à Kimi, auquel Palgu ne répond pas aujourd'hui (une réponse vide au bout d'environ deux minutes). Ajoutez `"docs": "gpt-6-sol"` ou `"data": "..."` à la matrice selon ce que votre passerelle permet.

**Les modèles que vous pouvez nommer.** Tout identifiant de modèle servi par votre passerelle fonctionne dans `routes`, `routes.kinds` ou une épingle. Le mod connaît ces modèles de la passerelle Palgu, si bien que `/route <prefix>` se développe vers eux même quand aucune route ne les nomme : `glm-5.3`, `kimi-k3.1-pro`, `kimi-k3.1-pro-highspeed`, `deepseek-v4-pro`, `gemini-3.8-flash`, `minimax-m3`, `minimax-m2.5`, `gpt-6-sol`, `gpt-6-luna`, `gpt-6-astra` et `mercury-3`. Le bandeau au-dessus du prompt a un bouton pour chacune de ces familles. `kimi-k3.1-pro` remplace `kimi-k3` ; une ancienne épingle `/route kimi-k3` se développe vers lui. Gemini, MiniMax et GPT-6 sont des options, pas des valeurs par défaut : `/route minimax`, `/route gpt` (GPT-6 Sol) ou `/route gpt/auto` (Luna pour les tours simples, Sol pour le code, Astra pour le critique) les épinglent. Mercury 3 d'Inception ne s'utilise aussi que par épingle : `/route mercury` (`mercury-3` sur Palgu, `mercury/3` sur OpenRouter).

**Quels modèles Palgu fonctionnent.** Testés le 2026-10-29 de la façon dont le mod exécute un tour (un enfant `claude -p --bare` épinglé effectuant une courte tâche de recherche avec des appels d'outils) : `glm-5.3`, `deepseek-v4-pro`, `gemini-3.8-flash`, `minimax-m3`, `gpt-6-sol`, `gpt-6-luna`, `gpt-6-astra`, `kimi-k3.1-pro`, `kimi-k3.1-pro-highspeed` et `mercury-3` réussissent en 19 à 46 s ; `minimax-m2.5` a continué à relancer des commandes refusées jusqu'à épuiser ses tours. Les échecs antérieurs de Kimi venaient de la surcharge de Moonshot (`429 engine_overloaded`) : Claude Code relançait chaque requête dix fois, si bien qu'un tour mettait environ deux à trois minutes à échouer. L'enfant ne relance désormais qu'au plus deux fois (`router.child.maxRetries`, par défaut 2), si bien qu'un fournisseur surchargé bascule sur le repli en quelques secondes. La recherche et la revue restent sur DeepSeek par défaut ; Kimi est une épingle. L'enfant envoie toujours `x-srooter-pin: <model>` à Palgu : sans cela, Palgu route selon l'intention et peut répondre avec un autre modèle (il servait chaque modèle non épinglé sous la forme de Gemini).

**Quand un enfant échoue.** Le modèle principal ne reprend un tour routé qu'après l'échec de tous les modèles équivalents. Sur Palgu, l'enfant envoie `x-palgu-fallback: auto`, si bien qu'en cas de surcharge la passerelle parcourt d'abord la propre chaîne de repli du modèle épinglé (sa liste de repli, puis sa classe). Si l'enfant échoue encore sur une surcharge (429, 5xx, délai dépassé, aucune réponse), le mod relance le tour sur le modèle équivalent suivant : d'abord les modèles de la même classe (d'après la liste en direct de Palgu), puis les autres modèles en bonne santé, jusqu'à `router.child.fallbacks` (3 par défaut). Un prompt trop long pour le modèle ne passe qu'à un modèle à plus grande fenêtre de contexte (`router.child.longContext`) ; une requête invalide (400, 401, 403, 404, 422) n'est pas retentée sur d'autres modèles. La ligne de route dit ce qui s'est passé : `child: deepseek-v4-pro failed (429) → served by glm-5.3`, ou `all equivalents failed: deepseek-v4-pro (429), glm-5.3 (529), …; main model answered`. Quand la propre chaîne de Palgu a servi un autre modèle, la ligne indique `child: kimi-k3.1-pro → served by deepseek-v4-pro (gateway fallback)`, et le tour est compté et tarifé comme ce modèle. Une réponse d'enfant que le mod écarte (il a abandonné, raconté ses intentions, vous a demandé d'agir, etc. : Ce qu'un enfant ne doit pas faire, ci-dessous) suit le même chemin, sauf un `HANDBACK` ou une demande que vous agissiez.

**Sous-agents.** Un sous-agent tourne dans Claude Code sur la propre connexion de votre session principale : le mod ne peut donc choisir que le modèle Claude qu'il utilise, jamais un modèle de la passerelle. Avant qu'un sous-agent intégré `general-purpose` démarre, le mod note sa tâche comme un prompt : une tâche simple tourne sur Haiku, du code sur Sonnet, une tâche critique garde le modèle de la session principale. Explore tourne sur Haiku. Le mod ne choisit jamais qu'un modèle moins cher que celui de la session principale, et ne touche pas à un sous-agent dont le modèle est déjà choisi, à l'agent d'un plugin ou au vôtre (sa définition peut fixer un modèle), à un fork, à un coéquipier ni à un agent de workflow. La transcription indique `subagent general-purpose on haiku · simple 2/10` ; `/route off` le désactive, et `router.subagents` le règle par type d'agent.

### Stratégies de routage : router selon la complexité, le coût, la vitesse, la qualité ou vos propres règles

Ce que le classifieur évalue, où se séparent les paliers et quel modèle prend chaque palier forment une **stratégie de routage**, un fichier markdown avec une grille, comme un skill. Quatre sont fournies :

| Stratégie | Évalue | Paliers (simple / coding) | Va vers |
| :- | :- | :- | :- |
| `complexity` (par défaut) | le rayon d'impact, comme ci-dessus | 3 / 7 | vos routes : GLM, DeepSeek pour la recherche et la revue, Claude pour le critique |
| `cost` | le risque qu'un modèle moins cher se trompe ; en cas de doute, plus bas | 4 / 8 | GLM, DeepSeek V4 Pro pour le code, la recherche et la revue, Gemini pour les images, Claude pour le critique |
| `speed` | la profondeur de raisonnement | 3 / 7 | Gemini 3.8 Flash, GPT-6 Sol pour le code, Sonnet plutôt qu'Opus pour le critique |
| `quality` | les enjeux ; en cas de doute, plus haut | 2 / 5 | GLM uniquement pour les recherches, Sonnet pour le code, Claude pour le critique |

`/route strategies` les liste avec les vôtres, `/route strategy cost` change de stratégie (mémorisé d'une session à l'autre ; `router.strategy` dans `model-config.json` fixe une valeur par défaut), et le bandeau affiche alors `auto (cost)`.

**La vôtre.** Placez un fichier dans `~/.claude/mixture-of-models/strategies/<name>.md`, ou demandez à Claude d'utiliser le skill **routing-strategy** du plugin, qui vous demande ce que vous voulez optimiser et l'écrit :

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

`thresholds` et `routes` sont du JSON sur une ligne et sont facultatifs (absents, ceux de votre config s'appliquent) ; le corps est la grille que lit le classifieur. Le format de réponse reste « <score> <kind> », donc paliers, familles, mémoire des échecs et économies fonctionnent de la même façon. Les règles de sécurité ci-dessus passent en premier quelle que soit la stratégie : le travail de sécurité, les notifications et les commandes de session restent sur Claude. Un fichier illisible est ignoré et nommé dans le log ; `/route strategy <name>` relit le dossier, donc un nouveau fichier est pris en compte sans redémarrage.

### Familles : choisir un membre, ou laisser le palier choisir

Toute route, route par type ou épingle peut être `<family>/<member>` ou `<family>/auto` au lieu d'un identifiant de modèle. Un `claude` seul signifie toujours « la session principale », exactement comme avant, donc les anciennes configs se comportent de la même façon.

| Famille | Membres (alias = identifiant exact) | `auto` par palier (par défaut) | S'exécute sur |
| :- | :- | :- | :- |
| `claude` | `fable` = `claude-fable-5-1`, `opus` = `claude-opus-5-5`, `sonnet` = `claude-sonnet-5-5`, `haiku` = `claude-haiku-5-5` | simple → `haiku`, coding → `sonnet`, critical → `opus` ; `fable` uniquement si vous ajoutez `"criticalPlus": "fable"` (tours critiques à 10/10) | un enfant `claude -p --model <id>` sans interface sur **votre connexion Claude** (pas de passerelle) ; un membre qui *est* le modèle de la session reste dans la session principale |
| `kimi` | `pro` = `kimi-k3.1-pro`, `highspeed` = `kimi-k3.1-pro-highspeed` | simple → `highspeed`, coding et critical → `pro` | l'enfant de la passerelle |
| `glm`, `deepseek`, `gemini`, `minimax` | depuis le catalogue de la passerelle : `glm/5.3` = `glm-5.3`, `deepseek/v4-pro` = `deepseek-v4-pro`, `gemini/3.8-flash`, `minimax/m3` = `minimax-m3`, `minimax/m2.5` | le premier membre | l'enfant de la passerelle |
| `gpt` | `sol` = `gpt-6-sol`, `luna` = `gpt-6-luna`, `astra` = `gpt-6-astra` | simple → `luna`, coding → `sol`, critical → `astra` | l'enfant de la passerelle |
| `codex` | aucun par défaut : `codex/<any model id>` transmet l'identifiant à Codex | aucun par défaut : le modèle par défaut de Codex | un enfant `codex exec`, voir [Codex](#codex-en-processus-enfant) |

`auto` utilise le même classifieur, les mêmes seuils, le même second échantillon pour les cas limites et la même mémoire des échecs que les paliers, puis cherche le palier dans la table `auto` de la famille. Il ne quitte jamais la famille. Un palier de la famille Claude (`"critical": "claude/opus"`) rend Claude obligatoire tout comme `"claude"` : `routes.kinds` ne le remplace pas. Remplacez les membres ou la table des paliers par famille dans `router.families` ; une épingle `/route claude/auto` classe quand même chaque prompt et choisit le membre d'après le score.

Pourquoi un enfant pour un membre de Claude, et pas le `/model` de la session elle-même : la session principale n'est jamais renommée ni redirigée ([ADR 0001](../../adr/0001-child-process-delegation.md)), donc un membre autre que le modèle de la session s'exécute dans un Claude Code séparé sans interface, démarré avec l'option `--model <id>` de Claude Code lui-même. Cet enfant tourne sans `--bare` (qui imposerait l'authentification par clé d'API), il utilise donc votre connexion claude.ai et charge vos hooks et plugins ; le mod reste inactif à l'intérieur grâce à `MAGGY_ROUTER_CHILD`. Son environnement efface tout `ANTHROPIC_BASE_URL` hérité ; un `ANTHROPIC_API_KEY` exporté dans votre shell l'emporte toujours sur la connexion, pour l'enfant comme pour la session principale. Voir [ADR 0002](../../adr/0002-model-families-and-codex-child.md).

### Codex en processus enfant

Les routes `codex`, `codex/<model>` et `codex/auto`, ainsi que `/route codex`, font répondre au tour la CLI Codex en mode non interactif :

```
codex exec --json -C <session cwd> [-m <model>] [Palgu provider flags] --sandbox read-only -c approval_policy="never" -
```

avec le même brief sur stdin, le même `child.timeoutMs`, le même contrôle, la même mémoire des échecs, la même ligne de route et la même étiquette de provenance que l'enfant Claude. `router.codex.auth` choisit le compte :

- `"palgu"` (par défaut) : Codex parle au point de terminaison Responses de votre passerelle, `/v1/responses`. Sur OpenRouter et LiteLLM, le fournisseur s'appelle `openrouter` ou `litellm`, l'URL de base est `<gateway_url>/v1` (`https://openrouter.ai/api/v1`, `http://localhost:4000/v1` ; une URL LiteLLM `/anthropic` perd d'abord ce suffixe) et la clé va dans `OPENROUTER_API_KEY` ou `LITELLM_API_KEY`, conformément aux guides Codex d'[OpenRouter](https://openrouter.ai/docs/cookbook/coding-agents/codex-cli.md) et de [LiteLLM](https://docs.litellm.ai/docs/proxy/client_setup/codex_cli.md). Nommez le modèle sur ces passerelles : OpenRouter exige un slug complet (`/route codex/openai/gpt-5.6-terra`), LiteLLM l'un de vos `model_name` ; l'identifiant du modèle par défaut de Codex n'en fait pas partie. Sur Palgu, le mod ajoute un fournisseur `palgu` explicite avec `-c model_provider="palgu"`, `-c model_providers.palgu.base_url="<gateway>/v1"`, `-c model_providers.palgu.wire_api="responses"` et `-c model_providers.palgu.env_key="PALGU_API_KEY"`, comme le décrit [la documentation Codex de Palgu](https://www.palgu.ai) (Codex ignore `OPENAI_BASE_URL` avec une connexion ChatGPT, le fournisseur doit donc être explicite). L'URL de base est votre `gateway_url` où `/anthropic` est remplacé par `/v1`, ou `router.codex.baseUrl`. La clé de votre passerelle va uniquement dans l'environnement de l'enfant sous la forme `PALGU_API_KEY`, jamais sur la ligne de commande, jamais affichée. Nécessite l'URL et la clé de la passerelle, comme l'enfant Claude de la passerelle.
- `"chatgpt"` : pas d'options de fournisseur ni de clé : Codex utilise votre propre `codex login` et `~/.codex/config.toml`. Le mod ne lit ni n'écrit jamais `~/.codex`.

#### Sandbox et approbations

`codex exec` ne peut rien demander à personne : en mode non interactif, Codex tourne avec la politique d'approbation Never (Codex 0.163 rejette purement et simplement `approval_policy = "untrusted"`), donc une commande que sa sandbox autorise s'exécute sans question, et une commande qu'elle n'autorise pas est refusée. La sandbox est donc la seule barrière, et le mod la garde étroite :

- **`router.codex.sandbox`** vaut `"read-only"` par défaut : Codex peut lire le projet et exécuter des commandes qui ne font que lire ; il ne peut ni modifier de fichiers ni utiliser le réseau. C'est plus étroit que l'enfant Claude (`acceptEdits`), car `codex exec` n'a aucun moyen de laisser passer les modifications tout en contrôlant les commandes. `-c approval_policy="never"` est passé explicitement, donc une demande de sortie de la sandbox est refusée, jamais exécutée.
- **Désactivation, à vos risques et périls :** `"workspace-write"` permet à Codex de modifier les fichiers du projet **et d'y exécuter n'importe quelle commande sans vous demander** (le réseau reste coupé : `-c sandbox_workspace_write.network_access=false`). `"danger-full-access"` supprime entièrement la sandbox ; ne l'utilisez que dans un environnement jetable, isolé de l'extérieur. Toute autre valeur signifie lecture seule.
- **`router.codex.allowOutsideGit`** (par défaut `false`) ajoute `--skip-git-repo-check`. Sans lui, Codex refuse de démarrer hors d'un dépôt git, la ligne de route indique `child answer discarded (outside a git repo; set router.codex.allowOutsideGit)` (réponse de l'enfant écartée : hors d'un dépôt git), et le modèle principal répond.
- **`router.codex.args`** ajoute des options (par exemple `-c model_reasoning_effort="high"`), mais jamais la sandbox ni l'approbation : `--sandbox`/`-s`, `--dangerously-bypass-approvals-and-sandbox`, `--approve-for-me`, `--full-auto`, `--add-dir`, `--skip-git-repo-check`, `-a`/`--ask-for-approval` et `-c approval_policy=…`/`sandbox_mode=…`/`sandbox_workspace_write.…`/`sandbox_permissions=…` sont supprimés, et le log de la session nomme ce qui a été ignoré. `--ephemeral` y désactive aussi la reprise décrite ci-dessous.

**Commandes refusées.** `codex exec --json` ne signale ni une commande bloquée par sa sandbox, ni une élévation qu'il a refusée : aucune n'apparaît comme un événement (vérifié avec Codex 0.163.0). Le brief demande donc à Codex de terminer sa réponse par `NEEDS-APPROVAL: <exact command>` pour chaque commande bloquée par la sandbox, et le mod compte aussi les lignes `reject command` que Codex écrit sur stderr pour les élévations refusées. Ensuite, comme pour l'enfant Claude :

- Avec la valeur par défaut en lecture seule, le mod vous pose la question dans la même boîte de dialogue, en nommant les commandes et ce que l'approbation autorise : *"Codex child on codex/default was refused by its read-only sandbox: touch made.txt. Allow and continue resumes it for this turn with permission to edit files in the project and run commands there (no network)."* (L'enfant Codex a été refusé par sa sandbox en lecture seule ; Allow and continue le reprend pour ce tour avec le droit de modifier les fichiers du projet et d'y exécuter des commandes, sans réseau.) Sur **Allow and continue**, le même fil reprend (`codex exec -C <cwd> resume --json … -c sandbox_mode="workspace-write" -c approval_policy="never" -c sandbox_workspace_write.network_access=false <thread> -`) avec un message nommant les commandes approuvées. Cela élargit la sandbox pour le reste de ce tour, pas seulement pour les commandes nommées, c'est pourquoi la question le dit. La question est posée au plus une fois par tour (`child.relayRounds: 0` la désactive).
- Sur **Deny**, quand personne ne peut répondre, ou quand votre sandbox est déjà plus large que la lecture seule, rien n'est élargi et le refus n'est jamais silencieux : la réponse se termine par une ligne nommant les commandes refusées (*Codex's sandbox refused, and nothing ran: `touch made.txt`.*) et la ligne de route affiche `· sandbox read-only · refused: touch made.txt` (ou `refused: 2 unnamed` pour des élévations que Codex n'a pas nommées).
- Comme le rapport de refus provient de la réponse de Codex lui-même, un modèle qui ignore la consigne peut encore laisser un refus sans nom. La ligne de route affiche toujours la sandbox dans laquelle le tour s'est exécuté (`sandbox read-only`, ou `sandbox workspace-write (approved)`), de sorte qu'un tour qui ne pouvait pas écrire est visible comme tel.

Si `codex` n'est pas dans le `PATH`, le mod affiche `codex is not installed: npm install -g @openai/codex (or brew install --cask codex) …`, la ligne de route indique `child answer discarded (codex not installed)`, et le modèle principal répond.

**Les scores limites obtiennent un second avis.** Un score égal au seuil de code ou juste au-dessus est échantillonné une seconde fois et le plus élevé l'emporte, pour qu'une tâche de débogage à 7 ou 8 ne change pas de palier à cause du bruit du classifieur.

**Il se souvient des échecs.** Tous les deux échecs d'enfant pour un type, le seuil de code de ce type baisse d'un cran (jamais en dessous de `simple + 1`), de sorte que le travail sur lequel le modèle bon marché échoue sans cesse revient progressivement vers Claude. `/route reset` efface cette mémoire.

**Il protège le fil du travail.** Un enfant n'a aucune mémoire au-delà de son brief, donc le mod ne laisse jamais une relance aboutir chez lui. Après un tour répondu par un enfant, `continue`, `yes` ou tout prompt de six mots ou moins revient à la session principale, qui détient toute la transcription. Et tant que la session principale est en pleine tâche (sa dernière réponse a utilisé des outils), le travail de niveau code reste chez elle (`via mid-task guard` sur la ligne de route) ; seules les recherches et les tâches nouvelles et autonomes partent. Sans ces règles, une session qui avait routé une tâche la recommencerait à chaque « continue ».

**Certains tours ne quittent jamais la session principale**, quel que soit le score ou l'épingle `/route`, parce qu'un enfant ne peut voir ni la conversation, ni les coéquipiers, ni les tâches en arrière-plan, ni les outils de la session (`via notification`, `via session command`, `via security or verdict` sur la ligne de route) :

- les notifications : `<teammate-message …>`, le JSON `idle_notification`, `<task-notification>`, `[SYSTEM NOTIFICATION …]` ;
- les courtes commandes d'opérateur sur l'état de la session ou les outils (12 mots ou moins) : `approve git pull --ff-only`, `continue`, `resume`, `merge it`, `check the sub agents`, `what's the status`, tout ce qui nomme une PR, une branche, la CI, un workflow ou un sous-agent ;
- les tours de sécurité et de verdict (`security`, `vulnerability`, `CVE`, `verdict`, …).

### Ce qu'un enfant n'a pas le droit de faire

Chaque brief commence par un préambule : l'enfant n'a pas accès à la session principale, ne doit jamais inventer d'états, d'identifiants, de numéros de PR, de résultats d'exécution ni de modifications de fichiers, ne doit jamais vous demander d'approuver ou d'exécuter quoi que ce soit, et répond `HANDBACK` quand la tâche nécessite l'état ou les outils de la session. Le mod contrôle ensuite la réponse et l'écarte, laissant le modèle principal faire le tour lui-même, quand elle :

| Réponse | Exemple |
| :- | :- |
| commence par `HANDBACK` | `HANDBACK` / `needs the PR list` |
| s'excuse et abandonne, ou vous renvoie le travail | "I'm sorry, but I don't have permission…", "could you please review the repository? Once that's done, we can continue" |
| parle de vous à quelqu'un d'autre au lieu de vous répondre | "The user can type \"continue\" or give the next instruction" |
| dit être bloquée ou vous demande d'agir | "blocked by the permission system", "you must approve it in the UI", "run `gh pr create` yourself" |
| affirme une action ou un fait de session sans appel d'outil (`num_turns` 1) | "I added X", "PR #812 is open", "14 commits behind", "no build runs exist" |
| se compose surtout d'intentions racontées | "I'll read the config. Then I will update the router." |
| répète une réponse déjà donnée | le même verdict republié à chaque notification d'inactivité |

Une réponse écartée compte comme un échec d'enfant pour ce type et apparaît comme `child answer discarded (<reason>), main model answered` sur la ligne de route. On ne demande jamais au modèle principal de relayer le texte d'un enfant : le mod répond au tour avec une réponse d'enfant contrôlée, ou laisse le tour au modèle principal.

Une réponse écartée est d'abord essayée sur le modèle équivalent suivant, comme une surcharge (ci-dessus), et la ligne de route indique `child: glm-5.3 failed (gave up) → served by deepseek-v4-pro`. Deux cas font exception : `HANDBACK`, où l'enfant a demandé la session principale, et une demande que vous agissiez, que tout modèle rencontrerait de la même façon ; le modèle principal les prend aussitôt.

Chaque ligne de route et le bandeau affichent le score et le type, donc quand une décision semble fausse, vous voyez les chiffres qui l'expliquent.

## Ce que vous voyez

Claude et la passerelle sont tous deux visibles, en permanence :

| Emplacement | Tour de la session principale | Tour routé |
| :- | :- | :- |
| Bandeau au-dessus du prompt | `mixture-of-models · auto · last: claude-opus-5 · critical 9/10`<br>`0: help  1: auto  2: glm  3: deepseek  …  9: claude  off` | `… · running glm-5.3 in a child…` pendant l'exécution |
| Indicateur d'activité | `Thinking…` | `Thinking · via glm-5.3 (child)…` |
| Boîte de dialogue de question | Les propres questions de Claude | `Child on glm-5.3 wants to run: Bash(git pull --ff-only)` avec Allow and continue / Deny |
| Réponse dans la transcription | inchangée (ou étiquetée `⇢ claude-opus-5 · main session` avec `ui.tags: "all"`) | une ligne atténuée `⇢ glm-5.3 · child on gateway` au-dessus de la réponse, conservée dans l'historique (`· child on your Claude subscription` pour un membre Claude, `· Codex child` pour Codex) |
| Ligne sous la réponse | `route: claude-opus-5 · main session · critical 9/10 via claude-haiku-5-5 · 23.1k in / 0.9k out · cache 91% · today: 8 turns, 5 off Claude (63%)` | `route: glm-5.3 · coding 6/10 via ollama · child 42s · saved ~$0.39 · today: …` |
| `/route` | `mixture-of-models live · mode auto · current route: … · today: … · saved ~$12.40 on 48 routed turns (82% of their Claude price) · 61% of all spend ($20.33) vs all claude-opus-5-5, at API prices` | idem |
| `/palgu login` | `Open https://www.palgu.ai/connect?code=WDJB-MJHT and approve code WDJB-MJHT …`, puis une notification `Signed in to Palgu as you@acme.com (Acme, plan starter). Routed turns now run on Palgu.` | idem |
| `/route stats` | Un panneau, « Mixture of models », avec quatre onglets sur les raccourcis m, k, s et r (cliquez d'abord le panneau ; un chiffre seul dans un prompt vide presse les boutons de la barre) : **models** (barres par modèle, part des tours, le titre « N of M turns off Claude » et, en vert, ce que le routage a économisé), **kinds** (chaque type et les modèles qui l'ont pris), **scores** (un histogramme de 1 à 10 coloré par palier, seuils marqués), **recent** (les dernières décisions avec score, type, modèle et durée de l'enfant). Échap le ferme. | idem |
| `/route usage` (`today`, `week`, `month`, `all`) | `Models used, last 7 days: 42 turns, 30 off Claude (71%)`, puis une ligne par modèle avec sa part et une barre, les modèles de vos sous-agents et l'économie | idem |
| `/route stats reset` | `stats reset: model counts, decision log, savings and subagent counts start again from now` | idem |

### Combien il fait économiser

Chaque tour routé est chiffré deux fois : au tarif du modèle Claude de votre session (ce que les mêmes tokens y auraient coûté) et à ce qu'il a réellement coûté. Sur Palgu, le coût réel vient du propre `/v1/pricing/quote` de Palgu, la formule selon laquelle il facture ; sur une autre passerelle, de `router.prices` ; un enfant `claude/<member>` est chiffré au tarif Claude de ce membre. Les tours qui restent dans la session principale comptent aussi dans le total tout-Claude, donc le pourcentage est la part de toute votre facture Claude que le routage a retirée, pas seulement celle des tours routés.

- Sous chaque réponse routée : `· saved ~$0.39`.
- `/route status` : `saved ~$12.40 on 48 routed turns (82% of their Claude price) · 61% of all spend ($20.33) vs all claude-opus-5-5, at API prices`, un total cumulé sur toutes les sessions.
- `/route stats` : le même total, en vert, dans l'onglet models.

Dans notre propre usage, des agents de code tournant jour et nuit épuisaient la limite hebdomadaire d'un abonnement Claude Max 20x en environ trois jours avec Claude seul ; avec Mixture of Models, le même abonnement a tenu les sept jours complets. Voir [GUIDELINES.md](GUIDELINES.md#économies-approximatives--abonnement-seul-ou-mixture-of-models).

C'est une estimation, et elle le dit. Les prix Claude sont les tarifs publics de l'API (Opus 5.5 $4 / $20 par million de tokens en entrée / sortie, Sonnet 5.5 $2 / $10, Haiku 5.5 $0.10 / $0.50, Fable 5.1 $10 / $50 ; les lectures de cache et les écritures de cache à 5 minutes et à 1 heure à leurs propres tarifs), donc sur un abonnement claude.ai il s'agit de l'économie équivalente en API, pas d'argent rendu. L'estimation suppose que le tour routé aurait utilisé le même nombre de tokens sur Claude. Un tour routé que le mod ne peut pas chiffrer (une passerelle sans entrée `router.prices` pour ce modèle, ou un enfant Codex) ne revendique aucune économie ; `/route status` le compte comme non chiffré.

Les boutons du bandeau ont des raccourcis numériques : avec un prompt vide, tapez `3` et marquez une pause pour épingler Kimi, `1` pour revenir à auto, `0` pour l'aide : un panneau qui dit ce que fait le mod, où il en est (mode, passerelle, économies), ce que fait chaque bouton et chaque commande, et comment connecter Palgu, OpenRouter ou LiteLLM. `/route help` l'ouvre aussi. Désactivez le bandeau avec `"ui": { "band": false }`.

## Autres agents de code

Le mod s'exécute dans Claude Code. Pour les autres agents, la CLI `mom` et un adaptateur léger par outil apportent les mêmes briques : Palgu choisit le modèle pour chaque requête, la mémoire Palgu est rappelée dans chaque prompt, et un tour qui s'arrête en pleine tâche est poursuivi ([ADR 0005](../../adr/0005-other-coding-agents.md)).

```bash
npm install -g github:alinaqi/mixture-of-models-claude-mod   # installe `mom` et les fichiers de plugin de chaque agent
mom login                                                     # se connecter à Palgu dans le navigateur
```

Puis, pour votre agent :

```bash
# Codex
mom setup codex --write && codex plugin marketplace add alinaqi/mixture-of-models-claude-mod && codex plugin add mixture-of-models@mixture-of-models
codex -p palgu

# Cursor (dans le dossier du projet ; puis Developer: Reload Window)
mom setup cursor --write

# OpenCode
mom setup opencode --write

# Antigravity
agy plugin install "$(npm root -g)/mixture-of-models-claude-mod/integrations/antigravity"

# GitHub Copilot CLI
copilot plugin install alinaqi/mixture-of-models-claude-mod:integrations/copilot
```

Facultatif, par projet, envoie son code source à Palgu : `mom memory on`. Toutes les commandes, avec vérifications et dépannage : [INSTALL.md](INSTALL.md). Comment tirer le meilleur de chaque agent : [GUIDELINES.md](GUIDELINES.md).

| Agent | État | Guide |
| :- | :- | :- |
| Codex (CLI, 0.163+) | Plugin : rappel de la mémoire, heartbeat, indexation ; `codex -p palgu` route via Palgu | [integrations/codex](integrations/codex/README.md) |
| Cursor | Plugin (ou `mom setup cursor`) : serveur MCP pour la recherche dans la mémoire Palgu et la délégation aux modèles Palgu (`mom mcp`), heartbeat et indexation via des hooks, une règle indiquant quand déléguer. Pas de routage par tour : les hooks de Cursor ne peuvent pas changer le modèle | [integrations/cursor](integrations/cursor/README.md) |
| OpenCode (1.19+) | Plugin à parité complète : modèle Palgu par requête (auto, épingle `/route`, ou vos routes par palier), rappel de la mémoire, heartbeat, indexation, `/route` et `/palgu` ; `mom setup opencode --write` ajoute le fournisseur | [integrations/opencode](integrations/opencode/README.md) |
| Antigravity (`agy` 1.0.7+) | Plugin : rappel de la mémoire dans le premier appel au modèle de chaque tour, heartbeat, indexation, outils Palgu via MCP (`palgu_delegate` pour les sous-tâches routées). Ses hooks ne peuvent pas changer le modèle | [integrations/antigravity](integrations/antigravity/README.md) |
| GitHub Copilot CLI (1.0.112+) | Plugin : heartbeat, indexation, outils Palgu via MCP (recherche dans la mémoire, `palgu_delegate`), un skill indiquant quand les utiliser. Ses hooks ne peuvent ni changer le modèle ni ajouter quoi que ce soit à un prompt | [integrations/copilot](integrations/copilot/README.md) |
| Aider, Continue, Goose | Routage Palgu (`model: auto`) ; pas de hooks, donc ni rappel de la mémoire ni heartbeat. Aider vérifié en conditions réelles | [integrations/gateway](integrations/gateway/README.md) |

Le consentement à la mémoire Palgu (`mom memory on`) se donne par dossier de projet et est partagé par tous les agents qui utilisent `mom`. Il est distinct du `/palgu memory on` du mod.

## Prérequis

- Claude Code **v2.1.287 ou plus récent** (`claude --version`). Les mods ne se chargent pas sur les versions plus anciennes ; `claude update`.
- Une passerelle utilisable par l'enfant : le point de terminaison Anthropic de Palgu, OpenRouter, un proxy LiteLLM, ou tout point de terminaison compatible Anthropic qui sert les identifiants de modèles de `routes`, avec sa clé.
- Facultatif : Ollama avec un petit modèle pour une classification gratuite (`ollama pull qwen2.5-coder:3b`). Sans lui, le classifieur se replie sur Haiku sur votre offre.

## Mise en place

Voir [GETTING_STARTED.md](GETTING_STARTED.md) pour le guide pas à pas complet, ou `./install.sh`.

1. Donnez sa passerelle à l'enfant. Sur Palgu, `/palgu login` fait toute cette étape : il utilise la connexion par appareil de Palgu (la même que celle de `srooterctl`), Palgu génère pour cet ordinateur une clé que vous pouvez révoquer sur sa page Devices, et le mod enregistre l'URL et la clé avec `claude plugin configure --values-stdin`. Sinon, le plugin demande deux valeurs ; la clé est masquée et conservée dans le stockage sécurisé de Claude Code, jamais dans un fichier de paramètres :

   ```
   /plugin configure mixture-of-models@mixture-of-models-claude-mod
   ```

   ou depuis le shell : lancez `claude plugin configure mixture-of-models@mixture-of-models-claude-mod --values-stdin`, tapez `{"gateway_url":"https://api.palgu.ai/anthropic","gateway_key":"<your key>"}` sur son entrée et appuyez sur Ctrl-D, pour que la clé n'apparaisse ni dans l'historique du shell ni dans la liste des processus.

2. Ajustez si vous le souhaitez les routes, les seuils et l'enfant dans `~/.claude/model-config.json` ; `config.example.json` dans le dépôt est un point de départ complet (également présenté plus bas).

3. Lancez `claude` et exécutez `/route`.

Tant qu'une URL et une clé de passerelle ne sont pas présentes, le mod est **en observation seule** : il classe et `/route` montre ce qu'il ferait, mais aucun enfant ne démarre.

La troisième option, `gateway_provider`, indique de quel type de passerelle il s'agit : `auto` (la valeur par défaut, y compris quand elle est vide) détecte Palgu (`*.palgu.ai`) et OpenRouter (`openrouter.ai`) d'après l'URL et traite tout autre hôte comme une passerelle générique compatible Anthropic, exactement comme avant 0.16 ; `palgu`, `openrouter`, `litellm` ou `anthropic-compatible` la nomment directement. Le fournisseur détermine comment l'enfant envoie la clé et quels identifiants de modèles utilisent les routes par défaut et le bandeau :

| Fournisseur | Authentification de l'enfant | Identifiants de modèles par défaut | En-têtes `x-srooter-*` |
| :- | :- | :- | :- |
| `palgu` | `ANTHROPIC_API_KEY` (`x-api-key`) | ceux de Palgu : `glm-5.3`, `deepseek-v4-pro`, … | oui |
| `openrouter` | `ANTHROPIC_AUTH_TOKEN` (`Authorization: Bearer`) | les slugs OpenRouter derrière les familles : `glm/5.3` → `z-ai/glm-5.3`, … | non |
| `litellm` | `ANTHROPIC_AUTH_TOKEN` (`Authorization: Bearer`) | les noms de Palgu ; les `model_name` de votre proxy décident | non |
| `anthropic-compatible` | `ANTHROPIC_API_KEY` (`x-api-key`) | ceux de Palgu | oui |

Quelle que soit la variable qui porte la clé, l'environnement de l'enfant met l'autre à vide, car l'enfant hérite de votre shell et Claude Code envoie les deux quand les deux sont définies : un `ANTHROPIC_API_KEY` exporté dans votre shell ne part jamais vers OpenRouter, et un `ANTHROPIC_AUTH_TOKEN` égaré n'atteint jamais Palgu. La clé n'est jamais sur une ligne de commande.

### OpenRouter

1. Créez une clé sur [openrouter.ai/keys](https://openrouter.ai/keys).
2. `/plugin configure mixture-of-models@mixture-of-models-claude-mod` avec

   | Option | Valeur |
   | :- | :- |
   | `gateway_url` | `https://openrouter.ai/api` |
   | `gateway_key` | votre clé OpenRouter (`sk-or-…`) |
   | `gateway_provider` | `auto` (ou `openrouter`) |

   ou depuis le shell : lancez `claude plugin configure mixture-of-models@mixture-of-models-claude-mod --values-stdin`, tapez `{"gateway_url":"https://openrouter.ai/api","gateway_key":"<your key>","gateway_provider":"openrouter"}` sur son entrée et appuyez sur Ctrl-D, pour que la clé n'apparaisse pas dans l'historique du shell.
3. Lancez `claude`. Les tours simples et de code s'exécutent sur `z-ai/glm-5.3`, la recherche et la revue sur `moonshotai/kimi-k3.1-pro` ; le bandeau propose `glm`, `kimi`, `deepseek` (`deepseek/deepseek-v4-pro`), `gemini` (`google/gemini-3.8-flash`), `minimax` (`minimax/minimax-m3`, `minimax/minimax-m3.1-flash`), `gpt` (`openai/gpt-6-sol`, `-luna`, `-astra`) et `mercury` (`inception/mercury-3`). Avec onze boutons, le dernier n'a pas de touche numérique ; cliquez dessus ou atteignez-le avec Tab. Ce sont les slugs que [la liste des modèles d'OpenRouter](https://openrouter.ai/models) servait le 2026-10-29. OpenRouter n'a pas de variante Kimi highspeed, donc `kimi/auto` vaut `pro` pour tous les paliers.

Sur OpenRouter, les routes nomment des membres de famille (`glm/5.3`), car un slug OpenRouter contient un `/` ; un slug qu'une famille liste (`z-ai/glm-5.3`) fonctionne aussi. Pour un autre modèle OpenRouter, ajoutez-le à une famille et routez vers lui :

```json
{ "router": {
    "families": { "glm": { "members": { "4.6": "z-ai/glm-4.6" } } },
    "routes":   { "simple": "glm/4.6" } } }
```

Comme le dit [le guide Claude Code d'OpenRouter](https://openrouter.ai/docs/guides/guides/claude-code-integration), Claude Code n'est garanti qu'avec les propres modèles d'Anthropic ; un tour routé dont le modèle ne sait pas gérer les outils de Claude Code échoue, et le modèle principal y répond.

### LiteLLM

Un [proxy LiteLLM](https://docs.litellm.ai/docs/tutorials/claude_responses_api) sert son `/v1/messages` compatible Anthropic à sa propre adresse. Il tourne sur votre machine, il n'est donc jamais détecté : nommez-le.

| Option | Valeur |
| :- | :- |
| `gateway_url` | votre proxy, par exemple `http://localhost:4000` (ou son relais `/anthropic`, `http://localhost:4000/anthropic`) |
| `gateway_key` | la clé maîtresse du proxy ou une clé virtuelle (`sk-…`) |
| `gateway_provider` | `litellm` |

L'enfant envoie la clé sous forme `Authorization: Bearer`. Les noms de modèles sont les `model_name` que définit le `config.yaml` de votre proxy. Les valeurs par défaut sont les noms de Palgu (`glm-5.3`, `kimi-k3.1-pro`, …) : nommez pareil les modèles de votre proxy, ou faites pointer les routes vers les vôtres :

```json
{ "router": {
    "routes":   { "simple": "my-glm", "coding": "my-glm", "kinds": { "research": "my-kimi", "review": "my-kimi" } },
    "families": { "glm": { "members": { "mine": "my-glm" } } } } }
```

Une clé virtuelle n'atteint que les modèles qui lui sont autorisés ; un 401 ou un modèle inconnu fait échouer l'enfant, et le modèle principal répond.

## Sécurité et utilisation des données

### Hôtes réseau contactés par ce plugin

- `https://api.palgu.ai` — Palgu, fixé dans le code : `/auth/device/code` et `/auth/token` lors de `/palgu login`, `/me` et `/me/org-settings` lors de `/palgu status`, `/v1/models/health` au démarrage de la session, après `/palgu login` et lors de `/route models` (la clé de la passerelle en `x-api-key` ; rien d'autre n'est envoyé), `/v1/pricing/quote` après un tour routé quand votre passerelle est Palgu et que `router.prices` n'a pas d'entrée pour le modèle, `/anthropic/heartbeat` quand la session principale termine un tour (le heartbeat, ci-dessous), et `/v1/cortex/search` à chacun de vos prompts dans un projet où vous avez lancé `/palgu memory on` (rappel de la mémoire Palgu, ci-dessous).
- `https://raw.githubusercontent.com` — au démarrage de session (au plus toutes les 12 heures, en arrière-plan) et lors de `/route update` : un GET de `/alinaqi/mixture-of-models-claude-mod/main/.claude-plugin/plugin.json` pour lire la version publiée. Rien n'est envoyé.
- `http://localhost:11434` — un Ollama local (`/api/chat`) qui évalue chaque prompt. Cela reste sur votre machine ; ignoré quand rien n'y répond.
- Anthropic, via le propre `$.model.classify` de Claude Code sur votre propre offre — uniquement quand Ollama ne répond pas, pour évaluer le prompt.
- L'URL de passerelle que vous définissez dans les paramètres du plugin (`gateway_url`, par exemple `https://api.palgu.ai/anthropic`, `https://openrouter.ai/api` ou votre proxy LiteLLM). L'utilisateur peut définir une URL de passerelle personnalisée dans les paramètres du plugin ; seule cette URL est contactée pour les tours routés, et c'est le processus enfant, pas le mod, qui la contacte. Un enfant Codex utilise le `/v1` de cette passerelle (ou le `router.codex.baseUrl` que vous définissez), ou OpenAI sur votre propre connexion Codex avec `codex.auth: "chatgpt"`. Un enfant `claude/<member>` utilise Anthropic sur votre propre connexion Claude.

### Données envoyées par le plugin

- Messages de la conversation (`session.messages`) : le prompt plus les `router.child.contextMessages` derniers messages (12 par défaut) qui contiennent du texte, chacun tronqué à 1 200 caractères, avec le nom des outils qu'ils ont utilisés. Ils sont écrits sur le stdin de l'enfant, et l'enfant les envoie à l'URL de passerelle ci-dessus (ou à Anthropic ou Codex pour ces routes) pour obtenir la réponse du modèle. Envoyés uniquement lors d'un tour routé : un tour que le score, ou votre épingle `/route`, éloigne de la session principale. Les tours critiques, de sécurité, de notification et d'opérateur ne sont jamais routés eux-mêmes, mais le contexte d'un tour routé ultérieur peut inclure leur texte récent, car le contexte se compose des derniers messages contenant du texte, quelle que soit leur route. Pendant qu'il travaille, la propre boucle d'agent de l'enfant envoie aussi ce que ses outils lisent dans le projet, sous les règles de refus décrites dans [Ce qu'un enfant n'a pas le droit de faire](#ce-quun-enfant-na-pas-le-droit-de-faire).
- Le texte du prompt et la grille d'évaluation : à l'Ollama local, ou à Anthropic via `$.model.classify`, pour chaque prompt qui arrive à la classification.
- Contenu de fichiers locaux (`fs.read`) : `~/.claude/model-config.json` (vos paramètres ; jamais envoyé) et `~/.claude/mixture-of-models/strategies/*.md` (vos stratégies de routage ; la grille de la stratégie active fait partie du prompt d'évaluation, elle part donc vers Ollama ou Anthropic comme ci-dessus). Le mod ne lit lui-même aucun fichier du projet.
- À Palgu : lors de `/palgu login`, l'identifiant client `mixture-of-models`, le nom d'appareil `Claude Code on <HOSTNAME>`, la version du mod, un identifiant d'installation aléatoire et le code d'appareil ; lors de `/palgu status`, la clé de la passerelle dans un en-tête Bearer ; pour un devis de prix, l'identifiant du modèle, quatre nombres de tokens et la clé. Aucun texte de prompt ni de réponse.
- À Palgu, le heartbeat : quand la session principale termine une réponse et que votre passerelle est Palgu (et que `router.heartbeat` ne vaut pas `local` ou `off`), les 600 derniers caractères de cette réponse, un identifiant de session (l'identifiant d'installation et le numéro du prompt) et la clé en `x-api-key`. Palgu indique si le tour s'est arrêté en pleine tâche. Rien d'autre de la conversation.
- À Palgu, via la CLI `palgu` et seulement après que vous avez lancé `/palgu memory on` : les fichiers source du projet, pour la mémoire Palgu (voir Programmes). `palgu` utilise sa propre connexion.
- À Palgu, le rappel de la mémoire Palgu, uniquement dans un dossier de projet où vous avez lancé `/palgu memory on` et tant que le mod est connecté à Palgu : chacun de vos prompts de quatre mots ou plus (sur une ligne, 300 caractères au plus ; pas les commandes slash), le nom Palgu du projet et la clé dans un en-tête Bearer, vers `/v1/cortex/search`. Ce qui revient (au plus 8 pointeurs d'une ligne : intentions consignées et ADR, docs, symboles de code avec leurs fichiers ; au plus 2 000 caractères) est ajouté à côté de votre prompt pour la session principale et au brief d'un enfant routé (Claude, un modèle Palgu ou Codex), de sorte que chaque modèle qui répond voit la même mémoire. Une recherche qui échoue ou dépasse 3 s n'ajoute rien et ne retarde jamais le prompt.
- À une passerelle Palgu ou générique, les en-têtes d'identification de l'enfant : `x-srooter-client` (nom et version du mod), `x-srooter-project` (le nom du dossier de la session, transformé en slug) et, sur Palgu, `x-srooter-pin` (l'identifiant du modèle routé). Voir [En-têtes envoyés par l'enfant](#en-têtes-envoyés-par-lenfant). Un enfant avec un modèle routé envoie aussi `x-palgu-fallback: auto`.
- Aucune autre donnée n'est envoyée. Pas de télémétrie. Pas d'analytique.

### Programmes exécutés par le plugin

Chaque appel `$.process.run` a son programme et ses options fixes écrits en texte littéral à l'endroit de l'appel. Aucun shell n'en exécute aucun.

- `claude -p --model <model> --output-format stream-json --verbose --max-turns <n> --add-dir <cwd> <child.args> --disallowedTools <deny rules>` — Claude Code lui-même, sans interface, pour exécuter un tour routé sur la passerelle ou sur votre connexion Claude (routes `claude/<member>`). Arguments dynamiques : l'identifiant du modèle (issu de vos routes ou de votre épingle ; refusé s'il n'est pas un identifiant simple fait de lettres, chiffres et `. _ : / @ [ ] -`, ne commençant pas par `-`, de 200 caractères au plus), la limite de tours et `child.args`/`router.child.deny` issus de votre `model-config.json`, et le répertoire de travail de la session ; chacun est refusé s'il n'est pas une chaîne simple ou s'il contient un NUL. Après que vous avez approuvé des commandes refusées à l'enfant, le même appel ajoute `--resume <its session id> --allowedTools <the patterns you approved>`.
- `codex exec --json … -`, et `codex exec -C <cwd> resume --json … <thread id> -` après que vous avez approuvé des commandes refusées — la CLI Codex, uniquement pour les routes `codex`, avec les mêmes contrôles (l'identifiant de fil comme identifiant simple).
- `claude plugin configure mixture-of-models@mixture-of-models-claude-mod --values-stdin` — une fois après `/palgu login`, pour enregistrer la clé générée par Palgu dans le stockage sécurisé de Claude Code. Chaque argument est un texte fixe ; la clé passe uniquement par stdin, et seulement après avoir été vérifiée comme un unique token simple (`A-Z a-z 0-9 . _ -`, 8 à 512 caractères).
- `claude plugin marketplace update mixture-of-models-claude-mod`, puis `claude plugin update mixture-of-models@mixture-of-models-claude-mod` — lors de `/route update`, uniquement quand GitHub liste une version plus récente. Chaque argument est un texte fixe.
- `palgu memory index .` (dans le dossier de la session, en arrière-plan, au plus toutes les 10 minutes par projet) et `palgu memory status . --json` — la CLI Palgu, uniquement dans un dossier de projet où vous avez lancé `/palgu memory on` et tant que le mod est connecté à Palgu. Chaque argument est un texte fixe. `palgu` se connecte avec sa propre clé (`palgu login`) ; le mod ne lui transmet ni clé, ni environnement, ni stdin. L'indexation envoie les fichiers source du projet à Palgu, c'est pourquoi elle est désactivée tant que vous ne l'activez pas.
- Le plugin n'exécute jamais de commandes reçues du réseau. Les réponses réseau ne figurent jamais dans l'argv d'un `process.run` : la réponse de GitHub décide seulement si les commandes de mise à jour fixes s'exécutent, et la seule valeur récupérée qui atteint un processus est la clé Palgu, sur stdin, après la vérification ci-dessus.

### Hooks

- `prompt.submit` — lit le prompt pour décider de sa route (pré-règles, puis score du classifieur, puis seuils). Le laisse passer inchangé : ne le supprime, ne le réécrit et n'y ajoute jamais rien. En cas d'erreur, laisse passer (fail open).
- `turn.step` — pour un tour routé, exécute l'enfant ci-dessus à la place du modèle principal et répond au tour avec le texte de l'enfant ; tout autre tour, et tout sous-agent, passe inchangé. Une réponse d'enfant en échec ou écartée rend le tour au modèle principal.
- `agent.spawn` — avant qu'un sous-agent intégré démarre, note sa tâche et lui choisit un modèle Claude moins cher (Sous-agents, ci-dessus) ; compte le modèle de chaque sous-agent.
- `turn.complete` — ajoute la ligne de route (route, score, coût, économies) au texte du tour et met à jour les compteurs, le journal des décisions et les totaux d'économies dans le stockage du plugin. Puis le heartbeat : quand la réponse de la session principale s'est arrêtée en pleine tâche (elle a annoncé une action puis s'est terminée, ou, quand vous aviez demandé des changements, a décrit des modifications qu'elle n'a pas faites), le mod soumet lui-même un prompt de continuation (`$.prompt.submit`, présenté au modèle comme venant de ce plugin), au plus `router.heartbeatMax` (3) fois par prompt de votre part. En cas d'erreur, laisse passer : une erreur ne bloque jamais un arrêt.
- Aussi : `session.start` (lit les paramètres, enregistre `/route` et `/palgu`), `turn.start` (efface le dernier résultat d'enfant), `ui.render` pour `AbovePrompt` (le bandeau), `AssistantMessage` (une étiquette de provenance sur les réponses des enfants), `Pane` (les panneaux d'aide et de statistiques) et `Spinner` (`via <model> (child)…`), et `command.run` pour `/route` et `/palgu`. Le mod ne gère jamais `tool.call` ni `tool.check`.

### Commandes, outils et agents ajoutés

- `/route` — affiche l'état du routage, épingle un palier, un modèle, un membre de famille ou `codex`, change de stratégie, ouvre le panneau de statistiques ou d'aide, réinitialise la mémoire des échecs, ou met à jour le plugin (`/route update`).
- `/palgu` — se connecter à Palgu (`login`), indiquer à qui appartient la clé définie, ce que votre organisation a dépensé de son budget Palgu sur la période et si le projet est dans la mémoire Palgu (`status`), donner le lien vers les offres et la facturation (`upgrade`), ou activer ou désactiver la mémoire Palgu pour le projet où vous êtes (`memory on`, `memory off`, `memory` ; chaque dossier de projet a besoin de son propre `memory on`).
- Le skill `routing-strategy` — aide à écrire ou à expliquer un fichier de stratégie de routage.
- Aucun outil, aucun agent, aucun serveur MCP.

### Identifiants

- Les clés d'API sont saisies par l'utilisateur dans les paramètres du plugin (`user_config`, stockées comme sensibles) : une seule clé, `gateway_key`, pour la passerelle que vous configurez (Palgu, OpenRouter, LiteLLM ou un autre point de terminaison compatible Anthropic). `/palgu login` remplit ce même paramètre pour vous.
- Le plugin ne lit pas de clés depuis les variables d'environnement ni depuis des fichiers sur la machine de l'utilisateur. Les variables d'environnement qu'il lit sont `HOME`, `HOSTNAME`, `MAGGY_ROUTER_CHILD` et `ANTHROPIC_CUSTOM_HEADERS` (vos propres en-têtes supplémentaires, transmis uniquement à l'enfant de la passerelle).
- Chaque clé n'est envoyée qu'à l'hôte de son propre fournisseur : `gateway_key` atteint la passerelle que vous avez configurée (ou, sur une route Codex, le `router.codex.baseUrl` que vous avez défini dans `model-config.json`), par le processus enfant, depuis l'environnement de l'enfant (jamais son argv), et n'atteint `https://api.palgu.ai` depuis le mod que lorsque cette passerelle est Palgu.

## Ce que ce plugin exécute, lit, envoie et stocke

L'analyse de sécurité de l'annuaire compare cette section avec le code. Tout ce que le mod fait en dehors de son propre code est listé ici. En résumé :

- Uniquement quand vous lancez `/palgu`, il **contacte** `https://api.palgu.ai` (`/auth/device/code`, `/auth/token`, `/me`) et **exécute** une fois `claude plugin configure … --values-stdin` pour enregistrer la clé générée par Palgu (voir les tableaux ci-dessous).
- Il **contacte** `http://localhost:11434/api/chat` avec `$.http.fetch`, en envoyant le texte du prompt et la grille d'évaluation à un Ollama local, pour évaluer le prompt. Aucun identifiant, rien ne quitte la machine.
- Il **appelle** `$.model.classify`, qui envoie le même texte de prompt et la même grille à Anthropic via le propre client API de Claude Code sur votre propre compte, quand Ollama ne répond pas.
- Au démarrage de session, en arrière-plan et au plus toutes les 12 heures, ainsi que lors de `/route update`, il **récupère** `https://raw.githubusercontent.com/alinaqi/mixture-of-models-claude-mod/main/.claude-plugin/plugin.json` (un simple GET, rien n'est envoyé) pour voir si une version plus récente est sortie, et le signale dans un toast et sur le bandeau.
- Uniquement lors de `/route update`, quand GitHub liste une version plus récente, il **exécute** `claude plugin marketplace update` et `claude plugin update` pour ce plugin, en texte fixe.
- Il **exécute** deux programmes avec `$.process.run` pour les tours routés : `claude` (Claude Code lui-même, sans interface), soit avec `ANTHROPIC_BASE_URL` et la clé que vous avez configurée (dans `ANTHROPIC_API_KEY`, ou `ANTHROPIC_AUTH_TOKEN` pour OpenRouter et LiteLLM, l'autre étant mise à vide) et, pour Palgu et les passerelles génériques, `ANTHROPIC_CUSTOM_HEADERS` défini pour l'identifier (voir [En-têtes envoyés par l'enfant](#en-têtes-envoyés-par-lenfant)), soit, pour une route `claude/<member>`, sur votre propre connexion Claude avec `ANTHROPIC_BASE_URL` effacé ; et, uniquement pour une route `codex`, `codex exec` (la CLI Codex), avec la clé de votre passerelle dans `PALGU_API_KEY` (`OPENROUTER_API_KEY` sur OpenRouter, `LITELLM_API_KEY` sur LiteLLM) ou sur votre propre connexion Codex. Chaque enfant **envoie** votre prompt et un bref résumé du texte récent de la session à son point de terminaison.
- Il **lit** `~/.claude/model-config.json`, vos fichiers de stratégie, `HOME`, `HOSTNAME`, `MAGGY_ROUTER_CHILD` et `ANTHROPIC_CUSTOM_HEADERS`, et **stocke** dans le stockage du plugin l'épingle de route, les compteurs par jour, le dernier verdict, les compteurs d'échecs par type, la dernière vérification de mise à jour et un journal des 200 dernières décisions (jour, modèle, type, palier, score, source du classifieur, durée de l'enfant et code de sortie ; jamais le texte du prompt).

Le détail complet suit ; une politique de confidentialité se trouve dans [PRIVACY.md](PRIVACY.md).

### Hooks

Le module de hooks `hooks/register.js` enregistre douze hooks. Ce que chacun fait des événements et des appels qu'il voit :

| Hook | Ce qu'il fait |
| :- | :- |
| `session.start` | Lit `~/.claude/model-config.json` et vos fichiers de stratégie, prend l'URL et la clé de la passerelle dans les options du plugin, mémorise le modèle de la session, charge l'épingle `/route` depuis le stockage du plugin, et enregistre les commandes `/route` et `/palgu`. Ne fait rien quand `MAGGY_ROUTER_CHILD` est défini, de sorte que le mod reste inactif dans son propre enfant. |
| `prompt.submit` | Laisse passer chaque prompt inchangé. En parallèle, il décide de la route : d'abord les pré-règles, puis un score d'impact de 1 à 10 donné par le classifieur (voir Réseau), puis les seuils. Ne supprime, ne réécrit et n'ajoute jamais rien à un prompt. En cas d'erreur, laisse passer : si l'évaluation lève une exception, le prompt passe quand même. |
| `turn.start` | Efface le résultat d'enfant du tour précédent. |
| `turn.step` | Pour un tour routé, au lieu de laisser la session principale appeler son modèle, exécute le processus enfant (Claude Code sur la passerelle ou sur votre connexion Claude, ou Codex) décrit sous Programmes et renvoie le texte de l'enfant comme réponse du tour avec `stopReason: end_turn`. Si le système de permissions de l'enfant a refusé une commande, le hook vous pose la question avec `$.ui.ask` (la boîte de dialogue que Claude utilise pour les questions), en nommant les commandes exactes ; sur « Allow and continue », il reprend le même enfant avec ces commandes autorisées, jusqu'à `relayRounds` fois ; sur « Deny », ou quand personne ne peut répondre, l'explication de l'enfant lui-même est la réponse. Un enfant Codex est interrogé de la même manière sur les commandes qu'il nomme comme refusées, une fois par tour ; sur « Allow and continue », le même fil Codex reprend avec les modifications autorisées dans le projet (voir [Sandbox et approbations](#sandbox-et-approbations)). Pour tout autre tour, et pour les sous-agents, il appelle `next(e)` sans changement. Si l'enfant échoue ou n'affiche rien, il appelle `next(e)`, et le modèle principal répond. |
| `agent.spawn` | Avant que l'outil Agent démarre un sous-agent intégré que les règles nomment (`router.subagents`), note sa tâche (les 2 000 premiers caractères, avec le même classifieur que les prompts) et fixe son modèle : Haiku pour simple, Sonnet pour le code, inchangé pour critique, et jamais un modèle plus cher que celui du parent. Un modèle déjà choisi, l'agent d'un plugin ou le vôtre, un fork, un coéquipier et un agent de workflow restent tels quels. Compte le modèle de chaque sous-agent, pour `/route usage`. |
| `turn.complete` | Ajoute sous la réponse une ligne avec la route, le score, le coût et le lieu d'exécution, ainsi que ce qu'un tour routé a économisé ; met à jour les compteurs par jour et les totaux d'économies dans le stockage du plugin. Sur Palgu, il demande à `/v1/pricing/quote` ce qu'a coûté le tour routé. |
| `ui.render` pour `AbovePrompt` | Dessine le bandeau : le mode actuel et la dernière décision, plus des boutons qui changent l'épingle `/route`. Conserve ce que d'autres mods y dessinent. |
| `ui.render` pour `AssistantMessage` | Place une ligne de provenance atténuée au-dessus d'une réponse produite par l'enfant. Les autres réponses passent telles quelles. |
| `ui.render` pour `Spinner` | Ajoute `via <model> (child)…` après le mot de l'indicateur d'activité pendant un tour routé. |
| `ui.render` pour `Pane` | Dessine le panneau de statistiques « Mixture of models » (id `routing-stats`) à partir du journal des décisions quand `/route stats` l'a ouvert. Les autres panneaux passent tels quels. |
| `command.run` pour `/palgu` | `login` démarre la connexion par appareil de Palgu et répond aussitôt avec le lien et le code ; un minuteur `$.clock` interroge ensuite `/auth/token` toutes les `interval` secondes (5 de plus après chaque `slow_down`) jusqu'à ce que vous approuviez, refusiez ou que le code expire, puis enregistre la clé et bascule l'enfant sur Palgu pour cette session. `status` demande au `/me` de Palgu à qui appartient la clé ; `upgrade` affiche le lien de facturation. |
| `command.run` pour `/route` | Affiche l'état du routage et les familles (`/route`, `/route status`) ou définit l'épingle (`auto`, `off`, un palier, un modèle, `<family>/<member>`, `<family>/auto` ou `codex`). Une famille ou un membre inconnu est refusé avec la liste des valeurs valides. |

Le mod ne gère jamais `tool.call` ni `tool.check`, il n'approuve, ne refuse ni ne modifie donc jamais un appel d'outil, et il ne change jamais les demandes de permission.

### Réseau : les hôtes contactés par ce plugin

Les appels du mod lui-même, puis ceux du processus enfant :

| Qui | Appel | Adresse | Ce qui est envoyé | Pourquoi |
| :- | :- | :- | :- | :- |
| Le mod, au démarrage de session (au plus toutes les 12 heures) et dans `/route update` | `$.http.fetch` | `https://raw.githubusercontent.com/alinaqi/mixture-of-models-claude-mod/main/.claude-plugin/plugin.json`, fixé dans le code | Rien d'autre que le GET | Lit la version publiée pour la comparer avec la vôtre. |
| Le mod, dans `/palgu login` | `$.http.fetch` | `https://api.palgu.ai/auth/device/code`, puis `/auth/token`, fixés dans le code | L'identifiant client `mixture-of-models`, le nom d'appareil (`Claude Code on <HOSTNAME>`), la version du mod et un identifiant d'installation aléatoire qu'il conserve dans son stockage ; puis le code d'appareil que Palgu lui a donné | Connexion. Palgu répond avec une clé pour cet ordinateur. |
| Le mod, au démarrage de la session, après `/palgu login` et lors de `/route models` | `$.http.fetch` | `https://api.palgu.ai/v1/models/health`, fixé dans le code | Rien d'autre que le GET et la clé de la passerelle en `x-api-key` ; uniquement quand votre `gateway_url` est sur `https://api.palgu.ai` | Lit quels modèles Palgu sert en ce moment et lesquels sont indisponibles, pour que la liste des modèles suive Palgu plutôt qu'une version publiée. Conservé dans le stockage du mod pour la session suivante. |
| Le mod, dans `turn.complete` après un tour routé sur Palgu | `$.http.fetch` | `https://api.palgu.ai/v1/pricing/quote`, fixé dans le code | L'identifiant du modèle routé et les quatre nombres de tokens de l'enfant (entrée, sortie, lecture de cache, écriture de cache), et la clé de la passerelle dans un en-tête Bearer ; uniquement quand votre `gateway_url` est sur `https://api.palgu.ai` et que `router.prices` n'a pas d'entrée pour ce modèle | Chiffre le tour pour l'estimation des économies. Aucun texte de prompt ni de réponse. |
| Le mod, dans `prompt.submit`, uniquement là où `/palgu memory on` a été lancé | `$.http.fetch` | `https://api.palgu.ai/v1/cortex/search`, hôte et chemin fixés dans le code | Votre prompt (une ligne, 300 caractères au plus), le nom Palgu du projet, `limit=8`, et la clé de la passerelle dans un en-tête Bearer ; uniquement quand votre `gateway_url` est sur `https://api.palgu.ai` | Rappel de la mémoire Palgu : des pointeurs issus de la mémoire du projet sont placés à côté du prompt pour la session principale et dans le brief d'un enfant routé. |
| Le mod, dans `/palgu status` | `$.http.fetch` | `https://api.palgu.ai/me` et `https://api.palgu.ai/me/org-settings`, fixés dans le code | La clé de la passerelle, dans un en-tête Bearer, uniquement quand votre `gateway_url` est sur `https://api.palgu.ai` (la clé d'une autre passerelle n'est jamais envoyée) | Indique à qui appartient la clé, l'offre de l'organisation, et ce que l'organisation a dépensé de son budget Palgu sur la période. |
| Le mod, dans `prompt.submit` | `$.http.fetch` | `http://localhost:11434/api/chat`, fixé dans le code | La grille d'évaluation et le texte du prompt, sous forme de requête de chat Ollama, sans identifiants | Classification locale gratuite. Ignorée quand rien n'y répond. |
| Le mod, dans `prompt.submit` | `$.model.classify` | L'API d'Anthropic via le propre client de Claude Code et votre propre offre | La grille d'évaluation et le texte du prompt | Classification quand Ollama n'est pas disponible. Modèle : l'alias `classifier`, `claude-haiku-5-5` par défaut. |
| Le processus enfant (Claude Code lui-même), démarré dans `turn.step` | Le client API normal de Claude Code | Le `gateway_url` que vous définissez dans les options du plugin (par exemple `https://api.palgu.ai/anthropic`, `https://openrouter.ai/api` ou votre proxy LiteLLM), avec `gateway_key` comme `x-api-key` (Palgu, générique) ou `Authorization: Bearer` (OpenRouter, LiteLLM) | Votre prompt plus un brief des `contextMessages` derniers échanges de la session (texte uniquement, tronqué), puis ce que la propre boucle d'agent de l'enfant envoie pendant qu'il travaille | C'est la raison d'être du plugin : le tour s'exécute sur le modèle de la passerelle au lieu de celui de la session principale. |
| Un enfant membre Claude (routes `claude/<member>`), démarré dans `turn.step` | Le client API normal de Claude Code | Anthropic, sur votre propre connexion claude.ai, la même que votre session principale | Le même brief, puis la propre boucle d'agent de l'enfant | Exécute le tour sur un autre modèle Claude sans rediriger la session principale. |
| L'enfant Codex (routes `codex`), démarré dans `turn.step` | Le propre client de la CLI Codex | Avec `codex.auth: "palgu"` : le `/v1` de votre passerelle (par exemple `https://api.palgu.ai/v1/responses`, `https://openrouter.ai/api/v1/responses` ou `<your LiteLLM proxy>/v1/responses`) avec `gateway_key` ; avec `"chatgpt"` : OpenAI, sur votre propre connexion Codex | Le même brief, puis la propre boucle d'agent de Codex | Exécute le tour sur Codex. |

Le mod ne contacte aucun autre hôte. La passerelle est celle que vous configurez ; rien n'est envoyé à un tiers fixe.

### Programmes que ce plugin exécute

**Quels programmes :** trois, `palgu` (la CLI Palgu, seulement après `/palgu memory on` : `palgu memory index .` et `palgu memory status . --json`, tous deux en texte fixe), `claude` (Claude Code lui-même en mode sans interface, et une fois après `/palgu login` sous la forme `claude plugin configure mixture-of-models@mixture-of-models-claude-mod --values-stdin`, avec l'URL et la clé de la passerelle sur stdin, pour les enregistrer ; et lors de `/route update`, quand une version plus récente est publiée, `claude plugin marketplace update mixture-of-models-claude-mod` puis `claude plugin update mixture-of-models@mixture-of-models-claude-mod`) et `codex` (la CLI Codex, `codex exec`, uniquement pour les routes `codex`). Le plugin n'exécute aucun shell, aucun script fourni dans le dossier du plugin, aucun lanceur de paquets ni aucun autre exécutable.

**Pourquoi :** un mod peut renommer le modèle d'une requête mais ne peut pas changer le point de terminaison ni les identifiants de la session dans laquelle il s'exécute. La seule façon d'exécuter un tour sur un autre point de terminaison avec les propres outils de Claude Code, tout en laissant intacts le point de terminaison et les identifiants de la session principale, est un second processus Claude Code dont l'environnement pointe vers la passerelle. L'enfant n'existe que pour cette raison, et uniquement pour les tours que le score éloigne de la session principale. Le même raisonnement couvre un autre modèle Claude (la session principale n'est jamais renommée, donc un autre membre s'exécute dans son propre processus) et Codex (une autre CLI d'agent, qui ne s'exécute que comme son propre processus).

**Comment :** quatre appels `$.process.run` dans `turn.step`, une première exécution et une exécution reprise pour chaque programme, chacun avec le nom de son programme et ses options fixes en texte littéral à l'endroit de l'appel : `claude` et `codex`. Les valeurs dynamiques sont vérifiées d'abord (voir [Programmes exécutés par le plugin](#programmes-exécutés-par-le-plugin)). Les arguments de `claude` pour une route de passerelle :

```
claude -p --model <routed model id> --output-format stream-json --verbose --max-turns <child.maxTurns> --add-dir <session cwd> --bare --permission-mode acceptEdits
```

Pour une route `claude/<member>`, le même programme s'exécute avec `--model <member id>` et `child.subscriptionArgs` (`--permission-mode acceptEdits`) à la place de `child.args`, donc sans `--bare`, et son environnement est `MAGGY_ROUTER_CHILD=1` plus `ANTHROPIC_BASE_URL` mis à vide, de sorte qu'il tourne sur votre connexion Claude.

Pour une route `codex`, le programme est `codex`, avec les arguments indiqués sous [Codex en processus enfant](#codex-en-processus-enfant) (et, seulement après que vous avez approuvé une commande refusée, `exec -C <cwd> resume … <thread> -` comme décrit là-bas), le brief sur stdin, l'environnement `MAGGY_ROUTER_CHILD=1` plus, sur le chemin de la passerelle uniquement, la clé dans `PALGU_API_KEY` (`OPENROUTER_API_KEY` sur OpenRouter, `LITELLM_API_KEY` sur LiteLLM), et le même `child.timeoutMs`.

Pour les enfants de passerelle et membres Claude, et seulement après que vous avez approuvé une commande relayée (voir ci-dessous), le même programme s'exécute à nouveau avec `--resume <that child's session id> --allowedTools <the approved patterns>` ajouté, pour que le même enfant continue. `--bare` tient vos hooks, plugins et trousseau à l'écart de l'enfant. `child.args` remplace les trois dernières options si vous le définissez. L'environnement de l'enfant de passerelle ajoute `ANTHROPIC_BASE_URL`, la clé dans `ANTHROPIC_API_KEY` avec `ANTHROPIC_AUTH_TOKEN` vide (Palgu, générique) ou dans `ANTHROPIC_AUTH_TOKEN` avec `ANTHROPIC_API_KEY` vide (OpenRouter, LiteLLM), `ANTHROPIC_CUSTOM_HEADERS` (ci-dessous), `CLAUDE_CODE_MAX_RETRIES` (`child.maxRetries`) et `MAGGY_ROUTER_CHILD=1` ; les enfants membres Claude et Codex ne reçoivent pas d'en-têtes d'identification. Le brief est écrit sur son stdin. Il s'exécute dans le répertoire de travail de la session avec les outils de Claude Code sous ce mode de permission, il peut donc y lire et modifier des fichiers et exécuter les commandes que le mode autorise ; ces commandes sont les propres décisions d'agent de l'enfant, régies par le système de permissions de Claude Code, et non des commandes émises par ce plugin. Il est arrêté au bout de `child.timeoutMs`.

### En-têtes envoyés par l'enfant

Chaque requête de l'enfant vers une passerelle Palgu ou générique porte deux en-têtes, pour que le tableau de bord de Palgu puisse afficher son trafic comme Mixture-of-Models, par projet. Sur OpenRouter et LiteLLM, qui ne les lisent pas, ils sont omis et seuls vos propres `ANTHROPIC_CUSTOM_HEADERS` sont envoyés :

```
x-srooter-client: mixture-of-models/0.16.0
x-srooter-project: <the session folder's name>
```

Le projet est le dernier segment du répertoire de travail de la session, transformé en slug comme le fait la détection de projet de la passerelle : tout ce qui sort de `[A-Za-z0-9._-]` devient `-`, les `-._` de début et de fin sont supprimés, 64 caractères au plus, en minuscules (`/Users/me/My App` → `my-app`). Quand il ne reste rien d'utilisable, l'en-tête est omis. Aucun des deux en-têtes ne contient de chemin, de texte de prompt ou quoi que ce soit d'autre.

Ils vont dans le `ANTHROPIC_CUSTOM_HEADERS` de l'enfant (la liste `Name: value` séparée par des retours à la ligne de Claude Code), défini au même endroit que `ANTHROPIC_BASE_URL` : pas de passerelle configurée, pas d'en-têtes, et l'enfant ne parle qu'à cette passerelle. Si vous définissez déjà `ANTHROPIC_CUSTOM_HEADERS`, vos lignes viennent en premier et sont conservées ; un `x-srooter-client` ou `x-srooter-project` de votre cru l'emporte sur celui du mod. Les requêtes de la session principale ne changent pas.

Un enfant avec un modèle routé envoie aussi `x-srooter-pin: <model>`, pour que Palgu serve exactement ce modèle, et `x-palgu-fallback: auto`, pour qu'en cas de surcharge la passerelle puisse confier une requête épinglée à un modèle équivalent au lieu de la faire échouer. Un `x-palgu-fallback` à vous dans `ANTHROPIC_CUSTOM_HEADERS` l'emporte.

### Fichiers et environnement lus

- `~/.claude/model-config.json`, via `$.fs.read`, pour les routes, les seuils, l'alias du classifieur et les paramètres de l'enfant. Il ne contient aucun identifiant. S'il manque ou est invalide, les valeurs par défaut s'appliquent.
- `~/.claude/mixture-of-models/strategies/*.md`, via `$.fs.list` et `$.fs.read`, pour vos stratégies de routage, au démarrage de la session et lors de `/route strategy` ou `/route strategies`.
- Les variables d'environnement `HOME`, `HOSTNAME` (pour le nom d'appareil Palgu), `MAGGY_ROUTER_CHILD` et `ANTHROPIC_CUSTOM_HEADERS` (pour conserver vos propres en-têtes personnalisés dans l'enfant), via `$.env.get`.
- Rien d'autre. La clé de la passerelle n'est jamais lue depuis un fichier ou depuis l'environnement ; elle provient uniquement de l'option `gateway_key` du plugin, que Claude Code conserve dans son stockage sécurisé.

### Ce qu'il stocke

Dans le propre stockage du plugin (`$.store`, sous `~/.claude/plugins/store/`) : un identifiant d'installation aléatoire pour la connexion à Palgu (`palgu-install-id`, pour que Palgu voie un seul appareil d'une connexion à l'autre), les dossiers de projet où la mémoire Palgu est activée et la date de leur dernière indexation (le chemin de leur dossier), la dernière liste de modèles servie par Palgu, l'épingle `/route`, les compteurs par jour et par modèle, le dernier verdict, les compteurs d'échecs par type, la dernière vérification de mise à jour (quand, la version listée par GitHub et la version qui vous a été signalée), et un journal des 200 dernières décisions (jour, modèle, type, palier, score, source du classifieur, durée de l'enfant et code de sortie). Aucun texte de prompt, aucune réponse, aucun identifiant.

### Ce qu'il ne fait jamais

Il n'écrit jamais dans les fichiers de paramètres, dans `model-config.json` ni dans `~/.codex`, ne change jamais le modèle, le point de terminaison ni les identifiants de la session principale, ne gère jamais les appels d'outils, et n'envoie jamais de données ailleurs qu'aux hôtes listés ci-dessus : les deux destinations du classifieur, Palgu et GitHub pour les commandes qui les nomment, et la passerelle que vous avez configurée.

## Configuration

Le mod lit la source de vérité unique de Maggy, `~/.claude/model-config.json`, et y ajoute un bloc `router` facultatif. Il n'écrit jamais dans ce fichier.

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

Une config qui place chaque palier sur un membre Claude, avec Fable pour les tours les plus difficiles et Codex pour les revues :

```json
{ "router": {
    "routes":   { "simple": "claude/auto", "coding": "claude/auto", "critical": "claude/auto", "kinds": { "review": "codex" } },
    "families": { "claude": { "auto": { "criticalPlus": "fable" } } } } }
```

- `routes` : palier → identifiant de modèle servi par la passerelle, plus `routes.kinds` : type → modèle pour les paliers non critiques. `"claude"` désigne la session principale.
- `primary` (le modèle suivi par Maggy, défini avec `/model-config`) : `glm`, `kimi` ou `deepseek` fait suivre ce modèle au palier `coding`, sauf si `routes.coding` est défini. `primary: claude` ne change rien : `critical` est déjà sur Claude, et `coding` reste bon marché sauf si vous mettez `routes.coding` à `"claude"`.
- `thresholds` : les seuils du score d'impact, `{ "simple": 3, "coding": 7 }` par défaut.
- `subagents` : pour quels sous-agents intégrés le mod choisit un modèle Claude, par type d'agent : `auto` note la tâche, `simple`, `coding` ou `critical` fixe le niveau, `off` (ou un type non nommé) laisse faire Claude Code. Par défaut `{ "general-purpose": "auto", "Explore": "simple" }`.
- `subagentModels` : le modèle Claude par niveau pour ces sous-agents, `{ "simple": "haiku", "coding": "sonnet" }` par défaut ; critique garde le modèle du parent, et un modèle qui n'est pas moins cher que celui du parent n'est jamais fixé.
- `classifier` : le modèle Claude utilisé quand Ollama est injoignable. Alias non datés uniquement (`claude-haiku-5-5`, `claude-sonnet-5`, `claude-opus-5`).
- `provider` : le fournisseur de la passerelle quand l'option `gateway_provider` du plugin n'est pas définie ou vaut `auto` : `palgu`, `openrouter`, `litellm` ou `anthropic-compatible`. Non défini, il est détecté d'après l'URL de la passerelle (voir [Mise en place](#mise-en-place)). Il choisit les `routes` et `families` par défaut, les boutons du bandeau et l'authentification de l'enfant ; tout ce que vous définissez dans `routes` ou `families` l'emporte quand même.
- `child.baseUrl` : valeur de repli pour l'URL de la passerelle quand l'option `gateway_url` du plugin n'est pas définie. La clé n'a pas de repli ; elle provient uniquement de l'option `gateway_key`.
- `child.auth` : `x-api-key` (`ANTHROPIC_API_KEY`) ou `bearer` (`ANTHROPIC_AUTH_TOKEN`), défini d'après le fournisseur ; définissez-le vous-même pour une passerelle générique qui veut un token bearer. `child.identify` : envoyer les en-têtes `x-srooter-*` (activé pour Palgu et les passerelles génériques).
- `child.args` : options supplémentaires. Par défaut `--bare` (pas de hooks ni de plugins hérités, authentification par clé d'API uniquement, de sorte que l'enfant ne peut jamais se replier sur votre abonnement) plus `acceptEdits` pour qu'il puisse modifier des fichiers sans demander. Le mod ajoute toujours `--add-dir <cwd>`, qui garde le `CLAUDE.md` du projet accessible sous `--bare`. N'ajoutez `--dangerously-skip-permissions` que si vous voulez que l'enfant exécute des commandes sans surveillance ; retirez `--bare` si vous voulez vos hooks et plugins dans l'enfant.
- `child.maxTurns`, `timeoutMs` : le budget agentique de l'enfant. `timeoutMs` est plafonné à dix minutes, la limite de `$.process.run`.
- `child.maxRetries` : combien de fois l'enfant de la passerelle relance une requête qui a échoué avec un 429 ou un 5xx (par défaut 2 ; la valeur par défaut de Claude Code est 10, ce qui prenait des minutes face à un fournisseur surchargé). Augmentez-la si votre passerelle a de courtes coupures que vous préférez attendre plutôt que de basculer sur le repli.
- `child.fallbacks` : combien de modèles équivalents le mod essaie lui-même après l'échec d'un enfant de passerelle, avant que le modèle principal ne reprenne le tour (3 par défaut ; 0 le désactive). Sur Palgu, la même classe d'abord, puis les autres modèles en bonne santé. Voir « Quand un enfant échoue » plus haut.
- `child.longContext` : les modèles de passerelle vers lesquels passe un prompt trop long pour le modèle routé. Vide par défaut : les modèles en bonne santé dont la fenêtre de contexte, selon la liste en direct de Palgu, est plus grande que celle du modèle en échec, la plus grande d'abord. Sans Palgu, définissez-la vous-même, sinon un prompt trop long va au modèle principal.
- `child.contextMessages` : combien d'échanges récents vont dans le brief.
- `child.relayRounds` : combien de fois un tour routé peut s'interrompre pour vous interroger sur des commandes refusées à l'enfant (par défaut 2).
- `child.deny` : règles supplémentaires de refus de permissions Claude Code pour chaque enfant Claude, passées avec `--disallowedTools` après `child.args`. Elles s'ajoutent à la liste intégrée (`.env`, `.env.*`, `*.pem`, `*.key`, `id_rsa*`, `id_ed25519*`, `secrets/**`), que rien ne supprime, car `--bare` ignore les hooks qui protégeraient sinon ces fichiers.
- `child.subscriptionArgs` : les options d'un enfant `claude/<member>`, à la place de `child.args`. Pas de `--bare` par défaut, car `--bare` n'autorise que l'authentification par clé d'API et le but est d'utiliser votre connexion Claude.
- `families` : par famille, `members` (alias → identifiant exact du modèle) et `auto` (palier → alias de membre, plus `criticalPlus` facultatif pour les tours critiques à 10/10). Fusionné par famille par-dessus les valeurs par défaut ; un nouveau nom de famille ajoute une famille de passerelle.
- `codex.auth` : `palgu` (par défaut ; le `/v1/responses` de votre passerelle configurée avec votre clé de passerelle, quel que soit le fournisseur) ou `chatgpt` (votre propre connexion Codex). `codex.baseUrl` : l'URL de base Responses si ce n'est pas celle qui est dérivée (Palgu : `/anthropic` → `/v1` ; OpenRouter et LiteLLM : `<gateway_url>/v1`). `codex.sandbox` : `read-only` (par défaut), `workspace-write` ou `danger-full-access`, voir [Sandbox et approbations](#sandbox-et-approbations). `codex.allowOutsideGit` : ajouter `--skip-git-repo-check` (par défaut `false`). `codex.args` : options supplémentaires ; les options de sandbox et d'approbation qui s'y trouvent sont ignorées.
- `strategy` : la stratégie de routage de départ, une stratégie intégrée (`complexity`, `cost`, `speed`, `quality`) ou le nom d'un de vos fichiers ; un choix fait avec `/route strategy` l'emporte. Voir [Stratégies de routage](#stratégies-de-routage--router-selon-la-complexité-le-coût-la-vitesse-la-qualité-ou-vos-propres-règles).
- `prices` : $ par million de tokens pour les modèles de la passerelle, pour l'[estimation des économies](#combien-il-fait-économiser), par exemple `{ "glm-5.3": { "input": 0.6, "output": 2.2 } }` (`cacheRead` facultatif, par défaut un dixième de l'entrée, et `cacheWrite`). Une entrée ici l'emporte sur le propre devis de Palgu. Un modèle sans prix sur une passerelle qui n'est pas Palgu est compté comme non chiffré.
- `heartbeat` : poursuivre la session principale quand elle s'arrête en pleine tâche. `palgu` (par défaut : Palgu décide quand c'est votre passerelle ; sinon, ou quand Palgu ne répond pas, le même classifieur tourne en local), `local` (ne demande jamais à Palgu) ou `off`. `heartbeatMax` : nombre de continuations par prompt de votre part (par défaut 3).
- `ui.band` : dessiner le bandeau au-dessus du prompt (par défaut `true`). `ui.tags` : quelles réponses reçoivent l'étiquette de provenance, `routed` (par défaut), `all` ou `off`.

## Commandes

| Commande | Effet |
| :- | :- |
| `/palgu login` | Créer un compte ou se connecter à Palgu depuis le terminal : approuvez un code dans le navigateur, et le mod enregistre sa clé Palgu et route aussitôt |
| `/palgu status` | À qui appartient la clé et l'offre de l'organisation |
| `/palgu upgrade` | La page des offres et de la facturation Palgu |
| `/palgu continue [--open]` | Poursuivre cette session dans Palgu avec tout son contexte : copie `cd <folder> && palgu --continue-claude=<session id>` ; `--open` la lance dans un nouvel onglet du Terminal macOS. Palgu lit lui-même la transcription et masque les identifiants |
| `/palgu memory on`, `off`, `memory` | Indexer ce projet dans la mémoire Palgu en arrière-plan avec la CLI `palgu` (envoie son code source ; désactivé par défaut) et le rappeler dans chaque prompt, pour Claude et pour chaque modèle routé ; arrêter ; ou indiquer s'il est indexé et à quel point l'index est à jour |
| `/route update` | Chercher sur GitHub une version plus récente et, s'il y en a une, lancer `claude plugin marketplace update` et `claude plugin update` pour vous ; ensuite `/reload-plugins` la charge |
| `/route models` | Les modèles que Palgu sert en ce moment et ceux qui sont indisponibles ; chacun peut être épinglé avec `/route <model>`. Le bandeau garde un bouton par famille connue du mod. Sans Palgu (ou quand il ne répond pas), la liste intégrée est utilisée |
| `/route strategies`, `/route strategy <name>` | Lister les stratégies de routage (complexity, cost, speed, quality et les vôtres) ou passer à l'une d'elles |
| `/route help` (ou `0` sur le bandeau) | Ce que fait le mod, où il en est, chaque bouton et chaque commande, et comment connecter un fournisseur |
| `/route`, `/route status` | Actif ou en observation seule, mode, décision actuelle (avec famille et membre), compteurs du jour, les familles et leurs membres |
| `/route auto` | Classer chaque prompt (par défaut) |
| `/route off` | Ne jamais démarrer d'enfant |
| `/route simple\|coding\|critical` | Épingler un palier |
| `/route reset` | Effacer la mémoire des échecs par type |
| `/route stats` | Ouvrir le panneau de statistiques : models, kinds, scores, recent |
| `/route usage` (`today`, `week`, `month`, `all`) | Quels modèles ont répondu à vos tours et fait tourner vos sous-agents sur la période (par défaut : les 7 derniers jours) |
| `/route stats reset` | Recommencer dès maintenant les compteurs de modèles, le journal des décisions, les économies et les compteurs de sous-agents ; votre route, votre épinglage et vos réglages restent |
| `/route glm`, `/route kimi`, `/route kimi-k3.1-pro`, `/route minimax`, `/route gpt`, `/route claude` | Épingler un modèle (un préfixe se développe vers le modèle configuré, puis vers un modèle connu de la passerelle ; un mot qui ne correspond à aucun modèle, comme `/route upgrade`, passe en auto au lieu d'être épinglé) |
| `/route claude/sonnet`, `/route kimi/highspeed`, `/route codex/gpt-5.6-terra` | Épingler un membre de famille (`claude/sonnet` s'exécute sur votre connexion Claude) |
| `/route claude/auto`, `/route kimi/auto`, `/route codex/auto` | Épingler une famille ; chaque prompt est toujours évalué et le palier choisit le membre |
| `/route codex` | Épingler Codex sur son modèle par défaut |

`/status` est la propre commande de Claude Code et un mod ne peut rien y ajouter ; `/route status` est l'équivalent du mod, et la ligne de route sous chaque réponse nomme la famille et le membre (`route: claude-sonnet-5-5 (claude/auto → sonnet) · coding 5/10 code via ollama · child 9s`).

Les épingles persistent d'une session à l'autre dans le stockage du plugin.

## Ce que l'enfant peut et ne peut pas faire

- Il dispose des outils de Claude Code et s'exécute dans le répertoire de travail de la session, il peut donc lire, modifier et exécuter des choses. Ses appels d'outils ne sont pas affichés dans la transcription principale, seulement son texte final.
- Quand il a besoin d'une commande que son mode de permission n'autorise pas (`git pull`, `npm install`, un déploiement), il ne peut pas vous la demander lui-même. Le mod relaie la demande : vous obtenez la boîte de dialogue de question de Claude Code nommant la commande exacte, et « Allow and continue » reprend le même enfant avec seulement cette commande autorisée. Les commandes en lecture seule comme `git status` ou `git log` s'exécutent déjà sans demander.
- Il ne partage pas la mémoire de la session principale. Le brief contient les `contextMessages` derniers échanges (12 par défaut, chacun tronqué à 1 200 caractères) et la tâche. C'est pourquoi les relances ne vont jamais à un enfant : voir [Comment il décide](#comment-il-décide).
- Il s'exécute en `--bare` par défaut, donc vos hooks et plugins restent en dehors, y compris tout hook qui protège des secrets. Il ne peut pas lire les fichiers `.env`, les clés ou les dossiers `secrets/` : le mod passe des règles de refus de permissions pour eux (`child.deny` en ajoute d'autres), et celles-ci sont appliquées par Claude Code lui-même, pas par un hook. Le mod détecte aussi le marqueur `MAGGY_ROUTER_CHILD` et ne fait rien dans un enfant.
- L'étiquette et la ligne de route nomment le modèle que le mod a **demandé**. Une passerelle qui route selon l'intention, comme le fait palgu, peut répondre avec un autre modèle ; la sortie `-p` de Claude Code n'indique pas lequel, le mod ne peut donc pas l'afficher.
- La sortie arrive quand l'enfant a terminé ; cette version utilise `$.process.run`, donc une réponse routée n'est pas diffusée token par token.

## Changelog

Chaque version a une section datée dans [CHANGELOG.md](../../../CHANGELOG.md), écrite dans le même commit que le changement. La CI échoue si la version de `plugin.json` n'a pas d'entrée (`npm run changelog`).

## Tests

```bash
npm test                           # tests de fonctions pures sous Node, sans Claude Code
claude plugin validate --strict .  # manifeste + analyse statique du module de hooks
claude plugin test                 # nécessite v2.1.287+ ; déclenche des événements à travers les hooks sans session ni réseau
```

`tests/classify`, `config`, `providers`, `routing`, `families`, `codex`, `stats`, `child` et `ui` couvrent la logique pure de `hooks/lib/`. `tests/mod.test.ts` pilote les hooks de bout en bout : un prompt simple reçoit la réponse d'un enfant avec la passerelle dans son environnement et le brief sur stdin, un prompt critique n'en démarre jamais, un enfant en échec se replie sur le modèle principal, une clé absente signifie observation seule, une session enfant désactive le mod, et `/route off` et `/route kimi` se comportent correctement. `tests/compliance.test.ts` vérifie ce qui atteint `$.process.run` : le programme et les options littéraux, un identifiant de modèle refusé, les deux commandes de mise à jour fixes, et une clé Palgu qui n'est pas un unique token simple.

## Organisation du dépôt

```
mixture-of-models-claude-mod/
├── .claude-plugin/
│   ├── plugin.json         # le manifeste du plugin
│   └── marketplace.json    # permet à `claude plugin install` de le trouver dans ce dépôt
├── docs/adr/               # décisions d'architecture (0001 : délégation par processus enfant, 0002 : familles et Codex, 0003 : fournisseurs de passerelle)
├── scripts/test-pure.mjs   # exécute les tests purs sous Node
├── hooks/
│   ├── hooks.json          # pointe vers register.js
│   ├── register.js         # les 12 enregistrements de hooks ; le seul fichier qui touche l'API des mods ($)
│   └── lib/                # pur, testé unitairement
│       ├── config.js       # valeurs par défaut et surcouche model-config.json
│       ├── providers.js    # Palgu, OpenRouter, LiteLLM, générique : détection, authentification de l'enfant, catalogues
│       ├── classify.js     # règles de pré-routage de Maggy, prompt du classifieur, format d'échange Ollama
│       ├── routing.js      # palier → modèle, grammaire de /route, ligne de résumé
│       ├── families.js     # <family>/<member>, <family>/auto, quel exécuteur sert une route
│       ├── codex.js        # argv, env, disponibilité et sortie JSONL de codex exec
│       ├── child.js        # argv de l'enfant, env restreint et en-têtes d'identification, disponibilité, lecture de fichiers env, le brief et son préambule
│       ├── version.js      # la version du mod, pour x-srooter-client
│       ├── vet.js          # écarte les renvois, les demandes d'action, les affirmations non vérifiées, la narration, les répétitions
│       └── stats.js        # compteurs par jour
└── tests/
```

Les mods exigent que chaque appel `$` se trouve dans `register.js` (un `$` passé à un autre fichier fait échouer `claude plugin validate`), c'est pourquoi ce fichier contient plus de fonctions que la limite habituelle.

## Pourquoi un processus enfant

Voir [ADR 0001](../../adr/0001-child-process-delegation.md). En bref : un mod peut renommer le modèle d'une requête mais pas changer sa destination, et faire passer le token d'abonnement par un proxy a été rejeté. Un processus enfant avec son propre environnement est la séparation propre.

## Correspondance avec Maggy

| Maggy | Ici |
| :- | :- |
| `hooks/route-task-hook` (UserPromptSubmit, classifieur qwen3, garde de continuation, cache) | `prompt.submit` + `lib/classify.js`, `$.http.fetch` vers Ollama, cache `$.store` |
| « You MUST delegate — run ~/bin/glm » injecté dans le contexte | `turn.step` exécute l'enfant et renvoie sa réponse ; on ne demande jamais à Claude de déléguer |
| lanceurs `~/bin/claude-<provider>` issus de `model_routing.py write-launcher` | le mod restreint lui-même `ANTHROPIC_BASE_URL` et la clé à l'environnement de l'enfant |
| `hooks/usage-summary-hook` (Stop) | `turn.complete` renvoie la ligne de résumé |
| modèle suivi par `/model-config` | `primary` dans `model-config.json` pilote le palier `coding` |
| passerelle `palgu` | le point de terminaison de l'enfant ; la session principale ne la voit jamais |

Testé avec Claude Code 2.1.274 pour `claude plugin validate` uniquement ; les types utilisés proviennent des déclarations de 2.1.277. Vérifiez `.claude-plugin/types/` après le premier chargement sur une version plus récente, en particulier si `$.process.spawn` est disponible pour diffuser la sortie de l'enfant.
