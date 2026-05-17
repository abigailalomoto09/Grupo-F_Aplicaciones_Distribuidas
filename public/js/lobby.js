const socket = io();

const playersContainer = document.getElementById("playersContainer");
const totalPlayers = document.getElementById("totalPlayers");
const startGameBtn = document.getElementById("startGameBtn");

const username = localStorage.getItem("username");

if (!username) {
  window.location.href = "/";
}

// Unirse formalmente al proceso de sockets
socket.emit("joinLobby", username);

<<<<<<< Updated upstream

// RECIBIR JUGADORES
=======
socket.on("loginError", (mensaje) => {
  alert(mensaje);
  window.location.href = "/";
});

// Renderizar la lista dinámica en el Lobby
>>>>>>> Stashed changes
socket.on("playersUpdated", (players) => {
  totalPlayers.textContent = players.length;
  playersContainer.innerHTML = "";

  players.forEach(player => {
    const card = document.createElement("div");
    card.className = `bg-slate-900/30 backdrop-blur-xl border border-white/10 px-8 py-5 rounded-full flex items-center gap-4 hover:scale-105 transition-all duration-300`;
    card.innerHTML = `
      <div class="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center text-black font-black text-2xl">
        ${player.username?.charAt(0)?.toUpperCase() || "?"}
      </div>
      <div>
        <h3 class="text-2xl font-black">${player.username || "Jugador"}</h3>
        <p class="text-slate-300 text-sm">Listo para jugar</p>
      </div>
    `;
    playersContainer.appendChild(card);
  });
});

// EVENTO CLAVE: Escuchar el click para iniciar partida
startGameBtn.addEventListener("click", () => {
  socket.emit("requestStartGame");
});

// Redirigir colectivamente cuando el servidor dé la señal de arranque
socket.on("redirectToGame", () => {
  window.location.href = "/game";
});