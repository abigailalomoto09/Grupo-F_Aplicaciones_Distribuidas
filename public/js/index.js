const socket = io();

const input = document.getElementById("username");
const button = document.getElementById("BtnIngresar");
const errorMessage = document.getElementById("error-message");

let verificando = false;

function normalizarNombre(texto) {
  return texto.trim().replace(/\s+/g, " ");
}

function validarNombre(nombre) {
  if (nombre === "") {
    return "Ingresa un nombre";
  }
  if (nombre.length < 3) {
    return "El nombre debe tener al menos 3 caracteres";
  }
  if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9]+(?:\s+[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9]+)*$/.test(nombre)) {
    return "Solo letras, números y un espacio entre palabras";
  }
  return "";
}

function mostrarError(mensaje) {
  errorMessage.textContent = mensaje;
  errorMessage.classList.remove("hidden");

  setTimeout(function () {
    errorMessage.classList.add("hidden");
  }, 4000);
}

function activarCarga(activo) {
  verificando = activo;
  button.disabled = activo;
  input.disabled = activo;

  if (activo) {
    button.textContent = "Verificando...";
  } else {
    button.textContent = "Entrar al Lobby";
  }
}

function enviarNombre() {
  if (verificando) {
    return;
  }

  const nombre = normalizarNombre(input.value);
  const error = validarNombre(nombre);

  if (error !== "") {
    mostrarError(error);
    return;
  }

  activarCarga(true);
  socket.emit("checkUsername", nombre);
}

// EVENTO: clic en el botón
button.addEventListener("click", function () {
  enviarNombre();
});

// EVENTO: tecla Enter en el input
input.addEventListener("keydown", function (evento) {
  if (evento.key === "Enter") {
    evento.preventDefault();
    enviarNombre();
  }
});

// EVENTO del socket: respuesta del servidor
socket.on("usernameResult", function (data) {
  if (!verificando) {
    return;
  }

  activarCarga(false);

  if (data.error) {
    mostrarError(data.message || "No se pudo verificar el nombre. Intenta de nuevo.");
    return;
  }

  if (data.available) {
    sessionStorage.setItem("username", data.username);
    window.location.replace("/lobby");
    return;
  }

  mostrarError(data.message || "Este nombre de usuario ya está en uso en este momento.");
});

// EVENTO del socket: error de conexión
socket.on("connect_error", function () {
  if (!verificando) {
    return;
  }

  activarCarga(false);
  mostrarError("No se pudo conectar con el servidor. Revisa que esté en ejecución.");
});
