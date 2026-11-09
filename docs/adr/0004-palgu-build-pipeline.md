# 0004 - The Palgu build pipeline: Palgu decides and verifies, Claude Code builds

**Status:** accepted (2026-11-07)
**Date:** 2026-11-05
**Spec:** srooter PR #2281, `docs/integrations/palgu-cli-capability-spec.md` (every Palgu call below cites it as "spec §n")
**Deciders:** Ali Naqi Shaheen

## Context

Palgu removed every place it wrote routing into Claude Code's settings (srooter #2260, PR #2269). The mod is now the supported way to use Palgu inside Claude Code, and the goal is the whole engineering process, not only model choice:

> spec → spec validation → planning with todos → todos in AWG → execution with multiple agents in Claude Code on the models Palgu recommends → validation in Palgu, visual and functional → PR, keeping code structure, repo structure and ADRs right.

Palgu already runs this pipeline as `palgu flow run` (spec §6), but Flow executes with Palgu's own local agent: its own worktrees under `.srooter/flows/`, its own `node … stream` workers, its own PR. Inside Claude Code that is a second agent doing the same job as the first. Claude Code already has the execution layer: subagents (the Agent tool, background and worktree isolation), tools, permissions, hooks, and its own memory.

Constraints from the spec:

- The mod's device key has `profile:read v1:chat` (spec "How the mod's key is checked"). New keys reach `GET /me`, chat, `/v1/sessions/usage` and `/v1/pricing/quote`. Memory, work items, routing, tickets and council need scopes srooter has not shipped yet (S1–S13, spec "Server changes needed").
- `palgu` itself is installed (0.1.44 here) and signs in with its own key, so anything run through `palgu` works today without a mod scope.
- `/v1/work` is read-only (spec §7). Creating, claiming and proving AWG tasks goes through the AWG plugin's tools in Claude Code (`awg_create`, `awg_next`, `awg_evidence`, `awg_handoff`, `awg_submit`).
- Palgu's definition of done (srooter `ci/proof_gates.py`, `trackers/done_proof.py`): a PR closes work only with a `## Validation` section holding a functional proof line and, for anything a person sees, an image or video link. A merged PR is not proof.
- The mod's rules (AGENTS.md): `$` stays in `register.js`; `$.process.run` program names are literals (`palgu`, `claude`, `codex`); the main session is never re-pointed.

## Decision

**Palgu decides and verifies; Claude Code builds.** The split by owner:

| Owner | What |
| :- | :- |
| Palgu | Specs and their validation; project memory (code index, recorded intent, decisions); provider decisions (which model for which role, the org policy, budgets); the gates (council review, quality and security checks, assurance, repo standards, ship verdict, deploy guard). |
| AWG | The plan as durable work items: dependencies, lanes, acceptance criteria, claims, evidence, handoffs. |
| Claude Code | Execution: the main session orchestrates, subagents implement, its tools, permissions, hooks and personal memory (`CLAUDE.md`, auto-memory). |
| The mod | Wiring: commands, the stage state, gates as dialogs, Palgu-recommended models on subagents (ADR 0001/0002 child routing), a pipeline pane. |

Palgu Flow's execution engine is not used by this pipeline. `/palgu flow run` stays available as an explicit shell-out for unattended runs.

### The stages

`/palgu build "<intent>"` starts a pipeline run with an id. Its state lives in the mod's store and in AWG; every stage ends at a gate, and a run can be resumed at any gate (`/palgu build resume <id>`).

| # | Stage | How | Gate |
| :- | :- | :- | :- |
| 1 | Spec | `palgu spec run "<intent>" --json` (spec §6); its up-to-four questions become `$.ui.ask` dialogs answered with `palgu spec answer <id> Q-n "…"`. Output: `.srooter/flows/<id>/spec/SPEC.md`, `claims.json`. | — |
| 2 | Spec validation | `palgu spec show <id> --claims --sources --trace --json`: the scorecard against requirement and architecture standards. Baseline of the repo: `palgu check --section structure --section practices --json` (spec §11). | Every claim verified or answered; the person approves (`palgu spec answer <id> approve`). |
| 3 | Planning with todos | Claude Code's main session (Plan subagent) turns the approved spec into todos: one file each in `_project_specs/todos/` (the layout `palgu todos` reads, spec §9) with acceptance criteria, dependencies, the files it may touch, and its validation (functional and, for UI, visual). Every architectural choice becomes an ADR in the repo's ADR folder, status proposed. | The person approves the plan; `palgu review --adversarial` on the plan commit when the org's review policy asks for it. |
| 4 | Todos in AWG | One `awg_create` per todo: acceptance criteria, `depends_on`, labels, the todo file as description. AWG computes lanes (`awg_lanes`; `palgu tasks lanes` reads the same). | AWG reports no cycles and at least one ready item. |
| 5 | Execution | The main session starts one background subagent per AWG lane (Agent tool, `isolation: worktree`). Each loops `awg_next` → test first → implement → `awg_evidence` → `awg_submit`, and hands off with `awg_handoff` when blocked. The model each subagent runs on is Palgu's recommendation for its role (below). | Every item submitted with evidence; tests green in each worktree. |
| 6 | Validation in Palgu | Per item and then on the integrated branch: functional: `palgu check quality --json` (council review, adversarial refutation, gitleaks, semgrep; spec §5, §11); visual: for UI work, a screenshot or recording from the running app (Claude Code's browser tools or the demo-video skill), attached with `awg_evidence`; for web apps `palgu assurance urls|cwv|seo --url <app> --json`; structure: `palgu check --section structure --section practices --json` again, compared with stage 2's baseline. | No unresolved high finding; visual proof present for every UI item; no structure regression; `palgu ship --json` clear (exit 0). |
| 7 | PR | `gh pr create` with What / Why / How, the ADRs added, the CHANGELOG entry, and a `## Validation` section in the shape Palgu's proof gate reads (functional proof line, image or video links, closing references). After merge: `awg_submit` with the PR link closes the items. | Palgu's PR gates pass; the person merges. |

Every gate is a `$.ui.ask` dialog with the evidence in front of it ("Approve spec", "Approve plan", "Open PR"); nothing past stage 1 runs without the previous gate's approval.

### Models Palgu recommends, per role

Palgu's routing has roles (`effective.flow_roles` in `palgu routing show --json`; spec §2, `GET /v1/routing/effective`). For this org on 2026-11-05: `researcher` gemini-3.7-flash, `spec_writer` gemini-3.8-flash, `implementer` gpt-6-sol, `validator` gpt-5.6-terra, `adversarial` gpt-5.6-terra. There is no planner role. The pipeline maps them:

- `spec_writer` drafts the spec inside `palgu spec run` (stage 1, Palgu's own choice); `researcher` → a research subagent when stage 3 needs one; `implementer` → the lane subagents of stage 5; `validator` and `adversarial` → stage 6's review, which runs inside Palgu.
- Planning (stage 3) stays on the main session's own model: it holds the conversation and the approved spec, and the plan is a gate the person reviews.
- A role that resolves to a Claude model sets the subagent's `model` on `agent.spawn`; it runs in-process on the user's login.
- A role that resolves to a gateway model runs that subagent's turn as a gateway child pinned with `x-srooter-pin` (ADR 0001, 0003). The child has no conversation to miss: its context is the AWG item bundle from `awg_next`.
- A role whose model Palgu reports down (`GET /v1/models/health`, read by the mod since 0.23.0) is not used: the lane takes the mod's own routing for that turn, and the pane says which role fell back and why. On 2026-11-07 that was `validator` and `adversarial` (gpt-5.6-terra down).
- Until the mod has `routing:read` (S1), the roles come from `palgu routing show --json` (Palgu's own key). Without either, the mod's own routing strategy (complexity by default) picks, and the pane says so.

### Structure, repo and ADRs

- ADRs: written in stage 3 for every decision the plan makes, updated in stage 7 (proposed → accepted); `palgu decisions list --json` confirms Palgu reads them.
- Repo and code structure: `palgu check --section structure --section practices` before (stage 2) and after (stage 6); a regression blocks the PR gate.
- CHANGELOG: one entry per run, in the PR.
- The files each todo may touch are part of the todo; a lane that changes files outside them is flagged at stage 6.

### What the mod adds

1. `/palgu build "<intent>"`, `/palgu build status|resume <id>|cancel <id>`; a pipeline pane: stages, gate state, AWG lanes and their agents, the latest Palgu verdicts.
2. A plugin skill, `palgu-build`, that the main session follows for stages 3–7 (planning, AWG, starting and supervising lane subagents, assembling the PR). The mod drives stages 1–2 and the gates; the skill drives the work.
3. Read-only model tools that shell out to `palgu … --json`: `palgu_spec`, `palgu_check`, `palgu_ship`, `palgu_routing_roles`; later, with scopes, `palgu_memory_ask` and `palgu_memory_why` over HTTP.
4. Per-subagent model routing on `agent.spawn` (designed in this conversation's earlier work; nothing changes for subagents outside a pipeline run unless `router.subagents` says so).
5. Never from a model tool: `palgu deploy run --prod`, `palgu flow` runs, anything that applies org settings.

## Consequences

- Works today for stages 1, 2, 3, 4, 6 and 7 through `palgu` and the AWG plugin. Stage 5's Palgu-recommended models need `palgu routing show` (works with Palgu's key) or S1; the per-subagent routing is new mod code.
- Two keys on the machine: the mod's (`/palgu login`) for gateway turns and pricing, and `palgu`'s own for everything shelled out. `/palgu status` shows both.
- The mod depends on the `palgu` CLI and the AWG plugin being installed for `/palgu build`; without them the command says what to install and does nothing.
- Pipeline runs cost real model time (spec drafting, council review, lane agents). The pane shows spend per stage from `/v1/sessions/usage` and the savings line.
- When srooter ships S1, S5 and S7, `palgu_routing_roles`, the AWG read tool and memory tools move from shell-out to HTTP with no change to the stages.

## Alternatives considered

- **Shell out to `palgu flow run` for everything.** Least mod code, but Palgu's agent does the work, not Claude Code, and Claude Code's subagents, permissions and memory sit idle.
- **Re-implement spec, review and checks in the mod.** Duplicates Palgu's gates and drifts from them; the point is that Palgu's verdict is the one the org trusts.
- **Claude Code only, Palgu for models.** Loses the spec scorecard, council review, proof gates and AWG durability that the request is about.

## Open questions

1. `palgu spec run` exits 3 when questions are waiting (`palgu spec --help`); the mod then reads them with `palgu spec show <id> --json` and answers with `spec answer`. Still to check: the JSON shape of a waiting question.
2. Resolved: `palgu routing show --json` returns `effective.flow_roles` (see "Models Palgu recommends").
3. Resolved (2026-11-07): one PR. Each lane subagent commits to its own branch (`palgu/<run>/lane-<n>`); the main session merges them into `palgu/<run>/integration`, stage 6 runs on that branch, and stage 7 opens one PR from it. Palgu's proof gates then run once, on what ships.
4. Spec §17 (agent runs, `/v1/agent-runs`, `model_group` on `/v1/routing/effective`, speed mode) landed after this ADR was proposed. Lane subagents report as agent runs once the mod's key can write them, so Palgu's live agents view shows Claude Code's lanes too.
5. Every Palgu project gets its own AWG workspace automatically, and AWG settings live in Studio and the CLI as well as the web (srooter #2351). Stage 4 creates items in that workspace (the `project` of `awg_create`) instead of choosing one.
