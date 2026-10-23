/* lib/claude-cli.mjs - the same `ask` contract as claude.mjs claudeJson, served by the Claude Code CLI (`claude -p`) on the
   signed-in subscription instead of an API key. Used by import-amsa.mjs when ANTHROPIC_API_KEY is not set: the CLI runs
   one print-mode turn with the system prompt (a file) and a JSON schema (--json-schema) and returns the parsed object in
   `structured_output`. Nothing else differs: the writer, examiner and exam prompts in generate.mjs are unchanged.
   Requires `claude` on PATH and a login. Model names are the CLI's aliases (opus, sonnet). */
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const CLI_MODEL = process.env.OSCE_CLI_MODEL || 'opus';

/* the real executable, not the npm shim, so no shell is involved and the schema survives quoting */
let exe = null;
function claudeExe() {
  if (exe) return exe;
  const which = process.platform === 'win32' ? 'where claude' : 'command -v claude';
  const found = execSync(which, { encoding: 'utf8' }).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const shim = found.find(f => !/\.(cmd|ps1)$/i.test(f)) || found[0];
  if (!shim) throw new Error('claude is not on PATH');
  const direct = path.join(path.dirname(shim), 'node_modules', '@anthropic-ai', 'claude-code', 'bin', process.platform === 'win32' ? 'claude.exe' : 'claude');
  exe = fs.existsSync(direct) ? direct : shim;
  return exe;
}

export async function claudeCliJson({ system, content, schema, effort = 'high', model = CLI_MODEL, label = 'call' }) {
  if (typeof content !== 'string') throw new Error(`${label}: the CLI adapter takes text content only`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'osce-cli-'));
  const sysFile = path.join(tmp, 'system.txt');
  fs.writeFileSync(sysFile, system);
  const args = ['-p', '--model', model, '--effort', effort, '--output-format', 'json', '--json-schema', JSON.stringify(schema),
    '--system-prompt-file', sysFile, '--tools', '', '--no-session-persistence',
    /* a plain model call: no MCP servers, hooks, plugins or settings from this machine (they add ~460k tokens a call otherwise) */
    '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--setting-sources', '', '--disable-slash-commands'];
  const env = { ...process.env };
  delete env.CLAUDECODE; delete env.CLAUDE_CODE_ENTRYPOINT;   /* the CLI refuses to nest inside a Claude Code session otherwise */
  const out = await new Promise((resolve, reject) => {
    const p = spawn(claudeExe(), args, { env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let so = '', se = '';
    p.stdout.on('data', d => { so += d; }); p.stderr.on('data', d => { se += d; });
    p.on('error', reject);
    p.on('close', code => (code === 0 || so.trim()) ? resolve(so) : reject(new Error(`${label}: claude exited ${code}: ${se.slice(0, 400)}`)));
    p.stdin.end(content);
  });
  fs.rmSync(tmp, { recursive: true, force: true });
  const line = out.split('\n').find(l => l.startsWith('{') && /"type":"result"/.test(l));
  if (!line) throw new Error(`${label}: no result line from the CLI: ${out.slice(0, 400)}`);
  const res = JSON.parse(line);
  if (res.is_error) throw new Error(`${label}: ${String(res.result).slice(0, 300)}`);
  if (!res.structured_output) throw new Error(`${label}: the CLI returned no structured output`);
  const used = res.modelUsage ? Object.keys(res.modelUsage)[0] : model;
  return { value: res.structured_output, model: used, usage: res.usage };
}
