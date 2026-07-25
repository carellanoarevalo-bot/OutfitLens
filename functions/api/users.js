// POST /api/users            -> crea o actualiza el perfil de una clienta (uid de Firebase)
// GET  /api/users/:uid        -> perfil + historial de compras + looks guardados de esa clienta

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const u = await request.json();
    if (!u.uid) return json({ error: 'uid es requerido' }, 400);
    await env.DB.prepare(`
      INSERT INTO usuarios (uid, email, nombre, telefono, creado)
      VALUES (?,?,?,?,?)
      ON CONFLICT(uid) DO UPDATE SET
        email=excluded.email, nombre=excluded.nombre, telefono=excluded.telefono
    `).bind(u.uid, u.email || '', u.nombre || '', u.telefono || '', u.creado || new Date().toISOString()).run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}
