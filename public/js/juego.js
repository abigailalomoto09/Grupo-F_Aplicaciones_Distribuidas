<<<<<<< Updated upstream
=======
const socket = io();

const username = localStorage.getItem("username");
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

// CAMBIO CRÍTICO: Enviamos nuestro identificador para que el servidor reemplace el ID viejo por el ID nuevo
socket.emit("syncGameScreen", username);

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (text !== "") {
    socket.emit("sendMessage", { text });
    chatInput.value = "";
  }
});

socket.on("chatMessage", (data) => {
  const msgDiv = document.createElement("div");
  msgDiv.className = "bg-slate-800/60 p-3 rounded-xl border border-slate-700/50";
  
  if (data.username === "SISTEMA") {
    msgDiv.className = "bg-cyan-500/10 p-3 rounded-xl border border-cyan-500/30 text-cyan-400 font-bold";
  }

  msgDiv.innerHTML = `<span class="font-black text-cyan-400">${data.username}:</span> <span class="ml-1">${data.text}</span>`;
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

socket.on("timerUpdate", (timeLeft) => {
  timerDisplay.textContent = timeLeft;
});

socket.on("roundStarted", (data) => {
  drawerNameDisplay.textContent = data.drawerName;
  
  if (data.drawerId !== socket.id) {
    currentWordDisplay.textContent = "_ ".repeat(data.wordLength).trim();
    window.canDraw = false; 
  } else {
    window.canDraw = true; 
  }
});

socket.on("secretWord", (word) => {
  currentWordDisplay.textContent = word;
});

socket.on("updateScoreboard", (players) => {
  playersCountDisplay.textContent = `${players.length} jugadores`;
  scoreboardContainer.innerHTML = "";

  players.sort((a, b) => b.score - a.score);

  players.forEach(p => {
    const playerRow = document.createElement("div");
    playerRow.className = "flex items-center justify-between bg-slate-800/50 p-4 rounded-xl border border-slate-700/50";
    playerRow.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-full bg-cyan-500 text-black font-black flex items-center justify-center text-sm">
          ${p.username.charAt(0).toUpperCase()}
        </div>
        <span class="font-bold">${p.username}</span>
      </div>
      <span class="text-cyan-400 font-black">${p.score || 0} pts</span>
    `;
    scoreboardContainer.appendChild(playerRow);
  });
});
>>>>>>> Stashed changes
