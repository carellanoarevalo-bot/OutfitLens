// DELETE /api/garments/:id           -> elimina FÍSICAMENTE la fila de D1 (uso: "subí por error")
// PATCH  /api/garments/:id           -> cambia estado: 'disponible' | 'en_carrito' | 'vendido'
//   body: { estado: 'en_carrito', esperado: 'disponible' }
//   La actualización es condicional (WHERE estado = esperado) para evitar que
//   dos clientas reserven la misma prenda única al mismo tiempo.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestDelete({ params, env }) {
  try {
    await env.DB.prepare('DELETE FROM garments WHERE id = ?').bind(params.id).run();
    return json({ ok: true, deleted: params.id });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}

export async function onRequestPatch({ params, request, env }) {
  try {
    const body = await request.json();
    const nuevoEstado = body.estado;
    const esperado = body.esperado || null;

    if (!['disponible', 'en_carrito', 'vendido'].includes(nuevoEstado)) {
      return json({ error: 'estado inválido' }, 400);
    }

    let result;
    if (esperado) {
      result = await env.DB.prepare(
        'UPDATE garments SET estado = ? WHERE id = ? AND estado = ?'
      ).bind(nuevoEstado, params.id, esperado).run();
    } else {
      result = await env.DB.prepare(
        'UPDATE garments SET estado = ? WHERE id = ?'
      ).bind(nuevoEstado, params.id).run();
    }

    const changed = result.meta && result.meta.changes ? result.meta.changes : 0;
    if (changed === 0) {
      return json({ ok: false, reservado_por_otro: true }, 409);
    }
    return json({ ok: true, id: params.id, estado: nuevoEstado });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}
