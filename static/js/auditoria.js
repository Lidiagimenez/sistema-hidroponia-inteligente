// ============================================================
// auditoria.js — Eventos con filtros, export CSV y modal
// ============================================================

let eventos = [];
let eventosFiltrados = [];
let cultivosMap = {};
let dispositivosMap = {};

const TIPO_EVENTO_CONFIG = {
    "sensor_sin_comunicacion": {
        label: "Sensor sin comunicación",
        badgeBg: "bg-orange-100",
        badgeText: "text-orange-800",
        iconoBg: "bg-orange-100",
        iconoColor: "text-orange-600",
        icono: "wifi-off",
    },
    "corte_electrico": {
        label: "Corte de energía",
        badgeBg: "bg-red-100",
        badgeText: "text-red-800",
        iconoBg: "bg-red-100",
        iconoColor: "text-red-600",
        icono: "zap-off",
    },
    "bomba_sin_caudal": {
        label: "Bomba sin caudal",
        badgeBg: "bg-red-100",
        badgeText: "text-red-800",
        iconoBg: "bg-red-100",
        iconoColor: "text-red-600",
        icono: "droplet",
    },
};

// ---------- Cargar todo ----------
async function cargarAuditoria() {
    const tbody = document.getElementById("tbody-auditoria");
    if (!tbody) return;

    try {
        tbody.innerHTML = `
            <tr><td colspan="6" class="py-8 text-center text-gray-400 text-sm">
                <i data-lucide="loader" class="w-5 h-5 mx-auto mb-2 animate-spin"></i>
                Cargando eventos...
            </td></tr>
        `;
        lucide.createIcons();

        await Promise.all([
            cargarCultivos(),
            cargarDispositivos(),
        ]);

        const resp = await apiGet("/eventos/");
        eventos = Array.isArray(resp) ? resp : (resp.results || []);
        eventos.sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));

        eventosFiltrados = [...eventos];

        poblarFiltrosCultivos();

        renderTabla();
        renderContador();
        renderStats(eventos);
        configurarFiltros();
        configurarExportar();
        configurarCierreModal();
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `
            <tr><td colspan="6" class="py-8 text-center text-red-500 text-sm">
                Error al cargar eventos: ${err.message}
            </td></tr>
        `;
    }
}

// ---------- Catálogos ----------
async function cargarCultivos() {
    const resp = await apiGet("/cultivos/");
    const lista = Array.isArray(resp) ? resp : (resp.results || []);
    cultivosMap = {};
    lista.forEach(c => { cultivosMap[c.id_cultivo] = c.nombre; });
}

async function cargarDispositivos() {
    const resp = await apiGet("/dispositivos/");
    const lista = Array.isArray(resp) ? resp : (resp.results || []);
    dispositivosMap = {};
    lista.forEach(d => { dispositivosMap[d.id] = d.nombre; });
}

// ---------- Poblar select de cultivos ----------
function poblarFiltrosCultivos() {
    const select = document.getElementById("filtro-cultivo");
    if (!select) return;

    const cultivosUnicos = new Set();
    eventos.forEach(e => {
        if (e.cultivo) cultivosUnicos.add(e.cultivo);
    });

    const opciones = Array.from(cultivosUnicos).map(id =>
        `<option value="${id}">${cultivosMap[id] || `Cultivo #${id}`}</option>`
    ).join("");

    select.innerHTML = `<option value="">Todos los cultivos</option>${opciones}`;
}

// ---------- Configurar filtros ----------
function configurarFiltros() {
    const filtroTipo = document.getElementById("filtro-tipo");
    const filtroCultivo = document.getElementById("filtro-cultivo");
    const filtroFecha = document.getElementById("filtro-fecha");
    const buscador = document.getElementById("filtro-buscar");

    function aplicarFiltros() {
        const tipo = filtroTipo?.value || "";
        const cultivoId = filtroCultivo?.value || "";
        const rangoFecha = filtroFecha?.value || "";
        const texto = (buscador?.value || "").toLowerCase().trim();

        eventosFiltrados = eventos.filter(e => {
            if (tipo && e.tipo_evento !== tipo) return false;
            if (cultivoId && String(e.cultivo) !== String(cultivoId)) return false;

            if (rangoFecha) {
                const fecha = new Date(e.fecha_hora);
                const ahora = new Date();
                const difDias = (ahora - fecha) / (1000 * 60 * 60 * 24);

                if (rangoFecha === "7" && difDias > 7) return false;
                if (rangoFecha === "30" && difDias > 30) return false;
                if (rangoFecha === "mes" && fecha.getMonth() !== ahora.getMonth()) return false;
            }

            if (texto) {
                const cultivoNombre = (cultivosMap[e.cultivo] || "").toLowerCase();
                const dispNombre = (dispositivosMap[e.dispositivo] || "").toLowerCase();
                const descripcion = (e.descripcion || "").toLowerCase();
                const tipoLabel = (TIPO_EVENTO_CONFIG[e.tipo_evento]?.label || "").toLowerCase();

                if (!cultivoNombre.includes(texto) &&
                    !dispNombre.includes(texto) &&
                    !descripcion.includes(texto) &&
                    !tipoLabel.includes(texto)) {
                    return false;
                }
            }

            return true;
        });

        renderTabla();
        renderContador();
        renderStats(eventosFiltrados);
    }

    [filtroTipo, filtroCultivo, filtroFecha].forEach(el => {
        el?.addEventListener("change", aplicarFiltros);
    });

    buscador?.addEventListener("input", aplicarFiltros);
}

// ---------- Renderizar tabla ----------
function renderTabla() {
    const tbody = document.getElementById("tbody-auditoria");

    if (eventosFiltrados.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="6" class="py-12 text-center">
                <i data-lucide="search-x" class="w-10 h-10 text-gray-300 mx-auto mb-2"></i>
                <p class="text-sm text-gray-500">No hay eventos que coincidan con los filtros.</p>
            </td></tr>
        `;
        lucide.createIcons();
        return;
    }

    tbody.innerHTML = eventosFiltrados.map(e => {
        const config = TIPO_EVENTO_CONFIG[e.tipo_evento] || {
            label: e.tipo_evento,
            badgeBg: "bg-gray-100",
            badgeText: "text-gray-800",
            iconoBg: "bg-gray-100",
            iconoColor: "text-gray-600",
            icono: "info",
        };

        const cultivoNombre = cultivosMap[e.cultivo] || `Cultivo #${e.cultivo}`;
        const dispositivoNombre = e.dispositivo
            ? (dispositivosMap[e.dispositivo] || `Disp #${e.dispositivo}`)
            : "—";

        const fechaStr = formatearFechaHora(e.fecha_hora);

        return `
            <tr class="hover:bg-gray-50">
                <td class="py-3 px-3 text-gray-700 whitespace-nowrap text-xs">${fechaStr}</td>
                <td class="py-3 px-3">
                    <div class="flex items-center gap-2">
                        <div class="w-7 h-7 ${config.iconoBg} rounded-lg flex items-center justify-center flex-shrink-0">
                            <i data-lucide="${config.icono}" class="w-3.5 h-3.5 ${config.iconoColor}"></i>
                        </div>
                        <span class="inline-flex items-center gap-1 ${config.badgeBg} ${config.badgeText} text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                            ${config.label}
                        </span>
                    </div>
                </td>
                <td class="py-3 px-3 text-gray-700 text-xs">${cultivoNombre}</td>
                <td class="py-3 px-3 text-gray-600 text-xs">${dispositivoNombre}</td>
                <td class="py-3 px-3 text-gray-600 text-xs max-w-md truncate" title="${e.descripcion || ''}">
                    ${e.descripcion || "Sin descripción"}
                </td>
                <td class="py-3 px-3">
                    <button class="btn-ver-evento p-1.5 hover:bg-gray-100 rounded transition" data-id="${e.id}" title="Ver detalle">
                        <i data-lucide="chevron-right" class="w-4 h-4 text-gray-400"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join("");

    // Event listeners
    document.querySelectorAll(".btn-ver-evento").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.id);
            const evento = eventos.find(ev => ev.id === id);
            if (evento) abrirModalEvento(evento);
        });
    });

    lucide.createIcons();
}

// ---------- Contador ----------
function renderContador() {
    const contador = document.getElementById("contador-auditoria");
    if (contador) {
        const total = eventos.length;
        const filtrado = eventosFiltrados.length;
        if (filtrado === total) {
            contador.textContent = `Mostrando 1 - ${total} de ${total} eventos`;
        } else {
            contador.textContent = `Mostrando ${filtrado} de ${total} eventos (filtrados)`;
        }
    }
}

// ---------- Stats ----------
function renderStats(lista) {
    const conteo = {
        sensor_sin_comunicacion: 0,
        corte_electrico: 0,
        bomba_sin_caudal: 0,
    };
    lista.forEach(e => {
        if (conteo[e.tipo_evento] !== undefined) conteo[e.tipo_evento]++;
    });

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set("stat-total", lista.length);
    set("stat-sensor", conteo.sensor_sin_comunicacion);
    set("stat-corte", conteo.corte_electrico);
    set("stat-bomba", conteo.bomba_sin_caudal);
}

// ---------- Exportar CSV ----------
function configurarExportar() {
    const btn = document.getElementById("btn-exportar");
    if (!btn) return;

    btn.addEventListener("click", () => {
        if (eventosFiltrados.length === 0) {
            alert("No hay eventos para exportar.");
            return;
        }

        const headers = ["Fecha y hora", "Tipo de evento", "Cultivo", "Dispositivo", "Descripción"];

        const filas = eventosFiltrados.map(e => {
            const config = TIPO_EVENTO_CONFIG[e.tipo_evento] || { label: e.tipo_evento };
            return [
                formatearFechaHora(e.fecha_hora),
                config.label,
                cultivosMap[e.cultivo] || `Cultivo #${e.cultivo}`,
                e.dispositivo ? (dispositivosMap[e.dispositivo] || `Disp #${e.dispositivo}`) : "—",
                e.descripcion || "Sin descripción",
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

function abrirModalEvento(evento) {
    const modal = document.getElementById("modal-evento");
    if (!modal) return;

    const config = TIPO_EVENTO_CONFIG[evento.tipo_evento] || {
        label: evento.tipo_evento,
        badgeBg: "bg-gray-100",
        badgeText: "text-gray-800",
        iconoBg: "bg-gray-100",
        iconoColor: "text-gray-600",
        icono: "info",
    };

    const cultivoNombre = cultivosMap[evento.cultivo] || `Cultivo #${evento.cultivo}`;
    const dispositivoNombre = evento.dispositivo
        ? (dispositivosMap[evento.dispositivo] || `Disp #${evento.dispositivo}`)
        : "—";

    const header = document.getElementById("modal-evento-header");
    header.innerHTML = `
        <div class="flex items-start gap-3">
            <div class="w-12 h-12 ${config.iconoBg} rounded-xl flex items-center justify-center flex-shrink-0">
                <i data-lucide="${config.icono}" class="w-6 h-6 ${config.iconoColor}"></i>
            </div>
            <div>
                <h3 class="font-serif text-xl font-bold text-gray-900">${config.label}</h3>
                <p class="text-xs text-gray-500 mt-0.5">Evento #${evento.id}</p>
            </div>
        </div>
    `;

    const body = document.getElementById("modal-evento-body");
    body.innerHTML = `
        <div class="space-y-3 text-sm">

            <div>
                <p class="text-xs text-gray-500 mb-0.5">Fecha y hora</p>
                <p class="font-medium text-gray-900">${formatearFechaHora(evento.fecha_hora)}</p>
            </div>

            <div>
                <p class="text-xs text-gray-500 mb-0.5">Tipo de evento</p>
                <span class="inline-flex items-center ${config.badgeBg} ${config.badgeText} text-xs font-semibold px-2 py-0.5 rounded-full">
                    ${config.label}
                </span>
            </div>

            <div>
                <p class="text-xs text-gray-500 mb-0.5">Cultivo</p>
                <p class="font-medium text-gray-900">${cultivoNombre}</p>
            </div>

            <div>
                <p class="text-xs text-gray-500 mb-0.5">Dispositivo</p>
                <p class="font-medium text-gray-900">${dispositivoNombre}</p>
            </div>

            ${evento.ciclo ? `
                <div>
                    <p class="text-xs text-gray-500 mb-0.5">Ciclo de producción</p>
                    <p class="font-medium text-gray-900">Ciclo #${evento.ciclo}</p>
                </div>
            ` : ""}

            <div class="pt-3 border-t border-gray-100">
                <p class="text-xs text-gray-500 mb-1">Descripción</p>
                <p class="text-gray-700 leading-relaxed">${evento.descripcion || "Sin descripción"}</p>
            </div>

        </div>
    `;

    modal.classList.remove("hidden");
    modal.classList.add("flex");

    lucide.createIcons();
}

function cerrarModalEvento() {
    const modal = document.getElementById("modal-evento");
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