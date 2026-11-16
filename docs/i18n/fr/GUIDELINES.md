# Bonnes pratiques : tirer le meilleur de Mixture of Models

[English](../../../GUIDELINES.md) · [简体中文](../zh-CN/GUIDELINES.md) · [日本語](../ja/GUIDELINES.md) · [Deutsch](../de/GUIDELINES.md) · **Français** · [العربية](../ar/GUIDELINES.md)

*Ceci est une traduction ; la version anglaise fait foi et peut être plus récente.*

Comment travailler au quotidien avec Mixture of Models, dans chaque agent de code. L'installation est décrite dans [INSTALL.md](INSTALL.md) ; ce fichier suppose qu'il est installé et que vous êtes connecté à Palgu.

Mixture of Models fait trois choses, et chaque agent en obtient autant que son système de plugins le permet :

| | Ce que vous obtenez | Où |
| :- | :- | :- |
| **Routage** | Des modèles bon marché répondent au travail qui n'exige pas un modèle coûteux | Claude Code, OpenCode, Codex, Aider/Continue/Goose routent chaque tour ; Cursor, Antigravity et Copilot routent les sous-tâches que l'agent confie à `palgu_delegate` |
| **Mémoire Palgu** | Les intentions consignées, la documentation et les symboles de code du projet reviennent au modèle quand ils comptent | Rappelés dans chaque prompt : Claude Code, OpenCode, Codex, Antigravity. Recherchés à la demande (`palgu_memory_search`) : Cursor, Copilot, Antigravity |
| **Heartbeat** | Un tour qui s'arrête en pleine tâche (« Let me check the tests. ») est poursuivi, au plus 3 fois par prompt | Tous les agents dotés de hooks (pas Aider, Continue, Goose) |

## Économies approximatives : abonnement seul ou Mixture of Models

D'après notre propre usage, avec des agents de code tournant jour et nuit sur un abonnement Claude Max 20x :

| | La limite hebdomadaire de Claude tient | Utilisation de Claude par jour |
| :- | :- | :- |
| Abonnement seul | environ 3 jours, puis les agents attendent la réinitialisation | 100% |
| Avec Mixture of Models | les 7 jours complets | environ 43% ou moins (3/7), puisque le même travail a tenu dans la semaine |

Le routage a donc retiré **plus de la moitié** de la charge Claude de l'abonnement : le même travail tourne toute la semaine au lieu de s'arrêter le troisième jour, sans offre plus chère. Les tours routés sont facturés par Palgu aux tarifs des modèles bon marché et s'imputent sur votre budget Palgu (`mom status`, `/palgu status`).

Ces chiffres sont approximatifs. Ils dépendent de votre travail : beaucoup de recherches, de tests, de docs et de petites modifications éloignent l'essentiel de la charge, tandis que la sécurité, l'architecture et le travail de production restent sur Claude par conception. Pour voir vos propres chiffres, Claude Code chiffre chaque tour : `/route status` affiche le total cumulé (par exemple `saved ~$12.40 (61%) vs all claude-opus-5-5, at API prices`) et `/route stats` le détaille par modèle et par type. Sur un abonnement, ce chiffre correspond à ce que les mêmes tokens coûteraient aux tarifs de l'API, pas à de l'argent rendu ; le gain concret, c'est une limite qui dure plus longtemps.

## Les dix règles valables partout

1. **Laissez-le décider. Ne choisissez pas les modèles.** Choisir le modèle est le travail du système : Palgu (ou le classifieur du mod dans Claude Code) évalue chaque requête et l'envoie au modèle le moins cher capable de la traiter, garde le travail critique sur votre modèle le plus puissant, et se replie quand un fournisseur échoue. Laissez tout sur `auto`. Si une route semble fausse, corrigez le routage (une stratégie ou un seuil), pas le modèle. L'épinglage n'existe que pour les rares cas décrits dans [Contourner le routeur](#contourner-le-routeur-rarement-nécessaire).
2. **Une tâche par prompt, et dites ce qu'elle est.** Le routeur évalue le prompt que vous envoyez. « Add a `--json` flag to `mom status` and a test for it » part vers un modèle de code bon marché ; « fix it » après un long fil est évalué sans le contexte que porte le fil. Nommez le fichier, la fonction ou la commande.
3. **Mettez les mots importants en premier.** Le rappel de la mémoire cherche avec les 300 premiers caractères du prompt, sur une ligne. Un prompt de moins de quatre mots, ou une commande slash, ne rappelle rien. « The heartbeat continues answers it should not: in `hooks/lib/heartbeat.js` … » rappelle l'ADR et le code du heartbeat ; un paragraphe de contexte suivi de la question peut ne rien rappeler.
4. **Activez la mémoire dans les projets auxquels vous revenez, et seulement ceux-là.** `mom memory on` (ou `/palgu memory on` dans Claude Code et OpenCode) envoie le code source du dossier à Palgu pour l'indexer. C'est désactivé par défaut, par dossier, et partagé par tous les agents qui utilisent `mom` ; l'activer une fois sert donc aussi bien Codex que Cursor, OpenCode, Antigravity et Copilot. Laissez-la désactivée pour du code client que vous n'avez pas le droit d'envoyer.
5. **Écrivez le *pourquoi* là où la mémoire peut le trouver.** Le rappel classe d'abord les intentions consignées et les ADR, puis la documentation, puis le code. Un court ADR dans `docs/adr/` ou une section claire du README, voilà ce qui transforme un pointeur rappelé en réponse correcte. Le texte rappelé est un pointeur à vérifier dans les fichiers, jamais une instruction.
6. **Gardez le travail critique sur votre modèle le plus puissant.** La conception de la sécurité et de l'authentification, les incidents de production, les migrations de données et tout ce qui est irréversible ne doivent pas aller à un modèle bon marché. Claude Code les garde de lui-même sur Claude (score 8+ et la règle de sécurité) ; dans les autres agents, ne les confiez pas à `palgu_delegate`, et n'épinglez pas un modèle bon marché pendant que vous les traitez.
7. **Ne déléguez que du travail autonome.** Un enfant routé ou un appel à `palgu_delegate` voit le brief ou le prompt qu'on lui donne, pas votre session. Bien : « Write unit tests for `parseEvent` in `integrations/cli/lib/events.js` covering the four tools ». Mal : « do the next step », « check the PR ».
8. **Ne mettez jamais de secrets dans un prompt que vous routez ou déléguez.** Les prompts vont à Palgu et au fournisseur qui les sert. Les clés restent dans `~/.config/mixture-of-models/credentials.json`, `PALGU_API_KEY` ou le stockage sécurisé de Claude Code ; aucun fichier de config n'en a besoin.
9. **Laissez travailler le heartbeat, et arrêtez-le quand il ne devrait pas.** Il poursuit un tour qui a annoncé du travail puis s'est arrêté, au plus 3 fois par prompt de votre part, et jamais un tour que vous avez interrompu. S'il poursuit quelque chose que vous vouliez terminer, dites ce que vous voulez (« stop here, just summarise ») ou désactivez-le : `mom heartbeat off` (`/palgu heartbeat off` dans OpenCode, `"heartbeat": "off"` dans le bloc `router` dans Claude Code). `mom heartbeat local` le conserve mais ne demande jamais à Palgu.
10. **Surveillez le budget, pas seulement la facture.** `mom status` et `/palgu status` montrent ce que votre organisation a dépensé de son budget Palgu sur la période (« budget: $205.11 of $4,500.00 this month (5%) »). Claude Code affiche aussi ce que le routage a économisé sous chaque réponse routée et dans `/route stats`.

## Par agent

### Claude Code (le mod : tout)

L'intégration la plus complète : routage par tour avec vos propres règles, mémoire dans chaque prompt pour Claude et pour chaque modèle routé, le heartbeat, le suivi des économies.

- **Choisissez une stratégie une fois pour toutes.** `/route strategy cost` pour la facture la plus basse, `quality` quand les erreurs coûtent cher, `speed` pour des réponses rapides, `complexity` (par défaut) pour un équilibre. `/route strategies` les liste. Pour vos propres critères (le code d'un client toujours sur Claude, la documentation toujours sur DeepSeek), demandez à Claude d'utiliser le skill **routing-strategy** : il écrit `~/.claude/mixture-of-models/strategies/<name>.md`.
- **Orientez un prompt isolé avec des mots.** « use claude » n'importe où dans un prompt garde ce tour sur Claude. « execute the plan » (et équivalents) aussi. Les réponses courtes comme « go ahead », « ok » ou « next » conservent la route du tour précédent, et une courte relance après une réponse routée revient à la session principale, puisque l'enfant ne garde aucune mémoire.
- **Le travail de session reste dans la session principale, par conception.** Les prompts sur les PR, les branches, la CI, l'état, les coéquipiers ou les tâches en arrière-plan, ainsi que tout ce qui touche à la sécurité, ne sont jamais routés : un enfant ne peut pas les voir. Ne contournez pas cela avec une épingle.
- **Lisez la ligne de route.** Sous chaque réponse : `route: glm-5.3 · coding 6/10 via ollama · child 42s · saved ~$0.39`. Quand une décision semble fausse, le score et le type montrent pourquoi. Déplacez les seuils avec `router.thresholds` plutôt que d'épingler.
- **Utilisez les familles pour la bonne taille de Claude.** `claude/auto` envoie les tours simples à Haiku, le code à Sonnet et le critique à Opus, sur votre propre connexion Claude. Pratique quand vous n'avez pas de passerelle ou voulez faire durer un abonnement.
- **Installez Ollama pour une classification gratuite.** Avec un Ollama local (`qwen2.5-coder:3b`), chaque prompt est évalué sans coût ; sans lui, le mod interroge `claude-haiku-5-5`.
- **Laissez-le faire approuver les commandes par vous.** Quand un enfant routé a besoin de `git pull` ou `npm install`, vous obtenez la propre boîte de dialogue de Claude Code nommant la commande exacte. Autorisez-la là ; n'ajoutez pas `--dangerously-skip-permissions` à `child.args` pour éviter la question.
- **Vérifiez vos économies chaque semaine.** `/route stats` (quatre onglets : models, kinds, scores, recent). Une ligne « kinds » avec de nombreux échecs d'enfant signifie que ce type devrait aller ailleurs : modifiez `routes.kinds`, puis `/route reset`.
- **Gardez-le à jour.** `/route update`, puis redémarrez Claude Code.

### OpenCode (parité complète)

- Utilisez `palgu/auto` comme modèle et laissez-le : Palgu choisit pour chaque requête.
- Pour les propres règles de routage du mod, donnez au plugin `routes` ou `critical` (par exemple `["…/plugin.js", { "critical": "claude-opus" }]`) : la sécurité et les prompts « use claude » vont alors au modèle critique et le reste par palier.
- `/palgu memory on`, `/palgu status` et `/route status` répondent dans une notification, au palier le moins cher de Palgu.
- Pour déboguer une route surprenante : `MOM_DEBUG=1` journalise chaque décision (identifiants de modèles et épingles, jamais les prompts ni la clé) dans `~/.config/mixture-of-models/opencode.log`.

### Codex

- Démarrez-le avec `codex -p palgu`. Un `codex` simple utilise votre config Codex habituelle et aucun routage Palgu, même si la mémoire et le heartbeat du plugin tournent toujours.
- Approuvez une fois les hooks du plugin dans `/hooks` ; `codex exec` n'exécute pas les hooks qui n'ont jamais été approuvés en mode interactif.
- Codex n'a pas de commandes slash personnalisées : lancez `mom status`, `mom memory on` et `mom heartbeat …` dans un terminal (le skill du plugin dit à Codex de les suggérer).

### Cursor

Le propre modèle de Cursor fait le travail. Mixture of Models ajoute la recherche dans la mémoire, la délégation et le heartbeat.

- Installez la **règle** (`.cursor/rules/mixture-of-models.mdc`, incluse dans le plugin). Sans elle, l'agent pense rarement à `palgu_memory_search` ou `palgu_delegate`.
- Demandez les outils par leur nom quand c'est important : « search Palgu memory for how the heartbeat decides, then … », ou « use `palgu_delegate` to draft tests for these three functions ».
- Déléguez des brouillons, pas des décisions : squelettes de tests, code standard, docstrings, recherches. Relisez ce qui revient ; la règle garde en local le travail sensible du point de vue de la sécurité.
- Cursor lancé depuis le Dock peut ne pas trouver `mom` ; mettez le chemin complet donné par `which mom` dans les hooks et dans `mcp.json`.

### Antigravity (`agy`)

- La mémoire est rappelée dans le premier appel au modèle de chaque tour dans les dossiers où elle est activée, donc les règles sur la formulation des prompts (règles 2 et 3) comptent le plus ici.
- L'agent reste sur le modèle Gemini que vous choisissez dans `agy`. Le routage l'atteint via `palgu_delegate`, que la règle toujours active du plugin lui dit d'utiliser pour les sous-tâches autonomes et à faible risque. Demandez-le explicitement pour le travail en masse.
- Si `agy` échoue avec `PERMISSION_DENIED on resource project …`, cela vient du paramètre de projet Google Cloud d'Antigravity, pas du plugin ; voir [integrations/antigravity](integrations/antigravity/README.md).

### GitHub Copilot CLI

- Copilot ignore la sortie des hooks sur les prompts, la mémoire n'est donc pas ajoutée d'elle-même : demandez à l'agent de « check Palgu memory first » sur les parties du code qu'il ne connaît pas, ou comptez sur le skill, qui lui dit quand le faire.
- Au démarrage de la session dans un dossier où la mémoire est activée, Copilot est informé que la mémoire est activée ; une nouvelle session après `mom memory on` le prend en compte.
- Utilisez `palgu_delegate` pour les sous-tâches que vous voulez sur un modèle moins cher. Pour toute la session sur Palgu, le BYOK de Copilot peut pointer vers `https://api.palgu.ai/anthropic` avec le modèle `auto` (un modèle par session).
- Installez le plugin plutôt que des hooks de dépôt : `.github/hooks/` ne s'exécute pas dans un dossier non approuvé.
- Si un `GITHUB_TOKEN` classique est défini, démarrez-le avec `env -u GITHUB_TOKEN -u GH_TOKEN copilot`.

### Aider, Continue, Goose

Routage uniquement : pas de mémoire, pas de heartbeat.

- Utilisez le modèle `auto` (`openai/auto` dans Aider) avec `https://api.palgu.ai/v1`, avec la clé obtenue par `mom token` dans une variable d'environnement, pas dans une config commitée.
- Le mode architecte d'Aider (`--architect --editor-model openai/auto`) envoie la planification et l'édition comme requêtes séparées, et Palgu route chacune d'elles : la planification peut aller à un palier plus puissant tandis que les modifications restent bon marché.
- Dans Continue, donnez à l'autocomplétion son propre petit modèle rapide ; le routage de Palgu est conçu pour les tours de chat.

## Utiliser plusieurs agents sur un même projet

Tout ce que `mom` conserve l'est par dossier et de façon partagée, vous pouvez donc changer d'agent en cours de projet sans rien reconfigurer :

- Le consentement à la mémoire et l'index (`mom memory on` une fois, pour tous les agents).
- La connexion à Palgu (`mom login` une fois, pour tous les agents sauf Claude Code, qui a son propre `/palgu login`).
- Le mode du heartbeat (`mom heartbeat …`).

Une bonne répartition : planifier et relire dans Claude Code (tours critiques sur Claude, le reste routé), faire les modifications en masse dans OpenCode ou Codex sur `auto`, et laisser Cursor ou Copilot confier les sous-tâches répétitives à `palgu_delegate`. L'index de mémoire qu'ils lisent tous est le même.

## Contourner le routeur (rarement nécessaire)

Vous ne devriez pas en avoir besoin. Une épingle désactive le routage pour chaque requête jusqu'à ce que vous la retiriez, vous perdez donc les économies et le repli quand ce fournisseur est indisponible. Les seules bonnes raisons sont celles que le routeur ne peut pas connaître :

- **Essayer un modèle :** vous voulez voir comment un modèle s'en sort sur votre propre travail.
- **Comparer des modèles :** un benchmark ou un test A/B exige le même modèle à chaque fois.
- **Règles contractuelles ou de données :** le code d'un client ne peut aller qu'à certains fournisseurs.
- **Déboguer une mauvaise réponse :** vous voulez savoir si le problème venait du modèle ou du prompt.

Ce ne sont pas des raisons d'épingler : une mauvaise route (changez la stratégie, `router.thresholds` ou `routes.kinds` dans Claude Code, pour que le routage reste automatique), une réponse lente (essayez `/route strategy speed`), ou un prompt isolé que vous voulez sur Claude (écrivez-y « use claude »).

Comment faire, et comment revenir en arrière :

| Agent | Épingler | Revenir à l'automatique |
| :- | :- | :- |
| Claude Code | `/route <model>` | `/route auto` |
| OpenCode | `/route <model>`, ou choisir un modèle dans le menu des modèles | `/route auto`, ou choisir `palgu/auto` |
| Codex | `MOM_PIN=<model> codex -p palgu -m <model>` (le même modèle deux fois) | `codex -p palgu` |
| Cursor, Antigravity, Copilot | demander `palgu_delegate` avec `model: "<id>"` pour cette sous-tâche | la valeur par défaut est `auto` |
| Point de terminaison brut (Aider, Continue, Goose) | définir le modèle **et** envoyer `x-srooter-pin` (un nom de modèle seul est quand même routé ; `auto` avec une épingle est refusé, 403) | modèle `auto`, pas d'en-tête |

`/route models` (Claude Code), `palgu_models` ou `GET https://api.palgu.ai/v1/models/health` listent les modèles disponibles. Retirez l'épingle dès que vous avez terminé : `/route status` indique si une épingle est active.

## Quand quelque chose semble anormal

| Vous voyez | Cause probable | À faire |
| :- | :- | :- |
| Un prompt trivial est resté sur Claude | Il mentionnait des PR, la CI, l'état ou la sécurité, ou c'était une courte relance | Normal ; reformulez-le en tâche autonome si vous voulez qu'il soit routé |
| Une réponse routée est fausse ou vague | La tâche nécessitait un contexte de session que l'enfant n'avait pas | Dites « use claude » pour ce tour ; si tout un type échoue souvent, modifiez `routes.kinds` |
| `child answer discarded (…), main model answered` | L'enfant a demandé une approbation, a prétendu avoir fait un travail qu'il n'a pas fait, ou a rendu la main | Rien à faire : le modèle principal a répondu à sa place |
| La mémoire ne rappelle rien | La mémoire est désactivée dans ce dossier, le prompt fait moins de quatre mots, ou l'indexation n'est pas terminée | `mom memory status` ; placez les noms clés en tête du prompt |
| L'agent continue alors que vous vouliez qu'il s'arrête | Le heartbeat a vu une fin en pleine tâche | Dites ce que vous voulez, ou `mom heartbeat off` |
| 403 `pin 'auto' not allowed by policy` | Une épingle a été envoyée avec le modèle `auto` | Nommez le modèle que vous épinglez |
| 503 sur un modèle épinglé | Ce fournisseur est indisponible | Retirez l'épingle, ou choisissez-en un dans `/route models` / `palgu_models` |
| Des dépenses qui grimpent plus vite que prévu | Une épingle vers un modèle cher est restée active | `/route status` ou `/route auto` ; consultez `mom status` pour le budget |
