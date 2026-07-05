// Proxy server-side hacia Google Gemini. La key nunca llega al navegador:
// vive solo como variable de entorno (GEMINI_API_KEY) en Netlify.
const MODELS = ['gemini-flash-latest', 'gemini-2.0-flash', 'gemini-1.5-flash'];

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return { statusCode: 500, body: JSON.stringify({ error: 'GEMINI_API_KEY no configurada en Netlify' }) };
  }
  let parts;
  try {
    parts = JSON.parse(event.body || '{}').parts;
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body inválido' }) };
  }
  if (!Array.isArray(parts) || !parts.length) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Falta "parts"' }) };
  }

  let lastErr = '';
  for (const model of MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-goog-api-key': key },
          body: JSON.stringify({ contents: [{ parts }] }),
        }
      );
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        const text = (d.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
        if (text) return { statusCode: 200, body: JSON.stringify({ text }) };
        lastErr = 'respuesta vacía';
      } else {
        lastErr = d.error?.message || `HTTP ${res.status}`;
        if (/API key|API_KEY/i.test(lastErr)) break;
      }
    } catch (e) {
      lastErr = e.message;
    }
  }
  return { statusCode: 502, body: JSON.stringify({ error: 'Gemini: ' + lastErr }) };
};
