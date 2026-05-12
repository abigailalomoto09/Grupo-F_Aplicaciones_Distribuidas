const input = document.getElementById("nombreUsuario");
const button = document.getElementById("BtnIngresar");

button.addEventListener("click", () => {

    const username = input.value.trim();

    if(username === ""){
        alert("Ingresa un nombre");
        return;
    }

    // GUARDAR NOMBRE
    localStorage.setItem("nombreUsuario", username);

    // IR AL LOBBY
    window.location.href = "/lobby";

});