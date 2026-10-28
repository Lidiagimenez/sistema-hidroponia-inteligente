// ============================================================
// dispositivos.js — Carga dinámica, filtros y gestión de Dispositivos
// ============================================================

let dispositivos = [];
let dispositivosFiltrados = [];
let cultivosLista = [];
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

        // Cargar cultivos para el mapa de nombres y selectores
        try {
            const respCultivos = await apiGet("/cultivos/");
            cultivosLista = Array.isArray(respCultivos) ? respCultivos : (respCultivos.results || []);
            cultivosMap = {};
            cultivosLista.forEach(c => { cultivosMap[c.id_cultivo] = c.nombre; });
            actualizarSelectCultivos();
        } catch (err) {
            cultivosMap = {};
            cultivosLista = [];
        }

        // Cargar dispositivos
        const resp = await apiGet("/dispositivos/?incluir_inactivos=1");
        dispositivos = Array.isArray(resp) ? resp : (resp.results || []);
        dispositivosFiltrados = [...dispositivos];

        renderTabla();
        renderStats();
        renderContador();
        configurarFiltros();
        configurarModalDispositivo();
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `
            <tr><td colspan="7" class="py-8 text-center text-red-500 text-sm">
                Error al cargar dispositivos: ${err.message}
            </td></tr>
        `;
    }
}

// ---------- Select de cultivos en modal ----------
function actualizarSelectCultivos() {
    const select = document.getElementById("select-dispositivo-cultivo");
    if (!select) return;

    select.innerHTML = `<option value="">Selecciona un cultivo...</option>` +
        cultivosLista.map(c => `
            <option value="${c.id_cultivo}">${escapeHtml(c.nombre)} (${escapeHtml(c.tipo_cultivo || "Sin tipo")})</option>
        `).join("");
}

// ---------- Filtros y Búsqueda ----------
function configurarFiltros() {
    const inputBuscar = document.getElementById("input-buscar-dispositivo");
    const filtroTipo = document.getElementById("filtro-tipo-dispositivo");
    const filtroEstado = document.getElementById("filtro-estado-dispositivo");

    const aplicarFiltros = () => {
        const query = (inputBuscar?.value || "").toLowerCase().trim();
        const tipo = filtroTipo?.value || "";
        const estado = filtroEstado?.value || "";

        dispositivosFiltrados = dispositivos.filter(d => {
            const coincideTexto = !query ||
                (d.nombre || "").toLowerCase().includes(query) ||
                (d.identificador_hardware || "").toLowerCase().includes(query) ||
                (d.ip_local || "").toLowerCase().includes(query) ||
                (cultivosMap[d.cultivo] || "").toLowerCase().includes(query);

            const coincideTipo = !tipo || d.tipo_dispositivo === tipo;
            const coincideEstado = !estado || d.estado === estado;

            return coincideTexto && coincideTipo && coincideEstado;
        });

        renderTabla();
        renderContador();
    };

    inputBuscar?.addEventListener("input", aplicarFiltros);
    filtroTipo?.addEventListener("change", aplicarFiltros);
    filtroEstado?.addEventListener("change", aplicarFiltros);
}

// ---------- Renderizar tabla ----------
function renderTabla() {
    const tbody = document.getElementById("tbody-dispositivos");
    if (!tbody) return;

    if (dispositivosFiltrados.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="7" class="py-12 text-center">
                <i data-lucide="cpu" class="w-10 h-10 text-gray-300 mx-auto mb-2"></i>
                <p class="text-sm text-gray-500">No se encontraron dispositivos.</p>
            </td></tr>
        `;
        lucide.createIcons();
        return;
    }

    tbody.innerHTML = dispositivosFiltrados.map(d => {
        let estadoBadge = "";
        if (d.estado === "activo") {
            estadoBadge = `<span class="inline-flex items-center gap-1 bg-green-100 text-green-800 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"><span class="w-1 h-1 bg-green-600 rounded-full"></span>Online</span>`;
        } else if (d.estado === "inactivo") {
            estadoBadge = `<span class="inline-flex items-center gap-1 bg-red-100 text-red-800 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"><span class="w-1 h-1 bg-red-600 rounded-full"></span>Offline</span>`;
        } else {
            estadoBadge = `<span class="inline-flex items-center gap-1 bg-orange-100 text-orange-800 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"><span class="w-1 h-1 bg-orange-600 rounded-full"></span>${escapeHtml(d.estado)}</span>`;
        }

        const cultivoNombre = escapeHtml(cultivosMap[d.cultivo] || "—");
        const tipoStr = escapeHtml(d.tipo_dispositivo || "—");
        const hardwareId = escapeHtml(d.identificador_hardware || "—");
        const esInactivo = d.estado === "inactivo";

        return `
            <tr class="hover:bg-gray-50">
                <td class="py-3 px-3">
                    <p class="text-gray-900 font-medium">${escapeHtml(d.nombre)}</p>
                    <p class="text-xs text-gray-500">${hardwareId}</p>
                </td>
                <td class="py-3 px-3 text-gray-700 text-xs uppercase">${tipoStr}</td>
                <td class="py-3 px-3 text-gray-700 text-xs">${cultivoNombre}</td>
                <td class="py-3 px-3">${estadoBadge}</td>
                <td class="py-3 px-3 text-gray-600 text-xs whitespace-nowrap">
                    ${d.fecha_alta ? tiempoRelativo(d.fecha_alta) : "—"}
                </td>
                <td class="py-3 px-3 text-gray-700 text-xs font-mono">
                    ${escapeHtml(d.ip_local || "—")}
                </td>
                <td class="py-3 px-3 text-right">
                    <div class="flex items-center justify-end gap-1">
                        <button class="btn-regenerar p-1.5 hover:bg-amber-50 hover:text-amber-600 rounded-lg transition text-gray-500" data-id="${d.id}" title="Regenerar API key">
                            <i data-lucide="key" class="w-4 h-4"></i>
                        </button>
                        <div class="relative inline-block text-left menu-dispositivo-wrapper">
                            <button
                                type="button"
                                class="btn-menu-trigger p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-500 hover:text-gray-800"
                                data-id="${d.id}"
                                title="Opciones"
                            >
                                <i data-lucide="more-vertical" class="w-4 h-4"></i>
                            </button>
                            <div class="menu-dropdown hidden absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-30">
                                <button
                                    type="button"
                                    class="btn-item-editar w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition"
                                    data-id="${d.id}"
                                >
                                    <i data-lucide="pencil" class="w-3.5 h-3.5 text-blue-600"></i>
                                    Editar datos
                                </button>
                                <button
                                    type="button"
                                    class="btn-item-toggle w-full text-left px-3 py-2 text-xs ${esInactivo ? 'text-green-700 hover:bg-green-50' : 'text-amber-700 hover:bg-amber-50'} flex items-center gap-2 transition"
                                    data-id="${d.id}"
                                >
                                    <i data-lucide="${esInactivo ? 'power' : 'power-off'}" class="w-3.5 h-3.5"></i>
                                    ${esInactivo ? 'Activar dispositivo' : 'Desactivar dispositivo'}
                                </button>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    lucide.createIcons();

    // Eventos regenerar API key
    tbody.querySelectorAll(".btn-regenerar").forEach(btn => {
        btn.addEventListener("click", () => regenerarApiKey(parseInt(btn.dataset.id)));
    });

    // Eventos menú 3 puntitos
    tbody.querySelectorAll(".btn-menu-trigger").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const wrapper = btn.closest(".menu-dispositivo-wrapper");
            const dropdown = wrapper.querySelector(".menu-dropdown");
            const estaAbierto = !dropdown.classList.contains("hidden");

            document.querySelectorAll(".menu-dispositivo-wrapper .menu-dropdown").forEach(d => d.classList.add("hidden"));
            if (!estaAbierto) dropdown.classList.remove("hidden");
        });
    });

    tbody.querySelectorAll(".btn-item-editar").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            document.querySelectorAll(".menu-dispositivo-wrapper .menu-dropdown").forEach(d => d.classList.add("hidden"));
            const id = parseInt(btn.dataset.id);
            const disp = dispositivos.find(d => d.id === id);
            if (disp) abrirModalEditarDispositivo(disp);
        });
    });

    tbody.querySelectorAll(".btn-item-toggle").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            document.querySelectorAll(".menu-dispositivo-wrapper .menu-dropdown").forEach(d => d.classList.add("hidden"));
            const id = parseInt(btn.dataset.id);
            const disp = dispositivos.find(d => d.id === id);
            if (disp) confirmarToggleDispositivo(disp);
        });
    });
}

// Cerrar menús al clickear afuera
document.addEventListener("click", () => {
    document.querySelectorAll(".menu-dispositivo-wrapper .menu-dropdown").forEach(d => d.classList.add("hidden"));
});

// ---------- Modal Crear / Editar Dispositivo ----------
function configurarModalDispositivo() {
    const modal = document.getElementById("modal-dispositivo");
    const btnAbrir = document.getElementById("btn-agregar-dispositivo");
    const btnCerrar = document.getElementById("btn-cerrar-modal-dispositivo");
    const btnCancelar = document.getElementById("btn-cancelar-dispositivo");
    const form = document.getElementById("form-dispositivo");

    btnAbrir?.addEventListener("click", abrirModalCrearDispositivo);
    btnCerrar?.addEventListener("click", cerrarModalDispositivo);
    btnCancelar?.addEventListener("click", cerrarModalDispositivo);

    modal?.addEventListener("click", (e) => {
        if (e.target === modal) cerrarModalDispositivo();
    });

    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        await guardarDispositivo();
    });
}

function abrirModalCrearDispositivo() {
    const modal = document.getElementById("modal-dispositivo");
    if (!modal) return;

    document.getElementById("form-dispositivo")?.reset();
    document.getElementById("dispositivo-id-editar").value = "";

    document.getElementById("modal-titulo-dispositivo").textContent = "Agregar dispositivo";
    document.getElementById("modal-subtitulo-dispositivo").textContent = "Configura los datos del nuevo dispositivo IoT.";
    document.getElementById("texto-guardar-dispositivo").textContent = "Agregar dispositivo";
    document.getElementById("icono-guardar-dispositivo").setAttribute("data-lucide", "plus");

    const inputHw = document.getElementById("input-dispositivo-hardware");
    if (inputHw) inputHw.removeAttribute("readonly");

    document.getElementById("error-dispositivo")?.classList.add("hidden");

    modal.classList.remove("hidden");
    modal.classList.add("flex");
    lucide.createIcons();
}

function abrirModalEditarDispositivo(d) {
    const modal = document.getElementById("modal-dispositivo");
    if (!modal || !d) return;

    document.getElementById("dispositivo-id-editar").value = d.id;
    document.getElementById("input-dispositivo-nombre").value = d.nombre || "";
    document.getElementById("select-dispositivo-tipo").value = d.tipo_dispositivo || "sensor";
    document.getElementById("select-dispositivo-estado").value = d.estado || "activo";
    document.getElementById("input-dispositivo-hardware").value = d.identificador_hardware || "";
    document.getElementById("select-dispositivo-cultivo").value = d.cultivo || "";
    document.getElementById("input-dispositivo-ip").value = d.ip_local || "";

    document.getElementById("modal-titulo-dispositivo").textContent = "Editar dispositivo";
    document.getElementById("modal-subtitulo-dispositivo").textContent = `Modificando los datos de "${d.nombre}".`;
    document.getElementById("texto-guardar-dispositivo").textContent = "Guardar cambios";
    document.getElementById("icono-guardar-dispositivo").setAttribute("data-lucide", "save");

    document.getElementById("error-dispositivo")?.classList.add("hidden");

    modal.classList.remove("hidden");
    modal.classList.add("flex");
    lucide.createIcons();
}

function cerrarModalDispositivo() {
    const modal = document.getElementById("modal-dispositivo");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    document.getElementById("form-dispositivo")?.reset();
    document.getElementById("dispositivo-id-editar").value = "";
}

// ---------- Guardar Dispositivo (POST o PATCH) ----------
async function guardarDispositivo() {
    const idEditar = document.getElementById("dispositivo-id-editar").value;
    const esEdicion = !!idEditar;
    const btn = document.getElementById("btn-guardar-dispositivo");
    const errorBox = document.getElementById("error-dispositivo");

    const nombre = document.getElementById("input-dispositivo-nombre").value.trim();
    const tipo = document.getElementById("select-dispositivo-tipo").value;
    const estado = document.getElementById("select-dispositivo-estado").value;
    const hardware = document.getElementById("input-dispositivo-hardware").value.trim();
    const cultivo = document.getElementById("select-dispositivo-cultivo").value;
    const ip = document.getElementById("input-dispositivo-ip").value.trim();

    if (!nombre || !tipo || !estado || !hardware || !cultivo) {
        if (errorBox) {
            errorBox.textContent = "Por favor completa todos los campos requeridos (*)";
            errorBox.classList.remove("hidden");
        }
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> ${esEdicion ? "Guardando..." : "Creando..."}`;
        lucide.createIcons();
    }
    if (errorBox) errorBox.classList.add("hidden");

    try {
        const payload = {
            nombre,
            tipo_dispositivo: tipo,
            estado,
            identificador_hardware: hardware,
            cultivo: parseInt(cultivo),
            ip_local: ip || null,
        };

        if (esEdicion) {
            await apiPatch(`/dispositivos/${idEditar}/`, payload);
        } else {
            payload.is_active = estado !== "inactivo";
            await apiPost("/dispositivos/", payload);
        }

        await cargarDispositivos();
        cerrarModalDispositivo();
    } catch (err) {
        console.error(err);
        let msg = err.message;
        try {
            const json = JSON.parse(msg.split(": ").slice(1).join(": "));
            if (typeof json === "object") {
                msg = Object.entries(json).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" · ");
            }
        } catch (e) {}

        if (errorBox) {
            errorBox.textContent = `Error: ${msg}`;
            errorBox.classList.remove("hidden");
        } else {
            alert(`Error: ${msg}`);
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            const esEditFinal = !!document.getElementById("dispositivo-id-editar")?.value;
            btn.innerHTML = esEditFinal
                ? `<i id="icono-guardar-dispositivo" data-lucide="save" class="w-4 h-4"></i> <span id="texto-guardar-dispositivo">Guardar cambios</span>`
                : `<i id="icono-guardar-dispositivo" data-lucide="plus" class="w-4 h-4"></i> <span id="texto-guardar-dispositivo">Agregar dispositivo</span>`;
            lucide.createIcons();
        }
    }
}

// ---------- Desactivar / Activar con Modal de Confirmación ----------
function confirmarToggleDispositivo(d) {
    const esInactivo = d.estado === "inactivo";
    const nuevoEstado = esInactivo ? "activo" : "inactivo";
    const accionTexto = esInactivo ? "activar" : "desactivar";

    confirmarAccion({
        titulo: `${esInactivo ? "Activar" : "Desactivar"} dispositivo`,
        mensaje: `¿Estás seguro de que deseas ${accionTexto} el dispositivo "${d.nombre}"?`,
        textoConfirmar: esInactivo ? "Activar" : "Desactivar",
        esPeligroso: !esInactivo,
        onConfirm: async () => {
            try {
                if (esInactivo) {
                    await apiPost(`/dispositivos/${d.id}/activar/`, {});
                } else {
                    await apiPost(`/dispositivos/${d.id}/desactivar/`, {});
                }
                await cargarDispositivos();
            } catch (err) {
                alert(`Error al cambiar estado del dispositivo: ${err.message}`);
            }
        }
    });
}

// ---------- Regenerar API key con Modal de Confirmación ----------
function regenerarApiKey(id) {
    const d = dispositivos.find(item => item.id === id);
    const nombre = d ? d.nombre : `ID ${id}`;

    confirmarAccion({
        titulo: "Regenerar API Key",
        mensaje: `¿Deseas regenerar la API key para "${nombre}"?\nLa clave anterior dejará de funcionar inmediatamente.`,
        textoConfirmar: "Regenerar clave",
        esPeligroso: true,
        onConfirm: async () => {
            try {
                const resp = await apiPost(`/dispositivos/${id}/regenerar-api-key/`, {});
                alert(`Nueva API key generada:\n\n${resp.api_key}\n\n⚠️ Guardala ahora: no se puede volver a consultar.`);
            } catch (err) {
                alert(`Error al regenerar API key: ${err.message}`);
            }
        }
    });
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
    if (contador) contador.textContent = `Mostrando ${dispositivosFiltrados.length} de ${dispositivos.length} dispositivos`;
}

// ---------- Iniciar ----------
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", cargarDispositivos);
} else {
    cargarDispositivos();
}
