// ============================================================
// alertas.js — Carga dinámica de la pantalla de Alertas
// ============================================================

let alertasCargadas = [];
let alertaSeleccionada = null;

// Mapeo de severidades a estilos
const SEVERIDAD_ESTILOS = {
    "alta": {
        bg: "bg-red-50",
        border: "border-red-200",
        iconBg: "bg-red-100",
        iconColor: "text-red-600",
        text: "text-red-700",
        badgeBg: "bg-red-100",
        badgeText: "text-red-700",
        label: "Crítica",
        icono: "alert-triangle",
    },
    "media": {
        bg: "bg-orange-50",
        border: "border-orange-200",
        iconBg: "bg-orange-100",
        iconColor: "text-orange-600",
        text: "text-orange-700",
        badgeBg: "bg-orange-100",
        badgeText: "text-orange-700",
        label: "Advertencia",
        icono: "alert-circle",
    },
    "baja": {
        bg: "bg-blue-50",
        border: "border-blue-200",
        iconBg: "bg-blue-100",
        iconColor: "text-blue-600",
        text: "text-blue-700",
        badgeBg: "bg-blue-100",
        badgeText: "text-blue-700",
        label: "Info",
        icono: "info",
    },
};

// ---------- Cargar alertas ----------
async function cargarAlertas() {
    const contenedor = document.getElementById("lista-alertas");

    try {
        contenedor.innerHTML = `
            <div class="text-center py-8 text-gray-400 text-sm">
                <i data-lucide="loader" class="w-6 h-6 mx-auto mb-2 animate-spin"></i>
                Cargando alertas...
            </div>
        `;
        lucide.createIcons();

        const respuesta = await apiGet("/alertas/");
        alertasCargadas = Array.isArray(respuesta) ? respuesta : (respuesta.results || []);

        // Actualizar contadores de tabs
        actualizarContadores(alertasCargadas);

        if (!alertasCargadas || alertasCargadas.length === 0) {
            contenedor.innerHTML = `
                <div class="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                    <i data-lucide="bell-off" class="w-10 h-10 text-gray-300 mx-auto mb-2"></i>
                    <p class="text-sm text-gray-500">No hay alertas registradas.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        renderListaAlertas(alertasCargadas);
        seleccionarAlerta(alertasCargadas[0]);

    } catch (err) {
        console.error(err);
        contenedor.innerHTML = `
            <div class="bg-red-50 border border-red-200 text-red-700 text-sm p-4 rounded-xl">
                Error al cargar alertas: ${err.message}
            </div>
        `;
    }
}

// ---------- Actualizar contadores de tabs ----------
function actualizarContadores(alertas) {
    const activas = alertas.filter(a => a.estado === "activa");
    const criticas = activas.filter(a => a.severidad === "alta");
    const advertencias = activas.filter(a => a.severidad === "media");
    const info = activas.filter(a => a.severidad === "baja");
    const resueltas = alertas.filter(a => a.estado === "resuelta");

    const set = (id, valor) => {
        const el = document.getElementById(id);
        if (el) el.textContent = valor;
    };

    set("tab-todas-count", alertas.length);
    set("tab-criticas-count", criticas.length);
    set("tab-advertencias-count", advertencias.length);
    set("tab-info-count", info.length);
    set("tab-resueltas-count", resueltas.length);

    // Contador del header de alertas en el sidebar (badge)
    const badge = document.getElementById("alerta-badge");
    if (badge) {
        if (activas.length > 0) {
            badge.textContent = activas.length;
            badge.style.display = "";
        } else {
            badge.style.display = "none";
        }
    }
}

// ---------- Renderizar lista ----------
function renderListaAlertas(alertas) {
    const contenedor = document.getElementById("lista-alertas");

    if (alertas.length === 0) {
        contenedor.innerHTML = `
            <div class="text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                <p class="text-sm text-gray-500">No hay alertas en esta categoría.</p>
            </div>
        `;
        return;
    }

    contenedor.innerHTML = alertas.map(a => {
        const est = SEVERIDAD_ESTILOS[a.severidad] || SEVERIDAD_ESTILOS.baja;
        const esSeleccionada = alertaSeleccionada && alertaSeleccionada.id === a.id;
        const resuelta = a.estado === "resuelta";

        // Estilos según selección
        let clases = `${est.bg} rounded-2xl border ${est.border} p-4 cursor-pointer hover:shadow-md transition`;
        if (esSeleccionada) {
            clases += " ring-2 ring-offset-2 ring-brand";
        }
        if (resuelta) {
            clases = "bg-green-50 rounded-2xl border border-green-200 p-4 cursor-pointer hover:shadow-md transition opacity-75";
            if (esSeleccionada) clases += " ring-2 ring-offset-2 ring-brand";
        }

        // Contenido según estado
        const iconoBg = resuelta ? "bg-green-100" : est.iconBg;
        const iconoColor = resuelta ? "text-green-600" : est.iconColor;
        const iconoNombre = resuelta ? "check-circle" : est.icono;
        const titulo = generarTitulo(a);

        const badge = resuelta
            ? `<span class="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full whitespace-nowrap">✓ Resuelta</span>`
            : `<span class="text-[10px] font-bold ${est.badgeText} ${est.badgeBg} px-2 py-0.5 rounded-full whitespace-nowrap">${est.label}</span>`;

        return `
            <div class="${clases}" data-alerta-id="${a.id}">
                <div class="flex items-start gap-4">
                    <div class="w-10 h-10 ${iconoBg} rounded-xl flex items-center justify-center flex-shrink-0">
                        <i data-lucide="${iconoNombre}" class="w-5 h-5 ${iconoColor}"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-start justify-between gap-3 mb-1">
                            <h3 class="font-semibold text-gray-900 truncate">${titulo}</h3>
                            ${badge}
                        </div>
                        <p class="text-sm text-gray-600">${generarOrigen(a)}</p>
                        <p class="text-xs text-gray-400 mt-1">${tiempoRelativo(a.fecha_hora_inicio)}</p>
                    </div>
                </div>
            </div>
        `;
    }).join("");

    // Event listeners
    document.querySelectorAll("[data-alerta-id]").forEach(card => {
        card.addEventListener("click", () => {
            const id = parseInt(card.dataset.alertaId);
            const alerta = alertasCargadas.find(a => a.id === id);
            if (alerta) seleccionarAlerta(alerta);
        });
    });

    lucide.createIcons();
}

// ---------- Helpers para contenido ----------
function generarTitulo(alerta) {
    // Si viene de una medición, usamos severidad + contexto
    if (alerta.medicion) return "Medición fuera de rango";
    // Si viene de un evento
    if (alerta.evento) return "Evento del sistema";
    return "Alerta";
}

function generarOrigen(alerta) {
    const partes = [];
    if (alerta.medicion) partes.push(`Medición #${alerta.medicion}`);
    if (alerta.evento) partes.push(`Evento #${alerta.evento}`);
    return partes.join(" · ") || "Origen desconocido";
}

// ---------- Seleccionar alerta ----------
function seleccionarAlerta(alerta) {
    alertaSeleccionada = alerta;
    renderListaAlertas(alertasCargadas);
    renderDetalle(alerta);
}

// ---------- Renderizar detalle ----------
function renderDetalle(alerta) {
    const contenedor = document.getElementById("detalle-alerta");
    const est = SEVERIDAD_ESTILOS[alerta.severidad] || SEVERIDAD_ESTILOS.baja;
    const resuelta = alerta.estado === "resuelta";

    // Si está resuelta, usamos estilos verdes
    const estilos = resuelta ? {
        bg: "bg-green-100",
        iconColor: "text-green-600",
        badgeBg: "bg-green-100",
        badgeText: "text-green-700",
        label: "Resuelta",
        icono: "check-circle",
    } : est;

    const titulo = generarTitulo(alerta);
    const duracion = calcularDuracion(alerta.fecha_hora_inicio, alerta.fecha_hora_fin);

    contenedor.innerHTML = `
        <div class="flex items-start justify-between gap-3 mb-4">
            <h2 class="font-serif text-xl font-bold text-gray-900">Detalle de alerta</h2>
            <span class="text-[10px] font-bold ${estilos.badgeText} ${estilos.badgeBg} px-2 py-0.5 rounded-full whitespace-nowrap">
                ${resuelta ? "✓" : "●"} ${estilos.label}
            </span>
        </div>

        <div class="flex items-start gap-3 mb-5">
            <div class="w-12 h-12 ${estilos.bg} rounded-xl flex items-center justify-center flex-shrink-0">
                <i data-lucide="${estilos.icono}" class="w-6 h-6 ${estilos.iconColor}"></i>
            </div>
            <div>
                <h3 class="font-semibold text-gray-900">${titulo}</h3>
                <p class="text-sm text-gray-600">${generarOrigen(alerta)}</p>
                <p class="text-xs text-gray-400 mt-0.5">${formatearFechaHora(alerta.fecha_hora_inicio)}</p>
            </div>
        </div>

        <div class="grid grid-cols-2 gap-x-4 gap-y-3 mb-5 pb-5 border-b border-gray-100 text-sm">
            <div>
                <p class="text-xs text-gray-500 mb-0.5">Severidad</p>
                <p class="font-semibold ${estilos.badgeText}">${est.label}</p>
            </div>

            <div>
                <p class="text-xs text-gray-500 mb-0.5">Estado</p>
                <p class="font-semibold ${resuelta ? 'text-green-600' : 'text-red-600'}">
                    ${resuelta ? "● Resuelta" : "● Activa"}
                </p>
            </div>

            <div>
                <p class="text-xs text-gray-500 mb-0.5">Origen</p>
                <p class="font-medium text-gray-900">${alerta.medicion ? `Medición #${alerta.medicion}` : `Evento #${alerta.evento}`}</p>
            </div>

            <div>
                <p class="text-xs text-gray-500 mb-0.5">Duración</p>
                <p class="font-medium text-gray-900">${duracion}</p>
            </div>

            <div>
                <p class="text-xs text-gray-500 mb-0.5">Inicio</p>
                <p class="font-medium text-gray-900 text-xs">${formatearFechaHora(alerta.fecha_hora_inicio)}</p>
            </div>

            <div>
                <p class="text-xs text-gray-500 mb-0.5">Fin</p>
                <p class="font-medium text-gray-900 text-xs">${alerta.fecha_hora_fin ? formatearFechaHora(alerta.fecha_hora_fin) : "—"}</p>
            </div>

            <div class="col-span-2">
                <p class="text-xs text-gray-500 mb-0.5">ID de alerta</p>
                <p class="font-mono text-xs text-gray-700">ALT-${String(alerta.id).padStart(6, "0")}</p>
            </div>
        </div>

        <div class="bg-green-50 border border-green-100 rounded-xl p-3 mb-4">
            <div class="flex items-start gap-2 mb-2">
                <i data-lucide="lightbulb" class="w-4 h-4 text-brand flex-shrink-0 mt-0.5"></i>
                <p class="text-xs font-semibold text-gray-900">Acciones sugeridas</p>
            </div>
            <ul class="text-xs text-gray-700 space-y-1 ml-6 list-disc">
                <li>Revisar el sensor o dispositivo asociado.</li>
                <li>Verificar las últimas mediciones.</li>
                <li>Si el problema persiste, contactar al administrador.</li>
            </ul>
        </div>

        ${!resuelta ? `
            <button
                id="btn-resolver"
                class="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2"
            >
                <i data-lucide="check" class="w-4 h-4"></i>
                Marcar como resuelta
            </button>
        ` : `
            <div class="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                <p class="text-sm font-semibold text-green-800">✅ Alerta resuelta</p>
                <p class="text-xs text-green-700 mt-1">Resuelta el ${formatearFechaHora(alerta.fecha_hora_fin)}</p>
            </div>
        `}
    `;

    lucide.createIcons();

    // Event listener para resolver
    const btnResolver = document.getElementById("btn-resolver");
    if (btnResolver) {
        btnResolver.addEventListener("click", () => resolverAlerta(alerta.id));
    }
}

// ---------- Calcular duración ----------
function calcularDuracion(inicio, fin) {
    const d1 = new Date(inicio);
    const d2 = fin ? new Date(fin) : new Date();
    const dif = Math.floor((d2 - d1) / 1000); // segundos

    if (dif < 60) return `${dif} seg`;
    if (dif < 3600) return `${Math.floor(dif / 60)} min`;
    if (dif < 86400) {
        const h = Math.floor(dif / 3600);
        const m = Math.floor((dif % 3600) / 60);
        return `${h} h ${m} min`;
    }
    const d = Math.floor(dif / 86400);
    const h = Math.floor((dif % 86400) / 3600);
    return `${d} días ${h} h`;
}

// ---------- Resolver alerta (PATCH) ----------
async function resolverAlerta(id) {
    const btn = document.getElementById("btn-resolver");
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Guardando...`;
        lucide.createIcons();
    }

    try {
        const actualizada = await apiPatch(`/alertas/${id}/`, { estado: "resuelta" });

        // Actualizar en la lista local
        const idx = alertasCargadas.findIndex(a => a.id === id);
        if (idx !== -1) {
            alertasCargadas[idx] = actualizada;
        }
        alertaSeleccionada = actualizada;

        // Re-renderizar
        renderListaAlertas(alertasCargadas);
        renderDetalle(actualizada);
        actualizarContadores(alertasCargadas);

    } catch (err) {
        alert(`Error al resolver la alerta: ${err.message}`);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> Marcar como resuelta`;
            lucide.createIcons();
        }
    }
}

// ---------- Iniciar ----------
document.addEventListener("DOMContentLoaded", cargarAlertas);