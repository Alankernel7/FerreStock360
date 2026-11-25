const {
  COLECCIONES,
  db,
  aBooleano,
} = require("../config/firestore");

const obtenerEstadisticasPublicas = async () => {
  const [productos, categorias] = await Promise.all([
    db().collection(COLECCIONES.productos).get(),
    db().collection(COLECCIONES.categorias).get(),
  ]);

  return {
    total_productos: productos.docs.filter((documento) =>
      aBooleano(documento.data().estado, true)
    ).length,
    total_categorias: categorias.size,
  };
};

module.exports = { obtenerEstadisticasPublicas };