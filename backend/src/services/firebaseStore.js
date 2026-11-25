const { obtenerApp, obtenerDb, FieldValue } = require("../config/firebase");
const { getAuth } = require("firebase-admin/auth");
const { hashNumerico, idNumericoDocumento, siguienteId, COLECCIONES } = require("../config/firestore");

function app() {
  return obtenerApp();
}
const db = () => obtenerDb();
function fallo(status, message) {
  return Object.assign(new Error(message), { status });
}
// Conserva identificadores estables al normalizar los documentos históricos.
function numero(id) { return hashNumerico(id); }
function fecha(valor) {
  if (valor?.toDate) return valor.toDate().toISOString();
  return typeof valor === "string" ? valor : null;
}
async function principal(req, crear = false) {
  const token = req.get("Authorization")?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) throw fallo(401, "Inicia sesión.");
  let identidad;
  try {
    identidad = await getAuth(app()).verifyIdToken(token, true);
  } catch (e) {
    if (
      [
        "auth/id-token-expired",
        "auth/id-token-revoked",
        "auth/user-disabled",
        "auth/argument-error",
        "auth/invalid-id-token",
        "auth/user-not-found",
      ].includes(e.code)
    )
      throw fallo(401, "Sesión inválida o vencida.");
    throw e;
  }
  const ref = db().collection(COLECCIONES.usuarios).doc(identidad.uid);
  let perfil = (await ref.get()).data();
  if (!perfil && crear) {
    const correo = String(identidad.email || "").trim().toLowerCase();
    const coincidentes = correo
      ? await db().collection(COLECCIONES.usuarios).where("email", "==", correo).get()
      : { docs: [] };
    const heredado = identidad.email_verified && coincidentes.docs.length === 1
      ? coincidentes.docs[0].data()
      : null;
    const idUsuario = Number(heredado?.id_usuario) || await siguienteId(
      "usuarios", COLECCIONES.usuarios, "id_usuario"
    );
    const rol = Number(heredado?.id_rol) === 1 || heredado?.rol === "admin"
      ? "admin"
      : String(heredado?.rol || "usuario");
    const nuevo = {
      uid: identidad.uid,
      id_usuario: idUsuario,
      email: correo,
      nombre: heredado?.nombre || identidad.name || identidad.email?.split("@")[0] || "Cliente",
      rol,
      id_rol: Number(heredado?.id_rol) || (rol === "admin" ? 1 : 2),
      estado: heredado?.estado === false || heredado?.estado === "inactivo" ? "inactivo" : "activo",
      proveedor:
        identidad.firebase.sign_in_provider === "google.com"
          ? "google"
          : "password",
      fecha_creacion: heredado?.fecha_creacion || FieldValue.serverTimestamp(),
      foto_url: identidad.picture || null,
      legacy_linked: Boolean(heredado),
      legacy_user_id: heredado ? idUsuario : null,
    };
    try {
      await ref.create(nuevo);
      perfil = nuevo;
    } catch (e) {
      if (e.code !== 6) throw e;
      perfil = (await ref.get()).data();
    }
  }
  // Vincula una cuenta heredada solo cuando Firebase declara verificado el
  // correo y existe exactamente un perfil antiguo sin UID. No se copia su hash.
  if (perfil && identidad.email_verified && !perfil.legacy_linked && identidad.email) {
    const antiguos = await db().collection(COLECCIONES.usuarios)
      .where("email", "==", String(identidad.email).trim().toLowerCase()).get();
    const candidatos = antiguos.docs.filter((d) => d.id !== identidad.uid && !d.data().uid);
    if (candidatos.length === 1) {
      const legado = candidatos[0].data();
      const rol = legado.rol === "admin" || Number(legado.id_rol) === 1
        ? "admin"
        : String(legado.rol || "usuario");
      perfil = {
        ...perfil,
        id_usuario: Number(legado.id_usuario) || perfil.id_usuario,
        nombre: legado.nombre || perfil.nombre,
        id_rol: Number(legado.id_rol) || (rol === "admin" ? 1 : 2),
        rol,
        estado: legado.estado === false || legado.estado === "inactivo" ? "inactivo" : perfil.estado,
        legacy_linked: true,
        legacy_user_id: Number(legado.id_usuario) || null,
      };
      await ref.set({ ...perfil, vinculado_en: FieldValue.serverTimestamp() }, { merge: true });
    }
  }
  if (perfil && !(Number(perfil.id_usuario) > 0)) {
    const collection = db().collection(COLECCIONES.usuarios);
    const counter = db().collection(COLECCIONES.contadores).doc("usuarios");
    await db().runTransaction(async (tx) => {
      const [actual, contador, todos] = await Promise.all([
        tx.get(ref), tx.get(counter), tx.get(collection),
      ]);
      if (!actual.exists || Number(actual.data().id_usuario) > 0) return;
      const maximo = todos.docs.reduce((max, doc) => Math.max(max, Number(doc.data().id_usuario) || 0), 0);
      let nuevo = Math.max(maximo, Number(contador.data()?.valor) || 0) + 1;
      while ((await tx.get(collection.doc(String(nuevo)))).exists) nuevo += 1;
      tx.set(counter, { valor: nuevo, actualizado_en: new Date() }, { merge: true });
      tx.update(ref, { id_usuario: nuevo, id_rol: Number(actual.data().id_rol) || (actual.data().rol === "admin" ? 1 : 2) });
      perfil.id_usuario = nuevo;
    });
    perfil = (await ref.get()).data();
  }
  if (!perfil || perfil.estado === "inactivo" || perfil.estado === false)
    throw fallo(403, "La cuenta no está activa.");
  return {
    uid: identidad.uid,
    id_usuario: Number(perfil.id_usuario) || numero(identidad.uid),
    nombre: perfil.nombre,
    email: identidad.email || "",
    rol: perfil.rol === "admin" || Number(perfil.id_rol) === 1
      ? "admin"
      : perfil.rol === "empleado" ? "empleado" : "cliente",
    rol_perfil: perfil.rol || "usuario",
    estado: perfil.estado,
    foto_url: perfil.foto_url || identidad.picture || null,
    proveedor: perfil.proveedor || "password",
    fecha_creacion: fecha(perfil.fecha_creacion),
  };
}
async function admin(req) {
  const u = await principal(req);
  if (u.rol !== "admin")
    throw fallo(403, "Esta operación requiere un administrador.");
  return u;
}
function producto(snap) {
  const p = snap.data();
  return {
    id_producto: idNumericoDocumento(snap, "id_producto"),
    firestore_id: snap.id,
    codigo: p.codigo,
    nombre: p.nombre,
    descripcion: p.descripcion ?? "",
    precio: Number(p.precio),
    estado: p.estado !== false,
    id_categoria: Number(p.categoria_id ?? p.id_categoria),
    stock_actual: Number(p.stock_actual),
    stock_minimo: Number(p.stock_minimo),
    imagen_1: p.imagen_url ?? p.imagen_1 ?? null,
    imagen_2: p.imagen_2 ?? null,
    fecha_creacion: fecha(p.fecha_creacion) ?? "",
  };
}
async function catalogo() {
  const snap = await db().collection("products").get();
  const lista = snap.docs.map(producto);
  if (new Set(lista.map((p) => p.id_producto)).size !== lista.length)
    throw fallo(409, "Hay una colisión entre identificadores de productos.");
  return lista;
}
async function documentoProducto(id) {
  const p = (await catalogo()).find((p) => p.id_producto === Number(id));
  if (!p) throw fallo(404, "Producto inexistente.");
  return db().collection("products").doc(p.firestore_id);
}
async function categorias() {
  return (await db().collection("categories").get()).docs.map((d) => ({
    ...d.data(),
    id_categoria: Number(d.data().id_categoria ?? d.id),
  }));
}
const ahora = () => new Date().toISOString();
module.exports = {
  db,
  app,
  fallo,
  numero,
  fecha,
  principal,
  admin,
  producto,
  catalogo,
  documentoProducto,
  categorias,
  ahora,
};
