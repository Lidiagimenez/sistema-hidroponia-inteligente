// ============================================================
// dashboard.js — Carga dinámica del Dashboard
// ============================================================

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
            cargarCultivoActivo(),
            cargarSensoresYMediciones(),
            cargarAlertas(),
        ]);

        renderBanner();
        renderTarjetas();
        renderGrafico();
        renderAlertas();
    } catch (err) {
        console.error(err);
    }
}

// ---------- Cultivo activo (el primero) ----------
async function cargarCultivoActivo() {
    const resp = await apiGet("/cultivos/");
    const lista = Array.isArray(resp) ? resp : (resp.results || []);
    cultivoActivo = lista[0] || null;
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

    // Agrupar por tipo
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

// ---------- Banner del cultivo ----------
function renderBanner() {
    const cont = document.getElementById("banner-cultivo");
    if (!cont) return;

    if (!cultivoActivo) {
        cont.innerHTML = `
            <div class="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center">
                <p class="text-sm text-gray-500">No hay cultivos activos</p>
            </div>
        `;
        return;
    }

    const fechaInicio = new Date(cultivoActivo.fecha_creacion);
    const hoy = new Date();
    const dias = Math.floor((hoy - fechaInicio) / (1000 * 60 * 60 * 24));
    const totalDias = 28; // asumido
    const etapa = dias < 7 ? "Germinación" : dias < 21 ? "Crecimiento" : "Cosecha";

    cont.innerHTML = `
        <div class="relative bg-gradient-to-r from-green-50 via-white to-green-50/30 rounded-2xl overflow-hidden border border-green-100">
            <div class="flex items-center justify-between p-6">
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
        </div>
    `;
    lucide.createIcons();
}

// ---------- 4 Tarjetas de estado ----------
function renderTarjetas() {
    const cont = document.getElementById("tarjetas-estado");
    if (!cont) return;

    // Sensores online (los que tienen mediciones)
    const totalSensores = Object.keys(sensoresMap).length;
    const online = Object.keys(agrupadas).length;

    // Última medición de pH
    const ultPh = agrupadas["ph"]?.[0];
    const valorPh = ultPh ? ultPh.valor.toFixed(2) : "—";

    // Cultivo activo
    const diasCultivo = cultivoActivo
        ? Math.floor((new Date() - new Date(cultivoActivo.fecha_creacion)) / (1000 * 60 * 60 * 24))
        : 0;

    cont.innerHTML = `
        <!-- Sensores -->
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

        <!-- Alertas -->
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

        <!-- Última medición -->
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

        <!-- Días del ciclo -->
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

// ---------- Gráfico de pH ----------
function renderGrafico() {
    const canvas = document.getElementById("chart-ph");
    if (!canvas) return;

    const medicionesPh = agrupadas["ph"] || [];
    const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const filtradas = medicionesPh
        .filter(m => new Date(m.fecha_hora) >= hace24h)
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

// ---------- Alertas que requieren atención ----------
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
document.addEventListener("DOMContentLoaded", cargarDashboard);