// GET  /api/pedidos  -> lista todos los pedidos (uso admin)
// POST /api/pedidos  -> una clienta envía su carrito como pedido pendiente
// body: { uid, cliente:{nombre,telefono,genero,tipo}, items:[...], total }
// Nota: las prendas quedan reservadas (estado 'en_carrito') hasta que el
// administrador apruebe o rechace el pedido — ver /api/pedidos/[id].js

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function rowToPedido(r) {
  return {
    id: r.id,
    uid: r.uid || null,
    cliente: { nombre: r.cliente_nombre, telefono: r.cliente_telefono, genero: r.cliente_genero, tipo: r.cliente_tipo },
    items: r.items ? JSON.parse(r.items) : [],
    total: r.total,
    estado: r.estado,
    fecha: r.fecha,
    ticketId: r.ticket_id || null
  };
}

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM pedidos ORDER BY fecha DESC'
    ).all();
    return json(results.map(rowToPedido));
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { uid = null, cliente = {}, items = [], total = 0 } = body;
    if (!cliente.nombre) return json({ error: 'cliente.nombre es requerido' }, 400);
    const id = 'pd_' + Date.now();
    const fecha = new Date().toISOString();
    await env.DB.prepare(`
      INSERT INTO pedidos (id, uid, cliente_nombre, cliente_telefono, cliente_genero, cliente_tipo, items, total, estado, fecha)
      VALUES (?,?,?,?,?,?,?,?, 'pendiente', ?)
    `).bind(id, uid, cliente.nombre, cliente.telefono || '', cliente.genero || '', cliente.tipo || '', JSON.stringify(items), total, fecha).run();

    return json(rowToPedido({
      id, uid, cliente_nombre: cliente.nombre, cliente_telefono: cliente.telefono,
      cliente_genero: cliente.genero, cliente_tipo: cliente.tipo,
      items: JSON.stringify(items), total, estado: 'pendiente', fecha
    }));
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}
