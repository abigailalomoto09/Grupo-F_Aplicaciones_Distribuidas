document.addEventListener("DOMContentLoaded", async () => {
    // Si ya tiene sesión OAuth activa, ir directo al lobby
    try {
        const response = await fetch("/auth/me");
        if (response.ok) {
            window.location.href = "/lobby";
        }
    } catch (e) {
        // sin sesión, mostrar pantalla de login normal
    }
});