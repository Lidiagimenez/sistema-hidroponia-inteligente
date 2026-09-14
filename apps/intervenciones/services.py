from apps.intervenciones.models import Intervencion


def crear_intervencion(alerta, operador, observaciones):
    return Intervencion.objects.create(alerta=alerta, operador=operador, observaciones=observaciones)


def resolver_intervencion(intervencion):
    intervencion.resuelta = True
    intervencion.save(update_fields=["resuelta"])
    return intervencion
