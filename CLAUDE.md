# mixture-of-models-claude-mod

A Claude Code **mod**: a plugin whose `hooks/register.js` registers in-process event handlers.

## Layout

- `hooks/register.js` — the only file that touches the mods API (`$`). Seven hooks, thin.
- `hooks/lib/*.js` — pure functions, no `$`, each with a test in `tests/`.
- `tests/*.test.ts` — kit-style tests. Pure ones run under Node via `npm test`; `tests/mod.test.ts` needs `claude plugin test`.
- `docs/adr/` — architecture decisions. Read before changing how routing or delegation works.

## Rules for changes

- Red → green: add or change a test before the code.
- Never pass `$` to a function outside `register.js`, never destructure it, and keep event names and `$.env.get` names as string literals, or `claude plugin validate` fails.
- Model ids: undated aliases only.
- The main session is never renamed or re-pointed. Routing happens only through the child process (ADR 0001).
- Update `CHANGELOG.md` in the same commit.

## Commands

```bash
npm test                              # pure tests under Node
claude plugin validate --strict .     # static analysis
claude --plugin-dir .                 # load for a session
claude plugin test                    # hook tests, Claude Code >= 2.1.287
```
