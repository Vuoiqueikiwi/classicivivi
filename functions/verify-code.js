const ALLOWED_ORIGINS = [
  'https://classicivivi.it',
  'https://www.classicivivi.it'
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    const { code, deviceId } = body;

    if (!code || typeof code !== 'string') {
      return new Response(JSON.stringify({ valid: false }), {
        status: 400, headers: corsHeaders
      });
    }

    if (!deviceId || typeof deviceId !== 'string' || !UUID_REGEX.test(deviceId)) {
      return new Response(JSON.stringify({ valid: false }), {
        status: 400, headers: corsHeaders
      });
    }

    const normalizedCode = code.trim().toUpperCase();
    const value = await env.CODES.get(normalizedCode);

    if (value === null) {
      return new Response(JSON.stringify({ valid: false }), {
        status: 404, headers: corsHeaders
      });
    }

    // Parse JSON — fallback per valori vecchi tipo "ACTIVE"
    let entry;
    try {
      entry = JSON.parse(value);
    } catch {
      entry = { status: 'ACTIVE', devices: [] };
    }

    // Se il valore era una stringa semplice (es. "ACTIVE"), normalizza
    if (typeof entry !== 'object' || !Array.isArray(entry.devices)) {
      entry = { status: 'ACTIVE', devices: [] };
    }

    // Codice non attivo
    if (entry.status !== 'ACTIVE' && entry.status !== 'active') {
      return new Response(JSON.stringify({ valid: false }), {
        status: 200, headers: corsHeaders
      });
    }

    // Device già registrato
    if (entry.devices.includes(deviceId)) {
      return new Response(JSON.stringify({ valid: true, libro: entry.libro || 'promessi-sposi' }), {
        status: 200, headers: corsHeaders
      });
    }

    // Limite device raggiunto
    if (entry.devices.length >= 3) {
      return new Response(JSON.stringify({ valid: false, reason: 'device_limit' }), {
        status: 200, headers: corsHeaders
      });
    }

    // Nuovo device — registra e salva
    entry.devices.push(deviceId);
    await env.CODES.put(normalizedCode, JSON.stringify(entry));

    return new Response(JSON.stringify({ valid: true, libro: entry.libro || 'promessi-sposi' }), {
      status: 200, headers: corsHeaders
    });

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
