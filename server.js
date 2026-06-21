require('dotenv').config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

const Jugador = require("./models/Jugador");
const vistasRoutes = require("./routes/views");
const authRoutes = require("./routes/auth");
const configurarSockets = require("./sockets/gameSockets");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware y archivos estáticos
app.use(express.json());
app.use(express.static("public"));

// Enrutamiento de vistas y API de auth
app.use("/", vistasRoutes);
app.use("/api/auth", authRoutes);


// Configuración de WebSockets
configurarSockets(io);

// Conexión a MongoDB y levantamiento del servidor
const PORT = process.env.PORT || 3000;

if (!process.env.MONGO_URI) {
  console.error("MONGO_URI no está definido en el archivo .env");
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("MongoDB conectado");

    // Limpieza absoluta de jugadores conectados al iniciar el servidor
    await Jugador.updateMany({}, { online: false, score: 0, socketId: "" });
    console.log("Servidor listo para recibir conexiones.");

    server.listen(PORT, () => {
      console.log(`Servidor corriendo en el puerto ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Error conectando a MongoDB:", err);
    process.exit(1);
  });