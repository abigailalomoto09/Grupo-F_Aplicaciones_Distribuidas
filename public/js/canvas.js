const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
let isDrawing = false;
let activePointerId = null;

function resizeCanvas() {
  const container = canvas.parentElement;
  if (!container) return;

  const dpr = window.devicePixelRatio || 1;
  const width = Math.floor(container.clientWidth);
  const height = Math.floor(container.clientHeight);

  if (width <= 0 || height <= 0) return;

  const previousWidth = canvas.width;
  const previousHeight = canvas.height;
  const snapshot = document.createElement("canvas");

  if (previousWidth > 0 && previousHeight > 0) {
    snapshot.width = previousWidth;
    snapshot.height = previousHeight;
    snapshot.getContext("2d").drawImage(canvas, 0, 0);
  }

  canvas.style.width = width + "px";
  canvas.style.height = height + "px";

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#000000";

  ctx.clearRect(0, 0, width, height);

  if (snapshot.width > 0 && snapshot.height > 0) {
    ctx.drawImage(
      snapshot,
      0,
      0,
      snapshot.width,
      snapshot.height,
      0,
      0,
      width,
      height
    );
  }
}

const container = canvas.parentElement;
if (container && "ResizeObserver" in window) {
  const resizeObserver = new ResizeObserver(() => {
    resizeCanvas();
  });
  resizeObserver.observe(container);
}

window.addEventListener("resize", () => {
  resizeCanvas();
});

resizeCanvas();

window.canDraw = false;
canvas.style.touchAction = "none";

ctx.lineWidth = 3;
ctx.lineCap = "round";
ctx.strokeStyle = "#000000";

canvas.addEventListener("pointerdown", startDrawing);
canvas.addEventListener("pointermove", draw);
canvas.addEventListener("pointerup", stopDrawing);
canvas.addEventListener("pointercancel", stopDrawing);
canvas.addEventListener("pointerleave", stopDrawing);

function startDrawing(e) {
  if (!window.canDraw) return;
  isDrawing = true;
  activePointerId = e.pointerId;

  if (canvas.setPointerCapture && activePointerId !== null) {
    try {
      canvas.setPointerCapture(activePointerId);
    } catch (err) {
      // Ignore capture failures; drawing still works without it.
    }
  }

  draw(e);
}

function draw(e) {
  if (!isDrawing || !window.canDraw) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y);

  socket.emit("draw", {
    x,
    y,
    color: ctx.strokeStyle,
    width: ctx.lineWidth,
    type: "drawing"
  });
}

function stopDrawing(e) {
  if (!isDrawing) return;
  isDrawing = false;

  if (canvas.releasePointerCapture && activePointerId !== null) {
    try {
      canvas.releasePointerCapture(activePointerId);
    } catch (err) {
      // Ignore capture failures.
    }
  }

  activePointerId = null;
  ctx.beginPath();

  socket.emit("draw", { type: "stop" });
}

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

socket.on("clearCanvas", () => {
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
});
