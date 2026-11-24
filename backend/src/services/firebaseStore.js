const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { createHash } = require("node:crypto");

function app() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw fallo(503, "Configura FIREBASE_PROJECT_ID en la API.");
  return (
    getApps().find((a) => a.name === "ferrestock") ||
    initializeApp(
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON
        ? { projectId, credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) }
        : { projectId },
      "ferrestock"
    )
  );
}
const db = () => getFirestore(app());
function fallo(status, message) {
  return Object.assign(new Error(message), { status });
}
// La web usa identificadores numéricos y los favoritos móviles conservan el ID original.
function numero(id) {
  return (
    parseInt(
      createHash("sha256").update(String(id)).digest("hex").slice(0, 12),
      16,
    ) || 1
  );
}
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
  const ref = db().collection("users").doc(identidad.uid);
  let perfil = (await ref.get()).data();
  if (!perfil && crear) {
    const nuevo = {
      uid: identidad.uid,
      email: identidad.email || "",
      nombre: identidad.name || identidad.email?.split("@")[0] || "Cliente",
      rol: "usuario",
      estado: "activo",
      proveedor:
        identidad.firebase.sign_in_provider === "google.com"
          ? "google"
          : "password",
      fecha_creacion: FieldValue.serverTimestamp(),
      foto_url: identidad.picture || null,
    };
    try {
      await ref.create(nuevo);
      perfil = nuevo;
    } catch (e) {
      if (e.code !== 6) throw e;
      perfil = (await ref.get()).data();
    }
  }
  if (perfil?.estado !== "activo")
    throw fallo(403, "La cuenta no está activa.");
  return {
    uid: identidad.uid,
    id_usuario: numero(identidad.uid),
    nombre: perfil.nombre,
    email: identidad.email || "",
    rol: perfil.rol === "admin" ? "admin" : "cliente",
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
    id_producto: numero(snap.id),
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
