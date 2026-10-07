// ============================================================
// intervenciones.js — Carga dinámica de Intervenciones
// ============================================================

let intervenciones = [];
let alertasDisponibles = [];
let usuariosMap = {};   // { id: username }

// ---------- Cargar todo ----------
async function cargarIntervenciones() {
    try {
        await cargarAlertasDisponibles();
        await cargarUsuarios();
        await cargarIntervencionesData();
        renderTabla();
        renderContador();
        configurarFormulario();
    } catch (err) {
        console.error(err);
        document.getElementById("tbody-intervenciones").innerHTML = `
            <tr><td colspan="7" class="py-8 text-center text-red-500 text-sm">
                Error: ${err.message}
            </td></tr>
        `;
    }
}

// ---------- Cargar alertas (para el select del formulario) ----------
async function cargarAlertasDisponibles() {
    const resp = await apiGet("/alertas/");
    const todas = Array.isArray(resp) ? resp : (resp.results || []);
    alertasDisponibles = todas;
}

// ---------- Cargar usuarios (para mostrar quién hizo cada intervención) ----------
async function cargarUsuarios() {
    try {
        const resp = await apiGet("/usuarios/");
        const lista = Array.isArray(resp) ? resp : (resp.results || []);
        usuariosMap = {};
        lista.forEach(u => { usuariosMap[u.id] = u.username; });
    } catch (err) {
        // Si es operador, no puede ver usuarios → dejar mapa vacío
        usuariosMap = {};
    }
}

// ---------- Cargar intervenciones ----------
async function cargarIntervencionesData() {
    const resp = await apiGet("/intervenciones/");
    intervenciones = Array.isArray(resp) ? resp : (resp.results || []);
    // Ordenar más recientes primero
    intervenciones.sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));
}

// ---------- Renderizar tabla ----------
function renderTabla() {
    const tbody = document.getElementById("tbody-intervenciones");
    const contador = document.getElementById("contador-intervenciones");

    if (intervenciones.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="7" class="py-12 text-center">
                <i data-lucide="wrench" class="w-10 h-10 text-gray-300 mx-auto mb-2"></i>
                <p class="text-sm text-gray-500">No hay intervenciones registradas todavía.</p>
            </td></tr>
        `;
        if (contador) contador.textContent = "Mostrando 0 intervenciones";
        lucide.createIcons();
        return;
    }

    tbody.innerHTML = intervenciones.map(i => {
        const fecha = new Date(i.fecha_hora);
        const fechaStr = formatearFecha(i.fecha_hora);
        const horaStr = `${String(fecha.getHours()).padStart(2,"0")}:${String(fecha.getMinutes()).padStart(2,"0")}`;
        const responsable = usuariosMap[i.operador] || `Usuario #${i.operador}`;
        const alertaRef = i.alerta ? `Alerta #${i.alerta}` : "—";

        // Estado según resuelta
        const estadoBadge = i.resuelta
            ? `<span class="inline-flex items-center gap-1 bg-green-100 text-green-800 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">✓ Resuelta</span>`
            : `<span class="inline-flex items-center gap-1 bg-orange-100 text-orange-800 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">● En proceso</span>`;

        return `
            <tr class="hover:bg-gray-50">
                <td class="py-3 px-3 text-gray-700 whitespace-nowrap">
                    <p class="font-medium">${fechaStr}</p>
                    <p class="text-xs text-gray-400">${horaStr}</p>
                </td>
                <td class="py-3 px-3">
                    <span class="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 whitespace-nowrap">
                        <i data-lucide="wrench" class="w-3.5 h-3.5 text-brand"></i>
                        Intervención
                    </span>
                </td>
                <td class="py-3 px-3 text-gray-700 whitespace-nowrap text-xs">${alertaRef}</td>
                <td class="py-3 px-3 text-gray-600 text-xs max-w-xs truncate" title="${i.observaciones || ''}">
                    ${i.observaciones || "Sin observaciones"}
                </td>
                <td class="py-3 px-3 text-gray-700 whitespace-nowrap text-xs">${responsable}</td>
                <td class="py-3 px-3">${estadoBadge}</td>
                <td class="py-3 px-3">
                    <button class="p-1 hover:bg-gray-100 rounded transition">
                        <i data-lucide="more-vertical" class="w-4 h-4 text-gray-400"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join("");

    if (contador) contador.textContent = `Mostrando 1 - ${intervenciones.length} de ${intervenciones.length} intervenciones`;
    lucide.createIcons();
}

// ---------- Contador de tabs ----------
function renderContador() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    set("tab-todas", intervenciones.length);
    set("tab-resueltas", intervenciones.filter(i => i.resuelta).length);
    set("tab-en-proceso", intervenciones.filter(i => !i.resuelta).length);
}

// ---------- Abrir/cerrar formulario ----------
function configurarFormulario() {
    const panelForm = document.getElementById("panel-form-intervencion");
    const panelCerrado = document.getElementById("panel-cerrado-intervencion");

    if (!panelForm || !panelCerrado) return;

    // Poblar select de alertas
    const selectAlerta = document.getElementById("select-alerta");
    if (selectAlerta) {
        selectAlerta.innerHTML = `<option value="">Selecciona una alerta</option>` +
            alertasDisponibles.map(a => {
                const titulo = a.medicion ? `Medición #${a.medicion}` : `Evento #${a.evento}`;
                const sev = a.severidad === "alta" ? "Crítica" : a.severidad === "media" ? "Advertencia" : "Info";
                return `<option value="${a.id}">${titulo} — ${sev}</option>`;
            }).join("");
    }

    // Fecha y hora actual en el input
    const inputFecha = document.getElementById("input-fecha");
    if (inputFecha) {
        const ahora = new Date();
        const fechaStr = `${String(ahora.getDate()).padStart(2,"0")}/${String(ahora.getMonth()+1).padStart(2,"0")}/${ahora.getFullYear()} ${String(ahora.getHours()).padStart(2,"0")}:${String(ahora.getMinutes()).padStart(2,"0")}`;
        inputFecha.value = fechaStr;
    }

    // Responsable actual
    const inputResp = document.getElementById("input-responsable");
    if (inputResp) inputResp.value = getUsername();

    // Botones
    const abrir = () => {
        panelForm.classList.remove("hidden");
        panelCerrado.classList.add("hidden");
    };
    const cerrar = () => {
        panelForm.classList.add("hidden");
        panelCerrado.classList.remove("hidden");
    };

    document.getElementById("btn-nueva-intervencion")?.addEventListener("click", abrir);
    document.getElementById("btn-abrir-form")?.addEventListener("click", abrir);
    document.getElementById("btn-cerrar-form")?.addEventListener("click", cerrar);
    document.getElementById("btn-cancelar-form")?.addEventListener("click", cerrar);

    // Submit
    document.getElementById("form-intervencion")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        await crearIntervencion(cerrar);
    });
}

// ---------- Crear intervención (POST) ----------
async function crearIntervencion(onSuccess) {
    const btn = document.getElementById("btn-guardar-intervencion");
    const alertaId = document.getElementById("select-alerta").value;
    const observaciones = document.getElementById("input-observaciones").value.trim();

    if (!alertaId) {
        alert("Seleccioná una alerta");
        return;
    }
    if (!observaciones) {
        alert("Escribí una observación");
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Guardando...`;
        lucide.createIcons();
    }

    try {
        const nueva = await apiPost("/intervenciones/", {
            alerta: parseInt(alertaId),
            observaciones: observaciones,
            resuelta: false,
        });

        // Recargar la lista
        await cargarIntervencionesData();
        renderTabla();
        renderContador();

        // Limpiar formulario
        document.getElementById("form-intervencion").reset();
        if (onSuccess) onSuccess();

    } catch (err) {
        alert(`Error al crear la intervención: ${err.message}`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="wrench" class="w-4 h-4"></i> Guardar intervención`;
            lucide.createIcons();
        }
    }
}

// ---------- Iniciar ----------
document.addEventListener("DOMContentLoaded", cargarIntervenciones);