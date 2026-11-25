const express = require("express");
const { getAuth } = require("firebase-admin/auth");
const { COLECCIONES, db, siguienteId, asegurarRoles, mapaRoles, resolverDocumento } = require("../config/firestore");
const { app, fallo } = require("../services/firebaseStore");
const { verificarToken, soloAdminActivo } = require("../middleware/authMiddleware");

const router = express.Router();
const auth = () => getAuth(app());
const rolCanonico = (data) => data.rol || (Number(data.id_rol) === 1 ? "admin" : "cliente");
const mapear = (doc, roles) => {
  const data = doc.data();
  const idRol = Number(data.id_rol) || (rolCanonico(data) === "admin" ? 1 : 2);
  return {
    uid: doc.id,
    id_usuario: Number(data.id_usuario) || null,
    nombre: data.nombre || "",
    email: data.email || "",
    id_rol: idRol,
    rol: roles.get(idRol)?.nombre || rolCanonico(data),
    estado: data.estado !== "inactivo" && data.estado !== false,
    fecha_creacion: data.fecha_creacion?.toDate?.().toISOString() || data.fecha_creacion || null,
  };
};
const listar = async () => {
  const [usuarios, rolesDocs] = await Promise.all([
    db().collection(COLECCIONES.usuarios).get(), asegurarRoles(),
  ]);
  const roles = mapaRoles(rolesDocs);
  return {
    usuarios: usuarios.docs.filter((d) => d.data().uid === d.id)
      .map((d) => mapear(d, roles))
      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    roles: [...roles.values()].sort((a, b) => a.nombre.localeCompare(b.nombre)),
  };
};
const buscar = async (id) => {
  const snap = await db().collection(COLECCIONES.usuarios).where("id_usuario", "==", Number(id)).limit(1).get();
  if (!snap.empty) return snap.docs[0];
  const directo = await db().collection(COLECCIONES.usuarios).doc(String(id)).get();
  return directo.exists ? directo : null;
};
const respuestaError = (res, error) => {
  const authStatus = error.code === "auth/email-already-exists" ? 409
    : ["auth/invalid-email", "auth/invalid-password"].includes(error.code) ? 400 : null;
  const status = error.status || authStatus || 500;
  return res.status(status).json({ ok: false, message: error.status || authStatus ? error.message : "No se pudo completar la operación." });
};

router.use("/usuarios", verificarToken, soloAdminActivo);
router.get("/usuarios", async (req, res) => {
  try {
    const data = await listar();
    const q = String(req.query.q || "").toLowerCase();
    const usuarios = data.usuarios.filter((u) =>
      `${u.nombre} ${u.email}`.toLowerCase().includes(q) &&
      (!req.query.rol || Number(req.query.rol) === u.id_rol) &&
      (!req.query.estado || req.query.estado === "todos" || u.estado === (req.query.estado === "activo"))
    );
    res.json({ ok: true, data: { ...data, usuarios } });
  } catch (error) { respuestaError(res, error); }
});

router.post("/usuarios", async (req, res) => {
  const { nombre, email, password, id_rol: idRol, estado = true } = req.body || {};
  if (typeof nombre !== "string" || !nombre.trim() || nombre.trim().length > 100 ||
      typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email.trim()) ||
      typeof password !== "string" || password.length < 6 || typeof estado !== "boolean") {
    return res.status(400).json({ ok: false, message: "Datos de usuario inválidos." });
  }
  try {
    const roles = mapaRoles(await asegurarRoles());
    const rol = roles.get(Number(idRol));
    if (!rol) throw fallo(400, "El rol seleccionado no existe.");
    const account = await auth().createUser({
      email: email.trim().toLowerCase(), password, displayName: nombre.trim(), disabled: !estado,
    });
    const idUsuario = await siguienteId("usuarios", COLECCIONES.usuarios, "id_usuario");
    const perfil = {
      uid: account.uid, id_usuario: idUsuario, nombre: nombre.trim(), email: account.email,
      id_rol: rol.id_rol, rol: rol.nombre,
      estado: estado ? "activo" : "inactivo", proveedor: "password",
      fecha_creacion: new Date(), actualizado_en: new Date(), foto_url: null,
    };
    try { await db().collection(COLECCIONES.usuarios).doc(account.uid).create(perfil); }
    catch (error) { await auth().deleteUser(account.uid); throw error; }
    res.status(201).json({ ok: true, message: "Usuario creado correctamente", data: mapear({ id: account.uid, data: () => perfil }, roles) });
  } catch (error) { respuestaError(res, error); }
});

router.put("/usuarios/:id", async (req, res) => {
  const { nombre, email, password, id_rol: idRol, estado } = req.body || {};
  if (!nombre?.trim?.() || nombre.trim().length > 100 || !/^\S+@\S+\.\S+$/.test(String(email || "").trim()) || typeof estado !== "boolean" || (password && (typeof password !== "string" || password.length < 6))) return res.status(400).json({ ok: false, message: "Datos de usuario inválidos." });
  try {
    const doc = await buscar(req.params.id);
    if (!doc || doc.data().uid !== doc.id) throw fallo(409, "La cuenta heredada requiere vinculación antes de editarse.");
    if (doc.id === req.usuario.uid && (!estado || Number(idRol) !== Number(doc.data().id_rol))) throw fallo(409, "No puedes desactivar tu cuenta ni cambiar tu propio rol.");
    const roles = mapaRoles(await asegurarRoles());
    const rol = roles.get(Number(idRol));
    if (!rol) throw fallo(400, "El rol seleccionado no existe.");
    const activos = (await db().collection(COLECCIONES.usuarios).get()).docs
      .filter((d) => d.data().uid === d.id && rolCanonico(d.data()) === "admin" && d.data().estado !== "inactivo").length;
    if (doc.data().rol === "admin" && (rol.nombre !== "admin" || !estado) && activos <= 1) throw fallo(409, "No puedes desactivar ni cambiar el rol del último administrador.");
    const cambios = { displayName: nombre.trim(), email: email.trim().toLowerCase(), disabled: !estado };
    if (typeof password === "string" && password) cambios.password = password;
    await auth().updateUser(doc.id, cambios);
    const perfil = {
      nombre: nombre.trim(), email: email.trim().toLowerCase(), id_rol: rol.id_rol,
      rol: rol.nombre, estado: estado ? "activo" : "inactivo",
      actualizado_en: new Date(),
    };
    await doc.ref.set(perfil, { merge: true });
    res.json({ ok: true, message: "Usuario actualizado correctamente", data: mapear({ id: doc.id, data: () => ({ ...doc.data(), ...perfil }) }, roles) });
  } catch (error) { respuestaError(res, error); }
});

router.patch("/usuarios/:id/estado", async (req, res) => {
  const { estado } = req.body || {};
  if (typeof estado !== "boolean") return res.status(400).json({ ok: false, message: "El estado debe ser activo o inactivo." });
  try {
    const doc = await buscar(req.params.id);
    if (!doc || doc.data().uid !== doc.id) throw fallo(409, "La cuenta heredada requiere vinculación antes de editarse.");
    if (doc.id === req.usuario.uid && !estado) throw fallo(409, "No puedes desactivar tu propia cuenta.");
    const roles = mapaRoles(await asegurarRoles());
    const activos = (await db().collection(COLECCIONES.usuarios).get()).docs
      .filter((d) => d.data().uid === d.id && rolCanonico(d.data()) === "admin" && d.data().estado !== "inactivo").length;
    if (doc.data().rol === "admin" && !estado && activos <= 1) throw fallo(409, "No puedes desactivar al último administrador.");
    await auth().updateUser(doc.id, { disabled: !estado });
    const perfil = { estado: estado ? "activo" : "inactivo", actualizado_en: new Date() };
    await doc.ref.set(perfil, { merge: true });
    res.json({ ok: true, message: `Usuario ${estado ? "activado" : "desactivado"} correctamente`, data: mapear({ id: doc.id, data: () => ({ ...doc.data(), ...perfil }) }, roles) });
  } catch (error) { respuestaError(res, error); }
});

module.exports = router;
