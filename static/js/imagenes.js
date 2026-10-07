// ============================================================
// imagenes.js — Galería de imágenes con fallback a Unsplash
// ============================================================

let imagenes = [];
let imagenSeleccionada = null;

// URLs de fallback (Unsplash) por tipo de cultivo
const FALLBACK_IMAGENES = [
    { cultivo: "Lechuga", url: "https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=600&h=600&fit=crop", origen: "Periódica" },
    { cultivo: "Lechuga", url: "https://images.unsplash.com/photo-1518843875459-f738682238a6?w=600&h=600&fit=crop", origen: "Periódica" },
    { cultivo: "Albahaca", url: "https://images.unsplash.com/photo-1618375569909-3c8616cf7733?w=600&h=600&fit=crop", origen: "Por evento" },
    { cultivo: "Tomate cherry", url: "https://images.unsplash.com/photo-1592841200221-a6898f307baa?w=600&h=600&fit=crop", origen: "Periódica" },
    { cultivo: "Frutilla", url: "https://images.unsplash.com/photo-1518635017498-87f514b751ba?w=600&h=600&fit=crop", origen: "Periódica" },
    { cultivo: "Kale", url: "https://images.unsplash.com/photo-1524179091875-bf99a9a6af57?w=600&h=600&fit=crop", origen: "Manual" },
    { cultivo: "Lechuga", url: "https://images.unsplash.com/photo-1556801712-76c8eb07bbc9?w=600&h=600&fit=crop", origen: "Periódica" },
    { cultivo: "Albahaca", url: "https://images.unsplash.com/photo-1628556270448-4d4e4148e1b1?w=600&h=600&fit=crop", origen: "Periódica" },
    { cultivo: "Tomate cherry", url: "https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=600&h=600&fit=crop", origen: "Por evento" },
    { cultivo: "Frutilla", url: "https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=600&h=600&fit=crop", origen: "Periódica" },
    { cultivo: "Kale", url: "https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=600&h=600&fit=crop", origen: "Sincronizada" },
    { cultivo: "Lechuga", url: "https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=600&h=600&fit=crop", origen: "Periódica" },
];

// Mapeo de origen a estilos de badge
const ORIGEN_ESTILOS = {
    "periodica":      { clase: "bg-white/90 text-gray-700", icono: "camera", label: "Periódica" },
    "evento":         { clase: "bg-orange-100 text-orange-800", icono: "alert-circle", label: "Por evento" },
    "manual":         { clase: "bg-blue-100 text-blue-800", icono: "hand", label: "Manual" },
    "sync_sd":        { clase: "bg-purple-100 text-purple-800", icono: "refresh-cw", label: "Sincronizada" },
};

// ---------- Cargar imágenes ----------
async function cargarImagenes() {
    const grid = document.getElementById("grid-imagenes");
    if (!grid) return;

    try {
        grid.innerHTML = `
            <div class="col-span-full text-center py-8 text-gray-400 text-sm">
                <i data-lucide="loader" class="w-6 h-6 mx-auto mb-2 animate-spin"></i>
                Cargando imágenes...
            </div>
        `;
        lucide.createIcons();

        // Intentar la API de análisis de imagen (inteligencia)
        let data = null;
        try {
            const resp = await apiGet("/analisis-imagen/");
            data = Array.isArray(resp) ? resp : (resp.results || []);
        } catch (e) {
            // Si falla, probar con la de monitoreo
            try {
                const resp2 = await apiGet("/imagenes/");
                data = Array.isArray(resp2) ? resp2 : (resp2.results || []);
            } catch (e2) {
                data = null;
            }
        }

        // Si hay datos reales, usarlos. Si no, usar el fallback de Unsplash
        if (data && data.length > 0) {
            imagenes = data.map(item => ({
                id: item.id,
                cultivo: item.cultivo_nombre || `Cultivo #${item.cultivo}`,
                url: item.imagen || item.archivo,
                fecha_hora: item.fecha_hora,
                origen: item.origen_captura || "periodica",
                dispositivo: item.dispositivo,
                real: true,
            }));
            console.log(`✅ ${imagenes.length} imágenes reales cargadas`);
        } else {
            // Usar fallback con fechas variadas
            const ahora = new Date();
            imagenes = FALLBACK_IMAGENES.map((img, i) => ({
                id: i + 1,
                cultivo: img.cultivo,
                url: img.url,
                fecha_hora: new Date(ahora.getTime() - (i * 90 * 60 * 1000)).toISOString(),
                origen: img.origen.toLowerCase().replace(/ /g, "_"),
                dispositivo: "EPS01",
                real: false,
            }));
            console.log(`ℹ️ Usando ${imagenes.length} imágenes de demostración`);
        }

        renderGaleria();
        renderContador();
    } catch (err) {
        console.error(err);
        grid.innerHTML = `
            <div class="col-span-full bg-red-50 border border-red-200 text-red-700 text-sm p-4 rounded-xl">
                Error: ${err.message}
            </div>
        `;
    }
}

// ---------- Renderizar galería ----------
function renderGaleria() {
    const grid = document.getElementById("grid-imagenes");

    if (imagenes.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                <i data-lucide="image-off" class="w-10 h-10 text-gray-300 mx-auto mb-2"></i>
                <p class="text-sm text-gray-500">No hay imágenes registradas todavía.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    grid.innerHTML = imagenes.map(img => {
        const origenKey = (img.origen || "periodica").toLowerCase().replace(/ /g, "_");
        const est = ORIGEN_ESTILOS[origenKey] || ORIGEN_ESTILOS.periodica;
        const fechaStr = formatearFechaHoraCorta(img.fecha_hora);

        return `
            <div class="imagen-card bg-white rounded-2xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-lg transition group" data-imagen-id="${img.id}">
                <div class="aspect-square overflow-hidden bg-gray-100 relative">
                    <img src="${img.url}" alt="${img.cultivo}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" loading="lazy">
                    <span class="absolute top-2 right-2 inline-flex items-center gap-1 ${est.clase} backdrop-blur text-[10px] font-semibold px-2 py-0.5 rounded-full">
                        <i data-lucide="${est.icono}" class="w-3 h-3"></i>
                        ${est.label}
                    </span>
                </div>
                <div class="p-3">
                    <p class="text-sm font-semibold text-gray-900 mb-0.5 truncate">${img.cultivo}</p>
                    <p class="text-xs text-gray-500">${fechaStr}</p>
                </div>
            </div>
        `;
    }).join("");

    lucide.createIcons();

    // Event listeners
    document.querySelectorAll(".imagen-card").forEach(card => {
        card.addEventListener("click", () => {
            const id = parseInt(card.dataset.imagenId);
            const img = imagenes.find(i => i.id === id);
            if (img) abrirModal(img);
        });
    });
}

// ---------- Formatear fecha corta ----------
function formatearFechaHoraCorta(fechaISO) {
    if (!fechaISO) return "—";
    const d = new Date(fechaISO);
    const ahora = new Date();
    const esHoy = d.toDateString() === ahora.toDateString();
    const ayer = new Date(ahora);
    ayer.setDate(ayer.getDate() - 1);
    const esAyer = d.toDateString() === ayer.toDateString();

    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");

    if (esHoy) return `Hoy, ${hh}:${mm}`;
    if (esAyer) return `Ayer, ${hh}:${mm}`;
    return formatearFecha(fechaISO);
}

// ---------- Modal ----------
function abrirModal(img) {
    const modal = document.getElementById("modal-imagen");
    const modalImg = document.getElementById("modal-img");
    const modalCultivo = document.getElementById("modal-cultivo");
    const modalFecha = document.getElementById("modal-fecha");
    const modalOrigen = document.getElementById("modal-origen");

    modalImg.src = img.url;
    modalImg.alt = img.cultivo;
    modalCultivo.textContent = img.cultivo;
    modalFecha.textContent = formatearFechaHora(img.fecha_hora);
    modalOrigen.textContent = img.origen.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());

    modal.classList.remove("hidden");
    modal.classList.add("flex");
}

function cerrarModal() {
    const modal = document.getElementById("modal-imagen");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
}

// ---------- Contador ----------
function renderContador() {
    const contador = document.getElementById("contador-imagenes");
    if (contador) {
        const reales = imagenes.filter(i => i.real).length;
        const modo = reales > 0 ? "" : " (demo)";
        contador.textContent = `Mostrando ${imagenes.length} imágenes${modo}`;
    }
}

// ---------- Iniciar ----------
function initImagenes() {
    cargarImagenes();

    const modal = document.getElementById("modal-imagen");
    document.getElementById("btn-cerrar-modal")?.addEventListener("click", cerrarModal);

    modal?.addEventListener("click", (e) => {
        if (e.target === modal) cerrarModal();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !modal.classList.contains("hidden")) {
            cerrarModal();
        }
    });
}

// El script se carga al final del body, el DOM ya está listo
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initImagenes);
} else {
    initImagenes();
}