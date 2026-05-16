const socket = io();

const timerDisplay = document.getElementById("timerDisplay");
const gameStatus = document.getElementById("gameStatus");

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

// EVENTO: volver atrás con caché del navegador
window.addEventListener("pageshow", function (evento) {
  if (evento.persisted) {
    window.location.reload();
  }
});

socket.on("gameState", function (data) {
  sessionStorage.setItem("roundTime", data.roundTime);
  sessionStorage.setItem("tiempoRestante", data.tiempoRestante);
  actualizarTimer(data.tiempoRestante);

  if (data.enCurso) {
    gameStatus.textContent = "Ronda activa";
  } else {
    gameStatus.textContent = "Ronda finalizada";
  }
});

socket.on("timerUpdate", function (data) {
  sessionStorage.setItem("tiempoRestante", data.tiempoRestante);
  actualizarTimer(data.tiempoRestante);
});

socket.on("roundEnded", function () {
  actualizarTimer(0);
  gameStatus.textContent = "Ronda finalizada";
});

socket.on("joinGameError", function (mensaje) {
  alert(mensaje);
  window.location.replace("/lobby");
});
