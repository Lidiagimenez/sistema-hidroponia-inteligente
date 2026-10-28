// ============================================================
// dashboard.js — Carga dinámica del Dashboard con selector
// ============================================================

let todosLosCultivos = [];
let cultivoActivo = null;
// Alimenta solo el contador de "Alertas activas" (la tarjeta lateral se retiró del HTML)
let alertasActivas = [];
let mediciones = [];
let sensoresMap = {};
let agrupadas = {};
let listaSensoresFull = [];
let listaTiposSensor = [];
// Rangos de operación reales por sensor (API /rangos-operacion/)
// sensor_id -> { valor_min, valor_max, vigente_desde }
let rangosPorSensor = {};
let tipoGraficoActual = "ph";

// Duración por defecto si el ciclo no tiene fecha_fin_estimada
const DURACION_DEFAULT_DIAS = 28;

// Ventana de datos del gráfico: últimas 24 horas, con tope de 50 puntos
const VENTANA_HORAS = 24;
const MAX_PUNTOS_GRAFICO = 50;


// ---------- Cargar todo ----------
async function cargarDashboard() {
    try {
        await Promise.all([
            cargarCultivos(),
            cargarSensoresYMediciones(),
            cargarAlertas(),
            cargarRangosOperacion(),
        ]);

        if (todosLosCultivos.length > 0) {
            cultivoActivo = todosLosCultivos[0];
        }

        renderTodo();
        // La imagen es independiente del gráfico: queda el placeholder mientras llega
        cargarImagenReciente();

        // Tiempo real: indicador "en vivo" + refresh automático cada 30 s.
        iniciarIndicadorEnVivo();
        iniciarPolling(refrescarDashboard);
    } catch (err) {
        console.error(err);
    }
}

/**
 * Refresh automático (polling cada 30 s, gestionado por tiempo-real.js).
 */
async function refrescarDashboard() {
    await Promise.all([
        cargarSensoresYMediciones(),
        cargarAlertas(),
    ]);

    renderTarjetas();
    renderGrafico(tipoGraficoActual);
}

// ---------- Cultivos ----------
async function cargarCultivos() {
    const resp = await apiGet("/cultivos/");
    todosLosCultivos = Array.isArray(resp) ? resp : (resp.results || []);
}

// ---------- Sensores y mediciones ----------
async function cargarSensoresYMediciones() {
    const respSensores = await apiGet("/sensores/");
    if (respSensores === null) throw new Error("No se pudo obtener /sensores/ (sesión expirada o API caída)");
    listaSensoresFull = Array.isArray(respSensores) ? respSensores : (respSensores.results || []);

    const respTipos = await apiGet("/tipos-sensor/");
    if (respTipos === null) throw new Error("No se pudo obtener /tipos-sensor/ (sesión expirada o API caída)");
    listaTiposSensor = Array.isArray(respTipos) ? respTipos : (respTipos.results || []);
    const mapaTipos = {};
    listaTiposSensor.forEach(t => { mapaTipos[t.id] = t; });

    sensoresMap = {};
    listaSensoresFull.forEach(s => {
        const tipo = mapaTipos[s.tipo_sensor];
        if (tipo) {
            sensoresMap[s.id] = {
                tipo_nombre: tipo.nombre,
                unidad: tipo.unidad_medida,
                es_simulado: s.es_simulado || (s.dispositivo && s.dispositivo.es_simulado) || false,
                dispositivo_nombre: s.dispositivo_nombre || "",
            };
        }
    });

    const respMed = await apiGet("/mediciones/");
    if (respMed === null) throw new Error("No se pudo obtener /mediciones/ (sesión expirada o API caída)");
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

// ---------- Rangos de operación (parámetro dinámico del gráfico) ----------
async function cargarRangosOperacion() {
    rangosPorSensor = {};
    try {
        const resp = await apiGet("/rangos-operacion/");
        const lista = Array.isArray(resp) ? resp : (resp.results || []);
        lista.forEach(r => {
            const actual = rangosPorSensor[r.sensor];
            if (!actual || new Date(r.vigente_desde) > new Date(actual.vigente_desde)) {
                rangosPorSensor[r.sensor] = r;
            }
        });
    } catch (err) {
        console.warn("No se pudieron cargar los rangos de operación:", err);
    }
}

function obtenerRangoVigente(tipo) {
    const ultima = agrupadas[tipo]?.[0];
    if (ultima && rangosPorSensor[ultima.sensor]) {
        return rangosPorSensor[ultima.sensor];
    }

    const sensoresTipo = listaSensoresFull.filter(
        s => (s.tipo_sensor_nombre || "").toLowerCase() === tipo
    );
    const delCultivo = cultivoActivo
        ? sensoresTipo.filter(s =>
            (s.cultivos_detalle || []).some(c => c.id_cultivo === cultivoActivo.id_cultivo))
        : [];

    for (const sensor of [...delCultivo, ...sensoresTipo]) {
        if (rangosPorSensor[sensor.id]) return rangosPorSensor[sensor.id];
    }
    return null;
}

function actualizarLeyendaRango(rango) {
    const leyenda = document.getElementById("leyenda-rango");
    if (!leyenda) return;
    leyenda.textContent = rango
        ? `Rango permitido (${rango.valor_min} - ${rango.valor_max})`
        : "Sin rango configurado";
}

// ---------- Alertas ----------
async function cargarAlertas() {
    const resp = await apiGet("/alertas/");
    if (resp === null) throw new Error("No se pudo obtener /alertas/ (sesión expirada o API caída)");
    const todas = Array.isArray(resp) ? resp : (resp.results || []);
    alertasActivas = todas.filter(a => a.estado === "activa");
}

// ---------- Helpers del ciclo ----------
function obtenerFechaInicio(cultivo) {
    if (cultivo?.ciclo_activo?.fecha_inicio) {
        return new Date(cultivo.ciclo_activo.fecha_inicio);
    }
    return new Date(cultivo?.fecha_creacion || new Date());
}

function obtenerDuracionCiclo(cultivo) {
    const ciclo = cultivo?.ciclo_activo;
    if (!ciclo?.fecha_fin_estimada || !ciclo?.fecha_inicio) {
        return DURACION_DEFAULT_DIAS;
    }
    const dias = Math.floor(
        (new Date(ciclo.fecha_fin_estimada) - new Date(ciclo.fecha_inicio))
        / (1000 * 60 * 60 * 24)
    );
    return Math.max(1, dias);
}

function obtenerDiasTranscurridos(cultivo) {
    if (!cultivo) return 0;
    const inicio = obtenerFechaInicio(cultivo);
    const hoy = new Date();
    return Math.max(0, Math.floor((hoy - inicio) / (1000 * 60 * 60 * 24)));
}


// ---------- Render de todo ----------
function renderTodo() {
    renderBanner();
    renderTarjetas();
    renderSelectorGrafico();
    renderGrafico(tipoGraficoActual);
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

    const dias = obtenerDiasTranscurridos(cultivoActivo);
    const totalDias = obtenerDuracionCiclo(cultivoActivo);

    const etapa = cultivoActivo.ciclo_activo?.estado
        ? capitalizar(cultivoActivo.ciclo_activo.estado)
        : (dias < 7 ? "Germinación" : dias < 21 ? "Crecimiento" : "Cosecha");

    const atraso = dias - totalDias;
    const esUltimoDia = dias === totalDias;
    const estaAtrasado = dias > totalDias;

    const opciones = todosLosCultivos.map(c => `
        <option value="${c.id_cultivo}" ${c.id_cultivo === cultivoActivo.id_cultivo ? "selected" : ""}>
            ${escapeHtml(c.nombre)}
        </option>
    `).join("");

    cont.innerHTML = `
        <div class="relative bg-gradient-to-r from-green-50 via-white to-green-50/30 rounded-2xl overflow-hidden border border-green-100">
            <div class="p-6">
                <div class="flex items-center justify-between gap-5 flex-wrap">
                    <div class="flex items-center gap-5">
                        <div class="w-14 h-14 bg-brand-light rounded-2xl flex items-center justify-center flex-shrink-0">
                            <i data-lucide="sprout" class="w-7 h-7 text-brand"></i>
                        </div>
                        <div>
                            <p class="text-xs text-gray-500 font-medium mb-0.5">Cultivo activo</p>
                            <h2 class="font-serif text-3xl font-bold text-gray-900 leading-tight">${escapeHtml(cultivoActivo.nombre)}</h2>
                            <div class="flex items-center gap-3 mt-1 text-sm text-gray-600 flex-wrap">
                                <span>Etapa: <span class="font-semibold text-gray-800">${etapa}</span></span>
                                <span class="text-gray-300">|</span>
                                <span class="flex items-center gap-1">
                                    <i data-lucide="calendar" class="w-3.5 h-3.5"></i>
                                    Día <span class="font-semibold">${dias}</span> de <span class="font-semibold">${totalDias}</span>
                                    ${estaAtrasado ? `<span class="ml-1.5 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">+${atraso} días de atraso</span>` : ""}
                                    ${esUltimoDia ? `<span class="ml-1.5 text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">Último día</span>` : ""}
                                </span>
                            </div>
                        </div>
                    </div>

                    <span class="inline-flex items-center gap-2 bg-green-100 text-green-800 text-sm font-semibold px-4 py-1.5 rounded-full">
                        <span class="w-2 h-2 bg-green-600 rounded-full"></span>
                        Normal
                    </span>
                </div>

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
                cargarImagenReciente();
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

    const ultCond = agrupadas["conductividad"]?.[0];
    const rangoCond = obtenerRangoVigente("conductividad");
    const tipoCond = listaTiposSensor.find(t => (t.nombre || "").toLowerCase() === "conductividad");
    const unidadCond = tipoCond?.unidad_medida || "";
    let valorCond = "—";
    let estadoCond = "Sin datos";
    let condColor = "text-gray-500";
    
    if (ultCond !== undefined && ultCond.valor !== undefined && ultCond.valor !== null) {
        // El valor se muestra tal como lo manda el sensor (ya no divide por 1000)
        valorCond = Number(ultCond.valor).toFixed(0);
        if (!rangoCond) {
            estadoCond = "Sin rango";
            condColor = "text-gray-500";
        } else if (ultCond.valor < rangoCond.valor_min) {
            estadoCond = "Bajo";
            condColor = "text-amber-600";
        } else if (ultCond.valor > rangoCond.valor_max) {
            estadoCond = "Alto";
            condColor = "text-red-600";
        } else {
            estadoCond = "OK";
            condColor = "text-emerald-600";
        }
    }

    const haySimulados = listaSensoresFull.some(s => s.es_simulado);
    const hayReales = listaSensoresFull.some(s => !s.es_simulado);

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
                    ${listaSensoresFull.length > 0 ? `<div class="flex items-center gap-1 mt-1">
                        ${hayReales ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">Real</span>` : ""}
                        ${haySimulados ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700">Simulado</span>` : ""}
                    </div>` : ""}
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
                <div class="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <i data-lucide="activity" class="w-6 h-6 text-teal-600"></i>
                </div>
                <div>
                    <p class="text-xs text-gray-500 mb-0.5">Conductividad</p>
                    <p class="text-2xl font-bold text-gray-900">${valorCond} <span class="text-gray-400 text-sm font-medium">${escapeHtml(unidadCond)}</span></p>
                    <p class="text-[11px] font-semibold ${condColor} mt-0.5">${estadoCond}</p>
                </div>
            </div>
        </div>
    `;
    lucide.createIcons();
}

// ---------- Selector gráfico ----------
function tituloEvolucion(tipoNombre, modoFallback = false) {
    const base = tipoNombre ? `Evolución de ${tipoNombre}` : "Evolución";
    const sufijo = modoFallback
        ? `Últimas ${MAX_PUNTOS_GRAFICO} mediciones`
        : `Últimas ${VENTANA_HORAS} hs`;
    return `${base} (${sufijo})`;
}

function renderSelectorGrafico() {
    const select = document.getElementById("selector-tipo-grafico");
    const titulo = document.getElementById("titulo-grafico-dashboard");
    if (!select) return;

    const opciones = (listaTiposSensor.length ? listaTiposSensor : [{nombre: "ph"}])
        .map(t => {
            const nombre = (t.nombre || "").toLowerCase();
            return `<option value="${escapeHtml(nombre)}">${escapeHtml(t.nombre)}</option>`;
        }).join("");

    select.innerHTML = opciones;
    if (tipoGraficoActual && !Array.from(select.options).some(o => o.value === tipoGraficoActual)) {
        tipoGraficoActual = "ph";
    }
    select.value = tipoGraficoActual;

    if (titulo) {
        const tipo = listaTiposSensor.find(t => (t.nombre || "").toLowerCase() === tipoGraficoActual);
        titulo.textContent = tituloEvolucion(tipo?.nombre);
    }

    select.onchange = () => {
        tipoGraficoActual = select.value || "ph";
        renderGrafico(tipoGraficoActual);
        if (titulo) {
            const tipo = listaTiposSensor.find(t => (t.nombre || "").toLowerCase() === tipoGraficoActual);
            titulo.textContent = tituloEvolucion(tipo?.nombre);
        }
    };
}

// ---------- Gráfico ----------
function renderGrafico(tipo = tipoGraficoActual) {
    tipoGraficoActual = tipo;
    const canvas = document.getElementById("chart-ph");
    if (!canvas) return;

    const medicionesTipo = agrupadas[tipo] || [];

    const limiteVentana = Date.now() - VENTANA_HORAS * 60 * 60 * 1000;
    let filtradas = [...medicionesTipo]
        .filter(m => new Date(m.fecha_hora).getTime() >= limiteVentana)
        .sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora))
        .slice(-MAX_PUNTOS_GRAFICO);

    let modoFallback = false;
    if (filtradas.length === 0 && medicionesTipo.length > 0) {
        modoFallback = true;
        filtradas = [...medicionesTipo]
            .sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora))
            .slice(-MAX_PUNTOS_GRAFICO);
    }

    const tituloEl = document.getElementById("titulo-grafico-dashboard");
    if (tituloEl) {
        const tipoInfo = listaTiposSensor.find(t => (t.nombre || "").toLowerCase() === tipo);
        tituloEl.textContent = tituloEvolucion(tipoInfo?.nombre, modoFallback);
    }

    const cruzaDias = new Set(filtradas.map(m => new Date(m.fecha_hora).toDateString())).size > 1;
    const labels = filtradas.map(m => {
        const d = new Date(m.fecha_hora);
        const hh = String(d.getHours()).padStart(2, "0");
        const mm = String(d.getMinutes()).padStart(2, "0");
        if (!cruzaDias) return `${hh}:${mm}`;
        return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${hh}:${mm}`;
    });
    const valores = filtradas.map(m => m.valor);

    const rango = obtenerRangoVigente(tipo);

    if (labels.length === 0 && window.graficoDashboard && window.graficoDashboard.__tipo === tipo) {
        return;
    }

    actualizarLeyendaRango(rango);

    const apoyosY = [];
    if (rango) {
        apoyosY.push(rango.valor_min, rango.valor_max);
    }
    valores.forEach(v => { if (Number.isFinite(v)) apoyosY.push(v); });
    if (apoyosY.length === 0) {
        apoyosY.push(5.5, 6.5); 
    }
    const lo = Math.min(...apoyosY);
    const hi = Math.max(...apoyosY);
    const pad = (hi - lo) * 0.1 || 1;
    const yMin = lo - pad;
    const yMax = hi + pad;

    const datasets = [{
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
    }];

    if (rango) {
        const estiloLineaRango = {
            borderColor: "#9CA3AF",
            borderDash: [6, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            pointHitRadius: 0,
            fill: false,
            tension: 0,
        };
        datasets.push(
            { label: "Rango mínimo", data: filtradas.map(() => rango.valor_min), ...estiloLineaRango },
            { label: "Rango máximo", data: filtradas.map(() => rango.valor_max), ...estiloLineaRango },
        );
    }

    if (window.graficoDashboard && window.graficoDashboard.__tipo === tipo) {
        window.graficoDashboard.data.labels = labels;
        window.graficoDashboard.data.datasets = datasets;
        window.graficoDashboard.options.scales.y.min = yMin;
        window.graficoDashboard.options.scales.y.max = yMax;
        window.graficoDashboard.update();
        return;
    }

    if (window.graficoDashboard) window.graficoDashboard.destroy();

    window.graficoDashboard = new Chart(canvas.getContext("2d"), {
        type: "line",
        data: {
            labels: labels,
            datasets: datasets,
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "nearest", axis: "x", intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "#0F3B26",
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: false,
                    filter: (item) => item.datasetIndex === 0,
                    callbacks: {
                        label: (c) => {
                            const tipoInfo = listaTiposSensor.find(
                                t => (t.nombre || "").toLowerCase() === tipo
                            );
                            const unidad = tipoInfo?.unidad_medida || "";
                            const valor = c.parsed.y;
                            const texto = Number.isInteger(valor) ? valor.toFixed(0) : valor.toFixed(2);
                            return unidad ? `${tipo}: ${texto} ${unidad}` : `${tipo}: ${texto}`;
                        },
                    },
                },
            },
            scales: {
                y: {
                    min: yMin,
                    max: yMax,
                    ticks: {
                        color: "#9CA3AF",
                        font: { size: 11 },
                        callback: v => Number.isInteger(v) ? String(v) : v.toFixed(1),
                    },
                    grid: { color: "#F3F4F6" },
                },
                x: {
                    ticks: { color: "#9CA3AF", font: { size: 11 }, maxTicksLimit: 8 },
                    grid: { display: false },
                },
            },
        },
    });

    window.graficoDashboard.__tipo = tipo;
}

// ---------- Última imagen del cultivo (API /imagenes/) ----------
function mediaUrl(valor) {
    if (!valor) return "";
    const url = String(valor).trim();
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith("//")) return "";
    return url.startsWith("/") ? url : `/${url}`;
}

async function cargarImagenReciente() {
    const cont = document.getElementById("ultima-imagen");
    if (!cont) return;
    const pie = document.getElementById("ultima-imagen-detalle");
    const cultivoId = cultivoActivo?.id_cultivo;
    if (!cultivoId) return;

    let ultima = null;
    try {
        const resp = await apiGet(`/imagenes/?cultivo=${cultivoId}`);
        const lista = Array.isArray(resp) ? resp : (resp.results || []);
        ultima = lista[0] || null;
    } catch (err) {
        console.error("No se pudo cargar la última imagen del cultivo:", err);
    }

    const url = ultima ? mediaUrl(ultima.archivo_url || ultima.archivo || "") : "";
    if (ultima && url) {
        cont.innerHTML = `
            <img src="${escapeHtml(url)}"
                 alt="${escapeHtml(ultima.cultivo_nombre || "Cultivo")}"
                 class="w-full h-full object-cover">
        `;
        if (pie) {
            pie.textContent = ultima.fecha_hora
                ? `Última foto: ${formatearFechaHora(ultima.fecha_hora)}`
                : "Imagen disponible";
        }
        return;
    }

    cont.innerHTML = `
        <i data-lucide="camera" class="w-12 h-12 text-gray-300 mb-2"></i>
        <p class="text-xs text-gray-400 px-3">Sin imagen disponible</p>
    `;
    if (pie) pie.textContent = "Sin imágenes todavía";
    lucide.createIcons();
}

// ---------- Utilidades ----------
function escapeHtml(text) {
    if (text == null) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function capitalizar(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}


// ---------- Iniciar ----------
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", cargarDashboard);
} else {
    cargarDashboard();
}