// ============================================================
// configuracion-sensores.js — Gestión de Sensores y Umbrales
// ============================================================

let sensores = [];
let sensoresFiltrados = [];
let tiposMap = {};          // { tipo_id: { id, nombre, unidad } }
let dispositivosMap = {};   // { disp_id: { id, nombre, cultivo_id } }
let cultivosMap = {};       // { cultivo_id: nombre }
let rangosPorSensor = {};   // { sensor_id: rango_obj }
let sensorSeleccionado = null;
let filtrosListenersListos = false;
let selectoresListenersListos = false;
let origenTipoDesdeSensor = false;

// ---------- Toast de éxito ----------
function mostrarToastConfig(mensaje) {
    document.getElementById("toast-config-sensores")?.remove();

    const toast = document.createElement("div");
    toast.id = "toast-config-sensores";
    toast.className = "fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-green-600 text-white px-4 py-3 rounded-xl shadow-lg transition-all duration-300 opacity-0 translate-y-2";
    toast.innerHTML = `
        <i data-lucide="check-circle" class="w-5 h-5"></i>
        <span class="text-sm font-medium">${escapeHtml(mensaje)}</span>
    `;
    document.body.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    setTimeout(() => toast.classList.remove("opacity-0", "translate-y-2"), 10);
    setTimeout(() => {
        toast.classList.add("opacity-0", "translate-y-2");
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ---------- Config visual de iconos ----------
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
            <tr><td colspan="6" class="py-8 text-center text-gray-400 text-sm">
                <i data-lucide="loader" class="w-5 h-5 mx-auto mb-2 animate-spin"></i>
                Cargando configuración de sensores...
            </td></tr>
        `;
        lucide.createIcons();

        await Promise.all([
            cargarTipos(),
            cargarDispositivos(),
            cargarCultivos(),
        ]);

        await Promise.all([
            cargarSensores(),
            cargarRangos(),
        ]);

        sensoresFiltrados = [...sensores];
        poblarFiltros();
        poblarSelectoresModal();
        renderTabla();
        renderContador();
        configurarModal();
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `
            <tr><td colspan="6" class="py-8 text-center text-red-500 text-sm">
                Error al cargar sensores: ${err.message}
            </td></tr>
        `;
    }
}

// ---------- Catálogos ----------
async function cargarTipos() {
    const resp = await apiGet("/tipos-sensor/");
    const lista = Array.isArray(resp) ? resp : (resp.results || []);
    tiposMap = {};
    lista.forEach(t => { tiposMap[t.id] = { id: t.id, nombre: t.nombre, unidad: t.unidad_medida }; });
}

async function cargarDispositivos() {
    const resp = await apiGet("/dispositivos/?incluir_inactivos=1");
    const lista = Array.isArray(resp) ? resp : (resp.results || []);
    dispositivosMap = {};
    lista.forEach(d => { dispositivosMap[d.id] = { id: d.id, nombre: d.nombre, cultivo_id: d.cultivo }; });
}

async function cargarCultivos() {
    const resp = await apiGet("/cultivos/");
    const lista = Array.isArray(resp) ? resp : (resp.results || []);
    cultivosMap = {};
    lista.forEach(c => { cultivosMap[c.id_cultivo] = c.nombre; });
}

async function cargarSensores() {
    const resp = await apiGet("/sensores/?incluir_inactivos=1");
    sensores = Array.isArray(resp) ? resp : (resp.results || []);
}

async function cargarRangos() {
    const resp = await apiGet("/rangos-operacion/");
    const lista = Array.isArray(resp) ? resp : (resp.results || []);
    rangosPorSensor = {};
    lista.forEach(r => {
        if (!rangosPorSensor[r.sensor] || new Date(r.vigente_desde) > new Date(rangosPorSensor[r.sensor].vigente_desde)) {
            rangosPorSensor[r.sensor] = r;
        }
    });
}

// ---------- Poblar Filtros y Modal Selects ----------
function poblarFiltros() {
    const filtroTipo = document.getElementById("filtro-tipo-sensor");
    const filtroCultivo = document.getElementById("filtro-cultivo-sensor");
    const valorTipoActual = filtroTipo?.value || "";
    const valorCultivoActual = filtroCultivo?.value || "";

    if (filtroTipo) {
        filtroTipo.innerHTML = `<option value="">Todos los tipos</option>` +
            Object.values(tiposMap).map(t => `<option value="${t.id}">${escapeHtml(t.nombre)}</option>`).join("");
        filtroTipo.value = valorTipoActual;
    }

    if (filtroCultivo) {
        filtroCultivo.innerHTML = `<option value="">Todos los cultivos</option>` +
            Object.entries(cultivosMap).map(([id, nombre]) => `<option value="${id}">${escapeHtml(nombre)}</option>`).join("");
        filtroCultivo.value = valorCultivoActual;
    }

    // Los listeners se enlazan una sola vez: poblarFiltros() puede re-ejecutarse
    // tras crear un tipo de sensor sin duplicar eventos.
    if (filtrosListenersListos) return;
    filtrosListenersListos = true;

    const inputBuscar = document.getElementById("input-buscar-sensor");
    const aplicarFiltros = () => {
        const query = (document.getElementById("input-buscar-sensor")?.value || "").toLowerCase().trim();
        const tipoId = document.getElementById("filtro-tipo-sensor")?.value ? parseInt(document.getElementById("filtro-tipo-sensor").value) : null;
        const cultivoId = document.getElementById("filtro-cultivo-sensor")?.value ? parseInt(document.getElementById("filtro-cultivo-sensor").value) : null;

        sensoresFiltrados = sensores.filter(s => {
            const tipo = tiposMap[s.tipo_sensor] || { nombre: "" };
            const disp = dispositivosMap[s.dispositivo] || { nombre: "" };
            const cNombre = disp.cultivo_id ? (cultivosMap[disp.cultivo_id] || "") : "";

            const coincideTexto = !query ||
                (tipo.nombre || "").toLowerCase().includes(query) ||
                (disp.nombre || "").toLowerCase().includes(query) ||
                cNombre.toLowerCase().includes(query);

            const coincideTipo = !tipoId || s.tipo_sensor === tipoId;
            const coincideCultivo = !cultivoId || (disp.cultivo_id === cultivoId) || (s.cultivos && s.cultivos.includes(cultivoId));

            return coincideTexto && coincideTipo && coincideCultivo;
        });

        renderTabla();
        renderContador();
    };

    inputBuscar?.addEventListener("input", aplicarFiltros);
    filtroTipo?.addEventListener("change", aplicarFiltros);
    filtroCultivo?.addEventListener("change", aplicarFiltros);
}

function poblarSelectoresModal() {
    const selTipo = document.getElementById("select-sensor-tipo");
    const selDisp = document.getElementById("select-sensor-dispositivo");
    const selCultivo = document.getElementById("select-sensor-cultivo");
    const valorTipoActual = selTipo?.value || "";
    const valorDispActual = selDisp?.value || "";
    const valorCultivoActual = selCultivo?.value || "";

    if (selTipo) {
        selTipo.innerHTML = `<option value="">Selecciona un tipo de sensor...</option>` +
            Object.values(tiposMap).map(t => `<option value="${t.id}" data-unidad="${escapeHtml(t.unidad)}">${escapeHtml(t.nombre)} (${escapeHtml(t.unidad || 's/u')})</option>`).join("");
        selTipo.value = valorTipoActual;
    }

    if (selDisp) {
        selDisp.innerHTML = `<option value="">Selecciona un dispositivo...</option>` +
            Object.values(dispositivosMap).map(d => `<option value="${d.id}">${escapeHtml(d.nombre)}</option>`).join("");
        selDisp.value = valorDispActual;
    }

    if (selCultivo) {
        selCultivo.innerHTML = `<option value="">Heredar del dispositivo o seleccionar cultivo...</option>` +
            Object.entries(cultivosMap).map(([id, nombre]) => `<option value="${id}">${escapeHtml(nombre)}</option>`).join("");
        selCultivo.value = valorCultivoActual;
    }

    // Igual que en los filtros: evitar listeners duplicados al repoblar.
    if (selectoresListenersListos) return;
    selectoresListenersListos = true;

    selTipo?.addEventListener("change", () => {
        const selected = selTipo.options[selTipo.selectedIndex];
        const unidad = selected?.dataset?.unidad || "";
        const labelUnidad = document.getElementById("label-unidad-rango");
        if (labelUnidad) labelUnidad.textContent = unidad ? `(${unidad})` : "";
    });
}

// ---------- Renderizar tabla ----------
function renderTabla() {
    const tbody = document.getElementById("tbody-sensores");
    if (!tbody) return;

    if (sensoresFiltrados.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="6" class="py-12 text-center">
                <i data-lucide="sliders" class="w-10 h-10 text-gray-300 mx-auto mb-2"></i>
                <p class="text-sm text-gray-500">No se encontraron sensores configurados.</p>
            </td></tr>
        `;
        lucide.createIcons();
        return;
    }

    tbody.innerHTML = sensoresFiltrados.map(s => {
        const tipo = tiposMap[s.tipo_sensor] || { nombre: "Sensor", unidad: "" };
        const disp = dispositivosMap[s.dispositivo] || { nombre: "Dispositivo" };
        const cultivoId = (s.cultivos && s.cultivos.length > 0) ? s.cultivos[0] : disp.cultivo_id;
        const cultivoNombre = escapeHtml(cultivoId ? (cultivosMap[cultivoId] || "—") : "—");
        const rango = rangosPorSensor[s.id];

        const tipoNombre = escapeHtml(tipo.nombre);
        const tipoConfig = TIPO_ICONO[tipo.nombre.toLowerCase()] || { icono: "activity", bg: "bg-gray-100", color: "text-gray-600" };

        let rangoTexto = "—";
        if (rango && (rango.valor_min !== null || rango.valor_max !== null)) {
            rangoTexto = `${rango.valor_min} - ${rango.valor_max} <span class="text-xs text-gray-400">${escapeHtml(tipo.unidad || '')}</span>`;
        }

        const estadoBadge = s.is_active !== false
            ? `<span class="inline-flex items-center gap-1 bg-green-100 text-green-800 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                   <span class="w-1 h-1 bg-green-600 rounded-full"></span> Activo
               </span>`
            : `<span class="inline-flex items-center gap-1 bg-red-100 text-red-800 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                   <span class="w-1 h-1 bg-red-600 rounded-full"></span> Inactivo
               </span>`;

        return `
            <tr class="hover:bg-gray-50 cursor-pointer sensor-fila-item transition" data-id="${s.id}">
                <td class="py-3 px-3">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 ${tipoConfig.bg} rounded-xl flex items-center justify-center flex-shrink-0">
                            <i data-lucide="${tipoConfig.icono}" class="w-4 h-4 ${tipoConfig.color}"></i>
                        </div>
                        <div>
                            <p class="text-gray-900 font-medium text-sm">${tipoNombre}</p>
                            <p class="text-[11px] text-gray-400">Sensor #${s.id}</p>
                        </div>
                    </div>
                </td>
                <td class="py-3 px-3 text-gray-700 text-xs">${escapeHtml(disp.nombre)}</td>
                <td class="py-3 px-3 text-gray-700 text-xs">${cultivoNombre}</td>
                <td class="py-3 px-3 text-gray-900 font-semibold text-xs">${rangoTexto}</td>
                <td class="py-3 px-3">${estadoBadge}</td>
                <td class="py-3 px-3 text-right">
                    <div class="flex items-center justify-end gap-1">
                        <button
                            type="button"
                            class="btn-editar-sensor p-1.5 hover:bg-green-50 hover:text-brand rounded-lg transition text-gray-500"
                            title="Editar sensor"
                            data-id="${s.id}"
                        >
                            <i data-lucide="pencil" class="w-4 h-4"></i>
                        </button>
                        <button
                            type="button"
                            class="btn-eliminar-sensor p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg transition text-gray-500"
                            title="Desactivar / Eliminar sensor"
                            data-id="${s.id}"
                        >
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    lucide.createIcons();

    // Eventos: click en fila abre el modal con datos cargados
    tbody.querySelectorAll(".sensor-fila-item").forEach(fila => {
        fila.addEventListener("click", () => {
            const id = parseInt(fila.dataset.id);
            const sensor = sensores.find(s => s.id === id);
            if (sensor) abrirModalEditarSensor(sensor);
        });
    });

    // Evento botón editar
    tbody.querySelectorAll(".btn-editar-sensor").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.id);
            const sensor = sensores.find(s => s.id === id);
            if (sensor) abrirModalEditarSensor(sensor);
        });
    });

    // Evento botón eliminar/desactivar
    tbody.querySelectorAll(".btn-eliminar-sensor").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.id);
            const sensor = sensores.find(s => s.id === id);
            if (sensor) confirmarEliminarSensor(sensor);
        });
    });
}

function renderContador() {
    const contador = document.getElementById("contador-sensores");
    if (contador) contador.textContent = `Mostrando ${sensoresFiltrados.length} de ${sensores.length} sensores configurados`;
}

// ---------- Configuración del Modal ----------
function configurarModal() {
    const modal = document.getElementById("modal-sensor-config");
    const btnNuevo = document.getElementById("btn-nuevo-sensor");
    const btnCerrar = document.getElementById("btn-cerrar-modal-sensor");
    const btnCancelar = document.getElementById("btn-cancelar-sensor-modal");
    const form = document.getElementById("form-sensor-modal");

    const modalTipo = document.getElementById("modal-tipo-sensor");
    const btnNuevoTipo = document.getElementById("btn-nuevo-tipo");
    const btnCerrarTipo = document.getElementById("btn-cerrar-modal-tipo");
    const btnCancelarTipo = document.getElementById("btn-cancelar-tipo-modal");
    const formTipo = document.getElementById("form-tipo-sensor");
    const btnIrNuevoTipo = document.getElementById("btn-ir-nuevo-tipo");

    btnNuevo?.addEventListener("click", abrirModalNuevoSensor);
    btnCerrar?.addEventListener("click", cerrarModalSensor);
    btnCancelar?.addEventListener("click", cerrarModalSensor);

    modal?.addEventListener("click", (e) => {
        if (e.target === modal) cerrarModalSensor();
    });

    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        await guardarSensor();
    });

    // ---------- Modal Tipo de Sensor ----------
    btnNuevoTipo?.addEventListener("click", () => abrirModalNuevoTipo(false));
    btnIrNuevoTipo?.addEventListener("click", () => {
        cerrarModalSensor();
        abrirModalNuevoTipo(true);
    });
    btnCerrarTipo?.addEventListener("click", cerrarModalTipo);
    btnCancelarTipo?.addEventListener("click", cerrarModalTipo);

    modalTipo?.addEventListener("click", (e) => {
        if (e.target === modalTipo) cerrarModalTipo();
    });

    formTipo?.addEventListener("submit", async (e) => {
        e.preventDefault();
        await guardarTipoSensor();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (modalTipo && !modalTipo.classList.contains("hidden")) {
            cerrarModalTipo();
        } else if (modal && !modal.classList.contains("hidden")) {
            cerrarModalSensor();
        }
    });
}

function abrirModalNuevoSensor() {
    const modal = document.getElementById("modal-sensor-config");
    if (!modal) return;

    document.getElementById("form-sensor-modal")?.reset();
    document.getElementById("sensor-id-editar").value = "";
    document.getElementById("rango-id-editar").value = "";

    document.getElementById("modal-titulo-sensor").textContent = "Nuevo sensor";
    document.getElementById("modal-subtitulo-sensor").textContent = "Vincula un sensor físico con su dispositivo y umbrales.";
    document.getElementById("texto-guardar-sensor").textContent = "Crear sensor";
    document.getElementById("icono-guardar-sensor").setAttribute("data-lucide", "plus");
    document.getElementById("label-unidad-rango").textContent = "";

    document.getElementById("error-sensor-modal")?.classList.add("hidden");

    modal.classList.remove("hidden");
    modal.classList.add("flex");
    lucide.createIcons();
}

function abrirModalEditarSensor(sensor) {
    const modal = document.getElementById("modal-sensor-config");
    if (!modal || !sensor) return;

    document.getElementById("sensor-id-editar").value = sensor.id;
    document.getElementById("select-sensor-tipo").value = sensor.tipo_sensor || "";
    document.getElementById("select-sensor-dispositivo").value = sensor.dispositivo || "";

    const cultivoId = (sensor.cultivos && sensor.cultivos.length > 0) ? sensor.cultivos[0] : "";
    document.getElementById("select-sensor-cultivo").value = cultivoId || "";

    const tipo = tiposMap[sensor.tipo_sensor];
    const labelUnidad = document.getElementById("label-unidad-rango");
    if (labelUnidad) labelUnidad.textContent = tipo?.unidad ? `(${tipo.unidad})` : "";

    const rango = rangosPorSensor[sensor.id];
    document.getElementById("rango-id-editar").value = rango ? rango.id : "";
    document.getElementById("input-sensor-min").value = rango ? rango.valor_min : "";
    document.getElementById("input-sensor-max").value = rango ? rango.valor_max : "";

    document.getElementById("modal-titulo-sensor").textContent = "Configurar sensor";
    document.getElementById("modal-subtitulo-sensor").textContent = `Editando sensor #${sensor.id} (${tipo ? tipo.nombre : ''}).`;
    document.getElementById("texto-guardar-sensor").textContent = "Guardar cambios";
    document.getElementById("icono-guardar-sensor").setAttribute("data-lucide", "save");

    document.getElementById("error-sensor-modal")?.classList.add("hidden");

    modal.classList.remove("hidden");
    modal.classList.add("flex");
    lucide.createIcons();
}

function cerrarModalSensor() {
    const modal = document.getElementById("modal-sensor-config");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    document.getElementById("form-sensor-modal")?.reset();
    document.getElementById("sensor-id-editar").value = "";
    document.getElementById("rango-id-editar").value = "";
}

// ---------- Modal Tipo de Sensor ----------
function abrirModalNuevoTipo(desdeSensor = false) {
    const modal = document.getElementById("modal-tipo-sensor");
    if (!modal) return;

    origenTipoDesdeSensor = desdeSensor;
    document.getElementById("form-tipo-sensor")?.reset();

    const errorBox = document.getElementById("error-tipo-modal");
    if (errorBox) {
        errorBox.textContent = "";
        errorBox.classList.add("hidden");
    }

    modal.classList.remove("hidden");
    modal.classList.add("flex");
    lucide.createIcons();
    document.getElementById("input-tipo-nombre")?.focus();
}

function cerrarModalTipo() {
    const modal = document.getElementById("modal-tipo-sensor");
    if (!modal) return;

    modal.classList.add("hidden");
    modal.classList.remove("flex");
    document.getElementById("form-tipo-sensor")?.reset();

    const errorBox = document.getElementById("error-tipo-modal");
    if (errorBox) {
        errorBox.textContent = "";
        errorBox.classList.add("hidden");
    }

    origenTipoDesdeSensor = false;
}

function formatearErrorApi(err) {
    let msg = err?.message || "No se pudo completar la operación.";
    const idx = msg.indexOf(": ");
    if (idx !== -1) {
        try {
            const json = JSON.parse(msg.slice(idx + 2));
            if (json && typeof json === "object") {
                msg = Object.entries(json)
                    .map(([campo, valor]) => `${campo}: ${Array.isArray(valor) ? valor.join(", ") : valor}`)
                    .join(" · ");
            }
        } catch (_) {}
    }
    return msg;
}

async function guardarTipoSensor() {
    const btn = document.getElementById("btn-guardar-tipo-modal");
    const errorBox = document.getElementById("error-tipo-modal");

    const nombre = (document.getElementById("input-tipo-nombre")?.value || "").trim();
    const unidad = (document.getElementById("input-tipo-unidad")?.value || "").trim();
    const minRaw = document.getElementById("input-tipo-min")?.value ?? "";
    const maxRaw = document.getElementById("input-tipo-max")?.value ?? "";

    const mostrarError = (mensaje) => {
        if (errorBox) {
            errorBox.textContent = mensaje;
            errorBox.classList.remove("hidden");
        } else {
            alert(mensaje);
        }
    };

    if (!nombre || !unidad || minRaw === "" || maxRaw === "") {
        mostrarError("Completá el nombre, la unidad y ambos valores del rango físico.");
        return;
    }

    const vMin = parseFloat(minRaw);
    const vMax = parseFloat(maxRaw);

    if (Number.isNaN(vMin) || Number.isNaN(vMax)) {
        mostrarError("Los valores mínimo y máximo deben ser números válidos.");
        return;
    }

    if (vMin >= vMax) {
        mostrarError("El valor mínimo físico debe ser estrictamente menor que el máximo.");
        return;
    }

    const nombreNormalizado = nombre.toLowerCase();
    const existe = Object.values(tiposMap).some(t => (t.nombre || "").toLowerCase() === nombreNormalizado);
    if (existe) {
        mostrarError(`Ya existe un tipo de sensor llamado "${nombre}".`);
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Guardando...`;
        lucide.createIcons();
    }
    if (errorBox) errorBox.classList.add("hidden");

    try {
        const nuevo = await apiPost("/tipos-sensor/", {
            nombre,
            unidad_medida: unidad,
            valor_min_fisico: vMin,
            valor_max_fisico: vMax,
        });

        // Actualizar el catálogo local al instante (sin recargar la página).
        if (nuevo && nuevo.id != null) {
            tiposMap[nuevo.id] = {
                id: nuevo.id,
                nombre: nuevo.nombre || nombre,
                unidad: nuevo.unidad_medida || unidad,
            };
        }

        poblarFiltros();
        poblarSelectoresModal();

        const volverAlSensor = origenTipoDesdeSensor;
        cerrarModalTipo();
        mostrarToastConfig(`Tipo de sensor "${nombre}" creado correctamente.`);

        // Si venía desde "Nuevo sensor", reabrir ese modal con el tipo ya elegido.
        if (volverAlSensor) {
            abrirModalNuevoSensor();
            if (nuevo && nuevo.id != null) {
                const selTipo = document.getElementById("select-sensor-tipo");
                if (selTipo) {
                    selTipo.value = String(nuevo.id);
                    const selected = selTipo.options[selTipo.selectedIndex];
                    const labelUnidad = document.getElementById("label-unidad-rango");
                    if (labelUnidad) labelUnidad.textContent = selected?.dataset?.unidad ? `(${selected.dataset.unidad})` : "";
                }
            }
        }
    } catch (err) {
        console.error(err);
        mostrarError(formatearErrorApi(err));
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i id="icono-guardar-tipo" data-lucide="plus" class="w-4 h-4"></i> <span id="texto-guardar-tipo">Crear tipo</span>`;
            lucide.createIcons();
        }
    }
}

// ---------- Guardar Sensor y Rango (POST o PATCH) ----------
async function guardarSensor() {
    const idSensor = document.getElementById("sensor-id-editar").value;
    const idRango = document.getElementById("rango-id-editar").value;
    const esEdicion = !!idSensor;

    const btn = document.getElementById("btn-guardar-sensor-modal");
    const errorBox = document.getElementById("error-sensor-modal");

    const tipoSensor = document.getElementById("select-sensor-tipo").value;
    const dispositivo = document.getElementById("select-sensor-dispositivo").value;
    const cultivo = document.getElementById("select-sensor-cultivo").value;
    const vMin = document.getElementById("input-sensor-min").value;
    const vMax = document.getElementById("input-sensor-max").value;

    if (!tipoSensor || !dispositivo) {
        if (errorBox) {
            errorBox.textContent = "Por favor selecciona el tipo de sensor y el dispositivo.";
            errorBox.classList.remove("hidden");
        }
        return;
    }

    if (vMin !== "" && vMax !== "" && parseFloat(vMin) >= parseFloat(vMax)) {
        if (errorBox) {
            errorBox.textContent = "El valor mínimo del rango debe ser estrictamente menor que el máximo.";
            errorBox.classList.remove("hidden");
        }
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Guardando...`;
        lucide.createIcons();
    }
    if (errorBox) errorBox.classList.add("hidden");

    try {
        const payloadSensor = {
            tipo_sensor: parseInt(tipoSensor),
            dispositivo: parseInt(dispositivo),
            cultivos: cultivo ? [parseInt(cultivo)] : [],
        };

        let sensorResult;
        if (esEdicion) {
            sensorResult = await apiPatch(`/sensores/${idSensor}/`, payloadSensor);
        } else {
            payloadSensor.is_active = true;
            sensorResult = await apiPost("/sensores/", payloadSensor);
        }

        const sid = sensorResult.id || idSensor;

        // Actualizar o crear Rango si se completaron los valores
        if (vMin !== "" && vMax !== "") {
            const payloadRango = {
                sensor: sid,
                valor_min: parseFloat(vMin),
                valor_max: parseFloat(vMax),
            };

            if (idRango) {
                await apiPatch(`/rangos-operacion/${idRango}/`, payloadRango);
            } else {
                await apiPost("/rangos-operacion/", payloadRango);
            }
        }

        await Promise.all([cargarSensores(), cargarRangos()]);
        sensoresFiltrados = [...sensores];
        renderTabla();
        renderContador();
        cerrarModalSensor();
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
            const esEditFinal = !!document.getElementById("sensor-id-editar")?.value;
            btn.innerHTML = esEditFinal
                ? `<i id="icono-guardar-sensor" data-lucide="save" class="w-4 h-4"></i> <span id="texto-guardar-sensor">Guardar cambios</span>`
                : `<i id="icono-guardar-sensor" data-lucide="plus" class="w-4 h-4"></i> <span id="texto-guardar-sensor">Crear sensor</span>`;
            lucide.createIcons();
        }
    }
}

// ---------- Eliminar / Desactivar con Confirmación ----------
function confirmarEliminarSensor(sensor) {
    const tipo = tiposMap[sensor.tipo_sensor]?.nombre || "Sensor";
    const disp = dispositivosMap[sensor.dispositivo]?.nombre || "Dispositivo";

    confirmarAccion({
        titulo: "Desactivar sensor",
        mensaje: `¿Estás seguro de que deseas desactivar el ${tipo} (#${sensor.id}) en ${disp}?\nEl sensor dejará de recibir lecturas en tiempo real.`,
        textoConfirmar: "Desactivar sensor",
        esPeligroso: true,
        onConfirm: async () => {
            try {
                await apiDelete(`/sensores/${sensor.id}/`);
                await cargarSensores();
                sensoresFiltrados = [...sensores];
                renderTabla();
                renderContador();
            } catch (err) {
                alert(`Error al desactivar sensor: ${err.message}`);
            }
        }
    });
}

// ---------- Iniciar ----------
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", cargarConfiguracion);
} else {
    cargarConfiguracion();
}
