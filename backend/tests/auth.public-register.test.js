const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { test } = require("node:test");

const JWT_SECRET = "test-only-signing-secret-for-auth-register";

test("registro público: validación, rol fijado en backend, login y protecciones administrativas", async (t) => {
  const usuarios = new Map();
  let siguienteId = 50;
  const authServicePath = require.resolve("../src/services/authService");
  const authControllerPath = require.resolve("../src/controllers/authController");
  const authRoutesPath = require.resolve("../src/routes/auth");
  const cartServicePath = require.resolve("../src/services/carritoService");
  const cartControllerPath = require.resolve("../src/controllers/carritoController");
  const cartRoutesPath = require.resolve("../src/routes/carrito");
  const databasePath = require.resolve("../src/config/database");
  const authMiddlewarePath = require.resolve("../src/middleware/authMiddleware");
  const usersServicePath = require.resolve("../src/services/usuariosService");
  const usersControllerPath = require.resolve("../src/controllers/usuariosController");
  const usersRoutesPath = require.resolve("../src/routes/usuarios");
  const originalService = require.cache[authServicePath];
  const originalCartService = require.cache[cartServicePath];
  const originalDatabase = require.cache[databasePath];
  const originalMiddleware = require.cache[authMiddlewarePath];
  const originalUsersService = require.cache[usersServicePath];
  const userAdminCalls = [];

  require.cache[databasePath] = {
    id: databasePath,
    filename: databasePath,
    loaded: true,
    exports: {
      sql: { Int: "int" },
      async getPool() {
        return {
          request() {
            const request = { params: {} };
            request.input = function (name, _type, value) { this.params[name] = value; return this; };
            request.query = async function () {
              return { recordset: [{ estado: true, rol: Number(this.params.id_usuario) === 1 ? "admin" : "cliente" }] };
            };
            return request;
          },
        };
      },
    },
  };
  delete require.cache[authMiddlewarePath];
  require.cache[usersServicePath] = {
    id: usersServicePath,
    filename: usersServicePath,
    loaded: true,
    exports: {
      async listarUsuarios() { return { usuarios: [], roles: [] }; },
      async obtenerRol(id) { return { id_rol: id, nombre: id === 1 ? "admin" : id === 3 ? "cliente" : "empleado" }; },
      async existeEmail() { return false; },
      async crearUsuarioAdmin(datos) {
        userAdminCalls.push({ accion: "crear", ...datos });
        return { id_usuario: 77, nombre: datos.nombre, email: datos.email, id_rol: datos.idRol, estado: datos.estado };
      },
      async actualizarUsuarioAdmin(datos) {
        userAdminCalls.push({ accion: "editar", ...datos });
        return { id_usuario: datos.id, nombre: datos.nombre, email: datos.email, id_rol: datos.idRol, estado: datos.estado };
      },
      async actualizarEstadoUsuario(id, estado) {
        userAdminCalls.push({ accion: "estado", id, estado });
        return { id_usuario: id, estado };
      },
      async existeUsuario() { return true; },
    },
  };
  delete require.cache[usersControllerPath];
  delete require.cache[usersRoutesPath];

  require.cache[authServicePath] = {
    id: authServicePath,
    filename: authServicePath,
    loaded: true,
    exports: {
      async obtenerUsuarioPorEmail(email) { return usuarios.get(email); },
      async crearUsuario(datos) {
        const usuario = {
          id_usuario: siguienteId++,
          nombre: datos.nombre,
          email: datos.email,
          password: datos.password,
          estado: true,
          rol: "cliente",
        };
        usuarios.set(usuario.email, usuario);
        return usuario;
      },
    },
  };
  require.cache[cartServicePath] = {
    id: cartServicePath,
    filename: cartServicePath,
    loaded: true,
    exports: {
      async obtenerCarrito(idUsuario) { return { id_usuario: idUsuario, items: [] }; },
    },
  };
  delete require.cache[authControllerPath];
  delete require.cache[authRoutesPath];
  delete require.cache[cartControllerPath];
  delete require.cache[cartRoutesPath];
  process.env.JWT_SECRET = JWT_SECRET;

  const app = express();
  app.use(express.json());
  app.use("/api", require("../src/routes/auth"));
  app.use("/api", require("../src/routes/carrito"));
  app.use("/api", require("../src/routes/usuarios"));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const request = (path, body, method = "POST") => fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  try {
    await t.test("un visitante registra cliente sin token; guarda contraseña bcrypt y no devuelve hash", async () => {
      const response = await request("/api/auth/register", {
        nombre: "  Ana Cliente  ", email: " ANA@example.test ", password: "ClaveSegura8",
      });
      const body = await response.json();
      assert.equal(response.status, 201);
      assert.equal(body.data.usuario.rol, "cliente");
      assert.equal(body.data.usuario.email, "ana@example.test");
      assert.equal("password" in body.data.usuario, false);
      const stored = usuarios.get("ana@example.test");
      assert.ok(stored.password.startsWith("$2"));
      assert.equal(await bcrypt.compare("ClaveSegura8", stored.password), true);
    });

    await t.test("rechaza correo duplicado", async () => {
      const response = await request("/api/auth/register", {
        nombre: "Ana duplicada", email: "ana@example.test", password: "ClaveSegura8",
      });
      assert.equal(response.status, 409);
    });

    await t.test("rechaza correo y contraseña inválidos", async () => {
      for (const datos of [
        { nombre: "Nombre", email: "sin-correo", password: "ClaveSegura8" },
        { nombre: "Nombre", email: "valido@example.test", password: "corta" },
        { nombre: "Nombre", email: "valido@example.test", password: "sinmayuscula8" },
        { nombre: "Nombre", email: "valido@example.test", password: "SinNumero" },
        { nombre: " ", email: "valido@example.test", password: "ClaveSegura8" },
      ]) {
        const response = await request("/api/auth/register", datos);
        assert.equal(response.status, 400);
      }
    });

    await t.test("rechaza rol manipulado y no crea una cuenta privilegiada", async () => {
      for (const campo of ["rol", "id_rol", "role", "roleId", "idRol"]) {
        const response = await request("/api/auth/register", {
          nombre: "Intento", email: `intento-${campo}@example.test`, password: "ClaveSegura8", [campo]: "admin",
        });
        assert.equal(response.status, 400);
      }
      assert.equal(usuarios.size, 1);
    });

    await t.test("el cliente registrado inicia sesión con rol cliente", async () => {
      const response = await request("/api/auth/login", {
        email: "ana@example.test", password: "ClaveSegura8",
      });
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.data.usuario.rol, "cliente");
      assert.equal(jwt.verify(body.data.token, JWT_SECRET).rol, "cliente");
    });

    await t.test("el token cliente puede acceder al carrito autenticado", async () => {
      const token = jwt.sign({ id_usuario: 50, rol: "cliente" }, JWT_SECRET);
      const response = await fetch(`${baseUrl}/api/carrito`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.data.id_usuario, 50);
    });

    await t.test("las rutas administrativas de usuarios rechazan visitas y clientes", async () => {
      for (const [path, method, body] of [
        ["/api/usuarios", "GET"],
        ["/api/usuarios", "POST", {}],
        ["/api/usuarios/1", "PUT", {}],
        ["/api/usuarios/1/estado", "PATCH", { estado: false }],
      ]) {
        const response = await request(path, body, method);
        assert.equal(response.status, 401);
      }

      const tokenCliente = jwt.sign({ id_usuario: 50, rol: "cliente" }, JWT_SECRET);
      const respuestaCliente = await fetch(`${baseUrl}/api/usuarios`, {
        headers: { Authorization: `Bearer ${tokenCliente}` },
      });
      assert.equal(respuestaCliente.status, 403);
    });

    await t.test("un administrador conserva la administración de usuarios", async () => {
      const tokenAdmin = jwt.sign({ id_usuario: 1, rol: "admin" }, JWT_SECRET);
      const headers = { Authorization: `Bearer ${tokenAdmin}`, "Content-Type": "application/json" };

      const creado = await fetch(`${baseUrl}/api/usuarios`, {
        method: "POST", headers,
        body: JSON.stringify({ nombre: "Cliente administrado", email: "cliente-admin@example.test", password: "ClaveAdmin8", id_rol: 3, estado: true }),
      });
      assert.equal(creado.status, 201);
      assert.equal((await creado.json()).data.id_rol, 3);

      const editado = await fetch(`${baseUrl}/api/usuarios/77`, {
        method: "PUT", headers,
        body: JSON.stringify({ nombre: "Cliente Editado", email: "cliente-admin@example.test", id_rol: 3, estado: true }),
      });
      assert.equal(editado.status, 200);

      const rolLegado = await fetch(`${baseUrl}/api/usuarios/77`, {
        method: "PUT", headers,
        body: JSON.stringify({ nombre: "Cliente Editado", email: "cliente-admin@example.test", id_rol: 2, estado: true }),
      });
      assert.equal(rolLegado.status, 400);

      const estado = await fetch(`${baseUrl}/api/usuarios/77/estado`, {
        method: "PATCH", headers,
        body: JSON.stringify({ estado: false }),
      });
      assert.equal(estado.status, 200);
      assert.deepEqual(userAdminCalls.map((call) => call.accion), ["crear", "editar", "estado"]);
    });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (originalService) require.cache[authServicePath] = originalService;
    else delete require.cache[authServicePath];
    if (originalCartService) require.cache[cartServicePath] = originalCartService;
    else delete require.cache[cartServicePath];
    if (originalDatabase) require.cache[databasePath] = originalDatabase;
    else delete require.cache[databasePath];
    if (originalMiddleware) require.cache[authMiddlewarePath] = originalMiddleware;
    else delete require.cache[authMiddlewarePath];
    if (originalUsersService) require.cache[usersServicePath] = originalUsersService;
    else delete require.cache[usersServicePath];
    delete require.cache[authControllerPath];
    delete require.cache[authRoutesPath];
    delete require.cache[cartControllerPath];
    delete require.cache[cartRoutesPath];
    delete require.cache[usersControllerPath];
    delete require.cache[usersRoutesPath];
  }
});

test("crearUsuario resuelve el id de cliente en roles y lo fija en el INSERT", async () => {
  const servicePath = require.resolve("../src/services/authService");
  const databasePath = require.resolve("../src/config/database");
  const originalDatabase = require.cache[databasePath];
  const captured = { inputs: [], queries: [] };
  let rolDisponible = false;
  const fakeSql = { NVarChar: (length) => `nvarchar(${length})`, Int: "int" };

  require.cache[databasePath] = {
    id: databasePath,
    filename: databasePath,
    loaded: true,
    exports: {
      sql: fakeSql,
      async getPool() {
        return {
          request() {
            const request = { params: {} };
            request.input = function (name, _type, value) { this.params[name] = value; return this; };
            request.query = async function (query) {
              captured.inputs.push({ ...this.params });
              captured.queries.push(query);
              if (query.includes("SELECT id_rol")) {
                return { recordset: rolDisponible ? [{ id_rol: 17 }] : [] };
              }
              return { recordset: [{ id_usuario: 88, nombre: "Ana", email: "ana@example.test", estado: true }] };
            };
            return request;
          },
        };
      },
    },
  };
  delete require.cache[servicePath];

  try {
    const { crearUsuario } = require("../src/services/authService");
    await assert.rejects(
      crearUsuario({ nombre: "Ana", email: "ana@example.test", password: "$2b$12$hash" }),
      /El rol cliente no existe/
    );
    assert.equal(captured.queries.length, 1, "sin el rol cliente no debe intentar insertar con otro rol");

    rolDisponible = true;
    const usuario = await crearUsuario({ nombre: "Ana", email: "ana@example.test", password: "$2b$12$hash" });
    assert.equal(usuario.rol, "cliente");
    assert.equal(captured.inputs[1].nombreRol, "cliente");
    assert.equal(captured.inputs[2].id_rol, 17);
    assert.match(captured.queries[2], /INSERT INTO usuarios/);
    assert.doesNotMatch(captured.queries[2], /\brol\b/i);
  } finally {
    if (originalDatabase) require.cache[databasePath] = originalDatabase;
    else delete require.cache[databasePath];
    delete require.cache[servicePath];
  }
});
