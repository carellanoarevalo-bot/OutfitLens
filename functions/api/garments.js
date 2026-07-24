// GET  /api/garments   -> lista todas las prendas
// POST /api/garments   -> crea o actualiza (upsert) una prenda
// Requiere binding D1 llamado "DB" en la configuración del proyecto de
// Cloudflare Pages (Settings → Functions → D1 database bindings).

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function rowToGarment(r) {
  return {
    id: r.id,
    nombre: r.nombre,
    categoriaPrincipal: r.categoria_principal || 'Ropa',
    categoria: r.categoria,
    genero: r.genero,
    precio: r.precio,
    tallas: r.tallas ? JSON.parse(r.tallas) : [],
    combinaCon: r.combina_con ? JSON.parse(r.combina_con) : [],
    imagen: r.imagen,
    activo: r.activo === 1,
    estado: r.estado || 'disponible',
    creado: r.creado
  };
}

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM garments ORDER BY creado DESC'
    ).all();
    return json(results.map(rowToGarment));
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const g = await request.json();
    if (!g.id || !g.nombre) return json({ error: 'id y nombre son requeridos' }, 400);

    await env.DB.prepare(`
      INSERT INTO garments
        (id, nombre, categoria, genero, precio, tallas, combina_con, imagen, activo, creado, categoria_principal, estado)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        nombre=excluded.nombre,
        categoria=excluded.categoria,
        genero=excluded.genero,
        precio=excluded.precio,
        tallas=excluded.tallas,
        combina_con=excluded.combina_con,
        imagen=excluded.imagen,
        activo=excluded.activo,
        categoria_principal=excluded.categoria_principal,
        estado=excluded.estado
    `).bind(
      g.id,
      g.nombre,
      g.categoria || '',
      g.genero || '',
      g.precio || 0,
      JSON.stringify(g.tallas || []),
      JSON.stringify(g.combinaCon || []),
      g.imagen || '',
      g.activo === false ? 0 : 1,
      g.creado || new Date().toISOString(),
      g.categoriaPrincipal || 'Ropa',
      g.estado || 'disponible'
    ).run();

    return json({ ok: true, id: g.id });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}
