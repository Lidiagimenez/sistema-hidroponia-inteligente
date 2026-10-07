// ============================================================
// dispositivos.js — Carga dinámica de Dispositivos
// ============================================================

let dispositivos = [];
let cultivosMap = {};

// ---------- Cargar todo ----------
async function cargarDispositivos() {
    const tbody = document.getElementById("tbody-dispositivos");
    if (!tbody) return;

    try {
        tbody.innerHTML = `
            <tr><td colspan="7" class="py-8 text-center text-gray-400 text-sm">
                <i data-lucide="loader" class="w-5 h-5 mx-auto mb-2 animate-spin"></i>
                Cargando dispositivos...
            </td></tr>
        `;
        lucide.createIcons();

        // Cargar cultivos para el mapa de nombres
        try {
            const respCultivos = await apiGet("/cultivos/");
            const listaCultivos = Array.isArray(respCultivos) ? respCultivos : (respCultivos.results || []);
            cultivosMap = {};
            listaCultivos.forEach(c => { cultivosMap[c.id_cultivo] = c.nombre; });
        } catch (err) {
            cultivosMap = {};
        }

        // Cargar dispositivos
        const resp = await apiGet("/dispositivos/");
        dispositivos = Array.isArray(resp) ? resp : (resp.results || []);

        renderTabla();
        renderStats();
        renderContador();
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `
            <tr><td colspan="7" class="py-8 text-center text-red-500 text-sm">
                Error: ${err.message}
            </td></tr>
        `;
    }
}

// ---------- Renderizar tabla ----------
function renderTabla() {
    const tbody = document.getElementById("tbody-dispositivos");

    if (dispositivos.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="7" class="py-12 text-center">
                <i data-lucide="cpu" class="w-10 h-10 text-gray-300 mx-auto mb-2"></i>
                <p class="text-sm text-gray-500">No hay dispositivos registrados.</p>
            </td></tr>
        `;
        lucide.createIcons();
        return;
    }

    tbody.innerHTML = dispositivos.map(d => {
        let estadoBadge = "";
        if (d.estado === "activo") {
            estadoBadge = `<span class="inline-flex items-center gap-1 bg-green-100 text-green-800 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"><span class="w-1 h-1 bg-green-600 rounded-full"></span>Online</span>`;
        } else if (d.estado === "inactivo") {
            estadoBadge = `<span class="inline-flex items-center gap-1 bg-red-100 text-red-800 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"><span class="w-1 h-1 bg-red-600 rounded-full"></span>Offline</span>`;
        } else {
            estadoBadge = `<span class="inline-flex items-center gap-1 bg-orange-100 text-orange-800 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"><span class="w-1 h-1 bg-orange-600 rounded-full"></span>${d.estado}</span>`;
        }

        const cultivoNombre = cultivosMap[d.cultivo] || "—";
        const tipoStr = d.tipo_dispositivo || "—";
        const hardwareId = d.identificador_hardware || "—";

        return `
            <tr class="hover:bg-gray-50">
                <td class="py-3 px-3">
                    <p class="text-gray-900 font-medium">${d.nombre}</p>
                    <p class="text-xs text-gray-500">${hardwareId}</p>
                </td>
                <td class="py-3 px-3 text-gray-700 text-xs">${tipoStr}</td>
                <td class="py-3 px-3 text-gray-700 text-xs">${cultivoNombre}</td>
                <td class="py-3 px-3">${estadoBadge}</td>
                <td class="py-3 px-3 text-gray-600 text-xs whitespace-nowrap">
                    ${d.fecha_alta ? tiempoRelativo(d.fecha_alta) : "—"}
                </td>
                <td class="py-3 px-3 text-gray-700 text-xs font-medium">
                    ${d.ip_local || "—"}
                </td>
                <td class="py-3 px-3">
                    <div class="flex items-center gap-1">
                        <button class="btn-regenerar p-1.5 hover:bg-gray-100 rounded transition" data-id="${d.id}" title="Regenerar API key">
                            <i data-lucide="key" class="w-4 h-4 text-gray-500"></i>
                        </button>
                        <button class="p-1.5 hover:bg-gray-100 rounded transition" title="Configurar">
                            <i data-lucide="settings" class="w-4 h-4 text-gray-500"></i>
                        </button>
                        <button class="p-1.5 hover:bg-gray-100 rounded transition" title="Más">
                            <i data-lucide="more-vertical" class="w-4 h-4 text-gray-500"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    lucide.createIcons();

    document.querySelectorAll(".btn-regenerar").forEach(btn => {
        btn.addEventListener("click", () => regenerarApiKey(parseInt(btn.dataset.id)));
    });
}

// ---------- Regenerar API key ----------
async function regenerarApiKey(id) {
    if (!confirm("¿Regenerar la API key? La anterior dejará de funcionar.")) return;

    try {
        const resp = await apiPost(`/dispositivos/${id}/regenerar-api-key/`, {});
        alert(`Nueva API key:\n\n${resp.api_key}\n\n⚠️ Guardala ahora: no se puede volver a ver.`);
    } catch (err) {
        alert(`Error: ${err.message}`);
    }
}

// ---------- Stats inferiores ----------
function renderStats() {
    const total = dispositivos.length;
    const online = dispositivos.filter(d => d.estado === "activo").length;
    const offline = dispositivos.filter(d => d.estado === "inactivo").length;
    const mantenimiento = total - online - offline;

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set("stat-total", total);
    set("stat-online", online);
    set("stat-offline", offline);
    set("stat-mantenimiento", mantenimiento);

    const pctOnline = total > 0 ? Math.round((online / total) * 100) : 0;
    const pctOffline = total > 0 ? Math.round((offline / total) * 100) : 0;
    const pctMant = total > 0 ? Math.round((mantenimiento / total) * 100) : 0;

    set("stat-online-pct", `${pctOnline}% del total`);
    set("stat-offline-pct", `${pctOffline}% del total`);
    set("stat-mant-pct", `${pctMant}% del total`);
}

// ---------- Contador ----------
function renderContador() {
    const contador = document.getElementById("contador-dispositivos");
    if (contador) contador.textContent = `Mostrando 1 - ${dispositivos.length} de ${dispositivos.length} dispositivos`;
}

// ---------- Iniciar ----------
// El script se carga al final del body, el DOM ya está listo
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", cargarDispositivos);
} else {
    cargarDispositivos();
}
