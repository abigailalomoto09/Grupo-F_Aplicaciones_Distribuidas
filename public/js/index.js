// CARGAR SOCKET EN EL INDEX
const socket = io();

const input = document.getElementById("username");
const button = document.getElementById("BtnIngresar");
const errorMessage = document.getElementById("error-message");

button.addEventListener("click", () => {

    const username = input.value.trim();

    if(username === ""){
        showError("Ingresa un nombre");
        return;
    }

    // VERIFICAR DISPONIBILIDAD ANTES DE ENTRAR
    socket.emit("checkUsername", username);

});

// ESCUCHAR RESPUESTA DEL SERVIDOR
socket.on("usernameResult", (data) => {
    if (data.available) {
        // GUARDAR NOMBRE Y REDIRIGIR
        localStorage.setItem("username", data.username);
        window.location.href = "/lobby";
    } else {
        showError("Este nombre de usuario ya está en uso en este momento.");
    }
});

function showError(text) {
    errorMessage.textContent = text;
    errorMessage.classList.remove("hidden");
    
    // Ocultar después de 3 segundos
    setTimeout(() => {
        errorMessage.classList.add("hidden");
    }, 3000);
}