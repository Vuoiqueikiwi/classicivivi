async function verifyPayhipSignature(signature, apiKey) {
  if (!signature) return false;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(apiKey));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const expected = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return signature === expected;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid request body", { status: 400 });
  }

  // Verifica firma Payhip
  const isValid = await verifyPayhipSignature(body.signature, env.PAYHIP_API_KEY);
  if (!isValid) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Accetta solo eventi "paid"
  if (body.type !== "paid") {
    return new Response("Ignored", { status: 200 });
  }

  // Estrai email acquirente
  const buyerEmail = body?.email;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!buyerEmail || !emailRegex.test(buyerEmail)) {
    return new Response("Missing or invalid email", { status: 400 });
  }

  // Determina il prefisso in base al prodotto acquistato
  const codePrefix = body.product_permalink === "jwiUH" ? "INF-" : "ICV-";

  // Cerca un codice active nel KV
  let foundCode = null;
  let foundMeta = null;
  let cursor = undefined;

  try {
    outer:
    while (true) {
      const listResult = await env.CODES.list({ limit: 100, cursor });
      for (const key of listResult.keys) {
        const value = await env.CODES.get(key.name);
        let entry;
        try { entry = JSON.parse(value); } catch { entry = { status: value }; }
        if ((entry.status === 'active' || entry.status === 'ACTIVE') && key.name.startsWith(codePrefix)) {
          foundCode = key.name;
          foundMeta = entry;
          break outer;
        }
      }
      if (listResult.list_complete) break;
      cursor = listResult.cursor;
    }
  } catch (err) {
    return new Response("KV error: " + err.message, { status: 503 });
  }

  if (!foundCode) {
    return new Response("No active codes available", { status: 500 });
  }

  // Marca il codice come usato PRIMA di inviare
  try {
    const usedEntry = Object.assign({}, foundMeta, { status: 'used' });
    await env.CODES.put(foundCode, JSON.stringify(usedEntry));
  } catch (err) {
    return new Response("KV error: " + err.message, { status: 503 });
  }

  // Invia email via Brevo
  const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { name: "I Classici Vivi", email: "info@classicivivi.it" },
      to: [{ email: buyerEmail }],
      templateId: 1,
      params: { code: foundCode },
    }),
  });

  if (!emailRes.ok) {
    const err = await emailRes.text();
    await env.CODES.put(foundCode, JSON.stringify(foundMeta));
    return new Response("Email error: " + err, { status: 500 });
  }

  return new Response("OK", { status: 200 });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
