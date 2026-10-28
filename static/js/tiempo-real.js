// ============================================================
// tiempo-real.js — Utilidades compartidas de "Tiempo Real" (polling)
//
// Se incluye en las páginas que refrescan datos automáticamente
// (Dashboard, Monitoreo). Expone tres funciones:
//
//   iniciarPolling(fn)          → cada 30s llama a `fn()`:
//                                   - no solapa peticiones (guard interno)
//                                   - pausa al ocultar la pestaña (visibilitychange)
//                                   - refresca apenas se vuelve a la pestaña
//   marcarActualizado()         → lo invoca el ciclo tras un refresh exitoso
//   iniciarIndicadorEnVivo()    → activa el punto verde pulsante + texto
//                                 "Actualizado hace X seg" junto al título
// ============================================================

const INTERVALO_POLL_MS = 30000;

// ---------- Estado de polling ----------
let _pollTimer = null;    // timeout programado del próximo refresh
let _pollEnCurso = false; // guard: true mientras hay una petición en vuelo
let _pollFn = null;       // función de refresh de la página activa

// ---------- Estado del indicador ----------
let _instanteUltimaActualizacion = null;
let _timerTexto = null;
let _textoEnVivo = null;
let _pollEnPausa = false;

// ---------- Polling ----------

function _programarTick() {
    clearTimeout(_pollTimer);
    _pollTimer = setTimeout(ejecutarCicloPoll, INTERVALO_POLL_MS);
}

/**
 * Un "tick" del ciclo: ejecuta el refresh (si corresponde) y vuelve a
 * programar el próximo, pase lo que pase.
 */
async function ejecutarCicloPoll() {
    clearTimeout(_pollTimer);

    // Pestaña oculta o refresh anterior todavía en vuelo: no ejecutar ahora,
    // solo re-programar (así nunca se acumulan peticiones solapadas).
    if (document.hidden || _pollEnCurso || !_pollFn) {
        _programarTick();
        return;
    }

    _pollEnCurso = true;
    try {
        await _pollFn();
        marcarActualizado();
    } catch (err) {
        // Los errores del poll son no bloqueantes: la página ya está renderizada
        console.warn("[tiempo-real] Refresh automático falló:", err);
    } finally {
        _pollEnCurso = false;
        _programarTick();
    }
}

function iniciarPolling(fn) {
    _pollFn = fn;

    document.addEventListener("visibilitychange", () => {
        // Pestaña oculta → pausa: se corta el timer programado.
        // Una petición que ya arrancó no se interrumpe; el guard "_pollEnCurso"
        // evita que el próximo tick la solape.
        if (document.hidden) {
            clearTimeout(_pollTimer);
            _pollEnPausa = true;
            setTextoEnVivo("Actualización en pausa");
        } else {
            // Pestaña visible → reanuda: des-marca la pausa y refresca al instante
            _pollEnPausa = false;
            ejecutarCicloPoll();
        }
    });

    // Primer refresco programado (no inmediato: la carga inicial de la página
    // ya trae datos frescos desde cargar<Dashboard|Monitoreo>).
    _programarTick();
}

// ---------- Indicador "en vivo" ----------

/**
 * Muestra el indicador junto al título del gráfico y arranca el tick de 1 segundo
 * que refresca el texto. Solo manipula texto del DOM: no genera peticiones.
 */
function iniciarIndicadorEnVivo() {
    const cont = document.getElementById("indicador-en-vivo");
    if (cont) {
        cont.classList.remove("hidden");
        cont.classList.add("flex");
    }

    _textoEnVivo = document.getElementById("texto-en-vivo");
    setTextoEnVivo("Sincronizando…");

    _instanteUltimaActualizacion = Date.now();
    clearInterval(_timerTexto);
    _timerTexto = setInterval(actualizarTextoEnVivo, 1000);
}

/** Llamar tras un refresh exitoso: reinicia el contador "hace X seg". */
function marcarActualizado() {
    _instanteUltimaActualizacion = Date.now();
    actualizarTextoEnVivo();
}

function actualizarTextoEnVivo() {
    if (!_textoEnVivo || _instanteUltimaActualizacion == null) return;

    // En pausa el texto lo maneja el evento visibilitychange ("Actualización en pausa")
    if (_pollEnPausa) return;

    const seg = Math.floor((Date.now() - _instanteUltimaActualizacion) / 1000);
    if (seg < 60) {
        setTextoEnVivo(`Actualizado hace ${seg} seg`);
    } else {
        // Si el usuario se queda mucho tiempo leyendo, pasamos a minutos
        setTextoEnVivo(`Actualizado hace ${Math.floor(seg / 60)} min`);
    }
}

function setTextoEnVivo(texto) {
    if (_textoEnVivo) _textoEnVivo.textContent = texto;
}
