// GET /api/users/:uid -> { profile, tickets, looks, pedidos }

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function rowToTicket(r) {
  return {
    id: r.id, numero: r.numero, folio: r.folio, fecha: r.fecha,
    cliente: { nombre: r.cliente_nombre, telefono: r.cliente_telefono, genero: r.cliente_genero, tipo: r.cliente_tipo },
    items: r.items ? JSON.parse(r.items) : [],
    total: r.total
  };
}
function rowToPedido(r) {
  return {
    id: r.id, estado: r.estado, fecha: r.fecha, total: r.total,
    items: r.items ? JSON.parse(r.items) : []
  };
}

export async function onRequestGet({ params, env }) {
  try {
    const uid = params.uid;
    const profile = await env.DB.prepare('SELECT * FROM usuarios WHERE uid = ?').bind(uid).first();
    const { results: ticketRows } = await env.DB.prepare(
      'SELECT * FROM tickets WHERE cliente_uid = ? ORDER BY numero DESC'
    ).bind(uid).all();
    const { results: lookRows } = await env.DB.prepare(
      'SELECT * FROM looks WHERE uid = ? ORDER BY creado DESC'
    ).bind(uid).all();
    const { results: pedidoRows } = await env.DB.prepare(
      "SELECT * FROM pedidos WHERE uid = ? AND estado != 'aprobado' ORDER BY fecha DESC"
    ).bind(uid).all();

    return json({
      profile: profile || null,
      tickets: ticketRows.map(rowToTicket),
      looks: lookRows.map(l => ({ id: l.id, garmentId: l.garment_id, garmentNombre: l.garment_nombre, imagen: l.imagen, creado: l.creado })),
      pedidos: pedidoRows.map(rowToPedido)
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}
