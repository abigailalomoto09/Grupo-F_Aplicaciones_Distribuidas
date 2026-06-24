const express = require("express");
const passport = require("passport");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Jugador = require("../models/Jugador");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// 1. Registro de usuario tradicional (API / Formulario)
router.post("/register", async (req, res) => {
  try {
    const { username, email, correo, contrasenia } = req.body || {};
    const userEmail = email || correo;
    
    if (!username || !contrasenia) {
      return res.status(400).json({ error: "El nombre de usuario y la contraseña son obligatorios" });
    }

    if (!userEmail) {
      return res.status(400).json({ error: "El correo electrónico es obligatorio" });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userEmail)) {
      return res.status(400).json({ error: "Formato de correo electrónico inválido" });
    }

    // Verificar si ya existe el usuario
    const existe = await Jugador.findOne({ $or: [{ username }, { email: userEmail }] });
    if (existe) {
      return res.status(400).json({ error: "El nombre de usuario o correo electrónico ya está en uso" });
    }

    // Hashear la contraseña
    const hashed = await bcrypt.hash(contrasenia, 10);

    // Crear el jugador en la base de datos
    const nuevo = new Jugador({
      username,
      email: userEmail,
      contrasenia: hashed
    });

    await nuevo.save();
    return res.status(201).json({ message: "Usuario registrado con éxito", success: true });
  } catch (error) {
    console.error("Error en registro:", error);
    return res.status(500).json({ error: "Error del servidor al registrar el usuario" });
  }
});

// 2. Login tradicional (Establece sesión web y también devuelve un token JWT para la API REST)
router.post("/login", async (req, res) => {
  try {
    const { usernameOrEmail, correo, email, contrasenia } = req.body || {};
    const identifier = usernameOrEmail || correo || email;

    if (!identifier || !contrasenia) {
      return res.status(400).json({ error: "Todos los campos son obligatorios" });
    }

    // Buscar jugador por username o por email
    const jugador = await Jugador.findOne({
      $or: [{ username: identifier }, { email: identifier }]
    });

    if (!jugador) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // Validar si el usuario se creó con Google OAuth y no tiene contraseña
    if (!jugador.contrasenia) {
      return res.status(400).json({ error: "Este usuario se autentica con Google. Por favor usa 'Continuar con Google'." });
    }

    // Comparar contraseñas
    const valido = await bcrypt.compare(contrasenia, jugador.contrasenia);
    if (!valido) {
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    // Generar un token JWT para cumplir con la API RESTful y autorización
    const token = jwt.sign({ id: jugador._id }, process.env.JWT_SECRET);

    // Iniciar sesión en Passport (Session-based, requerido para el Lobby del juego)
    req.login(jugador, (err) => {
      if (err) {
        console.error("Error al serializar sesión:", err);
        return res.status(500).json({ error: "Error interno al iniciar sesión" });
      }
      // Retorna tanto el token JWT como el éxito y redirección del juego
      return res.json({ success: true, redirect: "/lobby", token });
    });
  } catch (error) {
    console.error("Error en login:", error);
    return res.status(500).json({ error: "Error del servidor al iniciar sesión" });
  }
});

// 3. Recuperación de contraseña (API REST) - Devuelve un token temporal de 30 segundos
router.post("/recover", async (req, res) => {
  try {
    const { correo, email } = req.body || {};
    const userEmail = correo || email;

    if (!userEmail) {
      return res.status(400).json({ error: "El correo es obligatorio" });
    }

    const jugador = await Jugador.findOne({ email: userEmail });
    if (!jugador) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // Generar token corto temporal
    const token = jwt.sign({ id: jugador._id }, process.env.JWT_SECRET, { expiresIn: '30s' });
    res.json({ token });
  } catch (error) {
    console.error("Error en recuperación:", error);
    res.status(500).json({ error: "Error del servidor al procesar la solicitud" });
  }
});

// 4. Ruta Segura Protegida por JWT (API REST) - Consume y valida la cabecera Authorization
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    // Buscar al usuario por el ID decodificado del JWT en el middleware
    const jugador = await Jugador.findById(req.userId).select("-contrasenia");
    if (!jugador) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    res.json({
      msg: "Ruta segura accedida exitosamente con JWT",
      user: {
        id: jugador._id,
        username: jugador.username,
        email: jugador.email,
        score: jugador.score,
        online: jugador.online
      }
    });
  } catch (error) {
    console.error("Error al acceder a ruta segura:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// 5. Autenticación con Google (OAuth 2.0)
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"]
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/"
  }),
  (req, res) => {
    res.redirect("/lobby");
  }
);

// 6. Obtener datos del usuario autenticado actual (Sesión)
router.get("/me", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({
      authenticated: false
    });
  }

  res.json({
    authenticated: true,
    username: req.user.username,
    email: req.user.email,
    photo: req.user.photo
  });
});

// 7. Cerrar sesión (Sesión)
router.get("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/");
  });
});

module.exports = router;