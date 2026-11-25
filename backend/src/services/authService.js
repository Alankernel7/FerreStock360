const {
  COLECCIONES,
  db,
  aISO,
  aBooleano,
  normalizarTexto,
  siguienteId,
  asegurarRoles,
  obtenerRolPorNombre,
  mapaRoles,
  mapearUsuario,
  reclamarClaveUnica,
} = require("../config/firestore");

const obtenerUsuarioPorEmail = async (email) => {
  const correo = normalizarTexto(email);
  const snapshot = await db()
    .collection(COLECCIONES.usuarios)
    .where("email", "==", correo)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const documento = snapshot.docs[0];
  const data = documento.data();
  const roles = mapaRoles(await asegurarRoles());
  const usuario = mapearUsuario(documento, roles);

  return {
    ...usuario,
    password: typeof data.password === "string" ? data.password : null,
    estado: aBooleano(data.estado, true),
    fecha_creacion: aISO(data.fecha_creacion),
  };
};

const crearUsuario = async ({ nombre, email, password }) => {
  // El registro público solo crea clientes y nunca acepta un rol del navegador.
  const rolCliente = await obtenerRolPorNombre("cliente");

  if (!rolCliente) {
    throw new Error(
      "El rol cliente no existe. Ejecuta npm run seed:usuarios antes de habilitar el registro público."
    );
  }

  const idRolCliente = Number(rolCliente.data().id_rol) || 2;
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
      id_rol: idRolCliente,
      // La app móvil usa "usuario" para clientes; la API lo expone como "cliente".
      rol: "usuario",
      estado: true,
      fecha_creacion: new Date(),
      actualizado_en: new Date(),
      proveedor: "password",
      foto_url: null,
    });
  });

  return {
    id_usuario: idUsuario,
    nombre,
    email: correo,
    estado: true,
    fecha_creacion: new Date().toISOString(),
    rol: "cliente",
  };
};

module.exports = {
  obtenerUsuarioPorEmail,
  crearUsuario,
};
