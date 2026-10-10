// ============================================================
// rangos-operacion.js — Carga dinámica de Rangos de operación
// ============================================================

let rangos = [];
let sensoresMap = {};      // { sensor_id: { tipo_nombre, unidad, dispositivo_id, cultivo_nombre } }
let tiposMap = {};         // { tipo_id: { nombre, unidad } }
let sensoresDisponibles = [];  // para el select del modal

// ---------- Cargar todo ----------
async function cargarRangos() {
    const tbody = document.getElementById("tbody-rangos");
    if (!tbody) return;

    try {
        tbody.innerHTML = `
            <tr><td colspan="7" class="py-8 text-center text-gray-400 text-sm">
                <i data-lucide="loader" class="w-5 h-5 mx-auto mb-2 animate-spin"></i>
                Cargando rangos...
            </td></tr>
        `;
        lucide.createIcons();

        // Cargar todo en paralelo
        await Promise.all([
            cargarTipos(),
            cargarDispositivosCultivos(),
            cargarSensores(),
        ]);

        // Cargar rangos
        const resp = await apiGet("/rangos-operacion/");
        rangos = Array.isArray(resp) ? resp : (resp.results || []);

        renderTabla();
        renderContador();
        configurarModal();
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `
            <tr><td colspan="7" class="py-8 text-center text-red-500 text-sm">
                Error: ${err.message}
            </td></tr>
        `;
    }
}

// ---------- Cargar tipos de sensor ----------
async function cargarTipos() {
    const resp = await apiGet("/tipos-sensor/");
    const lista = Array.isArray(resp) ? resp : (resp.results || []);
    tiposMap = {};
    lista.forEach(t => { tiposMap[t.id] = { nombre: t.nombre, unidad: t.unidad_medida }; });
}

// ---------- Cargar dispositivos + cultivos ----------
async function cargarDispositivosCultivos() {
    // Cultivos
    const respCultivos = await apiGet("/cultivos/");
    const cultivos = Array.isArray(respCultivos) ? respCultivos : (respCultivos.results || []);
    const cultivosMap = {};
    cultivos.forEach(c => { cultivosMap[c.id_cultivo] = c.nombre; });

    // Dispositivos
    const respDisp = await apiGet("/dispositivos/");
    const dispositivos = Array.isArray(respDisp) ? respDisp : (respDisp.results || []);
    window._dispositivosMap = {};
    dispositivos.forEach(d => {
        window._dispositivosMap[d.id] = {
            cultivo_id: d.cultivo,
            cultivo_nombre: cultivosMap[d.cultivo] || "—",
        };
    });
}

// ---------- Cargar sensores ----------
async function cargarSensores() {
    const resp = await apiGet("/sensores/");
    sensoresDisponibles = Array.isArray(resp) ? resp : (resp.results || []);

    sensoresMap = {};
    sensoresDisponibles.forEach(s => {
        const tipo = tiposMap[s.tipo_sensor] || { nombre: "?", unidad: "" };
        const disp = (window._dispositivosMap || {})[s.dispositivo] || { cultivo_nombre: "—" };
        sensoresMap[s.id] = {
            tipo_nombre: tipo.nombre,
            unidad: tipo.unidad,
            tipo_id: s.tipo_sensor,
            dispositivo_id: s.dispositivo,
            cultivo_nombre: disp.cultivo_nombre,
        };
    });
}

// ---------- Renderizar tabla ----------
function renderTabla() {
    const tbody = document.getElementById("tbody-rangos");

    if (rangos.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="7" class="py-12 text-center">
                <i data-lucide="sliders-horizontal" class="w-10 h-10 text-gray-300 mx-auto mb-2"></i>
                <p class="text-sm text-gray-500 mb-3">No hay rangos configurados.</p>
                <button onclick="abrirModalRango()" class="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
                    <i data-lucide="plus" class="w-4 h-4"></i>
                    Crear el primero
                </button>
            </td></tr>
        `;
        lucide.createIcons();
        return;
    }

    tbody.innerHTML = rangos.map(r => {
        const sensor = sensoresMap[r.sensor] || { tipo_nombre: "?", unidad: "", cultivo_nombre: "—" };

        return `
            <tr class="hover:bg-gray-50">
                <td class="py-3 px-3 text-gray-900 font-medium">
                    ${sensor.tipo_nombre}
                    <span class="text-xs text-gray-400 ml-1">#${r.sensor}</span>
                </td>
                <td class="py-3 px-3 text-gray-700 text-xs">${sensor.cultivo_nombre}</td>
                <td class="py-3 px-3 text-gray-600 text-xs">${sensor.unidad || "—"}</td>
                <td class="py-3 px-3 text-gray-900 font-semibold">${r.valor_min}</td>
                <td class="py-3 px-3 text-gray-900 font-semibold">${r.valor_max}</td>
                <td class="py-3 px-3 text-gray-600 text-xs whitespace-nowrap">${formatearFecha(r.vigente_desde)}</td>
                <td class="py-3 px-3">
                    <div class="flex items-center gap-1">
                        <button class="btn-editar-rango p-1.5 hover:bg-gray-100 rounded transition" data-id="${r.id}" title="Editar">
                            <i data-lucide="pencil" class="w-4 h-4 text-gray-500"></i>
                        </button>
                        <button class="btn-eliminar-rango p-1.5 hover:bg-red-50 rounded transition" data-id="${r.id}" title="Eliminar">
                            <i data-lucide="trash-2" class="w-4 h-4 text-red-500"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    lucide.createIcons();

    // Event listeners
    document.querySelectorAll(".btn-editar-rango").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = parseInt(btn.dataset.id);
            const rango = rangos.find(r => r.id === id);
            if (rango) abrirModalRango(rango);
        });
    });

    document.querySelectorAll(".btn-eliminar-rango").forEach(btn => {
        btn.addEventListener("click", () => {
            eliminarRango(parseInt(btn.dataset.id));
        });
    });
}

// ---------- Contador ----------
function renderContador() {
    const contador = document.getElementById("contador-rangos");
    if (contador) contador.textContent = `Mostrando 1 - ${rangos.length} de ${rangos.length} rangos configurados`;
}

// ============================================================
// MODAL
// ============================================================

function configurarModal() {
    document.getElementById("btn-nuevo-rango")?.addEventListener("click", () => abrirModalRango());
    document.getElementById("form-rango")?.addEventListener("submit", guardarRango);
    document.getElementById("btn-cerrar-modal-rango")?.addEventListener("click", cerrarModalRango);

    const modal = document.getElementById("modal-rango");
    modal?.addEventListener("click", (e) => {
        if (e.target === modal) cerrarModalRango();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) {
            cerrarModalRango();
        }
    });
}

function abrirModalRango(rangoExistente = null) {
    const modal = document.getElementById("modal-rango");
    if (!modal) return;

    const form = document.getElementById("form-rango");
    form.reset();
    document.getElementById("error-rango").classList.add("hidden");

    // Poblar select de sensores
    const select = document.getElementById("select-sensor");
    select.innerHTML = `<option value="">Selecciona un sensor</option>` +
        sensoresDisponibles.map(s => {
            const info = sensoresMap[s.id] || {};
            return `<option value="${s.id}">${info.tipo_nombre || "Sensor"} — ${info.cultivo_nombre || "—"} (ID ${s.id})</option>`;
        }).join("");

    if (rangoExistente) {
        // Modo edición
        document.getElementById("modal-titulo-rango").textContent = "Editar rango";
        document.getElementById("rango-id-editar").value = rangoExistente.id;
        document.getElementById("select-sensor").value = rangoExistente.sensor;
        document.getElementById("input-valor-min").value = rangoExistente.valor_min;
        document.getElementById("input-valor-max").value = rangoExistente.valor_max;
    } else {
        // Modo creación
        document.getElementById("modal-titulo-rango").textContent = "Nuevo rango";
        document.getElementById("rango-id-editar").value = "";
    }

    modal.classList.remove("hidden");
    modal.classList.add("flex");
}

function cerrarModalRango() {
    const modal = document.getElementById("modal-rango");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
}

// ---------- Guardar (POST o PATCH) ----------
async function guardarRango(event) {
    event.preventDefault();

    const btn = document.getElementById("btn-guardar-rango");
    const errorBox = document.getElementById("error-rango");
    const idEditar = document.getElementById("rango-id-editar").value;
    const sensorId = document.getElementById("select-sensor").value;
    const vmin = document.getElementById("input-valor-min").value;
    const vmax = document.getElementById("input-valor-max").value;

    if (!sensorId) { mostrarErrorRango("Seleccioná un sensor"); return; }
    if (vmin === "") { mostrarErrorRango("Falta el valor mínimo"); return; }
    if (vmax === "") { mostrarErrorRango("Falta el valor máximo"); return; }
    if (parseFloat(vmin) >= parseFloat(vmax)) {
        mostrarErrorRango("El mínimo debe ser menor que el máximo");
        return;
    }

    const esEdicion = !!idEditar;

    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Guardando...`;
    lucide.createIcons();
    errorBox.classList.add("hidden");

    try {
        const datos = {
            sensor: parseInt(sensorId),
            valor_min: parseFloat(vmin),
            valor_max: parseFloat(vmax),
        };

        if (esEdicion) {
            await apiPatch(`/rangos-operacion/${idEditar}/`, datos);
        } else {
            await apiPost("/rangos-operacion/", datos);
        }

        // Recargar la lista
        const resp = await apiGet("/rangos-operacion/");
        rangos = Array.isArray(resp) ? resp : (resp.results || []);

        renderTabla();
        renderContador();
        cerrarModalRango();

    } catch (err) {
        console.error(err);
        let msg = "Error al guardar";
        try {
            const partes = err.message.split(": ");
            const json = JSON.parse(partes.slice(1).join(": "));
            if (typeof json === "object") {
                msg = Object.entries(json).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" · ");
            }
        } catch (e) {}
        mostrarErrorRango(msg);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i> Guardar`;
        lucide.createIcons();
    }
}

// ---------- Eliminar ----------
async function eliminarRango(id) {
    const rango = rangos.find(r => r.id === id);
    if (!rango) return;

    const sensor = sensoresMap[rango.sensor] || {};
    if (!confirm(`¿Eliminar el rango ${rango.valor_min} - ${rango.valor_max} de ${sensor.tipo_nombre || "sensor"}?`)) return;

    try {
        const res = await fetch(`/api/rangos-operacion/${id}/`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${localStorage.getItem("access_token")}` },
        });

        if (!res.ok) throw new Error(`DELETE → ${res.status}`);

        // Recargar
        const resp = await apiGet("/rangos-operacion/");
        rangos = Array.isArray(resp) ? resp : (resp.results || []);
        renderTabla();
        renderContador();

    } catch (err) {
        alert(`Error al eliminar: ${err.message}`);
    }
}

function mostrarErrorRango(msg) {
    const box = document.getElementById("error-rango");
    box.textContent = msg;
    box.classList.remove("hidden");
}

// ---------- Iniciar ----------
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", cargarRangos);
} else {
    cargarRangos();
}