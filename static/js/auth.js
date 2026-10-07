// Login: llama a /api/login/, guarda el JWT y redirige

const API_BASE = "/api";

const form = document.getElementById("login-form");
const errorMsg = document.getElementById("error-msg");
const submitBtn = document.getElementById("submit-btn");

function showError(message) {
    errorMsg.textContent = message;
    errorMsg.classList.remove("hidden");
}

function hideError() {
    errorMsg.classList.add("hidden");
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();
    submitBtn.disabled = true;
    submitBtn.textContent = "Ingresando...";

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    try {
        const res = await fetch(`${API_BASE}/login/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });

        const data = await res.json();

        if (!res.ok) {
            showError(data.detail || "Usuario o contraseña incorrectos");
            return;
        }

        // Guardar tokens y datos del usuario
        localStorage.setItem("access_token", data.access);
        localStorage.setItem("refresh_token", data.refresh);
        localStorage.setItem("username", data.username);
        localStorage.setItem("rol", data.rol);

        // Redirigir al dashboard
        window.location.href = "/dashboard/";
    } catch (err) {
        showError("Error de conexión. Probá de nuevo.");
        console.error(err);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Iniciar sesión";
    }
});