const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const dotenv = require("dotenv");
const path = require("path");

const conectarDB = require("./db");
const Jugador = require("./models/Jugador");

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

conectarDB().then(async () => {
  // Limpieza absoluta al arrancar el servidor
  await Jugador.updateMany({}, { online: false, score: 0, socketId: "" });
  console.log("Servidor listo para recibir conexiones.");
});

app.use(express.static("public"));

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "views", "index.html")));
app.get("/lobby", (req, res) => res.sendFile(path.join(__dirname, "views", "lobby.html")));
app.get("/game", (req, res) => res.sendFile(path.join(__dirname, "views", "juego.html")));

// --- VARIABLES DE CONTROL INTERNO DEL JUEGO ---
const PALABRAS = ["PERRO", "GATO", "CASA", "ARBOL", "COCHE", "SOL", "LAPIZ", "LUNA"];
let gameState = {
  inProgress: false,
  players: [],             // [{username, socketId}]
  currentDrawerIndex: 0,
  currentWord: "",
  timer: 60,
  timerInterval: null,
  currentRound: 1,         
  maxRounds: 3,            
  roundTime: 60,          
  turnCount: 0             
};

function mezclarJugadores(lista) {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}

async function startRound() {
  if (gameState.players.length === 0) {
    gameState.inProgress = false;
    clearInterval(gameState.timerInterval);
    return;
  }

  if (gameState.turnCount >= gameState.players.length) {
    gameState.turnCount = 0;
    gameState.currentRound++;
    gameState.currentDrawerIndex = 0;
  }

  // Finalizar juego al concluir la ronda 3
  if (gameState.currentRound > gameState.maxRounds) {
    await endGame();
    return;
  }

  const drawer = gameState.players[gameState.currentDrawerIndex];
  if (!drawer) {
    gameState.turnCount++;
    gameState.currentDrawerIndex = (gameState.currentDrawerIndex + 1) % gameState.players.length;
    startRound();
    return;
  }

  gameState.currentWord = PALABRAS[Math.floor(Math.random() * PALABRAS.length)];
  gameState.timer = gameState.roundTime || 60;

  console.log(`Jugando: Ronda ${gameState.currentRound}/${gameState.maxRounds}. Dibujante: ${drawer.username}. Tiempo por ronda: ${gameState.timer}s`);

  io.emit("roundStarted", {
    drawerId: drawer.socketId,
    drawerName: drawer.username,
    wordLength: gameState.currentWord.length,
    currentRound: gameState.currentRound,
    maxRounds: gameState.maxRounds,
    timer: gameState.timer
  });

  io.emit("timerUpdate", gameState.timer);
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
  
  io.emit("chat", { 
    username: "SISTEMA", 
    text: `La ronda ha terminado. Razón: ${reason}. La palabra era: ${gameState.currentWord}` 
  });
  
  gameState.turnCount++;
  gameState.currentDrawerIndex = (gameState.currentDrawerIndex + 1) % gameState.players.length;
  
  setTimeout(() => {
    if (gameState.inProgress) {
      startRound();
    }
  }, 4000);
}

async function endGame() {
  gameState.inProgress = false;
  clearInterval(gameState.timerInterval);

  try {
    const finalPlayers = await Jugador.find({ online: true }).sort({ score: -1 });
    let ganadorTexto = "No se registraron puntajes.";
    
    if (finalPlayers.length > 0) {
      ganadorTexto = `¡El ganador de la partida es ${finalPlayers[0].username} con ${finalPlayers[0].score || 0} pts!`;
    }

    io.emit("gameEnded", {
      ganador: ganadorTexto,
      players: finalPlayers
    });
    
    // Reinicio parcial del estado para cerrar la partida, pero preservar el host si sigue en el lobby
    gameState.players = [];
    gameState.currentDrawerIndex = 0;
    gameState.currentWord = "";
    gameState.currentRound = 1;
    gameState.turnCount = 0;
    await Jugador.updateMany({}, { score: 0 }); 
  } catch (err) {
    console.error("Error al finalizar la partida:", err);
  }
}

async function clearGameStateIfLobbyEmpty() {
  const onlinePlayersCount = await Jugador.countDocuments({ online: true });
  if (onlinePlayersCount === 0) {
    gameState.inProgress = false;
    gameState.players = [];
    gameState.host = undefined;
    gameState.currentDrawerIndex = 0;
    gameState.currentWord = "";
    gameState.currentRound = 1;
    gameState.turnCount = 0;
    gameState.timer = 60;
    if (gameState.timerInterval) {
      clearInterval(gameState.timerInterval);
      gameState.timerInterval = null;
    }
  }
}

function refreshHostIfNeeded(playersOnline) {
  if (!playersOnline || playersOnline.length === 0) {
    gameState.host = undefined;
    return;
  }

  if (!gameState.host || !playersOnline.some(p => p.username === gameState.host)) {
    gameState.host = playersOnline[0].username;
  }
}

// --- MANEJO DE SOCKETS ---
io.on("connection", (socket) => {

  // FILTRO DE ACCESO EN LOGIN: Respuesta inmediata garantizada
  socket.on("checkUsername", async (username) => {
    try {
      if (gameState.inProgress) {
        return socket.emit("usernameResult", { available: false, error: "PARTIDA_EN_CURSO" });
      }

      const count = await Jugador.countDocuments({ online: true });
      if (count >= 4) {
        return socket.emit("usernameResult", { available: false, error: "SALA_LLENA" });
      }

      const existe = await Jugador.findOne({ username, online: true });
      if (existe) {
        return socket.emit("usernameResult", { available: false, error: "USUARIO_REPETIDO" });
      }

      // Si pasa todos los filtros, permitir ingreso
      socket.emit("usernameResult", { available: true, username });
    } catch (error) {
      console.error("Error en checkUsername:", error);
      socket.emit("usernameResult", { available: false, error: "ERROR_SERVIDOR" });
    }
  });

  // ENTRADA AL LOBBY
  socket.on("joinLobby", async (username) => {
    try {
      if (!username) return;
      socket.username = username; 
      
      await Jugador.findOneAndUpdate(
        { username },
        { socketId: socket.id, online: true },
        { upsert: true, returnDocument: 'after' }
      );
      
      const playersOnline = await Jugador.find({ online: true });
      refreshHostIfNeeded(playersOnline);

      io.emit("playersUpdated", playersOnline);
      io.emit("lobbyInfo", { players: playersOnline, host: gameState.host });
    } catch (error) {
      console.error(error);
    }
  });

  // SINCRONIZAR CAMBIOS DE CONFIGURACIÓN
  socket.on("updateGameConfig", (config) => {
    try {
      if (socket.username === gameState.host) {
        if (config.roundTime) gameState.roundTime = config.roundTime;
        if (config.maxRounds) gameState.maxRounds = config.maxRounds;
        
        // Emitir a TODOS los clientes incluyendo al que hizo el cambio
        io.emit("configUpdated", {
          roundTime: gameState.roundTime,
          maxRounds: gameState.maxRounds
        });
        console.log(`Configuración actualizada por ${socket.username}:`, { roundTime: gameState.roundTime, maxRounds: gameState.maxRounds });
      }
    } catch (error) {
      console.error("Error updating config:", error);
    }
  });

  socket.on("draw", (data) => {
    const currentDrawer = gameState.players[gameState.currentDrawerIndex];
    if (gameState.inProgress && currentDrawer && currentDrawer.socketId === socket.id) {
      socket.broadcast.emit("draw", data);
    }
  });

  socket.on("clearCanvas", () => {
    const currentDrawer = gameState.players[gameState.currentDrawerIndex];
    if (gameState.inProgress && currentDrawer && currentDrawer.socketId === socket.id) {
      socket.broadcast.emit("clearCanvas");
    }
  });

  // INICIAR PARTIDA (mínimo 2 jugadores, máximo 4)
  socket.on("requestStartGame", async (options = {}) => {
    try {
      // only host can start
      if (!socket.username || socket.username !== gameState.host) {
        return socket.emit('chat', { username: 'SISTEMA', text: 'Solo el anfitrión puede iniciar la partida.' });
      }

      let playersOnline = await Jugador.find({ online: true });
      const minPlayers = 2;
      const maxPlayers = 4;

      if (playersOnline.length < minPlayers || playersOnline.length > maxPlayers) {
        return socket.emit("chat", { username: "SISTEMA", text: `Se necesitan entre ${minPlayers} y ${maxPlayers} jugadores para iniciar.` });
      }

      // Apply options
      const roundTime = parseInt(options.roundTime, 10) || gameState.roundTime || 60;
      const maxRounds = parseInt(options.maxRounds, 10) || gameState.maxRounds || 3;

      playersOnline = mezclarJugadores(playersOnline);

      gameState.inProgress = true;
      gameState.currentRound = 1;
      gameState.turnCount = 0;
      gameState.currentDrawerIndex = 0;
      gameState.roundTime = roundTime;
      gameState.maxRounds = maxRounds;
      gameState.currentWord = "";

      gameState.players = playersOnline.map(p => ({ username: p.username, socketId: p.socketId }));

      io.emit("redirectToGame");

      setTimeout(() => {
        startRound();
      }, 3500);
    } catch (err) {
      console.error('Error starting game:', err);
    }
  });

  // SINCRONIZACIÓN DE LA PANTALLA DE JUEGO
  socket.on("syncGameScreen", async (username) => {
    try {
      if (!username) return;
      socket.username = username; 
      
      await Jugador.findOneAndUpdate({ username }, { socketId: socket.id, online: true });
      const playersOnline = await Jugador.find({ online: true });
      
      const idx = gameState.players.findIndex(p => p.username === username);
      if (idx !== -1) {
        gameState.players[idx].socketId = socket.id;
      } else {
        if (gameState.inProgress) {
          return socket.emit("gameBlocked", "Espera que se termine la partida activa.");
        }
        gameState.players.push({ username: username, socketId: socket.id });
      }

      io.emit("updateScoreboard", playersOnline);

      if (gameState.inProgress) {
        const drawer = gameState.players[gameState.currentDrawerIndex];
        if (drawer) {
          socket.emit("roundStarted", {
            drawerId: drawer.socketId,
            drawerName: drawer.username,
            wordLength: gameState.currentWord.length,
            currentRound: gameState.currentRound,
            maxRounds: gameState.maxRounds,
            timer: gameState.timer
          });
          socket.emit("timerUpdate", gameState.timer);
          if (drawer.username === username) {
            socket.emit("secretWord", gameState.currentWord);
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  });

  socket.on("chat", async (msgData) => {
    try {
      const username = socket.username;
      if (!username) return;

      const currentDrawer = gameState.players[gameState.currentDrawerIndex];
      const esDibujante = currentDrawer && currentDrawer.username === username;

      if (esDibujante) return; 

      const mensajeLimpio = msgData.text.trim().toUpperCase();

      if (gameState.inProgress && mensajeLimpio === gameState.currentWord) {
        const jugador = await Jugador.findOne({ username: username });
        if (jugador) {
          // Calculate points based on remaining time
          const maxTime = gameState.roundTime || 60;
          const timeLeft = Math.max(0, gameState.timer);
          let points = Math.ceil(100 * (timeLeft / maxTime));
          if (points < 10) points = 10;

          jugador.score = (jugador.score || 0) + points;
          await jugador.save();

          io.emit("chat", { 
            username: "SISTEMA", 
            text: `¡${username} ha adivinado la palabra! (+${points} pts)` 
          });

          const playersOnline = await Jugador.find({ online: true });
          io.emit("updateScoreboard", playersOnline);

          gameState.currentWord = ""; // Evita que otros jugadores adivinen la misma palabra repetidas veces
          endRound(`Adivinado por ${username}`);
        }
      } else {
        io.emit("chat", { username: username, text: msgData.text });
      }
    } catch (err) {
      console.error(err);
    }
  });

  socket.on("disconnect", async () => {
    try {
      if (socket.username) {
        await Jugador.findOneAndUpdate({ username: socket.username }, { online: false });
        // Remover al jugador de la partida activa si está en progreso
        if (gameState.inProgress) {
          gameState.players = gameState.players.filter(p => p.username !== socket.username);
        }
      }
      const playersOnline = await Jugador.find({ online: true });
      refreshHostIfNeeded(playersOnline);
      io.emit("updateScoreboard", playersOnline);
      io.emit("lobbyInfo", { players: playersOnline, host: gameState.host });
      await clearGameStateIfLobbyEmpty();
    } catch (error) {
      console.error(error);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));