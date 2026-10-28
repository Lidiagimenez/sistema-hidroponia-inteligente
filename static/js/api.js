// ============================================================
// api.js — Helpers para llamar a la API con JWT en cookies HttpOnly
// ============================================================

const API_BASE = "/api";

function getRol() {
    return sessionStorage.getItem("rol") || "operador";
}

function getUsername() {
    return sessionStorage.getItem("username") || "Usuario";
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function refreshSession() {
    const res = await fetch(`${API_BASE}/refresh/`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
    });
    return res.ok;
}

async function apiRequest(url, options = {}, retry = true) {
    const res = await fetch(`${API_BASE}${url}`, {
        credentials: "same-origin",
        ...options,
        headers: options.headers || {},
    });

    if (res.status === 401 && retry && await refreshSession()) {
        return apiRequest(url, options, false);
    }

    if (res.status === 401) {
        console.error(
            "%c[API] SEVERO — 401 final: token expirado y refresh falló. " +
            "apiGet devolvió null. " +
            `Endpoint: ${url} | Redirigiendo a /login/…`,
            "background:#b91c1c;color:#fff;font-size:14px;font-weight:bold;padding:6px 10px;border-radius:4px;"
        );
        sessionStorage.clear();
        window.location.href = "/login/";
        return null;
    }

    if (!res.ok) {
        let detalle = "";
        try {
            const errData = await res.json();
            if (typeof errData === "object" && errData !== null) {
                detalle = JSON.stringify(errData);
            } else if (typeof errData === "string") {
                detalle = errData;
            }
        } catch (_) {}

        if (res.status === 403) {
            throw new Error("No tenés permisos para realizar esta acción.");
        }
        if (detalle) {
            throw new Error(`Error en el servidor: ${detalle}`);
        }
        throw new Error("No se pudo completar la operación. Intentá de nuevo.");
    }

    if (res.status === 204 || res.status === 205) return null;
    const text = await res.text();
    if (!text || !text.trim()) return null;
    try {
        return JSON.parse(text);
    } catch (_) {
        return null;
    }
}

async function apiGet(url) {
    return apiRequest(url);
}

async function apiPost(url, body) {
    return apiRequest(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

async function apiPatch(url, body) {
    return apiRequest(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

async function apiDelete(url) {
    return apiRequest(url, { method: "DELETE" });
}

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
    const dif = Math.floor((ahora - d) / 1000);

    if (dif < 60) return "Hace unos segundos";
    if (dif < 3600) return `Hace ${Math.floor(dif / 60)} min`;
    if (dif < 86400) return `Hace ${Math.floor(dif / 3600)} h`;
    if (dif < 604800) return `Hace ${Math.floor(dif / 86400)} días`;
    return formatearFecha(fechaISO);
}

function inicialDe(texto) {
    return (texto || "?").charAt(0).toUpperCase();
}