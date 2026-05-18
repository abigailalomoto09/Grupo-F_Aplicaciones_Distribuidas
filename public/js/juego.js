const socket = io();
const username = sessionStorage.getItem("username");

if (!username) {
  window.location.href = "/";
}

const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");
const timerDisplay = document.getElementById("timer").querySelector("h2");
const currentWordDisplay = document.getElementById("currentWord");
const drawerNameDisplay = document.getElementById("drawerName");
const scoreboardContainer = document.getElementById("scoreboard");
const playersCountDisplay = document.getElementById("playersCount");
const gameStatusIndicator = document.getElementById("gameStatus");

// emitiremos syncGameScreen al final, después de haber registrado todos los listeners

socket.on("gameBlocked", (message) => {
  alert(message);
  window.location.href = "/";
});

if (chatForm) {
  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (text !== "") {
      socket.emit("chat", { text: text });
      chatInput.value = "";
    }
  });
}

socket.on("chat", (data) => {
  const msgDiv = document.createElement("div");
  if (data.username === "SISTEMA") {
    msgDiv.className = "bg-cyan-500/10 p-3 rounded-xl border border-cyan-500/30 text-cyan-400 font-bold text-sm text-center animate-pulse";
    msgDiv.innerHTML = `<span>${data.text}</span>`;
  } else {
    msgDiv.className = "bg-slate-800/60 p-3 rounded-xl border border-slate-700/50 text-sm flex flex-col";
    msgDiv.innerHTML = `<div><span class="font-black text-cyan-400">${data.username}:</span><span class="ml-1 text-slate-200">${data.text}</span></div>`;
  }
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight; 
});

socket.on("timerUpdate", (timeLeft) => {
  if (timerDisplay) timerDisplay.textContent = timeLeft;
});

socket.on("roundStarted", (data) => {
  if (drawerNameDisplay) drawerNameDisplay.textContent = data.drawerName;
  if (gameStatusIndicator) gameStatusIndicator.textContent = `Ronda ${data.currentRound} / ${data.maxRounds}`;

  if (data.drawerName !== username) {
    if (currentWordDisplay) currentWordDisplay.textContent = "_ ".repeat(data.wordLength).trim();
    window.canDraw = false; 
    if (chatInput) {
      chatInput.disabled = false;
      chatInput.placeholder = "Escribe tu respuesta...";
    }
  } else {
    window.canDraw = true;  
    if (chatInput) {
      chatInput.disabled = true;
      chatInput.placeholder = "¡Estás dibujando! No puedes usar el chat.";
      chatInput.value = "";
    }
  }
});

socket.on("secretWord", (payload) => {
  const word = payload && typeof payload === 'object' ? payload.word : payload;
  if (currentWordDisplay) currentWordDisplay.textContent = word;
});

socket.on("updateScoreboard", (players) => {
  if (playersCountDisplay) playersCountDisplay.textContent = `${players.length} jugadores`;
  if (!scoreboardContainer) return;
  
  scoreboardContainer.innerHTML = "";
  players.sort((a, b) => b.score - a.score);

  players.forEach(p => {
    const row = document.createElement("div");
    row.className = "flex items-center justify-between bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 transition-all";
    row.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-full bg-cyan-500 text-black font-black flex items-center justify-center text-sm">
          ${p.username.charAt(0).toUpperCase()}
        </div>
        <span class="font-bold ${p.username === username ? 'text-cyan-400 underline font-black' : 'text-slate-100'}">${p.username}</span>
      </div>
      <span class="text-cyan-400 font-black">${p.score || 0} pts</span>
    `;
    scoreboardContainer.appendChild(row);
  });
});

socket.on("gameEnded", (data) => {
  window.canDraw = false;
  
  const podio = data.players.sort((a, b) => b.score - a.score);
  let tablaPodioHTML = "";
  
  podio.forEach((p, index) => {
    tablaPodioHTML += `
      <div class="flex justify-between items-center bg-slate-800/60 p-3 rounded-xl border border-slate-700/50 my-2">
        <span class="font-bold text-white">${index + 1}. ${p.username}</span>
        <span class="text-cyan-400 font-black">${p.score || 0} pts</span>
      </div>
    `;
  });

  const canvasArea = document.getElementById("gameCanvas").parentElement;
  if (canvasArea) {
    canvasArea.innerHTML = `
      <div class="text-center p-8 bg-slate-900 border border-cyan-500/30 rounded-3xl max-w-md mx-auto shadow-2xl max-h-[500px] overflow-y-auto">
        <h2 class="text-3xl font-black text-cyan-400 mb-4">¡PARTIDA FINALIZADA!</h2>
        <p class="text-xl font-bold text-green-400 mb-6">${data.ganador}</p>
        
        <div class="mb-6 text-left">
          <h3 class="text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">Resumen de Posiciones:</h3>
          ${tablaPodioHTML}
        </div>

        <button onclick="window.location.href='/lobby'" class="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-black px-8 py-3 rounded-xl transition-all shadow-lg shadow-cyan-500/20">
          Volver al Lobby
        </button>
      </div>
    `;
  }
});

  // Emitir sincronización una vez que todos los listeners están registrados
  socket.emit("syncGameScreen", username);
