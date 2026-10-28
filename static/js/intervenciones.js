// Intervenciones y cosechas: historial, filtros y registro guiado.

let intervenciones = [];
let alertasDisponibles = [];
let cultivosDisponibles = [];
let ciclosDisponibles = [];
let sensoresDisponibles = []; // <--- NUEVA VARIABLE
let tabActivoIntervenciones = "todas";

const TIPOS_OPERADOR = new Set([
    "mantenimiento",
    "ajuste_parametros",
    "tratamiento",
    "cosecha",
]);

function resultados(response) {
    return Array.isArray(response) ? response : (response.results || []);
}

function idDe(entidad, ...claves) {
    return claves.map(clave => entidad && entidad[clave])
        .find(valor => valor !== undefined && valor !== null);
}

function valorFechaLocal(fecha = new Date()) {
    const ajuste = fecha.getTimezoneOffset() * 60_000;
    return new Date(fecha.getTime() - ajuste).toISOString().slice(0, 16);
}

function fechaParaApi(valor) {
    return valor ? new Date(valor).toISOString() : null;
}

function crearElemento(etiqueta, clases, contenido) {
    const elemento = document.createElement(etiqueta);
    if (clases) elemento.className = clases;
    if (contenido !== undefined) elemento.textContent = contenido;
    return elemento;
}

function poblarOpciones(select, opciones, placeholder, valor, etiqueta) {
    if (!select) return;
    select.replaceChildren(new Option(placeholder, ""));
    opciones.forEach(opcion => select.add(new Option(etiqueta(opcion), valor(opcion))));
}

function tituloAlerta(alerta) {
    if (alerta.titulo_descriptivo) return alerta.titulo_descriptivo;
    if (alerta.descripcion) return alerta.descripcion;
    return alerta.medicion
        ? "Alerta por medición #" + alerta.medicion
        : "Alerta por evento #" + alerta.evento;
}

function etiquetaCiclo(ciclo) {
    const id = idDe(ciclo, "id_ciclo", "id");
    const cultivo = ciclo.cultivo_nombre || (ciclo.cultivo && ciclo.cultivo.nombre);
    return cultivo
        ? "Ciclo #" + id + " - " + cultivo
        : "Ciclo #" + id + " - " + (ciclo.estado || "sin estado");
}

function poblarFiltrosYFormulario() {
    poblarOpciones(
        document.getElementById("filtro-cultivo"),
        cultivosDisponibles,
        "Todos los cultivos",
        cultivo => idDe(cultivo, "id_cultivo", "id"),
        cultivo => cultivo.nombre || "Cultivo #" + idDe(cultivo, "id_cultivo", "id"),
    );
    poblarOpciones(
        document.getElementById("select-alerta"),
        alertasDisponibles,
        "Seleccioná una alerta",
        alerta => idDe(alerta, "id"),
        tituloAlerta,
    );
    poblarOpciones(
        document.getElementById("select-cultivo"),
        cultivosDisponibles,
        "Seleccioná un cultivo",
        cultivo => idDe(cultivo, "id_cultivo", "id"),
        cultivo => cultivo.nombre || "Cultivo #" + idDe(cultivo, "id_cultivo", "id"),
    );
    poblarOpciones(
        document.getElementById("select-ciclo"),
        ciclosDisponibles,
        "Seleccioná un ciclo",
        ciclo => idDe(ciclo, "id_ciclo", "id"),
        etiquetaCiclo,
    );
    // <--- NUEVA POBLACIÓN PARA SENSORES
    poblarOpciones(
        document.getElementById("select-sensor"),
        sensoresDisponibles,
        "Seleccioná un sensor",
        sensor => idDe(sensor, "id"),
        sensor => sensor.tipo_sensor_nombre ? `${sensor.tipo_sensor_nombre} (ID: ${sensor.id})` : `Sensor #${sensor.id}`,
    );
}

async function cargarReferencias() {
    const respuestas = await Promise.all([
        apiGet("/alertas/"),
        apiGet("/cultivos/"),
        apiGet("/ciclos-produccion/"),
        apiGet("/sensores/"), // <--- NUEVA LLAMADA
    ]);
    alertasDisponibles = resultados(respuestas[0]);
    cultivosDisponibles = resultados(respuestas[1]);
    ciclosDisponibles = resultados(respuestas[2]);
    sensoresDisponibles = resultados(respuestas[3]); // <--- NUEVA ASIGNACIÓN
}

async function cargarIntervencionesData() {
    const query = new URLSearchParams();
    const tipo = document.getElementById("filtro-tipo")?.value;
    const cultivo = document.getElementById("filtro-cultivo")?.value;
    const fecha = document.getElementById("filtro-fecha")?.value;
    if (tipo) query.set("tipo", tipo);
    if (cultivo) query.set("cultivo", cultivo);
    if (fecha) query.set("fecha", fecha);

    const ruta = "/intervenciones/" + (query.toString() ? "?" + query.toString() : "");
    intervenciones = resultados(await apiGet(ruta))
        .sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));
}

async function cargarIntervenciones() {
    try {
        await cargarReferencias();
        poblarFiltrosYFormulario();
        await cargarIntervencionesData();
        renderTodo();
    } catch (error) {
        console.error(error);
        mostrarErrorTabla("No se pudieron cargar las intervenciones. Intentá actualizar la página.");
    }
}

function intervencionesVisibles() {
    if (tabActivoIntervenciones === "resueltas") {
        return intervenciones.filter(intervencion => intervencion.resuelta);
    }
    if (tabActivoIntervenciones === "proceso") {
        return intervenciones.filter(intervencion => !intervencion.resuelta);
    }
    return intervenciones;
}

function origen(intervencion) {
    if (intervencion.alerta) return intervencion.alerta_descripcion || "Alerta #" + intervencion.alerta;
    if (intervencion.cultivo) return intervencion.cultivo_nombre || "Cultivo #" + intervencion.cultivo;
    if (intervencion.ciclo) return intervencion.ciclo_nombre || "Ciclo #" + intervencion.ciclo;
    if (intervencion.sensor) return intervencion.sensor_nombre || "Sensor #" + intervencion.sensor; // <--- NUEVO ORIGEN
    return "Sin vínculo";
}

function botonAccion(icono, etiqueta, accion, id, color) {
    const boton = crearElemento(
        "button",
        "accion-intervencion p-1.5 rounded-lg transition " + color,
    );
    boton.type = "button";
    boton.dataset.accion = accion;
    boton.dataset.id = id;
    boton.title = etiqueta;
    boton.setAttribute("aria-label", etiqueta);
    boton.innerHTML = '<i data-lucide="' + icono + '" class="w-4 h-4"></i>';
    return boton;
}

function renderFila(intervencion) {
    const fila = crearElemento("tr", "hover:bg-gray-50");
    const fecha = new Date(intervencion.fecha_hora);
    const hora = String(fecha.getHours()).padStart(2, "0") + ":" + String(fecha.getMinutes()).padStart(2, "0");
    const descripcion = intervencion.descripcion_accion || intervencion.observaciones || "Sin descripción";
    const fechaCelda = crearElemento("td", "py-3 px-3 text-gray-700 whitespace-nowrap");
    fechaCelda.append(
        crearElemento("p", "font-medium", formatearFecha(intervencion.fecha_hora)),
        crearElemento("p", "text-xs text-gray-400", hora),
    );

    const estado = crearElemento(
        "span",
        intervencion.resuelta
            ? "inline-flex items-center bg-green-100 text-green-800 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
            : "inline-flex items-center bg-orange-100 text-orange-800 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap",
        intervencion.resuelta ? "Resuelta" : "En proceso",
    );
    const descripcionCelda = crearElemento("td", "py-3 px-3 text-gray-600 text-xs max-w-xs truncate", descripcion);
    descripcionCelda.title = descripcion;
    const accionesCelda = crearElemento("td", "py-3 px-3");
    const acciones = crearElemento("div", "flex items-center justify-end gap-1");
    if (!intervencion.resuelta) {
        acciones.append(botonAccion("check", "Marcar como resuelta", "resolver", intervencion.id, "text-brand hover:bg-brand-light"));
    }
    if (getRol() === "administrador") {
        acciones.append(botonAccion("trash-2", "Eliminar", "eliminar", intervencion.id, "text-red-600 hover:bg-red-50"));
    }
    accionesCelda.append(acciones);
    fila.append(
        fechaCelda,
        crearElemento("td", "py-3 px-3 text-gray-700 text-xs font-medium", intervencion.tipo_display || intervencion.tipo),
        crearElemento("td", "py-3 px-3 text-gray-700 text-xs", origen(intervencion)),
        descripcionCelda,
        crearElemento("td", "py-3 px-3 text-gray-700 text-xs whitespace-nowrap", intervencion.operador_username || "Usuario #" + intervencion.operador),
        crearElemento("td", "py-3 px-3", undefined),
        accionesCelda,
    );
    fila.children[5].append(estado);
    return fila;
}

function renderTabla() {
    const tbody = document.getElementById("tbody-intervenciones");
    if (!tbody) return;
    const lista = intervencionesVisibles();
    tbody.replaceChildren();
    if (!lista.length) {
        const fila = crearElemento("tr");
        const celda = crearElemento("td", "py-12 text-center text-sm text-gray-500", "No hay intervenciones para los filtros seleccionados.");
        celda.colSpan = 7;
        fila.append(celda);
        tbody.append(fila);
        return;
    }
    lista.forEach(intervencion => tbody.append(renderFila(intervencion)));
    lucide.createIcons();
}

function renderContadores() {
    const asignar = (id, valor) => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.textContent = valor;
    };
    asignar("tab-todas", intervenciones.length);
    asignar("tab-resueltas", intervenciones.filter(item => item.resuelta).length);
    asignar("tab-en-proceso", intervenciones.filter(item => !item.resuelta).length);
    const contador = document.getElementById("contador-intervenciones");
    if (contador) contador.textContent = "Mostrando " + intervencionesVisibles().length + " intervención(es)";
}

function renderTodo() {
    renderTabla();
    renderContadores();
}

function mostrarErrorTabla(mensaje) {
    const tbody = document.getElementById("tbody-intervenciones");
    if (!tbody) return;
    const fila = crearElemento("tr");
    const celda = crearElemento("td", "py-8 text-center text-red-600 text-sm", mensaje);
    celda.colSpan = 7;
    fila.append(celda);
    tbody.replaceChildren(fila);
}

function actualizarVistaVinculo() {
    const seleccion = document.querySelector("input[name='tipo-vinculo']:checked")?.value;
    document.getElementById("grupo-vinculo-alerta")?.classList.toggle("hidden", seleccion !== "alerta");
    document.getElementById("grupo-vinculo-cultivo")?.classList.toggle("hidden", seleccion !== "cultivo");
    document.getElementById("grupo-vinculo-ciclo")?.classList.toggle("hidden", seleccion !== "ciclo");
    // <--- NUEVO GRUPO
    document.getElementById("grupo-vinculo-sensor")?.classList.toggle("hidden", seleccion !== "sensor");
}

function actualizarVistaCosecha() {
    const esCosecha = document.getElementById("select-tipo")?.value === "cosecha";
    document.getElementById("grupo-cosecha")?.classList.toggle("hidden", !esCosecha);
    const fechaCosecha = document.getElementById("input-fecha-cosecha");
    if (esCosecha && fechaCosecha && !fechaCosecha.value) fechaCosecha.value = valorFechaLocal();
    if (!esCosecha) {
        ["select-resultado-cosecha", "input-cantidad-cosecha", "input-motivo-no-cosecha", "input-fecha-cosecha"]
            .forEach(id => {
                const campo = document.getElementById(id);
                if (campo) campo.value = "";
            });
    }
    actualizarVistaMotivo();
}

function actualizarVistaMotivo() {
    const noCosechado = document.getElementById("select-resultado-cosecha")?.value === "no_cosechado";
    document.getElementById("grupo-motivo-no-cosecha")?.classList.toggle("hidden", !noCosechado);
    document.getElementById("grupo-cantidad-cosecha")?.classList.toggle("hidden", noCosechado);
}

function limpiarFormulario() {
    document.getElementById("form-intervencion")?.reset();
    document.getElementById("input-fecha").value = valorFechaLocal();
    document.getElementById("input-responsable").value = getUsername();
    document.getElementById("error-intervencion")?.classList.add("hidden");
    const cultivo = document.querySelector("input[name='tipo-vinculo'][value='cultivo']");
    if (cultivo) cultivo.checked = true;
    actualizarVistaVinculo();
    actualizarVistaCosecha();
}

function abrirModal() {
    limpiarFormulario();
    const modal = document.getElementById("modal-intervencion");
    modal?.classList.remove("hidden");
    modal?.classList.add("flex");
    window.setTimeout(() => document.getElementById("select-tipo")?.focus(), 0);
}

function cerrarModal() {
    const modal = document.getElementById("modal-intervencion");
    modal?.classList.add("hidden");
    modal?.classList.remove("flex");
}

function mostrarErrorForm(mensaje) {
    const error = document.getElementById("error-intervencion");
    if (!error) return;
    error.textContent = mensaje;
    error.classList.remove("hidden");
}

async function crearIntervencion(event) {
    event.preventDefault();
    const tipo = document.getElementById("select-tipo").value;
    const observaciones = document.getElementById("input-observaciones").value.trim();
    const vinculo = document.querySelector("input[name='tipo-vinculo']:checked")?.value;
    const valorVinculo = document.getElementById("select-" + vinculo)?.value;
    
    if (!valorVinculo) {
        mostrarErrorForm("Seleccioná " + (vinculo === "alerta" ? "una alerta." : vinculo === "ciclo" ? "un ciclo." : vinculo === "sensor" ? "un sensor." : "un cultivo."));
        return;
    }
    if (!observaciones) {
        mostrarErrorForm("Escribí observaciones sobre la intervención.");
        return;
    }
    if (getRol() !== "administrador" && !TIPOS_OPERADOR.has(tipo)) {
        mostrarErrorForm("No tenés permisos para registrar ese tipo de intervención.");
        return;
    }

    const datos = {
        tipo,
        observaciones,
        descripcion_accion: document.getElementById("input-descripcion-accion").value.trim(),
        fecha_hora: fechaParaApi(document.getElementById("input-fecha").value),
    };
    datos[vinculo] = Number(valorVinculo);

    if (tipo === "cosecha") {
        const resultado = document.getElementById("select-resultado-cosecha").value;
        const motivo = document.getElementById("input-motivo-no-cosecha").value.trim();
        const cantidad = document.getElementById("input-cantidad-cosecha").value;
        datos.fecha_cosecha_real = fechaParaApi(document.getElementById("input-fecha-cosecha").value);
        if (resultado) datos.resultado_cosecha = resultado;
        if (resultado === "no_cosechado") {
            if (!motivo) {
                mostrarErrorForm("Indicá por qué no se realizó la cosecha.");
                return;
            }
            datos.motivo_no_cosecha = motivo;
        } else if (cantidad !== "") {
            datos.cantidad_cosechada_kg = Number(cantidad);
        }
    }

    const boton = document.getElementById("btn-guardar-intervencion");
    boton.disabled = true;
    boton.classList.add("opacity-70", "cursor-wait");
    document.getElementById("error-intervencion")?.classList.add("hidden");
    try {
        await apiPost("/intervenciones/", datos);
        cerrarModal();
        await cargarIntervencionesData();
        renderTodo();
    } catch (error) {
        console.error(error);
        mostrarErrorForm(error.message || "No se pudo registrar la intervención.");
    } finally {
        boton.disabled = false;
        boton.classList.remove("opacity-70", "cursor-wait");
    }
}

async function resolverIntervencion(id) {
    try {
        await apiPatch("/intervenciones/" + id + "/", { resuelta: true });
        await cargarIntervencionesData();
        renderTodo();
    } catch (error) {
        mostrarErrorTabla(error.message || "No se pudo actualizar la intervención.");
    }
}

async function eliminarIntervencion(id) {
    if (!window.confirm("¿Eliminar esta intervención? Esta acción no se puede deshacer.")) return;
    try {
        await apiDelete("/intervenciones/" + id + "/");
        await cargarIntervencionesData();
        renderTodo();
    } catch (error) {
        mostrarErrorTabla(error.message || "No se pudo eliminar la intervención.");
    }
}

function configurarEventos() {
    document.getElementById("btn-nueva-intervencion")?.addEventListener("click", abrirModal);
    document.getElementById("btn-abrir-form")?.addEventListener("click", abrirModal);
    document.getElementById("btn-cerrar-form")?.addEventListener("click", cerrarModal);
    document.getElementById("btn-cancelar-form")?.addEventListener("click", cerrarModal);
    document.getElementById("modal-intervencion")?.addEventListener("click", event => {
        if (event.target.id === "modal-intervencion") cerrarModal();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") cerrarModal();
    });
    document.querySelectorAll("input[name='tipo-vinculo']").forEach(radio => {
        radio.addEventListener("change", actualizarVistaVinculo);
    });
    document.getElementById("select-tipo")?.addEventListener("change", actualizarVistaCosecha);
    document.getElementById("select-resultado-cosecha")?.addEventListener("change", actualizarVistaMotivo);
    document.getElementById("form-intervencion")?.addEventListener("submit", crearIntervencion);
    ["filtro-tipo", "filtro-cultivo", "filtro-fecha"].forEach(id => {
        document.getElementById(id)?.addEventListener("change", async () => {
            try {
                await cargarIntervencionesData();
                renderTodo();
            } catch (error) {
                mostrarErrorTabla("No se pudo aplicar el filtro.");
            }
        });
    });
    document.querySelectorAll(".tab-intervencion").forEach(boton => {
        boton.addEventListener("click", () => {
            tabActivoIntervenciones = boton.dataset.tab;
            document.querySelectorAll(".tab-intervencion").forEach(tab => {
                tab.classList.toggle("active", tab === boton);
            });
            renderTodo();
        });
    });
    document.getElementById("tbody-intervenciones")?.addEventListener("click", event => {
        const boton = event.target.closest(".accion-intervencion");
        if (!boton) return;
        const id = Number(boton.dataset.id);
        if (boton.dataset.accion === "resolver") resolverIntervencion(id);
        if (boton.dataset.accion === "eliminar") eliminarIntervencion(id);
    });
    if (getRol() !== "administrador") {
        document.querySelectorAll("[data-solo-admin]").forEach(opcion => opcion.remove());
    }
}

document.addEventListener("DOMContentLoaded", () => {
    configurarEventos();
    limpiarFormulario();
    cargarIntervenciones();
});