// Bookwise AI endpoint — POST /.netlify/functions/ai
// Set ANTHROPIC_API_KEY (and optionally AI_MODEL) in Netlify → Site configuration → Environment variables.
// Without a key this returns 503 and the app falls back to its built-in engine.
const SYSTEM = `You are the assistant inside Bookwise, small-business accounting software for U.S. owners.
Use ONLY the JSON context you are given (the business's books and its 2026 tax analysis). Never invent figures.
Write plainly for a busy owner: short sentences, sentence case, no hype, no emoji. Use $ amounts from the context.
When you discuss tax, say it is an estimate and suggest confirming with a CPA when the decision is material.
Follow the requested output format exactly.`;

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: 'AI not configured' }, { status: 503 });
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Bad JSON' }, { status: 400 }); }
  const { task = 'ask', prompt = '', context = {} } = body;
  if (String(prompt).length > 4000) return Response.json({ error: 'Prompt too long' }, { status: 413 });
  const ctx = JSON.stringify(context).slice(0, 60000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'claude-sonnet-5-5',
        max_tokens: 900,
        system: SYSTEM,
        messages: [{ role: 'user', content: `Task: ${task}\n\nContext (JSON):\n${ctx}\n\nRequest:\n${prompt}` }],
      }),
    });
    if (!r.ok) return Response.json({ error: `Upstream ${r.status}` }, { status: 502 });
    const data = await r.json();
    const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
    return Response.json({ text, model: data.model });
  } catch (e) {
    return Response.json({ error: 'AI request failed' }, { status: 502 });
  }
};
