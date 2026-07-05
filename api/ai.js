// Proxy server-side hacia Google Gemini (version Vercel). La key nunca llega
// al navegador: vive solo como variable de entorno (GEMINI_API_KEY) en Vercel.
const MODELS = ['gemini-flash-latest', 'gemini-2.0-flash', 'gemini-1.5-flash'];

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'GEMINI_API_KEY no configurada en Vercel' });
  }
  const parts = req.body?.parts;
  if (!Array.isArray(parts) || !parts.length) {
    return res.status(400).json({ error: 'Falta "parts"' });
  }

  let lastErr = '';
  for (const model of MODELS) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-goog-api-key': key },
          body: JSON.stringify({ contents: [{ parts }] }),
        }
      );
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        const text = (d.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
        if (text) return res.status(200).json({ text });
        lastErr = 'respuesta vacía';
      } else {
        lastErr = d.error?.message || `HTTP ${r.status}`;
        if (/API key|API_KEY/i.test(lastErr)) break;
      }
    } catch (e) {
      lastErr = e.message;
    }
  }
  return res.status(502).json({ error: 'Gemini: ' + lastErr });
};
