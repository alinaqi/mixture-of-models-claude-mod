---
name: routing-strategy
description: Create, edit or explain a Mixture of Models routing strategy, the rules that decide which prompts leave Claude and which model takes them. Use when the user wants to route by their own criteria (cost, speed, quality, privacy, team rules, specific kinds of work), asks how routing decides, or wants to change or compare the built-in strategies (complexity, cost, speed, quality).
---

# Routing strategies for Mixture of Models

The mod scores every prompt 1-10 with a small classifier, maps the score to a tier (`simple`, `coding`, `critical`), and routes each tier, and each kind of work below `critical`, to a model. A **routing strategy** decides what the score means and where each tier goes. It is one markdown file.

Before any strategy runs, fixed safety rules keep some turns on the main session: security work, notifications from teammates or background tasks, short session commands ("merge it", "status"), and follow-ups to a turn a child answered. A strategy cannot route those.

## Built-in strategies

| Name | Scores | Thresholds (simple / coding) | Routes |
| :- | :- | :- | :- |
| `complexity` (default) | blast radius: how much a wrong answer could break | 3 / 7 | the config's routes (GLM for simple and coding, DeepSeek for research and review, Claude for critical) |
| `cost` | risk of a cheaper model being wrong; when unsure, lower | 4 / 8 | simple `glm/5.3`, coding, research and review `deepseek/v4-pro`, images `gemini/3.8-flash`, critical Claude |
| `speed` | reasoning depth needed | 3 / 7 | simple `gemini/3.8-flash`, coding `gpt/sol`, research and images `gemini/3.8-flash`, critical `claude/sonnet` |
| `quality` | stakes; when unsure, higher | 2 / 5 | simple `glm/5.3`, coding `claude/sonnet`, critical Claude |

`/route strategies` lists them with the user's own; `/route strategy <name>` switches (remembered across sessions). `router.strategy` in `~/.claude/model-config.json` sets one too; a `/route strategy` pick wins.

## The file

Path: `~/.claude/mixture-of-models/strategies/<name>.md`. A file named like a built-in replaces it.

```markdown
---
name: frugal
description: One line the user sees in /route strategies.
score: risk
thresholds: {"simple": 5, "coding": 8}
routes: {"simple": "glm/5.3", "coding": "deepseek/v4-pro", "critical": "claude", "kinds": {"review": "kimi/pro"}}
---
Risk: how bad a wrong answer from a cheaper model would be. When unsure, score lower.
1-5: lookups, docs, tests, single-file edits, small fixes.
6-8: multi-file features, integrations, refactors that tests cover.
9-10: security, production, data migrations, anything irreversible.
```

Rules the mod checks (a file that breaks one is skipped, and the reason is logged):

- The frontmatter is between `---` lines, one `key: value` per line. `thresholds` and `routes` are **JSON on one line**.
- `thresholds`: whole numbers 1-9, `simple` below `coding`. A score at or below `simple` is the simple tier, at or below `coding` the coding tier, anything above is critical. Left out, the config's thresholds stay (3 / 7).
- `routes`: any of `simple`, `coding`, `critical`, and `kinds` (`code`, `research`, `review`, `docs`, `data`, `multimodal`). Left-out keys keep the config's value; `kinds` merge key by key. Kinds apply only below `critical`, and never override a tier routed to Claude.
- Route values: `claude` (the main session), `claude/<member>` (`fable`, `opus`, `sonnet`, `haiku`, on the user's own Claude login), a gateway family member (`glm/5.3`, `kimi/pro`, `kimi/highspeed`, `kimi/auto`, `deepseek/v4-pro`, `gemini/3.8-flash`, `minimax/m3`, `gpt/sol`, `gpt/luna`, `gpt/astra`, `gpt/auto`; `mercury/3` on OpenRouter only), `codex` or `codex/<model>`, or a plain model id the gateway serves. Family members work the same on Palgu, OpenRouter and LiteLLM; prefer them to plain ids.
- `score`: the name of what is scored; the classifier is asked for "the <score> from 1-10".
- The body is the rubric: what each score range means. Write it for a small model: short lines, concrete examples of work, a tie-break rule ("when unsure, score lower").
- `critical` should stay on Claude (`claude` or `claude/<member>`) unless the user explicitly wants otherwise; say so if they ask to route it away.

## Writing one with the user

1. Ask what they want to optimise and what must never leave Claude. Useful questions: cost, speed or quality first? Which work is low stakes for them (docs, tests, lookups)? Which models do they trust for code? Any kind of work that must stay on Claude (e.g. anything touching billing or auth)?
2. Read `/route strategies` output if they have one already, or the existing file, before changing it.
3. Write the file at `~/.claude/mixture-of-models/strategies/<name>.md` with a lowercase name, the rules above, and a rubric of four to six lines.
4. Check it: the frontmatter parses (JSON on one line), thresholds are ordered, every route is one of the forms above.
5. Tell them to run `/route strategy <name>`; the mod re-reads the folder then, no restart. `/route status` shows the active strategy, and the band shows it as `auto (<name>)`.
