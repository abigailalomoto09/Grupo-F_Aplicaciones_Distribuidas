document.addEventListener("DOMContentLoaded", async () => {
    // Si ya tiene sesión activa (OAuth o tradicional), ir directo al lobby
    try {
        const response = await fetch("/auth/me");
        if (response.ok) {
            const data = await response.json();
            if (data.authenticated) {
                window.location.href = "/lobby";
                return;
            }
        }
    } catch (e) {
        // Sin sesión activa, mostrar pantalla de login
    }

    // Elementos del DOM
    const tabLogin = document.getElementById("tabLogin");
    const tabRegister = document.getElementById("tabRegister");
    const formLogin = document.getElementById("formLogin");
    const formRegister = document.getElementById("formRegister");
    const alertMessage = document.getElementById("alertMessage");

    // Campos de Login
    const loginUsernameInput = document.getElementById("loginUsername");
    const loginPasswordInput = document.getElementById("loginPassword");

    // Campos de Registro
    const registerUsernameInput = document.getElementById("registerUsername");
    const registerEmailInput = document.getElementById("registerEmail");
    const registerPasswordInput = document.getElementById("registerPassword");

    // Mostrar alerta
    function showAlert(message, isSuccess = false) {
        alertMessage.textContent = message;
        alertMessage.className = `block mb-4 p-3 rounded-xl text-xs font-semibold text-center transition-all duration-200 ${
            isSuccess 
                ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400" 
                : "bg-red-500/20 border border-red-500/40 text-red-400"
        }`;
    }

    // Ocultar alerta
    function hideAlert() {
        alertMessage.textContent = "";
        alertMessage.className = "hidden";
    }

    // Manejo de Pestañas (Tabs)
    tabLogin.addEventListener("click", () => {
        hideAlert();
        // Clases de Pestañas
        tabLogin.className = "flex-1 pb-3 text-center font-bold text-sm border-b-2 border-cyan-400 text-cyan-400 transition-all duration-200";
        tabRegister.className = "flex-1 pb-3 text-center font-bold text-sm border-b-2 border-transparent text-slate-400 hover:text-slate-200 transition-all duration-200";
        // Visibilidad de Formularios
        formLogin.classList.remove("hidden");
        formRegister.classList.add("hidden");
    });

    tabRegister.addEventListener("click", () => {
        hideAlert();
        // Clases de Pestañas
        tabLogin.className = "flex-1 pb-3 text-center font-bold text-sm border-b-2 border-transparent text-slate-400 hover:text-slate-200 transition-all duration-200";
        tabRegister.className = "flex-1 pb-3 text-center font-bold text-sm border-b-2 border-emerald-500 text-emerald-400 transition-all duration-200";
        // Visibilidad de Formularios
        formLogin.classList.add("hidden");
        formRegister.classList.remove("hidden");
    });

    // Enviar formulario de Login
    formLogin.addEventListener("submit", async (e) => {
        e.preventDefault();
        hideAlert();

        const usernameOrEmail = loginUsernameInput.value.trim();
        const contrasenia = loginPasswordInput.value;

        try {
            const res = await fetch("/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ usernameOrEmail, contrasenia })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                if (data.token) {
                    localStorage.setItem('token', data.token);
                }
                showAlert("¡Sesión iniciada con éxito! Redirigiendo...", true);
                setTimeout(() => {
                    window.location.href = data.redirect;
                }, 1000);
            } else {
                showAlert(data.error || "Ocurrió un error al iniciar sesión");
            }
        } catch (err) {
            console.error(err);
            showAlert("No se pudo conectar con el servidor. Inténtalo más tarde.");
        }
    });

    // Enviar formulario de Registro
    formRegister.addEventListener("submit", async (e) => {
        e.preventDefault();
        hideAlert();

        const username = registerUsernameInput.value.trim();
        const email = registerEmailInput.value.trim();
        const contrasenia = registerPasswordInput.value;

        try {
            const res = await fetch("/auth/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ username, email, contrasenia })
            });

            const data = await res.json();

            if (res.ok) {
                showAlert("¡Registro completado con éxito! Ahora puedes iniciar sesión.", true);
                
                // Limpiar campos del registro
                registerUsernameInput.value = "";
                registerEmailInput.value = "";
                registerPasswordInput.value = "";

                // Cambiar a la pestaña de login después de 2 segundos
                setTimeout(() => {
                    tabLogin.click();
                    loginUsernameInput.value = username; // Auto-completar usuario
                }, 2000);
            } else {
                showAlert(data.error || "Ocurrió un error al registrar el usuario");
            }
        } catch (err) {
            console.error(err);
            showAlert("No se pudo conectar con el servidor. Inténtalo más tarde.");
        }
    });
});