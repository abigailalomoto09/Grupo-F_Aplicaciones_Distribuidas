const express = require('express');
const Jugador = require('../models/Jugador');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Registro de jugador
router.post('/register', async (req, res) => {
    try {
        const { correo, contrasenia, username } = req.body || {};

        if (!correo || !contrasenia || !username) {
            return res.status(400).json({ message: 'Todos los campos son obligatorios' });
        }

        // Encriptar la contraseña
        const hashed = await bcrypt.hash(contrasenia, 10);

        // Crear una instancia del modelo de jugador
        const nuevo = new Jugador({ 
            correo, 
            username, 
            contrasenia: hashed,
            online: false,
            score: 0,
            socketId: ""
        });

        // Guardar en la base de datos
        await nuevo.save();
        res.status(201).json({ message: 'Usuario creado' });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: 'El correo o nombre de usuario ya está registrado' });
        }
        res.status(500).json({ message: 'Error al registrar el jugador' });
    }
});

// Login de jugador
router.post('/login', async (req, res) => {
    try {
        const { correo, contrasenia } = req.body || {};

        if (!correo || !contrasenia) {
            return res.status(400).json({ message: 'El correo y contraseña son obligatorios' });
        }

        // Buscar por correo
        const jugador = await Jugador.findOne({ correo });
        if (!jugador) return res.status(404).json({ message: 'Usuario no encontrado' });

        // Comparar contraseña
        const valido = await bcrypt.compare(contrasenia, jugador.contrasenia);
        if (!valido) return res.status(401).json({ message: 'Contraseña incorrecta' });

        // Generar el token
        const token = jwt.sign({ id: jugador._id }, process.env.JWT_SECRET || 'nose1012');
        
        res.json({ token, username: jugador.username });
    } catch (err) {
        res.status(500).json({ message: 'Error al iniciar sesión' });
    }
});

// Recuperación de contraseña
router.post('/recover', async (req, res) => {
    try {
        const { correo } = req.body || {};
        if (!correo) {
            return res.status(400).json({ message: 'El correo es obligatorio' });
        }

        const jugador = await Jugador.findOne({ correo });
        if (!jugador) return res.status(404).json({ message: 'Usuario no encontrado' });

        const token = jwt.sign({ id: jugador._id }, process.env.JWT_SECRET || 'nose1012', { expiresIn: '30s' });
        res.json({ token });
    } catch (err) {
        res.status(500).json({ message: 'Error al recuperar' });
    }
});

module.exports = router;
