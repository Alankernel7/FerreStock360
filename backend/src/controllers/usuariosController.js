const bcrypt = require("bcryptjs");
const { listarUsuarios, obtenerRol, existeEmail, crearUsuarioAdmin, actualizarUsuarioAdmin, actualizarEstadoUsuario, existeUsuario } = require("../services/usuariosService");

const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const rolesPermitidos = new Set(["admin", "cliente"]);
const validarBase = ({ nombre, email, id_rol, estado }) => {
  const errores = [];
  if (typeof nombre !== "string" || !nombre.trim()) errores.push("El nombre es obligatorio");
  else if (nombre.trim().length > 100) errores.push("El nombre no puede superar 100 caracteres");
  if (typeof email !== "string" || !email.trim()) errores.push("El correo electrónico es obligatorio");
  else if (email.trim().length > 150 || !emailValido.test(email.trim())) errores.push("Ingresa un correo electrónico válido de hasta 150 caracteres");
  const rol = Number(id_rol);
  if (!Number.isInteger(rol) || rol <= 0 || rol > 2147483647) errores.push("Selecciona un rol válido");
  if (typeof estado !== "boolean") errores.push("El estado debe ser activo o inactivo");
  return { errores, rol };
};

const getUsuarios = async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (q.length > 150) return res.status(400).json({ ok: false, message: "La búsqueda no puede superar 150 caracteres" });
    let rol = null;
    if (req.query.rol) {
      rol = Number(req.query.rol);
      if (!Number.isInteger(rol) || rol <= 0 || rol > 2147483647) return res.status(400).json({ ok: false, message: "El rol no es válido" });
    }
    let estado = null;
    if (req.query.estado !== undefined && req.query.estado !== "todos") {
      if (!["activo", "inactivo"].includes(req.query.estado)) return res.status(400).json({ ok: false, message: "El estado no es válido" });
      estado = req.query.estado === "activo";
    }
    const data = await listarUsuarios({ q, rol, estado });
    return res.json({ ok: true, data });
  } catch (error) {
    console.error("Error al consultar usuarios:", error.message);
    return res.status(500).json({ ok: false, message: "No se pudieron consultar los usuarios" });
  }
};

const postUsuario = async (req, res) => {
  const body = req.body || {};
  const { errores, rol } = validarBase(body);
  if (typeof body.password !== "string" || body.password.length < 6 || body.password.length > 72) {
    errores.push("La contraseña es obligatoria y debe tener entre 6 y 72 caracteres");
  }
  if (errores.length) return res.status(400).json({ ok: false, message: errores[0], errores });
  try {
    const rolSeleccionado = await obtenerRol(rol);
    if (!rolSeleccionado) return res.status(400).json({ ok: false, message: "El rol seleccionado no existe" });
    if (!rolesPermitidos.has(rolSeleccionado.nombre)) return res.status(400).json({ ok: false, message: "Solo se permiten los roles admin y cliente" });
    const email = body.email.trim().toLowerCase();
    if (await existeEmail(email)) return res.status(409).json({ ok: false, message: "Ya existe un usuario con ese correo" });
    const password = await bcrypt.hash(body.password, 12);
    const data = await crearUsuarioAdmin({ nombre: body.nombre.trim(), email, password, idRol: rol, estado: body.estado });
    return res.status(201).json({ ok: true, message: "Usuario creado correctamente", data });
  } catch (error) {
    console.error("Error al crear usuario:", error.message);
    return res.status(error.number === 2601 || error.number === 2627 ? 409 : 500)
      .json({ ok: false, message: error.number === 2601 || error.number === 2627 ? "Ya existe un usuario con ese correo" : "No se pudo crear el usuario" });
  }
};

const putUsuario = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0 || id > 2147483647) return res.status(400).json({ ok: false, message: "El identificador de usuario no es válido" });
  const body = req.body || {};
  const { errores, rol } = validarBase(body);
  if (body.password !== undefined && body.password !== "" && (typeof body.password !== "string" || body.password.length < 6 || body.password.length > 72)) {
    errores.push("La contraseña debe tener entre 6 y 72 caracteres");
  }
  if (errores.length) return res.status(400).json({ ok: false, message: errores[0], errores });
  if (id === Number(req.usuario.id_usuario) && body.estado === false) {
    return res.status(409).json({ ok: false, message: "No puedes desactivar tu propia cuenta" });
  }
  try {
    if (!(await existeUsuario(id))) return res.status(404).json({ ok: false, message: "Usuario no encontrado" });
    const rolSeleccionado = await obtenerRol(rol);
    if (!rolSeleccionado) return res.status(400).json({ ok: false, message: "El rol seleccionado no existe" });
    if (!rolesPermitidos.has(rolSeleccionado.nombre)) return res.status(400).json({ ok: false, message: "Solo se permiten los roles admin y cliente" });
    const email = body.email.trim().toLowerCase();
    if (await existeEmail(email, id)) return res.status(409).json({ ok: false, message: "Ya existe un usuario con ese correo" });
    const password = body.password ? await bcrypt.hash(body.password, 12) : null;
    const data = await actualizarUsuarioAdmin({ id, idAutenticado: Number(req.usuario.id_usuario), nombre: body.nombre.trim(), email, idRol: rol, estado: body.estado, password });
    if (!data) return res.status(404).json({ ok: false, message: "Usuario no encontrado" });
    return res.json({ ok: true, message: "Usuario actualizado correctamente", data });
  } catch (error) {
    console.error("Error al actualizar usuario:", error.message);
    const status = error.number === 2601 || error.number === 2627 ? 409 : error.statusCode || 500;
    const message = error.number === 2601 || error.number === 2627 ? "Ya existe un usuario con ese correo" : error.statusCode ? error.message : "No se pudo actualizar el usuario";
    return res.status(status).json({ ok: false, message });
  }
};

const patchEstadoUsuario = async (req, res) => {
  const id = Number(req.params.id);
  const { estado } = req.body || {};
  if (!Number.isInteger(id) || id <= 0 || id > 2147483647) return res.status(400).json({ ok: false, message: "El identificador de usuario no es válido" });
  if (typeof estado !== "boolean") return res.status(400).json({ ok: false, message: "El estado debe ser activo o inactivo" });
  if (id === Number(req.usuario.id_usuario) && !estado) return res.status(409).json({ ok: false, message: "No puedes desactivar tu propia cuenta" });
  try {
    const data = await actualizarEstadoUsuario(id, estado);
    if (!data) return res.status(404).json({ ok: false, message: "Usuario no encontrado" });
    return res.json({ ok: true, message: `Usuario ${estado ? "activado" : "desactivado"} correctamente`, data });
  } catch (error) {
    console.error("Error al cambiar estado del usuario:", error.message);
    return res.status(error.statusCode || 500).json({ ok: false, message: error.statusCode ? error.message : "No se pudo cambiar el estado del usuario" });
  }
};

module.exports = { getUsuarios, postUsuario, putUsuario, patchEstadoUsuario };
