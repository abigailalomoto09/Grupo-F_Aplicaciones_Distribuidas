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

// CREAR ARREGLO DE JUGADORES
let players = [];

conectarDB();


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
  res.sendFile(path.join(__dirname, "views", "game.html"));
});


// SOCKETS
io.on("connection", (socket) => {

  console.log("Usuario conectado:", socket.id);

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

  });

});


// SERVIDOR
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Servidor ejecutándose en puerto ${PORT}`);
});