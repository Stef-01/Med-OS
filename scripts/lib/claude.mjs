/* lib/claude.mjs - the one way the scripts call Claude: the official SDK (@anthropic-ai/sdk, a dev dependency, imported
   only when a call is made, so `npm test` runs with no node_modules), streamed, with a JSON schema on the reply so it
   parses as the object itself. A declined request is re-run on a fallback model inside the same call (server-side
   fallbacks); a refusal from every model, or a reply cut off by max_tokens, throws.
   Credentials: ANTHROPIC_API_KEY, or a profile from `ant auth login` (the SDK finds either). */

export const MODEL = process.env.OSCE_MODEL || 'claude-opus-5-5';

let client = null;
export async function getClient() {
  if (client) return client;
  let Anthropic;
  try { ({ default: Anthropic } = await import('@anthropic-ai/sdk')); }
  catch { throw new Error('The Anthropic SDK is not installed. Run: npm install'); }
  client = new Anthropic();
  return client;
}

/* one structured call -> the parsed object. content: a string or content blocks (text, image). */
export async function claudeJson({ system, content, schema, effort = 'high', maxTokens = 64000, model = MODEL, label = 'call' }) {
  const c = await getClient();
  const stream = c.beta.messages.stream({
    model,
    max_tokens: maxTokens,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: { effort, format: { type: 'json_schema', schema } },
    system,
    messages: [{ role: 'user', content }],
  });
  const res = await stream.finalMessage();
  if (res.stop_reason === 'refusal') throw new Error(`${label}: declined (${res.stop_details?.category || 'no category'})`);
  if (res.stop_reason === 'max_tokens') throw new Error(`${label}: the reply ran past max_tokens`);
  const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
  try { return { value: JSON.parse(text), model: res.model, usage: res.usage }; }
  catch { throw new Error(`${label}: the reply was not JSON`); }
}

export const imageBlock = (bytes, mime) => ({ type: 'image', source: { type: 'base64', media_type: mime, data: Buffer.from(bytes).toString('base64') } });
