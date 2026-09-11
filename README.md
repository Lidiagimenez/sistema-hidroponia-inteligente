# HidroSensor — Guía de trabajo del equipo

Proyecto: sistema de monitoreo hidropónico inteligente (Django 6.1 + DRF + SQLite + Docker).

Esta es la única guía de setup y flujo de trabajo con Git para el equipo. Si algo no está acá, se agrega acá — no creamos guías nuevas sueltas.

---

## 0. Qué NO se sube a Git (y por qué)

| Archivo/carpeta | Motivo |
|---|---|
| `.venv/` | Entorno virtual de Python. No es portable entre máquinas ni sistemas operativos — cada quien genera el suyo. |
| `data/db.sqlite3` | Base de datos. Es binaria: no se puede mergear, genera conflictos irresolubles y expone contraseñas hasheadas. |
| `.env` | Variables de entorno / secretos. |

En cambio, `apps/usuarios/fixtures/seed_demo.json` **sí se sube** — es texto plano con datos de prueba compartidos (usuarios y cultivos base), para no tener que crear un superusuario a mano cada vez.

---

## 1. Primeros pasos (una sola vez, al empezar a trabajar en el proyecto)

```bash
# 1. Clonar el repo
git clone <url-del-repo>
cd sistema-hidroponia-inteligente

# 2. Crear y activar tu propio entorno virtual
python -m venv .venv
source .venv/Scripts/activate      # Windows (Git Bash)
# .venv\Scripts\activate.bat       # Windows (CMD)
# source .venv/bin/activate        # Mac/Linux

# Confirmá que el prompt ahora arranca con (.venv) —
# si no aparece, los próximos comandos van a fallar con ModuleNotFoundError.

# 3. Instalar dependencias
pip install -r requirements.txt

# 4. Verificar que exista la carpeta data/ (el clone ya la trae vacía)
ls data/ || mkdir -p data

# 5. Aplicar migraciones (crea data/db.sqlite3 con todas las tablas, vacías)
python manage.py migrate

# 6. Cargar los datos de prueba compartidos del equipo
python manage.py loaddata seed_demo.json
```

Con el paso 6 ya tenés cargados estos usuarios (mismas contraseñas que usa el equipo — pedíselas a quien las creó si no las tenés):

| Username | Rol | Superusuario |
|---|---|---|
| `admin` | administrador | sí |
| `admin_test` | administrador | no |
| `operador_test` | operador | no |

Si preferís tu propio usuario en vez de usar los del fixture, salteá el paso 6 y corré `python manage.py createsuperuser` — pero después ejecutá esto para que tenga el rol correcto (el campo `rol` no lo pide `createsuperuser`):

```bash
python manage.py shell -c "
from apps.usuarios.models import Usuario
u = Usuario.objects.get(username='TU_USERNAME')
u.rol = 'administrador'
u.save()
"
```

```bash
# 7. Levantar el servidor
python manage.py runserver
```

Entrá a `http://127.0.0.1:8000/admin/` (con `http://` explícito — si escribís `https://` te va a tirar un error 400, porque el servidor de desarrollo no habla HTTPS).

### Alternativa: Docker

Requiere Docker Desktop abierto y corriendo.

```bash
git clone <url-del-repo>
cd sistema-hidroponia-inteligente
mkdir -p data
docker compose up --build
```

En otra terminal, con el contenedor arriba:

```bash
docker compose exec web python manage.py migrate
docker compose exec web python manage.py loaddata seed_demo.json
```

Servidor en `http://localhost:8000/`. Para parar: `Ctrl+C` o `docker compose down`.

---

## 2. Cómo subir tus cambios a Git

```bash
# 1. Ver qué cambiaste
git status

# 2. Agregar los archivos (evitá "git add ." a lo ciego; revisá qué entra)
git add apps/cultivos/ apps/usuarios/  # ejemplo: las carpetas/archivos que tocaste

# 3. Confirmar que NO se coló .venv/ ni data/db.sqlite3
git status
# Si aparecen esos dos ahí, algo está mal con el .gitignore — avisar antes de seguir.

# 4. Commitear con un mensaje claro
git commit -m "feat: descripción corta de lo que hiciste"

# 5. Traer cambios del equipo ANTES de subir los tuyos (evita conflictos innecesarios)
git pull

# 6. Subir
git push
```

### Casos especiales al subir

- **¿Agregaste una librería nueva?** (`pip install algo`) → actualizá `requirements.txt` antes de commitear:
  ```bash
  pip freeze > requirements.txt
  ```
- **¿Cambiaste un modelo (`models.py`)?** → generá y subí también el archivo de migración:
  ```bash
  python manage.py makemigrations
  git add apps/<tu_app>/migrations/
  ```
- **¿Actualizaste los datos de prueba compartidos?** → regenerá el fixture y avisá al equipo antes de subir (ver sección 4):
  ```bash
  python manage.py dumpdata usuarios cultivos --indent 2 --natural-foreign > apps/usuarios/fixtures/seed_demo.json
  git add apps/usuarios/fixtures/seed_demo.json
  ```

---

## 3. Cómo bajar los cambios de tus compañeros

```bash
git pull
```

Pero **`git pull` solo trae código** — no corre nada por vos. Después de cada `pull`, revisá si necesitás alguno de estos tres pasos (son inofensivos correrlos siempre "por las dudas", no rompen nada si no había cambios):

```bash
# ¿Alguien agregó una librería nueva? Reinstalá dependencias:
pip install -r requirements.txt

# ¿Alguien agregó/cambió modelos? Aplicá las migraciones nuevas:
python manage.py migrate

# ¿Alguien actualizó los datos de prueba compartidos? Recargá el fixture:
python manage.py loaddata seed_demo.json
```

**Tip:** si `python manage.py runserver` te avisa `You have N unapplied migration(s)`, es la señal de que te faltó correr `migrate` después del `pull`.

---

## 4. Recordatorio sobre el fixture (`seed_demo.json`)

`loaddata` actualiza o crea por `pk`, pero **nunca borra**. Si alguien saca un registro del fixture, no desaparece solo de las bases de los demás. Por eso:

- Es seguro correr `loaddata seed_demo.json` las veces que haga falta.
- Si vas a regenerar el fixture con datos nuevos, avisá en el grupo antes de hacer `push`, para que nadie se sorprenda si les pisa algo que tenían con el mismo `pk`.
- El fixture es para **datos semilla compartidos** (usuarios base, algún cultivo de ejemplo) — tus propios datos de prueba personales creálos aparte, sin necesidad de meterlos en el fixture.

---

## 5. Estado del proyecto por app

| App | Responsable | Modelos/Migraciones | API (serializers/views/urls) |
|---|---|---|---|
| `usuarios` | Persona 1 | ✅ | ✅ completa (JWT, permisos, tests) |
| `cultivos` | Persona 1 | ✅ | ⏳ pendiente |
| `dispositivos`, `monitoreo`, `eventos` | Persona 2 | ✅ | ⏳ pendiente |
| `alertas`, `intervenciones` | Persona 3 | ✅ | ⏳ pendiente |
| `inteligencia`, `reportes` | Persona 3 | ⏳ no iniciado | ⏳ no iniciado |

**Pendiente transversal:** ninguna app (ni siquiera `cultivos`) está enrutada todavía en `config/urls.py` — hoy solo incluye `apps.usuarios.urls`. Al implementar la API de cada app, agregar también su `include()` correspondiente.

---

## 6. Tests

```bash
python manage.py test                  # todos
python manage.py test apps.usuarios    # una app puntual
```