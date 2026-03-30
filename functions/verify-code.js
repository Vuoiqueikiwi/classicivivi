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
        status: 200, headers: corsHeaders
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ valid: false, error: err.message }), {
      status: 500, headers: corsHeaders
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
