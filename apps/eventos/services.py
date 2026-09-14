from django.utils import timezone
from apps.dispositivos.models import Dispositivo
from apps.monitoreo.models import Medicion
from apps.alertas.models import ParametroAlerta
from apps.eventos.models import Evento


def detectar_sensores_sin_comunicacion():
    """RF-18: un sensor individual silencioso > tiempo configurado."""
    eventos_creados = []
    for dispositivo in Dispositivo.objects.filter(estado=Dispositivo.Estado.ACTIVO):
        for sensor in dispositivo.sensores.all():
            ultima = sensor.mediciones.order_by("-fecha_hora").first()
            parametro = ParametroAlerta.objects.filter(tipo_sensor=sensor.tipo_sensor).first()
            if not parametro:
                continue
            limite = timezone.now() - parametro.tiempo_maximo_sin_lectura
            silencioso = (ultima is None) or (ultima.fecha_hora < limite)
            if silencioso:
                ya_existe = Evento.objects.filter(
                    tipo_evento=Evento.TipoEvento.SENSOR_SIN_COMUNICACION,
                    dispositivo=dispositivo, cultivo=dispositivo.cultivo,
                ).exists()
                if not ya_existe:
                    evento = Evento.objects.create(
                        tipo_evento=Evento.TipoEvento.SENSOR_SIN_COMUNICACION,
                        dispositivo=dispositivo, cultivo=dispositivo.cultivo,
                    )
                    eventos_creados.append(evento)
    return eventos_creados


def detectar_corte_electrico():
    """RF-31: todos los dispositivos de un cultivo silenciosos a la vez."""
    eventos_creados = []
    cultivos_ids = Dispositivo.objects.values_list("cultivo_id", flat=True).distinct()
    for cultivo_id in cultivos_ids:
        dispositivos = Dispositivo.objects.filter(cultivo_id=cultivo_id, estado=Dispositivo.Estado.ACTIVO)
        if not dispositivos.exists():
            continue
        todos_silenciosos = all(_esta_silencioso(d) for d in dispositivos)
        if todos_silenciosos:
            ya_existe = Evento.objects.filter(
                tipo_evento=Evento.TipoEvento.CORTE_ELECTRICO, cultivo_id=cultivo_id, dispositivo__isnull=True,
            ).exists()
            if not ya_existe:
                evento = Evento.objects.create(
                    tipo_evento=Evento.TipoEvento.CORTE_ELECTRICO, dispositivo=None, cultivo_id=cultivo_id,
                )
                eventos_creados.append(evento)
    return eventos_creados


def _esta_silencioso(dispositivo):
    for sensor in dispositivo.sensores.all():
        ultima = sensor.mediciones.order_by("-fecha_hora").first()
        parametro = ParametroAlerta.objects.filter(tipo_sensor=sensor.tipo_sensor).first()
        if not parametro:
            continue
        limite = timezone.now() - parametro.tiempo_maximo_sin_lectura
        if ultima and ultima.fecha_hora >= limite:
            return False
    return True


def detectar_bomba_sin_caudal(umbral_caudal):
    """RF-32: bomba activa + caudal por debajo del umbral."""
    eventos_creados = []
    bombas = Dispositivo.objects.filter(
        tipo_dispositivo=Dispositivo.TipoDispositivo.BOMBA, estado=Dispositivo.Estado.ACTIVO,
    )
    for bomba in bombas:
        sensor_caudal = Medicion.objects.filter(
            sensor__dispositivo__cultivo=bomba.cultivo, sensor__tipo_sensor__nombre__icontains="caudal",
        ).order_by("-fecha_hora").first()
        if sensor_caudal and sensor_caudal.valor < umbral_caudal:
            ya_existe = Evento.objects.filter(
                tipo_evento=Evento.TipoEvento.BOMBA_SIN_CAUDAL, dispositivo=bomba,
            ).exists()
            if not ya_existe:
                evento = Evento.objects.create(
                    tipo_evento=Evento.TipoEvento.BOMBA_SIN_CAUDAL, dispositivo=bomba, cultivo=bomba.cultivo,
                )
                eventos_creados.append(evento)
    return eventos_creados