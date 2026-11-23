const express = require("express");
const {
  db,
  fallo,
  numero,
  principal,
  admin,
  catalogo,
  documentoProducto,
  categorias,
  ahora,
} = require("../services/firebaseStore");
const compras = require("../services/firebaseCompras");
const { fechasRetiroDisponibles } = require("../config/retiros");
const router = express.Router();
function ruta(method, path, acceso, fn, raw = false) {
  router[method](path, async (req, res, next) => {
    try {
      const u =
        acceso === "admin"
          ? await admin(req)
          : acceso === "usuario"
            ? await principal(req)
            : null;
      const data = await fn(req, u);
      res.json(raw ? data : { ok: true, data });
    } catch (e) {
      next(e);
    }
  });
}
async function docs(q) {
  return (await q.get()).docs.map((s) => s.data());
}
async function inventario() {
  const [productos, reservas, cats] = await Promise.all([
    catalogo(),
    compras.disponibles(),
    categorias(),
  ]);
  return productos.map((p) => {
    const r = reservas.get(p.firestore_id) || 0,
      d = Math.max(0, p.stock_actual - r);
    return {
      ...p,
      stock_fisico: p.stock_actual,
      unidades_reservadas: r,
      stock_disponible: d,
      estado_inventario:
        d === 0 ? "agotado" : d <= p.stock_minimo ? "bajo" : "normal",
      categoria:
        cats.find((c) => c.id_categoria === p.id_categoria)?.nombre || "",
    };
  });
}
const texto = (valor) => String(valor || "").toLowerCase();
const coincide = (valor, filtro) =>
  !filtro || filtro === "todos" || String(valor) === String(filtro);
ruta("get", "/health", null, () => ({ ok: true, almacen: "firestore" }), true);
ruta("post", "/auth/firebase", null, async (r) => ({
  usuario: await principal(r, true),
  token: r.get("Authorization").slice(7),
}));
ruta(
  "get",
  "/productos",
  null,
  async (r) => {
    const lista = await inventario();
    if (r.query.estado === "activo" || !r.get("Authorization"))
      return lista.filter((p) => p.estado);
    await admin(r);
    return lista;
  },
  true,
);
ruta(
  "get",
  "/productos/:id",
  null,
  async (r) => {
    const p = (await inventario()).find(
      (p) => p.id_producto === Number(r.params.id),
    );
    if (!p) throw fallo(404, "Producto inexistente.");
    if (!p.estado) {
      if (!r.get("Authorization") || r.query.estado === "activo")
        throw fallo(404, "Producto inexistente.");
      await admin(r);
    }
    return p;
  },
  true,
);
ruta("get", "/categorias", null, categorias, true);
ruta(
  "get",
  "/categorias/:id",
  null,
  async (r) => {
    const c = (await categorias()).find(
      (c) => c.id_categoria === Number(r.params.id),
    );
    if (!c) throw fallo(404, "Categoría inexistente.");
    return c;
  },
  true,
);
ruta("get", "/estadisticas-publicas", null, async () => ({
  total_productos: (await catalogo()).filter((p) => p.estado).length,
  total_categorias: (await categorias()).length,
}));
ruta("get", "/inventario/categorias", "admin", categorias);
ruta("get", "/inventario", "admin", async (r) => {
  const all = (await inventario()).filter((p) => p.estado);
  const productos = all.filter(
    (p) =>
      texto(p.nombre + " " + p.codigo).includes(texto(r.query.q)) &&
      coincide(p.id_categoria, r.query.categoria) &&
      coincide(p.estado_inventario, r.query.stock),
  );
  const campo = [
    "stock_actual",
    "stock_disponible",
    "stock_minimo",
    "nombre",
    "codigo",
  ].includes(r.query.orden)
    ? r.query.orden
    : "nombre";
  productos.sort(
    (a, b) =>
      (r.query.direccion === "desc" ? -1 : 1) *
      (typeof a[campo] === "number"
        ? a[campo] - b[campo]
        : String(a[campo]).localeCompare(String(b[campo]))),
  );
  const sum = (k) => all.reduce((a, p) => a + p[k], 0);
  return {
    productos,
    estadisticas: {
      total_productos: all.length,
      unidades_fisicas: sum("stock_fisico"),
      unidades_disponibles: sum("stock_disponible"),
      unidades_reservadas: sum("unidades_reservadas"),
      con_stock: all.filter((p) => p.stock_disponible > 0).length,
      stock_bajo: all.filter((p) => p.estado_inventario === "bajo").length,
      agotados: all.filter((p) => !p.stock_disponible).length,
    },
  };
});
const movimientos = () =>
  docs(
    db().collection("inventory_movements").orderBy("fecha_movimiento", "desc"),
  );
ruta("get", "/movimientos", "admin", async (r) =>
  (await movimientos()).filter(
    (m) =>
      coincide(m.tipo_movimiento, r.query.tipo) &&
      texto(m.producto + " " + m.codigo_producto).includes(texto(r.query.q)),
  ),
);
ruta("post", "/inventario/movimientos", "admin", async (r, u) => {
  const { id_producto, tipo_movimiento, cantidad, motivo } = r.body;
  if (
    !["entrada", "salida"].includes(tipo_movimiento) ||
    !Number.isSafeInteger(cantidad) ||
    cantidad < 1 ||
    typeof motivo !== "string" ||
    !motivo.trim() ||
    motivo.length > 440
  )
    throw fallo(400, "Movimiento inválido.");
  const ref = await documentoProducto(id_producto);
  return db().runTransaction(async (tx) => {
    const [p, h] = await tx.getAll(ref, compras.refStock(ref.id));
    const stock =
      p.data().stock_actual +
      (tipo_movimiento === "entrada" ? cantidad : -cantidad);
    if (stock < compras.reservado(h.data()?.holds))
      throw fallo(409, "Stock disponible insuficiente.");
    tx.update(ref, { stock_actual: stock });
    const m = db().collection("inventory_movements").doc();
    tx.create(m, {
      id_movimiento: numero(m.id),
      id_producto,
      producto: p.data().nombre,
      codigo_producto: p.data().codigo,
      cantidad,
      tipo_movimiento,
      motivo,
      fecha_movimiento: ahora(),
      usuario: u.nombre,
      id_usuario: u.id_usuario,
    });
    return { stock_actual: stock };
  });
});
ruta("get", "/dashboard", "admin", async () => {
  const [productos, cats, movs] = await Promise.all([
    inventario(),
    categorias(),
    movimientos(),
  ]);
  const activos = productos.filter((p) => p.estado),
    bajos = activos.filter((p) => p.stock_actual <= p.stock_minimo);
  return {
    resumen: {
      total_productos: activos.length,
      total_categorias: cats.length,
      productos_stock_bajo: bajos.length,
      total_movimientos: movs.length,
    },
    stock_bajo: bajos
      .sort((a, b) => a.stock_actual - b.stock_actual)
      .slice(0, 5),
    movimientos_recientes: movs.slice(0, 5),
  };
});
ruta("get", "/carrito", "usuario", (r, u) => compras.leerCarrito(u.uid));
ruta("post", "/carrito/items", "usuario", (r, u) => {
  if (!Number.isSafeInteger(r.body.cantidad) || r.body.cantidad < 1)
    throw fallo(400, "Cantidad inválida.");
  return compras.modificarCarrito(u.uid, r.body.id_producto, r.body.cantidad);
});
ruta("delete", "/carrito/items/:id", "usuario", (r, u) =>
  compras.modificarCarrito(u.uid, r.params.id, 0),
);
ruta("delete", "/carrito", "usuario", (r, u) => compras.vaciar(u.uid));
ruta("post", "/carrito/checkout", "usuario", (r, u) =>
  compras.checkout(u, r.body),
);
ruta("get", "/pedidos/fechas-retiro", null, () => fechasRetiroDisponibles());
async function pedidos(uid, q) {
  const col = db().collection("orders");
  return (await docs(uid ? col.where("uid", "==", uid) : col))
    .filter(
      (p) =>
        coincide(p.estado_pedido, q.estado) &&
        texto(p.codigo_pedido + " " + p.nombre_cliente).includes(texto(q.q)) &&
        (!q.desde || p.fecha_pedido.slice(0, 10) >= q.desde) &&
        (!q.hasta || p.fecha_pedido.slice(0, 10) <= q.hasta),
    )
    .sort((a, b) => b.fecha_pedido.localeCompare(a.fecha_pedido));
}
async function detalle(id, uid) {
  const [p] = await docs(
    db().collection("orders").where("id_pedido", "==", Number(id)).limit(1),
  );
  if (!p || (uid && p.uid !== uid)) throw fallo(404, "Pedido inexistente.");
  return p;
}
ruta("get", "/mis-pedidos", "usuario", (r, u) => pedidos(u.uid, r.query));
ruta("get", "/pedidos/:id", "usuario", (r, u) => detalle(r.params.id, u.uid));
ruta("get", "/admin/pedidos", "admin", async (r) => {
  const lista = await pedidos(null, r.query);
  const cuenta = (e) => lista.filter((p) => p.estado_pedido === e).length;
  return {
    pedidos: lista,
    indicadores: {
      total_pedidos: lista.length,
      pendientes: cuenta("pendiente"),
      pagados: cuenta("pagado"),
      cancelados: cuenta("cancelado"),
    },
  };
});
ruta("get", "/admin/pedidos/:id", "admin", (r) => detalle(r.params.id));
ruta("patch", "/admin/pedidos/:id", "admin", (r, u) =>
  compras.cambiarPedido(u, r.params.id, r.body.accion, r.body.motivo),
);
for (const [prefijo, acceso] of [
  ["/mis-notificaciones", "usuario"],
  ["/notificaciones", "admin"],
]) {
  const para = (u) =>
    db()
      .collection("notifications")
      .where("uid", "==", acceso === "admin" ? "@admin" : u.uid);
  ruta("get", prefijo, acceso, async (r, u) => {
    const lista = (await docs(para(u))).sort((a, b) =>
      b.fecha_creacion.localeCompare(a.fecha_creacion),
    );
    return {
      notificaciones: lista,
      no_leidas: lista.filter((n) => !n.leida).length,
    };
  });
  ruta("patch", prefijo + "/leidas", acceso, async (r, u) => {
    const snap = await para(u).where("leida", "==", false).get();
    await Promise.all(snap.docs.map((d) => d.ref.update({ leida: true })));
    return { actualizadas: snap.size };
  });
  ruta("patch", prefijo + "/:id/leida", acceso, async (r, u) => {
    const doc = (
      await para(u)
        .where("id_notificacion", "==", Number(r.params.id))
        .limit(1)
        .get()
    ).docs[0];
    if (!doc) throw fallo(404, "Notificación inexistente.");
    await doc.ref.update({ leida: true });
    return { leida: true };
  });
}
module.exports = { router, ruta };
