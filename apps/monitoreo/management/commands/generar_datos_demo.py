"""
Genera datos de prueba para HidroSensor.

Uso:
    python manage.py generar_datos_demo

Crea:
- 4 dispositivos (2 ESP32 con sensores, 1 bomba, 1 cámara)
- Sensores de pH, conductividad, temperatura, luz y oxígeno
- Mediciones de las últimas 24 horas
- Alertas activas y resueltas
"""
import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.cultivos.models import Cultivo, CicloProduccion
from apps.dispositivos.models import Dispositivo
from apps.monitoreo.models import TipoSensor, Sensor, Medicion, RangoOperacion
from apps.alertas.models import Alerta, ParametroAlerta
from apps.eventos.models import Evento
from apps.usuarios.models import Usuario


class Command(BaseCommand):
    help = "Genera datos de prueba para HidroSensor"

    def handle(self, *args, **options):
        self.stdout.write("🌱 Generando datos de prueba...")

        # --- 1. Usuario admin (por si no existe) ---
        admin = Usuario.objects.filter(rol="administrador").first()
        if not admin:
            admin = Usuario.objects.create_user(
                username="admin", password="admin1234", rol="administrador",
            )
        self.stdout.write(f"   Admin: {admin.username}")

        # --- 2. Cultivo activo ---
        cultivo, created = Cultivo.objects.get_or_create(
            nombre="Lechuga",
            defaults={
                "tipo_cultivo": "Hortaliza",
                "fecha_creacion": timezone.now().date() - timedelta(days=12),
                "usuario": admin,
            },
        )
        if created:
            self.stdout.write(f"   ✓ Cultivo creado: {cultivo.nombre}")
        else:
            self.stdout.write(f"   · Cultivo existente: {cultivo.nombre}")

        # Ciclo de producción
        ciclo, _ = CicloProduccion.objects.get_or_create(
            cultivo=cultivo,
            defaults={
                "fecha_inicio": timezone.now().date() - timedelta(days=12),
                "estado": "crecimiento",
            },
        )
        self.stdout.write(f"   ✓ Ciclo: {ciclo.estado}")

        # --- 3. Dispositivos ---
        self.stdout.write("\n📟 Creando dispositivos...")

        disp_esp32, _ = Dispositivo.objects.get_or_create(
            identificador_hardware="ESP32-001",
            defaults={
                "nombre": "EPS01",
                "tipo_dispositivo": "sensor",
                "cultivo": cultivo,
                "estado": "activo",
            },
        )
        self.stdout.write(f"   ✓ {disp_esp32.nombre}")

        disp_bomba, _ = Dispositivo.objects.get_or_create(
            identificador_hardware="BOMBA-001",
            defaults={
                "nombre": "Bomba-01",
                "tipo_dispositivo": "bomba",
                "cultivo": cultivo,
                "estado": "activo",
            },
        )
        self.stdout.write(f"   ✓ {disp_bomba.nombre}")

        disp_cam, _ = Dispositivo.objects.get_or_create(
            identificador_hardware="CAM-001",
            defaults={
                "nombre": "Camara-01",
                "tipo_dispositivo": "otro",
                "cultivo": cultivo,
                "estado": "activo",
                "ip_local": "192.168.1.50",
                "permite_polling": True,
            },
        )
        self.stdout.write(f"   ✓ {disp_cam.nombre}")

        # --- 4. Tipos de sensor y sensores ---
        self.stdout.write("\n🌡️  Creando sensores...")

        # Asegurar tipos de sensor con valores físicos
        tipos_config = [
            ("ph", "pH", 0, 14),
            ("conductividad", "uS/cm", 0, 5000),
            ("temperatura", "C", -10, 60),
            ("humedad", "%", 0, 100),
            ("caudal", "L/min", 0, 50),
        ]
        tipos = {}
        for nombre, unidad, vmin, vmax in tipos_config:
            tipo, _ = TipoSensor.objects.get_or_create(
                nombre=nombre,
                defaults={
                    "unidad_medida": unidad,
                    "valor_min_fisico": vmin,
                    "valor_max_fisico": vmax,
                },
            )
            tipos[nombre] = tipo

        # Luz (agregar tipo extra)
        tipo_luz, _ = TipoSensor.objects.get_or_create(
            nombre="luz",
            defaults={
                "unidad_medida": "umol/m2/s",
                "valor_min_fisico": 0,
                "valor_max_fisico": 2000,
            },
        )
        tipos["luz"] = tipo_luz

        # Crear sensores
        sensores_config = [
            ("ph", 5.5, 6.5),
            ("conductividad", 1300, 2000),
            ("temperatura", 18, 26),
            ("luz", 200, 500),
        ]
        sensores = []
        for nombre_tipo, vmin, vmax in sensores_config:
            sensor, _ = Sensor.objects.get_or_create(
                dispositivo=disp_esp32,
                tipo_sensor=tipos[nombre_tipo],
            )
            sensores.append(sensor)

            # Rango de operación
            RangoOperacion.objects.get_or_create(
                sensor=sensor,
                valor_min=vmin,
                valor_max=vmax,
            )

        self.stdout.write(f"   ✓ {len(sensores)} sensores creados")

        # --- 5. Mediciones de las últimas 24 horas ---
        self.stdout.write("\n📈 Generando mediciones...")

        # Borrar mediciones viejas para no duplicar
        Medicion.objects.filter(sensor__in=sensores).delete()

        ahora = timezone.now()
        for sensor in sensores:
            nombre_tipo = sensor.tipo_sensor.nombre

            # Valores típicos según tipo
            if nombre_tipo == "ph":
                base = 6.1
                var = 0.3
            elif nombre_tipo == "conductividad":
                base = 1800
                var = 100
            elif nombre_tipo == "temperatura":
                base = 22
                var = 1.5
            elif nombre_tipo == "luz":
                base = 320
                var = 40
            else:
                base = 50
                var = 5

            # Generar 48 mediciones (cada 30 min)
            for i in range(48):
                valor = base + random.uniform(-var, var)
                Medicion.objects.create(
                    sensor=sensor,
                    valor=round(valor, 2),
                    estado_lectura="normal",
                )
                # Ajustar fecha (Django auto_now_add no se puede setear al crear)
                m = Medicion.objects.latest("pk")
                Medicion.objects.filter(pk=m.pk).update(
                    fecha_hora=ahora - timedelta(minutes=30 * i)
                )

        total_mediciones = Medicion.objects.filter(sensor__in=sensores).count()
        self.stdout.write(f"   ✓ {total_mediciones} mediciones generadas")

        # --- 6. Parámetros de alerta ---
        self.stdout.write("\n⚠️  Configurando alertas...")

        for nombre_tipo, tipo in tipos.items():
            ParametroAlerta.objects.get_or_create(
                tipo_sensor=tipo,
                defaults={
                    "tiempo_maximo_sin_lectura": timedelta(hours=1),
                    "lecturas_consecutivas_apertura": 3,
                    "lecturas_consecutivas_cierre": 3,
                    "umbral_desviacion_alta": 20.0,
                    "valor_umbral_alerta": None,
                },
            )

        # --- 7. Alertas de ejemplo ---
        # Evento para vincular la alerta
        evento, _ = Evento.objects.get_or_create(
            tipo_evento="sensor_sin_comunicacion",
            cultivo=cultivo,
            defaults={
                "descripcion": "Sensor de pH sin comunicación por 2 horas",
                "dispositivo": disp_esp32,
                "ciclo": ciclo,
            },
        )

        # Alerta 1: activa, crítica
        Alerta.objects.get_or_create(
            evento=evento,
            defaults={
                "severidad": "alta",
                "estado": "activa",
            },
        )

        # Alerta 2: activa, media (vinculada a una medición)
        medicion_ph = Medicion.objects.filter(sensor__tipo_sensor__nombre="ph").first()
        if medicion_ph:
            Alerta.objects.get_or_create(
                medicion=medicion_ph,
                defaults={
                    "severidad": "media",
                    "estado": "activa",
                },
            )

        total_alertas = Alerta.objects.count()
        self.stdout.write(f"   ✓ {total_alertas} alertas generadas")

        # --- Resumen final ---
        self.stdout.write("\n" + "=" * 50)
        self.stdout.write(self.style.SUCCESS("✅ Datos de prueba generados"))
        self.stdout.write("=" * 50)
        self.stdout.write(f"  Usuarios:       {Usuario.objects.count()}")
        self.stdout.write(f"  Cultivos:       {Cultivo.objects.count()}")
        self.stdout.write(f"  Dispositivos:   {Dispositivo.objects.count()}")
        self.stdout.write(f"  Sensores:       {Sensor.objects.count()}")
        self.stdout.write(f"  Mediciones:     {Medicion.objects.count()}")
        self.stdout.write(f"  Alertas:        {Alerta.objects.count()}")
        self.stdout.write("=" * 50)