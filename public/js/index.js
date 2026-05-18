const socket = io();

// Forzar limpieza de almacenamiento de sesión previo (por pestaña)
sessionStorage.removeItem("username");

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("BtnIngresar");
  const usernameInput = document.getElementById("username");
  const errorMsg = document.getElementById("errorMsg");

  function attemptLogin() {
    if (!usernameInput) return;
    const username = usernameInput.value.trim();

    if (username !== "") {
      socket.emit("checkUsername", username);
    } else {
      if (errorMsg) {
        errorMsg.textContent = "⚠️ Por favor, ingresa un nombre de usuario.";
        errorMsg.classList.remove("hidden");
      } else {
        alert("Por favor, ingresa un nombre de usuario.");
      }
    }
  }

  if (loginForm) {
    // Se adapta automáticamente si en el HTML usaste un <form> o un <button>
    const eventType = loginForm.tagName === "FORM" ? "submit" : "click";
    loginForm.addEventListener(eventType, (e) => {
      e.preventDefault();
      attemptLogin();
    });
  }

  if (usernameInput) {
    usernameInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        attemptLogin();
      }
    });
  }
});

socket.on("usernameResult", (data) => {
  if (data.available) {
  sessionStorage.setItem("username", data.username);
  window.location.href = "/lobby";
  } else {
    const errorMsg = document.getElementById("errorMsg");
    if (errorMsg) {
      if (data.error === "PARTIDA_EN_CURSO") {
        errorMsg.textContent = "⚠️ Espera que se termine la partida actual para ingresar.";
      } else if (data.error === "SALA_LLENA") {
        errorMsg.textContent = "❌ La sala está llena (Máximo 4 jugadores).";
      } else if (data.error === "ERROR_SERVIDOR") {
        errorMsg.textContent = "❌ Error en el servidor. Intenta de nuevo.";
      } else {
        errorMsg.textContent = "El nombre de usuario ya está en uso.";
      }
      errorMsg.classList.remove("hidden");
    } else {
      // Alerta de respaldo si el contenedor HTML no está listo
      alert(data.error || "No se puede ingresar");
    }
  }
});
