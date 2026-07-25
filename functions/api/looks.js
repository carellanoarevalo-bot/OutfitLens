// POST /api/looks -> guarda un look de una clienta
// body: { uid, garmentId, garmentNombre, imagen }

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const l = await request.json();
    if (!l.uid || !l.imagen) return json({ error: 'uid e imagen son requeridos' }, 400);
    const id = 'lk_' + Date.now();
    await env.DB.prepare(`
      INSERT INTO looks (id, uid, garment_id, garment_nombre, imagen, creado)
      VALUES (?,?,?,?,?,?)
    `).bind(id, l.uid, l.garmentId || '', l.garmentNombre || '', l.imagen, new Date().toISOString()).run();
    return json({ ok: true, id });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}
