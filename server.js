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
  console.log("Base de datos limpia. Servidor listo para recibir conexiones.");
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
  gameState.timer = 60;

  console.log(`Jugando: Ronda ${gameState.currentRound}/${gameState.maxRounds}. Dibujante: ${drawer.username}`);

  io.emit("roundStarted", {
    drawerId: drawer.socketId,
    drawerName: drawer.username,
    wordLength: gameState.currentWord.length,
    currentRound: gameState.currentRound,
    maxRounds: gameState.maxRounds
  });

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
      ganadorTexto = `🏆 ¡El ganador de la partida es ${finalPlayers[0].username} con ${finalPlayers[0].score || 0} pts!`;
    }

    io.emit("gameEnded", {
      ganador: ganadorTexto,
      players: finalPlayers
    });
    
    // Reinicio completo del estado para la siguiente partida
    gameState.players = [];
    await Jugador.updateMany({}, { score: 0 }); 
  } catch (err) {
    console.error("Error al finalizar la partida:", err);
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
      io.emit("playersUpdated", playersOnline);
    } catch (error) {
      console.error(error);
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

  // INICIAR PARTIDA (ENTRE 2 Y 4 JUGADORES)
  socket.on("requestStartGame", async () => {
    let playersOnline = await Jugador.find({ online: true });
    
    if (playersOnline.length < 2 || playersOnline.length > 4) {
      return socket.emit("chat", { username: "SISTEMA", text: "⚠️ Se necesitan entre 2 y 4 jugadores para iniciar." });
    }

    playersOnline = mezclarJugadores(playersOnline);

    gameState.inProgress = true;
    gameState.currentRound = 1;
    gameState.turnCount = 0;
    gameState.currentDrawerIndex = 0;
    
    gameState.players = playersOnline.map(p => ({ username: p.username, socketId: p.socketId }));

    io.emit("redirectToGame");

    setTimeout(() => {
      startRound();
    }, 3500);
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
            maxRounds: gameState.maxRounds
          });
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
          jugador.score = (jugador.score || 0) + 100;
          await jugador.save();

          io.emit("chat", { 
            username: "SISTEMA", 
            text: `🎉 ¡${username} ha adivinado la palabra! (+100 pts)` 
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
      }
      const playersOnline = await Jugador.find({ online: true });
      io.emit("updateScoreboard", playersOnline);
    } catch (error) {
      console.error(error);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));