import csv
import io

from django.core.files.base import ContentFile
from django.utils import timezone

from apps.reportes.models import Reporte

# ---------------------------------------------------------------------------
# RECOLECTORES: uno por tipo de reporte. Devuelven lista de diccionarios.


def _datos_monitoreo(reporte):
    from apps.monitoreo.models import Medicion
    qs = Medicion.objects.filter(
        fecha_hora__date__gte=reporte.fecha_desde,
        fecha_hora__date__lte=reporte.fecha_hasta,
    ).select_related("sensor", "sensor__tipo_sensor")
    if reporte.cultivo:
        qs = qs.filter(sensor__dispositivo__cultivo=reporte.cultivo)
    return list(qs.values("id", "sensor__tipo_sensor__nombre", "valor", "fecha_hora"))


def _datos_alertas(reporte):
    from apps.alertas.models import Alerta
    qs = Alerta.objects.filter(
        fecha_hora_inicio__date__gte=reporte.fecha_desde,
        fecha_hora_inicio__date__lte=reporte.fecha_hasta,
    )
    if reporte.cultivo:
        qs = qs.filter(medicion__sensor__dispositivo__cultivo=reporte.cultivo)
    return list(qs.values("id", "severidad", "estado", "fecha_hora_inicio", "fecha_hora_fin"))


def _datos_eventos(reporte):
    from apps.eventos.models import Evento
    qs = Evento.objects.filter(
        fecha_hora__date__gte=reporte.fecha_desde,
        fecha_hora__date__lte=reporte.fecha_hasta,
    )
    if reporte.cultivo:
        qs = qs.filter(cultivo=reporte.cultivo)
    return list(qs.values("id", "tipo_evento", "fecha_hora", "dispositivo", "cultivo"))


def _datos_crecimiento(reporte):
    from apps.inteligencia.models import AnalisisImagen
    qs = AnalisisImagen.objects.filter(
        fecha_hora__date__gte=reporte.fecha_desde,
        fecha_hora__date__lte=reporte.fecha_hasta,
    )
    if reporte.cultivo:
        qs = qs.filter(cultivo=reporte.cultivo)
    return list(qs.values("id", "fecha_hora", "altura_estimada_cm", "area_foliar_cm2"))


def _datos_intervenciones(reporte):
    from apps.intervenciones.models import Intervencion
    qs = Intervencion.objects.filter(
        fecha_hora__date__gte=reporte.fecha_desde,
        fecha_hora__date__lte=reporte.fecha_hasta,
    )
    return list(qs.values("id", "alerta", "operador", "observaciones", "fecha_hora", "resuelta"))


def _datos_recomendaciones(reporte):
    from apps.inteligencia.models import Recomendacion
    qs = Recomendacion.objects.filter(
        fecha__date__gte=reporte.fecha_desde,
        fecha__date__lte=reporte.fecha_hasta,
    )
    if reporte.cultivo:
        qs = qs.filter(cultivo=reporte.cultivo)
    return list(qs.values("id", "tipo", "prioridad", "titulo", "detalle", "fecha"))


# Mapa tipo → función recolectora
DISPATCH = {
    Reporte.Tipo.MONITOREO: _datos_monitoreo,
    Reporte.Tipo.ALERTAS: _datos_alertas,
    Reporte.Tipo.EVENTOS: _datos_eventos,
    Reporte.Tipo.CRECIMIENTO: _datos_crecimiento,
    Reporte.Tipo.INTERVENCIONES: _datos_intervenciones,
    Reporte.Tipo.RECOMENDACIONES: _datos_recomendaciones,
}


# ---------------------------------------------------------------------------
# GENERADORES: convierten la lista de datos al formato pedido.


def _generar_csv(datos):
    if not datos:
        return b"sin_datos\n"
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=list(datos[0].keys()))
    writer.writeheader()
    writer.writerows(datos)
    return buf.getvalue().encode("utf-8")


def _generar_excel(datos):
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Reporte"
    if datos:
        cols = list(datos[0].keys())
        ws.append(cols)
        for fila in datos:
            ws.append([str(fila.get(c, "")) for c in cols])
    else:
        ws.append(["Sin datos en el período"])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _generar_pdf(reporte, datos):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    ancho, alto = A4
    y = alto - 2 * cm

    # Encabezado
    c.setFont("Helvetica-Bold", 14)
    c.drawString(2 * cm, y, f"Reporte: {reporte.get_tipo_display()}")
    y -= 0.8 * cm
    c.setFont("Helvetica", 10)
    c.drawString(2 * cm, y, f"Período: {reporte.fecha_desde} -> {reporte.fecha_hasta}")
    y -= 0.6 * cm
    if reporte.cultivo:
        c.drawString(2 * cm, y, f"Cultivo: {reporte.cultivo.nombre}")
        y -= 0.6 * cm
    c.drawString(2 * cm, y, f"Total de registros: {len(datos)}")
    y -= 1 * cm

    # Tabla simple (máximo 45 filas por página)
    if not datos:
        c.drawString(2 * cm, y, "Sin datos en el período.")
    else:
        cols = list(datos[0].keys())
        c.setFont("Helvetica-Bold", 8)
        c.drawString(2 * cm, y, " | ".join(cols[:5]))
        y -= 0.4 * cm
        c.setFont("Helvetica", 8)
        for fila in datos[:45]:
            linea = " | ".join(str(fila.get(k, ""))[:20] for k in cols[:5])
            c.drawString(2 * cm, y, linea)
            y -= 0.4 * cm
            if y < 2 * cm:
                c.showPage()
                y = alto - 2 * cm

    c.save()
    return buf.getvalue()


# ORQUESTADOR: función principal que coordina todo.


def generar_reporte(reporte):
    try:
        reporte.estado = Reporte.Estado.GENERANDO
        reporte.save(update_fields=["estado"])

        fn = DISPATCH.get(reporte.tipo)
        if not fn:
            raise ValueError(f"Tipo no soportado: {reporte.tipo}")

        datos = fn(reporte)
        reporte.total_registros = len(datos)

        if reporte.formato == Reporte.Formato.CSV:
            contenido, ext = _generar_csv(datos), "csv"
        elif reporte.formato == Reporte.Formato.EXCEL:
            contenido, ext = _generar_excel(datos), "xlsx"
        else:
            contenido, ext = _generar_pdf(reporte, datos), "pdf"

        nombre = f"reporte_{reporte.tipo}_{reporte.fecha_desde:%Y%m%d}_{reporte.fecha_hasta:%Y%m%d}.{ext}"
        reporte.archivo.save(nombre, ContentFile(contenido), save=False)
        reporte.estado = Reporte.Estado.LISTO
        reporte.fecha_generacion = timezone.now()
        reporte.error_detalle = ""
        reporte.save()

    except Exception as e:
        reporte.estado = Reporte.Estado.ERROR
        reporte.error_detalle = str(e)
        reporte.save()

    return reporte