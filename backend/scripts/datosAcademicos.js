// Crea documentos identificados de demostración. Al repetir conserva cambios y existencias.
require("dotenv").config({ quiet: true });
const { getAuth } = require("firebase-admin/auth");
const { app, db, numero, ahora } = require("../src/services/firebaseStore");
const {
  modificarCarrito,
  checkout,
  cambiarPedido,
} = require("../src/services/firebaseCompras");
const { fechasRetiroDisponibles } = require("../src/config/retiros");
const cliente = {
  uid: "fs360-academico-cliente",
  nombre: "Mariela Rivas",
  email: "mariela.rivas@example.org",
  rol: "cliente",
};
async function crear(ref, data) {
  try {
    await ref.create(data);
  } catch (e) {
    if (e.code !== 6) throw e;
  }
}
async function sembrar() {
  const cats = await db().collection("categories").get();
  const cat =
    cats.docs.find((d) => /herramient/i.test(d.data().nombre)) || cats.docs[0];
  if (!cat) throw new Error("El catálogo necesita al menos una categoría.");
  const categoria = Number(cat.data().id_categoria ?? cat.id);
  const productos = [
    ["ACAD-FLE-05", "Flexómetro reforzado de 5 metros", 8.75, 24, 6],
    ["ACAD-ALI-08", "Alicate de electricista de 8 pulgadas", 12.5, 3, 4],
  ];
  for (const [
    codigo,
    nombre,
    precio,
    stock_actual,
    stock_minimo,
  ] of productos) {
    await crear(db().collection("products").doc(codigo), {
      codigo,
      nombre,
      precio,
      stock_actual,
      stock_minimo,
      categoria_id: categoria,
      descripcion: nombre + " para taller y mantenimiento.",
      estado: true,
      imagen_url: null,
      imagen_2: null,
      fecha_creacion: ahora(),
      fuente: "demo_academica",
    });
  }
  try {
    await getAuth(app()).getUser(cliente.uid);
  } catch (e) {
    if (e.code !== "auth/user-not-found") throw e;
    await getAuth(app()).createUser({
      uid: cliente.uid,
      email: cliente.email,
      displayName: cliente.nombre,
    });
  }
  await crear(db().collection("users").doc(cliente.uid), {
    ...cliente,
    rol: "usuario",
    estado: "activo",
    fecha_creacion: ahora(),
    proveedor: "password",
    fuente: "demo_academica",
  });
  const ejemplos = [
    ["00000000-0000-4000-8000-000000000001", "ACAD-FLE-05", 2, true],
    ["00000000-0000-4000-8000-000000000002", "ACAD-ALI-08", 1, false],
  ];
  for (const [clave, sku, cantidad, entregar] of ejemplos) {
    const ref = db()
      .collection("orders")
      .doc(cliente.uid + "_" + clave);
    let pedido = (await ref.get()).data();
    if (!pedido) {
      await modificarCarrito(cliente.uid, numero(sku), cantidad);
      pedido = await checkout(cliente, {
        metodo: "efectivo",
        fecha_retiro: fechasRetiroDisponibles()[0],
        clave_idempotencia: clave,
      });
    }
    if (
      entregar &&
      !pedido.fecha_entrega &&
      pedido.estado_pedido !== "cancelado"
    ) {
      const operador = {
        id_usuario: numero("operador-demo"),
        nombre: "Operación académica",
      };
      if (pedido.estado_pedido === "pendiente")
        await cambiarPedido(operador, pedido.id_pedido, "confirmar_pago", "");
      await cambiarPedido(operador, pedido.id_pedido, "entregar", "");
    }
  }
}
if (require.main === module)
  sembrar()
    .then(() => console.log("Datos académicos verificados."))
    .catch((e) => {
      console.error(e.code || e.message);
      process.exitCode = 1;
    });
module.exports = { sembrar };
