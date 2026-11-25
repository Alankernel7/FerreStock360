// Pruebas de integración de productos e imágenes.
//
// Requieren conexión a la base configurada en backend/.env. Crean productos
// temporales (inactivos) y los eliminan al finalizar. No tocan los productos
// existentes.

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");
const { after, before, test: testBase } = require("node:test");
const basePruebasHabilitada = require("./testDatabaseConfig");
const test = (...args) => {
  if (!basePruebasHabilitada) {
    const [nombre, opciones, ejecutar] = args;
    return typeof opciones === "function"
      ? testBase(nombre, { skip: "Configura FIRESTORE_EMULATOR_HOST y TEST_FIREBASE_PROJECT_ID para pruebas con escritura" }, opciones)
      : testBase(nombre, { ...opciones, skip: "Configura FIRESTORE_EMULATOR_HOST y TEST_FIREBASE_PROJECT_ID para pruebas con escritura" }, ejecutar);
  }
  return testBase(...args);
};
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const jwt = require("jsonwebtoken");

const PORT = 34211;
const BASE = `http://127.0.0.1:${PORT}`;

const PREFIJO_CODIGO = `TEST-IMG-${Date.now()}`;

const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

let servidor;
let tokenAdmin;
let tokenCliente;
let idCategoria;
let idsOriginales = [];
const idsCreados = new Set();
let salidaServidor = "";

const crearToken = (idUsuario, rol) =>
  jwt.sign(
    {
      id_usuario: idUsuario,
      nombre: `Prueba ${rol}`,
      email: `prueba-${rol}@example.com`,
      rol,
    },
    process.env.JWT_SECRET,
    { expiresIn: "10m" }
  );

const esperarServidor = async () => {
  const limite = Date.now() + 30000;

  while (Date.now() < limite) {
    try {
      const respuesta = await fetch(`${BASE}/api/health`);

      if (respuesta.ok) return;
    } catch {
      // Aún no está escuchando.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`El servidor no inició.\n${salidaServidor}`);
};

const solicitar = async (ruta, opciones = {}) => {
  const respuesta = await fetch(`${BASE}${ruta}`, opciones);
  const tipo = respuesta.headers.get("content-type") || "";

  const cuerpo = tipo.includes("application/json")
    ? await respuesta.json()
    : await respuesta.arrayBuffer();

  return { estado: respuesta.status, cuerpo };
};

const formProducto = ({
  codigo,
  nombre,
  estado = "false",
  archivo1,
  archivo2,
  imagen1 = "",
  imagen2 = "",
}) => {
  const form = new FormData();

  form.set("nombre", nombre);
  form.set("descripcion", "Producto temporal de pruebas automatizadas");
  form.set("codigo", codigo);
  form.set("precio", "12.50");
  form.set("imagen_1", imagen1);
  form.set("imagen_2", imagen2);
  form.set("stock_actual", "3");
  form.set("stock_minimo", "1");
  form.set("id_categoria", String(idCategoria));
  form.set("estado", estado);

  const agregarArchivo = (campo, archivo) => {
    if (!archivo) return;

    const esDescriptor =
      !Buffer.isBuffer(archivo) && typeof archivo === "object";

    const contenido = esDescriptor ? archivo.buffer : archivo;
    const tipo = esDescriptor ? archivo.tipo : "image/png";
    const nombre = esDescriptor ? archivo.nombre : "imagen.png";

    form.set(campo, new Blob([contenido], { type: tipo }), nombre);
  };

  agregarArchivo("imagen_1_file", archivo1);
  agregarArchivo("imagen_2_file", archivo2);

  return form;
};

const crear = (datos, token = tokenAdmin) =>
  solicitar("/api/productos", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formProducto(datos),
  });

before(async () => {
  if (!basePruebasHabilitada) return;
  servidor = spawn(process.execPath, ["src/app.js"], {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  servidor.stdout.on("data", (dato) => {
    salidaServidor += dato.toString();
  });
  servidor.stderr.on("data", (dato) => {
    salidaServidor += dato.toString();
  });

  await esperarServidor();

  tokenAdmin = crearToken(1, "admin");
  tokenCliente = crearToken(3, "cliente");

  const categorias = await solicitar("/api/categorias");
  assert.equal(categorias.estado, 200);
  idCategoria = categorias.cuerpo[0].id_categoria;

  const productos = await solicitar("/api/productos");
  assert.equal(productos.estado, 200);
  idsOriginales = productos.cuerpo.map((p) => p.id_producto);
});

after(async () => {
  if (!basePruebasHabilitada) return;
  try {
    const { cuerpo } = await solicitar("/api/productos");

    for (const producto of cuerpo) {
      if (producto.codigo.startsWith(PREFIJO_CODIGO)) {
        await solicitar(`/api/productos/${producto.id_producto}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${tokenAdmin}` },
        });
      }
    }
  } catch (error) {
    console.error("Error durante la limpieza:", error.message);
  } finally {
    servidor?.kill();
  }
});

test("el catálogo público solo devuelve productos activos", async () => {
  const { estado, cuerpo } = await solicitar("/api/productos?estado=activo");

  assert.equal(estado, 200);
  assert.ok(Array.isArray(cuerpo));
  assert.ok(cuerpo.every((producto) => producto.estado === true));
});

test("abre el detalle de un producto activo existente", async () => {
  const { cuerpo: productos } = await solicitar("/api/productos?estado=activo");
  const activo = productos[0];

  assert.ok(activo, "Debe existir al menos un producto activo");

  const { estado, cuerpo } = await solicitar(
    `/api/productos/${activo.id_producto}?estado=activo`
  );

  assert.equal(estado, 200);
  assert.equal(cuerpo.id_producto, activo.id_producto);
  assert.equal(cuerpo.nombre, activo.nombre);
  assert.equal(cuerpo.codigo, activo.codigo);
  assert.ok("precio" in cuerpo);
  assert.ok("stock_actual" in cuerpo);
  assert.ok("id_categoria" in cuerpo);
});

test("crea un producto sin imagen", async () => {
  const codigo = `${PREFIJO_CODIGO}-SIN`;

  const { estado, cuerpo } = await crear({
    codigo,
    nombre: "Producto temporal sin imagen",
  });

  assert.equal(estado, 201);
  assert.equal(cuerpo.data.imagen_1, null);
  assert.equal(cuerpo.data.imagen_2, null);

  idsCreados.add(cuerpo.data.id_producto);
});

test("crea un producto con una imagen y la sirve desde el backend", async () => {
  const codigo = `${PREFIJO_CODIGO}-UNA`;

  const { estado, cuerpo } = await crear({
    codigo,
    nombre: "Producto temporal con una imagen",
    archivo1: PNG_1x1,
  });

  assert.equal(estado, 201);
  assert.match(cuerpo.data.imagen_1, /^\/uploads\/products\/producto-.+\.png$/);
  assert.equal(cuerpo.data.imagen_2, null);

  idsCreados.add(cuerpo.data.id_producto);

  const archivo = await fetch(`${BASE}${cuerpo.data.imagen_1}`);
  assert.equal(archivo.status, 200);
  assert.match(archivo.headers.get("content-type") || "", /image\/png/);
});

test("crea un producto con dos imágenes distintas", async () => {
  const codigo = `${PREFIJO_CODIGO}-DOS`;

  const { estado, cuerpo } = await crear({
    codigo,
    nombre: "Producto temporal con dos imágenes",
    archivo1: PNG_1x1,
    archivo2: {
      buffer: PNG_1x1,
      tipo: "image/png",
      nombre: "segunda.png",
    },
  });

  assert.equal(estado, 201);
  assert.ok(cuerpo.data.imagen_1);
  assert.ok(cuerpo.data.imagen_2);
  assert.notEqual(cuerpo.data.imagen_1, cuerpo.data.imagen_2);

  idsCreados.add(cuerpo.data.id_producto);

  for (const ruta of [cuerpo.data.imagen_1, cuerpo.data.imagen_2]) {
    const archivo = await fetch(`${BASE}${ruta}`);
    assert.equal(archivo.status, 200);
  }
});

test("rechaza un archivo con extensión o tipo no permitido", async () => {
  const codigo = `${PREFIJO_CODIGO}-TXT`;

  const respuesta = await crear({
    codigo,
    nombre: "Producto temporal archivo no permitido",
    archivo1: {
      buffer: Buffer.from("no soy una imagen"),
      tipo: "text/plain",
      nombre: "archivo.txt",
    },
  });

  assert.equal(respuesta.estado, 400);
  assert.match(respuesta.cuerpo.message, /Formato no permitido/i);

  const { cuerpo: productos } = await solicitar("/api/productos");
  assert.equal(productos.filter((p) => p.codigo === codigo).length, 0);
});

test("rechaza contenido que no coincide con una imagen real", async () => {
  const codigo = `${PREFIJO_CODIGO}-FALSO`;

  const respuesta = await crear({
    codigo,
    nombre: "Producto temporal archivo falso",
    archivo1: {
      buffer: Buffer.from("contenido falso que dice ser png"),
      tipo: "image/png",
      nombre: "falso.png",
    },
  });

  assert.equal(respuesta.estado, 400);
  assert.match(respuesta.cuerpo.message, /no es una imagen válida/i);
});

test("rechaza una imagen que supera el tamaño máximo", async () => {
  const codigo = `${PREFIJO_CODIGO}-GRANDE`;

  const grande = Buffer.alloc(6 * 1024 * 1024);
  PNG_1x1.copy(grande);

  const respuesta = await crear({
    codigo,
    nombre: "Producto temporal imagen grande",
    archivo1: {
      buffer: grande,
      tipo: "image/png",
      nombre: "grande.png",
    },
  });

  assert.equal(respuesta.estado, 400);
  assert.match(respuesta.cuerpo.message, /5 MB/i);
});

test("rechaza la carga sin token y sin permisos de administrador", async () => {
  const sinToken = await solicitar("/api/productos", {
    method: "POST",
    body: formProducto({
      codigo: `${PREFIJO_CODIGO}-SIN-TOKEN`,
      nombre: "Sin token",
      archivo1: PNG_1x1,
    }),
  });

  assert.equal(sinToken.estado, 401);

  const cliente = await crear(
    {
      codigo: `${PREFIJO_CODIGO}-CLIENTE`,
      nombre: "Cliente sin permiso",
      archivo1: PNG_1x1,
    },
    tokenCliente
  );

  assert.equal(cliente.estado, 403);
});

test("edita un producto conservando sus imágenes actuales", async () => {
  const codigo = `${PREFIJO_CODIGO}-EDITAR`;

  const creado = await crear({
    codigo,
    nombre: "Producto temporal para editar",
    archivo1: PNG_1x1,
    archivo2: {
      buffer: PNG_1x1,
      tipo: "image/png",
      nombre: "segunda.png",
    },
  });

  assert.equal(creado.estado, 201);

  const producto = creado.cuerpo.data;
  idsCreados.add(producto.id_producto);

  const respuesta = await solicitar(`/api/productos/${producto.id_producto}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${tokenAdmin}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      nombre: "Producto temporal editado",
      descripcion: "Descripción actualizada",
      codigo,
      precio: 20,
      imagen_1: producto.imagen_1,
      imagen_2: producto.imagen_2,
      stock_actual: 4,
      stock_minimo: 1,
      id_categoria: idCategoria,
      estado: false,
    }),
  });

  assert.equal(respuesta.estado, 200);
  assert.equal(respuesta.cuerpo.data.imagen_1, producto.imagen_1);
  assert.equal(respuesta.cuerpo.data.imagen_2, producto.imagen_2);
  assert.equal(respuesta.cuerpo.data.nombre, "Producto temporal editado");

  // Las imágenes siguen disponibles.
  for (const ruta of [producto.imagen_1, producto.imagen_2]) {
    const archivo = await fetch(`${BASE}${ruta}`);
    assert.equal(archivo.status, 200);
  }
});

test("reemplaza una imagen y elimina el archivo anterior", async () => {
  const codigo = `${PREFIJO_CODIGO}-REEMPLAZAR`;

  const creado = await crear({
    codigo,
    nombre: "Producto temporal para reemplazar",
    archivo1: PNG_1x1,
    archivo2: {
      buffer: PNG_1x1,
      tipo: "image/png",
      nombre: "segunda.png",
    },
  });

  assert.equal(creado.estado, 201);

  const producto = creado.cuerpo.data;
  idsCreados.add(producto.id_producto);

  const respuesta = await solicitar(`/api/productos/${producto.id_producto}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${tokenAdmin}` },
    body: formProducto({
      codigo,
      nombre: "Producto temporal reemplazado",
      imagen1: producto.imagen_1,
      imagen2: producto.imagen_2,
      archivo1: PNG_1x1,
    }),
  });

  assert.equal(respuesta.estado, 200);
  assert.notEqual(respuesta.cuerpo.data.imagen_1, producto.imagen_1);
  assert.equal(respuesta.cuerpo.data.imagen_2, producto.imagen_2);

  const anterior = await fetch(`${BASE}${producto.imagen_1}`);
  assert.equal(anterior.status, 404);

  const nueva = await fetch(`${BASE}${respuesta.cuerpo.data.imagen_1}`);
  assert.equal(nueva.status, 200);
});

test("elimina una imagen conservando la otra", async () => {
  const codigo = `${PREFIJO_CODIGO}-ELIMINAR-IMG`;

  const creado = await crear({
    codigo,
    nombre: "Producto temporal para quitar una imagen",
    archivo1: PNG_1x1,
    archivo2: {
      buffer: PNG_1x1,
      tipo: "image/png",
      nombre: "segunda.png",
    },
  });

  assert.equal(creado.estado, 201);

  const producto = creado.cuerpo.data;
  idsCreados.add(producto.id_producto);

  const respuesta = await solicitar(`/api/productos/${producto.id_producto}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${tokenAdmin}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      codigo,
      precio: producto.precio,
      imagen_1: producto.imagen_1,
      imagen_2: null,
      stock_actual: producto.stock_actual,
      stock_minimo: producto.stock_minimo,
      id_categoria: producto.id_categoria,
      estado: false,
    }),
  });

  assert.equal(respuesta.estado, 200);
  assert.equal(respuesta.cuerpo.data.imagen_1, producto.imagen_1);
  assert.equal(respuesta.cuerpo.data.imagen_2, null);

  const eliminada = await fetch(`${BASE}${producto.imagen_2}`);
  assert.equal(eliminada.status, 404);
});

test("no elimina una imagen todavía referenciada por otro producto", async () => {
  const codigoA = `${PREFIJO_CODIGO}-REF-A`;
  const codigoB = `${PREFIJO_CODIGO}-REF-B`;

  const creadoA = await crear({
    codigo: codigoA,
    nombre: "Producto temporal referencia A",
    archivo1: PNG_1x1,
  });

  assert.equal(creadoA.estado, 201);

  const productoA = creadoA.cuerpo.data;
  idsCreados.add(productoA.id_producto);

  // B reutiliza la ruta local de A sin subir un archivo nuevo.
  const creadoB = await crear({
    codigo: codigoB,
    nombre: "Producto temporal referencia B",
    imagen1: productoA.imagen_1,
  });

  assert.equal(creadoB.estado, 201);
  assert.equal(creadoB.cuerpo.data.imagen_1, productoA.imagen_1);

  const productoB = creadoB.cuerpo.data;
  idsCreados.add(productoB.id_producto);

  // A quita su imagen; el archivo debe conservarse porque B la referencia.
  const actualizadoA = await solicitar(`/api/productos/${productoA.id_producto}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${tokenAdmin}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      nombre: productoA.nombre,
      descripcion: productoA.descripcion,
      codigo: codigoA,
      precio: productoA.precio,
      imagen_1: null,
      imagen_2: null,
      stock_actual: productoA.stock_actual,
      stock_minimo: productoA.stock_minimo,
      id_categoria: productoA.id_categoria,
      estado: false,
    }),
  });

  assert.equal(actualizadoA.estado, 200);
  assert.equal(actualizadoA.cuerpo.data.imagen_1, null);

  const compartida = await fetch(`${BASE}${productoA.imagen_1}`);
  assert.equal(compartida.status, 200);

  // Al eliminar B ya no queda ninguna referencia y el archivo se borra.
  const eliminadoB = await solicitar(`/api/productos/${productoB.id_producto}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${tokenAdmin}` },
  });

  assert.equal(eliminadoB.estado, 200);

  const sinReferencias = await fetch(`${BASE}${productoA.imagen_1}`);
  assert.equal(sinReferencias.status, 404);
});

test("un producto inactivo no está disponible públicamente", async () => {
  const codigo = `${PREFIJO_CODIGO}-INACTIVO`;

  const creado = await crear({
    codigo,
    nombre: "Producto temporal inactivo",
    estado: "false",
  });

  assert.equal(creado.estado, 201);

  const producto = creado.cuerpo.data;
  idsCreados.add(producto.id_producto);

  const detalle = await solicitar(
    `/api/productos/${producto.id_producto}?estado=activo`
  );
  assert.equal(detalle.estado, 404);

  const { cuerpo: catalogo } = await solicitar("/api/productos?estado=activo");
  assert.equal(
    catalogo.filter((p) => p.id_producto === producto.id_producto).length,
    0
  );

  // Sin credenciales tampoco se expone por ID directo.
  const publicoPorId = await solicitar(
    `/api/productos/${producto.id_producto}`
  );
  assert.equal(publicoPorId.estado, 404);

  // El módulo administrativo sí puede consultarlo.
  const admin = await solicitar(`/api/productos/${producto.id_producto}`, {
    headers: { Authorization: `Bearer ${tokenAdmin}` },
  });
  assert.equal(admin.estado, 200);
});

test("elimina un producto y sus archivos asociados", async () => {
  const codigo = `${PREFIJO_CODIGO}-BORRAR`;

  const creado = await crear({
    codigo,
    nombre: "Producto temporal para borrar",
    archivo1: PNG_1x1,
  });

  assert.equal(creado.estado, 201);

  const producto = creado.cuerpo.data;

  const eliminado = await solicitar(`/api/productos/${producto.id_producto}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${tokenAdmin}` },
  });

  assert.equal(eliminado.estado, 200);

  const archivo = await fetch(`${BASE}${producto.imagen_1}`);
  assert.equal(archivo.status, 404);

  const { cuerpo: productos } = await solicitar("/api/productos");
  assert.equal(
    productos.filter((p) => p.id_producto === producto.id_producto).length,
    0
  );
});

test("los productos existentes siguen disponibles sin cambios", async () => {
  const { estado, cuerpo } = await solicitar("/api/productos");

  assert.equal(estado, 200);

  for (const id of idsOriginales) {
    assert.ok(
      cuerpo.some((producto) => producto.id_producto === id),
      `El producto original ${id} debe seguir existiendo`
    );
  }
});
