# mixture-of-models-claude-mod

A Claude Code **mod**: a plugin whose `hooks/register.js` registers in-process event handlers, plus `mom` (`integrations/cli`) and thin adapters for other coding agents (`integrations/*`, ADR 0005).

**Asked to install or set up Mixture of Models for a user (not to change this code)?** Follow [INSTALL.md](INSTALL.md) instead of this file. Asked how to use it well? [GUIDELINES.md](GUIDELINES.md).

## Layout

- `hooks/register.js` — the only file that touches the mods API (`$`). Eleven hook registrations.
- `hooks/lib/*.js` — pure functions, no `$`, each with a test in `tests/`.
- `tests/*.test.ts` — kit-style tests. Pure ones run under Node via `npm test`; `tests/mod.test.ts` and `tests/compliance.test.ts` need `claude plugin test`.
- `docs/adr/` — architecture decisions. Read before changing how routing or delegation works.

## Rules for changes

- Red → green: add or change a test before the code.
- Never pass `$` to a function outside `register.js` or to an inline function, never destructure it or store it (or `$.noun`) in a variable, write every call as plain `$.noun.method(...)`, and keep event names, `$.env.get` names, `$.http.fetch` URLs and `$.process.run` program names as string literals, or `claude plugin validate` and the plugin directory refuse the module.
- Model ids: undated aliases only.
- The main session is never renamed or re-pointed. Routing happens only through a child process: Claude Code on the gateway or on the user's Claude login, or `codex exec` (ADR 0001, ADR 0002).
- Update `CHANGELOG.md` in the same commit.
- The user docs (README, INSTALL, GUIDELINES, GETTING_STARTED, PRIVACY, UNINSTALL, `integrations/*/README.md`) have translations in `docs/i18n/{zh-CN,ja,de,fr,ar}/`. English is authoritative; when you change a section of one, change the same section in each translation, or say in the PR that they lag. Code blocks, commands, model ids and text the software prints stay in English in every language.

## Commands

```bash
npm test                              # pure tests under Node
claude plugin validate --strict .     # static analysis
claude --plugin-dir .                 # load for a session
claude plugin test                    # hook tests, Claude Code >= 2.1.287
```
