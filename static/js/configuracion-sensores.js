// ============================================================
// configuracion-sensores.js
// ============================================================

let sensores = [];
let sensoresFiltrados = [];
let tiposMap = {};          // { tipo_id: { nombre, unidad } }
let dispositivosMap = {};   // { disp_id: { nombre, cultivo_id } }
let cultivosMap = {};       // { cultivo_id: nombre }
let rangosPorSensor = {};   // { sensor_id: rango_obj }
let medicionesPorSensor = {}; // { sensor_id: [mediciones] }
let sensorSeleccionado = null;
let historial = [];

// ---------- Config visual ----------

const TIPO_ICONO = {
    "ph":              { icono: "droplet",     bg: "bg-green-100",  color: "text-brand" },
    "conductividad":   { icono: "activity",    bg: "bg-teal-100",   color: "text-teal-600" },
    "temperatura":     { icono: "thermometer", bg: "bg-orange-100", color: "text-orange-600" },
    "luz":             { icono: "sun",         bg: "bg-yellow-100", color: "text-yellow-600" },
    "humedad":         { icono: "waves",       bg: "bg-cyan-100",   color: "text-cyan-600" },
    "caudal":          { icono: "wind",        bg: "bg-blue-100",   color: "text-blue-600" },
};

// ---------- Cargar todo ----------
async function cargarConfiguracion() {
    const tbody = document.getElementById("tbody-sensores");
    if (!tbody) return;

    try {
        tbody.innerHTML = `
            <tr><td colspan="4" class="py-8 text-center text-gray-400 text-sm">
                <i data-lucide="loader" class="w-5 h-5 mx-auto mb-2 animate-spin"></i>
                Cargando...
            </td></tr>
        `;
        lucide.createIcons();

        await Promise.all([
            cargarTipos(),
            cargarDispositivos(),
            cargarCultivos(),
        ]);

        await cargarSensores();
        await cargarRangos();
        await cargarMediciones();

        sensoresFiltrados = [...sensores];
        renderTabla();

        // Seleccionar el primero
        if (sensoresFiltrados.length > 0) {
            seleccionarSensor(sensoresFiltrados[0]);
        }

        configurarFormulario();
        cargarHistorialDesdeLocal();
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `
            <tr><td colspan="4" class="py-8 text-center text-red-500 text-sm">
                Error: ${err.message}
            </td></tr>
        `;
    }
}

// ---------- Catálogos ----------
async function cargarTipos() {
    const resp = await apiGet("/tipos-sensor/");
    const lista = Array.isArray(resp) ? resp : (resp.results || []);
    tiposMap = {};
    lista.forEach(t => { tiposMap[t.id] = { nombre: t.nombre, unidad: t.unidad_medida }; });
}

async function cargarDispositivos() {
    const resp = await apiGet("/dispositivos/");
    const lista = Array.isArray(resp) ? resp : (resp.results || []);
    dispositivosMap = {};
    lista.forEach(d => { dispositivosMap[d.id] = { nombre: d.nombre, cultivo_id: d.cultivo }; });
}

async function cargarCultivos() {
    const resp = await apiGet("/cultivos/");
    const lista = Array.isArray(resp) ? resp : (resp.results || []);
    cultivosMap = {};
    lista.forEach(c => { cultivosMap[c.id_cultivo] = c.nombre; });
}

// ---------- Sensores ----------
async function cargarSensores() {
    const resp = await apiGet("/sensores/");
    sensores = Array.isArray(resp) ? resp : (resp.results || []);
}

// ---------- Rangos ----------
async function cargarRangos() {
    const resp = await apiGet("/rangos-operacion/");
    const lista = Array.isArray(resp) ? resp : (resp.results || []);
    rangosPorSensor = {};
    lista.forEach(r => {
        // Solo nos interesa el más reciente por sensor
        if (!rangosPorSensor[r.sensor] || new Date(r.vigente_desde) > new Date(rangosPorSensor[r.sensor].vigente_desde)) {
            rangosPorSensor[r.sensor] = r;
        }
    });
}

// ---------- Mediciones ----------
async function cargarMediciones() {
    const resp = await apiGet("/mediciones/");
    const lista = Array.isArray(resp) ? resp : (resp.results || []);
    medicionesPorSensor = {};
    lista.forEach(m => {
        if (!medicionesPorSensor[m.sensor]) medicionesPorSensor[m.sensor] = [];
        medicionesPorSensor[m.sensor].push(m);
    });
    // Ordenar cada grupo por fecha
    Object.keys(medicionesPorSensor).forEach(sid => {
        medicionesPorSensor[sid].sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));
    });
}

// ---------- Renderizar tabla ----------
function renderTabla() {
    const tbody = document.getElementById("tbody-sensores");

    if (sensoresFiltrados.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="4" class="py-8 text-center text-gray-400 text-sm">
                No hay sensores registrados.
            </td></tr>
        `;
        return;
    }

    tbody.innerHTML = sensoresFiltrados.map(s => {
        const tipo = tiposMap[s.tipo_sensor] || { nombre: "?", unidad: "" };
        const disp = dispositivosMap[s.dispositivo] || { nombre: "?" };
        const cultivoNombre = disp.cultivo_id ? (cultivosMap[disp.cultivo_id] || "—") : "—";
        const rango = rangosPorSensor[s.id];

        const esSeleccionado = sensorSeleccionado && sensorSeleccionado.id === s.id;
        const claseRow = esSeleccionado ? "bg-green-50" : "hover:bg-gray-50";

        // Determinar estado (normal si tiene rango)
        const estadoBadge = rango
            ? `<span class="inline-flex items-center gap-1 bg-green-100 text-green-800 text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                   <span class="w-1 h-1 bg-green-600 rounded-full"></span>
                   Configurado
               </span>`
            : `<span class="inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                   Sin rango
               </span>`;

        const tipoNombre = tipo.nombre;
        const tipoConfig = TIPO_ICONO[tipoNombre] || { icono: "activity", bg: "bg-gray-100", color: "text-gray-600" };

        return `
            <tr class="${claseRow} cursor-pointer sensor-row" data-id="${s.id}">
                <td class="py-2 px-2">
                    <div class="flex items-center gap-2">
                        <div class="w-7 h-7 ${tipoConfig.bg} rounded-lg flex items-center justify-center flex-shrink-0">
                            <i data-lucide="${tipoConfig.icono}" class="w-3.5 h-3.5 ${tipoConfig.color}"></i>
                        </div>
                        <div>
                            <p class="text-gray-900 font-medium text-xs">${tipoNombre}</p>
                            <p class="text-[10px] text-gray-400">ID ${s.id}</p>
                        </div>
                    </div>
                </td>
                <td class="py-2 px-2 text-gray-700 text-xs">${tipoNombre}</td>
                <td class="py-2 px-2 text-gray-700 text-xs">${cultivoNombre}</td>
                <td class="py-2 px-2">${estadoBadge}</td>
            </tr>
        `;
    }).join("");

    // Event listeners
    document.querySelectorAll(".sensor-row").forEach(row => {
        row.addEventListener("click", () => {
            const id = parseInt(row.dataset.id);
            const sensor = sensores.find(s => s.id === id);
            if (sensor) seleccionarSensor(sensor);
        });
    });

    lucide.createIcons();

    const contador = document.getElementById("contador-sensores");
    if (contador) contador.textContent = `Mostrando 1 - ${sensoresFiltrados.length} de ${sensoresFiltrados.length} sensores`;
}

// ---------- Seleccionar sensor ----------
function seleccionarSensor(sensor) {
    sensorSeleccionado = sensor;
    renderTabla();
    renderFormulario(sensor);
    renderGrafico(sensor);
}

// ---------- Renderizar formulario ----------
function renderFormulario(sensor) {
    const contenedor = document.getElementById("form-sensor-contenido");
    if (!contenedor) return;

    const tipo = tiposMap[sensor.tipo_sensor] || { nombre: "?", unidad: "" };
    const disp = dispositivosMap[sensor.dispositivo] || { nombre: "?" };
    const cultivoNombre = disp.cultivo_id ? (cultivosMap[disp.cultivo_id] || "—") : "—";
    const rango = rangosPorSensor[sensor.id];

    contenedor.innerHTML = `
        <div class="space-y-4">

            <!-- Sensor (solo lectura) -->
            <div>
                <label class="block text-xs font-semibold text-gray-700 mb-1.5">Sensor</label>
                <input
                    type="text"
                    value="${tipo.nombre} · ${disp.nombre} (ID ${sensor.id})"
                    readonly
                    class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-600 outline-none"
                >
            </div>

            <!-- Cultivo (solo lectura) -->
            <div>
                <label class="block text-xs font-semibold text-gray-700 mb-1.5">Cultivo asociado</label>
                <input
                    type="text"
                    value="${cultivoNombre}"
                    readonly
                    class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-600 outline-none"
                >
            </div>

            <!-- Grid: Tipo + Unidad -->
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-semibold text-gray-700 mb-1.5">Tipo</label>
                    <input
                        type="text"
                        value="${tipo.nombre}"
                        readonly
                        class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-600 outline-none"
                    >
                </div>
                <div>
                    <label class="block text-xs font-semibold text-gray-700 mb-1.5">Unidad</label>
                    <input
                        type="text"
                        value="${tipo.unidad || "—"}"
                        readonly
                        class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-600 outline-none"
                    >
                </div>
            </div>

            <!-- Rango de operación (editable) -->
            <div>
                <label class="block text-xs font-semibold text-gray-700 mb-1.5">Rango de operación</label>
                <div class="grid grid-cols-2 gap-3">
                    <input
                        type="number"
                        step="0.01"
                        id="input-min"
                        value="${rango ? rango.valor_min : ""}"
                        placeholder="Mínimo"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand focus:border-brand outline-none"
                    >
                    <input
                        type="number"
                        step="0.01"
                        id="input-max"
                        value="${rango ? rango.valor_max : ""}"
                        placeholder="Máximo"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand focus:border-brand outline-none"
                    >
                </div>
                <div class="flex justify-between mt-1">
                    <span class="text-[10px] text-gray-500">Mínimo</span>
                    <span class="text-[10px] text-gray-500">Máximo</span>
                </div>
            </div>

            <!-- Botón guardar -->
            <button
                id="btn-guardar-config"
                class="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-brand/20 mt-2"
            >
                <i data-lucide="save" class="w-4 h-4"></i>
                Guardar cambios
            </button>

            <div id="msg-config" class="hidden text-xs px-3 py-2 rounded-lg"></div>

        </div>
    `;

    lucide.createIcons();

    // Event listener del botón guardar
    document.getElementById("btn-guardar-config")?.addEventListener("click", () => guardarConfigSensor(sensor));
}

// ---------- Guardar configuración ----------
async function guardarConfigSensor(sensor) {
    const btn = document.getElementById("btn-guardar-config");
    const msg = document.getElementById("msg-config");
    const vMin = document.getElementById("input-min").value;
    const vMax = document.getElementById("input-max").value;

    if (vMin === "" || vMax === "") {
        mostrarMsgConfig("Completá el mínimo y el máximo", "error");
        return;
    }
    if (parseFloat(vMin) >= parseFloat(vMax)) {
        mostrarMsgConfig("El mínimo debe ser menor que el máximo", "error");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Guardando...`;
    lucide.createIcons();

    try {
        const rangoExistente = rangosPorSensor[sensor.id];
        const datos = {
            sensor: sensor.id,
            valor_min: parseFloat(vMin),
            valor_max: parseFloat(vMax),
        };

        let resultado;
        if (rangoExistente) {
            // PATCH al rango existente
            resultado = await apiPatch(`/rangos-operacion/${rangoExistente.id}/`, datos);
        } else {
            // POST nuevo rango
            resultado = await apiPost("/rangos-operacion/", datos);
        }

        // Actualizar en memoria
        rangosPorSensor[sensor.id] = resultado;

        // Guardar en historial local
        agregarCambioHistorial(sensor, datos);

        mostrarMsgConfig("✓ Cambios guardados correctamente", "exito");
        renderTabla();

    } catch (err) {
        console.error(err);
        mostrarMsgConfig(`Error: ${err.message}`, "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i> Guardar cambios`;
        lucide.createIcons();
    }
}

function mostrarMsgConfig(texto, tipo) {
    const msg = document.getElementById("msg-config");
    if (!msg) return;

    msg.textContent = texto;
    msg.classList.remove("hidden");
    if (tipo === "error") {
        msg.className = "text-xs px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700";
    } else {
        msg.className = "text-xs px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700";
    }
    setTimeout(() => msg.classList.add("hidden"), 4000);
}

// ---------- Historial ----------
function agregarCambioHistorial(sensor, datos) {
    const tipo = tiposMap[sensor.tipo_sensor] || { nombre: "Sensor" };
    const entrada = {
        fecha: new Date().toISOString(),
        usuario: getUsername(),
        sensor: tipo.nombre,
        cambio: `Rango: ${datos.valor_min} - ${datos.valor_max}`,
    };

    historial.unshift(entrada);
    historial = historial.slice(0, 10); // últimos 10
    localStorage.setItem("historial_config", JSON.stringify(historial));
    renderHistorial();
}

function cargarHistorialDesdeLocal() {
    try {
        historial = JSON.parse(localStorage.getItem("historial_config") || "[]");
    } catch (e) {
        historial = [];
    }
    renderHistorial();
}

function renderHistorial() {
    const contenedor = document.getElementById("historial-config");
    if (!contenedor) return;

    if (historial.length === 0) {
        contenedor.innerHTML = `
            <div class="text-center py-4 text-gray-400 text-xs">
                Sin cambios registrados todavía.
            </div>
        `;
        return;
    }

    contenedor.innerHTML = historial.map(h => `
        <div class="grid grid-cols-3 gap-2 text-xs py-2 border-b border-gray-100 last:border-0">
            <span class="text-gray-600">${formatearFechaHora(h.fecha)}</span>
            <span class="text-gray-700 font-medium truncate">${h.usuario}</span>
            <span class="text-gray-700 truncate">${h.cambio}</span>
        </div>
    `).join("");
}

// ---------- Gráfico ----------
function renderGrafico(sensor) {
    const canvas = document.getElementById("chart-sensor-config");
    if (!canvas) return;

    const tipo = tiposMap[sensor.tipo_sensor] || { nombre: "?", unidad: "" };
    const rango = rangosPorSensor[sensor.id];
    const mediciones = medicionesPorSensor[sensor.id] || [];

    // Últimas 50
    const ultimas = mediciones.slice(0, 50).sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));

    const labels = ultimas.map(m => {
        const d = new Date(m.fecha_hora);
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    });
    const valores = ultimas.map(m => m.valor);

    // Actualizar título
    const titulo = document.getElementById("titulo-grafico-sensor");
    if (titulo) titulo.textContent = `Evolución de ${tipo.nombre}`;

    // Leyenda
    const leyenda = document.getElementById("leyenda-rango-sensor");
    if (leyenda && rango) {
        leyenda.textContent = `Rango (${rango.valor_min} - ${rango.valor_max})`;
    }

    if (window.graficoSensorConfig) window.graficoSensorConfig.destroy();

    // Calcular min/max para el gráfico
    let yMin = 0, yMax = 10;
    if (rango) {
        const rangoTam = rango.valor_max - rango.valor_min;
        yMin = rango.valor_min - rangoTam * 0.3;
        yMax = rango.valor_max + rangoTam * 0.3;
    } else if (valores.length > 0) {
        const minVal = Math.min(...valores);
        const maxVal = Math.max(...valores);
        const tam = maxVal - minVal || 1;
        yMin = minVal - tam * 0.2;
        yMax = maxVal + tam * 0.2;
    }

    window.graficoSensorConfig = new Chart(canvas.getContext("2d"), {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                data: valores,
                borderColor: "#15803D",
                backgroundColor: "rgba(21, 128, 61, 0.1)",
                fill: true,
                tension: 0.4,
                pointRadius: 2,
                pointHoverRadius: 5,
                pointBackgroundColor: "#15803D",
                pointBorderColor: "#fff",
                pointBorderWidth: 1.5,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "#0F3B26",
                    padding: 8,
                    cornerRadius: 6,
                    displayColors: false,
                    callbacks: { label: (c) => `${tipo.nombre}: ${c.parsed.y.toFixed(2)}` },
                },
            },
            scales: {
                y: {
                    min: yMin,
                    max: yMax,
                    ticks: { color: "#9CA3AF", font: { size: 9 }, callback: v => v.toFixed(1) },
                    grid: { color: "#F3F4F6" },
                },
                x: {
                    ticks: { color: "#9CA3AF", font: { size: 9 }, maxTicksLimit: 6 },
                    grid: { display: false },
                },
            },
        },
        plugins: rango ? [{
            id: "rangoPermitido",
            beforeDatasetsDraw: (chart) => {
                const { ctx, chartArea, scales } = chart;
                const yMinPx = scales.y.getPixelForValue(rango.valor_min);
                const yMaxPx = scales.y.getPixelForValue(rango.valor_max);
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
        }] : [],
    });
}

// ---------- Configurar form ----------
function configurarFormulario() {
    // No hace falta nada extra, el form se renderiza dinámicamente
}

// ---------- Iniciar ----------
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", cargarConfiguracion);
} else {
    cargarConfiguracion();
}