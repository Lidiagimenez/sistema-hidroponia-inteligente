// ============================================================
// dashboard.js — Carga dinámica del Dashboard con selector
// ============================================================

let todosLosCultivos = [];
let cultivoActivo = null;
let alertasActivas = [];
let mediciones = [];
let sensoresMap = {};
let agrupadas = {};

const TIPOS_CONFIG = {
    "ph":           { unidad: "pH",         icono: "droplet",     color: "text-brand",      bg: "bg-green-100",  min: 5.5, max: 6.5 },
    "conductividad":{ unidad: "mS/cm",      icono: "activity",    color: "text-teal-600",   bg: "bg-teal-100",   min: 1300, max: 2000 },
    "temperatura":  { unidad: "°C",         icono: "thermometer", color: "text-orange-600", bg: "bg-orange-100", min: 18, max: 26 },
    "luz":          { unidad: "µmol/m²/s",  icono: "sun",         color: "text-yellow-600", bg: "bg-yellow-100", min: 200, max: 500 },
};

// ---------- Cargar todo ----------
async function cargarDashboard() {
    try {
        await Promise.all([
            cargarCultivos(),
            cargarSensoresYMediciones(),
            cargarAlertas(),
        ]);

        if (todosLosCultivos.length > 0) {
            cultivoActivo = todosLosCultivos[0];
        }

        renderTodo();
    } catch (err) {
        console.error(err);
    }
}

// ---------- Cultivos ----------
async function cargarCultivos() {
    const resp = await apiGet("/cultivos/");
    todosLosCultivos = Array.isArray(resp) ? resp : (resp.results || []);
}

// ---------- Sensores y mediciones ----------
async function cargarSensoresYMediciones() {
    const respSensores = await apiGet("/sensores/");
    const listaSensores = Array.isArray(respSensores) ? respSensores : (respSensores.results || []);

    const respTipos = await apiGet("/tipos-sensor/");
    const listaTipos = Array.isArray(respTipos) ? respTipos : (respTipos.results || []);
    const mapaTipos = {};
    listaTipos.forEach(t => { mapaTipos[t.id] = t; });

    sensoresMap = {};
    listaSensores.forEach(s => {
        const tipo = mapaTipos[s.tipo_sensor];
        if (tipo) {
            sensoresMap[s.id] = { tipo_nombre: tipo.nombre, unidad: tipo.unidad_medida };
        }
    });

    const respMed = await apiGet("/mediciones/");
    mediciones = Array.isArray(respMed) ? respMed : (respMed.results || []);

    agrupadas = {};
    mediciones.forEach(m => {
        const s = sensoresMap[m.sensor];
        if (!s) return;
        if (!agrupadas[s.tipo_nombre]) agrupadas[s.tipo_nombre] = [];
        agrupadas[s.tipo_nombre].push(m);
    });
    Object.keys(agrupadas).forEach(t => {
        agrupadas[t].sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));
    });
}

// ---------- Alertas ----------
async function cargarAlertas() {
    const resp = await apiGet("/alertas/");
    const todas = Array.isArray(resp) ? resp : (resp.results || []);
    alertasActivas = todas.filter(a => a.estado === "activa");
}

// ---------- Render de todo ----------
function renderTodo() {
    renderBanner();
    renderTarjetas();
    renderGrafico();
    renderAlertas();
}

// ---------- Banner con selector debajo ----------
function renderBanner() {
    const cont = document.getElementById("banner-cultivo");
    if (!cont) return;

    if (!todosLosCultivos || todosLosCultivos.length === 0) {
        cont.innerHTML = `
            <div class="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center">
                <i data-lucide="leaf" class="w-8 h-8 text-gray-300 mx-auto mb-2"></i>
                <p class="text-sm text-gray-500 mb-3">No hay cultivos activos</p>
                <a href="/cultivos/" class="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
                    <i data-lucide="plus" class="w-4 h-4"></i>
                    Crear el primero
                </a>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    const fechaInicio = new Date(cultivoActivo.fecha_creacion);
    const hoy = new Date();
    const dias = Math.floor((hoy - fechaInicio) / (1000 * 60 * 60 * 24));
    const totalDias = 28;
    const etapa = dias < 7 ? "Germinación" : dias < 21 ? "Crecimiento" : "Cosecha";

    const opciones = todosLosCultivos.map(c => `
        <option value="${c.id_cultivo}" ${c.id_cultivo === cultivoActivo.id_cultivo ? "selected" : ""}>
            ${c.nombre}
        </option>
    `).join("");

    cont.innerHTML = `
        <div class="relative bg-gradient-to-r from-green-50 via-white to-green-50/30 rounded-2xl overflow-hidden border border-green-100">
            <div class="p-6">

                <!-- Fila 1: Ícono + datos + badge -->
                <div class="flex items-center justify-between gap-5 flex-wrap">

                    <div class="flex items-center gap-5">
                        <div class="w-14 h-14 bg-brand-light rounded-2xl flex items-center justify-center flex-shrink-0">
                            <i data-lucide="sprout" class="w-7 h-7 text-brand"></i>
                        </div>
                        <div>
                            <p class="text-xs text-gray-500 font-medium mb-0.5">Cultivo activo</p>
                            <h2 class="font-serif text-3xl font-bold text-gray-900 leading-tight">${cultivoActivo.nombre}</h2>
                            <div class="flex items-center gap-3 mt-1 text-sm text-gray-600">
                                <span>Etapa: <span class="font-semibold text-gray-800">${etapa}</span></span>
                                <span class="text-gray-300">|</span>
                                <span class="flex items-center gap-1">
                                    <i data-lucide="calendar" class="w-3.5 h-3.5"></i>
                                    Día <span class="font-semibold">${dias}</span> de <span class="font-semibold">${totalDias}</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    <span class="inline-flex items-center gap-2 bg-green-100 text-green-800 text-sm font-semibold px-4 py-1.5 rounded-full">
                        <span class="w-2 h-2 bg-green-600 rounded-full"></span>
                        Normal
                    </span>

                </div>

                <!-- Fila 2: Selector de cultivo (si hay más de 1) -->
                ${todosLosCultivos.length > 1 ? `
                    <div class="mt-5 pt-5 border-t border-green-100 flex items-center gap-3">
                        <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Cambiar cultivo
                        </label>
                        <div class="relative">
                            <i data-lucide="chevron-down" class="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"></i>
                            <select
                                id="selector-cultivo"
                                class="appearance-none bg-white border border-gray-300 hover:border-brand rounded-xl text-sm font-medium text-gray-700 pl-4 pr-10 py-2 focus:ring-2 focus:ring-brand focus:border-brand outline-none cursor-pointer transition"
                            >
                                ${opciones}
                            </select>
                        </div>
                    </div>
                ` : ""}

            </div>
            <div class="absolute top-0 right-0 w-48 h-full bg-gradient-to-l from-green-100/50 to-transparent pointer-events-none"></div>
        </div>
    `;

    lucide.createIcons();

    const selector = document.getElementById("selector-cultivo");
    if (selector) {
        selector.addEventListener("change", (e) => {
            const id = parseInt(e.target.value);
            const cultivo = todosLosCultivos.find(c => c.id_cultivo === id);
            if (cultivo) {
                cultivoActivo = cultivo;
                renderTodo();
            }
        });
    }
}

// ---------- 4 Tarjetas ----------
function renderTarjetas() {
    const cont = document.getElementById("tarjetas-estado");
    if (!cont) return;

    const totalSensores = Object.keys(sensoresMap).length;
    const online = Object.keys(agrupadas).length;

    const ultPh = agrupadas["ph"]?.[0];
    const valorPh = ultPh ? ultPh.valor.toFixed(2) : "—";

    const diasCultivo = cultivoActivo
        ? Math.floor((new Date() - new Date(cultivoActivo.fecha_creacion)) / (1000 * 60 * 60 * 24))
        : 0;

    cont.innerHTML = `
        <div class="bg-white rounded-2xl border border-gray-200 p-5">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <i data-lucide="smartphone" class="w-6 h-6 text-brand"></i>
                </div>
                <div>
                    <p class="text-xs text-gray-500 mb-0.5">Sensores online</p>
                    <p class="text-2xl font-bold text-gray-900">
                        <span class="text-brand">${online}</span>
                        <span class="text-gray-300 text-lg font-normal">/ ${totalSensores}</span>
                    </p>
                </div>
            </div>
        </div>

        <div class="bg-white rounded-2xl border border-gray-200 p-5">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <i data-lucide="bell" class="w-6 h-6 text-red-600"></i>
                </div>
                <div>
                    <p class="text-xs text-gray-500 mb-0.5">Alertas activas</p>
                    <p class="text-2xl font-bold text-gray-900">${alertasActivas.length}</p>
                </div>
            </div>
        </div>

        <div class="bg-white rounded-2xl border border-gray-200 p-5">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <i data-lucide="droplet" class="w-6 h-6 text-blue-600"></i>
                </div>
                <div>
                    <p class="text-xs text-gray-500 mb-0.5">Última medición</p>
                    <p class="text-2xl font-bold text-gray-900">pH ${valorPh}</p>
                </div>
            </div>
        </div>

        <div class="bg-white rounded-2xl border border-gray-200 p-5">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <i data-lucide="calendar-days" class="w-6 h-6 text-cyan-600"></i>
                </div>
                <div>
                    <p class="text-xs text-gray-500 mb-0.5">Días del ciclo</p>
                    <p class="text-2xl font-bold text-gray-900">
                        ${diasCultivo} <span class="text-gray-300 text-lg font-normal">/ 28</span>
                    </p>
                </div>
            </div>
        </div>
    `;
    lucide.createIcons();
}

// ---------- Gráfico ----------
function renderGrafico() {
    const canvas = document.getElementById("chart-ph");
    if (!canvas) return;

    const medicionesPh = agrupadas["ph"] || [];

    // Tomar las últimas 50 mediciones sin importar la fecha
    const filtradas = medicionesPh
        .slice(0, 50)
        .sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));

    const labels = filtradas.map(m => {
        const d = new Date(m.fecha_hora);
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    });
    const valores = filtradas.map(m => m.valor);

    if (window.graficoDashboard) window.graficoDashboard.destroy();

    window.graficoDashboard = new Chart(canvas.getContext("2d"), {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                data: valores,
                borderColor: "#15803D",
                backgroundColor: "rgba(21, 128, 61, 0.1)",
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointHoverRadius: 6,
                pointBackgroundColor: "#15803D",
                pointBorderColor: "#fff",
                pointBorderWidth: 2,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "#0F3B26",
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: { label: (c) => `pH: ${c.parsed.y.toFixed(2)}` },
                },
            },
            scales: {
                y: {
                    min: 5.0, max: 7.0,
                    ticks: { stepSize: 0.5, color: "#9CA3AF", font: { size: 11 }, callback: v => v.toFixed(1) },
                    grid: { color: "#F3F4F6" },
                },
                x: {
                    ticks: { color: "#9CA3AF", font: { size: 11 }, maxTicksLimit: 8 },
                    grid: { display: false },
                },
            },
        },
        plugins: [{
            id: "rangoPermitido",
            beforeDatasetsDraw: (chart) => {
                const { ctx, chartArea, scales } = chart;
                const yMin = scales.y.getPixelForValue(5.5);
                const yMax = scales.y.getPixelForValue(6.5);
                ctx.save();
                ctx.fillStyle = "rgba(34, 197, 94, 0.08)";
                ctx.fillRect(chartArea.left, yMin, chartArea.right - chartArea.left, yMax - yMin);
                ctx.restore();
            },
        }],
    });
}

// ---------- Alertas ----------
function renderAlertas() {
    const cont = document.getElementById("alertas-recientes");
    if (!cont) return;

    if (alertasActivas.length === 0) {
        cont.innerHTML = `
            <div class="text-center py-6">
                <i data-lucide="check-circle" class="w-8 h-8 text-green-500 mx-auto mb-2"></i>
                <p class="text-sm text-gray-500">Sin alertas activas</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    const estilosSeveridad = {
        "alta":  { bg: "bg-red-50", border: "border-red-100", iconoBg: "bg-red-100", iconoColor: "text-red-600", badgeBg: "bg-red-100", badgeText: "text-red-700", label: "Crítica", icono: "alert-triangle" },
        "media": { bg: "bg-orange-50", border: "border-orange-100", iconoBg: "bg-orange-100", iconoColor: "text-orange-600", badgeBg: "bg-orange-100", badgeText: "text-orange-700", label: "Aviso", icono: "alert-circle" },
        "baja":  { bg: "bg-blue-50", border: "border-blue-100", iconoBg: "bg-blue-100", iconoColor: "text-blue-600", badgeBg: "bg-blue-100", badgeText: "text-blue-700", label: "Info", icono: "info" },
    };

    cont.innerHTML = alertasActivas.slice(0, 3).map(a => {
        const est = estilosSeveridad[a.severidad] || estilosSeveridad.baja;
        const titulo = a.medicion ? "Medición fuera de rango" : "Evento del sistema";

        return `
            <div class="flex items-start gap-3 p-3 rounded-xl ${est.bg} border ${est.border}">
                <div class="w-8 h-8 ${est.iconoBg} rounded-lg flex items-center justify-center flex-shrink-0">
                    <i data-lucide="${est.icono}" class="w-4 h-4 ${est.iconoColor}"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-gray-900 truncate">${titulo}</p>
                    <p class="text-xs text-gray-600 mt-0.5">${cultivoActivo?.nombre || "—"}</p>
                    <p class="text-xs text-gray-400 mt-0.5">${tiempoRelativo(a.fecha_hora_inicio)}</p>
                </div>
                <span class="text-[10px] font-bold ${est.badgeText} ${est.badgeBg} px-2 py-0.5 rounded-full whitespace-nowrap">
                    ${est.label}
                </span>
            </div>
        `;
    }).join("");

    lucide.createIcons();
}

// ---------- Iniciar ----------
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", cargarDashboard);
} else {
    cargarDashboard();
}