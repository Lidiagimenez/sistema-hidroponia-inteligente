// ============================================================
// reportes.js — Carga dinámica de Reportes
// ============================================================

let reportes = [];
let reportesFiltrados = [];
let cultivosMap = {};
let cultivosDisponibles = [];

// ---------- Config visual ----------

const ESTADO_CONFIG = {
    "listo":     { badgeBg: "bg-green-100",  badgeText: "text-green-800",  label: "Completado",  icono: "check-circle" },
    "pendiente": { badgeBg: "bg-orange-100", badgeText: "text-orange-800", label: "En proceso",  icono: "clock" },
    "generando": { badgeBg: "bg-blue-100",   badgeText: "text-blue-800",   label: "Generando",   icono: "loader" },
    "error":     { badgeBg: "bg-red-100",    badgeText: "text-red-800",    label: "Con errores", icono: "x-circle" },
};

const TIPO_REPORTE_CONFIG = {
    "monitoreo":      { label: "Monitoreo",      icono: "line-chart" },
    "alertas":        { label: "Alertas",        icono: "bell" },
    "eventos":        { label: "Eventos",        icono: "calendar" },
    "crecimiento":    { label: "Crecimiento",    icono: "sprout" },
    "intervenciones": { label: "Intervenciones", icono: "wrench" },
    "recomendaciones":{ label: "Recomendaciones",icono: "sparkles" },
};

// ---------- Cargar todo ----------
async function cargarReportes() {
    const tbody = document.getElementById("tbody-reportes");
    if (!tbody) return;

    try {
        tbody.innerHTML = `
            <tr><td colspan="6" class="py-8 text-center text-gray-400 text-sm">
                <i data-lucide="loader" class="w-5 h-5 mx-auto mb-2 animate-spin"></i>
                Cargando reportes...
            </td></tr>
        `;
        lucide.createIcons();

        await cargarCultivos();

        const resp = await apiGet("/reportes/");
        reportes = Array.isArray(resp) ? resp : (resp.results || []);
        reportes.sort((a, b) => new Date(b.fecha_solicitud) - new Date(a.fecha_solicitud));

        reportesFiltrados = [...reportes];

        renderTabla();
        renderContador();
        renderStats();
        configurarFiltros();
        configurarModal();
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `
            <tr><td colspan="6" class="py-8 text-center text-red-500 text-sm">
                Error al cargar reportes: ${err.message}
            </td></tr>
        `;
    }
}

// ---------- Cargar cultivos ----------
async function cargarCultivos() {
    const resp = await apiGet("/cultivos/");
    cultivosDisponibles = Array.isArray(resp) ? resp : (resp.results || []);
    cultivosMap = {};
    cultivosDisponibles.forEach(c => { cultivosMap[c.id_cultivo] = c.nombre; });
}

// ---------- Renderizar tabla ----------
function renderTabla() {
    const tbody = document.getElementById("tbody-reportes");

    if (reportesFiltrados.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="6" class="py-12 text-center">
                <i data-lucide="file-text" class="w-10 h-10 text-gray-300 mx-auto mb-2"></i>
                <p class="text-sm text-gray-500 mb-3">No hay reportes generados todavía.</p>
                <button onclick="abrirModalReporte()" class="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
                    <i data-lucide="plus" class="w-4 h-4"></i>
                    Generar el primero
                </button>
            </td></tr>
        `;
        lucide.createIcons();
        return;
    }

    tbody.innerHTML = reportesFiltrados.map(r => {
        const estado = ESTADO_CONFIG[r.estado] || ESTADO_CONFIG.pendiente;
        const tipoConf = TIPO_REPORTE_CONFIG[r.tipo] || { label: r.tipo_display, icono: "file-text" };

        const fechaStr = formatearFecha(r.fecha_solicitud);
        const cultivoNombre = r.cultivo_nombre || "General";
        const formatoStr = (r.formato_display || r.formato || "").toUpperCase();

        // Botón descarga: solo si está listo y tiene URL
        const botonDescargar = (r.estado === "listo" && r.url_descarga)
            ? `<a href="${r.url_descarga}" download class="p-1.5 hover:bg-gray-100 rounded transition" title="Descargar">
                    <i data-lucide="download" class="w-4 h-4 text-gray-500"></i>
               </a>`
            : `<button class="p-1.5 opacity-40 cursor-not-allowed" title="No disponible" disabled>
                    <i data-lucide="download" class="w-4 h-4 text-gray-400"></i>
               </button>`;

        return `
            <tr class="hover:bg-gray-50">
                <td class="py-3 px-3 text-gray-700 whitespace-nowrap text-xs">${fechaStr}</td>
                <td class="py-3 px-3">
                    <div class="flex items-center gap-2">
                        <i data-lucide="${tipoConf.icono}" class="w-4 h-4 text-brand"></i>
                        <span class="text-sm text-gray-900 font-medium">${r.tipo_display || tipoConf.label}</span>
                    </div>
                </td>
                <td class="py-3 px-3 text-gray-700 text-xs">${cultivoNombre}</td>
                <td class="py-3 px-3 text-gray-600 text-xs">${formatoStr}</td>
                <td class="py-3 px-3">
                    <span class="inline-flex items-center gap-1 ${estado.badgeBg} ${estado.badgeText} text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                        <i data-lucide="${estado.icono}" class="w-3 h-3"></i>
                        ${estado.label}
                    </span>
                </td>
                <td class="py-3 px-3">
                    <div class="flex items-center gap-1">
                        ${botonDescargar}
                        <button class="btn-ver-reporte p-1.5 hover:bg-gray-100 rounded transition" data-id="${r.id}" title="Ver detalle">
                            <i data-lucide="eye" class="w-4 h-4 text-gray-500"></i>
                        </button>
                        <button class="btn-eliminar-reporte p-1.5 hover:bg-red-50 rounded transition" data-id="${r.id}" title="Eliminar">
                            <i data-lucide="trash-2" class="w-4 h-4 text-red-500"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    lucide.createIcons();

    // Event listeners
    document.querySelectorAll(".btn-ver-reporte").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = parseInt(btn.dataset.id);
            const reporte = reportes.find(r => r.id === id);
            if (reporte) abrirModalDetalle(reporte);
        });
    });

    document.querySelectorAll(".btn-eliminar-reporte").forEach(btn => {
        btn.addEventListener("click", () => eliminarReporte(parseInt(btn.dataset.id)));
    });
}

// ---------- Contador ----------
function renderContador() {
    const contador = document.getElementById("contador-reportes");
    if (contador) {
        const total = reportes.length;
        const filtrado = reportesFiltrados.length;
        if (filtrado === total) {
            contador.textContent = `Mostrando 1 - ${total} de ${total} reportes`;
        } else {
            contador.textContent = `Mostrando ${filtrado} de ${total} reportes (filtrados)`;
        }
    }
}

// ---------- Stats ----------
function renderStats() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    const total = reportes.length;
    const listos = reportes.filter(r => r.estado === "listo").length;
    const enProceso = reportes.filter(r => r.estado === "pendiente" || r.estado === "generando").length;
    const conError = reportes.filter(r => r.estado === "error").length;

    set("stat-total", total);
    set("stat-listos", listos);
    set("stat-proceso", enProceso);
    set("stat-errores", conError);
}

// ---------- Filtros ----------
function configurarFiltros() {
    const filtroTipo = document.getElementById("filtro-tipo");
    const filtroCultivo = document.getElementById("filtro-cultivo");
    const filtroEstado = document.getElementById("filtro-estado");

    // Poblar select de cultivos
    if (filtroCultivo) {
        filtroCultivo.innerHTML = `<option value="">Todos los cultivos</option>` +
            cultivosDisponibles.map(c => `<option value="${c.id_cultivo}">${c.nombre}</option>`).join("");
    }

    function aplicarFiltros() {
        const tipo = filtroTipo?.value || "";
        const cultivoId = filtroCultivo?.value || "";
        const estado = filtroEstado?.value || "";

        reportesFiltrados = reportes.filter(r => {
            if (tipo && r.tipo !== tipo) return false;
            if (cultivoId && String(r.cultivo) !== String(cultivoId)) return false;
            if (estado && r.estado !== estado) return false;
            return true;
        });

        renderTabla();
        renderContador();
    }

    [filtroTipo, filtroCultivo, filtroEstado].forEach(el => {
        el?.addEventListener("change", aplicarFiltros);
    });
}

// ============================================================
// MODAL NUEVO REPORTE
// ============================================================

function configurarModal() {
    document.getElementById("btn-nuevo-reporte")?.addEventListener("click", abrirModalReporte);
    document.getElementById("form-reporte")?.addEventListener("submit", guardarReporte);
    document.getElementById("btn-cerrar-modal-reporte")?.addEventListener("click", cerrarModalReporte);

    const modal = document.getElementById("modal-reporte");
    modal?.addEventListener("click", (e) => {
        if (e.target === modal) cerrarModalReporte();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (modal && !modal.classList.contains("hidden")) cerrarModalReporte();
            const modalDet = document.getElementById("modal-detalle-reporte");
            if (modalDet && !modalDet.classList.contains("hidden")) {
                modalDet.classList.add("hidden");
                modalDet.classList.remove("flex");
            }
        }
    });
}

function abrirModalReporte() {
    const modal = document.getElementById("modal-reporte");
    if (!modal) return;

    document.getElementById("form-reporte").reset();
    document.getElementById("error-reporte").classList.add("hidden");

    // Poblar select de cultivos
    const selectCultivo = document.getElementById("select-cultivo-reporte");
    if (selectCultivo) {
        selectCultivo.innerHTML = `<option value="">Todos los cultivos (general)</option>` +
            cultivosDisponibles.map(c => `<option value="${c.id_cultivo}">${c.nombre}</option>`).join("");
    }

    // Fechas por defecto: últimos 7 días
    const hoy = new Date();
    const hace7 = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000);

    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

    document.getElementById("input-fecha-desde").value = fmt(hace7);
    document.getElementById("input-fecha-hasta").value = fmt(hoy);

    modal.classList.remove("hidden");
    modal.classList.add("flex");
}

function cerrarModalReporte() {
    const modal = document.getElementById("modal-reporte");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
}

async function guardarReporte(event) {
    event.preventDefault();

    const btn = document.getElementById("btn-crear-reporte");
    const errorBox = document.getElementById("error-reporte");
    const tipo = document.getElementById("select-tipo-reporte").value;
    const formato = document.getElementById("select-formato-reporte").value;
    const cultivoId = document.getElementById("select-cultivo-reporte").value;
    const fechaDesde = document.getElementById("input-fecha-desde").value;
    const fechaHasta = document.getElementById("input-fecha-hasta").value;

    if (!tipo) { mostrarErrorReporte("Seleccioná un tipo de reporte"); return; }
    if (!formato) { mostrarErrorReporte("Seleccioná un formato"); return; }
    if (!fechaDesde) { mostrarErrorReporte("Falta la fecha desde"); return; }
    if (!fechaHasta) { mostrarErrorReporte("Falta la fecha hasta"); return; }
    if (new Date(fechaDesde) > new Date(fechaHasta)) {
        mostrarErrorReporte("La fecha desde no puede ser mayor que la hasta");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Generando...`;
    lucide.createIcons();
    errorBox.classList.add("hidden");

    try {
        const datos = {
            tipo: tipo,
            formato: formato,
            fecha_desde: fechaDesde,
            fecha_hasta: fechaHasta,
        };

        if (cultivoId) datos.cultivo = parseInt(cultivoId);

        await apiPost("/reportes/", datos);

        // Recargar la lista
        const resp = await apiGet("/reportes/");
        reportes = Array.isArray(resp) ? resp : (resp.results || []);
        reportes.sort((a, b) => new Date(b.fecha_solicitud) - new Date(a.fecha_solicitud));
        reportesFiltrados = [...reportes];

        renderTabla();
        renderContador();
        renderStats();
        cerrarModalReporte();

    } catch (err) {
        console.error(err);
        let msg = "Error al generar el reporte";
        try {
            const partes = err.message.split(": ");
            const json = JSON.parse(partes.slice(1).join(": "));
            if (typeof json === "object") {
                msg = Object.entries(json).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" · ");
            }
        } catch (e) {}
        mostrarErrorReporte(msg);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="file-text" class="w-4 h-4"></i> Generar reporte`;
        lucide.createIcons();
    }
}

function mostrarErrorReporte(msg) {
    const box = document.getElementById("error-reporte");
    box.textContent = msg;
    box.classList.remove("hidden");
}

// ============================================================
// MODAL DETALLE
// ============================================================

function abrirModalDetalle(reporte) {
    const modal = document.getElementById("modal-detalle-reporte");
    if (!modal) return;

    const estado = ESTADO_CONFIG[reporte.estado] || ESTADO_CONFIG.pendiente;
    const tipoConf = TIPO_REPORTE_CONFIG[reporte.tipo] || { label: reporte.tipo_display, icono: "file-text" };
    const cultivoNombre = reporte.cultivo_nombre || "General";

    const header = document.getElementById("modal-detalle-header");
    header.innerHTML = `
        <div class="flex items-start gap-3">
            <div class="w-12 h-12 bg-brand-light rounded-xl flex items-center justify-center flex-shrink-0">
                <i data-lucide="${tipoConf.icono}" class="w-6 h-6 text-brand"></i>
            </div>
            <div>
                <h3 class="font-serif text-xl font-bold text-gray-900">${reporte.tipo_display || tipoConf.label}</h3>
                <p class="text-xs text-gray-500 mt-0.5">Reporte #${reporte.id}</p>
            </div>
        </div>
    `;

    const body = document.getElementById("modal-detalle-body");
    body.innerHTML = `
        <div class="space-y-3 text-sm">
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <p class="text-xs text-gray-500 mb-0.5">Estado</p>
                    <span class="inline-flex items-center gap-1 ${estado.badgeBg} ${estado.badgeText} text-xs font-semibold px-2 py-0.5 rounded-full">
                        ${estado.label}
                    </span>
                </div>
                <div>
                    <p class="text-xs text-gray-500 mb-0.5">Formato</p>
                    <p class="font-medium text-gray-900">${(reporte.formato_display || reporte.formato).toUpperCase()}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500 mb-0.5">Cultivo</p>
                    <p class="font-medium text-gray-900">${cultivoNombre}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500 mb-0.5">Registros</p>
                    <p class="font-medium text-gray-900">${reporte.total_registros || 0}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500 mb-0.5">Desde</p>
                    <p class="font-medium text-gray-900">${formatearFecha(reporte.fecha_desde)}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500 mb-0.5">Hasta</p>
                    <p class="font-medium text-gray-900">${formatearFecha(reporte.fecha_hasta)}</p>
                </div>
            </div>

            <div class="pt-3 border-t border-gray-100">
                <p class="text-xs text-gray-500 mb-1">Fecha de solicitud</p>
                <p class="text-gray-700">${formatearFechaHora(reporte.fecha_solicitud)}</p>
            </div>

            ${reporte.fecha_generacion ? `
                <div>
                    <p class="text-xs text-gray-500 mb-1">Fecha de generación</p>
                    <p class="text-gray-700">${formatearFechaHora(reporte.fecha_generacion)}</p>
                </div>
            ` : ""}

            ${reporte.error_detalle ? `
                <div class="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p class="text-xs font-semibold text-red-800 mb-1">Error</p>
                    <p class="text-xs text-red-700">${reporte.error_detalle}</p>
                </div>
            ` : ""}

            ${reporte.url_descarga ? `
                <a href="${reporte.url_descarga}" download class="mt-4 flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white font-semibold py-2.5 rounded-xl text-sm transition">
                    <i data-lucide="download" class="w-4 h-4"></i>
                    Descargar reporte
                </a>
            ` : ""}
        </div>
    `;

    modal.classList.remove("hidden");
    modal.classList.add("flex");

    lucide.createIcons();
}

// ---------- Eliminar ----------
async function eliminarReporte(id) {
    const reporte = reportes.find(r => r.id === id);
    if (!reporte) return;

    if (!confirm(`¿Eliminar el reporte "${reporte.tipo_display}"?\n\nEsta acción no se puede deshacer.`)) return;

    try {
        const res = await fetch(`/api/reportes/${id}/`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${localStorage.getItem("access_token")}` },
        });

        if (!res.ok) throw new Error(`DELETE → ${res.status}`);

        // Recargar
        reportes = reportes.filter(r => r.id !== id);
        reportesFiltrados = reportesFiltrados.filter(r => r.id !== id);
        renderTabla();
        renderContador();
        renderStats();

    } catch (err) {
        alert(`Error al eliminar: ${err.message}`);
    }
}

// ---------- Iniciar ----------
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", cargarReportes);
} else {
    cargarReportes();
}