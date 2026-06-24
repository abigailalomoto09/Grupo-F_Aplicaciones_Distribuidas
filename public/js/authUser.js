// authUser.js
// Carga el usuario (OAuth o nombre directo) y rellena #userInfo en el header

async function cargarUsuario() {

    const userInfoEl = document.getElementById("userInfo");

    // 1. Intentar sesión OAuth
    try {
        const response = await fetch("/auth/me");

        if (response.ok) {
            const user = await response.json();

            // Extraer solo el primer nombre del displayName
            const firstName = user.username
                ? user.username.split(/[\s_]+/)[0]
                : "Jugador";

            // Guardar en sessionStorage para que lobby.js lo use
            sessionStorage.setItem("username", user.username);

            // Renderizar con foto de Google
            userInfoEl.innerHTML = `
                <img
                    src="${user.photo || ''}"
                    alt="${firstName}"
                    class="w-10 h-10 rounded-full object-cover border-2 border-cyan-400/50"
                    onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                >
                <div
                    class="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 items-center justify-center text-black font-black text-lg hidden"
                >
                    ${firstName.charAt(0).toUpperCase()}
                </div>
                <div class="leading-tight">
                    <p class="font-black text-white text-base">${firstName}</p>
                    <p class="text-slate-400 text-xs">${user.email || ''}</p>
                </div>
            `;

            // Si es la primera vez tras el callback OAuth, recargar una vez
            // para que el socket se una al lobby con el username correcto
            if (!sessionStorage.getItem("oauthLoaded")) {
                sessionStorage.setItem("oauthLoaded", "true");
                location.reload();
            }

            return; // listo
        }

    } catch (e) {
        // sin sesión OAuth, caer al modo nombre directo
    }

    // 2. Modo nombre directo (sessionStorage)
    const username = sessionStorage.getItem("username");

    if (!username) {
        // No hay sesión de ningún tipo → volver al inicio
        window.location.href = "/";
        return;
    }

    const firstName = username.split(/[\s_]+/)[0];

    userInfoEl.innerHTML = `
        <div
            class="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center text-black font-black text-lg"
        >
            ${firstName.charAt(0).toUpperCase()}
        </div>
        <div class="leading-tight">
            <p class="font-black text-white text-base">${firstName}</p>
            <p class="text-slate-400 text-xs">Invitado</p>
        </div>
    `;
}

cargarUsuario();