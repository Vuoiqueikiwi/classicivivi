const ALLOWED_ORIGINS = [
  'https://classicivivi.it',
  'https://www.classicivivi.it'
];

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ valid: false }), {
        status: 400, headers: corsHeaders
      });
    }

    const { code } = body;
    if (!code || typeof code !== 'string') {
      return new Response(JSON.stringify({ valid: false }), {
        status: 400, headers: corsHeaders
      });
    }

    const normalizedCode = code.trim().toUpperCase();
    const value = await env.CODES.get(normalizedCode);

    if (value !== null) {
      return new Response(JSON.stringify({ valid: true }), {
        status: 200, headers: corsHeaders
      });
    } else {
      return new Response(JSON.stringify({ valid: false }), {
        status: 404, headers: corsHeaders
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ valid: false, error: err.message }), {
      status: 500, headers: corsHeaders
    });
  }
}

export async function onRequestOptions(context) {
  const corsHeaders = getCorsHeaders(context.request);
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}
