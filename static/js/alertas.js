// ============================================================
// alertas.js — Carga dinámica, tabs, filtros y acordeón
// ============================================================

let alertasCargadas = [];
let alertasFiltradas = [];
let alertaSeleccionada = null;
let alertaExpandidaId = null;

let tabActivoAlertas = "todas";
let filtroCultivo = "";
let filtroOrigen = "";
let filtroBusqueda = "";

const SEVERIDAD_ESTILOS = {
    "alta": {
        bg: "bg-red-50", border: "border-red-200", iconBg: "bg-red-100",
        iconColor: "text-red-600", text: "text-red-700",
        badgeBg: "bg-red-100", badgeText: "text-red-700",
        label: "Crítica", icono: "alert-triangle",
    },
    "media": {
        bg: "bg-orange-50", border: "border-orange-200", iconBg: "bg-orange-100",
        iconColor: "text-orange-600", text: "text-orange-700",
        badgeBg: "bg-orange-100", badgeText: "text-orange-700",
        label: "Advertencia", icono: "alert-circle",
    },
    "baja": {
        bg: "bg-blue-50", border: "border-blue-200", iconBg: "bg-blue-100",
        iconColor: "text-blue-600", text: "text-blue-700",
        badgeBg: "bg-blue-100", badgeText: "text-blue-700",
        label: "Info", icono: "info",
    },
};

// ---------- Cargar alertas ----------
async function cargarAlertas() {
    const contenedor = document.getElementById("lista-alertas");
    if (!contenedor) return; // Protección contra HTML roto

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

        await cargarCultivosEnSelect();
        actualizarContadores(alertasCargadas);
        aplicarFiltrosYRenderizar();

    } catch (err) {
        console.error(err);
        if (contenedor) {
            contenedor.innerHTML = `
                <div class="bg-red-50 border border-red-200 text-red-700 text-sm p-4 rounded-xl">
                    Error al cargar alertas: ${err.message}
                </div>
            `;
        }
    }
}

async function cargarCultivosEnSelect() {
    const select = document.getElementById("filtro-cultivo");
    if (!select || select.options.length > 1) return;

    try {
        const resp = await apiGet("/cultivos/");
        const cultivos = Array.isArray(resp) ? resp : (resp.results || []);

        cultivos.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.id_cultivo || c.id; // Fallback por si la API cambia
            opt.textContent = c.nombre;
            select.appendChild(opt);
        });
    } catch (e) {
        console.error("Error al cargar cultivos en select:", e);
    }
}

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
}

// ============================================================
// APLICAR FILTROS
// ============================================================

function aplicarFiltros() {
    let resultado = [...alertasCargadas];

    switch (tabActivoAlertas) {
        case "criticas":
            resultado = resultado.filter(a => a.severidad === "alta" && a.estado === "activa"); break;
        case "advertencias":
            resultado = resultado.filter(a => a.severidad === "media" && a.estado === "activa"); break;
        case "informativas":
            resultado = resultado.filter(a => a.severidad === "baja" && a.estado === "activa"); break;
        case "resueltas":
            resultado = resultado.filter(a => a.estado === "resuelta"); break;
    }

    if (filtroOrigen === "medicion") {
        resultado = resultado.filter(a => a.medicion);
    } else if (filtroOrigen === "evento") {
        resultado = resultado.filter(a => a.evento);
    }

    if (filtroCultivo) {
        const idCultivo = parseInt(filtroCultivo);
        resultado = resultado.filter(a => {
            if (a.evento && a.evento_cultivo) return a.evento_cultivo === idCultivo;
            return true;
        });
    }

    if (filtroBusqueda) {
        const q = filtroBusqueda.toLowerCase();
        resultado = resultado.filter(a => {
            const titulo = generarTitulo(a).toLowerCase();
            const origen = generarOrigen(a).toLowerCase();
            return titulo.includes(q) || origen.includes(q);
        });
    }

    return resultado;
}

// ============================================================
// RENDER
// ============================================================

function aplicarFiltrosYRenderizar() {
    alertasFiltradas = aplicarFiltros();
    const contenedor = document.getElementById("lista-alertas");
    if (!contenedor) return; // Protección

    if (alertasFiltradas.length === 0) {
        contenedor.innerHTML = `
            <div class="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                <i data-lucide="bell-off" class="w-10 h-10 text-gray-300 mx-auto mb-2"></i>
                <p class="text-sm text-gray-500">No hay alertas que coincidan con los filtros.</p>
            </div>
        `;
        lucide.createIcons();
        alertaSeleccionada = null;
        alertaExpandidaId = null;
        return;
    }

    renderListaAlertas(alertasFiltradas);
}

function renderListaAlertas(alertas) {
    const contenedor = document.getElementById("lista-alertas");
    if (!contenedor) return; // Protección

    contenedor.innerHTML = alertas.map(a => {
        const est = SEVERIDAD_ESTILOS[a.severidad] || SEVERIDAD_ESTILOS.baja;
        const esSeleccionada = alertaSeleccionada && alertaSeleccionada.id === a.id;
        const resuelta = a.estado === "resuelta";
        const expandida = alertaExpandidaId === a.id;

        let clases = `${est.bg} rounded-2xl border ${est.border} p-4 cursor-pointer hover:shadow-md transition`;
        if (esSeleccionada) clases += " ring-2 ring-offset-2 ring-brand";
        if (resuelta) {
            clases = "bg-green-50 rounded-2xl border border-green-200 p-4 cursor-pointer hover:shadow-md transition opacity-75";
            if (esSeleccionada) clases += " ring-2 ring-offset-2 ring-brand";
        }

        const iconoBg = resuelta ? "bg-green-100" : est.iconBg;
        const iconoColor = resuelta ? "text-green-600" : est.iconColor;
        const iconoNombre = resuelta ? "check-circle" : est.icono;
        const titulo = generarTitulo(a);

        const badge = resuelta
            ? `<span class="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full whitespace-nowrap">✓ Resuelta</span>`
            : `<span class="text-[10px] font-bold ${est.badgeText} ${est.badgeBg} px-2 py-0.5 rounded-full whitespace-nowrap">${est.label}</span>`;

        return `
            <div class="mb-3">
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
                        <div class="flex-shrink-0">
                            <i data-lucide="chevron-down" class="w-5 h-5 text-gray-400 transition-transform ${expandida ? 'rotate-180' : ''}"></i>
                        </div>
                    </div>
                </div>
                ${expandida ? `<div id="detalle-accordion-${a.id}" class="mt-2"></div>` : ""}
            </div>
        `;
    }).join("");

    document.querySelectorAll("[data-alerta-id]").forEach(card => {
        card.addEventListener("click", () => {
            const id = parseInt(card.dataset.alertaId);
            const alerta = alertasFiltradas.find(a => a.id === id);
            if (alerta) seleccionarAlertaAccordion(alerta);
        });
    });

    lucide.createIcons();

    if (alertaExpandidaId !== null) {
        const alertaExp = alertasFiltradas.find(a => a.id === alertaExpandidaId);
        if (alertaExp) {
            const contAcordeon = document.getElementById(`detalle-accordion-${alertaExp.id}`);
            if (contAcordeon) renderDetalleAccordion(alertaExp, contAcordeon);
        } else {
            alertaExpandidaId = null;
        }
    }
}

// ============================================================
// DIAGNÓSTICO INTELIGENTE (Predicción IA + última imagen)
// ============================================================

let cultivosCacheAlertas = null;

function mediaUrlImagen(valor) {
    if (!valor) return "";
    const url = String(valor).trim();
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith("//")) return "";
    return url.startsWith("/") ? url : `/${url}`;
}

async function obtenerCultivosCache() {
    if (cultivosCacheAlertas) return cultivosCacheAlertas;
    try {
        const resp = await apiGet("/cultivos/");
        cultivosCacheAlertas = Array.isArray(resp) ? resp : (resp.results || []);
    } catch (err) {
        console.error("No se pudieron cargar los cultivos para el diagnóstico:", err);
        cultivosCacheAlertas = [];
    }
    return cultivosCacheAlertas;
}

async function obtenerCultivoIdAlerta(alerta) {
    const directo = alerta?.medicion_detalle?.cultivo_id
        ?? alerta?.evento_cultivo
        ?? alerta?.evento_detalle?.cultivo_id
        ?? null;
    if (directo) return directo;

    // Las alertas por evento solo traen el nombre del cultivo: lo resolvemos contra /cultivos/.
    const nombre = alerta?.evento_detalle?.cultivo;
    if (!nombre) return null;

    const cultivos = await obtenerCultivosCache();
    const buscado = String(nombre).trim().toLowerCase();
    const match = cultivos.find(c => String(c.nombre || "").trim().toLowerCase() === buscado);
    return match ? (match.id_cultivo ?? match.id) : null;
}

function seccionDiagnosticoIA(alerta) {
    return `
        <div id="diagnostico-ia-${alerta.id}" class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 mb-4">
            <div class="flex items-center gap-3 mb-3">
                <div class="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <i data-lucide="brain-circuit" class="w-5 h-5 text-blue-600"></i>
                </div>
                <div class="min-w-0">
                    <p class="text-sm font-semibold text-gray-900">Diagnóstico Inteligente</p>
                    <p class="text-[11px] text-gray-500">Predicción IA del sensor y última imagen del cultivo</p>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div class="bg-white/80 border border-blue-100 rounded-xl p-3">
                    <div class="flex items-center gap-2 mb-2">
                        <i data-lucide="sparkles" class="w-4 h-4 text-blue-600"></i>
                        <p class="text-xs font-semibold text-gray-700">Predicción IA</p>
                    </div>
                    <div id="diag-prediccion-${alerta.id}" class="text-xs text-gray-400 flex items-center gap-2 py-4 justify-center">
                        <i data-lucide="loader" class="w-4 h-4 animate-spin"></i>
                        Analizando datos del sensor...
                    </div>
                </div>

                <div class="bg-white/80 border border-blue-100 rounded-xl p-3">
                    <div class="flex items-center gap-2 mb-2">
                        <i data-lucide="camera" class="w-4 h-4 text-blue-600"></i>
                        <p class="text-xs font-semibold text-gray-700">Última imagen del cultivo</p>
                    </div>
                    <div id="diag-imagen-${alerta.id}" class="w-full h-40 rounded-xl overflow-hidden bg-gray-100 flex flex-col items-center justify-center text-center">
                        <i data-lucide="loader" class="w-6 h-6 text-gray-300 mb-2 animate-spin"></i>
                        <p class="text-xs text-gray-400">Cargando imagen...</p>
                    </div>
                    <p id="diag-imagen-detalle-${alerta.id}" class="text-[11px] text-gray-500 mt-1.5">—</p>
                </div>
            </div>
        </div>
    `;
}

function renderPrediccionDiag(contenedor, sensorId, resultado) {
    if (!contenedor) return;

    if (!sensorId) {
        contenedor.innerHTML = `
            <div class="flex items-start gap-2 text-gray-500">
                <i data-lucide="info" class="w-4 h-4 flex-shrink-0 mt-0.5"></i>
                <p class="text-xs leading-relaxed">Esta alerta proviene de un evento, por lo que no tiene un sensor asociado para predecir.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    if (resultado.status !== "fulfilled" || !resultado.value || resultado.value.detail) {
        contenedor.innerHTML = `
            <div class="flex items-start gap-2 text-gray-500">
                <i data-lucide="database" class="w-4 h-4 flex-shrink-0 mt-0.5"></i>
                <p class="text-xs leading-relaxed">Sin datos históricos suficientes para generar una predicción de este sensor.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    const p = resultado.value;
    const tendencias = {
        subiendo: { icono: "trending-up", clase: "bg-orange-100 text-orange-700", label: "Subiendo" },
        bajando:  { icono: "trending-down", clase: "bg-blue-100 text-blue-700", label: "Bajando" },
        estable:  { icono: "minus", clase: "bg-green-100 text-green-700", label: "Estable" },
    };
    const tend = tendencias[p.tendencia] || tendencias.estable;

    contenedor.innerHTML = `
        <div class="flex items-center justify-between gap-2 mb-2">
            <p class="text-sm font-semibold text-gray-900 truncate">${escapeHtml(p.tipo_sensor || "Sensor")}</p>
            <span class="inline-flex items-center gap-1 ${tend.clase} text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                <i data-lucide="${tend.icono}" class="w-3 h-3"></i>
                ${tend.label}
            </span>
        </div>
        <div class="flex items-center gap-2 text-xs text-gray-600">
            <span>Actual <strong class="text-gray-900">${escapeHtml(p.valor_actual)}</strong></span>
            <i data-lucide="arrow-right" class="w-3 h-3 text-gray-400"></i>
            <span>Predicción <strong class="text-blue-700">${escapeHtml(p.prediccion)}</strong></span>
        </div>
        <p class="text-[11px] text-gray-500 mt-2 leading-relaxed">${escapeHtml(p.mensaje || "")}</p>
        ${p.usado_fallback ? `<p class="text-[10px] text-gray-400 mt-1">Estimación por media móvil (modelo en entrenamiento).</p>` : ""}
    `;
    lucide.createIcons();
}

function renderImagenDiag(contenedor, detalle, cultivoId, resultado) {
    if (!contenedor) return;

    let lista = [];
    if (resultado.status === "fulfilled" && resultado.value) {
        lista = Array.isArray(resultado.value) ? resultado.value : (resultado.value.results || []);
    }
    const ultima = lista[0] || null;
    const url = ultima ? mediaUrlImagen(ultima.archivo_url || ultima.archivo) : "";

    if (!ultima || !url) {
        contenedor.innerHTML = `
            <i data-lucide="camera-off" class="w-10 h-10 text-gray-300 mb-2"></i>
            <p class="text-xs text-gray-400 px-3">Sin imagen disponible</p>
        `;
        if (detalle) {
            detalle.textContent = cultivoId ? "Sin imágenes todavía" : "Cultivo no identificado";
        }
        lucide.createIcons();
        return;
    }

    contenedor.innerHTML = `
        <img src="${escapeHtml(url)}"
             alt="${escapeHtml(ultima.cultivo_nombre || "Cultivo")}"
             class="w-full h-full object-cover"
             loading="lazy">
    `;
    if (detalle) {
        detalle.textContent = ultima.fecha_hora
            ? `Última foto: ${formatearFechaHora(ultima.fecha_hora)}`
            : (ultima.cultivo_nombre || "Imagen disponible");
    }
}

async function cargarDiagnosticoIA(alerta) {
    const contPred = document.getElementById(`diag-prediccion-${alerta.id}`);
    const contImg = document.getElementById(`diag-imagen-${alerta.id}`);
    const detalleImg = document.getElementById(`diag-imagen-detalle-${alerta.id}`);
    if (!contPred && !contImg) return;

    const sensorId = alerta?.medicion_detalle?.sensor_id ?? null;
    const cultivoId = await obtenerCultivoIdAlerta(alerta);

    const predPromesa = sensorId
        ? apiGet(`/predicciones/?sensor=${sensorId}`)
        : Promise.reject(new Error("Sin sensor asociado"));

    const imgPromesa = cultivoId
        ? apiGet(`/imagenes/?cultivo=${cultivoId}`)
        : Promise.reject(new Error("Sin cultivo asociado"));

    const [predResultado, imgResultado] = await Promise.allSettled([predPromesa, imgPromesa]);

    renderPrediccionDiag(contPred, sensorId, predResultado);
    renderImagenDiag(contImg, detalleImg, cultivoId, imgResultado);
}

// ============================================================
// HELPERS
// ============================================================

function generarTitulo(alerta) {
    return alerta.titulo_descriptivo || "Alerta";
}

function generarOrigen(alerta) {
    if (alerta.medicion_detalle) {
        const d = alerta.medicion_detalle;
        const partes = [`Sensor: ${d.sensor_nombre}`];
        if (d.rango_min !== null && d.rango_max !== null) {
            partes.push(`Valor: ${d.valor} ${d.unidad || ""} (rango: ${d.rango_min} - ${d.rango_max})`);
        } else {
            partes.push(`Valor: ${d.valor} ${d.unidad || ""}`);
        }
        return partes.join(" · ");
    }
    if (alerta.evento_detalle) {
        const d = alerta.evento_detalle;
        const partes = [d.tipo_display];
        if (d.dispositivo) partes.push(d.dispositivo);
        if (d.descripcion) partes.push(d.descripcion);
        return partes.join(" · ");
    }
    return "Origen desconocido";
}

function seleccionarAlertaAccordion(alerta) {
    alertaSeleccionada = alerta;
    alertaExpandidaId = (alertaExpandidaId === alerta.id) ? null : alerta.id;
    renderListaAlertas(alertasFiltradas);
}

// ============================================================
// DETALLE
// ============================================================

function renderDetalleAccordion(alerta, contenedor) {
    const est = SEVERIDAD_ESTILOS[alerta.severidad] || SEVERIDAD_ESTILOS.baja;
    const resuelta = alerta.estado === "resuelta";

    const estilos = resuelta ? {
        bg: "bg-green-100", iconColor: "text-green-600",
        badgeBg: "bg-green-100", badgeText: "text-green-700",
        label: "Resuelta", icono: "check-circle",
    } : est;

    const titulo = generarTitulo(alerta);
    const duracion = calcularDuracion(alerta.fecha_hora_inicio, alerta.fecha_hora_fin);

    contenedor.innerHTML = `
        <div class="bg-white rounded-2xl border border-gray-200 p-5">
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

            ${alerta.medicion_detalle ? `
            <div class="bg-gray-50 rounded-xl p-3 mb-4 border border-gray-100">
                <p class="text-xs font-semibold text-gray-700 mb-2">📊 Detalle de la medición</p>
                <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                        <p class="text-xs text-gray-500">Sensor</p>
                        <p class="font-medium text-gray-900">${escapeHtml(alerta.medicion_detalle.sensor_nombre || "—")}</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500">Dispositivo</p>
                        <p class="font-medium text-gray-900">${escapeHtml(alerta.medicion_detalle.dispositivo || "—")}</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500">Valor medido</p>
                        <p class="font-semibold text-gray-900">${alerta.medicion_detalle.valor} ${alerta.medicion_detalle.unidad || ""}</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500">Rango esperado</p>
                        <p class="font-medium text-gray-900">
                            ${alerta.medicion_detalle.rango_min !== null && alerta.medicion_detalle.rango_min !== undefined
                                ? `${alerta.medicion_detalle.rango_min} - ${alerta.medicion_detalle.rango_max}`
                                : "—"}
                        </p>
                    </div>
                    ${alerta.medicion_detalle.desvio_pct !== null && alerta.medicion_detalle.desvio_pct !== undefined && alerta.medicion_detalle.desvio_pct !== 0 ? `
                    <div class="col-span-2">
                        <p class="text-xs text-gray-500">Desvío</p>
                        <p class="font-semibold ${alerta.medicion_detalle.desvio_pct > 0 ? 'text-red-600' : 'text-blue-600'}">
                            ${alerta.medicion_detalle.desvio_pct > 0 ? "+" : ""}${alerta.medicion_detalle.desvio_pct}%
                        </p>
                    </div>
                    ` : ""}
                </div>
            </div>
            ` : ""}

            ${alerta.evento_detalle ? `
            <div class="bg-gray-50 rounded-xl p-3 mb-4 border border-gray-100">
                <p class="text-xs font-semibold text-gray-700 mb-2">📋 Detalle del evento</p>
                <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div class="col-span-2">
                        <p class="text-xs text-gray-500">Tipo</p>
                        <p class="font-medium text-gray-900">${escapeHtml(alerta.evento_detalle.tipo_display || "—")}</p>
                    </div>
                    ${alerta.evento_detalle.dispositivo ? `
                    <div>
                        <p class="text-xs text-gray-500">Dispositivo</p>
                        <p class="font-medium text-gray-900">${escapeHtml(alerta.evento_detalle.dispositivo)}</p>
                    </div>
                    ` : ""}
                    ${alerta.evento_detalle.cultivo ? `
                    <div>
                        <p class="text-xs text-gray-500">Cultivo</p>
                        <p class="font-medium text-gray-900">${escapeHtml(alerta.evento_detalle.cultivo)}</p>
                    </div>
                    ` : ""}
                    ${alerta.evento_detalle.descripcion ? `
                    <div class="col-span-2">
                        <p class="text-xs text-gray-500">Descripción</p>
                        <p class="text-gray-700">${escapeHtml(alerta.evento_detalle.descripcion)}</p>
                    </div>
                    ` : ""}
                </div>
            </div>
            ` : ""}

            ${seccionDiagnosticoIA(alerta)}

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
                    <p class="text-xs text-gray-500 mb-0.5">Duración</p>
                    <p class="font-medium text-gray-900">${duracion}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500 mb-0.5">Cultivo</p>
                    <p class="font-medium text-gray-900">${escapeHtml(alerta.cultivo_nombre || "—")}</p>
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
                    ${(alerta.acciones_sugeridas || []).map(a => `<li>${escapeHtml(a)}</li>`).join("")}
                </ul>
            </div>

            ${!resuelta ? `
                <div class="space-y-2">
                    <button id="btn-intervenir-${alerta.id}" class="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2">
                        <i data-lucide="wrench" class="w-4 h-4"></i>
                        Registrar intervención y resolver
                    </button>
                    <button id="btn-resolver-directo-${alerta.id}" class="w-full border border-gray-300 hover:border-gray-400 text-gray-700 font-medium py-2 rounded-xl text-xs transition">
                        Resolver sin registrar intervención
                    </button>
                </div>
            ` : `
                <div class="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                    <p class="text-sm font-semibold text-green-800">✅ Alerta resuelta</p>
                    <p class="text-xs text-green-700 mt-1">Resuelta el ${formatearFechaHora(alerta.fecha_hora_fin)}</p>
                </div>
            `}
        </div>
    `;

    lucide.createIcons();

    cargarDiagnosticoIA(alerta).catch(err => console.error("Error en el diagnóstico inteligente:", err));

    const btnIntervenir = document.getElementById(`btn-intervenir-${alerta.id}`);
    if (btnIntervenir) {
        btnIntervenir.addEventListener("click", (e) => {
            e.stopPropagation();
            abrirModalIntervencion(alerta);
        });
    }

    const btnResolverDirecto = document.getElementById(`btn-resolver-directo-${alerta.id}`);
    if (btnResolverDirecto) {
        btnResolverDirecto.addEventListener("click", (e) => {
            e.stopPropagation();
            resolverSinIntervencion(alerta.id);
        });
    }
}

function calcularDuracion(inicio, fin) {
    const d1 = new Date(inicio);
    const d2 = fin ? new Date(fin) : new Date();
    const dif = Math.floor((d2 - d1) / 1000);

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

// ============================================================
// RESOLVER ALERTA Y MODAL
// ============================================================

async function resolverSinIntervencion(alertaId) {
    const confirmado = confirm("¿Marcar la alerta como resuelta sin registrar una intervención?");
    if (!confirmado) return;

    try {
        const actualizada = await apiPatch(`/alertas/${alertaId}/`, { estado: "resuelta" });
        const idx = alertasCargadas.findIndex(a => a.id === alertaId);
        if (idx !== -1) alertasCargadas[idx] = actualizada;
        alertaSeleccionada = actualizada;

        actualizarContadores(alertasCargadas);
        aplicarFiltrosYRenderizar();
        if (typeof actualizarBadgesAlertas === "function") actualizarBadgesAlertas();
    } catch (err) {
        alert(`Error al resolver: ${err.message}`);
    }
}

function abrirModalIntervencion(alerta) {
    const modal = document.getElementById("modal-intervencion");
    if (!modal) return;

    document.getElementById("intervencion-alerta-id").value = alerta.id;
    document.getElementById("intervencion-alerta-titulo").textContent = generarTitulo(alerta);
    document.getElementById("intervencion-tipo").value = sugerirTipo(alerta);
    document.getElementById("intervencion-descripcion").value = "";
    document.getElementById("intervencion-resolver").checked = true;
    document.getElementById("error-intervencion").classList.add("hidden");

    modal.classList.remove("hidden");
    modal.classList.add("flex");
    lucide.createIcons();
    setTimeout(() => document.getElementById("intervencion-tipo").focus(), 100);
}

function cerrarModalIntervencion() {
    const modal = document.getElementById("modal-intervencion");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.classList.remove("flex");
}

function sugerirTipo(alerta) {
    return alerta.medicion ? "ajuste_parametros" : "mantenimiento";
}

async function guardarIntervencion(event) {
    event.preventDefault();
    const alertaId = parseInt(document.getElementById("intervencion-alerta-id").value);
    const tipo = document.getElementById("intervencion-tipo").value;
    const descripcion = document.getElementById("intervencion-descripcion").value.trim();
    const resolverTambien = document.getElementById("intervencion-resolver").checked;
    const btn = document.getElementById("btn-guardar-intervencion");
    const errorBox = document.getElementById("error-intervencion");

    if (!descripcion) {
        errorBox.textContent = "Escribí qué hiciste antes de guardar.";
        errorBox.classList.remove("hidden");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Guardando...`;
    lucide.createIcons();
    errorBox.classList.add("hidden");

    try {
        await apiPost("/intervenciones/", { alerta: alertaId, tipo: tipo, observaciones: descripcion, descripcion_accion: "" });
        if (resolverTambien) {
            try {
                const alertaActualizada = await apiPatch(`/alertas/${alertaId}/`, { estado: "resuelta" });
                const idx = alertasCargadas.findIndex(a => a.id === alertaId);
                if (idx !== -1) alertasCargadas[idx] = alertaActualizada;
                alertaSeleccionada = alertaActualizada;
            } catch (err) { console.error("Error al resolver la alerta:", err); }
        }
        cerrarModalIntervencion();
        actualizarContadores(alertasCargadas);
        aplicarFiltrosYRenderizar();
        if (typeof actualizarBadgesAlertas === "function") actualizarBadgesAlertas();
    } catch (err) {
        console.error(err);
        errorBox.textContent = "Error al guardar la intervención.";
        errorBox.classList.remove("hidden");
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i> Guardar`;
        lucide.createIcons();
    }
}

// ============================================================
// INICIAR
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".tab-alerta").forEach(btn => {
        btn.addEventListener("click", () => {
            tabActivoAlertas = btn.dataset.tab;
            document.querySelectorAll(".tab-alerta").forEach(b => b.classList.toggle("active", b.dataset.tab === tabActivoAlertas));
            aplicarFiltrosYRenderizar();
        });
    });

    document.getElementById("filtro-cultivo")?.addEventListener("change", (e) => { filtroCultivo = e.target.value; aplicarFiltrosYRenderizar(); });
    document.getElementById("filtro-origen")?.addEventListener("change", (e) => { filtroOrigen = e.target.value; aplicarFiltrosYRenderizar(); });

    const buscador = document.getElementById("buscador-alertas");
    if (buscador) {
        let timerId = null;
        buscador.addEventListener("input", (e) => {
            clearTimeout(timerId);
            timerId = setTimeout(() => { filtroBusqueda = e.target.value.trim(); aplicarFiltrosYRenderizar(); }, 250);
        });
    }

    const modal = document.getElementById("modal-intervencion");
    if (modal) {
        document.getElementById("btn-cerrar-modal-intervencion")?.addEventListener("click", cerrarModalIntervencion);
        document.getElementById("btn-cancelar-intervencion")?.addEventListener("click", cerrarModalIntervencion);
        document.getElementById("form-intervencion")?.addEventListener("submit", guardarIntervencion);
        modal.addEventListener("click", (e) => { if (e.target === modal) cerrarModalIntervencion(); });
    }

    cargarAlertas();
});