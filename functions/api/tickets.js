// GET  /api/tickets  -> lista todos los tickets
// POST /api/tickets   -> crea un ticket: asigna folio secuencial atómico,
//                        guarda datos de la clienta y marca las prendas
//                        vendidas como 'vendido' en la misma operación.
// body: { cliente:{nombre,telefono,genero,tipo}, items:[...], total }

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function rowToTicket(r) {
  return {
    id: r.id,
    numero: r.numero,
    folio: r.folio,
    fecha: r.fecha,
    cliente: {
      nombre: r.cliente_nombre,
      telefono: r.cliente_telefono,
      genero: r.cliente_genero,
      tipo: r.cliente_tipo
    },
    items: r.items ? JSON.parse(r.items) : [],
    total: r.total
  };
}

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM tickets ORDER BY numero DESC'
    ).all();
    return json(results.map(rowToTicket));
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { cliente = {}, items = [], total = 0 } = body;
    if (!cliente.nombre) return json({ error: 'cliente.nombre es requerido' }, 400);

    // 1) Folio secuencial: leer contador, incrementar y guardar.
    const cur = await env.DB.prepare(
      "SELECT valor FROM counters WHERE clave = 'ticketSeq'"
    ).first();
    const numero = ((cur && cur.valor) || 0) + 1;
    const folio = 'OL-' + String(numero).padStart(6, '0');
    const id = 'tk_' + Date.now();
    const fecha = new Date().toISOString();

    const stmts = [
      env.DB.prepare("UPDATE counters SET valor = ? WHERE clave = 'ticketSeq'").bind(numero),
      env.DB.prepare(`
        INSERT INTO tickets (id, numero, folio, fecha, cliente_nombre, cliente_telefono, cliente_genero, cliente_tipo, items, total)
        VALUES (?,?,?,?,?,?,?,?,?,?)
      `).bind(id, numero, folio, fecha, cliente.nombre, cliente.telefono || '', cliente.genero || '', cliente.tipo || '', JSON.stringify(items), total)
    ];
    // 2) Marcar cada prenda vendida como 'vendido' (ya no vuelve al catálogo).
    for (const it of items) {
      if (it.garmentId) {
        stmts.push(env.DB.prepare("UPDATE garments SET estado = 'vendido' WHERE id = ?").bind(it.garmentId));
      }
    }
    await env.DB.batch(stmts);

    return json(rowToTicket({
      id, numero, folio, fecha,
      cliente_nombre: cliente.nombre, cliente_telefono: cliente.telefono,
      cliente_genero: cliente.genero, cliente_tipo: cliente.tipo,
      items: JSON.stringify(items), total
    }));
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}
