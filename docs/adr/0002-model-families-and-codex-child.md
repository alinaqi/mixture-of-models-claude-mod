# 0002 - Route within a model family, and run Codex as a second kind of child

**Status:** accepted
**Date:** 2026-10-28
**Spec:** https://github.com/alinaqi/mixture-of-models-claude-mod/issues/5
**Deciders:** Ali Naqi Shaheen

## Context

Routes named one model per tier (`glm-5.3`, `kimi-k3.1-pro`) or `claude`, meaning "the main session". Users want finer control: a specific Claude member (`claude-fable-5-1`, `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`), a choice inside a family made from the task's difficulty, and the Codex CLI as an executor next to Claude Code.

ADR 0001 rules out re-pointing or renaming the main session. A mod could rewrite the model name on a main-session request, which would keep the subscription and the transcript, but that is exactly the renaming 0001 forbids: a tool loop that switches model mid-turn, a session whose model the user did not choose, and a `/model` display that lies.

## Decision

1. A route value may be `<family>/<member>` or `<family>/auto`. Families are `claude`, the gateway families built from the gateway catalogue (`kimi`, `glm`, `deepseek`, `mercury`) and `codex`, each with `members` (alias → exact id) and an `auto` map (tier → member, optional `criticalPlus` for 10/10 critical turns). `auto` reuses the classifier, thresholds and failure memory and never leaves the family. Bare `claude` keeps its meaning.
2. A Claude member that is not the session model runs in a child `claude -p --model <id>`, Claude Code's own model flag, **without `--bare`** (which only allows API-key auth) and with `ANTHROPIC_BASE_URL` cleared, so it runs on the user's own Claude login. `ANTHROPIC_API_KEY` is not set at all: Claude Code treats an empty value as a key. A member equal to the session model stays in the main session.
3. A `codex` route runs `codex exec --json … -` as the child, with the same brief, timeout and vetting. On the Palgu path the provider is passed with `-c model_providers.palgu.*` (Responses wire API) and the key in the child's environment as `PALGU_API_KEY`; on the ChatGPT path the user's own Codex config and login are used untouched.
4. A route names a **runner**: `main`, `gateway`, `subscription` or `codex`, each with its own readiness (gateway URL + key; nothing; Codex auth), so a subscription route works without a gateway.

## Consequences

- The main session is still never renamed, re-pointed or touched.
- A subscription child loads the user's hooks and plugins (no `--bare`); the mod disables itself there via `MAGGY_ROUTER_CHILD`. Other hooks may add output to the child's run.
- The mod now runs two programs, `claude` and `codex`; README, PRIVACY and the static analysis list both.
- ~~Codex has no permission-denial report, so the permission relay does not apply to it: its sandbox (`workspace-write` by default) decides, and a blocked command fails inside the run.~~ Superseded by the 0.12.1 amendment below: that default let a routed Codex turn edit files and run any command in the workspace without the user's approval, which the Claude child never does.
- A subscription child spends the user's Claude plan, like the main session would; it is not a cost saving, it is a model choice.

## Amendment (0.12.1, 2026-10-28): Codex approval parity

**Finding** (security review, medium): `codex exec … --sandbox workspace-write` with no approval policy let a routed Codex turn run arbitrary commands in the workspace without the user's approval, while the Claude child relays every refused command to the user. The Codex path bypassed the mod's approval model.

**Facts, checked against Codex CLI 0.163.0** with a fake Responses endpoint in a throwaway `HOME`:
- `codex exec` always runs with approval policy Never. `-c approval_policy="untrusted"` is rejected (`no longer supported`); `on-request` and `on-failure` are accepted but a request to escalate is still refused (`approval policy is Never; reject command`). So nothing can be asked mid-run, and inside `workspace-write` every command runs unasked.
- `--json` reports neither a sandbox-blocked command nor a refused escalation: neither emits an item. A refused escalation only leaves a `reject command` log line on stderr.
- `codex exec -C <dir> resume --json -c sandbox_mode=… <thread> -` resumes a thread with a different sandbox (`resume` has no `--sandbox` or `-C` of its own).

**Decision:**
1. The default sandbox is `read-only` (`router.codex.sandbox`), with `-c approval_policy="never"` explicit. Writes cannot be gated in exec mode, so read-only is the only default no wider than the Claude child. `workspace-write` (network forced off) and `danger-full-access` are explicit opt-ins, documented as running commands unasked.
2. `router.codex.args` cannot set the sandbox, approval policy, extra writable dirs or the git check; such flags are dropped and logged.
3. `--skip-git-repo-check` only with `router.codex.allowOutsideGit: true`.
4. Refusals are relayed: the brief asks Codex to name each blocked command on a `NEEDS-APPROVAL:` line; the mod asks the user through the same dialog as the Claude child, naming the commands and that approving allows edits in the project for the rest of the turn. On approval the same thread resumes with `workspace-write`, network still off. Otherwise the answer and the route line name what was refused, and stderr rejections Codex did not name are counted.

**Consequences:** a read-only Codex turn that needs to write costs one extra question and a resume. Approval is per turn, not per command: Codex cannot allow one command only, and the question says so. The refusal report depends on Codex following the instruction; when it does not, the route line still shows the sandbox the turn ran in. Revisit if `codex exec --json` starts reporting refusals or regains an approval policy usable in exec mode.

## Alternatives Considered

| Option | Pros | Cons | Why Not |
|--------|------|------|---------|
| Rewrite `model` on the main session's `turn.step` for Claude members | One process, full transcript, streaming | Renames the main session per turn; mid-loop model switches | Violates ADR 0001 |
| Send Claude members through the gateway's `/anthropic` path | Same child as today | Spends gateway credit instead of the subscription the user pays for; needs a gateway | The ask is the subscription path |
| Codex through `OPENAI_BASE_URL` | Fewer flags | Ignored under a ChatGPT login | Palgu's Codex docs require an explicit provider |
| Write a `~/.codex/config.toml` profile | Shorter argv | Writes to the user's Codex config | The mod never writes user config |

## Links

- Supersedes: N/A
- Related: ADR 0001, issue #5, Palgu client docs (Codex CLI via `/v1/responses`)
