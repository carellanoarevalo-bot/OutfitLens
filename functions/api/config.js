// GET  /api/config  -> { nombreTienda, whatsappTienda }
// POST /api/config  -> guarda ambos valores

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare('SELECT clave, valor FROM config').all();
    const cfg = {};
    results.forEach(r => { cfg[r.clave] = r.valor; });
    return json(cfg);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const stmts = Object.entries(body).map(([clave, valor]) =>
      env.DB.prepare(
        'INSERT INTO config (clave, valor) VALUES (?,?) ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor'
      ).bind(clave, String(valor))
    );
    await env.DB.batch(stmts);
    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}
