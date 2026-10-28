# Guía de Presentación: Sistema Inteligente de Hidroponía Recirculante

## 1. Visión General del Sistema

### ¿Qué hace el sistema?
El **Sistema Inteligente de Hidroponía Recirculante** es una plataforma integral para el monitoreo, control y análisis de cultivos hidropónicos. Su objetivo es centralizar la información proveniente del hardware IoT, visualizarlos de forma clara para el usuario y asistir en la toma de decisiones mediante alertas y **Inteligencia Artificial**.

Sus principales funcionalidades son:

- **Monitoreo en tiempo real**: Captura valores de sensores (pH, temperatura, TDS/CE, etc.) asociados a dispositivos y cultivos.
- **Gestión de cultivos, dispositivos y sensores**: Permite organizar el ecosistema hidropónico por cultivo, asociar sensores mediante relación **Muchos a Muchos** (`Sensor.cultivos`) y mantener el historial mediante **borrado lógico**.
- **Alertas e intervenciones**: Detección de valores fuera de rango y registro de acciones correctivas.
- **Captura de imágenes**: Recepción de fotografías desde la cámara del ESP32 para seguimiento visual del cultivo.
- **Detección de anomalías con IA**: Identificación de patrones anómalos mediante **Isolation Forest** (enfoque híbrido con reglas de negocio).
- **Seguridad y auditoría**: Sistema de roles (Administrador / Operador), autenticación por JWT en cookies **HttpOnly**, trazabilidad de acciones y protección de endpoints IoT con **API Key**.

### Diagrama de flujo (visión general)
```
[ESP32 + Sensores + Cámara] 
            │  (HTTP + X-API-Key)
            ▼
        API Django (DRF)
            │  (validación, reglas, autenticación)
            ├──► Base de Datos (SQLite en desarrollo)
            ├──► Módulo de IA (IsolationForest / Anomalías)
            ├──► Sistema de Alertas / Auditoría
            │
            ▼
        Frontend (HTML/JS + Tailwind)
            │  (fetch vía api.js + JWT en cookie HttpOnly)
            ▼
           Usuario (Admin / Operador)
``` 

---

## 2. El Ecosistema Django y el Patrón MVT (Model-View-Template)

Django sigue el patrón **MVT** (*Model - View - Template*):

- **Model**: Define la estructura de los datos y su relación con la base de datos (ORM).
- **View**: Contiene la lógica de negocio (qué se muestra, qué se valida, qué permisos se aplican).
- **Template**: Se encarga de la presentación (HTML). En este proyecto las vistas de páginas usan `TemplateView` y la interacción dinámica se realiza vía API + JavaScript.

Tomando como ejemplo la app `apps/monitoreo`, vamos a detallar cada archivo:

### `models.py`
Define las entidades y sus relaciones. Aquí se modela el dominio de monitoreo:

- `TipoSensor`: Define el tipo de sensor, su **unidad de medida** y sus **límites físicos** (`valor_min_fisico`, `valor_max_fisico`).
- `Sensor`: Se relaciona con `Dispositivo` (`ForeignKey`), con `TipoSensor` (`ForeignKey`) y con `Cultivo` mediante **`ManyToManyField`** (`cultivos`). Posee `is_active` para **borrado lógico** (no se eliminan mediciones históricas al desactivar).
- `RangoOperacion`: Permite definir el rango válido de operación para un sensor (`valor_min`/`valor_max`) con vigencia (`vigente_desde`).
- `Medicion`: Almacena cada lectura con `valor`, `fecha_hora` (usa `default=timezone.now` para soportar **Store & Forward** desde el ESP32) y `estado_lectura` (`normal` / `fuera_rango`).
- `Imagen`: Almacena fotografías asociadas a un `Cultivo`, con `fecha_hora` configurable y `archivo` (`ImageField` en `imagenes_cultivo/`).

### `serializers.py` (Django REST Framework - DRF)
Los **serializers** transforman objetos de Django (Models) a JSON y viceversa. Son fundamentales para la **API REST** porque permiten:

- **Exponer solo lo necesario**: Ej. `SensorSerializer` agrega campos calculados como `tipo_sensor_nombre`, `unidad_medida`, `cultivos_detalle` y `cultivo_principal` (con **fallback** al cultivo del dispositivo para mantener compatibilidad con sensores antiguos).
- **Validación**: `ImagenSerializer.validate_archivo()` delega a `apps.common.validators.validate_uploaded_image` para validar el archivo subido.
- **URLs absolutas**: `get_archivo_url()` construye la URL completa usando el `request` del contexto.
- **Control de escritura**: En `MedicionSerializer`, `fecha_hora` y `estado_lectura` son `read_only_fields` (el servidor controla gran parte de ese flujo).

### `views.py`
Aquí está la lógica de endpoints. Diferenciamos dos conceptos clave:

#### Vista normal (`APIView`) vs `ViewSet`
- **`APIView`**: Más explícito. Se define manualmente qué método HTTP se implementa (`get`, `post`, etc.). Ideal cuando el comportamiento es muy específico.
- **`ViewSet` (`ModelViewSet`, `ReadOnlyModelViewSet`)**: Genera automáticamente CRUD/resto de acciones basadas en el router. Reduce código y mantiene consistencia. Permite agregar acciones personalizadas con `@action`.

**Ejemplos del proyecto:**

- **`IngestaMedicionView(APIView)`** (vista normal): Endpoint exclusivo para dispositivos IoT.
  - Usa `DispositivoAPIKeyAuthentication` + `EsDispositivo` + `ApiKeyScopedRateThrottle` (`iot_ingesta`).
  - Valida que el **sensor pertenezca al dispositivo** que autenticó (`sensor.dispositivo_id == dispositivo.id`).
  - Verifica que tanto **dispositivo** como **sensor** estén activos (`is_active` / `esta_activo` / `estado`).
  - Soporta **fecha enviada por el ESP32** (para *Store & Forward*): toma `fecha_hora` del request, lo parsea y si no viene, usa `timezone.now()`.
  - **Evita duplicados**: busca `Medicion.objects.filter(sensor=sensor, fecha_hora=fecha_dt).first()` y si existe, no crea uno nuevo (evitando duplicados por reintentos).
  
- **`MedicionViewSet(ReadOnlyModelViewSet)`** (ViewSet de solo lectura): Pensado para el **frontend humano**. Permite listar/consultar mediciones con filtros por `sensor` y `estado_lectura`. Requiere permisos `EsAdministradorOOperador`.

Otros ViewSets (`TipoSensorViewSet`, `SensorViewSet`, `RangoOperacionViewSet`) usan `AuditableSerializerMixin` para registrar acciones en auditoría, aplican permisos por rol según la acción (solo **Administrador** para crear/editar/eliminar/desactivar/activar) y `SensorViewSet` implementa **borrado lógico** en `perform_destroy()` (pone `is_active=False`) en lugar de borrar el registro.

- **`ImagenViewSet`**: Soporta **autenticación mixta** (`DispositivoAPIKeyAuthentication, CookieJWTAuthentication`) porque tanto el **ESP32** (API Key) como el **administrador/operador** (JWT) pueden subir imágenes. 
  - Al crear, **normaliza** los datos (acepta aliases como `foto/imagen/file/image`), asigna **cultivo automáticamente** si lo sube un dispositivo y no se envió cultivo, normaliza `fecha_hora` con `_parse_fecha_hora()` (soporta **ISO-8601** o **epoch en segundos**) y valida con el serializer.
  - Throttle con scope `iot_imagenes`. Permisos: crear permitido para **(EsDispositivo | EsAdministrador)**, actualizar/eliminar solo **Administrador**, resto para **AdministradorOOperador**.

### `urls.py`
- Usa **`DefaultRouter`** para registrar ViewSets (`tipos-sensor`, `sensores`, `rangos-operacion`, `mediciones`, `imagenes`) generando rutas REST estándar.
- Agrega explícitamente la ruta para ingesta IoT: `path("ingesta/mediciones/", IngestaMedicionView.as_view(), name="ingesta-mediciones")`.
- Estas rutas se incluyen bajo `/api/` desde `config/urls.py` junto al resto de apps.

### `admin.py`
Aunque el proyecto expone mayormente su propia interfaz administrativa personalizada (`/usuarios/`, `/dispositivos/`, `/auditoria/`, etc.), Django Admin está presente. En desarrollo se habilita bajo una ruta poco obvia (`/panel-interno/`) únicamente cuando `DEBUG=True` (ver `config/urls.py`). Sirve como **trastienda técnica** para inspección directa de modelos, útil para depuración.

---

## 3. Conexión con la Base de Datos

### ¿Qué base de datos usamos actualmente?
Actualmente el proyecto utiliza **SQLite**. En `config/settings.py` se configura:

```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'data' / 'db.sqlite3',
        'OPTIONS': {'timeout': 20},
    }
}
```

El archivo se ubica en `data/db.sqlite3`. En desarrollo esto es práctico y suficiente. Sin embargo, para **producción** se plantea el cambio a **PostgreSQL** (ver sección 7).

### ¿Cómo se comunica Django con ella (ORM)?
Django utiliza su **ORM** (*Object Relational Mapper*). Esto significa que:
- No escribimos SQL crudo para operaciones típicas; interactuamos con clases `Model` (`Medicion.objects.create()`, `.filter()`, `.get()`, `.select_related()`, `.prefetch_related()`).
- El ORM genera las consultas SQL automáticamente y gestiona el mapeo entre tablas y objetos Python.
- Las migraciones (`migrations/`) versionan el esquema de la base de datos.
- Existen optimizaciones usadas en el código: `select_related` (relaciones `ForeignKey`/`OneToOne`) y `prefetch_related` (relaciones inversas o `ManyToMany`), como se ve en `SensorViewSet.get_queryset()` y en consultas del módulo de IA.

### Relación entre modelos (ejemplo: Usuario -> Cultivo -> Sensor -> Medición)
Basado en el código real:

- **Usuario** (`apps/usuarios.models.Usuario`, heredando de `AbstractUser`, `AUTH_USER_MODEL = 'usuarios.Usuario'`): Representa a los usuarios del sistema con roles (Administrador / Operador). Se autentican con JWT en **cookies HttpOnly**.
- **Cultivo** (`apps/cultivos`): Entidad central del sistema hidropónico. Se relaciona con:
  - `Dispositivo.cultivo` (`ForeignKey`, ver `apps/dispositivos/models.py`)
  - `Sensor.cultivos` (`ManyToManyField`, ver `apps/monitoreo/models.py`) - *Un sensor puede estar asociado a uno o varios cultivos*.
  - `Imagen.cultivo` (`ForeignKey`)
  - `Anomalia.cultivo` (en `apps/inteligencia/models.py`, usado por el módulo de IA)
- **Dispositivo** (`apps/dispositivos.models.Dispositivo`): Hardware físico (ESP32/otros). Pertenece a un `Cultivo`, tiene `identificador_hardware` único, estado, flags de `is_active`/`es_simulado`, datos de red/cámara (`ip_local`, `url_captura`, `permite_polling`) y **autenticación por API Key** (`api_key_hash`, con `generar_api_key()` que retorna la clave en **claro solo una vez**).
- **Sensor** (`apps/monitoreo.models.Sensor`): Dispositivo lógico de medición asociado a un `Dispositivo`, de un `TipoSensor` y a uno/muchos `Cultivo(s)`. Tiene `is_active` para borrado lógico.
- **Medición** (`apps/monitoreo.models.Medicion`): Lectura puntual con `valor`, `fecha_hora`, `estado_lectura` asociada a un `Sensor`. Es el insumo principal para monitoreo, alertas y para el **entrenamiento/evaluación** del modelo de IA.

**Flujo relacional**: `Usuario` administra/configura → `Cultivo` agrupa → `Dispositivo` (con su `api_key`) se instala en el cultivo → `Sensor` se vincula al dispositivo y a cultivos → `Medicion` llega desde `IngestaMedicionView` → se visualiza en el frontend y se analiza con IA/alertas.

---

## 4. La API REST y la Conexión con el Frontend

### ¿Cómo pide datos el Frontend (HTML/JS con Tailwind)?
El frontend está compuesto por plantillas Django (`templates/`) con **HTML + JavaScript + Tailwind CSS**. La comunicación con el backend se realiza **asíncronamente** mediante **`fetch`** a los endpoints REST bajo `/api/`.

Aunque el archivo exacto `static/js/api.js` no fue leído en esta sesión, el patrón es evidente por la arquitectura:
- Las páginas renderizadas por `TemplateView` (dashboard, monitoreo, alertas, cultivos, etc.) cargan scripts JS que consumen la API REST de DRF.
- Las peticiones usan `fetch()` con `credentials: 'include'` (o equivalente) para enviar las **cookies HttpOnly** con los JWT.
- Se respetan los permisos del backend: si el usuario no está autenticado o no tiene rol, la API devuelve 401/403.

### ¿Cómo se asegura que un usuario no entre a datos que no debe?
La seguridad se implementa en **capas**:

#### Autenticación (quién eres)
- **Para usuarios humanos**: Se usa **JWT** con `djangorestframework-simplejwt`. La configuración usa **cookies HttpOnly** (`JWT_ACCESS_COOKIE = "hidro_access"`, `JWT_REFRESH_COOKIE = "hidro_refresh"`) gestionadas por `apps.usuarios.authentication.CookieJWTAuthentication` (que acepta tanto `Authorization: Bearer` como cookie). Tokens con rotación y **blacklist** tras rotación (`ROTATE_REFRESH_TOKENS=True`, `BLACKLIST_AFTER_ROTATION=True`). Lifetimes: access 15 min, refresh 7 días.
- **Para dispositivos IoT**: Se usa **API Key** vía header `X-API-Key`, comparada con `Dispositivo.api_key_hash` (SHA-256). Gestionado por `DispositivoAPIKeyAuthentication`. El objeto autenticado es `DispositivoAutenticado` (no es un `Usuario` de Django).

#### Autorización (qué puedes hacer)
- **Permisos por rol**: En `apps/usuarios/permissions.py` existen `EsAdministrador` y `EsAdministradorOOperador`. Muchos ViewSets aplican permisos condicionales según `action` (solo **Administrador** puede crear/actualizar/eliminar/desactivar; **Administrador o Operador** pueden leer/consultar).
- **Permisos por tipo de cliente**: `EsDispositivo` permite solo a `DispositivoAutenticado`. `ImagenViewSet` combina permisos con **OR lógico** instanciado (`(EsDispositivo | EsAdministrador)()`) porque DRF evalúa instancias de permisos.
- **Aislamiento por relación**: En ingesta, se valida estrictamente que el `Sensor` pertenezca al `Dispositivo` autenticado. En consultas, el filtrado y los permisos limitan el acceso según el rol.
- **Protección general**: Cookies con `HttpOnly`, `SameSite=Lax`, `Secure` en producción. `CSRF` configurado, `X-Frame-Options: DENY`, `Content-Security-Policy` middleware, rate limiting con DRF throttles.

---

## 5. La Conexión con el Hardware (IoT - ESP32)

### ¿Cómo se conecta la placa ESP32 a la API de Django?
El ESP32 actúa como **cliente HTTP**. Para enviar datos:
1. Se autentica con el header **`X-API-Key: <clave>`** (clave en claro generada con `Dispositivo.generar_api_key()`, solo visible al momento de generarla; el servidor guarda únicamente su hash SHA-256).
2. Realiza peticiones **POST** a los endpoints de ingesta/imágenes.
3. En caso de **pérdida de conectividad**, implementa **Store & Forward**: guarda las mediciones localmente (ej. en **SD**) con su **timestamp** y las reenvía cuando vuelve la conexión, enviando el campo `fecha_hora` para conservar la hora real de la lectura.

### Endpoint `api/ingesta/mediciones/` y uso de `X-API-Key`
**Ruta**: `POST /api/ingesta/mediciones/` (definida en `apps/monitoreo/urls.py` → `IngestaMedicionView`)

**Diferencia con JWT de humanos**:
- **JWT (usuarios)**: Viaja en **cookie HttpOnly** (`hidro_access`), autenticación por usuario con roles (`EsAdministrador`/`EsAdministradorOOperador`). Usado para la interfaz web.
- **X-API-Key (dispositivos)**: Viaja en header HTTP `X-API-Key`, autenticación por **dispositivo** (`DispositivoAPIKeyAuthentication`), retorna `DispositivoAutenticado`. Usado exclusivamente para IoT. No representa un usuario humano, por lo que no pasa permisos basados en roles de usuario.

**Lógica de validación en `IngestaMedicionView`**:
- Autenticación obligatoria como dispositivo.
- Se obtiene el `sensor` por `pk` enviado en el body.
- **Validación de pertenencia**: `sensor.dispositivo_id == dispositivo.id` (evita que un dispositivo envíe lecturas de sensores de otro dispositivo).
- **Validación de estado**: Verifica `dispositivo.is_active`/`esta_activo`/estado y `sensor.is_active` (rechaza si están inactivos).
- **Validación de valor**: Convierte a `float`, rechaza si no es numérico.
- **Manejo de fecha**: Usa `fecha_hora` del request si viene (soporta reenvíos desde SD), sino `timezone.now()`. Usa `django.utils.dateparse.parse_datetime`.
- **Prevención de duplicados**: Si ya existe una `Medicion` con mismo `sensor` y misma `fecha_hora`, **no crea duplicado** (log y retorna la existente con status 201).

### "Store & Forward" (guardar en SD cuando no hay red)
Tal como se observa en el código:
- `Medicion.fecha_hora` usa `default=timezone.now` pero **acepta valor enviado** (`fecha_str = request.data.get("fecha_hora")`).
- `ImagenViewSet` también normaliza `fecha_hora` (`_parse_fecha_hora()` acepta **epoch en segundos** o **ISO-8601**, haciéndolo consciente de zona horaria).
- El ESP32 puede **almacenar localmente en tarjeta SD** las lecturas con su timestamp, y al restablecer conexión **reenviarlas en lote** al endpoint, enviando explícitamente `fecha_hora`. El servidor **preserva esa fecha original** y evita duplicados por `(sensor, fecha_hora)`. Esto garantiza integridad temporal del historial incluso con cortes de red.

---

## 6. El Módulo de Inteligencia Artificial

### ¿Cómo funciona el `Isolation Forest` (Detección de anomalías)?
Ubicado en `apps/inteligencia/ia.py`. Se utiliza **`sklearn.ensemble.IsolationForest`**, un algoritmo de **aprendizaje no supervisado**.

**Principios**:
- **Aprendizaje no supervisado**: No requiere datos etiquetados como "anómalo/normal". Aprende directamente el **patrón/histograma** de valores históricos.
- **Idea base**: Las observaciones **anómalas** son más "diferentes" y, por lo tanto, **más fáciles de aislar**. El algoritmo construye árboles aleatorios; cuantas **menos divisiones** se necesitan para aislar un punto, **mayor es su anomalía**.
- **Entrenamiento por tipo de sensor**: Cada `TipoSensor` tiene su **propio modelo** (`iforest_tipo_sensor_{tipo_sensor_id}.joblib`) guardado en `ml_models/`. Esto es correcto porque cada variable (pH, temperatura, etc.) tiene su propia distribución.
- **Datos para entrenar**: Usa **todas** las mediciones de la ventana (normales o fuera de rango). El modelo debe aprender la **distribución real** del hardware, no replicar solo las reglas fijas.
- **Configuración**: `contamination=0.05` (se espera ~5% de anomalías), `n_estimators=100`, `random_state=42`. Mínimo **50 muestras** para entrenar (`MIN_MUESTRAS_ENTRENAMIENTO`). Ventana por defecto **30 días**.
- **Score**: Se calcula desde `decision_function()` escalando a un valor **[0.0, 1.0]** (0 = normal, 1 = muy anómalo). Umbral por defecto **`UMBRAL_SCORE_ANOMALIA = 0.5`**. Se genera descripción legible con el valor, unidad y score.

**Flujo**:
1. `entrenar_modelo(tipo_sensor_id)`: Obtiene mediciones de últimos N días, entrena IsolationForest, guarda con `joblib`.
2. `cargar_modelo(tipo_sensor_id)`: Carga desde disco o entrena si no existe.
3. `evaluar_medicion(medicion)`: Obtiene score y flag `es_anomalia`.
4. `detectar_y_registrar(medicion)`: Si es anómalo, crea registro `Anomalia` en BD con contexto (cultivo, sensor, medición, score, rango esperado si existe, descripción, `modelo_version="iforest-v1"`).
5. `evaluar_mediciones_recientes(horas=1)`: Modo batch para evaluar mediciones recientes evitando duplicados (verifica si ya existe `Anomalia` para esa `medicion`).
6. `entrenar_todos_los_modelos()`: Entrena todos los tipos de sensor con datos suficientes.

### Explicar el enfoque "Híbrido" (Reglas de negocio + Machine Learning)
El sistema combina **dos enfoques complementarios**:

- **Reglas de negocio (basadas en conocimiento experto)**: 
  - Se definen **rangos operativos** (`RangoOperacion`) por sensor.
  - Permiten marcar `Medicion.estado_lectura` como `normal` / `fuera_rango`.
  - Son **explicables**, inmediatas y reflejan límites seguros/conocidos para el cultivo hidropónico.
- **Machine Learning (Isolation Forest - no supervisado)**:
  - Detecta **anomalías sutiles** que **pueden estar DENTRO** del rango operativo pero que **se apartan del patrón histórico** (comportamiento inusual, deriva gradual, valores atípicos respecto a la estacionalidad del sistema).
  - Aprende del **comportamiento real** del hardware/sistema, no solo de umbrales teóricos.
  - Genera `score` cuantificable y priorización (`alta/media/baja` según score).

**¿Por qué híbrido?** Porque las reglas garantizan **detección de violaciones obvias** (seguridad), mientras que IA descubre **comportamientos anómalos no previstos**. Además, como el proyecto indica en sus comentarios, no se usan reglas para etiquetar y entrenar IA (evitando que aprenda lo mismo), sino que **IA aprende la distribución natural** de los datos.

---

## 7. Infraestructura y Docker (Para producción)

### ¿Qué es Docker y qué va a contener nuestro `docker-compose.yml` (Django + PostgreSQL)?
**Docker** permite empaquetar la aplicación con todas sus dependencias en un **contenedor** aislado, garantizando que funcione igual en desarrollo, pruebas y producción.

Nuestro `docker-compose.yml` actual está orientado a desarrollo, pero el objetivo hacia producción es orquestar **múltiples servicios**. Según lo indicado en la tarea: *"qué va a contener nuestro `docker-compose.yml` (Django + PostgreSQL)"*.

**Composición propuesta para producción**:
- **Servicio `web` (Django)**: Construido con `Dockerfile`, ejecuta migraciones, puede levantar el planificador (`planificador`) y el servidor (gunicorn/uwsgi en producción). Comparte volúmenes para `data/` (o se migra a volumen de DB) y `media/`.
- **Servicio `db` (PostgreSQL)**: Base de datos relacional robusta, con volumen persistente para los datos. Django se conecta vía variables de entorno (`DATABASE_URL`/config).
- **(Opcional)** `nginx` como proxy reverso, certificados TLS, etc.

**Configuración actual relevante** (`docker-compose.yml`):
```yaml
services:
  web:
    build: .
    container_name: hidroponia-django
    command: >
      sh -c "python manage.py migrate --noinput &&
             (python manage.py planificador &) &&
             python manage.py runserver 0.0.0.0:8000"
    ports:
      - "8000:8000"
    volumes:
      - .:/app  # bind mount único: data/ y media/ se comparten
    environment:
      - PYTHONUNBUFFERED=1
      - DJANGO_DEBUG=1
      - DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
```

Nota del comentario: *"Todo en UN contenedor a propósito: SQLite se lleva mal con varios procesos escribiendo desde contenedores distintos."*

### ¿Por qué SQLite no es ideal para producción y por qué pasamos a PostgreSQL?
**Limitaciones de SQLite en producción**:
- **Concurrencia limitada**: SQLite usa bloqueo a nivel de archivo. Con múltiples workers/procesos escribiendo simultáneamente (servidor web + planificador + ingesta IoT concurrente), aparecen contenciones y errores de "database is locked".
- **Menor escalabilidad**: No está pensado para alta concurrencia o múltiples conexiones simultáneas.
- **Menos robusto para despliegues distribuidos**: Con contenedores separados o múltiples instancias, el archivo compartido es problemático.
- **Tipos/funcionalidades**: Menor soporte para ciertas operaciones concurrentes comparado con un servidor de BD dedicado.

**Ventajas de PostgreSQL**:
- **Concurrencia real**: Soporta múltiples conexiones simultáneas con bloqueo a nivel de fila.
- **ACID completo y robusto**: Ideal para datos críticos (mediciones, alertas, auditoría).
- **Mejor rendimiento bajo carga**: Escalable para mayor número de dispositivos IoT enviando datos.
- **Ecosistema maduro**: Integración nativa con Django, herramientas de backup, replicación, etc.
- **Preparado para contenedores**: Funciona correctamente con `docker-compose` usando **volúmenes persistentes** (`db_data`) independiente del contenedor `web`.

**Transición**: En desarrollo se mantiene SQLite por simplicidad; en producción se configurará PostgreSQL vía variables de entorno en Django (`DATABASES`) para cumplir con los requisitos de concurrencia, fiabilidad y despliegue.

---

## 8. Preguntas Frecuentes (Defensa de Tesis)

### Pregunta 1: ¿Por qué usar Django REST Framework (DRF)?
**Respuesta ideal:**
DRF nos permite crear una **API REST** limpia, organizada y segura de forma rápida. Usamos `ViewSets` + `Routers` para estandarizar CRUDs, `Serializers` para validar y transformar datos, sistema de **permisos/autenticación** flexible (soportamos JWT para usuarios y API Key para dispositivos), `throttling` para limitar peticiones, `pagination`, filtros con `django-filter` y respuestas JSON consistentes. Además, se integra perfectamente con el ORM de Django y nuestro sistema de auditoría.

### Pregunta 2: ¿Cómo evitan que la ESP32 mande datos falsos o de otro dispositivo?
**Respuesta ideal:**
Aplicamos **defensa en profundidad**:
- **Autenticación fuerte**: El ESP32 debe enviar `X-API-Key` válida. El hash SHA-256 se compara con `Dispositivo.api_key_hash` (`DispositivoAPIKeyAuthentication`). Si es inválida o el dispositivo está inactivo, se rechaza.
- **Validación de pertenencia**: En `IngestaMedicionView`, tras obtener el `sensor`, verificamos que `sensor.dispositivo_id == dispositivo.id`. **Un dispositivo solo puede enviar mediciones de sus propios sensores**.
- **Validación de estado**: Se comprueba que tanto dispositivo como sensor estén activos (`is_active`, `esta_activo`, `estado`).
- **Validación de datos**: El valor se convierte a `float` y se valida. Fechas se parsean de forma segura.
- **Rate limiting**: `ApiKeyScopedRateThrottle` con scope `iot_ingesta` limita la frecuencia de peticiones por clave de API.

### Pregunta 3: ¿Qué pasa si el servidor se cae o hay corte de red? (Store & Forward)
**Respuesta ideal:**
Implementamos **Store & Forward** desde el lado del ESP32:
- **Almacenamiento local**: Cuando no hay conectividad, las lecturas se guardan en la **tarjeta SD** con su **fecha y hora reales** (timestamp local).
- **Reenvío diferido**: Al recuperar conexión, el ESP32 reenvía esas mediciones al endpoint `POST /api/ingesta/mediciones/` incluyendo el campo `fecha_hora`.
- **Preservación temporal**: El servidor acepta `fecha_hora` enviado (`parse_datetime`), usa ese valor (en lugar de sobrescribir con "ahora") y almacena en `Medicion.fecha_hora` con `default=timezone.now` pero asignado desde el request.
- **Prevención de duplicados**: Antes de crear, se busca si existe `Medicion` con mismo `sensor` y misma `fecha_hora`; si existe, **no se duplica**.
- **Imágenes también**: `ImagenViewSet` normaliza `fecha_hora` soportando epoch/ISO-8601 para mantener consistencia.

### Pregunta 4: ¿Por qué usar Isolation Forest y no solo reglas de rango?
**Respuesta ideal:**
Usamos un **enfoque híbrido**:
- **Reglas (`RangoOperacion`)**: Detectan violaciones directas de umbrales conocidos (rápidas, explicables, críticas para seguridad operativa).
- **Isolation Forest (IA)**: Detecta **anomalías contextuales/patronales**. Al ser **no supervisado**, aprende la distribución histórica real por `TipoSensor`. Puede detectar valores **dentro del rango válido** pero **atípicos** respecto al comportamiento normal del sistema (deriva de sensor, fallo gradual, condiciones inusuales). Entrenamos **por tipo de sensor** con sus propios datos, guardamos modelos `.joblib` en `ml_models/`, evitamos entrenar con etiquetas de reglas para no duplicar lógica, y registramos resultados en `Anomalia` con `score` y descripción.

### Pregunta 5: ¿Por qué pasar de SQLite a PostgreSQL para producción? ¿Qué implica Docker aquí?
**Respuesta ideal:**
**Razones para PostgreSQL**:
- **Concurrencia**: SQLite bloquea el archivo completo; PostgreSQL maneja **múltiples conexiones concurrentes** (crítico con ingesta IoT + web + planificador + múltiples usuarios).
- **Robustez y escalabilidad**: Mejor para datos transaccionales, integridad y crecimiento del sistema.
- **Despliegue multi-proceso/contenedor**: Evita el problema comentado en `docker-compose.yml`: *"SQLite se lleva mal con varios procesos escribiendo desde contenedores distintos"*.

**Rol de Docker**:
- **`Dockerfile`**: Define la imagen con dependencias Python.
- **`docker-compose.yml`**: Orquesta servicios. En producción idealmente tendremos **`web` (Django + gunicorn)** y **`db` (Postgres)** con **volúmenes persistentes** para BD y `media/`. 
- **Aislamiento y reproducibilidad**: Mismo entorno en cualquier servidor. El `command` actual muestra el patrón (migraciones + planificador + servidor), mientras que en producción se sustituiría `runserver` por un servidor WSGI apropiado y se configuraría la conexión a PostgreSQL mediante variables de entorno.
- **Persistencia**: `data/` y `media/` se manejan con volúmenes; para Postgres usaríamos un volumen dedicado (`postgres_data`).
Documento de presentación creado en GUIA_PRESENTACION.md