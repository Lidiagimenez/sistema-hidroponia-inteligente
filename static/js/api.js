// ============================================================
// api.js — Helpers para llamar a la API con JWT
// Uso: const data = await apiGet("/cultivos/");
// ============================================================

const API_BASE = "/api";

function getToken() {
    return localStorage.getItem("access_token");
}

function getRol() {
    return localStorage.getItem("rol") || "operador";
}

function getUsername() {
    return localStorage.getItem("username") || "Usuario";
}

// --- GET ---
async function apiGet(url) {
    const res = await fetch(`${API_BASE}${url}`, {
        headers: {
            "Authorization": `Bearer ${getToken()}`,
        },
    });

    if (res.status === 401) {
        localStorage.clear();
        window.location.href = "/login/";
        return null;
    }

    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`GET ${url} → ${res.status}: ${txt}`);
    }

    return res.json();
}

// --- POST ---
async function apiPost(url, body) {
    const res = await fetch(`${API_BASE}${url}`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${getToken()}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    if (res.status === 401) {
        localStorage.clear();
        window.location.href = "/login/";
        return null;
    }

    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`POST ${url} → ${res.status}: ${txt}`);
    }

    return res.json();
}

// --- PATCH ---
async function apiPatch(url, body) {
    const res = await fetch(`${API_BASE}${url}`, {
        method: "PATCH",
        headers: {
            "Authorization": `Bearer ${getToken()}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`PATCH ${url} → ${res.status}: ${txt}`);
    }

    return res.json();
}

// --- Helpers de formato ---

function formatearFecha(fechaISO) {
    if (!fechaISO) return "—";
    const d = new Date(fechaISO);
    const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
    return `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`;
}

function formatearFechaHora(fechaISO) {
    if (!fechaISO) return "—";
    const d = new Date(fechaISO);
    const fecha = formatearFecha(fechaISO);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${fecha}, ${hh}:${mm}`;
}

function tiempoRelativo(fechaISO) {
    if (!fechaISO) return "—";
    const ahora = new Date();
    const d = new Date(fechaISO);
    const dif = Math.floor((ahora - d) / 1000); // segundos

    if (dif < 60) return "Hace unos segundos";
    if (dif < 3600) return `Hace ${Math.floor(dif / 60)} min`;
    if (dif < 86400) return `Hace ${Math.floor(dif / 3600)} h`;
    if (dif < 604800) return `Hace ${Math.floor(dif / 86400)} días`;
    return formatearFecha(fechaISO);
}

function inicialDe(texto) {
    return (texto || "?").charAt(0).toUpperCase();
}