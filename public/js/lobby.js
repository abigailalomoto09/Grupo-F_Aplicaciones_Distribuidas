const socket = io();

const playersContainer = document.getElementById("playersContainer");
const totalPlayers = document.getElementById("totalPlayers");
const startGameBtn = document.getElementById("startGameBtn");

const roundTimeInput = document.getElementById("roundTime");
const roundTimeBtn = document.getElementById("roundTimeBtn");
const roundTimeLabel = document.getElementById("roundTimeLabel");
const roundTimeMenu = document.getElementById("roundTimeMenu");
const roundTimeArrow = document.getElementById("roundTimeArrow");
const roundTimeOptions = document.querySelectorAll(".round-time-option");

let cantidadJugadores = 0;
let partidaIniciando = false;

function cerrarMenuTiempo() {
  roundTimeMenu.classList.add("hidden");
  roundTimeArrow.classList.remove("rotate-180");
}

function abrirMenuTiempo() {
  roundTimeMenu.classList.remove("hidden");
  roundTimeArrow.classList.add("rotate-180");
}

function marcarOpcionSeleccionada(valor) {
  roundTimeOptions.forEach(function (opcion) {
    if (opcion.dataset.value === valor) {
      opcion.classList.add("bg-cyan-400/20");
    } else {
      opcion.classList.remove("bg-cyan-400/20");
    }
  });
}

function aplicarTiempo(valor, texto) {
  roundTimeInput.value = valor;
  roundTimeLabel.textContent = texto;
  marcarOpcionSeleccionada(valor);
}

function deshabilitarConfiguracion(deshabilitar) {
  startGameBtn.disabled = deshabilitar;
  roundTimeBtn.disabled = deshabilitar;

  roundTimeOptions.forEach(function (opcion) {
    opcion.disabled = deshabilitar;
  });

  if (deshabilitar) {
    roundTimeBtn.classList.add("opacity-60", "cursor-not-allowed");
  } else {
    roundTimeBtn.classList.remove("opacity-60", "cursor-not-allowed");
  }
}

function activarInicioPartida() {
  partidaIniciando = true;
  deshabilitarConfiguracion(true);
  startGameBtn.textContent = "Iniciando partida...";
}

function cancelarInicioPartida() {
  partidaIniciando = false;
  deshabilitarConfiguracion(false);
  startGameBtn.textContent = "Iniciar Partida";
}

// EVENTO: abrir o cerrar el menú de tiempo
roundTimeBtn.addEventListener("click", function () {
  if (partidaIniciando) {
    return;
  }

  if (roundTimeMenu.classList.contains("hidden")) {
    abrirMenuTiempo();
  } else {
    cerrarMenuTiempo();
  }
});

// EVENTO: elegir una opción de tiempo
roundTimeOptions.forEach(function (opcion) {
  opcion.addEventListener("click", function () {
    if (partidaIniciando) {
      return;
    }

    const valor = opcion.dataset.value;
    const texto = opcion.textContent.trim();

    aplicarTiempo(valor, texto);
    cerrarMenuTiempo();

    socket.emit("updateRoundTime", { roundTime: valor });
  });
});

// EVENTO: cerrar el menú al hacer clic fuera
document.addEventListener("click", function (evento) {
  const selectTiempo = document.getElementById("roundTimeSelect");

  if (!selectTiempo.contains(evento.target)) {
    cerrarMenuTiempo();
  }
});

function obtenerUsuario() {
  return sessionStorage.getItem("username");
}

function unirseAlLobby() {
  const username = obtenerUsuario();

  if (!username) {
    window.location.replace("/");
    return;
  }

  socket.emit("joinLobby", username);
}

unirseAlLobby();

// EVENTO: volver atrás con caché del navegador (evita mezclar usuarios)
window.addEventListener("pageshow", function (evento) {
  if (evento.persisted) {
    window.location.reload();
  }
});

socket.on("loginError", function (mensaje) {
  alert(mensaje);
  sessionStorage.removeItem("username");
  window.location.replace("/");
});

// EVENTO del socket: lista de jugadores
socket.on("playersUpdated", function (players) {
  cantidadJugadores = players.length;

  playersContainer.innerHTML = "";
  totalPlayers.textContent = players.length;

  players.forEach(function (player) {
    const card = document.createElement("div");

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

    playersContainer.appendChild(card);
  });
});

// EVENTO del socket: tiempo actualizado para todos
socket.on("roundTimeUpdated", function (data) {
  aplicarTiempo(String(data.roundTime), data.label);
});

// EVENTO del socket: alguien inició la partida (todos lo ven)
socket.on("gameStarting", function () {
  activarInicioPartida();
});

// EVENTO del socket: se canceló el inicio
socket.on("gameStartCancelled", function () {
  cancelarInicioPartida();
});

// EVENTO: clic en iniciar partida
startGameBtn.addEventListener("click", function () {
  if (partidaIniciando) {
    return;
  }

  if (cantidadJugadores < 2) {
    alert("Deben haber al menos dos jugadores para iniciar la partida.");
    return;
  }

  socket.emit("startGame");
});

// EVENTO del socket: la partida comenzó
socket.on("gameStarted", function (data) {
  sessionStorage.setItem("roundTime", data.roundTime);
  sessionStorage.setItem("tiempoRestante", data.tiempoRestante);
  window.location.replace("/juego");
});

// EVENTO del socket: error al iniciar
socket.on("startGameError", function (mensaje) {
  cancelarInicioPartida();
  alert(mensaje);
});

