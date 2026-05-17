const socket = io();

// OBTENER NOMBRE DE USUARIO
const username = localStorage.getItem("username");

if (!username) {
  window.location.href = "/";
}

// UNIRSE A LA PARTIDA (Lógica simplificada por ahora)
socket.emit("joinLobby", username);

// Aquí se agregarán los escuchadores para el temporizador, chat y puntajes más adelante
console.log("Juego cargado para:", username);
