// ============================================================
// monitoreo.js — Carga dinámica de la pantalla de Monitoreo
// ============================================================

let sensoresMap = {};
let medicionesTodas = [];
let agrupadas = {};

const TIPOS_CONFIG = {
    "ph":           { unidad: "pH",          icono: "droplet",     color: "text-brand",       bg: "bg-green-100",  min: 5.5, max: 6.5 },
    "conductividad":{ unidad: "mS/cm",       icono: "activity",    color: "text-teal-600",    bg: "bg-teal-100",   min: 1300, max: 2000 },
    "temperatura":  { unidad: "°C",          icono: "thermometer", color: "text-orange-600",  bg: "bg-orange-100", min: 18, max: 26 },
    "luz":          { unidad: "µmol/m²/s",   icono: "sun",         color: "text-yellow-600",  bg: "bg-yellow-100", min: 200, max: 500 },
    "humedad":      { unidad: "%",           icono: "waves",       color: "text-cyan-600",    bg: "bg-cyan-100",   min: 60, max: 80 },
    "caudal":       { unidad: "L/min",       icono: "wind",        color: "text-blue-600",    bg: "bg-blue-100",   min: 0.5, max: 3 },
};

// ---------- Cargar todo ----------
async function cargarMonitoreo() {
    try {
        await cargarSensores();
        await cargarMediciones();
        agruparMediciones();
        renderTodo();
    } catch (err) {
        console.error(err);
        const canvas = document.getElementById("chart-monitoreo");
        if (canvas) {
            canvas.parentElement.innerHTML = `
                <div class="bg-red-50 border border-red-200 text-red-700 text-sm p-4 rounded-xl">
                    Error al cargar monitoreo: ${err.message}
                </div>
            `;
        }
    }
}

// ---------- Cargar sensores ----------
async function cargarSensores() {
    const respuesta = await apiGet("/sensores/");
    const listaSensores = Array.isArray(respuesta) ? respuesta : (respuesta.results || []);

    const respTipos = await apiGet("/tipos-sensor/");
    const tiposSensor = Array.isArray(respTipos) ? respTipos : (respTipos.results || []);

    const mapaTipos = {};
    tiposSensor.forEach(t => { mapaTipos[t.id] = t; });

    sensoresMap = {};
    listaSensores.forEach(s => {
        const tipo = mapaTipos[s.tipo_sensor];
        if (tipo) {
            sensoresMap[s.id] = {
                tipo_nombre: tipo.nombre,
                unidad: tipo.unidad_medida,
                tipo_id: tipo.id,
            };
        }
    });

    console.log("Sensores cargados:", sensoresMap);
}

// ---------- Cargar mediciones ----------
async function cargarMediciones() {
    const respuesta = await apiGet("/mediciones/");
    medicionesTodas = Array.isArray(respuesta) ? respuesta : (respuesta.results || []);
    console.log(`Mediciones cargadas: ${medicionesTodas.length}`);
}

// ---------- Agrupar por tipo ----------
function agruparMediciones() {
    agrupadas = {};
    medicionesTodas.forEach(m => {
        const sensor = sensoresMap[m.sensor];
        if (!sensor) return;
        const tipo = sensor.tipo_nombre;
        if (!agrupadas[tipo]) agrupadas[tipo] = [];
        agrupadas[tipo].push(m);
    });

    Object.keys(agrupadas).forEach(tipo => {
        agrupadas[tipo].sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));
    });
}

// ---------- Render todo ----------
function renderTodo() {
    renderTarjetasSensores();
    renderLecturasActuales();
    renderTablaMediciones();
    renderGrafico("ph");
    renderDonaEstado();
    configurarSelectorGrafico();
}

// ---------- Tarjetas superiores ----------
function renderTarjetasSensores() {
    const contenedor = document.getElementById("tarjetas-sensores");
    const tiposAMostrar = ["ph", "conductividad", "temperatura", "luz"];

    contenedor.innerHTML = tiposAMostrar.map(tipo => {
        const config = TIPOS_CONFIG[tipo];
        const mediciones = agrupadas[tipo] || [];
        const ultima = mediciones[0];

        if (!ultima) {
            return `
                <div class="bg-white rounded-2xl border border-gray-200 p-5 opacity-50">
                    <p class="text-xs text-gray-500">${tipo}</p>
                    <p class="text-sm text-gray-400 mt-2">Sin datos</p>
                </div>
            `;
        }

        const valor = ultima.valor;
        const enRango = valor >= config.min && valor <= config.max;
        const badge = enRango
            ? `<span class="inline-flex items-center gap-1.5 bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-1 rounded-full"><span class="w-1.5 h-1.5 bg-green-600 rounded-full"></span>Normal</span>`
            : `<span class="inline-flex items-center gap-1.5 bg-red-100 text-red-800 text-xs font-semibold px-2.5 py-1 rounded-full"><span class="w-1.5 h-1.5 bg-red-600 rounded-full"></span>Alerta</span>`;

        let valorStr = valor;
        if (tipo === "ph") valorStr = valor.toFixed(2);
        else if (tipo === "conductividad") valorStr = (valor / 1000).toFixed(2);
        else if (tipo === "temperatura") valorStr = valor.toFixed(1);
        else if (tipo === "luz") valorStr = Math.round(valor);

        let rangoStr = "";
        if (tipo === "conductividad") {
            rangoStr = `Rango: ${(config.min/1000).toFixed(1)} - ${(config.max/1000).toFixed(1)}`;
        } else {
            rangoStr = `Rango: ${config.min} - ${config.max}`;
        }

        return `
            <div class="bg-white rounded-2xl border border-gray-200 p-5">
                <div class="flex items-start justify-between mb-3">
                    <div class="w-12 h-12 ${config.bg} rounded-xl flex items-center justify-center">
                        <i data-lucide="${config.icono}" class="w-6 h-6 ${config.color}"></i>
                    </div>
                    ${badge}
                </div>
                <p class="text-xs text-gray-500 mb-1">${nombreBonito(tipo)}</p>
                <p class="text-3xl font-bold text-gray-900 mb-1">
                    ${valorStr} <span class="text-lg font-medium text-gray-500">${config.unidad}</span>
                </p>
                <p class="text-xs text-gray-500">${rangoStr}</p>
            </div>
        `;
    }).join("");

    lucide.createIcons();
}

// ---------- Lecturas actuales ----------
function renderLecturasActuales() {
    const contenedor = document.getElementById("lecturas-actuales");

    const tipos = Object.keys(agrupadas).sort();
    if (tipos.length === 0) {
        contenedor.innerHTML = `<p class="text-sm text-gray-500 text-center py-4">Sin lecturas</p>`;
        return;
    }

    contenedor.innerHTML = tipos.map(tipo => {
        const config = TIPOS_CONFIG[tipo] || { unidad: "", icono: "activity", color: "text-gray-600", bg: "bg-gray-100", min: 0, max: 99999 };
        const ultima = agrupadas[tipo][0];
        if (!ultima) return "";

        const enRango = ultima.valor >= config.min && ultima.valor <= config.max;
        let valorStr = ultima.valor;
        if (tipo === "conductividad") valorStr = (ultima.valor / 1000).toFixed(2);
        else if (tipo === "ph") valorStr = ultima.valor.toFixed(2);
        else if (tipo === "temperatura") valorStr = ultima.valor.toFixed(1);
        else valorStr = Math.round(ultima.valor);

        return `
            <div class="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                <div class="w-8 h-8 ${config.bg} rounded-lg flex items-center justify-center flex-shrink-0">
                    <i data-lucide="${config.icono}" class="w-4 h-4 ${config.color}"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-xs text-gray-500">${nombreBonito(tipo)}</p>
                    <p class="text-sm font-bold text-gray-900">${valorStr} ${config.unidad}</p>
                </div>
                <span class="inline-flex items-center gap-1 ${enRango ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    <span class="w-1 h-1 ${enRango ? 'bg-green-600' : 'bg-red-600'} rounded-full"></span>
                    ${enRango ? 'Normal' : 'Alerta'}
                </span>
                <span class="text-[10px] text-gray-400 whitespace-nowrap">${tiempoRelativo(ultima.fecha_hora)}</span>
            </div>
        `;
    }).join("");

    lucide.createIcons();
}

// ---------- Tabla ----------
function renderTablaMediciones() {
    const tbody = document.getElementById("tbody-mediciones");

    const ultimas = [...medicionesTodas]
        .sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora))
        .slice(0, 10);

    const porFecha = {};
    ultimas.forEach(m => {
        const f = m.fecha_hora;
        if (!porFecha[f]) porFecha[f] = {};
        const sensor = sensoresMap[m.sensor];
        if (sensor) {
            porFecha[f][sensor.tipo_nombre] = m.valor;
        }
    });

    const filas = Object.entries(porFecha).slice(0, 5);

    tbody.innerHTML = filas.map(([fecha, valores]) => {
        const fechaFormato = formatearFechaHora(fecha).replace(",", "");
        const ph = valores["ph"] !== undefined ? valores["ph"].toFixed(2) : "—";
        const ec = valores["conductividad"] !== undefined ? (valores["conductividad"]/1000).toFixed(1) : "—";
        const temp = valores["temperatura"] !== undefined ? valores["temperatura"].toFixed(1) : "—";
        const luz = valores["luz"] !== undefined ? Math.round(valores["luz"]) : "—";
        const hum = valores["humedad"] !== undefined ? Math.round(valores["humedad"]) : "—";
        const caud = valores["caudal"] !== undefined ? valores["caudal"].toFixed(2) : "—";

        return `
            <tr class="hover:bg-gray-50">
                <td class="py-3 px-3 text-gray-700 whitespace-nowrap">${fechaFormato}</td>
                <td class="py-3 px-3 text-gray-900 font-medium">${ph}</td>
                <td class="py-3 px-3 text-gray-900 font-medium">${ec}</td>
                <td class="py-3 px-3 text-gray-900 font-medium">${temp}</td>
                <td class="py-3 px-3 text-gray-900 font-medium">${luz}</td>
                <td class="py-3 px-3 text-gray-900 font-medium">${hum}</td>
                <td class="py-3 px-3 text-gray-900 font-medium">${caud}</td>
            </tr>
        `;
    }).join("");

    const contador = document.getElementById("contador-mediciones");
    if (contador) contador.textContent = `Mostrando últimas ${filas.length} tomas de ${medicionesTodas.length} mediciones`;
}

// ---------- Gráfico ----------
function renderGrafico(tipo) {
    const mediciones = agrupadas[tipo] || [];
    const config = TIPOS_CONFIG[tipo] || { min: 0, max: 10 };

    // ✅ FIX: tomar las últimas 50 sin filtrar por fecha
    const filtradas = mediciones
        .slice(0, 50)
        .sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));

    const labels = filtradas.map(m => {
        const d = new Date(m.fecha_hora);
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    });
    const valores = filtradas.map(m => m.valor);

    const canvas = document.getElementById("chart-monitoreo");
    const ctx = canvas.getContext("2d");

    if (window.graficoMonitoreo) {
        window.graficoMonitoreo.destroy();
    }

    let yMin = config.min * 0.9;
    let yMax = config.max * 1.1;
    let stepSize = 0.5;

    if (tipo === "conductividad") {
        yMin = config.min * 0.9; yMax = config.max * 1.1;
        stepSize = (yMax - yMin) / 4;
    } else if (tipo === "temperatura") {
        stepSize = 2;
    } else if (tipo === "luz") {
        stepSize = 100;
    }

    window.graficoMonitoreo = new Chart(ctx, {
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
                    callbacks: {
                        label: (c) => `${nombreBonito(tipo)}: ${c.parsed.y.toFixed(2)}`,
                    },
                },
            },
            scales: {
                y: {
                    min: yMin,
                    max: yMax,
                    ticks: {
                        stepSize: stepSize,
                        color: "#9CA3AF",
                        font: { size: 11 },
                        callback: v => v.toFixed(1),
                    },
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
                const yMinPx = scales.y.getPixelForValue(config.min);
                const yMaxPx = scales.y.getPixelForValue(config.max);
                if (yMinPx > chartArea.bottom || yMaxPx < chartArea.top) return;
                ctx.save();
                ctx.fillStyle = "rgba(34, 197, 94, 0.08)";
                ctx.fillRect(
                    chartArea.left,
                    Math.max(yMinPx, chartArea.top),
                    chartArea.right - chartArea.left,
                    Math.min(yMaxPx, chartArea.bottom) - Math.max(yMinPx, chartArea.top)
                );
                ctx.restore();
            },
        }],
    });

    const rangoLabel = document.getElementById("leyenda-rango");
    if (rangoLabel) {
        if (tipo === "conductividad") {
            rangoLabel.textContent = `Rango permitido (${(config.min/1000).toFixed(1)} - ${(config.max/1000).toFixed(1)})`;
        } else {
            rangoLabel.textContent = `Rango permitido (${config.min} - ${config.max})`;
        }
    }

    const titulo = document.getElementById("titulo-grafico");
    if (titulo) {
        titulo.textContent = `Evolución de ${nombreBonito(tipo)} (Últimas 24 horas)`;
    }
}

// ---------- Selector ----------
function configurarSelectorGrafico() {
    const selector = document.getElementById("selector-sensor");
    if (!selector) return;

    selector.addEventListener("change", (e) => {
        renderGrafico(e.target.value);
    });
}

// ---------- Dona ----------
function renderDonaEstado() {
    const ctxDona = document.getElementById("chart-dona");
    if (!ctxDona) return;

    const totalSensores = Object.keys(sensoresMap).length;
    const conDatos = Object.keys(agrupadas).length;
    const online = conDatos;
    const offline = totalSensores - conDatos;
    const mantenimiento = 0;

    if (window.graficoDona) window.graficoDona.destroy();

    window.graficoDona = new Chart(ctxDona.getContext("2d"), {
        type: "doughnut",
        data: {
            labels: ["Online", "Offline", "Mantenimiento"],
            datasets: [{
                data: [online, offline, mantenimiento],
                backgroundColor: ["#15803D", "#EF4444", "#D1D5DB"],
                borderWidth: 0,
                cutout: "75%",
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
        },
    });

    const textoDona = document.getElementById("dona-texto");
    if (textoDona) textoDona.textContent = `${online}/${totalSensores}`;

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set("dona-online", online);
    set("dona-offline", offline);
    set("dona-mantenimiento", mantenimiento);
}

// ---------- Helpers ----------
function nombreBonito(tipo) {
    const nombres = {
        "ph": "pH",
        "conductividad": "Conductividad (EC)",
        "temperatura": "Temperatura",
        "luz": "Luz",
        "humedad": "Humedad",
        "caudal": "Caudal",
    };
    return nombres[tipo] || tipo;
}

// ---------- Iniciar ----------
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", cargarMonitoreo);
} else {
    cargarMonitoreo();
}