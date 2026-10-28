// ============================================================
// auditoria.js — Auditoría de acciones de usuario
// ============================================================

let registros = [];
let registrosFiltrados = [];

const ACCION_CONFIG = {
    "login": {
        label: "Login",
        badgeBg: "bg-green-100",
        badgeText: "text-green-800",
    },
    "logout": {
        label: "Logout",
        badgeBg: "bg-slate-100",
        badgeText: "text-slate-700",
    },
    "crear": {
        label: "Crear",
        badgeBg: "bg-blue-100",
        badgeText: "text-blue-800",
    },
    "editar": {
        label: "Editar",
        badgeBg: "bg-amber-100",
        badgeText: "text-amber-800",
    },
    "eliminar": {
        label: "Eliminar",
        badgeBg: "bg-red-100",
        badgeText: "text-red-800",
    },
    "login_fallido": {
        label: "Login fallido",
        badgeBg: "bg-purple-100",
        badgeText: "text-purple-800",
    },
};

function obtenerAccionConfig(registro) {
    const accion = registro.accion || "";
    const config = ACCION_CONFIG[accion];
    if (config) {
        return {
            label: registro.accion_display || config.label,
            badgeBg: config.badgeBg,
            badgeText: config.badgeText,
        };
    }
    return {
        label: registro.accion_display || accion,
        badgeBg: "bg-gray-100",
        badgeText: "text-gray-800",
    };
}

// ---------- Cargar todo ----------
async function cargarAuditoria() {
    const tbody = document.getElementById("tbody-auditoria");
    if (!tbody) return;

    try {
        tbody.innerHTML = `
            <tr><td colspan="7" class="py-8 text-center text-gray-400 text-sm">
                <i data-lucide="loader" class="w-5 h-5 mx-auto mb-2 animate-spin"></i>
                Cargando...
            </td></tr>
        `;
        lucide.createIcons();

        const resp = await apiGet("/auditoria/");
        registros = Array.isArray(resp) ? resp : (resp.results || []);
        registros.sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));

        registrosFiltrados = [...registros];

        renderTabla();
        renderContador();
        configurarFiltros();
        configurarExportar();
        configurarCierreModal();
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `
            <tr><td colspan="7" class="py-8 text-center text-red-500 text-sm">
                Error al cargar auditoría: ${err.message}
            </td></tr>
        `;
    }
}

// ---------- Configurar filtros ----------
function configurarFiltros() {
    const filtroAccion = document.getElementById("filtro-accion");
    const filtroFecha = document.getElementById("filtro-fecha");
    const buscador = document.getElementById("filtro-buscar");

    function aplicarFiltros() {
        const accion = filtroAccion?.value || "";
        const rangoFecha = filtroFecha?.value || "";
        const texto = (buscador?.value || "").toLowerCase().trim();

        registrosFiltrados = registros.filter(r => {
            if (accion && r.accion !== accion) return false;

            if (rangoFecha) {
                const fecha = new Date(r.fecha_hora);
                const ahora = new Date();
                const difDias = (ahora - fecha) / (1000 * 60 * 60 * 24);

                if (rangoFecha === "7" && difDias > 7) return false;
                if (rangoFecha === "30" && difDias > 30) return false;
                if (rangoFecha === "mes" && fecha.getMonth() !== ahora.getMonth()) return false;
            }

            if (texto) {
                const username = (r.usuario_username || "").toLowerCase();
                if (!username.includes(texto)) {
                    return false;
                }
            }

            return true;
        });

        renderTabla();
        renderContador();
    }

    [filtroAccion, filtroFecha].forEach(el => {
        el?.addEventListener("change", aplicarFiltros);
    });

    buscador?.addEventListener("input", aplicarFiltros);
}

// ---------- Renderizar tabla ----------
function renderTabla() {
    const tbody = document.getElementById("tbody-auditoria");

    if (registrosFiltrados.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="7" class="py-12 text-center">
                <i data-lucide="search-x" class="w-10 h-10 text-gray-300 mx-auto mb-2"></i>
                <p class="text-sm text-gray-500">No hay registros que coincidan con los filtros.</p>
            </td></tr>
        `;
        lucide.createIcons();
        return;
    }

    tbody.innerHTML = registrosFiltrados.map(r => {
        const config = obtenerAccionConfig(r);
        const fechaStr = formatearFechaHora(r.fecha_hora);
        const usuario = escapeHtml(r.usuario_username || "Anónimo");
        const entidad = escapeHtml(r.entidad || "—");
        const ip = escapeHtml(r.ip_address || "—");
        const detallesStr = r.detalles ? JSON.stringify(r.detalles) : "{}";
        const detallesPreview = detallesStr.length > 80 ? detallesStr.substring(0, 77) + "..." : detallesStr;

        return `
            <tr class="hover:bg-gray-50">
                <td class="py-3 px-3 text-gray-700 whitespace-nowrap text-xs">${fechaStr}</td>
                <td class="py-3 px-3 text-gray-700 text-xs">${usuario}</td>
                <td class="py-3 px-3">
                    <span class="inline-flex items-center gap-1 ${config.badgeBg} ${config.badgeText} text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                        ${escapeHtml(config.label)}
                    </span>
                </td>
                <td class="py-3 px-3 text-gray-700 text-xs">${entidad}</td>
                <td class="py-3 px-3 text-gray-600 text-xs max-w-xs truncate" title="${escapeHtml(detallesStr)}">
                    ${escapeHtml(detallesPreview)}
                </td>
                <td class="py-3 px-3 text-gray-600 text-xs">${ip}</td>
                <td class="py-3 px-3">
                    <button class="btn-ver-auditoria p-1.5 hover:bg-gray-100 rounded transition" data-id="${r.id}" title="Ver detalles">
                        <i data-lucide="eye" class="w-4 h-4 text-gray-400"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join("");

    document.querySelectorAll(".btn-ver-auditoria").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.id);
            const registro = registros.find(r => r.id === id);
            if (registro) abrirModalAuditoria(registro);
        });
    });

    lucide.createIcons();
}

// ---------- Contador ----------
function renderContador() {
    const contador = document.getElementById("contador-auditoria");
    if (contador) {
        const total = registros.length;
        const filtrado = registrosFiltrados.length;
        if (filtrado === total) {
            contador.textContent = `Mostrando ${total} registro${total === 1 ? "" : "s"}`;
        } else {
            contador.textContent = `Mostrando ${filtrado} de ${total} registros (filtrados)`;
        }
    }
}

// ---------- Exportar CSV ----------
function configurarExportar() {
    const btn = document.getElementById("btn-exportar");
    if (!btn) return;

    btn.addEventListener("click", () => {
        if (registrosFiltrados.length === 0) {
            alert("No hay registros para exportar.");
            return;
        }

        const headers = ["Fecha y Hora", "Usuario", "Acción", "Módulo/Entidad", "Detalles", "IP"];

        const filas = registrosFiltrados.map(r => {
            const config = obtenerAccionConfig(r);
            return [
                formatearFechaHora(r.fecha_hora),
                r.usuario_username || "Anónimo",
                config.label,
                r.entidad || "",
                JSON.stringify(r.detalles || {}),
                r.ip_address || "",
            ];
        });

        const csvContent = [
            headers.join(","),
            ...filas.map(fila => fila.map(celda => {
                const texto = String(celda).replace(/"/g, '""');
                return texto.includes(",") || texto.includes("\n") || texto.includes('"')
                    ? `"${texto}"`
                    : texto;
            }).join(",")),
        ].join("\n");

        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });

        const fecha = new Date();
        const fechaStr = `${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,"0")}-${String(fecha.getDate()).padStart(2,"0")}`;
        const nombreArchivo = `auditoria_${fechaStr}.csv`;

        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = nombreArchivo;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    });
}

// ============================================================
// MODAL DETALLE
// ============================================================

function abrirModalAuditoria(registro) {
    const modal = document.getElementById("modal-evento");
    if (!modal) return;

    const config = obtenerAccionConfig(registro);
    const body = document.getElementById("modal-evento-body");

    const detallesPretty = JSON.stringify(registro.detalles || {}, null, 2);

    body.innerHTML = `
        <div class="space-y-3 text-sm">
            <div>
                <p class="text-xs text-gray-500 mb-0.5">Fecha y Hora</p>
                <p class="font-medium text-gray-900">${formatearFechaHora(registro.fecha_hora)}</p>
            </div>
            <div>
                <p class="text-xs text-gray-500 mb-0.5">Usuario</p>
                <p class="font-medium text-gray-900">${escapeHtml(registro.usuario_username || "Anónimo")}</p>
            </div>
            <div>
                <p class="text-xs text-gray-500 mb-0.5">Acción</p>
                <span class="inline-flex items-center ${config.badgeBg} ${config.badgeText} text-xs font-semibold px-2 py-0.5 rounded-full">
                    ${escapeHtml(config.label)}
                </span>
            </div>
            <div>
                <p class="text-xs text-gray-500 mb-0.5">Módulo/Entidad</p>
                <p class="font-medium text-gray-900">${escapeHtml(registro.entidad || "—")}</p>
            </div>
            <div>
                <p class="text-xs text-gray-500 mb-0.5">Objeto ID</p>
                <p class="font-medium text-gray-900">${registro.objeto_id !== null && registro.objeto_id !== undefined ? registro.objeto_id : "—"}</p>
            </div>
            <div>
                <p class="text-xs text-gray-500 mb-0.5">IP</p>
                <p class="font-medium text-gray-900">${escapeHtml(registro.ip_address || "—")}</p>
            </div>
            <div class="pt-3 border-t border-gray-100">
                <p class="text-xs text-gray-500 mb-2">Detalles (JSON)</p>
                <pre class="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs overflow-x-auto text-gray-800">${escapeHtml(detallesPretty)}</pre>
            </div>
        </div>
    `;

    modal.classList.remove("hidden");
    modal.classList.add("flex");

    lucide.createIcons();
}

function cerrarModalEvento() {
    const modal = document.getElementById("modal-evento");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.classList.remove("flex");
}

function configurarCierreModal() {
    const modal = document.getElementById("modal-evento");
    if (!modal) return;

    document.getElementById("btn-cerrar-modal-evento")?.addEventListener("click", cerrarModalEvento);

    modal.addEventListener("click", (e) => {
        if (e.target === modal) cerrarModalEvento();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !modal.classList.contains("hidden")) {
            cerrarModalEvento();
        }
    });
}

// ---------- Iniciar ----------
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", cargarAuditoria);
} else {
    cargarAuditoria();
}
