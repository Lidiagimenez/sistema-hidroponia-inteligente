// ============================================================
// cultivos.js — Carga dinámica + crear/editar/eliminar
// ============================================================

let cultivosCargados = [];
let cultivoSeleccionado = null;

// ---------- Cargar la lista ----------
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

// ---------- Render lista ----------
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
                            <h3 class="font-semibold text-gray-900 truncate">${c.nombre}</h3>
                            <span class="inline-flex items-center gap-1 bg-green-100 text-green-800 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                                <span class="w-1 h-1 bg-green-600 rounded-full"></span>
                                Activo
                            </span>
                        </div>
                        <p class="text-xs text-gray-500 mb-1">${c.tipo_cultivo || "Sin tipo"}</p>
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

// ---------- Seleccionar ----------
async function seleccionarCultivo(cultivo) {
    cultivoSeleccionado = cultivo;
    renderListaCultivos(cultivosCargados);
    await renderDetalle(cultivo);
}

// ---------- Detalle ----------
async function renderDetalle(cultivo) {
    const contenedor = document.getElementById("detalle-contenido");

    const fechaInicio = new Date(cultivo.fecha_creacion);
    const hoy = new Date();
    const diasTranscurridos = Math.floor((hoy - fechaInicio) / (1000 * 60 * 60 * 24));

    contenedor.innerHTML = `
        <div class="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
            <div class="flex items-start justify-between gap-3 mb-4">
                <h2 class="font-serif text-2xl font-bold text-gray-900">Detalle de cultivo</h2>

                <!-- MENÚ DE ACCIONES -->
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
                            <h3 class="font-serif text-3xl font-bold text-gray-900">${cultivo.nombre}</h3>
                            <p class="text-sm italic text-gray-500">${cultivo.tipo_cultivo || "Sin tipo especificado"}</p>
                        </div>
                        <span class="inline-flex items-center gap-1.5 bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full">
                            <span class="w-2 h-2 bg-green-600 rounded-full"></span>
                            Activo
                        </span>
                    </div>
                    <div class="flex items-center gap-4 text-sm text-gray-600 mt-3">
                        <span class="flex items-center gap-1.5">
                            <i data-lucide="calendar" class="w-4 h-4"></i>
                            Inicio: ${formatearFecha(cultivo.fecha_creacion)}
                        </span>
                        <span class="text-gray-300">|</span>
                        <span>Día <span class="font-semibold">${diasTranscurridos}</span></span>
                    </div>
                </div>
            </div>

            <div class="flex items-center gap-1 mt-6 border-b border-gray-200 -mx-6 px-6 overflow-x-auto">
                <button class="tab-cultivo active px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 border-brand text-brand">Resumen</button>
                <button class="tab-cultivo px-4 py-3 text-sm font-medium text-gray-500 whitespace-nowrap border-b-2 border-transparent">Ciclo</button>
                <button class="tab-cultivo px-4 py-3 text-sm font-medium text-gray-500 whitespace-nowrap border-b-2 border-transparent">Sensores</button>
                <button class="tab-cultivo px-4 py-3 text-sm font-medium text-gray-500 whitespace-nowrap border-b-2 border-transparent">Alertas</button>
                <button class="tab-cultivo px-4 py-3 text-sm font-medium text-gray-500 whitespace-nowrap border-b-2 border-transparent">Imágenes</button>
            </div>
        </div>

        <div class="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
            <h3 class="font-serif text-lg font-bold text-gray-900 mb-4">Información general</h3>
            <div class="space-y-3 text-sm">
                <div class="flex items-center justify-between py-1.5 border-b border-gray-100">
                    <span class="text-gray-500">Nombre</span>
                    <span class="font-medium text-gray-900">${cultivo.nombre}</span>
                </div>
                <div class="flex items-center justify-between py-1.5 border-b border-gray-100">
                    <span class="text-gray-500">Tipo de cultivo</span>
                    <span class="font-medium text-gray-900">${cultivo.tipo_cultivo || "—"}</span>
                </div>
                <div class="flex items-center justify-between py-1.5 border-b border-gray-100">
                    <span class="text-gray-500">Fecha de creación</span>
                    <span class="font-medium text-gray-900">${formatearFecha(cultivo.fecha_creacion)}</span>
                </div>
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
    configurarMenuCultivo();
}

// ---------- Configurar menú de 3 puntitos ----------
function configurarMenuCultivo() {
    const btn = document.getElementById("btn-menu-cultivo");
    const menu = document.getElementById("menu-cultivo");
    const btnEditar = document.getElementById("menu-editar-cultivo");
    const btnEliminar = document.getElementById("menu-eliminar-cultivo");

    if (!btn || !menu) return;

    // Toggle del menú
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        menu.classList.toggle("hidden");
    });

    // Cerrar al hacer click afuera
    document.addEventListener("click", () => {
        menu.classList.add("hidden");
    });

    // Cerrar al hacer click dentro del menú (excepto en los botones que manejan su propio close)
    menu.addEventListener("click", (e) => {
        e.stopPropagation();
    });

    // Editar
    btnEditar?.addEventListener("click", () => {
        menu.classList.add("hidden");
        abrirModalEditar(cultivoSeleccionado);
    });

    // Eliminar
    btnEliminar?.addEventListener("click", () => {
        menu.classList.add("hidden");
        eliminarCultivo(cultivoSeleccionado);
    });
}

// ============================================================
// MODAL CREAR
// ============================================================

function abrirModalCultivo() {
    const modal = document.getElementById("modal-nuevo-cultivo");
    if (!modal) return;

    document.getElementById("modal-titulo-cultivo").textContent = "Nuevo cultivo";
    document.getElementById("form-nuevo-cultivo").reset();
    document.getElementById("cultivo-id-editar").value = "";

    const hoy = new Date();
    document.getElementById("input-fecha-cultivo").value =
        `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,"0")}-${String(hoy.getDate()).padStart(2,"0")}`;

    document.getElementById("error-cultivo").classList.add("hidden");

    modal.classList.remove("hidden");
    modal.classList.add("flex");
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
    document.getElementById("error-cultivo").classList.add("hidden");

    modal.classList.remove("hidden");
    modal.classList.add("flex");
}

function cerrarModalCultivo() {
    const modal = document.getElementById("modal-nuevo-cultivo");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
}

// ---------- Guardar (POST o PATCH) ----------
async function guardarCultivo(event) {
    event.preventDefault();

    const btn = document.getElementById("btn-crear-cultivo");
    const errorBox = document.getElementById("error-cultivo");
    const idEditar = document.getElementById("cultivo-id-editar").value;
    const nombre = document.getElementById("input-nombre-cultivo").value.trim();
    const tipo = document.getElementById("input-tipo-cultivo").value.trim() || "No especificado";
    const fecha = document.getElementById("input-fecha-cultivo").value;

    if (!nombre) {
        mostrarErrorCultivo("El nombre es obligatorio");
        return;
    }
    if (!fecha) {
        mostrarErrorCultivo("La fecha es obligatoria");
        return;
    }

    const esEdicion = !!idEditar;

    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> ${esEdicion ? "Guardando..." : "Creando..."}`;
    lucide.createIcons();
    errorBox.classList.add("hidden");

    try {
        const datos = {
            nombre: nombre,
            tipo_cultivo: tipo,
            fecha_creacion: fecha,
        };

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
        btn.innerHTML = `<i data-lucide="plus" class="w-4 h-4"></i> ${esEdicion ? "Guardar cambios" : "Crear cultivo"}`;
        lucide.createIcons();
    }
}

// ---------- Eliminar ----------
async function eliminarCultivo(cultivo) {
    if (!cultivo) return;

    const confirmado = confirm(`¿Eliminar el cultivo "${cultivo.nombre}"?\n\nEsta acción no se puede deshacer.`);
    if (!confirmado) return;

    try {
        // DELETE
        const res = await fetch(`/api/cultivos/${cultivo.id_cultivo}/`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${localStorage.getItem("access_token")}` },
        });

        if (!res.ok) {
            throw new Error(`DELETE → ${res.status}`);
        }

        // Recargar la lista
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

// ---------- Iniciar ----------
function initCultivos() {
    cargarCultivos();

    document.getElementById("btn-nuevo-cultivo")?.addEventListener("click", abrirModalCultivo);
    document.getElementById("form-nuevo-cultivo")?.addEventListener("submit", guardarCultivo);
    document.getElementById("btn-cerrar-modal-cultivo")?.addEventListener("click", cerrarModalCultivo);

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