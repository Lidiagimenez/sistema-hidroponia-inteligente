// ============================================================
// usuarios.js — Carga dinámica de la página de Usuarios
// ============================================================

let usuarios = [];
let usuarioSeleccionado = null;

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

        renderTabla();
        renderContador();
        configurarFormulario();
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `
            <tr><td colspan="6" class="py-8 text-center text-red-500 text-sm">
                Error al cargar usuarios: ${err.message}
            </td></tr>
        `;
    }
}

// ---------- Renderizar tabla ----------
function renderTabla() {
    const tbody = document.getElementById("tbody-usuarios");

    if (usuarios.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="6" class="py-12 text-center">
                <i data-lucide="users" class="w-10 h-10 text-gray-300 mx-auto mb-2"></i>
                <p class="text-sm text-gray-500">No hay usuarios registrados.</p>
            </td></tr>
        `;
        lucide.createIcons();
        return;
    }

    tbody.innerHTML = usuarios.map(u => {
        // Badge de rol
        const rolBadge = u.rol === "administrador"
            ? `<span class="inline-flex items-center bg-blue-100 text-blue-800 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">Administrador</span>`
            : `<span class="inline-flex items-center bg-gray-100 text-gray-700 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">Operador</span>`;

        // Badge de estado
        const estadoBadge = u.is_active
            ? `<span class="inline-flex items-center gap-1 bg-green-100 text-green-800 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                    <span class="w-1 h-1 bg-green-600 rounded-full"></span> Activo
               </span>`
            : `<span class="inline-flex items-center gap-1 bg-red-100 text-red-800 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                    <span class="w-1 h-1 bg-red-600 rounded-full"></span> Inactivo
               </span>`;

        // Avatar (inicial)
        const inicial = (u.username || "?").charAt(0).toUpperCase();
        const avatarBg = u.rol === "administrador" ? "bg-blue-600" : "bg-brand";

        // Fila con opacidad reducida si está inactivo
        const filaClase = u.is_active ? "hover:bg-gray-50" : "hover:bg-gray-50 opacity-60";

        return `
            <tr class="${filaClase}" data-usuario-id="${u.id}">
                <td class="py-3 px-3">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 ${avatarBg} rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                            ${inicial}
                        </div>
                        <div>
                            <p class="text-gray-900 font-medium">${u.username}</p>
                            <p class="text-xs text-gray-500">${u.email || "Sin email"}</p>
                        </div>
                    </div>
                </td>
                <td class="py-3 px-3">
                    <p class="text-gray-700 text-sm">${u.username}</p>
                </td>
                <td class="py-3 px-3">${rolBadge}</td>
                <td class="py-3 px-3">${estadoBadge}</td>
                <td class="py-3 px-3 text-gray-600 text-xs whitespace-nowrap">
                    ${u.last_login ? tiempoRelativo(u.last_login) : "Nunca"}
                </td>
                <td class="py-3 px-3">
                    <div class="flex items-center gap-1">
                        <button class="btn-toggle-activo p-1.5 hover:bg-gray-100 rounded transition" data-id="${u.id}" data-activo="${u.is_active}" title="${u.is_active ? 'Desactivar' : 'Activar'}">
                            <i data-lucide="${u.is_active ? 'user-x' : 'user-check'}" class="w-4 h-4 ${u.is_active ? 'text-red-500' : 'text-green-600'}"></i>
                        </button>
                        <button class="p-1.5 hover:bg-gray-100 rounded transition" title="Más">
                            <i data-lucide="more-vertical" class="w-4 h-4 text-gray-400"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    lucide.createIcons();

    // Event listeners
    document.querySelectorAll(".btn-toggle-activo").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.id);
            const activo = btn.dataset.activo === "true";
            toggleActivo(id, !activo);
        });
    });
}

// ---------- Toggle activo/inactivo ----------
async function toggleActivo(id, nuevoEstado) {
    try {
        const actualizado = await apiPatch(`/usuarios/${id}/`, { is_active: nuevoEstado });

        // Actualizar en el array local
        const idx = usuarios.findIndex(u => u.id === id);
        if (idx !== -1) usuarios[idx] = actualizado;

        renderTabla();
    } catch (err) {
        alert(`Error: ${err.message}`);
    }
}

// ---------- Contador ----------
function renderContador() {
    const contador = document.getElementById("contador-usuarios");
    const titulo = document.getElementById("titulo-tabla");

    if (titulo) titulo.textContent = `Usuarios registrados (${usuarios.length})`;
    if (contador) contador.textContent = `Mostrando 1 - ${usuarios.length} de ${usuarios.length} usuarios`;
}

// ---------- Formulario ----------
function configurarFormulario() {
    const form = document.getElementById("form-usuario");
    if (!form) return;

    // Botones abrir/cerrar
    document.getElementById("btn-nuevo-usuario")?.addEventListener("click", abrirForm);
    document.getElementById("btn-abrir-form-2")?.addEventListener("click", abrirForm);
    document.getElementById("btn-cerrar-usuario")?.addEventListener("click", cerrarForm);
    document.getElementById("btn-cancelar-usuario")?.addEventListener("click", cerrarForm);

    // Submit
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        await crearUsuario();
    });
}

function abrirForm() {
    document.getElementById("panel-form-usuario").classList.remove("hidden");
    document.getElementById("panel-cerrado-usuario").classList.add("hidden");
}

function cerrarForm() {
    document.getElementById("panel-form-usuario").classList.add("hidden");
    document.getElementById("panel-cerrado-usuario").classList.remove("hidden");
    document.getElementById("form-usuario").reset();
}

// ---------- Crear usuario (POST) ----------
async function crearUsuario() {
    const btn = document.getElementById("btn-crear-usuario");
    const username = document.getElementById("input-username").value.trim();
    const email = document.getElementById("input-email").value.trim();
    const rol = document.getElementById("select-rol").value;
    const password = document.getElementById("input-password").value;

    // Validaciones
    if (!username) { alert("Falta el nombre de usuario"); return; }
    if (!email) { alert("Falta el email"); return; }
    if (!rol) { alert("Seleccioná un rol"); return; }
    if (!password || password.length < 6) { alert("La contraseña debe tener al menos 6 caracteres"); return; }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Creando...`;
        lucide.createIcons();
    }

    try {
        const nuevo = await apiPost("/usuarios/", {
            username,
            email,
            rol,
            password,
            is_active: true,
        });

        // Recargar la lista
        const resp = await apiGet("/usuarios/");
        usuarios = Array.isArray(resp) ? resp : (resp.results || []);
        renderTabla();
        renderContador();

        // Cerrar form
        cerrarForm();

    } catch (err) {
        // Intenta extraer el mensaje del JSON de error
        let msg = err.message;
        try {
            const json = JSON.parse(msg.split(": ").slice(1).join(": "));
            if (typeof json === "object") {
                msg = Object.entries(json).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join("\n");
            }
        } catch (e) {}
        alert(`Error al crear usuario:\n${msg}`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="user-plus" class="w-4 h-4"></i> Crear usuario`;
            lucide.createIcons();
        }
    }
}

// ---------- Iniciar ----------
document.addEventListener("DOMContentLoaded", cargarUsuarios);