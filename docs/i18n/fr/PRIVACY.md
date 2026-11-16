# Politique de confidentialité

[English](../../../PRIVACY.md) · [简体中文](../zh-CN/PRIVACY.md) · [日本語](../ja/PRIVACY.md) · [Deutsch](../de/PRIVACY.md) · **Français** · [العربية](../ar/PRIVACY.md)

*Ceci est une traduction ; la version anglaise fait foi et peut être plus récente.*

mixture-of-models est un plugin Claude Code qui s'exécute entièrement sur votre machine. Il n'y a aucun serveur exploité par l'auteur, aucun compte et aucune télémétrie.

## Ce que le plugin envoie, et à qui

- **À Palgu à `https://api.palgu.ai`**, uniquement quand vous lancez `/palgu` : pour `/palgu login`, le nom client `mixture-of-models`, un nom d'appareil (`Claude Code on <your HOSTNAME>`), la version du plugin et un identifiant d'installation aléatoire, puis le code de connexion émis par Palgu ; pour `/palgu status`, votre clé de passerelle, pour demander à Palgu à qui elle appartient, et seulement quand votre passerelle configurée est Palgu. La clé que renvoie Palgu est enregistrée par Claude Code dans son stockage sécurisé, via `claude plugin configure --values-stdin`, jamais sur une ligne de commande.
- **À Palgu à `https://api.palgu.ai/v1/pricing/quote`**, après un tour routé et uniquement quand votre passerelle configurée est Palgu : l'identifiant du modèle et les quatre nombres de tokens du tour, avec votre clé de passerelle, pour que Palgu puisse chiffrer le tour pour l'estimation des économies. Aucun texte de prompt ni de réponse.
- **À GitHub (`raw.githubusercontent.com`)**, au démarrage de session au plus toutes les 12 heures et quand vous lancez `/route update` : un simple GET du manifeste publié du plugin, pour lire la dernière version. Rien sur vous ni sur votre travail n'est envoyé.
- **À un Ollama local à `http://localhost:11434`**, s'il y en a un qui tourne : le texte de chaque prompt que vous soumettez, accompagné d'une grille d'évaluation, pour que le prompt puisse recevoir un score de 1 à 10. Rien ne quitte votre machine pour cela.
- **À Anthropic, via le propre client API de Claude Code et votre propre compte**, quand aucun Ollama ne répond : le même texte de prompt et la même grille, pour le même score. C'est le même canal que Claude Code utilise déjà pour votre session.
- **À la passerelle que vous configurez** (`gateway_url` : par exemple Palgu à `https://api.palgu.ai/anthropic`, OpenRouter à `https://openrouter.ai/api`, ou un proxy LiteLLM que vous faites tourner), via un processus Claude Code enfant authentifié avec la `gateway_key` que vous fournissez (en `x-api-key` pour Palgu et les passerelles génériques, en token `Authorization: Bearer` pour OpenRouter et LiteLLM) : pour les tours routés uniquement, votre prompt plus un bref résumé des derniers échanges de votre session (texte uniquement, tronqué), et ce que la propre boucle d'agent de cet enfant envoie pendant qu'il travaille. Le traitement de ces données par la passerelle relève de la politique de son opérateur, pas de ce plugin. Chaque requête de l'enfant porte aussi deux en-têtes qui l'identifient auprès de la passerelle : `x-srooter-client: mixture-of-models/<version>` (le nom et la version du plugin) et `x-srooter-project: <folder name>` (le dernier segment du répertoire de travail de la session, mis en minuscules et réduit à `a-z 0-9 . _ -`). Ils ne contiennent aucun chemin, aucun texte de prompt ni aucun autre contenu, et ne sont envoyés qu'à la passerelle configurée, et seulement quand c'est Palgu ou une passerelle générique compatible Anthropic : OpenRouter et LiteLLM ne les reçoivent pas. Si aucune passerelle n'est configurée, rien n'est envoyé et le plugin est en observation seule.

- **À Anthropic, sur votre propre connexion Claude**, uniquement pour les routes qui nomment un membre de la famille Claude (`claude/sonnet`, `claude/auto`, …) : un processus Claude Code enfant envoie le même brief, et ce que sa boucle d'agent envoie pendant qu'il travaille, via le même compte que votre session principale.
- **Au point de terminaison de Codex**, uniquement pour les routes `codex` : un processus enfant `codex exec` lit le même brief (votre prompt plus les échanges récents tronqués), peut lire les fichiers du répertoire de travail de la session (un dépôt git, sauf si vous définissez `codex.allowOutsideGit`) dans une sandbox en lecture seule sans réseau, ne peut y modifier des fichiers que si vous approuvez une commande qui lui a été refusée pour ce tour, ou si vous mettez vous-même `codex.sandbox` à `workspace-write`, et envoie ce dont sa boucle d'agent a besoin soit au point de terminaison `/v1/responses` de votre passerelle (avec `codex.auth: "palgu"`, la valeur par défaut, en utilisant votre `gateway_key`, transmise uniquement dans son environnement ; sur OpenRouter c'est `https://openrouter.ai/api/v1/responses`, sur LiteLLM le `/v1/responses` de votre proxy), soit à OpenAI (avec `codex.auth: "chatgpt"`, sur votre propre connexion Codex, sous la politique d'OpenAI). Codex peut conserver ses propres fichiers de session sous `~/.codex`, comme lorsque vous le lancez vous-même ; le plugin ne lit ni n'écrit jamais ce dossier.

Le plugin n'envoie rien à aucune autre partie, et rien à l'auteur.

## Ce que le plugin stocke

Dans le stockage de plugins de Claude Code, sur votre machine : un identifiant d'installation aléatoire utilisé pour la connexion à Palgu, votre réglage `/route`, les totaux cumulés d'économies (montants en dollars calculés à partir des tokens et nombres de tours), les compteurs par jour du modèle qui a répondu, le dernier verdict, les compteurs d'échecs par type, et un journal des 200 dernières décisions de routage (jour, modèle, type, palier, score, classifieur qui a répondu, durée de l'enfant et code de sortie). Le plugin ne stocke aucun texte de prompt, aucune réponse ni aucun identifiant. Votre clé de passerelle est stockée par Claude Code dans son stockage sécurisé en tant qu'option de plugin sensible.

## Ce que le plugin lit

`~/.claude/model-config.json` (paramètres de routage, aucun identifiant) et les variables d'environnement `HOME`, `HOSTNAME` (pour le nom d'appareil Palgu), `MAGGY_ROUTER_CHILD` et `ANTHROPIC_CUSTOM_HEADERS` (uniquement pour que les en-têtes personnalisés que vous définissez vous-même soient conservés dans les requêtes de l'enfant vers la passerelle).

## Mineurs

Le plugin n'est pas destiné aux personnes de moins de 18 ans.

## Contact

Ouvrez un ticket sur https://github.com/alinaqi/mixture-of-models-claude-mod/issues.
