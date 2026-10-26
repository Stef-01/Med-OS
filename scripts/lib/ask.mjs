/* lib/ask.mjs - how a script reaches Claude, decided in one place: the SDK (lib/claude.mjs) when ANTHROPIC_API_KEY is set,
   else the Claude Code CLI on the signed-in subscription (lib/claude-cli.mjs). Both take { system, content, schema,
   effort, label } and return { value, model }.
     const { ask, api, how, name, via } = await claudeAsk();
       ask   the call;  api  true on the SDK;  how  'api' | 'cli' (recorded on what a writer makes)
       name  for a log line ("the API", "the Claude Code CLI");  via(model)  "<model> via the API", for a verdict */
export const viaApi = () => !!process.env.ANTHROPIC_API_KEY;
export async function claudeAsk() {
  if (viaApi()) { const { claudeJson, MODEL } = await import('./claude.mjs'); return { ask: claudeJson, api: true, how: 'api', name: 'the API', via: m => `${m || MODEL} via the API` }; }
  const { claudeCliJson, CLI_MODEL } = await import('./claude-cli.mjs');
  return { ask: claudeCliJson, api: false, how: 'cli', name: 'the Claude Code CLI', via: m => `${m || CLI_MODEL} via the Claude Code CLI` };
}
