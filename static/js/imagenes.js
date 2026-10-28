// ============================================================
// imagenes.js — Galería de imágenes con fallback a Unsplash
// ============================================================

let imagenes = [];
let imagenSeleccionada = null;

// true = mostrar fotos demo de Unsplash cuando no hay imágenes reales.
// Ojo: la CSP por defecto solo permite img-src 'self', así que las imágenes
// remotas se bloquean salvo que se agregue el dominio a la política.
const MOSTRAR_DEMO = false;

// Normaliza la URL que devuelve DRF a algo que el navegador pueda pedir.
function mediaUrl(valor) {
    if (!valor) return "";
    const url = String(valor).trim();
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith("//")) return ""; // protocol-relative: solo confiamos en el origen actual
    return url.startsWith("/") ? url : `/${url}`;
}

// Mapea un item del API (Imagen o AnalisisImagen) al formato de la galería.
function normalizarImagen(item, origenPorDefecto = "periodica") {
    const url = mediaUrl(
        item.archivo_url || item.url_imagen || item.archivo || item.imagen
    );
    if (!url) return null;

    return {
        id: item.id,
        cultivo: item.cultivo_nombre || `Cultivo #${item.cultivo ?? "?"}`,
        url,
        fecha_hora: item.fecha_hora || null,
        origen: item.origen_captura || origenPorDefecto,
        dispositivo: item.dispositivo_nombre || "—",
        real: true,
    };
}

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

    grid.innerHTML = `
        <div class="col-span-full text-center py-8 text-gray-400 text-sm">
            <i data-lucide="loader" class="w-6 h-6 mx-auto mb-2 animate-spin"></i>
            Cargando imágenes...
        </div>
    `;
    lucide.createIcons();

    // Consultamos LAS DOS fuentes, no una u otra.
    const [resMonitoreo, resAnalisis] = await Promise.allSettled([
        apiGet("/imagenes/"),          // subidas del ESP32 / admin
        apiGet("/analisis-imagen/"),   // capturas de la IA
    ]);

    const aLista = (resultado) => {
        if (resultado.status !== "fulfilled" || !resultado.value) return [];
        return Array.isArray(resultado.value)
            ? resultado.value
            : (resultado.value.results || []);
    };

    const encontradas = [
        ...aLista(resMonitoreo).map((item) => normalizarImagen(item, "periodica")),
        ...aLista(resAnalisis).map((item) => normalizarImagen(item, "manual")),
    ].filter(Boolean);

    // Deduplicar por URL (la misma foto puede estar en las dos tablas).
    const vistas = new Set();
    imagenes = encontradas.filter((img) => {
        if (vistas.has(img.url)) return false;
        vistas.add(img.url);
        return true;
    });

    if (imagenes.length === 0 && MOSTRAR_DEMO) {
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

    if (imagenes.length === 0) {
        console.warn(
            "No hay imágenes reales. Revisá GET /api/imagenes/ y media/imagenes_cultivo/."
        );
    } else {
        console.log(`✅ ${imagenes.length} imágenes reales cargadas`);
    }

    renderGaleria();
    renderContador();
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

    grid.innerHTML = imagenes.map((img, index) => {
        const origenKey = (img.origen || "periodica").toLowerCase().replace(/ /g, "_");
        const est = ORIGEN_ESTILOS[origenKey] || ORIGEN_ESTILOS.periodica;
        const fechaStr = formatearFechaHoraCorta(img.fecha_hora);

        return `
            <div class="imagen-card bg-white rounded-2xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-lg transition group" data-index="${index}">
                <div class="aspect-square overflow-hidden bg-gray-100 relative">
                    <img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.cultivo)}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" loading="lazy">
                    <span class="absolute top-2 right-2 inline-flex items-center gap-1 ${est.clase} backdrop-blur text-[10px] font-semibold px-2 py-0.5 rounded-full">
                        <i data-lucide="${est.icono}" class="w-3 h-3"></i>
                        ${est.label}
                    </span>
                </div>
                <div class="p-3">
                    <p class="text-sm font-semibold text-gray-900 mb-0.5 truncate">${escapeHtml(img.cultivo)}</p>
                    <p class="text-xs text-gray-500">${fechaStr}</p>
                </div>
            </div>
        `;
    }).join("");

    lucide.createIcons();

    // Event listeners (por índice: los ids pueden repetirse entre endpoints)
    document.querySelectorAll(".imagen-card").forEach(card => {
        card.addEventListener("click", () => {
            const img = imagenes[Number(card.dataset.index)];
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

    // Link de descarga del modal apunta al archivo real
    const linkDescarga = document.querySelector("#modal-imagen a[download]");
    if (linkDescarga) linkDescarga.href = img.url;

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