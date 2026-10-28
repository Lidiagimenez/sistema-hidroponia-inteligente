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

        const resp = await apiGet("/dispositivos/");
        dispositivos = Array.isArray(resp) ? resp : (resp.results || []);
        
        // 🔥 ORDENAMIENTO: El más nuevo (mayor ID) primero
        dispositivos.sort((a, b) => b.id - a.id);
        
        dispositivosFiltrados = [...dispositivos];

        renderTabla();
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

    select.innerHTML = `<option value="">Todos los cultivos (general)</option>` +
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

        const cultivoNombre = escapeHtml(cultivosMap[d.cultivo] || "General");
        const tipoStr = escapeHtml(d.tipo_dispositivo || "—");
        const hardwareId = escapeHtml(d.identificador_hardware || "—");

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
                        <!-- BOTÓN LLAVE -->
                        <button class="btn-regenerar p-1.5 hover:bg-amber-50 hover:text-amber-600 rounded-lg transition text-gray-500" data-id="${d.id}" title="Regenerar API key">
                            <i data-lucide="key" class="w-4 h-4"></i>
                        </button>
                        
                        <!-- BOTÓN EDITAR -->
                        <button class="btn-item-editar p-1.5 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition text-gray-500" data-id="${d.id}" title="Editar dispositivo">
                            <i data-lucide="pencil" class="w-4 h-4"></i>
                        </button>

                        <!-- BOTÓN ELIMINAR (TACHITO) -->
                        <button class="btn-item-eliminar p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition" data-id="${d.id}" title="Eliminar dispositivo">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    lucide.createIcons();

    tbody.querySelectorAll(".btn-regenerar").forEach(btn => {
        btn.addEventListener("click", () => regenerarApiKey(parseInt(btn.dataset.id)));
    });

    tbody.querySelectorAll(".btn-item-editar").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = parseInt(btn.dataset.id);
            const disp = dispositivos.find(d => d.id === id);
            if (disp) abrirModalEditarDispositivo(disp);
        });
    });

    tbody.querySelectorAll(".btn-item-eliminar").forEach(btn => {
        btn.addEventListener("click", () => eliminarDispositivo(parseInt(btn.dataset.id)));
    });
}

// ---------- Funciones de Modales ----------
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

    form?.addEventListener("submit", (e) => {
        e.preventDefault();
        guardarDispositivo(); // Abre el modal de confirmación
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

// ---------- Guardar (Crear/Editar) ----------
function guardarDispositivo() {
    const idEditar = document.getElementById("dispositivo-id-editar").value;
    const esEdicion = !!idEditar;
    const errorBox = document.getElementById("error-dispositivo");

    const nombre = document.getElementById("input-dispositivo-nombre").value.trim();
    const tipo = document.getElementById("select-dispositivo-tipo").value;
    const estado = document.getElementById("select-dispositivo-estado").value;
    const hardware = document.getElementById("input-dispositivo-hardware").value.trim();
    const cultivo = document.getElementById("select-dispositivo-cultivo").value;
    const ip = document.getElementById("input-dispositivo-ip").value.trim();

    if (!nombre || !tipo || !estado || !hardware) {
        if (errorBox) {
            errorBox.textContent = "Por favor completa los campos requeridos (*)";
            errorBox.classList.remove("hidden");
        }
        return;
    }

    const payload = {
        nombre,
        tipo_dispositivo: tipo,
        estado,
        identificador_hardware: hardware,
        cultivo: cultivo ? parseInt(cultivo) : null,
        ip_local: ip || null,
    };

    if (errorBox) errorBox.classList.add("hidden");

    // 🔥 MODAL DE CONFIRMACIÓN
    confirmarAccion({
        titulo: esEdicion ? "Guardar cambios" : "Agregar dispositivo",
        mensaje: esEdicion ? `¿Estás seguro de guardar los cambios en el dispositivo "${nombre}"?` : `¿Estás seguro de agregar el dispositivo "${nombre}"?`,
        textoConfirmar: esEdicion ? "Sí, guardar" : "Sí, agregar",
        esPeligroso: false,
        onConfirm: () => ejecutarGuardadoDispositivo(idEditar, esEdicion, payload)
    });
}

async function ejecutarGuardadoDispositivo(idEditar, esEdicion, payload) {
    const btn = document.getElementById("btn-guardar-dispositivo");
    const errorBox = document.getElementById("error-dispositivo");

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> ${esEdicion ? "Guardando..." : "Creando..."}`;
        lucide.createIcons();
    }
    if (errorBox) errorBox.classList.add("hidden");

    try {
        if (esEdicion) {
            await apiPatch(`/dispositivos/${idEditar}/`, payload);
        } else {
            payload.is_active = payload.estado !== "inactivo";
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

// ---------- Regenerar API key ----------
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

// ---------- Eliminar (Soft Delete) ----------
function eliminarDispositivo(id) {
    const d = dispositivos.find(item => item.id === id);
    if (!d) return;

    confirmarAccion({
        titulo: "Eliminar dispositivo",
        mensaje: `El dispositivo "${d.nombre}" dejará de verse en la lista, pero se conservará su historial en la base de datos.`,
        textoConfirmar: "Eliminar",
        esPeligroso: true,
        onConfirm: async () => {
            try {
                await apiDelete(`/dispositivos/${id}/`);
                await cargarDispositivos();
            } catch (err) {
                alert(`Error al eliminar: ${err.message}`);
            }
        }
    });
}

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