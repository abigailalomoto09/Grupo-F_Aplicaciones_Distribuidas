const socket = io();

const playersContainer = document.getElementById("playersContainer");
const totalPlayers = document.getElementById("totalPlayers");
const startGameBtn = document.getElementById("startGameBtn");
const roundTimeSelect = document.getElementById("roundTime");
const maxRoundsSelect = document.getElementById("maxRounds");

// OBTENER NOMBRE DE USUARIO Y TOKEN (por pestaña)
const username = sessionStorage.getItem("username");
const token = sessionStorage.getItem("token");

// SI NO EXISTE USUARIO O TOKEN
if (!username || !token) {
  window.location.href = "/";
}

// REINGRESAR AL LOBBY DESPUÉS DE UNA RECONEXIÓN
socket.on("connect", () => {
  if (username) {
    socket.emit("joinLobby", username);
  }
});

// MANEJAR ERROR DE LOGIN (NOMBRE REPETIDO)
socket.on("loginError", (mensaje) => {
  alert(mensaje);
  window.location.href = "/";
});

// SI EL SOCKET YA ESTÁ CONECTADO AL CARGAR LA PÁGINA
if (socket.connected && username) {
  socket.emit("joinLobby", username);
}


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

// Recibir info de lobby (host + jugadores)
socket.on("lobbyInfo", (data) => {
  const { players, host } = data;
  // Actualizar UI similar a playersUpdated
  playersContainer.innerHTML = "";
  totalPlayers.textContent = players.length;
  players.forEach(player => {
    const card = document.createElement("div");
    card.className = `bg-slate-900/30 backdrop-blur-xl border border-white/10 px-8 py-5 rounded-full flex items-center gap-4`;
    card.innerHTML = `
      <div class="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center text-black font-black text-2xl">${player.username?.charAt(0)?.toUpperCase() || "?"}</div>
      <div>
        <h3 class="text-2xl font-black">${player.username || "Jugador"}</h3>
        <p class="text-slate-300 text-sm">${player.username === host ? 'Anfitrión' : 'Listo para jugar'}</p>
      </div>
    `;
    playersContainer.appendChild(card);
  });

  // Solo el host puede iniciar
  if (startGameBtn) {
    if (username === host) {
      startGameBtn.disabled = false;
      startGameBtn.classList.remove('opacity-50');
    } else {
      startGameBtn.disabled = true;
      startGameBtn.classList.add('opacity-50');
    }
  }

  // Solo el host puede cambiar la configuración
  if (username !== host) {
    if (roundTimeSelect) roundTimeSelect.disabled = true;
    if (maxRoundsSelect) maxRoundsSelect.disabled = true;
  } else {
    if (roundTimeSelect) roundTimeSelect.disabled = false;
    if (maxRoundsSelect) maxRoundsSelect.disabled = false;
  }
});

// SINCRONIZAR CAMBIOS DE CONFIGURACIÓN EN TIEMPO REAL
if (roundTimeSelect) {
  roundTimeSelect.addEventListener("change", () => {
    socket.emit("updateGameConfig", {
      roundTime: parseInt(roundTimeSelect.value, 10),
      maxRounds: parseInt(maxRoundsSelect.value, 10)
    });
  });
}

if (maxRoundsSelect) {
  maxRoundsSelect.addEventListener("change", () => {
    socket.emit("updateGameConfig", {
      roundTime: parseInt(roundTimeSelect.value, 10),
      maxRounds: parseInt(maxRoundsSelect.value, 10)
    });
  });
}

// RECIBIR CAMBIOS DE CONFIGURACIÓN DE OTROS JUGADORES
socket.on("configUpdated", (config) => {
  if (roundTimeSelect) roundTimeSelect.value = String(config.roundTime);
  if (maxRoundsSelect) maxRoundsSelect.value = String(config.maxRounds);
  console.log("Configuración actualizada:", config);
});

// ESCUCHAR EVENTO DEL BOTÓN INICIAR PARTIDA
if (startGameBtn) {
  startGameBtn.addEventListener("click", () => {
    const options = {
      roundTime: roundTimeSelect ? parseInt(roundTimeSelect.value, 10) : 60,
      maxRounds: maxRoundsSelect ? parseInt(maxRoundsSelect.value, 10) : 3
    };
    socket.emit("requestStartGame", options);
  });
}

// REDIRECCIÓN COLECTIVA AL INSTANTE
socket.on("redirectToGame", () => {
  window.location.href = "/game";
});