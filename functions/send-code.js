export async function onRequestPost(context) {
  const { request, env } = context;

  // Verifica webhook secret Payhip
  const payhipSecret = request.headers.get("X-Payhip-Secret");
  if (!payhipSecret || payhipSecret !== env.PAYHIP_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();

  // Estrai email acquirente da Payhip
  const buyerEmail = body?.buyer?.email;
  if (!buyerEmail) {
    return new Response("Missing email", { status: 400 });
  }

  // Cerca un codice ACTIVE nel KV
  let foundCode = null;
  let cursor = undefined;

  outer:
  while (true) {
    const listResult = await env.CODES.list({ limit: 100, cursor });

    for (const key of listResult.keys) {
      const value = await env.CODES.get(key.name);
      if (value === "ACTIVE") {
        foundCode = key.name;
        break outer;
      }
    }

    if (listResult.list_complete) break;
    cursor = listResult.cursor;
  }

  if (!foundCode) {
    return new Response("No active codes available", { status: 500 });
  }

  // Marca il codice come usato PRIMA di inviare (evita doppio uso)
  await env.CODES.put(foundCode, "USED");

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
      subject: "Il tuo accesso a I Classici Vivi 🎓",
      htmlContent: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px; background: #080808; color: #F5E6C8;">
          <h1 style="color: #C9A84C; font-size: 28px;">I Classici Vivi</h1>
          <p>Grazie per il tuo acquisto! Ecco il tuo codice di accesso personale:</p>
          <div style="background: #1a1a1a; border: 2px solid #C9A84C; padding: 20px; text-align: center; margin: 30px 0; border-radius: 8px;">
            <span style="font-size: 28px; font-weight: bold; color: #C9A84C; letter-spacing: 4px;">${foundCode}</span>
          </div>
          <p>Vai su <a href="https://classicivivi.it/accedi" style="color: #C9A84C;">classicivivi.it/accedi</a> e inserisci il codice per accedere al tuo kit.</p>
          <p style="color: #999; font-size: 12px; margin-top: 40px;">Conserva questa email — il codice è personale e non trasferibile.</p>
        </div>
      `,
    }),
  });

  if (!emailRes.ok) {
    const err = await emailRes.text();
    // Ripristina il codice se l'email fallisce
    await env.CODES.put(foundCode, "ACTIVE");
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
