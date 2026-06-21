const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
let isDrawing = false;

// Make canvas responsive to its container and handle devicePixelRatio for crisp rendering
function resizeCanvas() {
  const container = canvas.parentElement;
  if (!container) return;

  const dpr = window.devicePixelRatio || 1;
  const width = Math.floor(container.clientWidth);
  const height = Math.floor(container.clientHeight);

  // Set display size (css pixels).
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';

  // Set actual size in memory (scaled for DPR)
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);

  // Reset transform and scale to DPR
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  // Re-apply drawing defaults (line width will be in CSS pixels)
  ctx.lineWidth = Math.max(2, 3);
  ctx.lineCap = "round";
  ctx.strokeStyle = ctx.strokeStyle || "#000000";

  // Clear to avoid stretching previous content
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

window.addEventListener('resize', () => {
  resizeCanvas();
});

// Initial resize
resizeCanvas();

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
