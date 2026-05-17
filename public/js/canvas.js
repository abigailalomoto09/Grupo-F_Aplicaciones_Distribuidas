const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
let isDrawing = false;

window.canDraw = false; // Control de seguridad compartido por juego.js

// Ajustes de dibujo
ctx.lineWidth = 3;
ctx.lineCap = "round";
ctx.strokeStyle = "#000000";

// Capturar eventos de ratón
canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mousemove", draw);
canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mouseout", stopDrawing);

function startDrawing(e) {
  if (!window.canDraw) return;
  isDrawing = true;
  draw(e);
}

function draw(e) {
  if (!isDrawing || !window.canDraw) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Dibujar localmente
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y);

  // Emitir al servidor
  socket.emit("draw", {
    x,
    y,
    color: ctx.strokeStyle,
    width: ctx.lineWidth,
    type: "drawing"
  });
}

function stopDrawing() {
  if (!isDrawing) return;
  isDrawing = false;
  ctx.beginPath();
  
  // Emitir fin de trazo
  socket.emit("draw", { type: "stop" });
}

// Escuchar dibujos de otros
socket.on("draw", (data) => {
  if (data.type === "drawing") {
    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.width;
    ctx.lineTo(data.x, data.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(data.x, data.y);
  } else if (data.type === "stop") {
    ctx.beginPath();
  }
});

// Limpiar canvas
socket.on("clearCanvas", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});