// ============================================================
// ia.js — Recomendaciones, Avisos y Anomalías (Motor de IA)
// ============================================================

let recomendaciones = [];
let recomendacionesFiltradas = [];
let avisos = [];
let anomalias = [];
let cultivosMap = {};
let tabActual = "recomendaciones";

// ---------- Config visual ----------

const PRIORIDAD_CONFIG = {
    "alta":  { badgeBg: "bg-red-100",    badgeText: "text-red-700",    label: "Alta",  color: "border-red-300"    },
    "media": { badgeBg: "bg-orange-100", badgeText: "text-orange-700", label: "Media", color: "border-orange-300" },
    "baja":  { badgeBg: "bg-blue-100",   badgeText: "text-blue-700",   label: "Baja",  color: "border-blue-300"   },
};

const TIPO_RECOMENDACION_ICONO = {
    "riego":          { icono: "droplet",       bg: "bg-blue-100",    color: "text-blue-600"    },
    "nutricion":      { icono: "leaf",          bg: "bg-green-100",   color: "text-brand"       },
    "ph":             { icono: "beaker",        bg: "bg-purple-100",  color: "text-purple-600"  },
    "conductividad":  { icono: "activity",      bg: "bg-teal-100",    color: "text-teal-600"    },
    "temperatura":    { icono: "thermometer",   bg: "bg-orange-100",  color: "text-orange-600"  },
    "iluminacion":    { icono: "sun",           bg: "bg-yellow-100",  color: "text-yellow-600"  },
    "crecimiento":    { icono: "sprout",        bg: "bg-green-100",   color: "text-brand"       },
    "cosecha":        { icono: "package",       bg: "bg-amber-100",   color: "text-amber-600"   },
    "otro":           { icono: "info",          bg: "bg-gray-100",    color: "text-gray-600"    },
};

const TIPO_AVISO_ICONO = {
    "sin_crecimiento":       { icono: "minus-circle",   bg: "bg-orange-100",  color: "text-orange-600"  },
    "crecimiento_negativo":  { icono: "trending-down",  bg: "bg-red-100",     color: "text-red-600"     },
    "desvio_curva":          { icono: "line-chart",     bg: "bg-yellow-100",  color: "text-yellow-600"  },
    "caida_verdor":          { icono: "leaf",           bg: "bg-amber-100",   color: "text-amber-600"   },
};

// ---------- Cargar todo ----------
async function cargarIA() {
    try {
        await cargarCultivos();
        await Promise.all([
            cargarRecomendaciones(),
            cargarAvisos(),
            cargarAnomalias(),
        ]);

        renderTabs();
        renderLista();
        renderStats();
        configurarAcciones();
    } catch (err) {
        console.error(err);
    }
}

async function cargarCultivos() {
    const resp = await apiGet("/cultivos/");
    const lista = Array.isArray(resp) ? resp : (resp.results || []);
    cultivosMap = {};
    lista.forEach(c => { cultivosMap[c.id_cultivo] = c.nombre; });
}

async function cargarRecomendaciones() {
    const resp = await apiGet("/recomendaciones/");
    recomendaciones = Array.isArray(resp) ? resp : (resp.results || []);
    recomendacionesFiltradas = [...recomendaciones];
}

async function cargarAvisos() {
    try {
        const resp = await apiGet("/avisos-crecimiento/");
        avisos = Array.isArray(resp) ? resp : (resp.results || []);
    } catch (e) {
        avisos = [];
    }
}

async function cargarAnomalias() {
    try {
        const resp = await apiGet("/anomalias/");
        anomalias = Array.isArray(resp) ? resp : (resp.results || []);
    } catch (e) {
        anomalias = [];
    }
}

// ---------- Tabs ----------
function renderTabs() {
    // Actualizar contadores en los tabs
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set("count-recomendaciones", recomendaciones.filter(r => r.vigente && !r.resuelta).length);
    set("count-avisos", avisos.filter(a => !a.resuelto).length);
    set("count-anomalias", anomalias.filter(a => a.estado === "nueva").length);

    // Event listeners de tabs
    document.querySelectorAll(".tab-ia").forEach(btn => {
        btn.addEventListener("click", () => {
            tabActual = btn.dataset.tab;
            document.querySelectorAll(".tab-ia").forEach(b => {
                b.classList.remove("active", "bg-brand", "text-white", "font-semibold");
                b.classList.add("text-gray-600", "font-medium", "hover:bg-gray-100");
            });
            btn.classList.add("active", "bg-brand", "text-white", "font-semibold");
            btn.classList.remove("text-gray-600", "font-medium", "hover:bg-gray-100");
            renderLista();
        });
    });

    // Aplicar estilos al tab activo
    const activo = document.querySelector(".tab-ia.active");
    if (activo) {
        activo.classList.add("bg-brand", "text-white", "font-semibold");
    }
    document.querySelectorAll(".tab-ia:not(.active)").forEach(b => {
        b.classList.add("text-gray-600", "font-medium", "hover:bg-gray-100");
    });
}

// ---------- Render lista según tab ----------
function renderLista() {
    const contenedor = document.getElementById("lista-ia");
    if (!contenedor) return;

    if (tabActual === "recomendaciones") {
        renderRecomendaciones(contenedor);
    } else if (tabActual === "avisos") {
        renderAvisos(contenedor);
    } else {
        renderAnomalias(contenedor);
    }

    lucide.createIcons();
}

// ---------- Recomendaciones ----------
function renderRecomendaciones(contenedor) {
    const vigentes = recomendacionesFiltradas.filter(r => r.vigente && !r.resuelta);

    if (vigentes.length === 0) {
        contenedor.innerHTML = `
            <div class="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                <i data-lucide="sparkles" class="w-10 h-10 text-gray-300 mx-auto mb-2"></i>
                <p class="text-sm text-gray-500 mb-3">No hay recomendaciones vigentes.</p>
                <button id="btn-evaluar-vacio" class="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
                    <i data-lucide="play" class="w-4 h-4"></i>
                    Ejecutar motor de recomendaciones
                </button>
            </div>
        `;
        lucide.createIcons();
        document.getElementById("btn-evaluar-vacio")?.addEventListener("click", ejecutarMotor);
        return;
    }

    contenedor.innerHTML = vigentes.map(r => {
        const prio = PRIORIDAD_CONFIG[r.prioridad] || PRIORIDAD_CONFIG.media;
        const tipoConf = TIPO_RECOMENDACION_ICONO[r.tipo] || TIPO_RECOMENDACION_ICONO.otro;

        return `
            <div class="recomendacion-card bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition" data-rec-id="${r.id}">
                <div class="flex items-start gap-4">
                    <div class="w-11 h-11 ${tipoConf.bg} rounded-xl flex items-center justify-center flex-shrink-0">
                        <i data-lucide="${tipoConf.icono}" class="w-5 h-5 ${tipoConf.color}"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-start justify-between gap-3 mb-1">
                            <h3 class="font-semibold text-gray-900">${r.titulo}</h3>
                            <span class="inline-flex items-center ${prio.badgeBg} ${prio.badgeText} text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                                ${prio.label}
                            </span>
                        </div>
                        <p class="text-xs text-gray-500 mb-2">
                            ${r.tipo_display} · ${r.cultivo_nombre || cultivosMap[r.cultivo] || "—"}
                        </p>
                        <p class="text-sm text-gray-600 mb-3 leading-relaxed">
                            ${r.detalle || "Sin detalle"}
                        </p>
                        <div class="flex items-center justify-between gap-3">
                            <span class="text-xs text-gray-400 flex items-center gap-1">
                                <i data-lucide="clock" class="w-3 h-3"></i>
                                ${tiempoRelativo(r.fecha)}
                            </span>
                            <button
                                class="btn-resolver-recomendacion inline-flex items-center gap-1.5 bg-green-50 hover:bg-green-100 text-brand text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                                data-id="${r.id}"
                            >
                                <i data-lucide="check" class="w-3.5 h-3.5"></i>
                                Marcar como resuelta
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join("");

    // Event listeners
    document.querySelectorAll(".btn-resolver-recomendacion").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            resolverRecomendacion(parseInt(btn.dataset.id));
        });
    });
}

// ---------- Avisos ----------
function renderAvisos(contenedor) {
    const activos = avisos.filter(a => !a.resuelto);

    if (activos.length === 0) {
        contenedor.innerHTML = `
            <div class="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                <i data-lucide="leaf" class="w-10 h-10 text-gray-300 mx-auto mb-2"></i>
                <p class="text-sm text-gray-500">No hay avisos de crecimiento activos.</p>
            </div>
        `;
        return;
    }

    contenedor.innerHTML = activos.map(a => {
        const tipoConf = TIPO_AVISO_ICONO[a.tipo] || TIPO_AVISO_ICONO.sin_crecimiento;
        const sevBg = a.severidad === "advertencia" ? "bg-orange-100" : "bg-blue-100";
        const sevText = a.severidad === "advertencia" ? "text-orange-700" : "text-blue-700";

        return `
            <div class="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition">
                <div class="flex items-start gap-4">
                    <div class="w-11 h-11 ${tipoConf.bg} rounded-xl flex items-center justify-center flex-shrink-0">
                        <i data-lucide="${tipoConf.icono}" class="w-5 h-5 ${tipoConf.color}"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-start justify-between gap-3 mb-1">
                            <h3 class="font-semibold text-gray-900">${a.tipo_display}</h3>
                            <span class="inline-flex items-center ${sevBg} ${sevText} text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                                ${a.severidad_display}
                            </span>
                        </div>
                        <p class="text-xs text-gray-500 mb-2">
                            ${a.cultivo_nombre || cultivosMap[a.cultivo] || "—"}
                        </p>
                        <p class="text-sm text-gray-600 mb-3 leading-relaxed">
                            ${a.descripcion || "Sin descripción"}
                        </p>
                        <div class="flex items-center justify-between gap-3">
                            <span class="text-xs text-gray-400 flex items-center gap-1">
                                <i data-lucide="clock" class="w-3 h-3"></i>
                                ${tiempoRelativo(a.fecha)}
                            </span>
                            <button
                                class="btn-resolver-aviso inline-flex items-center gap-1.5 bg-green-50 hover:bg-green-100 text-brand text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                                data-id="${a.id}"
                            >
                                <i data-lucide="check" class="w-3.5 h-3.5"></i>
                                Marcar como resuelto
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join("");

    document.querySelectorAll(".btn-resolver-aviso").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            resolverAviso(parseInt(btn.dataset.id));
        });
    });
}

// ---------- Anomalías ----------
function renderAnomalias(contenedor) {
    if (anomalias.length === 0) {
        contenedor.innerHTML = `
            <div class="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                <i data-lucide="brain-circuit" class="w-10 h-10 text-gray-300 mx-auto mb-2"></i>
                <p class="text-sm text-gray-500">No hay anomalías detectadas.</p>
            </div>
        `;
        return;
    }

    contenedor.innerHTML = anomalias.map(a => {
        const prio = PRIORIDAD_CONFIG[a.prioridad] || PRIORIDAD_CONFIG.baja;

        let estadoBadge = "";
        if (a.estado === "nueva") {
            estadoBadge = `<span class="inline-flex items-center gap-1 bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"><span class="w-1 h-1 bg-red-600 rounded-full"></span>Nueva</span>`;
        } else if (a.estado === "revisada") {
            estadoBadge = `<span class="inline-flex items-center gap-1 bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">✓ Revisada</span>`;
        } else {
            estadoBadge = `<span class="inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">✗ Descartada</span>`;
        }

        return `
            <div class="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition">
                <div class="flex items-start gap-4">
                    <div class="w-11 h-11 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <i data-lucide="activity" class="w-5 h-5 text-purple-600"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-start justify-between gap-3 mb-1">
                            <h3 class="font-semibold text-gray-900">
                                ${a.sensor_nombre || "Anomalía"} — Score ${a.score.toFixed(2)}
                            </h3>
                            ${estadoBadge}
                        </div>
                        <p class="text-xs text-gray-500 mb-2">
                            ${a.cultivo_nombre || "—"} · ${a.origen_display}
                        </p>
                        <div class="grid grid-cols-3 gap-2 my-3 text-xs">
                            <div class="bg-gray-50 rounded-lg p-2">
                                <p class="text-gray-400 mb-0.5">Valor</p>
                                <p class="font-semibold text-gray-900">${a.valor_observado}</p>
                            </div>
                            ${a.valor_esperado_min !== null ? `
                                <div class="bg-gray-50 rounded-lg p-2">
                                    <p class="text-gray-400 mb-0.5">Min esperado</p>
                                    <p class="font-medium text-gray-700">${a.valor_esperado_min}</p>
                                </div>
                            ` : ""}
                            ${a.valor_esperado_max !== null ? `
                                <div class="bg-gray-50 rounded-lg p-2">
                                    <p class="text-gray-400 mb-0.5">Max esperado</p>
                                    <p class="font-medium text-gray-700">${a.valor_esperado_max}</p>
                                </div>
                            ` : ""}
                        </div>
                        <div class="flex items-center justify-between gap-3 pt-2">
                            <span class="text-xs text-gray-400 flex items-center gap-1">
                                <i data-lucide="clock" class="w-3 h-3"></i>
                                ${tiempoRelativo(a.fecha_deteccion)}
                            </span>
                            ${a.estado === "nueva" ? `
                                <div class="flex gap-2">
                                    <button
                                        class="btn-descartar-anomalia inline-flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                                        data-id="${a.id}"
                                    >
                                        ✗ Descartar
                                    </button>
                                    <button
                                        class="btn-revisar-anomalia inline-flex items-center gap-1.5 bg-green-50 hover:bg-green-100 text-brand text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                                        data-id="${a.id}"
                                    >
                                        <i data-lucide="check" class="w-3.5 h-3.5"></i>
                                        Revisar
                                    </button>
                                </div>
                            ` : ""}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join("");

    document.querySelectorAll(".btn-revisar-anomalia").forEach(btn => {
        btn.addEventListener("click", () => revisarAnomalia(parseInt(btn.dataset.id)));
    });
    document.querySelectorAll(".btn-descartar-anomalia").forEach(btn => {
        btn.addEventListener("click", () => descartarAnomalia(parseInt(btn.dataset.id)));
    });
}

// ---------- Acciones ----------
async function resolverRecomendacion(id) {
    try {
        await apiPost(`/recomendaciones/${id}/resolver/`, {});
        await cargarRecomendaciones();
        renderTabs();
        renderLista();
        renderStats();
    } catch (err) {
        alert(`Error: ${err.message}`);
    }
}

async function resolverAviso(id) {
    try {
        await apiPost(`/avisos-crecimiento/${id}/resolver/`, {});
        await cargarAvisos();
        renderTabs();
        renderLista();
        renderStats();
    } catch (err) {
        alert(`Error: ${err.message}`);
    }
}

async function revisarAnomalia(id) {
    try {
        await apiPost(`/anomalias/${id}/revisar/`, {});
        await cargarAnomalias();
        renderTabs();
        renderLista();
        renderStats();
    } catch (err) {
        alert(`Error: ${err.message}`);
    }
}

async function descartarAnomalia(id) {
    try {
        await apiPost(`/anomalias/${id}/descartar/`, {});
        await cargarAnomalias();
        renderTabs();
        renderLista();
        renderStats();
    } catch (err) {
        alert(`Error: ${err.message}`);
    }
}

// ---------- Ejecutar motor ----------
async function ejecutarMotor() {
    const btn = document.getElementById("btn-ejecutar-motor");
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Ejecutando...`;
        lucide.createIcons();
    }

    try {
        // Tomar el primer cultivo
        const cultivoIds = Object.keys(cultivosMap);
        if (cultivoIds.length === 0) {
            alert("No hay cultivos para evaluar.");
            return;
        }

        const cultivoId = parseInt(cultivoIds[0]);
        const resp = await apiPost("/recomendaciones/evaluar/", { cultivo: cultivoId });

        alert(`✓ Motor ejecutado.\n\nRecomendaciones generadas: ${resp.generadas || 0}`);

        await cargarRecomendaciones();
        renderTabs();
        renderLista();
        renderStats();
    } catch (err) {
        alert(`Error al ejecutar el motor: ${err.message}`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="play" class="w-4 h-4"></i> Ejecutar motor`;
            lucide.createIcons();
        }
    }
}

// ---------- Stats ----------
function renderStats() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    const recVigentes = recomendaciones.filter(r => r.vigente && !r.resuelta).length;
    const recResueltas = recomendaciones.filter(r => r.resuelta).length;
    const avisosActivos = avisos.filter(a => !a.resuelto).length;
    const anomNuevas = anomalias.filter(a => a.estado === "nueva").length;

    set("stat-recomendaciones", recVigentes);
    set("stat-avisos", avisosActivos);
    set("stat-anomalias", anomNuevas);
    set("stat-resueltas", recResueltas);
}

// ---------- Configurar ----------
function configurarAcciones() {
    document.getElementById("btn-ejecutar-motor")?.addEventListener("click", ejecutarMotor);
}

// ---------- Iniciar ----------
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", cargarIA);
} else {
    cargarIA();
}