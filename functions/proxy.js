const ALLOWED_ORIGINS = ['https://classicivivi.it', 'https://www.classicivivi.it'];

function getCorsOrigin(request) {
  const origin = request.headers.get('Origin') || '';
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsOrigin = getCorsOrigin(request);
  try {
    // ── AUTH CHECK ──
    const accessCodeRaw = request.headers.get('X-Access-Code');
    if (!accessCodeRaw) {
      return new Response(JSON.stringify({ error: 'Access code required' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': corsOrigin
        }
      });
    }
    // Decode from Base64 (frontend stores btoa(code))
    let accessCode;
    try {
      accessCode = atob(accessCodeRaw).trim().toUpperCase();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid access code format' }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': corsOrigin
        }
      });
    }
    const CODES = env.CODES;
    if (!CODES) {
      return new Response(JSON.stringify({ error: 'Service unavailable' }), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': corsOrigin
        }
      });
    }
    const value = await CODES.get(accessCode);
    if (value === null) {
      return new Response(JSON.stringify({ error: 'Invalid or expired code' }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': corsOrigin
        }
      });
    }
    // ── END AUTH CHECK ──

    const body = await request.json();
    const { messages, model } = body;
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': corsOrigin
        }
      });
    }
    const GROQ_API_KEY = env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      return new Response(JSON.stringify({ error: 'Missing API key' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': corsOrigin
        }
      });
    }
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: model || 'llama-3.3-70b-versatile',
        messages: messages,
        max_tokens: 1024,
        temperature: 0.8
      })
    });
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': corsOrigin
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': corsOrigin
      }
    });
  }
}

export async function onRequestOptions({ request }) {
  const corsOrigin = getCorsOrigin(request);
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Access-Code'
    }
  });
}
