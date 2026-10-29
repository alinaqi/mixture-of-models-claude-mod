# 0003 - Gateway providers: Palgu, OpenRouter, LiteLLM and generic

**Status:** accepted
**Date:** 2026-10-29
**Spec:** https://github.com/alinaqi/mixture-of-models-claude-mod (OpenRouter and LiteLLM support, 0.16.0)
**Deciders:** Ali Naqi Shaheen

## Context

The gateway child (ADR 0001) took any Anthropic-compatible URL but assumed Palgu in three places: the key went in `ANTHROPIC_API_KEY` (`x-api-key`), routes and the band named Palgu's model ids, and Codex was pointed at Palgu's `/v1/responses` under a `palgu` provider. OpenRouter and LiteLLM differ on all three:

- Both document bearer auth for Claude Code: `ANTHROPIC_AUTH_TOKEN`, with `ANTHROPIC_API_KEY` explicitly empty ([OpenRouter](https://openrouter.ai/docs/guides/guides/claude-code-integration), [LiteLLM](https://docs.litellm.ai/docs/tutorials/claude_responses_api)). Claude Code sends `ANTHROPIC_AUTH_TOKEN` as `Authorization: Bearer`, `ANTHROPIC_API_KEY` as `x-api-key`, an `apiKeyHelper` in both ([Claude Code](https://code.claude.com/docs/en/llm-gateway-connect.md)).
- OpenRouter model ids are slugs with a `/` (`z-ai/glm-5.3`), which the route syntax reads as `<family>/<member>`. LiteLLM serves whatever `model_name`s its config defines.
- Both serve the Responses API under `<base>/v1` for Codex.

The child runs `--bare`, whose help says "Anthropic auth is strictly ANTHROPIC_API_KEY or apiKeyHelper via --settings". Checked against Claude Code 2.1.312 with a local server that logs request headers, with dummy keys and an empty `HOME`:

| Child environment (`--bare`) | Headers received |
| :- | :- |
| `ANTHROPIC_API_KEY=A` | `x-api-key: A` |
| `ANTHROPIC_AUTH_TOKEN=B` | `Authorization: Bearer B` |
| `ANTHROPIC_API_KEY=` and `ANTHROPIC_AUTH_TOKEN=C` | `Authorization: Bearer C` |
| `ANTHROPIC_API_KEY=X` and `ANTHROPIC_AUTH_TOKEN=F` | **both** `x-api-key: X` and `Authorization: Bearer F` |
| `ANTHROPIC_API_KEY=K` and `ANTHROPIC_AUTH_TOKEN=` | `x-api-key: K` |
| `--settings '{"apiKeyHelper":"printenv V"}'`, `V=D` | `x-api-key: D` and `Authorization: Bearer D` |

So `ANTHROPIC_AUTH_TOKEN` works under `--bare` on this build despite the help text, and the child's environment, which `$.process.run` merges over the parent's, leaks an inherited credential unless it blanks it.

## Decision

1. A **provider** (`hooks/lib/providers.js`): `palgu`, `openrouter`, `litellm` or `anthropic-compatible`, from the `gateway_provider` option, else `router.provider`, else detected by host (`*.palgu.ai`, `openrouter.ai`); anything else is `anthropic-compatible`, which behaves exactly as before. LiteLLM is never detected; it is named.
2. Per provider: `auth` (`x-api-key` or `bearer`), `identify` (send `x-srooter-*`, Palgu and generic only), a `catalogue` of route values for the band and `/route <prefix>`, gateway `families`, default `routes` and the `primary` map. They are defaults: `router.routes`, `router.families` and `router.child.auth` still win.
3. The child's key goes in **exactly one** variable and the other is set empty: `ANTHROPIC_API_KEY` + empty `ANTHROPIC_AUTH_TOKEN`, or `ANTHROPIC_AUTH_TOKEN` + empty `ANTHROPIC_API_KEY`. Nothing new on argv.
4. OpenRouter routes name families (`glm/5.3`), whose members map to slugs checked against `https://openrouter.ai/api/v1/models`. A full slug that a family lists resolves to that member, so `z-ai/glm-5.3` works as a route; an unlisted slug is still an unknown family, refused by `/route`.
5. Codex keeps one code path: on OpenRouter and LiteLLM the provider is named `openrouter` or `litellm`, the base URL is `<gateway_url>/v1`, and the key travels in `OPENROUTER_API_KEY` or `LITELLM_API_KEY`, only in the child's environment.

## Consequences

- A generic gateway works as before, except that an inherited `ANTHROPIC_AUTH_TOKEN` is now blanked in the child.
- The bearer path depends on `--bare` honouring `ANTHROPIC_AUTH_TOKEN`, which its help text does not promise. If a later build stops, the child fails with 401 and the main model answers; the fallback is `apiKeyHelper` through `--settings` with the key in the child's environment (verified above), which sends both headers.
- OpenRouter's slugs move; the catalogue is a default, overridable per family.
- Codex on OpenRouter and LiteLLM is configured from their own docs, not exercised against the live services: no real key was used.

## Alternatives Considered

| Option | Pros | Cons | Why Not |
| :- | :- | :- | :- |
| `apiKeyHelper` via `--settings` for bearer gateways | Documented under `--bare` | Runs a shell command in the child; `printenv` is not on Windows; sends the key in two headers | `ANTHROPIC_AUTH_TOKEN` is what both providers document, and works |
| Treat any unknown `a/b` route as a raw gateway id | Any OpenRouter slug works unlisted | A typo in a family name is sent to the gateway instead of refused | Listing the slug in a family is one line of config |
| Leave the other auth variable inherited | Smaller diff | An exported Anthropic key reaches OpenRouter, or a stray bearer token reaches Palgu | A credential leak |

## Links

- Related: ADR 0001, ADR 0002
