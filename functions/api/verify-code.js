export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return new Response(JSON.stringify({ valid: false, error: 'Codice mancante' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Normalizza il codice: maiuscolo, rimuovi spazi
    const normalizedCode = code.trim().toUpperCase();

    // Verifica nel KV
    const value = await env.CODES.get(normalizedCode);

    if (value !== null) {
      // Codice trovato — è valido
      return new Response(JSON.stringify({ valid: true }), {
        status: 200,
        headers: corsHeaders
      });
    } else {
      // Codice non trovato
      return new Response(JSON.stringify({ valid: false }), {
        status: 200,
        headers: corsHeaders
      });
    }

  } catch (err) {
    return new Response(JSON.stringify({ valid: false, error: err.message }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
