const express = require('express');
const router = express.Router();
const path = require('path');

// Enrutamiento de vistas del juego
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'index.html'));
});

router.get('/lobby', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'lobby.html'));
});

router.get('/game', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'juego.html'));
});

module.exports = router;
