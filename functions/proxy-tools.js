const CORS_ORIGINS = ["https://classicivivi.it","https://www.classicivivi.it"];

function getCorsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = CORS_ORIGINS.includes(origin) ? origin : CORS_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: getCorsHeaders(request) });
}

export async function onRequestPost({ request, env }) {
  const corsHeaders = getCorsHeaders(request);
  try {
    const { messages, model, system } = await request.json();
    const groqModel = model || "llama-3.3-70b-versatile";
    const groqMessages = [];
    if (system) { groqMessages.push({ role: "system", content: system }); }
    groqMessages.push(...messages);
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({ model: groqModel, messages: groqMessages, max_tokens: 2048 }),
    });
    const data = await groqRes.json();
    return new Response(JSON.stringify(data), {
      status: groqRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
