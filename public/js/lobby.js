const socket = io();

const playersContainer = document.getElementById("playersContainer");
const totalPlayers = document.getElementById("totalPlayers");
const startGameBtn = document.getElementById("startGameBtn");

// OBTENER NOMBRE DE USUARIO
const username = localStorage.getItem("username");

// SI NO EXISTE USUARIO
if (!username) {
  window.location.href = "/";
}

// ENVIAR AL SERVIDOR
socket.emit("joinLobby", username);

// MANEJAR ERROR DE LOGIN (NOMBRE REPETIDO)
socket.on("loginError", (mensaje) => {
  alert(mensaje);
  window.location.href = "/";
});

// RECIBIR JUGADORES
socket.on("playersUpdated", (players) => {
  console.log(players);
  // LIMPIAR CONTENEDOR
  playersContainer.innerHTML = "";
  // ACTUALIZAR TOTAL
  totalPlayers.textContent = players.length;

  // RECORRER JUGADORES
  players.forEach(player => {
    const card = document.createElement("div");

    // ESTILOS DE TARJETA
    card.className = `
      bg-slate-900/30
      backdrop-blur-xl
      border border-white/10
      px-8 py-5
      rounded-full
      flex items-center gap-4
      hover:scale-105
      transition-all duration-300
    `;

    // CONTENIDO TARJETA
    card.innerHTML = `
      <div
        class="
          w-14 h-14 rounded-full
          bg-gradient-to-br
          from-cyan-400 to-purple-500
          flex items-center justify-center
          text-black font-black text-2xl
        "
      >
        ${player.username?.charAt(0)?.toUpperCase() || "?"}
      </div>
      <div>
        <h3 class="text-2xl font-black">
          ${player.username || "Jugador"}
        </h3>
        <p class="text-slate-300 text-sm">
          Listo para jugar
        </p>
      </div>
    `;

    // AGREGAR TARJETA AL HTML
    playersContainer.appendChild(card);
  });
});

// ESCUCHAR EVENTO DEL BOTÓN INICIAR PARTIDA
if (startGameBtn) {
  startGameBtn.addEventListener("click", () => {
    socket.emit("requestStartGame");
  });
}

// REDIRECCIÓN COLECTIVA AL INSTANTE
socket.on("redirectToGame", () => {
  window.location.href = "/game";
});