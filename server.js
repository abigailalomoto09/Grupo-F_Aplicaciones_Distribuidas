const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const dotenv = require("dotenv");

const conectarDB = require("./db");

dotenv.config();

const app = express();

const server = http.createServer(app);

const io = new Server(server);

conectarDB();

io.on("connection", (socket) => {
  console.log("Usuario conectado");
});

server.listen(process.env.PORT, () => {
  console.log("Servidor ejecutándose");
});