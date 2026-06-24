const socket = io();

const playersContainer = document.getElementById("playersContainer");
const totalPlayers     = document.getElementById("totalPlayers");
const startGameBtn     = document.getElementById("startGameBtn");
const roundTimeSelect  = document.getElementById("roundTime");
const maxRoundsSelect  = document.getElementById("maxRounds");

// Username guardado (por OAuth o nombre directo)
const username = sessionStorage.getItem("username");

if (!username) {
    window.location.href = "/";
}

// Helpers

// Extrae el primer nombre visible (antes de espacio o guión bajo)
function primerNombre(raw) {
    if (!raw) return "Jugador";
    return raw.split(/[\s_]+/)[0];
}

function buildPlayerCard(player, host) {
    const nombre = primerNombre(player.username);
    const esHost = player.username === host;

    const card = document.createElement("div");
    card.className = `
        bg-slate-900/30 backdrop-blur-xl border border-white/10
        px-8 py-5 rounded-full flex items-center gap-4
        hover:scale-105 transition-all duration-300
    `;
    card.innerHTML = `
        <div class="
            w-14 h-14 rounded-full
            bg-gradient-to-br from-cyan-400 to-purple-500
            flex items-center justify-center
            text-black font-black text-2xl flex-shrink-0
        ">
            ${nombre.charAt(0).toUpperCase()}
        </div>
        <div class="min-w-0">
            <h3 class="text-2xl font-black truncate">${nombre}</h3>
            <p class="text-slate-300 text-sm">${esHost ? "Anfitrión" : "Listo para jugar"}</p>
        </div>
    `;
    return card;
}

// Conexión

socket.on("connect", () => {
    if (username) socket.emit("joinLobby", username);
});

if (socket.connected && username) {
    socket.emit("joinLobby", username);
}

socket.on("loginError", (mensaje) => {
    alert(mensaje);
    window.location.href = "/";
});

// Jugadores

socket.on("playersUpdated", (players) => {
    playersContainer.innerHTML = "";
    totalPlayers.textContent = players.length;
    players.forEach(player => {
        playersContainer.appendChild(buildPlayerCard(player, null));
    });
});

socket.on("lobbyInfo", (data) => {
    const { players, host } = data;

    playersContainer.innerHTML = "";
    totalPlayers.textContent = players.length;
    players.forEach(player => {
        playersContainer.appendChild(buildPlayerCard(player, host));
    });

    // Solo el host puede iniciar y configurar
    const esHost = username === host;

    if (startGameBtn) {
        startGameBtn.disabled = !esHost;
    }
    if (roundTimeSelect) roundTimeSelect.disabled = !esHost;
    if (maxRoundsSelect) maxRoundsSelect.disabled = !esHost;
});

// Configuración

function emitConfig() {
    socket.emit("updateGameConfig", {
        roundTime: parseInt(roundTimeSelect.value, 10),
        maxRounds: parseInt(maxRoundsSelect.value, 10)
    });
}

if (roundTimeSelect) roundTimeSelect.addEventListener("change", emitConfig);
if (maxRoundsSelect) maxRoundsSelect.addEventListener("change", emitConfig);

socket.on("configUpdated", (config) => {
    if (roundTimeSelect) roundTimeSelect.value = String(config.roundTime);
    if (maxRoundsSelect) maxRoundsSelect.value = String(config.maxRounds);
});

// Iniciar partida

if (startGameBtn) {
    startGameBtn.addEventListener("click", () => {
        socket.emit("requestStartGame", {
            roundTime: roundTimeSelect ? parseInt(roundTimeSelect.value, 10) : 60,
            maxRounds: maxRoundsSelect ? parseInt(maxRoundsSelect.value, 10) : 3
        });
    });
}

socket.on("redirectToGame", () => {
    window.location.href = "/game";
});

// Salir del lobby
const exitLobbyBtn = document.getElementById("exitLobbyBtn");
if (exitLobbyBtn) {
    exitLobbyBtn.addEventListener("click", () => {
        sessionStorage.clear();
        localStorage.removeItem("token");
        window.location.href = "/auth/logout";
    });
}