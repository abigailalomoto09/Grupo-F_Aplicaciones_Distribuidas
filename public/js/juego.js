const socket = io();

const timerDisplay = document.getElementById("timerDisplay");
const gameStatus = document.getElementById("gameStatus");
const scoreboard = document.getElementById("scoreboard");
const playersCount = document.getElementById("playersCount");
const drawerName = document.getElementById("drawerName");
const currentWord = document.getElementById("currentWord");

let dibujanteActual = null;

function obtenerUsuario() {
  return sessionStorage.getItem("username");
}

function unirseAlJuego() {
  const username = obtenerUsuario();

  if (!username) {
    window.location.replace("/");
    return;
  }

  socket.emit("joinGame", username);
}

function mostrarJugadores(jugadores) {
  scoreboard.innerHTML = "";

  if (!jugadores || jugadores.length === 0) {
    playersCount.textContent = "0 jugadores";
    return;
  }

  playersCount.textContent = jugadores.length + " jugadores";

  jugadores.forEach(function (jugador) {
    const fila = document.createElement("div");

    const esDibujante = jugador.username === dibujanteActual;

    fila.className =
      "rounded-2xl px-4 py-3 flex items-center justify-between " +
      (esDibujante
        ? "bg-cyan-500/20 border border-cyan-400"
        : "bg-slate-800");

    const estado = jugador.conectado ? "En línea" : "Desconectado";
    const colorEstado = jugador.conectado ? "text-green-400" : "text-slate-500";

    const info = document.createElement("div");
    const nombre = document.createElement("p");
    const estadoJugador = document.createElement("p");
    const puntos = document.createElement("p");

    nombre.className = "font-bold text-lg";
    nombre.textContent = jugador.username + (esDibujante ? " ✏️" : "");

    estadoJugador.className = "text-sm " + colorEstado;
    estadoJugador.textContent = estado;

    puntos.className = "text-2xl font-black text-cyan-400";
    puntos.textContent = jugador.puntos + " pts";

    info.appendChild(nombre);
    info.appendChild(estadoJugador);
    fila.appendChild(info);
    fila.appendChild(puntos);

    scoreboard.appendChild(fila);
  });
}

function aplicarRonda(data) {
  const miUsuario = obtenerUsuario();

  dibujanteActual = data.drawer;
  drawerName.textContent = data.drawer || "---";

  if (data.isDrawer) {
    currentWord.textContent = data.word || "???";
    currentWord.classList.add("text-cyan-400");
    gameStatus.textContent = "¡Tú dibujas! (Ronda " + data.roundNumber + ")";
    gameStatus.classList.remove("bg-cyan-500");
    gameStatus.classList.add("bg-purple-500");
  } else {
    currentWord.textContent = data.wordHint || "_ _ _ _ _";
    currentWord.classList.remove("text-cyan-400");
    gameStatus.textContent = "Adivina el dibujo (Ronda " + data.roundNumber + ")";
    gameStatus.classList.remove("bg-purple-500");
    gameStatus.classList.add("bg-cyan-500");
  }

  if (data.jugadores) {
    mostrarJugadores(data.jugadores);
  }

  sessionStorage.setItem("isDrawer", data.isDrawer ? "true" : "false");
}

function actualizarTimer(segundos) {
  timerDisplay.textContent = segundos;

  if (segundos <= 10) {
    timerDisplay.classList.remove("text-cyan-400");
    timerDisplay.classList.add("text-red-400");
  } else {
    timerDisplay.classList.remove("text-red-400");
    timerDisplay.classList.add("text-cyan-400");
  }
}

const tiempoGuardado = sessionStorage.getItem("tiempoRestante");
const tiempoRondaGuardado = sessionStorage.getItem("roundTime");

if (tiempoGuardado) {
  actualizarTimer(parseInt(tiempoGuardado, 10));
} else if (tiempoRondaGuardado) {
  actualizarTimer(parseInt(tiempoRondaGuardado, 10));
}

unirseAlJuego();

window.addEventListener("pageshow", function (evento) {
  if (evento.persisted) {
    window.location.reload();
  }
});

socket.on("gameState", function (data) {
  sessionStorage.setItem("roundTime", data.roundTime);
  sessionStorage.setItem("tiempoRestante", data.tiempoRestante);
  actualizarTimer(data.tiempoRestante);

  if (data.drawer) {
    aplicarRonda(data);
  } else if (data.jugadores) {
    mostrarJugadores(data.jugadores);
  }

  if (data.enCurso) {
    if (!data.isDrawer && data.drawer) {
      gameStatus.textContent = "Ronda activa";
    }
  } else {
    gameStatus.textContent = "Esperando jugadores...";
  }
});

socket.on("roundStart", function (data) {
  aplicarRonda(data);
  actualizarTimer(data.tiempoRestante);
});

socket.on("playersInGame", function (jugadores) {
  mostrarJugadores(jugadores);
});

socket.on("timerUpdate", function (data) {
  sessionStorage.setItem("tiempoRestante", data.tiempoRestante);
  actualizarTimer(data.tiempoRestante);
});

socket.on("roundEnded", function (data) {
  actualizarTimer(0);
  gameStatus.textContent = "Ronda finalizada";
  gameStatus.classList.remove("bg-purple-500");
  gameStatus.classList.add("bg-cyan-500");

  if (data && data.word) {
    currentWord.textContent = data.word;
  }
});

socket.on("gameEnded", function (data) {
  gameStatus.textContent = "Partida terminada";
  alert("¡Partida terminada! Revisa los puntajes finales.");

  if (data && data.jugadores) {
    mostrarJugadores(data.jugadores);
  }
});

socket.on("joinGameError", function (mensaje) {
  alert(mensaje);
  window.location.replace("/lobby");
});
