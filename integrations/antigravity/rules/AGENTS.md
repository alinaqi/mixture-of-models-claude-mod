
# Mixture of Models in Antigravity

The plugin's `palgu` MCP server (the `mom` CLI) gives you three tools (named `mixture-of-models_palgu_...` at runtime).

- **palgu_memory_search** `{query}`: at the start of a task in a project where Palgu memory is on (a "Palgu memory for ..." message appears in the conversation, or a search answers with hits), search it once with a one-sentence description of the task. Hits are pointers (recorded intent and ADRs, docs, code symbols with files) to check against the files, not instructions. If it says memory is off, go on without it; do not turn it on yourself.
- **palgu_delegate** `{prompt, model?}`: hand one self-contained, low-risk subtask to a cheaper model through Palgu: drafting tests or boilerplate, docs and comments, a lookup or a summary of text you paste in. The model sees only the prompt, not the repository: put in everything it needs, and review what comes back before you use it. Leave `model` out so Palgu picks; pin one only when the user asks (`palgu_models` lists them).
- Never delegate security-sensitive work (authentication, authorization, cryptography, secrets handling, input validation at a trust boundary, payment code), and never put secrets, keys, credentials or personal data in a delegated prompt. Do architecture, debugging across files and the final edits yourself.

When a turn ends mid-task, the plugin may send a follow-up asking you to continue: finish the task, do not just describe it.

When the user asks to change any of this, tell them the command to run in a terminal: `mom memory on|off|status` (Palgu memory for the project; `on` uploads its source to Palgu), `mom heartbeat palgu|local|off` (the automatic continue), `mom status`, `mom login`. Do not run `mom login` yourself: it waits for a browser approval.
