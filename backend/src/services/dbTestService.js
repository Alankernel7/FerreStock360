const { COLECCIONES, db } = require("../config/firestore");

const testConnection = async () => {
  await db().collection(COLECCIONES.contadores).limit(1).get();
  return { conectado: 1 };
};

module.exports = { testConnection };