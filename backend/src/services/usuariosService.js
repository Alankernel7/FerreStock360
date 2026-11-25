const {
  COLECCIONES,
  db,
  aNumero,
  normalizarTexto,
  siguienteId,
  resolverDocumento,
  resolverDocumentoEnTransaccion,
  asegurarRoles,
  mapaRoles,
  mapearRol,
  mapearUsuario,
  reclamarClaveUnica,
  liberarClaveUnica,
  referenciaClaveUnica,
} = require("../config/firestore");

const crearError = (message, statusCode) =>
  Object.assign(new Error(message), { statusCode });

const listarUsuarios = async ({ q, rol, estado }) => {
  const [documentos, roles] = await Promise.all([
    db().collection(COLECCIONES.usuarios).get(),
    asegurarRoles(),
  ]);
  const rolesPorId = mapaRoles(roles);
  const busqueda = normalizarTexto(q);

  const usuarios = documentos.docs
    .map((documento) => mapearUsuario(documento, rolesPorId))
    .filter((usuario) => {
      if (busqueda) {
        const texto = normalizarTexto(`${usuario.nombre} ${usuario.email}`);
        if (!texto.includes(busqueda)) return false;
      }
      if (rol && Number(usuario.id_rol) !== Number(rol)) return false;
      if (estado !== null && estado !== undefined && usuario.estado !== estado) return false;
      return true;
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  return {
    usuarios,
    roles: [...rolesPorId.values()]
      .filter((item) => ["admin", "cliente"].includes(item.nombre))
      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
  };
};

const obtenerRol = async (id) => {
  const roles = await asegurarRoles();
  const encontrado = roles.find(
    (documento) => aNumero(documento.data().id_rol) === Number(id)
  );
  if (!encontrado) return null;
  const rol = mapearRol(encontrado);
  return { id_rol: rol.id_rol, nombre: rol.nombre };
};

const existeEmail = async (email, excluirId = null) => {
  const correo = normalizarTexto(email);
  const coincide = (documento) => {
    const data = documento.data();
    if (normalizarTexto(data.email) !== correo) return false;
    if (excluirId === null || excluirId === undefined) return true;
    return Number(data.id_usuario) !== Number(excluirId);
  };

  const snapshot = await db()
    .collection(COLECCIONES.usuarios)
    .where("email", "==", correo)
    .get();
  if (snapshot.docs.some(coincide)) return true;

  // Compatibilidad con documentos heredados cuyo email no está normalizado.
  const todos = await db().collection(COLECCIONES.usuarios).get();
  return todos.docs.some(coincide);
};

const rolAlmacenado = (nombreRol) =>
  normalizarTexto(nombreRol) === "admin" ? "admin" : "usuario";

const crearUsuarioAdmin = async ({ nombre, email, password, idRol, estado }) => {
  const rolSeleccionado = await obtenerRol(idRol);
  if (!rolSeleccionado) throw crearError("El rol seleccionado no existe", 400);

  const correo = normalizarTexto(email);
  const idUsuario = await siguienteId(
    "usuarios",
    COLECCIONES.usuarios,
    "id_usuario"
  );

  await db().runTransaction(async (tx) => {
    await reclamarClaveUnica(tx, `user_email:${correo}`, idUsuario);
    tx.set(db().collection(COLECCIONES.usuarios).doc(String(idUsuario)), {
      id_usuario: idUsuario,
      nombre,
      email: correo,
      password,
      id_rol: rolSeleccionado.id_rol,
      rol: rolAlmacenado(rolSeleccionado.nombre),
      estado,
      fecha_creacion: new Date(),
      actualizado_en: new Date(),
      proveedor: "password",
      foto_url: null,
    });
  });

  const roles = mapaRoles(await asegurarRoles());
  return mapearUsuario(
    await resolverDocumento(COLECCIONES.usuarios, "id_usuario", idUsuario),
    roles
  );
};

const contarAdministradoresActivos = async (tx, roles) => {
  const usuarios = await tx.get(db().collection(COLECCIONES.usuarios));
  return usuarios.docs
    .map((documento) => mapearUsuario(documento, roles))
    .filter((usuario) => usuario.rol === "admin" && usuario.estado).length;
};

const protegerUltimoAdministrador = async (tx, roles, existente, cambios) => {
  const dejaDeSerAdmin =
    existente.rol === "admin" &&
    existente.estado &&
    (Number(cambios.idRol) !== Number(existente.id_rol) || cambios.estado === false);

  if (!dejaDeSerAdmin) return;

  const total = await contarAdministradoresActivos(tx, roles);
  if (total <= 1) {
    throw crearError(
      "No puedes cambiar el rol ni desactivar al último administrador activo",
      409
    );
  }
};

const actualizarUsuarioAdmin = async ({
  id,
  idAutenticado,
  nombre,
  email,
  idRol,
  estado,
  password,
}) => {
  const rolSeleccionado = await obtenerRol(idRol);
  if (!rolSeleccionado) throw crearError("El rol seleccionado no existe", 400);

  const roles = mapaRoles(await asegurarRoles());
  const correo = normalizarTexto(email);
  let encontrado = false;

  await db().runTransaction(async (tx) => {
    const documento = await resolverDocumentoEnTransaccion(
      tx,
      COLECCIONES.usuarios,
      "id_usuario",
      id
    );
    if (!documento) return;

    encontrado = true;
    const existente = mapearUsuario(documento, roles);

    if (Number(id) === Number(idAutenticado) && Number(idRol) !== Number(existente.id_rol)) {
      throw crearError("No puedes modificar tu propio rol", 409);
    }

    await protegerUltimoAdministrador(tx, roles, existente, { idRol, estado });

    const data = documento.data();
    const correoAnterior = normalizarTexto(data.email);
    const refAnterior = referenciaClaveUnica(`user_email:${correoAnterior}`);
    const refNueva = referenciaClaveUnica(`user_email:${correo}`);
    const [claveAnterior, claveNueva] = await Promise.all([
      tx.get(refAnterior),
      tx.get(refNueva),
    ]);

    if (
      correoAnterior !== correo &&
      claveNueva.exists &&
      Number(claveNueva.data().id) !== Number(id)
    ) {
      throw crearError("Ya existe un usuario con ese correo", 409);
    }

    if (correoAnterior !== correo) {
      if (claveAnterior.exists) tx.delete(refAnterior);
      tx.set(refNueva, {
        clave: correo,
        id: Number(id),
        actualizado_en: new Date(),
      });
    }

    const cambios = {
      nombre,
      email: correo,
      id_rol: rolSeleccionado.id_rol,
      rol: rolAlmacenado(rolSeleccionado.nombre),
      estado,
      actualizado_en: new Date(),
    };
    if (password) cambios.password = password;

    tx.set(documento.ref, cambios, { merge: true });
  });

  if (!encontrado) return null;

  return mapearUsuario(
    await resolverDocumento(COLECCIONES.usuarios, "id_usuario", id),
    roles
  );
};

const actualizarEstadoUsuario = async (id, estado) => {
  const roles = mapaRoles(await asegurarRoles());
  let encontrado = false;

  await db().runTransaction(async (tx) => {
    const documento = await resolverDocumentoEnTransaccion(
      tx,
      COLECCIONES.usuarios,
      "id_usuario",
      id
    );
    if (!documento) return;

    encontrado = true;
    const existente = mapearUsuario(documento, roles);

    await protegerUltimoAdministrador(tx, roles, existente, {
      idRol: existente.id_rol,
      estado,
    });

    tx.set(
      documento.ref,
      { estado, actualizado_en: new Date() },
      { merge: true }
    );
  });

  if (!encontrado) return null;

  return mapearUsuario(
    await resolverDocumento(COLECCIONES.usuarios, "id_usuario", id),
    roles
  );
};

const existeUsuario = async (id) =>
  Boolean(await resolverDocumento(COLECCIONES.usuarios, "id_usuario", id));

const obtenerRolesAdministrables = async () => {
  const roles = await asegurarRoles();
  return roles
    .map(mapearRol)
    .filter((rol) => ["admin", "cliente"].includes(rol.nombre))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
};

module.exports = {
  listarUsuarios,
  obtenerRol,
  existeEmail,
  crearUsuarioAdmin,
  actualizarUsuarioAdmin,
  actualizarEstadoUsuario,
  existeUsuario,
  obtenerRolesAdministrables,
};
