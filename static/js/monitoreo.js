// ============================================================
// monitoreo.js — Carga dinámica de la pantalla de Monitoreo
// ============================================================

let sensoresMap = {};
let medicionesTodas = [];
let agrupadas = {};
let rangosPorSensor = {}; // NUEVO: Almacena los rangos desde la API

const TIPOS_CONFIG = {
    "ph":           { unidad: "pH",          icono: "droplet",     color: "text-brand",       bg: "bg-green-100" },
    "conductividad":{ unidad: "ppm",         icono: "activity",    color: "text-teal-600",    bg: "bg-teal-100" },
};

// ---------- Cargar todo ----------
async function cargarMonitoreo() {
    try {
        await cargarSensores();
        await cargarMediciones();
        await cargarRangosOperacion(); // NUEVO: Traemos los rangos de la API
        agruparMediciones();
        renderTodo();

        iniciarIndicadorEnVivo();
        iniciarPolling(refrescarMonitoreo);
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

async function refrescarMonitoreo() {
    await cargarSensores();
    await cargarMediciones();
    await cargarRangosOperacion();
    agruparMediciones();

    const selector = document.getElementById("selector-sensor");
    const tipoActual = selector?.value || "ph";

    renderTablaMediciones();
    renderGrafico(tipoActual);
    renderDonaEstado();
}

// ---------- Cargar sensores ----------
async function cargarSensores() {
    const respuesta = await apiGet("/sensores/");
    if (respuesta === null) throw new Error("No se pudo obtener /sensores/");
    const listaSensores = Array.isArray(respuesta) ? respuesta : (respuesta.results || []);

    const respTipos = await apiGet("/tipos-sensor/");
    if (respTipos === null) throw new Error("No se pudo obtener /tipos-sensor/");
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
}

// ---------- Cargar mediciones ----------
async function cargarMediciones() {
    let todasLasMediciones = [];
    let url = "/mediciones/";
    
    try {
        while (url) {
            const respuesta = await apiGet(url);
            if (respuesta === null) throw new Error("No se pudo obtener /mediciones/");
            
            if (Array.isArray(respuesta)) {
                todasLasMediciones = respuesta;
                url = null; 
            } else {
                todasLasMediciones = todasLasMediciones.concat(respuesta.results || []);
                if (respuesta.next) {
                    const urlObj = new URL(respuesta.next);
                    url = urlObj.pathname.replace('/api', '') + urlObj.search;
                } else {
                    url = null;
                }
            }
        }
        medicionesTodas = todasLasMediciones;
    } catch (e) {
        console.error("Error al cargar mediciones:", e);
        throw e;
    }
}

// ---------- NUEVO: Cargar rangos desde la API ----------
async function cargarRangosOperacion() {
    rangosPorSensor = {};
    try {
        const resp = await apiGet("/rangos-operacion/");
        const lista = Array.isArray(resp) ? resp : (resp.results || []);
        lista.forEach(r => {
            const actual = rangosPorSensor[r.sensor];
            // Guardamos el rango más reciente
            if (!actual || new Date(r.vigente_desde) > new Date(actual.vigente_desde)) {
                rangosPorSensor[r.sensor] = r;
            }
        });
    } catch (err) {
        console.warn("No se pudieron cargar los rangos de operación:", err);
    }
}

// ---------- Helpers para obtener el rango de un tipo ----------
function obtenerRangoVigente(tipo) {
    const medicionesTipo = agrupadas[tipo] || [];
    const ultima = medicionesTipo[0]; // La más reciente
    
    if (ultima && rangosPorSensor[ultima.sensor]) {
        return rangosPorSensor[ultima.sensor];
    }
    return null;
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
    renderTablaMediciones();
    renderGrafico(document.getElementById("selector-sensor")?.value || "ph");
    renderDonaEstado();
    configurarSelectorGrafico();
}

// ---------- Tabla ----------
function renderTablaMediciones() {
    const tbody = document.getElementById("tbody-mediciones");
    if (!tbody) return;

    const scrollYAntes = window.scrollY;
    const contScroll = tbody.closest(".overflow-y-auto, .overflow-auto");
    const scrollTopAntes = contScroll ? contScroll.scrollTop : 0;

    const todasOrdenadas = [...medicionesTodas].sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));

    if (todasOrdenadas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="py-8 text-center text-gray-400 text-sm">No hay mediciones registradas</td></tr>`;
        const contador = document.getElementById("contador-mediciones");
        if (contador) contador.textContent = "0 mediciones";
        return;
    }

    const porFecha = {};
    todasOrdenadas.forEach(m => {
        const f = m.fecha_hora;
        if (!porFecha[f]) porFecha[f] = {};
        const sensor = sensoresMap[m.sensor];
        if (sensor) {
            porFecha[f][sensor.tipo_nombre] = m.valor;
        }
    });

    const filas = Object.entries(porFecha);

    tbody.innerHTML = filas.map(([fecha, valores]) => {
        const fechaFormato = formatearFechaHora(fecha).replace(",", "");
        const ph = valores["ph"] !== undefined ? Number(valores["ph"]).toFixed(2) : "—";
        const ec = valores["conductividad"] !== undefined ? Number(valores["conductividad"]).toFixed(1) : "—";
        
        return `
            <tr class="hover:bg-gray-50">
                <td class="py-3 px-3 text-gray-700 whitespace-nowrap">${fechaFormato}</td>
                <td class="py-3 px-3 text-gray-900 font-medium">${ph}</td>
                <td class="py-3 px-3 text-gray-900 font-medium">${ec}</td>
            </tr>
        `;
    }).join("");

    if (contScroll) contScroll.scrollTop = scrollTopAntes;
    if (window.scrollY !== scrollYAntes) window.scrollTo(window.scrollX, scrollYAntes);

    const contador = document.getElementById("contador-mediciones");
    if (contador) contador.textContent = `Mostrando ${filas.length} tomas de ${medicionesTodas.length} mediciones totales`;
}

// ---------- Gráfico ----------
function renderGrafico(tipo) {
    const mediciones = agrupadas[tipo] || [];
    
    // 🔥 AHORA EL RANGO VIENE DE LA API
    const rango = obtenerRangoVigente(tipo);
    const minVal = rango ? rango.valor_min : 0;
    const maxVal = rango ? rango.valor_max : 100;

    const filtradas = mediciones.slice(0, 50).sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));

    const labels = filtradas.map(m => {
        const d = new Date(m.fecha_hora);
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    });
    const valores = filtradas.map(m => m.valor);

    if (labels.length === 0 && window.graficoMonitoreo && window.graficoMonitoreo.__tipo === tipo) {
        actualizarTextosRango(tipo, rango);
        return;
    }

    if (window.graficoMonitoreo && window.graficoMonitoreo.__tipo === tipo) {
        window.graficoMonitoreo.data.labels = labels;
        window.graficoMonitoreo.data.datasets[0].data = valores;
        window.graficoMonitoreo.update();
        actualizarTextosRango(tipo, rango);
        return;
    }

    const canvas = document.getElementById("chart-monitoreo");
    const ctx = canvas.getContext("2d");

    if (window.graficoMonitoreo) {
        window.graficoMonitoreo.destroy();
    }

    const apoyosY = [];
    if (rango) apoyosY.push(rango.valor_min, rango.valor_max);
    valores.forEach(v => { if (Number.isFinite(v)) apoyosY.push(v); });
    if (apoyosY.length === 0) apoyosY.push(0, 10);
    
    const lo = Math.min(...apoyosY);
    const hi = Math.max(...apoyosY);
    const pad = (hi - lo) * 0.1 || 1;
    const yMin = lo - pad;
    const yMax = hi + pad;
    let stepSize = (yMax - yMin) / 5;

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
                    callbacks: { label: (c) => `${nombreBonito(tipo)}: ${c.parsed.y.toFixed(2)}` },
                },
            },
            scales: {
                y: {
                    min: yMin,
                    max: yMax,
                    ticks: { stepSize: stepSize, color: "#9CA3AF", font: { size: 11 }, callback: v => v.toFixed(1) },
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
                if (!rango) return; // Si no hay rango configurado, no pintamos la franja
                
                const yMinPx = scales.y.getPixelForValue(rango.valor_min);
                const yMaxPx = scales.y.getPixelForValue(rango.valor_max);
                if (yMinPx > chartArea.bottom || yMaxPx < chartArea.top) return;
                ctx.save();
                ctx.fillStyle = "rgba(34, 197, 94, 0.08)";
                ctx.fillRect(chartArea.left, Math.max(yMinPx, chartArea.top), chartArea.right - chartArea.left, Math.min(yMaxPx, chartArea.bottom) - Math.max(yMinPx, chartArea.top));
                ctx.restore();
            },
        }],
    });

    actualizarTextosRango(tipo, rango);
    window.graficoMonitoreo.__tipo = tipo;
}

function actualizarTextosRango(tipo, rango) {
    const rangoLabel = document.getElementById("leyenda-rango");
    if (rangoLabel) {
        rangoLabel.textContent = rango 
            ? `Rango permitido (${rango.valor_min} - ${rango.valor_max})` 
            : "Sin rango configurado";
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
    selector.addEventListener("change", (e) => { renderGrafico(e.target.value); });
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

    if (window.graficoDona) {
        window.graficoDona.data.datasets[0].data = [online, offline, mantenimiento];
        window.graficoDona.update("none");
    } else {
        window.graficoDona = new Chart(ctxDona.getContext("2d"), {
            type: "doughnut",
            data: {
                labels: ["Online", "Offline", "Mantenimiento"],
                datasets: [{ data: [online, offline, mantenimiento], backgroundColor: ["#15803D", "#EF4444", "#D1D5DB"], borderWidth: 0, cutout: "75%" }],
            },
            options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false }, tooltip: { enabled: false } } },
        });
    }

    const textoDona = document.getElementById("dona-texto");
    if (textoDona) textoDona.textContent = `${online}/${totalSensores}`;

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set("dona-online", online);
    set("dona-offline", offline);
    set("dona-mantenimiento", mantenimiento);
}

// ---------- Helpers ----------
function nombreBonito(tipo) {
    const nombres = { "ph": "pH", "conductividad": "Conductividad (EC)" };
    return nombres[tipo] || tipo;
}

// ---------- Iniciar ----------
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", cargarMonitoreo);
} else {
    cargarMonitoreo();
}