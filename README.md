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

Al arrancar, el contenedor aplica las migraciones y deja corriendo el planificador
(ver sección 7). Solo falta cargar los datos de prueba, en otra terminal:

```bash
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

---

## 5. Tests

```bash
python manage.py test                  # todos (108)
python manage.py test apps.usuarios    # una app puntual
```

---

## 6. Estado actual (actualizado 2026-09-28)

| App | Modelos/Migraciones | API | Tests |
|---|---|---|---|
| `usuarios` | ✅ | ✅ JWT + permisos | ✅ |
| `cultivos` | ✅ | ✅ | ✅ modelo, API y permisos |
| `dispositivos` | ✅ (+ campos de red y API key) | ✅ | ✅ modelo, permisos e ingesta |
| `monitoreo` | ✅ | ✅ (lectura + ingesta por API key) | ✅ |
| `eventos` | ✅ | ✅ solo lectura | ✅ |
| `alertas` | ✅ | ✅ | ✅ |
| `intervenciones` | ✅ | ✅ | ✅ |
| `inteligencia` | ✅ | ✅ | ✅ incluye cámaras (con `requests` simulado) |
| `reportes` | ✅ | ✅ | ✅ |

**Pendiente:** análisis real de imagen con OpenCV (`inteligencia/services.py` devuelve
métricas vacías), documentación Swagger/OpenAPI y frontend.

### Dependencias

Todas con versión fija en `requirements.txt` (Django, djangorestframework-simplejwt,
Pillow, django-filter, requests, openpyxl, reportlab).

---

## 7. Dispositivos (ESP32): autenticación por API key

Los dispositivos **no** usan usuario/contraseña. Cada uno tiene una API key propia:

1. Un administrador la genera (se muestra **una sola vez**, en la base se guarda solo su hash):
   ```
   POST /api/dispositivos/<id>/regenerar-api-key/      (con JWT de administrador)
   ```
2. El ESP32 envía cada lectura así:
   ```
   POST /api/ingesta/mediciones/
   Header:  X-API-Key: <la clave>
   Body:    {"sensor": 3, "valor": 6.4}
   ```
   El sensor debe pertenecer a ese dispositivo y el dispositivo debe estar `activo`.

Las personas (JWT) **solo consultan** `/api/mediciones/`; no pueden crear, editar ni borrar lecturas.

---

## 8. Tareas periódicas

### Desarrollo y Docker: `planificador`

```bash
python manage.py planificador          # queda corriendo; Ctrl+C para parar
python manage.py planificador --once   # corre todo una vez y termina
```

| Tarea | Frecuencia |
|---|---|
| `chequear_eventos` | cada 5 min |
| `poll_camaras` | cada 30 min |
| `evaluar_recomendaciones` | cada 1 h |
| `sync_camaras` | cada 24 h |
| `limpiar_imagenes_antiguas` | cada 24 h |

Con Docker se inicia solo. Local: abrir una segunda terminal con el venv activado.
Si una tarea falla, se registra el error y el planificador sigue con las demás.

### Producción (Linux): cron

```cron
*/5 * * * *  cd /app && python manage.py chequear_eventos >> /var/log/hidroponia/eventos.log 2>&1
*/30 8-19 * * * cd /app && python manage.py poll_camaras >> /var/log/hidroponia/camaras.log 2>&1
0 * * * *    cd /app && python manage.py sync_camaras --dias 1 >> /var/log/hidroponia/sync.log 2>&1
0 3 * * *    cd /app && python manage.py limpiar_imagenes_antiguas >> /var/log/hidroponia/limpieza.log 2>&1
0 */6 * * *  cd /app && python manage.py evaluar_recomendaciones >> /var/log/hidroponia/recomendaciones.log 2>&1
```

---

## 9. Variables de entorno

Ver `.env.example`. Si no están definidas, se usan valores de desarrollo.

| Variable | Para qué | Default |
|---|---|---|
| `DJANGO_SECRET_KEY` | Clave secreta de Django | clave de desarrollo |
| `DJANGO_DEBUG` | `1` = debug, `0` = producción | `1` |
| `DJANGO_ALLOWED_HOSTS` | Hosts permitidos, separados por coma | vacío |

**En producción** hay que poner `DJANGO_DEBUG=0`, una `DJANGO_SECRET_KEY` propia y los hosts reales.
