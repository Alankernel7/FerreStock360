const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const {
  obtenerUsuarioPorEmail,
  crearUsuario,
} = require("../services/authService");

const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const camposRol = ["rol", "id_rol", "role", "roleId", "idRol"];

const tieneCampoRol = (body) =>
  camposRol.some((campo) => Object.prototype.hasOwnProperty.call(body, campo));

const passwordValida = (password) => {
  if (typeof password !== "string") return false;
  const bytes = Buffer.byteLength(password, "utf8");
  return bytes >= 8 && bytes <= 72 &&
    /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ ok: false, message: "El correo electrónico es obligatorio" });
    }

    if (typeof password !== "string" || !password) {
      return res.status(400).json({ ok: false, message: "La contraseña es obligatoria" });
    }

    const usuario = await obtenerUsuarioPorEmail(email.trim().toLowerCase());

    if (!usuario) {
      return res.status(401).json({ ok: false, message: "Correo o contraseña incorrectos" });
    }

    if (!usuario.estado) {
      return res.status(403).json({ ok: false, message: "Este usuario se encuentra inactivo" });
    }

    const passwordCorrecta = await bcrypt.compare(password, usuario.password);
    if (!passwordCorrecta) {
      return res.status(401).json({ ok: false, message: "Correo o contraseña incorrectos" });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET no está configurado");
    }

    const token = jwt.sign({
      id_usuario: usuario.id_usuario,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
    }, process.env.JWT_SECRET, { expiresIn: "8h" });

    return res.json({
      ok: true,
      message: "Inicio de sesión exitoso",
      data: {
        usuario: {
          id_usuario: usuario.id_usuario,
          nombre: usuario.nombre,
          email: usuario.email,
          rol: usuario.rol,
        },
        token,
      },
    });
  } catch (error) {
    console.error("Error al iniciar sesión:", error.message);
    return res.status(500).json({ ok: false, message: "Error al iniciar sesión" });
  }
};

const register = async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? req.body
      : {};
    const { nombre, email, password } = body;

    if (tieneCampoRol(body)) {
      return res.status(400).json({
        ok: false,
        message: "El rol no se puede especificar durante el registro público",
      });
    }

    if (typeof nombre !== "string" || !nombre.trim()) {
      return res.status(400).json({ ok: false, message: "El nombre es obligatorio" });
    }
    if (nombre.trim().length > 100) {
      return res.status(400).json({ ok: false, message: "El nombre no puede superar 100 caracteres" });
    }

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ ok: false, message: "El correo electrónico es obligatorio" });
    }
    const emailNormalizado = email.trim().toLowerCase();
    if (emailNormalizado.length > 150 || !emailValido.test(emailNormalizado)) {
      return res.status(400).json({
        ok: false,
        message: "Ingresa un correo electrónico válido de hasta 150 caracteres",
      });
    }

    if (typeof password !== "string" || !password) {
      return res.status(400).json({ ok: false, message: "La contraseña es obligatoria" });
    }
    if (!passwordValida(password)) {
      return res.status(400).json({
        ok: false,
        message: "La contraseña debe tener entre 8 y 72 bytes e incluir minúscula, mayúscula y número",
      });
    }

    const usuarioExistente = await obtenerUsuarioPorEmail(emailNormalizado);
    if (usuarioExistente) {
      return res.status(409).json({
        ok: false,
        message: "Ya existe una cuenta con ese correo electrónico",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const usuario = await crearUsuario({
      nombre: nombre.trim(),
      email: emailNormalizado,
      password: passwordHash,
    });

    return res.status(201).json({
      ok: true,
      message: "Usuario registrado correctamente",
      data: {
        usuario: {
          id_usuario: usuario.id_usuario,
          nombre: usuario.nombre,
          email: usuario.email,
          rol: "cliente",
        },
      },
    });
  } catch (error) {
    console.error("Error al registrar usuario:", error.message);
    if (error.number === 2601 || error.number === 2627) {
      return res.status(409).json({
        ok: false,
        message: "Ya existe una cuenta con ese correo electrónico",
      });
    }

    const noConfigurado = error.message.includes("El rol cliente no existe");
    return res.status(500).json({
      ok: false,
      message: noConfigurado
        ? "El registro público aún no está configurado. Contacta al administrador."
        : "Error al registrar usuario",
    });
  }
};

module.exports = { login, register };
