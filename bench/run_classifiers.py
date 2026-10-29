"""Run the mod's routing classifier question through candidate models and record each verdict.

Usage: python3 -I bench/run_classifiers.py <questions.json> <results.json>

questions.json is [{"id", "q"}], q being the mod's classifierPrompt() for that prompt.
Palgu models: Anthropic API on api.palgu.ai, pinned with x-srooter-pin, cost from Palgu's
/v1/pricing/quote. Claude models: `claude -p` on the user's login with a minimal system prompt;
cost is estimated at API list prices from the question's size and the reported output tokens.
The Palgu key is read from Claude Code's credential store and never printed.
"""
import concurrent.futures as cf
import json
import os
import re
import subprocess
import sys
import time
import urllib.request

PALGU = ['glm-5.3', 'deepseek-pro', 'gemini-3.8-flash', 'minimax-m3', 'gpt-6-luna', 'gpt-6-sol', 'kimi-2.7-code']
CLAUDE = {'claude-haiku-5-5': (0.1, 0.5), 'claude-haiku-4-5': (1.0, 5.0), 'claude-sonnet-5-5': (2.0, 10.0)}
KINDS = ['code', 'research', 'review', 'docs', 'data', 'multimodal']


def palgu_key():
    creds = json.loads(subprocess.check_output(['security', 'find-generic-password', '-s', 'Claude Code-credentials', '-w']))
    return creds['pluginSecrets']['mixture-of-models@mixture-of-models-claude-mod']['gateway_key']


def verdict(raw):
    """The mod's parseVerdict: the first standalone 1-10, then the first kind word (default code)."""
    m = re.search(r'\b([1-9]|10)\b', raw or '')
    if not m:
        return None, None
    kind = next((k for k in KINDS if re.search(r'\b' + k + r'\b', raw, re.I)), 'code')
    return int(m.group(1)), kind


def post(url, body, key, extra=None):
    headers = {'content-type': 'application/json', 'x-api-key': key, 'authorization': 'Bearer ' + key,
               'anthropic-version': '2023-06-01', 'x-srooter-client': 'mixture-of-models/bench', **(extra or {})}
    with urllib.request.urlopen(urllib.request.Request(url, json.dumps(body).encode(), headers), timeout=120) as r:
        return json.load(r)


def ask_palgu(model, item, key):
    t = time.time()
    try:
        d = post('https://api.palgu.ai/anthropic/v1/messages',
                 {'model': model, 'max_tokens': 400, 'messages': [{'role': 'user', 'content': item['q']}]},
                 key, {'x-srooter-pin': model})
        secs = time.time() - t
        raw = ''.join(b.get('text', '') for b in d.get('content', []) if b.get('type') == 'text')
        u = d.get('usage', {})
        usage = {k: u.get(k, 0) or 0 for k in ('input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens')}
        try:
            cost = post('https://api.palgu.ai/v1/pricing/quote', {'model': model, 'usage': usage}, key).get('cost_usd')
        except Exception:
            cost = None
        return row(model, item, raw, secs, usage['input_tokens'], usage['output_tokens'], cost, d.get('model'), '')
    except Exception as e:
        return row(model, item, '', time.time() - t, 0, 0, None, '', str(e)[:200])


def ask_claude(model, item):
    t = time.time()
    argv = ['claude', '-p', '--model', model, '--system-prompt', 'You are a classifier. Reply with exactly what is asked.',
            '--tools', '', '--strict-mcp-config', '--no-session-persistence', '--output-format', 'json']
    try:
        p = subprocess.run(argv, input=item['q'], capture_output=True, text=True, timeout=180,
                           env={**os.environ, 'MAGGY_ROUTER_CHILD': '1'})
        secs = time.time() - t
        d = json.loads(p.stdout)
        d = d[-1] if isinstance(d, list) else d
        out = d.get('usage', {}).get('output_tokens', 0)
        tokens_in = round(len(item['q']) / 4)  # the mod sends only the question; ~4 characters a token
        price_in, price_out = CLAUDE[model]
        cost = (tokens_in * price_in + out * price_out) / 1e6
        return row(model, item, str(d.get('result', '')), secs, tokens_in, out, cost, model, '')
    except Exception as e:
        return row(model, item, '', time.time() - t, 0, 0, None, '', str(e)[:200])


def row(model, item, raw, secs, tin, tout, cost, served, error):
    score, kind = verdict(raw)
    return {'model': model, 'id': item['id'], 'raw': raw.strip()[:300], 'score': score, 'kind': kind,
            'seconds': round(secs, 2), 'tokens_in': tin, 'tokens_out': tout, 'cost_usd': cost,
            'served': served, 'error': error}


def main():
    questions = json.load(open(sys.argv[1]))
    key = palgu_key()
    jobs = [('p', m, q) for m in PALGU for q in questions] + [('c', m, q) for m in CLAUDE for q in questions]
    results = []
    with cf.ThreadPoolExecutor(8) as ex:
        futures = [ex.submit(ask_palgu, m, q, key) if src == 'p' else ex.submit(ask_claude, m, q) for src, m, q in jobs]
        for i, f in enumerate(cf.as_completed(futures), 1):
            results.append(f.result())
            if i % 32 == 0:
                print(f'{i}/{len(jobs)} done', flush=True)
    json.dump(sorted(results, key=lambda r: (r['model'], r['id'])), open(sys.argv[2], 'w'), indent=1)
    print('wrote', sys.argv[2], len(results), 'rows')


if __name__ == '__main__':
    main()
