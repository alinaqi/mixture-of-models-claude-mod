# Mixture of Models dans Aider, Continue et Goose

[English](../../../../../integrations/gateway/README.md) · [简体中文](../../../zh-CN/integrations/gateway/README.md) · [日本語](../../../ja/integrations/gateway/README.md) · [Deutsch](../../../de/integrations/gateway/README.md) · **Français** · [العربية](../../../ar/integrations/gateway/README.md)

*Ceci est une traduction ; la version anglaise fait foi et peut être plus récente.*

Ces agents n'ont ni hooks ni plugins que `mom` puisse utiliser, ils ne bénéficient donc que du routage de Palgu : faites-les pointer vers le point de terminaison compatible OpenAI de Palgu avec le modèle `auto`, et Palgu choisit le modèle pour chaque requête ([ADR 0005](../../../../adr/0005-other-coding-agents.md)). Le rappel de la mémoire Palgu et le heartbeat ne sont pas disponibles ici.

Chaque guide nécessite une clé Palgu. Avec `mom` installé (`npm install -g github:alinaqi/mixture-of-models-claude-mod`), faites `mom login` une fois, puis `mom token` l'affiche.

## Comment Palgu lit la requête

Vérifié sur `https://api.palgu.ai/v1/chat/completions` le 2026-11-16 :

| `model` | En-tête `x-srooter-pin` | Résultat |
| :- | :- | :- |
| `auto` | aucun | Palgu route (a servi `deepseek-pro` pour une réponse d'un mot) |
| n'importe quel modèle, p. ex. `glm-5.3` | aucun | Palgu route quand même : le champ model n'est pas une épingle |
| un modèle, p. ex. `kimi-k3.1-pro` | présent (nous envoyons le même identifiant de modèle) | ce modèle, épinglé |
| `auto` | présent | refusé, 403 `pin 'auto' not allowed by policy` |

Donc : laissez le modèle sur `auto` pour que Palgu choisisse ; pour épingler, définissez le modèle **et** envoyez `x-srooter-pin`. Un modèle épinglé indisponible répond 503 ; choisissez-en un autre dans `GET /v1/models/health`.

## Aider

Vérifié en conditions réelles avec aider-chat 0.86.2 : `model openai/auto` via Palgu a appliqué une modification à un fichier.

```bash
export OPENAI_API_KEY="$(mom token)"
aider --openai-api-base https://api.palgu.ai/v1 --model openai/auto
```

Ou dans `.aider.conf.yml` :

```yaml
openai-api-base: https://api.palgu.ai/v1
model: openai/auto
```

Nommez le client dans `.aider.model.settings.yml`, pour que le tableau de bord de Palgu affiche le trafic comme Mixture of Models :

```yaml
- name: aider/extra_params
  extra_params:
    extra_headers:
      x-srooter-client: mixture-of-models-aider/0.27.0
```

Aider ne connaît pas la fenêtre de contexte de `auto` et affiche un avertissement ; indiquez-la-lui dans `.aider.model.metadata.json` (ou passez `--no-show-model-warnings`) :

```json
{ "openai/auto": { "max_input_tokens": 200000, "max_output_tokens": 32000, "input_cost_per_token": 0, "output_cost_per_token": 0, "litellm_provider": "openai", "mode": "chat" } }
```

Pour épingler un modèle, ajoutez-lui une entrée avec l'en-tête, et utilisez `--model openai/<model>` :

```yaml
- name: openai/kimi-k3.1-pro
  extra_params:
    extra_headers:
      x-srooter-pin: kimi-k3.1-pro
```

Le mode architecte d'Aider (`--architect --editor-model openai/auto`) envoie la planification et l'édition comme requêtes séparées, que Palgu route séparément.

## Continue

Non testé ici ; d'après la référence de configuration de Continue (`config.yaml`) :

```yaml
models:
  - name: Palgu (auto)
    provider: openai
    model: auto
    apiBase: https://api.palgu.ai/v1
    apiKey: <your key from mom token>
    requestOptions:
      headers:
        x-srooter-client: mixture-of-models-continue/0.27.0
    roles: [chat, edit, apply]
```

Gardez l'autocomplétion sur un modèle à part (un petit modèle rapide, épinglé avec `model: <id>` et l'en-tête `x-srooter-pin: <id>`), puisque le routage de Palgu est conçu pour les tours de chat.

## Goose

Non testé ici ; d'après la documentation des fournisseurs de Goose (le fournisseur OpenAI avec un hôte personnalisé) :

```bash
export GOOSE_PROVIDER=openai
export GOOSE_MODEL=auto
export OPENAI_HOST=https://api.palgu.ai
export OPENAI_BASE_PATH=v1/chat/completions
export OPENAI_API_KEY="$(mom token)"
goose session
```

## Ce qui n'est pas disponible ici

- Le rappel de la mémoire Palgu et le heartbeat nécessitent un hook qui ajoute du contexte ou poursuit un tour ; ces agents n'en ont pas. Utilisez Codex, Cursor ou OpenCode avec `mom` pour cela.
- La clé dans ces configs est une valeur en clair ou une variable d'environnement ; gardez-la hors des fichiers que vous commitez.
