const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const dotenv = require("dotenv");
const path = require("path");

const conectarDB = require("./db");
const Jugador = require("./models/Jugador");
const Partida = require("./models/Partida");

dotenv.config();

const MIN_USERNAME_LENGTH = 3;
const USERNAME_PATTERN = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9]+(?:\s+[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9]+)*$/;

const ETIQUETAS_TIEMPO = {
  20: "20 segundos",
  40: "40 segundos",
  60: "60 segundos",
};

function normalizeUsername(raw) {
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/\s+/g, " ");
}

function validateUsername(username) {
  if (!username) {
    return "Ingresa un nombre válido";
  }
  if (username.length < MIN_USERNAME_LENGTH) {
    return "El nombre debe tener al menos 3 caracteres";
  }
  if (!USERNAME_PATTERN.test(username)) {
    return "Solo letras, números y un espacio entre palabras";
  }
  return null;
}

const TIEMPOS_VALIDOS = [20, 40, 60];
const MIN_JUGADORES = 2;

const lobbyState = {
  roundTime: 20,
  iniciandoPartida: false,
};

const gameState = {
  enCurso: false,
  tiempoRonda: 20,
  tiempoRestante: 20,
  timerInterval: null,
};

const app = express();
const server = http.createServer(app);
const io = new Server(server);

function detenerTemporizador() {
  if (gameState.timerInterval) {
    clearInterval(gameState.timerInterval);
    gameState.timerInterval = null;
  }
}

function iniciarTemporizador() {
  detenerTemporizador();
  gameState.tiempoRestante = gameState.tiempoRonda;
  gameState.enCurso = true;

  gameState.timerInterval = setInterval(() => {
    gameState.tiempoRestante -= 1;

    io.to("game").emit("timerUpdate", {
      tiempoRestante: gameState.tiempoRestante,
    });

    if (gameState.tiempoRestante <= 0) {
      detenerTemporizador();
      gameState.enCurso = false;
      io.to("game").emit("roundEnded");
    }
  }, 1000);
}

conectarDB().then(async () => {
  // RESETEAR TODOS LOS JUGADORES A OFFLINE AL INICIAR EL SERVIDOR
  await Jugador.updateMany({}, { online: false });
  console.log("Estados de jugadores reseteados en la DB");
});

// CARPETA PUBLIC
app.use(express.static("public"));

// RUTAS HTML
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

app.get("/lobby", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "lobby.html"));
});

app.get("/juego", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "juego.html"));
});

// SOCKETS
io.on("connection", (socket) => {

  console.log("Usuario conectado:", socket.id);

  // VERIFICAR DISPONIBILIDAD DE NOMBRE
  socket.on("checkUsername", async (rawUsername) => {
    const username = normalizeUsername(rawUsername);
    const validationError = validateUsername(username);

    if (validationError) {
      socket.emit("usernameResult", {
        available: false,
        message: validationError,
      });
      return;
    }

    try {
      const existe = await Jugador.findOne({ username, online: true });
      if (existe) {
        socket.emit("usernameResult", {
          available: false,
          message: "Este nombre de usuario ya está en uso en este momento.",
        });
      } else {
        socket.emit("usernameResult", { available: true, username });
      }
    } catch (error) {
      console.error("Error al verificar nombre:", error);
      socket.emit("usernameResult", {
        error: true,
        message: "Error del servidor al verificar el nombre. Intenta de nuevo.",
      });
    }
  });

  // UNIRSE AL LOBBY
  socket.on("joinLobby", async (username) => {
    try {
      // VALIDAR SI EL USUARIO YA ESTÁ ONLINE
      const existe = await Jugador.findOne({ username, online: true });

      if (existe) {
        socket.emit("loginError", "Este nombre de usuario ya está en uso en este momento.");
        return;
      }

      socket.join("lobby");

      // Actualizar si existe, si no, crear (upsert)
      await Jugador.findOneAndUpdate(
        { username },
        { socketId: socket.id, online: true, ultimoAcceso: new Date() },
        { upsert: true, new: true }
      );

      // Obtener lista actualizada de jugadores online
      const playersOnline = await Jugador.find({ online: true });
      
      console.log("Jugadores online:", playersOnline.map(p => p.username));

      // ENVIAR LISTA ACTUALIZADA
      io.to("lobby").emit("playersUpdated", playersOnline);

      // ENVIAR CONFIGURACIÓN ACTUAL DEL LOBBY
      socket.emit("roundTimeUpdated", {
        roundTime: lobbyState.roundTime,
        label: ETIQUETAS_TIEMPO[lobbyState.roundTime],
      });

      if (lobbyState.iniciandoPartida) {
        socket.emit("gameStarting");
      }
    } catch (error) {
      console.error("Error en joinLobby:", error);
    }
  });

  // ACTUALIZAR TIEMPO DE RONDA (LOBBY)
  socket.on("updateRoundTime", (data) => {
    const tiempo = parseInt(data?.roundTime, 10);

    if (!TIEMPOS_VALIDOS.includes(tiempo) || lobbyState.iniciandoPartida) {
      return;
    }

    lobbyState.roundTime = tiempo;

    io.to("lobby").emit("roundTimeUpdated", {
      roundTime: tiempo,
      label: ETIQUETAS_TIEMPO[tiempo],
    });
  });

  // DESCONECTARSE DEL LOBBY
  socket.on("disconnect", async () => {
    try {
      // Al desconectarse, marcar como offline
      await Jugador.findOneAndUpdate({ socketId: socket.id }, { online: false });

      // Obtener lista actualizada
      const playersOnline = await Jugador.find({ online: true });
      
      io.to("lobby").emit("playersUpdated", playersOnline);

      console.log("Usuario desconectado");
    } catch (error) {
      console.error("Error en disconnect:", error);
    }
  });

  // INICIAR PARTIDA
  socket.on("startGame", async () => {
    try {
      if (lobbyState.iniciandoPartida) {
        return;
      }

      const tiempoRonda = lobbyState.roundTime;

      const jugadoresOnline = await Jugador.find({ online: true });

      if (jugadoresOnline.length < MIN_JUGADORES) {
        socket.emit(
          "startGameError",
          "Deben haber al menos dos jugadores para iniciar la partida."
        );
        return;
      }

      lobbyState.iniciandoPartida = true;
      io.to("lobby").emit("gameStarting");

      gameState.tiempoRonda = tiempoRonda;

      let partida = await Partida.findOne();

      if (!partida) {
        partida = new Partida({
          tiempoRonda,
          estado: "iniciada",
          jugadores: jugadoresOnline.map((j) => j.username),
        });
      } else {
        partida.tiempoRonda = tiempoRonda;
        partida.estado = "iniciada";
        partida.jugadores = jugadoresOnline.map((j) => j.username);
      }

      await partida.save();
      iniciarTemporizador();

      io.to("lobby").emit("gameStarted", {
        roundTime: gameState.tiempoRonda,
        tiempoRestante: gameState.tiempoRestante,
      });
    } catch (error) {
      console.error("Error en startGame:", error);
      lobbyState.iniciandoPartida = false;
      io.to("lobby").emit("gameStartCancelled");
      socket.emit("startGameError", "No se pudo iniciar la partida. Intenta de nuevo.");
    }
  });

  // UNIRSE A LA PARTIDA (PANTALLA JUEGO)
  socket.on("joinGame", async (username) => {
    try {
      const nombre = normalizeUsername(username);

      if (!nombre) {
        socket.emit("joinGameError", "Nombre de usuario no válido.");
        return;
      }

      socket.join("game");
      socket.leave("lobby");

      await Jugador.findOneAndUpdate(
        { username: nombre },
        { socketId: socket.id, online: true, ultimoAcceso: new Date() },
        { upsert: true, new: true }
      );

      socket.emit("gameState", {
        roundTime: gameState.tiempoRonda,
        tiempoRestante: gameState.tiempoRestante,
        enCurso: gameState.enCurso,
      });
    } catch (error) {
      console.error("Error en joinGame:", error);
      socket.emit("joinGameError", "No se pudo unir a la partida.");
    }
  });

});

// SERVIDOR
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Servidor ejecutándose en puerto ${PORT}`);
});