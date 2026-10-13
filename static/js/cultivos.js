// ============================================================
// cultivos.js — Carga dinámica + crear/editar/eliminar + tabs
// ============================================================

let cultivosCargados = [];
let cultivoSeleccionado = null;
let tabActivo = "resumen";

// Duración estimada por tipo (días). Si no está, se usa 60.
const DURACION_POR_TIPO = {
    "lechuga": 60,
    "lechuga francesa": 60,
    "albahaca": 45,
    "tomate": 90,
    "tomate fresco": 90,
    "tomate cherry": 80,
    "frutilla": 120,
    "oregano": 30,
    "orégano": 30,
    "menta": 60,
    "kale": 55,
    "espinaca": 50,
    "rucula": 35,
    "rúcula": 35,
};

const DURACION_DEFAULT_DIAS = 60;

// Estados del ciclo para el dropdown
const ESTADOS_CICLO = [
    { value: "germinacion", label: "Germinación" },
    { value: "plantula", label: "Plántula" },
    { value: "crecimiento", label: "Crecimiento vegetativo" },
    { value: "floracion", label: "Floración" },
    { value: "cosecha", label: "Cosecha" },
];

// Estilos de severidad de alertas
const SEVERIDAD_ESTILOS = {
    "alta":  { bg: "bg-red-50", border: "border-red-100", iconoBg: "bg-red-100", iconoColor: "text-red-600", badge: "bg-red-100 text-red-700", label: "Crítica", icono: "alert-triangle" },
    "media": { bg: "bg-orange-50", border: "border-orange-100", iconoBg: "bg-orange-100", iconoColor: "text-orange-600", badge: "bg-orange-100 text-orange-700", label: "Aviso", icono: "alert-circle" },
    "baja":  { bg: "bg-blue-50", border: "border-blue-100", iconoBg: "bg-blue-100", iconoColor: "text-blue-600", badge: "bg-blue-100 text-blue-700", label: "Info", icono: "info" },
};


// ============================================================
// CARGA DE LA LISTA
// ============================================================

async function cargarCultivos() {
    const contenedor = document.getElementById("lista-cultivos");

    try {
        contenedor.innerHTML = `
            <div class="text-center py-8 text-gray-400 text-sm">
                <i data-lucide="loader" class="w-6 h-6 mx-auto mb-2 animate-spin"></i>
                Cargando cultivos...
            </div>
        `;
        lucide.createIcons();

        const respuesta = await apiGet("/cultivos/");
        cultivosCargados = Array.isArray(respuesta) ? respuesta : (respuesta.results || []);

        if (!cultivosCargados || cultivosCargados.length === 0) {
            contenedor.innerHTML = `
                <div class="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                    <i data-lucide="leaf" class="w-10 h-10 text-gray-300 mx-auto mb-2"></i>
                    <p class="text-sm text-gray-500 mb-3">No hay cultivos registrados.</p>
                    <button onclick="abrirModalCultivo()" class="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
                        <i data-lucide="plus" class="w-4 h-4"></i>
                        Crear el primero
                    </button>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        renderListaCultivos(cultivosCargados);

        if (cultivosCargados.length > 0) {
            seleccionarCultivo(cultivosCargados[0]);
        }

    } catch (err) {
        console.error(err);
        contenedor.innerHTML = `
            <div class="bg-red-50 border border-red-200 text-red-700 text-sm p-4 rounded-xl">
                Error al cargar cultivos: ${err.message}
            </div>
        `;
    }
}

function renderListaCultivos(cultivos) {
    const contenedor = document.getElementById("lista-cultivos");

    const contador = document.getElementById("contador-cultivos");
    if (contador) {
        contador.textContent = `Mostrando 1 - ${cultivos.length} de ${cultivos.length} cultivos`;
    }

    contenedor.innerHTML = cultivos.map(c => {
        const esSeleccionado = cultivoSeleccionado && cultivoSeleccionado.id_cultivo === c.id_cultivo;
        const clases = esSeleccionado
            ? "bg-green-50 border-2 border-green-300 ring-2 ring-offset-2 ring-brand"
            : "bg-white border border-gray-200";

        return `
            <div
                class="cultivo-card ${clases} rounded-2xl p-4 cursor-pointer hover:shadow-md transition"
                data-cultivo-id="${c.id_cultivo}"
            >
                <div class="flex items-center gap-4">
                    <div class="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-green-100 flex items-center justify-center">
                        <i data-lucide="leaf" class="w-8 h-8 text-brand"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-start justify-between gap-2 mb-1">
                            <h3 class="font-semibold text-gray-900 truncate">${escapeHtml(c.nombre)}</h3>
                            <span class="inline-flex items-center gap-1 bg-green-100 text-green-800 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                                <span class="w-1 h-1 bg-green-600 rounded-full"></span>
                                Activo
                            </span>
                        </div>
                        <p class="text-xs text-gray-500 mb-1">${escapeHtml(c.tipo_cultivo || "Sin tipo")}</p>
                        <p class="text-xs text-gray-600">
                            Desde <span class="font-semibold">${formatearFecha(c.fecha_creacion)}</span>
                        </p>
                    </div>
                    <i data-lucide="chevron-right" class="w-4 h-4 text-gray-400 flex-shrink-0"></i>
                </div>
            </div>
        `;
    }).join("");

    document.querySelectorAll(".cultivo-card").forEach(card => {
        card.addEventListener("click", () => {
            const id = parseInt(card.dataset.cultivoId);
            const cultivo = cultivosCargados.find(c => c.id_cultivo === id);
            if (cultivo) seleccionarCultivo(cultivo);
        });
    });

    lucide.createIcons();
}

async function seleccionarCultivo(cultivo) {
    cultivoSeleccionado = cultivo;
    tabActivo = "resumen";
    renderListaCultivos(cultivosCargados);
    await renderDetalle(cultivo);
}


// ============================================================
// DETALLE DEL CULTIVO
// ============================================================

async function renderDetalle(cultivo) {
    const contenedor = document.getElementById("detalle-contenido");

    const ciclo = cultivo.ciclo_activo;
    const fechaInicio = ciclo?.fecha_inicio
        ? new Date(ciclo.fecha_inicio)
        : new Date(cultivo.fecha_creacion);
    const hoy = new Date();
    const diasTranscurridos = Math.floor((hoy - fechaInicio) / (1000 * 60 * 60 * 24));

    const tabBtn = (id, label) => `
        <button
            class="tab-cultivo px-4 py-3 text-sm font-medium text-gray-500 whitespace-nowrap border-b-2 border-transparent hover:text-gray-700 transition"
            data-tab="${id}"
        >${label}</button>
    `;

    contenedor.innerHTML = `
        <div class="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
            <div class="flex items-start justify-between gap-3 mb-4">
                <h2 class="font-serif text-2xl font-bold text-gray-900">Detalle de cultivo</h2>

                <div class="relative">
                    <button
                        id="btn-menu-cultivo"
                        class="p-1.5 hover:bg-gray-100 rounded-lg transition"
                        title="Opciones"
                    >
                        <i data-lucide="more-horizontal" class="w-5 h-5 text-gray-500"></i>
                    </button>

                    <div
                        id="menu-cultivo"
                        class="hidden absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-200 py-1 min-w-[180px] z-20"
                    >
                        <button
                            id="menu-editar-cultivo"
                            class="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition text-left"
                        >
                            <i data-lucide="pencil" class="w-4 h-4 text-gray-500"></i>
                            Editar cultivo
                        </button>
                        <button
                            id="menu-eliminar-cultivo"
                            class="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition text-left"
                        >
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                            Eliminar cultivo
                        </button>
                    </div>
                </div>
            </div>

            <div class="flex items-start gap-5">
                <div class="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 bg-green-100 flex items-center justify-center">
                    <i data-lucide="leaf" class="w-12 h-12 text-brand"></i>
                </div>
                <div class="flex-1">
                    <div class="flex items-start justify-between gap-3 mb-2">
                        <div>
                            <h3 class="font-serif text-3xl font-bold text-gray-900">${escapeHtml(cultivo.nombre)}</h3>
                            <p class="text-sm italic text-gray-500">${escapeHtml(cultivo.tipo_cultivo || "Sin tipo especificado")}</p>
                        </div>
                        <span class="inline-flex items-center gap-1.5 bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full">
                            <span class="w-2 h-2 bg-green-600 rounded-full"></span>
                            Activo
                        </span>
                    </div>
                    <div class="flex items-center gap-4 text-sm text-gray-600 mt-3 flex-wrap">
                        <span class="flex items-center gap-1.5">
                            <i data-lucide="calendar" class="w-4 h-4"></i>
                            Siembra: ${formatearFecha(fechaInicio)}
                        </span>
                        <span class="text-gray-300">|</span>
                        <span>Día <span class="font-semibold">${diasTranscurridos}</span></span>
                    </div>
                </div>
            </div>

            <div id="tabs-container" class="flex items-center gap-1 mt-6 border-b border-gray-200 -mx-6 px-6 overflow-x-auto">
                ${tabBtn("resumen", "Resumen")}
                ${tabBtn("ciclo", "Ciclo")}
                ${tabBtn("sensores", "Sensores")}
                ${tabBtn("alertas", "Alertas")}
                ${tabBtn("imagenes", "Imágenes")}
            </div>
        </div>

        <div id="tab-contenido">
            <!-- El contenido del tab activo se carga acá -->
        </div>
    `;

    lucide.createIcons();
    configurarMenuCultivo();

    // Configurar listeners de tabs
    document.querySelectorAll(".tab-cultivo").forEach(btn => {
        btn.addEventListener("click", () => cambiarTab(btn.dataset.tab));
    });

    // Cargar el tab activo (resumen por default)
    await cambiarTab("resumen");
}

async function cambiarTab(tab) {
    tabActivo = tab;

    // Actualizar estilos de los botones
    document.querySelectorAll(".tab-cultivo").forEach(btn => {
        const esActivo = btn.dataset.tab === tab;
        if (esActivo) {
            btn.classList.add("border-brand", "text-brand", "font-semibold");
            btn.classList.remove("border-transparent", "text-gray-500", "font-medium");
        } else {
            btn.classList.remove("border-brand", "text-brand", "font-semibold");
            btn.classList.add("border-transparent", "text-gray-500", "font-medium");
        }
    });

    const cont = document.getElementById("tab-contenido");
    if (!cont) return;

    cont.innerHTML = `
        <div class="bg-white rounded-2xl border border-gray-200 p-10 text-center">
            <i data-lucide="loader" class="w-8 h-8 text-gray-300 mx-auto mb-3 animate-spin"></i>
            <p class="text-sm text-gray-500">Cargando...</p>
        </div>
    `;
    lucide.createIcons();

    switch (tab) {
        case "resumen":  return renderTabResumen();
        case "ciclo":    return renderTabCiclo();
        case "sensores": return renderTabSensores();
        case "alertas":  return renderTabAlertas();
        case "imagenes": return renderTabImagenes();
    }
}


// ============================================================
// TAB: RESUMEN
// ============================================================

async function renderTabResumen() {
    const cultivo = cultivoSeleccionado;
    const ciclo = cultivo.ciclo_activo;
    const cont = document.getElementById("tab-contenido");

    const fechaInicio = ciclo?.fecha_inicio
        ? new Date(ciclo.fecha_inicio)
        : new Date(cultivo.fecha_creacion);
    const diasTranscurridos = Math.floor((new Date() - fechaInicio) / (1000 * 60 * 60 * 24));

    cont.innerHTML = `
        <div class="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 class="font-serif text-lg font-bold text-gray-900 mb-4">Información general</h3>
            <div class="space-y-3 text-sm">
                <div class="flex items-center justify-between py-1.5 border-b border-gray-100">
                    <span class="text-gray-500">Nombre</span>
                    <span class="font-medium text-gray-900">${escapeHtml(cultivo.nombre)}</span>
                </div>
                <div class="flex items-center justify-between py-1.5 border-b border-gray-100">
                    <span class="text-gray-500">Tipo de cultivo</span>
                    <span class="font-medium text-gray-900">${escapeHtml(cultivo.tipo_cultivo || "—")}</span>
                </div>
                <div class="flex items-center justify-between py-1.5 border-b border-gray-100">
                    <span class="text-gray-500">Fecha de registro</span>
                    <span class="font-medium text-gray-900">${formatearFecha(cultivo.fecha_creacion)}</span>
                </div>
                ${ciclo ? `
                <div class="flex items-center justify-between py-1.5 border-b border-gray-100">
                    <span class="text-gray-500">Siembra real</span>
                    <span class="font-medium text-gray-900">${formatearFecha(ciclo.fecha_inicio)}</span>
                </div>
                <div class="flex items-center justify-between py-1.5 border-b border-gray-100">
                    <span class="text-gray-500">Estado del ciclo</span>
                    <span class="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs font-semibold px-2 py-0.5 rounded-full">
                        ${escapeHtml(ciclo.estado_display || ciclo.estado)}
                    </span>
                </div>
                <div class="flex items-center justify-between py-1.5 border-b border-gray-100">
                    <span class="text-gray-500">Cosecha estimada</span>
                    <span class="font-medium text-gray-900">${ciclo.fecha_fin_estimada ? formatearFecha(ciclo.fecha_fin_estimada) : "—"}</span>
                </div>
                ` : ""}
                <div class="flex items-center justify-between py-1.5 border-b border-gray-100">
                    <span class="text-gray-500">Días transcurridos</span>
                    <span class="font-medium text-gray-900">${diasTranscurridos} días</span>
                </div>
                <div class="flex items-center justify-between py-1.5">
                    <span class="text-gray-500">ID de cultivo</span>
                    <span class="font-mono text-xs text-gray-700">#${cultivo.id_cultivo}</span>
                </div>
            </div>
        </div>
    `;
    lucide.createIcons();
}


// ============================================================
// TAB: CICLO
// ============================================================

async function renderTabCiclo() {
    const cultivo = cultivoSeleccionado;
    const cont = document.getElementById("tab-contenido");

    let ciclos = [];
    try {
        const resp = await apiGet(`/ciclos-produccion/?cultivo=${cultivo.id_cultivo}`);
        ciclos = Array.isArray(resp) ? resp : (resp.results || []);
    } catch (err) {
        cont.innerHTML = `
            <div class="bg-red-50 border border-red-200 text-red-700 text-sm p-4 rounded-xl">
                Error al cargar ciclos: ${err.message}
            </div>
        `;
        return;
    }

    const activos = ciclos.filter(c => c.estado !== "finalizado");
    const finalizados = ciclos.filter(c => c.estado === "finalizado");
    const cicloActivo = activos[0] || null;

    if (!cicloActivo) {
        cont.innerHTML = `
            <div class="bg-white rounded-2xl border border-gray-200 p-8 text-center">
                <i data-lucide="calendar-x" class="w-10 h-10 text-gray-300 mx-auto mb-3"></i>
                <p class="text-sm text-gray-500 mb-2">Este cultivo no tiene un ciclo activo.</p>
                <p class="text-xs text-gray-400">Cuando inicies un nuevo ciclo, va a aparecer acá.</p>
            </div>
            ${renderHistorialCiclos(finalizados)}
        `;
        lucide.createIcons();
        return;
    }

    const hoy = new Date();
    const inicio = new Date(cicloActivo.fecha_inicio);
    const dias = Math.floor((hoy - inicio) / (1000 * 60 * 60 * 24));
    const totalDias = cicloActivo.fecha_fin_estimada
        ? Math.floor((new Date(cicloActivo.fecha_fin_estimada) - inicio) / (1000 * 60 * 60 * 24))
        : DURACION_DEFAULT_DIAS;
    const estaAtrasado = dias > totalDias;

    const opcionesEstados = ESTADOS_CICLO.map(e => `
        <option value="${e.value}" ${cicloActivo.estado === e.value ? "selected" : ""}>${e.label}</option>
    `).join("");

    cont.innerHTML = `
        <div class="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
            <div class="flex items-center justify-between gap-3 mb-4">
                <h3 class="font-serif text-lg font-bold text-gray-900">Ciclo activo</h3>
                <span class="text-xs font-semibold px-2 py-0.5 rounded-full ${estaAtrasado ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}">
                    ${estaAtrasado ? `+${dias - totalDias} días de atraso` : "En curso"}
                </span>
            </div>

            <div class="space-y-3 text-sm mb-5">
                <div class="flex items-center justify-between py-1.5 border-b border-gray-100">
                    <span class="text-gray-500">Siembra</span>
                    <span class="font-medium text-gray-900">${formatearFecha(cicloActivo.fecha_inicio)}</span>
                </div>
                <div class="flex items-center justify-between py-1.5 border-b border-gray-100">
                    <span class="text-gray-500">Cosecha estimada</span>
                    <span class="font-medium text-gray-900">
                        ${cicloActivo.fecha_fin_estimada ? formatearFecha(cicloActivo.fecha_fin_estimada) : "—"}
                    </span>
                </div>
                <div class="flex items-center justify-between py-1.5 border-b border-gray-100">
                    <span class="text-gray-500">Días transcurridos</span>
                    <span class="font-medium text-gray-900">${dias} / ${totalDias}</span>
                </div>
            </div>

            <div class="space-y-3">
                <div>
                    <label class="block text-xs font-semibold text-gray-700 mb-1.5">
                        Estado del ciclo
                    </label>
                    <select
                        id="select-estado-ciclo"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand focus:border-brand outline-none"
                    >
                        ${opcionesEstados}
                    </select>
                </div>

                <div class="flex gap-2 pt-2">
                    <button
                        id="btn-guardar-ciclo"
                        class="flex-1 bg-brand hover:bg-brand-dark text-white font-semibold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2"
                    >
                        <i data-lucide="save" class="w-4 h-4"></i>
                        Guardar cambios
                    </button>
                    <button
                        id="btn-finalizar-ciclo"
                        class="flex-1 border border-amber-300 hover:bg-amber-50 text-amber-700 font-semibold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2"
                    >
                        <i data-lucide="check-circle" class="w-4 h-4"></i>
                        Finalizar ciclo
                    </button>
                </div>
            </div>
        </div>

        ${renderHistorialCiclos(finalizados)}
    `;

    lucide.createIcons();

    document.getElementById("btn-guardar-ciclo")?.addEventListener("click", guardarCambiosCiclo);
    document.getElementById("btn-finalizar-ciclo")?.addEventListener("click", finalizarCiclo);
}

function renderHistorialCiclos(finalizados) {
    if (finalizados.length === 0) {
        return `
            <div class="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 class="font-serif text-lg font-bold text-gray-900 mb-3">Ciclos anteriores</h3>
                <p class="text-sm text-gray-400">No hay ciclos finalizados todavía.</p>
            </div>
        `;
    }

    return `
        <div class="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 class="font-serif text-lg font-bold text-gray-900 mb-3">Ciclos anteriores</h3>
            <div class="space-y-2">
                ${finalizados.map(c => `
                    <div class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg text-sm">
                        <span class="text-gray-700">
                            ${formatearFecha(c.fecha_inicio)} → ${c.fecha_fin_real ? formatearFecha(c.fecha_fin_real) : "—"}
                        </span>
                        <span class="text-xs font-semibold bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
                            Finalizado
                        </span>
                    </div>
                `).join("")}
            </div>
        </div>
    `;
}

async function guardarCambiosCiclo() {
    const cultivo = cultivoSeleccionado;
    if (!cultivo.ciclo_activo) return;

    const btn = document.getElementById("btn-guardar-ciclo");
    const nuevoEstado = document.getElementById("select-estado-ciclo").value;

    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Guardando...`;
    lucide.createIcons();

    try {
        await apiPatch(`/ciclos-produccion/${cultivo.ciclo_activo.id_ciclo}/`, {
            estado: nuevoEstado,
        });

        // Recargar el cultivo actualizado
        await recargarCultivoActual();
        await cambiarTab("ciclo");
    } catch (err) {
        alert(`Error al guardar: ${err.message}`);
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i> Guardar cambios`;
        lucide.createIcons();
    }
}

async function finalizarCiclo() {
    const cultivo = cultivoSeleccionado;
    if (!cultivo.ciclo_activo) return;

    const confirmado = confirm(
        "¿Finalizar el ciclo?\n\n" +
        "El ciclo se marcará como finalizado y el cultivo quedará sin ciclo activo. " +
        "Esta acción no se puede deshacer."
    );
    if (!confirmado) return;

    const btn = document.getElementById("btn-finalizar-ciclo");
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Finalizando...`;
    lucide.createIcons();

    const hoy = new Date().toISOString().split("T")[0];

    try {
        await apiPatch(`/ciclos-produccion/${cultivo.ciclo_activo.id_ciclo}/`, {
            estado: "finalizado",
            fecha_fin_real: hoy,
        });

        await recargarCultivoActual();
        await cambiarTab("ciclo");
    } catch (err) {
        alert(`Error al finalizar: ${err.message}`);
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4"></i> Finalizar ciclo`;
        lucide.createIcons();
    }
}


// ============================================================
// TAB: SENSORES
// ============================================================

async function renderTabSensores() {
    const cultivo = cultivoSeleccionado;
    const cont = document.getElementById("tab-contenido");

    let sensores = [];
    try {
        // Todos los cultivos comparten el mismo cultivador en el prototipo,
        // así que mostramos todos los sensores del sistema.
    const resp = await apiGet(`/sensores/`);
        sensores = Array.isArray(resp) ? resp : (resp.results || []);
    } catch (err) {
        cont.innerHTML = `
            <div class="bg-red-50 border border-red-200 text-red-700 text-sm p-4 rounded-xl">
                Error al cargar sensores: ${err.message}
            </div>
        `;
        return;
    }

    if (sensores.length === 0) {
        cont.innerHTML = `
            <div class="bg-white rounded-2xl border border-gray-200 p-8 text-center">
                <i data-lucide="cpu" class="w-10 h-10 text-gray-300 mx-auto mb-3"></i>
                <p class="text-sm text-gray-500">Este cultivo no tiene sensores asociados.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    // Necesitamos los nombres de tipos de sensor
    let tiposMap = {};
    try {
        const respTipos = await apiGet("/tipos-sensor/");
        const tipos = Array.isArray(respTipos) ? respTipos : (respTipos.results || []);
        tipos.forEach(t => tiposMap[t.id] = t);
    } catch (e) {
        // sin tipos, seguimos con lo que haya
    }

    cont.innerHTML = `
        <div class="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 class="font-serif text-lg font-bold text-gray-900 mb-4">Sensores del cultivo</h3>
            <div class="space-y-3">
                ${sensores.map(s => {
                    const tipo = tiposMap[s.tipo_sensor];
                    const nombre = tipo ? tipo.nombre : `Tipo #${s.tipo_sensor}`;
                    const unidad = tipo ? tipo.unidad_medida : "";
                    return `
                        <div class="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl">
                            <div class="flex items-center gap-3">
                                <div class="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
                                    <i data-lucide="activity" class="w-4 h-4 text-brand"></i>
                                </div>
                                <div>
                                    <p class="text-sm font-semibold text-gray-900">${escapeHtml(nombre)}</p>
                                    <p class="text-xs text-gray-500">${unidad ? escapeHtml(unidad) : ""}</p>
                                </div>
                            </div>
                            <span class="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                                <span class="w-1.5 h-1.5 bg-green-600 rounded-full"></span>
                                Activo
                            </span>
                        </div>
                    `;
                }).join("")}
            </div>
        </div>
    `;
    lucide.createIcons();
}


// ============================================================
// TAB: ALERTAS
// ============================================================

async function renderTabAlertas() {
    const cultivo = cultivoSeleccionado;
    const cont = document.getElementById("tab-contenido");

    let alertas = [];
    try {
        const resp = await apiGet(`/alertas/`);
        alertas = Array.isArray(resp) ? resp : (resp.results || []);
    } catch (err) {
        cont.innerHTML = `
            <div class="bg-red-50 border border-red-200 text-red-700 text-sm p-4 rounded-xl">
                Error al cargar alertas: ${err.message}
            </div>
        `;
        return;
    }

    if (alertas.length === 0) {
        cont.innerHTML = `
            <div class="bg-white rounded-2xl border border-gray-200 p-8 text-center">
                <i data-lucide="check-circle" class="w-10 h-10 text-green-500 mx-auto mb-3"></i>
                <p class="text-sm text-gray-500">Sin alertas para este cultivo.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    cont.innerHTML = `
        <div class="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 class="font-serif text-lg font-bold text-gray-900 mb-4">
                Alertas del cultivo <span class="text-sm text-gray-400 font-normal">(${alertas.length})</span>
            </h3>
            <div class="space-y-3">
                ${alertas.map(a => {
                    const est = SEVERIDAD_ESTILOS[a.severidad] || SEVERIDAD_ESTILOS.baja;
                    const resuelta = a.estado === "resuelta";
                    const fecha = a.fecha_hora_inicio ? tiempoRelativo(a.fecha_hora_inicio) : "—";
                    const badge = resuelta
                        ? `<span class="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Resuelta</span>`
                        : `<span class="text-[10px] font-bold ${est.badge} px-2 py-0.5 rounded-full">${est.label}</span>`;
                    return `
                        <div class="flex items-start gap-3 p-3 rounded-xl ${est.bg} border ${est.border}">
                            <div class="w-8 h-8 ${est.iconoBg} rounded-lg flex items-center justify-center flex-shrink-0">
                                <i data-lucide="${est.icono}" class="w-4 h-4 ${est.iconoColor}"></i>
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-semibold text-gray-900">
                                    ${a.medicion ? "Medición fuera de rango" : "Evento del sistema"}
                                </p>
                                ${a.descripcion ? `<p class="text-xs text-gray-600 mt-0.5 line-clamp-2">${escapeHtml(a.descripcion)}</p>` : ""}
                                <p class="text-xs text-gray-400 mt-1">${fecha}</p>
                            </div>
                            ${badge}
                        </div>
                    `;
                }).join("")}
            </div>
        </div>
    `;
    lucide.createIcons();
}


// ============================================================
// TAB: IMÁGENES
// ============================================================

async function renderTabImagenes() {
    const cultivo = cultivoSeleccionado;
    const cont = document.getElementById("tab-contenido");

    let imagenes = [];
    try {
        const resp = await apiGet(`/analisis-imagen/?cultivo=${cultivo.id_cultivo}`);
        imagenes = Array.isArray(resp) ? resp : (resp.results || []);
    } catch (err) {
        cont.innerHTML = `
            <div class="bg-red-50 border border-red-200 text-red-700 text-sm p-4 rounded-xl">
                Error al cargar imágenes: ${err.message}
            </div>
        `;
        return;
    }

    if (imagenes.length === 0) {
        cont.innerHTML = `
            <div class="bg-white rounded-2xl border border-gray-200 p-8 text-center">
                <i data-lucide="image-off" class="w-10 h-10 text-gray-300 mx-auto mb-3"></i>
                <p class="text-sm text-gray-500">Este cultivo todavía no tiene imágenes capturadas.</p>
                <p class="text-xs text-gray-400 mt-2">Cuando la cámara del ESP32 empiece a enviar fotos, van a aparecer acá.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    // Mostrar las primeras 8
    const preview = imagenes.slice(0, 8);

    cont.innerHTML = `
        <div class="bg-white rounded-2xl border border-gray-200 p-5">
            <div class="flex items-center justify-between gap-3 mb-4">
                <h3 class="font-serif text-lg font-bold text-gray-900">
                    Imágenes del cultivo <span class="text-sm text-gray-400 font-normal">(${imagenes.length})</span>
                </h3>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                ${preview.map(img => {
                    const url = img.url_imagen || img.imagen;
                    const fecha = img.fecha_hora ? formatearFechaHoraCorta(img.fecha_hora) : "—";
                    return `
                        <div class="rounded-xl overflow-hidden border border-gray-200">
                            <div class="aspect-square bg-gray-100">
                                <img src="${escapeHtml(url)}" alt="Imagen del cultivo" class="w-full h-full object-cover" loading="lazy">
                            </div>
                            <div class="p-2">
                                <p class="text-xs text-gray-500 truncate">${fecha}</p>
                            </div>
                        </div>
                    `;
                }).join("")}
            </div>
            ${imagenes.length > 8 ? `
                <p class="text-xs text-gray-500 text-center mt-4">
                    Mostrando 8 de ${imagenes.length} imágenes.
                    <a href="/imagenes/" class="text-brand hover:underline">Ver galería completa →</a>
                </p>
            ` : ""}
        </div>
    `;
    lucide.createIcons();
}

function formatearFechaHoraCorta(fechaISO) {
    if (!fechaISO) return "—";
    const d = new Date(fechaISO);
    const ahora = new Date();
    const esHoy = d.toDateString() === ahora.toDateString();
    const ayer = new Date(ahora);
    ayer.setDate(ayer.getDate() - 1);
    const esAyer = d.toDateString() === ayer.toDateString();

    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");

    if (esHoy) return `Hoy, ${hh}:${mm}`;
    if (esAyer) return `Ayer, ${hh}:${mm}`;
    return formatearFecha(fechaISO);
}


// ============================================================
// UTILIDADES
// ============================================================

async function recargarCultivoActual() {
    const resp = await apiGet("/cultivos/");
    const lista = Array.isArray(resp) ? resp : (resp.results || []);
    cultivosCargados = lista;
    const actualizado = lista.find(c => c.id_cultivo === cultivoSeleccionado.id_cultivo);
    if (actualizado) {
        cultivoSeleccionado = actualizado;
    }
    renderListaCultivos(cultivosCargados);
}


// ============================================================
// MENÚ DE 3 PUNTITOS
// ============================================================

function configurarMenuCultivo() {
    const btn = document.getElementById("btn-menu-cultivo");
    const menu = document.getElementById("menu-cultivo");
    const btnEditar = document.getElementById("menu-editar-cultivo");
    const btnEliminar = document.getElementById("menu-eliminar-cultivo");

    if (!btn || !menu) return;

    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        menu.classList.toggle("hidden");
    });

    document.addEventListener("click", () => {
        menu.classList.add("hidden");
    });

    menu.addEventListener("click", (e) => {
        e.stopPropagation();
    });

    btnEditar?.addEventListener("click", () => {
        menu.classList.add("hidden");
        abrirModalEditar(cultivoSeleccionado);
    });

    btnEliminar?.addEventListener("click", () => {
        menu.classList.add("hidden");
        eliminarCultivo(cultivoSeleccionado);
    });
}


// ============================================================
// MODAL CREAR / EDITAR
// ============================================================

function fechaHoyISO() {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,"0")}-${String(hoy.getDate()).padStart(2,"0")}`;
}

function abrirModalCultivo() {
    const modal = document.getElementById("modal-nuevo-cultivo");
    if (!modal) return;

    document.getElementById("modal-titulo-cultivo").textContent = "Nuevo cultivo";
    document.getElementById("form-nuevo-cultivo").reset();
    document.getElementById("cultivo-id-editar").value = "";

    const hoyStr = fechaHoyISO();
    document.getElementById("input-fecha-cultivo").value = hoyStr;
    document.getElementById("input-fecha-siembra").value = hoyStr;
    document.getElementById("input-estado-ciclo").value = "germinacion";
    document.getElementById("input-duracion-ciclo").value = String(DURACION_DEFAULT_DIAS);
    bloquearDuracion(true);

    const hint = document.getElementById("hint-duracion");
    if (hint) {
        hint.textContent = "Se autocompletará al elegir el tipo de cultivo.";
        hint.className = "text-[11px] text-gray-500 mt-1";
    }

    document.getElementById("seccion-ciclo-modal").classList.remove("hidden");
    document.getElementById("btn-crear-cultivo").innerHTML =
        `<i data-lucide="plus" class="w-4 h-4"></i> Crear cultivo`;
    document.getElementById("error-cultivo").classList.add("hidden");

    modal.classList.remove("hidden");
    modal.classList.add("flex");
    lucide.createIcons();
}

function abrirModalEditar(cultivo) {
    if (!cultivo) return;
    const modal = document.getElementById("modal-nuevo-cultivo");
    if (!modal) return;

    document.getElementById("modal-titulo-cultivo").textContent = "Editar cultivo";
    document.getElementById("input-nombre-cultivo").value = cultivo.nombre || "";
    document.getElementById("input-tipo-cultivo").value = cultivo.tipo_cultivo || "";
    document.getElementById("input-fecha-cultivo").value = cultivo.fecha_creacion || "";
    document.getElementById("cultivo-id-editar").value = cultivo.id_cultivo;
    document.getElementById("seccion-ciclo-modal").classList.add("hidden");
    document.getElementById("btn-crear-cultivo").innerHTML =
        `<i data-lucide="save" class="w-4 h-4"></i> Guardar cambios`;
    document.getElementById("error-cultivo").classList.add("hidden");

    modal.classList.remove("hidden");
    modal.classList.add("flex");
    lucide.createIcons();
}

function cerrarModalCultivo() {
    const modal = document.getElementById("modal-nuevo-cultivo");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
}

async function guardarCultivo(event) {
    event.preventDefault();

    const btn = document.getElementById("btn-crear-cultivo");
    const errorBox = document.getElementById("error-cultivo");
    const idEditar = document.getElementById("cultivo-id-editar").value;
    const nombre = document.getElementById("input-nombre-cultivo").value.trim();
    const tipo = document.getElementById("input-tipo-cultivo").value.trim() || "No especificado";
    const fecha = document.getElementById("input-fecha-cultivo").value;

    if (!nombre) { mostrarErrorCultivo("El nombre es obligatorio"); return; }
    if (!fecha) { mostrarErrorCultivo("La fecha de registro es obligatoria"); return; }

    const esEdicion = !!idEditar;

    let fechaSiembra, estadoCiclo, duracionCiclo;
    if (!esEdicion) {
        fechaSiembra = document.getElementById("input-fecha-siembra").value;
        estadoCiclo = document.getElementById("input-estado-ciclo").value;
        duracionCiclo = parseInt(document.getElementById("input-duracion-ciclo").value);

        if (!fechaSiembra) { mostrarErrorCultivo("La fecha real de siembra es obligatoria"); return; }
        if (!estadoCiclo) { mostrarErrorCultivo("El estado del ciclo es obligatorio"); return; }
        if (!duracionCiclo || duracionCiclo < 1) { mostrarErrorCultivo("La duración debe ser mayor a 0"); return; }
    }

    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> ${esEdicion ? "Guardando..." : "Creando..."}`;
    lucide.createIcons();
    errorBox.classList.add("hidden");

    try {
        const datos = { nombre, tipo_cultivo: tipo, fecha_creacion: fecha };
        if (!esEdicion) {
            datos.fecha_siembra = fechaSiembra;
            datos.estado_ciclo = estadoCiclo;
            datos.duracion_ciclo_dias = duracionCiclo;
        }

        let resultado;
        if (esEdicion) {
            resultado = await apiPatch(`/cultivos/${idEditar}/`, datos);
        } else {
            resultado = await apiPost("/cultivos/", datos);
        }

        await cargarCultivos();
        const creado = cultivosCargados.find(c => c.id_cultivo === resultado.id_cultivo);
        if (creado) seleccionarCultivo(creado);

        cerrarModalCultivo();
    } catch (err) {
        console.error(err);
        let msg = esEdicion ? "Error al guardar los cambios" : "Error al crear el cultivo";
        try {
            const partes = err.message.split(": ");
            const json = JSON.parse(partes.slice(1).join(": "));
            if (typeof json === "object") {
                msg = Object.entries(json).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" · ");
            }
        } catch (e) {}
        mostrarErrorCultivo(msg);
    } finally {
        btn.disabled = false;
        const esEdicionFinal = !!document.getElementById("cultivo-id-editar").value;
        btn.innerHTML = esEdicionFinal
            ? `<i data-lucide="save" class="w-4 h-4"></i> Guardar cambios`
            : `<i data-lucide="plus" class="w-4 h-4"></i> Crear cultivo`;
        lucide.createIcons();
    }
}

function bloquearDuracion(bloqueado) {
    const input = document.getElementById("input-duracion-ciclo");
    const icono = document.getElementById("icono-duracion-lock");
    if (!input) return;

    if (bloqueado) {
        input.setAttribute("readonly", "readonly");
        input.classList.add("bg-gray-50", "cursor-not-allowed", "text-gray-600");
        input.classList.remove("bg-white", "focus:ring-2", "focus:ring-brand", "focus:border-brand");
        if (icono) icono.setAttribute("data-lucide", "lock");
    } else {
        input.removeAttribute("readonly");
        input.classList.remove("bg-gray-50", "cursor-not-allowed", "text-gray-600");
        input.classList.add("bg-white", "focus:ring-2", "focus:ring-brand", "focus:border-brand");
        if (icono) icono.setAttribute("data-lucide", "pencil");
    }
    lucide.createIcons();
}

function autocompletarDuracion() {
    const inputTipo = document.getElementById("input-tipo-cultivo");
    const inputDuracion = document.getElementById("input-duracion-ciclo");
    const hint = document.getElementById("hint-duracion");
    if (!inputTipo || !inputDuracion) return;

    const tipo = inputTipo.value.toLowerCase().trim();

    if (!tipo) {
        inputDuracion.value = DURACION_DEFAULT_DIAS;
        bloquearDuracion(true);
        if (hint) {
            hint.textContent = "Se autocompletará al elegir el tipo de cultivo.";
            hint.className = "text-[11px] text-gray-500 mt-1";
        }
        return;
    }

    if (DURACION_POR_TIPO[tipo]) {
        inputDuracion.value = DURACION_POR_TIPO[tipo];
        bloquearDuracion(true);
        if (hint) {
            hint.textContent = `✓ Sugerido para "${tipo}": ${DURACION_POR_TIPO[tipo]} días.`;
            hint.className = "text-[11px] text-green-700 font-medium mt-1";
        }
    } else {
        bloquearDuracion(false);
        if (hint) {
            hint.textContent = `⚠️ No tenemos duración típica para "${tipo}". Ingresala manualmente.`;
            hint.className = "text-[11px] text-amber-700 font-medium mt-1";
        }
    }
}

async function eliminarCultivo(cultivo) {
    if (!cultivo) return;
    const confirmado = confirm(`¿Eliminar el cultivo "${cultivo.nombre}"?\n\nEsta acción no se puede deshacer.`);
    if (!confirmado) return;

    try {
        await apiDelete(`/cultivos/${cultivo.id_cultivo}/`);
        cultivoSeleccionado = null;
        await cargarCultivos();
    } catch (err) {
        alert(`Error al eliminar: ${err.message}`);
    }
}

function mostrarErrorCultivo(msg) {
    const box = document.getElementById("error-cultivo");
    box.textContent = msg;
    box.classList.remove("hidden");
}


// ============================================================
// INICIAR
// ============================================================

function initCultivos() {
    cargarCultivos();

    document.getElementById("btn-nuevo-cultivo")?.addEventListener("click", abrirModalCultivo);
    document.getElementById("form-nuevo-cultivo")?.addEventListener("submit", guardarCultivo);
    document.getElementById("btn-cerrar-modal-cultivo")?.addEventListener("click", cerrarModalCultivo);
    document.getElementById("input-tipo-cultivo")?.addEventListener("input", autocompletarDuracion);

    const modal = document.getElementById("modal-nuevo-cultivo");
    modal?.addEventListener("click", (e) => {
        if (e.target === modal) cerrarModalCultivo();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) {
            cerrarModalCultivo();
        }
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCultivos);
} else {
    initCultivos();
}