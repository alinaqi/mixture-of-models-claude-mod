// What Cursor needs to run mom: the hooks (.cursor/hooks.json) and the MCP server (.cursor/mcp.json),
// the same entries the Cursor plugin ships, merged into a project's files without dropping what is
// there. Pure: JSON in, JSON out.

export const SERVER = 'mixture-of-models'
const COMMAND = 'mom hook cursor'

// Timeouts in seconds. The stop waits for Palgu's verdict (8 s at most); loop_limit caps the
// follow-ups at mom's own budget of 3 per prompt.
export function cursorHooks() {
  return {
    version: 1,
    hooks: {
      sessionStart: [{ command: COMMAND, timeout: 10 }],
      beforeSubmitPrompt: [{ command: COMMAND, timeout: 5 }],
      afterAgentResponse: [{ command: COMMAND, timeout: 5 }],
      stop: [{ command: COMMAND, timeout: 15, loop_limit: 3 }]
    }
  }
}

// workspace: tell the server the project folder (Cursor expands ${workspaceFolder} in a project's
// .cursor/mcp.json). The plugin's copy leaves it out and relies on the client's roots.
export function cursorMcp(workspace) {
  const server = { command: 'mom', args: ['mcp', 'cursor'], ...(workspace ? { env: { MOM_PROJECT_DIR: '${workspaceFolder}' } } : {}) }
  return { mcpServers: { [SERVER]: server } }
}

const isObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v)

function mergeEvent(list, ours) {
  const have = Array.isArray(list) ? list : []
  return have.some((h) => h && h.command === COMMAND) ? have : [...have, ...ours]
}

export function mergeHooks(existing, ours) {
  const base = isObject(existing) ? existing : {}
  const hooks = isObject(base.hooks) ? { ...base.hooks } : {}
  for (const [event, list] of Object.entries(ours.hooks)) hooks[event] = mergeEvent(hooks[event], list)
  return { ...base, version: base.version || ours.version, hooks }
}

export function mergeMcp(existing, ours) {
  const base = isObject(existing) ? existing : {}
  const servers = isObject(base.mcpServers) ? base.mcpServers : {}
  return { ...base, mcpServers: { ...servers, ...ours.mcpServers } }
}
