import { expect, test } from 'claude-code/testing'
import { classifierPrompt } from '../hooks/lib/classify.js'
import { DEFAULTS, parseConfig } from '../hooks/lib/config.js'
import { BUILTIN, applyStrategy, parseStrategy, strategiesText, strategyPrompt } from '../hooks/lib/strategies.js'

const FILE = [
  '---',
  'name: frugal',
  'description: Everything but production work goes to GLM',
  'score: risk',
  'thresholds: {"simple": 6, "coding": 9}',
  'routes: {"coding": "deepseek/v4-pro", "kinds": {"review": "kimi/pro"}}',
  '---',
  '1-6: anything that is not production.',
  '7-10: production deploys and data.',
].join('\n')

test('there are four built-in strategies, complexity the default', async () => {
  expect(Object.keys(BUILTIN)).toEqual(['complexity', 'cost', 'speed', 'quality'])
  for (const s of Object.values(BUILTIN)) expect(s.description.length > 10).toBe(true)
})

test('the complexity strategy asks exactly what the classifier always asked', async () => {
  expect(strategyPrompt(BUILTIN.complexity, 'add a test')).toBe(classifierPrompt('add a test'))
})

test('another strategy keeps the reply format and kinds but uses its own rubric and score name', async () => {
  const p = strategyPrompt(BUILTIN.cost, 'add a test')
  expect(p).toContain('Reply with two words')
  expect(p).toContain('Kind: code')
  expect(p).toContain('Task: add a test')
  expect(p).not.toContain('Blast radius:')
})

test('parseStrategy reads JSON frontmatter and the rubric body', async () => {
  const s = parseStrategy(FILE, 'file-name')
  expect(s.name).toBe('frugal')
  expect(s.score).toBe('risk')
  expect(s.thresholds).toEqual({ simple: 6, coding: 9 })
  expect(s.routes).toEqual({ coding: 'deepseek/v4-pro', kinds: { review: 'kimi/pro' } })
  expect(s.rubric).toBe('1-6: anything that is not production.\n7-10: production deploys and data.')
  expect(strategyPrompt(s, 'x')).toContain('the risk from 1-10')
})

test('parseStrategy names a file without a name after the file, and refuses what would break routing', async () => {
  expect(parseStrategy('---\ndescription: d\n---\nrubric', 'mine').name).toBe('mine')
  expect(parseStrategy('no frontmatter', 'x').error).toMatch(/frontmatter/)
  expect(parseStrategy('---\nthresholds: {"simple": 8, "coding": 4}\n---\nr', 'x').error).toMatch(/simple.*below.*coding/)
  expect(parseStrategy('---\nroutes: not json\n---\nr', 'x').error).toMatch(/routes/)
  expect(parseStrategy('---\ndescription: d\n---\n', 'x').error).toMatch(/rubric/)
})

test('applyStrategy layers the strategy over the config, and complexity changes nothing', async () => {
  const cfg = parseConfig('')
  expect(applyStrategy(cfg, BUILTIN.complexity).routes).toEqual(cfg.routes)
  expect(applyStrategy(cfg, BUILTIN.complexity).thresholds).toEqual(cfg.thresholds)
  const s = parseStrategy(FILE, 'f')
  const out = applyStrategy(cfg, s)
  expect(out.thresholds).toEqual({ simple: 6, coding: 9 })
  expect(out.routes.coding).toBe('deepseek/v4-pro')
  expect(out.routes.simple).toBe(cfg.routes.simple)
  expect(out.routes.kinds.review).toBe('kimi/pro')
  expect(out.routes.kinds.research).toBe(cfg.routes.kinds.research)
  expect(out.strategy).toBe(s)
})

test('the built-ins pick sensible routes: cost and speed route more, quality keeps more on Claude', async () => {
  expect(BUILTIN.cost.thresholds.coding > DEFAULTS.thresholds.coding).toBe(true)
  expect(BUILTIN.quality.thresholds.coding < DEFAULTS.thresholds.coding).toBe(true)
  expect(BUILTIN.quality.routes.coding).toBe('claude/sonnet')
  expect(BUILTIN.speed.routes.simple).toBe('gemini/3.8-flash')
  for (const s of Object.values(BUILTIN)) expect((s.routes || {}).critical || 'claude').toMatch(/^claude/)
})

test('strategiesText lists every strategy, marks the current one and says where your own go', async () => {
  const t = strategiesText({ ...BUILTIN, frugal: parseStrategy(FILE, 'f') }, 'cost', '~/.claude/mixture-of-models/strategies')
  expect(t).toContain('* cost')
  expect(t).toContain('frugal (yours)')
  expect(t).toContain('/route strategy <name>')
  expect(t).toContain('~/.claude/mixture-of-models/strategies')
})
