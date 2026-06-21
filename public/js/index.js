const socket = io();

// Forzar limpieza de almacenamiento previo (por pestaña)
sessionStorage.removeItem("username");
sessionStorage.removeItem("token");

document.addEventListener("DOMContentLoaded", () => {
  const tabLogin = document.getElementById("tabLogin");
  const tabRegister = document.getElementById("tabRegister");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const errorMsg = document.getElementById("errorMsg");
  const successMsg = document.getElementById("successMsg");

  // Inputs Login
  const loginEmailInput = document.getElementById("loginEmail");
  const loginPasswordInput = document.getElementById("loginPassword");

  // Inputs Register
  const registerUsernameInput = document.getElementById("registerUsername");
  const registerEmailInput = document.getElementById("registerEmail");
  const registerPasswordInput = document.getElementById("registerPassword");

  // Función para alternar pestañas
  if (tabLogin && tabRegister) {
    tabLogin.addEventListener("click", () => {
      // Activar login tab
      tabLogin.classList.add("text-cyan-400", "border-cyan-400");
      tabLogin.classList.remove("text-slate-400", "border-transparent");
      // Desactivar register tab
      tabRegister.classList.remove("text-cyan-400", "border-cyan-400");
      tabRegister.classList.add("text-slate-400", "border-transparent");

      // Mostrar/Ocultar formularios
      loginForm.classList.remove("hidden");
      registerForm.classList.add("hidden");
      clearMessages();
    });

    tabRegister.addEventListener("click", () => {
      // Activar register tab
      tabRegister.classList.add("text-cyan-400", "border-cyan-400");
      tabRegister.classList.remove("text-slate-400", "border-transparent");
      // Desactivar login tab
      tabLogin.classList.remove("text-cyan-400", "border-cyan-400");
      tabLogin.classList.add("text-slate-400", "border-transparent");

      // Mostrar/Ocultar formularios
      registerForm.classList.remove("hidden");
      loginForm.classList.add("hidden");
      clearMessages();
    });
  }

  function clearMessages() {
    if (errorMsg) {
      errorMsg.textContent = "";
      errorMsg.classList.add("hidden");
    }
    if (successMsg) {
      successMsg.textContent = "";
      successMsg.classList.add("hidden");
    }
  }

  function showMsg(container, text, isError = true) {
    if (!container) return;
    container.textContent = text;
    container.classList.remove("hidden");
  }

  // Manejo de Registro
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearMessages();

      const username = registerUsernameInput.value.trim();
      const correo = registerEmailInput.value.trim();
      const contrasenia = registerPasswordInput.value;

      try {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ username, correo, contrasenia })
        });

        const data = await response.json();

        if (response.ok) {
          showMsg(successMsg, "¡Registro completado con éxito! Ahora puedes iniciar sesión.", false);
          registerForm.reset();
          // Simular click en pestaña login para comodidad del usuario
          setTimeout(() => {
            tabLogin.click();
          }, 1500);
        } else {
          showMsg(errorMsg, data.message || "Error al registrar el jugador.");
        }
      } catch (err) {
        showMsg(errorMsg, "Error de red o del servidor. Inténtalo de nuevo.");
      }
    });
  }

  // Manejo de Login
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearMessages();

      const correo = loginEmailInput.value.trim();
      const contrasenia = loginPasswordInput.value;

      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ correo, contrasenia })
        });

        const data = await response.json();

        if (response.ok) {
          // Guardar token temporalmente en sessionStorage para que sea accesible
          sessionStorage.setItem("token", data.token);
          // Verificar disponibilidad de la sala y de juego mediante socket.io
          socket.emit("checkUsername", data.username);
        } else {
          showMsg(errorMsg, data.message || "Credenciales incorrectas.");
        }
      } catch (err) {
        showMsg(errorMsg, "Error de red o del servidor. Inténtalo de nuevo.");
      }
    });
  }
});

// Respuesta del socket.io sobre checkUsername
socket.on("usernameResult", (data) => {
  const errorMsg = document.getElementById("errorMsg");
  if (data.available) {
    sessionStorage.setItem("username", data.username);
    window.location.href = "/lobby";
  } else {
    // Si la sala está llena o hay partida en curso, limpiamos el token para requerir re-login
    sessionStorage.removeItem("token");
    if (errorMsg) {
      if (data.error === "PARTIDA_EN_CURSO") {
        errorMsg.textContent = "Espera que se termine la partida actual para ingresar.";
      } else if (data.error === "SALA_LLENA") {
        errorMsg.textContent = "La sala está llena (Máximo 4 jugadores).";
      } else if (data.error === "ERROR_SERVIDOR") {
        errorMsg.textContent = "Error en el servidor. Intenta de nuevo.";
      } else {
        errorMsg.textContent = "El nombre de usuario ya está en uso.";
      }
      errorMsg.classList.remove("hidden");
    } else {
      alert(data.error || "No se puede ingresar");
    }
  }
});
