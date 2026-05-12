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

  socket.on("disconnect", () => {
    console.log("Usuario desconectado");
  });

});


// SERVIDOR
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Servidor ejecutándose en puerto ${PORT}`);
});