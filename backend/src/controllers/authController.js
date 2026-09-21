const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const {
  obtenerUsuarioPorEmail,
} = require("../services/authService");

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({
        ok: false,
        message: "El correo electrónico es obligatorio",
      });
    }

    if (!password) {
      return res.status(400).json({
        ok: false,
        message: "La contraseña es obligatoria",
      });
    }

    const usuario = await obtenerUsuarioPorEmail(
      email.trim().toLowerCase()
    );

    if (!usuario) {
      return res.status(401).json({
        ok: false,
        message: "Correo o contraseña incorrectos",
      });
    }

    if (!usuario.estado) {
      return res.status(403).json({
        ok: false,
        message: "Este usuario se encuentra inactivo",
      });
    }

    const passwordCorrecta = await bcrypt.compare(
      password,
      usuario.password
    );

    if (!passwordCorrecta) {
      return res.status(401).json({
        ok: false,
        message: "Correo o contraseña incorrectos",
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET no está configurado");
    }

    const token = jwt.sign(
      {
        id_usuario: usuario.id_usuario,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "8h",
      }
    );

    res.json({
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
    console.error(
      "Error al iniciar sesión:",
      error.message
    );

    res.status(500).json({
      ok: false,
      message: "Error al iniciar sesión",
    });
  }
};

module.exports = {
  login,
};