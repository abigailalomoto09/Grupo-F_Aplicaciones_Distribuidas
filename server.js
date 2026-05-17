const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const dotenv = require("dotenv");
const path = require("path");

const conectarDB = require("./db");

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

<<<<<<< Updated upstream
// CREAR ARREGLO DE JUGADORES
let players = [];

conectarDB();
=======
conectarDB().then(async () => {
  await Jugador.updateMany({}, { online: false, score: 0, socketId: "" });
  console.log("Estados y puntajes reseteados en la DB");
});
>>>>>>> Stashed changes

app.use(express.static("public"));

app.get("/", (req, res) => { res.sendFile(path.join(__dirname, "views", "index.html")); });
app.get("/lobby", (req, res) => { res.sendFile(path.join(__dirname, "views", "lobby.html")); });
app.get("/game", (req, res) => { res.sendFile(path.join(__dirname, "views", "juego.html")); });

// --- ESTADO INTERNO DEL JUEGO ---
const PALABRAS = ["PERRO", "GATO", "CASA", "ARBOL", "COCHE", "SOL", "MANZANA", "LAPIZ", "AVION", "LUNA"];
let gameState = {
  inProgress: false,
  players: [], // Aquí guardaremos objetos { username, socketId } actualizados
  currentDrawerIndex: 0,
  currentWord: "",
  timer: 60,
  timerInterval: null
};

function startRound() {
  if (gameState.players.length === 0) {
    gameState.inProgress = false;
    clearInterval(gameState.timerInterval);
    return;
  }

<<<<<<< Updated upstream
app.get("/game", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "game.html"));
});
=======
  // Asegurar que el índice esté dentro del rango actual de jugadores
  if (gameState.currentDrawerIndex >= gameState.players.length) {
    gameState.currentDrawerIndex = 0;
  }
>>>>>>> Stashed changes

  const drawer = gameState.players[gameState.currentDrawerIndex];
  gameState.currentWord = PALABRAS[Math.floor(Math.random() * PALABRAS.length)];
  gameState.timer = 60;

  console.log(`Ronda iniciada. Dibujante: ${drawer.username}, Palabra: ${gameState.currentWord}`);

  // Avisar a todos la estructura de la ronda
  io.emit("roundStarted", {
    drawerId: drawer.socketId,
    drawerName: drawer.username,
    wordLength: gameState.currentWord.length
  });

  // Enviar la palabra secreta ÚNICAMENTE al dibujante
  io.to(drawer.socketId).emit("secretWord", gameState.currentWord);
  io.emit("clearCanvas");

  clearInterval(gameState.timerInterval);
  gameState.timerInterval = setInterval(() => {
    gameState.timer--;
    io.emit("timerUpdate", gameState.timer);

    if (gameState.timer <= 0) {
      clearInterval(gameState.timerInterval);
      endRound("Tiempo terminado");
    }
  }, 1000);
}

function endRound(reason) {
  clearInterval(gameState.timerInterval);
  io.emit("chatMessage", { 
    username: "SISTEMA", 
    text: `La ronda ha terminado. Razón: ${reason}. La palabra era: ${gameState.currentWord}` 
  });
  
  gameState.currentDrawerIndex = (gameState.currentDrawerIndex + 1) % gameState.players.length;
  
  setTimeout(() => {
    if (gameState.inProgress && gameState.players.length > 0) {
      startRound();
    }
  }, 4000);
}

// --- MANEJO DE SOCKETS ---
io.on("connection", (socket) => {
  console.log("Usuario conectado:", socket.id);

<<<<<<< Updated upstream
  //UNIRSE AL LOBBY
  socket.on("joinLobby", (username) => {

    const player = {
      id: socket.id,
      username
    };

    players.push(player);

    console.log(players);

    // ENVIAR LISTA ACTUALIZADA
    io.emit("playersUpdated", players);

  });

  // DESCONECTARSE DEL LOBBY
  socket.on("disconnect", () => {

    players = players.filter(
      player => player.id !== socket.id
    );

    io.emit("playersUpdated", players);

    console.log("Usuario desconectado");

=======
  socket.on("checkUsername", async (username) => {
    try {
      const existe = await Jugador.findOne({ username, online: true });
      socket.emit("usernameResult", { available: !existe, username });
    } catch (error) {
      console.error(error);
    }
  });

  // Evento unificado para registrar/actualizar el socket de un jugador
  socket.on("joinLobby", async (username) => {
    try {
      let jugador = await Jugador.findOneAndUpdate(
        { username },
        { socketId: socket.id, online: true },
        { upsert: true, new: true }
      );

      const playersOnline = await Jugador.find({ online: true });
      io.emit("playersUpdated", playersOnline);

      // Si el juego ya está en marcha, sincronizamos al jugador que reingresa en la lista interna
      if (gameState.inProgress) {
        const index = gameState.players.findIndex(p => p.username === username);
        if (index !== -1) {
          gameState.players[index].socketId = socket.id;
        } else {
          gameState.players.push({ username: jugador.username, socketId: socket.id });
        }
      }
    } catch (error) {
      console.error(error);
    }
  });

  // Petición desde el Lobby para comenzar
  socket.on("requestStartGame", async () => {
    const playersOnline = await Jugador.find({ online: true });
    if (playersOnline.length < 2) {
      socket.emit("chatMessage", { username: "SISTEMA", text: "Se necesitan al menos 2 jugadores para iniciar la batalla." });
      return;
    }

    gameState.inProgress = true;
    gameState.players = []; // Se limpiará temporalmente para llenarse al cargar /game
    gameState.currentDrawerIndex = 0;

    io.emit("redirectToGame");
  });

  // ¡EVENTO CLAVE! Cada cliente avisa cuando ya terminó de cargar la vista /game
  socket.on("syncGameScreen", async (username) => {
    try {
      // Forzar actualización del ID de socket en la base de datos
      await Jugador.findOneAndUpdate({ username }, { socketId: socket.id, online: true });
      
      const playersOnline = await Jugador.find({ online: true });
      
      // Re-construir de forma segura la lista del juego con los Sockets Nuevos
      const index = gameState.players.findIndex(p => p.username === username);
      if (index === -1) {
        gameState.players.push({ username: username, socketId: socket.id });
      } else {
        gameState.players[index].socketId = socket.id;
      }

      // Enviar la tabla actualizada con las puntuaciones de DB
      io.emit("updateScoreboard", playersOnline);

      // Si es el primer jugador en reportarse listo, esperamos un breve lapso y arrancamos la primera ronda
      if (gameState.inProgress && gameState.players.length === 1) {
        setTimeout(() => {
          if (gameState.players.length > 0) startRound();
        }, 2000); 
      } else if (gameState.inProgress) {
        // Para jugadores que entren ligeramente más tarde, se les sincroniza el estado actual
        const drawer = gameState.players[gameState.currentDrawerIndex];
        if (drawer) {
          socket.emit("roundStarted", {
            drawerId: drawer.socketId,
            drawerName: drawer.username,
            wordLength: gameState.currentWord.length
          });
          if (drawer.socketId === socket.id) {
            socket.emit("secretWord", gameState.currentWord);
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  });

  // RELES DE CANVAS
  socket.on("draw", (data) => {
    socket.broadcast.emit("draw", data);
  });

  socket.on("clearCanvas", () => {
    io.emit("clearCanvas");
  });

  // PROCESAMIENTO DEL CHAT Y ADIVINANZAS
  socket.on("sendMessage", async (msgData) => {
    try {
      const jugador = await Jugador.findOne({ socketId: socket.id });
      if (!jugador) return;

      const mensajeLimpio = msgData.text.trim().toUpperCase();
      const currentDrawer = gameState.players[gameState.currentDrawerIndex];
      const esDibujante = currentDrawer && currentDrawer.socketId === socket.id;

      if (gameState.inProgress && mensajeLimpio === gameState.currentWord && !esDibujante) {
        jugador.score += 100;
        await jugador.save();

        io.emit("chatMessage", { 
          username: "SISTEMA", 
          text: `🎉 ¡${jugador.username} ha adivinado la palabra! (+100 pts)` 
        });

        const playersOnline = await Jugador.find({ online: true });
        io.emit("updateScoreboard", playersOnline);

        endRound(`Adivinado por ${jugador.username}`);
      } else {
        io.emit("chatMessage", { username: jugador.username, text: msgData.text });
      }
    } catch (err) {
      console.error(err);
    }
>>>>>>> Stashed changes
  });

  socket.on("disconnect", async () => {
    try {
      const jugadorEliminado = await Jugador.findOneAndUpdate({ socketId: socket.id }, { online: false });
      
      if (jugadorEliminado) {
        const username = jugadorEliminado.username;
        // Quitar de la lista de juego activa
        gameState.players = gameState.players.filter(p => p.username !== username);
        
        const playersOnline = await Jugador.find({ online: true });
        io.emit("playersUpdated", playersOnline);
        io.emit("updateScoreboard", playersOnline);

        // Validar si el que se desconectó era el dibujante del turno activo
        if (gameState.inProgress && gameState.players.length > 0) {
          const currentDrawer = gameState.players[gameState.currentDrawerIndex];
          if (!currentDrawer || currentDrawer.username === username) {
            endRound("El dibujante abandonó la partida");
          }
        }
      }
    } catch (error) {
      console.error(error);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Servidor en puerto ${PORT}`); });