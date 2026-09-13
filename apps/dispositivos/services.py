from apps.dispositivos.models import Dispositivo

def crear_dispositivo(nombre, tipo_dispositivo, identificador_hardware, cultivo):
    return Dispositivo.objects.create(
        nombre=nombre,
        tipo_dispositivo=tipo_dispositivo,
        identificador_hardware=identificador_hardware,
        cultivo=cultivo,
    )

def cambiar_estado_dispositivo(dispositivo, nuevo_estado):
    dispositivo.estado = nuevo_estado
    dispositivo.save(update_fields=["estado"])
    return dispositivo