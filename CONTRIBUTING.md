# Contributing

Thanks for helping. This mod follows the same philosophy as [Maggy](https://github.com/alinaqi/maggy): small, measurable, test-first.

## Ground rules

1. **Tests first.** Write the failing test, then the code. `npm test` runs the pure tests under Node; `claude plugin test` runs the hook tests (Claude Code 2.1.287+).
2. **Keep `$` in `hooks/register.js`.** Claude Code's static analysis only follows the mods API (`$`) into top-level functions of the hooks module. Everything that can be pure goes in `hooks/lib/` and gets a unit test.
3. **Quality gates.** Functions under 20 lines, at most 3 parameters, nesting depth 2, files under 200 lines. `register.js` is allowed more functions than usual because of rule 2.
4. **Model names.** Undated aliases only (`claude-opus-5`, `claude-sonnet-5`, `claude-haiku-4-5`). Never a dated snapshot id.
5. **Changelog in the same commit.** Every behaviour, config or docs change ships an entry in `CHANGELOG.md`.
6. **Architecture changes need an ADR** in `docs/adr/`. Copy the format of `0001-child-process-delegation.md`.

## Workflow

```bash
git clone https://github.com/alinaqi/mixture-of-models-claude-mod
cd mixture-of-models-claude-mod
npm test                                  # pure tests
claude plugin validate --strict .         # manifest + hooks module analysis
claude --plugin-dir .                     # load it; edits hot-reload at the end of each turn
env -u ANTHROPIC_API_KEY claude plugin test   # hook tests (needs 2.1.287+; a stale key in the shell 401s)
```

Open a pull request against `main`. CI runs the same checks, except that it validates without `--strict`: the runner's Claude Code build may not yet know manifest fields the directory requires, such as `privacyPolicyUrl`. Run `--strict` locally on 2.1.294 or later.

## Releasing

Bump `version` in `.claude-plugin/plugin.json` and `package.json`, add the changelog section, commit, push. Users on the marketplace get it with `claude plugin update mixture-of-models@mixture-of-models-claude-mod`.
