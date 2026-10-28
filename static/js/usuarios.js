// ============================================================
// usuarios.js — Carga dinámica, búsqueda y gestión de Usuarios
// ============================================================

let usuarios = [];
let usuariosFiltrados = [];

// ---------- Cargar lista ----------
async function cargarUsuarios() {
    const tbody = document.getElementById("tbody-usuarios");
    if (!tbody) return;

    try {
        tbody.innerHTML = `
            <tr><td colspan="6" class="py-8 text-center text-gray-400 text-sm">
                <i data-lucide="loader" class="w-5 h-5 mx-auto mb-2 animate-spin"></i>
                Cargando usuarios...
            </td></tr>
        `;
        lucide.createIcons();

        const resp = await apiGet("/usuarios/");
        usuarios = Array.isArray(resp) ? resp : (resp.results || []);
        usuariosFiltrados = [...usuarios];

        renderTabla();
        renderContador();
        configurarFormulario();
        configurarBusqueda();
        configurarTogglePassword(); // <-- Inicializa el ojito
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-red-500 text-sm">Error al cargar usuarios: ${err.message}</td></tr>`;
    }
}

// ---------- Búsqueda ----------
function configurarBusqueda() {
    const input = document.getElementById("input-buscar-usuario");
    if (!input) return;

    input.addEventListener("input", () => {
        const query = input.value.toLowerCase().trim();
        if (!query) {
            usuariosFiltrados = [...usuarios];
        } else {
            usuariosFiltrados = usuarios.filter(u =>
                (u.username || "").toLowerCase().includes(query) ||
                (u.email || "").toLowerCase().includes(query) ||
                (u.rol || "").toLowerCase().includes(query)
            );
        }
        renderTabla();
        renderContador();
    });
}

// ---------- Renderizar tabla ----------
function renderTabla() {
    const tbody = document.getElementById("tbody-usuarios");
    if (!tbody) return;

    if (usuariosFiltrados.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="6" class="py-12 text-center">
                <i data-lucide="users" class="w-10 h-10 text-gray-300 mx-auto mb-2"></i>
                <p class="text-sm text-gray-500">No se encontraron usuarios.</p>
            </td></tr>
        `;
        lucide.createIcons();
        return;
    }

    tbody.innerHTML = usuariosFiltrados.map(u => {
        const rolBadge = u.rol === "administrador"
            ? `<span class="inline-flex items-center bg-blue-100 text-blue-800 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">Administrador</span>`
            : `<span class="inline-flex items-center bg-gray-100 text-gray-700 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">Operador</span>`;

        const estadoBadge = u.is_active
            ? `<span class="inline-flex items-center gap-1 bg-green-100 text-green-800 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"><span class="w-1 h-1 bg-green-600 rounded-full"></span> Activo</span>`
            : `<span class="inline-flex items-center gap-1 bg-red-100 text-red-800 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"><span class="w-1 h-1 bg-red-600 rounded-full"></span> Inactivo</span>`;

        const inicial = escapeHtml((u.username || "?").charAt(0).toUpperCase());
        const avatarBg = u.rol === "administrador" ? "bg-blue-600" : "bg-brand";
        const filaClase = u.is_active ? "hover:bg-gray-50" : "hover:bg-gray-50 opacity-60";

        return `
            <tr class="${filaClase}" data-usuario-id="${u.id}">
                <td class="py-3 px-3">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 ${avatarBg} rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">${inicial}</div>
                        <div>
                            <p class="text-gray-900 font-medium">${escapeHtml(u.username)}</p>
                            <p class="text-xs text-gray-500">${escapeHtml(u.email || "Sin email")}</p>
                        </div>
                    </div>
                </td>
                <td class="py-3 px-3"><p class="text-gray-700 text-sm">${escapeHtml(u.username)}</p></td>
                <td class="py-3 px-3">${rolBadge}</td>
                <td class="py-3 px-3">${estadoBadge}</td>
                <td class="py-3 px-3 text-gray-600 text-xs whitespace-nowrap">${u.last_login ? tiempoRelativo(u.last_login) : "Nunca"}</td>
                <td class="py-3 px-3 text-right">
                    <div class="relative inline-block text-left menu-usuario-wrapper">
                        <button type="button" class="btn-menu-trigger p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-500 hover:text-gray-800" data-id="${u.id}" title="Opciones">
                            <i data-lucide="more-vertical" class="w-4 h-4"></i>
                        </button>
                        <div class="menu-dropdown hidden absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-30">
                            <button type="button" class="btn-item-editar w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition" data-id="${u.id}">
                                <i data-lucide="pencil" class="w-3.5 h-3.5 text-blue-600"></i> Editar datos
                            </button>
                            <button type="button" class="btn-item-toggle w-full text-left px-3 py-2 text-xs ${u.is_active ? 'text-amber-700 hover:bg-amber-50' : 'text-green-700 hover:bg-green-50'} flex items-center gap-2 transition" data-id="${u.id}">
                                <i data-lucide="${u.is_active ? 'user-x' : 'user-check'}" class="w-3.5 h-3.5"></i> ${u.is_active ? 'Desactivar' : 'Activar'}
                            </button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    lucide.createIcons();
    configurarEventosTabla(tbody);
}

function configurarEventosTabla(tbody) {
    tbody.querySelectorAll(".btn-menu-trigger").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const wrapper = btn.closest(".menu-usuario-wrapper");
            const dropdown = wrapper.querySelector(".menu-dropdown");
            const estaAbierto = !dropdown.classList.contains("hidden");
            document.querySelectorAll(".menu-usuario-wrapper .menu-dropdown").forEach(d => d.classList.add("hidden"));
            if (!estaAbierto) dropdown.classList.remove("hidden");
        });
    });

    tbody.querySelectorAll(".btn-item-editar").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            document.querySelectorAll(".menu-usuario-wrapper .menu-dropdown").forEach(d => d.classList.add("hidden"));
            const user = usuarios.find(item => item.id === parseInt(btn.dataset.id));
            if (user) abrirEditarUsuario(user);
        });
    });

    tbody.querySelectorAll(".btn-item-toggle").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            document.querySelectorAll(".menu-usuario-wrapper .menu-dropdown").forEach(d => d.classList.add("hidden"));
            const user = usuarios.find(item => item.id === parseInt(btn.dataset.id));
            if (user) {
                confirmarAccion({
                    titulo: `${!user.is_active ? "Activar" : "Desactivar"} usuario`,
                    mensaje: `¿Estás seguro de que deseas ${!user.is_active ? "activar" : "desactivar"} al usuario "${user.username}"?`,
                    textoConfirmar: !user.is_active ? "Activar" : "Desactivar",
                    esPeligroso: user.is_active,
                    onConfirm: () => toggleActivo(user.id, !user.is_active)
                });
            }
        });
    });
}

document.addEventListener("click", () => {
    document.querySelectorAll(".menu-usuario-wrapper .menu-dropdown").forEach(d => d.classList.add("hidden"));
});

// ---------- Toggle activo/inactivo ----------
async function toggleActivo(id, nuevoEstado) {
    try {
        const actualizado = await apiPatch(`/usuarios/${id}/`, { is_active: nuevoEstado });
        const idx = usuarios.findIndex(u => u.id === id);
        if (idx !== -1) usuarios[idx] = actualizado;
        const idxF = usuariosFiltrados.findIndex(u => u.id === id);
        if (idxF !== -1) usuariosFiltrados[idxF] = actualizado;
        renderTabla();
    } catch (err) {
        alert(`Error al actualizar estado: ${err.message}`);
    }
}

function renderContador() {
    const contador = document.getElementById("contador-usuarios");
    const titulo = document.getElementById("titulo-tabla");
    if (titulo) titulo.textContent = `Usuarios registrados (${usuarios.length})`;
    if (contador) contador.textContent = `Mostrando ${usuariosFiltrados.length} de ${usuarios.length} usuarios`;
}

// ---------- Formulario Modal ----------
function configurarFormulario() {
    const form = document.getElementById("form-usuario");
    if (!form) return;

    document.getElementById("btn-nuevo-usuario")?.addEventListener("click", abrirCrearUsuario);
    document.getElementById("btn-cerrar-usuario")?.addEventListener("click", cerrarForm);
    document.getElementById("btn-cancelar-usuario")?.addEventListener("click", cerrarForm);
    
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        validarYConfirmarGuardado();
    });
}

function abrirModal() {
    const modal = document.getElementById("modal-form-usuario");
    if (modal) {
        modal.classList.remove("hidden");
        modal.classList.add("flex");
    }
}

function abrirCrearUsuario() {
    const form = document.getElementById("form-usuario");
    if (form) form.reset();
    document.getElementById("usuario-id-editar").value = "";
    document.getElementById("titulo-form-usuario").textContent = "Crear usuario";
    document.getElementById("subtitulo-form-usuario").textContent = "Completa la información para crear un nuevo usuario.";
    document.getElementById("input-password").setAttribute("required", "required");
    document.getElementById("req-password").classList.remove("hidden");
    document.getElementById("hint-password").classList.add("hidden");
    document.getElementById("texto-btn-usuario").textContent = "Crear usuario";
    document.getElementById("icono-btn-usuario").setAttribute("data-lucide", "user-plus");
    abrirModal();
    lucide.createIcons();
}

function abrirEditarUsuario(u) {
    if (!u) return;
    document.getElementById("usuario-id-editar").value = u.id;
    document.getElementById("input-username").value = u.username || "";
    document.getElementById("input-email").value = u.email || "";
    document.getElementById("select-rol").value = u.rol || "operador";
    document.getElementById("input-password").value = "";
    document.getElementById("input-password").removeAttribute("required");
    document.getElementById("req-password").classList.add("hidden");
    document.getElementById("hint-password").classList.remove("hidden");
    document.getElementById("titulo-form-usuario").textContent = "Editar usuario";
    document.getElementById("subtitulo-form-usuario").textContent = `Modificando los datos de "${u.username}".`;
    document.getElementById("texto-btn-usuario").textContent = "Guardar cambios";
    document.getElementById("icono-btn-usuario").setAttribute("data-lucide", "save");
    abrirModal();
    lucide.createIcons();
}

function cerrarForm() {
    const modal = document.getElementById("modal-form-usuario");
    if (modal) {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
    }
    document.getElementById("form-usuario")?.reset();
    document.getElementById("usuario-id-editar").value = "";
}

// ---------- Validar y Confirmar ----------
function validarYConfirmarGuardado() {
    const idEditar = document.getElementById("usuario-id-editar").value;
    const esEdicion = !!idEditar;
    const username = document.getElementById("input-username").value.trim();
    const email = document.getElementById("input-email").value.trim();
    const rol = document.getElementById("select-rol").value;
    const password = document.getElementById("input-password").value;

    if (!username) { alert("Falta el nombre de usuario"); return; }
    if (!email) { alert("Falta el email"); return; }
    if (!rol) { alert("Seleccioná un rol"); return; }
    if (!esEdicion && (!password || password.length < 6)) { alert("La contraseña debe tener al menos 6 caracteres"); return; }
    if (esEdicion && password && password.length < 6) { alert("La nueva contraseña debe tener al menos 6 caracteres"); return; }

    // Confirmación antes de enviar
    confirmarAccion({
        titulo: esEdicion ? "Confirmar cambios" : "Confirmar creación",
        mensaje: esEdicion ? `¿Estás seguro de guardar los cambios en el usuario "${username}"?` : `¿Estás seguro de crear el usuario "${username}"?`,
        textoConfirmar: "Sí, guardar",
        esPeligroso: false,
        onConfirm: () => ejecutarGuardado(idEditar, esEdicion, { username, email, rol, password })
    });
}

// ---------- Guardar (API) ----------
async function ejecutarGuardado(idEditar, esEdicion, payload) {
    const btn = document.getElementById("btn-crear-usuario");
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Guardando...`;
        lucide.createIcons();
    }

    try {
        if (esEdicion) {
            // 🔥 SOLUCIÓN AL ERROR: Si la contraseña está vacía, no se envía a Django
            if (!payload.password || payload.password.trim() === "") {
                delete payload.password;
            }
            await apiPatch(`/usuarios/${idEditar}/`, payload);
        } else {
            payload.is_active = true;
            await apiPost("/usuarios/", payload);
        }

        const resp = await apiGet("/usuarios/");
        usuarios = Array.isArray(resp) ? resp : (resp.results || []);
        usuariosFiltrados = [...usuarios];
        renderTabla();
        renderContador();
        cerrarForm();
    } catch (err) {
        let msg = err.message;
        try {
            const json = JSON.parse(msg.split(": ").slice(1).join(": "));
            if (typeof json === "object") {
                msg = Object.entries(json).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join("\n");
            }
        } catch (e) {}
        alert(`Error al ${esEdicion ? "guardar" : "crear"} usuario:\n${msg}`);
    } finally {
        if (btn) {
            btn.disabled = false;
            const esEditFinal = !!document.getElementById("usuario-id-editar")?.value;
            btn.innerHTML = esEditFinal
                ? `<i id="icono-btn-usuario" data-lucide="save" class="w-4 h-4"></i> <span id="texto-btn-usuario">Guardar cambios</span>`
                : `<i id="icono-btn-usuario" data-lucide="user-plus" class="w-4 h-4"></i> <span id="texto-btn-usuario">Crear usuario</span>`;
            lucide.createIcons();
        }
    }
}

// ---------- Toggle Contraseña (Ojito) ----------
function configurarTogglePassword() {
    const btn = document.getElementById("btn-toggle-password");
    const input = document.getElementById("input-password");
    const icon = document.getElementById("icon-toggle-password");

    if (!btn || !input || !icon) return;

    // Remover listener anterior si existe (para evitar duplicados)
    const nuevoBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(nuevoBtn, btn);

    nuevoBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (input.type === "password") {
            input.type = "text";
            icon.setAttribute("data-lucide", "eye-off");
        } else {
            input.type = "password";
            icon.setAttribute("data-lucide", "eye");
        }
        lucide.createIcons();
    });
}

// ---------- Iniciar ----------
document.addEventListener("DOMContentLoaded", () => {
    cargarUsuarios();
});