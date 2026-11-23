const { router, ruta } = require("./firebase");
const {
  app,
  db,
  fallo,
  ahora,
  numero,
  admin,
  documentoProducto,
  producto,
} = require("../services/firebaseStore");
const { refStock, reservado } = require("../services/firebaseCompras");
const { getAuth } = require("firebase-admin/auth");
const {
  subirImagenesProducto,
} = require("../middleware/subirImagenesProducto");
const { validarProducto } = require("../controllers/productosController");

async function subir(archivo) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME,
    preset = process.env.CLOUDINARY_UPLOAD_PRESET;
  if (!cloud || !preset)
    throw fallo(503, "Configura Cloudinary para subir imágenes.");
  const form = new FormData();
  form.append(
    "file",
    new Blob([archivo.buffer], { type: archivo.mimetype }),
    "producto",
  );
  form.append("upload_preset", preset);
  const res = await fetch(
    "https://api.cloudinary.com/v1_1/" +
      encodeURIComponent(cloud) +
      "/image/upload",
    { method: "POST", body: form, signal: AbortSignal.timeout(30000) },
  );
  if (!res.ok) throw fallo(502, "No se pudo guardar la imagen.");
  return (await res.json()).secure_url;
}
for (const [method, path] of [
  ["post", "/productos"],
  ["put", "/productos/:id"],
]) {
  router[method](
    path,
    async (req, res, next) => {
      try {
        await admin(req);
        next();
      } catch (e) {
        next(e);
      }
    },
    subirImagenesProducto,
    async (req, res, next) => {
      try {
        const { datos, errores } = validarProducto(req.body || {});
        if (errores.length) throw fallo(400, errores[0]);
        for (const campo of ["imagen_1", "imagen_2"])
          if (req.files?.[campo + "_file"]?.[0])
            datos[campo] = await subir(req.files[campo + "_file"][0]);
        const col = db().collection("products");
        const ref =
          method === "post"
            ? col.doc()
            : await documentoProducto(req.params.id);
        await db().runTransaction(async (tx) => {
          const [snap, cat, h] = await tx.getAll(
            ref,
            db().collection("categories").doc(String(datos.id_categoria)),
            refStock(ref.id),
          );
          if (!cat.exists) throw fallo(400, "La categoría no existe.");
          if (method === "put" && !snap.exists)
            throw fallo(404, "Producto inexistente.");
          const repetidos = await tx.get(
            col.where("codigo", "==", datos.codigo),
          );
          if (repetidos.docs.some((d) => d.id !== ref.id))
            throw fallo(409, "Código de producto duplicado.");
          if (datos.stock_actual < reservado(h.data()?.holds))
            throw fallo(409, "El stock no puede ser inferior a las reservas.");
          tx.set(
            ref,
            {
              ...datos,
              categoria_id: datos.id_categoria,
              imagen_url: datos.imagen_1,
              fecha_creacion: snap.data()?.fecha_creacion || ahora(),
              actualizado_en: ahora(),
            },
            { merge: true },
          );
        });
        res.json({ ok: true, data: producto(await ref.get()) });
      } catch (e) {
        next(e);
      }
    },
  );
}
ruta(
  "delete",
  "/productos/:id",
  "admin",
  async (r) => {
    const ref = await documentoProducto(r.params.id);
    await db().runTransaction(async (tx) => {
      const holds = (await tx.get(refStock(ref.id))).data()?.holds;
      if (reservado(holds))
        throw fallo(409, "El producto tiene reservas activas.");
      tx.delete(ref);
    });
    return { ok: true, message: "Producto eliminado." };
  },
  true,
);
for (const method of ["post", "put", "delete"]) {
  ruta(
    method,
    method === "post" ? "/categorias" : "/categorias/:id",
    "admin",
    async (r) => {
      const col = db().collection("categories");
      return db().runTransaction(async (tx) => {
        const cats = await tx.get(col),
          id =
            method === "post"
              ? 1 +
                Math.max(
                  0,
                  ...cats.docs.map((c) =>
                    Number(c.data().id_categoria ?? c.id),
                  ),
                )
              : Number(r.params.id);
        const ref = col.doc(String(id));
        if (method !== "post" && !cats.docs.some((c) => c.id === ref.id))
          throw fallo(404, "Categoría inexistente.");
        if (method === "delete") {
          for (const campo of ["categoria_id", "id_categoria"])
            if (
              !(
                await tx.get(
                  db().collection("products").where(campo, "==", id).limit(1),
                )
              ).empty
            )
              throw fallo(409, "La categoría tiene productos.");
          tx.delete(ref);
          return { ok: true, message: "Categoría eliminada." };
        }
        const nombre = String(r.body.nombre || "").trim(),
          descripcion = String(r.body.descripcion || "").trim();
        if (!nombre || nombre.length > 100 || descripcion.length > 500)
          throw fallo(400, "Datos de categoría inválidos.");
        if (
          cats.docs.some(
            (c) =>
              c.id !== ref.id &&
              String(c.data().nombre).toLowerCase() === nombre.toLowerCase(),
          )
        )
          throw fallo(409, "Categoría duplicada.");
        const data = { id_categoria: id, nombre, descripcion };
        tx.set(ref, data, { merge: true });
        return { ok: true, data };
      });
    },
    true,
  );
}
const roles = [
  { id_rol: 1, nombre: "admin" },
  { id_rol: 2, nombre: "cliente" },
];
function usuario(d) {
  const p = d.data();
  return {
    uid: d.id,
    id_usuario: numero(d.id),
    nombre: p.nombre,
    email: p.email,
    id_rol: p.rol === "admin" ? 1 : 2,
    rol: p.rol === "admin" ? "admin" : "cliente",
    estado: p.estado === "activo",
    fecha_creacion:
      p.fecha_creacion?.toDate?.().toISOString() || p.fecha_creacion,
  };
}
ruta("get", "/usuarios", "admin", async (r) => {
  const todos = (await db().collection("users").get()).docs.map(usuario);
  const q = String(r.query.q || "").toLowerCase();
  return {
    usuarios: todos.filter(
      (u) =>
        (u.nombre + " " + u.email).toLowerCase().includes(q) &&
        (!r.query.rol || String(u.id_rol) === r.query.rol) &&
        (!r.query.estado ||
          r.query.estado === "todos" ||
          (u.estado ? "activo" : "inactivo") === r.query.estado),
    ),
    roles,
  };
});
async function buscar(id) {
  const d = (await db().collection("users").get()).docs.find(
    (d) => numero(d.id) === Number(id),
  );
  if (!d) throw fallo(404, "Usuario inexistente.");
  return d;
}
for (const method of ["patch", "put", "post"]) {
  ruta(
    method,
    method === "post"
      ? "/usuarios"
      : method === "put"
        ? "/usuarios/:id"
        : "/usuarios/:id/estado",
    "admin",
    async (r, u) => {
      const auth = getAuth(app()),
        b = r.body;
      if (typeof b.estado !== "boolean") throw fallo(400, "Estado inválido.");
      const existente = method === "post" ? null : await buscar(r.params.id);
      if (
        existente?.id === u.uid &&
        (!b.estado || (method === "put" && Number(b.id_rol) !== 1))
      )
        throw fallo(409, "Conserva los permisos de tu cuenta activa.");
      const cambios = { estado: b.estado ? "activo" : "inactivo" };
      const cuenta = { disabled: !b.estado };
      if (method !== "patch") {
        if (
          ![1, 2].includes(Number(b.id_rol)) ||
          !String(b.nombre || "").trim() ||
          !/^\S+@\S+\.\S+$/.test(b.email || "")
        )
          throw fallo(400, "Datos de usuario inválidos.");
        Object.assign(cambios, {
          nombre: b.nombre.trim(),
          email: b.email.trim().toLowerCase(),
          rol: Number(b.id_rol) === 1 ? "admin" : "usuario",
        });
        Object.assign(cuenta, {
          displayName: cambios.nombre,
          email: cambios.email,
        });
        if (b.password || method === "post") {
          if (typeof b.password !== "string" || b.password.length < 8)
            throw fallo(
              400,
              "La contraseña requiere al menos ocho caracteres.",
            );
          cuenta.password = b.password;
        }
      }
      const record = existente
        ? await auth.updateUser(existente.id, cuenta)
        : await auth.createUser(cuenta);
      const ref = db().collection("users").doc(record.uid);
      try {
        await ref.set(
          existente
            ? cambios
            : {
                ...cambios,
                uid: record.uid,
                proveedor: "password",
                fecha_creacion: ahora(),
              },
          { merge: true },
        );
      } catch (e) {
        if (!existente) await auth.deleteUser(record.uid);
        throw e;
      }
      return usuario(await ref.get());
    },
  );
}
module.exports = router;
