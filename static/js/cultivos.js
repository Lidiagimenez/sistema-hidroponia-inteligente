// ============================================================
// cultivos.js — Carga dinámica de la pantalla de Cultivos
// ============================================================

let cultivosCargados = [];
let cultivoSeleccionado = null;

// ---------- Cargar la lista de cultivos ----------
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
        // Si la API devuelve paginación, tomar 'results'. Si no, usar la respuesta directa.
        cultivosCargados = Array.isArray(respuesta) ? respuesta : (respuesta.results || []);

        if (!cultivosCargados || cultivosCargados.length === 0) {
            contenedor.innerHTML = `
                <div class="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                    <i data-lucide="leaf" class="w-10 h-10 text-gray-300 mx-auto mb-2"></i>
                    <p class="text-sm text-gray-500">No hay cultivos registrados.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        renderListaCultivos(cultivosCargados);

        // Seleccionar el primero automáticamente
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

// ---------- Renderizar lista ----------
function renderListaCultivos(cultivos) {
    const contenedor = document.getElementById("lista-cultivos");

    // Contador
    const contador = document.getElementById("contador-cultivos");
    if (contador) {
        contador.textContent = `Mostrando 1 - ${cultivos.length} de ${cultivos.length} cultivos`;
    }

    // Estado de la lista
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

    // Event listeners
    document.querySelectorAll(".cultivo-card").forEach(card => {
        card.addEventListener("click", () => {
            const id = parseInt(card.dataset.cultivoId);
            const cultivo = cultivosCargados.find(c => c.id_cultivo === id);
            if (cultivo) seleccionarCultivo(cultivo);
        });
    });

    lucide.createIcons();
}

// ---------- Seleccionar un cultivo ----------
async function seleccionarCultivo(cultivo) {
    cultivoSeleccionado = cultivo;
    renderListaCultivos(cultivosCargados);
    await renderDetalle(cultivo);
}

// ---------- Renderizar detalle ----------
async function renderDetalle(cultivo) {
    const contenedor = document.getElementById("detalle-contenido");

    const fechaInicio = new Date(cultivo.fecha_creacion);
    const hoy = new Date();
    const diasTranscurridos = Math.floor((hoy - fechaInicio) / (1000 * 60 * 60 * 24));

    contenedor.innerHTML = `
        <div class="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
            <div class="flex items-start justify-between gap-3 mb-4">
                <h2 class="font-serif text-2xl font-bold text-gray-900">Detalle de cultivo</h2>
                <button class="p-1 hover:bg-gray-100 rounded-lg transition">
                    <i data-lucide="more-horizontal" class="w-5 h-5 text-gray-500"></i>
                </button>
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
}

// ---------- Iniciar ----------
document.addEventListener("DOMContentLoaded", cargarCultivos);