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

app.get("/game", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "juego.html"));
});


// SOCKETS
io.on("connection", (socket) => {

  console.log("Usuario conectado:", socket.id);

  // VERIFICAR DISPONIBILIDAD DE NOMBRE
  socket.on("checkUsername", async (username) => {
    try {
      const existe = await Jugador.findOne({ username, online: true });
      if (existe) {
        socket.emit("usernameResult", { available: false });
      } else {
        socket.emit("usernameResult", { available: true, username });
      }
    } catch (error) {
      console.error("Error al verificar nombre:", error);
    }
  });

  //UNIRSE AL LOBBY
  socket.on("joinLobby", async (username) => {
    try {
      // VALIDAR SI EL USUARIO YA ESTÁ ONLINE
      const existe = await Jugador.findOne({ username, online: true });

      if (existe) {
        socket.emit("loginError", "Este nombre de usuario ya está en uso en este momento.");
        return;
      }

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
      io.emit("playersUpdated", playersOnline);
    } catch (error) {
      console.error("Error en joinLobby:", error);
    }
  });

  // EVENTO DE DIBUJO
  socket.on("draw", (data) => {
    // Retransmitir a todos los demás jugadores en la partida
    socket.broadcast.emit("draw", data);
  });

  // EVENTO PARA LIMPIAR CANVAS
  socket.on("clearCanvas", () => {
    socket.broadcast.emit("clearCanvas");
  });

  // DESCONECTARSE DEL LOBBY
  socket.on("disconnect", async () => {
    try {
      // Al desconectarse, marcar como offline
      await Jugador.findOneAndUpdate({ socketId: socket.id }, { online: false });

      // Obtener lista actualizada
      const playersOnline = await Jugador.find({ online: true });
      
      io.emit("playersUpdated", playersOnline);

      console.log("Usuario desconectado");
    } catch (error) {
      console.error("Error en disconnect:", error);
    }
  });

});


// SERVIDOR
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Servidor ejecutándose en puerto ${PORT}`);
});