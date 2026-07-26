// PATCH /api/pedidos/:id
// body: { accion: 'aprobar' | 'rechazar' }
// aprobar  -> asigna folio secuencial, crea el ticket real, marca las prendas
//             del pedido como 'vendido', y marca el pedido como 'aprobado'.
// rechazar -> libera las prendas del pedido (vuelven a 'disponible', y por lo
//             tanto reaparecen en el catálogo), y marca el pedido 'rechazado'.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function rowToTicket(r) {
  return {
    id: r.id, numero: r.numero, folio: r.folio, fecha: r.fecha,
    cliente: { nombre: r.cliente_nombre, telefono: r.cliente_telefono, genero: r.cliente_genero, tipo: r.cliente_tipo, uid: r.cliente_uid || null },
    items: r.items ? JSON.parse(r.items) : [],
    total: r.total
  };
}

export async function onRequestPatch({ params, request, env }) {
  try {
    const id = params.id;
    const body = await request.json();
    const accion = body.accion;

    const pedido = await env.DB.prepare('SELECT * FROM pedidos WHERE id = ?').bind(id).first();
    if (!pedido) return json({ error: 'Pedido no encontrado' }, 404);
    if (pedido.estado !== 'pendiente') return json({ error: 'Este pedido ya fue procesado' }, 409);

    const items = pedido.items ? JSON.parse(pedido.items) : [];

    if (accion === 'rechazar') {
      const stmts = [
        env.DB.prepare("UPDATE pedidos SET estado = 'rechazado' WHERE id = ?").bind(id)
      ];
      items.forEach(it => {
        if (it.garmentId) stmts.push(env.DB.prepare("UPDATE garments SET estado = 'disponible' WHERE id = ?").bind(it.garmentId));
      });
      await env.DB.batch(stmts);
      return json({ ok: true, estado: 'rechazado' });
    }

    if (accion === 'aprobar') {
      const cur = await env.DB.prepare("SELECT valor FROM counters WHERE clave = 'ticketSeq'").first();
      const numero = ((cur && cur.valor) || 0) + 1;
      const folio = 'OL-' + String(numero).padStart(6, '0');
      const ticketId = 'tk_' + Date.now();
      const fecha = new Date().toISOString();

      const stmts = [
        env.DB.prepare("UPDATE counters SET valor = ? WHERE clave = 'ticketSeq'").bind(numero),
        env.DB.prepare(`
          INSERT INTO tickets (id, numero, folio, fecha, cliente_nombre, cliente_telefono, cliente_genero, cliente_tipo, items, total, cliente_uid)
          VALUES (?,?,?,?,?,?,?,?,?,?,?)
        `).bind(ticketId, numero, folio, fecha, pedido.cliente_nombre, pedido.cliente_telefono, pedido.cliente_genero, pedido.cliente_tipo, pedido.items, pedido.total, pedido.uid),
        env.DB.prepare("UPDATE pedidos SET estado = 'aprobado', ticket_id = ? WHERE id = ?").bind(ticketId, id)
      ];
      items.forEach(it => {
        if (it.garmentId) stmts.push(env.DB.prepare("UPDATE garments SET estado = 'vendido' WHERE id = ?").bind(it.garmentId));
      });
      await env.DB.batch(stmts);

      return json({
        ok: true, estado: 'aprobado',
        ticket: rowToTicket({
          id: ticketId, numero, folio, fecha,
          cliente_nombre: pedido.cliente_nombre, cliente_telefono: pedido.cliente_telefono,
          cliente_genero: pedido.cliente_genero, cliente_tipo: pedido.cliente_tipo, cliente_uid: pedido.uid,
          items: pedido.items, total: pedido.total
        })
      });
    }

    return json({ error: 'accion inválida' }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}
