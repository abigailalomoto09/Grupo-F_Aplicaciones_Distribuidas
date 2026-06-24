const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const dotenv = require("dotenv");
dotenv.config();
const path = require("path");
const session = require("express-session");
const passport = require("passport");

require("./auth");

const conectarDB = require("./db");
const Jugador = require("./models/Jugador");
const logsRoutes = require("./routes/logs");
const authRoutes = require("./routes/auth");

const {
  trace,
  info,
  debug,
  warn,
  error: logError,
  fatal,
  getLogSummary,
  getRecentLogs
} = require("./logger");
const httpLoggerMiddleware = require("./logger/morganMiddleware");

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

conectarDB().then(async () => {
  // Limpieza absoluta al arrancar el servidor
  await Jugador.updateMany({}, { online: false, score: 0, socketId: "" });
  console.log("Servidor listo para recibir conexiones.");
  info("SERVER_START", "Servidor listo para recibir conexiones");
}).catch((err) => {
  fatal("DB_CONNECTION", "No fue posible conectar a MongoDB", { message: err.message });
  process.exit(1);
});

app.use(httpLoggerMiddleware);
app.use(express.static("public"));

// sesiones de usuario y autenticación
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use("/logs", logsRoutes);
app.use("/auth", authRoutes);
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "views", "index.html")));
app.get("/lobby", (req, res) => {

  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  res.sendFile(path.join(__dirname, "views", "lobby.html"));
});
app.get("/game", (req, res) => res.sendFile(path.join(__dirname, "views", "juego.html")));
app.get("/logs-view", (req, res) => res.sendFile(path.join(__dirname, "views", "logs.html")));

app.get("/api/logs/demo", async (req, res) => {
  try {
    trace("LOG_DEMO", "Evento de prueba TRACE");
    debug("LOG_DEMO", "Evento de prueba DEBUG");
    info("LOG_DEMO", "Evento de prueba INFO");
    warn("LOG_DEMO", "Evento de prueba WARN");
    logError("LOG_DEMO", "Evento de prueba ERROR");
    fatal("LOG_DEMO", "Evento de prueba FATAL");

    res.json({ ok: true, message: "Se generaron logs de prueba en todos los niveles." });
  } catch (err) {
    logError("LOG_DEMO", "No se pudieron generar los logs de prueba", { message: err.message });
    res.status(500).json({ ok: false });
  }
});

app.get("/api/logs/summary", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 25;
    const summary = await getLogSummary({ limit });
    res.json(summary);
  } catch (err) {
    logError("LOGS_API", "Error al obtener el resumen de logs", { message: err.message });
    res.status(500).json({ error: "No fue posible obtener el resumen de logs." });
  }
});

app.get("/api/logs/recent", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const level = req.query.level;
    const logs = await getRecentLogs({ limit, level });
    res.json(logs);
  } catch (err) {
    logError("LOGS_API", "Error al obtener los logs recientes", { message: err.message });
    res.status(500).json({ error: "No fue posible obtener los logs recientes." });
  }
});

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
  // Verificar jugadores activos ANTES de todo lo demás
  const activePlayers = gameState.players.filter(p => p.socketId);
  if (activePlayers.length === 0) {
    warn("ROUND_SKIP", "No hay jugadores activos con socket, terminando partida");
    await endGame();
    return;
  }

  if (gameState.players.length === 0) {
    gameState.inProgress = false;
    clearInterval(gameState.timerInterval);
    warn("ROUND_SKIP", "La ronda no pudo iniciar porque no hay jugadores activos");
    return;
  }

  if (gameState.turnCount >= gameState.players.length) {
    gameState.turnCount = 0;
    gameState.currentRound++;
    gameState.currentDrawerIndex = 0;
    gameState.players = mezclarJugadores([...gameState.players]);
  }

  // Finalizar juego al concluir la ronda 3
  if (gameState.currentRound > gameState.maxRounds) {
    await endGame();
    return;
  }

  const drawer = gameState.players[gameState.currentDrawerIndex];
  if (!drawer || !drawer.socketId) {
    gameState.turnCount++;
    gameState.currentDrawerIndex = (gameState.currentDrawerIndex + 1) % gameState.players.length;
    debug("ROUND_DRAWER_SKIP", "Se omitió un dibujante sin socket activo", {
      currentRound: gameState.currentRound,
      turnCount: gameState.turnCount
    });
    setTimeout(() => startRound(), 0);
    return;
  }

  gameState.currentWord = PALABRAS[Math.floor(Math.random() * PALABRAS.length)];
  gameState.timer = gameState.roundTime || 60;

  console.log(`Jugando: Ronda ${gameState.currentRound}/${gameState.maxRounds}. Dibujante: ${drawer.username}. Tiempo por ronda: ${gameState.timer}s`);
  info("ROUND_START", `Ronda ${gameState.currentRound}/${gameState.maxRounds} iniciada`, {
    drawer: drawer.username,
    timer: gameState.timer,
    players: gameState.players.length
  });

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
  info("ROUND_END", "La ronda terminó", {
    reason,
    currentWord: gameState.currentWord,
    currentRound: gameState.currentRound
  });
  
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
    const finalPlayers = await getScoreboardPlayers();
    finalPlayers.sort((a, b) => (b.score || 0) - (a.score || 0));
    let ganadorTexto = "No se registraron puntajes.";
    
    if (finalPlayers.length > 0) {
      ganadorTexto = `¡El ganador de la partida es ${finalPlayers[0].username} con ${finalPlayers[0].score || 0} pts!`;
    }

    info("GAME_END", "La partida finalizó", {
      winner: finalPlayers[0] ? finalPlayers[0].username : "sin ganador",
      totalPlayers: finalPlayers.length
    });

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
    logError("GAME_END", "Error al finalizar la partida", { message: err.message });
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
    info("LOBBY_EMPTY", "Se limpió el estado porque no quedaron jugadores conectados");
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

async function getScoreboardPlayers() {
  const usernames = gameState.players.map(player => player.username);
  if (usernames.length === 0) {
    return [];
  }

  const playersInDb = await Jugador.find({ username: { $in: usernames } }).select("username score online");
  const playersByUsername = new Map(playersInDb.map(player => [player.username, player]));

  return gameState.players.map(player => {
    const dbPlayer = playersByUsername.get(player.username);
    return {
      username: player.username,
      score: dbPlayer ? dbPlayer.score || 0 : 0,
      online: dbPlayer ? dbPlayer.online : false
    };
  });
}

async function emitScoreboard() {
  const playersForScoreboard = await getScoreboardPlayers();
  io.emit("updateScoreboard", playersForScoreboard);
}

// --- MANEJO DE SOCKETS ---
io.on("connection", (socket) => {
  trace("SOCKET_CONNECT", "Se conectó un cliente", { socketId: socket.id });

  // FILTRO DE ACCESO EN LOGIN: Respuesta inmediata garantizada
  socket.on("checkUsername", async (username) => {
    try {
      trace("CHECK_USERNAME", "Validando nombre de usuario", { username });
      if (gameState.inProgress) {
        warn("CHECK_USERNAME", "Intento de acceso mientras había una partida en curso", { username });
        return socket.emit("usernameResult", { available: false, error: "PARTIDA_EN_CURSO" });
      }

      const count = await Jugador.countDocuments({ online: true });
      if (count >= 4) {
        warn("CHECK_USERNAME", "Intento de acceso con la sala llena", { username, onlinePlayers: count });
        return socket.emit("usernameResult", { available: false, error: "SALA_LLENA" });
      }

      const existe = await Jugador.findOne({ username, online: true });
      if (existe) {
        warn("CHECK_USERNAME", "Nombre de usuario repetido", { username });
        return socket.emit("usernameResult", { available: false, error: "USUARIO_REPETIDO" });
      }

      // Si pasa todos los filtros, permitir ingreso
      info("CHECK_USERNAME", "Nombre de usuario validado correctamente", { username });
      socket.emit("usernameResult", { available: true, username });
    } catch (error) {
      console.error("Error en checkUsername:", error);
      logError("CHECK_USERNAME", "Error al validar el nombre de usuario", { message: error.message });
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
      info("LOBBY_JOIN", "Jugador ingresó al lobby", {
        username,
        totalPlayers: playersOnline.length,
        host: gameState.host
      });
    } catch (error) {
      console.error(error);
      logError("LOBBY_JOIN", "Error al ingresar al lobby", { message: error.message });
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
        info("CONFIG_UPDATE", "Configuración de juego actualizada", {
          host: socket.username,
          roundTime: gameState.roundTime,
          maxRounds: gameState.maxRounds
        });
      } else {
        warn("CONFIG_UPDATE", "Intento no autorizado de cambiar la configuración", {
          username: socket.username
        });
      }
    } catch (error) {
      console.error("Error updating config:", error);
      logError("CONFIG_UPDATE", "Error al actualizar la configuración", { message: error.message });
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
        warn("GAME_START", "Intento no autorizado de iniciar partida", {
          username: socket.username,
          host: gameState.host
        });
        return socket.emit('chat', { username: 'SISTEMA', text: 'Solo el anfitrión puede iniciar la partida.' });
      }

      let playersOnline = await Jugador.find({ online: true });
      const minPlayers = 2;
      const maxPlayers = 4;

      if (playersOnline.length < minPlayers || playersOnline.length > maxPlayers) {
        warn("GAME_START", "Cantidad de jugadores fuera de rango para iniciar", {
          players: playersOnline.length,
          minPlayers,
          maxPlayers
        });
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

      info("GAME_START", "Inicio de partida solicitado", {
        host: socket.username,
        roundTime,
        maxRounds,
        players: gameState.players.map((player) => player.username)
      });

      io.emit("redirectToGame");

      setTimeout(() => {
        startRound();
      }, 3500);
    } catch (err) {
      console.error('Error starting game:', err);
      logError("GAME_START", "Error al iniciar la partida", { message: err.message });
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
        gameState.players.push({ username: username, socketId: socket.id });
      }

      await emitScoreboard();
      trace("GAME_SYNC", "Pantalla de juego sincronizada", {
        username,
        inProgress: gameState.inProgress
      });

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
      logError("GAME_SYNC", "Error al sincronizar la pantalla de juego", { message: err.message });
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

          info("CORRECT_GUESS", "Palabra adivinada correctamente", {
            username,
            points,
            remainingTime: timeLeft
          });

          io.emit("chat", { 
            username: "SISTEMA", 
            text: `¡${username} ha adivinado la palabra! (+${points} pts)` 
          });

          await emitScoreboard();

          gameState.currentWord = ""; // Evita que otros jugadores adivinen la misma palabra repetidas veces
          endRound(`Adivinado por ${username}`);
        }
      } else {
        io.emit("chat", { username: username, text: msgData.text });
      }
    } catch (err) {
      console.error(err);
      logError("CHAT", "Error procesando mensaje de chat", { message: err.message });
    }
  });

  socket.on("disconnect", async () => {
    try {
      debug("SOCKET_DISCONNECT", "Cliente desconectado", { socketId: socket.id, username: socket.username });
      if (socket.username) {
        await Jugador.findOneAndUpdate({ username: socket.username }, { online: false });
        if (gameState.inProgress) {
          const idx = gameState.players.findIndex(p => p.username === socket.username);
          if (idx !== -1) {
            gameState.players[idx].socketId = "";
          }
        } else {
          gameState.players = gameState.players.filter(p => p.username !== socket.username);
        }
      }
      const playersOnline = await Jugador.find({ online: true });
      refreshHostIfNeeded(playersOnline);
      await emitScoreboard();
      io.emit("lobbyInfo", { players: playersOnline, host: gameState.host });
      await clearGameStateIfLobbyEmpty();
    } catch (error) {
      console.error(error);
      logError("DISCONNECT", "Error al procesar la desconexión", { message: error.message });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
  info("SERVER_LISTENING", "Servidor escuchando peticiones", { port: PORT });
});
